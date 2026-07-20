use crate::{
    analysis::{Analysis, analyze, hash_bytes},
    config::{load_source, load_verifications},
};
use anyhow::{Context, Result, bail};
use sqlx::{Connection, Row, SqliteConnection};
use std::{
    fs,
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

pub const DB_APPLICATION_ID: i64 = 0x4b4e4f57;
pub const SCHEMA_VERSION: i64 = 1;

pub async fn recompute(root: &Path) -> Result<Analysis> {
    analyze(root, load_source(root)?, &load_verifications(root)?)
}

pub async fn rebuild(root: &Path) -> Result<Analysis> {
    let analysis = recompute(root).await?;
    let know = root.join(".know");
    let cache = know.join("cache");
    fs::create_dir_all(&cache)?;
    let nonce = SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos();
    let temp_lock = know.join(format!(".linkVerification.lock.{nonce}.tmp"));
    let temp_db = cache.join(format!(".know.{nonce}.tmp.sqlite"));
    let lock_text = toml::to_string_pretty(&analysis.lockfile)?;
    fs::write(&temp_lock, &lock_text)?;
    write_database(&temp_db, &analysis, hash_bytes(lock_text.as_bytes())).await?;
    let lock_path = know.join("linkVerification.lock.toml");
    let db_path = cache.join("know.sqlite");
    replace_file(&temp_lock, &lock_path)?;
    replace_file(&temp_db, &db_path)?;
    fs::create_dir_all(cache.join("semantic"))?;
    Ok(analysis)
}

fn replace_file(source: &Path, destination: &Path) -> Result<()> {
    if destination.exists() {
        fs::remove_file(destination)?;
    }
    fs::rename(source, destination)?;
    Ok(())
}

async fn write_database(path: &Path, analysis: &Analysis, lock_hash: String) -> Result<()> {
    let url = format!("sqlite://{}?mode=rwc", path.display());
    let mut connection = SqliteConnection::connect(&url).await?;
    sqlx::query(&format!("PRAGMA application_id = {DB_APPLICATION_ID}"))
        .execute(&mut connection)
        .await?;
    sqlx::query(&format!("PRAGMA user_version = {SCHEMA_VERSION}"))
        .execute(&mut connection)
        .await?;
    sqlx::query(
        "CREATE TABLE metadata(key TEXT PRIMARY KEY, value TEXT NOT NULL);
         CREATE TABLE rule_data(id TEXT PRIMARY KEY, description TEXT NOT NULL, rationale TEXT NOT NULL, concepts_json TEXT NOT NULL, tags_json TEXT NOT NULL);
         CREATE TABLE concept_data(id TEXT PRIMARY KEY, description TEXT NOT NULL, tags_json TEXT NOT NULL);
         CREATE TABLE link_data(id INTEGER PRIMARY KEY, rule_id TEXT NOT NULL, kind TEXT NOT NULL, target TEXT NOT NULL, tags_json TEXT NOT NULL, status TEXT NOT NULL, reasons_json TEXT NOT NULL);
         CREATE TABLE resolved_target(link_id INTEGER NOT NULL, path TEXT NOT NULL);
         CREATE TABLE unlinked_rule_data(rule_id TEXT PRIMARY KEY);
         CREATE VIEW rules AS SELECT * FROM rule_data;
         CREATE VIEW concepts AS SELECT * FROM concept_data;
         CREATE VIEW links AS SELECT id, rule_id, kind, target, tags_json FROM link_data;
         CREATE VIEW link_verification_status AS SELECT rule_id, kind, target, status, reasons_json FROM link_data;
         CREATE VIEW unlinked_rules AS SELECT rule_id FROM unlinked_rule_data;
         CREATE VIEW read_model_metadata AS SELECT key, value FROM metadata;
         CREATE VIEW rule_context AS
           SELECT r.id AS rule_id, r.description, r.rationale, r.concepts_json, r.tags_json,
                  l.kind, l.target, l.tags_json AS link_tags_json, l.status, l.reasons_json,
                  t.path AS resolved_path
           FROM rule_data r JOIN link_data l ON l.rule_id = r.id
           LEFT JOIN resolved_target t ON t.link_id = l.id;",
    )
    .execute(&mut connection)
    .await?;
    for (key, value) in [
        (
            "source_model_hash",
            analysis.lockfile.source_model_hash.as_str(),
        ),
        (
            "link_verification_hash",
            analysis.lockfile.link_verification_hash.as_str(),
        ),
        (
            "resolved_model_hash",
            analysis.lockfile.resolved_model_hash.as_str(),
        ),
        ("link_verification_lock_hash", lock_hash.as_str()),
        ("read_model_schema_version", "1"),
        ("stable_view_contract_version", "1"),
    ] {
        sqlx::query("INSERT INTO metadata(key,value) VALUES(?,?)")
            .bind(key)
            .bind(value)
            .execute(&mut connection)
            .await?;
    }
    for rule in &analysis.source.rules {
        sqlx::query("INSERT INTO rule_data VALUES(?,?,?,?,?)")
            .bind(&rule.id)
            .bind(&rule.description)
            .bind(&rule.rationale)
            .bind(serde_json::to_string(&rule.concepts)?)
            .bind(serde_json::to_string(&rule.tags)?)
            .execute(&mut connection)
            .await?;
    }
    for concept in &analysis.source.concepts {
        sqlx::query("INSERT INTO concept_data VALUES(?,?,?)")
            .bind(&concept.id)
            .bind(&concept.description)
            .bind(serde_json::to_string(&concept.tags)?)
            .execute(&mut connection)
            .await?;
    }
    for link in &analysis.resolved_links {
        let result = sqlx::query("INSERT INTO link_data(rule_id,kind,target,tags_json,status,reasons_json) VALUES(?,?,?,?,?,?)")
            .bind(&link.rule.id)
            .bind(link.link.kind.as_str())
            .bind(&link.link.target)
            .bind(serde_json::to_string(&link.link.tags)?)
            .bind(link.status.as_str())
            .bind(serde_json::to_string(&link.reasons)?)
            .execute(&mut connection)
            .await?;
        let id = result.last_insert_rowid();
        for target in &link.resolved_targets {
            sqlx::query("INSERT INTO resolved_target(link_id,path) VALUES(?,?)")
                .bind(id)
                .bind(target)
                .execute(&mut connection)
                .await?;
        }
    }
    for rule in &analysis.lockfile.unlinked_rules {
        sqlx::query("INSERT INTO unlinked_rule_data VALUES(?)")
            .bind(&rule.rule)
            .execute(&mut connection)
            .await?;
    }
    connection.close().await?;
    Ok(())
}

pub async fn open_read_model(root: &Path) -> Result<SqliteConnection> {
    let path = root.join(".know/cache/know.sqlite");
    if !path.exists() {
        bail!("generated read model is missing; run `know index`");
    }
    let url = format!("sqlite://{}?mode=ro", path.display());
    let mut connection = SqliteConnection::connect(&url)
        .await
        .context("cannot open generated read model; run `know index`")?;
    let application_id: i64 = sqlx::query("PRAGMA application_id")
        .fetch_one(&mut connection)
        .await?
        .get(0);
    let schema: i64 = sqlx::query("PRAGMA user_version")
        .fetch_one(&mut connection)
        .await?
        .get(0);
    if application_id != DB_APPLICATION_ID || schema != SCHEMA_VERSION {
        bail!("generated read model is incompatible; run `know index`");
    }
    Ok(connection)
}

pub async fn freshness(root: &Path, current: &Analysis) -> Result<Freshness> {
    let lock_path = root.join(".know/linkVerification.lock.toml");
    let expected = toml::to_string_pretty(&current.lockfile)?;
    let lock_fresh = fs::read_to_string(&lock_path).is_ok_and(|actual| actual == expected);
    let mut connection = match open_read_model(root).await {
        Ok(connection) => connection,
        Err(_) => {
            return Ok(Freshness {
                lock_fresh,
                index_fresh: false,
            });
        }
    };
    let stored: Option<String> =
        sqlx::query_scalar("SELECT value FROM metadata WHERE key='resolved_model_hash'")
            .fetch_optional(&mut connection)
            .await?;
    let stored_lock: Option<String> =
        sqlx::query_scalar("SELECT value FROM metadata WHERE key='link_verification_lock_hash'")
            .fetch_optional(&mut connection)
            .await?;
    let actual_lock_hash = fs::read(&lock_path).ok().map(|bytes| hash_bytes(&bytes));
    Ok(Freshness {
        lock_fresh,
        index_fresh: stored.as_deref() == Some(&current.lockfile.resolved_model_hash)
            && stored_lock == actual_lock_hash,
    })
}

pub struct Freshness {
    pub lock_fresh: bool,
    pub index_fresh: bool,
}

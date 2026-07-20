use crate::{
    analysis::Status,
    codex_hook,
    config::{
        LinkKind, Verification, VerificationFile, find_root, load_verifications,
        write_verifications,
    },
    index,
    output::CheckOutput,
};
use anyhow::{Context, Result, bail};
use clap::{Parser, Subcommand, ValueEnum};
use serde::Serialize;
use sqlx::Row;
use std::{env, fs, io::IsTerminal, path::Path};

#[derive(Parser)]
#[command(
    name = "know",
    version,
    about = "Surface hidden rules before code changes"
)]
struct Cli {
    #[command(subcommand)]
    command: Option<Command>,
}

#[derive(Subcommand)]
enum Command {
    /// Initialize .know in the current repository
    Init {
        #[arg(long)]
        overwrite: bool,
        #[arg(long)]
        dry_run: bool,
    },
    /// Rebuild the lockfile and SQLite read model
    Index,
    /// Return rules that apply before editing a target
    Context {
        target: String,
        #[arg(long, value_enum)]
        kind: Option<KindArg>,
        #[arg(long, value_enum, default_value = "text")]
        format: Format,
        #[arg(long)]
        count: bool,
        #[arg(long)]
        require_fresh: bool,
    },
    /// Recompute and report source health without writing
    Check {
        #[arg(long, value_enum, default_value = "text")]
        format: Format,
        #[arg(long, value_enum, default_value = "broken")]
        fail_on: FailOn,
    },
    /// Approve current rule-link-code fingerprints
    Verify {
        #[arg(long)]
        rule: Option<String>,
        #[arg(long)]
        target: Option<String>,
        #[arg(long, value_enum)]
        kind: Option<KindArg>,
        #[arg(long)]
        all: bool,
        #[arg(long)]
        dry_run: bool,
    },
    /// Print a concise project health summary from the read model
    Status {
        #[arg(long, value_enum, default_value = "text")]
        format: Format,
    },
    /// Integration adapters for coding agents
    #[command(hide = true)]
    Hook {
        #[command(subcommand)]
        integration: HookIntegration,
    },
}

#[derive(Subcommand)]
enum HookIntegration {
    /// Inject linked rules before Codex file edits
    Codex,
}

#[derive(Clone, Copy, ValueEnum)]
enum Format {
    Text,
    Json,
}

#[derive(Clone, Copy, ValueEnum)]
enum KindArg {
    Path,
    Glob,
    Symbol,
}

impl From<KindArg> for LinkKind {
    fn from(value: KindArg) -> Self {
        match value {
            KindArg::Path => Self::Path,
            KindArg::Glob => Self::Glob,
            KindArg::Symbol => Self::Symbol,
        }
    }
}

#[derive(Clone, Copy, ValueEnum)]
enum FailOn {
    Invalid,
    Unverified,
    Broken,
    Unlinked,
    StaleLockfile,
    StaleIndex,
    SourceIssue,
}

#[derive(Serialize)]
struct CheckJson<'a> {
    #[serde(flatten)]
    summary: &'a CheckOutput,
    issues: Vec<CheckIssue>,
}

#[derive(Serialize)]
struct CheckIssue {
    status: String,
    rule: String,
    kind: String,
    target: String,
    reasons: Vec<String>,
}

pub async fn run() -> Result<u8> {
    let cli = Cli::parse();
    let Some(command) = cli.command else {
        if std::io::stdin().is_terminal() {
            println!("Know is ready. Start with `know init` or run `know --help`.");
        } else {
            println!("Run `know --help` for usage.");
        }
        return Ok(0);
    };
    match command {
        Command::Init { overwrite, dry_run } => init(overwrite, dry_run),
        Command::Index => {
            let root = project_root()?;
            let analysis = index::rebuild(&root).await?;
            println!(
                "Indexed {} rules and {} links.",
                analysis.source.rules.len(),
                analysis.resolved_links.len()
            );
            println!("Next: `know context <target>` or `know verify --all`.");
            Ok(0)
        }
        Command::Context {
            target,
            kind,
            format,
            count,
            require_fresh,
        } => context(&target, kind.map(Into::into), format, count, require_fresh).await,
        Command::Check { format, fail_on } => check(format, fail_on).await,
        Command::Verify {
            rule,
            target,
            kind,
            all,
            dry_run,
        } => verify(rule, target, kind.map(Into::into), all, dry_run).await,
        Command::Status { format } => status(format).await,
        Command::Hook { integration } => match integration {
            HookIntegration::Codex => codex_hook::run().await,
        },
    }
}

fn project_root() -> Result<std::path::PathBuf> {
    find_root(&env::current_dir()?)
}

fn init(overwrite: bool, dry_run: bool) -> Result<u8> {
    let root = env::current_dir()?;
    let know = root.join(".know");
    if know.exists() && !overwrite {
        bail!(".know already exists; use `know init --overwrite` to replace it");
    }
    if dry_run {
        println!(
            "Would create .know/rules, .know/concepts, .know/cache, verification files, and an example rule."
        );
        return Ok(0);
    }
    if overwrite {
        fs::remove_dir_all(&know).ok();
    }
    fs::create_dir_all(know.join("rules"))?;
    fs::create_dir_all(know.join("concepts"))?;
    fs::create_dir_all(know.join("cache"))?;
    fs::write(know.join(".gitignore"), "cache/\n")?;
    fs::write(
        know.join("linkVerification.toml"),
        "version = 1\nlinks = []\n",
    )?;
    fs::write(
        know.join("linkVerification.lock.toml"),
        "version = 1\nsource_model_hash = \"\"\nlink_verification_hash = \"\"\nresolved_model_hash = \"\"\nlinks = []\nunlinked_rules = []\n",
    )?;
    let link = if root.join("README.md").is_file() {
        "\n[[rules.links]]\ntarget = \"README.md\"\nkind = \"path\"\n"
    } else {
        ""
    };
    fs::write(
        know.join("rules/example.toml"),
        format!(
            "[[rules]]\nid = \"explain-non-obvious-decisions\"\ndescription = \"Non-obvious decisions in this area must preserve their documented intent.\"\nrationale = \"Future maintainers and AI agents need the reason, not only the implementation.\"{link}"
        ),
    )?;
    fs::write(know.join("concepts/example.toml"), "concepts = []\n")?;
    println!("Initialized .know/.");
    println!("Next: edit .know/rules/example.toml, then run `know index`.");
    Ok(0)
}

#[derive(Serialize)]
struct ContextOutput {
    target: String,
    freshness: &'static str,
    rules: Vec<ContextRule>,
    next_actions: Vec<String>,
}

#[derive(Serialize)]
struct ContextRule {
    id: String,
    description: String,
    rationale: String,
    concepts: Vec<String>,
    tags: Vec<String>,
    link: ContextLink,
}

#[derive(Serialize)]
struct ContextLink {
    kind: String,
    target: String,
    status: String,
    reasons: Vec<String>,
}

async fn context(
    target: &str,
    kind: Option<LinkKind>,
    format: Format,
    count: bool,
    require_fresh: bool,
) -> Result<u8> {
    let root = project_root()?;
    let current = index::recompute(&root).await?;
    let freshness = index::freshness(&root, &current).await?;
    if !freshness.index_fresh {
        if require_fresh {
            bail!("generated read model is stale; run `know index`");
        }
        eprintln!(
            "warning: generated read model is stale; showing last indexed context (run `know index`)"
        );
    }
    let query_kind = kind.unwrap_or_else(|| infer_kind(&root, target));
    let query_targets = resolve_query_targets(&root, target, query_kind)?;
    let mut connection = index::open_read_model(&root).await?;
    let mut rows = Vec::new();
    if query_kind == LinkKind::Symbol {
        rows = sqlx::query(
            "SELECT DISTINCT rule_id,description,rationale,concepts_json,tags_json,kind,target,link_tags_json,status,reasons_json
             FROM rule_context WHERE kind='symbol' AND target=? ORDER BY rule_id,target",
        )
        .bind(target)
        .fetch_all(&mut connection)
        .await?;
    } else {
        for query_target in query_targets {
            rows.extend(
                sqlx::query(
                    "SELECT DISTINCT rule_id,description,rationale,concepts_json,tags_json,kind,target,link_tags_json,status,reasons_json
                     FROM rule_context WHERE resolved_path=? ORDER BY rule_id,target",
                )
                .bind(query_target)
                .fetch_all(&mut connection)
                .await?,
            );
        }
    }
    let mut output = rows
        .into_iter()
        .map(|row| -> Result<ContextRule> {
            Ok(ContextRule {
                id: row.try_get("rule_id")?,
                description: row.try_get("description")?,
                rationale: row.try_get("rationale")?,
                concepts: serde_json::from_str(row.try_get("concepts_json")?)?,
                tags: serde_json::from_str(row.try_get("tags_json")?)?,
                link: ContextLink {
                    kind: row.try_get("kind")?,
                    target: row.try_get("target")?,
                    status: row.try_get("status")?,
                    reasons: serde_json::from_str(row.try_get("reasons_json")?)?,
                },
            })
        })
        .collect::<Result<Vec<_>>>()?;
    output.sort_by(|a, b| (&a.id, &a.link.target).cmp(&(&b.id, &b.link.target)));
    output.dedup_by(|a, b| {
        a.id == b.id && a.link.target == b.link.target && a.link.kind == b.link.kind
    });
    if count {
        let count = output
            .iter()
            .map(|rule| &rule.id)
            .collect::<std::collections::HashSet<_>>()
            .len();
        println!("{count}");
    } else if matches!(format, Format::Json) {
        println!(
            "{}",
            serde_json::to_string_pretty(&ContextOutput {
                target: target.to_owned(),
                freshness: if freshness.index_fresh {
                    "fresh"
                } else {
                    "stale"
                },
                rules: output,
                next_actions: if freshness.index_fresh {
                    vec![]
                } else {
                    vec!["know index".to_owned()]
                },
            })?
        );
    } else if output.is_empty() {
        println!("No rules apply to {target}.");
    } else {
        for (index, rule) in output.iter().enumerate() {
            if index > 0 {
                println!();
            }
            println!("{} [{}]", rule.id, rule.link.status);
            print_context_field("Constraint:", &rule.description);
            print_context_field("Why:", &rule.rationale);
            print_context_field(
                "Applies:",
                &format!("{} {}", rule.link.kind, rule.link.target),
            );
            if !rule.link.reasons.is_empty() {
                print_context_field("Attention:", &rule.link.reasons.join(", "));
            }
        }
    }
    Ok(0)
}

fn print_context_field(label: &str, value: &str) {
    const WIDTH: usize = 88;
    const LABEL_WIDTH: usize = 12;

    let first_prefix = format!("  {label:<LABEL_WIDTH$}");
    let continuation_prefix = " ".repeat(first_prefix.len());
    let content_width = WIDTH.saturating_sub(first_prefix.len());
    let mut line = String::new();
    let mut first_line = true;

    for word in value.split_whitespace() {
        let extra_width = usize::from(!line.is_empty()) + word.len();
        if !line.is_empty() && line.len() + extra_width > content_width {
            println!(
                "{}{}",
                if first_line {
                    &first_prefix
                } else {
                    &continuation_prefix
                },
                line
            );
            line.clear();
            first_line = false;
        }
        if !line.is_empty() {
            line.push(' ');
        }
        line.push_str(word);
    }

    println!(
        "{}{}",
        if first_line {
            &first_prefix
        } else {
            &continuation_prefix
        },
        line
    );
}

fn infer_kind(_root: &Path, target: &str) -> LinkKind {
    if target.contains('#') {
        LinkKind::Symbol
    } else if target.contains(['*', '?', '[']) {
        LinkKind::Glob
    } else {
        LinkKind::Path
    }
}

fn resolve_query_targets(root: &Path, target: &str, kind: LinkKind) -> Result<Vec<String>> {
    match kind {
        LinkKind::Path => Ok(vec![target.trim_start_matches("./").replace('\\', "/")]),
        LinkKind::Glob => {
            let link = crate::config::Link {
                target: target.to_owned(),
                kind,
                tags: vec![],
                exclude: vec![],
                include_ignored: false,
            };
            let source = crate::config::SourceModel {
                rules: vec![crate::config::Rule {
                    id: "query".to_owned(),
                    description: "query".to_owned(),
                    rationale: "query".to_owned(),
                    concepts: vec![],
                    tags: vec![],
                    links: vec![link],
                }],
                concepts: vec![],
            };
            let analysis = crate::analysis::analyze(root, source, &VerificationFile::default())?;
            Ok(analysis.resolved_links[0].resolved_targets.clone())
        }
        LinkKind::Symbol => Ok(vec![]),
    }
}

async fn check(format: Format, fail_on: FailOn) -> Result<u8> {
    let root = project_root()?;
    let analysis = index::recompute(&root).await?;
    let freshness = index::freshness(&root, &analysis).await?;
    let output = CheckOutput::from_analysis(&analysis, freshness.lock_fresh, freshness.index_fresh);
    match format {
        Format::Text => {
            output.print_text();
            for link in &analysis.resolved_links {
                if link.status != Status::Verified {
                    println!(
                        "{} {} {}: {} ({})",
                        link.status.as_str(),
                        link.rule.id,
                        link.link.target,
                        link.reasons.join(", "),
                        link.link.kind.as_str()
                    );
                }
            }
        }
        Format::Json => {
            let issues = analysis
                .resolved_links
                .iter()
                .filter(|link| link.status != Status::Verified)
                .map(|link| CheckIssue {
                    status: link.status.as_str().to_owned(),
                    rule: link.rule.id.clone(),
                    kind: link.link.kind.as_str().to_owned(),
                    target: link.link.target.clone(),
                    reasons: link.reasons.clone(),
                })
                .collect();
            println!(
                "{}",
                serde_json::to_string_pretty(&CheckJson {
                    summary: &output,
                    issues,
                })?
            );
        }
    }
    let failed = match fail_on {
        FailOn::Invalid => false,
        FailOn::Unverified => output.unverified > 0,
        FailOn::Broken => output.broken > 0,
        FailOn::Unlinked => output.unlinked > 0,
        FailOn::StaleLockfile => !output.lockfile_fresh,
        FailOn::StaleIndex => !output.index_fresh,
        FailOn::SourceIssue => output.unverified + output.broken + output.unlinked > 0,
    };
    Ok(if failed { 1 } else { 0 })
}

async fn verify(
    rule_filter: Option<String>,
    target_filter: Option<String>,
    kind_filter: Option<LinkKind>,
    all: bool,
    dry_run: bool,
) -> Result<u8> {
    if !all && rule_filter.is_none() && target_filter.is_none() {
        bail!("select relationships with --rule, --target, or --all");
    }
    let root = project_root()?;
    let analysis = index::recompute(&root).await?;
    let selected = analysis
        .resolved_links
        .iter()
        .filter(|link| link.status != Status::Broken)
        .filter(|link| rule_filter.as_ref().is_none_or(|id| &link.rule.id == id))
        .filter(|link| {
            target_filter
                .as_ref()
                .is_none_or(|target| &link.link.target == target)
        })
        .filter(|link| kind_filter.is_none_or(|kind| link.link.kind == kind))
        .collect::<Vec<_>>();
    if selected.is_empty() {
        bail!("no resolvable relationships matched the selection");
    }
    for link in &selected {
        println!(
            "{} {} {}",
            if dry_run { "Would verify" } else { "Verifying" },
            link.rule.id,
            link.link.target
        );
    }
    if dry_run {
        return Ok(0);
    }
    let mut approvals = load_verifications(&root)?;
    for link in selected {
        let verification = Verification {
            rule: link.rule.id.clone(),
            kind: link.link.kind,
            target: link.link.target.clone(),
            rule_fingerprint: link.rule_fingerprint.clone(),
            link_fingerprint: link.link_fingerprint.clone(),
            target_fingerprint: link
                .target_fingerprint
                .clone()
                .context("missing target fingerprint")?,
        };
        if let Some(existing) = approvals.links.iter_mut().find(|entry| {
            entry.rule == verification.rule
                && entry.kind == verification.kind
                && entry.target == verification.target
        }) {
            *existing = verification;
        } else {
            approvals.links.push(verification);
        }
    }
    write_verifications(&root, &mut approvals)?;
    index::rebuild(&root).await?;
    println!("Verification recorded and generated state refreshed.");
    Ok(0)
}

async fn status(format: Format) -> Result<u8> {
    let root = project_root()?;
    let analysis = index::recompute(&root).await?;
    let freshness = index::freshness(&root, &analysis).await?;
    let mut connection = index::open_read_model(&root).await?;
    let rules: i64 = sqlx::query_scalar("SELECT count(*) FROM rules")
        .fetch_one(&mut connection)
        .await?;
    let concepts: i64 = sqlx::query_scalar("SELECT count(*) FROM concepts")
        .fetch_one(&mut connection)
        .await?;
    let links: i64 = sqlx::query_scalar("SELECT count(*) FROM links")
        .fetch_one(&mut connection)
        .await?;
    let verified: i64 =
        sqlx::query_scalar("SELECT count(*) FROM link_verification_status WHERE status='verified'")
            .fetch_one(&mut connection)
            .await?;
    let unverified: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM link_verification_status WHERE status='unverified'",
    )
    .fetch_one(&mut connection)
    .await?;
    let broken: i64 =
        sqlx::query_scalar("SELECT count(*) FROM link_verification_status WHERE status='broken'")
            .fetch_one(&mut connection)
            .await?;
    let unlinked: i64 = sqlx::query_scalar("SELECT count(*) FROM unlinked_rules")
        .fetch_one(&mut connection)
        .await?;
    let output = CheckOutput {
        rules: rules as usize,
        concepts: concepts as usize,
        links: links as usize,
        verified: verified as usize,
        unverified: unverified as usize,
        broken: broken as usize,
        unlinked: unlinked as usize,
        lockfile_fresh: freshness.lock_fresh,
        index_fresh: freshness.index_fresh,
    };
    match format {
        Format::Text => output.print_text(),
        Format::Json => println!("{}", serde_json::to_string_pretty(&output)?),
    }
    Ok(0)
}

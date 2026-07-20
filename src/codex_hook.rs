use crate::{config::find_root, index};
use anyhow::{Context, Result};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::Row;
use std::{
    collections::{BTreeMap, BTreeSet},
    env,
    io::{self, Read},
    path::{Path, PathBuf},
};

#[derive(Deserialize)]
struct HookInput {
    #[serde(default)]
    hook_event_name: String,
    #[serde(default)]
    tool_name: String,
    cwd: Option<String>,
    #[serde(default)]
    tool_input: Value,
}

struct RuleContext {
    id: String,
    description: String,
    rationale: String,
    kind: String,
    target: String,
    status: String,
    reasons: Vec<String>,
    affected_paths: BTreeSet<String>,
}

pub async fn run() -> Result<u8> {
    let mut raw = String::new();
    io::stdin().read_to_string(&mut raw)?;
    let input: HookInput = serde_json::from_str(&raw).context("invalid Codex hook input")?;

    if input.hook_event_name != "PreToolUse" || input.tool_name != "apply_patch" {
        return Ok(0);
    }
    let Some(command) = input.tool_input.get("command").and_then(Value::as_str) else {
        return Ok(0);
    };
    let start = input
        .cwd
        .as_deref()
        .map(PathBuf::from)
        .unwrap_or(env::current_dir()?);
    let Ok(root) = find_root(&start) else {
        return Ok(0);
    };
    let paths = patch_paths(command, &root);
    if paths.is_empty() {
        return Ok(0);
    }

    match collect_context(&root, &paths).await {
        Ok(Some(context)) => emit_context(&context)?,
        Ok(None) => {}
        Err(error) => {
            emit_context(&format!(
                "Know could not load pre-edit context for {}: {error:#}. Run `know index` before editing protected code.",
                paths.join(", ")
            ))?;
        }
    }
    Ok(0)
}

fn patch_paths(command: &str, root: &Path) -> Vec<String> {
    const PREFIXES: [&str; 4] = [
        "*** Update File: ",
        "*** Add File: ",
        "*** Delete File: ",
        "*** Move to: ",
    ];
    command
        .lines()
        .filter_map(|line| {
            let candidate = PREFIXES
                .iter()
                .find_map(|prefix| line.strip_prefix(prefix))?
                .trim();
            canonical_target(candidate, root)
        })
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect()
}

fn canonical_target(candidate: &str, root: &Path) -> Option<String> {
    let path = Path::new(candidate);
    let relative = if path.is_absolute() {
        path.strip_prefix(root).ok()?
    } else {
        path
    };
    if relative
        .components()
        .any(|part| matches!(part, std::path::Component::ParentDir))
    {
        return None;
    }
    Some(relative.to_string_lossy().replace('\\', "/"))
}

async fn collect_context(root: &Path, paths: &[String]) -> Result<Option<String>> {
    let current = index::recompute(root).await?;
    let freshness = index::freshness(root, &current).await?;
    let mut connection = index::open_read_model(root).await?;
    let mut rules = BTreeMap::<(String, String, String), RuleContext>::new();

    for path in paths {
        let rows = sqlx::query(
            "SELECT DISTINCT rule_id,description,rationale,kind,target,status,reasons_json
             FROM rule_context WHERE resolved_path=? ORDER BY rule_id,target",
        )
        .bind(path)
        .fetch_all(&mut connection)
        .await?;
        for row in rows {
            let key = (
                row.try_get::<String, _>("rule_id")?,
                row.try_get::<String, _>("kind")?,
                row.try_get::<String, _>("target")?,
            );
            let entry = rules.entry(key.clone()).or_insert(RuleContext {
                id: key.0,
                description: row.try_get("description")?,
                rationale: row.try_get("rationale")?,
                kind: key.1,
                target: key.2,
                status: row.try_get("status")?,
                reasons: serde_json::from_str(row.try_get("reasons_json")?)?,
                affected_paths: BTreeSet::new(),
            });
            entry.affected_paths.insert(path.clone());
        }
    }
    if rules.is_empty() {
        return Ok(None);
    }

    let mut output = String::from(
        "KNOW PRE-EDIT CONTEXT\nThe pending edit touches code with linked project rules.\n",
    );
    if !freshness.index_fresh {
        output.push_str(
            "\nWarning: the read model is stale. This is last-indexed context; run `know index` to refresh it.\n",
        );
    }
    for rule in rules.values() {
        output.push_str(&format!(
            "\nRule `{}` [{}]\nConstraint: {}\nWhy: {}\nApplies through: {} {}\nAffected now: {}",
            rule.id,
            rule.status,
            rule.description,
            rule.rationale,
            rule.kind,
            rule.target,
            rule.affected_paths
                .iter()
                .cloned()
                .collect::<Vec<_>>()
                .join(", ")
        ));
        if !rule.reasons.is_empty() {
            output.push_str(&format!("\nAttention: {}", rule.reasons.join(", ")));
        }
        output.push('\n');
    }
    output.push_str(
        "\nBefore editing, explain any conflict between the request and these rules. Preserve the rule's intent or propose a compliant alternative. Do not run `know verify` unless the human explicitly authorizes verification.",
    );
    if output.len() > 9_000 {
        output.truncate(9_000);
        output.push_str(
            "\n[Know context truncated; query targets directly with `know context <path>`.]",
        );
    }
    Ok(Some(output))
}

fn emit_context(context: &str) -> Result<()> {
    println!(
        "{}",
        serde_json::to_string(&json!({
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "additionalContext": context
            }
        }))?
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::patch_paths;
    use std::path::Path;

    #[test]
    fn extracts_and_deduplicates_patch_paths() {
        let patch = "*** Begin Patch\n*** Update File: src/a.rs\n*** Move to: src/b.rs\n*** Update File: src/a.rs\n*** End Patch\n";
        assert_eq!(
            patch_paths(patch, Path::new("/repo")),
            vec!["src/a.rs", "src/b.rs"]
        );
    }

    #[test]
    fn rejects_paths_outside_the_repository() {
        let patch = "*** Begin Patch\n*** Update File: ../secret\n*** Update File: /elsewhere/a\n*** End Patch\n";
        assert!(patch_paths(patch, Path::new("/repo")).is_empty());
    }
}

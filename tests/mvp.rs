use assert_cmd::Command;
use predicates::prelude::*;
use std::fs;
use tempfile::TempDir;

fn know(directory: &TempDir) -> Command {
    let mut command = Command::cargo_bin("know").unwrap();
    command.current_dir(directory.path());
    command
}

#[test]
fn baseline_rule_lifecycle() {
    let directory = TempDir::new().unwrap();
    fs::write(directory.path().join("README.md"), "first\n").unwrap();

    know(&directory).arg("init").assert().success();
    know(&directory).arg("index").assert().success();
    know(&directory)
        .args(["context", "README.md"])
        .assert()
        .success()
        .stdout(predicate::str::contains(
            "explain-non-obvious-decisions [unverified]",
        ));

    know(&directory)
        .args(["verify", "--all"])
        .assert()
        .success();
    know(&directory)
        .args(["context", "README.md", "--require-fresh"])
        .assert()
        .success()
        .stdout(predicate::str::contains("[verified]"));
    know(&directory)
        .args(["context", "README.md", "--format", "json"])
        .assert()
        .success()
        .stdout(predicate::str::contains("\"freshness\": \"fresh\""));

    fs::write(directory.path().join("README.md"), "changed\n").unwrap();
    know(&directory)
        .args(["context", "README.md"])
        .assert()
        .success()
        .stderr(predicate::str::contains("stale"))
        .stdout(predicate::str::contains("[verified]"));
    know(&directory)
        .args(["check", "--fail-on", "unverified"])
        .assert()
        .failure()
        .stdout(predicate::str::contains("target-fingerprint-changed"));
}

#[test]
fn glob_links_match_context_targets() {
    let directory = TempDir::new().unwrap();
    fs::create_dir_all(directory.path().join("src/billing")).unwrap();
    fs::write(
        directory.path().join("src/billing/invoice.rs"),
        "fn total() {}\n",
    )
    .unwrap();
    know(&directory).arg("init").assert().success();
    fs::write(
        directory.path().join(".know/rules/example.toml"),
        "[[rules]]\nid = \"billing-total\"\ndescription = \"Totals must be exact.\"\nrationale = \"Billing errors cost real money.\"\n\n[[rules.links]]\ntarget = \"src/billing/**/*.rs\"\nkind = \"glob\"\n",
    )
    .unwrap();
    know(&directory).arg("index").assert().success();
    know(&directory)
        .args(["context", "src/billing/invoice.rs"])
        .assert()
        .success()
        .stdout(predicate::str::contains("billing-total [unverified]"));
}

#[test]
fn text_context_separates_and_labels_rules() {
    let directory = TempDir::new().unwrap();
    fs::write(directory.path().join("README.md"), "protected\n").unwrap();
    know(&directory).arg("init").assert().success();
    fs::write(
        directory.path().join(".know/rules/example.toml"),
        "[[rules]]\nid = \"first-rule\"\ndescription = \"First constraint.\"\nrationale = \"First rationale.\"\n\n[[rules.links]]\ntarget = \"README.md\"\nkind = \"path\"\n\n[[rules]]\nid = \"second-rule\"\ndescription = \"Second constraint.\"\nrationale = \"Second rationale.\"\n\n[[rules.links]]\ntarget = \"README.md\"\nkind = \"path\"\n",
    )
    .unwrap();
    know(&directory).arg("index").assert().success();
    know(&directory)
        .args(["context", "README.md"])
        .assert()
        .success()
        .stdout(
            predicate::str::contains("  Constraint: First constraint.")
                .and(predicate::str::contains("  Why:"))
                .and(predicate::str::contains("  Applies:"))
                .and(predicate::str::contains(
                    "no-verification-entry\n\nsecond-rule [unverified]",
                )),
        );
}

#[test]
fn strict_schema_rejects_unknown_fields() {
    let directory = TempDir::new().unwrap();
    know(&directory).arg("init").assert().success();
    let rules = directory.path().join(".know/rules/example.toml");
    fs::write(
        rules,
        "[[rules]]\nid = \"a-rule\"\ndescription = \"A\"\nrationle = \"typo\"\n",
    )
    .unwrap();
    know(&directory)
        .arg("check")
        .assert()
        .failure()
        .stderr(predicate::str::contains("unknown field"));
}

#[test]
fn codex_hook_injects_context_for_pending_patch() {
    let directory = TempDir::new().unwrap();
    fs::write(directory.path().join("README.md"), "protected\n").unwrap();
    know(&directory).arg("init").assert().success();
    fs::write(
        directory.path().join(".know/rules/example.toml"),
        "[[rules]]\nid = \"protect-readme\"\ndescription = \"Keep the surprising behavior.\"\nrationale = \"The reason is not visible in code.\"\n\n[[rules.links]]\ntarget = \"README.md\"\nkind = \"path\"\n",
    )
    .unwrap();
    know(&directory).arg("index").assert().success();
    let input = serde_json::json!({
        "hook_event_name": "PreToolUse",
        "tool_name": "apply_patch",
        "cwd": directory.path(),
        "tool_input": {
            "command": "*** Begin Patch\n*** Update File: README.md\n*** End Patch\n"
        }
    });

    know(&directory)
        .args(["hook", "codex"])
        .write_stdin(input.to_string())
        .assert()
        .success()
        .stdout(
            predicate::str::contains("\"hookEventName\":\"PreToolUse\"")
                .and(predicate::str::contains("protect-readme"))
                .and(predicate::str::contains("Keep the surprising behavior.")),
        );
}

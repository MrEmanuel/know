use crate::config::{Link, LinkKind, Rule, SourceModel, VerificationFile};
use anyhow::{Context, Result};
use ignore::WalkBuilder;
use ignore::overrides::OverrideBuilder;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{collections::BTreeMap, fs, path::Path};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct Lockfile {
    pub version: u32,
    pub source_model_hash: String,
    pub link_verification_hash: String,
    pub resolved_model_hash: String,
    #[serde(default)]
    pub links: Vec<LockLink>,
    #[serde(default)]
    pub unlinked_rules: Vec<UnlinkedRule>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct LockLink {
    pub rule: String,
    pub kind: LinkKind,
    pub target: String,
    pub status: Status,
    #[serde(default)]
    pub reasons: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct UnlinkedRule {
    pub rule: String,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Status {
    Verified,
    Unverified,
    Broken,
}

impl Status {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Verified => "verified",
            Self::Unverified => "unverified",
            Self::Broken => "broken",
        }
    }
}

#[derive(Clone, Debug)]
pub struct ResolvedLink {
    pub rule: Rule,
    pub link: Link,
    pub status: Status,
    pub reasons: Vec<String>,
    pub resolved_targets: Vec<String>,
    pub rule_fingerprint: String,
    pub link_fingerprint: String,
    pub target_fingerprint: Option<String>,
}

#[derive(Clone, Debug)]
pub struct Analysis {
    pub source: SourceModel,
    pub resolved_links: Vec<ResolvedLink>,
    pub lockfile: Lockfile,
}

pub fn analyze(root: &Path, source: SourceModel, approvals: &VerificationFile) -> Result<Analysis> {
    let source_model_hash = hash_json(&source_for_hash(&source))?;
    let link_verification_hash = hash_json(approvals)?;
    let mut resolved_links = Vec::new();
    let mut lock_links = Vec::new();
    let mut unlinked_rules = Vec::new();

    for rule in &source.rules {
        if rule.links.is_empty() {
            unlinked_rules.push(UnlinkedRule {
                rule: rule.id.clone(),
            });
        }
        for link in &rule.links {
            let rule_fingerprint = hash_json(&(
                &rule.id,
                &rule.description,
                &rule.rationale,
                &rule.concepts,
                &rule.tags,
            ))?;
            let link_fingerprint = hash_json(link)?;
            let resolution = resolve(root, link)?;
            let target_fingerprint = resolution.fingerprint;
            let (status, reasons) = if let Some(reason) = resolution.broken_reason {
                (Status::Broken, vec![reason])
            } else if let Some(approval) = approvals.links.iter().find(|entry| {
                entry.rule == rule.id && entry.kind == link.kind && entry.target == link.target
            }) {
                let mut reasons = Vec::new();
                if approval.rule_fingerprint != rule_fingerprint {
                    reasons.push("rule-fingerprint-changed".to_owned());
                }
                if approval.link_fingerprint != link_fingerprint {
                    reasons.push("link-fingerprint-changed".to_owned());
                }
                if target_fingerprint.as_ref() != Some(&approval.target_fingerprint) {
                    reasons.push("target-fingerprint-changed".to_owned());
                }
                if reasons.is_empty() {
                    (Status::Verified, reasons)
                } else {
                    (Status::Unverified, reasons)
                }
            } else {
                (Status::Unverified, vec!["no-verification-entry".to_owned()])
            };
            lock_links.push(LockLink {
                rule: rule.id.clone(),
                kind: link.kind,
                target: link.target.clone(),
                status,
                reasons: reasons.clone(),
            });
            resolved_links.push(ResolvedLink {
                rule: rule.clone(),
                link: link.clone(),
                status,
                reasons,
                resolved_targets: resolution.targets,
                rule_fingerprint,
                link_fingerprint,
                target_fingerprint,
            });
        }
    }
    lock_links.sort_by(|a, b| {
        (&a.rule, a.kind.as_str(), &a.target).cmp(&(&b.rule, b.kind.as_str(), &b.target))
    });
    let resolved_model_hash = hash_json(&(
        &source_model_hash,
        &link_verification_hash,
        &lock_links,
        &unlinked_rules,
        resolved_links
            .iter()
            .map(|link| {
                (
                    &link.rule.id,
                    &link.link.target,
                    &link.resolved_targets,
                    &link.target_fingerprint,
                )
            })
            .collect::<Vec<_>>(),
        1_u32,
    ))?;
    let lockfile = Lockfile {
        version: 1,
        source_model_hash,
        link_verification_hash,
        resolved_model_hash,
        links: lock_links,
        unlinked_rules,
    };
    Ok(Analysis {
        source,
        resolved_links,
        lockfile,
    })
}

struct Resolution {
    targets: Vec<String>,
    fingerprint: Option<String>,
    broken_reason: Option<String>,
}

fn resolve(root: &Path, link: &Link) -> Result<Resolution> {
    match link.kind {
        LinkKind::Path => {
            let path = root.join(&link.target);
            if !path.is_file() {
                return Ok(broken("target-not-found"));
            }
            let bytes = fs::read(&path)?;
            Ok(Resolution {
                targets: vec![link.target.clone()],
                fingerprint: Some(hash_bytes(&bytes)),
                broken_reason: None,
            })
        }
        LinkKind::Glob => resolve_glob(root, link),
        LinkKind::Symbol => Ok(broken("unsupported-language")),
    }
}

fn resolve_glob(root: &Path, link: &Link) -> Result<Resolution> {
    let mut overrides = OverrideBuilder::new(root);
    overrides
        .add(&link.target)
        .with_context(|| format!("invalid glob `{}`", link.target))?;
    for exclude in &link.exclude {
        overrides
            .add(&format!("!{exclude}"))
            .with_context(|| format!("invalid exclusion glob `{exclude}`"))?;
    }
    let overrides = overrides.build()?;
    let mut builder = WalkBuilder::new(root);
    builder
        .hidden(false)
        .git_ignore(!link.include_ignored)
        .git_global(!link.include_ignored)
        .git_exclude(!link.include_ignored)
        .overrides(overrides);
    let mut targets = Vec::new();
    for entry in builder.build() {
        let entry = entry?;
        if entry.file_type().is_some_and(|kind| kind.is_file()) {
            let relative = entry
                .path()
                .strip_prefix(root)?
                .to_string_lossy()
                .replace('\\', "/");
            targets.push(relative);
        }
    }
    targets.sort();
    targets.dedup();
    if targets.is_empty() {
        return Ok(broken("glob-empty"));
    }
    let mut components = BTreeMap::new();
    for target in &targets {
        components.insert(target.clone(), hash_bytes(&fs::read(root.join(target))?));
    }
    Ok(Resolution {
        targets,
        fingerprint: Some(hash_json(&components)?),
        broken_reason: None,
    })
}

fn broken(reason: &str) -> Resolution {
    Resolution {
        targets: vec![],
        fingerprint: None,
        broken_reason: Some(reason.to_owned()),
    }
}

pub fn hash_bytes(bytes: &[u8]) -> String {
    format!("sha256:{:x}", Sha256::digest(bytes))
}

pub fn hash_json(value: &impl Serialize) -> Result<String> {
    Ok(hash_bytes(&serde_json::to_vec(value)?))
}

fn source_for_hash(source: &SourceModel) -> (&[Rule], &[crate::config::Concept]) {
    (&source.rules, &source.concepts)
}

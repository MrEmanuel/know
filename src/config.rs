use anyhow::{Context, Result, bail};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    fs,
    path::{Component, Path, PathBuf},
};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct RulesFile {
    #[serde(default)]
    pub rules: Vec<Rule>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Rule {
    pub id: String,
    pub description: String,
    pub rationale: String,
    #[serde(default)]
    pub concepts: Vec<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub links: Vec<Link>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Link {
    pub target: String,
    pub kind: LinkKind,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub exclude: Vec<String>,
    #[serde(default)]
    pub include_ignored: bool,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum LinkKind {
    Path,
    Glob,
    Symbol,
}

impl LinkKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Path => "path",
            Self::Glob => "glob",
            Self::Symbol => "symbol",
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ConceptsFile {
    #[serde(default)]
    pub concepts: Vec<Concept>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Concept {
    pub id: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub tags: Vec<String>,
}

#[derive(Clone, Debug, Default)]
pub struct SourceModel {
    pub rules: Vec<Rule>,
    pub concepts: Vec<Concept>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct VerificationFile {
    pub version: u32,
    #[serde(default)]
    pub links: Vec<Verification>,
}

impl Default for VerificationFile {
    fn default() -> Self {
        Self {
            version: 1,
            links: vec![],
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Verification {
    pub rule: String,
    pub kind: LinkKind,
    pub target: String,
    pub rule_fingerprint: String,
    pub link_fingerprint: String,
    pub target_fingerprint: String,
}

pub fn find_root(start: &Path) -> Result<PathBuf> {
    for directory in start.ancestors() {
        if directory.join(".know").is_dir() {
            return Ok(directory.to_path_buf());
        }
    }
    bail!("not inside a Know project; run `know init` at the repository root")
}

pub fn load_source(root: &Path) -> Result<SourceModel> {
    let mut model = SourceModel::default();
    for path in toml_files(&root.join(".know/rules"))? {
        let text = fs::read_to_string(&path)
            .with_context(|| format!("failed to read {}", path.display()))?;
        let parsed: RulesFile = toml::from_str(&text)
            .with_context(|| format!("invalid rules file {}", path.display()))?;
        model.rules.extend(parsed.rules);
    }
    for path in toml_files(&root.join(".know/concepts"))? {
        let text = fs::read_to_string(&path)
            .with_context(|| format!("failed to read {}", path.display()))?;
        let parsed: ConceptsFile = toml::from_str(&text)
            .with_context(|| format!("invalid concepts file {}", path.display()))?;
        model.concepts.extend(parsed.concepts);
    }
    validate(&model)?;
    model.rules.sort_by(|a, b| a.id.cmp(&b.id));
    model.concepts.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(model)
}

pub fn load_verifications(root: &Path) -> Result<VerificationFile> {
    let path = root.join(".know/linkVerification.toml");
    if !path.exists() {
        return Ok(VerificationFile::default());
    }
    let text = fs::read_to_string(&path)?;
    let file: VerificationFile =
        toml::from_str(&text).context("invalid .know/linkVerification.toml")?;
    if file.version != 1 {
        bail!("unsupported linkVerification.toml version {}", file.version);
    }
    let mut identities = HashSet::new();
    for entry in &file.links {
        let link = Link {
            target: entry.target.clone(),
            kind: entry.kind,
            tags: vec![],
            exclude: vec![],
            include_ignored: false,
        };
        validate_target(&link)?;
        if !identities.insert((
            entry.rule.as_str(),
            entry.kind.as_str(),
            entry.target.as_str(),
        )) {
            bail!(
                "duplicate verification entry for {} {} {}",
                entry.rule,
                entry.kind.as_str(),
                entry.target
            );
        }
        for fingerprint in [
            &entry.rule_fingerprint,
            &entry.link_fingerprint,
            &entry.target_fingerprint,
        ] {
            if fingerprint.len() != 71
                || !fingerprint.starts_with("sha256:")
                || !fingerprint[7..]
                    .bytes()
                    .all(|byte| byte.is_ascii_hexdigit())
            {
                bail!("invalid verification fingerprint `{fingerprint}`");
            }
        }
    }
    Ok(file)
}

pub fn write_verifications(root: &Path, file: &mut VerificationFile) -> Result<()> {
    file.links.sort_by(|a, b| {
        (&a.rule, a.kind.as_str(), &a.target).cmp(&(&b.rule, b.kind.as_str(), &b.target))
    });
    let text = toml::to_string_pretty(file)?;
    fs::write(root.join(".know/linkVerification.toml"), text)?;
    Ok(())
}

fn toml_files(directory: &Path) -> Result<Vec<PathBuf>> {
    if !directory.is_dir() {
        bail!("missing required directory {}", directory.display());
    }
    let mut files = fs::read_dir(directory)?
        .filter_map(|entry| entry.ok().map(|entry| entry.path()))
        .filter(|path| {
            path.extension()
                .is_some_and(|extension| extension == "toml")
        })
        .collect::<Vec<_>>();
    files.sort();
    Ok(files)
}

fn validate(model: &SourceModel) -> Result<()> {
    let mut rule_ids = HashSet::new();
    let mut concept_ids = HashSet::new();
    for concept in &model.concepts {
        validate_id(&concept.id, "concept")?;
        if !concept_ids.insert(&concept.id) {
            bail!("duplicate concept id `{}`", concept.id);
        }
        validate_tags(&concept.tags)?;
    }
    for rule in &model.rules {
        validate_id(&rule.id, "rule")?;
        if !rule_ids.insert(&rule.id) {
            bail!("duplicate rule id `{}`", rule.id);
        }
        if rule.description.trim().is_empty() || rule.rationale.trim().is_empty() {
            bail!("rule `{}` requires a description and rationale", rule.id);
        }
        validate_tags(&rule.tags)?;
        let mut links = HashSet::new();
        for link in &rule.links {
            validate_target(link)?;
            validate_tags(&link.tags)?;
            if !links.insert((link.kind.as_str(), &link.target)) {
                bail!(
                    "rule `{}` contains duplicate {} link `{}`",
                    rule.id,
                    link.kind.as_str(),
                    link.target
                );
            }
            if link.kind != LinkKind::Glob && (!link.exclude.is_empty() || link.include_ignored) {
                bail!("exclude/include_ignored are valid only on glob links");
            }
        }
        for concept in &rule.concepts {
            if !concept_ids.contains(concept) {
                bail!("rule `{}` references unknown concept `{concept}`", rule.id);
            }
        }
    }
    Ok(())
}

fn validate_id(id: &str, kind: &str) -> Result<()> {
    let valid = !id.is_empty()
        && id.split('-').all(|part| {
            !part.is_empty()
                && part
                    .bytes()
                    .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit())
        });
    if !valid {
        bail!("{kind} id `{id}` must be lowercase ASCII kebab-case");
    }
    Ok(())
}

fn validate_tags(tags: &[String]) -> Result<()> {
    for tag in tags {
        let trimmed = tag.trim();
        if trimmed.is_empty()
            || trimmed.chars().count() > 80
            || trimmed.chars().any(char::is_control)
        {
            bail!("invalid tag `{tag}`");
        }
    }
    Ok(())
}

fn validate_target(link: &Link) -> Result<()> {
    let path_part = match link.kind {
        LinkKind::Symbol => link
            .target
            .split_once('#')
            .filter(|(_, symbol)| !symbol.is_empty())
            .map(|(path, _)| path)
            .context("symbol targets must use canonical path#Symbol form")?,
        _ => link.target.as_str(),
    };
    let path = Path::new(path_part);
    if path.is_absolute()
        || path_part.starts_with("./")
        || path_part.contains('\\')
        || path
            .components()
            .any(|component| matches!(component, Component::ParentDir))
    {
        bail!(
            "target `{}` is not repository-root-relative and canonical",
            link.target
        );
    }
    Ok(())
}

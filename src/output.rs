use crate::analysis::{Analysis, Status};
use serde::Serialize;

#[derive(Serialize)]
pub struct CheckOutput {
    pub rules: usize,
    pub concepts: usize,
    pub links: usize,
    pub verified: usize,
    pub unverified: usize,
    pub broken: usize,
    pub unlinked: usize,
    pub lockfile_fresh: bool,
    pub index_fresh: bool,
}

impl CheckOutput {
    pub fn from_analysis(analysis: &Analysis, lockfile_fresh: bool, index_fresh: bool) -> Self {
        Self {
            rules: analysis.source.rules.len(),
            concepts: analysis.source.concepts.len(),
            links: analysis.resolved_links.len(),
            verified: analysis
                .resolved_links
                .iter()
                .filter(|link| link.status == Status::Verified)
                .count(),
            unverified: analysis
                .resolved_links
                .iter()
                .filter(|link| link.status == Status::Unverified)
                .count(),
            broken: analysis
                .resolved_links
                .iter()
                .filter(|link| link.status == Status::Broken)
                .count(),
            unlinked: analysis.lockfile.unlinked_rules.len(),
            lockfile_fresh,
            index_fresh,
        }
    }

    pub fn print_text(&self) {
        println!(
            "{} rules, {} concepts, {} links ({} verified, {} unverified, {} broken), {} unlinked",
            self.rules,
            self.concepts,
            self.links,
            self.verified,
            self.unverified,
            self.broken,
            self.unlinked
        );
        println!(
            "lockfile: {}  index: {}",
            freshness(self.lockfile_fresh),
            freshness(self.index_fresh)
        );
    }
}

fn freshness(fresh: bool) -> &'static str {
    if fresh { "fresh" } else { "stale or missing" }
}

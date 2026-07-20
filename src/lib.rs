mod analysis;
mod cli;
mod codex_hook;
mod config;
mod index;
mod output;

use anyhow::Result;

pub async fn run() -> Result<u8> {
    cli::run().await
}

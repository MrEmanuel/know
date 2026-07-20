use std::process::ExitCode;

#[tokio::main]
async fn main() -> ExitCode {
    match know::run().await {
        Ok(code) => ExitCode::from(code),
        Err(error) => {
            eprintln!("error: {error:#}");
            ExitCode::from(2)
        }
    }
}

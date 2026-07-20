#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$ROOT"

if command -v know >/dev/null 2>&1; then
    KNOW=know
elif [ -x "$ROOT/target/release/know" ]; then
    KNOW="$ROOT/target/release/know"
elif [ -x "$ROOT/target/debug/know" ]; then
    KNOW="$ROOT/target/debug/know"
else
    echo "Know is not installed. Run ./install.sh first." >&2
    exit 1
fi

echo "==> Preparing Know's disposable read model"
"$KNOW" index

echo
echo "==> Running the SkyRoute playground"
python3 examples/skyroute/run_demo.py

echo
echo "==> Asking Know what applies to the pricing engine"
"$KNOW" context examples/skyroute/skyroute/pricing.py

echo
echo "==> Checking the shipped rule relationships"
"$KNOW" status

echo
echo "==> Now let Codex try a tempting refactor"
echo "This walkthrough uses Codex CLI specifically, not the VS Code extension."
echo "1. Start Codex in this repository: codex"
echo "2. If Codex asks you to review hooks, open /hooks and trust the repository hook."
echo "3. Paste this prompt:"
echo
echo "Simplify SkyRoute by calculating passenger category once when the booking is created and storing it on Passenger. Reuse it for every flight segment."
echo
echo "Know will inject the second-birthday rule before Codex edits protected code."

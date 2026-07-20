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

echo
echo "============================================================"
echo "  Know + Codex CLI demo"
echo "============================================================"
echo
echo "Preparing the demo automatically..."
"$KNOW" index >/dev/null

echo
python3 examples/skyroute/run_demo.py

"$KNOW" status >/dev/null
echo
echo "[done] Know has indexed and verified the SkyRoute rules."
echo "One rule prevents reusing a passenger category across flight segments."
echo "To inspect the linked rules yourself, run:"
echo
echo "     know context examples/skyroute/skyroute/pricing.py"

echo
echo "============================================================"
echo "  Demo instructions"
echo "============================================================"
echo
echo "Now try a tempting refactor and watch Know give Codex the"
echo "domain rule it would otherwise miss."
echo
echo "1. Start Codex CLI from this repository:"
echo
echo "     codex"
echo
echo "2. If Codex asks you to review hooks, run /hooks and trust"
echo "   the repository hook."
echo
echo "3. Copy and paste this prompt into Codex:"
echo
echo "------------------------------------------------------------"
echo "Simplify SkyRoute by calculating passenger category once when the booking is created and storing it on Passenger. Reuse it for every flight segment."
echo "------------------------------------------------------------"
echo
echo "What to look for:"
echo "Before editing the pricing code, Codex should receive Know's"
echo "second-birthday rule and explain why the refactor is unsafe."
echo "For a preview of the result, see images/CodexCliExample.png."
echo
echo "Note: this demo requires Codex CLI; the VS Code extension does"
echo "not currently run the hook."

#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
SCRIPT_NAME=${0##*/}
INSTALL_DIR=${KNOW_INSTALL_DIR:-"${CARGO_HOME:-$HOME/.cargo}/bin"}
RELEASE_BASE=${KNOW_RELEASE_BASE:-"https://github.com/MrEmanuel/know/releases/latest/download"}

platform_asset() {
    case "$(uname -s)" in
        Darwin) os=darwin ;;
        Linux) os=linux ;;
        *)
            return 1
            ;;
    esac
    case "$(uname -m)" in
        arm64|aarch64) arch=arm64 ;;
        x86_64|amd64) arch=x86_64 ;;
        *)
            return 1
            ;;
    esac
    printf 'know-%s-%s.tar.gz\n' "$os" "$arch"
}

install_release() {
    asset=$(platform_asset) || return 1
    command -v curl >/dev/null 2>&1 || return 1
    command -v tar >/dev/null 2>&1 || return 1

    temp_dir=$(mktemp -d)
    trap 'rm -rf "$temp_dir"' EXIT HUP INT TERM
    archive="$temp_dir/$asset"
    checksum="$archive.sha256"
    curl --fail --silent --location "$RELEASE_BASE/$asset" --output "$archive" ||
        return 1
    curl --fail --silent --location "$RELEASE_BASE/$asset.sha256" --output "$checksum" ||
        return 1

    if command -v shasum >/dev/null 2>&1; then
        (cd "$temp_dir" && shasum -a 256 -c "$asset.sha256") || return 1
    elif command -v sha256sum >/dev/null 2>&1; then
        (cd "$temp_dir" && sha256sum -c "$asset.sha256") || return 1
    else
        echo "A SHA-256 utility is required to verify the Know release." >&2
        return 1
    fi

    tar -xzf "$archive" -C "$temp_dir"
    mkdir -p "$INSTALL_DIR"
    install -m 755 "$temp_dir/know" "$INSTALL_DIR/know"
}

echo "Installing Know..."
if install_release; then
    echo "Installed the verified release to $INSTALL_DIR/know"
elif command -v cargo >/dev/null 2>&1 &&
    [ "$SCRIPT_NAME" = "install.sh" ] &&
    [ -f "$ROOT/Cargo.toml" ]; then
    echo "No matching release was available; building this checkout with Cargo."
    cargo build --manifest-path "$ROOT/Cargo.toml" --release --locked
    mkdir -p "$INSTALL_DIR"
    install -m 755 "$ROOT/target/release/know" "$INSTALL_DIR/know"
    echo "Installed the local build to $INSTALL_DIR/know"
else
    echo "No prebuilt Know release is available for this platform." >&2
    echo "On macOS or Linux, run this script from a Know checkout with Rust installed." >&2
    echo "Windows is not supported by the hackathon demo." >&2
    exit 1
fi

case ":$PATH:" in
    *":$INSTALL_DIR:"*) ;;
    *)
        echo "Add $INSTALL_DIR to PATH before running Know:"
        echo "  export PATH=\"$INSTALL_DIR:\$PATH\""
        ;;
esac

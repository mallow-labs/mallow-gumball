#!/bin/bash
# Compares the pinned external programs with the chain, or re-pins them.
#
#   external-programs.sh check        exit 1 when a program differs from its pin,
#                                     exit 2 when one could not be read
#   external-programs.sh pin <tag>    publish the current chain binaries as release
#                                     <tag> and point the manifest at it
#
# RPC overrides the mainnet endpoint. Devnet programs always use the public one.
set -uo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
MANIFEST=${SCRIPT_DIR}/external-programs.txt
MAINNET_RPC=${RPC:-https://api.mainnet-beta.solana.com}
DEVNET_RPC=https://api.devnet.solana.com

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

entries() { awk '!/^#/ && NF == 4' "$MANIFEST"; }
sha_of() { sha256sum -b "$1" | cut -d ' ' -f 1; }

dump() { # <file> <program-id> <cluster>
    local url=$MAINNET_RPC
    [ "$3" == "devnet" ] && url=$DEVNET_RPC
    solana program dump -u "$url" "$2" "${WORK}/$1" >/dev/null
}

check() {
    local status=0 file id cluster pinned actual
    while read -r file id cluster pinned; do
        if ! dump "$file" "$id" "$cluster"; then
            echo "UNREADABLE ${file} (${id} on ${cluster})"
            [ "$status" -eq 0 ] && status=2
            continue
        fi
        actual=$(sha_of "${WORK}/${file}")
        if [ "$actual" == "$pinned" ]; then
            echo "ok ${file}"
        else
            echo "DRIFT ${file} (${id} on ${cluster}): pinned ${pinned}, chain ${actual}"
            status=1
        fi
    done < <(entries)
    return "$status"
}

pin() {
    local tag=$1 file id cluster pinned
    local next="${WORK}/manifest"
    grep '^#' "$MANIFEST" >"$next"
    echo "release ${tag}" >>"$next"
    while read -r file id cluster pinned; do
        dump "$file" "$id" "$cluster" || { echo "could not read ${file}"; return 1; }
        echo "${file} ${id} ${cluster} $(sha_of "${WORK}/${file}")" >>"$next"
    done < <(entries)
    gh release create "$tag" "$WORK"/*.so \
        --repo mallow-labs/mallow-gumball \
        --title "$tag" \
        --latest=false \
        --notes "External program binaries the tests run against. See configs/program-scripts/external-programs.txt." \
        || return 1
    cp "$next" "$MANIFEST"
}

case "${1:-}" in
    check) check ;;
    pin)
        [ -n "${2:-}" ] || { echo "usage: $0 pin <release-tag>"; exit 1; }
        pin "$2"
        ;;
    *) echo "usage: $0 check | pin <release-tag>"; exit 1 ;;
esac

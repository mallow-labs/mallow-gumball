#!/bin/bash
#
# Regenerates the upgradeable-program account fixtures for the Gumball Guard
# program used by the JS test validator.
#
# amman can only load programs as non-upgradeable (`--bpf-program`), but
# `create_global_config` is gated on the program's upgrade authority, so the
# tests need Gumball Guard to be an upgradeable program whose upgrade authority
# is the deterministic test authority (see `getTestAuthority` in the JS tests).
#
# We stand up a throwaway validator with `--upgradeable-program` (which needs no
# program keypair), dump the resulting `Program` + `ProgramData` accounts, and
# commit them under `.amman/accounts/`. amman loads them via its `accounts`
# config (executable entry -> auto-loads the derived ProgramData account).
#
# Re-run this whenever `programs/.bin/gumball_guard.so` changes.

set -euo pipefail

GUARD_ID="GGRDy4ieS7ExrUu313QkszyuT9o3BvDLuc3H5VLgCpSF"
# Deterministic test authority = getTestAuthority() = Keypair.fromSeed([42; 32]).
UPGRADE_AUTHORITY="2iXtA8oeZqUU5pofxK971TCEvFGfems2AcDRaZHKD2pQ"

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
ROOT_DIR=$(dirname "$(dirname "$SCRIPT_DIR")")

SO="${ROOT_DIR}/programs/.bin/gumball_guard.so"
ACCOUNTS_DIR="${ROOT_DIR}/.amman/accounts"

if [ ! -f "$SO" ]; then
    echo "error: ${SO} not found — build the program first (pnpm programs:build)"
    exit 1
fi

# Isolated, throwaway solana home + ledger so we never touch the user's config.
WORK=$(mktemp -d)
trap 'kill "${VALIDATOR_PID:-}" 2>/dev/null || true; rm -rf "$WORK"' EXIT
export HOME="$WORK"
mkdir -p "$HOME/.config/solana"
solana-keygen new --no-bip39-passphrase -s -o "$HOME/.config/solana/id.json" >/dev/null

RPC_PORT=8917
solana-test-validator \
    --ledger "$WORK/ledger" \
    --reset --quiet \
    --rpc-port "$RPC_PORT" \
    --upgradeable-program "$GUARD_ID" "$SO" "$UPGRADE_AUTHORITY" &
VALIDATOR_PID=$!

RPC="http://127.0.0.1:${RPC_PORT}"
for _ in $(seq 1 30); do
    if solana -u "$RPC" cluster-version >/dev/null 2>&1; then break; fi
    sleep 1
done

PROGRAM_DATA=$(solana -u "$RPC" program show "$GUARD_ID" | grep -i "ProgramData Address" | awk '{print $NF}')
if [ -z "$PROGRAM_DATA" ]; then
    echo "error: failed to resolve ProgramData address"
    exit 1
fi

mkdir -p "$ACCOUNTS_DIR"
solana -u "$RPC" account "$GUARD_ID" -o "${ACCOUNTS_DIR}/${GUARD_ID}.json" --output json >/dev/null
solana -u "$RPC" account "$PROGRAM_DATA" -o "${ACCOUNTS_DIR}/${PROGRAM_DATA}.json" --output json >/dev/null

echo "Wrote upgradeable-program fixtures to ${ACCOUNTS_DIR}:"
echo "  program:     ${GUARD_ID}.json"
echo "  programData: ${PROGRAM_DATA}.json (upgrade authority ${UPGRADE_AUTHORITY})"

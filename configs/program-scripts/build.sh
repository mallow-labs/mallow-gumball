#!/bin/bash
set -eo pipefail

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
OUTPUT="./programs/.bin"
# saves external programs binaries to the output directory
source ${SCRIPT_DIR}/dump.sh ${OUTPUT}
# go to parent folder
cd $( dirname $( dirname ${SCRIPT_DIR} ) )

if [ -z ${PROGRAMS+x} ]; then
    PROGRAMS="`cat .github/.env | grep "PROGRAMS" | cut -d '=' -f 2`"
fi

# default to input from the command-line
ARGS=$*

# command-line arguments override env variable
if [ ! -z "$ARGS" ]; then
    PROGRAMS="[\"${1}\"]"
    shift
    ARGS=$*
fi

PROGRAMS=$(echo ${PROGRAMS} | jq -c '.[]' | sed 's/"//g')

# creates the output directory if it doesn't exist
if [ ! -d ${OUTPUT} ]; then
    mkdir ${OUTPUT}
fi

WORKING_DIR=$(pwd)

# Refuse to publish a binary or generated interface for another address.
assert_program_identity() {
    if ! grep -Fq "declare_id!(\"${PROGRAM_ID}\")" program/src/lib.rs ||
        [ "$(jq -r '.address' "target/idl/${PROGRAM_NAME}.json")" != "${PROGRAM_ID}" ]; then
        echo "Build changed the canonical program ID for ${p}; refusing artifact publication" >&2
        exit 1
    fi
}

for p in ${PROGRAMS[@]}; do
    case "${p}" in
        mallow-gumball) PROGRAM_ID="MGUMqztv7MHgoHBYWbvMyL3E3NJ4UHfTwgLJUQAbKGa" ;;
        gumball-guard) PROGRAM_ID="GGRDy4ieS7ExrUu313QkszyuT9o3BvDLuc3H5VLgCpSF" ;;
        *) echo "Unknown canonical program ID for ${p}" >&2; exit 1 ;;
    esac
    PROGRAM_NAME=${p//-/_}
    cd "${WORKING_DIR}/programs/${p}"
    # Anchor 1.1 syncs a newly generated key even with --ignore-keys. Pre-create
    # a local placeholder on cold caches; it is never a deployment identity.
    mkdir -p target/deploy
    if [ ! -f "target/deploy/${PROGRAM_NAME}-keypair.json" ]; then
        solana-keygen new --no-bip39-passphrase --silent -o "target/deploy/${PROGRAM_NAME}-keypair.json"
    fi
    cd ${WORKING_DIR}/programs/${p}/program
    # Phase 1: `anchor build` generates the IDL and the TS types. Its own .so is
    # a v0 build that phase 2 overwrites.
    # A non-localnet provider auto-syncs keys even with --ignore-keys.
    anchor build --provider.cluster localnet --ignore-keys
    (cd .. && assert_program_identity)
    # Phase 2: rebuild the .so for SBPFv2 (dynamic stack frames): mpl-core 0.12.1's
    # Core-asset deserializers exceed the v0 fixed 4KB frame and fault at runtime;
    # v2 removes the limit. NOTE: deploy targets must have SBPFv2 execution activated.
    # platform-tools is pinned to v1.52: LiteSVM 1.3.0 mis-executes SBPFv2 ELFs
    # emitted by v1.54+ (access violations / corrupted signer seeds at the first
    # invoke_signed). Drop the pin once litesvm runs v1.54 v2 output correctly.
    # This cannot be folded into `anchor build -- --arch v2 --tools-version v1.52`:
    # anchor already passes --tools-version (derived from `solana_version` in
    # Anchor.toml) and cargo-build-sbf rejects the flag twice. Writing into
    # target/deploy keeps a single deployable artifact.
    # Anchor just wrote v0 here. A warm SBF cache can skip regenerating a newer
    # output, so remove it before publishing the SBPFv2 build.
    rm -f "${WORKING_DIR}/programs/${p}/target/deploy/${PROGRAM_NAME}.so"
    cargo build-sbf --arch v2 --tools-version v1.52 --sbf-out-dir ${WORKING_DIR}/programs/${p}/target/deploy $ARGS
    (cd .. && assert_program_identity)
    # programs/.bin/ holds the same bytes next to the dumped external programs for
    # the LiteSVM and test-sbf suites.
    cp ${WORKING_DIR}/programs/${p}/target/deploy/*.so ${WORKING_DIR}/${OUTPUT}/
    # The AnchorIdls types ship with the umi client.
    cp ${WORKING_DIR}/programs/${p}/target/types/*.ts ${WORKING_DIR}/clients/umi/src/anchorIdls/
    # idls/ is the canonical codama input (see codama.mjs).
    cp ${WORKING_DIR}/programs/${p}/target/idl/*.json ${WORKING_DIR}/idls/
done

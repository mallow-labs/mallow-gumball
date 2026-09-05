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

for p in ${PROGRAMS[@]}; do
    cd ${WORKING_DIR}/programs/${p}/program
    # Phase 1: `anchor build` generates the IDL and the TS types. Its own .so is
    # a v0 build that phase 2 overwrites.
    anchor build
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
    cargo build-sbf --arch v2 --tools-version v1.52 --sbf-out-dir ${WORKING_DIR}/programs/${p}/target/deploy $ARGS
    # programs/.bin/ holds the same bytes next to the dumped external programs for
    # the LiteSVM and test-sbf suites.
    cp ${WORKING_DIR}/programs/${p}/target/deploy/*.so ${WORKING_DIR}/${OUTPUT}/
    # The AnchorIdls types ship with the umi client.
    cp ${WORKING_DIR}/programs/${p}/target/types/*.ts ${WORKING_DIR}/clients/umi/src/anchorIdls/
    # idls/ is the canonical codama input (see codama.mjs).
    cp ${WORKING_DIR}/programs/${p}/target/idl/*.json ${WORKING_DIR}/idls/
done

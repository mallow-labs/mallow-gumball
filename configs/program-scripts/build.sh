#!/bin/bash

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
export SBF_OUT_DIR="${WORKING_DIR}/${OUTPUT}"

for p in ${PROGRAMS[@]}; do
    cd ${WORKING_DIR}/programs/${p}/program
    # SBPFv2 (dynamic stack frames): mpl-core 0.12.1's Core-asset deserializers
    # exceed the v0 fixed 4KB frame and fault at runtime; v2 removes the limit.
    # NOTE: deploy targets must have SBPFv2 execution activated.
    # platform-tools is pinned to v1.52: LiteSVM 1.3.0 mis-executes SBPFv2 ELFs
    # emitted by v1.54+ (access violations / corrupted signer seeds at the first
    # invoke_signed). Drop the pin once litesvm runs v1.54 v2 output correctly.
    cargo build-sbf --arch v2 --tools-version v1.52 --sbf-out-dir ${WORKING_DIR}/${OUTPUT} $ARGS
    anchor build # generate types + spec-0.1.0 IDL
    cp ${WORKING_DIR}/programs/${p}/target/types/*.ts ${WORKING_DIR}/clients/js/src/anchorIdls/
    # idls/ is the canonical codama input (see codama.mjs).
    cp ${WORKING_DIR}/programs/${p}/target/idl/*.json ${WORKING_DIR}/idls/
done
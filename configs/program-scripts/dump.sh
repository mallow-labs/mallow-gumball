#!/bin/bash
# Installs the pinned external program binaries into the output directory.

# output colours
RED() { echo $'\e[1;31m'$1$'\e[0m'; }
GRN() { echo $'\e[1;32m'$1$'\e[0m'; }

CURRENT_DIR=$(pwd)
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
MANIFEST=${SCRIPT_DIR}/external-programs.txt
# go to parent folder
cd $(dirname $(dirname $SCRIPT_DIR))

OUTPUT=$1

if [ -z "$OUTPUT" ]; then
    echo "missing output directory"
    exit 1
fi

mkdir -p ${OUTPUT}

RELEASE=$(awk '$1 == "release" { print $2 }' ${MANIFEST})
RELEASE_URL="https://github.com/mallow-labs/mallow-gumball/releases/download/${RELEASE}"

sha_of() { sha256sum -b "$1" | cut -d ' ' -f 1; }

echo "Installing external programs from '${RELEASE}' to '${OUTPUT}':"

while read -r FILE PROGRAM_ID CLUSTER SHA; do
    case "$FILE" in "" | \#* | release) continue ;; esac

    if [ -f "${OUTPUT}/${FILE}" ] && [ "$(sha_of "${OUTPUT}/${FILE}")" == "$SHA" ]; then
        echo "$(GRN "[ SKIPPED ]") '${FILE}' already matches its pin"
        continue
    fi

    DOWNLOAD="${OUTPUT}/.download-${FILE}"
    if ! curl -fsSL --retry 3 -o "$DOWNLOAD" "${RELEASE_URL}/${FILE}"; then
        rm -f "$DOWNLOAD"
        echo $(RED "[  ERROR  ] could not download '${FILE}' from '${RELEASE}'")
        exit 1
    fi
    ACTUAL=$(sha_of "$DOWNLOAD")
    if [ "$ACTUAL" != "$SHA" ]; then
        rm -f "$DOWNLOAD"
        echo $(RED "[  ERROR  ] '${FILE}' has SHA-256 ${ACTUAL}, pinned ${SHA}")
        exit 1
    fi
    mv "$DOWNLOAD" "${OUTPUT}/${FILE}"
    echo "Wrote ${OUTPUT}/${FILE}"
done < ${MANIFEST}

echo ""

cd ${CURRENT_DIR}

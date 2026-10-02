#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${IDF_PATH:?Activate an isolated ESP-IDF 5.4.2 environment first}"
python "$IDF_PATH/tools/idf.py" -C firmware -DIDF_TARGET=esp32s3 build

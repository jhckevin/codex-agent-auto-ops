#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
npm test
python3 tests/serial_posix_test.py
bash tools/check-firmware-models.sh

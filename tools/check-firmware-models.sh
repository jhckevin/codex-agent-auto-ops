#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${IDF_PATH:?Set IDF_PATH to ESP-IDF 5.4.2}"
mkdir -p artifacts
cc -std=c11 -Wall -Wextra -Werror -Ifirmware/main -I"$IDF_PATH/components/json/cJSON" tests/firmware_test.c firmware/main/protocol.c "$IDF_PATH/components/json/cJSON/cJSON.c" -lm -o artifacts/firmware-protocol-test
artifacts/firmware-protocol-test
cc -std=c11 -Wall -Wextra -Werror -Ifirmware/main tests/ui_model_test.c firmware/main/ui_model.c -o artifacts/ui-model-test
artifacts/ui-model-test
cc -std=c11 -Wall -Wextra -Werror -Ifirmware/main tests/power_model_test.c firmware/main/power_model.c -o artifacts/power-model-test
artifacts/power-model-test
cc -std=c11 -Wall -Wextra -Werror -Ifirmware/main tests/motion_test.c -o artifacts/motion-model-test
artifacts/motion-model-test

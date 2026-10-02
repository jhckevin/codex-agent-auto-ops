#pragma once
#include <stdbool.h>
#include "esp_err.h"
esp_err_t agent_board_power_init(void);
esp_err_t agent_board_power_key(bool*pressed);
esp_err_t agent_board_power_off(void);
bool agent_board_power_available(void);

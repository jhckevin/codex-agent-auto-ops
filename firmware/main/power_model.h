#pragma once
#include <stdbool.h>
#include <stdint.h>
#define AGENT_SCREEN_TIMEOUT_MS 60000u
#define AGENT_POWER_HOLD_MS 2000u
typedef struct {
 uint64_t last_touch,pressed_at,raw_changed;
 bool asleep,shutdown,raw,stable,long_fired,ignore_until_release;
 unsigned short_presses,long_presses,wakes;
} agent_power_model;
void agent_power_init(agent_power_model*p,uint64_t now,bool pressed);
void agent_power_tick(agent_power_model*p,uint64_t now);
void agent_power_touch(agent_power_model*p,uint64_t now);
void agent_power_blank(agent_power_model*p);
void agent_power_button(agent_power_model*p,uint64_t now,bool pressed);

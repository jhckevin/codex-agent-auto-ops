#pragma once
#include <stdbool.h>
#include <stdint.h>
#include "cJSON.h"
void cua_ui_init(const char*mac);
void cua_ui_links(bool mounted,bool suspended);
void cua_ui_heartbeat(bool video);
bool cua_ui_ready(void);
bool cua_ui_paused(void);
int cua_ui_take_switch(void);
void cua_ui_pause(void);
unsigned cua_ui_action_start(const cJSON*action,unsigned seq);
void cua_ui_action_finish(unsigned id,bool ok,const char*error);
bool cua_ui_command(const cJSON*request,char*out,unsigned cap);
void cua_ui_screenshot(void);

bool cua_ui_take_shutdown(void);

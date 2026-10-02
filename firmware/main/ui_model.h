#pragma once
#include <stdbool.h>
#include <stdint.h>
#define CUA_HISTORY 12
#define CUA_AGENT_LEASE_MS 5000
#define CUA_ACTION_CARD_MS 5000
typedef enum {UI_HOME,UI_GUIDE,UI_HISTORY,UI_DEVICE,UI_DETAIL} cua_page;
typedef struct {
 unsigned id,seq; uint64_t started; unsigned duration_ms;
 char title[48],detail[128],result[48]; bool running,ok,demo;
} cua_ui_event;
typedef struct {
 bool usb, suspended, paused, agent_seen, video, demo;
 uint64_t agent_at, now; unsigned next_id,count; cua_page page;
 unsigned selected; cua_ui_event events[CUA_HISTORY];
 char mac[18];
} cua_ui_model;
void cua_model_init(cua_ui_model*m,const char*mac);
void cua_model_heartbeat(cua_ui_model*m,uint64_t now,bool video);
bool cua_model_agent(const cua_ui_model*m);
bool cua_model_ready(const cua_ui_model*m);
const cua_ui_event*cua_model_recent(const cua_ui_model*m,unsigned index);
const cua_ui_event*cua_model_active(const cua_ui_model*m);
unsigned cua_model_start(cua_ui_model*m,unsigned seq,const char*title,const char*detail,bool demo);
void cua_model_finish(cua_ui_model*m,unsigned id,bool ok,const char*result);
int cua_port_y(int bottom_basis_points);

#pragma once
#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>
#include "cJSON.h"
#define CUA_LINE_MAX 8000
typedef struct {
    bool (*perform)(const cJSON *action, void *ctx);
    bool (*release)(void *ctx);
    bool (*ready)(void *ctx);
    void *ctx;
    bool (*mounted)(void *ctx);
} cua_io;
typedef struct {
    uint32_t boot_id;
    char mac[18];
    bool armed;
    char session[33];
    unsigned seq;
    uint64_t touched;
    char last_request[CUA_LINE_MAX+1];
    char last_response[512];
    cua_io io;
} cua_protocol;
void cua_init(cua_protocol *p, uint32_t boot_id, const char *mac, cua_io io);
void cua_disarm(cua_protocol *p);
void cua_tick(cua_protocol *p, uint64_t now);
void cua_request(cua_protocol *p, const char *line, uint64_t now, char *out, size_t cap);
bool cua_action_valid(const cJSON *a);

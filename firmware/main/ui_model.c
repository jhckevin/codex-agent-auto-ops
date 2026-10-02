#include "ui_model.h"
#include <string.h>
#include <stdio.h>
void cua_model_init(cua_ui_model*m,const char*mac){memset(m,0,sizeof(*m));snprintf(m->mac,sizeof m->mac,"%s",mac);}
void cua_model_heartbeat(cua_ui_model*m,uint64_t now,bool video){m->now=now;m->agent_at=now;m->agent_seen=true;m->video=video;}
bool cua_model_agent(const cua_ui_model*m){return m->agent_seen&&m->now>=m->agent_at&&m->now-m->agent_at<CUA_AGENT_LEASE_MS;}
bool cua_model_ready(const cua_ui_model*m){return !m->demo&&!m->paused&&m->usb&&!m->suspended&&cua_model_agent(m)&&m->video;}
const cua_ui_event*cua_model_recent(const cua_ui_model*m,unsigned i){if(i>=m->count)return NULL;return &m->events[(m->next_id-1-i)%CUA_HISTORY];}
const cua_ui_event*cua_model_active(const cua_ui_model*m){const cua_ui_event*e=cua_model_recent(m,0);return e&&m->now>=e->started&&m->now-e->started<CUA_ACTION_CARD_MS?e:NULL;}
unsigned cua_model_start(cua_ui_model*m,unsigned seq,const char*title,const char*detail,bool demo){
 unsigned id=++m->next_id;cua_ui_event*e=&m->events[(id-1)%CUA_HISTORY];memset(e,0,sizeof(*e));
 e->id=id;e->seq=seq;e->started=m->now;e->running=true;e->demo=demo;
 snprintf(e->title,sizeof e->title,"%s",title);snprintf(e->detail,sizeof e->detail,"%s",detail);snprintf(e->result,sizeof e->result,"执行中");
 if(m->count<CUA_HISTORY)m->count++;
 return id;
}
void cua_model_finish(cua_ui_model*m,unsigned id,bool ok,const char*result){
 if(!id)return;
 cua_ui_event*e=&m->events[(id-1)%CUA_HISTORY];if(e->id!=id)return;
 e->running=false;e->ok=ok;e->duration_ms=(unsigned)(m->now-e->started);
 snprintf(e->result,sizeof e->result,"%s",result);
}
int cua_port_y(int bottom_basis_points){return (480*(10000-bottom_basis_points)+5000)/10000;}

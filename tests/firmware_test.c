#include <assert.h>
#include <stdio.h>
#include <string.h>
#include "protocol.h"
static int sent,released;static bool connected=true,fail_send=false;
static bool perform(const cJSON*a,void*x){(void)a;(void)x;sent++;return !fail_send;}
static bool release(void*x){(void)x;released++;return connected;}
static bool ready(void*x){(void)x;return connected;}
int main(void){
 static cua_protocol p;char out[512];cua_init(&p,42,"00:11:22:33:44:55",(cua_io){perform,release,ready,NULL,NULL});
 const char*begin="{\"v\":1,\"op\":\"begin\",\"seq\":0,\"boot_id\":42,\"session\":\"0123456789abcdef0123456789abcdef\"}";
 const char*act="{\"v\":1,\"op\":\"act\",\"seq\":1,\"session\":\"0123456789abcdef0123456789abcdef\",\"action\":{\"kind\":\"click\",\"x\":10,\"y\":20}}";
 cua_request(&p,act,1,out,sizeof out);assert(strstr(out,"not_armed"));assert(sent==0);
 cua_request(&p,begin,2,out,sizeof out);assert(p.armed);
 cua_request(&p,act,3,out,sizeof out);assert(sent==1&&strstr(out,"usb_reports_completed"));
 cua_request(&p,act,4,out,sizeof out);assert(sent==1);
 cua_request(&p,"{\"v\":1,\"op\":\"act\",\"seq\":1,\"session\":\"0123456789abcdef0123456789abcdef\",\"action\":{\"kind\":\"move\",\"x\":10,\"y\":20}}",5,out,sizeof out);assert(strstr(out,"sequence_conflict"));assert(sent==1);
 cua_request(&p,"{\"v\":1,\"op\":\"act\",\"seq\":2,\"session\":\"0123456789abcdef0123456789abcdef\",\"action\":{\"kind\":\"move\",\"x\":-1,\"y\":20}}",6,out,sizeof out);assert(strstr(out,"invalid_action"));assert(sent==1);
 cua_tick(&p,10004);assert(!p.armed);cua_request(&p,act,10005,out,sizeof out);assert(sent==1);
 cua_request(&p,begin,10006,out,sizeof out);fail_send=true;cua_request(&p,act,10007,out,sizeof out);assert(sent==2&&strstr(out,"outcome_unknown"));
 cua_request(&p,act,10008,out,sizeof out);assert(sent==2&&strstr(out,"outcome_unknown"));
 connected=false;cua_tick(&p,10009);assert(!p.armed&&released>=4);
 cua_request(&p,"{\"v\":1,\"v\":1,\"op\":\"hello\",\"seq\":0}",10010,out,sizeof out);assert(strstr(out,"invalid_request"));
 const char*valid[]={"{\"kind\":\"click_current\"}","{\"kind\":\"click_current\",\"button\":\"right\",\"count\":2}","{\"kind\":\"scroll_current\",\"ticks\":-2}"};
 for(unsigned i=0;i<sizeof valid/sizeof valid[0];i++){cJSON*a=cJSON_Parse(valid[i]);assert(cua_action_valid(a));cJSON_Delete(a);}
 const char*invalid[]={"{\"kind\":\"click_current\",\"x\":4}","{\"kind\":\"click_current\",\"button\":\"unknown\"}","{\"kind\":\"scroll_current\",\"ticks\":11}"};
 for(unsigned i=0;i<sizeof invalid/sizeof invalid[0];i++){cJSON*a=cJSON_Parse(invalid[i]);assert(!cua_action_valid(a));cJSON_Delete(a);}
 const char*motions[]={"{\"kind\":\"move_relative\",\"dx\":8192,\"dy\":-8192}","{\"kind\":\"pointer_keepalive\",\"direction\":1}"};
 for(unsigned i=0;i<sizeof motions/sizeof motions[0];i++){cJSON*a=cJSON_Parse(motions[i]);assert(cua_action_valid(a));cJSON_Delete(a);}
 cJSON*a=cJSON_Parse("{\"kind\":\"pointer_keepalive\",\"direction\":0}");assert(!cua_action_valid(a));cJSON_Delete(a);
 puts("firmware protocol tests passed: disarmed, dedupe, conflict, bounds, watchdog, unknown, disconnect, duplicate keys");
}

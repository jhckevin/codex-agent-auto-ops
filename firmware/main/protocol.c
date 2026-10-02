#include "protocol.h"
#include <stdio.h>
#include <string.h>
#include <math.h>
static const cJSON *get(const cJSON *o,const char *k){return cJSON_GetObjectItemCaseSensitive(o,k);}
static const char *str(const cJSON *o,const char *k){const cJSON *v=get(o,k);return cJSON_IsString(v)?v->valuestring:"";}
static bool number(const cJSON *o,const char *k,int lo,int hi){const cJSON*v=get(o,k);return cJSON_IsNumber(v)&&isfinite(v->valuedouble)&&floor(v->valuedouble)==v->valuedouble&&v->valuedouble>=lo&&v->valuedouble<=hi;}
static bool optional_num(const cJSON *o,const char*k,int lo,int hi){return !get(o,k)||number(o,k,lo,hi);}
static bool keys(const cJSON *o,const char *allowed){
 if(!cJSON_IsObject(o))return false;
 for(const cJSON*i=o->child;i;i=i->next){
  if(!i->string)return false;
  char token[80];if(strlen(i->string)>60)return false;snprintf(token,sizeof token,"|%s|",i->string);
  if(!strstr(allowed,token))return false;
  for(const cJSON*j=i->next;j;j=j->next)if(j->string&&!strcmp(i->string,j->string))return false;
 }
 return true;
}
static bool point(const cJSON*a){return number(a,"x",0,32767)&&number(a,"y",0,32767);}
bool cua_action_valid(const cJSON*a){
 const char*k=str(a,"kind");
 if(!strcmp(k,"click_current"))return keys(a,"|kind||button||count|")&&optional_num(a,"count",1,2)&&(!get(a,"button")||!strcmp(str(a,"button"),"left")||!strcmp(str(a,"button"),"right")||!strcmp(str(a,"button"),"middle"));
 if(!strcmp(k,"pointer_keepalive"))return keys(a,"|kind||direction|")&&number(a,"direction",-1,1)&&get(a,"direction")->valueint!=0;
 if(!strcmp(k,"scroll_current"))return keys(a,"|kind||ticks|")&&number(a,"ticks",-10,10);
 if(!strcmp(k,"move"))return keys(a,"|kind||x||y|")&&point(a);
 if(!strcmp(k,"click"))return keys(a,"|kind||x||y||button||count|")&&point(a)&&optional_num(a,"count",1,2)&&(!get(a,"button")||!strcmp(str(a,"button"),"left")||!strcmp(str(a,"button"),"right")||!strcmp(str(a,"button"),"middle"));
 if(!strcmp(k,"scroll"))return keys(a,"|kind||x||y||ticks|")&&point(a)&&number(a,"ticks",-10,10);
 if(!strcmp(k,"move_relative"))return keys(a,"|kind||dx||dy|")&&number(a,"dx",-8192,8192)&&number(a,"dy",-8192,8192);
 if(!strcmp(k,"drag")){
  if(!keys(a,"|kind||path||duration_ms|")||!optional_num(a,"duration_ms",50,1500))return false;
  const cJSON*path=get(a,"path");int n=cJSON_GetArraySize(path);if(!cJSON_IsArray(path)||n<2||n>32)return false;
  for(const cJSON*p=path->child;p;p=p->next)if(!keys(p,"|x||y|")||!point(p))return false;
  return true;
 }
 if(!strcmp(k,"press_key")||!strcmp(k,"type_text")){
  if(!keys(a,"|kind||strokes|"))return false;
  const cJSON*s=get(a,"strokes");int n=cJSON_GetArraySize(s);
  if(!cJSON_IsArray(s)||n<1||n>(!strcmp(k,"press_key")?1:128))return false;
  for(const cJSON*p=s->child;p;p=p->next)if(!keys(p,"|usage||mod|")||!number(p,"usage",4,115)||!number(p,"mod",0,15))return false;
  return true;
 }
 return false;
}
void cua_init(cua_protocol*p,uint32_t boot,const char*mac,cua_io io){memset(p,0,sizeof(*p));p->boot_id=boot;snprintf(p->mac,sizeof p->mac,"%s",mac);p->io=io;}
void cua_disarm(cua_protocol*p){p->armed=false;p->session[0]=0;p->io.release(p->io.ctx);}
void cua_tick(cua_protocol*p,uint64_t now){if(p->armed&&(now-p->touched>10000||!p->io.ready(p->io.ctx)))cua_disarm(p);}
static void reply(cua_protocol*p,const char*op,int seq,bool ok,const char*error,char*out,size_t cap){
 cJSON*r=cJSON_CreateObject();cJSON_AddNumberToObject(r,"v",1);cJSON_AddStringToObject(r,"op",op);cJSON_AddNumberToObject(r,"seq",seq);cJSON_AddBoolToObject(r,"ok",ok);
 cJSON_AddNumberToObject(r,"boot_id",p->boot_id);cJSON_AddStringToObject(r,"firmware","agent-auto-ops-0.3.4");
 cJSON_AddStringToObject(r,"mac",p->mac);cJSON_AddBoolToObject(r,"mounted",p->io.mounted?p->io.mounted(p->io.ctx):p->io.ready(p->io.ctx));cJSON_AddBoolToObject(r,"ready",p->io.ready(p->io.ctx));cJSON_AddBoolToObject(r,"armed",p->armed);
 if(error)cJSON_AddStringToObject(r,"error",error);
 if(ok&&!strcmp(op,"act"))cJSON_AddStringToObject(r,"delivery","usb_reports_completed");
 if(!cJSON_PrintPreallocated(r,out,(int)cap,false))snprintf(out,cap,"{\"ok\":false,\"error\":\"reply_overflow\"}");
 cJSON_Delete(r);
}
static bool nonce(const char*s){if(strlen(s)!=32)return false;for(;*s;s++)if(!((*s>='0'&&*s<='9')||(*s>='a'&&*s<='f')))return false;return true;}
void cua_request(cua_protocol*p,const char*line,uint64_t now,char*out,size_t cap){
 cua_tick(p,now);
 if(strlen(line)>CUA_LINE_MAX){reply(p,"error",0,false,"too_long",out,cap);return;}
 cJSON*r=cJSON_ParseWithOpts(line,NULL,true);const char*op=r?str(r,"op"):"error";
 int seq=r&&number(r,"seq",0,2147483647)?get(r,"seq")->valueint:0;
 if(!r||!keys(r,"|v||op||seq||session||boot_id||action|")||!number(r,"v",1,1)||!number(r,"seq",0,2147483647)){
  reply(p,"error",seq,false,"invalid_request",out,cap);cJSON_Delete(r);return;
 }
 const char*err=NULL;bool ok=false,cache=false;
 if(!strcmp(op,"hello"))ok=true;
 else if(!strcmp(op,"release")){p->armed=false;p->session[0]=0;ok=p->io.release(p->io.ctx);if(!ok)err="release_unconfirmed";}
 else if(!strcmp(op,"begin")){
  const cJSON*b=get(r,"boot_id");const char*s=str(r,"session");
  if(!cJSON_IsNumber(b)||b->valuedouble!=p->boot_id||!nonce(s)||seq!=0)err="identity_or_nonce";
  else if(!p->io.ready(p->io.ctx)||!p->io.release(p->io.ctx))err="usb_not_ready";
  else{snprintf(p->session,sizeof p->session,"%s",s);p->seq=0;p->armed=true;p->touched=now;p->last_request[0]=0;ok=true;}
 }else if(!strcmp(op,"act")){
  if(!p->armed||strcmp(str(r,"session"),p->session))err="not_armed";
  else if((unsigned)seq==p->seq && p->last_request[0]){
   if(!strcmp(line,p->last_request)){snprintf(out,cap,"%s",p->last_response);cJSON_Delete(r);return;}
   err="sequence_conflict";
  }else if((unsigned)seq!=p->seq+1)err="sequence_gap";
  else if(!cua_action_valid(get(r,"action")))err="invalid_action";
  else{
   p->seq=(unsigned)seq;p->touched=now;snprintf(p->last_request,sizeof p->last_request,"%s",line);cache=true;
   bool sent=p->io.perform(get(r,"action"),p->io.ctx);bool released=p->io.release(p->io.ctx);
   ok=sent&&released;if(!ok)err="outcome_unknown";
  }
 }else err="unknown_op";
 reply(p,op,seq,ok,err,out,cap);if(cache)snprintf(p->last_response,sizeof p->last_response,"%s",out);
 cJSON_Delete(r);
}

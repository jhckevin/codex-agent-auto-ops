#include <assert.h>
#include <stdio.h>
#include <string.h>
#include "ui_model.h"
int main(void){
 cua_ui_model m;cua_model_init(&m,"02:00:00:00:00:01");
 assert(!cua_model_ready(&m));m.usb=true;
 cua_model_heartbeat(&m,1000,false);assert(!cua_model_ready(&m));
 cua_model_heartbeat(&m,1100,true);assert(cua_model_ready(&m));
 m.now=6099;assert(cua_model_ready(&m));m.now=6100;assert(!cua_model_ready(&m));
 cua_model_heartbeat(&m,7000,true);m.paused=true;assert(!cua_model_ready(&m));m.paused=false;
 m.suspended=true;assert(!cua_model_ready(&m));m.suspended=false;m.usb=false;assert(!cua_model_ready(&m));
 m.usb=true;m.demo=true;assert(!cua_model_ready(&m));m.demo=false;
 unsigned id=cua_model_start(&m,1,"click","x=30 y=40",false);
 m.now=7100;cua_model_finish(&m,id,true,"sent");assert(cua_model_active(&m)->duration_ms==100);
 m.now=11999;assert(cua_model_active(&m));m.now=12000;assert(!cua_model_active(&m));
 assert(cua_model_recent(&m,0)->id==id);
 for(unsigned i=0;i<30;i++)cua_model_start(&m,i,"key","hidden",false);
 assert(m.count==CUA_HISTORY);assert(cua_model_recent(&m,11)->id==20);assert(!cua_model_recent(&m,12));
 assert(cua_port_y(3380)==318&&cua_port_y(2079)==380);
 assert(cua_port_y(5587)==212&&cua_port_y(4225)==277);
 puts("UI model: lease, readiness, 5s lifetime, ring history and physical port mapping passed");return 0;
}

#include <assert.h>
#include <stdio.h>
#include "power_model.h"
int main(void){
 agent_power_model p;agent_power_init(&p,1000,false);
 agent_power_tick(&p,60999);assert(!p.asleep);agent_power_tick(&p,61000);assert(p.asleep);
 agent_power_touch(&p,62000);assert(!p.asleep&&p.wakes==1);
 agent_power_button(&p,63000,true);agent_power_button(&p,63050,true);
 agent_power_button(&p,63200,false);agent_power_button(&p,63250,false);
 assert(p.asleep&&!p.shutdown&&p.short_presses==1);
 /* Short press never wakes a sleeping screen. */
 agent_power_button(&p,64000,true);agent_power_button(&p,64050,true);
 agent_power_button(&p,64200,false);agent_power_button(&p,64250,false);assert(p.asleep);
 agent_power_touch(&p,65000);assert(!p.asleep);
 agent_power_button(&p,66000,true);agent_power_button(&p,66050,true);
 agent_power_button(&p,68049,true);assert(!p.shutdown);agent_power_button(&p,68050,true);assert(p.shutdown&&p.long_presses==1);
 agent_power_touch(&p,68100);assert(p.asleep&&p.shutdown);
 agent_power_button(&p,68200,false);agent_power_button(&p,68250,false);assert(p.short_presses==2);
 /* Boot with held power key does not immediately turn the board back off. */
 agent_power_init(&p,0,true);agent_power_button(&p,4000,true);assert(!p.shutdown);
 agent_power_button(&p,4100,false);agent_power_button(&p,4200,false);assert(!p.asleep);
 puts("Power model: 60s idle, touch-only wake, debounce, short/long distinction, held boot key passed");
}

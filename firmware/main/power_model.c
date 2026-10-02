#include "power_model.h"
#include <string.h>
void agent_power_init(agent_power_model*p,uint64_t now,bool pressed){
 memset(p,0,sizeof(*p));p->last_touch=now;p->raw=pressed;p->stable=pressed;
 p->ignore_until_release=pressed;p->raw_changed=now;
}
void agent_power_tick(agent_power_model*p,uint64_t now){
 if(!p->shutdown&&!p->asleep&&now>=p->last_touch&&now-p->last_touch>=AGENT_SCREEN_TIMEOUT_MS)p->asleep=true;
}
void agent_power_touch(agent_power_model*p,uint64_t now){
 if(p->shutdown)return;
 if(p->asleep)p->wakes++;
 p->asleep=false;p->last_touch=now;
}
void agent_power_blank(agent_power_model*p){if(!p->shutdown)p->asleep=true;}
void agent_power_button(agent_power_model*p,uint64_t now,bool pressed){
 if(p->raw!=pressed){p->raw=pressed;p->raw_changed=now;}
 if(now-p->raw_changed<40)return;
 if(p->stable!=pressed){
  p->stable=pressed;
  if(pressed){p->pressed_at=now;p->long_fired=false;}
  else if(p->ignore_until_release)p->ignore_until_release=false;
  else if(!p->long_fired&&!p->shutdown){p->short_presses++;agent_power_blank(p);}
 }
 if(p->stable&&!p->ignore_until_release&&!p->long_fired&&now-p->pressed_at>=AGENT_POWER_HOLD_MS){
  p->long_fired=true;p->long_presses++;p->shutdown=true;p->asleep=true;
 }
}

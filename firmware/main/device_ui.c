#include "device_ui.h"
#include "ui_model.h"
#include "power_model.h"
#include "device_power.h"
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <assert.h>
#include <stdatomic.h>
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "freertos/task.h"
#include "esp_timer.h"
#include "esp_heap_caps.h"
#include "esp_pm.h"
#include "esp_private/esp_clk.h"
#include "esp_lvgl_port.h"
#include "bsp/esp32_s3_touch_lcd_4b.h"
#include "driver/uart.h"
#include "mbedtls/base64.h"
#include "lvgl.h"
LV_FONT_DECLARE(cua_font_16);
LV_FONT_DECLARE(cua_font_20);
LV_FONT_DECLARE(cua_font_30);
#define BG 0x0B111C
#define CARD 0x151F30
#define BORDER 0x26374B
#define FG 0xEDF4FC
#define MUTED 0x91A5BF
#define CYAN 0x55C9ED
#define GREEN 0x5DE0B2
#define AMBER 0xF2C477
static cua_ui_model model;
static agent_power_model power;
static SemaphoreHandle_t mutex;
static lv_display_t *display;
static lv_timer_t *render_timer;
static lv_obj_t *root,*body,*title,*badge,*nav[4],*hero,*hero_sub,*target_text,*agent_text,*video_text;
static lv_obj_t *target_rail,*agent_rail,*target_dot,*agent_dot,*toast,*toast_title,*toast_detail,*toast_result,*toast_bar;
static lv_obj_t *history_rows[CUA_HISTORY],*history_labels[CUA_HISTORY],*device_lines,*pause_button,*pause_label,*detail_lines;
static int switch_request;
static unsigned render_page=99;
static atomic_uint frame_generation,touch_count,power_error;
static atomic_bool touch_down,screen_dark,shutdown_sent;
static bool wake_touch_block;
static lv_indev_t *test_pointer;
static bool test_pressed,capture_requested;
static lv_point_t test_point;
static uint16_t *capture;
static unsigned capture_generation;
static uint64_t now_ms(void){return (uint64_t)(esp_timer_get_time()/1000);}
static void lock(void){xSemaphoreTake(mutex,portMAX_DELAY);}
static void unlock(void){xSemaphoreGive(mutex);}
static lv_color_t color(unsigned c){return lv_color_hex(c);}
static void text(lv_obj_t*o,const char*s){if(strcmp(lv_label_get_text(o),s))lv_label_set_text(o,s);}
static lv_obj_t*box(lv_obj_t*p,int x,int y,int w,int h,unsigned bg,int radius){
 lv_obj_t*o=lv_obj_create(p);lv_obj_remove_style_all(o);lv_obj_set_pos(o,x,y);lv_obj_set_size(o,w,h);
 lv_obj_set_style_bg_color(o,color(bg),0);lv_obj_set_style_bg_opa(o,255,0);lv_obj_set_style_radius(o,radius,0);
 lv_obj_remove_flag(o,LV_OBJ_FLAG_SCROLLABLE);return o;
}
static lv_obj_t*label(lv_obj_t*p,int x,int y,int w,const char*s,const lv_font_t*f,unsigned c){
 lv_obj_t*o=lv_label_create(p);lv_obj_set_pos(o,x,y);lv_obj_set_width(o,w);lv_obj_set_style_text_font(o,f,0);
 lv_obj_set_style_text_color(o,color(c),0);lv_label_set_text(o,s);return o;
}
static void border(lv_obj_t*o){lv_obj_set_style_border_color(o,color(BORDER),0);lv_obj_set_style_border_width(o,1,0);}
static void page_cb(lv_event_t*e){lock();model.page=(cua_page)(uintptr_t)lv_event_get_user_data(e);unlock();}
static lv_obj_t*button(lv_obj_t*p,int x,int y,int w,int h,const char*s,cua_page page){
 lv_obj_t*b=box(p,x,y,w,h,CARD,12);border(b);lv_obj_add_flag(b,LV_OBJ_FLAG_CLICKABLE);
 lv_obj_t*l=label(b,0,0,w,s,&cua_font_20,FG);lv_obj_set_style_text_align(l,LV_TEXT_ALIGN_CENTER,0);lv_obj_center(l);
 lv_obj_add_event_cb(b,page_cb,LV_EVENT_CLICKED,(void*)(uintptr_t)page);return b;
}
static void pause_cb(lv_event_t*e){(void)e;lock();model.paused=!model.paused;switch_request=model.paused?-1:1;unlock();}
static void history_cb(lv_event_t*e){
 lock();unsigned i=(unsigned)(uintptr_t)lv_event_get_user_data(e);const cua_ui_event*v=cua_model_recent(&model,i);
 if(v){model.selected=v->id;model.page=UI_DETAIL;}unlock();
}
static void touch_points(const esp_lcd_touch_point_data_t*p,uint8_t count,uint32_t ms,void*user){
 (void)p;(void)ms;(void)user;bool down=count>0,previous=atomic_exchange(&touch_down,down);
 if(down){if(!previous)touch_count++;lock();agent_power_touch(&power,now_ms());unlock();}
}
static void pointer_read(lv_indev_t*i,lv_indev_data_t*d){(void)i;d->point=test_point;d->state=test_pressed?LV_INDEV_STATE_PRESSED:LV_INDEV_STATE_RELEASED;}
static void snapshot_frame(lv_event_t*e){
 (void)e;if(!lv_display_flush_is_last(display))return;frame_generation++;
 if(!capture_requested||!capture)return;
 lv_draw_buf_t*b=lv_display_get_buf_active(display);
 if(!b||b->header.w!=480||b->header.h!=480||b->header.cf!=LV_COLOR_FORMAT_RGB565)return;
 for(int y=0;y<480;y++)memcpy(capture+y*480,b->data+y*b->header.stride,480*2);
 capture_generation=frame_generation;capture_requested=false;
}
static void power_result(esp_err_t e){if(e!=ESP_OK)atomic_store(&power_error,(unsigned)e);}
static void cpu_profile(bool dark){
 esp_pm_config_t c={.max_freq_mhz=dark?80:240,.min_freq_mhz=dark?80:240,.light_sleep_enable=false};
 power_result(esp_pm_configure(&c));
}
static void screen_mode(bool dark){
 lv_indev_t*input=bsp_display_get_input_dev();
 if(dark){
  lv_indev_enable(input,false);lv_indev_enable(test_pointer,false);
  power_result(bsp_display_backlight_off());power_result(bsp_display_panel_set_enabled(false));
  lv_timer_pause(lv_display_get_refr_timer(display));
  power_result(bsp_display_set_clock_hz(4000000));
  vTaskDelay(pdMS_TO_TICKS(160));cpu_profile(true);
  power_result(lvgl_port_touch_set_interval(input,80));lv_timer_set_period(render_timer,100);
  screen_dark=true;wake_touch_block=true;
 }else{
  cpu_profile(false);power_result(bsp_display_set_clock_hz(16000000));
  power_result(bsp_display_restart_scanout());vTaskDelay(pdMS_TO_TICKS(180));
  power_result(bsp_display_panel_set_enabled(true));
  power_result(lvgl_port_touch_set_interval(input,10));
  lv_timer_resume(lv_display_get_refr_timer(display));lv_timer_set_period(render_timer,50);
  lv_obj_invalidate(root);lv_refr_now(display);
  power_result(bsp_display_backlight_prepare_wake());power_result(bsp_display_brightness_set(65));
  screen_dark=false;
 }
}
static void power_task(void*arg){
 (void)arg;bool pressed=false;
 for(;;){
  if(agent_board_power_key(&pressed)==ESP_OK){
   lock();agent_power_button(&power,now_ms(),pressed);
   if(power.shutdown)model.paused=true;
   unlock();
  }
  vTaskDelay(pdMS_TO_TICKS(screen_dark?40:20));
 }
}
bool cua_ui_take_shutdown(void){
 lock();bool requested=power.shutdown;unlock();
 return requested&&!atomic_exchange(&shutdown_sent,requested);
}
static void draw_port(lv_obj_t*p,int center,bool output,unsigned accent,lv_obj_t**rail,lv_obj_t**dot){
 *rail=box(p,377,center-28,99,56,CARD,0);lv_obj_set_style_bg_opa(*rail,0,0);
 box(*rail,9,23,72,10,accent,5);
 static const lv_point_precise_t right[]={{65,7},{87,28},{65,49}};
 static const lv_point_precise_t left[]={{31,7},{9,28},{31,49}};
 lv_obj_t*head=lv_line_create(*rail);lv_line_set_points(head,output?right:left,3);
 lv_obj_set_style_line_color(head,color(accent),0);lv_obj_set_style_line_width(head,10,0);lv_obj_set_style_line_rounded(head,true,0);
 *dot=box(*rail,38,24,18,8,FG,4);
}
static void connection_cards(bool guide){
 lv_obj_t*t=box(body,16,142,454,96,CARD,16);border(t);
 label(t,18,14,330,"操作输出 · 被控设备",&cua_font_20,CYAN);
 target_text=label(t,18,53,322,guide?"键盘与鼠标操作":"未连接",&cua_font_16,MUTED);
 lv_obj_t*a=box(body,16,247,454,96,CARD,16);border(a);
 label(a,18,14,330,"指令输入 · Agent",&cua_font_20,GREEN);
 agent_text=label(a,18,53,322,guide?"运行 Codex 的笔记本":"未连接",&cua_font_16,MUTED);
 draw_port(body,(cua_port_y(5587)+cua_port_y(4225))/2-56,true,CYAN,&target_rail,&target_dot);
 draw_port(body,(cua_port_y(3380)+cua_port_y(2079))/2-56,false,GREEN,&agent_rail,&agent_dot);
}
static void build_home(void){
 hero=label(body,24,12,420,"准备连接",&cua_font_30,FG);
 hero_sub=label(body,24,59,420,"连接 Agent 与被控设备",&cua_font_16,MUTED);
 video_text=label(body,24,99,420,"目标画面 · 未连接",&cua_font_16,AMBER);
 connection_cards(false);
 toast=box(body,16,2,454,131,0x1D3144,16);border(toast);
 toast_title=label(toast,18,13,416,"",&cua_font_20,FG);
 toast_detail=label(toast,18,49,416,"",&cua_font_16,FG);
 toast_result=label(toast,18,85,416,"",&cua_font_16,GREEN);
 toast_bar=box(toast,18,120,416,3,CYAN,1);lv_obj_add_flag(toast,LV_OBJ_FLAG_HIDDEN);
}
static void build_guide(void){
 label(body,24,12,420,"连接设备",&cua_font_30,FG);
 label(body,24,57,420,"先连接 Agent，再连接被控设备",&cua_font_16,MUTED);
 label(body,24,97,428,"画面采集：被控设备 → 采集卡 → Agent",&cua_font_16,MUTED);
 connection_cards(true);
}
static void build_history(void){
 label(body,24,12,420,"最近操作",&cua_font_30,FG);
 label(body,24,56,420,"查看自动化操作与执行状态",&cua_font_16,MUTED);
 lv_obj_t*list=box(body,16,88,448,264,BG,0);lv_obj_add_flag(list,LV_OBJ_FLAG_SCROLLABLE);lv_obj_set_scroll_dir(list,LV_DIR_VER);
 for(unsigned i=0;i<CUA_HISTORY;i++){
  history_rows[i]=box(list,4,i*68,428,60,CARD,12);border(history_rows[i]);lv_obj_add_flag(history_rows[i],LV_OBJ_FLAG_CLICKABLE);
  history_labels[i]=label(history_rows[i],14,9,404,"",&cua_font_16,FG);
  lv_obj_add_event_cb(history_rows[i],history_cb,LV_EVENT_CLICKED,(void*)(uintptr_t)i);
 }
}
static void build_device(void){
 label(body,24,12,420,"设备设置",&cua_font_30,FG);
 device_lines=label(body,24,64,432,"",&cua_font_20,FG);lv_obj_set_style_text_line_space(device_lines,12,0);
 pause_button=box(body,24,237,430,48,0x244F56,12);lv_obj_add_flag(pause_button,LV_OBJ_FLAG_CLICKABLE);
 pause_label=label(pause_button,0,0,430,"暂停控制",&cua_font_20,FG);lv_obj_set_style_text_align(pause_label,LV_TEXT_ALIGN_CENTER,0);lv_obj_center(pause_label);
 lv_obj_add_event_cb(pause_button,pause_cb,LV_EVENT_CLICKED,NULL);
 label(body,24,310,430,"Agent 自动运维  ·  v0.3.3",&cua_font_16,MUTED);
}
static void build_detail(void){
 button(body,20,6,110,44,"< 返回",UI_HISTORY);
 label(body,148,16,294,"操作详情",&cua_font_20,FG);
 detail_lines=label(body,26,80,422,"",&cua_font_20,FG);lv_obj_set_style_text_line_space(detail_lines,16,0);
}
static void age_text(uint64_t now,uint64_t at,char*out,size_t cap){
 unsigned seconds=(unsigned)((now>=at?now-at:0)/1000);
 if(seconds<5)snprintf(out,cap,"刚刚");
 else if(seconds<60)snprintf(out,cap,"%u 秒前",seconds);
 else if(seconds<3600)snprintf(out,cap,"%u 分钟前",seconds/60);
 else snprintf(out,cap,"%u 小时前",seconds/3600);
}
static void render(lv_timer_t*t){
 (void)t;cua_ui_model m;bool dark;
 lock();model.now=now_ms();agent_power_tick(&power,model.now);m=model;dark=power.asleep;unlock();
 if(dark!=screen_dark)screen_mode(dark);
 if(dark)return;
 if(wake_touch_block&&!touch_down&&!test_pressed){
  lv_indev_enable(bsp_display_get_input_dev(),true);lv_indev_enable(test_pointer,true);wake_touch_block=false;
 }
 if(render_page!=(unsigned)m.page){
  lv_obj_clean(body);target_dot=agent_dot=NULL;render_page=m.page;
  switch(m.page){case UI_HOME:build_home();break;case UI_GUIDE:build_guide();break;case UI_HISTORY:build_history();break;case UI_DEVICE:build_device();break;default:build_detail();break;}
  const char*names[]={"总览","连接","记录","设置","详情"};text(title,names[m.page]);
  for(int i=0;i<4;i++)lv_obj_set_style_bg_color(nav[i],color(m.page==i?0x254055:CARD),0);
 }
 bool agent=cua_model_agent(&m),ready=cua_model_ready(&m);
 const char*state=m.demo?"测试":m.paused?"已暂停":ready?"已就绪":"待连接";
 text(badge,state);lv_obj_set_style_text_color(badge,color(ready?GREEN:m.paused?MUTED:AMBER),0);
 if(target_dot){
  unsigned step=(unsigned)((m.now/55)%44);
  lv_obj_set_x(target_dot,14+(int)step);lv_obj_set_x(agent_dot,60-(int)step);
  lv_obj_set_style_opa(target_dot,m.usb?220:0,0);lv_obj_set_style_opa(agent_dot,agent?220:0,0);
 }
 if(m.page==UI_HOME){
  const char*heading=m.paused?"自动控制已暂停":ready?"自动运维已就绪":!agent?"等待 Agent 连接":!m.usb?"等待被控设备":m.suspended?"被控设备休眠中":"等待目标画面";
  const char*sub=m.paused?"前往设置继续控制":ready?"已连接，可以开始操作":!agent?"将下方接口连接到 Agent 笔记本":!m.usb?"将上方接口连接到被控设备":m.suspended?"唤醒被控设备后即可继续":"连接采集卡以获取目标画面";
  text(hero,heading);text(hero_sub,sub);
  text(target_text,m.paused?"已暂停":m.suspended?"休眠中":m.usb?"已连接":"未连接");
  text(agent_text,agent?"已连接":"未连接");
  text(video_text,agent&&m.video?"目标画面 · 已连接":"目标画面 · 未连接");
  lv_obj_set_style_text_color(video_text,color(agent&&m.video?GREEN:AMBER),0);
  const cua_ui_event*e=cua_model_active(&m);
  if(e){
   lv_obj_remove_flag(toast,LV_OBJ_FLAG_HIDDEN);char line[160];
   snprintf(line,sizeof line,"%s%s",e->demo?"测试 · ":"",e->title);text(toast_title,line);text(toast_detail,e->detail);
   text(toast_result,e->result);lv_obj_set_style_text_color(toast_result,color(e->running?CYAN:e->ok?GREEN:AMBER),0);
   lv_obj_set_width(toast_bar,(int)(416*(5000-(m.now-e->started))/5000));
  }else lv_obj_add_flag(toast,LV_OBJ_FLAG_HIDDEN);
 }else if(m.page==UI_HISTORY){
  for(unsigned i=0;i<CUA_HISTORY;i++){
   const cua_ui_event*e=cua_model_recent(&m,i);
   if(!e){if(i==0){lv_obj_remove_flag(history_rows[i],LV_OBJ_FLAG_HIDDEN);text(history_labels[i],"暂无操作\n自动化开始后，操作会显示在这里");}else lv_obj_add_flag(history_rows[i],LV_OBJ_FLAG_HIDDEN);continue;}
   lv_obj_remove_flag(history_rows[i],LV_OBJ_FLAG_HIDDEN);char line[180],age[40];age_text(m.now,e->started,age,sizeof age);
   snprintf(line,sizeof line,"%s%s    >\n%s · %s",e->demo?"测试 · ":"",e->title,e->result,age);text(history_labels[i],line);
  }
 }else if(m.page==UI_DEVICE){
  char line[360];snprintf(line,sizeof line,"自动息屏     1 分钟\n亮屏方式     轻触屏幕\nAgent            %s\n被控设备     %s",agent?"已连接":"未连接",m.usb?"已连接":"未连接");
  text(device_lines,line);text(pause_label,m.paused?"继续控制":"暂停控制");
  lv_obj_set_style_bg_color(pause_button,color(m.paused?0x244F56:0x584133),0);
 }else if(m.page==UI_DETAIL){
  const cua_ui_event*e=m.selected?&m.events[(m.selected-1)%CUA_HISTORY]:NULL;
  if(e&&e->id==m.selected){char line[450],age[40];age_text(m.now,e->started,age,sizeof age);
   snprintf(line,sizeof line,"%s%s\n%s\n%s\n耗时  %u ms\n%s",e->demo?"测试 · ":"",e->title,e->detail,e->result,e->duration_ms,age);text(detail_lines,line);
  }else text(detail_lines,"记录已更新");
 }
}
void cua_ui_init(const char*mac){
 mutex=xSemaphoreCreateMutex();cua_model_init(&model,mac);agent_power_init(&power,now_ms(),false);
 cpu_profile(false);
 bsp_display_cfg_t config={.lvgl_port_cfg={.task_priority=5,.task_stack=10240,.task_affinity=1,.task_max_sleep_ms=500,.task_stack_caps=MALLOC_CAP_INTERNAL|MALLOC_CAP_8BIT,.timer_period_ms=5}};
 display=bsp_display_start_with_config(&config);assert(display);
 power_result(agent_board_power_init());bool pressed=false;agent_board_power_key(&pressed);agent_power_init(&power,now_ms(),pressed);
 assert(lvgl_port_lock(0));root=lv_screen_active();lv_obj_remove_style_all(root);lv_obj_set_style_bg_color(root,color(BG),0);lv_obj_set_style_bg_opa(root,255,0);
 label(root,22,14,215,"Agent 自动运维",&cua_font_20,CYAN);title=label(root,254,17,90,"总览",&cua_font_16,MUTED);
 badge=label(root,365,16,93,"待连接",&cua_font_16,AMBER);lv_obj_set_style_text_align(badge,LV_TEXT_ALIGN_RIGHT,0);
 box(root,22,52,436,1,BORDER,0);body=box(root,0,56,480,354,BG,0);
 const char*names[]={"总览","接线","记录","设置"};
 for(int i=0;i<4;i++)nav[i]=button(root,16+i*115,419,104,49,names[i],(cua_page)i);
 test_pointer=lv_indev_create();lv_indev_set_type(test_pointer,LV_INDEV_TYPE_POINTER);lv_indev_set_display(test_pointer,display);lv_indev_set_read_cb(test_pointer,pointer_read);
 lvgl_port_touch_set_points_callback(bsp_display_get_input_dev(),touch_points,NULL);
 lv_display_add_event_cb(display,snapshot_frame,LV_EVENT_FLUSH_FINISH,NULL);
 render_timer=lv_timer_create(render,50,NULL);render(NULL);lv_refr_now(display);lvgl_port_unlock();
 ESP_ERROR_CHECK(bsp_display_backlight_prepare_wake());ESP_ERROR_CHECK(bsp_display_brightness_set(65));
 xTaskCreate(power_task,"power_key",3072,NULL,4,NULL);
}
void cua_ui_links(bool mounted,bool suspended){lock();model.usb=mounted;model.suspended=suspended;model.now=now_ms();unlock();}
void cua_ui_heartbeat(bool video){lock();cua_model_heartbeat(&model,now_ms(),video);unlock();}
bool cua_ui_ready(void){lock();model.now=now_ms();bool v=cua_model_ready(&model);unlock();return v;}
bool cua_ui_paused(void){lock();bool v=model.paused;unlock();return v;}
int cua_ui_take_switch(void){lock();int v=switch_request;switch_request=0;unlock();return v;}
void cua_ui_pause(void){lock();if(!model.paused){model.paused=true;switch_request=-1;}unlock();}
static void key_name(int usage,char*out,size_t cap){
 if(usage>=4&&usage<=29)snprintf(out,cap,"%c",'A'+usage-4);
 else if(usage>=30&&usage<=38)snprintf(out,cap,"%c",'1'+usage-30);
 else if(usage>=58&&usage<=69)snprintf(out,cap,"F%d",usage-57);
 else {
  const char*name=usage==39?"0":usage==40?"Enter":usage==41?"Esc":usage==42?"Backspace":usage==43?"Tab":usage==44?"Space":
   usage==73?"Insert":usage==74?"Home":usage==75?"PageUp":usage==76?"Delete":usage==77?"End":usage==78?"PageDown":
   usage==79?"Right":usage==80?"Left":usage==81?"Down":usage==82?"Up":NULL;
  if(name)snprintf(out,cap,"%s",name);else snprintf(out,cap,"HID %d",usage);
 }
}
static int value(const cJSON*a,const char*k){const cJSON*v=cJSON_GetObjectItemCaseSensitive(a,k);return v?v->valueint:0;}
unsigned cua_ui_action_start(const cJSON*a,unsigned seq){
 const char*k=cJSON_GetObjectItemCaseSensitive(a,"kind")->valuestring;
 const char*title=(!strcmp(k,"click")||!strcmp(k,"click_current"))?"鼠标点击":!strcmp(k,"move")?"指针移动":!strcmp(k,"move_relative")?"相对移动":(!strcmp(k,"scroll")||!strcmp(k,"scroll_current"))?"滚动":!strcmp(k,"drag")?"拖动":!strcmp(k,"press_key")?"键盘按键":"输入文本";
 char detail[128];
 if(!strcmp(k,"type_text"))snprintf(detail,sizeof detail,"%d 个字符",cJSON_GetArraySize(cJSON_GetObjectItemCaseSensitive(a,"strokes")));
 else if(!strcmp(k,"press_key")){const cJSON*s=cJSON_GetArrayItem(cJSON_GetObjectItemCaseSensitive(a,"strokes"),0);char key[20];key_name(value(s,"usage"),key,sizeof key);int mod=value(s,"mod");snprintf(detail,sizeof detail,"%s%s%s%s%s",mod&1?"Ctrl + ":"",mod&2?"Shift + ":"",mod&4?"Alt + ":"",mod&8?"Win + ":"",key);}
 else if(!strcmp(k,"drag"))snprintf(detail,sizeof detail,"%d 个路径点 · %d ms",cJSON_GetArraySize(cJSON_GetObjectItemCaseSensitive(a,"path")),cJSON_GetObjectItemCaseSensitive(a,"duration_ms")?value(a,"duration_ms"):300);
 else if(!strcmp(k,"move_relative"))snprintf(detail,sizeof detail,"位移 X %d / Y %d",value(a,"dx"),value(a,"dy"));
 else if(!strcmp(k,"click_current")){
  const cJSON*b=cJSON_GetObjectItemCaseSensitive(a,"button");const char*button=cJSON_IsString(b)?b->valuestring:"left";
  snprintf(detail,sizeof detail,"%s%s",!strcmp(button,"right")?"右键":!strcmp(button,"middle")?"中键":"左键",value(a,"count")==2?"双击":"单击");
 }else if(!strcmp(k,"scroll_current"))snprintf(detail,sizeof detail,"滚动 %d 格",value(a,"ticks"));
 else if(!strcmp(k,"click")){
  const cJSON*b=cJSON_GetObjectItemCaseSensitive(a,"button");const char*button=cJSON_IsString(b)?b->valuestring:"left";
  snprintf(detail,sizeof detail,"%s%s · X %.1f%% / Y %.1f%%",!strcmp(button,"right")?"右键":!strcmp(button,"middle")?"中键":"左键",value(a,"count")==2?"双击":"单击",value(a,"x")*100.0/32767,value(a,"y")*100.0/32767);
 }else if(!strcmp(k,"scroll"))snprintf(detail,sizeof detail,"滚动 %d 格 · X %.1f%% / Y %.1f%%",value(a,"ticks"),value(a,"x")*100.0/32767,value(a,"y")*100.0/32767);
 else snprintf(detail,sizeof detail,"目标位置 X %.1f%% / Y %.1f%%",value(a,"x")*100.0/32767,value(a,"y")*100.0/32767);
 lock();model.now=now_ms();unsigned id=cua_model_start(&model,seq,title,detail,false);unlock();return id;
}
void cua_ui_action_finish(unsigned id,bool ok,const char*error){
 const char*r=ok?"已发送":error&&!strcmp(error,"outcome_unknown")?"结果未确认":"操作中止";
 lock();model.now=now_ms();cua_model_finish(&model,id,ok,r);unlock();
}
bool cua_ui_command(const cJSON*r,char*out,unsigned cap){
 const cJSON*op=cJSON_GetObjectItemCaseSensitive(r,"op");if(!cJSON_IsString(op))return false;
 if(!strcmp(op->valuestring,"ui_status")){
  lock();model.now=now_ms();const cua_ui_event*e=cua_model_active(&model);
  snprintf(out,cap,"{\"v\":1,\"op\":\"ui_status\",\"ok\":true,\"page\":%d,\"ready\":%s,\"paused\":%s,\"agent\":%s,\"usb\":%s,\"video\":%s,\"history\":%u,\"active_id\":%u,\"uptime_ms\":%llu,\"frames\":%u,\"touches\":%u,\"cache_line_bytes\":64,\"pclk_hz\":%u,\"cpu_mhz\":%u,\"screen\":\"%s\",\"touch_poll_ms\":%u,\"idle_ms\":%llu,\"pwr_short\":%u,\"pwr_long\":%u,\"wake_count\":%u,\"pmic_ready\":%s,\"power_error\":%u,\"mac\":\"%s\"}",
   model.page,cua_model_ready(&model)?"true":"false",model.paused?"true":"false",cua_model_agent(&model)?"true":"false",model.usb?"true":"false",(cua_model_agent(&model)&&model.video)?"true":"false",model.count,e?e->id:0,(unsigned long long)model.now,frame_generation,touch_count,screen_dark?4000000u:16000000u,(unsigned)(esp_clk_cpu_freq()/1000000),screen_dark?"off":"on",screen_dark?80u:10u,(unsigned long long)(model.now-power.last_touch),power.short_presses,power.long_presses,power.wakes,agent_board_power_available()?"true":"false",power_error,model.mac);unlock();return true;
 }
 if(strcmp(op->valuestring,"ui_tap")&&strcmp(op->valuestring,"ui_demo")&&strcmp(op->valuestring,"ui_clear")&&strcmp(op->valuestring,"ui_sleep"))return false;
 lock();bool blocked=model.usb;unlock();
 if(blocked){snprintf(out,cap,"{\"ok\":false,\"error\":\"ui_test_requires_target_disconnected\"}");return true;}
 if(!strcmp(op->valuestring,"ui_tap")){
  const cJSON*x=cJSON_GetObjectItemCaseSensitive(r,"x"),*y=cJSON_GetObjectItemCaseSensitive(r,"y");
  if(!cJSON_IsNumber(x)||!cJSON_IsNumber(y)||x->valuedouble!=x->valueint||y->valuedouble!=y->valueint||x->valueint<0||x->valueint>=480||y->valueint<0||y->valueint>=480){snprintf(out,cap,"{\"ok\":false,\"error\":\"invalid_point\"}");return true;}
  lock();bool waking=power.asleep||screen_dark;agent_power_touch(&power,now_ms());unlock();
  if(waking){vTaskDelay(pdMS_TO_TICKS(500));snprintf(out,cap,"{\"v\":1,\"ok\":true,\"test_only\":true,\"wake_only\":true}");return true;}
  lvgl_port_lock(0);test_point=(lv_point_t){x->valueint,y->valueint};test_pressed=true;lvgl_port_unlock();vTaskDelay(pdMS_TO_TICKS(120));
  lvgl_port_lock(0);test_pressed=false;lvgl_port_unlock();vTaskDelay(pdMS_TO_TICKS(120));
 }else if(!strcmp(op->valuestring,"ui_sleep")){
  lock();agent_power_blank(&power);unlock();vTaskDelay(pdMS_TO_TICKS(350));
 }else if(!strcmp(op->valuestring,"ui_demo")){
  lock();model.now=now_ms();model.demo=true;unsigned id=cua_model_start(&model,model.next_id+1,"鼠标点击","左键单击 · X 50.0% / Y 50.0%",true);cua_model_finish(&model,id,true,"已发送");unlock();
 }else{lock();memset(model.events,0,sizeof model.events);model.count=0;model.next_id=0;model.demo=false;model.page=UI_HOME;unlock();}
 snprintf(out,cap,"{\"v\":1,\"ok\":true,\"test_only\":true}");return true;
}
static void send_line(const char*s){uart_write_bytes(UART_NUM_0,"@cua ",5);uart_write_bytes(UART_NUM_0,s,strlen(s));uart_write_bytes(UART_NUM_0,"\n",1);}
void cua_ui_screenshot(void){
 lock();bool blocked=model.usb,asleep=power.asleep||screen_dark;unlock();
 if(asleep){send_line("{\"ok\":false,\"error\":\"screen_asleep\"}");return;}
 if(blocked){send_line("{\"ok\":false,\"error\":\"capture_requires_target_disconnected\"}");return;}
 capture=heap_caps_malloc(480*480*2,MALLOC_CAP_SPIRAM|MALLOC_CAP_8BIT);
 if(!capture){send_line("{\"ok\":false,\"error\":\"capture_memory\"}");return;}
 lvgl_port_lock(0);capture_requested=true;lv_obj_invalidate(root);lv_refr_now(display);bool done=!capture_requested;lvgl_port_unlock();
 if(!done){lvgl_port_lock(0);capture_requested=false;lvgl_port_unlock();free(capture);capture=NULL;send_line("{\"ok\":false,\"error\":\"capture_unavailable\"}");return;}
 const uint8_t*bytes=(const uint8_t*)capture;uint32_t crc=0xFFFFFFFF;
 for(unsigned i=0;i<460800;i++){crc^=bytes[i];for(int bit=0;bit<8;bit++)crc=(crc>>1)^(0xEDB88320u&-(int32_t)(crc&1));}crc^=0xFFFFFFFF;
 uint8_t*rle=heap_caps_malloc(480*480*4,MALLOC_CAP_SPIRAM|MALLOC_CAP_8BIT);unsigned size=0;
 if(!rle){free(capture);capture=NULL;send_line("{\"ok\":false,\"error\":\"capture_memory\"}");return;}
 for(unsigned i=0;i<480*480;){
  uint16_t value=capture[i];unsigned count=1;
  while(i+count<480*480&&count<65535&&capture[i+count]==value)count++;
  rle[size++]=(uint8_t)count;rle[size++]=(uint8_t)(count>>8);rle[size++]=(uint8_t)value;rle[size++]=(uint8_t)(value>>8);i+=count;
 }
 char line[700];snprintf(line,sizeof line,"{\"op\":\"frame_begin\",\"ok\":true,\"width\":480,\"height\":480,\"bytes\":%u,\"format\":\"rgb565le-rle\",\"generation\":%u,\"crc32\":%lu}",size,capture_generation,(unsigned long)crc);send_line(line);
 for(unsigned pos=0;pos<size;pos+=384){char encoded[520];size_t n=0;unsigned count=size-pos<384?size-pos:384;mbedtls_base64_encode((uint8_t*)encoded,sizeof encoded,&n,rle+pos,count);encoded[n]=0;
  snprintf(line,sizeof line,"{\"op\":\"frame_chunk\",\"offset\":%u,\"data\":\"%s\"}",pos,encoded);send_line(line);}
 send_line("{\"op\":\"frame_end\",\"ok\":true}");free(rle);free(capture);capture=NULL;
}

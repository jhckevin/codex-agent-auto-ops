#include <stdio.h>
#include <string.h>
#include <inttypes.h>
#include <stdatomic.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"
#include "driver/uart.h"
#include "driver/gpio.h"
#include "esp_timer.h"
#include "esp_random.h"
#include "esp_mac.h"
#include "tinyusb.h"
#include "protocol.h"
#include "motion.h"
#include "device_ui.h"
#include "device_power.h"
#include "bsp/display.h"

_Static_assert(CONFIG_ESP32S3_DATA_CACHE_LINE_SIZE == 64, "RGB bounce buffers require a 64-byte data-cache line");
static cua_protocol protocol;
static SemaphoreHandle_t completed[3];
static atomic_bool link_changed;
static int64_t deadline;
static unsigned ui_action_id;
static uint16_t last_x,last_y;
static bool absolute_dirty;
static bool relative_dirty;
static bool absolute_enabled=false;
static portMUX_TYPE hid_diag_mux=portMUX_INITIALIZER_UNLOCKED;
static struct {uint32_t descriptors,reports;uint8_t active[16],len;} hid_diag[3];
static void hid_status(char*out,size_t cap){
 char hex[3][33];uint32_t descriptors[3],reports[3];
 portENTER_CRITICAL(&hid_diag_mux);
 for(int i=0;i<3;i++){
  descriptors[i]=hid_diag[i].descriptors;reports[i]=hid_diag[i].reports;
  for(int j=0;j<hid_diag[i].len;j++)snprintf(hex[i]+2*j,3,"%02x",hid_diag[i].active[j]);
  hex[i][2*hid_diag[i].len]=0;
 }
 portEXIT_CRITICAL(&hid_diag_mux);
 snprintf(out,cap,"{\"v\":1,\"op\":\"hid_status\",\"seq\":0,\"ok\":true,\"profile\":\"%s\",\"mounted\":%s,\"suspended\":%s,\"protocol\":[%u,%u,%u],\"descriptors\":[%lu,%lu,%lu],\"reports\":[%lu,%lu,%lu],\"last_active\":[\"%s\",\"%s\",\"%s\"]}",
 absolute_enabled?"absolute":"relative",tud_mounted()?"true":"false",tud_suspended()?"true":"false",tud_hid_n_get_protocol(0),tud_hid_n_get_protocol(1),tud_hid_n_get_protocol(2),
 (unsigned long)descriptors[0],(unsigned long)descriptors[1],(unsigned long)descriptors[2],
 (unsigned long)reports[0],(unsigned long)reports[1],(unsigned long)reports[2],hex[0],hex[1],hex[2]);
}
static const uint8_t keyboard_desc[]={TUD_HID_REPORT_DESC_KEYBOARD()};
static const uint8_t relative_desc[]={TUD_HID_REPORT_DESC_MOUSE()};
static const uint8_t absolute_desc[]={
  0x05,0x01,0x09,0x02,0xA1,0x01,0x09,0x01,0xA1,0x00,
  0x05,0x09,0x19,0x01,0x29,0x03,0x15,0x00,0x25,0x01,0x95,0x03,0x75,0x01,0x81,0x02,
  0x95,0x01,0x75,0x05,0x81,0x03,
  0x05,0x01,0x09,0x30,0x09,0x31,0x15,0x00,0x26,0xFF,0x7F,0x75,0x10,0x95,0x02,0x81,0x02,
  0x09,0x38,0x15,0x81,0x25,0x7F,0x75,0x08,0x95,0x01,0x81,0x06,0xC0,0xC0};
static tusb_desc_device_t device={
 .bLength=sizeof(tusb_desc_device_t),.bDescriptorType=TUSB_DESC_DEVICE,.bcdUSB=0x0200,
 .bDeviceClass=0,.bDeviceSubClass=0,.bDeviceProtocol=0,.bMaxPacketSize0=64,
 .idVendor=0xCAFE,.idProduct=0x4012,.bcdDevice=0x0102,.iManufacturer=1,.iProduct=2,.iSerialNumber=3,.bNumConfigurations=1};
static const uint8_t relative_configuration[]={
 TUD_CONFIG_DESCRIPTOR(1,2,0,TUD_CONFIG_DESC_LEN+2*TUD_HID_DESC_LEN,0,100),
 TUD_HID_DESCRIPTOR(0,4,HID_ITF_PROTOCOL_KEYBOARD,sizeof keyboard_desc,0x81,16,5),
 TUD_HID_DESCRIPTOR(1,5,HID_ITF_PROTOCOL_MOUSE,sizeof relative_desc,0x82,16,5)};
static const uint8_t configuration[]={
 TUD_CONFIG_DESCRIPTOR(1,3,0,TUD_CONFIG_DESC_LEN+3*TUD_HID_DESC_LEN,0,100),
 TUD_HID_DESCRIPTOR(0,4,HID_ITF_PROTOCOL_KEYBOARD,sizeof keyboard_desc,0x81,16,5),
 TUD_HID_DESCRIPTOR(1,5,HID_ITF_PROTOCOL_MOUSE,sizeof relative_desc,0x82,16,5),
 TUD_HID_DESCRIPTOR(2,6,HID_ITF_PROTOCOL_NONE,sizeof absolute_desc,0x83,16,5)};
static char serial_number[18];
static const char*strings[]={(const char[]){0x09,0x04},"Agent Auto Ops","Agent Auto Ops Adapter",serial_number,"Boot keyboard","Boot mouse","Absolute pointer"};
static esp_err_t usb_install(void){
 const tinyusb_config_t usb={.device_descriptor=&device,.string_descriptor=strings,.string_descriptor_count=7,.configuration_descriptor=absolute_enabled?configuration:relative_configuration,.external_phy=false};
 return tinyusb_driver_install(&usb);
}
uint8_t const*tud_hid_descriptor_report_cb(uint8_t i){
 if(i>=3)return NULL;
 portENTER_CRITICAL(&hid_diag_mux);hid_diag[i].descriptors++;portEXIT_CRITICAL(&hid_diag_mux);
 return i==0?keyboard_desc:i==1?relative_desc:absolute_desc;
}
uint16_t tud_hid_get_report_cb(uint8_t i,uint8_t id,hid_report_type_t type,uint8_t*b,uint16_t len){(void)i;(void)id;(void)type;(void)b;(void)len;return 0;}
void tud_hid_set_report_cb(uint8_t i,uint8_t id,hid_report_type_t type,uint8_t const*b,uint16_t len){(void)i;(void)id;(void)type;(void)b;(void)len;}
void tud_hid_report_complete_cb(uint8_t i,uint8_t const*r,uint16_t len){
 if(i>=3)return;
 bool active=false;for(int n=0;n<len;n++)active|=r[n]!=0;
 portENTER_CRITICAL(&hid_diag_mux);
 hid_diag[i].reports++;
 if(active){hid_diag[i].len=len>16?16:len;memcpy(hid_diag[i].active,r,hid_diag[i].len);}
 portEXIT_CRITICAL(&hid_diag_mux);
 xSemaphoreGive(completed[i]);
}
void tud_mount_cb(void){link_changed=true;}
void tud_umount_cb(void){link_changed=true;}
void tud_suspend_cb(bool remote_wakeup_en){(void)remote_wakeup_en;link_changed=true;}
void tud_resume_cb(void){link_changed=true;}
static bool mounted(void*ctx){(void)ctx;return tud_mounted();}
static bool ready(void*ctx){(void)ctx;return tud_mounted()&&!tud_suspended()&&cua_ui_ready();}
static bool send_report(uint8_t i,const void*data,size_t size){
 int64_t until=esp_timer_get_time()+150000;
 while(!tud_hid_n_ready(i)){if(!tud_mounted()||tud_suspended()||esp_timer_get_time()>until)return false;vTaskDelay(pdMS_TO_TICKS(1));}
 xSemaphoreTake(completed[i],0);
 /* Follow TinyUSB hid_composite: ready gate, official report helpers,
  * then await tud_hid_report_complete_cb before the next report.
  * Boot mouse packets remain 3 bytes, as required by HID boot protocol. */
 const uint8_t*r=data;bool sent;
 if(i==1&&r[0])relative_dirty=true;
 if(i==0&&size==8)sent=tud_hid_n_keyboard_report(0,0,r[0],r+2);
 else if(i==1&&size==5&&tud_hid_n_get_protocol(1)!=HID_PROTOCOL_BOOT)
  sent=tud_hid_n_mouse_report(1,0,r[0],(int8_t)r[1],(int8_t)r[2],(int8_t)r[3],(int8_t)r[4]);
 else sent=tud_hid_n_report(i,0,data,(uint16_t)size);
 if(!sent)return false;
 bool ok=xSemaphoreTake(completed[i],pdMS_TO_TICKS(150))==pdTRUE;
 if(ok&&i==1&&!r[0])relative_dirty=false;
 return ok;
}
static bool absolute(uint16_t x,uint16_t y,uint8_t buttons,int8_t wheel){
 if(!absolute_enabled)return false;
 uint8_t r[]={buttons,(uint8_t)x,(uint8_t)(x>>8),(uint8_t)y,(uint8_t)(y>>8),(uint8_t)wheel};
 last_x=x;last_y=y;if(buttons)absolute_dirty=true;bool ok=send_report(2,r,sizeof r);if(ok&&!buttons)absolute_dirty=false;return ok;
}
static bool release_all(void*ctx){
 (void)ctx;uint8_t keys[8]={0},mouse[5]={0};
 bool a=send_report(0,keys,sizeof keys);
 /* Ordinary relative motion has no held state. Release only held mouse buttons. */
 bool b=!relative_dirty||send_report(1,mouse,tud_hid_n_get_protocol(1)==HID_PROTOCOL_BOOT?3:sizeof mouse);
 bool c=!absolute_dirty||absolute(last_x,last_y,0,0);return a&&b&&c;
}
static bool alive(void){return ready(NULL)&&esp_timer_get_time()<deadline;}
static bool pause_ms(int ms){for(int i=0;i<ms;i+=5){if(!alive())return false;vTaskDelay(pdMS_TO_TICKS(5));}return alive();}
static int num(const cJSON*a,const char*k,int d){const cJSON*v=cJSON_GetObjectItemCaseSensitive(a,k);return v?v->valueint:d;}
static const char*kind(const cJSON*a){return cJSON_GetObjectItemCaseSensitive(a,"kind")->valuestring;}
static bool perform_inner(const cJSON*a,void*ctx){
 (void)ctx;deadline=esp_timer_get_time()+3500000;
 if(!alive())return false;
 const char*k=kind(a);uint16_t x=num(a,"x",0),y=num(a,"y",0);
 if(!strcmp(k,"click_current")){
  const cJSON*b=cJSON_GetObjectItemCaseSensitive(a,"button");const char*s=b?b->valuestring:"left";
  uint8_t r[]={!strcmp(s,"right")?2:!strcmp(s,"middle")?4:1,0,0,0,0},z[5]={0};
  size_t size=tud_hid_n_get_protocol(1)==HID_PROTOCOL_BOOT?3:sizeof r;
  for(int i=0;i<num(a,"count",1);i++)if(!send_report(1,r,size)||!pause_ms(40)||!send_report(1,z,size)||!pause_ms(60))return false;
  return true;
 }
 if(!strcmp(k,"scroll_current")){
  if(tud_hid_n_get_protocol(1)==HID_PROTOCOL_BOOT)return false;
  uint8_t r[]={0,0,0,(uint8_t)num(a,"ticks",0),0};return send_report(1,r,sizeof r);
 }
 if(!strcmp(k,"move"))return absolute(x,y,0,0);
 if(!strcmp(k,"scroll"))return absolute(x,y,0,(int8_t)num(a,"ticks",0));
 if(!strcmp(k,"pointer_keepalive")){
  if(relative_dirty||absolute_dirty)return false;
  int d=num(a,"direction",1);uint8_t r[]={0,(uint8_t)d,0,0,0},back[]={0,(uint8_t)-d,0,0,0};
  size_t size=tud_hid_n_get_protocol(1)==HID_PROTOCOL_BOOT?3:sizeof r;
  /* One indivisible, button-free pair. No UI history or screen wake. */
  return send_report(1,r,size)&&pause_ms(5)&&send_report(1,back,size);
 }
 if(!strcmp(k,"move_relative")){
  int dx=num(a,"dx",0),dy=num(a,"dy",0),steps=cua_motion_steps(dx,dy);
  for(int i=1;i<=steps;i++){
   uint8_t r[]={0,(uint8_t)cua_motion_component(dx,i,steps),(uint8_t)cua_motion_component(dy,i,steps),0,0};
   if(!alive()||!send_report(1,r,tud_hid_n_get_protocol(1)==HID_PROTOCOL_BOOT?3:sizeof r)||(i<steps&&!pause_ms(5)))return false;
  }
  return true;
 }
 if(!strcmp(k,"click")){
  const cJSON*b=cJSON_GetObjectItemCaseSensitive(a,"button");const char*s=b?b->valuestring:"left";uint8_t button=!strcmp(s,"right")?2:!strcmp(s,"middle")?4:1;
  for(int i=0;i<num(a,"count",1);i++)if(!alive()||!absolute(x,y,button,0)||!pause_ms(35)||!absolute(x,y,0,0)||!pause_ms(60))return false;
  return true;
 }
 if(!strcmp(k,"drag")){
  const cJSON*path=cJSON_GetObjectItemCaseSensitive(a,"path");int n=cJSON_GetArraySize(path),dt=num(a,"duration_ms",300)/(n-1);
  for(const cJSON*p=path->child;p;p=p->next)if(!alive()||!absolute(num(p,"x",0),num(p,"y",0),1,0)||(p->next&&!pause_ms(dt)))return false;
  return absolute(last_x,last_y,0,0);
 }
 const cJSON*strokes=cJSON_GetObjectItemCaseSensitive(a,"strokes");
 if(strokes){
  for(const cJSON*s=strokes->child;s;s=s->next){
   uint8_t r[8]={(uint8_t)num(s,"mod",0),0,(uint8_t)num(s,"usage",0),0,0,0,0,0},z[8]={0};
   if(!alive()||!send_report(0,r,sizeof r)||!pause_ms(5)||!send_report(0,z,sizeof z)||!pause_ms(5))return false;
  }
  return true;
 }
 return false;
}
static bool perform(const cJSON*a,void*ctx){if(strcmp(kind(a),"pointer_keepalive"))ui_action_id=cua_ui_action_start(a,protocol.seq);return perform_inner(a,ctx);}
void app_main(void){
 gpio_config_t backlight={.pin_bit_mask=1ULL<<GPIO_NUM_4,.mode=GPIO_MODE_OUTPUT};ESP_ERROR_CHECK(gpio_config(&backlight));gpio_set_level(GPIO_NUM_4,1);
 uint8_t mac[6];ESP_ERROR_CHECK(esp_read_mac(mac,ESP_MAC_WIFI_STA));
 snprintf(serial_number,sizeof serial_number,"%02x:%02x:%02x:%02x:%02x:%02x",mac[0],mac[1],mac[2],mac[3],mac[4],mac[5]);
 cua_ui_init(serial_number);
 for(int i=0;i<3;i++)completed[i]=xSemaphoreCreateBinary();
 ESP_ERROR_CHECK(usb_install());
 uart_config_t uart={.baud_rate=115200,.data_bits=UART_DATA_8_BITS,.parity=UART_PARITY_DISABLE,.stop_bits=UART_STOP_BITS_1,.flow_ctrl=UART_HW_FLOWCTRL_DISABLE,.source_clk=UART_SCLK_DEFAULT};
 ESP_ERROR_CHECK(uart_param_config(UART_NUM_0,&uart));ESP_ERROR_CHECK(uart_set_pin(UART_NUM_0,43,44,UART_PIN_NO_CHANGE,UART_PIN_NO_CHANGE));ESP_ERROR_CHECK(uart_driver_install(UART_NUM_0,16384,0,0,NULL,0));
 cua_init(&protocol,esp_random(),serial_number,(cua_io){perform,release_all,ready,NULL,mounted});
 static char line[CUA_LINE_MAX+1],out[1024];size_t used=0;bool overflow=false;
 for(;;){
  cua_ui_links(tud_mounted(),tud_suspended());
  if(cua_ui_take_shutdown()){
   cua_disarm(&protocol);tud_disconnect();vTaskDelay(pdMS_TO_TICKS(30));
   bsp_display_backlight_off();agent_board_power_off();
  }
  int sw=cua_ui_take_switch();
  if(sw){cua_disarm(&protocol);if(sw<0)tud_disconnect();else tud_connect();}
  if(atomic_exchange(&link_changed,false)){cua_disarm(&protocol);}
  cua_tick(&protocol,(uint64_t)(esp_timer_get_time()/1000));
  uint8_t b;int n=uart_read_bytes(UART_NUM_0,&b,1,pdMS_TO_TICKS(20));if(n!=1)continue;
  if(b=='\r')continue;
  if(b=='\n'){
   if(!overflow){
    line[used]=0;cJSON*r=cJSON_ParseWithOpts(line,NULL,true);const cJSON*op=r?cJSON_GetObjectItemCaseSensitive(r,"op"):NULL;
    const char*name=cJSON_IsString(op)?op->valuestring:"";
    bool screenshot=!strcmp(name,"ui_screenshot");
    if(!strcmp(name,"heartbeat")){
     const cJSON*b=cJSON_GetObjectItemCaseSensitive(r,"boot_id"),*v=cJSON_GetObjectItemCaseSensitive(r,"video_ready"),*ver=cJSON_GetObjectItemCaseSensitive(r,"v");
     bool valid=cJSON_IsNumber(b)&&b->valuedouble==protocol.boot_id&&cJSON_IsBool(v)&&cJSON_IsNumber(ver)&&ver->valuedouble==1;
     if(valid)cua_ui_heartbeat(cJSON_IsTrue(v));
     snprintf(out,sizeof out,"{\"v\":1,\"op\":\"heartbeat\",\"ok\":%s,\"boot_id\":%lu,\"ready\":%s}",valid?"true":"false",(unsigned long)protocol.boot_id,cua_ui_ready()?"true":"false");
    }else if(!strcmp(name,"hid_status"))hid_status(out,sizeof out);
    else if(!strcmp(name,"hid_profile")){
     const cJSON*b=cJSON_GetObjectItemCaseSensitive(r,"boot_id"),*v=cJSON_GetObjectItemCaseSensitive(r,"v"),*profile=cJSON_GetObjectItemCaseSensitive(r,"profile");
     bool valid=cJSON_IsNumber(b)&&b->valuedouble==protocol.boot_id&&cJSON_IsNumber(v)&&v->valueint==1&&cJSON_IsString(profile)&&(!strcmp(profile->valuestring,"relative")||!strcmp(profile->valuestring,"absolute"));
     esp_err_t result=ESP_OK;
     if(valid){
      bool requested=!strcmp(profile->valuestring,"absolute");
      if(requested!=absolute_enabled){
       cua_disarm(&protocol);tud_disconnect();vTaskDelay(pdMS_TO_TICKS(100));
       result=tinyusb_driver_uninstall();
       if(result==ESP_OK){
        absolute_enabled=requested;absolute_dirty=false;relative_dirty=false;device.idProduct=requested?0x4011:0x4012;
        portENTER_CRITICAL(&hid_diag_mux);memset(hid_diag,0,sizeof hid_diag);portEXIT_CRITICAL(&hid_diag_mux);
        for(int i=0;i<3;i++)xSemaphoreTake(completed[i],0);
        result=usb_install();
       }
      }
     }
     snprintf(out,sizeof out,"{\"v\":1,\"op\":\"hid_profile\",\"seq\":0,\"ok\":%s,\"profile\":\"%s\",\"boot_id\":%lu}",valid&&result==ESP_OK?"true":"false",absolute_enabled?"absolute":"relative",(unsigned long)protocol.boot_id);
    }
    else if(screenshot)cua_ui_screenshot();
    else if(!cua_ui_command(r,out,sizeof out)){
     unsigned previous=ui_action_id;
     cua_request(&protocol,line,(uint64_t)(esp_timer_get_time()/1000),out,sizeof out);
     if(ui_action_id!=previous){cJSON*ack=cJSON_Parse(out);const cJSON*err=cJSON_GetObjectItemCaseSensitive(ack,"error");
      cua_ui_action_finish(ui_action_id,cJSON_IsTrue(cJSON_GetObjectItemCaseSensitive(ack,"ok")),cJSON_IsString(err)?err->valuestring:NULL);cJSON_Delete(ack);}
    }
    cJSON_Delete(r);
    if(!screenshot){uart_write_bytes(UART_NUM_0,"@cua ",5);uart_write_bytes(UART_NUM_0,out,strlen(out));uart_write_bytes(UART_NUM_0,"\n",1);}
   }
   else cua_disarm(&protocol);
   used=0;overflow=false;
  }else if(used<CUA_LINE_MAX&&!overflow)line[used++]=(char)b;else overflow=true;
 }
}

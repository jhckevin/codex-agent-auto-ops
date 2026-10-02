#include "device_power.h"
#include "bsp/esp32_s3_touch_lcd_4b.h"
#include "driver/i2c_master.h"
static i2c_master_dev_handle_t pmic;
static esp_io_expander_handle_t expander;
static bool available;
static esp_err_t read_reg(uint8_t reg,uint8_t*value){return i2c_master_transmit_receive(pmic,&reg,1,value,1,40);}
static esp_err_t update(uint8_t reg,uint8_t mask,uint8_t value){
 uint8_t v;esp_err_t err=read_reg(reg,&v);if(err!=ESP_OK)return err;
 uint8_t data[]={reg,(uint8_t)((v&~mask)|(value&mask))};
 return i2c_master_transmit(pmic,data,2,40);
}
esp_err_t agent_board_power_init(void){
 expander=bsp_io_expander_init();if(!expander)return ESP_ERR_INVALID_STATE;
 esp_err_t err=esp_io_expander_set_dir(expander,IO_EXPANDER_PIN_NUM_4,IO_EXPANDER_INPUT);
 if(err!=ESP_OK)return err;
 const i2c_device_config_t config={.dev_addr_length=I2C_ADDR_BIT_LEN_7,.device_address=0x34,.scl_speed_hz=400000};
 err=i2c_master_bus_add_device(bsp_i2c_get_handle(),&config,&pmic);if(err!=ESP_OK)return err;
 uint8_t chip=0;err=read_reg(0x03,&chip);if(err!=ESP_OK||chip!=0x4A)return ESP_ERR_NOT_FOUND;
 /* AXP2101 PEKEY: hardware long press powers off, never resets. Keep rail voltages and VBUS boot policy intact. */
 err=update(0x22,0x03,0x02);if(err!=ESP_OK)return err;
 /* 512 ms power-on, 4 s hardware fallback; application gracefully detaches at 2 s. */
 err=update(0x27,0x0F,0x01);available=err==ESP_OK;return err;
}
esp_err_t agent_board_power_key(bool*pressed){
 if(!expander)return ESP_ERR_INVALID_STATE;
 uint32_t level=IO_EXPANDER_PIN_NUM_4;
 esp_err_t err=esp_io_expander_get_level(expander,IO_EXPANDER_PIN_NUM_4,&level);
 if(err==ESP_OK)*pressed=(level&IO_EXPANDER_PIN_NUM_4)==0;
 return err;
}
esp_err_t agent_board_power_off(void){return available?update(0x10,0x01,0x01):ESP_ERR_INVALID_STATE;}
bool agent_board_power_available(void){return available;}

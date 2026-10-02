idf_component_register(
    SRCS "esp32_s3_touch_lcd_4b.c" ${SRC_VER}
    INCLUDE_DIRS "include" "include/bsp"
    PRIV_INCLUDE_DIRS "priv_include"
    REQUIRES esp_driver_i2c esp_driver_gpio esp_lcd esp_codec_dev esp_io_expander_tca9554 esp_lcd_panel_io_additions esp_lcd_st7701 esp_lcd_touch_gt911 esp_lvgl_port lvgl
    PRIV_REQUIRES esp_timer spiffs esp_psram fatfs
)

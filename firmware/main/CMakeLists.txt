idf_component_register(SRCS "adapter_main.c" "protocol.c" "ui_model.c" "device_ui.c" "power_model.c" "device_power.c" "fonts/cua_font_16.c" "fonts/cua_font_20.c" "fonts/cua_font_30.c" INCLUDE_DIRS "." REQUIRES esp_driver_uart esp_driver_gpio esp_timer esp_hw_support json esp_tinyusb waveshare_bsp esp_lvgl_port lvgl mbedtls esp_pm)

# Registry components use lvgl__lvgl; include the exported header directly.
target_compile_definitions(${COMPONENT_LIB} PRIVATE LV_LVGL_H_INCLUDE_SIMPLE)

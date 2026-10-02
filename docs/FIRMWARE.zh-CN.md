# 嵌入式固件
[English](FIRMWARE.md) · [简体中文](FIRMWARE.zh-CN.md)

型号：**Waveshare ESP32-S3-Touch-LCD-4B**。固件版本 **0.3.4**，插件与固件单独编号。

## 源码构建
使用独立的 ESP-IDF **5.4.2** 环境及 ESP32-S3 工具链，先激活 `export.sh`：

```sh
bash tools/build-firmware.sh
```

标准 IDF 组件管理器按照 `firmware/main/idf_component.yml` 和已提交的 `firmware/dependencies.lock` 解析依赖。修改过的两个显示组件位于 `firmware/vendor`，不需要任何私人构建目录。生成的字体已包含在源码内。

配置使用 16 MiB Flash、8 MiB 八线 PSRAM、240 MHz CPU、64 字节缓存行和 RGB bounce buffer。安装插件时不应顺带修改这些参数。

## 新安装
**此操作写入项目自定义分区表和固件，不是保留原厂固件的无损升级。** 先记录身份并备份自己板卡的整片 Flash，备份不要公开。开启安全启动/加密或容量不同的板卡不能直接使用这里的通用流程。

在构建环境将 PORT 替换为 UART/CH343 串口：

```sh
python -m esptool --chip esp32s3 --port PORT read_flash 0 0x1000000 private-device-backup.bin
idf.py -C firmware -p PORT flash
idf.py -C firmware -p PORT monitor
```

备份命令以已确认的 16 MiB 设备为前提，文件应保存在公开源码目录之外。下载模式与复位方法查阅[厂商文档](https://www.waveshare.com/wiki/ESP32-S3-Touch-LCD-4B)。

使用固件 ZIP 时，在匹配的 ESP-IDF/esptool 环境解压，先检查 `flash_args` 与 `flasher_args.json`，再从解压目录执行：

```sh
python -m esptool --chip esp32s3 --port PORT write_flash @flash_args
```

包中包含 bootloader、分区表、初始 OTA 数据和应用，来自同一 GitHub 版本的源码，不包含任何原设备备份。

## 更新已有定制固件
先读取实际分区表，确认当前应用槽的偏移和容量。只有已明确布局且有恢复备份，才执行仅应用更新；项目不提供适用于所有板卡的单一应用偏移命令。

项目布局的 factory 在 0x100000、OTA 在 0x600000。这是 **项目分区定义**，不是 Waveshare 型号保证的原厂布局。某台板卡曾经在 OTA 槽更新，不能推出其他板卡都应烧在同一地址。

固件包含键盘、相对鼠标及可选绝对鼠标 HID，UART 有界命令、会话身份、心跳和本地 LCD/触摸/电源逻辑。原型 VID/PID 见 NOTICE。本机 LCD 状态文字目前仍为中文。

## 验证
参见[验证状态](VALIDATION.zh-CN.md)。构建通过不代表你的板卡已通过 USB 枚举、光标、电源恢复或触摸实测。打包脚本与 CI 不会自动烧录设备。

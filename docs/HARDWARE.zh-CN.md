# 硬件
[English](HARDWARE.md) · [简体中文](HARDWARE.zh-CN.md)

## 当前实现的板型
**Waveshare ESP32-S3-Touch-LCD-4B**，16 MiB Flash、8 MiB 八线 PSRAM、480 × 480 RGB 触摸屏。引脚、TCA9554 扩展器、GT911 触摸与 ST7701 显示配置见 `firmware/vendor/waveshare_bsp`。[厂商说明](https://www.waveshare.com/wiki/ESP32-S3-Touch-LCD-4B)。

4.3 英寸、非 B 的 4 英寸板、其他 ESP32-S3 屏幕或通用 DevKit 都不能直接替换，需要移植并核对供电和 USB 路由。

## 三条连接
1. 被控端 HDMI 输出 → 采集卡 HDMI 输入；采集卡 USB → Agent 电脑。
2. 板卡 **UART/CH343** USB → Agent 电脑，传输命令和身份信息。
3. 板卡 **原生 USB** → 被控电脑或平板，由被控端枚举键盘和鼠标。

使用支持数据传输的线材。平板的扩展坞需要同时支持视频输出与 USB 主机角色。镜像、DeX 和扩展桌面可能是不同画面；操作前必须核实采集画面就是实际接收输入的屏幕。

LCD 用于本地状态和控制，不显示 HDMI 视频。背光与休眠逻辑是该板型专用的。

## 宿主与被控端
宿主需要 Node 20+、FFmpeg 和串口传输：Windows 使用 PowerShell，POSIX 使用 Python 3 标准库。项目不会自动安装驱动或调整系统权限。被控端仅需要兼容的视频输出和 USB HID。

被控端断网不会切断物理 HDMI/HID，但宿主上的 Codex 仍可能需要网络；这不是独立离线 AI 设备。

[验证状态](VALIDATION.zh-CN.md)区分实现与实测，烧录前阅读[固件指南](FIRMWARE.zh-CN.md)。

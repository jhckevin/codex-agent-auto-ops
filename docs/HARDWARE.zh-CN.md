# 硬件
[English](HARDWARE.md) · [简体中文](HARDWARE.zh-CN.md)

## 测试搭配与基础硬件

维护者的测试搭配是 **UGREEN HDMI to USB-C 采集卡（2K30 规格）**、**优质且符合标准协议的 HDMI 线缆**，以及 **waveshare-esp32s3-4B-touch**，正式型号为 **Waveshare ESP32-S3-Touch-LCD-4B**。插件通常按 **1280 × 720 / 5fps** 采集；2K30 是采集卡规格，并非这套配置实际使用的采集模式。

其他采集卡建议支持高于 720P 的采集分辨率。USB 线需要支持数据传输，HDMI 线使用优质标准线材。

## 当前实现的板型
**Waveshare ESP32-S3-Touch-LCD-4B**，16 MiB Flash、8 MiB 八线 PSRAM、480 × 480 RGB 触摸屏。引脚、TCA9554 扩展器、GT911 触摸与 ST7701 显示配置见 `firmware/vendor/waveshare_bsp`。[厂商说明](https://www.waveshare.com/wiki/ESP32-S3-Touch-LCD-4B)。

4.3 英寸、非 B 的 4 英寸板、其他 ESP32-S3 屏幕或通用 DevKit 都不能直接替换，需要移植并核对供电和 USB 路由。

## 两条链路的接线
1. 被控端 HDMI 输出 → 采集卡 HDMI 输入；采集卡 USB → Agent 电脑。
2. 板卡 **UART/CH343** USB → Agent 电脑，传输命令和身份信息。
3. 板卡 **原生 USB** → 被控电脑或平板，由被控端枚举键盘和鼠标。

使用支持数据传输的线材。平板的扩展坞需要同时支持视频输出与 USB 主机角色。镜像、DeX 和扩展桌面可能是不同画面；操作前必须核实采集画面就是实际接收输入的屏幕。

LCD 用于本地状态和控制，不显示 HDMI 视频。背光与休眠逻辑是该板型专用的。

## 适配其他 ESP32 板

常规有线方案需要**两个独立 USB 数据连接**：一条让 Codex 主控发送命令，一条通过原生 USB Device/HID 向被控端输出键鼠。要核对芯片能力、原理图和 USB 路由；仅有两个插座并不能证明满足要求，充电口不算数据连接。

指定 Waveshare 板可用对应发布固件或编译仓库固件；其他板需要先查官方资料与例程、移植硬件支持，再单独编译，不能直接复用 Waveshare 专用固件。

只有一个 USB 接口时，可以探索用蓝牙 / Wi-Fi 接收主控命令，并保留原生 USB 向被控端输出 HID。板端通信与插件宿主后端都需要适配，**这是魔改方向，当前版本尚未实现**。芯片没有原生 USB HID 能力时，需要更换或增加硬件。

可以把[安装提示词](INSTALL-PROMPT.zh-CN.md)复制给 Codex，让它按板型完成工具准备、烧录与验证。

## 宿主与被控端
宿主需要 Node 20+、FFmpeg 和串口传输：Windows 使用 PowerShell，POSIX 使用 Python 3 标准库。项目不会自动安装驱动或调整系统权限。被控端仅需要兼容的视频输出和 USB HID。

被控端断网不会切断物理 HDMI/HID，但宿主上的 Codex 仍可能需要网络；这不是独立离线 AI 设备。

[验证状态](VALIDATION.zh-CN.md)区分实现与实测，烧录前阅读[固件指南](FIRMWARE.zh-CN.md)。

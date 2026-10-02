# 让 Codex 帮你安装
[English](INSTALL-PROMPT.md) · [简体中文](INSTALL-PROMPT.zh-CN.md)

打开 Codex，直接复制下面的提示词。让它拉代码、准备烧录器、按实际板型配置固件，然后安装插件并调通画面与键鼠。

```text
请帮我安装并调通 Agent 自动运维：
https://github.com/jhckevin/codex-agent-auto-ops

我的目标是让运行 Codex 的笔记本看见并操作另一台 macOS / Windows 笔记本、主机或服务器：
视频：被控电脑 → HDMI 采集卡 → Codex 笔记本。
键鼠：Codex 笔记本 → ESP32 → 被控电脑。

请直接逐步完成，不要只给建议。先克隆仓库（已有则读取现有代码），阅读 README 和硬件、固件、安装文档，检查当前系统、工具和实际设备；只有板型、端口、接线等关键信息无法确认时再问我。

1. 核对硬件。测试搭配是 UGREEN HDMI to USB-C 采集卡（2K30 规格，插件通常使用 1280×720、5fps）、优质标准 HDMI 线缆，以及 waveshare-esp32s3-4B-touch，正式型号为 Waveshare ESP32-S3-Touch-LCD-4B。其他采集卡建议支持高于 720P 的采集分辨率。
2. 先从官方来源下载、配置烧录工具（如 esptool）。复用可用工具；新增依赖放在隔离环境中，遵守当前工作区规则，不污染 base 或全局环境。若不允许本机开发，则到已授权服务器编译，仅在连接板卡的机器完成烧录。
3. 如果是指定 Waveshare 4B 板：使用对应发布固件，或按仓库要求用 ESP-IDF 5.4.2 编译。核对芯片、Flash、实际分区和串口，备份原固件，按该板的正确方式烧录并验证启动。不要把某台设备的历史烧录偏移当成通用地址。
4. 如果不是该板：先查官方资料、原理图、例程和芯片 USB 能力，再配置隔离的编译烧录环境，移植所需固件并编译。优先选择支持原生 USB Device/HID、至少有两个独立 USB 数据连接的板卡：一条连接 Codex 主控，一条输出键鼠给被控电脑。不要直接烧入 Waveshare 专用固件。
5. 如果只有一个 USB 接口：先验证可行性，可把主控通信改为蓝牙或 Wi-Fi，并保留原生 USB 向被控端输出 HID。这需要同时适配板端通信和插件宿主后端，属于额外开发方向，当前插件不自带这一能力。若芯片没有原生 USB HID 能力，先说明所需替代硬件。
6. 帮我接好两条链路，准备宿主运行时和 FFmpeg，通过 Codex 支持的市场流程安装插件。默认英文，需要时可选中文，并说明查看器如何切换语言。
7. 生成本机私有配置，识别实际采集设备、串口和板卡身份，先用 720P / 5fps 调试。确认能持续收到新画面，再验证鼠标移动、点击和键盘输入，并从被控画面确认操作确实生效；不能用模拟器通过代替实机通过。

最后用简短清单报告：实际板型、烧录版本、接线、配置位置、画面是否正常、键鼠是否实测通过，以及仍需我处理的项目。
```

参考：[Codex 插件打包说明](https://developers.openai.com/plugins/build/plugins)、[Espressif USB Device 文档](https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/api-reference/peripherals/usb_device.html)、[esptool 安装说明](https://docs.espressif.com/projects/esptool/en/latest/esp32/installation.html)。工具版本和分区操作以本仓库[固件指南](FIRMWARE.zh-CN.md)为准。

蓝牙 / Wi-Fi 通信和其他板型属于移植方向。当前实现使用指定 Waveshare 板，USB 串口连接主控、原生 USB HID 连接被控端。

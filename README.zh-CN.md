<p align="center"><img src="plugins/agent-auto-ops/assets/logo.svg" width="76" alt="Agent 自动运维"></p>

<h1 align="center">Agent 自动运维</h1>
<p align="center">让 Codex 看见并操作另一台电脑。</p>
<p align="center"><a href="README.md">English</a> · <strong>简体中文</strong></p>

专门为 Codex 设计的插件。把运行 Codex 的笔记本与另一台笔记本、主机或服务器连接起来，核心就是两条：**视频和键鼠控制**。

## 1. 视频：走采集卡

**被控电脑 → HDMI 采集卡 → 运行 Codex 的笔记本**

另一台电脑输出视频信号，通过采集卡接到笔记本，让 Codex 看见它的屏幕。

## 2. 键鼠：走 ESP32

**运行 Codex 的笔记本 → ESP32 → 被控电脑**

ESP32 一端连接笔记本，另一端连接被控电脑，把 Codex 的操作转换、映射成 USB 键盘和鼠标输入（HID）。

**macOS / Windows 都可以用。** 被控设备需要有视频输出，并支持 USB 键鼠；这条连接不需要在被控端安装远程桌面软件。

## 开始使用

准备一张 HDMI 采集卡和 ESP32 控制板。当前固件适配 **Waveshare ESP32-S3-Touch-LCD-4B**。

添加插件市场：

```sh
codex plugin marketplace add jhckevin/codex-agent-auto-ops
```

在 Codex 中安装 **Agent Auto Ops**（默认英文）或 **Agent 自动运维**（中文）。查看器也可以随时切换 **English / 中文**。

[下载插件与固件](https://github.com/jhckevin/codex-agent-auto-ops/releases/latest) · [接线](docs/HARDWARE.zh-CN.md) · [配置](docs/SETUP.zh-CN.md) · [烧录固件](docs/FIRMWARE.zh-CN.md)

## 展望

未来可以加入 **手指机器人**，替你按下电源键；也可以接入 **ATX 开机板**，控制主机或服务器开机，实现远程自动开机。这些是后续扩展方向，当前版本尚未包含。

---

[详细原理](docs/ARCHITECTURE.zh-CN.md) · [兼容与实测情况](docs/VALIDATION.zh-CN.md) · [参与开发](CONTRIBUTING.zh-CN.md) · [安全说明](SECURITY.zh-CN.md)

面向 Codex 的社区开源项目。[AGPL-3.0-or-later](LICENSE) · [第三方许可](NOTICE)。

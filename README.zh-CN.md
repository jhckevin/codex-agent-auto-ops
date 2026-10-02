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

**macOS 实机已由维护者完成验收，画面和键鼠控制均正常。**

## 界面预览

![插件查看器：演示桌面](docs/images/viewer-zh-CN.png)

实际查看器界面，使用演示桌面与模拟连接数据。

<img src="docs/images/device-screen-demo.png" width="360" alt="嵌入式设备 480×480 屏幕模拟图">

板载屏幕模拟图：按固件 UI 布局重绘，非实机照片或运行验证。

## 测试设备

- **UGREEN HDMI to USB-C 采集卡**：2K30 规格；插件通常按 **720P / 5fps** 使用。
- **优质、符合标准协议的 HDMI 线缆**。
- **waveshare-esp32s3-4B-touch**，正式型号为 **Waveshare ESP32-S3-Touch-LCD-4B**。

## 基础硬件

1. 一张 HDMI 采集卡，建议采集分辨率高于 720P。
2. 一条优质、符合标准协议的 HDMI 线缆。
3. 指定 Waveshare 板，或另行适配的 ESP32 板。常规有线方案优先使用至少两个独立 USB 数据连接，并确认芯片支持原生 USB HID；仅有充电口不算。

指定板可用发布固件或自行编译；其他板需要查资料、移植并单独编译。单 USB 板可探索用蓝牙 / Wi-Fi 接收主控命令、保留 USB 向被控端输出 HID，这是额外开发方向。

## 建议安装方法

**打开 Codex，把[安装提示词](docs/INSTALL-PROMPT.zh-CN.md)复制给它。** 让它从 GitHub 拉代码 → 准备烧录工具 → 按板型烧录或移植固件 → 安装插件 → 验证画面和键鼠。

也可以手动添加插件市场：

```sh
codex plugin marketplace add jhckevin/codex-agent-auto-ops
```

在 Codex 中安装 **Agent Auto Ops**（默认英文）或 **Agent 自动运维**（中文）。查看器也可以随时切换 **English / 中文**。

[下载插件与固件](https://github.com/jhckevin/codex-agent-auto-ops/releases/latest) · [接线](docs/HARDWARE.zh-CN.md) · [配置](docs/SETUP.zh-CN.md) · [烧录固件](docs/FIRMWARE.zh-CN.md)

## 展望

目前它本质上是一个**近距离生效的 KVM**：把运行 Codex 的笔记本放在被控电脑旁边，接好采集卡和 ESP32，让 Codex 代劳操作。在近距离使用时，可以省去再把 computer use 与 ToDesk、远程 KVM 等连接手段组合起来的步骤。

### 以后准备做什么

- **无线遥控：**加入蓝牙 / Wi-Fi 命令传输，兼容更多带无线功能的 ESP 设备；被控端所需的 HID 能力仍要按板型适配。
- **接入远程 KVM：**把视频和键鼠链路扩展到网络上，让控制端与被控设备可以真正相隔远距离使用。
- **提高工具与工作流效率：**把常用操作封装成更快速、灵活的工具调用和工作流，减少模型来回推理与调用的次数；探索在工具或设备端执行定时按键、短操作序列。
- **优化提示词与自检：**让模型检查画面是否新鲜、操作是否真正生效，并考虑延迟和帧采样造成的“缺帧”。短暂画面可能没有被采到，不能只凭一次输入调用成功就认定操作完成。
- **远程开关机：**接入手指机器人，按下实体电源键；也可以接入 ATX 开机板，控制主机或服务器的电源。

以上是后续开发与优化方向；无线遥控、网络 KVM 和电源控制尚未包含在当前版本中。

### 局限性：最难的是把握时间

**“低消耗、低占用”是当前设计的重要约束。** 采集与模型观察不保证覆盖每一个中间画面，短暂事件可能落在两次采样之间；画面传输、模型思考和工具调用也都需要时间。

最大的局限是**能否赶上很短的操作窗口**：模型可能没有捕捉到瞬间出现的事件，或者准备发送鼠标、键盘操作时，时机已经过去。例如，一台电脑需要在开机时及时按 **Delete 进入 BIOS**，模型可能错过提示，也可能输入得太晚。当前流程无法保证这类快速操作一定成功；更快的工具和更好的提示词可以改善，但仍需检查最终画面来确认结果。

---

[详细原理](docs/ARCHITECTURE.zh-CN.md) · [兼容与实测情况](docs/VALIDATION.zh-CN.md) · [参与开发](CONTRIBUTING.zh-CN.md) · [安全说明](SECURITY.zh-CN.md)

面向 Codex 的社区开源项目。[AGPL-3.0-or-later](LICENSE) · [第三方许可](NOTICE)。

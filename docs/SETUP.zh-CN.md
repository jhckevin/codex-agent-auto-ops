# 安装与配置
[English](SETUP.md) · [简体中文](SETUP.zh-CN.md)

建议打开 Codex，复制[安装提示词](INSTALL-PROMPT.zh-CN.md)，让它按实际板型准备工具、烧录、安装插件，并验证真实画面和键鼠。

## 安装插件
按[首页](../README.zh-CN.md)添加仓库市场，选择默认英文 `agent-auto-ops` 或中文 `agent-auto-ops-zh`。也可解压 `marketplace-0.7.0.zip`，执行 `codex plugin marketplace add /解压目录的绝对路径`。

通过 Codex 插件目录安装后，新建对话。每个串口和采集卡只能由一个进程占用，不要为同一设备同时启用两个语言包。

## 找到设备
在 **Agent 宿主电脑** 执行：

```powershell
# Windows
[System.IO.Ports.SerialPort]::GetPortNames()
ffmpeg -list_devices true -f dshow -i dummy
```

```sh
# macOS
ls /dev/cu.*
ffmpeg -f avfoundation -list_devices true -i ""
# Linux
ls /dev/serial/by-id/
v4l2-ctl --list-devices
```

FFmpeg 列举后返回非零退出码可能是正常现象。示例名称只是占位值，不会自动匹配。

烧录固件后，关闭其他串口程序，在解压后的插件目录读取身份：

```sh
printf '%s\n' '{"v":1,"op":"hello","seq":0}' | python3 scripts/serial-bridge-posix.py --port /dev/ttyUSB0
```

Windows 将同一行 JSON 管道传入 `powershell.exe -NoProfile -File scripts/serial-bridge.ps1 -Port COM5`；macOS 换成实际 `/dev/cu.*`。将返回的 MAC 填入私有配置，不要用其他板卡的身份绕过不匹配检查。

## 配置
复制包内 `examples/windows-android.json`、`examples/macos.json` 或 `examples/linux.json` 到私有文件，修改：

- `target_id`、`target_os`：实际被控端。
- `serial.port`、`serial.expected_mac`：实际串口与已核实 MAC。
- `video.command`、`video.device`、尺寸、输入帧率：采集卡支持的格式。
- `pointer_mode`：无法枚举绝对鼠标时使用 relative。
- `display_mode`：没有确认时使用 unknown。

FFmpeg 驱动取决于宿主系统；`target_os` 描述被控端，两者不要混淆。

启动 Codex 前设置：

```powershell
$env:AGENT_AUTO_OPS_CONFIG = 'C:\path\private\adapter.json'
$env:AGENT_AUTO_OPS_LOCALE = 'zh-CN'
```

```sh
export AGENT_AUTO_OPS_CONFIG=/绝对路径/私有配置.json
export AGENT_AUTO_OPS_LOCALE=zh-CN
```

已经运行的桌面应用不会继承新终端的环境变量，需要完全退出后从已配置环境启动，或使用应用支持的环境设置。JSON 中执行文件、脚本使用绝对路径；不要把私人配置放进已安装插件的生成文件。

## 首次使用
让 Codex 检查状态和新画面，确认目标 ID、MAC、模式及 `simulation: false`。核实采集画面就是实际被控屏幕，先执行低影响动作，再看返回画面。`kvm_status` 提供只读查看器 URL。

无配置时是 **模拟器**。采集失败、身份不匹配或画面过期会阻止输入。设备被占用时关闭竞争的摄像头/串口程序。macOS 可能要求授予启动进程摄像头权限，项目不会自动屏蔽系统隐私提示。

文本仅支持可打印 US ASCII，目标键盘布局须匹配；界面语言不会切换目标输入法。`fill_text` 需要已聚焦的输入框，仅在明确要求时提交。

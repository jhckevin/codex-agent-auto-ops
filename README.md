<p align="center"><img src="plugins/agent-auto-ops/assets/logo.svg" width="76" alt="Agent Auto Ops"></p>

<h1 align="center">Agent Auto Ops</h1>
<p align="center">Let Codex see and control another computer.</p>
<p align="center"><strong>English</strong> · <a href="README.zh-CN.md">简体中文</a></p>

A plugin built for Codex. Connect the laptop running Codex to another laptop, desktop or server through **two paths: video and keyboard/mouse input**.

## 1. Video — through a capture card

**Target computer → HDMI capture card → laptop running Codex**

The target sends its video output through the capture card, so Codex can see its screen.

## 2. Keyboard and mouse — through an ESP32

**Laptop running Codex → ESP32 → target computer**

The ESP32 connects to both computers, converting Codex's input commands into USB keyboard and mouse actions (HID).

**For macOS and Windows.** The target needs video output and USB keyboard/mouse support. It does not need a remote desktop app for this connection.

## Get started

You need an HDMI capture card and an ESP32 adapter. The current firmware targets **Waveshare ESP32-S3-Touch-LCD-4B**.

Add the plugin marketplace:

```sh
codex plugin marketplace add jhckevin/codex-agent-auto-ops
```

Install **Agent Auto Ops** (English, default) or **Agent 自动运维** (Chinese) in Codex. The viewer also has an **English / 中文** switch.

[Download plugins and firmware](https://github.com/jhckevin/codex-agent-auto-ops/releases/latest) · [Wiring](docs/HARDWARE.md) · [Setup](docs/SETUP.md) · [Flash firmware](docs/FIRMWARE.md)

## What's next

Add a **robotic finger** to press a power button, or an **ATX power-control board** to switch on a desktop/server remotely. These are planned extensions, not features included in the current release.

---

[Architecture](docs/ARCHITECTURE.md) · [Compatibility and testing](docs/VALIDATION.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

Independent community project built for Codex. [AGPL-3.0-or-later](LICENSE) · [Third-party notices](NOTICE).

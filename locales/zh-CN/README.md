# Agent 自动运维
[English](https://github.com/jhckevin/codex-agent-auto-ops) · 简体中文

面向 Codex 的外部设备 HDMI 观察与 USB HID 操作插件，中文包 `agent-auto-ops-zh`。查看器可切换 English / 中文，默认英语的主插件为 `agent-auto-ops`。同一控制板只启用一个插件。

[安装、硬件、固件与源码](https://github.com/jhckevin/codex-agent-auto-ops/blob/main/README.zh-CN.md)。需要已有 Node 20+、FFmpeg，无需 npm。参照 examples/ 创建私有配置，将 AGENT_AUTO_OPS_CONFIG 设为绝对路径；无配置时进入明确标注的模拟器，输入前确认目标身份。

AGENT_AUTO_OPS_LOCALE=en 或 zh-CN 可覆盖 MCP 默认语言，重启生效。查看器记住浏览器选择，硬件文字输入仅支持可打印 US ASCII，与界面语言独立。

社区项目，非 OpenAI 官方产品。AGPL-3.0-or-later；详见 LICENSE、NOTICE、THIRD_PARTY_LICENSES.txt。

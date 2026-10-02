# Agent Auto Ops
English · [简体中文](https://github.com/jhckevin/codex-agent-auto-ops/blob/main/README.zh-CN.md)

A Codex plugin for external-device HDMI observation and USB HID input. Package: `agent-auto-ops`; English is the default. Switch English / 中文 in the viewer. For Chinese skills and tool descriptions, choose `agent-auto-ops-zh` instead. Enable only one package per adapter.

[Installation, hardware, firmware and source](https://github.com/jhckevin/codex-agent-auto-ops). Node 20+ and FFmpeg are required; npm is not needed to run this package. Set AGENT_AUTO_OPS_CONFIG to an absolute private JSON path based on examples/. Without it, the plugin runs a labelled simulator. Verify target identity before input.

MCP language override: AGENT_AUTO_OPS_LOCALE=en or zh-CN (restart required). Viewer choice is remembered by the browser. Text injection supports printable US ASCII, independently of interface language.

Independent community project, not an official OpenAI product. AGPL-3.0-or-later; see LICENSE, NOTICE and THIRD_PARTY_LICENSES.txt.

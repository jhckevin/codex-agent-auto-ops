# 架构
[English](ARCHITECTURE.md) · [简体中文](ARCHITECTURE.zh-CN.md)

本地 Node 进程通过 stdio 提供 MCP。Codex 根据返回画面决定动作；项目负责传输、检查和反馈，不另加模型。

| 层 | 职责 |
| --- | --- |
| `server/main.mjs` | MCP 参数、工具分发、语言与进程生命周期 |
| `server/harness.mjs` | 最新观察绑定、身份和时效检查、操作 ID 去重、结果状态 |
| `server/ffmpeg-video.mjs` | DirectShow / AVFoundation / V4L2 后台采集和最新帧元数据 |
| `server/esp.mjs`、`serial.mjs` | 控制板握手和串行 UART 事务 |
| `firmware/main` | HID 描述符和报告、有界命令、看门狗、LCD、触摸与电源 |
| `server/preview.mjs`、`ui/` | 仅 GET 的回环查看器、原创 SVG、中英文文案 |

## 观察 → 执行 → 核实
`kvm_status` 返回目标与模拟标识。`kvm_observe` 返回画面和观察 ID。`kvm_act` 消耗观察 ID 与唯一操作 ID，检查前提后执行一次有界意图，再返回稳定后的画面、耗时和变化诊断。未知结果不能盲目重试。

`kvm_set_view_context` 记录观察到的是镜像、DeX、扩展、桌面或未知，不改变系统显示设置。只有已确认的 Android/iPadOS 镜像允许可选的固件指针保活。`kvm_stop` 在支持时释放输入并结束会话。

## 边界
ESP32 不处理视频；查看器关闭后 FFmpeg 继续采集。查看器没有输入控制接口、不加载外部字体或资产，只保留最新画面与有限事件。该保留策略不代表 Codex 或外部日志系统的存储策略。

可选 Openterface Qt 属于旧兼容链路，需要附带的帧元数据补丁。默认文档使用 FFmpeg 与 ESP32 HID。

## 语言
主插件默认英语，中文包共用运行时。locale JSON 决定服务端描述和 HTML 初始语言。浏览器优先使用 URL 指定语言，其次已保存偏好，最后包默认值。两包共用原创 SVG，不需要位图库。

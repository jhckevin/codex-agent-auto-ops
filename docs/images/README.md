# Documentation images
[English](#english) · [简体中文](#简体中文)

## English

- `viewer-en.png` / `viewer-zh-CN.png`: browser screenshots of the shipped viewer, served through its real Preview class with **synthetic video, target identity and events**. The visible desktop, connection flags, frame figures and actions are fixture data, not a capture or performance measurement from a real target.
- `device-screen-demo.svg` / `device-screen-demo.png`: an **illustrative reconstruction** of the firmware's 480 × 480 screen, using the palette, layout and labels in `firmware/main/device_ui.c`. State and text explicitly say simulation. This is not a photograph, framebuffer capture or an execution of LVGL on a board. Original editable SVG is included.
- No historical hardware screenshots or real device identifiers are used. Artwork is under the project license.

To regenerate on an isolated development machine with Playwright and Chromium already installed:

```sh
node tools/render-doc-previews.mjs /absolute/path/to/playwright/index.mjs /absolute/path/to/chromium
```

The script starts a temporary loopback viewer, takes screenshots and closes both browser and server. It never opens serial, capture or HID devices. It uses no model service.

## 简体中文

- 两张查看器图片使用实际界面程序和 Preview 服务生成；桌面画面、设备名称、连接状态、帧数据、操作事件全部为**演示数据**，不是实机截图或性能测试。
- 板载屏幕图片按 `firmware/main/device_ui.c` 的配色、布局与文案**重绘模拟**，保留 480 × 480 尺寸并明确标注“模拟”。它不是板卡照片、帧缓冲截图或板端 LVGL 运行结果；附可编辑 SVG。
- 不使用历史实机截图或真实设备标识，原创素材适用项目许可证。复现脚本仅启动临时回环查看器和浏览器，不连接串口、采集卡或 HID。

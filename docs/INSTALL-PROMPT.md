# Install with Codex
[English](INSTALL-PROMPT.md) · [简体中文](INSTALL-PROMPT.zh-CN.md)

Open Codex and paste the prompt below. It asks Codex to get the code, prepare flashing tools, choose the correct board path, install the plugin and verify the two connections.

```text
Please install and bring up Agent Auto Ops for me:
https://github.com/jhckevin/codex-agent-auto-ops

I want the laptop running Codex to see and control another macOS / Windows laptop, desktop or server:
Video: target computer → HDMI capture card → Codex laptop.
Input: Codex laptop → ESP32 → target computer.

Carry out the setup, rather than only giving advice. Clone the repository, or inspect the existing checkout. Read its README, hardware, firmware and setup guides. Inspect the host, installed tools and connected devices; ask me only when essential board, port or wiring information cannot be determined.

1. Check the hardware. The reported test setup is a UGREEN HDMI to USB-C capture card (2K30 specification; the plugin normally uses 1280×720 at 5 fps), a quality standards-compliant HDMI cable, and waveshare-esp32s3-4B-touch, formally Waveshare ESP32-S3-Touch-LCD-4B. For other capture cards, prefer a capture resolution above 720p.
2. Download and configure an official flashing tool such as esptool first. Reuse installed tools. Keep new dependencies isolated, follow workspace rules and avoid changing base/global environments. If local development is prohibited, compile on an authorized server and flash from the machine physically connected to the board.
3. For the specified Waveshare 4B: use the matching release firmware or build it with the required ESP-IDF 5.4.2. Check chip, flash, actual partition layout and serial port, back up existing firmware, flash correctly and verify boot. Never treat a historical device-specific flash offset as universal.
4. For another board: inspect official documentation, schematics, examples and the chip's USB capabilities. Set up an isolated toolchain, port the necessary firmware and compile it. Prefer native USB Device/HID support and at least two independent USB data connections: one for the Codex host, one for target HID. Do not flash the Waveshare-specific binary onto a different board.
5. For a single-USB board: evaluate Bluetooth or Wi-Fi for host commands while retaining native USB HID toward the target. This requires changes to both board communications and the plugin host backend; it is an additional development option, not an existing feature. If native USB HID is unavailable, explain the required alternative hardware.
6. Connect both paths, prepare the host runtime and FFmpeg, and install through Codex's supported marketplace workflow. Default to English, offer Chinese when needed, and explain the viewer's language switch.
7. Create private machine configuration using the actual capture device, serial port and board identity. Start with 720p / 5 fps. Verify continuous fresh video, then mouse movement, clicking and keyboard input. Confirm actual effects in the target image; simulator success is not hardware validation.

Finish with a short checklist of the board, flashed version, wiring, configuration location, video result, physically verified input and any remaining action needed from me.
```

References: [Codex plugin packaging](https://developers.openai.com/plugins/build/plugins), [Espressif USB Device stack](https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/api-reference/peripherals/usb_device.html), [esptool installation](https://docs.espressif.com/projects/esptool/en/latest/esp32/installation.html). Follow this repository's [firmware guide](FIRMWARE.md) for the required tool versions and partition procedure.

Bluetooth / Wi-Fi transport and support for other boards are proposed ports. The current implementation uses the supported Waveshare board with USB UART to the host and native USB HID to the target.

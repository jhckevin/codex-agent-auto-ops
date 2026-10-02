# Hardware
[English](HARDWARE.md) · [简体中文](HARDWARE.zh-CN.md)

## Tested setup and basic hardware

The maintainer's test setup uses a **UGREEN HDMI to USB-C capture card (2K30 specification)**, a **quality, standards-compliant HDMI cable**, and **waveshare-esp32s3-4B-touch**, formally **Waveshare ESP32-S3-Touch-LCD-4B**. The plugin normally runs the capture at **1280 × 720 / 5 fps**; 2K30 describes the card specification, not the capture mode used for this setup.

For another capture card, a supported capture resolution above 720p is recommended. Use data-capable USB cables and a quality HDMI cable.

## Implemented board
**Waveshare ESP32-S3-Touch-LCD-4B**, with 16 MiB flash, 8 MiB octal PSRAM and a 480 × 480 RGB touch display. Board support, pin assignments, the TCA9554 expander, GT911 touch and ST7701 display setup are in `firmware/vendor/waveshare_bsp`. Vendor reference: [Waveshare board wiki](https://www.waveshare.com/wiki/ESP32-S3-Touch-LCD-4B).

Do not substitute the 4.3-inch, 4-inch non-B, other ESP32-S3 displays or a generic DevKit without porting and checking power/USB routing. Product suffixes matter.

## Wiring the two paths
1. External target's HDMI output → HDMI capture input. Capture USB → Agent computer.
2. Board's **UART/CH343** USB → Agent computer. This is the command/identity channel.
3. Board's **native USB** port → target computer/tablet. The target enumerates a keyboard and mouse.

Use data-capable cables. A tablet needs an adapter/hub that supports both its video output and USB-host role. Some tablets expose different mirror and desktop/DeX outputs. Verify that the captured screen is the one receiving the input before acting.

The LCD is a local status/control interface. It does not display the HDMI stream. The firmware's backlight and sleep controls are specific to this board.

## Other ESP32 boards

The wired arrangement needs **two independent USB data connections**: one from the Codex host to the command channel, and native USB Device/HID toward the target. Verify the chip, board schematic and USB routing; two sockets alone do not establish this capability, and a charge-only socket does not count.

For the specified Waveshare board, use its matching release firmware or compile the repository firmware. For another board, read its official documentation and examples, port the hardware support and compile a board-specific build. Do not reuse the Waveshare binary unchanged.

A single-USB board could receive host commands over Bluetooth / Wi-Fi and retain native USB HID for the target. That requires a new board transport and plugin host backend; **it is a porting direction, not a feature in the current release**. A chip without native USB HID needs different hardware.

Use the [copyable Codex installation prompt](INSTALL-PROMPT.md) to guide board identification, tool setup, flashing and verification.

## Host versus target
The Agent host needs Node 20+, FFmpeg, and a serial transport (PowerShell on Windows; Python 3 standard library on POSIX). This implementation does not install drivers or adjust OS permissions automatically. The target only needs compatible video output and USB HID.

A network outage on the target does not sever the physical HDMI/HID path. Codex itself can still require network access on the Agent host. This is not a standalone offline AI appliance.

Use [validation](VALIDATION.md) to distinguish implemented backends from tested combinations. Follow [firmware](FIRMWARE.md) before flashing.

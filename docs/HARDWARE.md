# Hardware
[English](HARDWARE.md) · [简体中文](HARDWARE.zh-CN.md)

## Implemented board
**Waveshare ESP32-S3-Touch-LCD-4B**, with 16 MiB flash, 8 MiB octal PSRAM and a 480 × 480 RGB touch display. Board support, pin assignments, the TCA9554 expander, GT911 touch and ST7701 display setup are in `firmware/vendor/waveshare_bsp`. Vendor reference: [Waveshare board wiki](https://www.waveshare.com/wiki/ESP32-S3-Touch-LCD-4B).

Do not substitute the 4.3-inch, 4-inch non-B, other ESP32-S3 displays or a generic DevKit without porting and checking power/USB routing. Product suffixes matter.

## Three connections
1. External target's HDMI output → HDMI capture input. Capture USB → Agent computer.
2. Board's **UART/CH343** USB → Agent computer. This is the command/identity channel.
3. Board's **native USB** port → target computer/tablet. The target enumerates a keyboard and mouse.

Use data-capable cables. A tablet needs an adapter/hub that supports both its video output and USB-host role. Some tablets expose different mirror and desktop/DeX outputs. Verify that the captured screen is the one receiving the input before acting.

The LCD is a local status/control interface. It does not display the HDMI stream. The firmware's backlight and sleep controls are specific to this board.

## Host versus target
The Agent host needs Node 20+, FFmpeg, and a serial transport (PowerShell on Windows; Python 3 standard library on POSIX). This implementation does not install drivers or adjust OS permissions automatically. The target only needs compatible video output and USB HID.

A network outage on the target does not sever the physical HDMI/HID path. Codex itself can still require network access on the Agent host. This is not a standalone offline AI appliance.

Use [validation](VALIDATION.md) to distinguish implemented backends from tested combinations. Follow [firmware](FIRMWARE.md) before flashing.

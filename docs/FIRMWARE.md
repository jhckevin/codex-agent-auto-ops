# Firmware
[English](FIRMWARE.md) · [简体中文](FIRMWARE.zh-CN.md)

Target: **Waveshare ESP32-S3-Touch-LCD-4B**. Firmware version: **0.3.4**. Plugin and firmware versions are independent.

## Build from source
Use a dedicated ESP-IDF **5.4.2** environment with its ESP32-S3 tools. Activate its `export.sh` first, then run:

```sh
bash tools/build-firmware.sh
```

The standard IDF component manager downloads the dependencies pinned in `firmware/main/idf_component.yml` and the committed `firmware/dependencies.lock`. The two modified display-support components are checked in under `firmware/vendor`. No private build directory is required. Generated fonts are already committed.

The build uses 16 MiB flash, 8 MiB octal PSRAM, 240 MHz CPU, 64-byte cache lines and an RGB bounce buffer. Do not change these as an incidental part of installing the plugin.

## New installation
**Flashing installs this project's custom partition table and firmware. It is not a non-destructive stock-firmware upgrade.** Back up the complete flash of your own device and record its identity before proceeding. Keep that backup private. Do not flash a secure-boot/encrypted or differently sized device using these generic steps.

From a build environment, replace PORT with the board's UART/CH343 port and use:

```sh
python -m esptool --chip esp32s3 --port PORT read_flash 0 0x1000000 private-device-backup.bin
idf.py -C firmware -p PORT flash
idf.py -C firmware -p PORT monitor
```

The first command assumes a verified 16 MiB device. Store it outside any public source checkout. USB boot/download mode and reset behavior depend on the board; consult the [vendor wiki](https://www.waveshare.com/wiki/ESP32-S3-Touch-LCD-4B).

For the prebuilt firmware ZIP, use the matching ESP-IDF/esptool environment, extract it, inspect `flash_args` and `flasher_args.json`, and run from that extracted directory:

```sh
python -m esptool --chip esp32s3 --port PORT write_flash @flash_args
```

The ZIP includes bootloader, partition table, initial OTA data and application. It is built from the source of the same GitHub release. It contains no original-device backup.

## Updating an existing custom installation
First read and verify the actual partition table and active application slot. Only use an application-only update when you know that slot's address and capacity and have a recovery backup. This project intentionally supplies no universal application-only update command.

The project layout contains a factory slot at 0x100000 and an OTA slot at 0x600000. These are **project partition offsets**, not properties guaranteed by the Waveshare model. A historical update to one board's OTA slot is not a reason to write every board at that address.

The firmware exposes keyboard, relative mouse and optional absolute mouse HID. It implements UART command bounds, session identity, heartbeat handling and local LCD/touch/power behavior. Prototype VID/PID values are documented in NOTICE. The LCD's status labels currently remain Chinese.

## Evidence
See [validation](VALIDATION.md). A successful build does not verify USB enumeration, target cursor behavior, power recovery or touch on your device. No device is flashed by the repository packaging scripts or CI.

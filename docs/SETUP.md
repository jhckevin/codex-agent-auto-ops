# Setup
[English](SETUP.md) · [简体中文](SETUP.zh-CN.md)

## Install the package
Use the repository marketplace described in the [README](../README.md). Choose English `agent-auto-ops` or Chinese `agent-auto-ops-zh`. The downloadable `marketplace-0.7.0.zip` can also be extracted and registered with `codex plugin marketplace add /absolute/path/to/extracted-folder`.

Use the plugin directory in Codex to install, then start a new chat. Only one process may own a given capture device and adapter. Do not enable both language packages on the same hardware.

## Find your devices
Run discovery on the **Agent computer**:

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

FFmpeg discovery can exit with a nonzero status after printing the devices. Device names in examples are placeholders, not automatic discovery.

Read the adapter identity after loading the firmware, with other serial clients stopped. From an extracted plugin directory:

```sh
printf '%s\n' '{"v":1,"op":"hello","seq":0}' | python3 scripts/serial-bridge-posix.py --port /dev/ttyUSB0
```

On Windows, pipe the same JSON line to `powershell.exe -NoProfile -File scripts/serial-bridge.ps1 -Port COM5`. On macOS use your actual `/dev/cu.*` port. Copy the returned MAC into your private configuration. Never use another adapter's identity to get past a mismatch.

## Configure
Copy `examples/windows-android.json`, `examples/macos.json` or `examples/linux.json` from the selected plugin to a private file. Replace:
- `target_id` and `target_os`: the actual external target.
- `serial.port` and `serial.expected_mac`: your UART bridge and verified board identity.
- `video.command`, `video.device`, dimensions and input FPS: a format supported by your capture card.
- `pointer_mode`: relative where absolute HID is unavailable.
- `display_mode`: start with unknown unless the actual mode is confirmed.

The host determines the FFmpeg input driver. `target_os` describes the device being controlled, not the machine running FFmpeg.

Set the environment before launching Codex:

```powershell
$env:AGENT_AUTO_OPS_CONFIG = 'C:\path\private\adapter.json'
$env:AGENT_AUTO_OPS_LOCALE = 'en'
```

```sh
export AGENT_AUTO_OPS_CONFIG=/absolute/private/adapter.json
export AGENT_AUTO_OPS_LOCALE=en
```

A desktop app already running will not inherit variables from a newly opened shell; fully relaunch it from the configured environment or use its supported environment configuration. Paths inside the JSON must be absolute where they refer to executables or scripts. Do not edit an installed plugin's generated files to store credentials or machine configuration.

## First observation
Ask Codex to inspect status and a fresh image. Check target ID, MAC, mode and `simulation: false`. Compare the captured screen with the actual target. Start with a harmless UI action and inspect the returned image. `kvm_status` returns the optional read-only preview URL.

No configuration means **simulator**. A capture failure, identity mismatch or stale frame blocks input. Stop competing camera/serial applications if a device is busy. On macOS, the host may require camera permission for the launching process; this project does not suppress OS privacy prompts.

Input is printable US ASCII. The target's keyboard layout must match; language switching in the viewer does not switch the target's layout. `fill_text` assumes a focused field and can submit only when explicitly requested.

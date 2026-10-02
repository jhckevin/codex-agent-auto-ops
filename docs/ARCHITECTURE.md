# Architecture
[English](ARCHITECTURE.md) · [简体中文](ARCHITECTURE.zh-CN.md)

The local Node process serves stdio MCP. Codex decides the next intent from the returned image; this project provides transport, validation and feedback, not a second model.

| Layer | Responsibility |
| --- | --- |
| `server/main.mjs` | MCP schemas, tool dispatch, locale and process lifecycle |
| `server/harness.mjs` | Latest-observation authorization, identity/freshness checks, unique operation IDs, outcome handling |
| `server/ffmpeg-video.mjs` | Background capture and latest-frame metadata on DirectShow/AVFoundation/V4L2 |
| `server/esp.mjs`, `serial.mjs` | Adapter handshake and serialized UART transactions |
| `firmware/main` | HID descriptors/reports, bounded command protocol, watchdog, LCD, touch and power |
| `server/preview.mjs`, `ui/` | GET-only loopback viewer, original SVG symbols, English/Chinese messages |

## Observe → act → verify
`kvm_status` identifies the configured target and simulator flag. `kvm_observe` returns an image with its observation ID. `kvm_act` consumes that ID and a unique operation ID, validates preconditions and sends one bounded intent. It returns a settled observation plus timing/change diagnostics. Unknown outcomes are not blindly retried.

`kvm_set_view_context` records what the agent has observed: mirror, DeX, extended, desktop or unknown. It does not reconfigure the target. Only confirmed Android/iPadOS mirror mode permits the optional firmware cursor-maintenance behavior. `kvm_stop` releases input where supported and ends the session.

## Boundaries
The ESP32 never processes video. FFmpeg runs even if the viewer is closed. The viewer has no input-control endpoint, requests no external fonts or assets, and keeps only the latest image plus a bounded event list. These retention properties do not describe what Codex or an external log collector stores.

The optional Openterface Qt integration is legacy and requires the included frame-metadata patch. The documented default uses FFmpeg plus ESP32 HID.

## Languages
The primary plugin defaults to English; the generated Chinese package uses the same runtime. Locale JSON selects server descriptions and initial HTML language. The browser applies explicit query parameter, then saved preference, then package default. Original interface SVG assets are shared; no raster icon library is required.

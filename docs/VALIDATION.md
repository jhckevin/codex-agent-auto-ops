# Validation status
[English](VALIDATION.md) · [简体中文](VALIDATION.zh-CN.md)

Release: plugin **0.7.0**, firmware **0.3.4**, 2026-10-02.

## Executed for this release
| Check | Result |
| --- | --- |
| Node/MCP contract suite | 47 tests passed |
| POSIX serial transport | PTY round-trip / timeout test passed |
| Firmware C models | Protocol, UI, power and motion checks passed |
| Installable ZIPs | Both extracted outside parent node_modules; MCP started and returned a labelled simulator image |
| Language defaults | English primary and Chinese package descriptions, manifests and HTML defaults passed |
| Codex compatibility manifests | Both passed the available plugin validator |
| Complete firmware build | Passed on isolated ESP-IDF 5.4.2 using public component-manager dependencies |
| UI predecessor | Desktop/mobile layout and live browser switching checked in 0.6.0; 0.7.0 changes default/package identity and docs |
| Physical flashing | Not performed for 0.7.0; existing hardware state preserved |

A clean component-manager build exposed a generated-font include assumption. The main component now defines `LV_LVGL_H_INCLUDE_SIMPLE`; it no longer relies on a private directory named lvgl. This is a build portability fix, not evidence of a new physical acceptance run.

## Earlier physical evidence
On 2026-09-30, firmware **0.3.3** on the implemented Waveshare board was used with a Windows Agent host, UGREEN HDMI capture and a Samsung Galaxy Tab S8+. HDMI frames, keyboard navigation, relative pointer movement and a click into visible pointer settings were observed in mirror mode. Closing the viewer did not stop capture. Absolute HID enumeration differed in the tested interface profiles.

These observations do not establish full support for DeX, iPadOS, macOS/Linux hosts, UEFI, long-duration stability or target release behavior after cable removal. Firmware 0.3.4 adds mobile mirror cursor maintenance, which still requires physical regression.

The historical screenshots contain private device information and are not distributed. The sanitized record is descriptive evidence, not a reproducible screenshot dataset.

## Reproduce
Run the [contribution-guide checks](../CONTRIBUTING.md), `bash tools/check-firmware-models.sh` and `bash tools/build-firmware.sh` in an isolated development environment. Release ZIPs include SHA256SUMS. CI runs plugin packaging and firmware compilation independently; its current result is available in the GitHub Actions tab.

Simulator results validate protocol behavior and packaging. They do not demonstrate physical target success. Report new device results with exact versions, display mode and observable before/after behavior.

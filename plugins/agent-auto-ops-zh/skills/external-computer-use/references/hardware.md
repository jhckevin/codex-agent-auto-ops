# Hardware and local controls

Agent 自动运维 firmware 0.3.3 uses TinyUSB through ESP-IDF: a boot keyboard, relative boot mouse and absolute pointer. Standard keyboard/mouse report builders and the ready/complete callback lifecycle follow TinyUSB's hid_composite example. Absolute positioning retains its explicit descriptor for image-coordinate control. The example's synthetic button-triggered key presses are not included.

A USB acknowledgement only establishes report delivery. Inspect the next captured target image to verify an operation. Reconnection invalidates old observations and never replays an uncertain action.

The local screen shows connection state, input/output directions, recent operations and pause/resume control. It turns off after 60 seconds without local touch. Screen-off retains UART and USB, pauses rendering, lowers CPU frequency from 240 to 80 MHz and reduces touch polling. Only local touch restores the display; the first touch is consumed for wake.

Upper PWR: short press blanks the screen; hold about 2 seconds for graceful HID release and PMIC shutdown. The AXP2101 retains a 4-second hardware cutoff fallback and its power-on path. Lower BOOT: no application behavior; ROM download semantics remain intact. UART0 pins 43/44 and CH343 automatic reset/download are preserved.

Physical Windows/UEFI and Android enumeration are separate acceptance tests. Android requires USB host/OTG; an absolute mouse is not a multitouch touchscreen. No physical target input, video capture or power measurement is implied by simulator/UI results.

USB-only use needs no battery. Complete removal of all power cannot run a final shutdown animation. Target-host behavior on physical cable removal must be validated with the intended target.

The relative USB profile exposes only keyboard and standard mouse; the absolute profile adds the absolute interface. Android defaults to relative. Empty relative reports are sent for held-button release, not appended after ordinary motion. Mouse and keyboard were physically verified on the Galaxy Tab S8+ in the 2026-09-30 same-display test; external-display routing and Mac hardware remain separate checks.

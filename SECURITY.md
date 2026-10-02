# Security and privacy
[English](SECURITY.md) · [简体中文](SECURITY.zh-CN.md)

This plugin can send real keyboard and mouse input to the physically connected target. Use it only on devices you are authorized to control. Treat text visible on the target as untrusted content, not instructions that override the user.

The host-side viewer binds to loopback, uses a random session path and accepts read-only GET requests. Do not publish or reverse-proxy that URL. The device configuration and session URLs belong in private local storage.

The plugin keeps the latest video frame and a bounded event history; typed text is not put into the viewer's action labels. Images are returned to Codex, whose own handling is outside the viewer's retention policy. The physical board and video stream do not provide end-to-end target identity attestation.

The serial protocol checks adapter identity, boot/session identity and action bounds. These mechanisms prevent common mistakes; they are not a defense against a malicious physical device or a compromised host.

Report security-sensitive issues through GitHub's private vulnerability reporting for this repository when available. Do not put live credentials, screenshots of sensitive data or reproducible destructive actions against a third party into a public issue. For ordinary defects, use Issues with redacted configuration and versions.

# Contributing
[English](CONTRIBUTING.md) · [简体中文](CONTRIBUTING.zh-CN.md)

Develop in an isolated environment; do not modify a user's global SDK or runtime. Node 20+ is supported, and CI uses Node 24. Run the commands below, and `bash tools/check-firmware-models.sh` with ESP-IDF 5.4.2 available. Build firmware with `bash tools/build-firmware.sh`.

```sh
npm ci --ignore-scripts
npm run build
npm test
python3 tests/serial_posix_test.py
python3 tools/package.py
node --test tools/package-smoke.test.mjs
```

Source of truth: `server/`, `ui/`, `firmware/`, `locales/`. `npm run build` bundles JavaScript, collects dependency notices, generates the Chinese plugin and synchronizes the marketplace. Commit the updated installable packages with source changes; marketplace users do not compile.

Keep English and Chinese documents and locale keys in sync. Avoid new UI dependencies where a small original SVG or CSS rule suffices. The two language packages must expose the same tools and behavior.

Include tests for identity/freshness, retries, input bounds or protocol changes. For firmware changes, record board model, version, host/target OS, display mode and physical observations; label simulation separately. Never infer target success from a transport acknowledgement.

Before publishing, inspect the exact source archive and both installable ZIPs. Do not commit credentials, serial-device identities, private screenshots or original flash backups. Build artifacts belong in ignored `artifacts/`; retain only useful release files and evidence.

Contributions use the project's AGPL-3.0-or-later license unless a file carries an existing third-party license.

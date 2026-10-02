# 贡献
[English](CONTRIBUTING.md) · [简体中文](CONTRIBUTING.zh-CN.md)

在隔离环境开发，不修改使用者的全局 SDK 或运行时。支持 Node 20+，CI 使用 Node 24。执行下列检查命令，并在 ESP-IDF 5.4.2 环境执行 `bash tools/check-firmware-models.sh`；固件使用 `bash tools/build-firmware.sh`。

```sh
npm ci --ignore-scripts
npm run build
npm test
python3 tests/serial_posix_test.py
python3 tools/package.py
node --test tools/package-smoke.test.mjs
```

源文件位于 `server/`、`ui/`、`firmware/`、`locales/`。`npm run build` 打包 JavaScript、收集依赖许可、生成中文插件并同步市场。源码变更需同时提交更新的可安装包，市场使用者不需要编译。

保持中英文文档和语言键同步；优先使用简洁原创 SVG/CSS。两个语言插件必须保持工具和行为一致。

身份、时效、重试、输入边界及协议变更需要针对性测试。固件测试记录板型、版本、宿主/目标系统、显示模式与实际现象，模拟测试单列。传输确认不能替代目标画面的成功验证。

发布前检查源码归档和两种语言的实际 ZIP。不要提交凭据、具体设备身份、私人截图或原厂整片备份。产物放进忽略的 `artifacts/`，仅保留有用发布包和验证记录。

贡献适用项目 AGPL-3.0-or-later 许可；有既有第三方许可的文件除外。

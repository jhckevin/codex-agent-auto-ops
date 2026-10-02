# Display vendor sources

Waveshare BSP 1.1.1 (upstream commit 3864a143201c0671f90e544963118776fe5f88c2) and ESP LVGL port 2.7.2 (upstream commit ee66ac9af9bb8edd19ba48fb7b8c52c49dea74d2) carry their Apache-2.0 licenses.
These copies include project modifications: RGB bounce-buffer synchronization, active-low backlight latch and asynchronous touch sampling. They are not pristine upstream copies; the exact delivered files are tracked here.
Only the local copies' dependency declarations are adjusted for this isolated build. No original firmware project or global SDK files are changed.
LVGL 9.2.0 and display drivers are pinned in main/idf_component.yml. ESP-IDF component manager resolves them from the pinned main manifest.
Chinese glyph data are rasterized subsets of WenQuanYi Zen Hei. Font attribution and embedding license are in main/fonts/LICENSE-WQY.txt. Generated font C files are committed; font conversion is not needed for ordinary firmware builds.

Version 0.3 adds a BSP wrapper for ESP-IDF RGB clock/restart APIs and a configurable touch polling interval. Empty touch samples no longer wake the LVGL task.

The BSP references the checked-in LVGL port through CMake EXTRA_COMPONENT_DIRS; its redundant registry override was removed so lockfiles contain no machine-specific path.

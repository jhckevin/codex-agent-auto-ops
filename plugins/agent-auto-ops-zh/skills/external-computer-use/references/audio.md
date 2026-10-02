# Video only and microphone isolation

The plugin opens only a video device. FFmpeg maps only 0:v:0, disables audio output, and macOS uses :none for the audio device. Audio-enabled configuration and embedded :audio= selectors are rejected. The viewer denies microphone/camera permissions and serves JPEG images, not media with an audio track.

A USB HDMI capture card may also expose a separate USB audio input. Windows or an application can select that input as its microphone even when speakers are silent and the plugin never opens audio. The plugin does not silently change the host's default microphone.

For the measured UGREEN device, the video child is MI_00 and the audio child is MI_02 (VID 345F, PID 2130). Check exact PnP identity before any change. The packaged scripts/isolate-capture-audio.ps1 defaults to Inspect and requires explicit InstanceId and ExpectedName. Disable/Enable requires Windows administrator rights, verifies a USB audio driver and touches only that child interface. It never records audio or changes the built-in microphone. Do not disable the USB composite parent or video child.

Current host attempt on 2026-09-30 returned a Windows PnP error; audio isolation is not verified. Recheck with administrator authorization or select the built-in microphone in Windows/Codex, then verify dictation with the user. Hardware testing was deferred while the tablet charges.

Microsoft reference: https://learn.microsoft.com/en-us/powershell/module/pnpdevice/disable-pnpdevice

# Setup

The prebuilt server runs with Node >=20 on Windows, macOS and Linux; no local npm installation or compilation is needed. Without AGENT_AUTO_OPS_CONFIG it runs an explicitly labelled simulator.

Set AGENT_AUTO_OPS_CONFIG to an absolute config JSON path; use the packaged examples. Identify the UART bridge, expected adapter MAC, target OS and capture device explicitly. Keep one active process per UART/capture device.

The FFmpeg video backend runs independently of the optional read-only webpage. kvm_status returns preview_url. Closing that page does not stop capture or actions. A browser camera grant is neither used nor required. macOS AVFoundation may require camera permission for the process launching FFmpeg.

On macOS choose /dev/cu.* and an existing Python 3. The POSIX serial helper uses only the standard library. Command, Option and Control are accepted modifier aliases. The maintainer has completed physical acceptance on macOS and confirms that video and keyboard/mouse control work correctly.

For the alternate Openterface video backend, apply patches/openterface-frame-metadata.patch to the pinned upstream source. An uninstrumented upstream video source cannot authorize input.

Install through Codex's supported plugin flow. New tools normally load in a new task. Start with kvm_status to verify target_id, hardware identity and simulation=false.

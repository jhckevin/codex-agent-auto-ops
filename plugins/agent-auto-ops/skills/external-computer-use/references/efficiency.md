# Efficient operation

Prefer native MCP calls so images return directly. kvm_act returns both the action result and a new image; inspect it before requesting another image. Adaptive waiting compares compressed-frame hashes, not OCR or application state. Animations, blinking cursors, clock updates and camera noise can affect hashes. The model must still verify the intended result.

The plugin records queue_ms, preflight_ms, pointer_prepare_ms, hid_ms, post_action_ms, total_ms and wire_actions, plus the failure phase. This separates capture/target latency from transport and model/tool orchestration time. It never reports UI success from a USB ACK.

Large relative motions are one logical call, bounded to ±8192 counts. Firmware 0.3.4 splits them into signed 8-bit packets along a line; older firmware uses sequential packets in one UART session. This does not calibrate counts to pixels or neutralize target acceleration.

For a visibly focused search field, use fill_text with submit=true instead of separate select-all, type and Enter tool calls. Do not use it on an unverified field.

## Existing-session fallback

A prebuilt worker is included at scripts/session-worker.cjs. It takes absolute PLUGIN_DIRECTORY CONFIG_JSON SESSION_DIRECTORY arguments and owns one MCP stdio server. Run it hidden using the host's existing Node runtime. There must be only one worker or native MCP session per UART/camera.

The prebuilt command client takes:
- SESSION_DIRECTORY observe [--wait]
- SESSION_DIRECTORY move DX DY --observation ID
- SESSION_DIRECTORY click left --observation ID
- SESSION_DIRECTORY key Enter --observation ID
- SESSION_DIRECTORY fill 'ASCII text' --submit --observation ID
- SESSION_DIRECTORY context mirror --observation ID
- SESSION_DIRECTORY stop

For arbitrary text prefer --text-file PATH instead of interpolating user text into shell code. Inspect the returned image_path with an image tool. The client requires the observation ID you actually inspected; it never silently selects a newer frame or retries input.

This compatibility worker adds one Node process. Native MCP is the production path with lower process count. The viewer remains read-only; no browser control endpoint was added.

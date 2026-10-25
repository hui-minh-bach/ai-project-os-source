# Managed Linux preview

For the `managed-linux` profile, selected only when `SITES_MANAGED_LINUX_CONTAINER=1`.

Follow the `cua_repl.js` tool instructions.

1. Run `sites-preview start <absolute-checkout>` for a checkout beneath `/workspace`. The container's daemon owns one preview; do not launch a separate server.
2. Open the exact URL returned by the CLI in the cloud browser. Do not choose or rewrite the host or port.
3. Reuse the preview through edits, builds, and hosting. Refresh static pages after edits when live reload is unavailable.
4. Use `sites-preview status` for diagnostics. Run `sites-preview stop` when finished or before restarting after a repair.

The CLI runs a nonempty `scripts.dev`; otherwise it serves `.openai/hosting.json`'s `static.directory`. For static HTML, set `static.directory` and create it with `index.html` before starting.

If the CLI, daemon, or browser route is unavailable, report the environment limitation and follow [Troubleshooting](../troubleshooting.md#preview). Do not change network permissions or bypass the sandbox.

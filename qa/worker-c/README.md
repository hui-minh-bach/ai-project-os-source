# Worker C source-bound QA

`node --test test/worker-c-launcher.test.mjs` runs actual Node launcher without trusting current working directory and proves an explicitly occupied port is **not reused**. Does not grant Windows sign-off.

`python qa/worker-c/verify_source_static.py` tests the actual source's 10-tab slots, 5 preserved themes, local error recovery markup, keyboard dialog support and non-destructive packaging controls. This is intentionally weaker than rendered browser/OS QA.

On a separate Windows 10/11 test machine, run `windows/Build-WorkerC-Internal-RC.ps1`, install the unsigned INTERNAL QA preview, then `windows/Smoke-Installed-WorkerC.ps1` and a manual 10x5x2 Playwright / axe audit. Never instruct users to disable Defender, and do not distribute the unsigned RC commercially.

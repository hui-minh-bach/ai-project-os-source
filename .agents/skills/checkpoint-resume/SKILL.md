---
name: checkpoint-resume
description: Tiếp tục tác vụ an toàn. Use for AI Project OS idea-to-product and media production workflows requiring this role.
---

# checkpoint-resume

## Scope
Lưu atomic mỗi bước với project/task ID, hashes, output, receipt, worker; khi máy Windows offline thì WAITING_WORKER; kiểm chứng artifact trước tiếp tục để không dựng lại những gì đã hoàn tất.

## Mandatory gates
- Begin with approved spec, task ID, current artifact references, permissions and tool availability.
- Tools/repositories listed in docs do not count as installed executors. Inspect actual probe and connector permission before using.
- Save output reference, SHA when available, task status and receipts for every material step.
- Distinguish static, mock, integration, browser, Windows native and NOT_TESTED evidence.
- Do not overwrite approved 3D/UI, historical user files or model selections.
- Require explicit approval for paid API, unsafe host commands, production publishing or destructive writes.
- If output does not exist or is unverified, report BLOCKED or NOT_TESTED, never COMPLETED.

## Handoff
Return work item, actual artifacts with exact locations, evidence type, current blockers and next task. This file is an instruction skill; it does not install or execute an MCP, AI model or worker.

---
name: requirements-to-spec
description: Biến ý tưởng thành đặc tả. Use for AI Project OS idea-to-product and media production workflows requiring this role.
---

# requirements-to-spec

## Scope
Phân loại website, ứng dụng Windows/mobile, game, dịch vụ API hoặc media; tạo tiêu chí nghiệm thu có thể kiểm chứng; chọn công nghệ theo yêu cầu chứ không mặc định framework.

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

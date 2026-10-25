---
name: heygen-workflows
description: Use HeyGen for talking-avatar videos, general AI clips with HeyGen Video 1, and video, avatar, voice, translation and media workflows.
---

Use the connected server's available tools and current schemas. Never claim a capability that the connection does not expose.

## Choose the video workflow

Route video requests yourself; never ask the user to pick a HeyGen tool or format, and ask only for what a useful result needs, such as a topic when none was given. Decide the format first, then use the requested length.

- **Avatar Video**: one person (the user, a stock avatar or another chosen person) speaking straight to the audience against a fixed background, at any length. Supplied audio or a word-for-word script is always Avatar Video. Without a known avatar ID, use prepare_avatar_video and follow its guidance; preserve the topic or script and respect an explicit decline of digital-twin setup. With a confirmed look and an exact script or audio, use create_video_from_avatar and preserve both exactly. Draft a script when only a topic is given.
- **HeyGen Video 1**: a visual production (scenes, demos, animation, product footage, B-roll, acted scenes, off-screen narration) of 15 seconds or less, with no stated length, or a vague request. Use text_to_video, image_to_video for a first-frame image, or reference_to_video for guiding media. Lengths are whole seconds from 5 to 15; requests under 5 seconds get 5, so say so briefly. Omit duration for the 5-second default and use auto only when the user leaves the length to HeyGen. Never stretch an unspecified length past 15 seconds. 2k text/reference generation requires 16:9 or 9:16; image-to-video follows the image's proportions.
- **Video Agent**: a visual production asked to run longer than 15 seconds, one that must keep the user's supplied photos or videos unchanged, or an explicit Video Agent request. Use video_agent.generate with presenter_mode none unless the user wants their own digital twin to appear. If an explicit Video Agent request needs exact wording or an exact recording, say Video Agent may reword or re-voice it and let the user choose.
- **Cinematic Avatar**: only when the user explicitly asks for Cinematic Avatar; a style word like "cinematic" is not such a request. Use create_video_from_cinematic_avatar with the user's own avatar or an AI-generated public avatar, never a public studio avatar. If it reports that the plan does not include Cinematic Avatar, explain that, offer a talking-avatar video instead and wait for the user's answer.

Route separately requested clips one at a time and continue the existing video or session for follow-ups. If a capability, length, plan limit, exact wording or likeness cannot be met, explain it and let the user choose; never switch formats silently.

## Show results and follow progress

On a widget-capable host where show_video is available, after text_to_video, image_to_video, reference_to_video or direct avatar creation returns a video ID, call show_video once in the same turn, including while pending. Do not ask whether to show the result. The player receives completion/failure updates and performs recovery reads. Do not poll get_model_video from the conversation merely to wait; use it for an explicit model-status/details request.

For an existing video ID, including a library result, first call get_video. Open show_video only after successful lookup with status other than failed and when the user wants to watch or track it. Library browsing alone should use list_videos without automatically playing a result. When the user asks for one video whose ID is unknown, such as "show my latest video", use lookup_videos to find candidates, verify the newest completed one with get_video, then call show_video once; mention a newer failed attempt that was skipped. lookup_videos output alone does not fulfill a browse or view request.

Downloads happen only when the user clicks Download in the player or gallery. Never invoke app-only download helpers on the user's behalf or fabricate a download link.

On direct clients without widgets, poll get_model_video for model clips, get_video for avatar videos and completed Video Agent output, and get_video_agent_session for ongoing Video Agent work. Honor returned retry delays; otherwise wait 30 seconds. After five minutes return actual status and available links for later follow-up. Never repeat creation to check progress. Stop on failed/cancelled and explain the returned failure without regenerating unless asked.

## Assets, voices and account actions

Reuse conversation attachments through import_asset_from_chat when supported. Otherwise use a verified HeyGen asset reference or the available upload workflow: create_asset_upload, transfer bytes, then complete_asset_upload. Do not claim an upload completed without that confirmation, or assume a direct client can transfer bytes.

For avatars, browse list_avatars when available or list_avatar_groups then list_avatar_looks on direct clients. Browsing or selection does not authorize generation. For user-selected voices, use choose_voice when available; for delegated voice choice, use list_voices and call create_speech once with the exact agreed text and a compatible returned voice. create_speech is the only speech-synthesis tool; Turbo and professional-clone-only model synthesis are not available through this connection. After a speech error or timeout, ask the user before generating again. Do not invent IDs or generate auditions unasked.

For HeyGen Image portraits, use create_image_generation with the user's identity images and exactly one reference image, then poll get_image_generation until it finishes. Never create another job to check progress.

Discover translation languages before starting a requested translation. A language question does not authorize generation. Before create_video_translation or creating an instant voice clone, explain what HeyGen will do with the media (by default, recreating the speakers' voices and lip movements) and wait for the user's explicit confirmation that they authorize it and have permission from everyone whose voice or likeness is used; an upload or the original request is not confirmation. Ask again if the media or options change materially.

To cut short clips from a longer video, use create_ai_clipping and check progress with get_ai_clipping. Highlights come from spoken dialogue, so music-only or silent videos fail, and clips are 20 seconds or longer. Follow recording, consent and authentication handoffs. Keep account actions within the user's request and explicit confirmation requirements. For an uncertain write outcome, check status before retrying. Retry a retryable read at most once after the returned delay. Explain entitlement and renewal facts without inventing reset schedules, promoting upgrades, or initiating purchases. If a tool reports that the user's workspace is not supported through this connection (byok_not_supported), explain that and that they can continue in the HeyGen web app; do not retry.

## Reusable templates

Use list_templates and get_template to inspect existing templates and generate_from_template for a requested video using verified variables. For explicit template-authoring requests, use create_template with a verified user video that has a supported current-editor draft. Inspect the returned composition or get_template before binding variables; never invent element IDs. Use set_template_variables with the complete desired variable set, including every variable to keep. Text matches are exact and case-sensitive. Prefer the current edit_version as expected_edit_version and reconcile a stale-version conflict before retrying. Use update_template to rename and delete_template only when the user requests removal. Template authoring or browsing alone does not authorize video generation.


# CoreServices v1 adapter contract (host integration pending)

This directory is **not** a separate app; it exports `registerMediaEngine({CoreServices,workspace})`, which **only registers seven TaskQueue handlers**. The app UI and core remain owned by the existing system. The supplied KBL Local Worker V5.7 ZIP has **no definitions** for `CoreServices`, `ProviderGateway`, `TaskQueue`, `ArtifactStore`, or `EventBus`; therefore this code **cannot** assert real integration until the AI Project OS host is supplied.

Mandatory bridge signatures:

```javascript
CoreServices = {
  ProviderGateway: { invoke(request): Promise<providerResult> },
  TaskQueue: { registerTask(name, asyncHandler): void },
  ArtifactStore: { putFile({jobId,source,name}): Promise<{uri,sha256}>, putJson({jobId,name,data}): Promise<{uri,sha256}> },
  EventBus: { publish(topic,payload): void }
}
registerMediaEngine({CoreServices, workspace:'C:/AI-Project-OS/authorized-workspace'});
```

`workspace` must be a dedicated writable directory, never your whole drive. Input media files must already be copied to it by the host through its authorized importer. Tasks use `jobId` with alphanumerics, `-` or `_`, and are invoked **only** by the host TaskQueue. See `adapters/host-core-services-v1.example.cjs`. Its hypothetical `host.*` methods are examples to replace with the real owner-provided interface, **not** confirmed core methods.

Registered job payloads:

| Name | Main fields | Result |
|---|---|---|
| `media.analyze` | `{jobId,source,transcribe?,language?}` | FFprobe, frame samples, audio extraction, scenes/silence, optional transcript through gateway |
| `media.subtitle-edit` | `{jobId,segments,changes,translation?}` | SRT/VTT, segmented edits and optional translation |
| `media.edit-plan` | `{jobId,source,prompt,analysis?}` | Structurally validated timeline, AI provider or deterministic fallback |
| `media.render` | `{jobId,source,editPlan,subtitleSegments?,music?}` | Preview/final MP4, SRT, QA, timeline |
| `media.story` | `{jobId,text?,source?,voice?,resolution?,mode?,allowProviderImages?,music?}` | Narrated chapter-scene MP4, editable SRT/VTT, storyboard, images |
| `media.publish-draft` | `{jobId,channel,title,description?,hashtags?,video,rights?}` | Draft metadata, **not posted** |
| `media.publish` | `{jobId,id}` | **BLOCKED**: deliberately hard locked |

`mode='verbatim'` preserves all sentences while normalizing whitespace. `mode='adapted'` requires an authorized text provider. Default story `resolution='720p'`, also supports `'1080p'` or low-resource `'360p'`. `voice='vi'` is a provider voice selection, **not** a guaranteed natural voice. Save original story rights as `rights`, e.g. `'original-author-owned'`; do not automatically publish without verified permissions.

All final artifacts must pass through `ArtifactStore`. Internal scene/audio/renders and checkpoint data are confined to `<workspace>/.media-engine/jobs/<id>/` and may be resumed without recomputation. `media.progress` events are emitted through EventBus. The module never calls the UI or accesses Vault.

Windows requirements: Node.js >=20, FFmpeg+FFprobe with libx264/libass and AAC codecs on PATH, suitable free disk space, at least 4 GB RAM for 720p recommended; 8 GB RAM and more space recommended for 1080p. A real Whisper model and voice provider must be explicitly connected via host ProviderGateway for transcription and natural Vietnamese narration. None are downloaded automatically.

No credentials in source, no cookie emulation, no CAPTCHA bypass, no external network listeners, no changes to existing server URL or token. `Publisher` internal implementation is draft-only through the registered module; external publish use must not be wired before V10 review.

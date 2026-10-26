/**
 * Video templates ("Mẫu video"): deterministic preset bundles over the
 * existing media operations. A template never invents a new engine — it
 * picks an operation and fills its parameters so a non-technical user goes
 * from "choose a template, drop content, run" instead of learning 10 modes.
 * The client mirrors this table for display; this module is the source of
 * truth for routing (AI Director with a templateId skips the model and
 * returns the template's plan verbatim, labeled as a template).
 */
export const MEDIA_TEMPLATES = [
  {
    id: 'news-vertical', name: 'Tin tức dọc 9:16', icon: '📰',
    desc: 'Video tin/bản tin đứng: khung dọc, chữ karaoke nảy, che phụ đề cũ.',
    needs: 'video', operation: 'media.retheme',
    params: { targetLanguage: 'vi', hardsubCover: 'blur', hardsubRegionPct: 18, karaokeCaptions: true, captionPreset: 'pop' },
    effects: ['pad-vertical'],
    hint: 'Nạp video nguồn, gõ chủ đề/tin mới (hoặc dán sẵn kịch bản), bấm Chạy.',
  },
  {
    id: 'review-sale', name: 'Review / Bán hàng', icon: '🛍️',
    desc: 'Clip giới thiệu sản phẩm: màu tươi, tiêu đề mở đầu + thẻ tên, khung dọc.',
    needs: 'video', operation: 'media.effects',
    params: {},
    effects: ['pad-vertical', 'vivid', 'title', 'lower-third'],
    hint: 'Nạp video sản phẩm, điền tiêu đề và thẻ tên trong panel Hiệu ứng, bấm Chạy.',
  },
  {
    id: 'story-telling', name: 'Kể chuyện', icon: '📖',
    desc: 'Văn bản thành phim kể: giọng đọc, hình minh họa, chuyển cảnh trượt mềm.',
    needs: 'text', operation: 'media.story',
    params: { transition: 'slideleft', transitionSeconds: 0.4, karaokeCaptions: true, captionPreset: 'pop' },
    effects: [],
    hint: 'Dán câu chuyện vào panel Kể chuyện, chọn giọng, bấm Chạy.',
  },
  {
    id: 'dub-film', name: 'Việt hóa video — 7 bước', icon: '🎬',
    desc: 'Nhận video → nghe → AI dịch → xử lý vùng chữ/logo → giọng Việt → phụ đề → MP4.',
    needs: 'video', operation: 'media.localize',
    params: { sourceLanguage: 'auto', targetLanguage: 'vi', ttsProvider: 'local' },
    effects: [],
    hint: 'Mở luồng 7 bước, kiểm tra vùng chữ/logo và giọng Việt rồi duyệt chạy một tác vụ.',
  },
  {
    id: 'karaoke-clip', name: 'Karaoke chữ chạy', icon: '🎤',
    desc: 'Giữ hình, thay giọng mới với chữ chạy theo lời kiểu hộp nổi bật.',
    needs: 'video', operation: 'media.retheme',
    params: { targetLanguage: 'vi', hardsubCover: 'off', karaokeCaptions: true, captionPreset: 'box' },
    effects: [],
    hint: 'Nạp video, dán kịch bản mới, bấm Chạy.',
  },
];

export function templateById(id) {
  return MEDIA_TEMPLATES.find(t => t.id === String(id || '')) || null;
}

/** Deterministic Director plan for a template: no model involved. */
export function directorPlanForTemplate(template, { source = null } = {}) {
  if (!template) return null;
  return {
    available: true, fallback: false, viaTemplate: template.id,
    intent: ['media.dub','media.localize'].includes(template.operation) ? 'long-tieng' : template.operation === 'media.story' ? 'y-tuong' : template.operation === 'media.effects' ? 'chinh-sua' : 'doi-chu-de',
    summary: `Mẫu “${template.name}”: ${template.desc}`,
    operation: template.operation,
    params: { ...(source ? { source } : {}), ...structuredClone(template.params), ...(template.effects.length ? { effects: [...template.effects] } : {}) },
    needsInput: template.needs === 'video' && !source ? 'Hãy nạp video nguồn trước khi chạy mẫu này.' : null,
  };
}

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createIngestStore, parseFeed } from '../src/lib/ingest.mjs';

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>Tin mẫu</title><link>https://example.com</link><description>Kênh tin mẫu</description>
<item><title>Bão lớn đổ bộ miền Trung</title><link>https://example.com/bao-1</link><guid>https://example.com/bao-1</guid><pubDate>Sat, 17 Oct 2026 02:00:00 GMT</pubDate><description><![CDATA[<p>Gió giật <b>cấp 12</b>, mưa rất to.</p>]]></description></item>
<item><title>Giá vàng &amp; đô la hôm nay</title><link>https://example.com/gia-vang</link><pubDate>Sat, 17 Oct 2026 03:30:00 GMT</pubDate><description>Giá vàng tăng mạnh trong phiên sáng.</description></item>
<item><title>Đội tuyển thắng trận mở màn</title><link>https://example.com/bong-da</link><pubDate>Sat, 17 Oct 2026 04:00:00 GMT</pubDate><description>Chiến thắng 2-0 trên sân nhà.</description></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<title>Atom mẫu</title>
<entry><title>Tin công nghệ mới</title><link rel="alternate" href="https://example.org/tech-1"/><id>urn:tech-1</id><updated>2026-10-17T05:00:00Z</updated><summary>Chip mới ra mắt &lt;ấn tượng&gt;.</summary></entry>
<entry><title>Bản tin thứ hai</title><link href="https://example.org/tech-2"/><id>urn:tech-2</id><published>2026-10-17T06:00:00Z</published><summary>Nội dung tóm tắt hai.</summary></entry>
</feed>`;

const fakeFetch = xml => async () => ({ ok: true, status: 200, text: async () => xml });

async function fixture(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aios-ingest-'));
  try { return await fn({ dir, file: path.join(dir, 'ingest.json') }); }
  finally { fs.rmSync(dir, { force: true, recursive: true }); }
}

test('ingest: parseFeed đọc đúng RSS 2.0 (CDATA, entity, ngày tháng)', () => {
  const items = parseFeed(RSS);
  assert.equal(items.length, 3);
  assert.equal(items[0].title, 'Bão lớn đổ bộ miền Trung');
  assert.equal(items[0].link, 'https://example.com/bao-1');
  assert.equal(items[0].guid, 'https://example.com/bao-1');
  assert.equal(items[0].publishedAt, '2026-10-17T02:00:00.000Z');
  assert.equal(items[0].summary, 'Gió giật cấp 12, mưa rất to.');
  assert.equal(items[1].title, 'Giá vàng & đô la hôm nay');
  assert.equal(items[2].publishedAt, '2026-10-17T04:00:00.000Z');
});

test('ingest: parseFeed đọc đúng Atom (link href, id, published/updated)', () => {
  const items = parseFeed(ATOM);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'Tin công nghệ mới');
  assert.equal(items[0].link, 'https://example.org/tech-1');
  assert.equal(items[0].guid, 'urn:tech-1');
  assert.equal(items[0].publishedAt, '2026-10-17T05:00:00.000Z');
  assert.equal(items[0].summary, 'Chip mới ra mắt <ấn tượng>.');
  assert.equal(items[1].link, 'https://example.org/tech-2');
  assert.equal(items[1].publishedAt, '2026-10-17T06:00:00.000Z');
});

test('ingest: parseFeed từ chối nội dung không phải feed', () => {
  assert.throws(() => parseFeed('<html><body>trang web thường</body></html>'), { code: 'INGEST_PARSE' });
  assert.throws(() => parseFeed('   '), { code: 'INGEST_PARSE' });
  assert.throws(() => parseFeed(null), { code: 'INGEST_PARSE' });
});

test('ingest: addSource kiểm tra URL và nguồn được lưu bền', () => fixture(({ file }) => {
  const store = createIngestStore({ file, fetchImpl: fakeFetch(RSS) });
  assert.throws(() => store.addSource({ name: 'X', url: 'khong-phai-url' }), { code: 'INGEST_URL' });
  assert.throws(() => store.addSource({ name: 'X', url: 'ftp://example.com/feed' }), { code: 'INGEST_URL' });
  assert.throws(() => store.addSource({ name: 'X', url: 'https://example.com/feed', kind: 'json' }), { code: 'INGEST_URL' });
  const s = store.addSource({ name: 'Tin mẫu', url: 'https://example.com/rss', kind: 'rss', keywords: ['bão'] });
  assert.ok(s.id);
  assert.equal(s.enabled, true);
  assert.deepEqual(s.keywords, ['bão']);
  const reopened = createIngestStore({ file, fetchImpl: fakeFetch(RSS) });
  assert.equal(reopened.listSources().length, 1);
  assert.equal(reopened.listSources()[0].url, 'https://example.com/rss');
}));

test('ingest: scanSource tạo thẻ và quét lại không trùng', () => fixture(async ({ file }) => {
  const fetchImpl = fakeFetch(RSS);
  const store = createIngestStore({ file, fetchImpl });
  const s = store.addSource({ name: 'Tin mẫu', url: 'https://example.com/rss' });
  const first = await store.scanSource(s.id);
  assert.equal(first.added, 3);
  assert.equal(first.duplicates, 0);
  assert.deepEqual(store.counts(), { sources: 1, enabledSources: 1, cards: 3, unusedCards: 3 });
  const cards = store.listCards();
  assert.equal(cards.length, 3);
  assert.ok(cards.every(c => c.sourceId === s.id && c.hash && c.usedByProjectId === null && c.fetchedAt));
  const second = await store.scanSource(s.id);
  assert.equal(second.added, 0);
  assert.equal(second.duplicates, 3);
  const reopened = createIngestStore({ file, fetchImpl });
  assert.equal(reopened.counts().cards, 3);
}));

test('ingest: bộ lọc từ khóa chỉ giữ thẻ khớp', () => fixture(async ({ file }) => {
  const store = createIngestStore({ file, fetchImpl: fakeFetch(RSS) });
  const s = store.addSource({ name: 'Lọc', url: 'https://example.com/rss', keywords: ['BÃO', 'vàng'] });
  const r = await store.scanSource(s.id);
  assert.equal(r.added, 2);
  assert.equal(r.filtered, 1);
  const titles = store.listCards().map(c => c.title);
  assert.ok(titles.some(t => t.includes('Bão')));
  assert.ok(titles.some(t => t.includes('vàng')));
  assert.ok(!titles.some(t => t.includes('Đội tuyển')));
}));

test('ingest: nguồn đang tắt bị chặn quét, nguồn lạ báo INGEST_NOT_FOUND', () => fixture(async ({ file }) => {
  const store = createIngestStore({ file, fetchImpl: fakeFetch(RSS) });
  const s = store.addSource({ name: 'Tin mẫu', url: 'https://example.com/rss' });
  store.setSourceEnabled(s.id, false);
  assert.equal(store.counts().enabledSources, 0);
  await assert.rejects(() => store.scanSource(s.id), { code: 'INGEST_DISABLED' });
  await assert.rejects(() => store.scanSource('khong-ton-tai'), { code: 'INGEST_NOT_FOUND' });
  assert.throws(() => store.setSourceEnabled('khong-ton-tai', true), { code: 'INGEST_NOT_FOUND' });
  store.setSourceEnabled(s.id, true);
  const r = await store.scanSource(s.id);
  assert.equal(r.added, 3);
  assert.equal(store.removeSource(s.id), true);
  assert.equal(store.counts().sources, 0);
  assert.equal(store.counts().cards, 0);
}));

test('ingest: markCardUsed đánh dấu thẻ đã dùng cho dự án', () => fixture(async ({ file }) => {
  const store = createIngestStore({ file, fetchImpl: fakeFetch(ATOM) });
  const s = store.addSource({ name: 'Atom', url: 'https://example.org/feed', kind: 'atom' });
  await store.scanSource(s.id);
  const [card] = store.listCards();
  const marked = store.markCardUsed(card.id, 'project-123');
  assert.equal(marked.usedByProjectId, 'project-123');
  assert.equal(store.counts().unusedCards, 1);
  assert.equal(store.listCards({ unusedOnly: true }).length, 1);
  assert.ok(store.listCards({ unusedOnly: true }).every(c => c.id !== card.id));
  assert.throws(() => store.markCardUsed('khong-ton-tai', 'p'), { code: 'INGEST_NOT_FOUND' });
}));

test('ingest: lỗi tải feed thành INGEST_FETCH, HTTP lỗi cũng vậy', () => fixture(async ({ file }) => {
  const store = createIngestStore({ file, fetchImpl: async () => { throw new Error('mạng hỏng'); } });
  const s = store.addSource({ name: 'Hỏng', url: 'https://example.com/rss' });
  await assert.rejects(() => store.scanSource(s.id), { code: 'INGEST_FETCH' });
  const store2 = createIngestStore({ file: file + '.2', fetchImpl: async () => ({ ok: false, status: 503, text: async () => '' }) });
  const s2 = store2.addSource({ name: 'Hỏng 2', url: 'https://example.com/rss' });
  await assert.rejects(() => store2.scanSource(s2.id), { code: 'INGEST_FETCH' });
}));

test('ingest: tóm tắt thẻ bị cắt ở 500 ký tự và sạch thẻ HTML', () => fixture(async ({ file }) => {
  const long = `<rss version="2.0"><channel><item><title>Dài</title><link>https://example.com/dai</link><description><p>${'từ dài '.repeat(150)}</p></description></item></channel></rss>`;
  const store = createIngestStore({ file, fetchImpl: fakeFetch(long) });
  const s = store.addSource({ name: 'Dài', url: 'https://example.com/rss' });
  await store.scanSource(s.id);
  const [card] = store.listCards();
  assert.equal(card.summary.length, 500);
  assert.ok(!card.summary.includes('<'));
}));

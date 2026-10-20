// Full-text for news cards (0.9.43, Miniflux pattern): heuristic article
// extraction, failure-tolerant fetching, ingest scan enrichment and the
// on-demand card API at store level.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { extractArticleText, fetchArticleText } from '../src/lib/fulltext.mjs';
import { isolatedRuntime } from './helpers/isolated-runtime.mjs';

const ARTICLE_HTML = `<!doctype html><html><head><title>Tiêu đề tab</title><meta property="og:title" content="Giá vàng tăng mạnh sáng nay"><style>.x{}</style><script>track()</script></head>
<body><nav><p>Menu điều hướng dài dòng không phải nội dung bài viết chính đâu nhé</p></nav>
<article>
<p>Giá vàng miếng trong nước sáng nay tăng thêm 700 nghìn đồng mỗi lượng, lên mức cao nhất trong nhiều tuần trở lại đây theo ghi nhận tại các cửa hàng lớn.</p>
<p><a href="/khac">Xem thêm bài khác</a> <a href="/nua">và bài nữa</a> <a href="/them">cùng một loạt liên kết</a></p>
<p>Các chuyên gia cho rằng biến động này đến từ giá thế giới và nhu cầu tích trữ cuối năm, nhà đầu tư nên thận trọng với các nhịp tăng nóng trong ngắn hạn.</p>
<p>Giá vàng miếng trong nước sáng nay tăng thêm 700 nghìn đồng mỗi lượng, lên mức cao nhất trong nhiều tuần trở lại đây theo ghi nhận tại các cửa hàng lớn.</p>
</article><footer><p>Bản quyền thuộc về tòa soạn, ghi rõ nguồn khi phát hành lại thông tin từ trang này nhé.</p></footer></body></html>`;

test('extractArticleText keeps the article body and drops chrome/links/dupes', () => {
  const r = extractArticleText(ARTICLE_HTML);
  assert.equal(r.title, 'Giá vàng tăng mạnh sáng nay');
  assert.match(r.text, /700 nghìn đồng/);
  assert.match(r.text, /chuyên gia cho rằng/);
  assert.doesNotMatch(r.text, /Menu điều hướng/);
  assert.doesNotMatch(r.text, /Bản quyền thuộc về/);
  assert.doesNotMatch(r.text, /Xem thêm bài khác/);
  assert.equal(r.paragraphs, 2, 'duplicate paragraph and link list are removed');
});

test('fetchArticleText validates and reports reasons without throwing', async () => {
  const okFetch = async () => ({ ok: true, status: 200, headers: { get: () => 'text/html; charset=utf-8' }, text: async () => ARTICLE_HTML });
  const r = await fetchArticleText('https://news.example/bai-viet', { fetchImpl: okFetch });
  assert.equal(r.ok, true);
  assert.ok(r.chars > 200);
  assert.equal((await fetchArticleText('ftp://x/y', { fetchImpl: okFetch })).reason, 'invalid-url');
  assert.equal((await fetchArticleText('https://a.b/c', { fetchImpl: async () => ({ ok: false, status: 404, headers: { get: () => 'text/html' }, text: async () => '' }) })).reason, 'http-404');
  assert.equal((await fetchArticleText('https://a.b/c', { fetchImpl: async () => ({ ok: true, status: 200, headers: { get: () => 'application/pdf' }, text: async () => '' }) })).reason, 'not-html');
  assert.equal((await fetchArticleText('https://a.b/c', { fetchImpl: async () => ({ ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => '<html><body><p>ngắn</p></body></html>' }) })).reason, 'too-short');
});

test('ingest scan enriches short-summary cards with full text (capped, opt-out honored)', async () => {
  const f = isolatedRuntime('fulltext');
  try {
    const ingest = await f.import('src/lib/ingest.mjs');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipos-ft-'));
    const feed = `<?xml version="1.0"?><rss><channel><title>Tin</title>
      <item><title>Giá vàng tăng mạnh</title><link>https://news.example/bai-1</link><description>Ngắn.</description></item>
      <item><title>Tin thứ hai</title><link>https://news.example/bai-2</link><description>Cũng ngắn.</description></item>
    </channel></rss>`;
    const fetcher = async (url) => {
      if (String(url).includes('feed')) return { ok: true, status: 200, text: async () => feed };
      return { ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => ARTICLE_HTML };
    };
    const store = ingest.createIngestStore({ file: path.join(dir, 'ingest.json'), fetchImpl: fetcher });
    const s1 = store.addSource({ name: 'Tin A', url: 'https://news.example/feed' });
    const r1 = await store.scanSource(s1.id);
    assert.equal(r1.added, 2);
    assert.equal(r1.fullTextFetched, 2);
    const cards = store.listCards();
    assert.ok(cards.every(c => c.fullText && c.fullText.length > 200 && c.fullTextAt));
    const s2 = store.addSource({ name: 'Tin B', url: 'https://news.example/feed2', fullText: false });
    const feedFetch2 = async (url) => String(url).includes('feed2') ? { ok: true, status: 200, text: async () => feed.replaceAll('bai-1', 'bai-3').replaceAll('bai-2', 'bai-4') } : fetcher(url);
    const store2 = ingest.createIngestStore({ file: path.join(dir, 'ingest.json'), fetchImpl: feedFetch2 });
    const r2 = await store2.scanSource(s2.id);
    assert.equal(r2.fullTextFetched, 0);
    const manual = store2.setCardFullText(cards[0].id, { text: 'Nội dung lấy tay '.repeat(30), title: 'T' });
    assert.ok(manual.fullText.length > 100);
    assert.equal(store2.getCard(cards[0].id).fullText, manual.fullText);
    fs.rmSync(dir, { recursive: true, force: true });
  } finally { f.cleanup(); }
});

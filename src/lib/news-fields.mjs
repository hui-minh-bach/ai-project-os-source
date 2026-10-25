/** Đội tin theo lĩnh vực (0.9.22).
 *
 * Mỗi lĩnh vực là một "phòng ban tin": có từ khóa nhận diện riêng, một truy
 * vấn tin tức mặc định (nạp qua Google News RSS — vẫn là RSS/Atom nên dùng
 * chung bộ quét sẵn có) và được chấm điểm độ đáng làm video bằng công thức
 * xác định (từ khóa + độ mới), KHÔNG phải AI tự quyết. AI (model Worker)
 * chỉ viết lại lời dẫn ở bước sau; việc chọn tin nào thuộc lĩnh vực nào và
 * tin nào điểm cao là do mã xác định ở đây đảm nhiệm và ghi rõ cơ sở. */

export const NEWS_FIELDS = [
  { id: 'thoi-su', label: 'Thời sự', query: 'thời sự Việt Nam hôm nay', keywords: ['chính phủ', 'quốc hội', 'thủ tướng', 'bộ trưởng', 'nghị quyết', 'thời sự', 'xã hội', 'an ninh', 'quốc phòng'] },
  { id: 'kinh-doanh', label: 'Kinh doanh – Tài chính', query: 'kinh tế tài chính chứng khoán Việt Nam', keywords: ['chứng khoán', 'vn-index', 'tài chính', 'ngân hàng', 'lãi suất', 'doanh nghiệp', 'xuất khẩu', 'đầu tư', 'vàng', 'usd', 'kinh tế'] },
  { id: 'cong-nghe', label: 'Công nghệ', query: 'công nghệ AI trí tuệ nhân tạo', keywords: ['công nghệ', 'trí tuệ nhân tạo', ' ai ', 'iphone', 'samsung', 'ứng dụng', 'phần mềm', 'internet', 'chip', 'robot', 'điện thoại'] },
  { id: 'the-thao', label: 'Thể thao', query: 'bóng đá thể thao Việt Nam', keywords: ['bóng đá', 'ngoại hạng', 'world cup', 'sea games', 'cầu thủ', 'huấn luyện viên', 'thể thao', 'v-league', 'đội tuyển'] },
  { id: 'giai-tri', label: 'Giải trí', query: 'giải trí showbiz Việt Nam', keywords: ['ca sĩ', 'diễn viên', 'phim', 'showbiz', 'hoa hậu', 'âm nhạc', 'giải trí', 'mv', 'gameshow', 'ngôi sao'] },
  { id: 'suc-khoe', label: 'Sức khỏe', query: 'sức khỏe y tế dinh dưỡng', keywords: ['sức khỏe', 'bệnh', 'y tế', 'bác sĩ', 'dinh dưỡng', 'vaccine', 'ung thư', 'tập luyện', 'giảm cân', 'sống khỏe'] },
  { id: 'am-thuc', label: 'Ẩm thực', query: 'ẩm thực món ngon Việt Nam', keywords: ['ẩm thực', 'món ngon', 'nấu ăn', 'công thức', 'quán ăn', 'nhà hàng', 'đặc sản', 'bếp', 'món ăn'] },
  { id: 'du-lich', label: 'Du lịch', query: 'du lịch Việt Nam điểm đến', keywords: ['du lịch', 'điểm đến', 'khách sạn', 'resort', 'vé máy bay', 'homestay', 'phượt', 'check-in', 'kỳ nghỉ'] },
  { id: 'xe-co', label: 'Xe cộ', query: 'ô tô xe máy thị trường xe', keywords: ['ô tô', 'xe máy', 'xe điện', 'vinfast', 'toyota', 'honda', 'thị trường xe', 'giá xe', 'lái xe'] },
  { id: 'giao-duc', label: 'Giáo dục', query: 'giáo dục tuyển sinh Việt Nam', keywords: ['giáo dục', 'tuyển sinh', 'học sinh', 'sinh viên', 'thi tốt nghiệp', 'trường học', 'học bổng', 'đại học', 'giáo viên'] },
  { id: 'phap-luat', label: 'Pháp luật', query: 'văn bản pháp luật mới Việt Nam (site:chinhphu.vn OR site:baochinhphu.vn OR site:vbpl.vn OR site:moj.gov.vn)', keywords: ['nghị định', 'thông tư', 'pháp luật', 'văn bản quy phạm', 'bộ luật', 'nghị quyết', 'xử phạt', 'quy định mới', 'luật mới'], officialDomains: ['chinhphu.vn', 'baochinhphu.vn', 'vbpl.vn', 'moj.gov.vn', 'quochoi.vn', 'toaan.gov.vn', 'vienkiemsat.gov.vn'] },
  { id: 'khoa-hoc', label: 'Khoa học', query: 'khoa học khám phá nghiên cứu mới', keywords: ['khoa học', 'nghiên cứu', 'vũ trụ', 'khám phá', 'nhà khoa học', 'phát minh', 'thiên văn', 'vật lý', 'sinh học'] },
  { id: 'moi-truong', label: 'Môi trường', query: 'môi trường biến đổi khí hậu Việt Nam', keywords: ['môi trường', 'khí hậu', 'ô nhiễm', 'rác thải', 'năng lượng tái tạo', 'phát thải', 'bảo vệ môi trường'] },
  { id: 'nong-nghiep', label: 'Nông nghiệp', query: 'nông nghiệp nông thôn Việt Nam', keywords: ['nông nghiệp', 'nông dân', 'lúa gạo', 'cà phê', 'nông sản', 'thủy sản', 'chăn nuôi', 'trồng trọt'] },
  { id: 'giao-thong', label: 'Giao thông', query: 'giao thông hạ tầng Việt Nam hôm nay', keywords: ['giao thông', 'tai nạn giao thông', 'cao tốc', 'sân bay', 'đường sắt', 'ùn tắc', 'metro', 'hạ tầng'] },
  { id: 'viec-lam', label: 'Việc làm – Lao động', query: 'việc làm lao động tuyển dụng Việt Nam', keywords: ['việc làm', 'tuyển dụng', 'lao động', 'tiền lương', 'bảo hiểm xã hội', 'thất nghiệp', 'nghề nghiệp'] },
  { id: 'quoc-te', label: 'Quốc tế', query: 'thế giới quốc tế hôm nay', keywords: ['thế giới', 'quốc tế', 'liên hợp quốc', 'asean', 'toàn cầu', 'nước ngoài'] },
  { id: 'van-hoa', label: 'Văn hóa – Xã hội', query: 'văn hóa xã hội Việt Nam', keywords: ['văn hóa', 'di sản', 'lễ hội', 'xã hội', 'cộng đồng', 'phong tục', 'bảo tàng', 'nghệ thuật'] },
  { id: 'bat-dong-san', label: 'Bất động sản', query: 'bất động sản nhà đất Việt Nam', keywords: ['bất động sản', 'nhà đất', 'chung cư', 'dự án bất động sản', 'thị trường nhà', 'đất nền', 'căn hộ'] },
  { id: 'thoi-tiet', label: 'Thời tiết', query: 'dự báo thời tiết Việt Nam hôm nay', keywords: ['thời tiết', 'dự báo thời tiết', 'bão', 'mưa lớn', 'nắng nóng', 'áp thấp nhiệt đới', 'không khí lạnh'] },
];

const FIELD_BY_ID = new Map(NEWS_FIELDS.map(f => [f.id, f]));
export function newsFieldById(id) { return FIELD_BY_ID.get(String(id || '')) || null; }
export function listNewsFields() { return NEWS_FIELDS.map(f => ({ id: f.id, label: f.label, query: f.query, keywords: [...f.keywords], ...(f.officialDomains ? { officialDomains: [...f.officialDomains] } : {}) })); }

const slugify = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^a-zA-Z0-9 ]/g, '').trim().split(/\s+/).map(w => w ? w[0].toUpperCase() + w.slice(1) : '').join('');

/** Hashtag xác định từ lĩnh vực + từ khóa đầu — dùng cho caption khi đăng. */
export function hashtagsForField(fieldId, suppliedField = null) {
  const f = suppliedField || newsFieldById(fieldId); if (!f) return ['#TinTuc'];
  const tags = ['#' + slugify(f.label)];
  for (const k of f.keywords.slice(0, 4)) { const t = '#' + slugify(k); if (t.length > 2 && !tags.includes(t)) tags.push(t); }
  return tags.slice(0, 4);
}

/** Trích số hiệu văn bản pháp luật (Nghị định 100/2019/NĐ-CP…) từ tiêu đề/tóm tắt — chỉ để hiển thị nguồn. */
export function lawDocRef(text) {
  const m = String(text || '').match(/(Nghị định|Thông tư|Luật|Nghị quyết|Quyết định|Chỉ thị)\s+(?:số\s+)?(\d+\/[\w.\-]+)/i);
  return m ? `${m[1]} ${m[2]}` : null;
}

/** Domain của một link tin có thuộc nguồn chính thống đã khai báo của lĩnh vực không. */
export function isOfficialSource(fieldId, link, publisher) {
  const f = newsFieldById(fieldId); if (!f?.officialDomains) return false;
  const hosts = [];
  try { hosts.push(new URL(String(link || '')).hostname.toLowerCase()); } catch { /* no link host */ }
  if (publisher) { hosts.push(String(publisher).toLowerCase().replace(/^www\./, '')); if (['bộ tư pháp', 'cổng pháp luật', 'cơ sở dữ liệu quốc gia', 'csdl quốc gia', 'chính phủ', 'quốc hội', 'tòa án', 'viện kiểm sát', 'công báo'].some(hint => String(publisher).toLowerCase().includes(hint))) return true; }
  return hosts.some(h => f.officialDomains.some(d => h === d || h.endsWith('.' + d)));
}

/** Nguồn tin theo chủ đề qua Google News RSS (hl=vi, gl=VN): vẫn là một
 * feed RSS 2.0 nên bộ quét ingest không cần thay đổi giao thức. */
export function googleNewsRssUrl(query) {
  const q = encodeURIComponent(String(query || '').trim() || 'tin tức');
  return `https://news.google.com/rss/search?q=${q}&hl=vi&gl=VN&ceid=VN:vi`;
}

const norm = (s) => (' ' + String(s || '').toLowerCase() + ' ');

/** Phân loại một tin vào lĩnh vực có nhiều từ khóa khớp nhất (tiêu đề tính
 * gấp đôi). Trả null khi không lĩnh vực nào khớp — tin đó thuộc nhóm
 * "chưa phân loại" chứ không bị gán bừa. */
export function classifyNewsField({ title, summary } = {}, fields = NEWS_FIELDS) {
  const t = norm(title), s = norm(summary);
  let best = null;
  for (const f of fields) {
    let hits = 0;
    for (const kw of f.keywords) {
      const k = kw.trim().toLowerCase();
      if (!k) continue;
      if (t.includes(k)) hits += 2;
      else if (s.includes(k)) hits += 1;
    }
    if (hits > 0 && (!best || hits > best.hits)) best = { fieldId: f.id, hits };
  }
  return best ? best.fieldId : null;
}

/** Điểm độ đáng làm video 0–100, hoàn toàn xác định:
 * từ khóa (tối đa 54) + độ mới theo giờ đăng (tối đa 30) + có tóm tắt (8)
 * + độ dài tiêu đề hợp lý (8). Cơ sở chấm luôn là 'keyword-freshness'. */
export function scoreNewsItem({ title, summary, publishedAt } = {}, { fieldId, field: suppliedField = null, now = new Date() } = {}) {
  const field = suppliedField || (fieldId ? FIELD_BY_ID.get(fieldId) : null);
  const keywords = field ? field.keywords : [];
  const t = norm(title), s = norm(summary);
  let keywordPoints = 0;
  for (const kw of keywords) {
    const k = kw.trim().toLowerCase();
    if (!k) continue;
    if (t.includes(k)) keywordPoints += 12;
    else if (s.includes(k)) keywordPoints += 6;
  }
  keywordPoints = Math.min(54, keywordPoints);
  let freshPoints = 0;
  const published = publishedAt ? Date.parse(publishedAt) : NaN;
  if (Number.isFinite(published)) {
    const ageHours = Math.max(0, (now.getTime() - published) / 3600000);
    freshPoints = ageHours <= 2 ? 30 : ageHours <= 6 ? 24 : ageHours <= 12 ? 18 : ageHours <= 24 ? 12 : ageHours <= 48 ? 6 : 0;
  }
  const summaryPoints = String(summary || '').trim().length >= 40 ? 8 : 0;
  const titleLen = String(title || '').trim().length;
  const titlePoints = titleLen >= 25 && titleLen <= 160 ? 8 : 0;
  return { score: keywordPoints + freshPoints + summaryPoints + titlePoints, basis: 'keyword-freshness' };
}

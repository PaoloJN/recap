export const VIDEO_TYPES = [
  "tutorial",
  "course-lecture",
  "strategy-talk",
  "product-demo",
  "interview-debate",
  "news-analysis",
  "other",
] as const

export type VideoType = (typeof VIDEO_TYPES)[number]

export const VIDEO_TYPE_LABELS: Record<VideoType, string> = {
  tutorial: "Hướng dẫn kỹ thuật",
  "course-lecture": "Bài giảng",
  "strategy-talk": "Chiến lược",
  "product-demo": "Demo sản phẩm",
  "interview-debate": "Phỏng vấn / tranh luận",
  "news-analysis": "Phân tích tin",
  other: "Khác",
}

/**
 * Briefs shipped before the longer presets. A stored copy of one of these was never
 * edited, so it is dropped and the current preset is used instead.
 */
export const LEGACY_VIDEO_TYPE_PRESETS: Record<VideoType, string> = {
  tutorial: "các bước, code/lệnh chính, lỗi hay gặp, áp dụng vào stack Python backend.",
  "course-lecture": "khái niệm cốt lõi, khung tư duy, ví dụ, điều cần nhớ để dùng thật.",
  "strategy-talk": "luận điểm, dự đoán, ai hưởng lợi, hàm ý cho lộ trình AI công ty.",
  "product-demo": "tính năng mới thật sự, so với đối thủ, đâu là marketing.",
  "interview-debate": "mỗi bên nói gì, đồng ý/bất đồng, ai có bằng chứng tốt hơn.",
  "news-analysis": "chuyện gì xảy ra, vì sao quan trọng, theo dõi gì tiếp.",
  other: "tự chọn cách khai thác hợp lý và nói vì sao.",
}

/** Short cue for the diagram only. The long preset is a written brief, not a mermaid spec. */
export const VIDEO_TYPE_DIAGRAM_EMPHASIS: Record<VideoType, string> = {
  ...LEGACY_VIDEO_TYPE_PRESETS,
}

/** Built-in focus for each type. Custom instructions still apply on top of these. */
export const VIDEO_TYPE_PRESETS: Record<VideoType, string> = {
  tutorial: [
    "Lấy các bước làm được ngay, lệnh hoặc code chính, điều kiện tiên quyết, và chỗ hay gãy. Bỏ lời chào, nhà tài trợ, và đoạn ôn lại.",
    "",
    "## Việc cần làm",
    "Các bước đúng thứ tự video dạy. Với mỗi bước: lệnh, cờ, file, hoặc đoạn code ngắn. Giữ nguyên tên thư viện và API, không dịch.",
    "",
    "## Chỗ dễ sai",
    "Lỗi tác giả gặp hoặc cảnh báo. Giả định ngầm về phiên bản, hệ điều hành, quyền, dữ liệu mẫu. Dấu hiệu cho thấy bước đang chạy sai.",
    "",
    "## Áp vào backend Python",
    "Map sang API, worker, DB, queue, cache. Nói phần copy được và phần phải viết lại cho một service Python đang chạy.",
    "",
    "## Sẵn sàng production",
    'Bảo mật, scale, chi phí, log/metric, rollback. Video không nói thì ghi đúng "không đề cập", đừng bịa.',
    "",
    "## Kiểm cách nghĩ",
    "Bước nào đã được chạy trên máy, bước nào chỉ là khẳng định. Thiếu gì so với hệ thống thật: auth, migration, idempotency, giới hạn tải.",
    "",
    "## Làm tiếp",
    "1–3 việc thử trên một service Python trong tuần này, kèm một tiêu chí dừng nếu thử xong mà không đáng giữ.",
  ].join("\n"),
  "course-lecture": [
    "Lấy khái niệm cốt lõi, mô hình tư duy, ví dụ, và điều dễ hiểu sai. Không chép lại cả bài giảng.",
    "",
    "## Khái niệm",
    "3–6 ý chính. Mỗi ý một câu cộng một ví dụ lấy từ bài. Giữ thuật ngữ gốc khi đó là tên kỹ thuật.",
    "",
    "## Mô hình tư duy",
    "Khung tác giả dùng để giải thích. Khung này giúp chọn gì, và nó gãy khi nào.",
    "",
    "## Hiểu sai",
    "Ngộ nhận phổ biến. Câu trong bài bác lại ngộ nhận đó, hoặc ghi nếu bài bỏ ngỏ.",
    "",
    "## Tự kiểm",
    "3 câu hỏi ngắn để biết đã hiểu, không phải câu hỏi ôn thuộc lòng.",
    "",
    "## Khi đem ra quyết định",
    "Chi phí, rủi ro, hoặc hệ quả nếu đội kỹ thuật áp dụng sai. Bài không đụng tới thì nói thẳng, đừng gán.",
    "",
    "## Làm tiếp",
    "Một cách dùng khung này khi xem xét một thay đổi backend trong tuần.",
  ].join("\n"),
  "strategy-talk": [
    "Lấy luận điểm, dự đoán có mốc thời gian, ai hưởng lợi, và hàm ý cho lộ trình AI của một công ty. Bỏ khẩu hiệu.",
    "",
    "## Luận điểm",
    "Một câu cho thesis. Các luận điểm phụ, đúng thứ tự tác giả trình bày.",
    "",
    "## Dự đoán",
    'Mỗi dự đoán kèm mốc thời gian nếu có. Không có mốc thì ghi "không nêu thời điểm".',
    "",
    "## Ai hưởng lợi",
    "Người, vai, hoặc loại công ty được lợi và bị thiệt, kể cả khi tác giả không nói thẳng.",
    "",
    "## Giả định và bằng chứng",
    "Giả định ngầm. Đâu là số liệu hoặc case, đâu là ý kiến. Chỗ yếu, bị bỏ qua, hoặc thiên về người nói.",
    "",
    "## Lộ trình AI",
    "Hàm ý cho build vs buy, chi phí, rủi ro, ROI, và cách đội tiếp nhận. Đánh dấu điều nào là suy ra, không phải lời tác giả.",
    "",
    "## Làm tiếp",
    "Một quyết định nên xem lại, và một tín hiệu để theo dõi trong 90 ngày.",
  ].join("\n"),
  "product-demo": [
    "Tách việc sản phẩm làm được thật với phần marketing. So với cách đang làm và với lựa chọn khác.",
    "",
    "## Mới thật sự",
    "Tính năng hoặc cách làm mới, chỉ tính phần được chứng minh trên demo, không phải câu trên slide.",
    "",
    "## Marketing",
    "Câu hứa không được chứng minh, hoặc chỉ đúng trong điều kiện demo đã dàn sẵn.",
    "",
    "## So sánh",
    "Khác gì so với tự xây trên Python, và so với lựa chọn thay thế nếu bài có nhắc.",
    "",
    "## Giới hạn chưa hiện",
    "Những gì demo không cho xem: lỗi, quy mô, bảo mật, vận hành, dữ liệu bẩn.",
    "",
    "## Giá và khóa chân",
    'Giá, hạn mức, phụ thuộc nhà cung cấp, chi phí thoát. Không nói thì ghi "không đề cập".',
    "",
    "## Có nên pilot",
    "Có, không, hoặc chỉ một phần. Điều kiện pilot, rủi ro, chi phí, và tiêu chí dừng sau 2–4 tuần.",
  ].join("\n"),
  "interview-debate": [
    "Tách lời từng người. Đừng hòa thành một ý trung dung.",
    "",
    "## Ai nói gì",
    "Mỗi bên: vai, claim chính, và đề xuất nếu có.",
    "",
    "## Chỗ gặp nhau",
    "Điểm cả hai chấp nhận, kể cả khi chấp nhận miễn cưỡng.",
    "",
    "## Chỗ lệch",
    'Bất đồng cụ thể. Không viết "họ khác quan điểm" mà không nói khác ở đâu.',
    "",
    "## Bằng chứng",
    "Ai đưa số, case, hoặc việc đã làm. Ai chủ yếu đưa ý kiến. Động cơ thấy được từ lời nói: bán hàng, gây quỹ, bảo vệ vị thế. Ghi câu nào bị né.",
    "",
    "## Quyết định",
    "Nếu phải chọn một hướng cho đội backend hoặc chiến lược AI: chọn theo bên nào, vì sao, và phần còn chưa ngã ngũ. Nêu chi phí, rủi ro, và điều kiện để đổi hướng.",
  ].join("\n"),
  "news-analysis": [
    "Nói chuyện đã xảy ra, vì sao đáng chú ý, và hệ quả bậc hai. Không kể lại nguyên tin.",
    "",
    "## Chuyện gì xảy ra",
    "Sự kiện, thời điểm, bên liên quan. Tách fact khỏi diễn giải của người nói.",
    "",
    "## Vì sao đáng chú ý",
    "Ảnh hưởng tới chi phí, rủi ro, sản phẩm, hoặc cách một đội kỹ thuật làm việc.",
    "",
    "## Hệ quả bậc hai",
    "Điều có thể xảy ra tiếp nếu sự kiện này đứng vững. Ghi rõ đó là suy đoán.",
    "",
    "## Độ chắc",
    "Nguồn nào trong video. Chỗ nào là suy diễn. Chỗ nào bỏ qua phía bên kia hoặc động cơ của người phân tích.",
    "",
    "## Theo dõi",
    "2–3 tín hiệu cụ thể, kèm nơi nhìn (số liệu, quyết định của đội, giá, hoặc luật). Thêm một việc không nên làm vội.",
  ].join("\n"),
  other: [
    "Chọn một cách khai thác đúng với video này và nói vì sao chọn cách đó ngay trong câu đầu.",
    "",
    "## Ý chính",
    "3–6 ý đáng giữ. Bỏ phần xã giao và đoạn nhắc lại.",
    "",
    "## Cách nghĩ của tác giả",
    "Luận điểm, giả định, chỗ là bằng chứng và chỗ là ý kiến. Thiên kiến hoặc điều bị bỏ qua nếu thấy từ lời nói.",
    "",
    "## Có đáng quyết không",
    "Việc này có đụng chi phí, rủi ro, đội ngũ, build vs buy, hoặc ROI không. Nếu không, nói thẳng là không. Đừng gán ý nghĩa quản trị cho một video không có.",
    "",
    "## Làm tiếp",
    "Một việc cụ thể trong tuần, hoặc một lý do rõ để không làm gì thêm. Nếu có việc, nói xong thì biết kết quả cụ thể bằng cách nào.",
  ].join("\n"),
}

export const MAX_VIDEO_TYPE_PROMPT = 4000

export function isVideoType(value: unknown): value is VideoType {
  return VIDEO_TYPES.includes(value as VideoType)
}

export function resolveVideoTypePrompt(
  type: VideoType,
  overrides: Partial<Record<VideoType, string>> | undefined,
): string {
  const custom = overrides?.[type]?.trim()
  return custom ? custom : VIDEO_TYPE_PRESETS[type]
}

export function videoTypeFocus(prompt: string | undefined): string {
  const text = prompt?.trim()
  if (!text) return ""
  return `Focus for this video type:\n${text}`
}

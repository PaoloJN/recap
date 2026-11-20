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

/** Built-in focus for each type. Custom instructions still apply on top of these. */
export const VIDEO_TYPE_PRESETS: Record<VideoType, string> = {
  tutorial: "các bước, code/lệnh chính, lỗi hay gặp, áp dụng vào stack Python backend.",
  "course-lecture": "khái niệm cốt lõi, khung tư duy, ví dụ, điều cần nhớ để dùng thật.",
  "strategy-talk": "luận điểm, dự đoán, ai hưởng lợi, hàm ý cho lộ trình AI công ty.",
  "product-demo": "tính năng mới thật sự, so với đối thủ, đâu là marketing.",
  "interview-debate": "mỗi bên nói gì, đồng ý/bất đồng, ai có bằng chứng tốt hơn.",
  "news-analysis": "chuyện gì xảy ra, vì sao quan trọng, theo dõi gì tiếp.",
  other: "tự chọn cách khai thác hợp lý và nói vì sao.",
}

export const MAX_VIDEO_TYPE_PROMPT = 500

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

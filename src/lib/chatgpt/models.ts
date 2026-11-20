export interface ChatGptModel {
  id: string
  label: string
}

/** `GET /v1/models` for a subscription token: `{ models: [{ slug, display_name, visibility }] }`. */
export function parseChatGptModels(body: unknown): ChatGptModel[] {
  const list = (body as { models?: unknown } | null)?.models
  if (!Array.isArray(list)) return []
  const models: ChatGptModel[] = []
  for (const item of list) {
    if (!item || typeof item !== "object") continue
    const row = item as { slug?: unknown; display_name?: unknown; visibility?: unknown }
    if (row.visibility !== "list" || typeof row.slug !== "string" || row.slug.trim() === "") {
      continue
    }
    const id = row.slug.trim()
    const label =
      typeof row.display_name === "string" && row.display_name.trim() ? row.display_name.trim() : id
    models.push({ id, label })
  }
  return models
}

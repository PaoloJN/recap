import type { UIMessage } from "ai"
import { describe, expect, it } from "vitest"
import { exportAllChats, exportVideoMarkdown, slugify } from "./export"
import type { ChatStore } from "./storage"

const meta = { videoId: "abc", title: "My Video", author: "Chan", durationSeconds: 60 }
const msgs: UIMessage[] = [
  {
    id: "1",
    role: "user",
    parts: [{ type: "text", text: "Why?" }],
    metadata: { quote: { seconds: 14, text: "Static" } },
  },
  { id: "2", role: "assistant", parts: [{ type: "text", text: "Because." }] },
]

describe("exportVideoMarkdown", () => {
  it("includes title, url, summary and chat", () => {
    expect(exportVideoMarkdown(meta, "Sum", msgs)).toBe(
      [
        "# My Video",
        "https://www.youtube.com/watch?v=abc\nChannel: Chan",
        "## Summary\n\nSum",
        "## Chat\n\n> [0:14] Static\n**You:** Why?\n\n**YouTube AI:** Because.",
      ].join("\n\n"),
    )
  })
  it("omits empty sections", () => {
    const out = exportVideoMarkdown(meta, undefined, [])
    expect(out).not.toContain("## Summary")
    expect(out).not.toContain("## Chat")
    expect(exportVideoMarkdown(meta, "", undefined)).not.toContain("## Summary")
  })
})

describe("exportAllChats", () => {
  it("lists videos newest first with title fallback", () => {
    const store: ChatStore = {
      old: { updatedAt: 1, messages: msgs },
      new: { updatedAt: 2, title: "Newer", messages: msgs },
    }
    const out = exportAllChats(store)
    expect(out.startsWith("# YouTube AI chats")).toBe(true)
    expect(out.indexOf("## Newer")).toBeLessThan(out.indexOf("## old"))
    expect(out).toContain("https://www.youtube.com/watch?v=old")
  })
})

describe("slugify", () => {
  it("slugifies titles", () => {
    expect(slugify("Next.js Conf 25: Opening Keynote")).toBe("next-js-conf-25-opening-keynote")
  })
  it("falls back to video and caps length", () => {
    expect(slugify("???")).toBe("video")
    expect(slugify("a".repeat(100))).toHaveLength(60)
  })
})

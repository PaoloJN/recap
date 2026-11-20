import { describe, expect, it } from "vitest"
import { NO_CAPTIONS_MESSAGE } from "@/lib/source/types"
import { unavailableTranscript } from "./useVideo"

describe("unavailableTranscript", () => {
  it("keeps YouTube's empty state and names the caption hint everywhere else", () => {
    expect(unavailableTranscript("youtube")).toEqual({ state: "unavailable" })
    expect(unavailableTranscript("udemy")).toEqual({
      state: "unavailable",
      message: NO_CAPTIONS_MESSAGE,
    })
    expect(NO_CAPTIONS_MESSAGE).toBe("Trang này không có phụ đề, bật CC rồi thử lại")
  })
})

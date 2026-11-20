import { describe, expect, it } from "vitest"
import { parseVtt, stripCueText } from "./vtt"

const sample = `WEBVTT

NOTE
This note is not a cue.

STYLE
::cue { color: white; }

1
00:00:01.000 --> 00:00:04.000 align:start
Hello
<v Speaker>world</v>

00:01.500 --> 00:03.2
<c.highlight>No hours</c>
and a second line

01:02:03.004 --> 01:02:05.500
Keep &amp; this
`

describe("parseVtt", () => {
  it("reads cues, multiline text, timestamps without hours, and styling tags", () => {
    expect(parseVtt(sample)).toEqual([
      { start: 1, end: 4, text: "Hello\nworld" },
      { start: 1.5, end: 3.2, text: "No hours\nand a second line" },
      { start: 3723.004, end: 3725.5, text: "Keep & this" },
    ])
  })

  it("strips tags and entities", () => {
    expect(stripCueText("<c>A</c> &lt;tag&gt;&nbsp;")).toBe("A <tag>")
  })

  it("returns nothing for an empty document", () => {
    expect(parseVtt("WEBVTT\n\n")).toEqual([])
  })
})

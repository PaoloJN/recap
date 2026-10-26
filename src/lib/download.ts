export function downloadText(filename: string, text: string, doc: Document = document): void {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }))
  const a = doc.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

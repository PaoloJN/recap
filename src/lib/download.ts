export function downloadBlob(filename: string, blob: Blob, doc: Document = document): void {
  const url = URL.createObjectURL(blob)
  const a = doc.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  // Revoking synchronously can cancel the download before the browser has read the blob.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function downloadText(filename: string, text: string, doc: Document = document): void {
  downloadBlob(filename, new Blob([text], { type: "text/markdown;charset=utf-8" }), doc)
}

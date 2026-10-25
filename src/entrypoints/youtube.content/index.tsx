import "@/assets/tailwind.css"

export default defineContentScript({
  matches: ["*://www.youtube.com/*"],
  cssInjectionMode: "ui",
  main() {},
})

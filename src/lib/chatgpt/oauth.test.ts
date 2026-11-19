import { describe, expect, it } from "vitest"
import {
  CHATGPT_AGENT_NAME,
  CHATGPT_DYNAMIC_CLIENT_ID,
  CHATGPT_REDIRECT_URI,
  CHATGPT_RESOURCE,
  CHATGPT_SCOPE,
} from "./constants"
import { buildAuthorizeUrl, parseAuthCallback } from "./oauth"

const HOST = "urn:uuid:11111111-1111-4111-8111-111111111111"

describe("parseAuthCallback", () => {
  const state = "state-1"
  const okUrl =
    "http://127.0.0.1:1455/auth/callback?code=abc&state=state-1&client_id=oaiapp_user&scope=openid"

  it("reads the code and the issued client id when state matches", () => {
    expect(parseAuthCallback(okUrl, state)).toEqual({
      ok: true,
      code: "abc",
      clientId: "oaiapp_user",
    })
  })

  it("rejects a state mismatch", () => {
    const result = parseAuthCallback(okUrl, "other")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain("state")
  })

  it("uses the saved client id when a re-auth callback omits client_id", () => {
    const url = "http://127.0.0.1:1455/auth/callback?code=abc&state=state-1"
    expect(parseAuthCallback(url, state, "oaiapp_saved")).toEqual({
      ok: true,
      code: "abc",
      clientId: "oaiapp_saved",
    })
    expect(
      parseAuthCallback(`${url}&client_id=dynamic_agent_client`, state, "oaiapp_saved"),
    ).toEqual({
      ok: true,
      code: "abc",
      clientId: "oaiapp_saved",
    })
  })

  it("still fails a first sign-in when the callback has no client id", () => {
    const url = "http://127.0.0.1:1455/auth/callback?code=abc&state=state-1"
    const result = parseAuthCallback(url, state)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain("client id")
  })

  it("rejects the dynamic client id and a missing code", () => {
    expect(
      parseAuthCallback(
        "http://127.0.0.1:1455/auth/callback?code=abc&state=state-1&client_id=dynamic_agent_client",
        state,
      ).ok,
    ).toBe(false)
    expect(
      parseAuthCallback(
        "http://127.0.0.1:1455/auth/callback?state=state-1&client_id=oaiapp_user",
        state,
      ).ok,
    ).toBe(false)
  })

  it("rejects localhost, the wrong port, and provider errors", () => {
    expect(parseAuthCallback(okUrl.replace("127.0.0.1", "localhost"), state).ok).toBe(false)
    expect(parseAuthCallback(okUrl.replace("1455", "1456"), state).ok).toBe(false)
    expect(parseAuthCallback(okUrl.replace("/auth/callback", "/callback"), state).ok).toBe(false)
    const denied = parseAuthCallback(
      "http://127.0.0.1:1455/auth/callback?error=access_denied&state=state-1",
      state,
    )
    expect(denied.ok).toBe(false)
  })
})

describe("buildAuthorizeUrl", () => {
  it("uses the dynamic client and Recap hint on the first sign-in", () => {
    const url = new URL(
      buildAuthorizeUrl({
        hostId: HOST,
        state: "s",
        nonce: "n",
        codeChallenge: "challenge",
      }),
    )
    expect(url.origin + url.pathname).toBe("https://auth.openai.com/api/accounts/authorize")
    expect(url.searchParams.get("client_id")).toBe(CHATGPT_DYNAMIC_CLIENT_ID)
    expect(url.searchParams.get("agent_name_hint")).toBe(CHATGPT_AGENT_NAME)
    expect(url.searchParams.get("ext_agent_host_id")).toBe(HOST)
    expect(url.searchParams.get("redirect_uri")).toBe(CHATGPT_REDIRECT_URI)
    expect(url.searchParams.get("resource")).toBe(CHATGPT_RESOURCE)
    expect(url.searchParams.get("scope")).toBe(CHATGPT_SCOPE)
    expect(url.searchParams.get("code_challenge_method")).toBe("S256")
    expect(url.searchParams.get("response_type")).toBe("code")
    expect(url.searchParams.get("id_token_hint")).toBeNull()
  })

  it("reuses the issued client id and omits the agent hint", () => {
    const url = new URL(
      buildAuthorizeUrl({
        issuedClientId: "oaiapp_user",
        idToken: "header.payload.sig",
        loginHint: "a@b.c",
        hostId: HOST,
        state: "s",
        nonce: "n",
        codeChallenge: "challenge",
      }),
    )
    expect(url.searchParams.get("client_id")).toBe("oaiapp_user")
    expect(url.searchParams.get("agent_name_hint")).toBeNull()
    expect(url.searchParams.get("id_token_hint")).toBe("header.payload.sig")
    expect(url.searchParams.get("login_hint")).toBe("a@b.c")
  })
})

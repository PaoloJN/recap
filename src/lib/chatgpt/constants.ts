/** Sign in with ChatGPT (token sharing for open-source apps). Flow A. */
export const CHATGPT_AUTHORIZE_URL = "https://auth.openai.com/api/accounts/authorize"
export const CHATGPT_TOKEN_URL = "https://auth.openai.com/api/accounts/oauth/token"
export const CHATGPT_RESPONSES_URL = "https://api.openai.com/v1/responses"
export const CHATGPT_MODELS_URL = "https://api.openai.com/v1/models"
export const CHATGPT_RESOURCE = "https://api.openai.com/v1"
export const CHATGPT_REDIRECT_URI = "http://127.0.0.1:1455/auth/callback"
export const CHATGPT_SCOPE =
  "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct"
export const CHATGPT_DIRECT_SCOPE = "chatgpt.tokens.use.direct"
export const CHATGPT_DYNAMIC_CLIENT_ID = "dynamic_agent_client"
export const CHATGPT_AGENT_NAME = "Recap"
/** Refresh this long before the 1h access token expires. Refresh tokens rotate. */
export const CHATGPT_REFRESH_SKEW_MS = 3 * 60 * 1000

export const CHATGPT_FORBIDDEN_FIELDS = [
  "temperature",
  "top_p",
  "max_output_tokens",
  "metadata",
  "previous_response_id",
  "prompt_cache_retention",
  "truncation",
  "user",
  "background",
  "conversation",
  "max_tool_calls",
  "moderation",
  "prompt",
  "safety_identifier",
  "top_logprobs",
] as const

export type AgentLlmClient = ReturnType<typeof createAgentLlmClient>;

export function createAgentLlmClient({
  env,
  fetchImpl = globalThis.fetch
}: {
  env: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}) {
  const baseUrl = env.CHRONOFACT_AGENT_LLM_BASE_URL || env.LLM_BASE_URL || env.NOERYN_INFERENCE_API_BASE || "";
  const apiKey =
    env.CHRONOFACT_AGENT_LLM_API_KEY ||
    env.LLM_API_KEY ||
    (env.NOERYN_INFERENCE_API_KEY_ENV ? env[env.NOERYN_INFERENCE_API_KEY_ENV] : undefined) ||
    "";
  const model = env.CHRONOFACT_AGENT_LLM_MODEL || env.LLM_MODEL || stripProviderPrefix(env.NOERYN_INFERENCE_MODEL) || "";
  const timeoutMs = Number(env.CHRONOFACT_AGENT_LLM_TIMEOUT_MS || 0) || 30000;

  const configured = Boolean(baseUrl && apiKey && model);

  return {
    configured,
    model,
    baseUrl,

    async complete({ system, user }: { system: string; user: string }) {
      if (!configured) {
        return null;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json"
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: system },
              { role: "user", content: user }
            ],
            temperature: 0.2
          }),
          signal: controller.signal
        });

        if (!response.ok) {
          return null;
        }
        const payload = await response.json().catch(() => ({}));
        const text = payload?.choices?.[0]?.message?.content;
        return typeof text === "string" && text.trim() ? text.trim() : null;
      } catch {
        return null;
      } finally {
        clearTimeout(timeout);
      }
    },

    async chooseTool({
      system,
      user,
      tools
    }: {
      system: string;
      user: string;
      tools: Array<{ name: string; description: string; parameters?: unknown }>;
    }) {
      if (!configured) {
        return null;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json"
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: system },
              { role: "user", content: user }
            ],
            tools: tools.map((tool) => ({
              type: "function",
              function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters ?? { type: "object", properties: {} }
              }
            })),
            tool_choice: "auto",
            temperature: 0
          }),
          signal: controller.signal
        });

        if (!response.ok) {
          return null;
        }
        const payload = await response.json().catch(() => ({}));
        const message = payload?.choices?.[0]?.message ?? {};
        const toolCall = Array.isArray(message.tool_calls) ? message.tool_calls[0] : null;
        const name = toolCall?.function?.name;
        if (typeof name === "string" && name) {
          return {
            toolName: name,
            arguments: parseJsonObject(toolCall?.function?.arguments)
          };
        }
        return parseToolChoiceFromText(message.content);
      } catch {
        return null;
      } finally {
        clearTimeout(timeout);
      }
    }
  };
}

function parseJsonObject(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function parseToolChoiceFromText(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const match = value.match(/\{[\s\S]*\}/);
  if (!match) return null;
  const parsed = parseJsonObject(match[0]);
  const toolName = (parsed as any).toolName ?? (parsed as any).tool_name ?? (parsed as any).name;
  return typeof toolName === "string" && toolName ? { toolName, arguments: parsed } : null;
}

function stripProviderPrefix(value: string | undefined) {
  if (!value) return "";
  return value.includes("/") ? value.split("/").at(-1) || "" : value;
}

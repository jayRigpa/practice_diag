// Netlify Function: serverless proxy to the Anthropic API for the triage tool.
// The framework document is embedded server-side and cached via prompt caching,
// so the large system block costs cache-read rates after the first request.

import { TRIAGE_SYSTEM_PROMPT } from "./triage-prompt.mjs";
import { FRAMEWORK_DOC, FRAMEWORK_READY } from "./framework-doc.mjs";

// Provider selection via Netlify env vars:
//   PROVIDER=anthropic (default)  → uses ANTHROPIC_API_KEY
//   PROVIDER=openai-compatible    → uses OPENAI_API_KEY and OPENAI_BASE_URL
//     (works for OpenAI itself, z.ai GLM, or any /chat/completions endpoint)
//   TRIAGE_MODEL overrides the model for either provider.
const PROVIDER = process.env.PROVIDER || "anthropic";
const MODEL =
  process.env.TRIAGE_MODEL ||
  (PROVIDER === "anthropic" ? "claude-sonnet-4-6" : "gpt-5.5");
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");

export default async (req) => {
  if (req.method !== "POST") {
    return json({ error: "POST only" }, 405);
  }

  const apiKey =
    PROVIDER === "anthropic" ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const varName = PROVIDER === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY";
    return json({ error: `${varName} is not set in Netlify environment variables.` }, 500);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const { messages } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ error: "Body must include non-empty 'messages'." }, 400);
  }

  const trimmed = messages.slice(-60).map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: String(m.content).slice(0, 8000),
  }));

  const readiness = FRAMEWORK_READY
    ? ""
    : "\n\n[SYSTEM NOTE: the framework document is still the placeholder. Tell the user the instrument is not yet configured and decline to assess.]";

  const systemText = TRIAGE_SYSTEM_PROMPT + "\n\n" + FRAMEWORK_DOC + readiness;

  try {
    let text;

    if (PROVIDER === "anthropic") {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1200,
          system: [
            { type: "text", text: systemText, cache_control: { type: "ephemeral" } },
          ],
          messages: trimmed,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        return json({ error: data?.error?.message || `Anthropic API error (${resp.status})` }, 502);
      }
      text = (data.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
    } else {
      // OpenAI-compatible /chat/completions (OpenAI, z.ai GLM, etc.).
      // These providers cache repeated prompt prefixes automatically.
      const resp = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1200,
          messages: [{ role: "system", content: systemText }, ...trimmed],
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        return json({ error: data?.error?.message || `Provider API error (${resp.status})` }, 502);
      }
      text = (data.choices?.[0]?.message?.content || "").trim();
    }

    return json({ reply: text });
  } catch (err) {
    return json({ error: "Upstream request failed: " + (err?.message || String(err)) }, 502);
  }
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const config = { path: "/api/triage" };

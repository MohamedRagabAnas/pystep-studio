const AI_INSTRUCTIONS = [
  "You are a beginner-friendly Python tutor inside PyStep Studio.",
  "The user is stepping through code with a real Python interpreter.",
  "Always use the provided current_line_number/current_line_code as the line Python is executing or where Python stopped.",
  "If an error is present, explain the error simply, point to the failing line, and suggest a small fix.",
  "If there is no error, explain only the current step and relevant memory/output changes.",
  "Answer follow-up questions interactively, but do not invent code behavior outside the provided execution context.",
  "Keep answers concise and concrete.",
  "Return only the final answer for the learner.",
  "Never include hidden reasoning, chain-of-thought, analysis, scratchpad notes, or sections titled thinking/reasoning/analysis."
].join(" ");

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const corsHeaders = buildCorsHeaders(origin, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/api/explain") {
      return json({ error: { message: "Not found." } }, 404, corsHeaders);
    }

    if (!env.AI_API_KEY) {
      return json({ error: { message: "AI_API_KEY is missing from Worker secrets." } }, 400, corsHeaders);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: { message: "Invalid JSON request body." } }, 400, corsHeaders);
    }

    if (!body.context) {
      return json({ error: { message: "Missing explanation context." } }, 400, corsHeaders);
    }

    try {
      const result = env.AI_PROVIDER === "gemini"
        ? await requestGemini(env, body.context, body.messages || [])
        : await requestOpenAiCompatible(env, body.context, body.messages || []);

      if (!result.ok) {
        return json({ error: { message: result.message } }, result.status, corsHeaders);
      }

      return json({ text: cleanAiAnswer(result.text) }, 200, corsHeaders);
    } catch (err) {
      return json({
        error: {
          message: `Could not reach the AI provider. ${err.message || ""}`.trim()
        }
      }, 502, corsHeaders);
    }
  }
};

async function requestOpenAiCompatible(env, context, messages) {
  const aiBaseUrl = env.AI_BASE_URL || "https://openrouter.ai/api/v1/chat/completions";
  const aiModel = env.AI_MODEL || "openrouter/free";
  const providerMessages = [
    {
      role: "system",
      content: AI_INSTRUCTIONS
    },
    {
      role: "user",
      content: `Execution context:\n${JSON.stringify(context, null, 2)}`
    },
    ...messages.slice(-8).map(message => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: String(message.content || "")
    }))
  ];

  const upstream = await fetch(aiBaseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.AI_API_KEY}`,
      "HTTP-Referer": env.AI_APP_URL || "https://mohamedragabanas.github.io/pystep-studio/",
      "X-Title": env.AI_APP_TITLE || "PyStep Studio"
    },
    body: JSON.stringify({
      model: aiModel,
      messages: providerMessages,
      temperature: 0.2,
      max_tokens: 450
    })
  });

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return {
      ok: false,
      status: upstream.status,
      message: data.error?.message || `AI provider returned ${upstream.status}.`
    };
  }

  return {
    ok: true,
    text: data.choices?.[0]?.message?.content || data.output_text || ""
  };
}

async function requestGemini(env, context, messages) {
  const aiBaseUrl = env.AI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/models";
  const aiModel = env.AI_MODEL || "gemini-2.0-flash";
  const url = `${aiBaseUrl}/${encodeURIComponent(aiModel)}:generateContent?key=${encodeURIComponent(env.AI_API_KEY)}`;
  const contents = [
    {
      role: "user",
      parts: [{ text: `Execution context:\n${JSON.stringify(context, null, 2)}` }]
    },
    ...messages.slice(-8).map(message => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: String(message.content || "") }]
    }))
  ];

  const upstream = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: AI_INSTRUCTIONS }]
      },
      contents,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 450
      }
    })
  });

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return {
      ok: false,
      status: upstream.status,
      message: data.error?.message || `Gemini returned ${upstream.status}.`
    };
  }

  const text = (data.candidates?.[0]?.content?.parts || [])
    .map(part => part.text || "")
    .join("")
    .trim();
  return { ok: true, text };
}

function buildCorsHeaders(origin, env) {
  const allowed = (env.ALLOWED_ORIGIN || "https://mohamedragabanas.github.io")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0] || "*";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function json(payload, status, headers) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function cleanAiAnswer(text) {
  let cleaned = String(text || "").trim();

  cleaned = cleaned
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/```(?:thinking|reasoning|analysis|scratchpad)[\s\S]*?```/gi, "");

  const finalMarkers = [
    /\bfinal answer\s*[:\-]\s*/i,
    /\banswer\s*[:\-]\s*/i
  ];
  for (const marker of finalMarkers) {
    const match = cleaned.match(marker);
    if (match && typeof match.index === "number" && match.index > 0) {
      cleaned = cleaned.slice(match.index + match[0].length);
      break;
    }
  }

  cleaned = cleaned
    .split(/\r?\n/)
    .filter(line => !/^\s*(thinking|reasoning|analysis|scratchpad)\s*[:\-]/i.test(line))
    .join("\n")
    .trim();

  return cleaned || "I could not produce a clear answer. Please ask again in a simpler way.";
}

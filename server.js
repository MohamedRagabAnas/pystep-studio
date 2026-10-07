const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
loadEnv(path.join(root, ".env"));

const PORT = Number(process.env.PORT || 8000);
const AI_PROVIDER = process.env.AI_PROVIDER || "openai-compatible";
const AI_BASE_URL = process.env.AI_BASE_URL || "https://openrouter.ai/api/v1/chat/completions";
const AI_MODEL = process.env.AI_MODEL || "openrouter/free";
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

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/explain") {
      await handleExplain(req, res);
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      sendJson(res, 405, { error: { message: "Method not allowed." } });
      return;
    }

    serveStatic(req, res);
  } catch (err) {
    sendJson(res, 500, { error: { message: err.message || "Server error." } });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`PyStep Studio running at http://127.0.0.1:${PORT}/`);
});

async function handleExplain(req, res) {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    sendJson(res, 400, {
      error: {
        message: "AI_API_KEY is missing. Add it to .env, then restart the server."
      }
    });
    return;
  }

  const body = await readJson(req);
  if (!body.context) {
    sendJson(res, 400, { error: { message: "Missing explanation context." } });
    return;
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];

  let result;
  try {
    result = AI_PROVIDER === "gemini"
      ? await requestGemini(apiKey, body.context, messages)
      : await requestOpenAiCompatible(apiKey, body.context, messages);
  } catch (err) {
    sendJson(res, 502, {
      error: {
        message: `Could not reach the AI provider. Check your network or try another provider in .env. ${err.message || ""}`.trim()
      }
    });
    return;
  }

  if (!result.ok) {
    sendJson(res, result.status, { error: { message: result.message } });
    return;
  }

  sendJson(res, 200, { text: cleanAiAnswer(result.text) });
}

async function requestOpenAiCompatible(apiKey, context, messages) {
  const contextPrompt = buildContextPrompt(context);
  const providerMessages = [
    {
      role: "system",
      content: AI_INSTRUCTIONS
    },
    {
      role: "user",
      content: contextPrompt
    },
    ...messages.slice(-8).map(message => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: String(message.content || "")
    }))
  ];

  const upstream = await fetch(AI_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.AI_APP_URL || `http://127.0.0.1:${PORT}/`,
      "X-Title": process.env.AI_APP_TITLE || "PyStep Studio"
    },
    body: JSON.stringify({
      model: AI_MODEL,
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

  const text = data.choices?.[0]?.message?.content || data.output_text || "";
  return { ok: true, text };
}

async function requestGemini(apiKey, context, messages) {
  const model = AI_MODEL || "gemini-2.0-flash";
  const url = `${process.env.AI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/models"}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const contextPrompt = buildContextPrompt(context);
  const contents = [
    {
      role: "user",
      parts: [{ text: contextPrompt }]
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

function buildContextPrompt(context) {
  return `Execution context:\n${JSON.stringify(context, null, 2)}`;
}

function serveStatic(req, res) {
  const requestPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const cleanPath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.normalize(path.join(root, cleanPath));

  if (!filePath.startsWith(root)) {
    sendJson(res, 403, { error: { message: "Forbidden." } });
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendJson(res, 404, { error: { message: "Not found." } });
      return;
    }

    res.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream"
    });
    if (req.method === "HEAD") res.end();
    else res.end(data);
  });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON request body."));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
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

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) process.env[key] = value;
  }
}

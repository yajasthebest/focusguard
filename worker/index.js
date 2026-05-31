// FocusGuard Backend — Cloudflare Worker
// Deploy this at workers.cloudflare.com (free, no credit card)
// Set GEMINI_API_KEY as an environment variable in the worker settings
//
// NOTE: This is the BACKEND, deployed separately to Cloudflare. It is NOT the
// mobile app's entry point. The app entry lives in /index.js
// (registerRootComponent). Keeping this file out of the app's import graph is
// what prevents the "Could not get BatchedBridge" crash.

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

function buildSystemPrompt(context) {
  const { appName, usedMinutes, limitMinutes, calendarEvents, todos } = context;
  const remaining = limitMinutes - usedMinutes;
  const percent = Math.round((usedMinutes / limitMinutes) * 100);

  const calendar = calendarEvents?.length
    ? calendarEvents.map(e => `- ${e.title} at ${e.time}${e.isToday ? " (TODAY)" : ""}`).join("\n")
    : "No events today.";

  const tasks = todos?.length
    ? todos.map(t => `- [${t.completed ? "DONE" : "PENDING"}] ${t.title}${t.dueDate ? ` (due: ${t.dueDate})` : ""}`).join("\n")
    : "No pending tasks.";

  return `You are FocusGuard, an AI accountability assistant in a focus app. The user is trying to open ${appName}.

SITUATION:
- App: ${appName}
- Daily limit: ${limitMinutes} minutes
- Used today: ${usedMinutes} minutes (${percent}%)
- Remaining: ${remaining} minutes

THEIR CALENDAR TODAY:
${calendar}

THEIR TO-DO LIST:
${tasks}

YOUR PERSONALITY: Firm but fair. Like a strict coach. Direct, occasionally dry. 2-3 sentences max. Reference their actual schedule when relevant. Don't lecture repeatedly.

DECISION RULES:
- Pending urgent tasks + opening distraction = deny
- Calendar event in next 2 hours + distraction = deny
- 80%+ limit used + weak reason = deny
- Genuine work reason = grant
- Genuinely stressed/needs break = consider granting
- After 4 exchanges make a final call

RESPOND ONLY WITH RAW JSON:
{"message":"your response","accessGranted":null,"grantedMinutes":null}

accessGranted: null (still deciding) | true (allow) | false (deny)
grantedMinutes: null or number of minutes if allowing`;
}

async function callGemini(messages, context, apiKey) {
  const systemPrompt = buildSystemPrompt(context);

  const contents = [
    { role: "user", parts: [{ text: systemPrompt }] },
    { role: "model", parts: [{ text: '{"message":"Understood.","accessGranted":null,"grantedMinutes":null}' }] },
    ...messages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.role === "assistant"
        ? JSON.stringify({ message: m.content, accessGranted: null, grantedMinutes: null })
        : m.content
      }]
    }))
  ];

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents, generationConfig: { temperature: 0.8, maxOutputTokens: 300 } })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Gemini error ${res.status}`);

  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  try {
    return JSON.parse(raw.replace(/```json\n?|```\n?/g, "").trim());
  } catch {
    return { message: raw, accessGranted: null, grantedMinutes: null };
  }
}

export default {
  async fetch(request, env) {
    // CORS headers
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Content-Type": "application/json"
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    const url = new URL(request.url);

    // Health check
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true }), { headers: cors });
    }

    // Main chat endpoint
    if (url.pathname === "/chat" && request.method === "POST") {
      try {
        // Verify Google token (proves user is logged in with Google)
        const authHeader = request.headers.get("Authorization") || "";
        const googleToken = authHeader.replace("Bearer ", "");
        if (!googleToken) return new Response(JSON.stringify({ error: "No auth token" }), { status: 401, headers: cors });

        // Verify the Google token is real
        const verifyRes = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${googleToken}`);
        if (!verifyRes.ok) return new Response(JSON.stringify({ error: "Invalid Google token" }), { status: 401, headers: cors });

        const { messages, context } = await request.json();
        const result = await callGemini(messages, context, env.GEMINI_API_KEY);

        return new Response(JSON.stringify(result), { headers: cors });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: cors });
      }
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: cors });
  }
};

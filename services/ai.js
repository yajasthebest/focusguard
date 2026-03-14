// Replace this with your Cloudflare Worker URL after deploying
// It'll look like: https://focusguard.YOUR-NAME.workers.dev
const WORKER_URL = "https://focusguard.YOUR-NAME.workers.dev";

export async function sendMessage(messages, context, googleToken) {
  const res = await fetch(`${WORKER_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // We send the Google OAuth token — worker verifies it's real
      // then uses ITS OWN Gemini key. User never sees the Gemini key.
      "Authorization": `Bearer ${googleToken}`,
    },
    body: JSON.stringify({ messages, context }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Worker error");
  return data;
}

const WORKER_URL = 'https://fancy-sea-9e22.yajas-terian.workers.dev';

// The worker returns { message, accessGranted, grantedMinutes }. But when the
// model wraps its reply in JSON (or the JSON is truncated by the token limit),
// `message` can arrive as a raw/partial JSON string like:
//   {"message":"Back to work, you have a deadl
// This pulls the human text out of those cases instead of showing braces.
function extractMessage(raw) {
  if (typeof raw !== 'string') return raw;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{')) return raw;

  // 1. Well-formed JSON object — just read .message.
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed.message === 'string') return parsed.message;
  } catch {
    // falls through to the truncated-JSON handling below
  }

  // 2. Truncated/loose JSON — grab the "message" value with a regex, tolerating
  //    a missing closing quote (cut off mid-sentence) and unescaping \" and \n.
  const m = trimmed.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)/);
  if (m) {
    return m[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\t/g, '\t');
  }
  return raw;
}

export async function sendMessage(messages, context, googleToken) {
  const res = await fetch(`${WORKER_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${googleToken || 'anonymous'}`,
    },
    body: JSON.stringify({ messages, context }),
  });
  const rawText = await res.text();
  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(`Server returned invalid response (${res.status})`);
  }
  if (!res.ok) throw new Error(data?.error || 'Worker error');

  data.message = extractMessage(data.message);
  return data;
}

const WORKER_URL = 'https://fancy-sea-9e22.yajas-terian.workers.dev';

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
  if (typeof data.message === 'string' && data.message.trim().startsWith('{')) {
    try { data.message = JSON.parse(data.message).message || data.message; } catch {}
  }
  return data;
}

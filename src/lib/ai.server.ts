const MODEL = "google/gemini-3.6-flash";
const ENDPOINT = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

async function call(messages: ChatMsg[], timeoutMs = 30000): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({ model: MODEL, messages }),
    });
    if (res.status === 429) throw new Error("The AI is busy right now — please try again in a moment.");
    if (res.status === 402) throw new Error("AI credits are exhausted for this workspace.");
    if (!res.ok) {
      console.error("AI gateway error", res.status, await res.text());
      throw new Error("The AI service failed to respond.");
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? "";
  } finally {
    clearTimeout(timer);
  }
}

export async function llmText(messages: ChatMsg[]): Promise<string> {
  return (await call(messages)).trim();
}

export async function llmJson<T>(system: string, user: string): Promise<T | null> {
  try {
    const content = await call([
      { role: "system", content: `${system}\n\nReply with a single valid JSON object and nothing else.` },
      { role: "user", content: user },
    ]);
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]) as T;
  } catch (error) {
    console.error("llmJson failed", error);
    return null;
  }
}

export function num(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function fallbackQuestions(role: string): string[] {
  return [
    `Tell me about yourself and why you're a strong fit for a ${role} role.`,
    `Walk me through a project you're proud of. What was your specific contribution?`,
    `Describe a technical problem you found hard. How did you approach it?`,
    `Tell me about a time you disagreed with a teammate. How did you handle it?`,
    `How do you keep your skills sharp, and what are you learning right now?`,
    `Where do you see yourself in three years as a ${role}?`,
  ];
}

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type CurriculumDay = Database["public"]["Tables"]["curriculum_days"]["Row"];
export type Candidate = Database["public"]["Tables"]["candidates"]["Row"];

export function getSupabase() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const url = process.env["SUPABASE_URL"]!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const MODEL = "google/gemini-3.5-flash";

/** Calls the Lovable AI gateway and parses a JSON object out of the reply. Returns null on any failure. */
export async function llmJson(
  system: string,
  user: string,
  timeoutMs = 25000,
): Promise<Record<string, unknown> | null> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: `${system}\n\nAlways reply with a single valid JSON object and nothing else.` },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      console.error("AI gateway error", res.status, await res.text());
      return null;
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content ?? "";
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch (error) {
    console.error("AI gateway call failed", error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function clampScore(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(10, Math.round(n * 10) / 10));
}

/** Keyword-based fallback scoring so the interview never breaks. */
export function heuristicScore(answer: string, day: CurriculumDay | null): number {
  const text = answer.toLowerCase().trim();
  if (!text) return 0;
  const words = text.split(/\s+/).length;
  let score = Math.min(5, words / 25);
  const terms = [...(day?.key_concepts ?? []), ...(day?.tools ?? []), ...(day?.objectives ?? [])];
  const hits = terms.filter((t) => text.includes(t.toLowerCase().split(" ")[0]!)).length;
  score += Math.min(4, hits * 1.2);
  if (/because|trade-?off|latency|cost|scale|production|measured|benchmark/.test(text)) score += 1;
  return clampScore(score, 3);
}

export function pickWeightedDay(
  days: CurriculumDay[],
  candidate: Candidate,
  used: number[],
): CurriculumDay {
  const attempts = (candidate.attempts ?? {}) as Record<string, number>;
  const pool = days.filter((d) => !used.includes(d.day));
  const list = pool.length > 0 ? pool : days;
  const scored = list.map((d) => {
    let w = 1;
    if (candidate.completed_days.includes(d.day)) w += 3;
    if ((attempts[String(d.day)] ?? 0) > 1) w += 3;
    if (candidate.weak_topics.some((t) => d.module === t || d.topic.includes(t))) w += 4;
    if (candidate.skipped_days.includes(d.day)) w -= 0.5;
    return { d, w: Math.max(0.2, w) };
  });
  const total = scored.reduce((s, x) => s + x.w, 0);
  let r = Math.random() * total;
  for (const item of scored) {
    r -= item.w;
    if (r <= 0) return item.d;
  }
  return scored[0]!.d;
}

export function templateQuestion(day: CurriculumDay, candidate: Candidate): string {
  const concept = day.key_concepts[0] ?? day.topic;
  const project = candidate.projects[0];
  return project
    ? `On day ${day.day} you covered ${day.topic}. Walk me through how ${concept} showed up in "${project}" — what decision did you make and why?`
    : `On day ${day.day} you covered ${day.topic}. Explain ${concept} as if I were a senior engineer reviewing your design.`;
}

export function templateFollowup(question: string): string {
  return `Let's go one level deeper. ${question} — specifically, what would break first at 10x traffic, and how would you measure it?`;
}

export const COHORT_SKILLS: Record<string, string[]> = {
  "Retrieval-Augmented Generation": ["rag", "retrieval augmented", "chunking", "re-rank", "reranking", "llamaindex", "grounding"],
  "Vector Databases": ["vector database", "pgvector", "pinecone", "qdrant", "chroma", "weaviate", "embedding", "hnsw", "similarity search"],
  "Prompt Engineering": ["prompt engineering", "few-shot", "chain-of-thought", "system prompt", "prompt injection"],
  "Agentic AI": ["agent", "agentic", "langgraph", "crewai", "react loop", "tool calling", "function calling"],
  "Model Context Protocol": ["mcp", "model context protocol"],
  "AI Deployment": ["docker", "fastapi", "cloud run", "kubernetes", "ci/cd", "serverless", "deployment"],
  "Production AI Systems": ["observability", "langsmith", "tracing", "evals", "caching", "rate limit", "monitoring", "cost optimization"],
  "Core LLM tooling": ["langchain", "openai", "anthropic", "gemini", "hugging face", "python"],
};

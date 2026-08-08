import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type QA = { question: string; answer: string };

export type ScoreReport = {
  overall: number;
  communication: number;
  confidence: number;
  clarity: number;
  relevance: number;
  summary: string;
  strengths: string[];
  suggestions: string[];
};

export const generateQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { role: string; skills?: string[]; count?: number }) => ({
    role: String(input.role ?? "Software Engineer").slice(0, 120),
    skills: (input.skills ?? []).slice(0, 20).map((s) => String(s).slice(0, 60)),
    count: Math.max(3, Math.min(10, input.count ?? 6)),
  }))
  .handler(async ({ data }) => {
    const { llmJson, fallbackQuestions } = await import("./ai.server");
    const parsed = await llmJson<{ questions?: unknown }>(
      "You are an experienced technical interviewer. Produce realistic spoken interview questions: one behavioural opener, a mix of role-specific technical questions, and one closing question. Each question is a single sentence a human would say out loud.",
      `Role: ${data.role}\nCandidate skills: ${data.skills.join(", ") || "unspecified"}\nReturn {"questions": ["...", ...]} with exactly ${data.count} questions.`,
    );
    const list = Array.isArray(parsed?.questions)
      ? (parsed!.questions as unknown[]).map((q) => String(q).trim()).filter(Boolean)
      : [];
    const questions = list.length >= 3 ? list.slice(0, data.count) : fallbackQuestions(data.role).slice(0, data.count);
    return { questions };
  });

export const scoreInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { role: string; qa: QA[] }) => ({
    role: String(input.role ?? "Software Engineer").slice(0, 120),
    qa: (input.qa ?? []).slice(0, 12).map((x) => ({
      question: String(x.question ?? "").slice(0, 1000),
      answer: String(x.answer ?? "").slice(0, 4000),
    })),
  }))
  .handler(async ({ data }): Promise<ScoreReport> => {
    const { llmJson, num } = await import("./ai.server");
    const transcript = data.qa.map((x, i) => `Q${i + 1}: ${x.question}\nA${i + 1}: ${x.answer || "(no answer)"}`).join("\n\n");

    const parsed = await llmJson<Record<string, unknown>>(
      "You are a strict but supportive interview coach. Score the candidate's mock interview transcript. Scores are 0-100 integers. Be honest: empty or one-line answers score low.",
      `Role: ${data.role}\n\nTranscript:\n${transcript}\n\nReturn {"overall":n,"communication":n,"confidence":n,"clarity":n,"relevance":n,"summary":"2-3 sentences","strengths":["..."],"suggestions":["..."]}`,
    );

    const words = data.qa.reduce((s, x) => s + (x.answer?.trim().split(/\s+/).filter(Boolean).length ?? 0), 0);
    const answered = data.qa.filter((x) => x.answer?.trim()).length;
    const base = Math.max(10, Math.min(75, Math.round((answered / Math.max(1, data.qa.length)) * 55 + Math.min(20, words / 25))));

    const strengths = Array.isArray(parsed?.["strengths"]) ? (parsed!["strengths"] as unknown[]).map(String).slice(0, 5) : [];
    const suggestions = Array.isArray(parsed?.["suggestions"]) ? (parsed!["suggestions"] as unknown[]).map(String).slice(0, 6) : [];

    return {
      overall: num(parsed?.["overall"], base),
      communication: num(parsed?.["communication"], base),
      confidence: num(parsed?.["confidence"], base),
      clarity: num(parsed?.["clarity"], base),
      relevance: num(parsed?.["relevance"], base),
      summary:
        typeof parsed?.["summary"] === "string" && parsed["summary"]
          ? (parsed["summary"] as string)
          : `You answered ${answered} of ${data.qa.length} questions with roughly ${words} words in total. Add more structure and concrete examples to lift your score.`,
      strengths: strengths.length ? strengths : ["You completed the full interview without skipping questions."],
      suggestions: suggestions.length
        ? suggestions
        : [
            "Use the STAR structure: Situation, Task, Action, Result.",
            "Quantify outcomes with numbers wherever you can.",
            "Slow down and finish each thought before moving on.",
          ],
    };
  });

export const chatReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { messages: { role: "user" | "assistant"; content: string }[] }) => ({
    messages: (input.messages ?? []).slice(-16).map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: String(m.content ?? "").slice(0, 4000),
    })),
  }))
  .handler(async ({ data }) => {
    const { llmText } = await import("./ai.server");
    const reply = await llmText([
      {
        role: "system",
        content:
          "You are an AI career and interview coach. Give practical, encouraging, specific advice about interviews, resumes, careers and technical topics. Keep answers concise (under 200 words) and use markdown lists when helpful.",
      },
      ...data.messages,
    ]);
    return { reply: reply || "Sorry, I couldn't come up with a reply — try rephrasing that." };
  });

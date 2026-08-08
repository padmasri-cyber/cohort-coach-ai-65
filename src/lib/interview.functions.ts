import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const MIN_QUESTIONS = 8;
export const MIN_DAYS = 4;

export type ChatTurn = {
  id: string;
  question: string;
  answer: string | null;
  day: number | null;
  topic: string | null;
  is_followup: boolean;
  score: number | null;
};

export type InterviewState = {
  sessionId: string;
  turns: ChatTurn[];
  questionCount: number;
  daysCovered: number;
  canEnd: boolean;
  status: string;
};

export type Feedback = {
  overallScore: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  breakdown: Array<{ day: number | null; topic: string; score: number; questions: number }>;
};

export const loginCandidate = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ name: z.string().min(1), email: z.string().email() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { getSupabase } = await import("./interview.server");
    const supabase = getSupabase();
    const email = data.email.trim().toLowerCase();

    const { data: existing } = await supabase
      .from("candidates")
      .select("*")
      .eq("email", email)
      .maybeSingle();
    if (existing) return { candidateId: existing.candidate_id, name: existing.name };

    // Round-robin a demo profile so a brand-new learner still gets a rich journey.
    const { data: demos } = await supabase
      .from("candidates")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(3);
    const seed = demos && demos.length > 0 ? demos[Math.floor(Math.random() * demos.length)]! : null;

    const { data: created, error } = await supabase
      .from("candidates")
      .insert({
        name: data.name.trim(),
        email,
        completed_days: seed?.completed_days ?? [1, 3, 5, 9],
        skipped_days: seed?.skipped_days ?? [],
        attempts: seed?.attempts ?? {},
        strong_topics: seed?.strong_topics ?? ["Prompt Engineering"],
        weak_topics: seed?.weak_topics ?? ["Agentic AI"],
        projects: seed?.projects ?? ["Cohort capstone RAG app"],
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { candidateId: created.candidate_id, name: created.name };
  });

export const getDashboard = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ candidateId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { getSupabase } = await import("./interview.server");
    const supabase = getSupabase();
    const [{ data: candidate }, { count }] = await Promise.all([
      supabase.from("candidates").select("*").eq("candidate_id", data.candidateId).maybeSingle(),
      supabase.from("curriculum_days").select("*", { count: "exact", head: true }),
    ]);
    if (!candidate) throw new Error("Candidate not found");
    return { candidate, totalDays: 31, curriculumDays: count ?? 0 };
  });

export const startInterview = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ candidateId: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<InterviewState> => {
    const { getSupabase, pickWeightedDay, templateQuestion, llmJson } = await import(
      "./interview.server"
    );
    const supabase = getSupabase();

    const { data: candidate } = await supabase
      .from("candidates")
      .select("*")
      .eq("candidate_id", data.candidateId)
      .maybeSingle();
    if (!candidate) throw new Error("Candidate not found");

    const { data: days } = await supabase.from("curriculum_days").select("*").order("day");
    if (!days || days.length === 0) throw new Error("Curriculum not seeded");

    const day = pickWeightedDay(days, candidate, []);

    const ai = await llmJson(
      "You are a senior AI engineer running a technical mock interview. Ask ONE opening question grounded in the given curriculum day.",
      JSON.stringify({
        candidate: { name: candidate.name, projects: candidate.projects, weak_topics: candidate.weak_topics },
        day,
        want: { question: "string - one warm but rigorous opening interview question" },
      }),
    );
    const question =
      (typeof ai?.["question"] === "string" && (ai["question"] as string).trim()) ||
      templateQuestion(day, candidate);

    const { data: session, error } = await supabase
      .from("interview_sessions")
      .insert({ candidate_id: candidate.candidate_id, status: "active", days_touched: [day.day] })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    const { data: row } = await supabase
      .from("interview_qa_log")
      .insert({ session_id: session.session_id, day: day.day, topic: day.topic, question, is_followup: false })
      .select("*")
      .single();

    return {
      sessionId: session.session_id,
      turns: [
        {
          id: row?.id ?? "first",
          question,
          answer: null,
          day: day.day,
          topic: day.topic,
          is_followup: false,
          score: null,
        },
      ],
      questionCount: 1,
      daysCovered: 1,
      canEnd: false,
      status: "active",
    };
  });

export const getInterview = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ sessionId: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<InterviewState> => {
    const { getSupabase } = await import("./interview.server");
    const supabase = getSupabase();
    const { data: session } = await supabase
      .from("interview_sessions")
      .select("*")
      .eq("session_id", data.sessionId)
      .maybeSingle();
    if (!session) throw new Error("Session not found");
    const { data: rows } = await supabase
      .from("interview_qa_log")
      .select("*")
      .eq("session_id", data.sessionId)
      .order("created_at");
    const turns: ChatTurn[] = (rows ?? []).map((r) => ({
      id: r.id,
      question: r.question,
      answer: r.answer,
      day: r.day,
      topic: r.topic,
      is_followup: r.is_followup,
      score: r.score === null ? null : Number(r.score),
    }));
    const answered = turns.filter((t) => t.answer !== null).length;
    const daysCovered = session.days_touched.length;
    return {
      sessionId: session.session_id,
      turns,
      questionCount: turns.length,
      daysCovered,
      canEnd: answered >= MIN_QUESTIONS && daysCovered >= MIN_DAYS,
      status: session.status,
    };
  });

export const respondToAnswer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ sessionId: z.string().uuid(), answer: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }): Promise<InterviewState> => {
    const {
      getSupabase,
      pickWeightedDay,
      templateQuestion,
      templateFollowup,
      llmJson,
      clampScore,
      heuristicScore,
    } = await import("./interview.server");
    const supabase = getSupabase();

    const { data: session } = await supabase
      .from("interview_sessions")
      .select("*")
      .eq("session_id", data.sessionId)
      .maybeSingle();
    if (!session) throw new Error("Session not found");

    const { data: rows } = await supabase
      .from("interview_qa_log")
      .select("*")
      .eq("session_id", data.sessionId)
      .order("created_at");
    const log = rows ?? [];
    const pending = [...log].reverse().find((r) => r.answer === null);
    if (!pending) throw new Error("No open question");

    const { data: candidate } = await supabase
      .from("candidates")
      .select("*")
      .eq("candidate_id", session.candidate_id)
      .single();
    const { data: days } = await supabase.from("curriculum_days").select("*").order("day");
    const allDays = days ?? [];
    const currentDay = allDays.find((d) => d.day === pending.day) ?? null;

    const followupCount = log.filter((r) => r.is_followup && r.day === pending.day).length;
    const answeredSoFar = log.filter((r) => r.answer !== null).length + 1;

    const ai = await llmJson(
      "You are a senior AI engineer conducting an adaptive technical interview. Score the candidate's answer, then either probe deeper on the same topic (if the answer was vague, short, or hand-wavy) or move on with a fresh question. Strong answers deserve a production-scaling twist or a new topic.",
      JSON.stringify({
        curriculum_day: currentDay,
        candidate: { projects: candidate?.projects ?? [], weak_topics: candidate?.weak_topics ?? [] },
        question: pending.question,
        answer: data.answer,
        followups_already_asked_on_this_day: followupCount,
        want: {
          score: "number 0-10",
          feedback_reason: "one short sentence, internal only",
          ask_followup: "boolean - true only if probing the SAME topic is more valuable than moving on",
          next_question: "string - the follow-up question, only if ask_followup is true",
        },
      }),
    );

    const score = clampScore(ai?.["score"], heuristicScore(data.answer, currentDay));
    await supabase.from("interview_qa_log").update({ answer: data.answer, score }).eq("id", pending.id);

    const wantsFollowup = ai ? ai["ask_followup"] === true : data.answer.trim().split(/\s+/).length < 30;
    const askFollowup = wantsFollowup && followupCount < 2;

    let nextQuestion: string;
    let nextDay = pending.day;
    let nextTopic = pending.topic;
    let isFollowup = false;

    if (askFollowup) {
      isFollowup = true;
      nextQuestion =
        (typeof ai?.["next_question"] === "string" && (ai["next_question"] as string).trim()) ||
        templateFollowup(pending.question);
    } else {
      const used = session.days_touched;
      const day = pickWeightedDay(allDays, candidate!, used);
      nextDay = day.day;
      nextTopic = day.topic;
      const gen = await llmJson(
        "You are a senior AI engineer running a technical mock interview. Ask ONE new question grounded in the given curriculum day, referencing the candidate's own projects when it fits. Do not repeat earlier questions.",
        JSON.stringify({
          day,
          candidate: { projects: candidate?.projects ?? [] },
          previous_questions: log.map((r) => r.question),
          want: { question: "string" },
        }),
      );
      nextQuestion =
        (typeof gen?.["question"] === "string" && (gen["question"] as string).trim()) ||
        templateQuestion(day, candidate!);
      if (!used.includes(day.day)) {
        await supabase
          .from("interview_sessions")
          .update({ days_touched: [...used, day.day] })
          .eq("session_id", session.session_id);
      }
    }

    await supabase.from("interview_qa_log").insert({
      session_id: session.session_id,
      day: nextDay,
      topic: nextTopic,
      question: nextQuestion,
      is_followup: isFollowup,
    });

    const { data: refreshed } = await supabase
      .from("interview_qa_log")
      .select("*")
      .eq("session_id", data.sessionId)
      .order("created_at");
    const { data: refreshedSession } = await supabase
      .from("interview_sessions")
      .select("days_touched")
      .eq("session_id", data.sessionId)
      .single();

    const turns: ChatTurn[] = (refreshed ?? []).map((r) => ({
      id: r.id,
      question: r.question,
      answer: r.answer,
      day: r.day,
      topic: r.topic,
      is_followup: r.is_followup,
      score: r.score === null ? null : Number(r.score),
    }));
    const daysCovered = refreshedSession?.days_touched.length ?? 1;

    return {
      sessionId: data.sessionId,
      turns,
      questionCount: turns.length,
      daysCovered,
      canEnd: answeredSoFar >= MIN_QUESTIONS && daysCovered >= MIN_DAYS,
      status: "active",
    };
  });

export const endInterview = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ sessionId: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<Feedback> => {
    const { getSupabase, llmJson, clampScore } = await import("./interview.server");
    const supabase = getSupabase();

    const { data: rows } = await supabase
      .from("interview_qa_log")
      .select("*")
      .eq("session_id", data.sessionId)
      .order("created_at");
    const answered = (rows ?? []).filter((r) => r.answer !== null && r.score !== null);

    const byTopic = new Map<string, { day: number | null; total: number; count: number }>();
    for (const r of answered) {
      const key = r.topic ?? "General";
      const entry = byTopic.get(key) ?? { day: r.day, total: 0, count: 0 };
      entry.total += Number(r.score);
      entry.count += 1;
      byTopic.set(key, entry);
    }
    const breakdown = [...byTopic.entries()].map(([topic, v]) => ({
      day: v.day,
      topic,
      score: Math.round((v.total / v.count) * 10) / 10,
      questions: v.count,
    }));
    const overall =
      answered.length > 0
        ? Math.round((answered.reduce((s, r) => s + Number(r.score), 0) / answered.length) * 10) / 10
        : 0;

    const strong = breakdown.filter((b) => b.score >= 7).map((b) => b.topic);
    const weak = breakdown.filter((b) => b.score < 6).map((b) => b.topic);

    const ai = await llmJson(
      "You are a senior AI engineering interviewer writing candid, encouraging, specific post-interview feedback.",
      JSON.stringify({
        transcript: answered.map((r) => ({ topic: r.topic, question: r.question, answer: r.answer, score: r.score })),
        computed: { overall, breakdown },
        want: {
          summary: "3-5 sentence written summary addressed to the candidate",
          strengths: "array of 2-4 short strings",
          improvements: "array of 2-4 short actionable strings",
          overall_score: "number 0-10",
        },
      }),
      35000,
    );

    const strengths = Array.isArray(ai?.["strengths"])
      ? (ai["strengths"] as string[]).slice(0, 4)
      : strong.length > 0
        ? strong.map((t) => `Solid grasp of ${t}`)
        : ["You completed a full adaptive interview end to end"];
    const improvements = Array.isArray(ai?.["improvements"])
      ? (ai["improvements"] as string[]).slice(0, 4)
      : weak.length > 0
        ? weak.map((t) => `Revisit ${t} and practice explaining trade-offs out loud`)
        : ["Add concrete metrics and numbers to your explanations"];
    const summary =
      typeof ai?.["summary"] === "string"
        ? (ai["summary"] as string)
        : `You answered ${answered.length} questions across ${breakdown.length} topics with an average score of ${overall}/10. Keep practicing the areas below and tie every answer back to a system you actually built.`;

    await supabase
      .from("interview_sessions")
      .update({ status: "completed" })
      .eq("session_id", data.sessionId);

    return {
      overallScore: clampScore(ai?.["overall_score"], overall),
      summary,
      strengths,
      improvements,
      breakdown: breakdown.sort((a, b) => b.score - a.score),
    };
  });

export const analyzeResume = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ text: z.string().min(20) }).parse(input))
  .handler(async ({ data }) => {
    const { COHORT_SKILLS, llmJson } = await import("./interview.server");
    const lower = data.text.toLowerCase();
    const matched: string[] = [];
    const missing: string[] = [];
    for (const [area, keywords] of Object.entries(COHORT_SKILLS)) {
      const hits = keywords.filter((k) => lower.includes(k));
      if (hits.length > 0) matched.push(`${area} (${hits.slice(0, 3).join(", ")})`);
      else missing.push(area);
    }

    const ai = await llmJson(
      "You review resumes for graduates of a 31-day AI engineering cohort (RAG, vector DBs, prompt engineering, agentic AI, MCP, deployment, production AI).",
      JSON.stringify({
        resume: data.text.slice(0, 8000),
        detected: matched,
        gaps: missing,
        want: {
          note: "3-4 sentence assessment addressed to the candidate",
          suggestions: "array of 3-5 concrete bullet lines they could add to the resume",
        },
      }),
    );

    return {
      matched,
      missing,
      suggestions: Array.isArray(ai?.["suggestions"])
        ? (ai["suggestions"] as string[]).slice(0, 5)
        : missing.slice(0, 4).map((m) => `Add a bullet showing hands-on ${m} work with a measurable outcome.`),
      note:
        typeof ai?.["note"] === "string"
          ? (ai["note"] as string)
          : `Your resume covers ${matched.length} of ${matched.length + missing.length} cohort skill areas. Add specific projects, tools and numbers for the gaps below.`,
    };
  });

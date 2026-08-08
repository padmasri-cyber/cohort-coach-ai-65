import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Lightbulb, Loader2 } from "lucide-react";

import { AppNav } from "@/components/app-nav";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/feedback/$id")({
  head: () => ({
    meta: [
      { title: "Interview report — AI Interview Practice" },
      { name: "description", content: "Your scored interview report with a breakdown of communication, confidence, clarity and relevance." },
      { property: "og:title", content: "Your interview report" },
      { property: "og:description", content: "Score out of 100 with strengths and concrete suggestions to improve." },
    ],
  }),
  component: Feedback,
});

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-medium">{value}/100</span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function Feedback() {
  const { id } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["feedback", id],
    queryFn: async () => {
      const [sessionRes, answersRes] = await Promise.all([
        supabase.from("practice_sessions").select("*").eq("id", id).maybeSingle(),
        supabase.from("practice_answers").select("position, question, answer").eq("session_id", id).order("position"),
      ]);
      if (sessionRes.error) throw sessionRes.error;
      return { session: sessionRes.data, answers: answersRes.data ?? [] };
    },
  });

  const s = data?.session;

  return (
    <div className="min-h-screen bg-background">
      <AppNav />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : !s ? (
          <p className="text-sm text-muted-foreground">That report doesn't exist.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="font-[family-name:var(--font-display)] text-3xl">{s.role_title} interview</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {new Date(s.completed_at ?? s.created_at).toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-surface px-6 py-4 text-center">
                <p className="text-xs tracking-wide text-muted-foreground uppercase">Overall</p>
                <p className="font-[family-name:var(--font-display)] text-4xl text-primary">{s.overall_score ?? "—"}</p>
                <p className="text-xs text-muted-foreground">out of 100</p>
              </div>
            </div>

            <section className="mt-6 space-y-4 rounded-xl border border-border bg-surface p-5">
              <Bar label="Communication skills" value={Number(s.communication ?? 0)} />
              <Bar label="Confidence" value={Number(s.confidence ?? 0)} />
              <Bar label="Clarity" value={Number(s.clarity ?? 0)} />
              <Bar label="Relevance of answers" value={Number(s.relevance ?? 0)} />
            </section>

            {s.summary ? (
              <section className="mt-6 rounded-xl border border-border bg-surface p-5">
                <h2 className="text-sm font-semibold">Summary</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.summary}</p>
              </section>
            ) : null}

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <section className="rounded-xl border border-border bg-surface p-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  What went well
                </h2>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {s.strengths.map((x, i) => (
                    <li key={i}>· {x}</li>
                  ))}
                </ul>
              </section>
              <section className="rounded-xl border border-border bg-surface p-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  Improve next time
                </h2>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {s.suggestions.map((x, i) => (
                    <li key={i}>· {x}</li>
                  ))}
                </ul>
              </section>
            </div>

            <section className="mt-6 rounded-xl border border-border bg-surface p-5">
              <h2 className="text-sm font-semibold">Your answers</h2>
              <div className="mt-3 space-y-4">
                {data.answers.map((a) => (
                  <div key={a.position}>
                    <p className="text-sm font-medium">{a.question}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{a.answer || "(no answer)"}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="mt-8 flex gap-3">
              <Button asChild>
                <Link to="/practice">Practice again</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/dashboard">Back to dashboard</Link>
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

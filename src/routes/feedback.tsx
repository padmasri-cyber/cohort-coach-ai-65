import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { Feedback } from "@/lib/interview.functions";
import { clearSessionId } from "@/lib/session-store";

export const Route = createFileRoute("/feedback")({
  head: () => ({
    meta: [
      { title: "Interview feedback report — AI Cohort Interview Coach" },
      {
        name: "description",
        content: "Your overall interview score, strengths, areas to improve and a per-topic breakdown.",
      },
      { property: "og:title", content: "Interview feedback report" },
      { property: "og:description", content: "Scored, structured feedback from your mock technical interview." },
    ],
  }),
  component: FeedbackPage,
});

function FeedbackPage() {
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("aicc_feedback");
    if (raw) setFeedback(JSON.parse(raw) as Feedback);
    setReady(true);
  }, []);

  return (
    <div className="min-h-screen">
      <AppHeader
        right={
          <Button variant="ghost" size="sm" onClick={() => void navigate({ to: "/dashboard" })}>
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Button>
        }
      />
      <main className="mx-auto max-w-4xl px-6 py-10">
        {!ready ? null : !feedback ? (
          <div className="panel p-8 text-center">
            <p className="text-sm text-muted-foreground">No feedback report yet — finish an interview first.</p>
            <Button className="mt-4" onClick={() => void navigate({ to: "/interview" })}>
              Start an interview
            </Button>
          </div>
        ) : (
          <>
            <div className="panel flex flex-col gap-6 p-8 sm:flex-row sm:items-center">
              <div className="text-center sm:text-left">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Overall score</p>
                <p className="font-[family-name:var(--font-display)] text-6xl text-primary">
                  {feedback.overallScore}
                  <span className="text-2xl text-muted-foreground">/10</span>
                </p>
              </div>
              <p className="text-sm leading-relaxed text-foreground/90">{feedback.summary}</p>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div className="panel p-6">
                <h2 className="text-sm font-semibold text-success">Strengths</h2>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {feedback.strengths.map((s) => (
                    <li key={s}>· {s}</li>
                  ))}
                </ul>
              </div>
              <div className="panel p-6">
                <h2 className="text-sm font-semibold text-warning">Areas to improve</h2>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {feedback.improvements.map((s) => (
                    <li key={s}>· {s}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="panel mt-6 p-6">
              <h2 className="text-sm font-semibold">Per-topic breakdown</h2>
              <div className="mt-4 space-y-4">
                {feedback.breakdown.map((b) => (
                  <div key={b.topic}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium">
                        {b.day ? `Day ${b.day} · ` : ""}
                        {b.topic}
                      </span>
                      <span className="text-muted-foreground">
                        {b.score}/10 · {b.questions} {b.questions === 1 ? "question" : "questions"}
                      </span>
                    </div>
                    <Progress value={b.score * 10} className="mt-2" />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                onClick={() => {
                  clearSessionId();
                  localStorage.removeItem("aicc_feedback");
                  void navigate({ to: "/interview" });
                }}
              >
                <RefreshCw className="h-4 w-4" /> Start New Interview
              </Button>
              <Button variant="outline" onClick={() => void navigate({ to: "/dashboard" })}>
                Back to Dashboard
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

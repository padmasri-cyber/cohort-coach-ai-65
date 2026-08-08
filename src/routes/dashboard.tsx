import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { FileText, Loader2, LogOut, MessageSquareText } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getDashboard } from "@/lib/interview.functions";
import { clearCandidate, clearSessionId, loadCandidate } from "@/lib/session-store";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Your cohort dashboard — AI Cohort Interview Coach" },
      {
        name: "description",
        content: "See your 31-day cohort progress, strong and focus topics, and start a mock interview.",
      },
      { property: "og:title", content: "Your cohort dashboard" },
      { property: "og:description", content: "Cohort progress, focus topics and mock interview practice." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const fetchDashboard = useServerFn(getDashboard);
  const [candidateId, setCandidateId] = useState<string | null>(null);

  useEffect(() => {
    const stored = loadCandidate();
    if (!stored) void navigate({ to: "/" });
    else setCandidateId(stored.candidateId);
  }, [navigate]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard", candidateId],
    queryFn: () => fetchDashboard({ data: { candidateId: candidateId! } }),
    enabled: !!candidateId,
  });

  const candidate = data?.candidate;
  const percent = candidate ? Math.round((candidate.completed_days.length / 31) * 100) : 0;

  return (
    <div className="min-h-screen">
      <AppHeader
        right={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              clearCandidate();
              clearSessionId();
              void navigate({ to: "/" });
            }}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        }
      />

      <main className="mx-auto max-w-5xl px-6 py-10">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your profile…
          </div>
        ) : error || !candidate ? (
          <p className="text-sm text-destructive">We couldn't load your profile. Try signing in again.</p>
        ) : (
          <>
            <h1 className="font-[family-name:var(--font-display)] text-3xl">Hi {candidate.name.split(" ")[0]}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Here's where you stand after the 31-day AI engineering cohort.
            </p>

            <div className="mt-8 grid gap-5 md:grid-cols-3">
              <div className="panel p-6 md:col-span-2">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold">Cohort progress</h2>
                  <span className="text-2xl font-semibold text-primary">{percent}%</span>
                </div>
                <Progress value={percent} className="mt-3" />
                <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                  <Stat label="Days completed" value={candidate.completed_days.length} />
                  <Stat label="Days skipped" value={candidate.skipped_days.length} />
                  <Stat label="Days retried" value={Object.keys(candidate.attempts ?? {}).length} />
                </div>
              </div>

              <div className="panel flex flex-col gap-3 p-6">
                <h2 className="text-sm font-semibold">Practice</h2>
                <Button onClick={() => void navigate({ to: "/interview" })}>
                  <MessageSquareText className="h-4 w-4" /> Start Mock Interview
                </Button>
                <Button variant="outline" onClick={() => void navigate({ to: "/resume" })}>
                  <FileText className="h-4 w-4" /> Analyze My Resume
                </Button>
                <p className="text-xs text-muted-foreground">
                  Interviews run at least 8 questions across 4+ curriculum days.
                </p>
              </div>

              <div className="panel p-6">
                <h2 className="text-sm font-semibold">Strong topics</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {candidate.strong_topics.map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="panel p-6">
                <h2 className="text-sm font-semibold">Focus topics</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {candidate.weak_topics.map((t) => (
                    <Badge key={t} variant="outline" className="border-warning text-warning">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="panel p-6">
                <h2 className="text-sm font-semibold">Projects built</h2>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {candidate.projects.map((p) => (
                    <li key={p}>· {p}</li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

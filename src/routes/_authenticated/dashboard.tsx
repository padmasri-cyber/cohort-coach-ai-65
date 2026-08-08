import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, Loader2, Mic, TrendingUp, Trophy } from "lucide-react";

import { AiChatbox } from "@/components/ai-chatbox";
import { AppNav } from "@/components/app-nav";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — AI Interview Practice" },
      { name: "description", content: "Your practice history, average score and progress across every mock interview." },
      { property: "og:title", content: "Your interview practice dashboard" },
      { property: "og:description", content: "Track scores, review past mock interviews and start a new session." },
    ],
  }),
  component: Dashboard,
});

function Stat({ icon: Icon, label, value }: { icon: typeof Trophy; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-2 font-[family-name:var(--font-display)] text-3xl">{value}</p>
    </div>
  );
}

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [profileRes, sessionsRes] = await Promise.all([
        supabase.from("profiles").select("full_name, email").maybeSingle(),
        supabase
          .from("practice_sessions")
          .select("id, role_title, status, overall_score, created_at, completed_at")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      if (sessionsRes.error) throw sessionsRes.error;
      return { profile: profileRes.data, sessions: sessionsRes.data ?? [] };
    },
  });

  const completed = (data?.sessions ?? []).filter((s) => s.status === "completed" && s.overall_score !== null);
  const avg = completed.length
    ? Math.round(completed.reduce((sum, s) => sum + Number(s.overall_score), 0) / completed.length)
    : 0;
  const best = completed.length ? Math.max(...completed.map((s) => Number(s.overall_score))) : 0;
  const firstName = data?.profile?.full_name?.split(" ")[0] || "there";

  return (
    <div className="min-h-screen bg-background">
      <AppNav />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="font-[family-name:var(--font-display)] text-3xl">Welcome back, {firstName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Here's how your interview practice is going.</p>

        {isLoading ? (
          <Loader2 className="mt-10 h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <Stat icon={CalendarDays} label="Interviews taken" value={String(completed.length)} />
              <Stat icon={TrendingUp} label="Average score" value={completed.length ? `${avg}/100` : "—"} />
              <Stat icon={Trophy} label="Best score" value={completed.length ? `${best}/100` : "—"} />
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
              <section className="rounded-xl border border-border bg-surface">
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <h2 className="text-sm font-semibold">Practice history</h2>
                  <Button asChild size="sm">
                    <Link to="/practice">
                      <Mic className="h-4 w-4" />
                      New interview
                    </Link>
                  </Button>
                </div>

                {data?.sessions.length ? (
                  <ul className="divide-y divide-border">
                    {data.sessions.map((s) => (
                      <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{s.role_title}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(s.created_at).toLocaleDateString(undefined, {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                            {s.status !== "completed" ? " · incomplete" : ""}
                          </p>
                        </div>
                        {s.overall_score !== null ? (
                          <span className="rounded-full bg-accent px-3 py-1 text-sm font-semibold">{s.overall_score}/100</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">No score</span>
                        )}
                        {s.status === "completed" ? (
                          <Button asChild size="sm" variant="ghost">
                            <Link to="/feedback/$id" params={{ id: s.id }}>
                              Report
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="px-5 py-10 text-center">
                    <p className="text-sm text-muted-foreground">You haven't taken an interview yet.</p>
                    <Button asChild className="mt-4">
                      <Link to="/practice">Start your first interview</Link>
                    </Button>
                  </div>
                )}
              </section>

              <AiChatbox compact className="hidden lg:flex" />
            </div>
          </>
        )}
      </main>

      <div className="lg:hidden">
        <FloatingChat />
      </div>
    </div>
  );
}

import { useState } from "react";
import { MessageSquare, X } from "lucide-react";

function FloatingChat() {
  const [open, setOpen] = useState(false);
  return (
    <>
      {open ? (
        <div className="fixed inset-x-3 bottom-20 z-40">
          <AiChatbox compact className="shadow-xl" />
        </div>
      ) : null}
      <Button
        size="icon"
        className="fixed right-4 bottom-4 z-40 h-12 w-12 rounded-full shadow-lg"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close AI coach" : "Open AI coach"}
      >
        {open ? <X className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
      </Button>
    </>
  );
}

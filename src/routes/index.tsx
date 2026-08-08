import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { BrainCircuit, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginCandidate } from "@/lib/interview.functions";
import { loadCandidate, saveCandidate } from "@/lib/session-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI Cohort Interview Coach — Practice your post-cohort interview" },
      {
        name: "description",
        content:
          "Sign in with your name and email to run an adaptive mock technical interview across RAG, vector databases, agents, MCP and production AI.",
      },
      { property: "og:title", content: "AI Cohort Interview Coach" },
      {
        property: "og:description",
        content: "Adaptive mock technical interviews for AI engineering cohort graduates.",
      },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const login = useServerFn(loginCandidate);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loadCandidate()) void navigate({ to: "/dashboard" });
  }, [navigate]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await login({ data: { name, email } });
      saveCandidate({ candidateId: result.candidateId, name: result.name });
      await navigate({ to: "/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign you in");
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2 text-sm font-semibold tracking-wide uppercase opacity-80">
          <BrainCircuit className="h-5 w-5" />
          Cohort Interview Coach
        </div>
        <div className="max-w-md">
          <h1 className="font-[family-name:var(--font-display)] text-4xl leading-tight">
            You built the systems. Now practice explaining them.
          </h1>
          <p className="mt-4 text-sm leading-relaxed opacity-80">
            An adaptive interviewer that draws from your own 31-day journey — the days you
            completed, the ones you retried, and the projects you shipped.
          </p>
          <ul className="mt-8 space-y-2 text-sm opacity-80">
            <li>· Multi-turn questions grounded in the curriculum</li>
            <li>· Follow-ups that probe vague answers</li>
            <li>· Scored feedback with a per-topic breakdown</li>
          </ul>
        </div>
        <p className="text-xs opacity-60">RAG · Vector DBs · Prompting · Agents · MCP · Deployment</p>
      </section>

      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <h2 className="font-[family-name:var(--font-display)] text-2xl">Start your session</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            No password needed — we just match you to your cohort profile.
          </p>
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Aditi Sharma" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="aditi@example.com"
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Continue
            </Button>
          </form>
          <p className="mt-6 text-xs text-muted-foreground">
            Try a demo profile: aditi@example.com, marcus@example.com or priya@example.com
          </p>
        </div>
      </section>
    </main>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { BrainCircuit, Camera, LineChart, MessageSquare, Mic } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI Interview Practice — Mock interviews with instant AI feedback" },
      {
        name: "description",
        content:
          "Run realistic on-camera mock interviews. The AI asks questions, you answer by voice, and you get a score for communication, confidence, clarity and relevance.",
      },
      { property: "og:title", content: "AI Interview Practice" },
      {
        property: "og:description",
        content: "On-camera AI mock interviews with speech-to-text answers and a scored performance breakdown.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: Camera, title: "Real interview feel", body: "Camera and mic check, live video preview, one question at a time." },
  { icon: Mic, title: "Answer with your voice", body: "Speech-to-text captures your answers exactly as you say them." },
  { icon: LineChart, title: "Scored feedback", body: "A score out of 100 with a breakdown and concrete next steps." },
  { icon: MessageSquare, title: "AI coach on call", body: "Ask interview tips and career questions any time in the chatbox." },
];

function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <BrainCircuit className="h-5 w-5 text-primary" />
          AI Interview Practice
        </span>
        <Button asChild size="sm">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-24">
        <section className="py-16 text-center sm:py-24">
          <h1 className="font-[family-name:var(--font-display)] text-4xl leading-tight sm:text-5xl">
            Practice the interview before it counts.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
            A full mock interview in your browser — camera on, questions asked out loud, answers captured by voice, and an
            honest AI score when you're done.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/auth">Create your account</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-surface p-6">
              <f.icon className="h-5 w-5 text-primary" />
              <h2 className="mt-3 text-base font-semibold">{f.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}

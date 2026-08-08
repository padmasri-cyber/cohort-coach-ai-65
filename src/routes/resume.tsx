import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { AppHeader } from "@/components/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { analyzeResume } from "@/lib/interview.functions";

export const Route = createFileRoute("/resume")({
  head: () => ({
    meta: [
      { title: "Resume analysis — AI Cohort Interview Coach" },
      {
        name: "description",
        content: "Check your resume against cohort skills like RAG, vector databases, agents, MCP and deployment.",
      },
      { property: "og:title", content: "Resume analysis for AI engineers" },
      { property: "og:description", content: "Matched skills, gaps and suggested resume bullets." },
    ],
  }),
  component: ResumePage,
});

type Result = { matched: string[]; missing: string[]; suggestions: string[]; note: string };

function ResumePage() {
  const navigate = useNavigate();
  const analyze = useServerFn(analyzeResume);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function run() {
    if (text.trim().length < 20) {
      toast.error("Paste a bit more of your resume first.");
      return;
    }
    setBusy(true);
    try {
      setResult(await analyze({ data: { text } }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setBusy(false);
    }
  }

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
        <h1 className="font-[family-name:var(--font-display)] text-3xl">Resume analysis</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste your resume or upload a .txt file. We check it against the cohort's skill areas.
        </p>

        <div className="panel mt-6 p-6">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your resume text here…"
            className="min-h-64 resize-y"
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={() => void run()} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Analyze
            </Button>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <Upload className="h-4 w-4" />
              Upload .txt
              <input
                type="file"
                accept=".txt,text/plain"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) setText(await file.text());
                }}
              />
            </label>
          </div>
        </div>

        {result ? (
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="panel p-6 md:col-span-2">
              <h2 className="text-sm font-semibold">Assessment</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{result.note}</p>
            </div>
            <div className="panel p-6">
              <h2 className="text-sm font-semibold text-success">Matched skills</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {result.matched.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No cohort skills detected yet.</p>
                ) : (
                  result.matched.map((m) => (
                    <Badge key={m} variant="secondary">
                      {m}
                    </Badge>
                  ))
                )}
              </div>
            </div>
            <div className="panel p-6">
              <h2 className="text-sm font-semibold text-warning">Gaps</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {result.missing.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Full coverage — nice.</p>
                ) : (
                  result.missing.map((m) => (
                    <Badge key={m} variant="outline" className="border-warning text-warning">
                      {m}
                    </Badge>
                  ))
                )}
              </div>
            </div>
            <div className="panel p-6 md:col-span-2">
              <h2 className="text-sm font-semibold">Suggested additions</h2>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {result.suggestions.map((s) => (
                  <li key={s}>· {s}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

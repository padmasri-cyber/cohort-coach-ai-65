import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff, Send, Square } from "lucide-react";
import { toast } from "sonner";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  MIN_DAYS,
  MIN_QUESTIONS,
  endInterview,
  getInterview,
  respondToAnswer,
  startInterview,
  type InterviewState,
} from "@/lib/interview.functions";
import { clearSessionId, loadCandidate, loadSessionId, saveSessionId } from "@/lib/session-store";

export const Route = createFileRoute("/interview")({
  head: () => ({
    meta: [
      { title: "Mock interview — AI Cohort Interview Coach" },
      {
        name: "description",
        content: "An adaptive multi-turn technical interview across your cohort curriculum, with live progress tracking.",
      },
      { property: "og:title", content: "Mock interview in progress" },
      { property: "og:description", content: "Adaptive technical interview grounded in your cohort curriculum." },
    ],
  }),
  component: Interview,
});

type Bubble = { role: "interviewer" | "candidate"; text: string; meta?: string | undefined };

function toBubbles(state: InterviewState): Bubble[] {
  const out: Bubble[] = [];
  for (const t of state.turns) {
    out.push({
      role: "interviewer",
      text: t.question,
      meta: t.day ? `Day ${t.day} · ${t.topic ?? ""}${t.is_followup ? " · follow-up" : ""}` : undefined,
    });
    if (t.answer) {
      out.push({
        role: "candidate",
        text: t.answer,
        meta: t.score !== null ? `Scored ${t.score}/10` : undefined,
      });
    }
  }
  return out;
}

function Interview() {
  const navigate = useNavigate();
  const start = useServerFn(startInterview);
  const resume = useServerFn(getInterview);
  const respond = useServerFn(respondToAnswer);
  const finish = useServerFn(endInterview);

  const [state, setState] = useState<InterviewState | null>(null);
  const [answer, setAnswer] = useState("");
  const [thinking, setThinking] = useState(true);
  const [ending, setEnding] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const booted = useRef(false);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const candidate = loadCandidate();
    if (!candidate) {
      void navigate({ to: "/" });
      return;
    }
    void (async () => {
      try {
        const existing = loadSessionId();
        if (existing) {
          const restored = await resume({ data: { sessionId: existing } });
          if (restored.status === "active") {
            setState(restored);
            setThinking(false);
            return;
          }
          clearSessionId();
        }
        const fresh = await start({ data: { candidateId: candidate.candidateId } });
        saveSessionId(fresh.sessionId);
        setState(fresh);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not start the interview");
      } finally {
        setThinking(false);
      }
    })();
  }, [navigate, resume, start]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state, thinking]);

  const submit = useCallback(async () => {
    const text = answer.trim();
    if (!text || !state || thinking) return;
    setAnswer("");
    setThinking(true);
    const optimistic: InterviewState = {
      ...state,
      turns: state.turns.map((t, i) => (i === state.turns.length - 1 ? { ...t, answer: text } : t)),
    };
    setState(optimistic);
    try {
      const next = await respond({ data: { sessionId: state.sessionId, answer: text } });
      setState(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong — try sending again");
      setAnswer(text);
      setState(state);
    } finally {
      setThinking(false);
    }
  }, [answer, respond, state, thinking]);

  function toggleMic() {
    const SR =
      typeof window !== "undefined"
        ? ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition)
        : undefined;
    if (!SR) {
      toast.error("Your browser doesn't support voice input. Try Chrome.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setAnswer((prev) => (prev ? `${prev} ${transcript}`.trim() : transcript.trim()));
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  }

  async function onEnd() {
    if (!state) return;
    setEnding(true);
    try {
      const feedback = await finish({ data: { sessionId: state.sessionId } });
      localStorage.setItem("aicc_feedback", JSON.stringify(feedback));
      clearSessionId();
      await navigate({ to: "/feedback" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate feedback");
      setEnding(false);
    }
  }

  const answered = state?.turns.filter((t) => t.answer).length ?? 0;
  const bubbles = state ? toBubbles(state) : [];

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader
        right={
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Question {Math.min(answered + 1, state?.questionCount ?? 1)} · {state?.daysCovered ?? 0} days covered
            </span>
            <Button size="sm" variant={state?.canEnd ? "default" : "outline"} disabled={!state?.canEnd || ending} onClick={onEnd}>
              {ending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
              End Interview
            </Button>
          </div>
        }
      />

      <div className="mx-auto w-full max-w-3xl px-6 pt-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {answered}/{MIN_QUESTIONS} answers · {state?.daysCovered ?? 0}/{MIN_DAYS} curriculum days
          </span>
          <span>{state?.canEnd ? "Minimums met — you can wrap up any time" : "Keep going to unlock feedback"}</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(100, (answered / MIN_QUESTIONS) * 100)}%` }}
          />
        </div>
      </div>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-6 py-6">
        {bubbles.map((b, i) => (
          <div key={i} className={`flex ${b.role === "candidate" ? "justify-end" : "justify-start"}`}>
            <div className={`bubble-in max-w-[85%] ${b.role === "candidate" ? "text-right" : ""}`}>
              {b.meta && b.role === "interviewer" ? (
                <p className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{b.meta}</p>
              ) : null}
              <div
                className={
                  b.role === "candidate"
                    ? "rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-sm leading-relaxed text-primary-foreground"
                    : "rounded-2xl rounded-bl-sm border border-border bg-surface px-4 py-3 text-sm leading-relaxed shadow-sm"
                }
              >
                {b.text}
              </div>
              {b.meta && b.role === "candidate" ? (
                <p className="mt-1 text-[11px] text-muted-foreground">{b.meta}</p>
              ) : null}
            </div>
          </div>
        ))}

        {thinking ? (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-border bg-surface px-4 py-3">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}
            </div>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </main>

      <footer className="sticky bottom-0 border-t border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-end gap-2 px-6 py-4">
          <Textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder={listening ? "Listening…" : "Answer out loud or type here. Shift+Enter for a new line."}
            className="max-h-40 min-h-[52px] resize-none"
          />
          <Button
            type="button"
            variant={listening ? "destructive" : "outline"}
            size="icon"
            onClick={toggleMic}
            aria-label="Voice answer"
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button type="button" size="icon" onClick={() => void submit()} disabled={thinking || !answer.trim()} aria-label="Send answer">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </footer>
    </div>
  );
}

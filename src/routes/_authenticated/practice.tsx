import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Loader2, Mic, MicOff, Send, Square, Volume2 } from "lucide-react";
import { toast } from "sonner";

import { AppNav } from "@/components/app-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { generateQuestions, scoreInterview } from "@/lib/ai.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/practice")({
  head: () => ({
    meta: [
      { title: "Practice Interview — AI Interview Practice" },
      { name: "description", content: "Take a live on-camera mock interview: the AI asks questions and you answer by voice or text." },
      { property: "og:title", content: "Live AI mock interview" },
      { property: "og:description", content: "Camera on, questions asked one by one, answers captured by speech-to-text." },
    ],
  }),
  component: Practice,
});

type Stage = "setup" | "live" | "scoring";

function Practice() {
  const navigate = useNavigate();
  const getQuestions = useServerFn(generateQuestions);
  const score = useServerFn(scoreInterview);

  const [stage, setStage] = useState<Stage>("setup");
  const [role, setRole] = useState("Software Engineer");
  const [busy, setBusy] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [answer, setAnswer] = useState("");
  const [listening, setListening] = useState(false);
  const [camOn, setCamOn] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);

  const stopMedia = useCallback(() => {
    recognitionRef.current?.stop?.();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => stopMedia, [stopMedia]);

  function speak(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.98;
    window.speechSynthesis.speak(utter);
  }

  async function begin() {
    if (!role.trim()) {
      toast.error("Enter the role you're interviewing for");
      return;
    }
    setBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Your session expired — sign in again.");

      const { data: profile } = await supabase.from("profiles").select("skills").maybeSingle();
      const { questions: qs } = await getQuestions({ data: { role: role.trim(), skills: profile?.skills ?? [], count: 6 } });

      const { data: session, error } = await supabase
        .from("practice_sessions")
        .insert({ user_id: userId, role_title: role.trim(), status: "active" })
        .select("id")
        .single();
      if (error) throw error;

      setSessionId(session.id);
      setQuestions(qs);
      setAnswers([]);
      setIndex(0);
      setStage("live");
      setTimeout(() => {
        if (videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current;
        speak(qs[0]!);
      }, 100);
    } catch (err) {
      const message =
        err instanceof DOMException
          ? "We need camera and microphone access to run the interview. Allow access and try again."
          : err instanceof Error
            ? err.message
            : "Could not start the interview";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  function toggleMic() {
    const SR =
      typeof window !== "undefined" ? ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition) : undefined;
    if (!SR) {
      toast.error("Voice input isn't supported in this browser — type your answer instead.");
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
      for (let i = event.resultIndex; i < event.results.length; i++) transcript += event.results[i][0].transcript;
      setAnswer((prev) => (prev ? `${prev} ${transcript}`.trim() : transcript.trim()));
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  }

  function toggleCam() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamOn(track.enabled);
  }

  async function submitAnswer() {
    const text = answer.trim();
    if (!text) {
      toast.error("Answer the question before moving on");
      return;
    }
    recognitionRef.current?.stop?.();
    setListening(false);
    const nextAnswers = [...answers, text];
    setAnswers(nextAnswers);
    setAnswer("");

    if (sessionId) {
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        await supabase.from("practice_answers").insert({
          session_id: sessionId,
          user_id: userData.user.id,
          position: index,
          question: questions[index]!,
          answer: text,
        });
      }
    }

    if (index + 1 < questions.length) {
      const next = index + 1;
      setIndex(next);
      speak(questions[next]!);
    } else {
      await finish(nextAnswers);
    }
  }

  async function finish(finalAnswers: string[]) {
    if (!sessionId) return;
    setStage("scoring");
    stopMedia();
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    try {
      const qa = questions.slice(0, finalAnswers.length).map((q, i) => ({ question: q, answer: finalAnswers[i] ?? "" }));
      const report = await score({ data: { role, qa } });
      await supabase
        .from("practice_sessions")
        .update({
          status: "completed",
          overall_score: report.overall,
          communication: report.communication,
          confidence: report.confidence,
          clarity: report.clarity,
          relevance: report.relevance,
          summary: report.summary,
          strengths: report.strengths,
          suggestions: report.suggestions,
          completed_at: new Date().toISOString(),
        })
        .eq("id", sessionId);
      await navigate({ to: "/feedback/$id", params: { id: sessionId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not score the interview");
      setStage("live");
    }
  }

  if (stage === "setup") {
    return (
      <div className="min-h-screen bg-background">
        <AppNav />
        <main className="mx-auto max-w-xl px-4 py-10 sm:px-6">
          <h1 className="font-[family-name:var(--font-display)] text-3xl">Practice Interview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Six questions, asked out loud, on camera. Answer with your voice or type — you'll get a scored report at the end.
          </p>
          <div className="mt-6 space-y-4 rounded-xl border border-border bg-surface p-5">
            <div className="space-y-2">
              <Label htmlFor="role">Role you're interviewing for</Label>
              <Input id="role" value={role} onChange={(e) => setRole(e.target.value)} maxLength={120} />
            </div>
            <p className="text-xs text-muted-foreground">
              Your browser will ask for camera and microphone permission. Nothing is recorded or uploaded — only your typed or
              transcribed answers are saved.
            </p>
            <Button onClick={() => void begin()} disabled={busy} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              Allow camera & start interview
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (stage === "scoring") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Analysing your answers and building your report…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppNav />
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-xl border border-border bg-black">
            <video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full object-cover" />
            {!camOn ? (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">Camera off</div>
            ) : null}
            <span className="absolute top-3 left-3 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white">
              LIVE
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={toggleCam}>
              {camOn ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}
              {camOn ? "Camera on" : "Camera off"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => speak(questions[index]!)}>
              <Volume2 className="h-4 w-4" />
              Repeat question
            </Button>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => void finish(answers)}>
              <Square className="h-4 w-4" />
              End
            </Button>
          </div>
        </div>

        <div className="flex flex-col rounded-xl border border-border bg-surface p-5">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Question {index + 1} of {questions.length}
          </p>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(index / questions.length) * 100}%` }} />
          </div>
          <h1 className="mt-4 font-[family-name:var(--font-display)] text-xl leading-snug">{questions[index]}</h1>

          <Textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={listening ? "Listening… speak your answer" : "Speak with the mic button, or type your answer here."}
            className="mt-4 min-h-40 flex-1 resize-none"
          />
          <div className="mt-3 flex items-center gap-2">
            <Button type="button" variant={listening ? "destructive" : "outline"} onClick={toggleMic}>
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {listening ? "Stop recording" : "Answer by voice"}
            </Button>
            <Button className="ml-auto" onClick={() => void submitAnswer()} disabled={!answer.trim()}>
              <Send className="h-4 w-4" />
              {index + 1 === questions.length ? "Finish interview" : "Next question"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

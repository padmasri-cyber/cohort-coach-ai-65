import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { chatReply } from "@/lib/ai.functions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Msg = { id: string; role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "How do I answer 'tell me about yourself'?",
  "Tips to sound more confident on camera",
  "What should I ask the interviewer?",
];

export function AiChatbox({ className, compact = false }: { className?: string; compact?: boolean }) {
  const send = useServerFn(chatReply);
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [local, setLocal] = useState<Msg[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: history = [] } = useQuery({
    queryKey: ["chat-messages"],
    queryFn: async (): Promise<Msg[]> => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, role, content")
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      return (data ?? []).map((m) => ({ id: m.id, role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
    },
  });

  const messages = [...history, ...local];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, pending]);

  async function ask(text: string) {
    const question = text.trim();
    if (!question || pending) return;
    setInput("");
    setPending(true);
    setLocal((prev) => [...prev, { id: `tmp-${Date.now()}`, role: "user", content: question }]);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      const { reply } = await send({
        data: { messages: [...messages, { role: "user" as const, content: question }].map((m) => ({ role: m.role, content: m.content })) },
      });
      if (userId) {
        await supabase.from("chat_messages").insert([
          { user_id: userId, role: "user", content: question },
          { user_id: userId, role: "assistant", content: reply },
        ]);
      }
      setLocal([]);
      await queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
    } catch (err) {
      setLocal([]);
      setInput(question);
      toast.error(err instanceof Error ? err.message : "The AI coach is unavailable right now.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={cn("flex flex-col overflow-hidden rounded-xl border border-border bg-surface", className)}>
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">AI Coach</p>
        <span className="ml-auto text-xs text-muted-foreground">Interview tips & career doubts</span>
      </div>

      <div className={cn("flex-1 space-y-3 overflow-y-auto px-4 py-4", compact ? "max-h-80" : "min-h-64")}>
        {messages.length === 0 && !pending ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Ask me anything about interviews, resumes or your career.</p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => void ask(s)}
                className="block w-full rounded-md border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}

        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                m.role === "user"
                  ? "rounded-br-sm bg-primary text-primary-foreground"
                  : "rounded-bl-sm border border-border bg-background",
              )}
            >
              {m.role === "assistant" ? (
                <div className="prose prose-sm max-w-none dark:prose-invert [&_ul]:my-1 [&_p]:my-1">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}

        {pending ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
        className="flex gap-2 border-t border-border p-3"
      >
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask the AI coach…" maxLength={1000} />
        <Button type="submit" size="icon" disabled={pending || !input.trim()} aria-label="Send message">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

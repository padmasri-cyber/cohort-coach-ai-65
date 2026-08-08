import { createFileRoute } from "@tanstack/react-router";
import { AiChatbox } from "@/components/ai-chatbox";
import { AppNav } from "@/components/app-nav";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "AI Coach Chatbox — AI Interview Practice" },
      { name: "description", content: "Ask the AI coach for interview tips, resume advice and answers to career doubts." },
      { property: "og:title", content: "AI coach chatbox" },
      { property: "og:description", content: "Interview tips and career guidance from an AI coach, any time." },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppNav />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6">
        <h1 className="font-[family-name:var(--font-display)] text-3xl">AI Coach</h1>
        <p className="mt-1 text-sm text-muted-foreground">Interview tips, career doubts, anything you're unsure about.</p>
        <AiChatbox className="mt-6 min-h-[60vh] flex-1" />
      </main>
    </div>
  );
}

import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, BrainCircuit, LayoutDashboard, LogOut, MessageSquare, Mic, User } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/practice", label: "Practice Interview", icon: Mic },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/chat", label: "Chatbox", icon: MessageSquare },
] as const;

export function AppNav() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isDashboard = pathname === "/dashboard";

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <Link to="/dashboard" className="flex items-center gap-2 text-sm font-semibold">
          <BrainCircuit className="h-5 w-5 text-primary" />
          <span className="hidden sm:inline">AI Interview Practice</span>
        </Link>

        <nav className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto sm:order-none sm:mx-0 sm:w-auto">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                pathname === item.to && "bg-accent font-medium text-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {!isDashboard ? (
            <Button asChild size="sm" variant="outline">
              <Link to="/dashboard">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back to dashboard</span>
              </Link>
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={() => void signOut()} aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}

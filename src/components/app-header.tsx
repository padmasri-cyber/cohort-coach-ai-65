import { Link } from "@tanstack/react-router";
import { BrainCircuit } from "lucide-react";

export function AppHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link to="/dashboard" className="flex items-center gap-2 text-sm font-semibold">
          <BrainCircuit className="h-5 w-5 text-primary" />
          Cohort Interview Coach
        </Link>
        <div className="flex items-center gap-2">{right}</div>
      </div>
    </header>
  );
}

# AI Usage Log — Cohort Coach (AI Interview Practice)

This project was built using AI assistance across two tools: **Lovable** (primary app build) and **Claude** (debugging, deployment, and GitHub setup support).

## Built with Lovable

The core application — "AI Interview Practice" — was vibe-coded in Lovable, including:
- Landing page and dashboard
- Camera/mic-based mock interview flow
- Voice-to-text answer capture
- AI-scored feedback with breakdown
- AI coach chatbox
- Supabase integration for auth/data
- Security fixes (revoked open access on legacy cohort tables, per Lovable's security scan)

> Note: the original prompt-by-prompt history from the Lovable chat isn't captured here — if Lovable's project history/export is available, add it above this line for a complete log.

## Assisted with Claude

Claude was used alongside Lovable to:
1. Analyze the live app (`cohort-coach-ai-65.lovable.app`) and produce a standalone React + Tailwind reference build (`App.jsx`) covering the same screens (landing, auth, camera/mic setup, interview with speech-to-text, scored feedback, AI coach chat wired to the Claude API).
2. Walk through local environment setup and debugging in VS Code — Node.js installation, PowerShell execution policy fixes, Tailwind CSS configuration, and resolving a nested-folder project structure issue.
3. Guide deployment alternatives (StackBlitz, CodeSandbox, Bolt) when local setup proved difficult.
4. Guide connecting the Lovable project to GitHub via Lovable's built-in Git integration (Settings → Git), and reviewing repository visibility and `.env` contents for exposed secrets before making the repo public.
5. Draft this AI-usage log file for hackathon submission.

## Repository

- **Public GitHub repo:** https://github.com/padmasri-cyber/cohort-coach-ai-65
- **Live app:** https://cohort-coach-ai-65.lovable.app

# AI Interview Coach

Build "AI Cohort Interview Coach" — a web app that conducts personalized, 

multi-turn technical interviews for learners finishing a 31-day AI 

engineering cohort (topics: Retrieval-Augmented Generation, Vector 

Databases, Prompt Engineering, Agentic AI, Model Context Protocol, AI 

Deployment, Production AI Systems).

CORE PURPOSE

After the cohort, learners struggle to confidently explain the systems 

they built in a real interview. This app runs a realistic, adaptive mock 

interview based on each candidate's actual learning journey — not a 

scripted quiz — and ends with structured, actionable feedback.

DATA MODEL (Supabase tables)

1. curriculum_days

   - day (int), module (text), topic (text), objectives (text[]), 

     tools (text[]), key_concepts (text[])

   - Seed with ~12 representative days spanning all 7 modules (I'll 

     provide the full 31-day JSON later — build the schema to accept it 

     as-is)

2. candidates

   - candidate_id, name, email, completed_days (int[]), skipped_days (int[]), 

     attempts (jsonb, day -> attempt count), strong_topics (text[]), 

     weak_topics (text[]), projects (text[])

   - Seed with 2-3 sample candidates

3. interview_sessions

   - session_id, candidate_id, status (active/completed), 

     days_touched (int[]), created_at

   - No long-term history needed — sessions can be cleared after feedback 

     is generated, but keep them in the DB for the duration of the 

     interview so state survives page refreshes

4. interview_qa_log

   - session_id, day, question, answer, score (0-10), is_followup (bool), 

     created_at

   - This is what maintains conversation context and lets me compute 

     per-day breakdowns

PAGES / FLOW

1. Login (simple, no real auth)

   - Name + email fields

   - Maps to a candidate profile in Supabase (create one if it doesn't 

     exist, round-robin assign a demo profile otherwise)

   - Store candidateId in local state/localStorage — no Supabase Auth 

     needed, this is just a name-based session

2. Dashboard

   - Candidate's cohort progress: % days completed, progress bar

   - Strong topics vs weak/focus topics as badges

   - Projects they've built (from candidate profile)

   - "Start Mock Interview" and "Analyze My Resume" buttons

3. Interview Chat

   - Chat-bubble UI (interviewer left, candidate right), typing indicator

   - On load, call an edge function to start the session: picks curriculum 

     days weighted toward the candidate's completed days, attempted-more-

     than-once days, and weak topics; generates the first question

   - Each candidate answer is sent to an edge function that:

     a) scores the previous answer (0-10)

     b) decides whether to ask a follow-up question based on that specific 

        answer (vague/short answer → probe deeper; strong answer → move on 

        or add a "how would this scale in production" twist)

     c) if moving on, picks the next curriculum day and generates a new 

        question, grounded in that day's objectives/key_concepts and the 

        candidate's own projects where relevant

   - Track progress: must reach minimum 8 questions across minimum 4 

     distinct curriculum days before allowing the interview to end

   - Include a mic button using the browser's built-in Web Speech API for 

     optional voice-to-text answers (client-side only, no audio sent to 

     backend)

   - "End Interview" button (enabled once minimums are met) → calls an 

     edge function to generate final feedback, then navigates to feedback 

     page

4. Feedback Report

   - Overall score (0-10) with a short written summary

   - Strengths (topics scoring well)

   - Areas to improve (topics scoring low)

   - Per-day/per-topic score breakdown

   - "Start New Interview" and "Back to Dashboard" buttons

5. Resume Analysis (bonus)

   - Paste resume text or upload a .txt file

   - Edge function checks for cohort-relevant keywords/skills (RAG, vector 

     databases, LangChain, agents, MCP, Docker, deployment, etc.)

   - Returns matched skills, suggested additions, and a short note

BACKEND LOGIC (Supabase Edge Functions, calling an LLM via API)

- start-interview: selects curriculum days for the candidate (weighted by 

  completed days, attempts, weak topics), generates the opening question, 

  creates the session row

- respond-to-answer: scores the last answer, generates an adaptive 

  follow-up OR the next day's question, updates qa_log and days_touched, 

  returns progress info

- end-interview: reads the full qa_log for the session, computes overall 

  score and per-day averages, generates a written summary via LLM, returns 

  structured feedback JSON, marks session completed

- analyze-resume: keyword-matches resume text against cohort skills, 

  returns structured suggestions

Use an LLM (via the Lovable AI integration / OpenAI-compatible call) for: 

question generation grounded in the curriculum_days row, deciding whether 

a follow-up is warranted based on the previous answer's depth, scoring 

answers, and writing the final feedback summary. Fall back to simple 

template-based questions and keyword-based scoring if the LLM call fails, 

so the interview never breaks mid-session.

DESIGN

- Clean, professional, calm palette (blues/grays/whites) — should feel 

  like a real interview tool, not a game or chatbot toy

  - Clear progress indicators ("Question 5 · 3 days covered")

- Mobile-responsive but primarily used on desktop/laptop

EXPLICITLY NOT NEEDED

- Real user authentication or password login

- Persistent long-term conversation history beyond a single session

- Voice output / spoken questions (text only, mic input is optional and 

  client-side)

- Native mobile app

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://cohort-coach-ai-65.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/742a9404-94c2-4378-b950-f9b138876974).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

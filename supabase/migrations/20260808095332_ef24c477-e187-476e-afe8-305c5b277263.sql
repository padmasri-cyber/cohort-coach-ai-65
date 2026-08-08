
CREATE TABLE public.curriculum_days (
  day integer PRIMARY KEY,
  module text NOT NULL,
  topic text NOT NULL,
  objectives text[] NOT NULL DEFAULT '{}',
  tools text[] NOT NULL DEFAULT '{}',
  key_concepts text[] NOT NULL DEFAULT '{}'
);
GRANT SELECT ON public.curriculum_days TO anon, authenticated;
GRANT ALL ON public.curriculum_days TO service_role;
ALTER TABLE public.curriculum_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "curriculum readable by everyone" ON public.curriculum_days FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.candidates (
  candidate_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  completed_days integer[] NOT NULL DEFAULT '{}',
  skipped_days integer[] NOT NULL DEFAULT '{}',
  attempts jsonb NOT NULL DEFAULT '{}'::jsonb,
  strong_topics text[] NOT NULL DEFAULT '{}',
  weak_topics text[] NOT NULL DEFAULT '{}',
  projects text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.candidates TO anon, authenticated;
GRANT ALL ON public.candidates TO service_role;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "candidates readable" ON public.candidates FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "candidates insertable" ON public.candidates FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "candidates updatable" ON public.candidates FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.interview_sessions (
  session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(candidate_id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  days_touched integer[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_sessions TO anon, authenticated;
GRANT ALL ON public.interview_sessions TO service_role;
ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessions all access" ON public.interview_sessions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.interview_qa_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.interview_sessions(session_id) ON DELETE CASCADE,
  day integer,
  topic text,
  question text NOT NULL,
  answer text,
  score numeric,
  is_followup boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX interview_qa_log_session_idx ON public.interview_qa_log(session_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_qa_log TO anon, authenticated;
GRANT ALL ON public.interview_qa_log TO service_role;
ALTER TABLE public.interview_qa_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qa log all access" ON public.interview_qa_log FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.curriculum_days (day, module, topic, objectives, tools, key_concepts) VALUES
(1,'Prompt Engineering','Prompt Fundamentals & Structured Output',ARRAY['Write role/context/task prompts','Force structured JSON output','Evaluate prompt quality'],ARRAY['OpenAI API','Gemini','Python'],ARRAY['few-shot prompting','system prompts','JSON schema output','temperature']),
(3,'Prompt Engineering','Advanced Prompting & Chain-of-Thought',ARRAY['Apply reasoning prompts','Reduce hallucination','Design prompt evals'],ARRAY['LangChain','PromptLayer'],ARRAY['chain-of-thought','self-consistency','guardrails','prompt injection']),
(5,'Vector Databases','Embeddings & Similarity Search',ARRAY['Generate embeddings','Understand cosine similarity','Store vectors'],ARRAY['pgvector','sentence-transformers'],ARRAY['embedding dimensions','cosine vs dot product','ANN indexes','HNSW']),
(7,'Vector Databases','Production Vector Stores',ARRAY['Choose a vector DB','Tune index parameters','Handle metadata filtering'],ARRAY['Pinecone','Qdrant','Chroma'],ARRAY['IVF vs HNSW','hybrid search','metadata filters','namespace design']),
(9,'Retrieval-Augmented Generation','RAG Pipeline Basics',ARRAY['Chunk documents effectively','Build a retrieve-then-generate pipeline','Cite sources'],ARRAY['LangChain','LlamaIndex'],ARRAY['chunking strategy','top-k retrieval','context window budgeting','grounding']),
(12,'Retrieval-Augmented Generation','Advanced RAG & Evaluation',ARRAY['Implement re-ranking','Measure retrieval quality','Debug bad answers'],ARRAY['Cohere Rerank','RAGAS'],ARRAY['re-ranking','recall@k','faithfulness','query rewriting']),
(15,'Agentic AI','Tool-Using Agents',ARRAY['Define tools and schemas','Implement a ReAct loop','Handle tool errors'],ARRAY['LangGraph','OpenAI function calling'],ARRAY['ReAct','tool schemas','loop termination','state management']),
(18,'Agentic AI','Multi-Agent Systems & Memory',ARRAY['Coordinate multiple agents','Design memory layers','Control cost per run'],ARRAY['LangGraph','CrewAI'],ARRAY['planner-executor','short vs long term memory','handoffs','token budgeting']),
(21,'Model Context Protocol','MCP Fundamentals',ARRAY['Explain the MCP client/server model','Expose tools and resources','Connect an MCP client'],ARRAY['MCP SDK','Claude Desktop'],ARRAY['MCP servers','resources vs tools','transport (stdio/HTTP)','capability negotiation']),
(24,'Model Context Protocol','Building Production MCP Servers',ARRAY['Authenticate MCP clients','Version tool contracts','Test MCP servers'],ARRAY['MCP SDK','OAuth'],ARRAY['OAuth scopes','tool versioning','streaming responses','error contracts']),
(27,'AI Deployment','Serving & Containerizing AI Apps',ARRAY['Containerize an AI service','Stream responses','Manage secrets'],ARRAY['Docker','FastAPI','Cloud Run'],ARRAY['streaming SSE','cold starts','secret management','horizontal scaling']),
(31,'Production AI Systems','Observability, Cost & Reliability',ARRAY['Instrument LLM calls','Control cost and latency','Handle failures gracefully'],ARRAY['LangSmith','Prometheus','Redis'],ARRAY['tracing','caching','fallback models','rate limiting','evals in CI']);

INSERT INTO public.candidates (name, email, completed_days, skipped_days, attempts, strong_topics, weak_topics, projects) VALUES
('Aditi Sharma','aditi@example.com',ARRAY[1,3,5,7,9,12,15,18,21],ARRAY[24],'{"9":3,"12":2,"18":2}'::jsonb,ARRAY['Prompt Engineering','Vector Databases'],ARRAY['Agentic AI','Model Context Protocol'],ARRAY['Docs RAG chatbot over 500 PDFs','Resume screening agent']),
('Marcus Lee','marcus@example.com',ARRAY[1,3,5,9,15,18,21,24,27],ARRAY[7,12],'{"15":3,"21":2,"27":2}'::jsonb,ARRAY['Agentic AI','AI Deployment'],ARRAY['Vector Databases','Retrieval-Augmented Generation'],ARRAY['Multi-agent research assistant','Dockerized FastAPI inference API']),
('Priya Nair','priya@example.com',ARRAY[1,5,7,9,12,21,24,27,31],ARRAY[3,15],'{"27":3,"31":3,"12":2}'::jsonb,ARRAY['Production AI Systems','Retrieval-Augmented Generation'],ARRAY['Prompt Engineering','Agentic AI'],ARRAY['Observability dashboard for LLM traces','Hybrid search API with Qdrant']);

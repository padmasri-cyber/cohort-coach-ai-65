-- Remove permissive policies on legacy cohort tables
DROP POLICY IF EXISTS "candidates insertable" ON public.candidates;
DROP POLICY IF EXISTS "candidates readable" ON public.candidates;
DROP POLICY IF EXISTS "candidates updatable" ON public.candidates;
DROP POLICY IF EXISTS "sessions all access" ON public.interview_sessions;
DROP POLICY IF EXISTS "qa log all access" ON public.interview_qa_log;

ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_qa_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.candidates FROM anon, authenticated;
REVOKE ALL ON public.interview_sessions FROM anon, authenticated;
REVOKE ALL ON public.interview_qa_log FROM anon, authenticated;

GRANT ALL ON public.candidates TO service_role;
GRANT ALL ON public.interview_sessions TO service_role;
GRANT ALL ON public.interview_qa_log TO service_role;
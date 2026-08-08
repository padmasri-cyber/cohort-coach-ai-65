const KEY = "aicc_candidate";

export type StoredCandidate = { candidateId: string; name: string };

export function saveCandidate(value: StoredCandidate) {
  localStorage.setItem(KEY, JSON.stringify(value));
}

export function loadCandidate(): StoredCandidate | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredCandidate) : null;
  } catch {
    return null;
  }
}

export function clearCandidate() {
  localStorage.removeItem(KEY);
}

const SESSION_KEY = "aicc_session";

export function saveSessionId(id: string) {
  localStorage.setItem(SESSION_KEY, id);
}
export function loadSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_KEY);
}
export function clearSessionId() {
  localStorage.removeItem(SESSION_KEY);
}

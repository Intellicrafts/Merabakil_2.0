import type {
  AuthResponse,
  Category,
  ConversationTurn,
  IngestionJob,
  IngestionResult,
  KnowledgeDocument,
  KnowledgeGraph,
  Page,
  ResearchResponse,
  UploadDocumentResponse,
  UserDocument,
  AuthUser,
} from "@/lib/types";
import type {
  CourtroomActionsRequestPayload,
  MandatoryFact,
  OpponentFactDefense,
  ProposedAction,
  ProposedActionPlan,
} from "@/lib/courtroom/types";

export const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_API_URL ?? "http://localhost:8001";
export const INGESTION_URL =
  process.env.NEXT_PUBLIC_INGESTION_API_URL ?? "http://localhost:8002";
export const DOCUMENT_URL =
  process.env.NEXT_PUBLIC_DOCUMENT_API_URL ?? "http://localhost:8005";
export const RESEARCH_URL =
  process.env.NEXT_PUBLIC_RESEARCH_API_URL ?? "http://localhost:8004";

const TOKEN_KEY = "legalos.access_token";
const REFRESH_TOKEN_KEY = "legalos.refresh_token";
const USER_KEY = "legalos.user";

let refreshPromise: Promise<string> | null = null;

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

function setTokens(accessToken: string, refreshToken: string): void {
  window.localStorage.setItem(TOKEN_KEY, accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function setSession(auth: AuthResponse): void {
  setTokens(auth.tokens.access_token, auth.tokens.refresh_token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(auth.user));
}

export function clearSession(): void {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

function redirectToLogin(reason = "session-expired"): void {
  if (typeof window === "undefined") return;
  clearSession();
  const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
  window.location.assign(`/login?reason=${reason}&next=${next}`);
}

async function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    redirectToLogin("session-expired");
    throw new Error("Session expired. Please sign in again.");
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      const res = await fetch(`${AUTH_URL}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) {
        redirectToLogin("session-expired");
        throw new Error("Session expired. Please sign in again.");
      }
      const tokens = (await res.json()) as { access_token: string; refresh_token: string };
      setTokens(tokens.access_token, tokens.refresh_token);
      return tokens.access_token;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

async function authorizedFetch(url: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(url, { ...init, headers });
  if (res.status !== 401 || !retry) return res;

  await refreshAccessToken();
  const nextToken = getToken();
  if (!nextToken) throw new Error("Not authenticated");

  const retryHeaders = new Headers(init.headers);
  retryHeaders.set("Authorization", `Bearer ${nextToken}`);
  return fetch(url, { ...init, headers: retryHeaders });
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function updateStoredUser(patch: Partial<AuthUser>): AuthUser | null {
  const stored = getStoredUser();
  if (!stored) return null;
  const updated = { ...stored, ...patch };
  window.localStorage.setItem(USER_KEY, JSON.stringify(updated));
  return updated;
}

/** Refresh JWT from DB and merge latest roles/permissions into cached user. */
export async function syncStoredUser(): Promise<AuthUser | null> {
  const stored = getStoredUser();
  if (!stored) return null;
  try {
    await refreshAccessToken();
    const me = await apiFetch<Pick<AuthUser, "roles" | "permissions">>(
      `${AUTH_URL}/api/v1/users/me`,
      { headers: authHeaders() },
    );
    return updateStoredUser({ roles: me.roles, permissions: me.permissions });
  } catch {
    return stored;
  }
}

async function parseError(res: Response): Promise<never> {
  let message = `Request failed (${res.status})`;
  try {
    const body = await res.json();
    if (typeof body.message === "string") {
      message = body.message;
    } else if (typeof body.detail === "string") {
      message = body.detail;
    } else if (Array.isArray(body.detail)) {
      message = body.detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join("; ") || message;
    }
  } catch {
    /* ignore */
  }
  if (res.status === 401) {
    message = "Invalid email or password.";
  } else if (res.status === 409) {
    message =
      message.includes("already exists")
        ? "An account with this email already exists. Please sign in instead."
        : message;
  }
  throw new Error(message);
}

function authHeaders(json = true): HeadersInit {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await authorizedFetch(url, init ?? {});
  if (!res.ok) return parseError(res);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  let res: Response;
  try {
    res = await fetch(`${AUTH_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error(
      `Cannot reach auth service at ${AUTH_URL}. Start the backend with: make native`,
    );
  }
  if (!res.ok) return parseError(res);
  return res.json();
}

export async function register(
  email: string,
  full_name: string,
  password: string,
  role: string,
): Promise<AuthResponse> {
  let res: Response;
  try {
    res = await fetch(`${AUTH_URL}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, full_name, password, role }),
    });
  } catch {
    throw new Error(
      `Cannot reach auth service at ${AUTH_URL}. Start the backend with: make native`,
    );
  }
  if (!res.ok) return parseError(res);
  return res.json();
}

export async function requestPasswordReset(email: string): Promise<void> {
  const res = await fetch(`${AUTH_URL}/api/v1/auth/password-reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) return parseError(res);
}

export async function confirmPasswordReset(
  token: string,
  newPassword: string,
): Promise<void> {
  const res = await fetch(`${AUTH_URL}/api/v1/auth/password-reset/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, new_password: newPassword }),
  });
  if (!res.ok) return parseError(res);
}

export async function listUsers(page = 1, size = 20): Promise<Page<AuthUser>> {
  return apiFetch(`${AUTH_URL}/api/v1/users?page=${page}&size=${size}`, {
    headers: authHeaders(),
  });
}

export async function listCategories(): Promise<Category[]> {
  return apiFetch(`${INGESTION_URL}/api/v1/knowledge/categories`, {
    headers: authHeaders(),
  });
}

export async function listKnowledgeDocuments(
  page = 1,
  size = 20,
  docType?: string,
): Promise<Page<KnowledgeDocument>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (docType) params.set("doc_type", docType);
  return apiFetch(`${INGESTION_URL}/api/v1/knowledge/documents?${params}`, {
    headers: authHeaders(),
  });
}

export async function listIngestionJobs(page = 1, size = 20): Promise<Page<IngestionJob>> {
  return apiFetch(`${INGESTION_URL}/api/v1/knowledge/jobs?page=${page}&size=${size}`, {
    headers: authHeaders(),
  });
}

export async function getJob(jobId: string): Promise<IngestionJob> {
  return apiFetch(`${INGESTION_URL}/api/v1/knowledge/jobs/${jobId}`, {
    headers: authHeaders(),
  });
}

export async function getKnowledgeGraph(limit = 200): Promise<KnowledgeGraph> {
  return apiFetch(`${INGESTION_URL}/api/v1/knowledge/graph?limit=${limit}`, {
    headers: authHeaders(),
  });
}

export async function uploadDocument(
  file: File,
  meta: { title: string; doc_type: string; jurisdiction?: string; async_mode?: boolean },
): Promise<UploadDocumentResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("title", meta.title);
  form.append("doc_type", meta.doc_type);
  if (meta.jurisdiction) form.append("jurisdiction", meta.jurisdiction);
  form.append("async_mode", String(meta.async_mode ?? false));

  const res = await authorizedFetch(`${INGESTION_URL}/api/v1/knowledge/documents/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) return parseError(res);
  const data = await res.json();
  if (res.status === 202) return { kind: "job", data: data as IngestionJob };
  return { kind: "result", data: data as IngestionResult };
}

export async function listUserDocuments(
  page = 1,
  size = 20,
): Promise<Page<UserDocument>> {
  return apiFetch(`${DOCUMENT_URL}/api/v1/documents?page=${page}&size=${size}`, {
    headers: authHeaders(),
  });
}

export async function getUserDocument(documentId: string): Promise<UserDocument> {
  return apiFetch(`${DOCUMENT_URL}/api/v1/documents/${documentId}`, {
    headers: authHeaders(),
  });
}

export async function uploadUserDocument(
  file: File,
  meta: { title: string; doc_type?: string },
): Promise<UserDocument> {
  const form = new FormData();
  form.append("file", file);
  form.append("title", meta.title);
  form.append("doc_type", meta.doc_type ?? "user_upload");

  const res = await authorizedFetch(`${DOCUMENT_URL}/api/v1/documents/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) return parseError(res);
  return res.json();
}

export async function runResearch(
  query: string,
  jurisdiction?: string,
  history: ConversationTurn[] = [],
): Promise<ResearchResponse> {
  return apiFetch(`${RESEARCH_URL}/api/v1/research`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ query, jurisdiction: jurisdiction || null, history }),
  });
}

export interface ResearchStreamHandlers {
  onStatus?: (stage: string, message: string) => void;
  onToken?: (text: string) => void;
}

function parseSseBlock(block: string): { event: string; data: string } | null {
  let event = "message";
  let data = "";
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  return data ? { event, data } : null;
}

export async function streamResearch(
  query: string,
  jurisdiction: string | undefined,
  history: ConversationTurn[],
  handlers: ResearchStreamHandlers,
  options?: { documentId?: string; signal?: AbortSignal },
): Promise<ResearchResponse> {
  const path = options?.documentId
    ? `/api/v1/research/document/${options.documentId}/stream`
    : "/api/v1/research/stream";

  const res = await authorizedFetch(`${RESEARCH_URL}${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ query, jurisdiction: jurisdiction || null, history }),
    signal: options?.signal,
  });

  if (!res.ok) return parseError(res);
  if (!res.body) throw new Error("No stream returned from research service");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: ResearchResponse | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const parsed = parseSseBlock(block);
      if (!parsed) continue;
      if (parsed.event === "status") {
        const payload = JSON.parse(parsed.data) as { stage: string; message: string };
        handlers.onStatus?.(payload.stage, payload.message);
      } else if (parsed.event === "token") {
        const payload = JSON.parse(parsed.data) as { text: string };
        handlers.onToken?.(payload.text);
      } else if (parsed.event === "error") {
        const payload = JSON.parse(parsed.data) as { message?: string };
        if (!result) {
          throw new Error(
            payload.message ??
              "Research service encountered an error while generating the answer.",
          );
        }
      } else if (parsed.event === "done") {
        const payload = JSON.parse(parsed.data) as ResearchResponse;
        result = {
          ...payload,
          web_sources: payload.web_sources ?? [],
          web_images: payload.web_images ?? [],
          suggestions: payload.suggestions ?? [],
          disclaimer:
            payload.disclaimer ??
            "This response is generated by an AI system for informational purposes only and does not constitute legal advice.",
        };
      }
    }
  }

  if (!result) {
    throw new Error(
      "Research stream ended before a complete answer was returned. Check that the research service is running and your LLM API key is valid.",
    );
  }
  return result;
}

export async function runDocumentResearch(
  documentId: string,
  query: string,
  jurisdiction?: string,
  history: ConversationTurn[] = [],
): Promise<ResearchResponse> {
  return apiFetch(`${RESEARCH_URL}/api/v1/research/document/${documentId}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      query,
      jurisdiction: jurisdiction || null,
      scope: "document",
      history,
    }),
  });
}

export interface ReadAloudStream {
  reader: ReadableStreamDefaultReader<Uint8Array>;
  sampleRate: number;
}

export async function streamReadAloud(
  text: string,
  options?: { signal?: AbortSignal; language?: string },
): Promise<ReadAloudStream> {
  const res = await authorizedFetch(`${RESEARCH_URL}/api/v1/research/tts/stream`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      text,
      rewrite_for_speech: true,
      language: options?.language ?? "en-IN",
    }),
    signal: options?.signal,
  });
  if (!res.ok) return parseError(res);
  if (!res.body) throw new Error("No audio stream returned");

  const sampleRate = Number(res.headers.get("X-Audio-Sample-Rate") ?? 24000);
  return {
    reader: res.body.getReader(),
    sampleRate: Number.isFinite(sampleRate) ? sampleRate : 24000,
  };
}

function mapProposedAction(raw: Record<string, unknown>): ProposedAction {
  const ctaRaw = raw.cta as Record<string, unknown> | null | undefined;
  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? ""),
    description: String(raw.description ?? ""),
    side: (raw.side as ProposedAction["side"]) || "both",
    priority: (raw.priority as ProposedAction["priority"]) || "medium",
    timeframe: (raw.timeframe as ProposedAction["timeframe"]) || "7d",
    category: (raw.category as ProposedAction["category"]) || "procedure",
    rationale: String(raw.rationale ?? ""),
    relatedIssueIds: (raw.relatedIssueIds as string[] | undefined) ??
      (raw.related_issue_ids as string[] | undefined) ??
      [],
    cta: ctaRaw
      ? {
          kind:
            ctaRaw.kind === "research" || ctaRaw.kind === "mera_vakil" || ctaRaw.kind === "copy"
              ? ctaRaw.kind
              : "copy",
          query: ctaRaw.query != null ? String(ctaRaw.query) : undefined,
        }
      : null,
  };
}

function mapMandatoryFact(raw: Record<string, unknown>): MandatoryFact {
  return {
    id: String(raw.id ?? ""),
    fact: String(raw.fact ?? ""),
    whyMandatory: String(raw.whyMandatory ?? raw.why_mandatory ?? ""),
    howToProve: String(raw.howToProve ?? raw.how_to_prove ?? ""),
    side: (raw.side as MandatoryFact["side"]) || "petitioner",
    relatedIssueIds:
      (raw.relatedIssueIds as string[] | undefined) ??
      (raw.related_issue_ids as string[] | undefined) ??
      [],
  };
}

function mapOpponentDefense(raw: Record<string, unknown>): OpponentFactDefense {
  return {
    id: String(raw.id ?? ""),
    opponentFact: String(raw.opponentFact ?? raw.opponent_fact ?? ""),
    defenseStrategy: String(raw.defenseStrategy ?? raw.defense_strategy ?? ""),
    evidenceNeeded: String(raw.evidenceNeeded ?? raw.evidence_needed ?? ""),
    side: (raw.side as OpponentFactDefense["side"]) || "petitioner",
    relatedIssueIds:
      (raw.relatedIssueIds as string[] | undefined) ??
      (raw.related_issue_ids as string[] | undefined) ??
      [],
  };
}

export async function proposeCourtroomActions(
  payload: CourtroomActionsRequestPayload,
): Promise<ProposedActionPlan> {
  const data = await apiFetch(`${RESEARCH_URL}/api/v1/research/courtroom/actions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const raw = data as Record<string, unknown>;
  const actionsRaw = (raw.actions as Record<string, unknown>[] | undefined) ?? [];
  const anglesRaw =
    (raw.researchAngles as { title?: string; query?: string }[] | undefined) ??
    (raw.research_angles as { title?: string; query?: string }[] | undefined) ??
    [];
  const mandatoryRaw =
    (raw.mandatoryFacts as Record<string, unknown>[] | undefined) ??
    (raw.mandatory_facts as Record<string, unknown>[] | undefined) ??
    [];
  const defenseRaw =
    (raw.opponentFactDefenses as Record<string, unknown>[] | undefined) ??
    (raw.opponent_fact_defenses as Record<string, unknown>[] | undefined) ??
    [];

  return {
    headline: String(raw.headline ?? "Post-hearing action plan"),
    summary: String(raw.summary ?? ""),
    forumHint: (raw.forumHint as string | null | undefined) ??
      (raw.forum_hint as string | null | undefined) ??
      null,
    limitationFlags:
      (raw.limitationFlags as string[] | undefined) ??
      (raw.limitation_flags as string[] | undefined) ??
      [],
    actions: actionsRaw.map(mapProposedAction),
    mandatoryFacts: mandatoryRaw.map(mapMandatoryFact).filter((f) => f.fact.trim()),
    opponentFactDefenses: defenseRaw
      .map(mapOpponentDefense)
      .filter((d) => d.opponentFact.trim()),
    documentsToGather:
      (raw.documentsToGather as string[] | undefined) ??
      (raw.documents_to_gather as string[] | undefined) ??
      [],
    researchAngles: anglesRaw
      .filter((a) => a.title && a.query)
      .map((a) => ({ title: String(a.title), query: String(a.query) })),
    settlementLevers:
      (raw.settlementLevers as string[] | undefined) ??
      (raw.settlement_levers as string[] | undefined) ??
      [],
    disclaimer: String(
      raw.disclaimer ??
        "AI courtroom simulation output — not legal advice.",
    ),
  };
}

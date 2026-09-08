import type {
  AuthResponse,
  CaseBriefExtraction,
  CaseShare,
  CaseStatus,
  Category,
  ConversationTurn,
  GoogleAuthResult,
  IngestionJob,
  IngestionResult,
  KnowledgeDocument,
  KnowledgeGraph,
  LegalCase,
  Page,
  ResearchResponse,
  UploadDocumentResponse,
  UserDocument,
  AuthUser,
  WalletBalance,
  WalletTransaction,
  WalletTransactionList,
} from "@/lib/types";
import type {
  AppointmentMessage,
  AppointmentRecord,
  JoinStateDto,
  RankedMarketplaceLawyer,
  RoomTokenResponse,
} from "@/lib/appointment-types";

import { clearAvatarUrl } from "@/lib/avatar";
import {
  authServiceUrl,
  billingServiceUrl,
  caseServiceUrl,
  documentServiceUrl,
  ingestionServiceUrl,
  marketplaceServiceUrl,
  researchServiceUrl,
} from "@/lib/service-urls";

const TOKEN_KEY = "legalos.access_token";
const REFRESH_TOKEN_KEY = "legalos.refresh_token";
const USER_KEY = "legalos.user";

let refreshPromise: Promise<string> | null = null;

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

/** Returns a valid (non-expired) access token, refreshing automatically if needed. */
export async function ensureFreshToken(): Promise<string | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const exp = JSON.parse(atob(token.split(".")[1]))?.exp as number | undefined;
    if (exp && exp * 1000 > Date.now() + 30_000) return token; // still fresh
  } catch {}
  return refreshAccessToken().catch(() => null);
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
  clearAvatarUrl();
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
      const res = await fetch(`${authServiceUrl()}/api/v1/auth/refresh`, {
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
      `${authServiceUrl()}/api/v1/users/me`,
      { headers: authHeaders() },
    );
    return updateStoredUser({ roles: me.roles, permissions: me.permissions });
  } catch {
    return stored;
  }
}

const AUTH_OFFLINE_MESSAGE =
  "Auth service is offline. From the project root run: make native";

function isProxyOrOfflineStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
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
    } else if (body.detail && typeof body.detail === "object") {
      const detail = body.detail as { message?: string; join_state?: string };
      if (typeof detail.message === "string") message = detail.message;
      else if (typeof detail.join_state === "string") message = `Join window is ${detail.join_state}`;
    }
  } catch {
    /* ignore */
  }
  if (isProxyOrOfflineStatus(res.status) || (res.status === 500 && message.startsWith("Request failed"))) {
    throw new Error(AUTH_OFFLINE_MESSAGE);
  }
  if (res.status === 401 && message.startsWith("Request failed")) {
    message = "Invalid email or password.";
  } else if (res.status === 409) {
    message =
      message.includes("already exists")
        ? "An account with this email already exists. Please sign in instead."
        : message;
  }
  throw new Error(message);
}

async function postAuthJson<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${authServiceUrl()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(AUTH_OFFLINE_MESSAGE);
  }
  if (!res.ok) return parseError(res);
  return res.json();
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

export async function probeAuthService(): Promise<boolean> {
  try {
    const res = await fetch(`${authServiceUrl()}/health`, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  return postAuthJson<AuthResponse>("/api/v1/auth/login", { email, password });
}

export async function register(
  email: string,
  full_name: string,
  password: string,
  role: string,
): Promise<AuthResponse> {
  return postAuthJson<AuthResponse>("/api/v1/auth/register", {
    email,
    full_name,
    password,
    role,
  });
}

export async function loginWithGoogle(idToken: string): Promise<GoogleAuthResult> {
  return postAuthJson<GoogleAuthResult>("/api/v1/auth/google", { id_token: idToken });
}

export async function completeGoogleRegistration(
  onboardingToken: string,
  role: string,
): Promise<AuthResponse> {
  return postAuthJson<AuthResponse>("/api/v1/auth/google/complete", {
    onboarding_token: onboardingToken,
    role,
  });
}

export async function requestPasswordReset(email: string): Promise<void> {
  const res = await fetch(`${authServiceUrl()}/api/v1/auth/password-reset`, {
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
  const res = await fetch(`${authServiceUrl()}/api/v1/auth/password-reset/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, new_password: newPassword }),
  });
  if (!res.ok) return parseError(res);
}

export async function listUsers(page = 1, size = 20): Promise<Page<AuthUser>> {
  return apiFetch(`${authServiceUrl()}/api/v1/users?page=${page}&size=${size}`, {
    headers: authHeaders(),
  });
}

export async function listCategories(): Promise<Category[]> {
  return apiFetch(`${ingestionServiceUrl()}/api/v1/knowledge/categories`, {
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
  return apiFetch(`${ingestionServiceUrl()}/api/v1/knowledge/documents?${params}`, {
    headers: authHeaders(),
  });
}

export async function listIngestionJobs(page = 1, size = 20): Promise<Page<IngestionJob>> {
  return apiFetch(`${ingestionServiceUrl()}/api/v1/knowledge/jobs?page=${page}&size=${size}`, {
    headers: authHeaders(),
  });
}

export async function getJob(jobId: string): Promise<IngestionJob> {
  return apiFetch(`${ingestionServiceUrl()}/api/v1/knowledge/jobs/${jobId}`, {
    headers: authHeaders(),
  });
}

export async function getKnowledgeGraph(limit = 200): Promise<KnowledgeGraph> {
  return apiFetch(`${ingestionServiceUrl()}/api/v1/knowledge/graph?limit=${limit}`, {
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

  const res = await authorizedFetch(`${ingestionServiceUrl()}/api/v1/knowledge/documents/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) return parseError(res);
  const data = await res.json();
  if (res.status === 202) return { kind: "job", data: data as IngestionJob };
  return { kind: "result", data: data as IngestionResult };
}

export async function reindexKnowledgeDocument(
  documentId: string,
  force = true,
): Promise<IngestionResult> {
  const params = new URLSearchParams({ force: String(force) });
  return apiFetch(
    `${ingestionServiceUrl()}/api/v1/knowledge/documents/${documentId}/reindex?${params}`,
    {
      method: "POST",
      headers: authHeaders(),
    },
  );
}

export async function reindexKnowledgeSource(
  sourceUri: string,
  force = true,
): Promise<IngestionResult> {
  return apiFetch(`${ingestionServiceUrl()}/api/v1/knowledge/sources/reindex`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ source_uri: sourceUri, force }),
  });
}

export async function listUserDocuments(
  page = 1,
  size = 20,
  caseId?: string | null,
): Promise<Page<UserDocument>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (caseId) params.set("case_id", caseId);
  return apiFetch(`${documentServiceUrl()}/api/v1/documents?${params}`, {
    headers: authHeaders(),
  });
}

export async function listCaseDocuments(caseId: string): Promise<UserDocument[]> {
  return apiFetch<UserDocument[]>(`${documentServiceUrl()}/api/v1/documents/case/${encodeURIComponent(caseId)}`, {
    headers: authHeaders(),
  });
}

export async function uploadCaseDocument(
  caseId: string,
  file: File,
  meta: { title: string; doc_type: string },
): Promise<UserDocument> {
  const form = new FormData();
  form.append("file", file);
  form.append("title", meta.title);
  form.append("doc_type", meta.doc_type);
  form.append("case_id", caseId);

  const res = await authorizedFetch(`${documentServiceUrl()}/api/v1/documents/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) return parseError(res);
  return res.json();
}

export async function getUserDocument(documentId: string): Promise<UserDocument> {
  return apiFetch(`${documentServiceUrl()}/api/v1/documents/${documentId}`, {
    headers: authHeaders(),
  });
}

export async function uploadUserDocument(
  file: File,
  meta: { title: string; doc_type?: string },
  onProgress?: (percent: number) => void,
): Promise<UserDocument> {
  if (onProgress) {
    return uploadUserDocumentWithProgress(file, meta, onProgress);
  }
  const form = new FormData();
  form.append("file", file);
  form.append("title", meta.title);
  form.append("doc_type", meta.doc_type ?? "user_upload");

  const res = await authorizedFetch(`${documentServiceUrl()}/api/v1/documents/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) return parseError(res);
  return res.json();
}

export async function uploadUserDocumentWithProgress(
  file: File,
  meta: { title: string; doc_type?: string },
  onProgress: (percent: number) => void,
): Promise<UserDocument> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const form = new FormData();
  form.append("file", file);
  form.append("title", meta.title);
  form.append("doc_type", meta.doc_type ?? "user_upload");

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${documentServiceUrl()}/api/v1/documents/upload`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.min(95, Math.round((event.loaded / event.total) * 90)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        try {
          resolve(JSON.parse(xhr.responseText) as UserDocument);
        } catch {
          reject(new Error("Upload succeeded but the response was invalid."));
        }
        return;
      }
      try {
        const body = JSON.parse(xhr.responseText) as { message?: string; detail?: string };
        reject(new Error(body.message || body.detail || `Upload failed (${xhr.status})`));
      } catch {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Could not reach the document service."));
    xhr.send(form);
  });
}

export async function getDocumentText(
  documentId: string,
): Promise<{ text: string; title: string; status: string; filename?: string | null }> {
  return apiFetch(`${documentServiceUrl()}/api/v1/documents/${documentId}/text`, {
    headers: authHeaders(),
  });
}

export async function fetchDocumentFile(documentId: string): Promise<Blob> {
  const res = await authorizedFetch(`${documentServiceUrl()}/api/v1/documents/${documentId}/file`, {
    headers: authHeaders(false),
  });
  if (!res.ok) return parseError(res);
  return res.blob();
}

export async function runResearch(
  query: string,
  jurisdiction?: string,
  history: ConversationTurn[] = [],
): Promise<ResearchResponse> {
  return apiFetch(`${researchServiceUrl()}/api/v1/research`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ query, jurisdiction: jurisdiction || null, history }),
  });
}

export interface ResearchStreamHandlers {
  onStatus?: (stage: string, message: string) => void;
  onToken?: (text: string) => void;
  /** Fired as soon as citations are ready — before suggestions arrive. */
  onCitations?: (result: ResearchResponse) => void;
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

export async function attachDocumentToSession(
  sessionId: string,
  documentId: string,
): Promise<void> {
  const res = await authorizedFetch(
    `${researchServiceUrl()}/api/v1/research/sessions/${sessionId}/documents`,
    {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ document_id: documentId }),
    },
  );
  if (!res.ok) return parseError(res);
}

export async function detachDocumentFromSession(
  sessionId: string,
  documentId: string,
): Promise<void> {
  await authorizedFetch(
    `${researchServiceUrl()}/api/v1/research/sessions/${sessionId}/documents/${documentId}`,
    { method: "DELETE", headers: authHeaders() },
  );
}

export async function streamResearch(
  query: string,
  jurisdiction: string | undefined,
  history: ConversationTurn[],
  handlers: ResearchStreamHandlers,
  options?: { documentId?: string; documentIds?: string[]; signal?: AbortSignal; sessionId?: string },
): Promise<ResearchResponse> {
  // documentId triggers exclusive document-scoped search (e.g. document detail page).
  // Saarthi chat uses server-side session documents instead — do not pass documentId there.
  const path = options?.documentId
    ? `/api/v1/research/document/${options.documentId}/stream`
    : "/api/v1/research/stream";

  const user = getStoredUser();
  const res = await authorizedFetch(`${researchServiceUrl()}${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      query,
      jurisdiction: jurisdiction || null,
      history,
      session_id: options?.sessionId ?? null,
      user_id: user?.user_id ?? null,
      document_ids: options?.documentIds?.length ? options.documentIds : undefined,
    }),
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
      } else if (parsed.event === "citations") {
        const payload = JSON.parse(parsed.data) as ResearchResponse;
        const citationsResult: ResearchResponse = {
          ...payload,
          web_sources: payload.web_sources ?? [],
          web_images: payload.web_images ?? [],
          suggestions: [],
          disclaimer:
            payload.disclaimer ??
            "This response is generated by an AI system for informational purposes only and does not constitute legal advice.",
        };
        handlers.onCitations?.(citationsResult);
        result = citationsResult;
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
  return apiFetch(`${researchServiceUrl()}/api/v1/research/document/${documentId}`, {
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
  options?: { signal?: AbortSignal; language?: string; rewriteForSpeech?: boolean },
): Promise<ReadAloudStream> {
  const res = await authorizedFetch(`${researchServiceUrl()}/api/v1/research/tts/stream`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      text,
      rewrite_for_speech: options?.rewriteForSpeech ?? true,
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


export async function fetchMarketplaceLawyers(params: {
  query?: string;
  practiceArea?: string;
  city?: string;
  verified?: boolean;
} = {}): Promise<RankedMarketplaceLawyer[]> {
  const qs = new URLSearchParams();
  if (params.query) qs.set("query", params.query);
  if (params.practiceArea) qs.set("practice_area", params.practiceArea);
  if (params.city) qs.set("city", params.city);
  qs.set("verified", String(params.verified ?? true));
  return apiFetch<RankedMarketplaceLawyer[]>(`${marketplaceServiceUrl()}/api/v1/lawyers?${qs.toString()}`);
}

export async function matchMarketplaceLawyers(body: {
  practice_areas: string[];
  city?: string;
  limit?: number;
}): Promise<RankedMarketplaceLawyer[]> {
  return apiFetch<RankedMarketplaceLawyer[]>(`${marketplaceServiceUrl()}/api/v1/lawyers/match`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
}

export async function bookAppointment(body: {
  lawyer_id: string;
  date: string;
  time_slot: string;
  matter_summary: string;
  source?: "ai_match" | "manual";
  citizen_name?: string;
  case_id?: string | null;
}): Promise<AppointmentRecord> {
  return apiFetch<AppointmentRecord>(`${marketplaceServiceUrl()}/api/v1/appointments`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
}

export async function listAppointments(): Promise<AppointmentRecord[]> {
  return apiFetch<AppointmentRecord[]>(`${marketplaceServiceUrl()}/api/v1/appointments`);
}

export async function listAppointmentsByCaseId(caseId: string): Promise<AppointmentRecord[]> {
  return apiFetch<AppointmentRecord[]>(
    `${marketplaceServiceUrl()}/api/v1/appointments?case_id=${encodeURIComponent(caseId)}`,
  );
}

export async function getAppointment(id: string): Promise<AppointmentRecord> {
  return apiFetch<AppointmentRecord>(`${marketplaceServiceUrl()}/api/v1/appointments/${id}`);
}

export async function getAppointmentJoinState(id: string): Promise<JoinStateDto> {
  return apiFetch<JoinStateDto>(`${marketplaceServiceUrl()}/api/v1/appointments/${id}/join-state`);
}

export async function confirmAppointment(id: string): Promise<AppointmentRecord> {
  return apiFetch<AppointmentRecord>(`${marketplaceServiceUrl()}/api/v1/appointments/${id}/confirm`, {
    method: "POST",
    headers: authHeaders(),
  });
}

export async function cancelAppointment(id: string): Promise<AppointmentRecord> {
  return apiFetch<AppointmentRecord>(`${marketplaceServiceUrl()}/api/v1/appointments/${id}/cancel`, {
    method: "POST",
    headers: authHeaders(),
  });
}

export async function rejectAppointment(id: string, reason: string): Promise<AppointmentRecord> {
  return apiFetch<AppointmentRecord>(`${marketplaceServiceUrl()}/api/v1/appointments/${id}/reject`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
}

export async function fetchRoomToken(id: string): Promise<RoomTokenResponse> {
  try {
    return await apiFetch<RoomTokenResponse>(`${marketplaceServiceUrl()}/api/v1/appointments/${id}/room-token`, {
      method: "POST",
      headers: authHeaders(),
    });
  } catch (err) {
    const message = (err as Error).message ?? "";
    if (message.includes("503") || message.toLowerCase().includes("livekit")) {
      return { token: null, url: null, room: `apt-${id}`, configured: false, mode: "polling" };
    }
    throw err;
  }
}

export async function listAppointmentMessages(id: string, after?: string): Promise<AppointmentMessage[]> {
  const qs = after && !after.startsWith("tmp-") ? `?after=${encodeURIComponent(after)}` : "";
  return apiFetch<AppointmentMessage[]>(`${marketplaceServiceUrl()}/api/v1/appointments/${id}/messages${qs}`);
}

export async function postAppointmentMessage(id: string, body: string): Promise<AppointmentMessage> {
  return apiFetch<AppointmentMessage>(`${marketplaceServiceUrl()}/api/v1/appointments/${id}/messages`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ body }),
  });
}

export async function reactAppointmentMessage(
  appointmentId: string,
  messageId: string,
  emoji: string,
): Promise<{ id: string; reactions: Record<string, string[]> }> {
  return apiFetch(`${marketplaceServiceUrl()}/api/v1/appointments/${appointmentId}/messages/${messageId}/reactions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ emoji }),
  });
}

export async function summonAppointmentOpponent(id: string): Promise<JoinStateDto> {
  return apiFetch<JoinStateDto>(`${marketplaceServiceUrl()}/api/v1/appointments/${id}/summon`, {
    method: "POST",
    headers: authHeaders(),
  });
}

export async function dismissAppointmentSummon(id: string): Promise<JoinStateDto> {
  return apiFetch<JoinStateDto>(`${marketplaceServiceUrl()}/api/v1/appointments/${id}/summon/dismiss`, {
    method: "POST",
    headers: authHeaders(),
  });
}

export async function leaveAppointment(id: string): Promise<{ ok: boolean }> {
  return apiFetch(`${marketplaceServiceUrl()}/api/v1/appointments/${id}/leave`, {
    method: "POST",
    headers: authHeaders(),
  });
}

export async function fetchAppointmentTranscript(
  id: string,
): Promise<{ appointment: AppointmentRecord; messages: AppointmentMessage[] }> {
  return apiFetch(`${marketplaceServiceUrl()}/api/v1/appointments/${id}/transcript`);
}

export async function markAppointmentRead(id: string, messageId?: string): Promise<void> {
  const qs = messageId ? `?message_id=${messageId}` : "";
  await apiFetch(`${marketplaceServiceUrl()}/api/v1/appointments/${id}/read${qs}`, {
    method: "POST",
    headers: authHeaders(),
  });
}

export async function postAppointmentTyping(id: string, on = true): Promise<void> {
  await apiFetch(`${marketplaceServiceUrl()}/api/v1/appointments/${id}/typing`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ on }),
  });
}

export async function uploadAppointmentAttachment(
  id: string,
  file: File,
  opts: { caption?: string; kind?: "document" | "image" | "screenshot" | "voice" } = {},
): Promise<AppointmentMessage> {
  const form = new FormData();
  form.append("file", file);
  form.append("caption", opts.caption ?? "");
  form.append("kind", opts.kind ?? (file.type.startsWith("image/") ? "image" : "document"));
  const res = await authorizedFetch(`${marketplaceServiceUrl()}/api/v1/appointments/${id}/attachments`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) return parseError(res);
  return res.json();
}

export async function fetchAppointmentAttachmentBlob(appointmentId: string, attachmentId: string): Promise<Blob> {
  const res = await authorizedFetch(
    `${marketplaceServiceUrl()}/api/v1/appointments/${appointmentId}/attachments/${attachmentId}`,
  );
  if (!res.ok) return parseError(res);
  return res.blob();
}

export async function recordAppointmentCallEvent(
  id: string,
  type: "started" | "ended",
  talkSeconds = 0,
): Promise<void> {
  await apiFetch(`${marketplaceServiceUrl()}/api/v1/appointments/${id}/call-event`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ type, talk_seconds: talkSeconds }),
  });
}

export async function ringAppointmentCall(
  id: string,
  mode: "audio" | "video",
): Promise<import("@/lib/appointment-types").IncomingCallPayload> {
  return apiFetch(`${marketplaceServiceUrl()}/api/v1/appointments/${id}/call/ring`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ mode }),
  });
}

export async function respondAppointmentCall(
  id: string,
  callId: string,
  action: "accept" | "decline",
): Promise<import("@/lib/appointment-types").IncomingCallPayload> {
  return apiFetch(`${marketplaceServiceUrl()}/api/v1/appointments/${id}/call/respond`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ call_id: callId, action }),
  });
}

export async function cancelAppointmentCall(
  id: string,
  callId: string,
): Promise<import("@/lib/appointment-types").IncomingCallPayload> {
  return apiFetch(`${marketplaceServiceUrl()}/api/v1/appointments/${id}/call/cancel`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ call_id: callId }),
  });
}

export interface LawyerListingInput {
  full_name?: string;
  bar_council_id?: string | null;
  practice_areas?: string[];
  jurisdictions?: string[];
  languages?: string[];
  city?: string;
  years_experience?: number;
  hourly_rate?: number | null;
  bio?: string;
}

export async function getMyLawyerListing(): Promise<RankedMarketplaceLawyer> {
  return apiFetch<RankedMarketplaceLawyer>(`${marketplaceServiceUrl()}/api/v1/lawyers/me`);
}

export async function upsertMyLawyerListing(
  body: LawyerListingInput,
): Promise<RankedMarketplaceLawyer> {
  return apiFetch<RankedMarketplaceLawyer>(`${marketplaceServiceUrl()}/api/v1/lawyers/me`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
}

export async function syncAdvocateListing(): Promise<void> {
  const user = getStoredUser();
  if (!user?.roles.includes("advocate")) return;
  try {
    await upsertMyLawyerListing({ full_name: user.full_name });
  } catch {
    /* marketplace may be offline during login */
  }
}

export async function adminListAppointments(params: {
  status?: string;
  search?: string;
  emergency?: string;
  live?: boolean;
} = {}): Promise<{
  items: AppointmentRecord[];
  live_matrix?: AppointmentRecord[];
  counts: Record<string, number>;
  emergency_counts?: Record<string, number>;
  total: number;
  live_total?: number;
}> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.search) qs.set("search", params.search);
  if (params.emergency) qs.set("emergency", params.emergency);
  if (params.live) qs.set("live", "true");
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch(`${marketplaceServiceUrl()}/api/v1/admin/appointments${suffix}`);
}

export async function adminGetAppointment(id: string): Promise<{
  appointment: AppointmentRecord;
  messages: AppointmentMessage[];
  events: { id: string; type: string; actor_user_id: string | null; payload: Record<string, unknown>; created_at: string | null }[];
}> {
  return apiFetch(`${marketplaceServiceUrl()}/api/v1/admin/appointments/${id}`);
}

export async function adminForceCancelAppointment(id: string, reason: string): Promise<AppointmentRecord> {
  return apiFetch(`${marketplaceServiceUrl()}/api/v1/admin/appointments/${id}/force-cancel`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ reason }),
  });
}

export async function adminForceCompleteAppointment(id: string, reason: string): Promise<AppointmentRecord> {
  return apiFetch(`${marketplaceServiceUrl()}/api/v1/admin/appointments/${id}/force-complete`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ reason }),
  });
}

export async function requestAppointmentEmergency(id: string, reason: string): Promise<AppointmentRecord> {
  return apiFetch(`${marketplaceServiceUrl()}/api/v1/appointments/${id}/emergency`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ reason }),
  });
}

export async function resolveAppointmentEmergency(id: string): Promise<AppointmentRecord> {
  return apiFetch(`${marketplaceServiceUrl()}/api/v1/appointments/${id}/emergency/resolve`, {
    method: "POST",
    headers: authHeaders(),
  });
}

export async function adminAckEmergency(id: string): Promise<AppointmentRecord> {
  return apiFetch(`${marketplaceServiceUrl()}/api/v1/admin/appointments/${id}/emergency/ack`, {
    method: "POST",
    headers: authHeaders(),
  });
}

export async function adminResolveEmergency(id: string): Promise<AppointmentRecord> {
  return apiFetch(`${marketplaceServiceUrl()}/api/v1/admin/appointments/${id}/emergency/resolve`, {
    method: "POST",
    headers: authHeaders(),
  });
}

export async function adminSetPriority(id: string, priority: "normal" | "urgent" | "emergency"): Promise<AppointmentRecord> {
  return apiFetch(`${marketplaceServiceUrl()}/api/v1/admin/appointments/${id}/priority`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ priority }),
  });
}

export async function adminExtendAppointment(id: string, minutes: number): Promise<AppointmentRecord> {
  return apiFetch(`${marketplaceServiceUrl()}/api/v1/admin/appointments/${id}/extend`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ minutes }),
  });
}

export async function adminReassignAppointment(id: string, lawyerId: string): Promise<AppointmentRecord> {
  return apiFetch(`${marketplaceServiceUrl()}/api/v1/admin/appointments/${id}/reassign`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ lawyer_id: lawyerId }),
  });
}

export async function adminSystemMessage(id: string, body: string): Promise<AppointmentMessage> {
  return apiFetch(`${marketplaceServiceUrl()}/api/v1/admin/appointments/${id}/system-message`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ body }),
  });
}

export async function adminForceSummon(id: string): Promise<JoinStateDto> {
  return apiFetch(`${marketplaceServiceUrl()}/api/v1/admin/appointments/${id}/force-summon`, {
    method: "POST",
    headers: authHeaders(),
  });
}

export async function adminKickParticipant(
  id: string,
  target: "citizen" | "lawyer",
  reason?: string,
): Promise<AppointmentRecord> {
  return apiFetch(`${marketplaceServiceUrl()}/api/v1/admin/appointments/${id}/moderate/kick`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ target, reason: reason ?? "" }),
  });
}

export async function adminSuspendParticipant(
  id: string,
  target: "citizen" | "lawyer",
  minutes: 5 | 15 | 30,
  reason: string,
): Promise<AppointmentRecord> {
  return apiFetch(`${marketplaceServiceUrl()}/api/v1/admin/appointments/${id}/moderate/suspend`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ target, minutes, reason }),
  });
}

export async function adminUnsuspendParticipant(
  id: string,
  target: "citizen" | "lawyer",
): Promise<AppointmentRecord> {
  return apiFetch(`${marketplaceServiceUrl()}/api/v1/admin/appointments/${id}/moderate/unsuspend`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ target }),
  });
}

export async function adminListLawyers(): Promise<RankedMarketplaceLawyer[]> {
  return apiFetch(`${marketplaceServiceUrl()}/api/v1/admin/lawyers`);
}

export async function adminSetLawyerVerified(
  lawyerId: string,
  isVerified: boolean,
): Promise<RankedMarketplaceLawyer> {
  return apiFetch(`${marketplaceServiceUrl()}/api/v1/admin/lawyers/${lawyerId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ is_verified: isVerified }),
  });
}

export async function getWalletBalance(): Promise<WalletBalance> {
  return apiFetch<WalletBalance>(`${billingServiceUrl()}/api/v1/wallet/me`, {
    headers: authHeaders(),
  });
}

export async function topUpWallet(
  amount: number,
  description = "Manual top-up",
): Promise<WalletTransaction> {
  return apiFetch<WalletTransaction>(`${billingServiceUrl()}/api/v1/wallet/me/top-up`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ amount, description }),
  });
}

export async function listWalletTransactions(
  page = 1,
  size = 20,
): Promise<WalletTransactionList> {
  return apiFetch<WalletTransactionList>(
    `${billingServiceUrl()}/api/v1/wallet/me/transactions?page=${page}&size=${size}`,
    { headers: authHeaders() },
  );
}

// ── Case Service ─────────────────────────────────────────────────────────────

export async function createCase(data: {
  title: string;
  description?: string;
  case_number?: string;
  court?: string;
  jurisdiction?: string;
  practice_area?: string;
  status?: string;
  source?: string;
  session_id?: string | null;
  ai_brief?: Record<string, unknown>;
}): Promise<LegalCase> {
  return apiFetch<LegalCase>(`${caseServiceUrl()}/api/v1/cases`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
}

export async function listCasesApi(
  status?: CaseStatus | null,
  page = 1,
  size = 20,
): Promise<Page<LegalCase>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (status) params.set("status_filter", status);
  return apiFetch<Page<LegalCase>>(`${caseServiceUrl()}/api/v1/cases?${params}`, {
    headers: authHeaders(),
  });
}

export async function listCasesSharedWithMe(
  page = 1,
  size = 20,
): Promise<Page<LegalCase>> {
  return apiFetch<Page<LegalCase>>(
    `${caseServiceUrl()}/api/v1/cases/shared-with-me?page=${page}&size=${size}`,
    { headers: authHeaders() },
  );
}

export async function getCaseApi(id: string): Promise<LegalCase> {
  return apiFetch<LegalCase>(`${caseServiceUrl()}/api/v1/cases/${id}`, {
    headers: authHeaders(),
  });
}

export async function updateCaseApi(
  id: string,
  patch: Partial<{
    title: string;
    description: string;
    case_number: string;
    court: string;
    jurisdiction: string;
    practice_area: string;
    status: string;
    ai_brief: Record<string, unknown>;
  }>,
): Promise<LegalCase> {
  return apiFetch<LegalCase>(`${caseServiceUrl()}/api/v1/cases/${id}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(patch),
  });
}

export async function shareCase(
  id: string,
  lawyerUserId: string,
  message = "",
): Promise<CaseShare> {
  return apiFetch<CaseShare>(`${caseServiceUrl()}/api/v1/cases/${id}/share`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ lawyer_user_id: lawyerUserId, message }),
  });
}

export async function revokeShare(id: string, lawyerUserId: string): Promise<void> {
  return apiFetch<void>(
    `${caseServiceUrl()}/api/v1/cases/${id}/share/${lawyerUserId}`,
    { method: "DELETE", headers: authHeaders() },
  );
}

export async function extractCaseBrief(sessionId: string): Promise<CaseBriefExtraction> {
  return apiFetch<CaseBriefExtraction>(
    `${researchServiceUrl()}/api/v1/research/sessions/${sessionId}/extract-case`,
    { method: "POST", headers: authHeaders() },
  );
}


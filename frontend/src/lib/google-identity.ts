/**
 * Google Identity Services (GIS) loader — no npm dependency required.
 * https://developers.google.com/identity/gsi/web
 */

type CredentialCallback = (credential: string) => void;

interface GoogleCredentialResponse {
  credential?: string;
}

interface GooglePromptNotification {
  isNotDisplayed: () => boolean;
  isSkippedMoment: () => boolean;
  isDismissedMoment: () => boolean;
  getNotDisplayedReason: () => string;
  getSkippedReason: () => string;
  getDismissedReason: () => string;
}

interface GoogleIdConfig {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  use_fedcm_for_prompt?: boolean;
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
  itp_support?: boolean;
}

interface GoogleButtonConfig {
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  width?: number;
  logo_alignment?: "left" | "center";
  /** Avoid FedCM on localhost where token retrieval often fails. */
  use_fedcm_for_button?: boolean;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GoogleIdConfig) => void;
          renderButton: (parent: HTMLElement, options: GoogleButtonConfig) => void;
          prompt: (momentListener?: (notification: GooglePromptNotification) => void) => void;
          cancel: () => void;
        };
      };
    };
  }
}

const GIS_SCRIPT = "https://accounts.google.com/gsi/client";
const listeners = new Set<CredentialCallback>();
let scriptPromise: Promise<void> | null = null;
let initialized = false;
let oneTapState: "idle" | "pending" | "active" | "done" = "idle";
let buttonActivity = 0;
let promptChain: Promise<boolean> = Promise.resolve(false);
let renderChain: Promise<boolean> = Promise.resolve(true);
const renderedButtons = new WeakMap<HTMLElement, number>();

function getClientId(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
}

function isLocalDevHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

function dispatchCredential(credential: string): void {
  listeners.forEach((listener) => listener(credential));
}

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Google GIS failed to load")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = GIS_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google GIS failed to load"));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitForButtonIdle(timeoutMs = 2500): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (buttonActivity > 0 && Date.now() < deadline) {
    await wait(50);
  }
}

export async function ensureGoogleIdentityReady(): Promise<boolean> {
  const clientId = getClientId();
  if (!clientId) return false;

  await loadScript();
  if (!window.google?.accounts?.id) return false;

  if (!initialized) {
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        if (response.credential) dispatchCredential(response.credential);
      },
      // FedCM One Tap is flaky on localhost and collides with the GIS button.
      use_fedcm_for_prompt: false,
      auto_select: false,
      cancel_on_tap_outside: true,
      itp_support: true,
    });
    initialized = true;
  }

  return true;
}

export function subscribeGoogleCredential(callback: CredentialCallback): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/** Call while the GIS sign-in button overlay is mounting/updating. */
export function beginGoogleButtonActivity(): void {
  buttonActivity += 1;
}

/** Call when the GIS sign-in button overlay is stable. */
export function endGoogleButtonActivity(): void {
  buttonActivity = Math.max(0, buttonActivity - 1);
}

async function renderGoogleSignInButtonInner(
  container: HTMLElement,
  options?: GoogleButtonConfig,
): Promise<boolean> {
  beginGoogleButtonActivity();
  try {
    const ready = await ensureGoogleIdentityReady();
    if (!ready || !window.google?.accounts?.id) return false;

    const width = Math.max(container.offsetWidth || 0, 280);
    const previousWidth = renderedButtons.get(container);
    if (previousWidth !== undefined && Math.abs(previousWidth - width) < 8) {
      return true;
    }

    container.replaceChildren();
    window.google.accounts.id.renderButton(container, {
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "pill",
      width,
      logo_alignment: "left",
      use_fedcm_for_button: isLocalDevHost() ? false : undefined,
      ...options,
    });
    renderedButtons.set(container, width);
    return true;
  } finally {
    endGoogleButtonActivity();
  }
}

export async function renderGoogleSignInButton(
  container: HTMLElement,
  options?: GoogleButtonConfig,
): Promise<boolean> {
  const task = renderChain.then(() => renderGoogleSignInButtonInner(container, options));
  renderChain = task.catch(() => false);
  return task;
}

export function cancelGoogleOneTap(): void {
  if (typeof window === "undefined") return;
  if (!window.google?.accounts?.id) return;
  try {
    window.google.accounts.id.cancel();
  } catch {
    /* ignore */
  }
  oneTapState = "done";
}

export async function showGoogleOneTap(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (oneTapState !== "idle") return false;

  // FedCM/network errors are common on local dev; the GIS button still works.
  if (isLocalDevHost()) return false;

  oneTapState = "pending";

  promptChain = promptChain.then(async () => {
    if (oneTapState !== "pending") return false;

    await waitForButtonIdle();
    await wait(350);

    const ready = await ensureGoogleIdentityReady();
    if (!ready || !window.google?.accounts?.id) {
      oneTapState = "idle";
      return false;
    }

    return await new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (value: boolean) => {
        if (settled) return;
        settled = true;
        oneTapState = value ? "active" : "done";
        resolve(value);
      };

      try {
        window.google!.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            finish(false);
            return;
          }
          if (notification.isDismissedMoment()) {
            oneTapState = "done";
          }
        });
        finish(true);
      } catch {
        oneTapState = "idle";
        finish(false);
      }
    });
  });

  return promptChain;
}

export function isGoogleIdentityConfigured(): boolean {
  return Boolean(getClientId());
}

/** One Tap is disabled on localhost — FedCM token retrieval is unreliable there. */
export function isGoogleOneTapSupported(): boolean {
  if (typeof window === "undefined") return false;
  return !isLocalDevHost();
}

/** Dev hint when Google returns origin_mismatch. */
export function getGoogleOriginHint(): string {
  if (typeof window === "undefined") return "";
  const origin = window.location.origin;
  return `(Add this exact origin in Google Cloud Console → Credentials → JavaScript origins: ${origin})`;
}

export function getCurrentOrigin(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

/** Test helper — reset module singleton state. */
export function resetGoogleIdentityForTests(): void {
  oneTapState = "idle";
  buttonActivity = 0;
  promptChain = Promise.resolve(false);
  renderChain = Promise.resolve(true);
  initialized = false;
  scriptPromise = null;
  listeners.clear();
}

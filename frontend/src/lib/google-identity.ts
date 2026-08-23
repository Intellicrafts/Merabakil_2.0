/**
 * Google Identity Services (GIS) loader — no npm dependency required.
 * https://developers.google.com/identity/gsi/web
 */

type CredentialCallback = (credential: string) => void;

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleIdConfig {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  use_fedcm_for_prompt?: boolean;
  auto_select?: boolean;
}

interface GoogleButtonConfig {
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  width?: number;
  logo_alignment?: "left" | "center";
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GoogleIdConfig) => void;
          renderButton: (parent: HTMLElement, options: GoogleButtonConfig) => void;
          prompt: () => void;
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

function getClientId(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
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
      use_fedcm_for_prompt: true,
      auto_select: false,
    });
    initialized = true;
  }

  return true;
}

export function subscribeGoogleCredential(callback: CredentialCallback): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export async function renderGoogleSignInButton(
  container: HTMLElement,
  options?: GoogleButtonConfig,
): Promise<boolean> {
  const ready = await ensureGoogleIdentityReady();
  if (!ready || !window.google?.accounts?.id) return false;

  container.replaceChildren();
  const width = Math.max(container.offsetWidth || 0, 280);
  window.google.accounts.id.renderButton(container, {
    theme: "outline",
    size: "large",
    text: "continue_with",
    shape: "pill",
    width,
    logo_alignment: "left",
    ...options,
  });
  return true;
}

export async function showGoogleOneTap(): Promise<boolean> {
  const ready = await ensureGoogleIdentityReady();
  if (!ready || !window.google?.accounts?.id) return false;
  window.google.accounts.id.prompt();
  return true;
}

export function isGoogleIdentityConfigured(): boolean {
  return Boolean(getClientId());
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

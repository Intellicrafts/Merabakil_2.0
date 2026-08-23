"use client";

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

import {
  completeGoogleRegistration,
  loginWithGoogle,
  setSession,
  syncAdvocateListing,
} from "@/lib/api";
import { loginRedirectForUser } from "@/lib/permissions";
import type { AuthResponse, GoogleAuthResult } from "@/lib/types";
import { isGoogleNeedsRole } from "@/lib/types";

export const GOOGLE_ONBOARDING_KEY = "legalos.google.onboarding";
export const ONE_TAP_DISMISSED_KEY = "legalos.google.one_tap_dismissed";

export interface GoogleOnboardingContext {
  onboarding_token: string;
  email: string;
  full_name: string;
  picture?: string | null;
}

export function storeGoogleOnboarding(context: GoogleOnboardingContext): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(GOOGLE_ONBOARDING_KEY, JSON.stringify(context));
}

export function readGoogleOnboarding(): GoogleOnboardingContext | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(GOOGLE_ONBOARDING_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GoogleOnboardingContext;
  } catch {
    return null;
  }
}

export function clearGoogleOnboarding(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(GOOGLE_ONBOARDING_KEY);
}

export async function finishAuthSession(
  auth: AuthResponse,
  router: AppRouterInstance,
  nextPath?: string | null,
): Promise<void> {
  setSession(auth);
  await syncAdvocateListing();
  if (nextPath && nextPath.startsWith("/")) {
    router.push(nextPath);
    return;
  }
  router.push(loginRedirectForUser(auth.user));
}

export async function handleGoogleAuthResult(
  result: GoogleAuthResult,
  router: AppRouterInstance,
  nextPath?: string | null,
): Promise<void> {
  if (isGoogleNeedsRole(result)) {
    storeGoogleOnboarding({
      onboarding_token: result.onboarding_token,
      email: result.email,
      full_name: result.full_name,
      picture: result.picture,
    });
    const onboardingNext = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
    router.push(`/auth/onboarding/role${onboardingNext}`);
    return;
  }
  await finishAuthSession(result, router, nextPath);
}

export async function handleGoogleCredential(
  credential: string,
  router: AppRouterInstance,
  nextPath?: string | null,
): Promise<void> {
  const result = await loginWithGoogle(credential);
  await handleGoogleAuthResult(result, router, nextPath);
}

export async function completeGoogleOnboarding(
  onboardingToken: string,
  role: string,
  router: AppRouterInstance,
  nextPath?: string | null,
): Promise<AuthResponse> {
  const auth = await completeGoogleRegistration(onboardingToken, role);
  clearGoogleOnboarding();
  await finishAuthSession(auth, router, nextPath);
  return auth;
}

export function isGoogleAuthEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim());
}

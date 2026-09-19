"use client";

import { useEffect, useRef } from "react";

import { getToken } from "@/lib/api";
import { ONE_TAP_DISMISSED_KEY, isGoogleAuthEnabled } from "@/lib/auth/google-flow";
import {
  cancelGoogleOneTap,
  isGoogleOneTapSupported,
  showGoogleOneTap,
} from "@/lib/google-identity";

/**
 * Optional One Tap on login — runs only once per page load, after the GIS button
 * is ready, and is skipped on localhost where FedCM commonly errors.
 */
export function GoogleOneTapPrompt() {
  const startedRef = useRef(false);

  useEffect(() => {
    if (!isGoogleAuthEnabled()) return;
    if (!isGoogleOneTapSupported()) return;
    if (getToken()) return;
    if (startedRef.current) return;
    startedRef.current = true;

    if (typeof window !== "undefined" && window.sessionStorage.getItem(ONE_TAP_DISMISSED_KEY)) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      void showGoogleOneTap().catch(() => {
        /* GIS/FedCM transient failures are non-fatal; button sign-in remains available. */
      });
    }, 600);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      cancelGoogleOneTap();
    };
  }, []);

  return null;
}

"use client";

import { useEffect } from "react";

import { getToken } from "@/lib/api";
import { ONE_TAP_DISMISSED_KEY, isGoogleAuthEnabled } from "@/lib/auth/google-flow";
import { showGoogleOneTap } from "@/lib/google-identity";

/** Shows Google One Tap on login — credential handling is done by SocialLoginButtons. */
export function GoogleOneTapPrompt() {
  useEffect(() => {
    if (!isGoogleAuthEnabled()) return;
    if (getToken()) return;
    if (typeof window !== "undefined" && window.sessionStorage.getItem(ONE_TAP_DISMISSED_KEY)) {
      return;
    }

    showGoogleOneTap().catch(() => {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(ONE_TAP_DISMISSED_KEY, "1");
      }
    });
  }, []);

  return null;
}

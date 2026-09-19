"use client";

import { useEffect, useState } from "react";

import { ensureFreshToken } from "@/lib/api";
import { authServiceUrl } from "@/lib/service-urls";

function isExternalAvatar(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

function isApiAvatarPath(url: string): boolean {
  return url.startsWith("/api/v1/users/me/avatar");
}

/** Resolve avatar src for display — external URLs pass through; API paths fetch with JWT. */
export function useResolvedAvatarSrc(avatarUrl?: string | null, fallback?: string | null): string | null {
  const candidate = avatarUrl ?? fallback ?? null;
  const [resolved, setResolved] = useState<string | null>(() => {
    if (!candidate) return null;
    if (isExternalAvatar(candidate)) return candidate;
    return null;
  });

  useEffect(() => {
    if (!candidate) {
      setResolved(null);
      return;
    }
    if (isExternalAvatar(candidate)) {
      setResolved(candidate);
      return;
    }

    if (!isApiAvatarPath(candidate)) {
      setResolved(candidate);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    void (async () => {
      const token = await ensureFreshToken();
      if (!token || cancelled) return;
      const url = `${authServiceUrl()}${candidate.split("?")[0]}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok || cancelled) return;
      const blob = await res.blob();
      objectUrl = URL.createObjectURL(blob);
      if (!cancelled) setResolved(objectUrl);
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [candidate]);

  return resolved;
}

"use client";

import { useEffect } from "react";

const CHUNK_ERROR = /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module/i;
const RETRY_KEY = "merabakil.chunk-reload-attempted";

/**
 * A browser can retain an HTML shell from a previous deployment while its
 * JavaScript chunks have been replaced. Retry once with a full document reload
 * so visitors recover without seeing a raw Next.js runtime error.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunkError = CHUNK_ERROR.test(error.message);

  useEffect(() => {
    if (!isChunkError || sessionStorage.getItem(RETRY_KEY) === "1") return;
    sessionStorage.setItem(RETRY_KEY, "1");
    window.location.reload();
  }, [isChunkError]);

  function retry() {
    sessionStorage.removeItem(RETRY_KEY);
    window.location.reload();
  }

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-stone-50 px-6 text-stone-950">
        <main className="max-w-md text-center">
          <p className="text-sm font-medium text-amber-800">MeraBakil</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Let&apos;s refresh this page</h1>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            {isChunkError
              ? "A new version of this page is ready. Refresh to continue."
              : "Something unexpected happened. Please try again."}
          </p>
          <button
            type="button"
            onClick={isChunkError ? retry : reset}
            className="mt-6 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-stone-700"
          >
            {isChunkError ? "Refresh page" : "Try again"}
          </button>
        </main>
      </body>
    </html>
  );
}

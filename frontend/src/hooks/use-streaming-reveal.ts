"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type StreamingPhase = "idle" | "waiting" | "streaming" | "revealing" | "complete";

export interface StreamingSnapshot {
  content: string;
  revealedChars: number;
  phase: StreamingPhase;
  isAnimating: boolean;
}

const DEFAULT_CHARS_PER_FRAME = 60;

export interface UseStreamingRevealOptions {
  charsPerFrame?: number;
}

export function useStreamingReveal(options: UseStreamingRevealOptions = {}) {
  const charsPerFrame = options.charsPerFrame ?? DEFAULT_CHARS_PER_FRAME;

  const [snapshot, setSnapshot] = useState<StreamingSnapshot>({
    content: "",
    revealedChars: 0,
    phase: "idle",
    isAnimating: false,
  });

  const contentRef = useRef("");
  const revealedRef = useRef(0);
  const bufferRef = useRef("");
  const phaseRef = useRef<StreamingPhase>("idle");
  const rafRef = useRef<number | null>(null);

  const publish = useCallback(() => {
    const content = contentRef.current;
    const revealedChars = revealedRef.current;
    const phase = phaseRef.current;
    const isAnimating = revealedChars < content.length;
    setSnapshot({ content, revealedChars, phase, isAnimating });
    return isAnimating;
  }, []);

  const stopRaf = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const tickReveal = useCallback(() => {
    rafRef.current = null;

    if (bufferRef.current) {
      contentRef.current += bufferRef.current;
      bufferRef.current = "";
    }

    const target = contentRef.current.length;
    const current = revealedRef.current;

    if (current < target) {
      revealedRef.current = Math.min(current + charsPerFrame, target);
      if (phaseRef.current === "waiting") {
        phaseRef.current = "streaming";
      } else if (phaseRef.current === "streaming" && revealedRef.current < target) {
        phaseRef.current = "revealing";
      }
      publish();
      rafRef.current = requestAnimationFrame(tickReveal);
      return;
    }

    if (phaseRef.current === "revealing") {
      phaseRef.current = "streaming";
    }
    publish();
  }, [charsPerFrame, publish]);

  const scheduleReveal = useCallback(() => {
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(tickReveal);
    }
  }, [tickReveal]);

  const reset = useCallback(() => {
    stopRaf();
    contentRef.current = "";
    revealedRef.current = 0;
    bufferRef.current = "";
    phaseRef.current = "idle";
    publish();
  }, [publish, stopRaf]);

  const startWaiting = useCallback(() => {
    stopRaf();
    contentRef.current = "";
    revealedRef.current = 0;
    bufferRef.current = "";
    phaseRef.current = "waiting";
    publish();
  }, [publish, stopRaf]);

  const appendToken = useCallback(
    (token: string) => {
      if (!token) return;
      bufferRef.current += token;
      if (phaseRef.current === "waiting" || phaseRef.current === "idle") {
        phaseRef.current = "streaming";
      }
      scheduleReveal();
    },
    [scheduleReveal],
  );

  const flush = useCallback(() => {
    if (bufferRef.current) {
      contentRef.current += bufferRef.current;
      bufferRef.current = "";
    }
    scheduleReveal();
    return {
      content: contentRef.current,
      revealedChars: revealedRef.current,
    };
  }, [scheduleReveal]);

  const setContent = useCallback(
    (nextContent: string, opts?: { resetReveal?: boolean }) => {
      contentRef.current = nextContent;
      if (opts?.resetReveal) {
        revealedRef.current = 0;
      }
      if (phaseRef.current === "waiting" || phaseRef.current === "idle") {
        phaseRef.current = "streaming";
      } else if (revealedRef.current < nextContent.length) {
        phaseRef.current = "revealing";
      }
      scheduleReveal();
    },
    [scheduleReveal],
  );

  const complete = useCallback(() => {
    if (bufferRef.current) {
      contentRef.current += bufferRef.current;
      bufferRef.current = "";
    }
    phaseRef.current = "complete";
    if (revealedRef.current < contentRef.current.length) {
      scheduleReveal();
    } else {
      revealedRef.current = contentRef.current.length;
      publish();
    }
  }, [publish, scheduleReveal]);

  const fastForward = useCallback(() => {
    stopRaf();
    if (bufferRef.current) {
      contentRef.current += bufferRef.current;
      bufferRef.current = "";
    }
    revealedRef.current = contentRef.current.length;
    publish();
  }, [publish, stopRaf]);

  const waitForAnimation = useCallback(
    (timeoutMs = 3000): Promise<void> =>
      new Promise((resolve) => {
        const start = Date.now();
        const check = () => {
          const animating = revealedRef.current < contentRef.current.length;
          if (!animating || Date.now() - start > timeoutMs) {
            resolve();
            return;
          }
          requestAnimationFrame(check);
        };
        check();
      }),
    [],
  );

  useEffect(() => () => stopRaf(), [stopRaf]);

  const displayText = snapshot.content.slice(0, snapshot.revealedChars);

  return {
    ...snapshot,
    displayText,
    reset,
    startWaiting,
    appendToken,
    flush,
    setContent,
    complete,
    fastForward,
    waitForAnimation,
    stopRaf,
  };
}

export type SpeechResultLike = {
  0?: { transcript?: string };
  isFinal?: boolean;
};

export function collectSpeechTranscript(
  results: ArrayLike<SpeechResultLike>,
): { finalText: string; liveText: string } {
  const finals: string[] = [];
  const interims: string[] = [];
  for (let i = 0; i < results.length; i += 1) {
    const piece = (results[i][0]?.transcript ?? "").replace(/\s+/g, " ").trim();
    if (!piece) continue;
    if (results[i].isFinal) finals.push(piece);
    else interims.push(piece);
  }
  const finalText = finals.join(" ").trim();
  const liveText = [finalText, ...interims].filter(Boolean).join(" ").trim();
  return { finalText, liveText };
}

export function waitForSpeechEnd(
  rec: { stop: () => void; onend: (() => void) | null } | null,
  timeoutMs = 800,
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    if (!rec) {
      done();
      return;
    }
    rec.onend = done;
    try {
      rec.stop();
    } catch {
      done();
      return;
    }
    if (typeof window !== "undefined") {
      window.setTimeout(done, timeoutMs);
    } else {
      done();
    }
  });
}

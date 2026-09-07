function flag(v: string | undefined): boolean {
  return v !== "false";
}

export const FEATURES = Object.freeze({
  SAARTHI:          flag(process.env.NEXT_PUBLIC_FEATURE_SAARTHI),
  VOICE:            flag(process.env.NEXT_PUBLIC_FEATURE_VOICE),
  CASE_BRIEF:       flag(process.env.NEXT_PUBLIC_FEATURE_CASE_BRIEF),
  CASES:            flag(process.env.NEXT_PUBLIC_FEATURE_CASES),
  RESEARCH_CONSOLE: flag(process.env.NEXT_PUBLIC_FEATURE_RESEARCH_CONSOLE),
  MARKETPLACE:      flag(process.env.NEXT_PUBLIC_FEATURE_MARKETPLACE),
  AI_MATCHING:      flag(process.env.NEXT_PUBLIC_FEATURE_AI_MATCHING),
  BOOKING:          flag(process.env.NEXT_PUBLIC_FEATURE_BOOKING),
  ROOM:             flag(process.env.NEXT_PUBLIC_FEATURE_ROOM),
  WALLET:           flag(process.env.NEXT_PUBLIC_FEATURE_WALLET),
});

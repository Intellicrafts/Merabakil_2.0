import type {
  CourtroomListener,
  CourtroomSessionConfig,
  CourtroomState,
  ObjectionType,
} from "@/lib/courtroom/types";

export interface CourtroomSimulationAdapter {
  getState(): CourtroomState;
  start(config: CourtroomSessionConfig): void;
  pause(): void;
  resume(): void;
  endArguments(): void;
  raiseObjection(type: ObjectionType): void;
  setSpeechGated(enabled: boolean): void;
  advanceScript(): void;
  revealJudgment(): void;
  isAwaitingSpeech(): boolean;
  subscribe(listener: CourtroomListener): () => void;
  dispose(): void;
}

// AudioWorklet processor — captures mic as Int16 PCM and posts to main thread
class PCMCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0]?.[0];
    if (ch) {
      const out = new Int16Array(ch.length);
      for (let i = 0; i < ch.length; i++) {
        out[i] = Math.max(-32768, Math.min(32767, ch[i] * 32768));
      }
      this.port.postMessage(out.buffer, [out.buffer]);
    }
    return true;
  }
}
registerProcessor("mv-pcm-capture", PCMCaptureProcessor);

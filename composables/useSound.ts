// Efectos de sonido 8-bit generados con Web Audio API — sin archivos de audio.
let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

function beep(
  freq: number,
  dur: number,
  type: OscillatorType = "square",
  delay = 0,
  vol = 0.06,
  muted = false
) {
  if (muted || !import.meta.client) return;
  try {
    const ctx = getCtx();
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch {
    // Web Audio puede fallar si todavía no hubo interacción del usuario; se ignora.
  }
}

export function useSound(mutedRef: { value: boolean }) {
  const sfxSolve = () => {
    beep(660, 0.09, "square", 0, 0.06, mutedRef.value);
    beep(990, 0.12, "square", 0.09, 0.06, mutedRef.value);
  };
  const sfxWrong = () => beep(160, 0.18, "sawtooth", 0, 0.06, mutedRef.value);
  const sfxComplete = () =>
    [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.14, "square", i * 0.08, 0.06, mutedRef.value));
  const sfxLevelUp = () =>
    [392, 523, 659, 784, 988, 1319].forEach((f, i) =>
      beep(f, 0.16, "square", i * 0.07, 0.07, mutedRef.value)
    );
  const sfxHint = () => beep(300, 0.08, "triangle", 0, 0.04, mutedRef.value);
  const sfxEquip = () => {
    beep(440, 0.06, "square", 0, 0.05, mutedRef.value);
    beep(220, 0.08, "square", 0.05, 0.04, mutedRef.value);
  };
  const sfxUnlockSkill = () =>
    [523, 784, 1047].forEach((f, i) => beep(f, 0.1, "triangle", i * 0.05, 0.05, mutedRef.value));

  return { sfxSolve, sfxWrong, sfxComplete, sfxLevelUp, sfxHint, sfxEquip, sfxUnlockSkill };
}

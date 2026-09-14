// Suoni sintetizzati con WebAudio: nessun file esterno, funzionano offline.
type Suono = 'attacco' | 'incantesimo' | 'evoca' | 'turno' | 'vittoria' | 'sconfitta';

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function nota(c: AudioContext, freq: number, t0: number, durata: number, tipo: OscillatorType = 'sine', vol = 0.15) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + durata);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + durata + 0.05);
}

export function suona(s: Suono) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  switch (s) {
    case 'attacco':
      nota(c, 180, t, 0.18, 'sawtooth', 0.2);
      nota(c, 90, t + 0.03, 0.25, 'square', 0.12);
      break;
    case 'incantesimo':
      nota(c, 660, t, 0.12, 'triangle');
      nota(c, 990, t + 0.08, 0.15, 'triangle');
      nota(c, 1320, t + 0.16, 0.25, 'sine');
      break;
    case 'evoca':
      nota(c, 330, t, 0.12, 'triangle');
      nota(c, 440, t + 0.1, 0.2, 'triangle');
      break;
    case 'turno':
      nota(c, 523, t, 0.1, 'sine', 0.1);
      break;
    case 'vittoria':
      [523, 659, 784, 1047].forEach((f, i) => nota(c, f, t + i * 0.15, 0.4, 'triangle', 0.18));
      break;
    case 'sconfitta':
      [392, 349, 311, 262].forEach((f, i) => nota(c, f, t + i * 0.2, 0.45, 'sawtooth', 0.12));
      break;
  }
}

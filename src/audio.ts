// Suoni sintetizzati con WebAudio: nessun file esterno, funzionano offline.
// I suoni di impatto sono a tema elementale (crepitio, cristalli, rocce).
import type { Element } from './engine/types';

export type Suono = 'attacco' | 'incantesimo' | 'evoca' | 'turno' | 'vittoria' | 'sconfitta' | 'colpo' | 'cura' | 'morte';

let ctx: AudioContext | null = null;
let rumore: AudioBuffer | null = null;

function audio(): AudioContext | null {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function bufferRumore(c: AudioContext): AudioBuffer {
  if (rumore) return rumore;
  const b = c.createBuffer(1, c.sampleRate, c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  rumore = b;
  return b;
}

function nota(c: AudioContext, freq: number, t0: number, durata: number, tipo: OscillatorType = 'sine', vol = 0.15, freqFine?: number) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(freq, t0);
  if (freqFine) o.frequency.exponentialRampToValueAtTime(freqFine, t0 + durata);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + durata);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + durata + 0.05);
}

/** Raffica di rumore filtrato: base per crepitii, frantumi e boati. */
function soffio(c: AudioContext, t0: number, durata: number, tipoFiltro: BiquadFilterType, freq: number, q: number, vol: number, freqFine?: number) {
  const src = c.createBufferSource();
  src.buffer = bufferRumore(c);
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = tipoFiltro;
  f.frequency.setValueAtTime(freq, t0);
  if (freqFine) f.frequency.exponentialRampToValueAtTime(freqFine, t0 + durata);
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + durata);
  src.connect(f).connect(g).connect(c.destination);
  src.start(t0);
  src.stop(t0 + durata + 0.05);
}

function impatto(c: AudioContext, t: number, el: Element | 'neutro') {
  switch (el) {
    case 'fuoco':
      // crepitio: rumore passa-banda con più scoppiettii brevi
      soffio(c, t, 0.35, 'lowpass', 1800, 0.7, 0.35, 300);
      for (let i = 0; i < 6; i++) soffio(c, t + 0.03 + i * 0.045 + Math.random() * 0.02, 0.05, 'bandpass', 2500 + Math.random() * 2500, 4, 0.18);
      nota(c, 90, t, 0.3, 'sawtooth', 0.12, 40);
      break;
    case 'ghiaccio':
      // cristalli che si rompono: rumore acuto + tintinnii
      soffio(c, t, 0.25, 'highpass', 3500, 1, 0.3);
      [3200, 4100, 5200, 6400].forEach((f, i) => nota(c, f, t + 0.02 + i * 0.03, 0.18, 'sine', 0.08));
      nota(c, 1400, t, 0.12, 'triangle', 0.12, 700);
      break;
    case 'terra':
      // rocce: boato basso e sassi che ricadono
      soffio(c, t, 0.5, 'lowpass', 500, 0.5, 0.45, 80);
      nota(c, 60, t, 0.45, 'sine', 0.25, 30);
      for (let i = 0; i < 4; i++) soffio(c, t + 0.15 + i * 0.07, 0.04, 'bandpass', 700 + Math.random() * 600, 3, 0.15);
      break;
    default:
      soffio(c, t, 0.25, 'bandpass', 1200, 1.5, 0.25, 400);
      nota(c, 660, t, 0.15, 'triangle', 0.12, 330);
  }
}

export function suona(s: Suono, elemento: Element | 'neutro' = 'neutro') {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  switch (s) {
    case 'attacco':
      // sibilo dell'affondo, poi impatto a tema
      soffio(c, t, 0.18, 'bandpass', 600, 1, 0.12, 1800);
      impatto(c, t + 0.2, elemento);
      break;
    case 'colpo':
      impatto(c, t, elemento);
      break;
    case 'incantesimo':
      // sibilo in salita del proiettile, poi impatto
      nota(c, 300, t, 0.35, 'sine', 0.1, 1600);
      soffio(c, t, 0.3, 'bandpass', 900, 2, 0.1, 3000);
      impatto(c, t + 0.38, elemento);
      break;
    case 'cura':
      [523, 659, 784].forEach((f, i) => nota(c, f, t + i * 0.07, 0.35, 'triangle', 0.1));
      break;
    case 'evoca':
      nota(c, 220, t, 0.25, 'triangle', 0.12, 440);
      soffio(c, t, 0.3, 'lowpass', 900, 0.8, 0.12, 200);
      nota(c, 440, t + 0.12, 0.3, 'sine', 0.1);
      break;
    case 'morte':
      soffio(c, t, 0.4, 'lowpass', 1200, 0.7, 0.2, 150);
      nota(c, 200, t, 0.4, 'sawtooth', 0.08, 50);
      break;
    case 'turno':
      nota(c, 523, t, 0.1, 'sine', 0.1);
      nota(c, 784, t + 0.08, 0.15, 'sine', 0.08);
      break;
    case 'vittoria':
      [523, 659, 784, 1047].forEach((f, i) => nota(c, f, t + i * 0.15, 0.4, 'triangle', 0.18));
      break;
    case 'sconfitta':
      [392, 349, 311, 262].forEach((f, i) => nota(c, f, t + i * 0.2, 0.45, 'sawtooth', 0.12));
      break;
  }
}

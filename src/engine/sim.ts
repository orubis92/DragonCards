// Simulazione IA contro IA per verificare bilanciamento mazzi e livelli.
// Uso: npm run sim [partite] [livelloA] [livelloB]
import { nuovaPartita, applicaInPlace } from './rules';
import { scegliAzione, type Livello } from './ai';
import { MAZZI } from './decks';

const N = Number(process.argv[2] ?? 40);
const LA = Number(process.argv[3] ?? 3) as Livello;
const LB = Number(process.argv[4] ?? 3) as Livello;

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function partita(mA: string, mB: string, seed: number): { vincitore: 0 | 1; turni: number } {
  const s = nuovaPartita({ nomi: ['A', 'B'], mazzi: [mA, mB], seed });
  const r = rng(seed);
  let guard = 0;
  while (s.vincitore === null && guard++ < 2000) {
    const liv = s.attivo === 0 ? LA : LB;
    applicaInPlace(s, scegliAzione(s, liv, r));
  }
  return { vincitore: (s.vincitore ?? 0) as 0 | 1, turni: s.turno };
}

console.log(`Simulazione: ${N} partite per coppia, livelli ${LA} vs ${LB}`);
const t0 = Date.now();
for (const a of MAZZI) {
  for (const b of MAZZI) {
    let vA = 0, turni = 0;
    for (let i = 0; i < N; i++) {
      const r = partita(a.id, b.id, 1000 + i * 7919);
      if (r.vincitore === 0) vA++;
      turni += r.turni;
    }
    console.log(`${a.nome.padEnd(20)} vs ${b.nome.padEnd(20)} → ${((vA / N) * 100).toFixed(0).padStart(3)}% vittorie A, ${(turni / N).toFixed(1)} turni medi`);
  }
}
console.log(`Tempo: ${((Date.now() - t0) / 1000).toFixed(1)}s`);

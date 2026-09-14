// Test del motore: npm test
import { nuovaPartita, applicaInPlace, azioniLegali } from './rules';
import { vantaggio, dannoElementale, carta, DRAGHI, INCANTESIMI } from './cards';
import { MAZZI } from './decks';
import { scegliAzione } from './ai';
import type { DragonOnBoard, GameState } from './types';
import { MAX_CAMPO, VITA_INIZIALE } from './types';

let ok = 0, ko = 0;
function check(cond: boolean, msg: string) {
  if (cond) ok++; else { ko++; console.error('  ✗', msg); }
}

function drago(state: GameState, pid: 0 | 1, defId: string, extra: Partial<DragonOnBoard> = {}): DragonOnBoard {
  const def = carta(defId);
  if (def.kind !== 'drago') throw new Error();
  const d: DragonOnBoard = {
    uid: state.nextUid++, defId, attacco: def.attacco, vita: def.vita, vitaMax: def.vita, puoAttaccare: true, haAttaccato: false,
    congelato: false, scudo: (def.keywords ?? []).includes('scudo'), keywords: (def.keywords ?? []).slice(), elemento: def.elemento, ...extra,
  };
  state.giocatori[pid].campo.push(d);
  return d;
}

console.log('Triangolo elementale');
check(vantaggio('fuoco', 'ghiaccio') === 1, 'fuoco batte ghiaccio');
check(vantaggio('ghiaccio', 'terra') === 1, 'ghiaccio batte terra');
check(vantaggio('terra', 'fuoco') === 1, 'terra batte fuoco');
check(vantaggio('ghiaccio', 'fuoco') === -1, 'ghiaccio perde con fuoco');
check(vantaggio('fuoco', 'fuoco') === 0, 'stesso elemento neutro');
check(vantaggio('neutro', 'fuoco') === 0, 'neutro');
check(dannoElementale(3, 1) === 5, '3 con vantaggio = 5');
check(dannoElementale(3, -1) === 2, '3 con svantaggio = 2');
check(dannoElementale(1, -1) === 1, 'minimo 1');

console.log('Catalogo e mazzi');
check(DRAGHI.length === 36, '36 draghi');
check(INCANTESIMI.length === 16, '16 incantesimi');
for (const m of MAZZI) {
  check(m.carte.length === 30, `${m.nome}: 30 carte (${m.carte.length})`);
  check(m.carte.every((id) => { try { carta(id); return true; } catch { return false; } }), `${m.nome}: id validi`);
}
const ids = new Set<string>();
for (const c of [...DRAGHI, ...INCANTESIMI]) { check(!ids.has(c.id), `id duplicato ${c.id}`); ids.add(c.id); }

console.log('Inizio partita');
{
  const s = nuovaPartita({ nomi: ['A', 'B'], mazzi: ['fuoco', 'terra'], seed: 42, iniziaPer: 0 });
  check(s.turno === 1 && s.attivo === 0, 'turno 1, inizia A');
  check(s.giocatori[0].mano.length === 5, 'A ha 5 carte (4 + pescata)');
  check(s.giocatori[1].mano.length === 5, 'B ha 5 carte (4 + compensazione)');
  check(s.giocatori[0].cristalli === 1, 'A ha 1 cristallo');
  check(s.giocatori[0].mazzo.length === 25, 'A ha 25 carte nel mazzo');
}

console.log('Combattimento e Guardiano');
{
  const s = nuovaPartita({ nomi: ['A', 'B'], mazzi: ['fuoco', 'terra'], seed: 1, iniziaPer: 0 });
  const att = drago(s, 0, 'f05'); // 4/3 fuoco
  const g = drago(s, 1, 't05'); // 2/5 terra guardiano
  const altro = drago(s, 1, 'g03'); // 2/3 ghiaccio
  const az = azioniLegali(s).filter((a) => a.tipo === 'attacca');
  check(az.length === 1 && az[0].tipo === 'attacca' && az[0].a === g.uid, 'può attaccare solo il guardiano');
  applicaInPlace(s, { tipo: 'attacca', da: att.uid, a: g.uid });
  // fuoco vs terra: svantaggio → 4*0.75 = 3; terra vs fuoco: vantaggio → 2*1.5 = 3
  check(g.vita === 2, `guardiano a 2 vita (${g.vita})`);
  check(att.vita === 0 || !s.giocatori[0].campo.includes(att), 'attaccante distrutto (3 danni su 3 vita)');
  check(s.giocatori[0].cimitero.some((c) => c.uid === att.uid), 'attaccante nel cimitero');
  void altro;
}

console.log('Scudo e congelamento');
{
  const s = nuovaPartita({ nomi: ['A', 'B'], mazzi: ['fuoco', 'terra'], seed: 2, iniziaPer: 0 });
  const att = drago(s, 0, 'f03'); // 3/2
  const dif = drago(s, 1, 'g04'); // 2/2 scudo
  applicaInPlace(s, { tipo: 'attacca', da: att.uid, a: dif.uid });
  check(dif.vita === 2 && !dif.scudo, 'scudo assorbe il primo danno');
  check(att.vita === 1, 'attaccante subisce 2*0.75→1 (ghiaccio vs fuoco svantaggio)');
  check(att.haAttaccato, 'ha attaccato');
  check(azioniLegali(s).every((a) => a.tipo !== 'attacca'), 'non può attaccare due volte');
}

console.log('Incantesimi');
{
  const s = nuovaPartita({ nomi: ['A', 'B'], mazzi: ['fuoco', 'terra'], seed: 3, iniziaPer: 0 });
  const p = s.giocatori[0];
  p.cristalli = 10;
  const dif = drago(s, 1, 't06'); // 3/4 terra
  p.mano.push({ uid: 900, defId: 'sg1' }); // lancia di ghiaccio 3 → vs terra 5
  applicaInPlace(s, { tipo: 'giocaIncantesimo', uid: 900, bersaglio: dif.uid });
  check(s.giocatori[1].campo.length === 0, 'lancia di ghiaccio con vantaggio distrugge 3/4');
  check(p.cristalli === 8, 'costo scalato');
  p.vita = 10;
  p.mano.push({ uid: 901, defId: 'st2' });
  applicaInPlace(s, { tipo: 'giocaIncantesimo', uid: 901 });
  check(p.vita === 15, 'cura +5');
  p.mano.push({ uid: 902, defId: 'sf3' });
  applicaInPlace(s, { tipo: 'giocaIncantesimo', uid: 902, bersaglio: 'giocatore' });
  check(s.giocatori[1].vita === VITA_INIZIALE - 4, 'soffio infernale 4 danni al giocatore');
  const n = p.mano.length;
  p.mano.push({ uid: 903, defId: 'sn1' });
  applicaInPlace(s, { tipo: 'giocaIncantesimo', uid: 903 });
  check(p.mano.length === n + 2, 'pesca 2');
}

console.log('Limiti e fine turno');
{
  const s = nuovaPartita({ nomi: ['A', 'B'], mazzi: ['fuoco', 'terra'], seed: 4, iniziaPer: 0 });
  const p = s.giocatori[0];
  for (let i = 0; i < MAX_CAMPO; i++) drago(s, 0, 't01');
  p.cristalli = 10;
  p.mano.push({ uid: 910, defId: 'f01' });
  check(!azioniLegali(s).some((a) => a.tipo === 'giocaDrago' && a.uid === 910), 'campo pieno: non evocabile');
  const r = drago(s, 0, 't04', { vita: 1 }); // rigenerazione
  p.campo.pop(); p.campo[0] = r; // sostituisce per restare a 4
  applicaInPlace(s, { tipo: 'fineTurno' });
  check(r.vita === 3, `rigenerazione +2 a fine turno (${r.vita})`);
  check(s.attivo === 1 && s.turno === 2, 'passa a B, turno 2');
  check(s.giocatori[1].cristalli === 1, 'B ha 1 cristallo');
}

console.log('Vittoria e fatica');
{
  const s = nuovaPartita({ nomi: ['A', 'B'], mazzi: ['fuoco', 'terra'], seed: 5, iniziaPer: 0 });
  const att = drago(s, 0, 'f12'); // 9 attacco
  s.giocatori[1].vita = 5;
  applicaInPlace(s, { tipo: 'attacca', da: att.uid, a: 'giocatore' });
  check(s.vincitore === 0, 'A vince');
  check(azioniLegali(s).length === 0, 'nessuna azione a partita finita');
  const s2 = nuovaPartita({ nomi: ['A', 'B'], mazzi: ['fuoco', 'terra'], seed: 6, iniziaPer: 0 });
  s2.giocatori[1].mazzo = [];
  applicaInPlace(s2, { tipo: 'fineTurno' });
  check(s2.giocatori[1].vita === VITA_INIZIALE - 1, 'fatica 1 danno');
}

console.log('IA: tutti i livelli producono solo mosse legali');
for (const liv of [1, 2, 3] as const) {
  const s = nuovaPartita({ nomi: ['A', 'B'], mazzi: ['misto', 'ghiaccio'], seed: 100 + liv });
  let passi = 0;
  while (s.vincitore === null && passi++ < 600) {
    const a = scegliAzione(s, liv);
    const legale = azioniLegali(s).some((l) => JSON.stringify(l) === JSON.stringify(a));
    if (!legale) { check(false, `livello ${liv}: mossa illegale ${JSON.stringify(a)}`); break; }
    applicaInPlace(s, a);
  }
  check(s.vincitore !== null, `livello ${liv}: la partita termina (${passi} passi)`);
}

console.log('IA Difficile trova il colpo letale');
{
  const s = nuovaPartita({ nomi: ['A', 'B'], mazzi: ['fuoco', 'terra'], seed: 7, iniziaPer: 0 });
  drago(s, 0, 'f03'); drago(s, 0, 'f05'); // 3 + 4 = 7
  s.giocatori[1].vita = 7;
  drago(s, 1, 't06'); // bersaglio alternativo allettante
  let guard = 0;
  while (s.attivo === 0 && s.vincitore === null && guard++ < 10) applicaInPlace(s, scegliAzione(s, 3));
  check(s.vincitore === 0, 'letale eseguito');
}

console.log(`\n${ok} ok, ${ko} falliti`);
process.exit(ko ? 1 : 0);

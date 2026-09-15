// Test del motore: npm test
import { nuovaPartita, applicaInPlace, azioniLegali } from './rules';
import { vantaggio, dannoElementale, carta, DRAGHI, DRAGHI_BASE, DRAGHI_EFFETTO, INCANTESIMI } from './cards';
import { MAZZI, MAZZI_CAMPAGNA, validaMazzo } from './decks';
import { CAMPAGNA, COLLEZIONE_INIZIALE, registraVittoria, collezione } from './campagna';
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
check(dannoElementale(3, 1) === 4, '3 con vantaggio = 4');
check(dannoElementale(8, 1) === 10, '8 con vantaggio = 10 (+25%)');
check(dannoElementale(3, -1) === 2, '3 con svantaggio = 2');
check(dannoElementale(1, -1) === 1, 'minimo 1');

console.log('Catalogo e mazzi');
check(DRAGHI_BASE.length === 36, '36 draghi base');
check(DRAGHI_EFFETTO.length === 12, '12 draghi con effetto');
check(INCANTESIMI.length === 16, '16 incantesimi');
for (const m of [...MAZZI, ...MAZZI_CAMPAGNA]) {
  check(m.carte.length === 30, `${m.nome}: 30 carte (${m.carte.length})`);
  check(m.carte.every((id) => { try { carta(id); return true; } catch { return false; } }), `${m.nome}: id validi`);
}
const ids = new Set<string>();
for (const c of [...DRAGHI, ...INCANTESIMI]) { check(!ids.has(c.id), `id duplicato ${c.id}`); ids.add(c.id); }

console.log('Campagna e collezione');
{
  check(CAMPAGNA.length === 10, '10 avversari');
  check(CAMPAGNA.every((b) => { try { return MAZZI_CAMPAGNA.some((m) => m.id === b.mazzo); } catch { return false; } }), 'ogni boss ha un mazzo');
  check(COLLEZIONE_INIZIALE.length === 36 + 16 - 4, `collezione iniziale 48 carte (${COLLEZIONE_INIZIALE.length})`);
  let prog = { battuti: [] as string[], sbloccate: [] as string[] };
  for (const b of CAMPAGNA) prog = registraVittoria(prog, b);
  check(collezione(prog).size === 36 + 12 + 16, 'a campagna finita la collezione è completa');
  check(validaMazzo(MAZZI[0].carte, collezione(prog)).length === 0, 'mazzo Fuoco valido con collezione completa');
  check(validaMazzo(MAZZI[0].carte.slice(0, 29), collezione(prog)).length === 1, '29 carte: un problema');
  check(validaMazzo([...MAZZI[0].carte.slice(0, 27), 'f01', 'f01', 'f01'], collezione(prog)).some((x) => x.includes('copie')), 'troppe copie segnalate');
}

console.log('Effetti di Evocazione e Morte');
{
  const s = nuovaPartita({ nomi: ['A', 'B'], mazzi: ['fuoco', 'terra'], seed: 11, iniziaPer: 0 });
  const p = s.giocatori[0];
  p.cristalli = 10;
  const b1 = drago(s, 1, 'g03'); // 2/3
  const b2 = drago(s, 1, 'g05'); // 3/4
  p.mano.push({ uid: 920, defId: 'f13' }); // Evocazione: 2 danni al più debole (fuoco vs ghiaccio: 3)
  applicaInPlace(s, { tipo: 'giocaDrago', uid: 920 });
  check(s.giocatori[1].campo.length === 1 && s.giocatori[1].campo[0].uid === b2.uid, 'Drago Incendiario distrugge il più debole (3 danni con vantaggio)');
  void b1;
  p.mano.push({ uid: 921, defId: 'f15' }); // 3 danni al giocatore
  applicaInPlace(s, { tipo: 'giocaDrago', uid: 921 });
  check(s.giocatori[1].vita === VITA_INIZIALE - 3, 'Araldo della Cenere: 3 danni all\'avversario');
  // Morte: Kamikaze
  const k = drago(s, 0, 'f14');
  const t1 = drago(s, 1, 't01', { vita: 2 }); // 1/3 terra con 2 vita
  s.giocatori[0].campo = s.giocatori[0].campo.filter((d) => d.uid === k.uid); // solo il kamikaze
  applicaInPlace(s, { tipo: 'attacca', da: k.uid, a: b2.uid }); // 4 vs 3/4: kamikaze prende 3 (2 vita) → muore; b2 prende 4-? fuoco vs ghiaccio +1 = 5 → muore
  check(!s.giocatori[0].campo.some((d) => d.uid === k.uid), 'Kamikaze muore nello scambio');
  check(t1.vita === 1, `Morte del Kamikaze: 2 danni −1 (svantaggio vs terra) → t01 a 1 vita (${t1.vita})`);
}
{
  const s = nuovaPartita({ nomi: ['A', 'B'], mazzi: ['terra', 'fuoco'], seed: 12, iniziaPer: 0 });
  const p = s.giocatori[0];
  p.cristalli = 10;
  const g = drago(s, 0, 't13'); // Morte: evoca Germoglio
  const a = drago(s, 1, 'f05'); // 4/3
  s.attivo = 1; s.giocatori[1].cristalli = 10;
  applicaInPlace(s, { tipo: 'attacca', da: a.uid, a: g.uid });
  check(p.campo.length === 1 && p.campo[0].defId === 'tk1', 'Drago Germoglio lascia un Germoglio');
  check(!p.campo[0].puoAttaccare, 'il token non attacca subito');
  s.attivo = 0;
  p.mano.push({ uid: 930, defId: 't16' }); // +1/+1 agli altri
  applicaInPlace(s, { tipo: 'giocaDrago', uid: 930 });
  check(p.campo[0].attacco === 2 && p.campo[0].vita === 2, 'Patriarca potenzia il Germoglio');
  p.mano.push({ uid: 931, defId: 't14' });
  const prima = p.cristalli;
  applicaInPlace(s, { tipo: 'giocaDrago', uid: 931 });
  check(p.cristalli === prima - 3 + 1, 'Drago Radicato restituisce un cristallo');
  p.mano = p.mano.slice(0, 3);
  const n = p.mano.length;
  s.giocatori[0].campo = [];
  p.cristalli = 10;
  p.mano.push({ uid: 932, defId: 'g15' });
  applicaInPlace(s, { tipo: 'giocaDrago', uid: 932 });
  check(p.mano.length === n + 2, 'Drago Oracolo pesca 2');
  const forte = drago(s, 1, 'f09'); // 6/5
  p.mano.push({ uid: 933, defId: 'g13' });
  applicaInPlace(s, { tipo: 'giocaDrago', uid: 933 });
  check(forte.congelato, 'Drago Gelido congela il più forte');
  p.vita = 10;
  p.mano.push({ uid: 934, defId: 't15' });
  applicaInPlace(s, { tipo: 'giocaDrago', uid: 934 });
  check(p.vita === 14, 'Custode Antico cura 4');
}
{
  // Vita massima personalizzata (campagna)
  const s = nuovaPartita({ nomi: ['A', 'B'], mazzi: ['fuoco', 'c-ignis'], seed: 13, iniziaPer: 0, vita: [25, 35] });
  check(s.giocatori[1].vita === 35, 'vita IA 35');
  const s2 = nuovaPartita({ nomi: ['A', 'B'], mazzi: [MAZZI[0].carte, MAZZI[1].carte], seed: 14 });
  check(s2.giocatori[0].mazzo.length + s2.giocatori[0].mano.length === 30, 'mazzo passato come lista');
}

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
  check(att.vita === 1, `attaccante subisce il contrattacco pieno (2), non modificato dal triangolo (${att.vita})`);
  void altro;
}

console.log('Scudo e congelamento');
{
  const s = nuovaPartita({ nomi: ['A', 'B'], mazzi: ['fuoco', 'terra'], seed: 2, iniziaPer: 0 });
  const att = drago(s, 0, 'f03'); // 3/2
  const dif = drago(s, 1, 'g04'); // 2/2 scudo
  applicaInPlace(s, { tipo: 'attacca', da: att.uid, a: dif.uid });
  check(dif.vita === 2 && !dif.scudo, 'scudo assorbe il primo danno');
  check(att.vita === 0 || !s.giocatori[0].campo.includes(att), 'attaccante subisce 2 dal contrattacco e muore');
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

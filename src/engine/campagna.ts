import type { Livello } from './ai';
import { DRAGHI_BASE, INCANTESIMI } from './cards';

// ---------------------------------------------------------------------------
// Campagna: dieci avversari in sequenza. Ogni vittoria sblocca carte per il
// deck builder e l'avversario successivo.
// ---------------------------------------------------------------------------

export interface Boss {
  id: string;
  nome: string;
  titolo: string;
  mazzo: string; // id in MAZZI_CAMPAGNA
  livello: Livello;
  vitaIA: number; // vita dell'avversario
  vitaGiocatore: number;
  ricompensa: string[]; // carte sbloccate
  descrizione: string;
  icona: string;
}

export const CAMPAGNA: Boss[] = [
  { id: 'b01', nome: 'Pip', titolo: 'il Guardiano del Nido', mazzo: 'c-cuccioli', livello: 1, vitaIA: 20, vitaGiocatore: 25, ricompensa: ['f13', 't13'], icona: 'dinosaur-egg',
    descrizione: 'Un nido pieno di cuccioli chiassosi. Impara ad attaccare e a usare i cristalli.' },
  { id: 'b02', nome: 'Brasa', titolo: 'la Domatrice di Brace', mazzo: 'c-brace', livello: 1, vitaIA: 25, vitaGiocatore: 25, ricompensa: ['g13', 'f14'], icona: 'flame',
    descrizione: 'Draghi di Fuoco veloci. Il Ghiaccio non è la scelta giusta, la Terra sì.' },
  { id: 'b03', nome: 'Nivea', titolo: 'la Custode del Lago', mazzo: 'c-ghiaccio', livello: 2, vitaIA: 25, vitaGiocatore: 25, ricompensa: ['t14', 'g14'], icona: 'snowflake-1',
    descrizione: 'Scudi e congelamenti. Porta incantesimi per rompere gli Scudi.' },
  { id: 'b04', nome: 'Petrus', titolo: 'il Muro di Roccia', mazzo: 'c-roccia', livello: 2, vitaIA: 28, vitaGiocatore: 25, ricompensa: ['f15', 't15'], icona: 'stone-wall',
    descrizione: 'Un Guardiano dietro l\'altro. Servono danni ad area o il Ghiaccio.' },
  { id: 'b05', nome: 'Aurelia', titolo: 'la Tessitrice di Tempeste', mazzo: 'c-tempesta', livello: 2, vitaIA: 25, vitaGiocatore: 25, ricompensa: ['g15', 'f16'], icona: 'lightning-storm',
    descrizione: 'Pochi draghi, molti incantesimi. Non affollare il campo.' },
  { id: 'b06', nome: 'Magmar', titolo: 'il Cuore del Vulcano', mazzo: 'c-vulcano', livello: 3, vitaIA: 28, vitaGiocatore: 25, ricompensa: ['t16', 'g16'], icona: 'volcano',
    descrizione: 'Fuoco con effetti di Evocazione e di Morte. Ogni scambio costa caro.' },
  { id: 'b07', nome: 'Glacia', titolo: 'la Regina Eterna', mazzo: 'c-cristallo', livello: 3, vitaIA: 30, vitaGiocatore: 25, ricompensa: ['sn3'], icona: 'dragon-orb',
    descrizione: 'La cattedrale di cristallo non cade facilmente. Pazienza e Fuoco.' },
  { id: 'b08', nome: 'Silvanus', titolo: 'il Patriarca della Foresta', mazzo: 'c-foresta', livello: 3, vitaIA: 30, vitaGiocatore: 25, ricompensa: ['sf2', 'sg4'], icona: 'oak',
    descrizione: 'Draghi che crescono a ogni evocazione. Colpisci prima che diventino enormi.' },
  { id: 'b09', nome: 'Triade', titolo: 'i Tre Signori', mazzo: 'c-triade', livello: 3, vitaIA: 32, vitaGiocatore: 25, ricompensa: ['st4'], icona: 'double-dragon',
    descrizione: 'Il meglio di ogni elemento. Nessun vantaggio elementale ti proteggerà per tutta la partita.' },
  { id: 'b10', nome: 'Ignis', titolo: 'Cuore del Vesuvio', mazzo: 'c-ignis', livello: 3, vitaIA: 35, vitaGiocatore: 25, ricompensa: [], icona: 'spiked-dragon-head',
    descrizione: 'Solo draghi leggendari. Sopravvivi ai primi turni: dopo, sarà una guerra di giganti.' },
];

/** Collezione iniziale: tutti i draghi base e gli incantesimi tranne quelli riservati alla campagna. */
export const RISERVATE_CAMPAGNA = new Set(CAMPAGNA.flatMap((b) => b.ricompensa));
export const COLLEZIONE_INIZIALE: string[] = [
  ...DRAGHI_BASE.map((d) => d.id),
  ...INCANTESIMI.map((s) => s.id).filter((id) => !RISERVATE_CAMPAGNA.has(id)),
];

export interface ProgressoCampagna {
  battuti: string[]; // id dei boss sconfitti
  sbloccate: string[]; // carte sbloccate oltre alla collezione iniziale
}

export function collezione(progresso: ProgressoCampagna): Set<string> {
  return new Set([...COLLEZIONE_INIZIALE, ...progresso.sbloccate]);
}

export function prossimoBoss(progresso: ProgressoCampagna): Boss | null {
  return CAMPAGNA.find((b) => !progresso.battuti.includes(b.id)) ?? null;
}

export function bossDisponibile(progresso: ProgressoCampagna, boss: Boss): boolean {
  const i = CAMPAGNA.findIndex((b) => b.id === boss.id);
  return i === 0 || progresso.battuti.includes(CAMPAGNA[i - 1].id);
}

export function registraVittoria(progresso: ProgressoCampagna, boss: Boss): ProgressoCampagna {
  if (progresso.battuti.includes(boss.id)) return progresso;
  return {
    battuti: [...progresso.battuti, boss.id],
    sbloccate: [...new Set([...progresso.sbloccate, ...boss.ricompensa])],
  };
}

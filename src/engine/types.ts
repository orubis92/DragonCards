// Tipi base del motore di gioco (puro TypeScript, nessuna dipendenza da React)

export type Element = 'fuoco' | 'ghiaccio' | 'terra';
export type Keyword = 'guardiano' | 'carica' | 'rigenerazione' | 'scudo';

// Effetti innescati (all'evocazione o alla morte). Tutti senza scelta del
// bersaglio: quando serve un bersaglio la regola è deterministica.
export type Trigger =
  | { tipo: 'dannoTuttiAvversari'; valore: number }
  | { tipo: 'dannoDragoPiuDebole'; valore: number } // il drago avversario con meno vita
  | { tipo: 'dannoDragoPiuForte'; valore: number } // il drago avversario con più attacco
  | { tipo: 'dannoGiocatore'; valore: number }
  | { tipo: 'congelaPiuForte' }
  | { tipo: 'pesca'; valore: number }
  | { tipo: 'cristalli'; valore: number }
  | { tipo: 'curaGiocatore'; valore: number }
  | { tipo: 'potenziaAlleati'; attacco: number; vita: number }
  | { tipo: 'scudoAlleati' }
  | { tipo: 'evocaToken'; defId: string };

export interface DragonDef {
  kind: 'drago';
  id: string;
  nome: string;
  elemento: Element;
  costo: number;
  attacco: number;
  vita: number;
  keywords?: Keyword[];
  icona: string; // nome icona game-icons (senza estensione)
  testo?: string; // testo descrittivo mostrato sulla carta
  evocazione?: Trigger; // "Evocazione: ..." quando entra in campo
  morte?: Trigger; // "Morte: ..." quando viene distrutto
  token?: boolean; // non appartiene a nessun mazzo: viene creato da un effetto
}

export type SpellEffect =
  | { tipo: 'danno'; valore: number; bersaglio: 'drago' }
  | { tipo: 'danno'; valore: number; bersaglio: 'giocatore' }
  | { tipo: 'dannoTutti'; valore: number } // tutti i draghi avversari
  | { tipo: 'cura'; valore: number } // cura il giocatore
  | { tipo: 'potenzia'; attacco: number; vita: number; bersaglio: 'drago' }
  | { tipo: 'pesca'; valore: number }
  | { tipo: 'distruggi'; costoMax: number; bersaglio: 'drago' }
  | { tipo: 'congela'; bersaglio: 'drago' }
  | { tipo: 'scudo'; bersaglio: 'drago' }
  | { tipo: 'cristalli'; valore: number };

export interface SpellDef {
  kind: 'incantesimo';
  id: string;
  nome: string;
  elemento: Element | 'neutro';
  costo: number;
  effetto: SpellEffect;
  icona: string;
  testo: string;
}

export type CardDef = DragonDef | SpellDef;

// Istanza di una carta in gioco (mano/mazzo/campo)
export interface CardInstance {
  uid: number;
  defId: string;
}

export interface DragonOnBoard extends CardInstance {
  attacco: number;
  vita: number;
  vitaMax: number;
  puoAttaccare: boolean; // false nel turno di evocazione (salvo Carica)
  haAttaccato: boolean;
  congelato: boolean; // salta il prossimo attacco
  scudo: boolean; // ignora il primo danno
  keywords: Keyword[];
  elemento: Element;
}

export type PlayerId = 0 | 1;

export interface PlayerState {
  id: PlayerId;
  nome: string;
  vita: number;
  cristalli: number;
  cristalliMax: number;
  mazzo: CardInstance[];
  mano: CardInstance[];
  campo: DragonOnBoard[];
  cimitero: CardInstance[];
  fatica: number;
}

export interface LogEntry {
  turno: number;
  chi: PlayerId;
  testo: string;
  tipo: 'gioca' | 'attacco' | 'incantesimo' | 'sistema' | 'danno' | 'morte';
}

export interface GameState {
  vitaMax: [number, number];
  turno: number;
  attivo: PlayerId;
  giocatori: [PlayerState, PlayerState];
  vincitore: PlayerId | null;
  log: LogEntry[];
  nextUid: number;
  seed: number;
  ultimoEvento: GameEvent | null;
}

// Eventi usati dalla UI per animazioni
export type GameEvent =
  | { tipo: 'attacco'; da: number; a: number | 'giocatore'; danno: number; vantaggio: -1 | 0 | 1 }
  | { tipo: 'trigger'; uid: number; elemento: Element; quando: 'evocazione' | 'morte' }
  | { tipo: 'incantesimo'; carta: string; a: number | 'giocatore' | 'tutti' | null }
  | { tipo: 'evoca'; uid: number }
  | { tipo: 'morte'; uid: number }
  | { tipo: 'fineTurno' };

export type Action =
  | { tipo: 'giocaDrago'; uid: number }
  | { tipo: 'giocaIncantesimo'; uid: number; bersaglio?: number | 'giocatore' }
  | { tipo: 'attacca'; da: number; a: number | 'giocatore' }
  | { tipo: 'fineTurno' };

export const MAX_CAMPO = 4;
export const MAX_MANO = 7;
export const VITA_INIZIALE = 25;
export const CRISTALLI_MAX = 10;
export const MANO_INIZIALE = 4;

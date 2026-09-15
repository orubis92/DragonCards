# DraghiCarte

Duello di carte con draghi elementali contro l'IA, per tablet e smartphone (PWA installabile, funziona offline).

- **Tre elementi a triangolo**: Fuoco batte Ghiaccio, Ghiaccio batte Terra, Terra batte Fuoco. Chi attacca con vantaggio fa +1 danno (almeno +25%), in svantaggio −1; il contrattacco non è modificato.
- **64 carte**: 36 draghi base, 12 draghi con effetti di Evocazione/Morte (si sbloccano nella campagna) e 16 incantesimi; abilità Guardiano, Carica, Rigenerazione, Scudo.
- **Campagna** di 10 avversari con mazzi e difficoltà crescenti; ogni vittoria sblocca carte.
- **Deck builder**: mazzi personalizzati da 30 carte (max 2 copie) dalla collezione; 4 mazzi preconfezionati sempre disponibili.
- **Tutorial guidato** con suggerimenti contestuali nella prima partita.
- **IA a 3 livelli** (Facile casuale, Medio greedy, Difficile con ricerca a fascio e stima della risposta avversaria) con **personalità** legata al mazzo (Fuoco aggressivo, Terra difensivo, Ghiaccio di controllo). L'IA ragiona su una copia della partita con il proprio mazzo rimescolato: non conosce le carte che pescherà.
- **Illustrazioni procedurali** per ogni carta (SVG generato dall'id) e suoni sintetizzati a tema elementale.
- **Effetti a tema elementale** (v0.2): affondo del drago verso il bersaglio, braci di Fuoco, schegge di Ghiaccio, sassi di Terra, proiettili degli incantesimi, draghi che si frantumano, scossa dello schermo, tavolo "vivo" (draghi che respirano, scintille sullo sfondo). Tutto in CSS, disattivato con `prefers-reduced-motion`.
- Motore di gioco in TypeScript puro (`src/engine`), indipendente dalla UI e testato.

## Comandi

```bash
npm install       # una volta sola
npm run dev       # sviluppo (http://localhost:5173)
npm run build     # build di produzione in dist/
npm run preview   # anteprima della build
npm test          # test del motore (100 controlli)
npm run sim       # simulazione IA vs IA: npm run sim [partite] [livelloA] [livelloB]
```

## Struttura

```
src/engine/types.ts   tipi e costanti (vita 25, campo 4, mano 7, cristalli max 10)
src/engine/cards.ts   catalogo carte, triangolo elementale, parole chiave
src/engine/decks.ts   mazzi preconfezionati, mazzi della campagna, validazione dei mazzi personalizzati
src/engine/campagna.ts avversari della campagna, collezione e sblocchi
src/engine/rules.ts   stato di gioco, azioni legali, applicazione mosse
src/engine/ai.ts      IA a tre livelli
src/engine/test.ts    test del motore
src/engine/sim.ts     simulatore
src/components/       UI React (Menu con campagna e deck builder, Partita con tutorial, Carta, Arte procedurale, Icon, Effetti)
src/icons.ts          icone vettoriali da game-icons.net (CC BY 3.0)
public/draghi/        illustrazioni opzionali delle carte (vedi README.md lì dentro)
public/sw.js          service worker per l'uso offline
```

## Deploy su GitHub Pages

Il workflow `.github/workflows/main.yml` compila e pubblica a ogni push su `main`.
Nelle impostazioni del repository impostare Pages → Source → **GitHub Actions**.
La base è relativa (`base: './'`), quindi funziona sia in una sottocartella sia in root.

## Crediti

Icone: [game-icons.net](https://game-icons.net) (CC BY 3.0) — Lorc, Delapouite e altri autori elencati nel gioco (Crediti).

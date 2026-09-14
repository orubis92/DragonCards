# DraghiCarte

Duello di carte con draghi elementali contro l'IA, per tablet e smartphone (PWA installabile, funziona offline).

- **Tre elementi a triangolo**: Fuoco batte Ghiaccio, Ghiaccio batte Terra, Terra batte Fuoco (danno ×1,5 / ×0,75).
- **52 carte**: 36 draghi (12 per elemento) e 16 incantesimi; abilità Guardiano, Carica, Rigenerazione, Scudo.
- **4 mazzi preconfezionati** da 30 carte: tre mono-elemento e uno misto.
- **IA a 3 livelli**: Facile (casuale), Medio (greedy con valutazione euristica), Difficile (ricerca a fascio sull'intero turno con stima della risposta avversaria).
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
src/engine/decks.ts   mazzi preconfezionati
src/engine/rules.ts   stato di gioco, azioni legali, applicazione mosse
src/engine/ai.ts      IA a tre livelli
src/engine/test.ts    test del motore
src/engine/sim.ts     simulatore
src/components/       UI React (Menu, Partita, Carta, Icon, Effetti)
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

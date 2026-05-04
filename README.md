# ScoreYard

Open-source live scorecards for badminton, tennis, pickleball, table tennis, and any racquet sport. Score from your phone courtside, show the overlay in OBS, Streamlabs, Streamyard, or fullscreen on a TV.

> Status: pre-alpha, scaffolding in progress. Not yet usable. See [docs/PRD.md](docs/PRD.md) for the plan.

## Design principles

- **Mobile-first control.** The scorekeeper is courtside on a phone, not at a streaming PC.
- **Local-first, offline-tolerant.** Every score tap writes to local storage first, then syncs.
- **Event-sourced.** State is computed by replaying events. Free undo, free history, free video burn-in later.
- **Sport rules as data, not code.** Adding a sport is a config file, not a fork.
- **Themes are plain HTML + CSS.** Anyone can write one. No build step required.

## Inspired by

[OpenScoreboard](https://github.com/jackbmccarthy/OpenScoreboard) by Jack McCarthy — for the dynamic-URL pattern and proving real broadcasters use OSS scoring tools.

## License

MIT

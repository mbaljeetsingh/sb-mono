# Cricket engine (placeholder)

Cricket scoring is **not** in the racquet family. It needs its own event vocabulary, state shape, and reducer:

```ts
type CricketEvent =
  | { type: 'innings.start'; battingTeam: 'A' | 'B' }
  | { type: 'ball'; runs: number; extra?: 'wide' | 'no-ball' | 'bye' | 'leg-bye'; wicket?: WicketKind; striker?: PlayerId; bowler?: PlayerId }
  | { type: 'over.end' }
  | { type: 'innings.end' }
  | { type: 'declaration' }
  | ...
```

When implemented, this folder will contain:

- `config.ts` — formats: T20 (20 overs), ODI (50), Test (unlimited), T10, The Hundred, custom
- `types.ts` — `CricketEvent`, `CricketState`, `BattingCard`, `BowlingFigures`
- `reducer.ts` — ball-by-ball state machine
- `__tests__/` — full test coverage

Cricket sits as a sibling of `badminton/` under `sports/`, NOT as a config variant. This is the architectural fix for OpenScoreboard's `switch (sportName)` trap.

Deferred to v1.x. The architecture supports it without changes.

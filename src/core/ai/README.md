# core/ai

**Owner:** AI agent (M1 wave 2). **Status:** not started.

## Responsibility
- AI club manager: each week choose a valid lineup of 5, captain and a tactics preset per fighter; sign free agents to fill needs; renew or release contracts; stay within budget.
- Distinct, data-driven manager styles (`Club.aiProfileId`, profiles from content).
- Off-season planning (renewals, rookies).

## Rules
- **One rulebook:** AI acts only by returning `Command`s that core/game validates exactly like the player's. No direct state writes, no hidden bonuses, no knowledge of the player's future fixtures or tactics.
- Deterministic: randomness via `Rng.create(root, STREAM.ai, season, week, clubId)`.
- Never counter-builds reactively against the player's club.

Depends on: `util`, `rng`, `model`, `content`, `tactics`, `fighters`, `league`, `economy`. Tests: always produces a valid lineup when 5 fit fighters exist; never overspends past the budget rule; soak: AI clubs stay solvent and competitive over 20 seasons.

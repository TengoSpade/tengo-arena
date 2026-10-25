# core/economy

**Owner:** economy agent (M1 wave 1). **Status:** not started (needs 03-league-economy and economy.json, phase B).

## Responsibility
- Ledger: `post()` is the only writer of `Club.balance` and `GameState.ledger` (one entry per money movement).
- Weekly finances: wages, operating costs, match revenue; season prizes and prize money.
- Contracts: wage demands, offer evaluation (sign / renew), expiry handling, release costs.
- Free-agent market: pool size and refresh, asking wages.
- Budget rules (e.g. wage limits, negative-balance consequences) from 03-league-economy.

## Rules
- Money is integer (`Money`); round once with `roundHalfAway` where a fraction appears.
- Invariant (soak-checked): `balance == openingBalance + sum(ledger entries)` per club, every week.
- Same rules for player and AI clubs; randomness via `STREAM.market`.

Depends on: `util`, `rng`, `model`, `content`. Tests: ledger invariant, wage totals, prize distribution, offer acceptance boundaries, contract expiry at season end.

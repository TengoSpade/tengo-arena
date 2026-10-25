# ui/format

**Owner:** WP6. **Status:** implemented.

- `index.ts`: `configureFormat(content)` reads the currency from `economy.json` (D-K: "11,840 ts"); `formatMoney`, `formatInt`, `formatSigned` (true minus U+2212), `formatPercentBp`, `formatPercent`, `formatTicks` ("0:38"), `formatWeeks` ("2 wk"), `ordinal`, `formatDateTime`, `formatPlaytime`; the band helpers `attributeBand` (5/10/15) and `ratingBand` (40/55/70) and `potentialStars` (potential ÷ 20 in half stars) — one place for the TUNABLE thresholds (OC-9).
- `calendar.ts`: week codes and names (P1 Trials Day, P4 Kick-off week, Matchweek N, "<tier tournament> quarterfinal"), matchweeks left, phase names.
- `fighter.ts`: role ids and names, trait badges and tooltips, rating / potential / preset / attribute tooltips, contract, injury, trend, training and captaincy labels — all from content and core views.
- `rules.ts`: rule sentences from the content vocabulary (`ruleParts`, `ruleSentence`, `presetLines`, stance names).

Locale APIs (`Intl`, `toLocaleString`) are allowed here; they are banned in core.

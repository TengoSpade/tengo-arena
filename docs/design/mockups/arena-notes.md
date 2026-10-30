# Arena screen (M2): design notes

UI designer notes for the arena viewer, branch `m2/ui-arena-style`, against `docs/design/_drafts/05-technical-m2.md` (draft rev. 3, §A5, §A7, §A9, §A13). Mock: [`arena.html`](arena.html) (all names, clubs and numbers are EXAMPLE data; the lineup and opponents are those of the match-report mock, matchweek 6). Tokens: `src/ui/styles/tokens.css`. Marks and screen CSS: `src/ui/styles/components.css` §25 (loaded by `src/main.ts` with the other two files, so no import changes). Specimen: the "Arena marks" section of `components.html`.

Mock states: `arena.html?state=play|live|paused|round-end|replay`, plus `&theme=light`, `&motion=reduced`, `&focus=1` (draws the focus rings) and `&cvd=deutan|protan|tritan|gray`. Checked in headless Chrome: screenshots reviewed at 1280 × 720, 1440 × 900 and 1920 × 1080 in both themes, with reduced motion, the focus rings and the four colour-vision simulations; overflow measured also at 2560 × 1440 (none), no duplicate ids, every state switches cleanly. Not checked: a real GPU canvas, screen readers, interface scale above 100%.

## 1. Layout decisions

| Area | Decision |
| --- | --- |
| Frame | One full-window screen, no app shell (like the title screen): HUD 56 px, stage, fighter strip 72 px, all scaled by `--ui-scale`. |
| HUD | Home crest, name and "n of 5 standing", score pips (rounds won toward the target, filled = won); centre: "Round 2 of 3" and the clock (amber plus the word Overtime from 0:45); away mirrored; right: speed 1x 2x 4x, Pause or Play (brass only while paused), a hidden calls-left slot. Score pips use the side colour but sit left and right of the clock, so place also tells the side. |
| Stage | The canvas host, letterboxed 16:9 (32 × 18 m) with a 0.35 m wall outside the field. The viewer fills the host and follows its size. It gives about 35 px per metre at 1440 and 46 at 1920 (A5 says about 52 with no dock). |
| Transport | A 3 rem bar under the stage: status (Live, Paused automatically with the cause, Round over), step back and forward, the scrubber, the time readout, Live, Skip to end of round, Simulate the rest. Scrubber marks: ours above the track, theirs below (place carries the side), shape carries the kind (diamond = down, ring = interrupt, rally, handover, deathward, bar = overtime and round end). Live: the track is 0 to the head and marks stop at the head. Replay: the whole round, marks after the playhead dimmed, round tabs R1 to R3, no Live button. |
| Dock | A right column (22 rem; 20 rem below 1600 px) with the pause inspector above the key-moment feed. The feed is chronological, aria-live polite, newest line highlighted, opened scrolled to the newest, reusing the report's `.timeline` component. A moment click or Enter rewinds (live, never past the head) or seeks (replay). |
| Inspector | Opens while paused with a fighter selected (click, Tab, or `I`). Order: Doing now (rule badge, sentence, commit tick and reaction); Why this rule (every rule in order: skipped with its reason and observed value, the fired one marked, the rest "not reached"; the stance last); the probe line "deciding now"; State (HP, shield and focus bars, cooldowns, statuses with time left, fires this round and rules not yet fired, Freshness, captain grade). Rule sentences use the existing `.rule` styling and the `describeRule` wording. |
| Fighter strip | Ten cards, front row to back row, ours left. Per card: name, captain mark, rule badge, HP bar with hatched shield and a percentage, role glyph(s) and class, Freshness tag (Tired, Spent) when it applies, portrait from 1600 px. Side is the left border: solid for us, double for them (the ring style again). Downed: the HP bar dims, a diamond and "Downed · <cause>" replace it. |
| Round-end card | Over the north strip of the floor so a fighter still standing in the middle stays visible. Non-blocking: no scrim, `role="status"`, a 1.5 s drain bar (static under reduced motion), "Any key skips this card", then the between-round screen opens by itself. |
| Play match | The Squad screen's top-right action becomes a pair: Watch (brass, `Space`) and Simulate (neutral, a placeholder key). One primary per screen holds. The mock also shows the save-failure callout with Retry, "Resume watching" (Home, mid-round) and the "Resumed" toast. |

Floor marks drawn: centre line, four row markers (faint, no labels; labels only at kickoff), zones in the owner's ring colour at 22%, telegraphs, projectiles (at least 0.9 rem), impacts, floating numbers, the down callout. Draw order: floor, zones, telegraphs, bodies with their marks, then projectiles, impacts, numbers and callouts.

### The token on the canvas (specification for WP-M2D)

Bottom to top: facing wedge (a ring-coloured point), side ring, plate-coloured keyline, body (club primary with a secondary rim), role-glyph plate. Above the disc, bottom to top: focus bar (60% of the HP bar), HP bar with the hatched shield after the HP fill, row of rule badge and up to four status pips (hard control first, then a "+n" chip), cast bar, Freshness tag (first 3 s), name (selected fighter; `L` toggles all). Captain crown on a small plate chip at the top right. Selected: four corner brackets in `--c-focus` (their shape differs from the round rings, so a brass bracket is never read as a brass side ring). Hard control greys the ring but keeps its style. Downed: body and plate flattened to 60% height at 40% opacity, a diamond in the side colour, bars and wedge gone.

- **Ring.** Ours solid, 3.5 px; theirs two 2 px lines with a 1.5 px gap; a 1.5 px plate-coloured keyline inside and a 1 px one outside. Widths are CSS px at any zoom (not scaled by metres), so they stay legible at 27 px per metre.
- **Role-glyph plate (a decision beyond A5, please confirm).** The role glyph sits on a fixed plate (near-black in dark, cream in light), so its contrast never depends on the club colours. Without it a club whose primary is a role hue would hide its own glyph. The plate takes about a third of the disc.
- **Telegraph.** The caster's ring colour and ring style (ours solid, theirs double) at `--arena-telegraph-fill` alpha, a brighter edge, and a growing inner fill in `--c-arena-telegraph` for progress. Casts of 0.3 s or more also show the cast bar over the caster. Cone and line telegraphs use the same colours and edge style on the wedge or strip; the single-target line is the same edge style, 2 px.
- **Damage tones.** Colour and shape: physical = angular spark and warm white, arcane = round burst and violet, true = diamond and white. Numbers always carry a sign (−38, +45), and are drawn with a plate-coloured stroke so text keeps 4.5:1 on any floor.
- **Status pips.** A 1 rem chip on the plate, outlined 1.5 px in the family colour (the outline is what keeps the pip 3:1 against the floor), with a silhouette: buff = double chevron up, debuff = double chevron down, hard control = octagon with a bar, soft control = octagon ring, damage over time = drop, healing over time = heart, special = spark. Category to pip: `cc_hard` control-hard, `cc_soft` control-soft, `buff` buff, `debuff` debuff, `dot` dot, `hot` hot, `special` special; `shield` has no pip (the bar segment). All 34 statuses map through their category.

## 2. Token table (`src/ui/styles/tokens.css`)

Both themes follow the existing structure: theme-neutral values in the first `:root` block, colours in the dark block (also the default) and the light block, reduced motion at the end. Overlays sit on a plate (near-black `#14161a` with parchment ink in dark; cream `#fbf8ee` with dark ink in light), so every mark has a known background. Checks use WCAG contrast against the floor (3:1 for rings, glyphs, bars, pips; 4.5:1 for text) and CIEDE2000 under Machado 2009 simulations. Floor: dark `#3e3a32`, light `#eee7d6`.

| Token | Dark | Light | Use and check |
| --- | --- | --- | --- |
| `--c-arena-floor` | `#3e3a32` | `#eee7d6` | Flat floor. Both side rings and every role hue (on the plate) reach 3:1 |
| `--c-arena-wall` | `#716857` | `#857a64` | Boundary band. 3.5:1 and 3.4:1 against the page background |
| `--c-arena-line` | `#5a5448` | `#cfc4a8` | Centre line, row markers. 1.5:1 on purpose (faint) |
| `--c-arena-plate` | `#14161a` | `#fbf8ee` | Glyph plate, bar track, pip chip, label chip, keyline |
| `--c-arena-ink` | `#ebe6da` | `#1d1c19` | Text on the plate: 14.5:1, 16.0:1 |
| `--c-arena-edge` | `#8d897f` | `#5b5445` | Hairline around bar tracks: 3.2:1, 6.1:1 on the floor (the track alone is only 1.6:1, 1.2:1) |
| `--c-arena-hp` | `#ebe6da` | `#1d1c19` | HP fill, neutral, no red or green meaning: 14.5:1, 16.0:1 on the track |
| `--c-arena-track` | = plate | = plate | Bar track |
| `--c-arena-shield` | `#8fd6ee` | `#0f6b86` | Shield segment, hatched: 11.2:1, 5.7:1 on the track |
| `--c-arena-focus` | `#b8a8f7` | `#5b3fc4` | Thin focus bar: 8.6:1, 6.7:1 on the track |
| `--c-arena-select` | = `--c-focus` | = `--c-focus` | Selection brackets: 6.9:1, 4.0:1 on the floor |
| `--c-arena-telegraph` | `#fff0cf` | `#2b2418` | Telegraph progress fill and cast bar; the area takes the caster's ring colour |
| `--c-arena-hit-flash` | `#ffffff` | `#ffffff` | Hit wash on the body |
| `--c-fx-physical` | `#f2e6c8` | `#4a3b22` | Hit tone: 9.1:1, 8.8:1 on the floor |
| `--c-fx-arcane` | `#a98bff` | `#5a2fd0` | Hit tone: 4.2:1, 6.2:1 on the floor; 6.7:1, 7.2:1 as number text on the plate stroke |
| `--c-fx-true` | `#ffffff` | `#15130f` | True damage (extra, A5 names the tone) |
| `--c-fx-heal` | = `--c-good` | = `--c-good` | Heal number; follows the blue/orange status option |
| `--c-fx-shield` | = shield | = shield | Shield gain tone |
| `--c-pip-buff` | `#96eddc` | `#087a6b` | Pip glyph on the plate: 13.3:1, 4.9:1 |
| `--c-pip-debuff` | `#b6c24a` | `#76680a` | 9.3:1, 5.3:1 |
| `--c-pip-control` | `#c58ef7` | `#7437d0` | 7.4:1, 6.2:1 |
| `--glyph-pip-*` | 7 data-URI masks | same | `buff`, `debuff`, `control-hard`, `control-soft`, `dot`, `hot`, `special`; same format as `--glyph-*`, so the host decodes them the same way |
| `--c-side-us`, `--c-side-them` | unchanged | unchanged | Rings: 6.1:1 and 5.4:1 (dark), 4.8:1 and 5.7:1 (light) on the floor |

Geometry, effects and motion (theme-neutral, TUNABLE by the UI designer): `--arena-ring-w` 3.5px, `--arena-ring-line` 2px, `--arena-ring-gap` 1.5px, `--arena-down-opacity` 0.4, `--arena-zone-alpha` 0.22, `--arena-telegraph-fill` 0.16, `--arena-telegraph-edge` 0.9, `--arena-telegraph-progress` 0.3, `--arena-hit-flash-alpha` 0.7, `--arena-hit-flash-ms` 90ms, `--arena-flash-limit` 3 a second per fighter, `--arena-fx-fade-ms` 400ms and `--arena-number-merge-ms` 100ms (the two values A5 hands to the UI designer), `--arena-number-rise` 0.9rem, `--arena-pulse-ms` 220ms, `--arena-ease-ms` 220ms, `--arena-motion` 1, and the sizes `--arena-label-size` (the `--fs-xs` step), `--arena-pip-size` 1rem, `--arena-bar-h` 0.4rem. Also added: `data-pip` and `data-tone` mappings (`--pip-c`, `--pip-glyph`, `--tone-c`) next to `data-role`.

Colour-vision results (CIEDE2000, none / deutan / protan / tritan / grayscale, dark theme; light is similar):

| Pair | dE | Cue that carries it when colour does not |
| --- | --- | --- |
| side ring us vs them | 32 / 35 / 33 / 33 / **3** | **Ring style**: in grayscale brass and steel have the same lightness, so solid versus double is load-bearing, not decoration |
| pip buff vs debuff vs control | 21 or more in each of deutan, protan, tritan (29 / 24 / 69 in plain vision) | Silhouette and chip: chevron up, chevron down, octagon |
| physical vs arcane | 47 / 44 / 43 / 25 / 19 | Impact shape: spark, burst |
| HP vs shield | 23 / 23 / 19 / 30 / 6 | Hatch and place (the segment follows the HP fill) |
| role pairs (existing palette) | worst 33 / 15 / 10 / 7 / 0 | The five glyph shapes, as in 04 §9 |

The pip hues were searched, not picked: over about 150 candidate hues no triple kept every pair above dE 25 under all three simulations, and the best ones were all a mint, an olive and a violet; this set is one of them, and each stays at least 12 away from every role hue and both side colours in plain vision.

## 3. How the canvas reads the tokens

Consistent with `src/render/colors` and the render README ("one colour source"): the pure half never touches the DOM, so the UI host does the reading.

1. **Once per theme, motion or interface-scale change**, the host (a small module in `src/ui`, outside the render package) reads computed style from `document.documentElement` and builds the palette object it already passes to `createArenaViewer` and `setPalette`. Colours (`#rrggbb`, `rgb()`, `rgba()`) become `0xRRGGBB` plus an alpha; `ms` values become numbers; unitless values stay numbers; `rem` sizes are measured once with a hidden probe element (the host never multiplies by hand, so `--ui-scale` reaches labels, bars and pips).
2. **Aliases resolve on read.** `--c-fx-heal` and `--c-arena-select` are `var()` aliases; `getComputedStyle` returns the final value, so the blue/orange status option and the theme apply with no code in the viewer.
3. **Glyphs.** Role and pip glyph tokens are decoded to SVG markup in the same function (the `url("data:image/svg+xml,...")` payload), because the pip masks use the same format. `StatusCue.category` indexes the pip table in §1.
4. **Reduced motion** reaches the viewer as the boolean it already takes (OS setting or the in-game setting). The `--arena-*-ms` tokens mirror it for the DOM; the viewer need not read them, and `--arena-fx-fade-ms` stays 400 under reduced motion (numbers fade in place).
5. **Club colours.** `colorsForMatch` should lighten (dark theme) or darken (light theme) a body or rim colour in Lab, hue and chroma kept, until it reaches 3:1 on `--c-arena-floor`. The mock does this (the green and rust club colours are shown after the nudge). See open question 8: about half of all club colours need it.

Proposed `ArenaPalette` additions (the type is architect-owned; today it holds side, roles, glyphs, text, floor, wall, good, bad, warn and two fx colours): `plate`, `ink`, `edge`, `line`, `hp`, `track`, `shield`, `focus`, `select`, `telegraph`, `hitFlash`, `fx { physical, arcane, true, heal, shield }`, `pip { buff, debuff, control, ink }`, `pipGlyphSvg` (seven entries), and a `metrics` object for the numeric tokens above.

## 4. Keyboard map

From §A7 unless marked. The arena screen owns these keys while it is open; the global shell shortcuts (1 to 7 navigate, Space is Continue, S is Save) must yield, see open question 6.

| Key | Action |
| --- | --- |
| Space | Play or pause (Enter or Space on a focused button as usual) |
| 1, 2, 4 | Speed 1x, 2x, 4x. `[` and `]` cycle |
| Left, Right | One frame (0.1 s) while paused; Shift: one second |
| End (mine) | Return to the live head |
| Tab, Shift Tab | Select the next or previous fighter |
| Enter, I | Open the inspector for the selected fighter (while paused) |
| L | Name labels on all fighters |
| Home | Recentre the camera |
| Shift S | Skip to the end of the round (asks once while live) |
| Esc | Close the inspector, then back (replay: to the report) |
| Shift Space (placeholder) | Simulate, on the match screen only |
| Alt 1 to 3 (mine, as the report) | Replay round tabs |

Every control is a real `button` with a name, a tooltip and its key shown in a `kbd` where room allows. Pausing is free and unlimited; nothing in the screen needs timing.

## 5. Accessibility notes

- **Redundancy.** Role = glyph shape + hue + name in the strip and inspector. Side = ring colour + ring style + position + strip border style + mark side on the scrubber. Status = pip silhouette + chip + colour. Damage kind = impact shape + tone + number sign. Overtime = amber clock + the word. Tired and Spent = words. Down = diamond + word + callout + feed line. Shield = hatch + place.
- **Contrast.** Table in §2; every pair passes in both themes. Overlays on the canvas always sit on the plate, so nothing depends on the floor except the rings, the wall and the pip outlines, which are checked.
- **Reduced motion** (`data-motion="reduced"` or the OS): no rule-badge pulse, no hit flash, no floating-number drift, no camera ease, the drain bar of the round-end card is static; telegraph progress stays. Flashing is capped at 3 a second per fighter at any speed; nothing shakes; the round-end card is not full-screen.
- **Focus.** Native `:focus-visible` ring (2 px `--c-focus`, offset 2 px) on every control and the scrubber; the canvas ring is drawn outside the wall (a ring on the canvas box would sit under the 12 px wall); the selected token has corner brackets. `?focus=1` shows them.
- **Screen readers (best effort).** HUD, strip, feed and inspector are DOM. The canvas is `role="img"` with a label rewritten at each pause. The feed is `aria-live="polite"` and carries downs, overtime and the round end. The scrubber is a `slider` with `aria-valuetext` ("0:27, at the live head"). The round-end card is `role="status"`.
- **Interface scale.** HUD and strip heights, label, pip and bar sizes are rem or `--ui-scale`-based; rings and keylines are px by design.
- **Minimum 1280 × 720.** Works (27 px per metre, glyphs about 12 px); better to collapse the dock there (open question 2).

## 6. Inspector wording (for WP-M2E)

Skip reasons map from `RuleSkipReason` and the trace detail (`cond`, `observed`, `readyInTicks`):

| Reason | Sentence |
| --- | --- |
| `condition_false` | "Condition {n} was false: {condition text} (observed {value})." e.g. "Focus was 40, it needs 60." |
| `no_target` | "Nobody matched {selector}." |
| `only_filtered_all` | "Everyone matched failed the ONLY filter ({predicate})." |
| `on_cooldown` | "{Ability} is on cooldown: ready in {s} s." |
| `rule_cooldown` | "This rule's own cooldown: ready in {s} s." |
| `no_focus` | "Not enough focus: {have} of {need}." |
| `out_of_range` | "Out of range. {Target} was {gap} m away. {Ability} reaches {range} m." |
| `blocked` | "Blocked: {status}." |

The mock shows the worked example (Ysolde Varn's Triage list at 0:27: R1 out of range, R2 on cooldown, R3 condition 2 false, R4 fired), which matches the match-report mock ("Ysolde out of reach, R1 skipped").

## 7. Open questions and gaps in §A7 (not resolved here)

1. **The round-end overlay and "one Enter".** The brief says Enter continues from the overlay; §A7 says the overlay lasts 1.5 s, any key skips it, and the between-round screen then opens by itself, which carries the Enter. I mocked §A7. Also unclear: whether the overlay appears for the deciding round (and what it says before the report), and what follows it when `pauseBetweenRounds` is Never.
2. **Where the feed and inspector live.** §A7 lists them but not where. A 16:9 arena in 1920 × 952 leaves only about 114 px bands, so a permanent right dock costs arena size (46 px per metre at 1920, 35 at 1440, 27 at 1280, against about 52 in A5). Alternatives: the dock only while paused (the camera `padding.right` already allows it), a collapsible dock, or an overlay. No key for toggling the dock is in the list.
3. **Camera padding.** A5 pads 56 top and 72 bottom because the HUD strips are over the canvas. In the mock the canvas host is the stage between the strips (padding about 16 px, room for the wall), so those paddings do not apply. Confirm which the viewer should assume.
4. **Live scrubber.** "Spans 0 to the head" means the track rescales as the head grows, so marks drift left while the round plays. A fixed 0 to 75 s track would not leak the end but shows empty future. Mocked per §A7.
5. **Missing keys and homes.** Simulate (Shift Space is a placeholder; `S` is Save in the shell), Simulate the rest, return to Live, Watch preference under Streamlined (A3 says Streamlined simulates; how does the player watch one match?), and where "Paused automatically" tells its cause (I used the transport status and the down callout).
6. **Global keys.** 1 to 7 navigate screens, Space is Continue, `[` `]` step fighters or report tabs elsewhere, Home and Esc have shell meanings. The arena reassigns them; the shell must stand down while it is open. Tab "selects a fighter" would trap focus: where does Tab leave the canvas?
7. **Overtime vignette and horn.** 04 §7 lists a thin edge vignette and a horn; Q59 and A9 say no arena sound and no full-screen effects. Omitted: amber clock plus the word only.
8. **3:1 on body colours.** 04 §9 and A5 require every ring and body colour to reach 3:1 against the floor. With any floor that also keeps the brass and steel rings at 3:1, 49 of the 96 club colours (24 of 48 primaries) fail it on the dark floor and 47 on the light one; the median Lab lightness shift is 28 to 30 and the largest 50 (dark) or 43 (light), so a navy becomes periwinkle. Alternative: hold the ring and the plate to 3:1 and exempt the body, which a ring and a keyline already enclose.
9. **Role-glyph plate** (§1) is a design addition; the viewer's drawing and `ArenaPalette` need it.
10. **Downed bodies.** asset-006 says "then removed at round end"; I keep them in the round-end frame because they show why the round was lost. Replay feed: I show the whole round with later moments dimmed; §A7 says only "live feed". The live feed omits injuries (the report timeline has them; `KeyMoment` does not, and they are rolled at the round's end).
11. **Icons.** Four icons (`pause`, `step-back`, `step-fwd`, `skip-end`) are defined in `components.css` §25 outside the generated icon block (its generator is not in the repository); WP-M2E must add them to `IconName`. If the block is regenerated, move them in.

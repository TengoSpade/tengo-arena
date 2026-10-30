# Arena League — art direction and presentation

> ARENA LEAGUE DESIGN PACKAGE · DRAFT v0.9 · 2026-10-28. **v0.9 documents the M2 arena and replay screens as built** (M2 is built, merged to main (squash c7bcb8f of `m2/finish`) and tagged `m2-arena-viewer`; this pass adds no owner decision): `ui-arena` and the new `ui-replay` on the owner's answers (01 §8.1 O34 and O35) and on the UI designer's tokens, screen CSS and mock (the design-review decisions A18 of the architect's addendum, merged on main @ bdfd5bc): the bare `#/arena` and `#/replay` routes, the HUD, the fighter strip with home on the left whoever the player is, the transport (a fixed 0 to 75 s live scrubber; Skip, Simulate the rest and Dock icon-only under 1600 px), the right dock with the feed and the pause inspector, the keyboard scope, the 1.5 s round-end card, the report opening per pacing, the placeholder skin with its cues, and the polish round (dock, keys, home-left, icon transport, feed contrast, toasts). The camera is top-down with fixed framing (zoom, follow and the 3/4 view stay open, open-036); there are no class icons, sprites or arena sound in M2 (O34 (Q59)). v0.8 had updated the M2 direction to the owner's answers while M2 was still a contract. The screens of M1 and M1.1 are unchanged, except the Replay button of the report and the between-round screen's Continue. v0.7 documents the R002 playtest changes as built (main @ d440107, O27–O32; main was then @ 00ad3db): the box score with damage and healing received and a per-round view, the Freshness column and the effective rating in the Squad table, the true reserve swap, the R1/R2 markers, ratings and more stats on the between-round screen, and next season's wage room in the Market's Renewals view and the renewal dialog. v0.6 had documented the M1.1 "Playtest round 1" screens as built (main @ 293f49a, tag `m1.1-playtest-r1`): the level-up card with its real effect, the between-round screen and its keys, the 5 + 2 squad with Match reserve and Bench labels, the Freshness displays, the match report additions and the autosave settings. v0.5 had added those screens as designed (O15–O22). Merged from the UI/UX designer's phase-2 draft (`_drafts/04-presentation.md`), reconciled with documents 01, 02 and 03 by the lead designer, synced in v0.3 to the M1 build and to D-N to D-T, and in v0.4 to the QA polish round (m1/polish-ui @ c35d12a; main tagged `m1-season-mvp` @ 3e682d5). Reviewed by the requirements reviewer and the independent reviewer (01 §8.6); not approved by the owner. M1 was built at risk on these working assumptions.
> Follow the labels, scope, glossary, and authority rules in [document 01](01-game-vision-and-design-principles.md). REQUIRED appears only where an owner ID is cited (O12 match reports, O13 good UI design, T1 PixiJS from M2, T3 HTML/CSS UI, T5 theme data). **DELEGATED** marks D-J to D-M (the UI designer's OC-3 to OC-6) and the orchestrator decisions D-O, D-R and D-S where this document presents them, all adopted under the owner's goal instruction and pending confirmation (01 §8.2); D-U to D-AE, which the owner confirmed (O25), are REQUIRED where this document presents them, and the R002 changes follow the owner's tickets (O27–O32). **PERMITTED-CHOICE** (01) marks behaviour the implementation chose within stated bounds. Everything else the UI designer decided is PROPOSED, with PROPOSED · TUNABLE values in `src/ui/styles/tokens.css`. The owner questions are in 01 §8.5 (Q4, Q23–Q27, Q29, Q32, Q33; the M1.1 questions Q37–Q39, Q41, Q43, Q44, Q50 and Q51 were answered on 2026-10-27, O25).
> This document owns how the game looks, sounds, and communicates. It must faithfully present the rules in [document 03](03-gameplay-systems-and-content.md) and the journey in [document 02](02-player-experience-and-game-flow.md). Vocabulary follows 01 §7; the content key `archetypes` holds the five role ids.

| Field | Value |
| --- | --- |
| Game / version / updated | Arena League / v0.9 / 2026-10-28 |
| Status / design owner | Draft v0.9 (v0.9 documents the M2 arena and replay screens as built, named in the header), synced to the M1.1 build on main @ 00ad3db (M1.1 plus the R002 fixes and the merged fix branches) and to the M2 build on `m2/integration` (final code tip ceae885, merged to main (squash c7bcb8f of `m2/finish`) and tagged `m2-arena-viewer`), and reviewed (01 §8.6), not approved / the project owner |
| Milestone covered | **M1 "Season MVP"** (O14) and **M1.1 "Playtest round 1"** (O15–O22, with the R002 playtest fixes O27–O32): management screens and match reports (O12). The M2 arena and replay screens are documented as built (`ui-arena` and `ui-replay`, on O34 and O35 and the UI designer's mock, A18); M4 and M5 screens are placeholders (§6.3) |
| Visual references | **Approved EXAMPLE visual references and primary visual anchor** (§2 ref-001): the static mockups in [`mockups/`](mockups/index.html) (index, home, squad, fighter, match-report, league, market, components, and from M2 `arena.html` with `arena-notes.md`) and the design system in [`src/ui/styles/`](../../src/ui/styles/) (`tokens.css`, `base.css`, `components.css`). Sample names and numbers in the mockups are EXAMPLE data. Where a mockup's wording differs from this document, this document governs (§6.3, reconciliation notes) |

## 1. Presentation promise

**Status:** PROPOSED. Anchored to O13 (good UI design, REQUIRED) and pillar 2 "Clear at a glance".

> The game should look, sound, and feel like **a guild's war ledger kept by a sharp quartermaster**: dark, warm, quiet surfaces where numbers are crisp, every figure explains itself on hover, and the few things that need you this week stand out in brass. It supports the player experience of **"my choices won or lost this, and I can see why"** (01 §1, pillar 2) with the fewest clicks a PC player would expect.

- **Defining qualities**
  - *Ledger-dense, not cluttered.* Data lives in sortable tables with tabular numerals and right-aligned figures. Panels group by question ("Who plays?", "Can we afford it?"), never by data type. Implication: a 12-column grid, uppercase micro-titles, a 2.4 rem row height (2 rem compact).
  - *One loud colour.* Brass (`--c-accent`) is reserved for the primary action, the current selection and elite values. Everything else is parchment on slate. Implication: if two brass things compete on a screen, one of them is wrong.
  - *Explains itself.* Every number has a tooltip with its definition and its breakdown or source; every result has a "why" built from the rule trace (research C1.2, C2.2).
  - *PC-native.* Keyboard shortcuts on every recurring action, hover tooltips, right-aligned numbers, sticky table headers, no card stacks or bottom sheets (the FM26 lesson, research C2.4).
  - *Fantasy in the frame, not in the data.* The serif display face, club crests, role glyphs and trait badges carry the setting; tables and numbers stay plain.
- **Mood and intensity:** calm and confident between matches; a short lift at results (a brass "Won" and the round pips), never celebration spam. Losses are explained, not punished with red screens.
- **Signature motifs:** the heraldic **shield crest** (club identity), the five **role glyphs** (shield, diamond, triangle, hourglass, circle-cross), **rule sentences** set as `IF … THEN … ON …` with small-caps keywords, and the **brass Continue** button that always sits top right.
- **What the style excludes:** parchment textures, scroll ornaments and fake wood (they lower contrast and age badly); gradients on data; glow, bloom and drop shadows on text; mobile patterns (hamburger menus, full-screen cards, swipe carousels); modal pop-ups that interrupt Continue; a press-conference layer (P-17); colour as the only carrier of meaning.
- **Readability priority:** first, *what needs me now* (Continue state, blockers, "Needs action" digest items); second, *the next fixture and my lineup*; third, *trends and context* (standings, money, form).

## 2. Approved references and interpretation

**Status:** ref-001 is approved as the EXAMPLE visual reference and primary visual anchor (orchestrator instruction, 2026-10-25; the owner confirms the visual direction in 01 Q26, OC-1). Every other reference is exploratory and informs mechanics and UX lessons only. **Do not copy any other game's art, layout, icons, text or UI assets** (owner rule). Eslabong is a mechanics reference only; its install folder is never opened.

| Reference ID / link | Approval status | Adopt these qualities | Do not infer | Applies to |
| --- | --- | --- | --- | --- |
| ref-001: [mockups](mockups/index.html) (index, home, squad, fighter, match-report, league, market, components) and the [design system](../../src/ui/styles/) (`tokens.css`, `base.css`, `components.css`) | **approved EXAMPLE visual reference; primary visual anchor** | Palette, type, density, layout grid, component look, interaction patterns. The tokens are the source of every visual value | Sample names and numbers (EXAMPLE); `mockups.js` is demo behavior, not production code; mockup wording that predates the 03 merge (§6.3 reconciliation notes) | All M1 screens |
| ref-002: Football Manager 24 table screens (research B1.1) | exploratory | Sortable dense tables, attribute colouring by band, filters that stay put, keyboard navigation | Its colours, layout, fonts, iconography | Squad, Market, League |
| ref-003: FM26 negative reviews (research B1.1, C2.4) | anti-reference | What to avoid: extra clicks, buried information, card-based mobile layouts on PC | — | Whole UI |
| ref-004: FM27 "continue flow" presets (research B1.1) | exploratory | Presets for how often Continue stops | Their names or screens | Settings, Continue |
| ref-005: Teamfight Tactics round recap (research A2.1, A4.2) | exploratory | A per-fighter recap after each round | Art, layout | Match report |
| ref-006: Eslabong death summary and orders under HP bars (research A1.1) | exploratory, mechanics only | A death summary per down; an order or rule label above each fighter (M2) | Anything visual or textual; never open its files | Match report; M2 rule badges |
| ref-007: Crusader Kings III trait icons with rich tooltips (research Part D) | exploratory | Compact trait badges whose tooltip shows effect, category, opposite and source | Icon art, frames, text | Traits everywhere |
| ref-008: Gladiabots replay-to-editor (research A3.1, C1.4) | exploratory, M2–M3 | Jump from a report moment to the rule that caused it | — | Report, M3 editor |
| ref-009: Okabe & Ito, "Color Universal Design" palette (2008) | exploratory, permitted | Colour-blind-safe hue set for the five roles | — | Role colours |
| ref-010: WCAG 2.2 AA (1.4.3, 1.4.11, 1.4.4, 2.1.1, 2.4.7) | exploratory | Contrast, non-text contrast, resize, keyboard, visible focus | Full conformance claims | Accessibility |

- **Primary visual anchor:** ref-001. A screen that contradicts the component sheet (`mockups/components.html`) is wrong, or the sheet needs an approved change.
- **Primary motion / audio anchor:** OPEN (M1 is nearly static; §7–8 give rules, not references).
- **Reference conflicts:** ref-001 governs anything visual. Research references govern only the UX lesson named in "Adopt".
- **Asset availability / permitted use:** M1 ships no bitmap art. Icons are original 24 px stroke drawings encoded in `components.css`; glyphs, crests and portrait busts are original CSS masks. Fonts are system fonts (§3). Any later asset needs a licence record (P-15 credits).

## 3. Visual language

**Status:** PROPOSED. Values are PROPOSED · TUNABLE and live in `tokens.css`; change the token, never a component.

| Dimension | Required direction | Concrete constraint / example | Avoid |
| --- | --- | --- | --- |
| Representation | Flat 2D UI over a warm charcoal ground; heraldic and glyph shapes for identity | Panels are flat rectangles with 6 px radius ("forged plate"), 1 px borders, a faint top-light gradient on headers | Skeuomorphic parchment, 3D buttons, glassmorphism |
| Shape and proportion | Squared, sturdy shapes; identity through silhouettes | Crest = heater shield 40:46; role glyphs fill a 24 px square; trait badges are pills (positive), square-cut (negative), double-ringed (storied/rare) | Rounded "bubbly" chips for data; circles for everything |
| Palette | Slate surfaces, parchment text, one brass accent, five role hues, four status hues | Dark: bg `#0e1013`, panel `#171b20`, header `#1d2228`, text `#ebe6da`, muted `#aaa69c`, brass `#d9a54c`. Light: bg `#e9e5dc`, panel `#fbfaf6`, text `#1d1c19`, brass fill `#c88e31`, brass text `#8a5a12`. Roles (dark): tank `#56b4e9`, melee `#ee7a3c`, ranged `#f0e442`, controller `#d88bb6`, healer `#1fb88a` | Pure black or white; saturated reds and greens as large fills; role hues for anything but roles |
| Values and contrast | Data is the brightest thing on screen; chrome recedes | Text ≥ 4.5:1 on every surface, glyphs and bars ≥ 3:1 (measured, §9). Ratings use a lightness ramp: dim (1–5), muted (6–10), parchment (11–15), brass (16–20) | Mid-grey text on mid-grey panels; colour-only emphasis |
| Materials and surface detail | None beyond a 2–3% gradient on panel headers and the hero panels | `--tex-header`, `--tex-hero` tokens only | Noise, paper grain, leather, rivets |
| Lighting and atmosphere | Even, soft; a brass glow only on the hero panel corner | Shadows: `--shadow-1` (resting), `--shadow-2` (popovers), `--shadow-3` (dialogs) | Vignettes, dramatic spotlights on data |
| Scale and density | Dense but breathable | Root 15 px at 1280–1440 wide rising to 18 px at 2560; 4 px spacing scale; grid gap 1 rem; panel padding 1 rem; table rows 2.4 rem (compact 2 rem) | Rows under 28 px; more than 12 table columns at 1440 |
| Typography and iconography | Serif display for names and titles; humanist sans for UI; mono for traces | Display: Palatino Linotype → Book Antiqua → Georgia. UI: Segoe UI Variable → system-ui. Mono: Cascadia Mono → Consolas. Scale: 12 / 13 / 14 / 16 / 20 / 26 / 36 / 48 px at 1440. Tabular, lining figures for all numbers. Icons: 24 px grid, 2 px round strokes, currentColor | Display serif for numbers or table text; icon fonts; emoji; mixed icon styles |

**Typography offline rule (REQUIRED by the brief, PROPOSED in the package):** nothing loads from a CDN. The three stacks above are installed on Windows and have close equivalents elsewhere. PROPOSED (OC-2, 01 Q27): system fonts in M1; at M7 polish, self-host an open-licensed pair, recommended **Alegreya + Alegreya Sans (SIL OFL)**. Only the three `--font-*` tokens change.

**Role language (DELEGATED, D-J; OC-3).** Used unchanged in the M2 arena. Shape first, colour second, label always available:

| Role (`data-role`) | Glyph | Colour (dark / light) | Why this shape |
| --- | --- | --- | --- |
| Tank (`tank`) | Heater shield | sky blue `#56b4e9` / `#0b6fae` | Protection |
| Melee DPS (`melee`) | Diamond (blade point) | vermillion `#ee7a3c` / `#c1500c` | Edge, close quarters |
| Ranged DPS (`ranged`) | Upward triangle (arrowhead) | yellow `#f0e442` / `#957b00` | Projectile |
| Controller (`controller`) | Hourglass | reddish purple `#d88bb6` / `#a8457e` | Time, slows, holds |
| Healer (`healer`) | Circle with a cross | bluish green `#1fb88a` / `#007f5c` | Care |

Hybrids show both glyphs side by side (e.g. Paladin = shield + cross). Hues derive from ref-009; the light-theme variants are darkened to keep 3:1 on white.

## 4. Viewpoint and camera

**Status:** M1 has no arena view (O12, REQUIRED); from M2 the arena is built as this section sets it (T1; 05 §9.4 as built). The camera is the owner's answer (O34 (Q55)); the numbers marked "as built" are PERMITTED-CHOICE.

- **Perspective and framing (M2; approved, O34 (Q55)):** top-down orthographic 2D over the whole arena (P-03). The working arena of 32 m × 18 m (03 §1) is exactly 16:9, so the whole field fits a 1920 × 1080 window with room for the HUD and the dock: **as built, about 48 px per metre at 1920 × 1080 with the dock open (47.8 measured by the smoke; 29 at 1280 × 720; 35 at 1440 is the mock's figure)**; the 52 px of the no-dock estimate was not a requirement (A18, decision 2). Home starts at the west end, away at the east; each side's **front row** and **back row** are faint lines parallel to the centre line, labelled only at kickoff.
- **Player control (M2; O34 (Q55)):** fixed framing, with no zoom and no follow in M2 (no camera work is needed to follow a 5v5 fight). The 3/4 view (about 40°, as sprite pipeline C would render it), zoom 1×/1.5×/2× and a follow-selected-fighter option stay OPEN, to be decided with the sprite pipeline (open-036; art §12 Q4); the viewer keeps the projection, zoom and follow as configuration, so that decision needs no rework.
- **Required visible information (M2):** per fighter: HP bar with shield segment, focus bar, role glyph, side ring, captain crown, status icons, cast telegraph, and the **live rule badge** ("R3", P-22). Per side: fighters standing (and, once calls exist after M2, calls left, P-01). Global: round clock, overtime state (from 45 s), speed and pause.
- **Motion behaviour:** no camera shake by default; a 220 ms ease on zoom changes (once zoom exists, open-036); speed changes (1×/2×/4×, T1) never move the camera.
- **Constraints:** the arena never scrolls at default zoom, so nothing is ever off-screen. Labels avoid overlap by stacking above the HP bar.
- **Defaults and recovery:** every round starts at the default framing; Home key recentres.
- **Comfort controls:** reduce motion (also reduces hit flashes), screen-shake toggle (off), flash limit (§9).
- **Representative composition:** EXAMPLE: home lineup of 2 front / 3 back on the left third, away mirrored on the right third, centre third empty at kickoff; HUD strip 56 px at the top (score, round pips, clock), fighter strip 72 px at the bottom (portraits with HP and rule badges).

**M1 stand-in:** the match report (§6, ui-report) is the "view" of a fight: score, round pips, key-moment timeline, box score and the "what decided it" trace.

## 5. Characters, objects, and environments

**Status:** PROPOSED. M1 uses CSS placeholders only. M2 adds arena tokens and placeholder shapes (O34 (Q59)); the 42 class icons come with the sprite pipeline decision, after M2.

**Asset sources (O22, REQUIRED):** fighter assets must not use the existing 3D asset pipeline (asset-gen) or the Synty packs. The sprite pipeline is open-032: `docs/art/sprite-pipeline-research.md` recommends a new AI 3D → 2D render pipeline with direct 2D generation as the fallback, decided by a bake-off, and lists the owner's open questions (§12 there).

### Reusable asset briefs

**asset-001 · Fighter portrait (placeholder, M1).**
- *Role:* identifies a fighter in tables, lineup cards and the profile header.
- *Silhouette:* a bust per race (CSS mask `--bust-*`): human (neutral), elf (pointed ears, slimmer shoulders), dwarf (wide shoulders, beard), orc (broad head, heavy jaw). The Ashkin, the fifth race in `races.json`, has no bust yet and falls back to human (OPEN, small: an Ashkin bust is needed before M1 ships; 01 Q26).
- *Palette:* role-tinted radial field, parchment silhouette at 52% opacity, role glyph in the top-right corner.
- *Sizes:* 1.6 / 2.5 / 3.25 / 6.5 rem (xs, sm, default, lg). Injured fighters show 70% grayscale.
- *Acceptance:* at xs size in a 2 rem row, race and role are still distinguishable.

**asset-002 · Club crest (M1).**
- Heater shield with a rim, a diagonal two-colour field from `clubs.json` `colors.primary/secondary`, and a 2-letter code in the display face. Sizes 1.25 / 1.6 / 2.2 / 3.4 / 4.6 rem; letters hidden below 1.6 rem.
- *Acceptance:* the 16 clubs of one tier are distinguishable in the standings at 1.6 rem. Clubs whose two colours are both very light or both very dark get the darker rim automatically (rule for implementers: compute luminance, swap the rim token).
- M7 (release polish): heraldic charges (a lantern, an oar…) per club.

**asset-003 · Role glyphs (M1, permanent).** The five filled silhouettes of §3 at 12–36 px. They are used unchanged in M2 inside arena tokens.

**asset-004 · Trait badge icon (M1 placeholder).** A polarity glyph (up triangle, down triangle, gem, question mark for unrevealed in M4) in a round (positive), square (negative) or double-ringed (storied/rare) frame. Release (FUTURE): one icon per trait id in `traits.json` (`icon_trait_*`), drawn in the same 24 px stroke style.

**asset-005 · Class icon (after M2, with the sprite pipeline decision, open-032; not in M2, O34 (Q59)).** 42 icons keyed by `classes.json` `iconId`. Frame = the role glyph shape (hybrids: a split frame), interior = one emblem of the class's tool (gong, net, scalpel…). Monochrome with the role hue as the frame fill. 24, 32 and 48 px. *Acceptance:* the 6 classes of one role are distinguishable at 24 px by interior emblem alone.

**asset-006 · Arena fighter token (M2).**
- Circle sized to the fighter radius (0.5 m, 03 §1), side ring (brass for the player's side, steel blue `--c-side-them` for the opponent; in AI-vs-AI replays, home and away use club primaries with a luminance check), role glyph inside, facing wedge, HP and focus bars above.
- States: idle, moving, casting (telegraph arc), stunned (grey ring), downed (flattened, 40% opacity, then removed at round end). **As built (PERMITTED-CHOICE; A18):** the side ring is solid for the player's side and double for the opponent's, with keylines; the facing wedge and a role-glyph plate (so a club colour never hides the glyph) sit on the disc; a stunned body keeps its ring style and greys it; a downed body is flattened at the palette's down opacity with a diamond in the side colour, its bars and wedge gone, kept in the round-end frame and removed at the next kickoff; body colours are the clubs' exact colours, while rings, the plate, bars and pip outlines reach 3:1 on the floor (in a replay between other clubs the rings take the club primaries, shifted until they reach 3:1).
- *M2 treatment (O34 (Q59)):* placeholder shapes only: a coloured disc with the side ring, the role glyph(s), the facing wedge, the bars and the rule badge, and no sprite. A sprite skin comes later and adds to this token without replacing it (05 §9.4).
- *Fighter token revision (owner, 2026-10-30; PROPOSED as built on `m2/fighter-tokens`, mock `docs/art/reference/fighter-token-mock.png`):* the placeholder body is now the owner's token. The disc is filled with the fighter's **role colour** (`--c-role-*`; a hybrid is split diagonally, first role upper-left) with **OVR** (the round's kickoff rating; the "OVR" caption from a 56 px disc) and the **short role label** inside, from `combat.json` archetypes `shortName` ("TNK", "MEL/HEA"; full names stay in tooltips and the inspector), falling back to the role glyph(s) on a small plate only where the label cannot fit; the **class name** is printed under the token. The ring inside the disc's edge is the **Freshness ring**: arc length is Freshness 0 to 100 from twelve o'clock, clockwise (the colour-free cue), colour is the Freshness tier read from `levels.json` freshness.labels (fresh = status good, ready/Winded = warn, tired = halfway warn to bad, spent = bad, so the colour-vision option carries over); it is fixed for the round and never redraws. HP stays the viewer's bar above the token and follows the sampled HP; shield, focus, pips, rule badge, name chip and the Freshness tag are unchanged (since O36 the tag marks every penalty tier with its label from content: "Winded (62)", "Tired (41)", "Spent (18)"; the ring picked up the 75/50/25 tiers and "Winded" from `levels.json` with no code change). **Team cue:** the side ring (solid/double) is the team cue as before; the club's primary colour is a thin keylined bar under the class name (identity only, not held to 3:1). **Size (owner, 2026-10-30):** the token is 1.3 m of arena and never under 48 px: about 60 px at 1920 × 1080 (46 px per metre with the dock), 48 px at 1440 and 1280; the ring, stack, wedge and selection are sized to it and the viewer's separate glyph plate is omitted for this body (`BodyVisual.drawsRole`). Bunched fighters overlap (accepted); the selected or hovered token and its bars and pips are drawn above every other, and bars and pips always sit above bodies. The class name gives way (hides) where another token's stack would overlap it, except on the raised token. Names above the token follow the arena Labels setting (default "selected", unchanged).
- *Acceptance:* observers can name both sides' tank and healer in at least 90% of prompts (vis-003).

### Environment direction (M2)

A flat sand-and-stone floor at a mid value (so both side colours and every role hue reach 3:1), a centre line, faint row markers at kickoff, and walls that read as the boundary. No obstacles, hazards or decoration that could be mistaken for gameplay (open-019). Crowd and banners stay outside the walls. **Tokens (open-037, settled as built):** the UI designer added the floor, wall, effect-tone, plate, bar and pip tokens for both themes (the arena group of `src/ui/styles/tokens.css`; `components.css` §25 holds the screen CSS, and `mockups/arena.html` with `arena-notes.md` the mock); §3 keeps the role hues for roles. The viewer reads them once per theme, motion or scale change and takes every colour, alpha, size and duration from them.

## 6. Interface and interaction language

**Status:** PROPOSED unless an ID is cited. O13 (good UI design) and T3 (HTML/CSS UI) are REQUIRED.

### 6.1 App shell

Every management screen shares one shell (mockup: any page).

- **Top bar (3.5 rem):** club crest, name and tier (click → Home); season and matchweek; balance; wage bill (≥ 1480 px); roster count (≥ 1480 px); standing; search (Ctrl K); digest bell with count; theme; shortcut sheet; and the **Continue** button at the far right, always in the same place.
- **Side navigation (13.5 rem, collapsible to 3.75 rem):** Home 1 · Squad 2 · Fixtures 3 · League 4 · Market 5 · Finances 6 · Class codex 7; footer: Save / Load, Settings. Badges show counts only for things that need action.
- **Page:** page header (eyebrow, display-face title, one-line meta, page actions), then a 12-column grid of panels. Content stops growing at 118 rem and centres on ultrawide screens.
- **Continue** (one primary action, research C1.9) changes label with the state of the week: `Continue · Lineup at <club>` (opens the lineup) → `Play match · locks lineup` (which runs and autosaves the whole week before the report opens, D-O; from M2, with Watch chosen, each round plays in the arena first and is committed when it ends, O35, and Home's Continue reads `Resume watching` while a round is being watched) → (report) `Continue · To matchweek N` (opens the next hub; nothing further is processed). Preseason: `Continue · Week P2`, plus **Skip to Matchweek 1** on a quiet preseason week (it stops early if something needs the player, Kick off still confirms, and it is not offered under Thorough); end of P4: `Kick off season`; out of the Reckoning: `Advance to season end`. Before the season-end step, a confirmation lists unrenewed expiring contracts with Renew links. When something blocks progress (02 §3), the button turns neutral with a warning outline and reads `Decide first · <item>`; pressing it jumps to the item. Space triggers it from anywhere except text fields. During the player's match (M1.1) the between-round screen carries its own Continue (Enter or Space) that plays the next round. The **pacing preset** (DELEGATED, D-L; ui-settings) decides where Continue stops at the lineup and the report. A preset never changes a result: the match always uses the lineup, captain, rows and presets the player would lock, and the same seeds (P-05).

### 6.2 Interaction rules

**Click budget (vis-006; PROPOSED · TUNABLE).** The routine matchweek is **3 actions** (3 × Space): Continue → Play match → Continue. Reading the digest costs nothing (it is on Home). **M1.1:** each between-round pause adds one input (Enter or Space accepts the pre-filled suggestions), and the QA playtest counted a routine week at 2–4 inputs and a routine round at one. Budgets for common tasks:

| Task | Budget | Path |
| --- | --- | --- |
| Routine week, no changes | 3 | Continue, Play match, Continue |
| Change one fighter's preset | +2 | open the preset select on the lineup card, pick |
| Swap a starter | +2 | select a roster row, press F / B (or drag) |
| Change captain | +2 | select the fighter, press C |
| Sign a free agent from the digest | +3 | View, Offer, Send offer |
| Renew a contract | +3 | Renewals, Offer, Send |
| See why we lost | 0 | the report opens with "What decided it" at the top |
| Routine round (M1.1) | 1 | Enter on the between-round screen (the auto-swap suggestions apply) |
| Name or change the match reserves (M1.1) | +2 | select a bench fighter, press M (or drag him onto the Match reserves zone); "Suggest reserves" names two in one click |

**Confirm and undo (DELEGATED, D-M; OC-6).** A confirmation appears only for binding actions; everything reversible applies at once with Undo. Three classes, never mixed:
1. *Reversible settings* (lineup draft, rows, captain, presets, filters, sorting, theme): apply at once, show a toast with **Undo (Ctrl Z)** for 8 s. No dialog.
2. *Binding commit points* (02 §3): renew a contract, sign a trials rookie, release, Kick off season, Advance to season end, Start career, load a save, overwrite or delete a slot, and from M5 enroll and call up. One dialog states the consequences in numbers (cost, balance after, wage bill after, roster after). The primary button names the action and the amount ("Release for 10,620 ts"). Enter confirms, Esc cancels. No second "Are you sure?". Release, load and call-up show a warning callout because they cannot be undone. A dialog takes focus when it opens, and its keys still work if focus fell to the page body (M1.1 QA fix). On the between-round screen only the player's own swaps ask once ("a fighter swapped out cannot return"); accepting the pre-filled suggestions plays on at once. **A free-agent offer is not binding until week processing** (03 sys-transfers): its dialog is the form where wage and length are set, Send needs no extra confirmation, and the pending offer can be withdrawn from the Market or the digest until the player presses Continue.
3. *Continue and Play match:* no dialog. The lineup screen is the review; a blocked state explains itself on the button.

**Notification budget (PROPOSED · TUNABLE, OC-7, 01 Q26).** Item sources are the digest triggers of 03 sys-calendar.
- The weekly digest holds at most **6 items**, at most **2 marked "Needs action"**, ordered: blockers, needs action, our result, squad changes, market, league. Routine items are grouped (all other results become one "Matchweek 6 results" item).
- Toasts confirm the player's own actions only; at most 3 stacked; 5 s (8 s with Undo); never for information already on screen.
- Modal interruptions: only dialogs the player opened, the season-end review, and from M6 a dismissal. Nothing pops up on Continue except a blocker.
- Every item has a deadline if it has one ("ends after S3", "answer at week processing").

**Tooltips everywhere a number appears (PROPOSED).**
- Every displayed number, rating, stat, money figure, standing figure and trait has a tooltip: what it is, its breakdown or source, and when it changed. Glossary terms in prose carry a dotted underline (`.term`); numbers do not need one because all of them have tooltips.
- Hover opens after 280 ms (TUNABLE, Settings); keyboard focus opens at once; **Shift pins** a tooltip so its contents can be read or copied; Esc closes. A tooltip is never the only way to reach an action.
- Structure (component `.tooltip`): kicker (category), title, body, optional rows (breakdown with a total), flavour line, meta (source, date).

**Tables.** Click a header to sort (again to reverse); the sort is remembered per table per career. Headers are sticky. ↑ ↓ move the selection, Enter opens the row, the row stays selected when returning. Columns that do not fit at 1440 move to a column chooser; extra columns appear automatically on wide screens (`.col-wide` ≥ 1800 px). Numbers are right-aligned with tabular figures and never truncated; names truncate with an ellipsis and a tooltip.

**Right-click and drag.** Right-clicking a fighter anywhere opens a short context menu (Profile, Compare, Set captain, Move to front / back / reserve, Release…). Drag and drop works for the lineup; every drag has a keyboard equivalent.

**Writing.** Plain sentences, 01 vocabulary, numbers with units ("230 ts/wk", "2 wk", "0:38"). The report states causes and never advises or forecasts (pillar 2; P-13 "no outcome forecast").

**Money format (DELEGATED, D-K; OC-4, with D-C).** Gold displays as the **tessel, "ts"** everywhere (`economy.json` currency). Thousands separators, a true minus sign (−), "+" on gains.

### 6.3 Screen specifications

Each screen lists purpose, flow state (02 §3), layout regions in order of importance, data, actions, empty and error states, and shortcuts. Mocked screens link their mockup.

**Screens and flow states** (02 §3; the names 02 uses are in the last column):

| Screen | Flow state | Name in 02 |
| --- | --- | --- |
| ui-new (title and club select) | flow-state-001, flow-state-002 | title screen, new-career screen |
| ui-home | flow-state-003 | hub, matchweek hub, digest |
| ui-squad | flow-state-004 when opened by Continue; otherwise a hub screen | lineup screen, roster |
| ui-fighter, ui-codex, ui-league, ui-fixtures, ui-market, ui-finances | flow-state-003 (hub screens) | fighter card, tables, market, finance screen |
| ui-match | flow-state-005 | the match (M1: headless simulation; from M2 Watch or Simulate) |
| ui-report | flow-state-006 | match report |
| ui-between (M1.1) | flow-state-010 | between-round screen |
| ui-arena (M2) | flow-state-012 | arena (watching), a bare full-window route with no app shell |
| ui-replay (M2) | flow-state-013 | replay, a bare full-window route with no app shell |
| ui-levelup (M1.1) | flow-state-011 | level-up card |
| ui-season-end | flow-state-007 | season-end review |
| ui-save, ui-settings | flow-state-009 | menu, save/load, settings |
| Job offers (M6, not yet designed) | flow-state-008 | job-offers |

**Calendar labels** everywhere: P1 "Trials Day", P2, P3, P4 "Kick-off week", MW1–MW16, TW1 "Reckoning quarterfinal", TW2 "Reckoning semifinal", TW3 "Reckoning final" (03 sys-calendar).

**Reconciliation notes** (mockup wording that predates the 03 merge; implementation follows this document):
- "Wage headroom" in the mockups is the **wage room** of 03 (wage budget − wage bill − pending wages). Interface text says "wage room".
- "Likely to accept" in the market mockup becomes the deterministic **terms check** of ui-market. The mockups' **willingness** pips are the fighter's remaining negotiation patience with the club (03 sys-contracts).
- The mockups do not yet show the M1 **training emphasis** setting (D-A), the lineup **chemistry readout** (D-D), the **Pending offers** list or **rival-offer counts** (D-C). This document specifies them in ui-squad, ui-fighter and ui-market.
- `data-row="bench"` in the CSS is a roster fighter outside the match squad; interface text says "Bench" for him and "Match reserve" for the up to two squad reserves (M1.1; 01 §7). Where the narrowest layouts have no room, the mark reads "Reserve" and the tooltip keeps the full name.

#### ui-new · New career and club select

- **Purpose:** start a career in under a minute with an informed club choice. **Flow:** flow-state-001 title → flow-state-002 new-career.
- **Title screen:** Continue (latest save; disabled with "No saves yet" when none), New career, Load, Settings, Quit. Keyboard: Enter = Continue, N = New career.
- **Layout:** left column (4/12): manager name; world seed (collapsed under "Advanced", random by default, P-05); tier filter (Crown / Banner / Muster). Main (8/12): a grid of club cards for the selected tier. Bottom bar: chosen club summary and **Start career**.
- **Club card data:** crest, name, city and arena (`clubs.json`), tier, season budget and wage budget (03 sys-finance), mean roster rating, club captain, prestige, roster cap (10/12/14, O2), AI personality tag. Muster Circuit clubs carry "Recommended for a first career" (02 step 2).
- **Actions:** pick a card (click or arrows + Enter); optional rename and two colours (PROPOSED, 02 step 2) in a small dialog with a live crest preview; Start career (single commit, button disables on press).
- **Empty / error:** no club picked → the button reads "Pick a club to manage"; world generation failure → error panel with "Try again" and the seed shown for a bug report.
- **Shortcuts:** arrows move between cards, Enter picks, Ctrl Enter starts.

#### ui-home · Home, the matchweek hub ([home.html](mockups/home.html))

- **Purpose:** answer "what needs me this week?" and start the week in one press. **Flow:** flow-state-003 hub.
- **Layout (8/12 main, 4/12 side):**
  1. *Next fixture* (hero panel): both crests and names (player's club always on the left, venue says Home/Away), records, last-five form strips, venue and week; a strip with **our lineup** by row (role glyphs, a Freshness meter and label for each fighter, readiness and the auto-substitution note), **their last lineup** (D-R: the five they last fielded, labelled as such and never a forecast of their next lineup; "No matches played yet" until the opponent has played), **their style** tags (visible in M1, open-026) and the main threat; a footer with the next three fixtures.
  2. *Digest* ("This week"): the ≤ 6 items with filter tabs (All, Needs action, Results, Squad, Market); each item has an icon by kind, a title, one line of detail and its action button.
  3. Side: *Club* (balance and its change, this week's projection, Watch or embargo status, wage bill plus pending offers against the wage budget, roster plus pending offers against the cap), *Availability* (injuries with weeks out, contracts ending this season), *Advice* alerts ("Outclassed" when our lineup's rating trails the opponent's last lineup clearly; unused wage room together with open roster places), *wing table* (8 rows, top-4 Reckoning cut, 8th relegation line, our row and the next opponent highlighted).
- **Data:** fixture, both clubs' standings rows and last five, lineups, presets, style tags, digest items, ledger summary, wage budget, roster cap, injuries, contracts, wing table.
- **Actions:** Continue; Lineup (L); Opponent (O); each digest action; mark done (with Undo); Save (Ctrl S).
- **States:** *since you were away* (02 §7): after a load, the digest's first item summarises the last 3 results, standing, pending decisions and budget. *Bye or no fixture* (preseason): the hero shows the preseason checklist (budget, roster vs cap, trials day, contracts) instead. *Embargo* (03 sys-finance, D-C): a red banner under the top bar on every hub screen, "Spending embargo · balance −2,300 ts · new contracts above 150 ts are refused" (Banner minimum, EXAMPLE). *Empty digest:* "Nothing needs you this week" with Continue emphasised.
- **Shortcuts:** Space Continue, L lineup, O opponent, 1–7 screens, Ctrl S save, S Save / Load.

#### ui-squad · Squad: lineup and roster ([squad.html](mockups/squad.html))

- **Purpose:** pick five fighters, their rows, captain and presets, and manage the roster. This screen is also the **lineup screen** of 02 step 6 (flow-state-004) when opened by Continue.
- **Layout:**
  1. *Lineup board* (full width): **Back row** and **Front row** zones (front faces the enemy side, as in the M2 arena), sized by how many fighters each holds; one card per starter with portrait, name, captain crown or VC tag, class and race/age, a **preset select** and the rating (with its effective rating, "45 → 41", when his Freshness is below 75, O28); a validation strip underneath (✓ 5 of 5 fit, ✓ captain and vice-captain, ✓ presets, ⚠ injuries) with the lineup's mean rating (and, when it differs, the mean effective rating beside it) against the opponent's last lineup, the lineup's wages, and the **chemistry readout** ("Chemistry +3 · +1 composure each", one line per source on hover; 03 sys-chemistry, D-D). Each card also shows the fighter's **injury risk**: a word, and on hover an **estimate** of the chance per round started, always with ≈ and the note "estimated from typical rounds (not exact)" (as built, PROPOSED: the 03 sys-injury formula for a typical round, downed 55% and damage taken 60% of max HP, times the fighter's proneness); At risk and Still tender add their status text. The per-match career-ending estimate core computes is not shown in M1 (05 §12) and his **level and XP bar** with "next level in ≈ N matches" (03 sys-development; M1 showed a season XP bar and a trend), so benching a prospect visibly costs development (O17).
  2. *Roster table:* the **roster cap meter** (one cell per place, 11 / 12), filter chips (All, Lineup, Reserves, Injured, Contract ends), name filter, Sign. Columns at 1440: **#** (1–5 for the five in slot order, **R1** and **R2** for the two match reserves in the order they were named, blank for the bench; sorted the five, then the reserves, then the bench; O31), fighter (portrait, name, C/VC, rookie tag), class (role glyphs), race · age, rating (with its effective rating, "45 → 41", when his Freshness is below 75, and a tooltip that says where the loss comes from; sorted by the effective rating, the rated value breaking ties; O28), potential (stars, number on hover), lineup state (Front / Back / Reserve / injured weeks), preset, training emphasis (Balanced, Body, Mind; D-A), level and Freshness (M1.1; the M1 trend column is gone; Freshness is a meter and its number, with the word only for Tired or Spent, sortable, and a column in every view: Overview, Attributes, Contracts and Season stats, O28), traits (polarity dots with tooltips), wage, contract (ends, seasons left, warning tag in the final season). Wide-screen extras: apps, downs, rating sparkline S1–S3.
  3. *View switch* (page header): Overview, Attributes (12 attribute columns), Contracts, Season stats.
- **Actions:** drag between rows and the roster; keyboard F / B / R (front, back, reserve), C captain, V vice-captain, P cycle preset, E cycle training emphasis, Enter profile; "Last lineup" restores the previous five; **Auto-pick** applies the AI's lineup rule (03 sys-ai-manager step 8); Play match (Continue). **Pre-fill** (PERMITTED-CHOICE, as built): a new career's first lineup is the AI rule's pick; each later week starts from the last locked lineup without departed fighters and hired blades, and an unfit starter gets a one-click Bring in from the reserves.
- **M1.1 squad (O20) and Freshness (O19):** the lineup board gains a **Reserves** zone with 2 places next to the Back and Front rows; rows and presets are set for all seven; the validation strip adds "✓ 2 reserves" (0 or 1 is allowed when nobody else is fit). Every card and roster row shows a **Freshness bar** (0–100, with a tick at 75, where the penalty begins) in the label's colour and shape (Fresh ≥ 75 full, Winded 50–74, Tired 25–49 striped, Spent < 25 hollow; never colour alone), the value, and on hover the forecast "after a typical match ≈ 71", "Not Tired for ≈ 3 more rounds" and "Drains 4.2 a round · recovers +46 a week". The injury estimate adds the Freshness multiplier ("× 1.03 (Tired)"). The roster table gains Level and Freshness columns; the M1 trend is replaced by "next level in ≈ N matches". Match-day settings (auto-swap rule, between-round pause) are one click away from the board. **As built (PERMITTED-CHOICE):** the board names the two squad places **Match reserves** and everyone else on the roster is **Bench**; select a bench fighter and press **M**, or drag him onto the zone; naming a third reserve replaces the one named first (toast "{name} replaces {other}" with Undo); **a true swap (O29):** bringing a match reserve into the five (F or B, drag and drop either way, Bring in, or a Rotate tip) puts the displaced starter in the reserve's place and not on the bench (toast "{other} takes the match reserve place. Undo puts both back."), a bench fighter who comes in still sends the starter to the bench, and Undo restores the five and the reserves together; the match reserve cards show the rating with its effective rating and the Freshness (O28); "Suggest reserves" names the fit, fresh fighters who cover the roles of the five first, and the zone shows "Cover: …" or "No cover yet" (a hybrid covers both of its roles). A **Rotate** tip, "Rest {out} for {in}", appears when a starter would start a round below 50 and a rested fighter of the same role within 6 rating is available (it prefers the bench over the match reserves). The validation strip adds a hint when a starter is Spent and no rested fighter of his role is on the roster ("{name} is Spent and starts rounds with the Freshness penalty: no rested {role} on the roster. Consider signing depth.").
- **Selection and focus:** the selected fighter is outlined in brass on the board and highlighted in the table.
- **Captain changes:** C or V previews the consequence before it applies ("Rook Saltmere will be Snubbed: −2 chemistry for 6 weeks") and applies at once with Undo. Costs are evaluated only at the next lineup lock, so changing back before it is free (03 sys-captaincy).
- **Validation (inline, never a dialog):** fewer than 5 fit fighters → strip reads "4 of 5 · a hired blade will fill the last place" (open-006); no captain → the strip says one will be named at kickoff (the vice-captain if fit, else the best-CQ fit starter) and Play match stays enabled; the digest then reports the interim captain and why (`captain.interim`, D-S); roster over cap after relegation → Continue becomes `Decide first · Release N fighters` (flow-005).
- **Empty / error:** a roster of 0 cannot happen; a roster below 5 shows the hired-blade card (dashed, labelled) in the empty slot.
- **Shortcuts:** above, plus ↑ ↓ rows, Space Play match.

#### ui-fighter · Fighter profile ([fighter.html](mockups/fighter.html))

- **Purpose:** everything about one fighter, so decisions about playing, keeping or selling him are informed.
- **Layout:**
  1. *Header:* large portrait; name and captain mark; facts line (role badge, class, race and age, row, preset, tenure); **trait badges** (CK-style, rich tooltips: category, polarity, effect text from `traits.json`, flavour, opposite, source); rating (large pill) and potential (stars and number); actions Renew (enabled only in the final contract season), Compare, Release.
  2. *Tabs:* Overview, Tactics (read-only preset rules in M1 with fire counts from the last match, plus the class kit), Match log, Contract.
  3. *Overview grid:* **Attributes** grouped Physical (5) and Mental (7) as in `combat.json`, each a bar on the absolute 1–20 scale with band ticks at 5/10/15, the attribute's **ceiling** as a tick and **age wear** as a hatched segment (03 sys-fighters), the value and the change this season; **Age curve** for the fighter's race (physical and mental curves from `development.json`, growth / peak / wear zones, a "you are here" marker; elves and other races show their own age axis and the human-age equivalent); **Development** (season XP against the typical season, rating by season with potential as a dashed line; M1.1 replaces the trend word with the level, the XP bar and "next level in ≈ N matches"); **Traits** with effect lines; **Fitness and contract** (wage, end, release payout, captaincy 1–100 with its grade, injury status and history, "At risk" and "Still tender", the retirement chance from human-age 31 and the final-season status; 03 sys-injury, sys-development); **Career** table by season.
- **M1.1 additions:** the header shows the **level** with the XP bar (xpIntoLevel / xpNeeded), levels this season and "next level in ≈ N matches" (replacing the trend), and a "Level-up" badge when one is pending; the attributes list gains **Stamina** among the physical stats; a **Freshness** tile (bar, label, drain per round and weekly rest); the Tactics tab shows **rank pips** on each ability with the next rank's delta, and a **Perks** list (up to 4, tier and effect); the level-up mode for this fighter.
- **Actions:** previous / next fighter ( [ ] ), set preset, set training emphasis, set captain / vice-captain, compare, renew, release (commit dialog).
- **Empty / error:** a rookie has an empty career table ("First season · no matches yet"); an injured fighter shows the injury callout above the attributes; retired fighters open read-only with a "Retired after S5" ribbon.
- **Shortcuts:** [ ] cycle fighters, T tactics tab, Esc back to Squad.

#### ui-codex · Class codex (not mocked)

- **Purpose:** learn the 42 classes (O8) and their presets without leaving the game.
- **Layout:** left filter rail (role toggles with glyphs; "hybrids" toggle; search by name, ability or role tag such as "taunter"); main grid of class cards (role frame and icon, name, role(s), preferred row, complexity, one-line description); a detail pane on selection: flavour, abilities (basic, two actives, passive, each with cooldown, focus cost, range and description from `abilities.json`), stat emphasis bars from `ratingWeights`, the presets with their summaries and rules as sentences, and two lists: "Your fighters of this class" and "Free agents of this class".
- **M1.1 additions:** each ability shows its ranks 1–3 with each rank's change (`ability-ranks.json`); a **Perks** tab lists the 72 perks by archetype and tier with tags, requirements and exclusions (`perks.json`); starter classes carry a Starter tag on their card (O21), and the Market marks them with a ★ after the class name.
- **Data:** `classes.json`, `abilities.json`, `tactics-presets.json`, `ability-ranks.json`, `perks.json`, roster, market.
- **Empty:** a filter with no match shows "No class matches · Reset filters".
- **Shortcuts:** 7 opens; arrows move in the grid; Enter opens the detail; / focuses search.

#### ui-league · League: standings and the Reckoning ([league.html](mockups/league.html))

- **Purpose:** where we stand, what is at stake, and who we would meet. **Structure** (03 sys-league, sys-tournament; D-C): each tier has 16 clubs in two 8-club wings (Dawn and Dusk); top 4 of each wing reach the 8-club **Reckoning** (O9); the 8th of each wing is relegated; the Reckoning champion and the **Shield** winner (best tier record) are promoted.
- **Layout:** tier switch (Crown, Banner, Muster) in the page header. *Standings* panel with a Wings / Tier table switch: two wing tables (position with promotion ▲ or relegation ▼ mark, club, W–L, rounds, round difference, points, last five) with a dashed line under 4th (brass) and above 8th (red); the tier table adds wing and projected seed and marks the Shield leader. *Reckoning* panel: a bracket with quarterfinal, semifinal, final and champion columns, each match showing seeds, crests, short names, score and venue/week; a switch between "If the season ended today" (projection, explicitly not a forecast) and last season's result. At ≥ 1800 px the two panels sit side by side and the wing tables stack.
- **Zone legend:** colour bar + glyph + words for every zone; never colour alone.
- **Actions:** sort any table, open a club (club page FUTURE: roster, form, style tag), open a fixture's report.
- **Empty states:** before matchweek 1 the tables show 0s. Until matchweek 13 the bracket reads "Projection from matchweek 13 · seeds decided after matchweek 16"; from MW13 to MW16 it shows the live projection (03 sys-tournament); during the Reckoning the switch is replaced by "Live". The final always shows "Charterhall · TW3 · best of 5".
- **Shortcuts:** 4 opens; Tab between panels; W / T switch Wings / Tier table.

#### ui-fixtures · Fixtures and results (not mocked)

- **Purpose:** the season's calendar and every result.
- **Layout:** tabs *Our season* (list of our 16 fixtures plus Reckoning: week, opponent with crest and standing, home/away, venue, result with round scores, report link; the next fixture highlighted; past rows show our form chip), *By matchweek* (all 8 fixtures of a tier for a chosen week, ← → to change week, each with score and report link), *Calendar* (P1–P4, MW1–MW16, TW1–TW3 strip with markers for trials day, grant payments, contract deadlines).
- **Data:** fixtures and results (sys-league), calendar (sys-calendar).
- **Empty:** future weeks show "Not played"; an AI-vs-AI report opens read-only.
- **Shortcuts:** 3 opens; ← → change week; Enter opens a report.

#### ui-match · Simulating (transient, M1)

- **Purpose:** flow-state-005. In M1, Play match runs the whole week processing (every fixture of the week, the player's included) and writes the autosave before the report opens (D-O); the week takes about 0.2 s (median on the development machine, 05 §8). Show a 600 ms (TUNABLE; 0 with reduced motion) panel "Simulating · Round 1 · Round 2 · Round 3" filling in as rounds resolve, then open the report. Input is ignored except Esc, which does nothing but is not an error. M2: Play match offers **Watch** (the primary button) and **Simulate** (open-020 settled, O34 (Q54)); Simulate keeps this panel, and Watch opens ui-arena after the round's locked inputs have been autosaved (O35); the Streamlined preset simulates. As built, Play match offers the two buttons, Watch first; Shift+Space is Simulate there (and "Simulate the rest" in the viewer, A18 decision 3); under Streamlined, where Simulate is the primary action, the keys swap: Space simulates and Shift+Space watches.

#### ui-between · Between-round screen (M1.1)

- **Purpose:** flow-state-010 (02 §3): after each round of the player's match that does not decide it, show what the round did to the squad and let the manager swap (O20; O25, D-U, D-V). It is where Freshness matters (O19): nothing about it changes during a round.
- **Layout:** (1) a header strip with the round result, the score and the next round's number, plus "Swaps left: n of 2"; (2) **our active five**, one table row each (as built, PERMITTED-CHOICE): slot, fighter, **rating with its effective rating** ("45 → 41", with the reasons on hover; O30), the Freshness bar, value and label with this round's change ("Winded → Tired (48)", −10.9), this match's counters so far, grouped **Damage** (done, taken) and **Healing** (done, received), then downs (inflicted / times downed), rounds started and XP so far (O30), and an injury callout (an injured fighter is marked "must be replaced"); (3) **our reserves** (Freshness, label, rating with its effective rating, class and role glyph; O30); (4) the **planned swaps** list, pre-filled with the auto-swap suggestions and their reason ("auto: below 50", "forced: injured"), each with Undo; (5) a note "Withdrawn fighters cannot return this match" and, when relevant, "No reserve left: an emergency entrant will replace him" (the best-suited fit fighter outside the squad); (6) the opponent's round summary without his swap plans (decisions are blind).
- **Actions:** drag a reserve onto an active card, or select both and press Swap; choose the entering fighter's row (front or back; default the outgoing fighter's); Continue plays the next round with the planned swaps (no change accepts the suggestions at once; swaps the player makes ask once). **As built (PERMITTED-CHOICE), keyboard:** 1–5 cycle a swap for that slot, A restores the suggestions, N clears them, Enter or Space plays on; a routine round is one input. The opponent's side shows only its round summary: its suggestions and plan are never computed for the view (blind decisions, O25, D-U).
- **States:** no swaps left → reserves are dimmed with "No swaps left"; a withdrawn fighter appears greyed under "Withdrawn" with no action; pacing `when_urgent` opens the screen only for a forced choice, a fighter below the auto threshold or a missing captain; `never` skips it (the suggestions apply). Quitting here resumes here (P-05).
- **M2, as built (PERMITTED-CHOICE):** when the match is watched, the screen gains "Replay round n" (a checksum-verified replay of a committed round of the live match), and its Continue locks and saves the next round and opens it in the arena. While that write runs the screen says "Locking the next round..."; if it fails, one shared toast says so with a Retry that survives leaving the screen (05 §9.4). Reaching it in a watched match fetches the viewer chunks at idle.
- **Not here:** level-up picks (they wait until after the report, O25, D-X) and tactics edits (M3).

#### ui-arena · Arena viewer, the live round (M2, as built; mock `mockups/arena.html`, A18)

- **Purpose:** flow-state-012 (02 §3): watch the player's round live so that "why did that happen?" is answered on the field (pillar 2, P-22, vis-003). **Status:** the Watch or Simulate choice, the camera, the auto-pause defaults, replay availability and the commit point are REQUIRED as the owner's answers (O34, O35). Everything else below is the screen as built (PERMITTED-CHOICE), on the UI designer's tokens, screen CSS and mock, as the design review of A18 accepted them (open-037, settled).
- **Route and gate.** A bare full-window route, `#/arena`, with no app shell. It opens only for a round whose lock is saved: until then it says the match start is being saved, and nothing is simulated or shown; if the write fails it stays closed and offers a Retry (O35). The viewer is a lazy chunk, fetched at idle on Home and Squad in a matchweek, on the between-round screen of a watched match and after a load onto a waiting round (never when the player always simulates).
- **Play match.** Watch (the primary button) and Simulate, one click either way (O34 (Q54)); Streamlined simulates at Continue.
- **Layout (A18).** The canvas is the stage under a DOM HUD (T3): a top strip with the two crests and the score, the round pips, the round clock (amber from 0:45, with the word "Overtime"), fighters standing, the speed and pause; the transport; a fighter strip of ten cards; and the right dock, which holds the pause inspector above the feed and is open at every width (about 48 px per metre of arena at 1920 × 1080, 29 at 1280 × 720; the mock gave 35 at 1440; role glyphs are about 12 px at the minimum). **Home is on the left and away on the right, in the HUD, the strip and the round-end card, whoever the player is**; the player's side is marked by a "You" tag and the solid ring. **D** hides or shows the dock, remembered per device, and nothing resizes on its own.
- **The token (asset-006).** Each fighter shows a side ring (the player's solid, the opponent's double), a facing wedge, a role-glyph plate, an HP bar with a hatched shield segment, a focus bar, up to four status pips (hard control first, then a "+n" chip), the captain crown, the rule badge ("R3"; "S" for the stance), a cast bar and telegraph, a Freshness tag and the name. Telegraphs are clipped to the floor. Effect and hit cues are data-driven: every one of the 84 active abilities has a visible release cue and every one of the 34 statuses a pip. Floating numbers carry a sign and sit beside the disc; a down callout queue runs along one end of the field ("X downed by Y · Ability", one line each, 2 s, a captain's fall as one line, never an internal id).
- **Transport.** Play or pause, step back and forward, speed 1x/2x/4x, Live, skip the round, simulate the rest, dock. **Skip, Simulate the rest and Dock carry text, icon and key hint at 1600 px and wider and are icon-only under 1600 px, each with its full accessible name; the frame steps are always icon-only and Live keeps its label and key hint at every width.** A status note beside it says why the round stopped (a manual pause is its own stop and a resume clears an old cause; an auto-pause names its cause; "Round over"); the scrubber's value text says how far the playhead is behind the head when the round is rewound. The live scrubber is a fixed 0 to 75 s track: the area past the head is empty and cannot be sought, and its marks do not drift; marks closer than 12 px merge into one with a count.
- **Controls (the arena owns the keyboard; the shell's screen shortcuts stand down).** Space plays or pauses; 1, 2, 4 or [ ] set the speed (1x at first, then the speed remembered per device); ← → step a frame while paused, Shift ← → a second; End returns to Live; Enter or I opens the inspector; L toggles names; D the dock; Home recentres; Shift+S skips to the end of the round (asks once); Shift+Space simulates the rest of the match (asks once; Watch does not come back in that match); Ctrl S saves while paused (while the round runs it says to pause first); F8 files a ticket, which captures the arena; Esc closes the inspector, then asks once and leaves to Home with the match still live (Continue there reads "Resume watching"). Tab walks the ten fighter cards in the normal order and focus is selection (clicking a token focuses its card); the canvas is one tab stop that never traps; the key-moment feed is one roving tab stop (↑ ↓ between lines). Every action is reachable by keyboard (§6.4).
- **No look ahead (O34 (Q56)).** Pause is free and unlimited. The player can rewind within the current round, and End returns to the head. The scrubber, feed, strip and inspector show only what has been shown (a test compares the DOM for a full log and for a log cut at the head). A live round is drawn one frame interval behind its head, so its motion is as smooth as a replay's.
- **Inspector ("Fired this round").** Selecting a fighter while paused shows his rule as a sentence; what he would decide now; why each earlier rule was skipped (the reason, the condition and the value observed, the ready-in time); the rules he has fired so far this round, with counts, under "Fired this round"; HP, shield and focus; cooldowns; statuses with time left; his Freshness and captain grade. Both sides' rules are shown (open-026); from M4 opponents' rules are read at the viewing club's knowledge (P-13).
- **Feed.** Key moments as they happen, in the dock: downs (the fallen, the credited fighter and the ability; a captain's fall is one line), overtime and the round end. Injuries stay out of the live feed (they are rolled at the round's end and shown between rounds). The feed's text and marker contrast were raised in the polish round; the feed announces downs, overtime and the round end to screen readers.
- **Auto-pause (O34 (Q58)).** Playback stops after drawing the tick of the event, so its cause is on screen (and in the transport status). On by default: one of the player's fighters downed, the player's captain down, overtime start. Off by default: an enemy downed, a fighter of the player's club below 25% HP. Each is a switch in Settings › Match day › Watching, and a live round also pauses when the window is hidden (on by default). A stop that lands on the round's end tick is the round end only, so the player presses Play once to leave the round.
- **Round end (A18, decision 1).** A non-blocking card, 1.5 s, names the last to fall (none for a round that ended at the time cap or was skipped); any key skips it and that key is consumed; then the next stop opens by itself, so a round boundary costs one input (ux-001, D-AE). After a non-deciding round the next stop is the between-round screen per `pauseBetweenRounds`, or the next kickoff when it does not pause; after the deciding round the card says the match result, then the report opens per the pacing preset (D-L: Thorough always, Balanced after a loss or an injury, Streamlined after an injury only) or Home shows a result toast.
- **Failures and toasts.** A failed lock write keeps the arena closed with a Retry (O35); a commit that fails when a round ends shows a failure card ("The round could not be saved", nothing lost) with Retry, which sends the same log hash, and Leave, and a `watch.mismatch` shows a defect card with Leave only (Leave goes Home with the match still live; Continue there reads "Resume watching"); a failed cursor save at a stop leaves a quiet note in the transport and is retried at the next stop; a lock failure on the between-round Continue gives a Retry toast that survives leaving the screen. Toasts: "Saved to slot n" for Ctrl S, "Resumed" with the time (and why the round had stopped), an error toast with the reason.
- **Resume.** Loading a save whose match is in a watched round opens the arena paused where playback last stopped, with the "Resumed" toast (built as the working assumption of open-016; the stop cause is remembered per device and recalled only for the same career, fixture, round and cursor).
- **Accessibility (§9).** Role is glyph shape plus hue plus the name in the strip and the inspector; side is ring colour plus ring style; status is pip glyph plus colour; Tired and Spent are words. No timing demand anywhere. Reduced motion draws effects static at their end state (numbers fade in place), removes pulses, trails and camera ease and keeps telegraph progress, which is information; a fighter's flash starts at most 3 times a second and there is no screen shake or full-screen flash. The HUD, strip, feed and inspector are DOM.
- **Overtime (A18, decision 6).** The clock is amber with the word "Overtime", the scrubber has an overtime mark, the feed says "Overtime begins", and a thin static amber line shows on the inner edge of the wall band (it fades in over 360 ms, instantly under reduced motion, and never pulses). No horn (O34 (Q59)).
- **Not here:** calls (after M2; the HUD keeps a hidden calls-left slot), the tactics editor (M3), class icons, sprites and arena sound (O34 (Q59)), and zoom, follow and the 3/4 view (open-036).

#### ui-replay · Replay (M2, as built)

- **Purpose:** flow-state-013 (02 §3): re-watch a stored match round by round, so the report's "what decided it" can be seen on the field. **Status:** which matches can be replayed, and that replays end at an update that changes a balance value, are REQUIRED (O34 (Q56)); the rest is as built (PERMITTED-CHOICE).
- **Route.** A bare full-window route, `#/replay/:fixtureId`, with an optional round and tick (`?round=2&tick=300`); it is the same screen as ui-arena in a replay mode.
- **Entries.** The report's Replay button; the report's key moments (a replay starts 2 s before the moment); the fixtures list (its action cell); Home's last result; and "Replay round n" on the between-round screen, which replays a committed round of the live match. A button that cannot work is disabled and its tooltip says why: "Older matches between other clubs keep only their summary, to keep saves small." (compacted, also for a match older than last season), "Played before a balance update: the replay cannot be rebuilt. The report is unchanged." (another sim) or "Your match is in progress." (PERMITTED-CHOICE wording).
- **Controls.** As the live arena, with free seeking over the whole round: round tabs (Alt 1–5), a scrubber with key-moment marks, frame and second steps. The feed shows the whole round with later moments dimmed (there is nothing to leak in a replay). Esc closes the inspector, then goes back to the report. In a replay between other clubs the rings take the club primaries, shifted until they reach 3:1.
- **Integrity.** A replay is checked against the stored round checksum when it loads; a mismatch is a defect and is never shown. A replay never changes a saved result (P-13).

#### ui-report · Match report ([match-report.html](mockups/match-report.html))

- **Purpose:** make the result explain itself (C1.2, pillar 2, P-22); vis-001 asks playtesters to name a concrete cause from this screen.
- **Layout:**
  1. *Scoreboard* (home club on the left): crests, names, a large score, result line (Won/Lost, points, gate if home), **round pips** (winner, duration, end reason: standing count, overtime or time-cap tiebreak step), and the **MVP strip** (portrait, headline numbers, "How MVP is chosen" tooltip). MVP (PROPOSED · TUNABLE; presentation only, with no mechanical effect; **as built**, 03 sys-match-report): the fighter on the match winner's side with the highest score over the match, = damage dealt (to HP and to shields) + healing done + shielding done + 150 × downs inflicted + 50 × assists; ties go to the earlier lineup slot. The tooltip states this formula.
  2. *Round tabs:* Whole match, Round 1–3 (or 1–5 in finals) filter every panel below.
  3. *What decided it* (top of the main column): a one-sentence summary callout (after a loss it adds a line on the rating gap between the two lineups), then up to 5 **rule traces**: fighter, preset, verdict, the rule as a sentence, fire counts, and one line of effect. Traces and counters come from 03 sys-match-report. **Selection heuristic as built (PROPOSED · TUNABLE; WP7, `match-report/analysis.ts`)**, a presentation rule that chooses what to show and never changes or forecasts a result (P-13), with *contribution* = damage dealt + healing + shielding + 250 × downs inflicted (a ranking aid only, not the MVP score), in this order and without repeating a fighter's rule:
     1. **Helped:** our two highest contributors, each with his most-fired rule (the stance only if no rule fired), with downs, damage and healing.
     2. **Hurt us:** the opponent's highest contributor and his most-fired rule.
     3. **Hurt:** our fighter who was downed first in the most rounds (at least two), with the rule he spent most ticks committed to and who downed him.
     4. **Idle:** never-fired rules of our starters, in lineup order (the P-22 warning), until there are 5 traces.
     A round decided at the time cap adds a line naming the tiebreak step. Not built in M1: traces for rules skipped for a reason (cooldown, out of reach, controlled) and a "blocked" verdict (the M2 pause inspector shows them for the paused tick, ui-arena).
  4. *Box score* (O27): both sides (ours first, theirs dimmed), the columns grouped **Offense** (downs, damage done), **Defense** (downed, damage received) and **Support** (healing done, healing received, shielding), then control seconds, rules fired, Freshness (before → after, ours) and XP; every column sorts and every number has a breakdown tooltip (per round, per ability). **As built (PERMITTED-CHOICE):** each side ends with a **Team total** row that is the sum of the rows above it; a **Match / R1 / R2 …** toggle in the panel header (and the round tabs) shows the same counters for one round, with how each fighter fell and the HP he had left; the less-needed columns (Row, Shielding, Class, Control, Rules, in that order) are not drawn when the panel is narrow, and the report stacks below 1800 px so the table has the room. Damage is HP damage and healing is effective healing, overheal excluded, and a fighter's own healing counts at both ends (03 sys-match-report). When a match cannot be replayed (another build played it) the per-round counters are missing and the panel says so, while downs, falls and HP left stay; healing received reads "—" when it was never counted.
  5. *Key moments* (side): a timeline grouped by round; markers by side colour and by event shape (diamond = down, ring = rule or save, square = injury, bar = round end or overtime); each item names the actor, the rule or ability and the cause (an interrupt is listed only when another fighter caused it, never for a cast the caster dropped). Clicking an item highlights the related trace and box-score row; from M2 it jumps the replay to that tick.
  6. *Injuries and XP:* injury callouts with cause and weeks out; XP gains and attribute changes. **M1.1:** each round tab shows both sides' active five with Fresh, Winded, Tired or Spent tags; the timeline adds swap lines between rounds ("After round 1 — Home: Druid (Tired 48) → Bard (Fresh 92), auto"); recaps say "entered after round n", "swapped out after round n" or "injured in round n"; ranked abilities read "Shield Bash II". **As built (PERMITTED-CHOICE):** the box score covers everyone who started a round, marks a reserve who came on "sub R2" ("sub" alone when the round is unknown; an emergency entrant is labelled as such) and shows each fighter's Freshness from the start of his first round → after the match with a breakdown tooltip; a Team total row ends each side (the sum of the rows above it, over everyone who fought, O27); the "Bench · ⅓ XP" list shows every fit fighter who started no round with the XP he earned ("bench ⅓", "reserve" for a named reserve who never came on) and the XP line reads "XP this match: total · n from rounds played + n bench ⅓"; perk procs appear per fighter ("Perk ×n"); fighters who levelled get a "Lv n" chip, and the level-up card opens after the report per level-up pacing or from the "Level-ups (n)" badge. A match between other clubs shows "Summary only" once it is compacted (3 weeks after it was played, O24; never for the player's own matches in the season), under a plain note ("The detailed report of an older match between other clubs is not kept, to keep saves small. What is kept: …"; PERMITTED-CHOICE wording), and the fighter's match log lists it with the kept totals and a dash for damage taken, while Home still shows the next opponent's last five: the score, the rounds and each fighter's rounds, downs, damage and healing (03 sys-match-report).
- **Actions:** Continue (to the next week's hub; the week was already processed and autosaved at Play match, D-O); open any fighter; copy the event log; Replay (enabled from M2 when the match can be rebuilt, otherwise disabled with the reason as its tooltip, 02 §3, Replay availability; O34 (Q56); as built, the key moments of the timeline also open the replay 2 s before the moment).
- **Empty / error:** a report missing its event log (an old save) shows score and rounds and "Details unavailable for this match"; a hired blade in the lineup is labelled in every table.
- **Shortcuts:** Alt+1–5 and [ ] round tabs, ← → previous/next report, Space Continue.

#### ui-levelup · Level-up card (M1.1)

- **Purpose:** flow-state-011 (02 §3): let the manager pick 1 of 3 options when a fighter levels (O18). It opens after the match report per level-up pacing (`detailed` default in M1.1; `balanced`; `fast`), or from a **"Level-ups (n)"** badge on Home, Squad and the fighter page.
- **Layout:** the fighter (portrait, name, class, new level, XP bar reset with the carried-over XP); **three option cards**: a *stat* card shows the stat's real change on the scale the fighter page shows, to one decimal, for example "10.4 → 11.3 (+0.9)" (a pick adds one point or the room left under his ceiling, so it is never a whole-number step the pick does not make), a line that says whether the shown stat rises to the next whole number or stays, and a tooltip with the reason ("never past his ceiling", "only 0.43 left") and the room under his ceiling, plus the rating change; a *rank* card shows the ability with its rank pips and the next rank's one-line delta ("Shield Bash II: cooldown 9 → 8 s"); a *perk* card shows its name, tier, tags and one-line effect from `perks.json`; options made illegal by an earlier pick are greyed out with the reason. A separate **trait offer** row, when present: two trait chips with their kind and effect, and "Neither".
- **Actions:** pick a card (click, 1–3, Enter); **Auto-pick** highlights and takes the option the fighter's policy would take; **Later** keeps it in the queue (at most 3; the digest says when the oldest auto-resolves); a mode selector for this fighter ("Ask me", Auto, Auto favouring stats, Auto favouring skills). With several fighters, a stepper ("2 of 4") moves through them.
- **States:** no pick is possible while a match is in progress; a level that resolved empty (nothing left to offer) shows a short note instead of cards.

#### ui-market · Market: free agents, offers, renewals, releases ([market.html](mockups/market.html))

- **Purpose:** find, compare and sign free agents within the cap and the wage budget (R6, O10, P-09).
- **Layout:** filter rail (search; role toggles where hybrids match either role, open-024; class; race including Ashkin; age range; minimum rating; switches "Fits wage headroom", "No negative traits", "Only new this week"); results table (compare checkbox, fighter, class, Race and Age columns, rating, potential, traits, ask per week, the **ask for my club** at 1, 2 and 3 seasons (preferred length marked), signing cost, **rival offers** (a count, never amounts), a starter flag ("would start for you"), **willingness** (3 pips = patience left with this club this season; 0 = "will not deal with you this season", 03 sys-contracts), Offer); a sticky **compare tray** (2–3 fighters against a chosen roster fighter) opening a comparison dialog with the best value per row marked ▲. Page header: free agents count, roster places left (cap − roster − pending offers), wage room (tooltip: wage budget − wage bill − pending wages). A **Pending** tab lists sent offers with their answer week and Withdraw.
- **Offer dialog (commit):** wage stepper (5 ts steps; Shift 25), length (1–3 seasons, `economy.json`), the fighter's ask, a **terms check** callout (at or above his ask: acceptable, and he takes the best acceptable offer at week processing, with +1,000 for clubs where he would start, a figure the tooltip and the dialog read from the content (`economy.market.starterBonusBp`, KI-16); within the counter window: he will counter; below it: refused, patience −1; the rival-offer count; never a probability forecast, P-13), signing cost (charged on acceptance), balance after, roster after, wage bill after with a meter against the budget. Footer note: offers are answered at **week processing** and can be withdrawn until then (03 sys-transfers, D-C). A blocked offer shows one state with its reason in a tooltip (roster full, over the wage room, cash, embargo). Columns respond to width so 1280 px shows whole names. Send offer → toast "Offer sent · he answers when you Continue"; the answer arrives as a digest item.
- **Renew** uses the same dialog from the profile or the digest (renewals answer at once, 03 sys-contracts).
- **Renewals judged on next season (O32; PERMITTED-CHOICE, as built):** the Renewals view opens with a **Next season's wage room** panel: the projected wage budget (S{n}; a projection that assumes no promotion or relegation) less the contracts that continue, less the renewals already agreed, less the pending offers that run into next season, giving the room (or "Over by"); beside it a **Not counted** list of the contracts that end this season and are not renewed, with their wages and the note that renewing one adds his new wage; and a line that sums every ask ("Renew all 3 at their asks: 505 / wk, 105 over the room", or "… of the room left"; EXAMPLE figures: asks of 75, 85 and 345 against a room of 400, as in 03 le-033). The table gains a **Next season** column that says Fits or Over {n} for each ask on its own (tooltip: the room left, or the excess). The renewal dialog replaces the wage-bill meter with **Next season's wage bill after** (the commitments plus this wage) against the projected budget, a Fits or Over verdict, the breakdown (continuing + agreed renewals + pending offers + this renewal), the fighters not counted, and "Assumes no promotion or relegation"; a renewal that does not raise the wage reads "No raise: allowed whatever the room is." A refusal reads "Over next season's wage room by {n} per week (projected budget {b}, already committed {c}). Ask for less, or renew fewer of the others." A free-agent offer made while the season-end step is pending, which starts next season, is judged and shown the same way. **Release** uses the commit dialog on the profile (payout, balance, wage bill, roster and captain after).
- **Errors (inline, with reasons):** roster full → "Roster full (12/12). Release a fighter first.", or with pending offers "Roster full with pending offers (9 + 1 of 10)" (02 flow-004); over the wage room → the Offer button is disabled and the ask shows a warning tag with the excess (a renewal is judged on next season's room, O32); embargo → "Spending embargo: only tier-minimum offers (150 ts, 1 season) while you have fewer than 5 fit fighters" (Banner, EXAMPLE) (03 sys-finance).
- **Empty:** no match → "No free agents match · Reset filters"; Rookies tab outside P1 → "Trials-day rookies are available in week P1 only; unsigned rookies join the free agents". In P1 the tab lists the club's exclusive share (season 1: exactly one rookie, D-P) at its Trials Day ask, capped at 1.25 × the tier minimum; Sign is binding at once with no signing cost (commit dialog).
- **Shortcuts:** 5 opens; / search; C compare; O offer on the selected row; Enter sends in the dialog.

#### ui-finances · Finances (not mocked)

- **Purpose:** can we afford the season, and where does the money go? (O10)
- **Layout:** tiles (balance, this week's projected net, wage bill plus pending against the wage budget, projected balance at season end before prizes); the **season budget** with its parts (grant after any Registry deduction, parachute, promotion grant, sponsor retainer, projected gate) and the reserve contribution to wage room; a **wage bill** table (fighter, wage, contract end, share of the wage budget, sorted by wage); a **revenue breakdown** (central grant instalments at P1 and after MW8, sponsor retainer, gates, prizes) as a stacked bar by week; a **projection** line chart of balance to season end with markers for grant payments and the Reckoning; the **ledger** (week, item, amount, balance) with filters.
- **States:** "Watch" warning when the projection goes below 0 within 4 weeks; embargo banner; Registry advance explained with its repayment (03 sys-finance, D-C).
- **Shortcuts:** 6 opens.

#### ui-season-end · Season-end review (not mocked)

- **Purpose:** flow-state-007; show everything the season-end step did (02 step 10), in order, read-only.
- **Layout:** a stepper across the top (Final standings · Reckoning · Money · Aging and levels · Retirements and contracts · Next season), one panel per step, Next and Back, and **Begin next season** on the last step.
  - *Final standings:* wing and tier tables with promotion and relegation banners; our movement in large type ("Promoted to the Crown Circuit").
  - *Reckoning:* the completed bracket and prize per round reached.
  - *Money and prestige:* table and Reckoning prizes, the season's revenue, the prestige change with its reasons, and next season's season budget and wage budget.
  - *Aging and levels* (step 4; M1 titled it "Aging and development"): a table of every own fighter (age before and after, with human-age; rating before → after; **levels at the start and end of the season and each pick** (stat, skill or trait) from the fighter's season log and core's `developmentSummary`; round XP and bench XP; the rounds he started Tired or Spent; potential change; retired), deltas with arrows; sortable; elves and dwarves read correctly by race. M1 showed the change of every attribute and a trend instead.
  - *Retirements and contracts* (step 5): retirements with career summary lines; expired contracts (now free agents); contracts raised to the tier minimum at setup (from → to).
  - *Next season:* tier and wing (the new wing draw), roster cap (with "release N fighters before Kick off · cap relief pays no payout" if over), budgets, and the rookie count for Trials Day.
- **Empty:** "No retirements this season", "No contracts expired".
- **Shortcuts:** ← → steps, Enter Begin next season on the last step.

#### ui-save · Save / Load (not mocked)

- **Purpose:** R7 (REQUIRED) with the open-016 working assumption: manual slots plus rotating autosaves.
- **Layout:** two tables, *Manual saves* (name, club, season and week, saved at, play time) and *Autosaves* (after every week processing, which in a match week happens when the match is done and before the report opens (D-O), after the season-end step and when a career starts; three rotating weekly slots, newest first; 03 sys-save), plus the **Mid-match autosave** slot (`auto-round`, tagged "Mid-match"), overwritten after every round of the player's match: loading it resumes the match on its between-round screen with no round replayed (O25, D-AD); from M2, with Watch, it also holds the locked inputs of the round being watched (O35) and, while playback is stopped, its cursor, and loading it resumes the arena paused where playback last stopped (OPEN, open-016); actions Save (Ctrl S, to the selected or a new slot), Save as, Load (commit dialog if there is unsaved progress), Delete (commit dialog, removes only that file).
- **Errors:** damaged or incompatible save → a clear message with the save's version and "This save cannot be loaded; nothing was changed" (02 §3); a failed write never replaces the previous file (05 §5).

#### ui-settings · Settings (not mocked)

- **Gameplay · Pacing presets (DELEGATED, D-L; OC-5), in M1:** *Thorough* (stop at the lineup every week, open every report), *Balanced* (default: stop at the lineup every week; open the report automatically only after a loss or an injury, otherwise a result toast with "Open report"), *Streamlined* (play with the last valid lineup and presets unless something changed; stop only for blockers, injuries in the lineup, answered offers, contract deadlines and season events), *Custom* (checkboxes per stop reason). A preset only decides where Continue stops. Under Streamlined, Continue plays the match with the current valid lineup and presets, the same inputs the player would lock, so the result is identical (P-05). Default: Balanced.
- **Interface:** theme (Dark, Light, System), interface scale 85–150% (TUNABLE, default 100%), table density (Comfortable, Compact), tooltip delay, number format.
- **Accessibility:** reduce motion (also follows the OS), status colours (Green/red, Blue/orange), flash limit (M2), larger focus ring.
- **Audio:** master, music, effects, interface; mute when the window is unfocused.
- **Match day › Watching, M2 (as built, PERMITTED-CHOICE; the auto-pause defaults are REQUIRED, O34 (Q58)):** the Watch preference (whether Play match offers Watch and Simulate or just does one; the Streamlined preset simulates), the remembered arena speed, the auto-pause switches (defaults: on for the player's fighter downed, the player's captain down and overtime; off for an enemy downed and a fighter of the player's club below 25% HP), names over fighters, the dock (also on D) and pausing when the window is hidden (on by default). These are per device, outside saves.
- **Match day (M1.1, per club):** level-up default ("Ask me", Auto, Auto favouring stats, Auto favouring skills) and level-up pacing (Detailed, the M1.1 default; Balanced; Fast); the between-round pause (Always, the M1.1 default; When urgent; Never); the auto-swap rule (Off, Injured only, Threshold) with its threshold (default 40), the lost-round bonus (+10) and "keep one swap for injuries" (O25, D-V).
- **Saves (M1.1, O25, D-AD):** "Weekly autosaves" (on by default) switches the three rotating slots; the text says the mid-match safety save always runs, so quitting never replays a result.
- **Controls:** every shortcut remappable, with conflict warnings and "Reset to defaults".

#### ui-knowledge · Fuzzy-stat display (M4 placeholder, not designed)

- **Status:** placeholder (C7). The screen design is M4 scope and not yet written; these constraints already bind it.
- **Constraints:** every fighter has a free, low-accuracy **baseline report** with wide ranges (O4, REQUIRED), and scouting narrows it (R3). Values appear as **ranges with a certainty** and a **source label** (scout and week) instead of exact numbers (P-12); information decays slowly and contact refreshes it (P-19). Opponents' values are shown at the viewer's knowledge, and reports never forecast outcomes (P-13). Traits reveal in `traits.json` revealOrder, negatives last (`.trait--hidden` until revealed). The same `.stat-bar` gains a range form (`__range`, already in the component sheet). Careers started before M4 never gain fog, so their saves keep exact values (owner question Q10).
- **Surfaces affected:** ui-fighter, ui-market, ui-squad (opponent strip), ui-home (their last lineup), ui-report (opponent box score).

#### ui-academy · Academy (M5 placeholder, not designed)

- **Status:** placeholder (C7). The screen design is M5 scope and not yet written; these constraints already bind it.
- **Constraints:** a separate pool with capacity equal to the tier's roster cap (O2); enrollment chosen at the start of the season and committed at Kick off, except fighters signed or traded for mid-season, who may be enrolled that week (O3); a call-up is a binding commit whose dialog states that the fighter cannot return this season and gains no XP unless he plays (O3, D-M). Program types, cost and the R5 outcomes (growth of stats and potential, new abilities and traits, curing flaws) are shown as ranges before enrollment, with no hidden success roll (open-004). How a taught ability fits the fixed 4-ability kit is owner question Q20.
- **Surfaces affected:** a new hub screen, ui-squad (academy column), ui-fighter (program tab), ui-season-end (graduation step), ui-finances (fees).

### 6.4 Input behaviour

| Player intent | Supported input / gesture | Immediate feedback | Commit / cancel behaviour | Remapping / alternative |
| --- | --- | --- | --- | --- |
| Advance the week | Continue button, Space | Button press state; simulating panel | Commits at week processing; blocked state explains why | Remappable |
| Change screen | Side nav, 1–7, Ctrl K search | Instant route change, nav highlight | None | Remappable |
| Go back / close | Esc, Alt ← | Previous screen or dialog closes | Esc never commits | — |
| Sort a table | Click a header (again reverses) | Arrow on the header, rows reorder | Remembered per table | Header buttons are focusable (Enter) |
| Move in a table / grid | ↑ ↓ (← → in grids) | Row highlight | Enter opens | — |
| Edit the lineup | Drag; or select + F / B / R / C / V | Card moves; validation strip updates; toast with Undo | Draft until Play match | Keyboard path for every drag |
| Change a preset | Select on the card; P cycles | Toast with Undo | Draft until Play match | — |
| Change training emphasis | Select on the profile or roster row; E cycles | Toast with Undo | Standing setting, applies at once (D-A) | — |
| Read a number's source | Hover 280 ms; focus; Shift pins | Tooltip | Esc closes | Delay in Settings |
| Commit with a cost | Primary button in a dialog; Enter | Dialog closes, toast confirms | Single commit; Esc cancels | — |
| Undo a reversible change | Ctrl Z, toast Undo | Previous state restored | Only reversible settings | — |
| Save | Ctrl S, nav footer | Toast "Saved to slot 1" | Overwrite asks once | — |
| Shortcut help | ? | Shortcut sheet dialog | Esc | — |
| Control a watched round or a replay | Space play or pause; 1 2 4 or [ ] speed; ← → a frame (Shift: a second) while paused; End Live; Enter or I inspector; L names; D dock; Home recentre; Shift+S skip the round; Shift+Space simulate the rest | The transport status names the cause of a stop | Skip and simulate-the-rest ask once; Esc closes the inspector, then leaves with the match still live (a replay: back to the report) | The arena owns the keyboard: the shell's screen shortcuts stand down there; F8 stays, and Ctrl S works while paused |
| Report an issue (playtest ticket) | F8 on any screen, also over dialogs; top-bar bug button "Report an issue (F8)" | Screenshot first, then a dialog with its thumbnail and one note field; toast "Ticket AL-R001-T001 saved" with Copy ID | Enter files (an empty note asks once), Shift+Enter new line, Esc cancels; game shortcuts are off while typing | Dev builds always; other builds behind Settings › Playtest tools |

**Playtest tickets.** The id `AL-R###-T###_YYYYMMDD-HHMMSS` (run per career, R000 with no career; ticket number within the run; local time) is shown in full in files and Copy ID, short (`AL-R001-T001`) in the toast. Tickets land in `tickets/<id>/` under `npm run dev` (screenshot, save, metadata; `tickets/tickets.md` lists them) and in the browser otherwise (Settings › Tickets). `?ticket=<id>` in dev reopens a ticket's save on the same screen with an info banner "Reproducing ticket …"; Save / Load lists such saves under Ticket reproductions. The writing plugin runs in the dev server only and accepts same-origin requests only (05 §8).

## 7. Feedback, animation, and effects

**Status:** PROPOSED. Durations are tokens (`--dur-*`) and TUNABLE; reduce motion sets them to 0.

| Event / state | What the player must understand | Visual cue | Motion / duration | Sound | Priority |
| --- | --- | --- | --- | --- | --- |
| Hover / press | It is interactive | Surface lightens; press offsets 1 px | 80–140 ms | none | low |
| Week processing | The world is moving | Simulating panel; skeleton rows | ≤ 600 ms display | soft tick | medium |
| Result revealed | Win or loss, and how | Brass "Won" or neutral "Lost"; round pips in order | pips stagger 120 ms | win / loss sting | high |
| Downed (report) | Who fell and why | Diamond marker in the side colour | none | none | high |
| Injury | Who is out and for how long | Red square marker, red callout, digest item | none | low thud | high |
| Rule never fired | A rule did nothing | Amber "never fired" trace, warning text | none | none | high |
| Reversible change | It applied; it can be undone | Toast with Undo | 220 ms in | click | medium |
| Commit done | It is binding | Toast in green | 220 ms in | confirm | medium |
| Invalid action | Why it is refused | Inline message at the control, red outline | none (no shake) | error | high |
| Blocked Continue | What to decide first | Neutral button with warning outline and label | none | error on press | high |
| Embargo | Spending is limited | Red banner on every hub screen | none | none | high |
| Attribute change | Growth or decline | ▲ / ▼ delta with sign | none | none | medium |
| Promotion / relegation | Tier changes | Season-end banner, large display type | 360 ms fade | fanfare / low horn | high |
| M2: rule fires | Which rule acted | Rule badge "R3" pulses over the fighter | 220 ms | none | high |
| M2: overtime | Damage ramps | Clock turns amber with the word "Overtime"; a thin static amber line on the inner edge of the wall band (as built) | 360 ms (instant under reduced motion; it never pulses) | none in M2 (a horn comes with the arena sound, after M2, O34 (Q59)) | high |

- **Anticipation, action, recovery:** M1 has no in-fight animation. M2 telegraphs casts and channels of 0.3 s or longer with an arc and a cast bar (03 sys-fight-ai).
- **Simulation relationship:** presentation never affects results (T4). Report animations run after the result is committed.
- **Responsiveness:** input feedback within 100 ms; screen changes within 200 ms on the target machine; tables of 50 rows sort within 50 ms.
- **Simultaneous effects:** at most one toast region, one banner; tooltips sit above everything (`--z-tooltip`).
- **Skipping / speed:** every animation is skippable by clicking or pressing Space; reduce motion removes them.
- **Failure feedback:** *invalid input* (a refused offer, a full roster) is an inline message with the reason and the number; *a mechanical failure* (a lost round, a missed shot) is reported as an event with its cause, never styled as an error.

## 8. Audio direction

**Status:** PROPOSED, light for M1. **The arena sound is not in M2 (O34 (Q59)):** it comes with the sprite pipeline decision (open-032), after M2; the interface sounds and the optional menu loop of M1 stay.

- **Music:** M1 optional: one calm menu loop (low strings, frame drum, plucked lute), ducked by 6 dB on the report. FUTURE: a short arena theme for the Reckoning.
- **Environmental sound:** after M2: crowd bed outside the walls, rising in overtime.
- **Action sounds:** after M2: material-based hits (steel, wood, flesh-free thud), cast wind-ups per role family, a distinct downed sound.
- **Interface sounds (M1):** click, confirm, error, notify, win sting, loss sting. Short (< 300 ms), dry, at −18 LUFS integrated so they never dominate.
- **Voice:** none (no barks or commentary; P-17).
- **Mix priorities:** interface errors and results over music.
- **Player controls:** master, music, effects, interface sliders; mute when unfocused. No information is carried by sound alone.

## 9. Accessibility and adaptation

**Status:** PROPOSED; intended requirements, not a conformance claim.

- **Information redundancy (colour-blind safety):**
  - Roles: Okabe-Ito-derived hues **always paired with the glyph shape**, plus the name in tooltips and badges. Checked with simulated deuteranopia, protanopia, tritanopia and grayscale (component sheet `?cvd=deutan|protan|tritan|gray`): hues converge for some pairs (controller and healer in deuteranopia, tank and healer in tritanopia), and the shapes keep them distinct. Pairing is therefore mandatory, not decoration.
  - Status: good/bad colours always come with ▲ / ▼, + / −, W / L letters or words. An alternative **blue/orange** status palette (`data-status-palette="blue-orange"`) is a Settings option.
  - Traits: polarity is coded by glyph (▲, ▼, gem, ?), frame shape (pill, square-cut, double ring) and colour, and screen readers hear "Negative trait:".
  - Zones: bars, dashed lines, ▲ / ▼ and a word legend.
- **Contrast (measured, WCAG AA):** dark theme body text 13.9:1, muted 7.1:1, faint 4.9:1, brass text 9.4:1, on-accent 8.2:1; role glyphs 6.2–13.1:1 (≥ 3:1 needed). Light theme body 16.3:1, muted 7.6:1, faint 5.9:1 (4.9:1 on the page background), brass text 5.7:1, role glyphs 3.9–5.3:1. Status text on its tinted tag ≥ 4.6:1. Every pair in `tokens.css` was checked; implementers re-check any new pair.
- **Text and readability:** root 15 px at 1280–1440 px wide, 16 px at 1920, 18 px at 2560; smallest running text 12 px at 100%; only keycap hints and count badges go down to 10.5–11 px. **Interface scale 85–150%** (`--ui-scale`) scales text, spacing and controls together. Numbers use tabular figures.
- **Input demands:** no timing, no holds, no double-clicks; every action is reachable by keyboard; a visible 2 px focus ring; remappable shortcuts; drag always has a keyboard path.
- **Motion and flashing:** reduce motion follows the OS and Settings; no flashing above 3 per second; in the M2 arena there is no screen shake, a fighter's flash starts at most 3 times a second, and reduced motion draws effects static (numbers fade in place) and keeps telegraph progress.
- **Audio dependence:** none.
- **Screen readers (best effort):** semantic landmarks, headings, real tables, `aria-sort`, tabs with `role="tab"`, dialogs as `<dialog>`, toasts in a polite live region, decorative glyphs `aria-hidden`, role and trait names in text.
- **Localization:** FUTURE. All strings live in theme data (T5); layouts allow 30% text growth; no text inside images; number formatting by locale.
- **Device variation:** desktop, mouse and keyboard (01 §2). **Minimum supported 1280 × 720 CSS px** (OC-8, 01 Q26); designed and verified at 1440 × 900 and 1920 × 1080; up to 2560 × 1440, where content stops at 118 rem and centres. Ultrawide works the same way. No touch or controller support at first release.

## 10. Asset scope and visual acceptance

**Status:** PROPOSED.

| Deliverable / view | Prototype treatment (M1) | Release treatment | Acceptance condition | Reference |
| --- | --- | --- | --- | --- |
| Design system | `tokens.css`, `base.css`, `components.css` | Same files, extended | Every screen uses only these classes and tokens; no inline colours | ref-001 |
| Portraits | CSS race busts + role glyph | Painted or vector portraits per race and gender variety (FUTURE) | Race and role readable at 1.6 rem | asset-001 |
| Crests | Two-colour shield + code | Heraldic charges per club | 16 clubs distinguishable at 1.6 rem | asset-002 |
| Role glyphs | 5 masks | Same | Distinct in grayscale at 12 px | asset-003 |
| Trait icons | Polarity glyph | One icon per trait id | Polarity readable without colour | asset-004 |
| Class icons | Role glyph + name (M1; also in M2) | 42 icons (after M2, with the sprite pipeline decision; O34 (Q59)) | 6 classes of a role distinct at 24 px | asset-005 |
| UI icons | 65 stroke icons | Same style, extended | One style; 24 px grid | components.css |
| Arena tokens | — | M2 placeholder shapes (T1; O34 (Q59)); sprites after open-032 | vis-003 | asset-006 |

| ID | Situation | Expected presentation | How to review | Milestone |
| --- | --- | --- | --- | --- |
| art-001 | Home at matchweek 7, 1440 × 900, dark | Fixture hero, digest and side column readable without scrolling past the second digest item; one brass primary | Screenshot review | M1 |
| art-002 | Same at 1920 × 1080, light | No empty bands wider than one panel; numbers stay aligned | Screenshot | M1 |
| art-003 | Squad at 1280 × 720 | Roster table fits without horizontal scroll; lineup names readable (portraits hide below 1400 px) | Screenshot | M1 |
| art-004 | League at 1920 × 1080 | Wings and bracket side by side; no truncated club names in the bracket | Screenshot | M1 |
| art-005 | Component sheet under simulated deuteranopia and tritanopia | All five roles distinguishable by shape; status meaning kept by arrows and letters | `components.html?cvd=…` | M1 |
| ux-001 | Routine matchweek | ≤ 3 actions from Home to the next Home (vis-006); from M1.1 plus one Enter per between-round pause (the QA playtest counted 2–4 inputs for a routine week); from M2, Play match offers Watch or Simulate in one click and a round boundary still costs one input, because the round-end overlay does not block | Timed walkthrough | M1, M1.1, M2 |
| ux-002 | A lost match | Tester names a cause from "What decided it" within 1 minute (vis-001) | Playtest | M1 |
| ux-003 | Keyboard only | Full week, a signing and a save with no mouse | Walkthrough | M1 |
| ux-004 | Tooltip coverage | Every number on Home, Squad, Profile, Report, League and Market has a tooltip | Automated DOM check | M1 |
| ux-005 | Offer over the wage headroom | Refused before sending, with the excess in ts | Walkthrough | M1 |
| art-006 | A watched fight at 1280 × 720 and 1920 × 1080, both themes, with the default settings | Both sides' tank and healer can be named from glyph shape and ring alone; every down names its cause; nothing past the head of a live round is shown; no flash above 3 a second | Screenshot sequences and the browser smoke (05 §9.4, §10: 11 screenshots at 1280 × 720 and 1920 × 1080 in both themes, with reduced motion and under four colour-vision deficiencies, all drawn); the agent pre-check scored 59 of 59, but only human observers count for vis-003 (open-039) | M2 |
| art-007 | A watched match in which the player's club is the away club, at 1280 × 720 and 1920 × 1080 | Home is on the left in the HUD, the fighter strip and the round-end card, whoever the player is; the player's side carries the "You" tag and the solid ring | Screenshots (the QA walk, `m2-qa`) and the arena tests | M2 |
| art-008 | A round that reaches overtime, at the default settings and with reduced motion | From 0:45 the clock is amber with the word "Overtime", the scrubber has an overtime mark, the feed says "Overtime begins" and a thin static amber edge shows on the wall band; nothing pulses or flashes, and with reduced motion the edge appears at once; the default auto-pause stops once there | The browser smoke (its overtime check) and screenshots | M2 |

**Verification done by the UI designer on the draft (mockups only).** Screenshots (headless Chrome, isolated profile) reviewed for every mockup at 1440 × 900 and 1920 × 1080 in both themes, Home and Squad at 1280 × 720, League at 2560 × 1440, the offer and release dialogs, and the component sheet under simulated deuteranopia and tritanopia. In the built-in browser: an automated check of 8 pages × 4 widths (1280, 1440, 1920, 2560) × 2 themes found no horizontal overflow; no script errors; every `data-tip-ref` and dialog id resolves; no duplicate ids; sorting, tabs with arrow keys, segmented switches, the compare count, dialogs (initial focus, Esc, toasts) and tooltips (hover, focus, Esc, in-viewport placement) work. Not verified: screen readers, interface scale above 100% in a real window, live data wiring.

## 11. Open decisions and completion check

Owner items: OC-1 and OC-7 to OC-10 are PROPOSED and asked in 01 §8.5 Q26; OC-2 in Q27; OC-3, OC-5 and OC-6 are DELEGATED as D-J, D-L and D-M (Q23–Q25); the M1.1 screens follow D-U, D-V and D-AD, D-AE, which the owner confirmed (O25; Q37, Q39, Q50, Q51 answered 2026-10-27), and the R002 changes follow O27–O32; OC-4 is DELEGATED as D-K and confirmed with the money model in Q4. The v0.3 screen changes follow D-O (report after the autosave, Q29), D-R (their last lineup, Q32) and D-S (no captain blocker, Q33); the MVP and "What decided it" rules are documented as built (PROPOSED). Related package items: open-026 (exact values in M1, assumed here), D-C (league structure and money), open-006 (hired blades in the lineup), the D-C failure ladder (embargo banner), open-011 (vice-captain), open-016 (save screen), open-020 (M2 Watch or Simulate, settled by O34 (Q54)); the M2 screens are built on O34 and O35 (Q53–Q60, answered 2026-10-27), with open-036 still open and open-037 settled as built, open-024 under D-G (hybrids match either role in filters).

- [x] References state exactly which qualities to reproduce.
- [x] Style can be evaluated through concrete shapes, colours, type, layout and motion (tokens and mockups).
- [x] Interface presents actual rules (cap, wage budget, points, zones, presets, rule traces) from 03 v0.3.
- [x] Essential information remains readable in the busiest screens (report, squad) at 1280–2560 px.
- [x] Prototype placeholders and required finished qualities are explicit (§10).
- [ ] A new artist can produce class icons and arena tokens without inventing direction (briefs exist; reference art comes with the sprite pipeline decision, after M2, O34 (Q59)).

## Notes for implementers

**Files.** `src/ui/styles/tokens.css` (all values, two themes, role/band mappings, reduced motion, density, status palette), `base.css` (reset, root size, focus, scrollbars, layout primitives `.l-*`, utilities `.u-*`), `components.css` (everything else, including the generated icon set). Load them in that order. The mockups link them by relative path and add only `mockups.js` (demo behaviour: tooltips, sort, tabs, dialogs, shortcuts, theme, `?theme=`, `?scale=`, `?open=`, `?cvd=`). `mockups.js` is not production code.

**Naming conventions.**
- Components: BEM-style `block`, `block__element`, `block--modifier` (`.panel__header`, `.btn--primary`). Layout: `.l-*`. Utilities: `.u-*`. Grid spans: `.span-N`, `.span-N@wide` (≥ 1800 px). Columns: `.col-wide` (only ≥ 1800 px), `.col-narrow` (only < 1800 px), `.col-mid` (hidden < 1400 px); `.cell-wrap` lets a cell wrap. Below 1400 px dense tables tighten their padding and lineup cards drop portraits, so the 1280 minimum needs no horizontal scroll.
- State: native ARIA first (`aria-current="page"`, `aria-selected`, `aria-pressed`, `aria-sort`, `aria-disabled`, `hidden`, `<dialog open>`), then `.is-*` (`.is-us`, `.is-cut`, `.is-dimmed`, `.is-injured`, `.is-path`, `.is-done`).
- Domain values as data attributes so templates bind straight from content ids: `data-role` (tank, melee, ranged, controller, healer = `combat.json` archetype ids), `data-band` (1–4), `data-race` (human, elf, dwarf, orc; ashkin falls back), `data-row` (front, back, bench), `data-side` (us, them), `data-event` (down, injury, rule, save, end), `data-kind` (medical, contract, result, market, league, development), `data-r` (W, L, -), `data-polarity` (pos, neg, rare), `data-zone` (qualify, relegate), `data-state` (good, warn, bad, blocked), `data-icon` (icon name). Variables for continuous values: `--v`, `--max`, `--peak`, `--cap`, `--at`, `--from`, `--crest-a`, `--crest-b`, `--slots`, `--tiles`.
- Bands (TUNABLE): attributes 1–5 → 1, 6–10 → 2, 11–15 → 3, 16–20 → 4; rating and potential 1–39 → 1, 40–54 → 2, 55–69 → 3, 70–100 → 4. Compute in one helper.
- Traits: `polarity: negative` → `.trait--neg`; `rarity: storied` (or rare positive) → `.trait--rare`; otherwise `.trait`. Unrevealed (M4) → `.trait--hidden`.

**Component inventory** (component sheet: `mockups/components.html`).

| Group | Classes |
| --- | --- |
| Shell | `.app`, `.topbar` (`__club`, `__stat`, `__actions`), `.continue` (`[data-state=blocked]`), `.sidenav` (`__item`, `__key`, `__badge`, `__footer`), `.main`, `.page`, `.page-header`, `.breadcrumbs`, `.banner` |
| Actions and inputs | `.btn` (`--primary`, `--ghost`, `--danger`, `--sm`, `--lg`, `--icon`, `--block`), `.icon-btn`, `.field`, `.input`, `.select` + `.select-wrap`, `.check`, `.switch`, `.range`, `.chip`, `.segmented`, `.tabs` / `.tab`, `.search-trigger`, `.role-toggle` |
| Containers | `.panel` (`__header`, `__title`, `__body`, `__footer`, `--hero`), `.card`, `.well`, `.kv`, `.stat-tile`, `.tile-row`, `.callout`, `.empty`, `.skeleton` |
| Data | `.table-wrap`, `.data-table` (`--compact`, `--dense`, `--zebra`; `.th-sort`; `.cell-num`, `.cell-fill`), `.entity`, `.stat-bar` (`__fill`, `__range`, `__cap`, `__wear`), `.stat-num`, `.rating` (`--lg`, `--range`), `.stars` / `.star`, `.form`, `.delta`, `.meter`, `.progress`, `.capmeter`, `.condition`, `.willing`, `.sparkline`, `.chart`, `.legend`, `.compare`, `.compare-tray` |
| Domain | `.role-glyph`, `.role-badge`, `.class-tag`, `.trait` (`--neg`, `--rare`, `--hidden`), `.trait-dots`, `.trait-row`, `.captain-mark`, `.row-mark`, `.zone-mark`, `.crest`, `.portrait`, `.fixture`, `.scoreboard`, `.round-pips`, `.mvp`, `.lineup` / `.lineup-card`, `.checklist`, `.digest`, `.profile-head`, `.rule` / `.rule-list`, `.trace`, `.timeline`, `.bracket` |
| Overlays | `.tooltip` (`__kicker`, `__title`, `__body`, `__rows`, `__flavor`, `__meta`), `.toast-region` / `.toast`, `dialog.modal` (`__header`, `__body`, `__footer`; `--wide`, `--narrow`), `.shortcut-list` |
| Icons | `.icon[data-icon]`: 65 icons (`home`, `squad`, `fighter`, `fixtures`, `league`, `codex`, `market`, `finances`, `settings`, `save`, `search`, `bell`, `crown`, `injury`, `contract`, `swords`, `scroll`, `trend`, `level-up`, …) |

**Screens to components.**

| Screen | Main components |
| --- | --- |
| ui-home | `.fixture`, `.form`, `.role-glyph`, `.row-mark`, `.digest`, `.tabs`, `.stat-tile`, `.meter`, `.capmeter`, `.data-table--compact` with `data-zone` |
| ui-squad | `.lineup`, `.lineup-card`, `.select--inline`, `.checklist--inline`, `.capmeter`, `.chip`, `.data-table--dense`, `.trait-dots`, `.stars`, `.segmented` |
| ui-fighter | `.profile-head`, `.trait`, `.rating--lg`, `.stat-bar`, `.chart`, `.progress`, `.kv`, `.rule-list`, `dialog.modal` |
| ui-report | `.scoreboard`, `.round-pips`, `.mvp`, `.trace`, `.rule`, `.timeline`, `.data-table` with `.row-group` |
| ui-league | `.segmented`, `.data-table` with `data-zone`, `.zone-mark`, `.bracket` |
| ui-market | `.filters`, `.role-toggle`, `.switch`, `.willing`, `.compare-tray`, `.compare`, offer `dialog.modal` |
| ui-new, ui-codex | `.card`, `.l-autogrid`, `.crest`, `.role-badge`, `.rule` |
| ui-fixtures, ui-finances, ui-season-end, ui-save, ui-settings | `.tabs`, `.data-table`, `.stat-tile`, `.meter`, `.chart`, `.segmented`, `.switch`, `.range`, `dialog.modal` |

**Behaviour contracts** the UI framework must provide (05 owns the framework): a tooltip service (`data-tip` text or a template id, hover delay, focus, Shift-pin, Esc), table sorting that writes `aria-sort`, a toast service with an Undo callback, `<dialog>` with initial focus and Esc, a global shortcut map (ignored while typing), and the Continue state machine of §6.1. Reversible changes go through the same command path as commits (05: the UI dispatches commands) so Undo is a command, not a UI trick.

**Player text** never shows internal ids (content ids, error codes, offer codes); it uses names and plain words.

**Formatting.** Money `11,840 ts`, signed changes with U+2212, durations `0:38`, weeks `2 wk`, matchweeks `MW7`, tournament weeks `TW1`, ratings as integers, potential as stars plus the number in a tooltip.

## Owner confirmations (status after the merge)

The UI designer's items and their status in document 01. The recommendations are the working assumptions used by the mockups.

| ID | Decision | Status | Owner question |
| --- | --- | --- | --- |
| OC-1 | Visual direction: the dark "war ledger" default (slate, parchment, one brass accent) with a full light theme | PROPOSED | Q26 |
| OC-2 | Typography: system fonts in M1 (Palatino Linotype display, Segoe UI interface); a self-hosted open-licensed serif pair (candidate Alegreya + Alegreya Sans, OFL) at M7 polish | PROPOSED (system fonts are the M1 working assumption) | Q27 |
| OC-3 | Role language: five glyph shapes (shield, diamond, triangle, hourglass, circle-cross) plus Okabe-Ito hues, in the UI and later in the arena | **DELEGATED (D-J)** | Q23 |
| OC-4 | Money shown as tessels ("11,840 ts", true minus sign, thousands separators) | **DELEGATED (D-K)**, with D-C | Q4 |
| OC-5 | Pacing presets (Thorough / Balanced / Streamlined / Custom) in M1 rather than M7 | **DELEGATED (D-L)** | Q24 |
| OC-6 | Confirmation only for binding actions; reversible settings apply at once with Undo | **DELEGATED (D-M)** | Q25 |
| OC-7 | Notification budget: at most 6 digest items a week, at most 2 "Needs action", no pop-ups on Continue | PROPOSED · TUNABLE | Q26 |
| OC-8 | Minimum resolution 1280 × 720; designed for 1440 × 900 and 1920 × 1080; up to 2560 × 1440 | PROPOSED | Q26 |
| OC-9 | Rating bands and "brass = elite" (attributes 5/10/15; rating 40/55/70) | PROPOSED · TUNABLE | Q26 |
| OC-10 | Reports explain causes but never advise or forecast | PROPOSED (consistent with P-13 and pillar 2) | Q26 |

Smaller items, also in Q26: an Ashkin portrait bust (needed before M1 ships); renaming the club at career start (02 step 2, PROPOSED; the mockups assume a renamed "Thornwick Wardens", EXAMPLE). M2 zoom and follow stay OPEN (open-036): M2 is top-down with fixed framing (O34 (Q55)).

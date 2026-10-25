# Art direction and presentation (phase-2 draft)

> ARENA LEAGUE DESIGN PACKAGE · PHASE-2 DRAFT · 2026-10-25 · UI/UX and presentation designer. Not approved and not merged into [document 04](../04-art-direction-and-presentation.md). It follows the structure of the Tengo template 04 section by section.
> Labels follow [document 01](../01-game-vision-and-design-principles.md) "Meaning of specification labels". **REQUIRED** appears only where an owner ID (R, T, V, G, O) is cited. Everything this draft decides is **PROPOSED**; adjustable values are **PROPOSED · TUNABLE** with an initial value; **EXAMPLE** marks sample data; **OPEN** items wait for the owner (see "Owner confirmations needed"); **FUTURE** is outside the milestone named.
> Vocabulary follows 01 §7 (club, lineup, side, fight, round, match, matchweek, downed, rule, preset, role). The brief's "archetype" is the 01 term **role**; the content data key is `archetypes` with the same five ids.
> Inputs read: 01, 02, 03 §1–2, research.md (C1.2, C1.5, C1.9, C2.2, C2.4, Part D), the drafts `03-league-economy.md`, `03-combat.md` (sys-match-report), `03-fighter-lifecycle.md` and `05-technical.md`, and `content/default/*.json`. Where those drafts set a number or name, this draft uses it and says so; it does not decide their mechanics.

| Field | Value |
| --- | --- |
| Game / version / updated | Arena League / draft v0.1 / 2026-10-25 |
| Status / design owner | Phase-2 draft, not reviewed / the project owner |
| Milestone covered | **M1 "Season MVP"** (O14): management screens and match reports (O12). M2 arena-viewer direction is given at brief level and marked FUTURE |
| Deliverables | This document; the design system `src/ui/styles/tokens.css`, `base.css`, `components.css`; static mockups in `docs/design/mockups/` (index, Home, Squad, Fighter profile, Match report, League, Market, component sheet) |

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

**Status:** every reference is exploratory until the owner approves this draft. References inform mechanics and UX lessons only. **Do not copy any other game's art, layout, icons, text or UI assets** (owner rule). Eslabong is a mechanics reference only; its install folder is never opened.

| Reference ID / link | Approval status | Adopt these qualities | Do not infer | Applies to |
| --- | --- | --- | --- | --- |
| ref-001: [mockups](../mockups/index.html) and [design system](../../../src/ui/styles/) (this draft) | exploratory, proposed **primary visual anchor** | Palette, type, density, layout grid, component look, interaction patterns | Sample names and numbers (EXAMPLE) | All M1 screens |
| ref-002: Football Manager 24 table screens (research B1.1) | exploratory | Sortable dense tables, attribute colouring by band, filters that stay put, keyboard navigation | Its colours, layout, fonts, iconography | Squad, Market, League |
| ref-003: FM26 negative reviews (research B1.1, C2.4) | anti-reference | What to avoid: extra clicks, buried information, card-based mobile layouts on PC | — | Whole UI |
| ref-004: FM27 "continue flow" presets (research B1.1) | exploratory | Presets for how often Continue stops | Their names or screens | Settings, Continue |
| ref-005: Teamfight Tactics round recap (research A2.1, A4.2) | exploratory | A per-fighter recap after each round | Art, layout | Match report |
| ref-006: Eslabong death summary and orders under HP bars (research A1.1) | exploratory, mechanics only | A death summary per down; an order or rule label above each fighter (M2) | Anything visual or textual; never open its files | Match report; M2 rule badges |
| ref-007: Crusader Kings III trait icons with rich tooltips (research Part D) | exploratory | Compact trait badges whose tooltip shows effect, category, opposite and source | Icon art, frames, text | Traits everywhere |
| ref-008: Gladiabots replay-to-editor (research A3.1, C1.4) | exploratory, FUTURE M2–M3 | Jump from a report moment to the rule that caused it | — | Report, M3 editor |
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

**Typography offline rule (REQUIRED by the brief, PROPOSED in the package):** nothing loads from a CDN. The three stacks above are installed on Windows and have close equivalents elsewhere. OPEN (OC-2): self-host an open-licensed pair later, recommended **Alegreya + Alegreya Sans (SIL OFL)**; only the three `--font-*` tokens change.

**Role language (PROPOSED, OC-3).** Shape first, colour second, label always available:

| Role (`data-role`) | Glyph | Colour (dark / light) | Why this shape |
| --- | --- | --- | --- |
| Tank (`tank`) | Heater shield | sky blue `#56b4e9` / `#0b6fae` | Protection |
| Melee DPS (`melee`) | Diamond (blade point) | vermillion `#ee7a3c` / `#c1500c` | Edge, close quarters |
| Ranged DPS (`ranged`) | Upward triangle (arrowhead) | yellow `#f0e442` / `#957b00` | Projectile |
| Controller (`controller`) | Hourglass | reddish purple `#d88bb6` / `#a8457e` | Time, slows, holds |
| Healer (`healer`) | Circle with a cross | bluish green `#1fb88a` / `#007f5c` | Care |

Hybrids show both glyphs side by side (e.g. Vowknight = shield + cross). Hues derive from ref-009; the light-theme variants are darkened to keep 3:1 on white.

## 4. Viewpoint and camera

**Status:** M1 has no arena view (O12, REQUIRED); this section sets M2 direction (FUTURE M2, T1) so M1 assets and colours do not need redoing.

- **Perspective and framing (FUTURE M2):** top-down orthographic 2D over the whole arena (P-03). The working arena of 32 m × 18 m (03 §1) is exactly 16:9, so the whole field fits a 1920 × 1080 window at about 52 px per metre with room for the HUD. Home starts at the west end, away at the east; each side's **front row** and **back row** are faint lines parallel to the centre line, labelled only at kickoff.
- **Player control:** fixed framing by default (no camera work needed to follow a 5v5 fight). Zoom 1×/1.5×/2× with a follow-selected-fighter option is OPEN for M2.
- **Required visible information (M2):** per fighter: HP bar with shield segment, focus bar, role glyph, side ring, captain crown, status icons, cast telegraph, and the **live rule badge** ("R3", P-22). Per side: fighters standing, calls left (P-01). Global: round clock, overtime state (from 45 s), speed and pause.
- **Motion behaviour:** no camera shake by default; a 220 ms ease on zoom changes; speed changes (1×/2×/4×, T1) never move the camera.
- **Constraints:** the arena never scrolls at default zoom, so nothing is ever off-screen. Labels avoid overlap by stacking above the HP bar.
- **Defaults and recovery:** every round starts at the default framing; Home key recentres.
- **Comfort controls:** reduce motion (also reduces hit flashes), screen-shake toggle (off), flash limit (§9).
- **Representative composition:** EXAMPLE: home lineup of 2 front / 3 back on the left third, away mirrored on the right third, centre third empty at kickoff; HUD strip 56 px at the top (score, round pips, clock), fighter strip 72 px at the bottom (portraits with HP and rule badges).

**M1 stand-in:** the match report (§6, ui-report) is the "view" of a fight: score, round pips, key-moment timeline, box score and the "what decided it" trace.

## 5. Characters, objects, and environments

**Status:** PROPOSED. M1 uses CSS placeholders only. M2 adds arena tokens and class icons.

### Reusable asset briefs

**asset-001 · Fighter portrait (placeholder, M1).**
- *Role:* identifies a fighter in tables, lineup cards and the profile header.
- *Silhouette:* a bust per race (CSS mask `--bust-*`): human (neutral), elf (pointed ears, slimmer shoulders), dwarf (wide shoulders, beard), orc (broad head, heavy jaw). The Ashkin, the fifth race in `races.json`, has no bust yet and falls back to human (OPEN, small).
- *Palette:* role-tinted radial field, parchment silhouette at 52% opacity, role glyph in the top-right corner.
- *Sizes:* 1.6 / 2.5 / 3.25 / 6.5 rem (xs, sm, default, lg). Injured fighters show 70% grayscale.
- *Acceptance:* at xs size in a 2 rem row, race and role are still distinguishable.

**asset-002 · Club crest (M1).**
- Heater shield with a rim, a diagonal two-colour field from `clubs.json` `colors.primary/secondary`, and a 2-letter code in the display face. Sizes 1.25 / 1.6 / 2.2 / 3.4 / 4.6 rem; letters hidden below 1.6 rem.
- *Acceptance:* the 16 clubs of one tier are distinguishable in the standings at 1.6 rem. Clubs whose two colours are both very light or both very dark get the darker rim automatically (rule for implementers: compute luminance, swap the rim token).
- FUTURE: heraldic charges (a lantern, an oar…) per club for release.

**asset-003 · Role glyphs (M1, permanent).** The five filled silhouettes of §3 at 12–36 px. They are used unchanged in M2 inside arena tokens.

**asset-004 · Trait badge icon (M1 placeholder).** A polarity glyph (up triangle, down triangle, gem, question mark for unrevealed in M4) in a round (positive), square (negative) or double-ringed (storied/rare) frame. Release (FUTURE): one icon per trait id in `traits.json` (`icon_trait_*`), drawn in the same 24 px stroke style.

**asset-005 · Class icon (FUTURE M2).** 42 icons keyed by `classes.json` `iconId`. Frame = the role glyph shape (hybrids: a split frame), interior = one emblem of the class's tool (gong, net, scalpel…). Monochrome with the role hue as the frame fill. 24, 32 and 48 px. *Acceptance:* the 6 classes of one role are distinguishable at 24 px by interior emblem alone.

**asset-006 · Arena fighter token (FUTURE M2).**
- Circle sized to the collision radius from the combat draft, side ring (brass for the player's side, steel blue `--c-side-them` for the opponent; in AI-vs-AI replays, home and away use club primaries with a luminance check), role glyph inside, facing wedge, HP and focus bars above.
- States: idle, moving, casting (telegraph arc), stunned (grey ring), downed (flattened, 40% opacity, then removed at round end).
- *Acceptance:* observers can name both sides' tank and healer in at least 90% of prompts (vis-003).

### Environment direction (FUTURE M2)

A flat sand-and-stone floor at a mid value (so both side colours and every role hue reach 3:1), a centre line, faint row markers at kickoff, and walls that read as the boundary. No obstacles, hazards or decoration that could be mistaken for gameplay (open-019). Crowd and banners stay outside the walls.

## 6. Interface and interaction language

**Status:** PROPOSED unless an ID is cited. O13 (good UI design) and T3 (HTML/CSS UI) are REQUIRED.

### 6.1 App shell

Every management screen shares one shell (mockup: any page).

- **Top bar (3.5 rem):** club crest, name and tier (click → Home); season and matchweek; balance; wage bill (≥ 1480 px); roster count (≥ 1480 px); standing; search (Ctrl K); digest bell with count; theme; shortcut sheet; and the **Continue** button at the far right, always in the same place.
- **Side navigation (13.5 rem, collapsible to 3.75 rem):** Home 1 · Squad 2 · Fixtures 3 · League 4 · Market 5 · Finances 6 · Class codex 7; footer: Save / Load, Settings. Badges show counts only for things that need action.
- **Page:** page header (eyebrow, display-face title, one-line meta, page actions), then a 12-column grid of panels. Content stops growing at 118 rem and centres on ultrawide screens.
- **Continue** (one primary action, research C1.9) changes label with the state of the week: `Continue · Lineup at <club>` (opens the lineup) → `Play match · locks lineup` → (report) `Continue · To matchweek N`. Preseason: `Continue · Week P2`; end of P4: `Kick off season`; out of the Reckoning: `Advance to season end`. When something blocks progress (02 §3), the button turns neutral with a warning outline and reads `Decide first · <item>`; pressing it jumps to the item. Space triggers it from anywhere except text fields.

### 6.2 Interaction rules

**Click budget (vis-006; PROPOSED · TUNABLE).** The routine matchweek is **3 actions** (3 × Space): Continue → Play match → Continue. Reading the digest costs nothing (it is on Home). Budgets for common tasks:

| Task | Budget | Path |
| --- | --- | --- |
| Routine week, no changes | 3 | Continue, Play match, Continue |
| Change one fighter's preset | +2 | open the preset select on the lineup card, pick |
| Swap a starter | +2 | select a roster row, press F / B (or drag) |
| Change captain | +2 | select the fighter, press C |
| Sign a free agent from the digest | +3 | View, Offer, Send offer |
| Renew a contract | +3 | Renewals, Offer, Send |
| See why we lost | 0 | the report opens with "What decided it" at the top |

**Confirm and undo (PROPOSED, OC-6).** Three classes, never mixed:
1. *Reversible settings* (lineup draft, rows, captain, presets, filters, sorting, theme): apply at once, show a toast with **Undo (Ctrl Z)** for 8 s. No dialog.
2. *Commit points with a cost* (02 §3: send an offer, renew, release, kick off season, advance to season end, load a save, overwrite a slot): one dialog that states the consequences in numbers (cost, balance after, wage bill after, roster after). The primary button names the action and the amount ("Release for 10,620 ts"). Enter confirms, Esc cancels. No second "Are you sure?". Release and load show a warning callout because they cannot be undone.
3. *Continue and Play match:* no dialog. The lineup screen is the review; a blocked state explains itself on the button.

**Notification budget (PROPOSED · TUNABLE, OC-7).**
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

**Money format (OPEN, OC-4).** The economy draft displays gold as the **tessel, "ts"**; this draft uses it everywhere. Thousands separators, a true minus sign (−), "+" on gains.

### 6.3 Screen specifications

Each screen lists purpose, flow state (02 §3), layout regions in order of importance, data, actions, empty and error states, and shortcuts. Mocked screens link their mockup.

#### ui-new · New career and club select

- **Purpose:** start a career in under a minute with an informed club choice. **Flow:** flow-state-001 title → flow-state-002 new-career.
- **Title screen:** Continue (latest save; disabled with "No saves yet" when none), New career, Load, Settings, Quit. Keyboard: Enter = Continue, N = New career.
- **Layout:** left column (4/12): manager name; world seed (collapsed under "Advanced", random by default, P-05); tier filter (Crown / Banner / Muster). Main (8/12): a grid of club cards for the selected tier. Bottom bar: chosen club summary and **Start career**.
- **Club card data:** crest, name, city and arena (`clubs.json`), tier, season budget and wage budget (economy draft), mean roster rating, club captain, prestige, roster cap (10/12/14, O2), AI style tag. Muster Circuit clubs carry "Recommended for a first career" (02 step 2).
- **Actions:** pick a card (click or arrows + Enter); optional rename and two colours (PROPOSED, 02 step 2) in a small dialog with a live crest preview; Start career (single commit, button disables on press).
- **Empty / error:** no club picked → the button reads "Pick a club to manage"; world generation failure → error panel with "Try again" and the seed shown for a bug report.
- **Shortcuts:** arrows move between cards, Enter picks, Ctrl Enter starts.

#### ui-home · Home, the matchweek hub ([home.html](../mockups/home.html))

- **Purpose:** answer "what needs me this week?" and start the week in one press. **Flow:** flow-state-003 hub.
- **Layout (8/12 main, 4/12 side):**
  1. *Next fixture* (hero panel): both crests and names (player's club always on the left, venue says Home/Away), records, last-five form strips, venue and week; a strip with **our lineup** by row (role glyphs, readiness and the auto-substitution note), **their last lineup**, **their style** tags (visible in M1, open-026) and the main threat; a footer with the next three fixtures.
  2. *Digest* ("This week"): the ≤ 6 items with filter tabs (All, Needs action, Results, Squad, Market); each item has an icon by kind, a title, one line of detail and its action button.
  3. Side: *Club* (balance and its change, this week's projection, wage bill meter against the wage budget, roster cap meter), *Availability* (injuries with weeks out, contracts ending this season), *wing table* (8 rows, top-4 Reckoning cut, 8th relegation line, our row and the next opponent highlighted).
- **Data:** fixture, both clubs' standings rows and last five, lineups, presets, style tags, digest items, ledger summary, wage budget, roster cap, injuries, contracts, wing table.
- **Actions:** Continue; Lineup (L); Opponent (O); each digest action; mark done (with Undo); Save (Ctrl S).
- **States:** *since you were away* (02 §7): after a load, the digest's first item summarises the last 3 results, standing, pending decisions and budget. *Bye or no fixture* (preseason): the hero shows the preseason checklist (budget, roster vs cap, trials day, contracts) instead. *Embargo* (open-007): a red banner under the top bar on every hub screen, "Spending embargo · balance −2,300 ts · new contracts above 110 ts are refused". *Empty digest:* "Nothing needs you this week" with Continue emphasised.
- **Shortcuts:** Space Continue, L lineup, O opponent, 1–7 screens, Ctrl S save.

#### ui-squad · Squad: lineup and roster ([squad.html](../mockups/squad.html))

- **Purpose:** pick five fighters, their rows, captain and presets, and manage the roster. This screen is also the **lineup screen** of 02 step 6 (flow-state-004) when opened by Continue.
- **Layout:**
  1. *Lineup board* (full width): **Back row** and **Front row** zones (front faces the enemy side, as in the M2 arena), sized by how many fighters each holds; one card per starter with portrait, name, captain crown or VC tag, class and race/age, a **preset select** and the rating; a validation strip underneath (✓ 5 of 5 fit, ✓ captain and vice-captain, ✓ presets, ⚠ injuries) with the lineup's mean rating against the opponent's last lineup and the lineup's wages.
  2. *Roster table:* the **roster cap meter** (one cell per place, 11 / 12), filter chips (All, Lineup, Reserves, Injured, Contract ends), name filter, Sign. Columns at 1440: fighter (portrait, name, C/VC, rookie tag), class (role glyphs), race · age, rating, potential (stars, number on hover), lineup state (Front / Back / Reserve / injured weeks), preset, traits (polarity dots with tooltips), wage, contract (ends, seasons left, warning tag in the final season). Wide-screen extras: apps, downs, rating sparkline S1–S3.
  3. *View switch* (page header): Overview, Attributes (12 attribute columns), Contracts, Season stats.
- **Actions:** drag between rows and the roster; keyboard F / B / R (front, back, reserve), C captain, V vice-captain, P cycle preset, Enter profile; "Last lineup" restores the previous five; Play match (Continue).
- **Selection and focus:** the selected fighter is outlined in brass on the board and highlighted in the table.
- **Validation (inline, never a dialog):** fewer than 5 fit fighters → strip reads "4 of 5 · a hired blade will fill the last place" (open-006); no captain → "Choose a captain" and Play match blocked; roster over cap after relegation → Continue becomes `Decide first · Release N fighters` (flow-005).
- **Empty / error:** a roster of 0 cannot happen; a roster below 5 shows the hired-blade card (dashed, labelled) in the empty slot.
- **Shortcuts:** above, plus ↑ ↓ rows, Space Play match.

#### ui-fighter · Fighter profile ([fighter.html](../mockups/fighter.html))

- **Purpose:** everything about one fighter, so decisions about playing, keeping or selling him are informed.
- **Layout:**
  1. *Header:* large portrait; name and captain mark; facts line (role badge, class, race and age, row, preset, tenure); **trait badges** (CK-style, rich tooltips: category, polarity, effect text from `traits.json`, flavour, opposite, source); rating (large pill) and potential (stars and number); actions Renew (enabled only in the final contract season), Compare, Release.
  2. *Tabs:* Overview, Tactics (read-only preset rules in M1 with fire counts from the last match, plus the class kit), Match log, Contract.
  3. *Overview grid:* **Attributes** grouped Physical (5) and Mental (7) as in `combat.json`, each a bar on the absolute 1–20 scale with band ticks at 5/10/15, the attribute's **ceiling** as a tick and **age wear** as a hatched segment (lifecycle draft), the value and the change this season; **Age curve** for the fighter's race (physical and mental curves from `development.json`, growth / peak / wear zones, a "you are here" marker; elves and other races show their own age axis and the human-age equivalent); **Development** (season XP against the typical season, rating by season with potential as a dashed line, trend word); **Traits** with effect lines; **Fitness and contract** (wage, end, release payout, captaincy 1–100 with its grade, injury status and history, "At risk" / "Still tender" from the lifecycle draft); **Career** table by season.
- **Actions:** previous / next fighter ( [ ] ), set preset, set captain / vice-captain, compare, renew, release (commit dialog).
- **Empty / error:** a rookie has an empty career table ("First season · no matches yet"); an injured fighter shows the injury callout above the attributes; retired fighters open read-only with a "Retired after S5" ribbon.
- **Shortcuts:** [ ] cycle fighters, T tactics tab, Esc back to Squad.

#### ui-codex · Class codex (not mocked)

- **Purpose:** learn the 42 classes (O8) and their presets without leaving the game.
- **Layout:** left filter rail (role toggles with glyphs; "hybrids" toggle; search by name, ability or role tag such as "taunter"); main grid of class cards (role frame and icon, name, role(s), preferred row, complexity, one-line description); a detail pane on selection: flavour, abilities (basic, two actives, passive, each with cooldown, focus cost, range and description from `abilities.json`), stat emphasis bars from `ratingWeights`, the presets with their summaries and rules as sentences, and two lists: "Your fighters of this class" and "Free agents of this class".
- **Data:** `classes.json`, `abilities.json`, `tactics-presets.json`, roster, market.
- **Empty:** a filter with no match shows "No class matches · Reset filters".
- **Shortcuts:** 7 opens; arrows move in the grid; Enter opens the detail; / focuses search.

#### ui-league · League: standings and the Reckoning ([league.html](../mockups/league.html))

- **Purpose:** where we stand, what is at stake, and who we would meet. **Structure** comes from the economy draft: each tier has 16 clubs in two 8-club wings (Dawn and Dusk); top 4 of each wing reach the 8-club **Reckoning** (O9); the 8th of each wing is relegated; the Reckoning champion and the **Shield** winner (best tier record) are promoted.
- **Layout:** tier switch (Crown, Banner, Muster) in the page header. *Standings* panel with a Wings / Tier table switch: two wing tables (position with promotion ▲ or relegation ▼ mark, club, W–L, rounds, round difference, points, last five) with a dashed line under 4th (brass) and above 8th (red); the tier table adds wing and projected seed and marks the Shield leader. *Reckoning* panel: a bracket with quarterfinal, semifinal, final and champion columns, each match showing seeds, crests, short names, score and venue/week; a switch between "If the season ended today" (projection, explicitly not a forecast) and last season's result. At ≥ 1800 px the two panels sit side by side and the wing tables stack.
- **Zone legend:** colour bar + glyph + words for every zone; never colour alone.
- **Actions:** sort any table, open a club (club page FUTURE: roster, form, style tag), open a fixture's report.
- **Empty states:** before matchweek 1 the tables show 0s and the bracket reads "Seeds decided after matchweek 16"; during the Reckoning the projection switch is replaced by "Live".
- **Shortcuts:** 4 opens; Tab between panels; W / T switch Wings / Tier table.

#### ui-fixtures · Fixtures and results (not mocked)

- **Purpose:** the season's calendar and every result.
- **Layout:** tabs *Our season* (list of our 16 fixtures plus Reckoning: week, opponent with crest and standing, home/away, venue, result with round scores, report link; the next fixture highlighted; past rows show our form chip), *By matchweek* (all 8 fixtures of a tier for a chosen week, ← → to change week, each with score and report link), *Calendar* (P1–P4, MW1–MW16, TW1–TW3 strip with markers for trials day, grant payments, contract deadlines).
- **Data:** fixtures and results (sys-league), calendar (sys-calendar).
- **Empty:** future weeks show "Not played"; an AI-vs-AI report opens read-only.
- **Shortcuts:** 3 opens; ← → change week; Enter opens a report.

#### ui-match · Simulating (transient, M1)

- **Purpose:** flow-state-005. The headless match resolves in well under a second. Show a 600 ms (TUNABLE; 0 with reduced motion) panel "Simulating · Round 1 · Round 2 · Round 3" filling in as rounds resolve, then open the report. Input is ignored except Esc, which does nothing but is not an error. FUTURE M2: this becomes Watch or Simulate (open-020).

#### ui-report · Match report ([match-report.html](../mockups/match-report.html))

- **Purpose:** make the result explain itself (C1.2, pillar 2, P-22); vis-001 asks playtesters to name a concrete cause from this screen.
- **Layout:**
  1. *Scoreboard* (home club on the left): crests, names, a large score, result line (Won/Lost, points, gate if home), **round pips** (winner, duration, end reason: standing count, overtime or time-cap tiebreak step), and the **MVP strip** (portrait, headline numbers, "How MVP is chosen" tooltip).
  2. *Round tabs:* Whole match, Round 1–3 (or 1–5 in finals) filter every panel below.
  3. *What decided it* (top of the main column): a one-sentence summary callout, then 3–5 **rule traces**: fighter, preset, verdict (helped / hurt / never fired / blocked), the rule as a sentence, fire counts per round, and one line of effect. Traces are chosen from the event stream: largest swing in downs, damage or healing first, then "never fired" rules of starters, then rules skipped for a reason (cooldown, out of reach, controlled). This uses the combat draft's decision traces and recap counters.
  4. *Box score:* both sides (ours first, theirs dimmed), columns downs, downed, damage, taken, healed, control seconds, rules fired, XP; sortable; every number has a breakdown tooltip (per round, per ability).
  5. *Key moments* (side): a timeline grouped by round; markers by side colour and by event shape (diamond = down, ring = rule or save, square = injury, bar = round end or overtime); each item names the actor, the rule or ability and the cause. Clicking an item highlights the related trace and box-score row; FUTURE M2 jumps the replay to that tick.
  6. *Injuries and XP:* injury callouts with cause and weeks out; XP gains and attribute changes.
- **Actions:** Continue (to the next week); open any fighter; copy the event log; Replay (FUTURE M2, shown disabled with a tooltip).
- **Empty / error:** a report missing its event log (an old save) shows score and rounds and "Details unavailable for this match"; a hired blade in the lineup is labelled in every table.
- **Shortcuts:** 1–5 round tabs, ← → previous/next report, Space Continue.

#### ui-market · Market: free agents, offers, renewals, releases ([market.html](../mockups/market.html))

- **Purpose:** find, compare and sign free agents within the cap and the wage budget (R6, O10, P-09).
- **Layout:** filter rail (search; role toggles where hybrids match either role, open-024; class; race including Ashkin; age range; minimum rating; switches "Fits wage headroom", "No negative traits", "Only new this week"); results table (compare checkbox, fighter, class, race · age, rating, potential, traits, ask per week, willingness with a 3-pip meter and word, Offer); a sticky **compare tray** (2–3 fighters against a chosen roster fighter) opening a comparison dialog with the best value per row marked ▲. Page header: free agents count, roster places left, wage headroom (tooltip: wage budget − wage bill).
- **Offer dialog (commit):** wage stepper (5 ts steps; Shift 25), length (1–3 seasons, `economy.json`), the fighter's ask, likelihood callout, signing cost (charged on acceptance), balance after, roster after, wage bill after with a meter against the budget. Footer note: offers are answered at **week processing** and can be withdrawn until then (economy draft). Send offer → toast "Offer sent · he answers when you Continue"; the answer arrives as a digest item.
- **Renew** uses the same dialog from the profile or the digest (renewals answer at once, economy draft). **Release** uses the commit dialog on the profile (payout, balance, wage bill, roster and captain after).
- **Errors (inline, with reasons):** roster full → "Roster full (12 / 12). Release a fighter first." (flow-004); over the wage headroom → the Offer button is disabled and the ask shows a warning tag with the excess; embargo → "Spending embargo: offers above 110 ts are refused".
- **Empty:** no match → "No free agents match · Reset filters"; Rookies tab outside preseason → "Trials-day rookies appear in preseason week P1".
- **Shortcuts:** 5 opens; / search; C compare; O offer on the selected row; Enter sends in the dialog.

#### ui-finances · Finances (not mocked)

- **Purpose:** can we afford the season, and where does the money go? (O10)
- **Layout:** tiles (balance, this week's projected net, wage bill vs wage budget, projected balance at season end before prizes); a **wage bill** table (fighter, wage, contract end, share of the wage budget, sorted by wage); a **revenue breakdown** (central grant instalments at P1 and after MW8, sponsor retainer, gates, prizes) as a stacked bar by week; a **projection** line chart of balance to season end with markers for grant payments and the Reckoning; the **ledger** (week, item, amount, balance) with filters.
- **States:** "Watch" warning when the projection goes below 0 within 4 weeks; embargo banner; Registry advance explained with its repayment (economy draft, open-007).
- **Shortcuts:** 6 opens.

#### ui-season-end · Season-end review (not mocked)

- **Purpose:** flow-state-007; show everything the season-end step did (02 step 10), in order, read-only.
- **Layout:** a stepper across the top (Final standings · Reckoning · Money · Aging and development · Retirements and contracts · Next season), one panel per step, Next and Back, and **Begin next season** on the last step.
  - *Final standings:* wing and tier tables with promotion and relegation banners; our movement in large type ("Promoted to the Crown Circuit").
  - *Reckoning:* the completed bracket and prize per round reached.
  - *Money:* prizes, revenue and next season's budget and wage budget.
  - *Aging and development:* a table of every own fighter: age +1 (with human-age), rating change, attribute changes (arrows), trend, potential; sortable; elves and dwarves read correctly by race.
  - *Retirements and contracts:* retirements with career summary lines; expired contracts (now free agents).
  - *Next season:* tier, roster cap (with "release N fighters before kick-off" if over), budgets, rookies count for trials day.
- **Empty:** "No retirements this season", "No contracts expired".
- **Shortcuts:** ← → steps, Enter Begin next season on the last step.

#### ui-save · Save / Load (not mocked)

- **Purpose:** R7 (REQUIRED) with the open-016 working assumption: manual slots plus rotating autosaves.
- **Layout:** two tables, *Manual saves* (name, club, season and week, saved at, play time) and *Autosaves* (week start and after each match, newest first); actions Save (Ctrl S, to the selected or a new slot), Save as, Load (commit dialog if there is unsaved progress), Delete (commit dialog, removes only that file).
- **Errors:** damaged or incompatible save → a clear message with the save's version and "This save cannot be loaded; nothing was changed" (02 §3); a failed write never replaces the previous file (05 §5).

#### ui-settings · Settings (not mocked)

- **Gameplay · Pacing presets (OC-5):** *Thorough* (stop at the lineup every week, open every report), *Balanced* (default: stop at the lineup every week; open the report automatically only after a loss or an injury, otherwise a result toast with "Open report"), *Streamlined* (play with the last valid lineup and presets unless something changed; stop only for blockers, injuries in the lineup, answered offers, contract deadlines and season events), *Custom* (checkboxes per stop reason). 01 schedules pacing presets for M7; this draft recommends shipping them in M1.
- **Interface:** theme (Dark, Light, System), interface scale 85–150% (TUNABLE, default 100%), table density (Comfortable, Compact), tooltip delay, number format.
- **Accessibility:** reduce motion (also follows the OS), status colours (Green/red, Blue/orange), flash limit (M2), larger focus ring.
- **Audio:** master, music, effects, interface; mute when the window is unfocused.
- **Controls:** every shortcut remappable, with conflict warnings and "Reset to defaults".

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
| Read a number's source | Hover 280 ms; focus; Shift pins | Tooltip | Esc closes | Delay in Settings |
| Commit with a cost | Primary button in a dialog; Enter | Dialog closes, toast confirms | Single commit; Esc cancels | — |
| Undo a reversible change | Ctrl Z, toast Undo | Previous state restored | Only reversible settings | — |
| Save | Ctrl S, nav footer | Toast "Saved to slot 1" | Overwrite asks once | — |
| Shortcut help | ? | Shortcut sheet dialog | Esc | — |

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
| M2: rule fires (FUTURE) | Which rule acted | Rule badge "R3" pulses over the fighter | 220 ms | none | high |
| M2: overtime (FUTURE) | Damage ramps | Clock turns amber; thin edge vignette | 360 ms | horn | high |

- **Anticipation, action, recovery:** M1 has no in-fight animation. M2 telegraphs casts ≥ 0.5 s with an arc and a cast bar (combat draft).
- **Simulation relationship:** presentation never affects results (T4). Report animations run after the result is committed.
- **Responsiveness:** input feedback within 100 ms; screen changes within 200 ms on the target machine; tables of 50 rows sort within 50 ms.
- **Simultaneous effects:** at most one toast region, one banner; tooltips sit above everything (`--z-tooltip`).
- **Skipping / speed:** every animation is skippable by clicking or pressing Space; reduce motion removes them.
- **Failure feedback:** *invalid input* (a refused offer, a full roster) is an inline message with the reason and the number; *a mechanical failure* (a lost round, a missed shot) is reported as an event with its cause, never styled as an error.

## 8. Audio direction

**Status:** PROPOSED, light for M1; FUTURE for most of it.

- **Music:** M1 optional: one calm menu loop (low strings, frame drum, plucked lute), ducked by 6 dB on the report. FUTURE: a short arena theme for the Reckoning.
- **Environmental sound:** FUTURE M2: crowd bed outside the walls, rising in overtime.
- **Action sounds:** FUTURE M2: material-based hits (steel, wood, flesh-free thud), cast wind-ups per role family, a distinct downed sound.
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
- **Motion and flashing:** reduce motion follows the OS and Settings; no flashing above 3 per second; M2 screen shake off by default.
- **Audio dependence:** none.
- **Screen readers (best effort):** semantic landmarks, headings, real tables, `aria-sort`, tabs with `role="tab"`, dialogs as `<dialog>`, toasts in a polite live region, decorative glyphs `aria-hidden`, role and trait names in text.
- **Localization:** FUTURE. All strings live in theme data (T5); layouts allow 30% text growth; no text inside images; number formatting by locale.
- **Device variation:** desktop, mouse and keyboard (01 §2). **Minimum supported 1280 × 720 CSS px** (OC-8); designed and verified at 1440 × 900 and 1920 × 1080; up to 2560 × 1440, where content stops at 118 rem and centres. Ultrawide works the same way. No touch or controller support at first release.

## 10. Asset scope and visual acceptance

**Status:** PROPOSED.

| Deliverable / view | Prototype treatment (M1) | Release treatment | Acceptance condition | Reference |
| --- | --- | --- | --- | --- |
| Design system | `tokens.css`, `base.css`, `components.css` | Same files, extended | Every screen uses only these classes and tokens; no inline colours | ref-001 |
| Portraits | CSS race busts + role glyph | Painted or vector portraits per race and gender variety (FUTURE) | Race and role readable at 1.6 rem | asset-001 |
| Crests | Two-colour shield + code | Heraldic charges per club | 16 clubs distinguishable at 1.6 rem | asset-002 |
| Role glyphs | 5 masks | Same | Distinct in grayscale at 12 px | asset-003 |
| Trait icons | Polarity glyph | One icon per trait id | Polarity readable without colour | asset-004 |
| Class icons | Role glyph + name (M1) | 42 icons (M2) | 6 classes of a role distinct at 24 px | asset-005 |
| UI icons | 65 stroke icons | Same style, extended | One style; 24 px grid | components.css |
| Arena tokens | — | M2 placeholder shapes (T1) | vis-003 | asset-006 |

| ID | Situation | Expected presentation | How to review | Milestone |
| --- | --- | --- | --- | --- |
| art-001 | Home at matchweek 7, 1440 × 900, dark | Fixture hero, digest and side column readable without scrolling past the second digest item; one brass primary | Screenshot review | M1 |
| art-002 | Same at 1920 × 1080, light | No empty bands wider than one panel; numbers stay aligned | Screenshot | M1 |
| art-003 | Squad at 1280 × 720 | Roster table fits without horizontal scroll; lineup names readable (portraits hide below 1400 px) | Screenshot | M1 |
| art-004 | League at 1920 × 1080 | Wings and bracket side by side; no truncated club names in the bracket | Screenshot | M1 |
| art-005 | Component sheet under simulated deuteranopia and tritanopia | All five roles distinguishable by shape; status meaning kept by arrows and letters | `components.html?cvd=…` | M1 |
| ux-001 | Routine matchweek | ≤ 3 actions from Home to the next Home (vis-006) | Timed walkthrough | M1 |
| ux-002 | A lost match | Tester names a cause from "What decided it" within 1 minute (vis-001) | Playtest | M1 |
| ux-003 | Keyboard only | Full week, a signing and a save with no mouse | Walkthrough | M1 |
| ux-004 | Tooltip coverage | Every number on Home, Squad, Profile, Report, League and Market has a tooltip | Automated DOM check | M1 |
| ux-005 | Offer over the wage headroom | Refused before sending, with the excess in ts | Walkthrough | M1 |

**Verification done for this draft.** Screenshots (headless Chrome, isolated profile) reviewed for every mockup at 1440 × 900 and 1920 × 1080 in both themes, Home and Squad at 1280 × 720, League at 2560 × 1440, the offer and release dialogs, and the component sheet under simulated deuteranopia and tritanopia. In the built-in browser: an automated check of 8 pages × 4 widths (1280, 1440, 1920, 2560) × 2 themes found no horizontal overflow; no script errors; every `data-tip-ref` and dialog id resolves; no duplicate ids; sorting, tabs with arrow keys, segmented switches, the compare count, dialogs (initial focus, Esc, toasts) and tooltips (hover, focus, Esc, in-viewport placement) work. Not verified: screen readers, interface scale above 100% in a real window, live data wiring.

## 11. Open decisions and completion check

Open items for the owner are listed at the end ("Owner confirmations needed", OC-1 to OC-10). Related package items: open-026 (M1 shows exact values: assumed here), open-014 and open-028 (structure and money from the economy draft), open-006 (hired blades shown in the lineup), open-007 (embargo banner), open-011 (vice-captain shown), open-016 (save screen), open-020 (M2 Watch or Simulate), open-024 (hybrids match either role in filters).

- [x] References state exactly which qualities to reproduce.
- [x] Style can be evaluated through concrete shapes, colours, type, layout and motion (tokens and mockups).
- [x] Interface presents actual rules (cap, wage budget, points, zones, presets, rule traces) from the drafts.
- [x] Essential information remains readable in the busiest screens (report, squad) at 1280–2560 px.
- [x] Prototype placeholders and required finished qualities are explicit (§10).
- [ ] A new artist can produce class icons and arena tokens without inventing direction (briefs exist; reference art is FUTURE M2).

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

**Formatting.** Money `11,840 ts`, signed changes with U+2212, durations `0:38`, weeks `2 wk`, matchweeks `MW7`, tournament weeks `TW1`, ratings as integers, potential as stars plus the number in a tooltip.

## Owner confirmations needed

Each item is OPEN until the owner answers. The recommendation is the working assumption used by the mockups.

| ID | Decision | Recommendation |
| --- | --- | --- |
| OC-1 | Visual direction: the dark "war ledger" default (slate, parchment, one brass accent) with a full light theme | **Approve.** It keeps dense data calm over long sessions; the light theme is a token swap |
| OC-2 | Typography: system fonts now (Palatino Linotype display, Segoe UI interface), or self-host an open-licensed pair | **System fonts for M1;** decide at M7 polish, with Alegreya + Alegreya Sans (OFL) as the candidate |
| OC-3 | Role language: five glyph shapes (shield, diamond, triangle, hourglass, circle-cross) plus Okabe-Ito hues, used in UI and later in the arena | **Approve as permanent.** Colour-vision checks show the shapes are what keeps roles distinct |
| OC-4 | Money shown as tessels ("ts"), from the economy draft | **Approve,** so every money figure reads the same in rules, UI and data |
| OC-5 | Ship pacing presets (Thorough / Balanced / Streamlined / Custom) in M1 rather than M7 | **Ship a simple version in M1:** it is UI-only, and FM's history (research B1.1) says pacing control prevents fatigue early |
| OC-6 | Confirmation policy: dialogs only at commit points; reversible settings apply at once with Undo | **Approve.** It removes most dialogs and keeps every costly action explicit |
| OC-7 | Notification budget: at most 6 digest items a week, at most 2 "Needs action", no pop-ups on Continue | **Approve as TUNABLE** |
| OC-8 | Minimum resolution 1280 × 720; designed for 1440 × 900 and 1920 × 1080; up to 2560 × 1440 | **Approve** |
| OC-9 | Rating bands and "brass = elite" (attributes 5/10/15; rating 40/55/70) | **Approve as TUNABLE** |
| OC-10 | Reports explain causes but never advise or forecast ("What decided it" names rules and effects only) | **Approve,** consistent with P-13 and pillar 2 |

Smaller items: an Ashkin portrait bust (needed before M1 ships, small); whether the player may rename the club at career start (02 step 2 PROPOSED; the mockups assume a renamed "Thornwick Wardens"); M2 zoom and follow (OPEN for M2).

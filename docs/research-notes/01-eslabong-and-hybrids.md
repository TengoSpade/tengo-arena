# Research notes 01: Eslabong and combat/management hybrids

**Scope.** These notes are a deep dive on *Eslabong* (shirowita, Steam Early Access, Aug 2026), our primary inspiration, plus six games that combine combat with team, roster or sports-style management: *Teamfight Manager 1 & 2*, *Battle Brothers*, *Blood Bowl 2 & 3*, *Gladiator Guild Manager*, *Domina* and *Mordheim: City of the Damned*. The focus is the seams between management and fights, roster attachment, injuries/permadeath/aging, wage and economy pressure, match and season length, battle readability, and how early-access games were received. Research was done 2026-10-25 using web sources only; no game files were opened. Steam review snapshots are dated, and Eslabong patches several times a week, so treat its mechanics as a moving target. "(inference)" marks my own reasoning. "Unverified" means I could not find a source. Our game is used as the reference frame throughout: 3–5 fighters, real-time 2D autobattle, gambit rules, scouting, academy, leagues with promotion/relegation, and a headless deterministic sim.

---

## 1. Eslabong (primary inspiration)

**Key facts.**
- **Developer/publisher:** shirowita. This is Franz, a solo developer from Argentina, with a contracted 2D artist and a musician [1][2][6].
- **Engine and platform:** Godot. Windows only, and Steam Deck compatible [2].
- **Timeline:** Public playtest from 6 May 2026 [5]. Steam Next Fest in June 2026 [6]. Early Access launched 24 Aug 2026 [1].
- **Price:** $14.99, with a 15% launch discount to $12.74 [1][12]. There is also a free demo [1].
- **Planned Early Access length:** about 3–9 months [1].
- **Reviews:** "Very Positive", 94% of 1,624 all-time and 92% of 432 in the last 30 days (snapshot 2026-10-25) [1].
- **Player counts:** All-time peak of 1,432 concurrent players in Aug 2026, about 800 average in Sep–Oct, and an estimated ~38.8K units sold. The sales figure is a third-party estimate [13].

### 1.1 Pitch and sports metaphor
- **Store pitch:** a medieval world where arena combat has replaced war. You either pilot one fighter in real-time battles (aimed abilities, positioning) or set tactics and watch. You earn gold by winning, trade mercenaries, and build a club across seasons of leagues and tournaments. Randomized stats and evolving rosters keep each season different [1]. The trailer is titled "Your Team. Your Rules" [2].
- **Devblog #1** frames the game as three interests in one: direct action, long-term management, and sports-style tournaments [6].
- **What players call it:** reviewers describe three roles at once — manager (contracts, gear, stamina), coach (tactics, formations) and player (direct control) [9]. Others call it the best mix of a MOBA-style action RPG, an autobattler and sports management [10].
- **Comparisons players draw:** *Domina*, Football Manager, *Battlerite*, WoW arenas and *Mount & Blade* arenas [9][10].

### 1.2 How battles work (verified from patch notes, devblogs and reviews)
- **Arena:** a 2D top-down real-time arena with skillshots, knockbacks, summons, friendly fire and resurrection [1][2][4].
- **Control:** you control one "captain" and can switch fighters at any time with F1–F4. Alternatively, the whole team autobattles [6][8]. Async PvP is autobattle-only [9].
- **Team sizes by format:**
  - League matches: 5v5 [9].
  - Draft and smaller cups: 2v2/3v3/4v4 [4][9].
  - Chaos Thunder: 3v3v3v3, plus 2+2/3+3 alliances [4][6].
  - 8v8 League: replaced the Mid-Season Cup in Oct 2026 [3].
  - 1v1: Champion and class tournaments [4][5].
  - Draft series: best-of-3 for 2v2/3v3 and best-of-5 for 4v4/5v5 [4].
- **Rounds:** fights are played in rounds/waves. A demo patch replaced "rounds" with a wave system [5], and a "Change Tactics" button appears after the first round [5]. 1v1s enter sudden death after 60 s [5].
- **Readability aids added over time:**
  - A Death Summary showing what killed you [5].
  - Ally orders displayed under HP bars [5].
  - Shields and barriers shown on overhead health bars [4].
  - Battle speed controls [3].
  - Shift-detailed tooltips [3].
  - A "Painted Combat Effects" style option [3].
- **Scale of content:** 50+ classes, about 100 champions (named multi-class fighters) and 700+ abilities (720 in the Codex) [1][7]. Classes are deliberately asymmetric (e.g. Mirage anchors/afterimages, Hellforged HP-sacrifice casting, Shockmender "Crash Cart") [3][4].

### 1.3 Tactics and behaviour system (most relevant to our gambits)
- **Base layer, personality:** each fighter has an AI personality that sets defaults. Examples are Berserker (dives in), Tactician (waits for openings), Cautious (keeps distance) and Reckless [5][6].
  - Personalities have a base mistake chance shown on hover [3] and grant small combat passives [4].
  - Personality is fixed per fighter but can be changed in the Time Chamber by spending Development Tomes [3].
- **Directives:** these override instincts, e.g. focus healers, burst a target, or hold position to protect an ally [6].
- **Advanced Tactics** (added incrementally Aug–Oct 2026), per fighter and per ability:
  - AoE efficiency: Natural / Requires 2 / Requires 3 targets [5].
  - Friendly fire: Natural / Avoid / Calculated / They Will Dodge [5].
  - Preferred range for ranged fighters [5].
  - Opening Move duration of 1–5 s [4].
  - Skill priority [3].
  - Minimum ally or enemy counts before casting [7].
  - Per-ability timing: Open with it / Save it / Emergency only [7].
  - Heal-below-HP thresholds [7].
  - Combo starter / finisher roles [7].
- **How personality and explicit settings interact:** personality supplies the default for each setting (Reckless leans to "They Will Dodge", Cautious to "Avoid"), and an explicit setting overrides it [5].
- **Saving and reuse:** formations such as Tight, saved tactics (slots raised from 3 to 10) and saved lineups that remember positions [4][3]. Tactics can change between Draft Cup rounds [4].
- **Status of the system (inference):** it is a growing pile of per-ability toggles, not an ordered IF/THEN list. Players still ask for sequencing it can't express, e.g. "use X only as a late gap-closer, then Y, then Z" [19]. This is exactly the gap a gambit list fills.

### 1.4 Management systems
**League and season structure.**
- **Teams per season:** 20, including yours. The rest are a mix of 25–30+ handcrafted named teams (each with a leader, backstory and playstyle) and random teams [6][1].
- **Divisions:** first 6, cut to 4 in Sep 2026. You start in Division IV, the top 4 are promoted, and top divisions start with level-30+ rosters [4][5].
- **Disbanding:** the lowest finishers are disbanded each season. Their fighters flood the market and new teams appear [6].
- **Competition calendar:**
  - The league itself (win/draw/loss gives points, gold and Renown) [6].
  - A Mid-Season Cup, later replaced by an 8v8 League [3].
  - Chaos Thunder Cup [6].
  - Champions Cup for the top 8 [6].
  - All-Star match for the 10 best fighters [6].
  - Draft Cup [4].
  - Tournament Center: rotating class tournaments with entry fees and a 4-week cooldown [3][5][8].
  - Iron Gate: PvE co-op mode [1][2].
  - Hall of Legends: late PvE with global speed/casualty leaderboards [3].
  - Special-event registration in weeks 5, 13 and 21 [3].
- **Season Modifiers:** a pool of per-season rules (combat, class availability, economy, markets, lineups) that can be disabled [3].
- **Length:** seasons are infinite and the level cap is 100 [5].

**Recruiting and market.**
- **Sources:** fresh level 1–2 recruits come from the "Mercenary Union". Veterans are bought from AI clubs. There are also offers, trades, champion auctions, and loans of inactive fighters for gold [6][4].
- **Renown gates:** stronger classes unlock with Renown [6]. Signings more than 5 levels above your top five cost 200 Renown per extra level [4].
- **Division premium:** fighters from higher divisions cost +15% per division, capped at +75% [4].
- **Protecting fighters:** you can mark fighters "non-negotiable" to stop offers [4].
- **Simulated market:** AI clubs open chests, buy, sell and equip relics [5].

**Scouting.**
- **Scouting Office:** reveals hidden stats and potential and gives a market value [6]. Its capacity was raised from 6 to 10 [5].
- **Class search:** pay 2,500 gold to search for a class; candidates appear the following week [5]. An Automatic Weekly Scout costs 2,000 gold/week [4].
- **Scout Assessments** [4], plus Scout staff [3].
- **What the market shows:** personality, growth, injury risk and tendencies [4].
- **Gaps:** players ask to extend scouting to rival rosters ("Intel") [14]. Unlike our design, scouting appears to be about money and capacity, not scout skill or regional expertise (inference).

**Development.**
- **Stats:** HP, damage (later renamed Power), defense and movement speed. They are partly random per level-up, with a chosen boost every 3 levels [6].
- **Growth styles:** balanced/good/excellent per stat [5]. Rebirth can reroll the growth style [4].
- **Abilities:** a new ability every 4 levels, picked from 2–3 weighted options [6].
  - Skill rarity is 55/30/13.5/1.5% with legendary pity [4].
  - Ability evolutions start at level 20 [5].
  - Upgrades were reworked into three big picks at levels 14/34/54 instead of 15 small ones [3].
- **Ascend to Champion:** turns a regular fighter into a cross-class Champion; AI clubs do this too [7].
- **Shiny fighters:** a 1/5000 roll for +20–40% base stats. Shiny stat bonuses were later stripped from PvP [4].
- **Training and academy:**
  - Training Hall gives passive weekly XP [5].
  - The Time Chamber levels fighters to 20 and handles respecs [4][3].
  - The Academy was originally a youth team of 5 low-level fighters in weekly simulated matches at 75% XP [5]. It was reworked into a 3v3 academy league you can play without advancing the week, with weekly objectives that pay Development Tomes (catch-up currency) [5]. Academy matches now grant XP even on a loss [3].
  - "Development Plans" automate Academy/Training rotation with presets [4].
- **Bench XP:** benched fighters earn less XP, which creates a starters-versus-rotation tension [15].

**Condition, injuries and aging.**
- **Form (fatigue):** has variable loss per match and a "Restore Form" window. The Medical Bay reduces loss and can heal Form for gold [5]. Players say fighters weaken below 75% Form [19].
  - Form can be disabled on any difficulty [5].
  - Form loss is reduced 50%/25% in Seasons 1/2 [7].
  - Form loss was removed from some cups [3].
- **Injuries:** exist and recover per league week. An Oct 2026 patch matched rival clubs' injury rate to the player's [3]. The Rookie Cup has no injuries [4].
- **Retirement:** absent at launch, then requested in several threads [16]. Added 20–21 Oct 2026 as an **optional, off-by-default** campaign setting [3]:
  - Veterans announce their final season.
  - Career records persist.
  - You can pay once per career to keep a fighter one more season.
  - AI clubs also retire fighters [4].
- **No age stat is documented** (unverified).

**Economy and facilities.**
- **Currencies:** gold (wins, chests, sales), Renown (unlocks, signings, rerolls) and Prestige (endgame) [5][9].
- **Facilities:** HQ (roster cap from 20 up to 70; upgrades cost 5,000–500,000 gold), Medical Bay, Treasure House, Scouting Office, Training Hall and Club House [4][3][5].
- **Staff:** a market for staff (Medic, Scout, Trainer, Captain Teacher, Treasure Hunter, Shiny Catcher…) who can be hired, assigned and sold [3].
- **Wages/contracts:** **unverified.** No patch note mentions wages. One forum post lists "salary" as a desired filter field [21], and one review mentions "contracts" [9]. If upkeep exists, it is not a headline pressure (inference).

**Difficulty and meta-progression.**
- **Difficulty tiers:** Relaxed/Easy/Normal/Hard/Infernus [8]. On Easy, XP and gold are doubled [8]. Infernus "Threat" scales up by season, reaching +60% at Season 15 [4].
- **Meta-progression:** the developer says the only real meta-progression is permanent class unlocks. He thinks the league lacks the real-world grounding Football Manager has, and has "some ideas" for more [18].

**Multiplayer.**
- **Challenge Tower:** async ghost battles against submitted rosters. It is split into Competitive (level-100 normalization, standard relics, fresh Elo) and Eternal (your real progression) [4].
- **Local and remote co-op:** player 2 pilots one fighter [8][3].

**Saves.** Rotating autosaves, backup/restore, and an "Allow new rolls when loading" toggle that decides whether reloading rerolls random outcomes [3].

### 1.5 Match and season length
- **Match length:** unverified as a number. In the 2026 playtest, one season had about 40 matches [5]. Players asked for a skip-round button because "5 rounds is a lot to watch" in tournaments [22]. Late-game load times were optimized "from season 10" [3].
- **Pacing complaints:** players report losing motivation after about 10–15 h because seasons repeat [18].

### 1.6 Early Access versus roadmap
- **Current build:** the content listed in §1.2–1.4 [1].
- **Store plan for 1.0:** finish the Dungeon Complex, expand async multiplayer, and add more classes and abilities [1].
- **Announced in-flight work (Oct 2026):** a Steam Workshop "Create a champion" feature [3]; more class champions; more late-game performance and UI fixes [3].
- **Release cadence:** about 119 Steam posts between Apr and Oct 2026, often several builds a day. Examples are 0.80.1–0.81.3, all on 16 Oct [3][4].

### 1.7 Reception
- **Launch day:** 50 of 53 English reviews were positive [12].
- **Now:** 94% all-time, and 92% for the most recent 30 days [1]. The recent negatives mostly cite new-player difficulty, complexity and UI [11], so those are the likely cause of the small dip (inference).
- **Sample of the 10 most recent English reviews (23–24 Oct):** all positive [10].

### Eslabong — the 5 points
**1. What makes it fun or sticky.**
- **Three-role fantasy:** manager, coach and player [9].
- **Programmable AI that visibly changes fights.** One reviewer: "You can change the entire match with a tweak of your teams AI." (Kariu) [9]
- **Gacha-like discovery:** the "one good shiny champion with perfect skillset" [10], plus auctions and weighted ability rolls [6][4].
- **A dense calendar:** something new every week (cups, drafts, events, special formats) [3][6].
- **A churning world:** disbanding teams and season modifiers keep the league changing [6][3].

**2. Good practices to adopt.**
- **Behaviour vocabulary:** personality defaults with explicit overrides, and per-ability timing/threshold conditions [5][7].
- **Same rules for rivals:** AI clubs obey the player's rules — matched injury rates, AI retirements, AI ascensions [3][4][7].
- **Variety tools:**
  - Season Modifiers as an anti-staleness lever that players can opt out of [3].
  - Draft cups that use the whole roster [9].
- **Catch-up for new joiners:** Development Tomes and Academy objectives let newcomers catch up [5].
- **Showing hidden information at the market:** risk and potential before purchase [4].
- **Opt-in hardcore toggles:** Form, retirement, no-champion-signings [5][3][4].

**3. Features players love.**
- **Depth of AI tuning** [9][10].
- **Class and ability variety** [10].
- **Draft Cups** ("probably my favorite") [9].
- **Scouting and watchlists** [9].
- **Highly responsive developer and frequent updates** [9][10].
- **Manual control as an optional skill expression**, though many default to autobattle [10].

**4. Complaints and pitfalls.**
- **Patch churn:**
  - "I feel like I'm playing a different game every four days." (Morritranquilo) [8]
  - 3–4 patches a day change runs mid-season [8].
- **Tactics reliability:**
  - Fighters don't focus targets.
  - Clerics dump a big AoE heal on full-HP allies.
  - Fighters stand idle after casting ("Characters just standing still for seconds after they use an ability", Demigod Dan) [8].
  - The AI mismanages stamina [20].
  - A self-buff bug was confirmed by the developer [19].
  - Combat is too fast to verify whether settings work [8].
- **Levels outweigh tactics:** rivals are often far higher level, and Easy only doubles XP/gold rather than weakening the AI [8][15].
- **Shallow management (early EA):** passive training and a weak academy. "there is not much to manage in a management game." (Drages, Aug 2026) [8]
- **No endpoint:** endless seasons, a stale late game after level 100, and losses with no stakes [18][9].
- **UI/UX:** hitches on every action, an opaque stat/level-up UI, and costs hidden in the Codex [8][11].
- **Trust problems:**
  - Some reviewers suspect heavy AI-assisted development (generic ability text, "LLM-sounding" humor) [8][11].
  - Requests for clearer credit for third-party (Liberated Pixel Cup) assets [8].
- **Economy:** tight early gold, relics sell far below value, and tournament entry fees are only recovered by winning [8].

**5. Ideas for our hybrid game.**
- **Personality as a gambit preset:** our fighters' personalities become a starter gambit list plus a "mistake chance". Players edit or replace it, and the UI shows which rules came from personality and which from the player.
- **Gambit conditions taken from Eslabong's toggles:** `IF enemies_in_radius ≥ N`, `IF ally HP < X%`, `IF opening (first N s)`, `IF emergency (self HP < X%)`, `IF combo-primed target`, plus a friendly-fire policy per action. The ordered list solves the sequencing gap players complain about [19].
- **A battle trace:** per fighter, "rule #3 fired 14×, rule #5 never". Add pause-and-inspect and a post-match "why" panel to answer "did my tactics work?" [8].
- **Weekly cadence:** a league fixture plus one optional side format (draft cup, 3v3 academy cup), so depth players can play the whole roster [9].
- **Realism that is on by default, not optional:** aging, retirement and real injuries. Eslabong had to retrofit retirement as an opt-in, which shows players want it [16][3].

---

## 2. Teamfight Manager (2021) and Teamfight Manager 2 (EA 2026) — the "sports autobattler"

**Key facts.**
- **Developer/publisher:** Team Samoyed [24][28].
- **TFM1:** released 1 Mar 2021 at $9.99. 83% of 1,179 English reviews are positive [24].
- **TFM2:** Early Access since 25 May 2026 at $19.99, with an expected 1–2 years in EA. "Mostly Positive", 73% of 814 English reviews, but the last 30 days are 80% [28]. Both are tagged eSports/Auto Battler/Management [24][28].

**1. What makes it fun or sticky.**
- **TFM1 loop:** you coach an esports team and never control matches. Matches are about 1-minute kill-count deathmatches, usually first to two wins. Team size grows 2v2 → 3v3 → 4v4 as you climb from the Amateur League [24][27][26].
- **Where the depth is:** the pick/ban draft, plus an in-fiction **patch cycle** that buffs and nerfs champions between seasons, so the meta shifts under you [27][26].
- **TFM2:** adds a MOBA map, team and personal tactics, scouting via "Solo Rank", and transfers. Player stats drive AI *decision quality* rather than raw damage [28].

**2. Good practices.**
- **Short matches** with a clear win condition [24].
- **The in-world "patch" as a seasonal variety engine** [27].
- **Player-champion mastery** that grows with use, which creates specialists [27].
- **Workshop support** for champions, teams and tournaments [28].
- **Visible, frequent, communicative development**, praised in TFM2 reviews [30].

**3. Features players love.**
- **Drafting.** Even critics call it as good as TFM1's [29].
- **The meta shifting with patches** [26].
- **Attachment to individual players with traits and specialties** [30].
- **Sandbox storytelling and player arcs** [30].

**4. Complaints and pitfalls.**
- **TFM1:**
  - Management is shallow; training barely matters compared with simply recruiting better players [27][25].
  - Too many long games per season, and you have to watch tournaments you aren't in [25].
  - Equipment crafting feels like a lottery [25].
  - The late game reduces to drafting. "Eventually you're just playing draft chess." (Robin) [25]
- **TFM2:**
  - Opacity dominates the complaints: over 10 unexplained stats, and nothing showing *why* a match was lost. "you have no idea WHY the things that are happening, are happening." (Bobbyaxe) [29]
  - The AI ignores set tactics and makes visibly dumb plays, which is the top theme in an aggregate review analysis [29][31].
  - Training gives everyone the same boost [29].
  - A contract bug let prospects silently expire [29].
  - Young players demand higher wages than stars [29].
  - Text reads as AI-generated [29].

**5. Ideas for our game.**
- **Stats should change decisions as well as numbers** (TFM2's idea). For example, a "Composure" stat lowers the chance a gambit misfires or fires late. A post-match panel then attributes outcomes to stats and rules.
- **Seasonal "rules patches"** across the league: a balance tweak or modifier, announced in a news feed, that forces adaptation.
- **Auto-sim or skip for matches you're not in**, plus a "watch highlights" mode.
- **Targetable training**, so specific weak stats can be trained.

---

## 3. Battle Brothers (2017) — the fantasy mercenary company

**Key facts.** Overhype Studios. Published by Hooded Horse/Overhype. Released 24 Mar 2017 at $29.99, with several DLCs (two free). Turn-based tactics on a real-time world map. 89% of 15,636 English reviews are positive; recent reviews are 82% [32].

**1. What makes it fun or sticky.**
- **Emergent stories** of low-born recruits (about 50 backgrounds, e.g. beggar or graverobber) who become veterans or die permanently [32][35].
- **A living sandbox:** late-game crises (around day 100) that reshape the map [35].
- **Attachment despite (and because of) loss.** "You will come to care about your battle brothers." (DorianRaker) [34]

**2. Good practices.**
- **Constant upkeep:** daily wages and food, so every idle day costs money [32][36].
- **Wages tied to identity:**
  - Pay is set per background with a small random factor per recruit, so cheap and pricey recruits of the same background both exist.
  - Wage growth per level was changed from +2 crowns per level to +10% of base wage per level up to level 11, then +5% (Dev Blog #110, 2018, via search summary) [37].
- **Unpaid or hungry men leave** [35].
- **Temporary versus permanent injuries:** a broken arm heals with rest, while a broken elbow permanently lowers attributes [35][36].
- **Traits that grow out of events** [32].
- **Separate difficulty sliders** for economy, combat and starting funds, added in update 1.1 (2017) [53].

**3. Features players love.** Permadeath tension, backgrounds and traits, perk-tree builds, the morale and fatigue model, and the replayability of the sandbox [34][36].

**4. Complaints and pitfalls.**
- **RNG without counterplay**, the top complaint in 7 of 10 top negative reviews. Losing veterans to miss streaks feels like "gambling with my time" (Many-As-One) [33].
- **Difficulty spikes:** a frontloaded early game and a mid-game wall [33].
- **Rebuilding after losses is slow, and the late game repeats** [33].
- **Reserve problems:** 20 men on the roster but only 12 per battle, and reserves gain no XP, so they're underprepared [35].
- **Opaque information:** few tooltips on wounds and enemy abilities [36].

**5. Ideas for our game.**
- **Wages as a background × level formula** with a per-fighter random "greed" factor. Scouting reveals it, and contract renewals reprice it.
- **An injury table with a severity ladder:** light (Form loss) → out N weeks → permanent stat scar → career-ending. Medical staff and academy specialisations change the odds.
- **Bench XP via training or academy**, so reserves aren't dead weight — the opposite of Battle Brothers' problem.
- **Deterministic RNG that feels fair:** cap swinginess for key events in the sim (e.g. no one-shot from full HP at equal level) and show hit chances. Reduces BB-style "the game cheats" perceptions.

---

## 4. Blood Bowl 2 (2015) and Blood Bowl 3 (2023) — fantasy sports leagues

**Key facts.**
- **Studios:** both by Cyanide. Publishers were Focus Home (BB2) and Nacon (BB3) [41][38].
- **Format:** turn-based adaptations of the Games Workshop board game [41].
- **BB2:** Metacritic 76 on PC [41].
- **BB3:** a planned Sept 2021 PC early access was postponed indefinitely in favour of closed betas, then the game launched 23 Feb 2023 with Metacritic 60 (PC) and "mostly negative" Steam reviews in launch week [38].

**1. What makes it fun or sticky.**
- **Persistent teams in leagues:**
  - Players gain experience and skills, and races progress at different rates [43].
  - Injury, death and retirement force marketplace churn [41][43].
- **Online leagues are the "golden egg":** BB2's highest-hour reviewers cite community leagues, typically one game per week, and a champion ladder running 6–9 weeks [42].

**2. Good practices.**
- **Catch-up between mismatched teams:**
  - "Inducements" give the lower-value team a budget for temporary help (mercenaries, star players, bribes).
  - "Spiralling expenses" curb runaway strong teams [43].
- **Team value as a matchmaking and balance currency** [43].
- **Player aging** existed in one ruleset era (LRB1) [43].

**3. Features players love.**
- **Long-term team identity and the risk management of each roll** [42].
- **Injuries that can permanently remove key players**, which give the stakes [42].
- **Humour and commentary** [41][42].

**4. Complaints and pitfalls.**
- **BB3's launch is a cautionary tale:**
  - It shipped without BB2-era features (private-league tools, eternal leagues, reconnect, match history).
  - Many skills were bugged, and the single-player AI was worse than BB2's [39][38].
  - Monetisation was called predatory: consumable, per-player cosmetics, a battle pass, and paid factions [38][39].
  - League admin tools only arrived in beta in Jan 2024 [38].
- **Recent BB3 reviews (Oct 2026)** are 7 of 10 positive but note lag, disconnects and a newcomer-hostile online scene [40].
- **BB2 critics:** dice frustration, and a ruleset poorly introduced to newcomers [41].

**5. Ideas for our game.**
- **League-level catch-up mechanics:** inducement-style budgets for promoted or poor clubs, and wage-cap or spiralling-expense pressure on dynasties. These address Eslabong's "too easy by season 4" problem [18].
- **Season-end "redraft" pressure:** a review of contracts, retirements and academy returns, presented as a ceremony.
- **Never ship a sequel or update that removes league tools players relied on** (process lesson).

---

## 5. Gladiator Guild Manager (EA 2021 → 1.0 2024) — strategic autobattler

**Key facts.**
- **Studio:** Entertainment Forge. Publishers are GrabTheGames and others [44].
- **Dates:** Early Access from 13 Oct 2021, 1.0 on 22 Jun 2024. $14.99 [44].
- **Reviews:** 80% of 1,646 English reviews positive; recent reviews are 70% [44].

**1. What makes it fun or sticky.**
- **Pre-fight decisions, then an automatic battle:** choose which gladiators fight, place them, and set behaviour [44].
- **A calendar of monthly championships and weekly "Ring of Death" arenas** [44].
- **Factions and quests** that change offers [44][46].
- **An endless leaderboard mode** after the campaign [44].

**2. Good practices.**
- **Time passing forces a choice** between preparing for big events and earning now [46].
- **Optional permadeath:** "Nightmare + permadeath" is called the best way to play [46].
- **Items seeded per run** [46].

**3. Features players love.** Class variety with rock-paper-scissors counters, good value, and easy-to-read presentation [46].

**4. Complaints and pitfalls.**
- **Placement chores:** units must be placed manually before every fight, and formations can't be saved [45][46].
- **Arbitrary squad caps:** 3–5 per fight out of 8+ owned, so XP is starved [45].
- **Fighters freezing mid-fight**, a recurring bug [45].
- **Shallow management:** no rival guilds and no behaviour system [46].
- **Repetition after about 5 hours** [45].
- **Perceived abandonment after 1.0** [45].
- **Fallen champions revive quickly on lower difficulties**, which removes stakes [46].

**5. Ideas for our game.**
- **Saved formations and saved gambit presets per squad**, and per opponent archetype.
- **If the squad size is below the roster size,** give non-selected fighters a meaningful parallel track (academy, loans, training camp).
- **A "frozen fighter" watchdog** in the sim (QA lesson: idle detection in deterministic tests).

---

## 6. Domina (2017) — gladiator school, Eslabong's closest ancestor

**Key facts.**
- **Studio and dates:** Bignic (also listed as DolphinBarn). Steam Early Access 3 Apr 2017 [47][49].
- **Sale history:** removed from sale on Steam in Sept 2022 after offensive patch-note comments by the developer [47].
- **Why it's here:** Eslabong reviewers explicitly compare the two [9][10].

**1. What makes it fun or sticky.**
- **"Football Manager for gladiators":** buy and train fighters, pick classes, and send them to the pits or the Colosseum [48].
- **Optional direct control of one gladiator**, though most leave fights to the AI [47][48].
- **Permadeath and quirky events** [48][49].

**2. Good practices.**
- **Hiring staff (trainers, workers)** gives a second management axis [48].
- **A strong soundtrack and arena-entrance spectacle**, singled out by several critics [47][48].

**3. Features players love.** Brutality, spectacle and value (about 20–30 hours at about $6) [48]. GameSkinny scored it 9/10 [49].

**4. Complaints and pitfalls.**
- **Clumsy manual control** [48].
- **Poor ally AI** (PC Gamer) [47].
- **"Wild balance issues"** (RPS) [47].
- **Dull downtime with no fast-forward** [48].
- **No save option, and a time-capped mode** [49].
- **A "disposable" feel** with low attachment (RPS) [49].
- **Developer conduct destroyed the game's commercial life** [47].

**5. Ideas for our game.**
- **Downtime must be skippable or eventful.** Every in-game week should have a decision, otherwise auto-advance.
- **Arena entrance and crowd moments** (intro, kill cams, MVP card) are a cheap readability and spectacle win.

---

## 7. Mordheim: City of the Damned (2015) — warband management with persistent wounds

**Key facts.** Rogue Factor; publisher Nacon. Released 19 Nov 2015, after an early-access period in 2014 (reviews are tagged EA). 71% of 4,778 English reviews positive; Metacritic 74 [50][51].

**1. What makes it fun or sticky.**
- **Persistent warband:** units gain XP and skills [50].
- **Injuries are rolled after missions:** lost limbs, head trauma, madness [51].
- **Death is permanent** [50].
- **Every action autosaves with no undo**, so each choice carries weight [51].

**2. Good practices.** Injuries that change *how* a unit plays, e.g. a melee unit improving after losing an arm, or head trauma causing idle turns [51].

**3. Features players love.** Tension from permadeath and wounds, deep skill trees, and atmosphere [51].

**4. Complaints and pitfalls.**
- **Asymmetry:** the player's injuries are permanent, but enemy warbands are regenerated each mission and scale to the player, so they never suffer. "every death and injury inflicted on you is permanent." (Nay) [52]
- **Difficulty is just inflated enemy wounds and stats** [52].
- **Replacements start at level 0** [52].
- **Slow and repetitive** [52].
- **Upkeep:** fixed warband wages plus a Wyrdstone quota that can end the game [52].

**5. Ideas for our game.** AI clubs must persist and suffer the same injuries, aging and finances, simulated headlessly. That makes rival decline visible ("their star tore a ligament"), creates transfer opportunities, and makes the world feel fair.

---

## 8. Cross-game comparison

**Seams between management and combat.**
- **Where it works:** management feeds the fight through stats, abilities and behaviour, and the fight feeds back through XP, injuries, Form and money. Eslabong closes the loop best because the tactics you set are visible in the fight [9]. Battle Brothers ties the economy directly to battle outcomes (pay, loot, wounds) [36].
- **Where it fails:**
  - When stats don't visibly matter (TFM1/TFM2 [25][29]).
  - When one variable such as level dominates everything (Eslabong [8]).
  - When placement or tactics are chores rather than decisions (GGM [45]).
- **Lesson (inference):** every management lever needs a **visible combat signature**, plus a post-match explanation that links outcomes back to it.

**Roster attachment.**
- **Driven by:** origin stories (BB backgrounds [32]), rare finds (Eslabong Shinies and champions [10]), career records (Eslabong retirement [3]), persistent wounds (Mordheim [51]) and specialisation (TFM champion mastery [27]).
- **Weakened by:** disposability and quick revives (Domina [49], GGM [46]), and by replacement always beating training (TFM [27]).
- **Our academy plus potential system is the main attachment engine (inference):** players invest months of game time in a prospect.

**Injuries, permadeath and aging.**
- **Two poles:** brutal permanence (BB, Mordheim) produces stories but also RNG rage [33][52]; soft or optional systems (GGM, Eslabong) produce staleness and "no stakes" [18][46].
- **Eslabong retrofitted optional retirement after demand** [16][3].
- **Blood Bowl had aging in one ruleset era** [43].
- **No game here does sports-style aging curves well** (inference). That is an opening for us: peak ages per class, decline, retirement, and veterans becoming staff (a request in [17]).

**Wage and economy pressure.**
- **Battle Brothers:** daily wages and food, with desertion [35][37].
- **Mordheim:** fixed wages plus quotas [52].
- **Eslabong:** pressure is mainly early gold scarcity and entry fees; wages are unverified [8][21].
- **TFM2:** wage logic looked broken (young players asking more than stars) [29].
- **Typical arc (inference):** pressure is high early and collapses late — "running out of things to buy" by season 4 [18]. Dynasties need cost growth (wages scaling with stardom, spiralling expenses [43]) and money sinks with a real decision attached.

**Match and season length.**

| Game | Match | Season / run |
|---|---|---|
| TFM1 | about 1 min, first to 2 wins [27] | "too many games per season" [25] |
| TFM2 | about 9–12 min typical (aggregate) [31] | 10–20 h per season (aggregate) [31] |
| Eslabong | rounds/waves; 60 s sudden death in 1v1 [5] | about 40 matches in the playtest season [5]; infinite seasons [5] |
| Blood Bowl 2 online | — | 1 game per week; ladder seasons 6–9 weeks [42] |
| GGM | — | monthly championships plus weekly arenas [44] |
| Battle Brothers | — | crisis around day 100 [35] |

- **Pattern:** short individual fights are praised, but a season of them tires players unless non-essential matches can be skipped or simulated [25][22].

**Battle readability.**
- **Recurring complaints:**
  - "Too fast to verify tactics" (Eslabong [8]).
  - "No idea WHY" (TFM2 [29]).
  - AI looking dumb on screen even if the backend is sound [29].
- **Fixes seen:** Eslabong's death summary, orders under HP bars, shield bars and detailed tooltips [5][4][3].
- **Implication for us (inference):** pause plus a rule-trace overlay, slow-motion on key events, and post-match analytics are table stakes for a gambit game.

**Early-access reception trends.**
- **High scores come from responsiveness plus a fun core:** Eslabong at 94% [1], TFM2 recovering to 80% recent [28].
- **The killers:**
  - Visible AI stupidity and opacity (TFM2 [31]).
  - Missing predecessor features plus monetisation (BB3 [38]).
  - Perceived abandonment (GGM [45]).
  - Developer conduct (Domina [47]).
- **Patch speed is double-edged:** loved as responsiveness [9] and resented as churn [8].
- **Suspected AI-generated text** is an emerging trust complaint in this niche (Eslabong [8][11], TFM2 [29]).

---

## 9. Top ideas for our game (ranked)

1. **Ordered gambit lists, seeded by personality presets.** Combine Eslabong's personality defaults [5][6] with a true ordered IF/THEN list. This covers the sequencing players can't express today [19] while staying approachable (the personality preset works out of the box).
2. **Steal Eslabong's condition vocabulary.** Use thresholds such as N enemies in radius, ally HP < X%, opening window, emergency only, combo setup/finish, and a friendly-fire policy [5][7]. These are proven useful in a real-time 2D arena.
3. **Rule-trace and "why we lost" analytics.** Show per-rule fire counts, misfires, and a death summary per fighter. This is the biggest gap across TFM2 and Eslabong [29][8].
4. **Stats that affect decision quality, not just numbers.** E.g. composure, reaction delay and misfire chance on gambits (TFM2's idea [28]). This lets "smart" players visibly outperform, and it ties scouting reports to fight behaviour.
5. **Rival clubs live under identical rules.** They age, get injured, pay wages, use academies and decline, all simulated by the deterministic sim [3][52]. This creates transfer stories and fairness.
6. **A side-competition calendar that uses depth.** Small-format cups (2v2/3v3), a draft cup and an academy cup. Draft Cups are the most-loved Eslabong feature among engaged players, and they "make the whole roster matter" [9].
7. **Seasonal league modifiers or "rules patches",** announced in the news feed. These counter endless-season staleness and solved metas (Eslabong [3], TFM [27]).
8. **Sports-style aging and retirement on by default,** with farewell seasons, career records and veterans becoming staff (trainer or scout). Players asked Eslabong for exactly this [16][17][3].
9. **Wages scale with background, level and stardom, with a hidden "greed" factor** revealed by scouting (Battle Brothers [37]). This keeps pressure on late-game dynasties.
10. **Catch-up and anti-dynasty levers:** inducement budgets for underdogs and spiralling expenses for champions (Blood Bowl [43]). These fix "too easy by season 4" [18].
11. **Injury severity ladder with play-changing scars** (Battle Brothers, Mordheim [35][51]). Medical staff and academy specialisations change the odds.
12. **Planning automation:** Eslabong-style Development Plans [4], saved formations and gambit sets per opponent type (GGM's missing feature [45]).
13. **Skip or simulate any match you don't care about,** plus highlight reels (TFM [25], Domina [48], Eslabong [22]).
14. **Season-end ceremony:** awards, a review of retirements and contracts, academy graduates, disbanded or relegated clubs flooding the market [6][5].

## 10. Pitfalls to avoid (ranked)

1. **AI that looks dumb on screen.** Idle after casting, wasted heals, ignored focus orders, stamina starvation [8][20][29][31]. This is the #1 complaint across the genre. Mitigate with sim QA bots and idle and waste detectors.
2. **Opaque cause and effect.** Unexplained stats, no post-match "why", costs hidden in a codex [29][8]. Opacity turned TFM2's reception Mostly Positive.
3. **One variable dominating** (level or raw stats beating tactics) [8][15]. If tactics don't matter, the core pillar fails.
4. **Endless seasons with no goals, stakes or endpoint** [18][9]. Add objectives, legacy, aging, dynasty pressure and optional season targets.
5. **Patch churn that breaks saves and strategies mid-season** [8]. Use a beta branch, batch balance changes between seasons, and version-lock long saves.
6. **Management that is passive or token** (passive training, an academy that "feels weak") [8][27]. Every system needs a decision.
7. **Asymmetric rules between the player and the AI** [52][33][35]. This is felt as cheating.
8. **Chores instead of decisions:** re-placing units every fight, unskippable matches, waiting through dead days [45][25][48].
9. **RNG spikes on irreversible outcomes** (permadeath or career-ending injuries from one roll) without mitigation [33][52].
10. **Difficulty settings that change rewards but not the challenge players struggle with** [8].
11. **Shipping without features players expect, or monetising cosmetics aggressively** (BB3) [38][39].
12. **Generic or "LLM-sounding" text and unclear asset licensing** that erode trust [8][11][29]. Write or curate flavour text by hand, and credit CC-licensed assets properly.
13. **Broken transfer, contract or wage logic** (e.g. silent contract expiries, young players asking more than stars) [29].
14. **Post-1.0 abandonment, or developer conduct issues** [45][47].

## 11. Open questions for the designer

1. **Manual control:** do we offer direct control of one fighter (Eslabong's "captain")? Or stay pure autobattle with pause-and-edit gambits? Manual control is loved but makes balance and async harder, and some modes end up requiring it [8][10].
2. **Gambit edit timing:** can players edit gambits only between matches, also between rounds (Eslabong allows after round 1 [5]), or live while paused?
3. **Permanence defaults:** are permadeath, career-ending injuries and aging on by default, or a difficulty/"Ironman" toggle? Eslabong chose opt-in [3]; BB and Mordheim chose mandatory.
4. **Endgame:** what are the season goals and the endpoint? Board objectives, a dynasty score, a "career" length, or New Game+ (requested in [18])?
5. **RNG and save-scumming:** does reload reroll outcomes (Eslabong offers a toggle [3]), or is the deterministic seed fixed per match?
6. **Async PvP:** is ghost-league PvP in scope? If so, do we normalise stats like Eslabong's Competitive ladder [4]?
7. **Wage model:** fixed weekly wages, renegotiated contracts, or Battle Brothers-style daily upkeep? How harsh is debt (desertion, a transfer embargo)?
8. **Round format:** how many rounds per match and how long each, given that a season of 30–40 fixtures must not exhaust players [5][25]?

---

## Sources
1. Eslabong — Steam store page. https://store.steampowered.com/app/4560660/Eslabong/
2. Eslabong — official site / press info. https://eslabong.com/
3. Steam News API, Eslabong posts 21 Sep–23 Oct 2026 (patches 0.52.4–0.84.4). https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=1500
4. Steam News API, Eslabong posts 29 Aug–19 Sep 2026 (patches 0.33.11–0.51.4). https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=1500&enddate=1789948800
5. Steam News API, Eslabong posts Apr–28 Aug 2026 (devblogs, playtest, demo patches, EA launch, 0.31–0.33). https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=3000&enddate=1787961600
6. Eslabong Devblogs #1–#4 (Apr–May 2026), full text via Steam News API: https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=5&maxlength=0&enddate=1777766400 — individual posts: https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1831432155566499 (Devblog #3), https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1831432155574638 (Devblog #4)
7. Eslabong 0.82.1 "Ascend to Champion" / Advanced Tactics notes (19 Oct 2026), via Steam News API. https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=4&maxlength=0&enddate=1792454400
8. Eslabong — top-rated negative Steam reviews (English). https://steamcommunity.com/app/4560660/negativereviews/?browsefilter=toprated&filterLanguage=english
9. Eslabong — top-rated positive Steam reviews (English). https://steamcommunity.com/app/4560660/positivereviews/?browsefilter=toprated&filterLanguage=english
10. Eslabong — most recent Steam reviews (English, 23–24 Oct 2026). https://steamcommunity.com/app/4560660/reviews/?browsefilter=mostrecent&filterLanguage=english
11. Eslabong — most recent negative Steam reviews (English). https://steamcommunity.com/app/4560660/negativereviews/?browsefilter=mostrecent&filterLanguage=english
12. GameGuideDog — "Eslabong Early Access Steam review snapshot" (25 Aug 2026). https://gameguidedog.com/articles/eslabong-early-access-review-snapshot/
13. Raijin.gg — Eslabong Steam stats & charts (third-party estimates). https://raijin.gg/app/4560660/Eslabong
14. Eslabong — Steam General Discussions index. https://steamcommunity.com/app/4560660/discussions/
15. Eslabong discussion — "Unbalanced … Game" (difficulty/levels thread). https://steamcommunity.com/app/4560660/discussions/0/590687538416527966/
16. Eslabong discussions — search "retirement". https://steamcommunity.com/app/4560660/discussions/search/?q=retirement&gidforum=0
17. Eslabong discussion — "Retirement" (22 Oct 2026). https://steamcommunity.com/app/4560660/discussions/0/562545439722860075/
18. Eslabong discussion — "Please add progression" (incl. developer replies). https://steamcommunity.com/app/4560660/discussions/0/570426530135597095/
19. Eslabong discussions — search "tactics". https://steamcommunity.com/app/4560660/discussions/search/?q=tactics&gidforum=0
20. Eslabong discussion — "AI and stamina management". https://steamcommunity.com/app/4560660/discussions/0/562545740485849739/
21. Eslabong discussions — search "salary". https://steamcommunity.com/app/4560660/discussions/search/?q=salary&gidforum=0
22. Eslabong discussions — search "rounds". https://steamcommunity.com/app/4560660/discussions/search/?q=rounds&gidforum=0
23. Unofficial Eslabong fan wiki — Beginner Guide (low reliability; not used for facts). https://eslabong-game.wiki/en/guide/eslabong-beginner-guide
24. Teamfight Manager — Steam store page. https://store.steampowered.com/app/1372810/Teamfight_Manager/
25. Teamfight Manager — top-rated negative Steam reviews. https://steamcommunity.com/app/1372810/negativereviews/?browsefilter=toprated&filterLanguage=english
26. Teamfight Manager — top-rated positive Steam reviews. https://steamcommunity.com/app/1372810/positivereviews/?browsefilter=toprated&filterLanguage=english
27. Gideon's Gaming — "Team Fight Manager review: needs a little coaching" (2021). https://gideonsgaming.com/team-fight-manager-review-needs-a-little-coaching
28. Teamfight Manager 2 — Steam store page. https://store.steampowered.com/app/3009300/Teamfight_Manager_2/
29. Teamfight Manager 2 — top-rated negative Steam reviews. https://steamcommunity.com/app/3009300/negativereviews/?browsefilter=toprated&filterLanguage=english
30. Teamfight Manager 2 — top-rated positive Steam reviews. https://steamcommunity.com/app/3009300/positivereviews/?browsefilter=toprated&filterLanguage=english
31. Vaporlens — Teamfight Manager 2 review analysis (aggregate, third-party). https://vaporlens.app/app/3009300/teamfight_manager_2.md
32. Battle Brothers — Steam store page. https://store.steampowered.com/app/365360/Battle_Brothers/
33. Battle Brothers — top-rated negative Steam reviews. https://steamcommunity.com/app/365360/negativereviews/?browsefilter=toprated&filterLanguage=english
34. Battle Brothers — top-rated positive Steam reviews. https://steamcommunity.com/app/365360/positivereviews/?browsefilter=toprated&filterLanguage=english
35. KeenGamer — Battle Brothers review. https://www.keengamer.com/articles/reviews/battle-brothers-review/
36. Gideon's Gaming — Battle Brothers Complete review. https://gideonsgaming.com/battle-brothers-complete-review/
37. Battle Brothers Developer Blog #110 "More Stuff" (2018), via GameBanshee (page returned 403; content taken from search-result summary). https://dev.gamebanshee.com/news/battle-brothers-developer-blog-110-more-stuff
38. Wikipedia — Blood Bowl 3. https://en.wikipedia.org/wiki/Blood_Bowl_3
39. Blood Bowl 3 — top-rated negative Steam reviews. https://steamcommunity.com/app/1016950/negativereviews/?browsefilter=toprated&filterLanguage=english
40. Blood Bowl 3 — most recent Steam reviews (Oct 2026). https://steamcommunity.com/app/1016950/reviews/?browsefilter=mostrecent&filterLanguage=english
41. Wikipedia — Blood Bowl 2. https://en.wikipedia.org/wiki/Blood_Bowl_2
42. Blood Bowl 2 — top-rated positive Steam reviews. https://steamcommunity.com/app/236690/positivereviews/?browsefilter=toprated&filterLanguage=english
43. Wikipedia — Blood Bowl (board game; league/progression/inducements/ageing history). https://en.wikipedia.org/wiki/Blood_Bowl
44. Gladiator Guild Manager — Steam store page. https://store.steampowered.com/app/1043260/Gladiator_Guild_Manager/
45. Gladiator Guild Manager — top-rated negative Steam reviews. https://steamcommunity.com/app/1043260/negativereviews/?browsefilter=toprated&filterLanguage=english
46. Gladiator Guild Manager — top-rated positive Steam reviews. https://steamcommunity.com/app/1043260/positivereviews/?browsefilter=toprated&filterLanguage=english
47. Wikipedia — Domina (video game). https://en.wikipedia.org/wiki/Domina_(video_game)
48. The Daily Star — "Are you not entertained?" (Domina review). https://www.thedailystar.net/shout/game-review/are-you-not-entertained-1558099
49. OpenCritic — Domina. https://opencritic.com/game/4105/Domina
50. Mordheim: City of the Damned — Steam store page. https://store.steampowered.com/app/276810/
51. Mordheim — top-rated positive Steam reviews. https://steamcommunity.com/app/276810/positivereviews/?browsefilter=toprated&filterLanguage=english
52. Mordheim — top-rated negative Steam reviews. https://steamcommunity.com/app/276810/negativereviews/?browsefilter=toprated&filterLanguage=english
53. GameBanshee — "Battle Brothers Update 1.1 Released" (June 2017). http://www.gamebanshee.com/kdarp

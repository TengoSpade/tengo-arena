# Research notes 02: The autobattler genre

**Scope.** These notes cover nine autobattlers: Teamfight Tactics, Dota Underlords, Auto Chess (the Dota 2 mod and the Drodo/Dragonest standalone), Super Auto Pets, The Bazaar, Mechabellum, Backpack Battles, Hearthstone Battlegrounds and Storybook Brawl. The goal is mechanics and design lessons for our single-player 2D arena-league game. That game has 3–5 fighters per team, gambit-style IF/THEN tactics, a deterministic headless sim, and scouting/transfer/academy management across seasons. Each game section has key facts and five points. A cross-game comparison follows, ending with a translation of lobby mechanics into a single-player league, then ranked ideas, pitfalls, open questions and numbered sources. Research was done on 25 Oct 2026. Steam review evidence comes from small samples (about 20 reviews per game: the top-rated and most-recent pages), plus Steam's aggregate score and Vaporlens, an AI-aggregated review-theme site. Treat those as directional, not statistical. My own inferences are marked "(inference)".

---

## 1. Teamfight Tactics (TFT)

**Key facts:** Riot Games, June 2019 (mobile March 2020). Live, on Set 18 "Enchanted Wilds" (26 Aug 2026), which also moved the game to Unreal Engine [1]. PC/Mac/iOS/Android with cross-play. Free-to-play, monetized through cosmetics, passes and loot eggs [1]. Mechanics evidence below spans Sets 1–2 (2019–20 dev blogs) to Sets 17–18 (shop odds), and is labelled where it matters.

**1. What makes it fun / sticky**
- Riot names three pillars: Mastery, Playful Competition and Discovery. Mastery is split into five skill domains: Knowledge, Flexibility, *Fortune* (managing variance), Perception (reading opponents) and Speed. Mechanical execution is deliberately de-emphasized [2].
- Discovery comes from set rotation. When a meta becomes "solved", a new set replaces roster and traits while core rules carry over [2]. Since Set 10 there are three full sets a year [6].
- Matches last about 30–35 minutes [6]. Augments (pick 1 of 3 run-modifiers, added in Set 6) became a defining hook [1][6].

**2. Good practices**
- Riot's stated GDC 2020 principle is "tough choices, not touch execution." They capped units on the field and made duplicates merge, so stressful bench-juggling became decisions about what to keep. The first version was built in 18 weeks [5].
- Randomness is kept "positive and controlled." Opt-in, predictable coin-flips (two-piece Imperial) were fine. Uncontrollable punishers (Phantom set an enemy to 100 HP; Hextech removed items) were the most hated traits. The item system was rebuilt for predictable-but-varied outcomes [3].
- Soft counters over hard counters. Set 1's 100% magic immunity and 100% heal block were softened (Grievous Wounds went from 100% to 80%). After Set 2 Riot said they would avoid hard counters "altogether" [3][4].
- Disables (CC) are needed as outlets for damage but must be predictable or temporary. Single-target CC that lands early "felt like a dice roll" [3][4].
- Deterministic spell targeting. In Set 2, spells that picked random targets (high-mana carries whose first cast decided the fight) caused extreme variance. Riot moved to rule-based targeting, such as "always targets the enemy with most attack speed" [4].
- Post-combat **Combat Recap** cycles damage dealt, damage taken and healing per unit (PC hotkeys added in patch 12.6, 2022) [9].
- Patch restraint. Early B-patches touched 15–20 things at once, which was too much to absorb, so later B-patches only nerf outliers [3].

**3. Features players love**
- The social/competitive feel of paired 1v1s inside an 8-player lobby, the shared "carousel" draft, and avatars [2].
- Riot wants TFT to be players' "favorite second game" and avoids pressuring daily play [6].
- Augments, and opt-in risk/reward after the Set 5 "Shadow items" misfire [6].

**4. Complaints and pitfalls**
- Onboarding. A 2025 Reddit thread (mirrored on devtrackers) complains of no tutorial, no year-round bots, and 30-second phases too short to read unit/item/augment text [13].
- Unit identification. Riot's own labs found new players struggled to match splash art to in-game models [12].
- Board clutter. Set 2 summoners (plants, minions, soldiers), invisible or no-travel-time effects, and tiny projectiles hurt clarity. Riot's fix was more visible, telegraphed spells [4].
- "Trait tax": weak units that exist only to enable traits, which narrowed comps [3].
- Hyper Roll, the fast mode, was retired in May 2025 for missing its goals [1].

**5. Ideas for our game**
- Adopt the pillars directly: Knowledge / Flexibility / Fortune / Perception / Speed map onto scouting, squad pivots, variance management, opponent scouting reports, and calendar decisions (inference).
- Make ability targeting deterministic and rule-named, e.g. "highest attack speed" or "lowest HP%". These are exactly the gambit conditions we want players to author [4].
- Ship a Combat Recap equivalent per fighter (dealt/taken/healed/CC'd), plus a gambit rule-fire count [9].

---

## 2. Dota Underlords

**Key facts:** Valve, early access 20 Jun 2019, 1.0 on 25 Feb 2020. Built on Source 2, with PC/mobile cross-play [14]. Free-to-play with an optional $4.99 cosmetic battle pass [77]. **Status: online but effectively abandoned.** There has been no official Valve statement. The last content update was Aug 2020 and the last patch Nov 2020. A Dec 2021 micro-patch only extended the battle-pass end date [15][23]. About 800 average concurrent players in mid-2026 [22]. Steam: 84% positive of 33.5k English reviews, recent 75% [21].

**1. What makes it fun / sticky**
- Players praised a cleaner, more novice-friendly take on the mod. IGN called it the easiest autobattler for newcomers, partly thanks to the UI [14].
- Recent reviews describe a relaxing "one game after work" loop and duo play with friends [21].

**2. Good practices**
- Item drops became choices: pick 1 of 3 items after creep rounds instead of random drops. Losing a loot round removes two of the three options. Season 1 added one item-choice reroll and more frequent item rounds (1, 4, 8, 12…) [18].
- Mode spread: Knockout for 10–15 minute games, Duos, offline bots, a single-player City Crawl with puzzle challenges, plus replays and ranked [14][19][77].
- **Streak economics were patched against exploits.** "Open forting" meant deliberately losing early with an empty board to farm loss-streak gold. Valve capped loss-streak gold at 2 and reset win streaks after 8 [17].

**3. Features players love**
- Cross-play between mobile and PC [19].
- Stability is now a perverse positive: knowledge never goes stale and there is no time-limited pass pressure [15].
- A June 2019 review captured the genre's emotional asymmetry: "When you lose, it's clearly all just RNG." [21]

**4. Complaints and pitfalls**
- Abandonment and silence. Players asked for any word on the game's future [20][21].
- The 1.0 "Underlords on the board" mechanic and the UI were disliked by some. A patch that shortened games and changed drop rates also drew complaints [20].
- "Skill-less RNG" complaints [20].

**Postmortem (why it wound down).** Valve never explained, so this is assembled from evidence plus (inference):
- (a) **Distribution and competition.** TFT sat inside the League client in front of millions of players daily. Drodo's Auto Chess went to mobile and Epic. Concurrents fell about 80% (200k to about 18.7k peak) within roughly six months [16].
- (b) **Churn from monthly overhauls during early access** [16]. Valve's Adrian Finol had said the team "finally killed Valve Time" by building fast [78].
- (c) **Content stall.** Season One ran more than a year past expectations [19].
- (d) **No communication** [20].

**Lessons:**
- Stability and clear communication beat constant overhauls.
- Don't rely on live-service cadence for retention (inference).
- A game with stable rules keeps a loyal core even when frozen [15], which suits a single-player release.

**5. Ideas for our game**
- 1-of-3 choices with one reroll for loot, recruits and staff [18].
- A puzzle-challenge mode ("win this fight with these 3 fighters by editing gambits only"), modeled on City Crawl [19].
- Any catch-up money must be capped so that losing on purpose is never optimal [17].

---

## 3. Auto Chess (Dota 2 mod and Drodo/Dragonest standalone)

**Key facts:** Drodo Studio, a team of a handful of people. The mod launched 4 Jan 2019 and drew on Mahjong and the Warcraft III "Pokemon Defense" map [24][25]. Standalone: Android Apr 2019, iOS May 2019, Epic Jul 2019, PS4 Dec 2020, Steam 7 Dec 2022 (published under Dragonest/Chengdu Longyuan) [24][26]. Free-to-play with IAP. **Live** (Steam reviews still arriving in Oct 2026). Steam rating "Mixed", 65% of 1,025 [26][27].

**1. What makes it fun / sticky**
- It invented the genre. The mod passed 7 million installs in about three months, growing by more than 80k per day, and 8 million by May 2019 [24][25].
- Drodo credited a calm pace with downtime, layered strategy and replayability. It drew Hearthstone and CS:GO players, not just Dota players [25].

**2. Good practices**
- The founding vocabulary:
  - A shared piece pool, so contested synergies are harder to complete.
  - 3 copies merge into 1 stronger piece.
  - Race/class synergies with tiered breakpoints.
  - Interest on banked gold, streak bonuses.
  - Courier level = maximum units on board.
  - Creep rounds for items [24][28].
- Ranked "insurance cards" mean one bad game costs no rank points (paid with in-game currency) [27].

**3. Features players love**
- "The OG" nostalgia.
- Team battles with friends.
- A recent ex-TFT player liked its lower RNG, fast loads and fewer drastic season changes [27].

**4. Complaints and pitfalls**
- Roster bloat lengthened matches. With about 60 heroes, games passed 40 minutes, so Drodo removed three unpopular heroes [25].
- Queue times were the top 2019 complaint [25].
- The standalone suffers from:
  - Mobile UX ported unchanged to PC, plus PC graphics bugs [27].
  - Convoluted multi-currency cosmetics economies [27].
  - Cheaters [27].
  - Loud audio by default and intrusive pop-ups [27].
  - Unclear art direction [27].

**5. Ideas for our game**
- Keep the active fighter roster per season small, so fights stay legible and seasons stay short [25].
- Design PC-native UI first (hover tooltips, drag-and-drop, keyboard shortcuts), not a mobile port [27].
- A "bad match insurance" analog: one consumable per season that voids a loss's morale or finance penalty (inference, adapted from [27]).

---

## 4. Super Auto Pets (SAP)

**Key facts:** Team Wood Games, Steam 24 Sep 2021, mobile Feb 2022, plus browser [29]. Free-to-play with paid packs [32]. Live. Steam: 91% positive of 25k English, recent 88% [32]. It rose to fame through streamers [29].

**1. What makes it fun / sticky**
- A tiny ruleset with deep emergent interactions [29][30]:
  - 10 gold per turn; pets and food cost 3; rerolls cost 1; freeze lets you keep an offer.
  - Team of 5 in a line.
  - Merge duplicates up to level 3.
  - Shop tier rises every 2 turns, up to tier 6 by turn 11.
- Arena is a mini-roguelike: 10 wins before losing 5 lives, with one life restored on turn 3, async and with **no timer** [30][32].
- The weekly random pack brings players back every Monday [32][34].

**2. Good practices**
- Fully legible combat [30][31]:
  - The front pets trade blows simultaneously; when one faints, the next steps up.
  - Only Attack and Health exist.
  - Abilities key off a small trigger vocabulary (Start of Battle, Faint, Hurt, Start of Turn…).
  - Start-of-battle effects resolve in attack order, highest first.
- Asynchronous opponents are other players' saved teams, with AI teams when none are available [29].
- Packs were separated in matchmaking so paid content didn't face free players [33].

**3. Features players love**
- Its simple yet strategic design, cute presentation, fun with friends, and weekly variety [34].
- "Easy to understand, hard to master" recurs in recent reviews [35].

**4. Complaints and pitfalls**
- Monetizing gameplay content (pets in paid packs) generated pay-to-win complaints, the top negative theme in aggregated reviews [33][34].
- Luck reliance and matchmaking unfairness come next [34].

**5. Ideas for our game**
- SAP's trigger vocabulary is our gambit condition vocabulary. "On ally down", "On hurt", "At round start", "When HP < X%" are proven to be readable at a glance [31].
- Add a "Cup run" mode or cup format: N wins before K losses, no timer [30].
- For 3–5 fighter rosters, SAP shows that **order and adjacency alone** can carry synergy depth without large trait sets (inference from [30]).

---

## 5. The Bazaar

**Key facts:** Tempo (founded by Hearthstone pro and streamer Andrey "Reynad" Yanyuk), first announced 2018 [45]. Closed beta 2024, open beta on Tempo's launcher March 2025, Steam 13 Aug 2025 [36][43]. Business model has changed repeatedly:
- Free-to-play with a paid monthly card pass (open beta) [38].
- Then premium: $39.99, cut to $19.99 with heroes as $19.99 DLC (Sep 2025) [37].
- On 15 Oct 2026 Tempo announced the game will be free to download with one hero free, a one-time $29.99 unlock for all heroes, and mobile launch end of Oct 2026 [39]. The Steam page still showed $19.99 plus DLC heroes on 25 Oct 2026 [36].
- Steam: 78% of 6.3k English reviews, recent 56% "Mixed" [36].

**1. What makes it fun / sticky**
- A roguelike "hero builder". Each in-game day has hourly choices (vendor/event hours, a PvE fight, then a PvP fight), and you gain XP every hour [41].
- Prestige works as run health (20 at start), and the goal is 10 PvP wins [41].
- Items charge on cooldowns and fire automatically. Timing manipulation is the combat language: Haste, Slow, Freeze, Charge, Ammo [41].
- Players praise polish and production (the top Vaporlens theme), build variety, and voiced merchants that give the world personality [42][43].

**2. Good practices**
- **Async with low pressure.** Players fight "ghost" snapshots and can take as long as they like. One review credits async for being able to analyze "as much or as little" as desired [43].
- Matchmaking only against ghosts of equal or lower rank, to ease new players [37].
- Item sizes (small/medium/large) make board space a resource [41].

**3. Features players love**
- High replayability, flexible async, and depth. One review title says "every choice can make or break a run" [42][43].
- The rarity of build-around items makes a hit feel special [43].

**4. Complaints and pitfalls**
- **Monetization flip-flops and paid power.**
  - Cards were gated behind a $10/month pass, which broke a promise that the game would be neither pay-to-win nor pay-to-play [38][40].
  - Heroes became DLC, and some reviewers feel new heroes launch stronger to sell [43].
- **Communication.** Reviews accuse the team of banning critics and of a CEO insulting players [43].
- **Balance.** New hero expansions dominated, then were heavily nerfed. One hero showed about 50% pick rate [43].
- The need for replays is unmet in-game: a third-party tracker offers tick-by-tick fight replays [44].

**5. Ideas for our game**
- A **day/hour season calendar**. Each week offers choices (scout trip, training camp, rest, friendly, merchant) before a fixed match day. This is the Bazaar loop mapped onto a league week [41] (inference).
- Model status effects as **timer manipulation** (haste/slow/freeze of ability cooldowns). Timers make readable, sim-friendly effects, and gambits can react to them, e.g. "IF ally frozen THEN cleanse" [41].
- Price once, include everything, and never sell power (lesson from [37][38][39]).

---

## 6. Mechabellum

**Key facts:** Game River (China), early access 11 May 2023, 1.0 on 26 Sep 2024. Publisher changed from Paradox to Dreamhaven in Mar 2025 [46][48]. "2.0" launched 22 Sep 2026 with a Free Edition and the solo/co-op roguelite "Star Expedition" [53]. Paid ($15 standard) plus a Free Edition and cosmetics [48][53]. Steam: 84% of 10k English reviews, recent 71% [47].

**1. What makes it fun / sticky**
- "RTS depth without APM" [48]:
  - Buy units with supply, place them, then watch.
  - Placed units persist and keep their positions across rounds.
  - Units level up, unspent supply carries over [49][50][55].
- Matches usually take about 15 minutes. Reviewers repeatedly call it the strategy game for people "too old" for twitch play, and say a loss feels like being outplayed, not cheated [55].

**2. Good practices**
- **Near-full information.** You see the opponent's army, upgrades and bonuses, and both players get the same card offers each round [49][52]. Strategy lives in the counter-placement read.
- A clear role triangle: chaff (cheap bodies that absorb fire), chaff-clear (wipes swarms), carry. Anti-air answers flyers that bypass ground blocking [49].
- Replays. Any match can be saved, rewound, and rounds re-played to test alternatives [48][52].
- Players can choose reinforcements, or decline one for 50 supply [50].

**3. Features players love**
- Low stress, which includes playing vs bots: one reviewer preferred bots to people [55].
- Variety of units, active development, and a non-predatory model [54].
- The new single-player Expedition got a strong reception [52][55].

**4. Complaints and pitfalls**
- **Targeting frustration.** Big units waste shots on chaff while enemy killers roam free, and players want a target-priority option [52]. Game River answered unit by unit with techs such as Steel Ball's "Heavy Target", which locks onto the highest-HP unit in range. Players then argued over counterplay [51].
- Poor teaching of strategic thinking, and unit stats hidden until purchase [52].
- Other complaints: no undo for misclicks [55], lackluster buildings (the top negative theme), performance, and matchmaking [54].
- Expedition balance [55].

**5. Ideas for our game**
- Our gambits directly solve Mechabellum's #1 behavior complaint. "IF enemy in range with highest threat THEN target" is a player-authored Heavy Target. Price strong targeting as a cost (range, cooldown), not a free toggle [51][52].
- **Matches as multi-round series**: a best-of rounds structure where you can edit gambits and positions between rounds after seeing what happened. This gives our league match the same adapt-and-counter inner loop (inference from [49]).
- Deterministic replay plus "re-sim this round with my edited tactics" as a learning tool. Our deterministic sim makes this cheap (inference from [52]).
- Undo for all management actions until confirm [55].

---

## 7. Backpack Battles

**Key facts:** PlayWithFurcifer with publisher IndieArk, built in Godot. Demo June 2023, early access 8 Mar 2024, 1.0 on 13 Jun 2025 [56]. Premium $14.99, no microtransactions [57][61]. It sold about 640k in the first month: 500k in two weeks, 48% from China, and about 35% via bundles with Slay the Spire and Brotato [58]. Steam: 92% of 5.6k English reviews, recent 78% [57].

**1. What makes it fun / sticky**
- A spatial puzzle shop. Items have shapes and **adjacency** effects (e.g. a pan is stronger next to food), and recipes combine neighbors [56].
- Fights last 10–20 seconds, with items triggering on timers [56]. The win condition is 10 wins before 5 losses [56].
- Players love the "rotate the banana to fit" moment and how addictive it is [62].

**2. Good practices**
- Super Auto Pets was the main inspiration, by the developers' own account [59].
- A long-running free demo (38 content patches, about 19k peak concurrents) built the community before launch [58].
- Mode spread: unranked with no timers, ranked, custom rules, and live lobbies [57].
- Breadth: 7 classes × 5 subclasses and more than 500 items [57].

**3. Features players love**
- Build variety, crafting depth, quick matches, fair monetization, and frequent updates [61].

**4. Complaints and pitfalls**
- **"Rigged" matchmaking perception** is the top negative theme cluster (about 0.18 broken matchmaking, 0.15 ranked feels rigged) [61].
- A 2026 review claims opponents are selected to counter you [62].
- The developer's 2024 reply to a ranked complaint was that opponents get stronger at higher rank: lose to drop down, or play unranked [60].
- RNG and luck dominance (about 0.14) [61].
- Async integrity: "cheat builds" made with unlimited shop rerolls [62].
- Stale meta and a small item pool early on (IGN 6/10) [56][62].

**5. Ideas for our game**
- Formation adjacency synergies (e.g. a shieldbearer buffs the fighter directly behind it), which give spatial depth to a 3–5 fighter lineup [56].
- Because AI-picked opponents can feel rigged, publish fixtures in advance and show AI clubs' styles. Never choose opponents reactively against the player's build [60][61].
- Keep individual fights short at 1x (inference from [56]).

---

## 8. Hearthstone Battlegrounds (HSBG)

**Key facts:** Blizzard. The prototype came from a Tavern Brawl designer, and open beta started Nov 2019 [64]. Inside Hearthstone (PC/mobile). Free, with a paid Season Pass that grants +2 hero choices [69]. Live. Duos launched Apr 2024 [70]. Evidence below is from Season 7 to Season 9+ era wiki pages and an Apr 2026 dev post.

**1. What makes it fun / sticky**
- Low-stakes battle-royale losses mean wins feel good without losses stinging. Blizzard built it as a long-term onboarding funnel, not for short-term revenue [64].
- Very simple economy [63]:
  - 3 gold rising to 10 per turn, with no carry-over.
  - All minions cost 3; refresh costs 1; selling returns 1.
  - Tavern tier upgrades get 1 cheaper each turn you wait.
  - Triples give a golden minion plus a "discover" from the next tier.
  - Freeze holds your shop.

**2. Good practices**
- Readable combat [63]:
  - Attacks go left to right, alternating sides.
  - Targets are random except that Taunt must be hit first.
  - The side with more minions attacks first.
  - Damage to the loser = tavern tier + surviving minions' tiers.
- **Hero-balancing armor.** Since Nov 2021, weaker heroes start with more armor, now fixed values of 5–20 [65].
- **Anomalies.** A random rule-modifier per game, which also changes the available minion types, refreshes the meta [71].
- **Offer rules that guarantee relevance** (trinkets, Apr 2026) [66]:
  - You count as "in" a tribe at 2 of that type by turn 6 or 3 by turn 9.
  - Every offer includes one item for your main tribe, one generic item, and at least one cheap option.
  - The designers' goal is that it should "just work" without players learning the rules.
- Animation speedups. Battlegrounds got faster combat pacing first. Hearthstone later cut trigger resolution from 0.8 s to 0.2 s to match that cadence [68].

**3. Features players love**
- Social 8-player play [64], Duos co-op [70], and constant novelty from anomalies and season rotations [71].

**4. Complaints and pitfalls**
- **Paid hero choice.** Extra hero options are exclusive to the paid pass and can't be bought with gold, which drew pay-to-win criticism [69].
- **Combat duration.** Long combat animations eat into the next buy phase. Lobbies sometimes wait 3+ minutes on slow builds. Players proposed a hard combat cap (about 60 s) that compresses animations [67].
- Random targeting means some fights hinge on coin-flips (inference from [63]).

**5. Ideas for our game**
- Armor-style handicaps for difficulty and AI club strength in lower tiers (inference from [65]).
- **Season "anomalies"**: one league-wide rule per season (e.g. "healing −30%", "arena hazards on", "first ability free") so meta shifts without patches [71].
- Relevance-guaranteed offer rules for scouting reports and recruit lists, e.g. at least one prospect who fits your current archetype per report [66].
- Fight duration cap plus overtime ramp. The headless sim gives AI-vs-AI results instantly; the player's fights respect a time budget [67] (inference).

---

## 9. Storybook Brawl (SBB)

**Key facts:** Good Luck Games (founded by four ex-Magic pros), early access 18 Jun 2021, Windows [72]. Free-to-play [76]. The studio had seven staff in Aug 2021 [72]. Acquired by FTX on 22 Mar 2022 with NFT plans [72]. **Shut down 1 May 2023** after FTX's bankruptcy [72][73]. The studio said "there is no path forward" [73]. The planned world championship was cancelled in Nov 2022 [73]. Peak 2,770 concurrents in Sep 2021; average players fell 59% after the acquisition [73].

**1. What makes it fun / sticky**
- A cleaner, card-based Battlegrounds-like that removes much of the "what's going on?" curve, according to a 901-hour reviewer [75].
- Two rows (4 front, 3 back) add positioning depth. Screen Rant liked its depth and variety [72][74].

**2. Good practices**
- **Auto-leveling.** Tier can't be bought: you gain 1 XP per turn and level every 3 XP. This removes rushing and stalling [74].
- Tripling gives a choice of 3 treasures rather than a unit [74].
- Positional roles [74]:
  - Ranged units deal damage without taking return damage.
  - Ranged and flying units can hit the back row.
  - Supports buff the units in front of them.
- Damage is capped at 27, which makes greedier play viable [74].

**3. Features players love**
- Depth, a responsive developer, and an evolving meta before the acquisition [75].
- Faster games than HSBG [74].

**4. Complaints and pitfalls**
- PC Gamer found it "crowded", with many random elements making games swing [72].
- Little information about opponents outside combat [74].
- **Postmortem (fact plus inference).** The game died of ownership, not design.
  - The FTX deal and NFT plans triggered a review-bomb from "Mostly Positive" to "Overwhelmingly Negative" and player loss [72][75].
  - The parent's collapse then killed the servers [73].
  - Lessons: servers make a game mortal; trust collapses when monetization or ownership conflicts with player values; small studios are fragile (inference).

**5. Ideas for our game**
- Front/back rows with role rules (melee blocked by the front row, ranged/flying can reach the back) suit 3–5 fighter formations [74].
- Treasure-on-milestone: when a fighter hits a development milestone, offer 1 of 3 perks [74] (inference: adapted).
- Offline-first: AI clubs simulated locally mean the game can't be "shut down" (inference from [73]).

---

## Cross-game comparison

### Unit AI and targeting (and player control)

| Game | Default targeting / movement | Player control over behavior |
|---|---|---|
| TFT | Closest enemy in range, otherwise move toward one. Assassins (early sets) leap to the farthest target. Trait or spell rules override this, e.g. Hacker (13.8) changed to "closest" instead of back-row preference [10][11] | Placement plus items only. Riot moved spells from random to rule-based targets [4] |
| Underlords / Auto Chess | Dota-style melee/ranged auto-attack and cast on full mana (inference: same lineage as [24]) | Placement only |
| HSBG | Strict left-to-right attack order. Random target except Taunt [63] | Order only |
| SAP | Front unit vs front unit, simultaneous. Start-of-battle effects in attack order [30][31] | Order only |
| SBB | Front row fights first. Ranged/flying reach the back row. Supports buff ahead [74] | Row + order |
| Mechabellum | Units engage what they meet; chaff exploits this by absorbing fire [49] | Placement + techs (e.g. Heavy Target = highest-HP lock-on) [51] |
| Backpack / Bazaar | No spatial targeting. Items fire on cooldowns, and effects manipulate timers [41][56] | Item layout/adjacency |

**Takeaways:**
- No mainstream autobattler gives per-unit IF/THEN control. Our gambits are a genuine differentiator (inference).
- The genre's lesson is that targeting must be **deterministic and nameable**. Random targeting was Riot's biggest source of variance [4].
- "Wasted shots on chaff" is the most common behavior complaint where control is absent [52].
- Make "nearest valid enemy in range" the default, with tie-break rules documented, and expose overrides as gambit conditions with costs [51].

### Readability of fights
- **Clutter sources to avoid:** summons and pets, invisible or no-travel-time effects, fast blink units, tiny projectiles [4]. Low-contrast art direction (Auto Chess standalone) [27]. Unit models that are hard to match to their portraits [12].
- **Telegraphing:** Riot called out spells with clear anticipation and impact as more satisfying [4]. Predictable CC is tolerated; surprise lockouts are not [3].
- **Explaining outcomes:**
  - TFT's Combat Recap (dealt/taken/healed) [9].
  - Mechabellum's replays with rewind and re-play rounds [52].
  - Underlords' replays [14].
  - The Bazaar has none in-game, and a third-party tick replay tool exists [44], which is evidence of demand.
- **Pacing:** Hearthstone cut trigger time 75% to match Battlegrounds' faster cadence [68], yet HSBG still gets "fights take too long" complaints [67]. Backpack fights are 10–20 s [56].
- **For us:** a speed toggle plus a duration cap plus a recap screen that answers "why did we lose?" Show which gambit fired, the target chosen, and damage by source (inference).

### Synergies / traits / tribes
- Breakpoint traits (TFT, Auto Chess) [3][24].
- Tribes with targeted offers (HSBG) [66].
- Ability-trigger combos with no tribes (SAP) [31].
- Adjacency and recipes (Backpack) [56].
- Item tags and hero pools (Bazaar) [41].
- Counters and tech in place of traits (Mechabellum) [49].
- Rows plus treasures (SBB) [74].
- Riot's two warnings: avoid trait tax, and keep trait interactions as soft counters [3][4].
- **For 3–5 fighters:** large breakpoints (6/9) are impossible. Use 2–3-piece tags, pair chemistry, adjacency and gambit combos, as SAP and Backpack prove small-board depth [30][56] (inference).

### Economy

| Game | Income | Saving | Streaks | Refresh | Scaling |
|---|---|---|---|---|---|
| TFT | 5/round base after early rounds [7] | +1 per 10 banked, max +5 [7] | Win/loss streak bonus up to +3 (values vary by patch) [7] | Reroll shop | Buy XP. Level odds, e.g. Set 18 level 8 = 30% 4-cost [8] |
| Underlords | Gold per round | Interest (one update cut max interest from 5 to 3, per a player review [21]) | Loss-streak gold capped at 2 to stop "open forting" [17] | Reroll | XP levels |
| HSBG | 3 rising to 10, no carry-over [63] | None | None | 1 gold | Tavern tier, 1 cheaper per turn waited [63] |
| SAP | 10 flat [30] | None | None | 1 gold, freeze | Time-gated tiers [30] |
| SBB | Gold per turn | None | None | Reroll | Auto XP, no buying [74] |
| Mechabellum | Supply per round | Unspent supply carries over [50] | None | Card offers | Unit unlocks / levels [49] |

- **Pattern:** "greed vs tempo" (TFT interest, Mechabellum carry-over, HSBG waiting for cheaper upgrades) is the genre's core economic tension. Every catch-up mechanic eventually gets exploited and capped [17] (inference).

### Progression (in-run vs meta)
- Lobby games keep power **in-run only**, with meta progression cosmetic: TFT passes [1], Underlords pass [19], HSBG (except paid hero choice) [69].
- Exceptions:
  - Mechabellum's Tech Points and hangar unlocks [47][53].
  - Expedition rewards that carry into later runs [53].
  - Paid heroes and packs in the Bazaar and SAP, the most-criticized pattern [34][43].
- **For us:** the club *is* the meta progression (roster, facilities, reputation across seasons). Power gain is legitimate when earned in-world, never bought (inference).

### Randomness vs skill
- Tools that work [2][3][18][49][63][66]:
  - Opt-in or predictable randomness.
  - Choice-of-3 offers.
  - Rerolls and freeze.
  - Visible odds tables.
  - Full opponent information.
  - Relevance-guaranteed offers.
  - Soft counters.
- Failure modes [3][4][61][62]:
  - Random punishers.
  - Random spell targets.
  - Ranked matchmaking that feels rigged.
  - Unlimited-reroll cheating in async.
- A season of many matches averages variance; cups concentrate it (inference).

### Match length and fight length
- Full match lengths:
  - TFT about 30–35 min [6].
  - Auto Chess over 40 min with a 60-hero pool [25].
  - Underlords Knockout 10–15 min [19].
  - Mechabellum about 15 min [55].
- HSBG recruit phase 60 s, rising 15 s per round to 120 s [63].
- Fights: Backpack 10–20 s [56]; HSBG combats can stall lobbies for minutes [67].
- **For us:** a single fight should be about 20–45 s at 1x, and a full matchday (including adjustments) about 5–10 min (inference).

### Spectating and replays
- Replays in Mechabellum [48][52] and Underlords [14]. TFT recap stats [9].
- The Bazaar lacks in-game replays [44]. The sources here did not document SAP or Backpack Battles replay features.
- Determinism makes replays nearly free: store seed plus inputs (inference).

### Async PvP vs live
- Async with no timer is the most beloved low-stress format: SAP Arena [32], Backpack unranked [57], the Bazaar [43], Mechabellum's new Expedition [53].
- Live play is kept for friends' lobbies [32][57].
- Async problems: rigged-matchmaking perception [61], ghost-build cheating [62], and rank-ladder friction [37][60].
- Several reviewers explicitly prefer bots [55]. That is a supportive signal for a single-player league (inference).

### Translation to a single-player league

| Lobby mechanic | League analog for our game | Guardrail |
|---|---|---|
| Interest on banked gold (TFT) [7] | Season-end **reserve dividend** (e.g. +1% of cash per 10% reserve, capped), plus **facility investments** (academy, scouting HQ, medical) that pay over seasons. This is the tempo-vs-greed choice: buy a veteran now or invest | Wages and contract inflation make hoarding costly; the dividend is capped (inference) |
| Win streaks [7] | Momentum: gate/sponsor bonuses, fan mood, morale buffs that decay | Effects are small; never decisive in-fight |
| Loss streaks / comeback gold [7][17] | **Parachute payments** on relegation, an underdog prize pot, cheaper loans | Capped; never larger than the reward for winning, so tanking ("open forting") is never optimal [17] |
| Carousel, lowest HP picks first [1] | **Youth intake draft / free-agent day** in reverse-standings order | Pick order is visible in advance |
| Shop reroll (1 gold) [30][63] | **Scout assignments**: scout-days per region refresh the visible prospect pool | Limited scout time is the reroll currency |
| Freeze (SAP/HSBG) [30][63] | **Shortlist/option**: pay a small fee to hold a prospect through the window | Expires |
| Shop odds by level [8] | Scouting network level, region and tier set the odds of seeing high-potential players, shown as an odds table | Odds are always visible |
| Shared pool, contested synergies [24] | AI clubs shortlist the same targets; "3 clubs interested" pushes prices up | AI never targets the player reactively [60] |
| Player level = units on board [24] | Team size by tier (3v3 lower leagues to 5v5 top) or matchday slots by facility level | Open question |
| Augments (1 of 3) [1] | Season-start **club strategy / owner mandate / staff hire** from 3 | Guarantee one relevant option [66] |
| Items / components [5] | Equipment slots with crafting | Soft counters only [3] |
| Star-ups via duplicates [24] | Training XP, academy loans, position familiarity; levels persist like Mechabellum units [49] | |
| PvE creep rounds [24] | Preseason friendlies / monster exhibitions for XP and loot | |
| HP and elimination | League points, relegation zones; cups as single-elimination or "N wins before K losses" runs [30] | |
| Hero powers and armor [65] | Manager archetypes; difficulty via armor-like handicaps for AI clubs | |
| Sets / anomalies [2][71] | **Season modifiers**, plus leagues with distinct house rules | Announced at season start |
| Ghost opponents [32][43] | AI clubs with persistent, scoutable tactical identities, which players can study as they would study a ghost | |

**How synergies map onto a fixed 3–5 fighter roster bought on a market.**
- In lobby games, synergy completion is a 30-minute puzzle against shop RNG. In our game the puzzle stretches across transfer windows and seasons.
- Recommendations (inference):
  1. Low breakpoints (2 and 3) on 1–2 tags per fighter.
  2. Pair chemistry links that grow with time played together.
  3. Formation adjacency and row rules [56][74].
  4. Gambit combos, e.g. a Taunt fighter plus an "IF ally taunting THEN attack lowest-HP enemy" assassin.
- A squad of 8–12 with 3–5 starters recreates TFT's bench, letting you swap lineups per opponent without the juggling stress [5].

**Inner loop.** Make a league match a short series of rounds. You see the result plus the recap, edit gambits and positions, and play the next round. This preserves the autobattler "adapt after each fight" loop inside one fixture [49][9] (inference).

---

## Top ideas for our game (ranked)

1. **Deterministic, named targeting plus a "why" log.** Default "nearest valid enemy in range" with documented tie-breaks, and every targeting change attributable to a gambit. Random targeting was Riot's top variance problem. (TFT [4])
2. **Post-fight recap per fighter**: dealt/taken/healed, CC applied, and gambit rule-fire counts. It answers "why did we lose?" and teaches gambit authoring. (TFT [9])
3. **Multi-round matches with between-round tactic edits.** This keeps the genre's adapt-and-counter loop inside a league fixture. (Mechabellum [49], TFT rounds [1])
4. **Pre-match scouting report of the opponent's last formation and gambits** (fuzzed by scout quality). Full information made Mechabellum losses feel fair. (Mechabellum [52][55])
5. **Gambit conditions drawn from proven trigger vocabularies**: round start, on hurt, on ally down, HP thresholds, "highest HP in range". (SAP [31], Mechabellum Heavy Target [51])
6. **Replay plus "re-sim with edited tactics."** This is cheap with a deterministic sim and a powerful learning and debugging tool. (Mechabellum [52], Bazaar tracker demand [44])
7. **Tempo-vs-greed economy**: capped reserve dividend and long-yield facility investments in place of interest. (TFT [7], Mechabellum carry-over [50])
8. **Choice-of-3 offers with one reroll and relevance guarantees** for recruits, staff, perks and loot. (Underlords [18], HSBG trinkets [66])
9. **Soft-counter archetypes and limited, predictable CC.** No 100% immunities. (TFT [3][4])
10. **Season modifiers ("anomalies")** to refresh the meta each season without patches. (HSBG [71], TFT sets [2])
11. **Row and adjacency formation rules** for depth in 3–5 slots. (SBB [74], Backpack [56])
12. **Reverse-standings youth draft and capped parachute payments** as catch-up that can't be gamed. (TFT carousel [1], Underlords streak cap [17])
13. **No-timer planning; pressure comes from the calendar, not the clock.** (SAP [32], Backpack [57], Mechabellum Expedition [53]; TFT onboarding complaint [13])
14. **A Bazaar-style weekly calendar of choices** (scout, train, rest, friendly, market) before match day. (Bazaar [41])
15. **A puzzle-challenge mode** ("win this fight by editing gambits only") for onboarding and mastery. (Underlords City Crawl [19])

## Pitfalls to avoid (ranked)

1. **Selling power or flip-flopping on monetization.** It drove the Bazaar's top negative theme (0.53) [42], HSBG's pay-to-win anger over paid hero choice [69], and SAP's pack complaints [34].
2. **Uncontrolled randomness deciding fights**: random punishers, random spell targets, luck-dominance complaints. Evidence: [3][4][61][72].
3. **Hard counters and lockout CC**: 100% immunities and long, unpredictable disables [3][4].
4. **Visual clutter and unreadable effects**: summons, invisible hits, fast blinkers, unclear art [4][12][27].
5. **Exploitable catch-up**: "open forting" and tanking [17].
6. **Opponent selection that feels rigged.** Backpack's top complaint [61][62]. In a league, fixtures must be fixed and AI must never counter-build reactively.
7. **Abandonment and silence**: Underlords [15][20], the Bazaar's communication [43].
8. **Too many sweeping changes at once**: Underlords' early-access churn [16], TFT B-patches with 15–20 changes [3], season-change whiplash [27]. Protect save compatibility and keep the core sim stable (inference).
9. **Weak onboarding and time pressure**: TFT's lack of a tutorial or bots and its 30 s phases [13]; Mechabellum not teaching strategy and hiding stats until purchase [52].
10. **Fight and match bloat**: Auto Chess past 40 min [25], HSBG combat stalls [67].
11. **Trait tax**: units that exist only as synergy enablers [3].
12. **No undo for costly management misclicks** [55].
13. **Mobile-port UX on PC, loud default audio, intrusive pop-ups** [27][55].
14. **Server dependence and ownership risk.** SBB's shutdown and NFT review-bomb [72][73]. Being offline-first avoids it (inference).

## Open questions for the designer

1. Does team size scale with tier (3v3 lower leagues to 5v5 top flight), as the analog of TFT's "level = units on board"? Or is it fixed?
2. How much behavior is innate (e.g. assassins leap to the backline) versus authored via gambits? What is the price of strong targeting overrides (gambit slots, cooldowns, range penalties)?
3. Match format: a single fight, or a best-of-3/5 round series with between-round edits?
4. How much in-fight randomness (crit/dodge/proc) is allowed versus fully deterministic per seed, given that fights must be explainable?
5. What does scouting reveal about opponents' tactics: exact gambits, a fuzzy "style", or nothing without a scout assignment?
6. Season modifiers: rotating league-wide anomalies, permanent per-league house rules, or both?
7. Which catch-up mechanisms (reverse draft, parachute payments, loans), and what caps make tanking never optimal?
8. Is there ever an optional async "ghost club" online mode, or strictly offline?

---

## Sources

1. Teamfight Tactics, Wikipedia: https://en.wikipedia.org/wiki/Teamfight_Tactics
2. Riot, "/dev: Design Pillars of TFT" (18 Jun 2019): https://teamfighttactics.leagueoflegends.com/en-gb/news/dev/dev-design-pillars-of-tft
3. Surrender at 20, "Red Post Collection: /dev on TFT Set 1" (Oct 2019, reproduces Riot's Set 1 Learnings): https://www.surrenderat20.net/2019/10/red-post-collection-dev-on-tft-set-1.html
4. Riot (VNG mirror), "/dev: TFT Rise of the Elements Learnings" (2020): https://dtcl.vnggames.com/en-us/news/dev/dev-tft-rise-of-the-elements-learnings
5. Pocket Tactics, TFT GDC 2020 design lessons (updated Feb 2022): https://www.pockettactics.com/teamfight-tactics-design
6. GamesBeat, "Teamfight Tactics turns 7" (25 Jun 2026): https://gamesbeat.com/teamfight-tactics-turns-7-riot-games-discusses-lessons-learned-and-the-road-ahead-exclusive-interview/
7. Mobalytics, TFT economy guide (values patch-dependent): https://mobalytics.gg/blog/tft/how-to-manage-your-economy-in-teamfight-tactics-three-strategies/
8. SeeMeta, TFT Set 18 shop odds: https://seemeta.com/en/tft/set-18/odds
9. League of Legends Wiki, V12.6 (TFT) Combat Recap hotkeys (Mar 2022): https://wiki.leagueoflegends.com/en-us/V12.6_(Teamfight_Tactics)
10. Inven Global, "Understanding Assassins and Counter-Strategies" (16 Jul 2019): https://www.invenglobal.com/articles/8672/tft-guide-understanding-assassins-and-counter-strategies
11. Sportskeeda, TFT patch 13.8 notes (Hacker targeting): https://sportskeeda.com/esports/teamfight-tactics-tft-patch-13-8-official-notes-blitzcrank-nerfs-lux-buffs-hacker-reworks
12. Riot, "Splash Art Returns to Teamfight Tactics" (6 Mar 2020): https://teamfighttactics.leagueoflegends.com/en-gb/news/dev/splash-art-returns-to-teamfight-tactics/
13. devtrackers.gg mirror of r/TFT new-player thread (~2025): https://devtrackers.gg/teamfight-tactics/p/df2e092b-tft-looks-interesting-but-i-find-the-new-player-experience-too-wretched-to-endure
14. Dota Underlords, Wikipedia: https://en.wikipedia.org/wiki/Dota_Underlords
15. Destructoid, "I can't believe this abandoned Valve game still has players…" (14 Aug 2025): https://www.destructoid.com/i-cant-believe-this-abandoned-valve-game-still-has-players-and-is-fun-4-years-later/
16. PCGamesN, "Dota Underlords is struggling to keep its players" (Jan 2020): https://www.pcgamesn.com/dota-underlords/player-count-drop
17. ONE Esports, Underlords update caps win/loss streaks (6 Jul 2019): https://www.oneesports.gg/dota-underlords/dota-underlordss-latest-update-caps-winning-and-losing-streaks
18. BlueStacks, Underlords Season 1 update (item choices): https://www.bluestacks.com/blog/game-guides/dota-underlords/dotaul-season-1-update-en.html ; Esports Tales, item drop by creep wave: https://www.esportstales.com/dota-underlords/item-drop-rate-by-creep-wave
19. High Ground Gaming, Dota Underlords review (28 Aug 2020): https://www.highgroundgaming.com/dota-underlords-review/
20. Steam Community, "why Dota Underlord die?" (Mar 2021): https://steamcommunity.com/app/1046930/discussions/0/5168416410407459322
21. Steam user reviews, Dota Underlords (sampled Oct 2026): https://steamcommunity.com/app/1046930/reviews/
22. SteamBase, Dota Underlords player stats (Jul 2026): https://steambase.io/apps/1046930
23. StopGame, Valve appears to have abandoned Underlords (9 Dec 2021, Russian): https://stopgame.ru/newsdata/51189/pohozhe_valve_okonchatelno_zabrosila_podderzhku_dota_underlords
24. Dota Auto Chess, Wikipedia: https://en.wikipedia.org/wiki/Dota_Auto_Chess
25. Inven Global, "A rare glimpse behind the creation of Auto Chess" (2019): https://www.invenglobal.com/articles/7962/a-rare-glimpse-behind-the-creation-of-auto-chess
26. Steam store, Auto Chess: https://store.steampowered.com/app/1530300/Auto_Chess/
27. Steam user reviews, Auto Chess (sampled Oct 2026): https://steamcommunity.com/app/1530300/reviews/
28. PC Gamer, Dota Auto Chess guide (2019): https://pcgamer.com/dota-auto-chess-guide-combos-tactics
29. Super Auto Pets, Wikipedia: https://en.wikipedia.org/wiki/Super_Auto_Pets
30. Super Auto Pets Wiki, "The Basics": https://superautopets.wiki.gg/wiki/The_Basics
31. Super Auto Pets Wiki, "Glossary": https://superautopets.wiki.gg/wiki/Glossary
32. Steam store, Super Auto Pets: https://store.steampowered.com/app/1714040/Super_Auto_Pets/
33. Steam Community, SAP "Animal Pack" pay-to-win thread (1 Oct 2021): https://steamcommunity.com/app/1714040/discussions/0/2958293022025588185
34. Vaporlens (AI review aggregation), Super Auto Pets: https://vaporlens.app/app/1714040/super_auto_pets.md
35. Steam user reviews, Super Auto Pets (sampled Oct 2026): https://steamcommunity.com/app/1714040/reviews/
36. Steam store, The Bazaar (viewed 25 Oct 2026): https://store.steampowered.com/app/1617400/The_Bazaar/
37. The Outer Haven, "Tempo announces new pricing and update structure for The Bazaar" (3 Sep 2025): https://www.theouterhaven.net/tempo-announces-new-pricing-and-update-structure-for-the-bazaar/
38. CardGamer, "6 Reasons Why The Bazaar's Open Beta Caused An Uproar" (10 Mar 2025): https://cardgamer.com/games/digital-card-games/the-bazaar/6-reasons-why-the-bazaars-open-beta-caused-an-uproar
39. TheBazaarZone (republished Tempo Steam post), "Mobile Announcement + Future Plans" (15 Oct 2026): https://thebazaarzone.com/mobile-announcement-future-plans/
40. The Hofstra Chronicle, "Full release of The Bazaar disappoints after phenomenal open beta" (9 Apr 2025): https://thehofstrachronicle.com/104592/arts-entertainment/full-release-of-the-bazaar-disappoints-after-phenomenal-open-beta
41. Mobalytics, The Bazaar day guide and keywords (2025–26): https://mobalytics.gg/the-bazaar/guides/day-guide ; https://mobalytics.gg/the-bazaar/guides/keywords-and-terms ; item sizes: https://mobalytics.gg/the-bazaar/items-enchantments-skills
42. Vaporlens (AI review aggregation), The Bazaar: https://vaporlens.app/app/1617400/the_bazaar.md
43. Steam user reviews, The Bazaar (sampled Oct 2026): https://steamcommunity.com/app/1617400/reviews/
44. BazaarDB Tracker (third-party fight replays): https://sin.bazaardb.gg/tracker
45. The Bazaar Wiki, "The Bazaar": https://thebazaar.wiki.gg/wiki/The_Bazaar
46. Mechabellum, Wikipedia: https://en.wikipedia.org/wiki/Mechabellum
47. Steam store, Mechabellum: https://store.steampowered.com/app/669330/Mechabellum/
48. GamesBeat, "Mechabellum gets a second chance as Dreamhaven relaunches…" (25 Mar 2025): https://gamesbeat.com/mechabellum-gets-a-second-chance-as-dreamhaven-relaunches-the-mech-autobattler/
49. FinalBoss.io, Mechabellum beginner guide to roles, deployment, towers (Jul 2026): https://finalboss.io/mechabellum-beginner-guide-to-unit-roles-deployment-and
50. Gamepressure, Mechabellum tips for beginners (early access era): https://www.gamepressure.com/S013-amp.asp?ID=22125
51. Steam Community, Mechabellum Heavy Target / Steel Ball thread (2 Jun 2023): https://steamcommunity.com/app/669330/discussions/0/3833172420312842660
52. Quarter to Three forum, "Mechabellum – tactical autobattler against other people" (multi-year thread): https://forum.quartertothree.com/t/mechabellum-tactical-autobattler-against-other-people/167835
53. Turn Based Lovers, "Mechabellum 2.0 launches September 22…" (Sep 2026): https://turnbasedlovers.com/overview/mechabellum-2-0/
54. Vaporlens (AI review aggregation), Mechabellum: https://vaporlens.app/app/669330/mechabellum.md
55. Steam user reviews, Mechabellum (sampled Oct 2026): https://steamcommunity.com/app/669330/reviews/
56. Backpack Battles, Wikipedia: https://en.wikipedia.org/wiki/Backpack_Battles
57. Steam store, Backpack Battles: https://store.steampowered.com/app/2427700/Backpack_Battles/
58. Game World Observer, "Backpack Battles sales: 640k copies, China top country" (25 Apr 2024): https://gameworldobserver.com/2024/04/25/backpack-battles-sales-640k-copies-china-top-country
59. GameDiscoverCo, "How Backpack Battles sold 650k copies in its first month" (2024; seen via search, page fetch failed): https://newsletter.gamediscover.co/p/how-backpack-battles-sold-650k-copies
60. Steam Community, Backpack Battles ranked/RNG complaint with developer reply (Feb 2024): https://steamcommunity.com/app/2427700/discussions/0/4203616558110689260
61. Vaporlens (AI review aggregation), Backpack Battles: https://vaporlens.app/app/2427700/backpack_battles.md
62. Steam user reviews, Backpack Battles (sampled Oct 2026): https://steamcommunity.com/app/2427700/reviews/
63. Hearthstone Wiki, "Battlegrounds": https://hearthstone.wiki.gg/wiki/Battlegrounds
64. Game Developer, "Why the Hearthstone devs wanted to make an auto battler" (11 Nov 2019): https://gamedeveloper.com/design/why-the-i-hearthstone-i-devs-wanted-to-make-an-auto-battler
65. Hearthstone Wiki, "Battlegrounds/Armor": https://hearthstone.wiki.gg/wiki/Battlegrounds/Armor ; BlizzardWatch on the armor system (Nov 2021): https://blizzardwatch.com/2021/11/16/armor-system-hearthstone-battlegrounds/
66. Blizzard forums, "Battlegrounds Developer Insights: Updated Trinket Rules" (6 Apr 2026): https://us.forums.blizzard.com/en/hearthstone/t/158955/1
67. Blizzard forums, "Battlegrounds Animation Issues" (6 Oct 2024): https://us.forums.blizzard.com/en/hearthstone/t/battlegrounds-animation-issues/135955
68. Out of Games, Hearthstone minion trigger speeds increasing (c. 2020): https://outof.games/hearthstone/758-hearthstone-gameplay-is-going-to-be-faster-minion-trigger-speeds-increasing-by-300-in-an-upcoming-patch
69. Esports.gg, "Battlegrounds Rewards Track and Season Pass: is BG becoming pay-to-win?" (2022; seen via search, fetch blocked): https://esports.gg/news/hearthstone/hearthstone-battlegrounds-rewards-track-season-pass-is-bg-becoming-pay-to-win-with-runestones/
70. Blizzard, "Announcing Battlegrounds Season 7" (Duos, Apr 2024): https://hearthstone.blizzard.com/en-us/news/24064742/announcing-battlegrounds-season-7
71. BlizzardWatch, Battlegrounds Anomalies guide (Sep 2023): https://blizzardwatch.com/2023/09/12/anomalies-hearthstone-battlegrounds-season-5/
72. Storybook Brawl, Wikipedia: https://en.wikipedia.org/wiki/Storybook_Brawl
73. Decrypt, "FTX Acquired a Video Game That Sam Bankman-Fried Loved. Now It's Shutting Down" (25 Apr 2023): https://decrypt.co/137875/ftx-sam-bankman-fried-storybook-brawl-video-game-shutting-down
74. HSReplay, "Storybook Brawl, the perfect game for Battlegrounds players? Part 2" (23 Sep 2022): https://articles.hsreplay.net/2022/09/23/storybook-brawl-the-perfect-game-for-battlegrounds-players-2/
75. Steam user reviews, Storybook Brawl (app hub still online, sampled Oct 2026): https://steamcommunity.com/app/1367020/reviews/
76. PC Gamer, "This new free-to-play fairytale card game was designed by former Magic pros" (2021; headline seen, body not retrievable): https://www.pcgamer.com/au/this-new-free-to-play-fairytale-card-game-was-designed-by-former-magic-pros
77. Apple App Store, Dota Underlords listing (Season One, City Crawl, $4.99 battle pass copy): https://apps.apple.com/app/id1465996312
78. PCGamesN, Underlords "Valve Time" interview with Adrian Finol (Feb 2020): https://www.pcgamesn.com/dota-underlords/valve-time

# Arena League — Design Research

## 1. Scope and how to read

This document merges five sourced research-notes files into one reference for our original PC game: a single-player fantasy-mercenary league in which teams of 3–5 fighters autobattle in a real-time 2D arena on player-written IF/THEN tactics, wrapped in scouting, an academy, multi-tier leagues and club management. Eslabong is a mechanics reference only. **Part A** covers combat/management hybrids, autobattlers and player-scripted unit AI. **Part B** covers sports management and career modes. **Part C** is the synthesis: ranked must-haves, ranked pitfalls and open decisions for the owner. Sections are numbered for citation (e.g. A2.3, C1.4). Every game subsection has a key-facts line and the same five points: (1) fun/sticky, (2) practices to adopt, (3) what players love, (4) complaints and pitfalls, (5) ideas for us. Qualifiers are kept from the notes: **(inference)** marks a researcher's own reasoning, **(snippet)** / **(search result only)** marks claims resting on a search-result summary of a page that could not be opened, and review percentages and patch facts are dated snapshots (all research was done on 25 Oct 2026). Part C's rankings and recommended defaults are this document's synthesis, not sourced facts. Full detail and the original numbered citations are in the notes:

- [01 — Eslabong and combat/management hybrids](research-notes/01-eslabong-and-hybrids.md)
- [02 — Autobattlers](research-notes/02-autobattlers.md)
- [03 — Player-configurable unit AI (tactics editors)](research-notes/03-tactics-ai.md)
- [04 — Football Manager, OOTP, Hattrick](research-notes/04-football-manager-hattrick-ootp.md)
- [05 — Franchise modes and Motorsport Manager](research-notes/05-franchise-modes-and-motorsport.md)

**Terms used for our game.** *Season*: one league campaign plus its cups, ending in promotion and relegation. *Matchweek*: one in-game week, normally one fixture plus management choices. *Fixture*: a scheduled match between two clubs, league or cup. *Match*: what is played on a fixture, a best-of-N series of rounds (C3.2). *Round*: one fight within a match; tactics can be edited between rounds. *Fight* (also *bout*): the real-time combat that decides a round. Game subsections keep each game's own terms; Part C uses these.

## 2. Executive summary

1. **Ordered IF/THEN tactics are our clearest differentiator.** No mainstream autobattler gives per-unit rule lists (inference; A4.1), and Eslabong's growing pile of per-ability toggles cannot express the sequencing its players ask for ([forum](https://steamcommunity.com/app/4560660/discussions/search/?q=tactics&gidforum=0)). Every successful scripted-AI game layers the same way: working default → named presets → editable sentence rules → advanced vocabulary (A3.7).
2. **"Why did that happen?" is the genre's biggest unmet need.** Visibly dumb AI and unexplained outcomes top the complaints for Teamfight Manager 2 ([reviews](https://steamcommunity.com/app/3009300/negativereviews/?browsefilter=toprated&filterLanguage=english)), Eslabong ([reviews](https://steamcommunity.com/app/4560660/negativereviews/?browsefilter=toprated&filterLanguage=english)) and Gladiabots ([reviews](https://steamcommunity.com/app/871930/reviews/?browsefilter=toprated)). Rule badges, a paused inspector, per-fighter recaps and replays are table stakes, and cheap for a deterministic sim.
3. **Randomness must be named and bounded.** TFT's worst variance came from random spell targets ([Riot](https://dtcl.vnggames.com/en-us/news/dev/dev-tft-rise-of-the-elements-learnings)); Battle Brothers' top complaint is RNG without counterplay ([reviews](https://steamcommunity.com/app/365360/negativereviews/?browsefilter=toprated&filterLanguage=english)).
4. **One rulebook for every club.** Players read Mordheim's regenerating enemies as cheating ([reviews](https://steamcommunity.com/app/276810/negativereviews/?browsefilter=toprated&filterLanguage=english)); AI that falls behind made Motorsport Manager "seriously easy" after ~50 h ([reviews](https://steamcommunity.com/app/415200/positivereviews/?browsefilter=toprated)).
5. **Scouting is fun as orders and reveals, not clicks.** Narrowing stat ranges and knowledge % ([guide](https://www.passion4fm.com/football-manager-player-attributes/)), fixed reveal steps ([Madden](https://www.mut.gg/news/madden-nfl-22-scouting-update-deep-dive/)), certainty labels ([NHL](https://www.gameinformer.com/preview/2018/08/17/nhl-19-franchise-mode-interview-learn-the-nitty-gritty-details-about-the-new)), standing briefs that return digests ([FM26](https://www.fmscout.com/a-fm26-recruitment-revamp.html)), and imperfect AI scouting that good information can beat ([OOTP](https://www.ootpdevelopments.com/newsletters/nl0043/)).
6. **Academy stints need visible progress and an exit.** OOTP's progress bars and mid-term recall are the model, yet one reviewer found most of its programs left players with lower ratings or injured, which reads as a trap (search result only) ([review](https://www.sportsgamersonline.com/news/reviews/out-of-the-park-baseball-26-review-a-baseball-nerds-dream/)).
7. **Long saves die of flatness and friction.** Eslabong players stall after 10–15 h of repeating seasons ([forum](https://steamcommunity.com/app/4560660/discussions/0/570426530135597095/)); FM26 fell to 38% positive from FM24's 92%, mainly over UI ([reviews](https://steamcommunity.com/app/3551340/negativereviews/?browsefilter=toprated&filterLanguage=english)).
8. **Spectating needs a little agency.** Motorsport Manager's designer cut "set and watch" after a 2014 playtest, before the PC release ([interview](https://gamedeveloper.com/design/making-formula-1-accessible-with-i-motorsport-manager-i-)), but full live editing breaks parity with headless AI matches. Between-round edits plus a few timed calls is the evidence-backed middle (C3.1).
9. **Premium, offline, never sell power.** Paid power drove the top complaints for The Bazaar ([Vaporlens](https://vaporlens.app/app/1617400/the_bazaar.md)) and Super Auto Pets ([Vaporlens](https://vaporlens.app/app/1714040/super_auto_pets.md)); Storybook Brawl died with its servers ([Decrypt](https://decrypt.co/137875/ftx-sam-bankman-fried-storybook-brawl-video-game-shutting-down)).

## 3. Part A — Autobattlers and tactics AI

### A1. Eslabong and combat/management hybrids

#### A1.1 Eslabong (primary inspiration)

**Key facts:** shirowita (a solo developer in Argentina plus a contracted artist and musician); Godot; Windows/Steam Deck; Early Access since 24 Aug 2026 (planned 3–9 months); $14.99 plus free demo; **Very Positive: 94% of 1,624 all-time, 92% of 432 in the last 30 days (snapshot 25 Oct 2026)** ([store](https://store.steampowered.com/app/4560660/Eslabong/), [site](https://eslabong.com/)). Peak 1,432 concurrent, ~38.8K units (third-party estimate) ([Raijin](https://raijin.gg/app/4560660/Eslabong)). It ships several builds a week, so treat every mechanic below as a moving target ([Sep–Oct patches](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=1500)).

**Pitch and battles.** Arena combat has replaced war; you pilot one fighter or set tactics and watch, and build a mercenary club across seasons. The arena is **top-down 2D real time** with skillshots, knockbacks, summons, friendly fire and resurrection, and there are 50+ asymmetric classes and 700+ abilities ([store](https://store.steampowered.com/app/4560660/Eslabong/)). Reviewers see three roles at once (manager, coach, player); league matches are 5v5, and async PvP is autobattle-only ([reviews](https://steamcommunity.com/app/4560660/positivereviews/?browsefilter=toprated&filterLanguage=english)). You may steer one "captain" or let the team autobattle ([devblogs](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=5&maxlength=0&enddate=1777766400)). Fights run in rounds/waves, tactics can change after round 1, 1v1s hit sudden death after 60 s, and a death summary and ally orders under HP bars were added during the demo ([Apr–Aug notes](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=3000&enddate=1787961600)). Later patches added other formats (1v1 tournaments, small draft cups, an 8v8 league) and more readability aids (shields on health bars, speed controls, detailed tooltips) ([Aug–Sep patches](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=1500&enddate=1789948800), [Sep–Oct patches](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=1500)).

**Tactics (closest to our gambits).**
- *Personality* sets defaults (e.g. diver, opportunist, distance-keeper) with a base mistake chance shown on hover ([Apr–Aug notes](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=3000&enddate=1787961600), [Sep–Oct patches](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=1500)); *directives* override instincts (focus healers, guard an ally) ([devblogs](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=5&maxlength=0&enddate=1777766400)).
- *Advanced Tactics* (Aug–Oct 2026), per fighter and ability: AoE minimum targets, a four-level friendly-fire policy, preferred range, opening-move duration, skill priority, minimum ally/enemy counts, timing (open with / save / emergency only), heal thresholds, combo starter/finisher. Personality supplies each default and an explicit setting overrides it. Up to 10 saved tactics and lineups ([Apr–Aug notes](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=3000&enddate=1787961600), [Aug–Sep patches](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=1500&enddate=1789948800), [Sep–Oct patches](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=1500), [0.82.1 notes](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=4&maxlength=0&enddate=1792454400)).
- (Inference) It is a pile of toggles, not an ordered list; players ask for sequences it cannot express, such as saving one ability as a late gap-closer before two others ([forum](https://steamcommunity.com/app/4560660/discussions/search/?q=tactics&gidforum=0)).

**Management.**
- *League:* 20 teams per season (handcrafted rivals with leaders and styles, plus random teams) over 4 divisions; the top 4 go up and the lowest finishers are disbanded, flooding the market ([devblogs](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=5&maxlength=0&enddate=1777766400), [Aug–Sep patches](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=1500&enddate=1789948800)). Seasons are infinite ([Apr–Aug notes](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=3000&enddate=1787961600)). A dense calendar of cups and events, plus **season modifiers** that change combat, class, economy and lineup rules and that players can switch off ([Sep–Oct patches](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=1500)).
- *Market and scouting:* recruits, AI-club veterans, trades, auctions, loans; reputation gates classes and high-level signings ([devblogs](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=5&maxlength=0&enddate=1777766400), [Aug–Sep patches](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=1500&enddate=1789948800)). A scouting office reveals hidden stats and potential; a paid class search returns candidates next week ([Apr–Aug notes](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=3000&enddate=1787961600)). Players want to scout rival rosters ([forum](https://steamcommunity.com/app/4560660/discussions/)). (Inference) Scouting is money and capacity, not scout skill or regions.
- *Development:* partly random stat gains with a chosen boost every 3 levels; a new ability every 4 levels from 2–3 weighted options ([devblogs](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=5&maxlength=0&enddate=1777766400), [Aug–Sep patches](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=1500&enddate=1789948800)). The **Academy** is a youth league, not a send-away program: now a playable 3v3 league whose weekly objectives pay a catch-up currency ([Apr–Aug notes](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=3000&enddate=1787961600)). Benched fighters earn less XP ([thread](https://steamcommunity.com/app/4560660/discussions/0/590687538416527966/)).
- *Condition:* Form (fatigue) can be disabled ([Apr–Aug notes](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=3000&enddate=1787961600)). **Retirement** was requested repeatedly ([forum search](https://steamcommunity.com/app/4560660/discussions/search/?q=retirement&gidforum=0)). An Oct 2026 patch matched rival clubs' injury rate to the player's, and retirement arrived on 20–21 Oct 2026 as an **optional, off-by-default** setting with farewell seasons, career records and AI retirements ([Sep–Oct patches](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=1500)). No age stat is documented (unverified).
- *Economy:* gold, reputation and an endgame currency; facilities (HQ raises the roster cap 20→70); a hire-and-sell staff market ([Aug–Sep patches](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=1500&enddate=1789948800), [Sep–Oct patches](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=1500)). **Wages/contracts are unverified** ([forum search](https://steamcommunity.com/app/4560660/discussions/search/?q=salary&gidforum=0)).
- *Difficulty, meta, saves:* Easy only doubles XP and gold ([reviews](https://steamcommunity.com/app/4560660/negativereviews/?browsefilter=toprated&filterLanguage=english)); the only meta-progression is class unlocks, and the developer says the league lacks Football Manager's grounding ([forum](https://steamcommunity.com/app/4560660/discussions/0/570426530135597095/)). An async ghost tower has a normalised ladder, and a save toggle decides whether reloading rerolls outcomes ([Aug–Sep patches](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=1500&enddate=1789948800), [Sep–Oct patches](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=1500)).

**Length and reception.** No verified match length; a playtest season had ~40 matches ([Apr–Aug notes](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=3000&enddate=1787961600)), and players asked to skip rounds ([forum search](https://steamcommunity.com/app/4560660/discussions/search/?q=rounds&gidforum=0)). Players lose motivation after 10–15 h as seasons repeat ([forum](https://steamcommunity.com/app/4560660/discussions/0/570426530135597095/)). Recent negatives cite new-player difficulty, complexity and UI ([reviews](https://steamcommunity.com/app/4560660/negativereviews/?browsefilter=mostrecent&filterLanguage=english)).

1. **Fun/sticky:** the three-role fantasy and tactics tweaks that visibly swing a match ([reviews](https://steamcommunity.com/app/4560660/positivereviews/?browsefilter=toprated&filterLanguage=english)); gacha-like discovery of a rare fighter ([reviews](https://steamcommunity.com/app/4560660/reviews/?browsefilter=mostrecent&filterLanguage=english)); a churning world with something new every week ([devblogs](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=5&maxlength=0&enddate=1777766400)).
2. **Adopt:** personality defaults with explicit overrides; per-ability timing and threshold conditions ([Apr–Aug notes](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=3000&enddate=1787961600)); rivals under the player's rules and season modifiers players can opt out of ([Sep–Oct patches](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=1500), [0.82.1 notes](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=4&maxlength=0&enddate=1792454400)); draft cups that use the whole roster ([reviews](https://steamcommunity.com/app/4560660/positivereviews/?browsefilter=toprated&filterLanguage=english)); risk and potential shown at the market ([Aug–Sep patches](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=1500&enddate=1789948800)).
3. **Loved:** depth of AI tuning, class variety, draft cups, scouting and watchlists, a responsive developer, optional manual control ([reviews](https://steamcommunity.com/app/4560660/positivereviews/?browsefilter=toprated&filterLanguage=english), [reviews](https://steamcommunity.com/app/4560660/reviews/?browsefilter=mostrecent&filterLanguage=english)).
4. **Complaints:** patch churn of 3–4 patches a day mid-season; unreliable tactics (no focus fire, big heals on full-HP allies, fighters idle after casting, fights too fast to verify settings); thin early management; suspected AI-written text ([reviews](https://steamcommunity.com/app/4560660/negativereviews/?browsefilter=toprated&filterLanguage=english)). Stamina mismanagement ([thread](https://steamcommunity.com/app/4560660/discussions/0/562545740485849739/)); levels outweigh tactics ([thread](https://steamcommunity.com/app/4560660/discussions/0/590687538416527966/)); no endpoint ([forum](https://steamcommunity.com/app/4560660/discussions/0/570426530135597095/)); costs hidden in the codex ([reviews](https://steamcommunity.com/app/4560660/negativereviews/?browsefilter=mostrecent&filterLanguage=english)).
5. **Ideas for us:** personality as a *starter gambit list* (notes 01 also suggests a mistake chance; see C3.7), with the UI marking which rules it supplied; conditions lifted from the toggles (enemies in radius ≥ N, ally HP < X%, opening window, emergency, combo-primed target, friendly-fire policy); a battle trace ("rule 3 fired 14×, rule 5 never") with a post-match "why" panel; one optional side format per week; aging, retirement and injuries **on by default**, since Eslabong had to retrofit retirement.

#### A1.2 Teamfight Manager 1 and 2

**Key facts:** Team Samoyed. TFM1 (2021): 83% of 1,179 positive ([store](https://store.steampowered.com/app/1372810/Teamfight_Manager/)). TFM2: Early Access since 25 May 2026, $19.99; 73% of 814, last 30 days 80% (Oct 2026) ([store](https://store.steampowered.com/app/3009300/Teamfight_Manager_2/)).

1. **Fun/sticky:** coach an esports team without controlling matches; ~1-minute fights, first to two wins, team size growing 2v2 → 4v4 as you climb ([store](https://store.steampowered.com/app/1372810/Teamfight_Manager/), [review](https://gideonsgaming.com/team-fight-manager-review-needs-a-little-coaching)); depth in the pick/ban draft and an in-fiction patch cycle ([review](https://gideonsgaming.com/team-fight-manager-review-needs-a-little-coaching)). In TFM2 stats drive AI *decision quality*, not raw damage ([store](https://store.steampowered.com/app/3009300/Teamfight_Manager_2/)).
2. **Adopt:** short matches with a clear win condition; the in-world patch as a seasonal variety engine; player–champion mastery that creates specialists ([review](https://gideonsgaming.com/team-fight-manager-review-needs-a-little-coaching)).
3. **Loved:** drafting ([reviews](https://steamcommunity.com/app/3009300/negativereviews/?browsefilter=toprated&filterLanguage=english)); the shifting meta ([reviews](https://steamcommunity.com/app/1372810/positivereviews/?browsefilter=toprated&filterLanguage=english)); attachment to players with traits ([reviews](https://steamcommunity.com/app/3009300/positivereviews/?browsefilter=toprated&filterLanguage=english)).
4. **Complaints:** training barely matters next to recruiting; too many long games, including tournaments you are not in ([reviews](https://steamcommunity.com/app/1372810/negativereviews/?browsefilter=toprated&filterLanguage=english)). TFM2: 10+ unexplained stats and nothing showing *why* a match was lost; the AI ignoring tactics is the top theme in an aggregate analysis; a bug letting contracts silently expire ([reviews](https://steamcommunity.com/app/3009300/negativereviews/?browsefilter=toprated&filterLanguage=english), [Vaporlens](https://vaporlens.app/app/3009300/teamfight_manager_2.md)).
5. **Ideas for us:** a composure-type stat that lowers misfire or late-fire chance, attributed in the post-match panel; announced seasonal rules patches; auto-sim for matches we are not in; targetable training.

#### A1.3 Battle Brothers

**Key facts:** Overhype Studios; released 2017, $29.99; turn-based mercenary tactics on a real-time map; 89% of 15,636, recent 82% ([store](https://store.steampowered.com/app/365360/Battle_Brothers/)).

1. **Fun/sticky:** emergent stories of ~50 low-born backgrounds who become veterans or die permanently ([store](https://store.steampowered.com/app/365360/Battle_Brothers/)); attachment despite loss ([reviews](https://steamcommunity.com/app/365360/positivereviews/?browsefilter=toprated&filterLanguage=english)).
2. **Adopt:** daily wages and food ([Gideon's Gaming](https://gideonsgaming.com/battle-brothers-complete-review/)); pay set per background with a random factor, growing per level (dev blog, search summary only) ([dev blog](https://dev.gamebanshee.com/news/battle-brothers-developer-blog-110-more-stuff)); unpaid men leave; temporary versus permanent injuries ([KeenGamer](https://www.keengamer.com/articles/reviews/battle-brothers-review/)); separate difficulty sliders for economy, combat and funds ([GameBanshee](http://www.gamebanshee.com/kdarp)).
3. **Loved:** permadeath tension, backgrounds, perk trees, sandbox replay ([reviews](https://steamcommunity.com/app/365360/positivereviews/?browsefilter=toprated&filterLanguage=english)).
4. **Complaints:** RNG without counterplay, the top complaint in 7 of the 10 top negative reviews ([reviews](https://steamcommunity.com/app/365360/negativereviews/?browsefilter=toprated&filterLanguage=english)); slow rebuilding; reserves gaining no XP ([KeenGamer](https://www.keengamer.com/articles/reviews/battle-brothers-review/)); few tooltips ([Gideon's Gaming](https://gideonsgaming.com/battle-brothers-complete-review/)).
5. **Ideas for us:** wages = background × level × a hidden greed factor revealed by scouting; an injury severity ladder; bench XP via training or academy; capped swings and visible hit chances.

#### A1.4 Blood Bowl 2 and 3

**Key facts:** Cyanide; turn-based fantasy football. BB2 (2015): Metacritic 76 ([Wikipedia](https://en.wikipedia.org/wiki/Blood_Bowl_2)). BB3 (Feb 2023, after its planned Early Access was postponed indefinitely): Metacritic 60, mostly negative at launch ([Wikipedia](https://en.wikipedia.org/wiki/Blood_Bowl_3)).

1. **Fun/sticky:** persistent teams whose players gain skills while injury, death and retirement force churn ([Wikipedia](https://en.wikipedia.org/wiki/Blood_Bowl)); online leagues of one game a week ([reviews](https://steamcommunity.com/app/236690/positivereviews/?browsefilter=toprated&filterLanguage=english)).
2. **Adopt:** "inducements" give the weaker team a budget for temporary help; "spiralling expenses" curb runaway teams; team value as a balance currency ([Wikipedia](https://en.wikipedia.org/wiki/Blood_Bowl)).
3. **Loved:** long-term team identity; permanent injuries as stakes; commentary ([reviews](https://steamcommunity.com/app/236690/positivereviews/?browsefilter=toprated&filterLanguage=english)).
4. **Complaints:** BB3 shipped without BB2's league tools, with bugs, a weaker AI and monetisation called predatory ([Wikipedia](https://en.wikipedia.org/wiki/Blood_Bowl_3), [reviews](https://steamcommunity.com/app/1016950/negativereviews/?browsefilter=toprated&filterLanguage=english)); dice frustration and a poorly taught ruleset ([Wikipedia](https://en.wikipedia.org/wiki/Blood_Bowl_2)).
5. **Ideas for us:** inducement budgets for promoted or poor clubs and expense pressure on dynasties, aimed at "too easy by season 4" ([forum](https://steamcommunity.com/app/4560660/discussions/0/570426530135597095/)); a season-end ceremony; never remove tools players rely on.

#### A1.5 Gladiator Guild Manager

**Key facts:** Entertainment Forge; 1.0 June 2024 after EA from 2021; $14.99; 80% of 1,646, recent 70% ([store](https://store.steampowered.com/app/1043260/Gladiator_Guild_Manager/)).

1. **Fun/sticky:** pick, place and set behaviour, then an automatic battle; monthly championships and weekly arenas ([store](https://store.steampowered.com/app/1043260/Gladiator_Guild_Manager/)).
2. **Adopt:** time passing forces prepare-vs-earn choices; optional permadeath, which fans call the best way to play ([reviews](https://steamcommunity.com/app/1043260/positivereviews/?browsefilter=toprated&filterLanguage=english)).
3. **Loved:** rock-paper-scissors class counters, readable presentation ([reviews](https://steamcommunity.com/app/1043260/positivereviews/?browsefilter=toprated&filterLanguage=english)).
4. **Complaints:** re-placing units before every fight with no saved formations; 3–5 fighters per fight out of 8+ owned, starving XP; fighters freezing mid-fight; repetition after ~5 h; perceived abandonment ([reviews](https://steamcommunity.com/app/1043260/negativereviews/?browsefilter=toprated&filterLanguage=english)); quick revives remove stakes ([reviews](https://steamcommunity.com/app/1043260/positivereviews/?browsefilter=toprated&filterLanguage=english)).
5. **Ideas for us:** saved formations and gambit sets per opponent archetype; a parallel track for unselected fighters; an idle-fighter watchdog in sim tests.

#### A1.6 Domina

**Key facts:** Bignic; Steam EA 2017; pulled from sale in 2022 after offensive developer comments in patch notes ([Wikipedia](https://en.wikipedia.org/wiki/Domina_(video_game))). Eslabong reviewers compare the two ([reviews](https://steamcommunity.com/app/4560660/positivereviews/?browsefilter=toprated&filterLanguage=english)).

1. **Fun/sticky:** gladiator-school management with optional direct control of one fighter; permadeath and quirky events ([Daily Star](https://www.thedailystar.net/shout/game-review/are-you-not-entertained-1558099)).
2. **Adopt:** staff as a second axis; arena-entrance spectacle and music ([Daily Star](https://www.thedailystar.net/shout/game-review/are-you-not-entertained-1558099)).
3. **Loved:** brutality, spectacle and value ([Daily Star](https://www.thedailystar.net/shout/game-review/are-you-not-entertained-1558099), [OpenCritic](https://opencritic.com/game/4105/Domina)).
4. **Complaints:** clumsy control, dull downtime with no fast-forward ([Daily Star](https://www.thedailystar.net/shout/game-review/are-you-not-entertained-1558099)); poor ally AI and wild balance ([Wikipedia](https://en.wikipedia.org/wiki/Domina_(video_game))); no saves, a time-capped mode, a disposable feel ([OpenCritic](https://opencritic.com/game/4105/Domina)); conduct ended its sales ([Wikipedia](https://en.wikipedia.org/wiki/Domina_(video_game))).
5. **Ideas for us:** every week has a decision or auto-advances; entrances, kill cams and an MVP card as cheap spectacle.

#### A1.7 Mordheim: City of the Damned

**Key facts:** Rogue Factor; released 2015 after Early Access; 71% of 4,778; Metacritic 74 ([store](https://store.steampowered.com/app/276810/), [reviews](https://steamcommunity.com/app/276810/positivereviews/?browsefilter=toprated&filterLanguage=english)).

1. **Fun/sticky:** a persistent warband; post-mission injury rolls; permanent death; autosave with no undo ([reviews](https://steamcommunity.com/app/276810/positivereviews/?browsefilter=toprated&filterLanguage=english)).
2. **Adopt:** injuries that change *how* a unit plays, not just its numbers ([reviews](https://steamcommunity.com/app/276810/positivereviews/?browsefilter=toprated&filterLanguage=english)).
3. **Loved:** tension from permadeath and wounds; skill trees ([reviews](https://steamcommunity.com/app/276810/positivereviews/?browsefilter=toprated&filterLanguage=english)).
4. **Complaints:** enemy warbands regenerate each mission and scale to the player while your losses are permanent; difficulty is just inflated enemy stats; replacements start at level 0 ([reviews](https://steamcommunity.com/app/276810/negativereviews/?browsefilter=toprated&filterLanguage=english)).
5. **Ideas for us:** AI clubs persist and suffer the same injuries, aging and finances in the headless sim, so rival decline is visible and opens transfer chances.

### A2. Autobattlers

Review evidence here comes from small samples (~20 Steam reviews per game, from the top-rated and most-recent pages) plus Vaporlens, an AI-aggregated review-theme site; treat it as directional ([notes 02](research-notes/02-autobattlers.md)).

#### A2.1 Teamfight Tactics (TFT)

**Key facts:** Riot Games, 2019; live on Set 18 (Aug 2026); free-to-play with cosmetics and passes ([Wikipedia](https://en.wikipedia.org/wiki/Teamfight_Tactics)). Evidence spans 2019–20 dev blogs to Set 18.

1. **Fun/sticky:** stated pillars of mastery, playful competition and discovery, with mastery including *fortune* (managing variance) and execution deliberately de-emphasised ([Riot](https://teamfighttactics.leagueoflegends.com/en-gb/news/dev/dev-design-pillars-of-tft)); three set rotations a year refresh solved metas; ~30–35-min matches ([GamesBeat](https://gamesbeat.com/teamfight-tactics-turns-7-riot-games-discusses-lessons-learned-and-the-road-ahead-exclusive-interview/)).
2. **Adopt:** "tough choices, not touch execution": field caps and merges turned bench-juggling into decisions ([Pocket Tactics](https://www.pockettactics.com/teamfight-tactics-design)); randomness kept "positive and controlled" (opt-in coin-flips fine, uncontrollable punishers hated) and soft counters over hard ones ([Set 1 learnings](https://www.surrenderat20.net/2019/10/red-post-collection-dev-on-tft-set-1.html)); **random spell targets caused extreme variance, so Riot moved to rule-based targeting** such as "enemy with most attack speed" ([Set 2 learnings](https://dtcl.vnggames.com/en-us/news/dev/dev-tft-rise-of-the-elements-learnings)); a post-combat recap of damage dealt, taken and healed ([wiki](https://wiki.leagueoflegends.com/en-us/V12.6_(Teamfight_Tactics))); fewer changes per patch ([Set 1 learnings](https://www.surrenderat20.net/2019/10/red-post-collection-dev-on-tft-set-1.html)).
3. **Loved:** paired 1v1s inside an 8-player lobby and the shared draft ([Riot](https://teamfighttactics.leagueoflegends.com/en-gb/news/dev/dev-design-pillars-of-tft)); a "second game" with no daily-play pressure ([GamesBeat](https://gamesbeat.com/teamfight-tactics-turns-7-riot-games-discusses-lessons-learned-and-the-road-ahead-exclusive-interview/)).
4. **Complaints:** no tutorial or year-round bots, and phases too short to read (2025 thread via mirror) ([devtrackers](https://devtrackers.gg/teamfight-tactics/p/df2e092b-tft-looks-interesting-but-i-find-the-new-player-experience-too-wretched-to-endure)); board clutter from summons, invisible effects and tiny projectiles ([Set 2 learnings](https://dtcl.vnggames.com/en-us/news/dev/dev-tft-rise-of-the-elements-learnings)); "trait tax" units ([Set 1 learnings](https://www.surrenderat20.net/2019/10/red-post-collection-dev-on-tft-set-1.html)).
5. **Ideas for us:** deterministic, rule-named targeting *is* our selector vocabulary; a per-fighter recap plus rule-fire counts; TFT's mastery skills map onto scouting, squad pivots and variance management (inference).

#### A2.2 Dota Underlords

**Key facts:** Valve; 2019–20; free with a $4.99 pass ([Wikipedia](https://en.wikipedia.org/wiki/Dota_Underlords), [App Store](https://apps.apple.com/app/id1465996312)). **Online but effectively abandoned** since 2020 ([Destructoid](https://www.destructoid.com/i-cant-believe-this-abandoned-valve-game-still-has-players-and-is-fun-4-years-later/), [StopGame](https://stopgame.ru/newsdata/51189/pohozhe_valve_okonchatelno_zabrosila_podderzhku_dota_underlords)); 84% of 33.5k, recent 75% ([reviews](https://steamcommunity.com/app/1046930/reviews/)).

1. **Fun/sticky:** a newcomer-friendly take with clean UI ([Wikipedia](https://en.wikipedia.org/wiki/Dota_Underlords)); a relaxing one-game-after-work loop ([reviews](https://steamcommunity.com/app/1046930/reviews/)).
2. **Adopt:** item drops as pick-1-of-3 (losing a loot round removes two options) ([BlueStacks](https://www.bluestacks.com/blog/game-guides/dota-underlords/dotaul-season-1-update-en.html)); modes including a single-player puzzle crawl and replays ([review](https://www.highgroundgaming.com/dota-underlords-review/)); after players deliberately lost with empty boards to farm loss-streak gold, Valve capped it at 2 ([ONE Esports](https://www.oneesports.gg/dota-underlords/dota-underlordss-latest-update-caps-winning-and-losing-streaks)).
3. **Loved:** cross-play ([review](https://www.highgroundgaming.com/dota-underlords-review/)); stable rules that never go stale ([Destructoid](https://www.destructoid.com/i-cant-believe-this-abandoned-valve-game-still-has-players-and-is-fun-4-years-later/)).
4. **Complaints:** abandonment and silence; "skill-less RNG" ([thread](https://steamcommunity.com/app/1046930/discussions/0/5168416410407459322)). Postmortem (evidence plus inference): distribution against TFT, concurrents down ~80% in ~6 months, churn from monthly overhauls ([PCGamesN](https://www.pcgamesn.com/dota-underlords/player-count-drop)), a stalled season ([review](https://www.highgroundgaming.com/dota-underlords-review/)).
5. **Ideas for us:** 1-of-3 offers with one reroll for loot, recruits and staff; a puzzle mode ("win by editing gambits only"); catch-up money capped so losing on purpose never pays.

#### A2.3 Auto Chess

**Key facts:** Drodo Studio (a handful of people); Dota 2 mod 2019, later standalone incl. Steam (2022) ([Wikipedia](https://en.wikipedia.org/wiki/Dota_Auto_Chess)); free with IAP; live; "Mixed", 65% of 1,025 ([store](https://store.steampowered.com/app/1530300/Auto_Chess/)).

1. **Fun/sticky:** it invented the genre (7M mod installs in ~3 months); a calm pace with downtime ([Wikipedia](https://en.wikipedia.org/wiki/Dota_Auto_Chess), [Inven Global](https://www.invenglobal.com/articles/7962/a-rare-glimpse-behind-the-creation-of-auto-chess)).
2. **Adopt:** the founding vocabulary (shared pool, 3-merge, tiered race/class breakpoints, interest, level = units on board) ([Wikipedia](https://en.wikipedia.org/wiki/Dota_Auto_Chess)); ranked "insurance" so one bad game costs no rank ([reviews](https://steamcommunity.com/app/1530300/reviews/)).
3. **Loved:** nostalgia, friends, lower RNG than TFT ([reviews](https://steamcommunity.com/app/1530300/reviews/)).
4. **Complaints:** a ~60-hero pool pushed games past 40 min ([Inven Global](https://www.invenglobal.com/articles/7962/a-rare-glimpse-behind-the-creation-of-auto-chess)); mobile UI ported to PC, multi-currency cosmetics, cheaters, loud audio, unclear art ([reviews](https://steamcommunity.com/app/1530300/reviews/)).
5. **Ideas for us:** a small active pool per season; PC-native UI (hover, drag-and-drop, shortcuts); one "bad match insurance" consumable per season (inference).

#### A2.4 Super Auto Pets

**Key facts:** Team Wood Games; 2021; live; free with paid packs; 91% of 25k, recent 88% ([Wikipedia](https://en.wikipedia.org/wiki/Super_Auto_Pets), [store](https://store.steampowered.com/app/1714040/Super_Auto_Pets/)).

1. **Fun/sticky:** a tiny ruleset (10 gold a turn, everything costs 3, reroll 1, freeze; 5 pets in a line) with deep interactions; 10 wins before 5 lives lost, async, **no timer**; a weekly pack ([wiki](https://superautopets.wiki.gg/wiki/The_Basics), [store](https://store.steampowered.com/app/1714040/Super_Auto_Pets/)).
2. **Adopt:** fully legible combat (front units trade blows; only attack and health; abilities on a small trigger vocabulary such as start of battle, faint, hurt) ([glossary](https://superautopets.wiki.gg/wiki/Glossary)); saved player teams as async opponents with AI fallback ([Wikipedia](https://en.wikipedia.org/wiki/Super_Auto_Pets)).
3. **Loved:** simple yet strategic, weekly variety ([Vaporlens](https://vaporlens.app/app/1714040/super_auto_pets.md)).
4. **Complaints:** pets in paid packs drew pay-to-win anger, the top negative theme; luck and matchmaking ([thread](https://steamcommunity.com/app/1714040/discussions/0/2958293022025588185), [Vaporlens](https://vaporlens.app/app/1714040/super_auto_pets.md)).
5. **Ideas for us:** the trigger vocabulary *is* our condition vocabulary; an "N wins before K losses" cup; order and adjacency alone can carry synergy for 3–5 fighters (inference).

#### A2.5 The Bazaar

**Key facts:** Tempo; on Steam since Aug 2025, live. The model kept changing: a $10/month card pass ([CardGamer](https://cardgamer.com/games/digital-card-games/the-bazaar/6-reasons-why-the-bazaars-open-beta-caused-an-uproar)), then paid DLC heroes ([Outer Haven](https://www.theouterhaven.net/tempo-announces-new-pricing-and-update-structure-for-the-bazaar/)), then (announced 15 Oct 2026) free with a one-time all-heroes unlock ([Tempo post](https://thebazaarzone.com/mobile-announcement-future-plans/)). 78% of 6.3k, **recent 56% Mixed** ([store](https://store.steampowered.com/app/1617400/The_Bazaar/)).

1. **Fun/sticky:** a roguelike builder with hourly choices each in-game day before PvE and PvP fights; items fire on cooldowns and combat is timer manipulation (haste, slow, freeze) ([Mobalytics](https://mobalytics.gg/the-bazaar/guides/day-guide), [keywords](https://mobalytics.gg/the-bazaar/guides/keywords-and-terms)).
2. **Adopt:** async ghosts with no time pressure ([reviews](https://steamcommunity.com/app/1617400/reviews/)); newcomers only meet equal- or lower-rank ghosts ([Outer Haven](https://www.theouterhaven.net/tempo-announces-new-pricing-and-update-structure-for-the-bazaar/)); item sizes make space a resource ([items](https://mobalytics.gg/the-bazaar/items-enchantments-skills)).
3. **Loved:** replayability, flexible async, polish ([reviews](https://steamcommunity.com/app/1617400/reviews/), [Vaporlens](https://vaporlens.app/app/1617400/the_bazaar.md)).
4. **Complaints:** paid power and broken promises are the top negative theme ([Vaporlens](https://vaporlens.app/app/1617400/the_bazaar.md)); communication and balance swings ([reviews](https://steamcommunity.com/app/1617400/reviews/)); no in-game replays, so a third-party tracker offers them ([tracker](https://sin.bazaardb.gg/tracker)).
5. **Ideas for us:** a weekly calendar of choices (scout, train, rest, friendly, market) before match day (inference); statuses as cooldown manipulation that gambits can react to; price once, never sell power.

#### A2.6 Mechabellum

**Key facts:** Game River; 1.0 Sep 2024; "2.0" (Sep 2026) added a free edition and a solo roguelite ([Wikipedia](https://en.wikipedia.org/wiki/Mechabellum), [Turn Based Lovers](https://turnbasedlovers.com/overview/mechabellum-2-0/)); 84% of 10k, recent 71% ([store](https://store.steampowered.com/app/669330/Mechabellum/)).

1. **Fun/sticky:** "RTS depth without APM": place units, watch; units keep positions and levels across rounds ([GamesBeat](https://gamesbeat.com/mechabellum-gets-a-second-chance-as-dreamhaven-relaunches-the-mech-autobattler/), [guide](https://finalboss.io/mechabellum-beginner-guide-to-unit-roles-deployment-and)); ~15-min matches where losses feel like being outplayed ([reviews](https://steamcommunity.com/app/669330/reviews/)).
2. **Adopt:** near-full information on the enemy army ([guide](https://finalboss.io/mechabellum-beginner-guide-to-unit-roles-deployment-and)); a chaff / chaff-clear / carry role triangle ([guide](https://finalboss.io/mechabellum-beginner-guide-to-unit-roles-deployment-and)); replays you can rewind and re-play by round ([forum](https://forum.quartertothree.com/t/mechabellum-tactical-autobattler-against-other-people/167835)).
3. **Loved:** low stress, including against bots; a non-predatory model ([Vaporlens](https://vaporlens.app/app/669330/mechabellum.md), [reviews](https://steamcommunity.com/app/669330/reviews/)).
4. **Complaints:** **big units waste shots on chaff**, and players want target priority; per-unit lock-on techs followed ([forum](https://forum.quartertothree.com/t/mechabellum-tactical-autobattler-against-other-people/167835), [thread](https://steamcommunity.com/app/669330/discussions/0/3833172420312842660)); poor teaching; no undo ([reviews](https://steamcommunity.com/app/669330/reviews/)).
5. **Ideas for us:** gambits answer that complaint ("IF highest-threat enemy in range THEN target"), priced via range or cooldown; matches as short round series with edits between rounds; "re-sim this round with my edits" in replays; undo until confirm.

#### A2.7 Backpack Battles

**Key facts:** PlayWithFurcifer; Godot; 1.0 June 2025 ([Wikipedia](https://en.wikipedia.org/wiki/Backpack_Battles)); $14.99, no microtransactions; 92% of 5.6k, recent 78% ([store](https://store.steampowered.com/app/2427700/Backpack_Battles/)). First-month sales: ~640k per one source ([Game World Observer](https://gameworldobserver.com/2024/04/25/backpack-battles-sales-640k-copies-china-top-country)), 650k per another's headline ([GameDiscoverCo](https://newsletter.gamediscover.co/p/how-backpack-battles-sold-650k-copies)).

1. **Fun/sticky:** a spatial shop puzzle where shapes and **adjacency** matter; 10–20-s fights; 10 wins before 5 losses ([Wikipedia](https://en.wikipedia.org/wiki/Backpack_Battles)).
2. **Adopt:** a long free demo that built the community ([Game World Observer](https://gameworldobserver.com/2024/04/25/backpack-battles-sales-640k-copies-china-top-country)); an unranked mode with no timers ([store](https://store.steampowered.com/app/2427700/Backpack_Battles/)).
3. **Loved:** build variety, quick matches, fair monetisation ([Vaporlens](https://vaporlens.app/app/2427700/backpack_battles.md)).
4. **Complaints:** "rigged" matchmaking is the top negative cluster ([Vaporlens](https://vaporlens.app/app/2427700/backpack_battles.md)), with a 2024 developer reply that opponents get stronger with rank ([thread](https://steamcommunity.com/app/2427700/discussions/0/4203616558110689260)); luck; unlimited-reroll cheat builds ([reviews](https://steamcommunity.com/app/2427700/reviews/)).
5. **Ideas for us:** adjacency synergies (a shield-bearer buffs the fighter behind); **publish fixtures in advance and never pick opponents reactively**.

#### A2.8 Hearthstone Battlegrounds

**Key facts:** Blizzard; 2019, inside Hearthstone ([Game Developer](https://gamedeveloper.com/design/why-the-i-hearthstone-i-devs-wanted-to-make-an-auto-battler)); free with a paid pass granting extra hero choices ([esports.gg](https://esports.gg/news/hearthstone/hearthstone-battlegrounds-rewards-track-season-pass-is-bg-becoming-pay-to-win-with-runestones/)); live.

1. **Fun/sticky:** low-stakes losses, built as a long-term onboarding funnel ([Game Developer](https://gamedeveloper.com/design/why-the-i-hearthstone-i-devs-wanted-to-make-an-auto-battler)); a very simple economy (3→10 gold, no carry-over) ([wiki](https://hearthstone.wiki.gg/wiki/Battlegrounds)).
2. **Adopt:** strict left-to-right attack order ([wiki](https://hearthstone.wiki.gg/wiki/Battlegrounds)); armor handicaps of 5–20 for weaker heroes ([wiki](https://hearthstone.wiki.gg/wiki/Battlegrounds/Armor)); a random rule modifier per game ([BlizzardWatch](https://blizzardwatch.com/2023/09/12/anomalies-hearthstone-battlegrounds-season-5/)); offer rules that guarantee relevance (one main-tribe item, one generic, one cheap) ([dev post](https://us.forums.blizzard.com/en/hearthstone/t/158955/1)); faster trigger animations ([Out of Games](https://outof.games/hearthstone/758-hearthstone-gameplay-is-going-to-be-faster-minion-trigger-speeds-increasing-by-300-in-an-upcoming-patch)).
3. **Loved:** social play, duos, constant novelty ([Game Developer](https://gamedeveloper.com/design/why-the-i-hearthstone-i-devs-wanted-to-make-an-auto-battler), [BlizzardWatch](https://blizzardwatch.com/2023/09/12/anomalies-hearthstone-battlegrounds-season-5/)).
4. **Complaints:** paid hero choice as pay-to-win (search result only) ([esports.gg](https://esports.gg/news/hearthstone/hearthstone-battlegrounds-rewards-track-season-pass-is-bg-becoming-pay-to-win-with-runestones/)); combats stalling lobbies 3+ minutes, with players asking for a ~60-s cap ([forum](https://us.forums.blizzard.com/en/hearthstone/t/battlegrounds-animation-issues/135955)).
5. **Ideas for us:** armor-style handicaps for difficulty; a league-wide rule per season; scouting reports guaranteed to include one fighter who fits your archetype; a fight cap with an overtime ramp.

#### A2.9 Storybook Brawl

**Key facts:** Good Luck Games (seven staff in 2021); EA 2021, free; bought by FTX in 2022 with NFT plans; **shut down 1 May 2023** ([Wikipedia](https://en.wikipedia.org/wiki/Storybook_Brawl), [Decrypt](https://decrypt.co/137875/ftx-sam-bankman-fried-storybook-brawl-video-game-shutting-down)).

1. **Fun/sticky:** a cleaner card take on Battlegrounds with front and back rows ([reviews](https://steamcommunity.com/app/1367020/reviews/), [HSReplay](https://articles.hsreplay.net/2022/09/23/storybook-brawl-the-perfect-game-for-battlegrounds-players-2/)).
2. **Adopt:** auto-levelling removes rushing and stalling; triples give a choice of 3 treasures; ranged and flying units reach the back row, supports buff the unit ahead ([HSReplay](https://articles.hsreplay.net/2022/09/23/storybook-brawl-the-perfect-game-for-battlegrounds-players-2/)).
3. **Loved:** depth, a responsive developer, faster games ([reviews](https://steamcommunity.com/app/1367020/reviews/)).
4. **Complaints:** random swings ([Wikipedia](https://en.wikipedia.org/wiki/Storybook_Brawl)); little opponent information ([HSReplay](https://articles.hsreplay.net/2022/09/23/storybook-brawl-the-perfect-game-for-battlegrounds-players-2/)). It died of ownership: the NFT deal triggered a review-bomb, then the parent's collapse killed the servers ([Wikipedia](https://en.wikipedia.org/wiki/Storybook_Brawl), [Decrypt](https://decrypt.co/137875/ftx-sam-bankman-fried-storybook-brawl-video-game-shutting-down)).
5. **Ideas for us:** front/back rows with role rules; a 1-of-3 perk at milestones; offline-first so the game cannot be shut down (inference).

### A3. Player-configurable unit AI

Several wikis, Reddit and some forums were blocked, so some points rest on search-result snippets, marked (snippet) ([notes 03](research-notes/03-tactics-ai.md)).

#### A3.1 Gladiabots

**Key facts:** GFX47; 1.0 May 2019; PC, Mac, Linux, mobile; ~87% of ~850 reviews positive; solo missions, a sandbox, and async PvP against stored AIs ([store](https://store.steampowered.com/app/871930/GLADIABOTS__AI_Combat_Arena/)).

**How it works.** Each bot's AI is a node tree checked in a fixed order; the first action reached ends the tick's decision ([guide](https://steamcommunity.com/sharedfiles/filedetails/?id=1759851189); snippet: [wiki](https://wiki.gladiabots.com/index.php?title=Advanced)). Nodes are colour-coded by subject, distance comes in bands, tags and counters give memory ([guide](https://steamcommunity.com/sharedfiles/filedetails/?id=1759851189), [guide](https://steamcommunity.com/sharedfiles/filedetails/?id=2154546931)); reusable modules count against a node budget ([thread](https://steamcommunity.com/app/871930/discussions/0/1642039362988268518/)).

1. **Fun/sticky:** the create–test–refine loop *is* the game; the developer found tuning one AI until it beat another genuinely fun ([Game Developer](https://www.gamedeveloper.com/design/gladiabots-inception)).
2. **Adopt:** a sandbox scripting both sides ([store](https://store.steampowered.com/app/871930/GLADIABOTS__AI_Combat_Arena/)); a button from a replay straight into the editor ([devlog](https://gfx47.itch.io/gladiabots/devlog/34211/gladiabots-alpha-13-is-live)); a debugger with rewind and step-through ([reviews](https://steamcommunity.com/app/871930/reviews/?browsefilter=toprated)); reusable modules; a complexity budget ([thread](https://steamcommunity.com/app/871930/discussions/0/1642039362988268518/)).
3. **Loved:** a drag-and-drop editor non-coders call intuitive; reliable async matchmaking ([reviews](https://steamcommunity.com/app/871930/reviews/?browsefilter=toprated)).
4. **Complaints:** slow debugging; losses hard to understand; a tutorial that skips comparisons like "nearest" ([reviews](https://steamcommunity.com/app/871930/reviews/?browsefilter=toprated)); one tactic winning almost everything in early access ([review](https://gamingrespawn.com/reviews/34358/gladiabots-review/)); near-opposite conditions that confuse ([guide](https://steamcommunity.com/sharedfiles/filedetails/?id=2154546931)).
5. **Ideas for us:** a scrimmage sandbox; replay → this fighter's rules at this moment; a decision trace built into replays; shareable rule modules; lint for near-opposites; in-person newcomer playtests, which the developer later credited with exposing problems players rarely report (snippet) ([interview](https://www.actugaming.net/no-plan-b-interview-agfd-443201)).

#### A3.2 Pillars of Eternity II: Deadfire

**Key facts:** Obsidian, 2018; real-time-with-pause; party cut to five partly for readability; inspired by FFXII's gambits and Origins' tactics; the rebuilt AI also made enemies tougher ([PCGamesN](https://www.pcgamesn.com/pillars-of-eternity-2-deadfire/pillars-of-eternity-ii-companions-custom-ai)).

**How it works.** Each character has a class-based default, stances and a secondary rule set for when an affliction blocks the first ([PCGamesN](https://www.pcgamesn.com/pillars-of-eternity-2-deadfire/pillars-of-eternity-ii-companions-custom-ai), [guide](https://www.gry-online.pl/poradniki/pillars-of-eternity-2-deadfire/sztuczna-inteligencja-ai-druzyny/zc17866)). A custom behaviour is an ordered list; each entry has conditions, one action, a **target type**, a **target priority** (e.g. most allies nearby, lowest resistance) and an optional **timer**; stacked conditions mean AND, a duplicated entry means OR, and every condition has NOT ([thread](https://steamcommunity.com/app/560130/discussions/0/1693795812309628406), [thread](https://steamcommunity.com/app/560130/discussions/0/1696048245844756614/); snippet: [guide](https://steamcommunity.com/sharedfiles/filedetails/?id=1392162466)).

1. **Fun/sticky:** companions that look after themselves ([thread](https://steamcommunity.com/app/560130/discussions/0/1696048245844756614/)).
2. **Adopt:** presets over the full editor ([PCGamesN](https://www.pcgamesn.com/pillars-of-eternity-2-deadfire/pillars-of-eternity-ii-companions-custom-ai)); target priority separate from conditions (snippet) ([guide](https://steamcommunity.com/sharedfiles/filedetails/?id=1392162466)); per-rule timers ([thread](https://steamcommunity.com/app/560130/discussions/0/1693795812309628406)); categorised condition lists ([patch 1.1](https://eternity.obsidian.net/news/pillars-of-eternity-ii-deadfire-update-49---patch-11)); cloning a premade script ([thread](https://steamcommunity.com/app/560130/discussions/0/1696048245844756614/)).
3. **Loved:** default AI is enough on normal, custom control matters on the hardest modes ([RPG Site](https://rpgsite.net/review/7139-pillars-of-eternity-ii-deadfire-review)).
4. **Complaints:** ability spam and wasted buffs without timers ([thread](https://steamcommunity.com/app/560130/discussions/0/1693795812309628406)); missing conditions (enemy HP, "target is casting", immunities) ([thread](https://steamcommunity.com/app/560130/discussions/0/1693795812309628406)) that a mod adds (snippet) ([Nexus](https://www.nexusmods.com/pillarsofeternity2/mods/88?tab=posts)); list UI that jumps while reordering and loses edits; area spells hitting allies ([thread](https://steamcommunity.com/app/560130/discussions/0/1696048245844756614/)).
5. **Ideas for us:** separate *when*, *who* and *which*; a visible cooldown field; a categorised picker; an unremovable fallback stance; a "no friendly fire" filter; generous vocabulary at launch.

#### A3.3 Final Fantasy XII and The Zodiac Age

**Key facts:** FFXII 2006; The Zodiac Age 2017 (PC 2018), which added 2x/4x speed in battle; director Hiroyuki Ito; developer Square Enix (general knowledge; not recorded in the notes) ([Wikipedia](https://en.wikipedia.org/wiki/Final_Fantasy_XII), [Player2](https://www.player2.net.au/2017/07/final-fantasy-xii-the-zodiac-age-review/)).

**How it works.** A gambit is a target-with-condition, an action, and a priority by list position; the first valid one fires and player commands win ([Gamer Guides](https://gamerguides.com/final-fantasy-xii/guide/basics/gameplay-mechanics/battle-system)). Slots grow to 12 (guides disagree on the starting count: four vs two or three) ([Gamer Guides](https://gamerguides.com/final-fantasy-xii/guide/basics/gameplay-mechanics/battle-system)); conditions are bought or found (snippet) ([StrategyWiki](https://strategywiki.org/wiki/Final_Fantasy_XII/Gambits)). Vocabulary spans ally, foe and self tests such as HP < X% in 10% steps, nearest, leader's target, weak to element ([Jegged](https://jegged.com/Games/Final-Fantasy-XII/Gambits/)). It grew from hidden monster AI so real-time battles would not be too fast to control ([PlayStation Blog](https://blog.playstation.com/?p=192698)).

1. **Fun/sticky:** you feel like a tactician because the thinking happens before the fight ([essay](https://publish.obsidian.md/taniynquest/Final+Fantasy+XII+and+the+Illusion+of+Free+Will)); triumph when a tuned party beats a tough enemy ([PlayStation Blog](https://blog.playstation.com/?p=192698)).
2. **Adopt:** one-phrase rules; strict top-down priority; per-rule toggles in battle ([Gamer Guides](https://gamerguides.com/final-fantasy-xii/guide/basics/gameplay-mechanics/battle-system)); vocabulary as loot and slots as progression; enemies on the same system ([PlayStation Blog](https://blog.playstation.com/?p=192698)).
3. **Loved:** routine healing automated so attention goes to bosses ([RPG Site](https://www.rpgsite.net/review/2789-final-fantasy-xii-review)); speed-up makes grinding painless ([Player2](https://www.player2.net.au/2017/07/final-fantasy-xii-the-zodiac-age-review/)).
4. **Complaints:** "plays itself" (snippet) ([Giant Bomb](https://www.giantbomb.com/final-fantasy-xii/3030-11497/user-reviews/2200-3319/)), though gambits do nothing until built ([Wikipedia](https://en.wikipedia.org/wiki/Final_Fantasy_XII)); too complicated for newcomers ([Wikipedia](https://en.wikipedia.org/wiki/Final_Fantasy_XII)); buying every threshold separately is a chore ([essay](https://publish.obsidian.md/taniynquest/Final+Fantasy+XII+and+the+Illusion+of+Free+Will)); **the ordering trap**: an unconditional attack above a heal means the heal never fires ([Gamer Guides](https://gamerguides.com/final-fantasy-xii/guide/basics/gameplay-mechanics/battle-system)).
5. **Ideas for us:** sentence rules in 10% steps; a captain's-target selector for focus fire; per-rule toggles at pause; hard fights a generic list cannot win (inference).

#### A3.4 Dragon Age: Origins and successors

**Key facts:** Origins 2009, then DA2, Inquisition and The Veilguard (2024); developer BioWare (general knowledge; not recorded in the notes).

**How it works.** Condition → action rules checked top-down; 2 slots at start plus free ones at set levels, more via a skill ([thread](https://steamcommunity.com/app/47810/discussions/0/2579854400736575780/); snippet: [wiki](https://dragonage.fandom.com/wiki/Combat_Tactics)); eight role presets as starting points; stances separate from rules ([thread](https://steamcommunity.com/app/47810/discussions/0/2579854400736575780/)); conditions grouped by self, ally, enemy and named companion, plus "jump to rule N" ([LiveJournal](https://dragon-age.livejournal.com/348046.html); snippet: [wiki](https://dragonage.fandom.com/wiki/Tactics_(Origins))). Inquisition swapped lists for per-ability use / don't use / prefer (snippet) ([Giant Bomb](https://www.giantbomb.com/forums/dragon-age-inquisition-7175/inquisition-hints-tips-tricks-1500141/)); Veilguard removed companion control for an ability wheel ([PS LifeStyle](https://www.playstationlifestyle.net/2024/08/09/dragon-age-the-veilguard-companions-controlled-detrimental/)).

1. **Fun/sticky:** specialists that run themselves while you control one; focus fire via "attack the tank's target" ([LiveJournal](https://dragon-age.livejournal.com/348046.html)).
2. **Adopt:** slots that grow free with level; role presets you save over; separate stances ([thread](https://steamcommunity.com/app/47810/discussions/0/2579854400736575780/)); ally-referencing rules (snippet) ([wiki](https://dragonage.fandom.com/wiki/Tactics_(Origins))).
3. **Loved:** veterans still measure later games against it (snippet) ([Steam](https://steamcommunity.com/app/1222690/discussions/0/598512477964095800), [Steam](https://steamcommunity.com/app/1845910/discussions/0/4635985982183765729)).
4. **Complaints:** unintuitive, buggy conditions; skill points spent on slots feel wasted ([thread](https://steamcommunity.com/app/47810/discussions/0/2579854400736575780/)); stances chasing bait ([thread](https://steamcommunity.com/app/47810/discussions/0/1319961868324922289)); area spells hitting allies ([Sorcerers.net](https://sorcerers.net/Games/DragonAge/Walkthrough/getting-started/scripting.php)); **rules tied to names break** when you swap the tank ([LiveJournal](https://dragon-age.livejournal.com/348046.html)); successors simplified until experts felt a loss ([Seasoned Gaming](https://seasonedgaming.com/2024/11/20/review-dragon-age-the-veilguard-less-chatting-more-clashing/)).
5. **Ideas for us:** reference roles, not names; free slot growth; a use / don't / prefer screen as a *beginner layer* that compiles into real rules (inference).

#### A3.5 Unicorn Overlord

**Key facts:** Vanillaware/Atlus, March 2024; consoles only (snippet) ([Wikipedia](https://en.wikipedia.org/wiki/Unicorn_Overlord)).

**How it works.** Squad fights resolve automatically; active skills cost AP, passive (reactive) skills cost PP; each skill has **up to two conditions** in an ordered list; with no tactics a unit attacks the enemy in front; **Optimize** fills tactics and gear in one click ([RPG Site](https://www.rpgsite.net/news/15481-unicorn-overlord-highlights-tactics-priority-and-battle-stages-along-with-several-new-non-human-allies)). Designers deliberately left some conditions out to force workarounds ([Nameless Quality](https://namelessquality.com/the-unicorn-overlord-tactics-system/)). A community analysis says conditions act as checks, filters or sorts, but guides contradict each other ([ResetEra](https://www.resetera.com/threads/unicorn-overlord-ot-ogre-battle-24-the-queens-gambit.824595/page-10); snippet: [Prima](https://primagames.com/gaming/unicorn-overlord-tactics-and-conditions-explained)). A battle forecast previews results ([FullCleared](https://fullcleared.com/reviews/unicorn-overlord-review/)).

1. **Fun/sticky:** tactics as a puzzle and a reason to watch; the general who must trust trained troops ([Nameless Quality](https://namelessquality.com/the-unicorn-overlord-tactics-system/)).
2. **Adopt:** AP/PP budgets make rule order an economic choice; a two-condition cap; a sensible default; one-click Optimize ([RPG Site](https://www.rpgsite.net/news/15481-unicorn-overlord-highlights-tactics-priority-and-battle-stages-along-with-several-new-non-human-allies)); a slow drip of new skills ([Nameless Quality](https://namelessquality.com/the-unicorn-overlord-tactics-system/)).
3. **Loved:** min-max room alongside Optimize ([FullCleared](https://fullcleared.com/reviews/unicorn-overlord-review/)); experts still improving after 50 h ([GamingTrend](https://gamingtrend.com/unicorn-overlord-review-for-king-and-country/)).
4. **Complaints:** **optimising gear overwrites hand-made tactics** ([GamingTrend](https://gamingtrend.com/unicorn-overlord-review-for-king-and-country/)); unclear semantics ([ResetEra](https://www.resetera.com/threads/unicorn-overlord-ot-ogre-battle-24-the-queens-gambit.824595/page-10)); the forecast removes the need to adapt, and tuning 10 squads is daunting ([FullCleared](https://fullcleared.com/reviews/unicorn-overlord-review/)).
5. **Ideas for us:** a per-fight focus budget; explicit **Only** (filter) vs **Prefer** (sort); an assistant coach that never overwrites locked rules; a quick test run against a scouted lineup (inference; may need limits).

#### A3.6 Other reference systems (brief notes only)

The notes cover these in a line or two, so no five-point breakdown is available.

| Game | What it does | Lesson for us |
|---|---|---|
| Dragon Quest | Named team orders; removing direct control in DQIV drew criticism, so DQV added a "follow orders" option ([DQ wiki](https://dragon-quest.org/wiki/Artificial_Intelligence)) | Forced automation needs an override |
| Persona | Five preset orders switchable in battle (snippet) ([wiki](https://megatenwiki.com/wiki/Tactics)) | The simplest "personality" layer |
| FFXIII | Whole-party role presets switched in real time (snippet) ([Jegged](https://jegged.com/Games/Final-Fantasy-XIII/Paradigms/Paradigm-Explanation.html)) | Mid-fight playbook switching |
| Carnage Heart | Flowchart chips; debugging can swallow the game (snippet) ([Wikipedia](https://en.wikipedia.org/wiki/Carnage_Heart)) | Expressiveness costs approachability |
| Screeps, Baldur's Gate | Real code or external script files (snippet) ([Steam](https://store.steampowered.com/app/464350/Screeps_World), [Beamdog](https://forums.beamdog.com/discussion/comment/867341)) | The ceiling, not our audience |
| Ogre Battle | One target order per unit (snippet) ([Wikipedia](https://en.wikipedia.org/wiki/Ogre_Battle:_The_March_of_the_Black_Queen)) | One selector can carry real strategy |

#### A3.7 Approachability versus depth: comparison

| | Gladiabots | Deadfire | FFXII / TZA | DA: Origins | Unicorn Overlord |
|---|---|---|---|---|---|
| Editor form | Node graph | Ordered list + dropdowns | Ordered phrase list | Ordered phrase list | Skill list + ≤2 conditions |
| Newcomer on-ramp | Tutorial campaign, no presets | Class default, stances, presets to clone | Starter gambits, few slots | Role presets, stances | Default attack, Optimize |
| Expert depth | Memory tags, modules, async PvP | AND/OR/NOT, target priority, timers | 12 slots, bought vocabulary | "Jump to", ally references | Check/filter/sort, AP/PP economy |
| Limit | Node budget | Practical only | 12 slots | Slots by level + skill | Skills known + AP/PP |
| Feedback | Replay debugger (tedious) | Watch (+ log, inference) | Watch | Watch | Battle forecast |
| Mid-fight control | None | Pause + manual cast | Commands + toggles | Control one character | None |

Sources (the Deadfire guide and the Origins wiki are snippets): ([reviews](https://steamcommunity.com/app/871930/reviews/?browsefilter=toprated), [thread](https://steamcommunity.com/app/871930/discussions/0/1642039362988268518/), [PCGamesN](https://www.pcgamesn.com/pillars-of-eternity-2-deadfire/pillars-of-eternity-ii-companions-custom-ai), [guide](https://steamcommunity.com/sharedfiles/filedetails/?id=1392162466), [Gamer Guides](https://gamerguides.com/final-fantasy-xii/guide/basics/gameplay-mechanics/battle-system), [wiki](https://dragonage.fandom.com/wiki/Combat_Tactics), [RPG Site](https://www.rpgsite.net/news/15481-unicorn-overlord-highlights-tactics-priority-and-battle-stages-along-with-several-new-non-human-allies), [FullCleared](https://fullcleared.com/reviews/unicorn-overlord-review/)).

- Every successful system layers **working default → named presets → editable rules → advanced vocabulary**; Gladiabots, with no presets, has the steepest curve and the most debugging complaints ([reviews](https://steamcommunity.com/app/871930/reviews/?browsefilter=toprated)). Failures sit at both ends: too opaque (Origins' conditions) or too thin (Inquisition, Veilguard) ([thread](https://steamcommunity.com/app/47810/discussions/0/2579854400736575780/), [Seasoned Gaming](https://seasonedgaming.com/2024/11/20/review-dragon-age-the-veilguard-less-chatting-more-clashing/)).
- Presets work as editable starting points; defaults must clear normal difficulty ([RPG Site](https://rpgsite.net/review/7139-pillars-of-eternity-ii-deadfire-review)). Gradual unlocks teach vocabulary, but re-buying each threshold is busywork ([essay](https://publish.obsidian.md/taniynquest/Final+Fantasy+XII+and+the+Illusion+of+Free+Will)).
- Limits create choices when each slot is a real trade-off ([LiveJournal](https://dragon-age.livejournal.com/348046.html)) and frustrate when hidden or arbitrary ([thread](https://steamcommunity.com/app/871930/discussions/0/1642039362988268518/)).
- Vocabulary always reduces to **who**, **a test**, **which one** and **what to do**; the best-loved systems separate "which one" from "whether" ([ResetEra](https://www.resetera.com/threads/unicorn-overlord-ot-ogre-battle-24-the-queens-gambit.824595/page-10); snippet: [guide](https://steamcommunity.com/sharedfiles/filedetails/?id=1392162466)).
- Debugging is the weakest area; only Gladiabots has a real debugger, and it is called tedious ([reviews](https://steamcommunity.com/app/871930/reviews/?browsefilter=toprated)).

### A4. Cross-cutting themes for Part A

#### A4.1 Unit AI and tactics customization

- **Our niche is open.** Lobby autobattlers give placement, order and items, never per-unit rules ([TFT targeting](https://www.invenglobal.com/articles/8672/tft-guide-understanding-assassins-and-counter-strategies), [wiki](https://hearthstone.wiki.gg/wiki/Battlegrounds), [glossary](https://superautopets.wiki.gg/wiki/Glossary)); Eslabong and TFM2 offer per-fighter behaviour settings but no ordered IF/THEN list ([Apr–Aug notes](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=3000&enddate=1787961600), [store](https://store.steampowered.com/app/3009300/Teamfight_Manager_2/)). Ordered gambits are a genuine differentiator (inference).
- **Targeting must be deterministic and nameable** (random targeting was TFT's biggest variance source ([Set 2 learnings](https://dtcl.vnggames.com/en-us/news/dev/dev-tft-rise-of-the-elements-learnings))). Default to "nearest valid enemy in range" with documented tie-breaks and price strong overrides ([thread](https://steamcommunity.com/app/669330/discussions/0/3833172420312842660)).
- **Proven vocabularies:** triggers such as round start, hurt and ally down ([glossary](https://superautopets.wiki.gg/wiki/Glossary)); Eslabong's AoE counts, opening window, emergency-only and friendly-fire policy ([Apr–Aug notes](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=3000&enddate=1787961600), [0.82.1 notes](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=4&maxlength=0&enddate=1792454400)); FFXII's 10% steps and leader's target ([Jegged](https://jegged.com/Games/Final-Fantasy-XII/Gambits/)); Origins' "surrounded by N" and "attacked by melee/ranged" ([Sorcerers.net](https://sorcerers.net/Games/DragonAge/Walkthrough/getting-started/scripting.php)). Most requested: threat-reading conditions (target casting, immunities, enemy HP) ([thread](https://steamcommunity.com/app/560130/discussions/0/1693795812309628406)).
- **Tactics must beat stats where it counts:** Eslabong's levels outweigh tactics ([reviews](https://steamcommunity.com/app/4560660/negativereviews/?browsefilter=toprated&filterLanguage=english)); hard content must reward *specific* tactics (inference). **AI clubs must use the same rule format**, as FFXII's and Deadfire's enemies did ([PlayStation Blog](https://blog.playstation.com/?p=192698), [PCGamesN](https://www.pcgamesn.com/pillars-of-eternity-2-deadfire/pillars-of-eternity-ii-companions-custom-ai)).

**Editor sketch proposed in notes 03 §8 (inference; a starting point for the design doc).**
- *Rule:* `WHEN <condition> [AND <condition>] → <action> ON <selector> [ONLY <filter> | PREFER <sort>] [cooldown]`, shown as one sentence ("When an ally is below 40% → Mend → lowest-HP ally, cooldown 6 s"). Only = filter (skipped if nothing qualifies); Prefer = sort (never blocks). NOT on every condition, 10% steps, a visible cooldown field, an unremovable stance fallback.
- *Day-one vocabulary (~10 each):* conditions (my HP < X%, ally HP < X%, enemy in reach, surrounded by ≥ N, ally under attack, opening, focus ≥ X, outnumbered); selectors (nearest, lowest-HP enemy, enemy attacking me, captain's target, backline, densest group, lowest-HP ally, self); actions (attack, ability, advance, kite, guard, protect, mend, consumable, hold, taunt).
- *Advanced:* telegraphs, enemy class, statuses, ally role down, clusters, execute range, distance bands, fight time, hazards; role-based and "not yet targeted" selectors; flank, interrupt, mark, call focus, switch playbook, jump to rule group.
- *Slots and support:* 4 rules + stance on day one, growing free with experience to 8 (traits to 10–12); new vocabulary from coaches, academy and scouting; role templates; an assistant-coach diff that never overwrites locked rules; lint (unreachable rules, no cooldown, friendly-fire risk, near-opposites); copy/paste and export codes ([ResetEra](https://www.resetera.com/threads/unicorn-overlord-ot-ogre-battle-24-the-queens-gambit.824595/page-10), snippet: [guide](https://steamcommunity.com/sharedfiles/filedetails/?id=1392162466), [thread](https://steamcommunity.com/app/47810/discussions/0/2579854400736575780/), [GamingTrend](https://gamingtrend.com/unicorn-overlord-review-for-king-and-country/), [guide](https://steamcommunity.com/sharedfiles/filedetails/?id=2154546931)).

#### A4.2 Fight readability and explaining outcomes

- **Clutter to avoid:** summons, invisible or instant effects, blink units, tiny projectiles ([Set 2 learnings](https://dtcl.vnggames.com/en-us/news/dev/dev-tft-rise-of-the-elements-learnings)); low-contrast art ([reviews](https://steamcommunity.com/app/1530300/reviews/)); models hard to match to portraits ([Riot](https://teamfighttactics.leagueoflegends.com/en-gb/news/dev/splash-art-returns-to-teamfight-tactics/)). Telegraph big abilities; keep disables predictable ([Set 1 learnings](https://www.surrenderat20.net/2019/10/red-post-collection-dev-on-tft-set-1.html)).
- **Explanation tools seen:** TFT's recap ([wiki](https://wiki.leagueoflegends.com/en-us/V12.6_(Teamfight_Tactics))); Eslabong's death summary and orders under HP bars ([Apr–Aug notes](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=3000&enddate=1787961600)); Mechabellum's rewindable replays ([forum](https://forum.quartertothree.com/t/mechabellum-tactical-autobattler-against-other-people/167835)); a third-party Bazaar replay tracker, evidence of unmet demand ([tracker](https://sin.bazaardb.gg/tracker)).
- **Conflict between notes:** notes 03 says no studied game shows an "active rule" indicator ([thread](https://steamcommunity.com/app/560130/discussions/0/1693795812309628406)), but notes 01 shows Eslabong displaying ally orders under HP bars ([Apr–Aug notes](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=3000&enddate=1787961600)); the 03 claim holds only for its RPG/programming games.
- **For us (inference):** speed controls, pause, a duration cap, a recap that answers "why did we lose?", slow motion on key events, and arena-entrance and MVP moments ([Daily Star](https://www.thedailystar.net/shout/game-review/are-you-not-entertained-1558099)).

#### A4.3 Synergies

- Patterns: trait breakpoints ([Wikipedia](https://en.wikipedia.org/wiki/Dota_Auto_Chess)), tribes with targeted offers ([dev post](https://us.forums.blizzard.com/en/hearthstone/t/158955/1)), trigger combos ([glossary](https://superautopets.wiki.gg/wiki/Glossary)), adjacency ([Wikipedia](https://en.wikipedia.org/wiki/Backpack_Battles)), counters instead of traits ([guide](https://finalboss.io/mechabellum-beginner-guide-to-unit-roles-deployment-and)), rows ([HSReplay](https://articles.hsreplay.net/2022/09/23/storybook-brawl-the-perfect-game-for-battlegrounds-players-2/)), class rock-paper-scissors ([reviews](https://steamcommunity.com/app/1043260/positivereviews/?browsefilter=toprated&filterLanguage=english)). Avoid "trait tax" and 100% immunities ([Set 1 learnings](https://www.surrenderat20.net/2019/10/red-post-collection-dev-on-tft-set-1.html)).
- For 3–5 fighters (inference): 2–3-piece tags, pair chemistry that grows with time together, row and adjacency rules, and **gambit combos** (a taunter plus a striker with "IF ally taunting THEN attack lowest-HP enemy"); a squad of 8–12 with 3–5 starters ([Pocket Tactics](https://www.pockettactics.com/teamfight-tactics-design)).

#### A4.4 Economy

- Genre economies are tiny and legible: interest on banked gold and streak bonuses (values vary by patch) ([Mobalytics](https://mobalytics.gg/blog/tft/how-to-manage-your-economy-in-teamfight-tactics-three-strategies/)); flat income ([wiki](https://superautopets.wiki.gg/wiki/The_Basics)); no carry-over ([wiki](https://hearthstone.wiki.gg/wiki/Battlegrounds)); carry-over supply ([Gamepressure](https://www.gamepressure.com/S013-amp.asp?ID=22125)). Greed vs tempo is the core tension, and **every catch-up mechanic gets exploited, then capped** ([ONE Esports](https://www.oneesports.gg/dota-underlords/dota-underlordss-latest-update-caps-winning-and-losing-streaks)) (inference).
- Hybrids: daily wages and desertion ([KeenGamer](https://www.keengamer.com/articles/reviews/battle-brothers-review/)); wages plus a quota ([reviews](https://steamcommunity.com/app/276810/negativereviews/?browsefilter=toprated&filterLanguage=english)); early scarcity and entry fees ([reviews](https://steamcommunity.com/app/4560660/negativereviews/?browsefilter=toprated&filterLanguage=english)). The typical arc is pressure early that collapses by season 4 ([forum](https://steamcommunity.com/app/4560660/discussions/0/570426530135597095/)), so dynasties need costs that scale with success ([Wikipedia](https://en.wikipedia.org/wiki/Blood_Bowl)) and money sinks with real decisions (inference).

#### A4.5 Progression and attachment

- Lobby games keep power in-run and meta-progression cosmetic; paid heroes and packs are the most-criticised exception ([Vaporlens](https://vaporlens.app/app/1714040/super_auto_pets.md), [reviews](https://steamcommunity.com/app/1617400/reviews/)). For us the club *is* the meta-progression, earned in-world (inference).
- Attachment comes from origin stories ([store](https://store.steampowered.com/app/365360/Battle_Brothers/)), rare finds ([reviews](https://steamcommunity.com/app/4560660/reviews/?browsefilter=mostrecent&filterLanguage=english)), career records ([Sep–Oct patches](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=1500)), persistent wounds ([reviews](https://steamcommunity.com/app/276810/positivereviews/?browsefilter=toprated&filterLanguage=english)) and specialisation ([review](https://gideonsgaming.com/team-fight-manager-review-needs-a-little-coaching)); quick revives and "replacement beats training" weaken it ([reviews](https://steamcommunity.com/app/1043260/positivereviews/?browsefilter=toprated&filterLanguage=english), [review](https://gideonsgaming.com/team-fight-manager-review-needs-a-little-coaching)). Our academy and potential system is the main attachment engine (inference).

#### A4.6 Randomness versus skill

- **Works:** opt-in or predictable randomness ([Set 1 learnings](https://www.surrenderat20.net/2019/10/red-post-collection-dev-on-tft-set-1.html)); choice-of-3 offers and rerolls ([BlueStacks](https://www.bluestacks.com/blog/game-guides/dota-underlords/dotaul-season-1-update-en.html)); visible odds ([SeeMeta](https://seemeta.com/en/tft/set-18/odds)); full opponent information ([guide](https://finalboss.io/mechabellum-beginner-guide-to-unit-roles-deployment-and)); relevance-guaranteed offers ([dev post](https://us.forums.blizzard.com/en/hearthstone/t/158955/1)).
- **Fails:** random punishers and random targets ([Set 2 learnings](https://dtcl.vnggames.com/en-us/news/dev/dev-tft-rise-of-the-elements-learnings)); matchmaking that feels rigged ([Vaporlens](https://vaporlens.app/app/2427700/backpack_battles.md)); async reroll cheating ([reviews](https://steamcommunity.com/app/2427700/reviews/)); irreversible losses to miss streaks ([reviews](https://steamcommunity.com/app/365360/negativereviews/?browsefilter=toprated&filterLanguage=english)). A long season averages variance; cups concentrate it (inference).
- **Conflict on "deterministic":** notes 02/03 recommend a seeded, reproducible sim; notes 05 lists "solvable, deterministic sims" as its #2 pitfall, because fixed tyre wear made Motorsport Manager arithmetic ([reviews](https://steamcommunity.com/app/415200/negativereviews/?browsefilter=toprated)). Reproducible-from-a-seed is not the same as constant and solvable: keep seeded variance, hidden per-arena variables and opponent variety (inference).

#### A4.7 Match length and fight length

| Game | Fight / match | Season |
|---|---|---|
| TFT; Auto Chess | ~30–35 min ([GamesBeat](https://gamesbeat.com/teamfight-tactics-turns-7-riot-games-discusses-lessons-learned-and-the-road-ahead-exclusive-interview/)); 40+ min with a big pool ([Inven Global](https://www.invenglobal.com/articles/7962/a-rare-glimpse-behind-the-creation-of-auto-chess)) | — |
| Underlords; Mechabellum | 10–15-min knockout ([review](https://www.highgroundgaming.com/dota-underlords-review/)); ~15 min ([reviews](https://steamcommunity.com/app/669330/reviews/)) | — |
| Backpack Battles; Battlegrounds | 10–20-s fights ([Wikipedia](https://en.wikipedia.org/wiki/Backpack_Battles)); combat can stall a lobby 3+ min ([forum](https://us.forums.blizzard.com/en/hearthstone/t/battlegrounds-animation-issues/135955)) | — |
| TFM1; TFM2 | ~1-min fights ([review](https://gideonsgaming.com/team-fight-manager-review-needs-a-little-coaching)); ~9–12 min (aggregate) ([Vaporlens](https://vaporlens.app/app/3009300/teamfight_manager_2.md)) | "too many games" ([reviews](https://steamcommunity.com/app/1372810/negativereviews/?browsefilter=toprated&filterLanguage=english)); 10–20 h (aggregate) ([Vaporlens](https://vaporlens.app/app/3009300/teamfight_manager_2.md)) |
| Eslabong | rounds; 60-s sudden death in 1v1 ([Apr–Aug notes](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=3000&enddate=1787961600)) | ~40 matches (playtest) ([Apr–Aug notes](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=3000&enddate=1787961600)) |

Short fights are praised, but a season of them tires players unless non-essential matches can be skipped ([reviews](https://steamcommunity.com/app/1372810/negativereviews/?browsefilter=toprated&filterLanguage=english), [forum search](https://steamcommunity.com/app/4560660/discussions/search/?q=rounds&gidforum=0)). Notes 02 suggests (inference) **~20–45 s per fight at 1x and a 5–10-minute matchday**.

#### A4.8 Spectating, replays and intervention

- Replays exist in Mechabellum ([forum](https://forum.quartertothree.com/t/mechabellum-tactical-autobattler-against-other-people/167835)) and Underlords ([Wikipedia](https://en.wikipedia.org/wiki/Dota_Underlords)); a deterministic sim makes them nearly free (seed plus inputs) (inference).
- Intervention ranges from none (Unicorn Overlord, Gladiabots) ([Game Informer](https://gameinformer.com/review/unicorn-overlord/tactical-superiority)) through per-rule toggles (FFXII) ([Gamer Guides](https://gamerguides.com/final-fantasy-xii/guide/basics/gameplay-mechanics/battle-system)), pause-and-cast (Deadfire) ([thread](https://steamcommunity.com/app/560130/discussions/0/1693795812309628406)), controlling one fighter (Origins, Eslabong) ([thread](https://steamcommunity.com/app/47810/discussions/0/1319961868324922289), [devblogs](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=5&maxlength=0&enddate=1777766400)) and playbook switches (FFXIII) ([Jegged](https://jegged.com/Games/Final-Fantasy-XIII/Paradigms/Paradigm-Explanation.html)) to edits between rounds ([Apr–Aug notes](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=3000&enddate=1787961600), [guide](https://finalboss.io/mechabellum-beginner-guide-to-unit-roles-deployment-and)). Forced automation without override drew backlash in Dragon Quest IV ([DQ wiki](https://dragon-quest.org/wiki/Artificial_Intelligence)).
- No-timer async is the most-loved low-stress format ([store](https://store.steampowered.com/app/1714040/Super_Auto_Pets/), [reviews](https://steamcommunity.com/app/1617400/reviews/)); some Mechabellum players prefer bots ([reviews](https://steamcommunity.com/app/669330/reviews/)), a supportive signal for single-player (inference). Let players skip matches they are not in ([reviews](https://steamcommunity.com/app/1372810/negativereviews/?browsefilter=toprated&filterLanguage=english)).

#### A4.9 Translating lobby mechanics to a single-player league

All rows are inference from notes 02 unless a source is given.

| Lobby mechanic | League analogue | Guardrail |
|---|---|---|
| Interest on banked gold ([Mobalytics](https://mobalytics.gg/blog/tft/how-to-manage-your-economy-in-teamfight-tactics-three-strategies/)) | Capped reserve dividend; facility investments that pay over seasons | Wage inflation makes hoarding costly |
| Loss-streak gold ([ONE Esports](https://www.oneesports.gg/dota-underlords/dota-underlordss-latest-update-caps-winning-and-losing-streaks)) | Parachute payments, underdog prize pot, cheaper loans | Always worth less than winning |
| Shared draft, lowest picks first ([Wikipedia](https://en.wikipedia.org/wiki/Teamfight_Tactics)) | Youth draft in reverse-standings order | Order visible in advance |
| Shop reroll and freeze ([wiki](https://superautopets.wiki.gg/wiki/The_Basics)) | Scout-days refresh the prospect pool; a fee holds a prospect | Scout time is the currency; holds expire |
| Shop odds by level ([SeeMeta](https://seemeta.com/en/tft/set-18/odds)) | Scouting network, region and tier set the odds of seeing top talent | Odds always visible |
| Shared piece pool ([Wikipedia](https://en.wikipedia.org/wiki/Dota_Auto_Chess)) | AI clubs chase the same targets and push prices up | AI never targets the player reactively ([thread](https://steamcommunity.com/app/2427700/discussions/0/4203616558110689260)) |
| Level = units on board | Team size by tier (3v3 → 5v5) | See C3.4 |
| Pick-1-of-3 modifiers; anomalies ([BlizzardWatch](https://blizzardwatch.com/2023/09/12/anomalies-hearthstone-battlegrounds-season-5/)) | Season-start strategy or staff pick; season modifiers | One option guaranteed relevant ([dev post](https://us.forums.blizzard.com/en/hearthstone/t/158955/1)) |
| Ghost opponents ([store](https://store.steampowered.com/app/1714040/Super_Auto_Pets/)) | AI clubs with persistent, scoutable styles | — |
| Elimination | League points, relegation, "N wins before K losses" cups ([wiki](https://superautopets.wiki.gg/wiki/The_Basics)) | — |

The "see the result, adapt, fight again" loop survives inside one fixture if a match is a short series of rounds with edits between them ([guide](https://finalboss.io/mechabellum-beginner-guide-to-unit-roles-deployment-and)) (inference).

#### A4.10 Development and reception lessons

- Patch speed is loved as responsiveness ([reviews](https://steamcommunity.com/app/4560660/positivereviews/?browsefilter=toprated&filterLanguage=english)) and resented as churn ([reviews](https://steamcommunity.com/app/4560660/negativereviews/?browsefilter=toprated&filterLanguage=english)); TFT learned to change less per patch ([Set 1 learnings](https://www.surrenderat20.net/2019/10/red-post-collection-dev-on-tft-set-1.html)).
- What sank games here: visible AI stupidity and opacity ([Vaporlens](https://vaporlens.app/app/3009300/teamfight_manager_2.md)); missing predecessor features plus monetisation ([Wikipedia](https://en.wikipedia.org/wiki/Blood_Bowl_3)); perceived abandonment ([reviews](https://steamcommunity.com/app/1043260/negativereviews/?browsefilter=toprated&filterLanguage=english), [thread](https://steamcommunity.com/app/1046930/discussions/0/5168416410407459322)); developer conduct ([Wikipedia](https://en.wikipedia.org/wiki/Domina_(video_game))); ownership and servers ([Decrypt](https://decrypt.co/137875/ftx-sam-bankman-fried-storybook-brawl-video-game-shutting-down)). Suspected AI-generated text is an emerging trust complaint ([reviews](https://steamcommunity.com/app/4560660/negativereviews/?browsefilter=toprated&filterLanguage=english), [reviews](https://steamcommunity.com/app/3009300/negativereviews/?browsefilter=toprated&filterLanguage=english)).

## 4. Part B — Sports management and career modes

### B1. Per-game notes

#### B1.1 Football Manager (main management reference)

**Key facts:** Sports Interactive / SEGA; premium annual release. FM25 was cancelled in Feb 2025 ([Wikipedia](https://en.wikipedia.org/wiki/Football_Manager_26)); FM26 (Nov 2025, first on Unity) is **Mostly Negative: 38% of ~9,435, recovering to 64% of 247 in the last 30 days (Oct 2026)**, against FM24's 92% of 11,656 ([store](https://store.steampowered.com/app/3551340/Football_Manager_26/), [store](https://store.steampowered.com/app/2252570/Football_Manager_2024/)), though it still reached ~8M players ([Wikipedia](https://en.wikipedia.org/wiki/Football_Manager_26)). FM27 is due 10 Nov 2026; its features below are announcements ([FM Scout](https://www.fmscout.com/a-football-manager-2027-new-features.html)).

**State of the series.** FM25's front end was clunky and not fun even though the simulation largely worked ([FM Scout](https://www.fmscout.com/a-miles-jacobson-explains-fm25-cancellation-and-fm26-plans.html)). All 10 top-rated negative FM26 reviews cite the UI (clutter, more clicks, buried information), and most cite removed features ([reviews](https://steamcommunity.com/app/3551340/negativereviews/?browsefilter=toprated&filterLanguage=english)). FM27 is a usability correction: grouped messages, restored features, and **"continue flow" presets** (streamlined / balanced / comprehensive / custom) that set how often the game stops ([FM Scout](https://www.fmscout.com/a-football-manager-2027-new-features.html)).

1. **Fun/sticky:** a long-horizon story you author, such as taking a small club up the pyramid ([reviews](https://steamcommunity.com/app/2252570/positivereviews/?browsefilter=toprated&filterLanguage=english)); nested weekly, monthly and yearly loops, so something is always about to resolve (inference); discovery under fog ([guide](https://www.passion4fm.com/football-manager-player-attributes/)); the slow lower-league climb ([FM Scout](https://www.fmscout.com/a-basic-guide-to-lower-league-management-llm.html)).
2. **Adopt:**
   - **Attribute masking:** unknown attributes show as ranges (e.g. 11–16) that narrow with scouting, regional knowledge or playing against the player; a per-player knowledge %; hidden traits (consistency, injury proneness) appear as pros/cons only after extensive scouting ([guide](https://www.passion4fm.com/football-manager-player-attributes/)).
   - **Two-axis scouts** (judging current ability vs potential) plus per-nation knowledge that makes them faster and more accurate at home ([guide](https://www.passion4fm.com/?p=1127); search result only: [guide](https://www.passion4fm.com/?p=964)). Knowledge **fades** as new youngsters appear and scouts roam (FM22-era guide), and **scouting range is a budget tier**, often just your own division at small clubs ([guide](https://www.passion4fm.com/?p=1127)).
   - **Briefs, not clicks:** a standing recruitment focus returns A–F graded players ([Diamond Lobby](https://diamondlobby.com/football-manager-2023/fm23-scouting-guide/)); FM26 "requirements" adverts bring offers to you ([FM Scout](https://www.fmscout.com/a-fm26-recruitment-revamp.html)); FM27 adds a "fits your tactic" gauge ([FM Scout](https://www.fmscout.com/a-football-manager-2027-new-features.html)).
   - **Stars are opinions,** relative to your squad and different per staff member; "black" stars mark uncertain potential ([FM Scout](https://www.fmscout.com/a-current-and-potential-ability-guide-2022.html), [FM Scout](https://www.fmscout.com/a-black-stars-in-scouting-reports.html)).
   - **An annual youth intake with a preview,** shaped by nation, facilities and the youth head's personality and style ([Passion4FM](https://www.passion4fm.com/youth-intake-guide-how-clubs-produce-newgens/)); readable squad hierarchies ([Game Informer](https://gameinformer.com/b/features/archive/2017/11/06/the-sports-desk-inside-the-dynamics-of-football-manager-2018)); delegation by responsibility (search result only) ([official](https://footballmanager.com/node/673)).
3. **Loved:** emergent long-save stories ([reviews](https://steamcommunity.com/app/2252570/positivereviews/?browsefilter=toprated&filterLanguage=english)); tactical depth that even FM26's harshest critics praise ([reviews](https://steamcommunity.com/app/3551340/negativereviews/?browsefilter=toprated&filterLanguage=english)); wonderkid hunting (search result only) ([Sortitoutsi](https://sortitoutsi.net/content/63677/fm24-youth-development-guide-mentoring-and-training-wonderkids)).
4. **Complaints:** **UI friction kills goodwill faster than missing depth** (same core, 92% → 38%) ([reviews](https://steamcommunity.com/app/3551340/negativereviews/?browsefilter=toprated&filterLanguage=english), [store](https://store.steampowered.com/app/2252570/Football_Manager_2024/)); press-conference and news noise, and a solved meta, with a critic proposing scout reports stay vague even after full scouting ([Substack](https://fmprojects.substack.com/p/make-football-manager-great-again)); irrational AI transfers and wage spikes after promotion ([reviews](https://steamcommunity.com/app/2252570/negativereviews/?browsefilter=toprated&filterLanguage=english)); restarts after ~6–10 seasons (search result only) ([forum](https://www.fmscout.com/q-3898-What-happens-in-the-end.html)). Lighter editions show how to cut busywork: Touch drops press conferences, per reader comments ([Nintendo Life](https://www.nintendolife.com/news/2018/04/football_manager_touch_2018_kicks_off_today_on_nintendo_switch)); Classic ran a season in ~7–10 h on the same simulation, with half-season challenges ([Wikipedia](https://en.wikipedia.org/wiki/Football_Manager_2013)); Mobile offers crisis scenarios ([Pocket Tactics](https://www.pockettactics.com/football-manager-2020-mobile/review)).
5. **Ideas for us:** per-stat ranges and a knowledge meter per fighter and region (fewer stats than FM, so wider, readable ranges); scouts with "read skill" and "read talent", home regions and a limited calendar, sent on timed tours; standing briefs returning a weekly A–F digest with a "fits your gambits" flag checked against the player's actual rules; an annual trials day for youth with a preview; pacing presets (how often the game stops) from day one.

#### B1.2 Out of the Park Baseball (OOTP)

**Key facts:** Out of the Park Developments; annual since 1999; OOTP 27 (Mar 2026) **82% of 537** ([store](https://store.steampowered.com/app/4045750/Out_of_the_Park_Baseball_27)).

1. **Fun/sticky:** a living universe at any scale, historical or fictional, with full delegation and numbers that tell stories ([reviews](https://steamcommunity.com/app/3116890/positivereviews/?browsefilter=toprated&filterLanguage=english)).
2. **Adopt:** **one scouting director instead of a scout army** (2008 redesign), with a style bias from "favour ability" to "favour raw tools", a budget split four ways and ratings that change at report dates; the abstraction cut league file size by 80% ([newsletter](https://www.ootpdevelopments.com/newsletters/nl0043/)). **AI clubs scout imperfectly too**, so their offers are hard to read ([newsletter](https://www.ootpdevelopments.com/newsletters/nl0043/)). An explicit error model with more error for young and international players (search result only) ([dev guide](https://forums.ootpdevelopments.com/showthread.php?p=5188669)). A confidence value per report plus a neutral yearly baseline ([blog](https://baseballreplayjournal.substack.com/p/scouting-in-ootp)). A development Lab with individual programs ([Game Developer](https://www.gamedeveloper.com/press-release/out-the-park-baseball-25-takes-the-field-with-all-new-innovative-features-in-the-award-winning-baseball-strategy-game-now-available-worldwide)) for a couple of players per offseason (search result only) ([Scribd](https://www.scribd.com/document/740974558/changes)), whose 2.0 version added **progress bars, mid-term reports and early withdrawal** (search result only) ([review](https://www.sportsgamersonline.com/news/reviews/out-of-the-park-baseball-26-review-a-baseball-nerds-dream/)).
3. **Loved:** depth, the GM role and customisation ([reviews](https://steamcommunity.com/app/3116890/positivereviews/?browsefilter=toprated&filterLanguage=english)); a pre-draft combine (search result only) ([review](https://www.sportsgamersonline.com/news/reviews/out-of-the-park-baseball-26-review-a-baseball-nerds-dream/)).
4. **Complaints:** an online card mode accused of draining development ([reviews](https://steamcommunity.com/app/3116890/negativereviews/?browsefilter=toprated&filterLanguage=english)); scouting that confuses next to FM's clear fog, with ratings shifting overnight when the director changes ([blog](https://baseballreplayjournal.substack.com/p/scouting-in-ootp)); Lab programs that mostly lowered ratings or injured players (search result only) ([review](https://www.sportsgamersonline.com/news/reviews/out-of-the-park-baseball-26-review-a-baseball-nerds-dream/)); save bloat and AI releasing prospects ([reviews](https://steamcommunity.com/app/3116890/negativereviews/?browsefilter=toprated&filterLanguage=english)).
5. **Ideas for us:** a neutral registry's free, low-accuracy yearly read on every fighter; scouts biased toward "proven" or "raw"; a hidden development pace; academy programs with mid-term recall; AI clubs that misprice fighters.

#### B1.3 Hattrick

**Key facts:** browser MMO since 1997; free, with a subscription giving **no competitive advantage**; still above 200k players in 2025/26; 16-week seasons ([Wikipedia](https://en.wikipedia.org/wiki/Hattrick_(video_game)), [arXiv](https://arxiv.org/abs/2504.09499)).

1. **Fun/sticky:** one or two matches a week, players aging a year every 112 days, and users staying for decades ([arXiv](https://arxiv.org/abs/2504.09499), [Trustpilot](https://au.trustpilot.com/review/hattrick.org)); 8-team groups, 14 rounds ([German Wikipedia](https://de.wikipedia.org/wiki/Hattrick_(Computerspiel))); undocumented mechanics fuel a research community ([arXiv](https://arxiv.org/abs/2504.09499)).
2. **Adopt:** **word tiers instead of numbers** (21 steps) and **specialties with drawbacks** that trigger match events ([Swedish Wikipedia](https://sv.wikipedia.org/wiki/Hattrick_(datorspel)), [arXiv](https://arxiv.org/abs/2504.09499)); readable sector ratings ([arXiv](https://arxiv.org/abs/2504.09499)); one team-wide training type per week that only helps players in the trained position ([Swedish Wikipedia](https://sv.wikipedia.org/wiki/Hattrick_(datorspel))), with growth slowing after ~21 and decaying after ~28 (search result only) ([TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/HatTrick)); youth potential inferred from coach comments ([Youthclub](https://hattrick-youthclub.org/)); a pyramid of up to 11 tiers with playoffs and a cup where the weaker side plays at home; two weeks to clear debt or be deleted ([German Wikipedia](https://de.wikipedia.org/wiki/Hattrick_(Computerspiel))).
3. **Loved:** long-term strategy, community, free play that stays competitive ([Trustpilot](https://au.trustpilot.com/review/hattrick.org)).
4. **Complaints:** little happens between matches; results feel random; market inflation ([Trustpilot](https://au.trustpilot.com/review/hattrick.org)); lower divisions fill with bots and passive teams ([arXiv](https://arxiv.org/abs/2504.09499)).
5. **Ideas for us:** word-tier stats with hidden sub-progress ("Seasoned (+)"); specialty traits with drawbacks; sector-style ratings before a bout; 8-team divisions; an underdog-home cup; weekly scout "calls" of one prospect.

#### B1.4 Madden NFL Franchise

**Key facts:** EA Sports / EA Tiburon; Madden 27 (Aug 2026) on consoles; PC availability not verified ([EA](https://www.ea.com/games/madden-nfl/madden-nfl-27/news/madden-27-franchise-mode)).

1. **Fun/sticky:** a weekly plan-play-react loop; contextual prompts you can delegate to staff; an hour-by-hour free-agency frenzy; 65+ personality types driving holdouts and negotiation ([EA](https://www.ea.com/games/madden-nfl/madden-nfl-27/news/madden-27-franchise-mode), [Operation Sports](https://www.operationsports.com/madden-nfl-27-franchise-mode-details-revealed/)).
2. **Adopt:** **legible scouting thresholds**: each prospect's knowledge % reveals physicals at 1%, traits at 10%, one attribute per further 10% as a letter grade, the archetype at 70% and the true talent range at 100% ([MUT.GG](https://www.mut.gg/news/madden-nfl-22-scouting-update-deep-dive/)); a hidden development tier revealed by playing time (search result) ([Diamond Lobby](https://diamondlobby.com/madden-24/madden-24-player-dev-trait-guide/)); a league-wide regression report (search result) ([EA Help](https://help.ea.com/en/articles/madden-nfl/progression-regression-franchise-mode/)).
3. **Loved:** long-requested realism ([EA](https://www.ea.com/games/madden-nfl/madden-nfl-27/news/madden-27-franchise-mode)); negotiation ([ClutchPoints](https://clutchpoints.com/gaming/madden-27-review)); a news ticker surfacing league moves ([Smashpad](https://smashpad.com/madden-nfl-27-review/)).
4. **Complaints:** years of neglect ([Game Informer](https://www.gameinformer.com/index.php/2020/08/03/ea-sports-updates-fans-on-its-vision-for-maddens-franchise-mode)); an Aug 2026 patch listing open CPU failures (unrecoverable cap deficits, thin depth, illogical retirements) ([EA update](https://www.ea.com/games/madden-nfl/madden-nfl-27/news/m27-title-update-august-26-2026)); holdouts "executed pretty poorly" ([ClutchPoints](https://clutchpoints.com/gaming/madden-27-review)); trades flipped by small add-ons ([Madden School](https://www.madden-school.com/the-new-madden-21-trade-logic-is-still-hilariously-broken-here-are-some-examples/)).
5. **Ideas for us:** knowledge % with fixed reveal steps; talent tier hidden until N matches, then a reveal event (inference); delegable weekly prompts; mercenary holdouts with **visible** mood thresholds.

#### B1.5 College Football Dynasty (CFB 25/26/27; NCAA Football 14 benchmark)

**Key facts:** EA Sports / EA Orlando; CFB 27 (July 2026); console only in the sources ([EA](https://www.ea.com/games/ea-sports-college-football/college-football-27/news/college-football-27-dynasty)).

1. **Fun/sticky:** **recruiting as a weekly hours budget** scaled by prestige, spent on priced actions that reveal what each recruit cares about across 14 categories ([Uproxx](https://uproxx.com/?p=404163987); search result: [esports.gg](https://esports.gg/news/college-football-25/cfb-25-recruiting-guide-5-tips-to-getting-a-1-ranked-signing-class/)); gem/bust flags after full scouting; tiers hidden until signing day (search result) ([Prima](https://primagames.com/gaming/ea-college-football-25-development-traits-best-traits-how-they-work-and-how-to-unlock)); 30-year dynasties ([Uproxx](https://uproxx.com/?p=404163987)).
2. **Adopt:** commitment stages (open → top 5 → top 3 → verbal → hard commit) with flips; one non-rolling annual budget; overpaying sets a recruit's new price floor; a "risk of leaving" column with reasons; weekly practice plans trading XP against injury; an athletic director with escalating goals ([EA](https://www.ea.com/games/ea-sports-college-football/college-football-27/news/college-football-27-dynasty)); dealbreakers that shift with development ([CBS](https://www.cbssports.com/college-football/news/ea-sports-college-football-26-dynasty-mode-deep-dive-exploring-the-biggest-changes-and-updates)).
3. **Loved:** intense recruiting and small-school realism ([Uproxx](https://uproxx.com/?p=404163987)); NCAA 14's simpler points pool with carryover kept the strategy ([Engadget](https://www.engadget.com/2013-05-29-ncaa-14-dynasty-mode-levels-up-with-coach-skills-recruiting-cha.html), [Game Informer](https://gameinformer.com/games/ncaa_football_14/b/xbox360/archive/2013/07/09/ncaa-14-review-not-the-complete-product)).
4. **Complaints:** launch exploits and broken gating (locked out of recruits while ranked first) ([Dexerto](https://www.dexerto.com/gaming/college-football-25-august-8-patch-notes-2855263/), [Uproxx](https://uproxx.com/?p=404163987)); too many sim upsets (search result) ([Sportskeeda](https://www.sportskeeda.com/college-football/10-biggest-issues-ea-sports-college-football-25-post-release)); paid bonus points ([EA](https://www.ea.com/games/ea-sports-college-football/college-football-27/news/college-football-27-dynasty)). Portal size differs within the notes: ~2,000 a year vs "up to 3,500" ([CBS](https://www.cbssports.com/college-football/news/ea-sports-college-football-26-dynasty-mode-deep-dive-exploring-the-biggest-changes-and-updates), [EA](https://www.ea.com/en/games/ea-sports-college-football/college-football-26/features/cfb26-dynasty)).
5. **Ideas for us:** a weekly contacts budget shared by scouting and recruiting; three motivations per mercenary (gold, glory, home region, starting slot…) with a possible dealbreaker and a guild grade per motivation; "risk of leaving" before contracts expire; weekly training intensity.

#### B1.6 NBA 2K MyNBA / MyGM

**Key facts:** 2K / Visual Concepts; NBA 2K27 (Sept 2026) on consoles and PC, though PC has had the current-gen version only since 2K25 ([2K](https://nba.2k.com/2k27/features/mynba/); search result: [2K FAQ](https://nba.2k.com/2k25/pc-faq/)).

1. **Fun/sticky:** eras and 100-year franchises, including a dynasty whose descendants inherit traits; friendships and rivalries from shared history, with small boosts for close pairs ([2K](https://nba.2k.com/2k27/features/mynba/), [2K Newsroom](https://newsroom.2k.com/news/nbar-2k27-mynba-answers-the-community-with-a-back-to-basics-franchise-overhaul-and-modern-cba-rules)).
2. **Adopt:** **GM Trust** (starts at 50; kept promises raise it, dumping contracts lowers it, and low trust makes promises worth less) ([2K](https://nba.2k.com/2k27/features/mynba/), [Operation Sports](https://www.operationsports.com/nba-2k27-mynba-details-revealed/)); sim presets trading AI reasoning for speed and owner goals that earn facility points ([2K Newsroom](https://newsroom.2k.com/news/endless-possibilities-await-as-mynba-levels-up-in-nbar-2k26)); a scoring system that rewards rebuilding ([Game Informer](https://www.gameinformer.com/preview/2019/07/28/nba-2k20-introduces-big-changes-for-the-mygm-and-myleague-modes)).
3. **Loved:** a "back to basics" year of community fixes ([2K Newsroom](https://newsroom.2k.com/news/nbar-2k27-mynba-answers-the-community-with-a-back-to-basics-franchise-overhaul-and-modern-cba-rules)); 20 optional hardship modifiers ([2K](https://nba.2k.com/2k27/features/mynba/)).
4. **Complaints:** underinvestment versus monetised modes (an author's inference) and long-save bugs ([Fadeaway World](https://fadeawayworld.net/nba-2k/nba-2k22-had-a-massive-bug-where-free-agents-in-mynba-became-99-years-old)); action points that could block playing a game (search result) ([NLSC](https://forums.nba-live.com/viewtopic.php?p=1979282)).
5. **Ideas for us:** a 0–100 guild trust behind promises; bonded pairs that unlock a buff and a gambit condition ("IF bonded ally below 30% HP THEN guard"); fast/thorough presets for headless sims; never spend an action budget on playing matches.

#### B1.7 NHL Franchise Mode

**Key facts:** EA Sports / EA Vancouver; NHL 27 (Sept 2026); scouting dates from NHL 19 (2018), largely unchanged ([Hardcore Gamer](https://hardcoregamer.com/nhl-27-review/), [Game Informer](https://www.gameinformer.com/preview/2018/08/17/nhl-19-franchise-mode-interview-learn-the-nitty-gritty-details-about-the-new)).

1. **Fun/sticky:** fog-of-war scouting: up to 20 scouts that AI teams compete to hire; pairing two in a region merges reports for accuracy at a coverage cost; scouts improve by staying put; gems and busts are always accurate once found, and auto-scouting finds ~3 while manual finds more ([Game Informer](https://www.gameinformer.com/preview/2018/08/17/nhl-19-franchise-mode-interview-learn-the-nitty-gritty-details-about-the-new)); potential tiers with a low/medium/high **certainty** label ([Diamond Lobby](https://diamondlobby.com/nhl-23/how-potential-works-nhl-23-franchise-mode/)).
2. **Adopt:** opponent intel decays over 30–60 days and contact refreshes it; junior minutes drive growth and **sending a prospect down blocks recall**; readable CPU draft logic ([Game Informer](https://www.gameinformer.com/preview/2018/08/17/nhl-19-franchise-mode-interview-learn-the-nitty-gritty-details-about-the-new)).
3. **Loved:** NHL 19's scouting ([Game Informer](https://www.gameinformer.com/preview/2018/08/17/nhl-19-franchise-mode-interview-learn-the-nitty-gritty-details-about-the-new)); small touches like waiver claims ([Hardcore Gamer](https://hardcoregamer.com/nhl-27-review/)).
4. **Complaints:** stagnation ([Hardcore Gamer](https://hardcoregamer.com/nhl-27-review/), [Best Buy](https://blog.bestbuy.ca/video-games/nhl-26-review)); an online mode with no CPU teams, draft or aging ([Hardcore Gamer](https://hardcoregamer.com/nhl-27-review/)); elite prospects stalling, especially on CPU teams (search result) ([EA forums](https://forums.ea.com/discussions/nhl-26-general-discussion-en/prospects-in-ahl/13553974)).
5. **Ideas for us:** scout pairing and home-region growth; matches refresh intel; potential, certainty and accuracy as separate values; the academy as a juniors-style lock; AI developing prospects under the same rules.

#### B1.8 Motorsport Manager

**Key facts:** Playsport Games (began as a solo mobile game); PC 2016 ([Wikipedia](https://en.wikipedia.org/wiki/Motorsport_Manager)); **90% of 5,196 (25 Oct 2026)**, Metacritic 81 ([store](https://store.steampowered.com/app/415200/Motorsport_Manager/)); a PC sequel is due in 2027 with day-one mods ([Game Developer](https://www.gamedeveloper.com/press-release/motorsport-manager-2-announced-playsport-returns-to-the-pit-wall-with-the-next-chapter-in-the-legendary-motorsport-management-series)).

1. **Fun/sticky:** race weekends you watch and steer, with pause, auto-pause on decisions and speed-up ([Game Informer](https://gameinformer.com/b/features/archive/2016/08/15/the-sports-desk-behind-the-wheel-of-motorsport-manager)); emergent race stories and the climb ([reviews](https://steamcommunity.com/app/415200/positivereviews/?browsefilter=toprated)).
2. **Adopt:** **"set and watch" was cut** after playtesters disengaged (a 2014 article on a playtest before the PC release); letting players queue only the *next* pit stop kept them reading the race; labelled buttons replaced sliders; paid, to avoid pay-to-win ([Game Developer](https://gamedeveloper.com/design/making-formula-1-accessible-with-i-motorsport-manager-i-)). Drivers peak and decline; rivals bribe for rule votes ([RaceFans](https://www.racefans.net/2016/08/10/meeting-man-behind-motorsport-manager/)); a three-tier ladder with promotion on by default ([Game Informer](https://gameinformer.com/b/features/archive/2016/08/15/the-sports-desk-behind-the-wheel-of-motorsport-manager)).
3. **Loved:** excitement without chores; talent hunting; mods ([reviews](https://steamcommunity.com/app/415200/positivereviews/?browsefilter=toprated)).
4. **Complaints:** solved too fast (fixed tyre wear) and repeating events ([reviews](https://steamcommunity.com/app/415200/negativereviews/?browsefilter=toprated)); **AI falls behind**, "seriously easy" after ~50 h ([reviews](https://steamcommunity.com/app/415200/positivereviews/?browsefilter=toprated)); **promotion shock** (a ~800k budget drop, targets from the old tier) ([thread](https://steamcommunity.com/app/415200/discussions/0/133256758576774722), [thread](https://steamcommunity.com/app/415200/discussions/0/142261352661385160)); long-unfixed bugs and season-6 crashes ([reviews](https://steamcommunity.com/app/415200/negativereviews/?browsefilter=toprated)).
5. **Ideas for us:** 1–3 timed calls per bout shown as one queued action; configurable auto-pause; hidden per-arena variables so strategy never collapses to a constant; tier regulations and lobbying; fixed and bonus patrons.

### B2. Cross-cutting themes for Part B

#### B2.1 Scouting systems, and how to make scouting fun

| Model | Example | Strength | Risk |
|---|---|---|---|
| Per-stat ranges + knowledge % | FM ([guide](https://www.passion4fm.com/football-manager-player-attributes/)) | Most legible fog | Many screens if stats are many |
| Fixed reveal steps by knowledge % | Madden ([MUT.GG](https://www.mut.gg/news/madden-nfl-22-scouting-update-deep-dive/)) | Every scouting hour visibly pays | Can feel mechanical |
| Potential tier + certainty + accuracy | NHL ([Diamond Lobby](https://diamondlobby.com/nhl-23/how-potential-works-nhl-23-franchise-mode/)) | Uncertainty stated honestly | Three values to learn |
| Error-model view + confidence + neutral baseline | OOTP ([blog](https://baseballreplayjournal.substack.com/p/scouting-in-ootp)) | Realistic disagreement | Confusing when sources are unclear |
| Word tiers + coach comments | Hattrick ([Youthclub](https://hattrick-youthclub.org/)) | Flavourful | Hard to compare |
| Money and capacity only | Eslabong ([Apr–Aug notes](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=3000&enddate=1787961600)) | Simple | No routing decisions |

- **Scouts:** FM splits judging ability from judging potential and adds per-nation knowledge ([guide](https://www.passion4fm.com/?p=1127)); OOTP abstracts a department into one biased director ([newsletter](https://www.ootpdevelopments.com/newsletters/nl0043/)); NHL scouts grow in their home region and can be paired ([Game Informer](https://www.gameinformer.com/preview/2018/08/17/nhl-19-franchise-mode-interview-learn-the-nitty-gritty-details-about-the-new)).
- **Knowledge over time:** FM knowledge fades as intakes arrive and scouts roam ([guide](https://www.passion4fm.com/?p=1127)); NHL intel decays over 30–60 days and contact refreshes it ([Game Informer](https://www.gameinformer.com/preview/2018/08/17/nhl-19-franchise-mode-interview-learn-the-nitty-gritty-details-about-the-new)); a new OOTP director resets the lens ([blog](https://baseballreplayjournal.substack.com/p/scouting-in-ootp)).
- **Making scouting fun** (notes 04 §4.10, notes 05 §6.1):
  1. Give orders, get digests: standing briefs beat clicking fighters one by one ([FM Scout](https://www.fmscout.com/a-fm26-recruitment-revamp.html), [Diamond Lobby](https://diamondlobby.com/football-manager-2023/fm23-scouting-guide/)).
  2. Scouts are characters with opinions; disagreement is content ([newsletter](https://www.ootpdevelopments.com/newsletters/nl0043/)).
  3. Make uncertainty pay: AI clubs scout imperfectly, so better information beats the market ([newsletter](https://www.ootpdevelopments.com/newsletters/nl0043/)).
  4. Ration time and place, and stage reveal moments such as signing day or a talent reveal after N games ([guide](https://www.passion4fm.com/?p=1127), [Prima](https://primagames.com/gaming/ea-college-football-25-development-traits-best-traits-how-they-work-and-how-to-unlock), [Diamond Lobby](https://diamondlobby.com/madden-24/madden-24-player-dev-trait-guide/)).
  5. Give a free low-accuracy baseline so nobody is blind ([blog](https://baseballreplayjournal.substack.com/p/scouting-in-ootp)).
  6. Keep some vagueness after full scouting ([Substack](https://fmprojects.substack.com/p/make-football-manager-great-again), [FM Scout](https://www.fmscout.com/a-black-stars-in-scouting-reports.html)).
  7. Show the source and confidence of every number ([blog](https://baseballreplayjournal.substack.com/p/scouting-in-ootp)).
  8. Avoid chores: no invisible payoff, no information locked until it is useless ([Smashpad](https://smashpad.com/madden-nfl-27-review/)); allow delegation, but let manual scouting find more ([Game Informer](https://www.gameinformer.com/preview/2018/08/17/nhl-19-franchise-mode-interview-learn-the-nitty-gritty-details-about-the-new)).

#### B2.2 Displaying fuzzy and uncertain stats

- **Options seen:** narrowing ranges per stat ([guide](https://www.passion4fm.com/football-manager-player-attributes/)); a knowledge % per player ([guide](https://www.passion4fm.com/football-manager-player-attributes/)) or a confidence label per report ([blog](https://baseballreplayjournal.substack.com/p/scouting-in-ootp)); stars split into sure and unsure segments ([FM Scout](https://www.fmscout.com/a-black-stars-in-scouting-reports.html)); word tiers with hidden sub-progress ([Swedish Wikipedia](https://sv.wikipedia.org/wiki/Hattrick_(datorspel))); hidden traits revealed as pros/cons ([guide](https://www.passion4fm.com/football-manager-player-attributes/)); letter grades revealed by threshold ([MUT.GG](https://www.mut.gg/news/madden-nfl-22-scouting-update-deep-dive/)); a certainty label on potential ([Diamond Lobby](https://diamondlobby.com/nhl-23/how-potential-works-nhl-23-franchise-mode/)).
- **Relative stars confuse** ([FM Scout](https://www.fmscout.com/a-current-and-potential-ability-guide-2022.html)): state what any rating is relative to.
- **Recommended combination (inference, notes 04):** a range bar per stat, one knowledge meter per fighter, potential stars with "unsure" segments, traits "?" until revealed, and the source of each number on hover.

#### B2.3 Recruiting

- College Football's hours budget, pitch categories, dealbreakers and verbal-to-hard commits are the richest model ([Uproxx](https://uproxx.com/?p=404163987), [EA](https://www.ea.com/games/ea-sports-college-football/college-football-27/news/college-football-27-dynasty), [CBS](https://www.cbssports.com/college-football/news/ea-sports-college-football-26-dynasty-mode-deep-dive-exploring-the-biggest-changes-and-updates)); NCAA 14 showed a simpler points pool keeps the strategy ([Engadget](https://www.engadget.com/2013-05-29-ncaa-14-dynasty-mode-levels-up-with-coach-skills-recruiting-cha.html), [Game Informer](https://gameinformer.com/games/ncaa_football_14/b/xbox360/archive/2013/07/09/ncaa-14-review-not-the-complete-product)).
- Free agency works as an event: an hour-by-hour frenzy ([EA](https://www.ea.com/games/madden-nfl/madden-nfl-27/news/madden-27-franchise-mode)), binding promises in a moratorium ([2K Newsroom](https://newsroom.2k.com/news/nbar-2k27-mynba-answers-the-community-with-a-back-to-basics-franchise-overhaul-and-modern-cba-rules)), deadline day ([FM Scout](https://www.fmscout.com/a-football-manager-2027-new-features.html)), "brief out, offers in" adverts ([FM Scout](https://www.fmscout.com/a-fm26-recruitment-revamp.html)).
- For us (inference): adverts plus a short deadline-day event, motivations and dealbreakers per mercenary, and a trust score behind promises.

#### B2.4 Player development and potential

- **Fixed vs dynamic:** FM's ceiling is fixed, and reaching it depends on age, personality, playing time, facilities and injuries ([FM Scout](https://www.fmscout.com/a-current-and-potential-ability-guide-2022.html)); OOTP's can move via a randomness slider ([forum](https://forums.ootpdevelopments.com/showthread.php?p=5132567)).
- **Curves and tiers:** growth slows after ~21 and decays after ~28 in Hattrick (search result only) ([TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/HatTrick)); hidden tiers revealed by play or signing ([Diamond Lobby](https://diamondlobby.com/madden-24/madden-24-player-dev-trait-guide/), [Prima](https://primagames.com/gaming/ea-college-football-25-development-traits-best-traits-how-they-work-and-how-to-unlock)); peaks and declines ([RaceFans](https://www.racefans.net/2016/08/10/meeting-man-behind-motorsport-manager/)).
- **Failure modes:** training that barely matters ([reviews](https://steamcommunity.com/app/1372810/negativereviews/?browsefilter=toprated&filterLanguage=english)), reserves with no XP ([KeenGamer](https://www.keengamer.com/articles/reviews/battle-brothers-review/)), prospects who stall ([EA forums](https://forums.ea.com/discussions/nhl-26-general-discussion-en/prospects-in-ahl/13553974), [EA Answers](https://answers.ea.com:443/t5/General-Discussion-News/Need-advice-for-developing-Players/td-p/11425067)). Wonderkid culture works only because potential is hidden but discoverable (inference).

#### B2.5 Youth academies, loans, and minor-league / redshirt analogues

- **Analogues for "away but developing":** NHL juniors (growth from minutes; recall blocked) ([Game Informer](https://www.gameinformer.com/preview/2018/08/17/nhl-19-franchise-mode-interview-learn-the-nitty-gritty-details-about-the-new)); OOTP's Lab (a couple of players per offseason; progress bars, mid-term reports, early withdrawal) (search result only) ([review](https://www.sportsgamersonline.com/news/reviews/out-of-the-park-baseball-26-review-a-baseball-nerds-dream/), [Scribd](https://www.scribd.com/document/740974558/changes)); FM loans for game time ([FM Scout](https://www.fmscout.com/a-basic-guide-to-lower-league-management-llm.html)); CFB's redshirt (up to 4 games without losing the year, once per career) (search result) ([esports.gg](https://esports.gg/news/college-football-25/how-to-redshirt-a-player-in-college-football-25)); 2K's overseas stash ([2K](https://nba.2k.com/2k27/features/mynba/)); a driver academy in Motorsport Manager 2 ([DLH](https://www.dlh.net/en/news/90710/motorsport-manager-2---new-trailer-dev-diary.html)). Notes 04 calls OOTP's Lab the closest analogue and notes 05 names NHL juniors; each fits half of our design (the program vs the lock).
- **Trade-offs that create decisions** (notes 04 §4.12): opportunity cost; capacity limits; visible progress with an exit; legible, modest risk, because programs that left players weaker or injured felt like traps (search result only) ([review](https://www.sportsgamersonline.com/news/reviews/out-of-the-park-baseball-26-review-a-baseball-nerds-dream/)); specialisation by program type ([Game Developer](https://www.gamedeveloper.com/press-release/out-the-park-baseball-25-takes-the-field-with-all-new-innovative-features-in-the-award-winning-baseball-strategy-game-now-available-worldwide)) and staff style ([Passion4FM](https://www.passion4fm.com/youth-intake-guide-how-clubs-produce-newgens/)); personality as a growth multiplier ([FM Scout](https://www.fmscout.com/a-current-and-potential-ability-guide-2022.html)). AI clubs must use the pipeline as well as the player ([EA forums](https://forums.ea.com/discussions/nhl-26-general-discussion-en/prospects-in-ahl/13553974)).

#### B2.6 Leagues, divisions, promotion/relegation and cups

- Hattrick: a fan-out pyramid of 8-team groups with tier-specific promotion and playoffs, plus a giant-killing cup ([German Wikipedia](https://de.wikipedia.org/wiki/Hattrick_(Computerspiel))). FM's lower leagues feel different (tiny budgets, loans, players refusing to re-sign unless you go up) ([FM Scout](https://www.fmscout.com/a-basic-guide-to-lower-league-management-llm.html)). OOTP supports custom pyramids (search result only) ([forum](https://forums.ootpdevelopments.com/showthread.php?p=5253336)).
- Motorsport Manager: three tiers, promotion on by default, and **promotion shock** ([Game Informer](https://gameinformer.com/b/features/archive/2016/08/15/the-sports-desk-behind-the-wheel-of-motorsport-manager), [thread](https://steamcommunity.com/app/415200/discussions/0/142261352661385160), [thread](https://steamcommunity.com/app/415200/discussions/0/133256758576774722)). US-sports modes use closed leagues with playoffs ([EA](https://www.ea.com/games/ea-sports-college-football/college-football-27/news/college-football-27-dynasty)). Eslabong: 4 divisions, top 4 promoted, bottom clubs disbanded ([Aug–Sep patches](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=1500&enddate=1789948800)).
- Ideas (inference): a soft landing after promotion; higher-tier clubs headhunting the manager; team size growing by tier, as TFM's does ([store](https://store.steampowered.com/app/1372810/Teamfight_Manager/)).

#### B2.7 Transfers and contracts

- Contracts keep deepening: clauses and loans with buybacks ([FM Scout](https://www.fmscout.com/a-fm26-recruitment-revamp.html)), guarantees and negotiation meters ([EA](https://www.ea.com/games/madden-nfl/madden-nfl-27/news/madden-27-franchise-mode)), graded incentives ([2K](https://nba.2k.com/2k27/features/mynba/)), per-year clauses ([EA](https://ea.com/games/nhl/nhl-25/features/franchise-mode)).
- **AI trading is the chronic weak point:** irrational fees ([reviews](https://steamcommunity.com/app/2252570/negativereviews/?browsefilter=toprated&filterLanguage=english)); add-ons flipping rejections ([Madden School](https://www.madden-school.com/the-new-madden-21-trade-logic-is-still-hilariously-broken-here-are-some-examples/)); cap mismanagement ([EA update](https://www.ea.com/games/madden-nfl/madden-nfl-27/news/m27-title-update-august-26-2026)); silent contract expiries and young players out-earning stars ([reviews](https://steamcommunity.com/app/3009300/negativereviews/?browsefilter=toprated&filterLanguage=english)).
- For us (inference): few clauses (release fee, sell-on %, a guaranteed-matches promise); value by need and scarcity with diminishing returns; fuzz-test the trade AI with exploit offers in long headless runs.

#### B2.8 Finances

- Board budgets and spending rules ([FM Scout](https://www.fmscout.com/a-fm26-recruitment-revamp.html)); hard but survivable bankruptcy and a managed money supply ([German Wikipedia](https://de.wikipedia.org/wiki/Hattrick_(Computerspiel))); a non-rolling annual budget ([EA](https://www.ea.com/games/ea-sports-college-football/college-football-27/news/college-football-27-dynasty)); fixed vs bonus sponsors (search result) ([Windows Central](https://www.windowscentral.com/motorsport-manager-preview)); budget systems that warp AI decisions ([reviews](https://steamcommunity.com/app/3116890/negativereviews/?browsefilter=toprated&filterLanguage=english)). For us (inference): one wage-to-revenue rule per tier with clear warnings.

#### B2.9 Morale and chemistry

- Structural systems read well: hierarchies and social groups ([Game Informer](https://gameinformer.com/b/features/archive/2017/11/06/the-sports-desk-inside-the-dynamics-of-football-manager-2018)); friendships, rivalries and duo boosts ([2K](https://nba.2k.com/2k27/features/mynba/)); teammates who refuse to renew while a rival stays ([Game Informer](https://gameinformer.com/b/features/archive/2016/08/15/the-sports-desk-behind-the-wheel-of-motorsport-manager)). Conversational systems wear out: press conferences get delegated ([Substack](https://fmprojects.substack.com/p/make-football-manager-great-again)), and under-tuned personality systems feel random ([ClutchPoints](https://clutchpoints.com/gaming/madden-27-review)). Keep chemistry structural and visible (inference).

#### B2.10 Staff

- FM: many delegable roles with 1–20 attributes ([guide](https://www.passion4fm.com/?p=1127)); OOTP: one director ([newsletter](https://www.ootpdevelopments.com/newsletters/nl0043/)); CFB: slots tied to prestige and bidding for coordinators ([EA](https://www.ea.com/games/ea-sports-college-football/college-football-27/news/college-football-27-dynasty)); Madden: coach abilities that can be downgraded (search result) ([Insider Gaming](https://insider-gaming.com/madden-26-franchise-deep-dive-shows-new-coaching-updates-gameplan-changes-and-more/)); NHL: a competitive scout market ([Game Informer](https://www.gameinformer.com/preview/2018/08/17/nhl-19-franchise-mode-interview-learn-the-nitty-gritty-details-about-the-new)); Eslabong: hire-and-sell staff ([Sep–Oct patches](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=1500)). Staff mostly multiply hours, XP, accuracy or cost. For a small team (inference): 4–5 slots with ~3 attributes each; retired veterans can become staff ([thread](https://steamcommunity.com/app/4560660/discussions/0/562545439722860075/)).

#### B2.11 Long-save longevity versus busywork

- **Keeps saves alive:** continue-flow presets and delegation ([FM Scout](https://www.fmscout.com/a-football-manager-2027-new-features.html)); scenario challenges and quick seasons ([Wikipedia](https://en.wikipedia.org/wiki/Football_Manager_2013)); escalating goals ([EA](https://www.ea.com/games/ea-sports-college-football/college-football-27/news/college-football-27-dynasty)); politics and rule votes ([RaceFans](https://www.racefans.net/2016/08/10/meeting-man-behind-motorsport-manager/)); rivalries and news tickers ([Smashpad](https://smashpad.com/madden-nfl-27-review/)); opt-in hardship modifiers ([2K](https://nba.2k.com/2k27/features/mynba/)); mods ([reviews](https://steamcommunity.com/app/415200/positivereviews/?browsefilter=toprated)).
- **Kills saves:** noise, repetition and solved metas ([Substack](https://fmprojects.substack.com/p/make-football-manager-great-again), [reviews](https://steamcommunity.com/app/415200/negativereviews/?browsefilter=toprated)); stagnation after ~6–10 seasons ([forum](https://www.fmscout.com/q-3898-What-happens-in-the-end.html)); AI that falls behind ([reviews](https://steamcommunity.com/app/415200/positivereviews/?browsefilter=toprated)); save bloat and crashes ([reviews](https://steamcommunity.com/app/3116890/negativereviews/?browsefilter=toprated&filterLanguage=english)); over-delegation ([Substack](https://fmprojects.substack.com/p/holidaying-in-football-manager)).
- **Pacing has two failure poles:** too little happening between matches ([Trustpilot](https://au.trustpilot.com/review/hattrick.org)) and time moving too slowly (search result only) ([Top Gear](https://topgear.com/car-news/gaming/football-manager-26-review-fantastic-match-engine-tangled-mess-menus)). Franchise players are loyalists who notice neglect ([Game Informer](https://www.gameinformer.com/index.php/2020/08/03/ea-sports-updates-fans-on-its-vision-for-maddens-franchise-mode)).

## 5. Part C — Synthesis

Part C uses the terms defined in §1: a *fixture* is a scheduled *match*, a match is a best-of-N series of *rounds*, and each round is decided by one real-time *fight*.

### C1. Top 10 must-have mechanics (ranked)

**C1.1 Ordered sentence-rule tactics on a layered ladder.**
- *What:* each fighter has an ordered list, checked top-down, first valid rule wins: `WHEN <condition> [AND <condition>] → <action> ON <selector> [ONLY | PREFER] [cooldown]`, read as one sentence, with NOT toggles, 10% steps and an unremovable stance fallback. Players climb a ladder: working default → **personality preset** (a starter rule list, with the UI marking which rules it supplied) → editable rules → advanced vocabulary from coaches, academy and scouting. Rules reference **roles, not names**. Abilities draw on a per-fight focus budget, so rule order is an economic choice. Four slots at first, growing free with experience.
- *Why:* every successful scripted-AI game layers this way, and the one without presets has the steepest curve ([reviews](https://steamcommunity.com/app/871930/reviews/?browsefilter=toprated), [PCGamesN](https://www.pcgamesn.com/pillars-of-eternity-2-deadfire/pillars-of-eternity-ii-companions-custom-ai)); Unicorn Overlord's AP/PP budgets make order a resource decision ([RPG Site](https://www.rpgsite.net/news/15481-unicorn-overlord-highlights-tactics-priority-and-battle-stages-along-with-several-new-non-human-allies)); Eslabong's toggles cannot express sequencing ([forum](https://steamcommunity.com/app/4560660/discussions/search/?q=tactics&gidforum=0)); name-bound rules break on transfers ([LiveJournal](https://dragon-age.livejournal.com/348046.html)); paid slots feel wasted ([thread](https://steamcommunity.com/app/47810/discussions/0/2579854400736575780/)); unlabelled filter/sort semantics confused players ([ResetEra](https://www.resetera.com/threads/unicorn-overlord-ot-ogre-battle-24-the-queens-gambit.824595/page-10)).
- *From:* FFXII, Deadfire, Dragon Age: Origins, Unicorn Overlord, Eslabong.

**C1.2 Fights that explain themselves.**
- *What:* a live rule badge over each fighter ("R3"); a pause inspector that says why ("R1 skipped: no ally below 40%; R2 on cooldown; R3 fired"); a per-fighter recap after each round (dealt, taken, healed, rule-fire counts, rules that never fired, death summary); editor lint for unreachable rules, missing cooldowns, friendly-fire risk and near-opposite conditions. If fighters can ever deviate from their rules (C3.7), the inspector names the cause.
- *Why:* opacity and ignored tactics dominate TFM2's complaints ([reviews](https://steamcommunity.com/app/3009300/negativereviews/?browsefilter=toprated&filterLanguage=english), [Vaporlens](https://vaporlens.app/app/3009300/teamfight_manager_2.md)); Eslabong fights are too fast to verify settings ([reviews](https://steamcommunity.com/app/4560660/negativereviews/?browsefilter=toprated&filterLanguage=english)); Gladiabots debugging is slow ([reviews](https://steamcommunity.com/app/871930/reviews/?browsefilter=toprated)); the ordering trap silently disables rules ([Gamer Guides](https://gamerguides.com/final-fantasy-xii/guide/basics/gameplay-mechanics/battle-system)); recaps and death summaries are proven ([wiki](https://wiki.leagueoflegends.com/en-us/V12.6_(Teamfight_Tactics)), [Apr–Aug notes](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=3000&enddate=1787961600)).
- *From:* TFT, Eslabong, Gladiabots, Deadfire, FFXII.

**C1.3 Deterministic, nameable targeting and bounded randomness.**
- *What:* the default target is the nearest valid enemy in range with published tie-breaks; every target change traces to a rule; abilities never pick random targets; disables are short and telegraphed; soft counters only; seeded RNG with visible hit chances and capped swings on irreversible events; a fight cap with an overtime ramp.
- *Why:* random spell targets were TFT's worst variance and uncontrollable punishers its most-hated traits ([Set 2 learnings](https://dtcl.vnggames.com/en-us/news/dev/dev-tft-rise-of-the-elements-learnings), [Set 1 learnings](https://www.surrenderat20.net/2019/10/red-post-collection-dev-on-tft-set-1.html)); RNG without counterplay is Battle Brothers' top complaint ([reviews](https://steamcommunity.com/app/365360/negativereviews/?browsefilter=toprated&filterLanguage=english)); units wasting shots on chaff is the main complaint where targeting is uncontrolled ([forum](https://forum.quartertothree.com/t/mechabellum-tactical-autobattler-against-other-people/167835)); long combats stall play ([forum](https://us.forums.blizzard.com/en/hearthstone/t/battlegrounds-animation-issues/135955)).
- *From:* TFT, Mechabellum, Battle Brothers, Battlegrounds.

**C1.4 A watch–tweak loop inside every match.**
- *What:* matches are short best-of-N series with edits between rounds. Replays open the editor at any moment. Between rounds you may watch the replay and use a scrimmage sandbox, which uses a different seed and models only the scouted part of the opponent's rules, so it cannot replay the real fixture (C3.6, C3.16). Re-running played rounds with edited tactics against the opponent's real rules is available only after the match ends, and never changes the saved result. Puzzle challenges teach the editor.
- *Why:* the create–test–refine loop is what makes Gladiabots fun ([Game Developer](https://www.gamedeveloper.com/design/gladiabots-inception)) and its replay-to-editor button shortens it ([devlog](https://gfx47.itch.io/gladiabots/devlog/34211/gladiabots-alpha-13-is-live)); Mechabellum lets you rewind and re-play rounds ([forum](https://forum.quartertothree.com/t/mechabellum-tactical-autobattler-against-other-people/167835)); Eslabong allows edits after round 1 ([Apr–Aug notes](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=3000&enddate=1787961600)); Underlords shipped a single-player puzzle crawl ([review](https://www.highgroundgaming.com/dota-underlords-review/)); Bazaar players built their own replay tool ([tracker](https://sin.bazaardb.gg/tracker)).
- *From:* Gladiabots, Mechabellum, Eslabong, Underlords.

**C1.5 Fog-of-war stats that say how sure they are.**
- *What:* each stat is a range bar that narrows with knowledge; a knowledge meter per fighter with fixed reveal steps (physicals → traits → stat bands → role → potential range); potential as stars with "unsure" segments and a certainty label; traits "?" until revealed; the source of every number on hover (own scout, contact in a match, registry baseline); residual vagueness; an absolute, labelled scale. **Owner choice:** a free registry baseline softens the mandate that scouting is required; if kept, cap it at a very wide range (notes 04 suggests a "±4" read).
- *Why:* FM's ranges are the clearest fog in the genre ([guide](https://www.passion4fm.com/football-manager-player-attributes/)); Madden's thresholds make each scouting hour pay ([MUT.GG](https://www.mut.gg/news/madden-nfl-22-scouting-update-deep-dive/)); NHL separates potential, certainty and accuracy ([Diamond Lobby](https://diamondlobby.com/nhl-23/how-potential-works-nhl-23-franchise-mode/)); OOTP confuses when sources are unclear ([blog](https://baseballreplayjournal.substack.com/p/scouting-in-ootp)); relative stars confuse ([FM Scout](https://www.fmscout.com/a-current-and-potential-ability-guide-2022.html)); full certainty kills scouting ([Substack](https://fmprojects.substack.com/p/make-football-manager-great-again)).
- *From:* FM, Madden, NHL, OOTP.

**C1.6 Scouting by orders and digests, from characterful, time-limited scouts.**
- *What:* scouts have "read skill" and "read talent" ratings, a home region that improves while stationed, a proven-vs-raw bias and a wage. Send them on N-week regional tours with a brief; they return a weekly digest with A–F grades and a "fits your tactics" flag checked against your actual rules. Paired scouts sharpen reports; facing a fighter in a match refreshes intel on him; a weekly contacts budget is shared with recruiting; manual focus beats auto-scouting.
- *Why:* standing briefs removed FM's chores ([Diamond Lobby](https://diamondlobby.com/football-manager-2023/fm23-scouting-guide/), [FM Scout](https://www.fmscout.com/a-fm26-recruitment-revamp.html)) and FM27 adds tactic fit ([FM Scout](https://www.fmscout.com/a-football-manager-2027-new-features.html)); NHL's pairing and "auto finds ~3 gems" ([Game Informer](https://www.gameinformer.com/preview/2018/08/17/nhl-19-franchise-mode-interview-learn-the-nitty-gritty-details-about-the-new)); OOTP's bias makes disagreement content ([newsletter](https://www.ootpdevelopments.com/newsletters/nl0043/)); CFB's hours budget forces spread-vs-focus choices ([Uproxx](https://uproxx.com/?p=404163987)).
- *From:* FM, NHL, OOTP, Madden, College Football.

**C1.7 One rulebook for every club.**
- *What:* AI clubs live under the player's rules in the headless sim: the same rule format and templates (with distinct, scoutable manager styles), the same in-fight calls, imperfect scouting, wages, injuries, aging, academies and finances. AI clubs keep improving rosters, never counter-build reactively against the player, and fixtures are published in advance.
- *Why:* regenerating enemies read as cheating ([reviews](https://steamcommunity.com/app/276810/negativereviews/?browsefilter=toprated&filterLanguage=english)); Eslabong had to match rival injury rates ([Sep–Oct patches](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=1500)); imperfect AI scouting creates a beatable market ([newsletter](https://www.ootpdevelopments.com/newsletters/nl0043/)); AI that lagged made Motorsport Manager easy after ~50 h ([reviews](https://steamcommunity.com/app/415200/positivereviews/?browsefilter=toprated)); CPU cap failures ([EA update](https://www.ea.com/games/madden-nfl/madden-nfl-27/news/m27-title-update-august-26-2026)) and stalled CPU prospects ([EA forums](https://forums.ea.com/discussions/nhl-26-general-discussion-en/prospects-in-ahl/13553974)) drain leagues; rigged-feeling matchmaking is Backpack Battles' top complaint ([Vaporlens](https://vaporlens.app/app/2427700/backpack_battles.md)).
- *From:* Mordheim, Eslabong, OOTP, Motorsport Manager, Madden, NHL.

**C1.8 Academy terms as visible programs with an exit.**
- *What:* send a fighter on a typed program (e.g. technique, conditioning, tactics school, a tour abroad) for a set term, using limited slots and money; he is unavailable for matches for the term. A progress bar and mid-term report allow early recall for partial gains; outcome ranges are shown up front; risk is modest and legible, never a hidden stat loss. Returns can bring traits, new rule vocabulary and sharper scouting certainty. AI clubs use academies too. **Owner choice:** a cheaper light-duty variant (up to N matches during the term, like a redshirt) softens the mandate that academy fighters are unavailable for months; drop it to keep the mandate strict.
- *Why:* OOTP's progress bars, mid-term reports and early withdrawal, and one reviewer's finding that most of its programs left players with lower ratings or injured (search result only) ([review](https://www.sportsgamersonline.com/news/reviews/out-of-the-park-baseball-26-review-a-baseball-nerds-dream/)); NHL's juniors lock and CFB's redshirt exemption ([Game Informer](https://www.gameinformer.com/preview/2018/08/17/nhl-19-franchise-mode-interview-learn-the-nitty-gritty-details-about-the-new), [esports.gg](https://esports.gg/news/college-football-25/how-to-redshirt-a-player-in-college-football-25)); Eslabong's early academy felt weak ([reviews](https://steamcommunity.com/app/4560660/negativereviews/?browsefilter=toprated&filterLanguage=english)); unselected fighters need a track ([reviews](https://steamcommunity.com/app/1043260/negativereviews/?browsefilter=toprated&filterLanguage=english)).
- *From:* OOTP, NHL, College Football, FM loans.

**C1.9 A matchweek that is a decision, never a wait.**
- *What:* each matchweek has one fixture and one or two calendar choices (scout trip, training intensity, rest, friendly, market), delivered as a digest, with pacing presets for how often the game stops and the option to skip or auto-simulate any match we are not in.
- *Why:* FM26's UI collapse and FM27's pacing presets ([reviews](https://steamcommunity.com/app/3551340/negativereviews/?browsefilter=toprated&filterLanguage=english), [FM Scout](https://www.fmscout.com/a-football-manager-2027-new-features.html)); Domina's dead downtime ([Daily Star](https://www.thedailystar.net/shout/game-review/are-you-not-entertained-1558099)); TFM made you watch tournaments you were not in ([reviews](https://steamcommunity.com/app/1372810/negativereviews/?browsefilter=toprated&filterLanguage=english)); The Bazaar's hourly choices before each fight (inference for a league week) ([Mobalytics](https://mobalytics.gg/the-bazaar/guides/day-guide)).
- *From:* FM, The Bazaar, Domina, Teamfight Manager.

**C1.10 Aging, retirement and escalating goals keep long saves moving.**
- *What:* aging with peaks, decline and retirement on by default (farewell seasons, career records, veterans becoming staff), plus a patron with a temperament whose goals escalate with success and whose patience sets job security. Related levers are placed elsewhere: season modifiers (C3.19), wage growth (C3.11), catch-up (C3.17), promotion soft landing (C3.9), legacy and scenarios (C3.12).
- *Why:* Eslabong players stall at 10–15 h and asked for retirement, which was retrofitted as opt-in ([forum](https://steamcommunity.com/app/4560660/discussions/0/570426530135597095/), [Sep–Oct patches](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=1500)); FM saves restart after ~6–10 seasons ([forum](https://www.fmscout.com/q-3898-What-happens-in-the-end.html)); Motorsport Manager felt seen-it-all in 2–3 seasons ([reviews](https://steamcommunity.com/app/415200/negativereviews/?browsefilter=toprated)); College Football's athletic director escalates goals ([EA](https://www.ea.com/games/ea-sports-college-football/college-football-27/news/college-football-27-dynasty)); 2K's owner directives govern job security ([2K Newsroom](https://newsroom.2k.com/news/endless-possibilities-await-as-mynba-levels-up-in-nbar-2k26)).
- *From:* Eslabong, FM, Motorsport Manager, College Football, NBA 2K.

### C2. Top 10 pitfalls to avoid (ranked)

**C2.1 AI that looks dumb on screen.** Idling after casts, heals on full-HP allies, ignored focus orders ([reviews](https://steamcommunity.com/app/4560660/negativereviews/?browsefilter=toprated&filterLanguage=english), [thread](https://steamcommunity.com/app/4560660/discussions/0/562545740485849739/)); ignored tactics as TFM2's top theme ([Vaporlens](https://vaporlens.app/app/3009300/teamfight_manager_2.md)); spam without timers ([thread](https://steamcommunity.com/app/560130/discussions/0/1693795812309628406)); bait-chasing and friendly fire ([thread](https://steamcommunity.com/app/47810/discussions/0/1319961868324922289), [Sorcerers.net](https://sorcerers.net/Games/DragonAge/Walkthrough/getting-started/scripting.php)); fighters freezing ([reviews](https://steamcommunity.com/app/1043260/negativereviews/?browsefilter=toprated&filterLanguage=english)). *Mitigation:* cooldown and friendly-fire filters on by default; headless QA bots with idle, overheal and overkill detectors and a frozen-fighter watchdog.

**C2.2 Opaque cause and effect.** No "why" in TFM2 ([reviews](https://steamcommunity.com/app/3009300/negativereviews/?browsefilter=toprated&filterLanguage=english)); hard-to-read losses in Gladiabots ([reviews](https://steamcommunity.com/app/871930/reviews/?browsefilter=toprated)); contradictory guides on condition logic ([ResetEra](https://www.resetera.com/threads/unicorn-overlord-ot-ogre-battle-24-the-queens-gambit.824595/page-10)); unclear scouting sources ([blog](https://baseballreplayjournal.substack.com/p/scouting-in-ootp)); hidden costs ([reviews](https://steamcommunity.com/app/4560660/negativereviews/?browsefilter=mostrecent&filterLanguage=english)). *Mitigation:* C1.2 tooling; labelled Only/Prefer; source and confidence on every number; costs shown where you spend.

**C2.3 Tactics that don't matter.** Levels beat tactics ([thread](https://steamcommunity.com/app/4560660/discussions/0/590687538416527966/)); "plays itself" ([Giant Bomb](https://www.giantbomb.com/final-fantasy-xii/3030-11497/user-reviews/2200-3319/)); one dominant script ([review](https://gamingrespawn.com/reviews/34358/gladiabots-review/)); a solved meta ([Substack](https://fmprojects.substack.com/p/make-football-manager-great-again)); strategy as arithmetic ([reviews](https://steamcommunity.com/app/415200/negativereviews/?browsefilter=toprated)); a forecast that removes adapting ([FullCleared](https://fullcleared.com/reviews/unicorn-overlord-review/)). *Mitigation:* tiers that bound level gaps; hard opponents needing specific tactics; soft counters; season modifiers and hidden arena variables; no outcome forecast.

**C2.4 UI friction, chores and noise.** FM26 fell to 38% from FM24's 92% over UI ([reviews](https://steamcommunity.com/app/3551340/negativereviews/?browsefilter=toprated&filterLanguage=english), [store](https://store.steampowered.com/app/2252570/Football_Manager_2024/)); clunky rule lists that lose edits ([thread](https://steamcommunity.com/app/560130/discussions/0/1696048245844756614/)); re-placing units every fight ([reviews](https://steamcommunity.com/app/1043260/negativereviews/?browsefilter=toprated&filterLanguage=english)); mobile UI on PC ([reviews](https://steamcommunity.com/app/1530300/reviews/)); press conferences ([Substack](https://fmprojects.substack.com/p/make-football-manager-great-again)); an optimiser that overwrote hand-made tactics ([GamingTrend](https://gamingtrend.com/unicorn-overlord-review-for-king-and-country/)). *Mitigation:* PC-native UI with shortcuts; a click budget for the weekly loop; pacing presets; saved formations and rule sets per opponent type; undo until confirm ([reviews](https://steamcommunity.com/app/669330/reviews/)); assistant tools that suggest a diff and never overwrite the player's work; newcomer playtests ([interview](https://www.actugaming.net/no-plan-b-interview-agfd-443201)); no press layer.

**C2.5 Different rules for the AI, or AI that falls behind.** Regenerating enemies ([reviews](https://steamcommunity.com/app/276810/negativereviews/?browsefilter=toprated&filterLanguage=english)); "seriously easy" after ~50 h ([reviews](https://steamcommunity.com/app/415200/positivereviews/?browsefilter=toprated)); CPU cap deficits ([EA update](https://www.ea.com/games/madden-nfl/madden-nfl-27/news/m27-title-update-august-26-2026)); AI releasing prospects ([reviews](https://steamcommunity.com/app/3116890/negativereviews/?browsefilter=toprated&filterLanguage=english)); passive bot teams ([arXiv](https://arxiv.org/abs/2504.09499)). *Mitigation:* C1.7, plus 30+-season headless soak tests tracking league quality, AI finances and prospect growth, and trade-AI fuzz tests.

**C2.6 Irreversible randomness and trap mechanics.** Veterans lost to miss streaks ([reviews](https://steamcommunity.com/app/365360/negativereviews/?browsefilter=toprated&filterLanguage=english)); random punishers ([Set 1 learnings](https://www.surrenderat20.net/2019/10/red-post-collection-dev-on-tft-set-1.html)); programs that mostly left players weaker or injured (search result only) ([review](https://www.sportsgamersonline.com/news/reviews/out-of-the-park-baseball-26-review-a-baseball-nerds-dream/)); holdouts that feel random ([ClutchPoints](https://clutchpoints.com/gaming/madden-27-review)). *Mitigation:* an injury ladder with a small, capped career-ending chance; odds shown before risky choices; visible mood thresholds; results saved once played.

**C2.7 Exploitable economics.** Farming loss-streak gold ([ONE Esports](https://www.oneesports.gg/dota-underlords/dota-underlordss-latest-update-caps-winning-and-losing-streaks)); trades flipped by add-ons ([Madden School](https://www.madden-school.com/the-new-madden-21-trade-logic-is-still-hilariously-broken-here-are-some-examples/)); launch recruiting exploits ([Dexerto](https://www.dexerto.com/gaming/college-football-25-august-8-patch-notes-2855263/)); young players out-earning stars ([reviews](https://steamcommunity.com/app/3009300/negativereviews/?browsefilter=toprated&filterLanguage=english)); promotion cliffs ([thread](https://steamcommunity.com/app/415200/discussions/0/133256758576774722)) and wage spikes ([reviews](https://steamcommunity.com/app/2252570/negativereviews/?browsefilter=toprated&filterLanguage=english)). *Mitigation:* catch-up worth less than winning; need-based trade valuation with diminishing returns; promotion soft landing; economy dashboards in soak tests.

**C2.8 Saves that go flat.** Eslabong at 10–15 h ([forum](https://steamcommunity.com/app/4560660/discussions/0/570426530135597095/)); FM after ~6–10 seasons ([forum](https://www.fmscout.com/q-3898-What-happens-in-the-end.html)); Motorsport Manager in 2–3 seasons ([reviews](https://steamcommunity.com/app/415200/negativereviews/?browsefilter=toprated)); GGM after ~5 h ([reviews](https://steamcommunity.com/app/1043260/negativereviews/?browsefilter=toprated&filterLanguage=english)); TFM's late game reduced to drafting ([reviews](https://steamcommunity.com/app/1372810/negativereviews/?browsefilter=toprated&filterLanguage=english)). *Mitigation:* C1.10, season modifiers (C3.19), a large event pool, rivals with persistent identities, goals beyond the next trophy.

**C2.9 Churn, neglect and fragile saves.** 3–4 patches a day ([reviews](https://steamcommunity.com/app/4560660/negativereviews/?browsefilter=toprated&filterLanguage=english)); overhauls then silence ([PCGamesN](https://www.pcgamesn.com/dota-underlords/player-count-drop), [thread](https://steamcommunity.com/app/1046930/discussions/0/5168416410407459322)); franchise modes untouched for years ([Game Informer](https://www.gameinformer.com/index.php/2020/08/03/ea-sports-updates-fans-on-its-vision-for-maddens-franchise-mode), [Hardcore Gamer](https://hardcoregamer.com/nhl-27-review/)); two-year-old bugs and season-6 crashes ([reviews](https://steamcommunity.com/app/415200/negativereviews/?browsefilter=toprated)); sequels missing relied-on features ([Wikipedia](https://en.wikipedia.org/wiki/Blood_Bowl_3), [reviews](https://steamcommunity.com/app/3551340/negativereviews/?browsefilter=toprated&filterLanguage=english)). *Mitigation:* batch balance changes between seasons on a beta branch; versioned saves with migrations; never remove relied-on features; long-save CI soak tests.

**C2.10 Selling power or eroding trust.** Paid power is the top negative theme for The Bazaar ([Vaporlens](https://vaporlens.app/app/1617400/the_bazaar.md)) and Super Auto Pets ([Vaporlens](https://vaporlens.app/app/1714040/super_auto_pets.md)); BB3's monetisation ([reviews](https://steamcommunity.com/app/1016950/negativereviews/?browsefilter=toprated&filterLanguage=english)); pre-order franchise points ([EA](https://www.ea.com/games/madden-nfl/madden-nfl-27/news/madden-27-franchise-mode)); an NFT deal and a shutdown ([Decrypt](https://decrypt.co/137875/ftx-sam-bankman-fried-storybook-brawl-video-game-shutting-down)); suspected AI-written text ([reviews](https://steamcommunity.com/app/4560660/negativereviews/?browsefilter=toprated&filterLanguage=english)). *Mitigation:* premium price, no paid power, offline-first, hand-written or curated text, proper asset credits.

### C3. Open design questions for the owner

Ordered by how much each shapes the design. Each option has a one-line trade-off; the **recommended default** is a recommendation, not a decision.

**C3.1 Can the player intervene during a fight?**
- *None:* purest test of tactics; risks the disengagement that made Motorsport Manager's designer cut "set and watch" (a 2014 article on a playtest before the PC release) ([Game Developer](https://gamedeveloper.com/design/making-formula-1-accessible-with-i-motorsport-manager-i-)).
- *Edits between rounds only:* keeps the adapt loop; nothing to do during a fight ([Apr–Aug notes](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=3000&enddate=1787961600)).
- *Pause plus a few calls* (toggle rules, switch playbook, call a focus target, retreat): agency without micromanagement; AI managers can spend the same budget ([Gamer Guides](https://gamerguides.com/final-fantasy-xii/guide/basics/gameplay-mechanics/battle-system), [Jegged](https://jegged.com/Games/Final-Fantasy-XIII/Paradigms/Paradigm-Explanation.html)).
- *Free pause-and-edit or direct control of one fighter:* maximum control; breaks parity with headless sims and complicates balance and async ([reviews](https://steamcommunity.com/app/4560660/reviews/?browsefilter=mostrecent&filterLanguage=english)).
- **Recommended:** free pause to *inspect*; auto-pause when a decision opens, as in Motorsport Manager ([Game Informer](https://gameinformer.com/b/features/archive/2016/08/15/the-sports-desk-behind-the-wheel-of-motorsport-manager)), extended to configurable event triggers such as an ally going down (inference); full edits between rounds; **up to two calls per round**, used by AI managers too; no direct control at launch. (Notes 03 suggests pause-time toggles with an optional limited timeout count, and notes 05 suggests 1–3 calls per fight; both point to a small per-round budget that AI managers can also spend.)

**C3.2 Match format, fight length and season cadence.**
- *One round per match:* fastest; loses the adapt loop.
- *Best-of-3 rounds (best-of-5 in finals):* keeps the loop; more watching per match, and Eslabong players already find five rounds a lot to watch ([forum search](https://steamcommunity.com/app/4560660/discussions/search/?q=rounds&gidforum=0)).
- *~40 matches a season* (Eslabong playtest) vs *~14 league fixtures* (8-team double round-robin): many matches tire players ([reviews](https://steamcommunity.com/app/1372810/negativereviews/?browsefilter=toprated&filterLanguage=english)); fewer leave room for cups ([German Wikipedia](https://de.wikipedia.org/wiki/Hattrick_(Computerspiel))).
- **Recommended:** best-of-3 matches; fights of ~20–45 s at 1x with an overtime ramp and a hard cap; a 5–10-minute match including edits (notes 02 inference); 14 league fixtures plus cup ties and, every few matchweeks, one optional side event such as a draft cup, which Eslabong players rate highly ([reviews](https://steamcommunity.com/app/4560660/positivereviews/?browsefilter=toprated&filterLanguage=english)); a season of a few hours, below FM Classic's 7–10 h ([Wikipedia](https://en.wikipedia.org/wiki/Football_Manager_2013)) (inference).

**C3.3 Arena view: top-down or side-view?**
- *Top-down free movement* (Eslabong): supports range bands, surround, flank and kite, as the proposed vocabulary assumes; more clutter risk ([store](https://store.steampowered.com/app/4560660/Eslabong/)).
- *Side-view line or rows* (Super Auto Pets, Storybook Brawl): maximally readable; tactics collapse to order and rows ([glossary](https://superautopets.wiki.gg/wiki/Glossary), [HSReplay](https://articles.hsreplay.net/2022/09/23/storybook-brawl-the-perfect-game-for-battlegrounds-players-2/)).
- *Hybrid:* a top-down arena with front/back deployment rows and adjacency bonuses at the start of each round ([Wikipedia](https://en.wikipedia.org/wiki/Backpack_Battles)).
- **Recommended:** the hybrid, applying TFT's clutter lessons ([Set 2 learnings](https://dtcl.vnggames.com/en-us/news/dev/dev-tft-rise-of-the-elements-learnings)). Evidence is indirect: no source compared the two views.

**C3.4 Team size: fixed or scaling with tier?**
- *Fixed 5v5:* one balance target; newcomers face five rule lists at once.
- *3v3 → 4v4 → 5v5 by tier:* an onboarding ramp, and promotion feels like growth, as in TFM's climb ([store](https://store.steampowered.com/app/1372810/Teamfight_Manager/)); balance across sizes.
- *Fixed 3v3 or 4v4:* most readable; least depth.
- **Recommended:** scale by tier, with mixed-size cups that use the whole roster.

**C3.5 Do rival AI clubs play under the same rules?**
- *Full parity, fully simulated:* fairest; costs CPU and save size.
- *Parity of outcomes, abstracted processes* (AI scouting as noise from a club's scouting quality; identical wages, injuries, aging, academies, rule format and calls): fair and cheap; OOTP's abstraction cut file size 80% ([newsletter](https://www.ootpdevelopments.com/newsletters/nl0043/)).
- *AI exempt or regenerated:* cheapest; read as cheating ([reviews](https://steamcommunity.com/app/276810/negativereviews/?browsefilter=toprated&filterLanguage=english)).
- **Recommended:** parity of outcomes with abstracted processes.

**C3.6 How much randomness, and when are seeds drawn?**
- *Fully deterministic:* perfectly explainable; risks being solvable ([reviews](https://steamcommunity.com/app/415200/negativereviews/?browsefilter=toprated)).
- *Seeded, bounded variance* (visible hit chances, capped swings): fair and varied; needs C1.2.
- *High variance:* drama, and rage ([reviews](https://steamcommunity.com/app/365360/negativereviews/?browsefilter=toprated&filterLanguage=english)).
- **Recommended:** seeded, bounded variance. Each round's seed is drawn at kickoff and logged only so replays reproduce the fight; it is never known in advance. Results are saved once played, so reloading cannot reroll them (rerolling on reload stays off; Eslabong offers it as a toggle ([Sep–Oct patches](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=1500))). The rehearsal sandbox always uses its own seed (C1.4).

**C3.7 Should fighters ever deviate from their rules?**
- *Never:* every action traces to a rule, the most explainable option and the safest against "AI looks dumb" (C2.1); fighters with identical rules behave identically, so mental stats and personality add less.
- *Small seeded misfires, always shown in the inspector* (like Eslabong's personality mistake chance, shown on hover ([Sep–Oct patches](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=1500))): flavour and variance; any visible slip risks reading as the AI ignoring tactics, TFM2's top complaint ([Vaporlens](https://vaporlens.app/app/3009300/teamfight_manager_2.md)).
- *Stat-driven deviation* (a composure or discipline stat sets misfire or late-fire chance, as with TFM2's stats that drive decision quality ([store](https://store.steampowered.com/app/3009300/Teamfight_Manager_2/)) and notes 03's discipline idea): scouting and development visibly change fights; risks stats beating tactics (C2.3) and the opacity TFM2 is criticised for ([reviews](https://steamcommunity.com/app/3009300/negativereviews/?browsefilter=toprated&filterLanguage=english)).
- **Recommended:** no rule-skipping at launch. Let a composure-type stat affect execution only (a short reaction delay before a rule fires), seeded and named in the inspector; revisit small misfires after playtests.

**C3.8 How big is the tactics editor at launch?**
- *Lists only:* most approachable ([Gamer Guides](https://gamerguides.com/final-fantasy-xii/guide/basics/gameplay-mechanics/battle-system)).
- *Plus a node-graph expert mode:* most expressive; scares newcomers ([reviews](https://steamcommunity.com/app/871930/reviews/?browsefilter=toprated)).
- *Per-ability toggles only:* gentlest; experts felt a loss (snippet) ([Steam](https://steamcommunity.com/app/1222690/discussions/0/598512477964095800)).
- **Recommended:** lists with rule groups and "jump to"; a thin team playbook (focus target, formation, phase switch); all starter vocabulary from day one; slots 4 → 8 with experience, 10–12 via traits; a local library and export codes at launch, Workshop later.

**C3.9 How many leagues, tiers and regions at launch?**
- *One region, 3–4 tiers* (Eslabong, Motorsport Manager): cheapest; regional scouting means little ([Aug–Sep patches](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=1500&enddate=1789948800), [Game Informer](https://gameinformer.com/b/features/archive/2016/08/15/the-sports-desk-behind-the-wheel-of-motorsport-manager)).
- *2–3 regions × 3 tiers of 8 clubs* with regional cups and a cross-region cup: gives scouts regions to know; ~48–72 clubs to simulate.
- *Deep pyramid* (Hattrick, up to 11 tiers): a long climb; sim cost and empty-league risk ([German Wikipedia](https://de.wikipedia.org/wiki/Hattrick_(Computerspiel)), [arXiv](https://arxiv.org/abs/2504.09499)).
- **Recommended:** 2–3 regions × 3 tiers of 8, distant leagues on a lighter sim, top 1–2 promoted plus a playoff, an underdog-at-home cup, and a soft landing after promotion (expectations set by the new tier, parachute money) to avoid Motorsport Manager's promotion shock ([thread](https://steamcommunity.com/app/415200/discussions/0/133256758576774722)); all in data files.

**C3.10 Roster cap, academy slots and loans.**
- Evidence: Eslabong's HQ raises the roster cap from 20 to 70 ([Aug–Sep patches](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=1500&enddate=1789948800)); Battle Brothers fields 12 of 20 and reserves gain no XP ([KeenGamer](https://www.keengamer.com/articles/reviews/battle-brothers-review/)); Gladiator Guild Manager fields 3–5 of 8+ and starves XP ([reviews](https://steamcommunity.com/app/1043260/negativereviews/?browsefilter=toprated&filterLanguage=english)); OOTP's Lab takes a couple of players per cycle (search result only) ([Scribd](https://www.scribd.com/document/740974558/changes)); FM uses loans for game time, and small clubs loan players in from big ones ([FM Scout](https://www.fmscout.com/a-basic-guide-to-lower-league-management-llm.html)); Eslabong lends inactive fighters for gold ([devblogs](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=5&maxlength=0&enddate=1777766400)).
- *Tight cap (~2× team size):* everyone plays; little room for prospects or rotation.
- *Medium cap (~2.5–3× team size, e.g. 8 at 3v3 up to 12–16 at 5v5) with bench XP via training, academy and loans:* depth without dead weight (notes 02 suggests a squad of 8–12, inference).
- *Large, facility-upgradable cap:* collecting play; reserves starve unless they have a track.
- Academy slots: *1–2 per academy, +1 via facilities* (a real allocation choice) vs *unlimited* (no decision). Loans: *none*, *out only*, or *both ways*.
- **Recommended:** a medium cap that grows with tier, with academy fighters counting against it; two academy slots plus one via facilities; loans both ways, with loan-out as the cheaper development path (the fighter plays matches for a lower-tier club, grows from playing time and returns at the next window) and loan-in letting small clubs borrow from big ones.

**C3.11 How is the transfer market structured?**
- Evidence: FM's deadline day, with offers rising toward the deadline ([FM Scout](https://www.fmscout.com/a-football-manager-2027-new-features.html)), and adverts that bring offers to you ([FM Scout](https://www.fmscout.com/a-fm26-recruitment-revamp.html)); Madden's hour-by-hour free-agency frenzy ([EA](https://www.ea.com/games/madden-nfl/madden-nfl-27/news/madden-27-franchise-mode)); 2K's moratorium with binding promises ([2K Newsroom](https://newsroom.2k.com/news/nbar-2k27-mynba-answers-the-community-with-a-back-to-basics-franchise-overhaul-and-modern-cba-rules)); Hattrick's player-run auctions needed anti-inflation measures ([German Wikipedia](https://de.wikipedia.org/wiki/Hattrick_(Computerspiel))); Eslabong's offers, auctions and non-negotiable flags ([Aug–Sep patches](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=1500&enddate=1789948800)); AI trade valuation is the chronic weak point (B2.7).
- *Always open:* simple and flexible; no tension, and AI can raid your roster mid-season.
- *Two windows (preseason and mid-season) with a deadline-day event:* planning and drama; more calendar logic.
- *Pricing:* offers and counters (predictable) vs auctions (bidding wars, but inflation in Hattrick's market).
- *AI valuation:* by rating alone (exploitable, as Madden's add-on trades show ([Madden School](https://www.madden-school.com/the-new-madden-21-trade-logic-is-still-hilariously-broken-here-are-some-examples/))) vs by need, scarcity and its own imperfect scouting (believable; costs tuning).
- **Recommended:** two windows plus a short deadline-day event; free agents any time; one offer/counter round weighted by guild trust (notes 05 inference); auctions only for rare top-tier fighters; AI values by need and scarcity with diminishing returns and its own imperfect scouting, fuzz-tested with exploit offers. Wages come from background × level × stardom plus a hidden greed factor ([dev blog](https://dev.gamebanshee.com/news/battle-brothers-developer-blog-110-more-stuff)), each tier has a wage-to-revenue rule, and debt triggers a transfer embargo first (inference).

**C3.12 Aging, retirement and career length: endless, win condition, or both?**
- *Endless sandbox:* freedom; stalls without goals ([forum](https://steamcommunity.com/app/4560660/discussions/0/570426530135597095/)).
- *Fixed endpoint or time cap:* a clear arc; Domina's time-capped mode drew complaints ([OpenCritic](https://opencritic.com/game/4105/Domina)).
- *Endless with goals* (patron directives, a legacy score, optional milestones and scenario challenges): both ([EA](https://www.ea.com/games/ea-sports-college-football/college-football-27/news/college-football-27-dynasty), [Wikipedia](https://en.wikipedia.org/wiki/Football_Manager_2013)).
- **Recommended:** endless with goals; aging and retirement **on by default** with Hattrick-like curves (growth slows after ~21, decline after ~28), a recommendation that rests on a search-result snippet ([TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/HatTrick)); careers of roughly 10–15 seasons (our inference, not from the notes); veterans can become staff.

**C3.13 Injuries and permadeath.**
- *Permadeath and career-ending injuries by default:* stakes and stories; RNG rage ([reviews](https://steamcommunity.com/app/365360/negativereviews/?browsefilter=toprated&filterLanguage=english)).
- *A severity ladder by default, death only in opt-in hardcore:* stakes with fairness ([KeenGamer](https://www.keengamer.com/articles/reviews/battle-brothers-review/)).
- *Soft or optional injuries:* "no stakes" complaints ([reviews](https://steamcommunity.com/app/1043260/positivereviews/?browsefilter=toprated&filterLanguage=english)).
- **Recommended:** the ladder (Form loss → weeks out → permanent scar → rare, capped career-ending) at AI-equal rates, modified by medical staff; permadeath only in hardcore.

**C3.14 How are fuzzy stats shown, and does potential move?**
- *Ranges + knowledge %* ([guide](https://www.passion4fm.com/football-manager-player-attributes/)); *reveal steps with grades* ([MUT.GG](https://www.mut.gg/news/madden-nfl-22-scouting-update-deep-dive/)); *word tiers* ([Swedish Wikipedia](https://sv.wikipedia.org/wiki/Hattrick_(datorspel))); *estimates + confidence* ([blog](https://baseballreplayjournal.substack.com/p/scouting-in-ootp)).
- Potential *fixed* (readable, feeds wonderkid hunting) ([FM Scout](https://www.fmscout.com/a-black-stars-in-scouting-reports.html)) or *dynamic* (alive, but blurs scouting's value) (search result only) ([forum](https://forums.ootpdevelopments.com/showthread.php?p=5132567)).
- *Registry baseline:* none (scouting fully required) vs a free, very wide read (nobody is blind, but the mandate softens) ([blog](https://baseballreplayjournal.substack.com/p/scouting-in-ootp)).
- **Recommended:** C1.5 on an absolute scale; potential mostly fixed, with a hidden development pace, limited event-driven changes (academy, injury) and a randomness slider. The baseline is an owner choice; if kept, make it very wide.

**C3.15 Academy shape and risk level.**
- *Safe, guaranteed gains:* no real decision.
- *Typed programs with modest, legible risk, mid-term recall and a lock:* real decisions ([Game Informer](https://www.gameinformer.com/preview/2018/08/17/nhl-19-franchise-mode-interview-learn-the-nitty-gritty-details-about-the-new); search result only: [review](https://www.sportsgamersonline.com/news/reviews/out-of-the-park-baseball-26-review-a-baseball-nerds-dream/)).
- *High-variance programs:* drama; one reviewer found most OOTP programs left players weaker or injured, which felt like a trap (search result only) ([review](https://www.sportsgamersonline.com/news/reviews/out-of-the-park-baseball-26-review-a-baseball-nerds-dream/)).
- **Recommended:** typed programs of ~3–6 in-game months, outcome ranges shown up front, worst case under-delivery or a minor injury. The light-duty variant is an owner choice (C1.8).

**C3.16 How much do we reveal of opponents' tactics before a match?**
- *Nothing without a scout:* scouting matters; blind losses feel unfair.
- *Style tag and last lineup always, more with better scouting:* fair, and rewards scouting ([forum](https://forum.quartertothree.com/t/mechabellum-tactical-autobattler-against-other-people/167835)).
- *Exact rules or an outcome forecast:* removes the need to adapt ([FullCleared](https://fullcleared.com/reviews/unicorn-overlord-review/)).
- **Recommended:** always show the fixture, style tag and last lineup; scout skill reveals top rules and stance; no outcome forecast. Before and during a match, rehearsal happens only in the sandbox, with its own seed and only the scouted rules; replay re-runs against the opponent's real rules unlock only after the match ends (C1.4, C3.6).

**C3.17 Difficulty and catch-up without exploitable tanking.**
- *Reward multipliers:* miss what players struggle with ([reviews](https://steamcommunity.com/app/4560660/negativereviews/?browsefilter=toprated&filterLanguage=english)).
- *Separate sliders* (AI quality, economy, scouting accuracy) plus armor-style AI handicaps ([GameBanshee](http://www.gamebanshee.com/kdarp), [wiki](https://hearthstone.wiki.gg/wiki/Battlegrounds/Armor)).
- *League-level catch-up* (underdog budgets, parachute payments, reverse-order youth draft, rising costs for dynasties) ([Wikipedia](https://en.wikipedia.org/wiki/Blood_Bowl)).
- **Recommended:** sliders plus capped catch-up, each always worth less than winning ([ONE Esports](https://www.oneesports.gg/dota-underlords/dota-underlordss-latest-update-caps-winning-and-losing-streaks)), with tanking strategies in QA soak tests.

**C3.18 Business model and multiplayer scope.**
- *Premium, no paid power:* Backpack Battles ($14.99, no microtransactions; ranked, unranked and live lobbies) ([store](https://store.steampowered.com/app/2427700/Backpack_Battles/)); Motorsport Manager (paid specifically to avoid pay-to-win) ([Game Developer](https://gamedeveloper.com/design/making-formula-1-accessible-with-i-motorsport-manager-i-)); Eslabong ($14.99 with a free demo, plus async PvP and co-op) ([store](https://store.steampowered.com/app/4560660/Eslabong/), [Aug–Sep patches](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=1500&enddate=1789948800)). Trust and no pay-to-win backlash; smaller reach than free-to-play.
- *Free-to-play with cosmetics* (TFT): reach; needs live operations a small team would struggle to staff (inference) ([Wikipedia](https://en.wikipedia.org/wiki/Teamfight_Tactics)).
- *Paid gameplay content:* revenue; the top complaint wherever it appears ([Vaporlens](https://vaporlens.app/app/1617400/the_bazaar.md)).
- Multiplayer: none; async ghost clubs later with normalised stats ([Aug–Sep patches](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=1500&enddate=1789948800)); or live PvP, the costliest (notes 05 advises single-player until the solo loop is solid, inference) ([Hardcore Gamer](https://hardcoregamer.com/nhl-27-review/)).
- **Recommended:** premium with a free demo and no paid power. **Offline-first** is our own recommendation, not a description of those games: a single-player game that cannot be shut down (inference from Storybook Brawl ([Decrypt](https://decrypt.co/137875/ftx-sam-bankman-fried-storybook-brawl-video-game-shutting-down))). Async ghost clubs only after launch, with save and tactics formats designed to allow them.

**C3.19 Lower-impact questions (suggested defaults).**
- *Season modifiers:* one league-wide modifier per season, announced at the start and opt-out, as Eslabong's are, plus permanent per-league house rules ([Sep–Oct patches](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=1500), [BlizzardWatch](https://blizzardwatch.com/2023/09/12/anomalies-hearthstone-battlegrounds-season-5/)).
- *Personality breadth:* a handful of readable traits, not Madden's 65+ types (inference) ([EA](https://www.ea.com/games/madden-nfl/madden-nfl-27/news/madden-27-franchise-mode)).
- *Press and morale:* structural chemistry only ([Substack](https://fmprojects.substack.com/p/make-football-manager-great-again)).
- *Youth intake:* an annual trials day with a preview, plus weekly scout calls ([Passion4FM](https://www.passion4fm.com/youth-intake-guide-how-clubs-produce-newgens/), [Youthclub wiki](https://wiki.hattrick-youthclub.org/players)).
- *Knowledge decay:* slow, refreshed by contact in matches ([Game Informer](https://www.gameinformer.com/preview/2018/08/17/nhl-19-franchise-mode-interview-learn-the-nitty-gritty-details-about-the-new)).
- *Talent reveal:* partial after N matches or the first academy term ([Diamond Lobby](https://diamondlobby.com/madden-24/madden-24-player-dev-trait-guide/)).
- *Action budgets:* never spent on playing matches ([NLSC](https://forums.nba-live.com/viewtopic.php?p=1979282)).
- *Mods:* data-driven league files and tactics codes at launch; Workshop later ([Game Developer](https://www.gamedeveloper.com/press-release/motorsport-manager-2-announced-playsport-returns-to-the-pit-wall-with-the-next-chapter-in-the-legendary-motorsport-management-series)).

## 5a. Part D — Owner-requested addendum: traits and captains

The owner added two requirements after Parts A–C: randomized fighter traits, about 80% positive and 20% negative, in the style of Crusader Kings; and a captain on every team, whose stats, traits and skills make him good or bad at it. Full detail is in [06 — Traits and captains](research-notes/06-traits-and-captains.md). Qualifiers follow §1. D3 is this document's recommendation, not sourced fact. All trait names below are original.

### D1. Traits findings

- **Crusader Kings keeps personality small, opposed and two-sided.**
  - CK3 characters tend to have at most three personality traits. Each has one or two opposites that cannot coexist ([CK3 Wiki](https://ck3.paradoxwikis.com/Traits)). The cap was chosen so characters read at a glance, after CK2's piles of traits did little (snippet) ([GamingOnLinux](https://www.gamingonlinux.com/articles/15647/)).
  - Most personality traits cut both ways: Ambitious gives +1 to every skill but −15 opinion of one's liege. Every trait also sets AI weights, such as Brave +200 boldness ([CK3 Wiki](https://ck3.paradoxwikis.com/Traits)).
  - Paradox aims for players to read an AI's plans from its traits, and admitted personality had often not mattered ([DD #104](https://devtrackers.gg/crusader-kings/p/059cf6b8-dev-diary-104-ai-ai-ai)).
- **Traits drive opinion, and stress keeps characters in character.**
  - Shared traits add opinion (+10 to +20), opposites subtract it (−10 to −15), and two Ambitious characters dislike each other (−15) ([CK3 Wiki](https://ck3.paradoxwikis.com/Traits)).
  - Acting against one's nature builds stress. Breaks at 100, 200 and 300 can add coping traits that carry drawbacks ([Stress](https://ck3.paradoxwikis.com/Stress)).
  - Players rank stress and emergent stories among CK3's top likes ([Vaporlens](https://vaporlens.app/app/1158310/crusader_kings_iii.md)), but always-stressed traits push some players to cherry-pick heirs (snippet) ([Steam](https://steamcommunity.com/app/1158310/discussions/0/3186865924607270710)).
- **Roster games use few traits, mirrored pairs and cures.**
  - Darkest Dungeon has 5 positive and 5 negative quirk slots and mirrored pairs. Each negative quirk has a 25% chance per mission to lock in, and the Sanitarium treats one per week ([DD Wiki](https://darkestdungeon.wiki.gg/wiki/Quirks)). Its afflictions act on their own, which reads as lost control (snippet) ([God is a Geek](https://godisageek.com/reviews/darkest-dungeon-review/)).
  - RimWorld uses 1–3 traits with spectrum degrees, exclusion pairs and no removal ([RimWorld Wiki](https://rimworldwiki.com/wiki/Traits)). Players reroll away pure negatives (snippet) ([Basics](https://www.rimworldwiki.com/wiki/Basics)).
  - Battle Brothers recruits carry 0–2 background-weighted traits ([Steam](https://steamcommunity.com/app/365360/discussions/0/1489992080508052323), [Keen Gamer](https://www.keengamer.com/articles/reviews/battle-brothers-review/)), revealed by a paid try-out (snippet) ([Raider King](https://raiderking.com/?p=1330)).
  - XCOM 2: War of the Chosen breeds negative traits from overwork and cures them in the infirmary ([GameBanshee](https://www.gamebanshee.com/kdd8x)).
  - FM's player traits are coach-taught habits whose value depends on the tactic, and unlearning one can take a season ([Passion4FM](https://www.passion4fm.com/football-manager-player-traits/)).
  - Blood Bowl prices its harshest drawbacks into its strongest players ([LP Archive](https://lparchive.org/Blood-Bowl-(by-GNU-Order)/Update%2004/)).
- **No game publishes a ratio.** Darkest Dungeon's 25% virtue chance is deliberately grim ([DD Wiki](https://darkestdungeon.wiki.gg/wiki/Virtue)). The owner's 80/20 suits fighters who are assets (inference).

### D2. Captaincy findings

- **Football Manager: a social lever with a debated on-pitch effect.** Leadership is the key attribute for choosing a captain (snippet) ([FM Scout](https://www.fmscout.com/a-football-manager-2023-hints-and-tips.html?pg=1)). Unhappy Team Leaders spread discontent ([The Set Pieces](https://thesetpieces.com/?p=19246)), and changing captain can upset him and the squad (snippet) ([footballmanager.com](https://footballmanager.com/node/129)). An FM Mobile 2017 test found team ratings within about 1% across four captains, though each rated higher with the armband ([FMM Vibe](https://fmmvibe.com/forums/topic/38819-battle-of-captains/)).
- **Hattrick:** the captain's experience and leadership reportedly feed team experience, which lowers confusion. This rests on 2003–05 forum claims with no formula (snippet) ([FOFC archive](https://forums.operationsports.com/fofc/archive/index.php/.../a%3E/t-25284.html)).
- **Madden and NBA 2K: captaincy as narrative and chemistry.** A Madden 27 captain can become a distraction after a bad negotiation ([Sun-Times](https://chicago.suntimes.com/nfl/2026/08/21/madden-27-review-curses-bears-and-caleb-williams-better-not-hope-so)). In 2K27, clashing personalities such as two Alpha Dogs slow chemistry ([2K](https://nba.2k.com/en-GB/2k27/features/mynba/)).
- **Blood Bowl:** Leader adds one scarce team reroll (snippet), yet NAF advises banning it in small formats (snippet) ([NAF](https://www.thenaf.net/wp-content/uploads/2019/09/Blood-Bowl-Sevens-2019.pdf)).
- **Commanders lend reliability, not damage.**
  - Total War's general lifts nearby morale and rallies routers; after his death, routing units shatter ([manual](https://r2enc.totalwar.com/en/manual/single-player/0087_enc_page_battle_play_phase_conflict_morale)).
  - Battle Brothers' sergeant rallies brothers within 4 hexes (snippet) ([RPGHQ](https://rpghq.org/forums/viewtopic.php?p=93749)) and is chosen for resolve ([Steam](https://steamcommunity.com/app/365360/discussions/0/4032475099154973610)).
  - Bannerlord's captain perks work only for the formation that hero leads ([Gamer Guides](https://gamerguides.com/mount-and-blade-ii-bannerlord/guide/perks/social/leadership)).
  - CK3 commander traits level up through victories ([CK3 Wiki](https://ck3.paradoxwikis.com/Traits)).
- **The esports in-game leader** calls each round and adjusts it as it unfolds, and often frags less ([Esports.net](https://www.esports.net/news/counter-strike/all-cs-player-roles/)). No autobattler with in-fight captain decisions was found.

### D3. Recommendations

**Trait taxonomy.** Each fighter rolls **3 traits** (range 2–4), with a cap of 4 slots including command:
- *Temperament* (1–2): opposite poles on about six axes, one pole per axis. These are two-sided by design. They tilt preset rules, tie-breaks and reaction delay without ever skipping a rule (C3.7), and they drive chemistry.
- *Build* (0–1): an innate gift or weakness in three tiers each way, fixed except by injury.
- *Craft* (0–1, up to 2 later): learned fighting habits whose value depends on the tactic.
- *Scar* (0–1): acquired from injury, overwork or strain. Scars are mostly negative and always treatable.
- *Command* (0–1, rare): active only while the fighter is captain or vice-captain.

**The 80/20 split, opposites and rarity.**
- Each generated trait rolls by net value. 80% come from boons (pure positives) or edges (net-positive trade-offs). 20% come from burdens (net-negative, but with a real upside or niche) or flaws (pure negatives); about three in four of these are burdens. Flaws are rare and always curable.
- No starting fighter carries more than one negative. Negatives are priced into fee and wage, and a background's odds show before signing.
- Scars sit outside the split because the player's choices cause them.
- Exclusion groups block contradictions, and some temperaments clash with themselves (two glory-hunters).
- Rarity runs common, uncommon, rare and storied. Storied traits are earned through events or captaincy and never rolled.

**Scouting and academy.**
- *Reveal order,* refining C1.5: build at first look; temperament at the traits step; craft with the stat bands; burdens, flaws and command traits last, or at a paid try-out day.
- *Uncertain reads* show as "rumoured" and can be wrong. Traits that fire against us in a match get revealed.
- *Academy* programs teach or remove a craft, with suitability and odds shown first. A treatment term clears one flaw or scar. A mentor, possibly the captain, shifts a young fighter's temperament one step over a season. No program creates builds.

**Chemistry.**
- Every starter pair has a value. It rises with shared temperament and shared fights (rescues, comebacks), and falls with opposite poles and self-clashing tags. Named levels give small adjacency bonuses, and the captain's traits count double for every pair.
- Rules that contradict a fighter's temperament (for example, making a reckless fighter kite) build visible **strain**. Strain lowers morale and can turn into a scar; rest clears it.

**Captaincy model.**
- *Choosing:* the player appoints a captain and vice-captain. Each fighter has a *standing* (tenure, age, Command, reputation), and passing over a clearly higher-standing veteran costs mood with him and his friends.
- *Good and bad captains:* the *Command* word tier, composure, experience, steady temperaments, command traits and a Rally skill make a good captain. Low Command, a volatile or self-clashing temperament, a nerve flaw or low standing make a bad one.
- *In fight:*
  - The two timed calls per round (C3.1) go through the captain. His Command sets their delay and his voice range, so fighters outside it hear late.
  - A composure aura cuts nearby reaction delay and panic. One Rally per match restores morale.
  - His rules set the "captain's target" (A4.1).
  - Calling briefly slows his own reactions, the in-game leader's trade-off.
  - Any single effect is capped at about 10%, with diminishing returns, and AI captains follow identical rules.
- *Captain down:* a short, capped wobble that the inspector names. The vice-captain then takes over calling at a smaller range.
- *Off field:* the captain damps morale swings after losses, mentors regardless of age, warns about unrest early, counts double in chemistry and sways re-signings.
- *Removal:* when the captain is benched or injured, the vice-captain handles calls and the captain keeps his off-field role. When he is sold, team mood drops in proportion to his standing and the vice-captain steps up. When he is stripped of the role, he loses mood and a proud captain may ask to leave. Command traits go dormant rather than vanish.

**Example traits:**
- EXAMPLE — **Banner-Sworn** (command, rare): as captain, nearby allies shake off one panic per round; if he falls, they gain 3 s of fury instead of the wobble.
- EXAMPLE — **Grudge-Keeper** (temperament; opposite **Clean-Slate**): +8% damage on whoever downed an ally this round; a retreat order within 3 s builds strain.
- EXAMPLE — **Coin-Hungry** (burden): asks 15% more wages and listens to rival offers; +composure when a win bonus is at stake.
- EXAMPLE — **Shieldwall-Drilled** (craft, teachable): +10% block beside an ally; −10% speed when no ally is within 3 tiles.
- EXAMPLE — **Cracked Nerve** (scar, treatable): +0.2 s reaction delay below 30% HP; one rest term clears it.

## 6. Research limitations

**Blocked or unavailable.** Reddit was blocked for notes 03 and 05 (notes 02 reached one thread via a mirror ([devtrackers](https://devtrackers.gg/teamfight-tactics/p/df2e092b-tft-looks-interesting-but-i-find-the-new-player-experience-too-wretched-to-endure))); so were Fandom wikis (HTTP 402), the Obsidian forums, StrategyWiki, Prima and the Gladiabots wiki (notes 03), forums.ea.com and the NLSC forums (notes 05), and several FM and OOTP pages (403s or timeouts, notes 04). None of the notes cite Steam's review JSON endpoint: review evidence comes from the HTML review pages plus Steam's headline percentages. Notes 02 sampled ~20 reviews per game (top-rated and most-recent pages); notes 01, 04 and 05 read the same kinds of pages at ~10 reviews each. Notes 03's search budget ran out, so Robocode, Colobot and Ni no Kuni were not researched.

**Design-relevant claims resting on search-result snippets only:**
- Hattrick's age curves (growth slows after ~21, decline after ~28), used in B1.3, B2.4 and C3.12 ([TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/HatTrick)).
- OOTP's scouting error model, Lab outcomes, Lab capacity and draft combine ([dev guide](https://forums.ootpdevelopments.com/showthread.php?p=5188669), [review](https://www.sportsgamersonline.com/news/reviews/out-of-the-park-baseball-26-review-a-baseball-nerds-dream/), [Scribd](https://www.scribd.com/document/740974558/changes)).
- Madden's hidden development tiers and scout caps ([Diamond Lobby](https://diamondlobby.com/madden-24/madden-24-player-dev-trait-guide/), [Diamond Lobby](https://diamondlobby.com/madden-24/madden-24-scouting-tips-franchise-mode/)); College Football's trait reveals, redshirt rule and recruiting-hour figures ([Prima](https://primagames.com/gaming/ea-college-football-25-development-traits-best-traits-how-they-work-and-how-to-unlock), [esports.gg](https://esports.gg/news/college-football-25/how-to-redshirt-a-player-in-college-football-25), [esports.gg](https://esports.gg/news/college-football-25/cfb-25-recruiting-guide-5-tips-to-getting-a-1-ranked-signing-class/)).
- Deadfire's target-priority and AND/OR/NOT details, Origins' slot and condition lists, and Inquisition-era sentiment, each marked "snippet" in A3.2 and A3.4.
- The Battle Brothers wage formula ([dev blog](https://dev.gamebanshee.com/news/battle-brothers-developer-blog-110-more-stuff)); Battlegrounds' paid-hero criticism ([esports.gg](https://esports.gg/news/hearthstone/hearthstone-battlegrounds-rewards-track-season-pass-is-bg-becoming-pay-to-win-with-runestones/)); FM's scout-skill guide, delegation, holiday mode and late-save boredom ([guide](https://www.passion4fm.com/?p=964), [official](https://footballmanager.com/node/673), [Dot Esports](https://dotesports.com/general/news/how-to-simulate-days-and-seasons-in-football-manager-2024), [forum](https://www.fmscout.com/q-3898-What-happens-in-the-end.html)).

**Unverified or thin.** Eslabong's match length, wages/contracts and any age stat; the claim that its scouting ignores scout skill (inference). Deadfire's condition count and whether it shows the active rule; Unicorn Overlord's slot cap and official condition semantics; Origins' full condition list; whether FFXII highlights the active gambit. Madden 27 on PC; any PC College Football; replay features in Super Auto Pets and Backpack Battles. Postmortems (Underlords, Storybook Brawl) and most "ideas for us" are inference. FM Touch's lack of press conferences rests on reader comments. Developer names for FFXII and Dragon Age were added from general knowledge.

**Evidence quality and recency.** Review samples are small and skewed to top-rated reviews; Vaporlens is an AI-generated aggregate; Raijin and SteamBase figures are third-party estimates. Everything is a 25 Oct 2026 snapshot: Eslabong ships builds several times a week; FM27's features are pre-release announcements; yearly editions (Madden, College Football, NBA 2K, NHL, OOTP) change annually; TFT economy values are patch-dependent; The Bazaar's pricing was mid-change. Some sources are old: Motorsport Manager's "set and watch" lesson comes from a 2014 article about a playtest before the PC release; FM guides date from the FM22 era and 2012–13; Hattrick data is mostly from 2007 ([Swedish Wikipedia](https://sv.wikipedia.org/wiki/Hattrick_(datorspel))); Battle Brothers 2017–18; NCAA Football 14 (2013).

**Conflicts flagged where they occur:** per-unit rules in autobattlers vs Eslabong's and TFM2's per-fighter settings (A4.1); whether any game shows the active rule (A4.2); two senses of "deterministic" (A4.6); differing intervention recommendations (C3.1); the closest academy analogue (B2.5); Backpack Battles' first-month sales, 640k vs 650k (A2.7); College Football's portal size, ~2,000 vs up to 3,500 (B1.5); FFXII's starting gambit slots (A3.3); Unicorn Overlord's condition semantics (A3.5).

## 7. Sources

Deduplicated list of every source cited above, grouped by the notes file it came from. Titles follow the notes; "search result", "search result only" and "(snippet)" mark pages the researchers saw only as search-result summaries. The notes files list a few further sources not cited here.

### A1 — Eslabong and combat/management hybrids (notes 01)

- Eslabong — Steam store page — https://store.steampowered.com/app/4560660/Eslabong/
- Eslabong — official site / press info — https://eslabong.com/
- Steam News API, Eslabong posts 21 Sep–23 Oct 2026 (patches 0.52.4–0.84.4) — https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=1500
- Steam News API, Eslabong posts 29 Aug–19 Sep 2026 (patches 0.33.11–0.51.4) — https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=1500&enddate=1789948800
- Steam News API, Eslabong posts Apr–28 Aug 2026 (devblogs, playtest, demo patches, EA launch, 0.31–0.33) — https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=40&maxlength=3000&enddate=1787961600
- Eslabong Devblogs #1–#4 (Apr–May 2026), full text via Steam News API — https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=5&maxlength=0&enddate=1777766400
- Eslabong 0.82.1 "Ascend to Champion" / Advanced Tactics notes (19 Oct 2026), via Steam News API — https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4560660&count=4&maxlength=0&enddate=1792454400
- Eslabong — top-rated negative Steam reviews (English) — https://steamcommunity.com/app/4560660/negativereviews/?browsefilter=toprated&filterLanguage=english
- Eslabong — top-rated positive Steam reviews (English) — https://steamcommunity.com/app/4560660/positivereviews/?browsefilter=toprated&filterLanguage=english
- Eslabong — most recent Steam reviews (English, 23–24 Oct 2026) — https://steamcommunity.com/app/4560660/reviews/?browsefilter=mostrecent&filterLanguage=english
- Eslabong — most recent negative Steam reviews (English) — https://steamcommunity.com/app/4560660/negativereviews/?browsefilter=mostrecent&filterLanguage=english
- Raijin.gg — Eslabong Steam stats & charts (third-party estimates) — https://raijin.gg/app/4560660/Eslabong
- Eslabong — Steam General Discussions index — https://steamcommunity.com/app/4560660/discussions/
- Eslabong discussion — "Unbalanced … Game" (difficulty/levels thread) — https://steamcommunity.com/app/4560660/discussions/0/590687538416527966/
- Eslabong discussions — search "retirement" — https://steamcommunity.com/app/4560660/discussions/search/?q=retirement&gidforum=0
- Eslabong discussion — "Retirement" (22 Oct 2026) — https://steamcommunity.com/app/4560660/discussions/0/562545439722860075/
- Eslabong discussion — "Please add progression" (incl. developer replies) — https://steamcommunity.com/app/4560660/discussions/0/570426530135597095/
- Eslabong discussions — search "tactics" — https://steamcommunity.com/app/4560660/discussions/search/?q=tactics&gidforum=0
- Eslabong discussion — "AI and stamina management" — https://steamcommunity.com/app/4560660/discussions/0/562545740485849739/
- Eslabong discussions — search "salary" — https://steamcommunity.com/app/4560660/discussions/search/?q=salary&gidforum=0
- Eslabong discussions — search "rounds" — https://steamcommunity.com/app/4560660/discussions/search/?q=rounds&gidforum=0
- Teamfight Manager — Steam store page — https://store.steampowered.com/app/1372810/Teamfight_Manager/
- Teamfight Manager — top-rated negative Steam reviews — https://steamcommunity.com/app/1372810/negativereviews/?browsefilter=toprated&filterLanguage=english
- Teamfight Manager — top-rated positive Steam reviews — https://steamcommunity.com/app/1372810/positivereviews/?browsefilter=toprated&filterLanguage=english
- Gideon's Gaming — "Team Fight Manager review: needs a little coaching" (2021) — https://gideonsgaming.com/team-fight-manager-review-needs-a-little-coaching
- Teamfight Manager 2 — Steam store page — https://store.steampowered.com/app/3009300/Teamfight_Manager_2/
- Teamfight Manager 2 — top-rated negative Steam reviews — https://steamcommunity.com/app/3009300/negativereviews/?browsefilter=toprated&filterLanguage=english
- Teamfight Manager 2 — top-rated positive Steam reviews — https://steamcommunity.com/app/3009300/positivereviews/?browsefilter=toprated&filterLanguage=english
- Vaporlens — Teamfight Manager 2 review analysis (aggregate, third-party) — https://vaporlens.app/app/3009300/teamfight_manager_2.md
- Battle Brothers — Steam store page — https://store.steampowered.com/app/365360/Battle_Brothers/
- Battle Brothers — top-rated negative Steam reviews — https://steamcommunity.com/app/365360/negativereviews/?browsefilter=toprated&filterLanguage=english
- Battle Brothers — top-rated positive Steam reviews — https://steamcommunity.com/app/365360/positivereviews/?browsefilter=toprated&filterLanguage=english
- KeenGamer — Battle Brothers review — https://www.keengamer.com/articles/reviews/battle-brothers-review/
- Gideon's Gaming — Battle Brothers Complete review — https://gideonsgaming.com/battle-brothers-complete-review/
- Battle Brothers Developer Blog #110 "More Stuff" (2018), via GameBanshee (page returned 403; content taken from search-result summary) — https://dev.gamebanshee.com/news/battle-brothers-developer-blog-110-more-stuff
- Wikipedia — Blood Bowl 3 — https://en.wikipedia.org/wiki/Blood_Bowl_3
- Blood Bowl 3 — top-rated negative Steam reviews — https://steamcommunity.com/app/1016950/negativereviews/?browsefilter=toprated&filterLanguage=english
- Wikipedia — Blood Bowl 2 — https://en.wikipedia.org/wiki/Blood_Bowl_2
- Blood Bowl 2 — top-rated positive Steam reviews — https://steamcommunity.com/app/236690/positivereviews/?browsefilter=toprated&filterLanguage=english
- Wikipedia — Blood Bowl (board game; league/progression/inducements/ageing history) — https://en.wikipedia.org/wiki/Blood_Bowl
- Gladiator Guild Manager — Steam store page — https://store.steampowered.com/app/1043260/Gladiator_Guild_Manager/
- Gladiator Guild Manager — top-rated negative Steam reviews — https://steamcommunity.com/app/1043260/negativereviews/?browsefilter=toprated&filterLanguage=english
- Gladiator Guild Manager — top-rated positive Steam reviews — https://steamcommunity.com/app/1043260/positivereviews/?browsefilter=toprated&filterLanguage=english
- Wikipedia — Domina (video game) — https://en.wikipedia.org/wiki/Domina_(video_game)
- The Daily Star — "Are you not entertained?" (Domina review) — https://www.thedailystar.net/shout/game-review/are-you-not-entertained-1558099
- OpenCritic — Domina — https://opencritic.com/game/4105/Domina
- Mordheim: City of the Damned — Steam store page — https://store.steampowered.com/app/276810/
- Mordheim — top-rated positive Steam reviews — https://steamcommunity.com/app/276810/positivereviews/?browsefilter=toprated&filterLanguage=english
- Mordheim — top-rated negative Steam reviews — https://steamcommunity.com/app/276810/negativereviews/?browsefilter=toprated&filterLanguage=english
- GameBanshee — "Battle Brothers Update 1.1 Released" (June 2017) — http://www.gamebanshee.com/kdarp

### A2 — Autobattlers (notes 02)

- Teamfight Tactics, Wikipedia — https://en.wikipedia.org/wiki/Teamfight_Tactics
- Riot, "/dev: Design Pillars of TFT" (18 Jun 2019) — https://teamfighttactics.leagueoflegends.com/en-gb/news/dev/dev-design-pillars-of-tft
- Surrender at 20, "Red Post Collection: /dev on TFT Set 1" (Oct 2019, reproduces Riot's Set 1 Learnings) — https://www.surrenderat20.net/2019/10/red-post-collection-dev-on-tft-set-1.html
- Riot (VNG mirror), "/dev: TFT Rise of the Elements Learnings" (2020) — https://dtcl.vnggames.com/en-us/news/dev/dev-tft-rise-of-the-elements-learnings
- Pocket Tactics, TFT GDC 2020 design lessons (updated Feb 2022) — https://www.pockettactics.com/teamfight-tactics-design
- GamesBeat, "Teamfight Tactics turns 7" (25 Jun 2026) — https://gamesbeat.com/teamfight-tactics-turns-7-riot-games-discusses-lessons-learned-and-the-road-ahead-exclusive-interview/
- Mobalytics, TFT economy guide (values patch-dependent) — https://mobalytics.gg/blog/tft/how-to-manage-your-economy-in-teamfight-tactics-three-strategies/
- SeeMeta, TFT Set 18 shop odds — https://seemeta.com/en/tft/set-18/odds
- League of Legends Wiki, V12.6 (TFT) Combat Recap hotkeys (Mar 2022) — https://wiki.leagueoflegends.com/en-us/V12.6_(Teamfight_Tactics)
- Inven Global, "Understanding Assassins and Counter-Strategies" (16 Jul 2019) — https://www.invenglobal.com/articles/8672/tft-guide-understanding-assassins-and-counter-strategies
- Riot, "Splash Art Returns to Teamfight Tactics" (6 Mar 2020) — https://teamfighttactics.leagueoflegends.com/en-gb/news/dev/splash-art-returns-to-teamfight-tactics/
- devtrackers.gg mirror of r/TFT new-player thread (~2025) — https://devtrackers.gg/teamfight-tactics/p/df2e092b-tft-looks-interesting-but-i-find-the-new-player-experience-too-wretched-to-endure
- Dota Underlords, Wikipedia — https://en.wikipedia.org/wiki/Dota_Underlords
- Destructoid, "I can't believe this abandoned Valve game still has players…" (14 Aug 2025) — https://www.destructoid.com/i-cant-believe-this-abandoned-valve-game-still-has-players-and-is-fun-4-years-later/
- PCGamesN, "Dota Underlords is struggling to keep its players" (Jan 2020) — https://www.pcgamesn.com/dota-underlords/player-count-drop
- ONE Esports, Underlords update caps win/loss streaks (6 Jul 2019) — https://www.oneesports.gg/dota-underlords/dota-underlordss-latest-update-caps-winning-and-losing-streaks
- BlueStacks, Underlords Season 1 update (item choices) — https://www.bluestacks.com/blog/game-guides/dota-underlords/dotaul-season-1-update-en.html
- High Ground Gaming, Dota Underlords review (28 Aug 2020) — https://www.highgroundgaming.com/dota-underlords-review/
- Steam Community, "why Dota Underlord die?" (Mar 2021) — https://steamcommunity.com/app/1046930/discussions/0/5168416410407459322
- Steam user reviews, Dota Underlords (sampled Oct 2026) — https://steamcommunity.com/app/1046930/reviews/
- StopGame, Valve appears to have abandoned Underlords (9 Dec 2021, Russian) — https://stopgame.ru/newsdata/51189/pohozhe_valve_okonchatelno_zabrosila_podderzhku_dota_underlords
- Dota Auto Chess, Wikipedia — https://en.wikipedia.org/wiki/Dota_Auto_Chess
- Inven Global, "A rare glimpse behind the creation of Auto Chess" (2019) — https://www.invenglobal.com/articles/7962/a-rare-glimpse-behind-the-creation-of-auto-chess
- Steam store, Auto Chess — https://store.steampowered.com/app/1530300/Auto_Chess/
- Steam user reviews, Auto Chess (sampled Oct 2026) — https://steamcommunity.com/app/1530300/reviews/
- Super Auto Pets, Wikipedia — https://en.wikipedia.org/wiki/Super_Auto_Pets
- Super Auto Pets Wiki, "The Basics" — https://superautopets.wiki.gg/wiki/The_Basics
- Super Auto Pets Wiki, "Glossary" — https://superautopets.wiki.gg/wiki/Glossary
- Steam store, Super Auto Pets — https://store.steampowered.com/app/1714040/Super_Auto_Pets/
- Steam Community, SAP "Animal Pack" pay-to-win thread (1 Oct 2021) — https://steamcommunity.com/app/1714040/discussions/0/2958293022025588185
- Vaporlens (AI review aggregation), Super Auto Pets — https://vaporlens.app/app/1714040/super_auto_pets.md
- Steam store, The Bazaar (viewed 25 Oct 2026) — https://store.steampowered.com/app/1617400/The_Bazaar/
- The Outer Haven, "Tempo announces new pricing and update structure for The Bazaar" (3 Sep 2025) — https://www.theouterhaven.net/tempo-announces-new-pricing-and-update-structure-for-the-bazaar/
- CardGamer, "6 Reasons Why The Bazaar's Open Beta Caused An Uproar" (10 Mar 2025) — https://cardgamer.com/games/digital-card-games/the-bazaar/6-reasons-why-the-bazaars-open-beta-caused-an-uproar
- TheBazaarZone (republished Tempo Steam post), "Mobile Announcement + Future Plans" (15 Oct 2026) — https://thebazaarzone.com/mobile-announcement-future-plans/
- Mobalytics, The Bazaar day guide (2025–26) — https://mobalytics.gg/the-bazaar/guides/day-guide
- Mobalytics, The Bazaar keywords and terms (2025–26) — https://mobalytics.gg/the-bazaar/guides/keywords-and-terms
- Mobalytics, The Bazaar items, enchantments and skills (item sizes) — https://mobalytics.gg/the-bazaar/items-enchantments-skills
- Vaporlens (AI review aggregation), The Bazaar — https://vaporlens.app/app/1617400/the_bazaar.md
- Steam user reviews, The Bazaar (sampled Oct 2026) — https://steamcommunity.com/app/1617400/reviews/
- BazaarDB Tracker (third-party fight replays) — https://sin.bazaardb.gg/tracker
- Mechabellum, Wikipedia — https://en.wikipedia.org/wiki/Mechabellum
- Steam store, Mechabellum — https://store.steampowered.com/app/669330/Mechabellum/
- GamesBeat, "Mechabellum gets a second chance as Dreamhaven relaunches…" (25 Mar 2025) — https://gamesbeat.com/mechabellum-gets-a-second-chance-as-dreamhaven-relaunches-the-mech-autobattler/
- FinalBoss.io, Mechabellum beginner guide to roles, deployment, towers (Jul 2026) — https://finalboss.io/mechabellum-beginner-guide-to-unit-roles-deployment-and
- Gamepressure, Mechabellum tips for beginners (early access era) — https://www.gamepressure.com/S013-amp.asp?ID=22125
- Steam Community, Mechabellum Heavy Target / Steel Ball thread (2 Jun 2023) — https://steamcommunity.com/app/669330/discussions/0/3833172420312842660
- Quarter to Three forum, "Mechabellum – tactical autobattler against other people" (multi-year thread) — https://forum.quartertothree.com/t/mechabellum-tactical-autobattler-against-other-people/167835
- Turn Based Lovers, "Mechabellum 2.0 launches September 22…" (Sep 2026) — https://turnbasedlovers.com/overview/mechabellum-2-0/
- Vaporlens (AI review aggregation), Mechabellum — https://vaporlens.app/app/669330/mechabellum.md
- Steam user reviews, Mechabellum (sampled Oct 2026) — https://steamcommunity.com/app/669330/reviews/
- Backpack Battles, Wikipedia — https://en.wikipedia.org/wiki/Backpack_Battles
- Steam store, Backpack Battles — https://store.steampowered.com/app/2427700/Backpack_Battles/
- Game World Observer, "Backpack Battles sales: 640k copies, China top country" (25 Apr 2024) — https://gameworldobserver.com/2024/04/25/backpack-battles-sales-640k-copies-china-top-country
- GameDiscoverCo, "How Backpack Battles sold 650k copies in its first month" (2024; seen via search, page fetch failed) — https://newsletter.gamediscover.co/p/how-backpack-battles-sold-650k-copies
- Steam Community, Backpack Battles ranked/RNG complaint with developer reply (Feb 2024) — https://steamcommunity.com/app/2427700/discussions/0/4203616558110689260
- Vaporlens (AI review aggregation), Backpack Battles — https://vaporlens.app/app/2427700/backpack_battles.md
- Steam user reviews, Backpack Battles (sampled Oct 2026) — https://steamcommunity.com/app/2427700/reviews/
- Hearthstone Wiki, "Battlegrounds" — https://hearthstone.wiki.gg/wiki/Battlegrounds
- Game Developer, "Why the Hearthstone devs wanted to make an auto battler" (11 Nov 2019) — https://gamedeveloper.com/design/why-the-i-hearthstone-i-devs-wanted-to-make-an-auto-battler
- Hearthstone Wiki, "Battlegrounds/Armor" — https://hearthstone.wiki.gg/wiki/Battlegrounds/Armor
- Blizzard forums, "Battlegrounds Developer Insights: Updated Trinket Rules" (6 Apr 2026) — https://us.forums.blizzard.com/en/hearthstone/t/158955/1
- Blizzard forums, "Battlegrounds Animation Issues" (6 Oct 2024) — https://us.forums.blizzard.com/en/hearthstone/t/battlegrounds-animation-issues/135955
- Out of Games, Hearthstone minion trigger speeds increasing (c. 2020) — https://outof.games/hearthstone/758-hearthstone-gameplay-is-going-to-be-faster-minion-trigger-speeds-increasing-by-300-in-an-upcoming-patch
- Esports.gg, "Battlegrounds Rewards Track and Season Pass: is BG becoming pay-to-win?" (2022; seen via search, fetch blocked) — https://esports.gg/news/hearthstone/hearthstone-battlegrounds-rewards-track-season-pass-is-bg-becoming-pay-to-win-with-runestones/
- BlizzardWatch, Battlegrounds Anomalies guide (Sep 2023) — https://blizzardwatch.com/2023/09/12/anomalies-hearthstone-battlegrounds-season-5/
- Storybook Brawl, Wikipedia — https://en.wikipedia.org/wiki/Storybook_Brawl
- Decrypt, "FTX Acquired a Video Game That Sam Bankman-Fried Loved. Now It's Shutting Down" (25 Apr 2023) — https://decrypt.co/137875/ftx-sam-bankman-fried-storybook-brawl-video-game-shutting-down
- HSReplay, "Storybook Brawl, the perfect game for Battlegrounds players? Part 2" (23 Sep 2022) — https://articles.hsreplay.net/2022/09/23/storybook-brawl-the-perfect-game-for-battlegrounds-players-2/
- Steam user reviews, Storybook Brawl (app hub still online, sampled Oct 2026) — https://steamcommunity.com/app/1367020/reviews/
- Apple App Store, Dota Underlords listing (Season One, City Crawl, $4.99 battle pass copy) — https://apps.apple.com/app/id1465996312

### A3 — Player-configurable unit AI (notes 03)

- Gladiabots Inception (Game Developer) — https://www.gamedeveloper.com/design/gladiabots-inception
- GLADIABOTS on Steam — https://store.steampowered.com/app/871930/GLADIABOTS__AI_Combat_Arena/
- Gladiabots Steam reviews (top rated) — https://steamcommunity.com/app/871930/reviews/?browsefilter=toprated
- Steam: Multiple calls to same Sub AI increase AI size — https://steamcommunity.com/app/871930/discussions/0/1642039362988268518/
- Steam guide: Welcome To Gladiabots (since removed) — https://steamcommunity.com/sharedfiles/filedetails/?id=1759851189
- Steam guide: AI Writing Techniques (Gladiabots) — https://steamcommunity.com/sharedfiles/filedetails/?id=2154546931
- Gladiabots Alpha 13 devlog — https://gfx47.itch.io/gladiabots/devlog/34211/gladiabots-alpha-13-is-live
- Gaming Respawn: Gladiabots review — https://gamingrespawn.com/reviews/34358/gladiabots-review/
- Gladiabots Wiki: Advanced (snippet) — https://wiki.gladiabots.com/index.php?title=Advanced
- PCGamesN: Pillars of Eternity II's programmable AI — https://www.pcgamesn.com/pillars-of-eternity-2-deadfire/pillars-of-eternity-ii-companions-custom-ai
- Obsidian: Deadfire Update 49 – Patch 1.1 — https://eternity.obsidian.net/news/pillars-of-eternity-ii-deadfire-update-49---patch-11
- Steam: Deadfire AI Behaviors for Beginners — https://steamcommunity.com/app/560130/discussions/0/1693795812309628406
- Steam: Deadfire AI Script Behavior improvements — https://steamcommunity.com/app/560130/discussions/0/1696048245844756614/
- Gry-Online: Deadfire party AI guide (Polish) — https://www.gry-online.pl/poradniki/pillars-of-eternity-2-deadfire/sztuczna-inteligencja-ai-druzyny/zc17866
- RPG Site: Deadfire review — https://rpgsite.net/review/7139-pillars-of-eternity-ii-deadfire-review
- Nexus Mods: More Custom AI Conditions (snippet) — https://www.nexusmods.com/pillarsofeternity2/mods/88?tab=posts
- Steam guide: AI Behavior – understanding how it works (snippet) — https://steamcommunity.com/sharedfiles/filedetails/?id=1392162466
- PlayStation Blog: How FFXII's Gambit created a distinct RPG — https://blog.playstation.com/?p=192698
- Wikipedia: Final Fantasy XII — https://en.wikipedia.org/wiki/Final_Fantasy_XII
- Gamer Guides: FFXII battle system — https://gamerguides.com/final-fantasy-xii/guide/basics/gameplay-mechanics/battle-system
- Jegged: FFXII Gambits — https://jegged.com/Games/Final-Fantasy-XII/Gambits/
- RPG Site: Final Fantasy XII review — https://www.rpgsite.net/review/2789-final-fantasy-xii-review
- FFXII and the Illusion of Free Will (essay) — https://publish.obsidian.md/taniynquest/Final+Fantasy+XII+and+the+Illusion+of+Free+Will
- Player2: FFXII The Zodiac Age review — https://www.player2.net.au/2017/07/final-fantasy-xii-the-zodiac-age-review/
- Giant Bomb user review: FFXII (snippet) — https://www.giantbomb.com/final-fantasy-xii/3030-11497/user-reviews/2200-3319/
- StrategyWiki: FFXII Gambits (snippet) — https://strategywiki.org/wiki/Final_Fantasy_XII/Gambits
- Dragon Age Wiki: Combat Tactics (snippet) — https://dragonage.fandom.com/wiki/Combat_Tactics
- Dragon Age Wiki: Tactics (Origins) (snippet) — https://dragonage.fandom.com/wiki/Tactics_(Origins)
- Steam: DA:O tactics thread — https://steamcommunity.com/app/47810/discussions/0/2579854400736575780/
- Steam: DA:O tactics advice thread — https://steamcommunity.com/app/47810/discussions/0/1319961868324922289
- Sorcerers.net: Dragon Age scripting — https://sorcerers.net/Games/DragonAge/Walkthrough/getting-started/scripting.php
- LiveJournal: Tactics – Origins Revisited — https://dragon-age.livejournal.com/348046.html
- Giant Bomb forums: Inquisition hints and tips (snippet) — https://www.giantbomb.com/forums/dragon-age-inquisition-7175/inquisition-hints-tips-tricks-1500141/
- Steam: DA:Inquisition discussion (snippet) — https://steamcommunity.com/app/1222690/discussions/0/598512477964095800
- PlayStation LifeStyle: Veilguard companion control "detrimental" — https://www.playstationlifestyle.net/2024/08/09/dragon-age-the-veilguard-companions-controlled-detrimental/
- Seasoned Gaming: Veilguard review — https://seasonedgaming.com/2024/11/20/review-dragon-age-the-veilguard-less-chatting-more-clashing/
- Steam: Veilguard discussion (snippet) — https://steamcommunity.com/app/1845910/discussions/0/4635985982183765729
- RPG Site: Unicorn Overlord tactics, priority, battle stages — https://www.rpgsite.net/news/15481-unicorn-overlord-highlights-tactics-priority-and-battle-stages-along-with-several-new-non-human-allies
- Prima Games: Unicorn Overlord tactics and conditions explained (snippet) — https://primagames.com/gaming/unicorn-overlord-tactics-and-conditions-explained
- ResetEra: Unicorn Overlord OT, page 10 — https://www.resetera.com/threads/unicorn-overlord-ot-ogre-battle-24-the-queens-gambit.824595/page-10
- Nameless Quality: The Unicorn Overlord Tactics System — https://namelessquality.com/the-unicorn-overlord-tactics-system/
- Game Informer: Unicorn Overlord review — https://gameinformer.com/review/unicorn-overlord/tactical-superiority
- FullCleared: Unicorn Overlord review — https://fullcleared.com/reviews/unicorn-overlord-review/
- GamingTrend: Unicorn Overlord review — https://gamingtrend.com/unicorn-overlord-review-for-king-and-country/
- Dragon Quest Wiki: Artificial Intelligence — https://dragon-quest.org/wiki/Artificial_Intelligence
- Wikipedia: Carnage Heart (snippet) — https://en.wikipedia.org/wiki/Carnage_Heart
- Screeps World on Steam (snippet) — https://store.steampowered.com/app/464350/Screeps_World
- Jegged: FFXIII Paradigm explanation (snippet) — https://jegged.com/Games/Final-Fantasy-XIII/Paradigms/Paradigm-Explanation.html
- Megami Tensei Wiki: Tactics (snippet) — https://megatenwiki.com/wiki/Tactics
- Beamdog forums: Infinity Engine AI scripting (snippet) — https://forums.beamdog.com/discussion/comment/867341
- Wikipedia: Ogre Battle: The March of the Black Queen (snippet) — https://en.wikipedia.org/wiki/Ogre_Battle:_The_March_of_the_Black_Queen
- ActuGaming: No Plan B interview with GFX47 (snippet) — https://www.actugaming.net/no-plan-b-interview-agfd-443201
- Wikipedia: Unicorn Overlord (snippet) — https://en.wikipedia.org/wiki/Unicorn_Overlord

### B1 — Sports management and career modes (notes 04 and 05)

- Wikipedia: Football Manager 26 — https://en.wikipedia.org/wiki/Football_Manager_26
- FM Scout: FM27 New Features Guide (updated 22 Oct 2026) — https://www.fmscout.com/a-football-manager-2027-new-features.html
- FM Scout: Miles Jacobson explains FM25 cancellation and FM26 plans (29 Aug 2025) — https://www.fmscout.com/a-miles-jacobson-explains-fm25-cancellation-and-fm26-plans.html
- Steam: Football Manager 26 store page (reviews as of Oct 2026) — https://store.steampowered.com/app/3551340/Football_Manager_26/
- Steam Community: FM26 top-rated negative reviews — https://steamcommunity.com/app/3551340/negativereviews/?browsefilter=toprated&filterLanguage=english
- Steam: Football Manager 2024 store page — https://store.steampowered.com/app/2252570/Football_Manager_2024/
- Steam Community: FM24 top-rated positive reviews — https://steamcommunity.com/app/2252570/positivereviews/?browsefilter=toprated&filterLanguage=english
- Steam Community: FM24 top-rated negative reviews — https://steamcommunity.com/app/2252570/negativereviews/?browsefilter=toprated&filterLanguage=english
- FM Scout: FM26 Recruitment Revamp (8 Oct 2025) — https://www.fmscout.com/a-fm26-recruitment-revamp.html
- Passion4FM: Building Your Scouting Network in Football Manager (FM22-era, dated 2024) — https://www.passion4fm.com/?p=1127
- FM Scout: Current and Potential Ability Guide (2022) — https://www.fmscout.com/a-current-and-potential-ability-guide-2022.html
- FM Scout: Black stars in scouting reports (Oct 2016) — https://www.fmscout.com/a-black-stars-in-scouting-reports.html
- Diamond Lobby: FM23 scouting guide — https://diamondlobby.com/football-manager-2023/fm23-scouting-guide/
- Passion4FM: Football Manager Player Attributes Explained (Jan 2025) — https://www.passion4fm.com/football-manager-player-attributes/
- Passion4FM: How to Find the Best Scouts in Football Manager (search result only) — https://www.passion4fm.com/?p=964
- Passion4FM: Youth Intake guide, how clubs produce newgens — https://www.passion4fm.com/youth-intake-guide-how-clubs-produce-newgens/
- FM Scout: A basic guide to Lower League Management (Jun 2013) — https://www.fmscout.com/a-basic-guide-to-lower-league-management-llm.html
- Game Informer: Inside the Dynamics of Football Manager 2018 (Nov 2017) — https://gameinformer.com/b/features/archive/2017/11/06/the-sports-desk-inside-the-dynamics-of-football-manager-2018
- FM Projects (Substack): Make Football Manager Great Again (Jan 2025) — https://fmprojects.substack.com/p/make-football-manager-great-again
- FM Projects (Substack): Holidaying in Football Manager (Oct 2024) — https://fmprojects.substack.com/p/holidaying-in-football-manager
- Wikipedia: Football Manager 2013 (Classic mode, Challenges) — https://en.wikipedia.org/wiki/Football_Manager_2013
- Pocket Tactics: Football Manager 2020 Mobile review (Mar 2020) — https://www.pockettactics.com/football-manager-2020-mobile/review
- Nintendo Life: FM Touch 2018 on Switch (Apr 2018; reader comments) — https://www.nintendolife.com/news/2018/04/football_manager_touch_2018_kicks_off_today_on_nintendo_switch
- Football Manager (official): How to Delegate Staff Responsibilities in FM22 (search result only) — https://footballmanager.com/node/673
- Dot Esports: How to simulate days and seasons in FM24 (holiday mode) (search result only) — https://dotesports.com/general/news/how-to-simulate-days-and-seasons-in-football-manager-2024
- Steam: Out of the Park Baseball 27 — https://store.steampowered.com/app/4045750/Out_of_the_Park_Baseball_27
- Steam Community: OOTP 26 top-rated negative reviews — https://steamcommunity.com/app/3116890/negativereviews/?browsefilter=toprated&filterLanguage=english
- Steam Community: OOTP 26 top-rated positive reviews — https://steamcommunity.com/app/3116890/positivereviews/?browsefilter=toprated&filterLanguage=english
- Baseball Replay Journal: Scouting in OOTP (Mar 2025) — https://baseballreplayjournal.substack.com/p/scouting-in-ootp
- OOTP Developments Newsletter #43 (OOTP 9 scouting redesign, c. 2008) — https://www.ootpdevelopments.com/newsletters/nl0043/
- OOTP Forums: Matt Arnold, "A developer's guide to the new Scouting System" (May 2025) (search result only, 403) — https://forums.ootpdevelopments.com/showthread.php?p=5188669
- OOTP Forums: Talent Change Randomness discussion (search result only) — https://forums.ootpdevelopments.com/showthread.php?p=5132567
- Sports Gamers Online: OOTP 26 review (search result only, 403) — https://www.sportsgamersonline.com/news/reviews/out-of-the-park-baseball-26-review-a-baseball-nerds-dream/
- Game Developer: OOTP 25 launch press release (Mar 2024) — https://www.gamedeveloper.com/press-release/out-the-park-baseball-25-takes-the-field-with-all-new-innovative-features-in-the-award-winning-baseball-strategy-game-now-available-worldwide
- Wikipedia: Hattrick (video game) — https://en.wikipedia.org/wiki/Hattrick_(video_game)
- Constantinou, Higgins, Kitson: "Decoding the mechanisms of the Hattrick football manager game using Bayesian network structure learning", arXiv 2504.09499 (Entertainment Computing, 2026) — https://arxiv.org/abs/2504.09499
- German Wikipedia: Hattrick (Computerspiel) — https://de.wikipedia.org/wiki/Hattrick_(Computerspiel)
- Swedish Wikipedia: Hattrick (datorspel) (notes its information is mostly from 2007) — https://sv.wikipedia.org/wiki/Hattrick_(datorspel)
- Hattrick Youthclub (community CHPP tool) — https://hattrick-youthclub.org/
- Hattrick Youthclub Wiki: players page — https://wiki.hattrick-youthclub.org/players
- Trustpilot: hattrick.org reviews (2019–2026) — https://au.trustpilot.com/review/hattrick.org
- TV Tropes: Hattrick (search result only, 403) — https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/HatTrick
- FM Scout forum: "What happens in the end" thread (older FM era) (search result only) — https://www.fmscout.com/q-3898-What-happens-in-the-end.html
- Sortitoutsi: FM24 Youth Development Guide, mentoring and training wonderkids (search result only, 403) — https://sortitoutsi.net/content/63677/fm24-youth-development-guide-mentoring-and-training-wonderkids
- Top Gear: Football Manager 26 review (search result only, 403) — https://topgear.com/car-news/gaming/football-manager-26-review-fantastic-match-engine-tangled-mess-menus
- Scribd: OOTP 25 changes list (development complex note) (search result only) — https://www.scribd.com/document/740974558/changes
- OOTP Forums: fictional pro/rel pyramid threads (search result only; one of several threads surfaced) — https://forums.ootpdevelopments.com/showthread.php?p=5253336
- EA Sports, "Madden NFL 27 – Franchise Deep Dive" (June 4, 2026) — https://www.ea.com/games/madden-nfl/madden-nfl-27/news/madden-27-franchise-mode
- Steve Noah, Operation Sports, "Madden NFL 27 Franchise Mode Details Revealed" (June 7, 2026) — https://www.operationsports.com/madden-nfl-27-franchise-mode-details-revealed/
- Massimo Marchiano, ClutchPoints, "Madden 27 Review – Persona Non Grata" (Aug 18, 2026) — https://clutchpoints.com/gaming/madden-27-review
- Danreb Victorio, Smashpad, "Madden NFL 27 Review" (Aug 13, 2026) — https://smashpad.com/madden-nfl-27-review/
- EA Sports, "Madden NFL 27 Title Update – August 26, 2026." — https://www.ea.com/games/madden-nfl/madden-nfl-27/news/m27-title-update-august-26-2026
- Brian Shea, Game Informer, "EA Sports Updates Fans On Its Vision For Madden's Franchise Mode" (Aug 3, 2020) — https://www.gameinformer.com/index.php/2020/08/03/ea-sports-updates-fans-on-its-vision-for-maddens-franchise-mode
- MUT.GG, "Madden NFL 22 Scouting Update Deep Dive" (Sept 17, 2021) — https://www.mut.gg/news/madden-nfl-22-scouting-update-deep-dive/
- Diamond Lobby, "Madden 24 Scouting Tips (Franchise Mode)" (search result) — https://diamondlobby.com/madden-24/madden-24-scouting-tips-franchise-mode/
- Diamond Lobby, "Madden 24 Player Dev Trait Guide" (search result) — https://diamondlobby.com/madden-24/madden-24-player-dev-trait-guide/
- EA Help, "Progression and regression in Franchise" (search result) — https://help.ea.com/en/articles/madden-nfl/progression-regression-franchise-mode/
- Madden School, "The New Madden 21 Trade Logic Is Still Hilariously Broken" (c. March 2021) — https://www.madden-school.com/the-new-madden-21-trade-logic-is-still-hilariously-broken-here-are-some-examples/
- Insider Gaming, "Madden 26 Franchise Deep Dive Shows New Coaching Updates, Gameplan Changes and More" (2025) (search result) — https://insider-gaming.com/madden-26-franchise-deep-dive-shows-new-coaching-updates-gameplan-changes-and-more/
- EA Sports, "College Football 27 – Dynasty & Team Builder Deep Dive" (June 4, 2026) — https://www.ea.com/games/ea-sports-college-football/college-football-27/news/college-football-27-dynasty
- Robby Kalland, CBS Sports, "EA Sports College Football 26 Dynasty Mode deep dive" (June 24, 2025) — https://www.cbssports.com/college-football/news/ea-sports-college-football-26-dynasty-mode-deep-dive-exploring-the-biggest-changes-and-updates
- EA Sports, "College Football 26 – Dynasty" feature page (2025) — https://www.ea.com/en/games/ea-sports-college-football/college-football-26/features/cfb26-dynasty
- Bill DiFilippo, UPROXX, "'EA Sports College Football 25' Dynasty Review: The Mode We All Hoped For" (July 18, 2024) — https://uproxx.com/?p=404163987
- Esports.gg, "CFB 25 recruiting guide: 5 tips to getting a #1 ranked signing class" (2024) (search result) — https://esports.gg/news/college-football-25/cfb-25-recruiting-guide-5-tips-to-getting-a-1-ranked-signing-class/
- Dexerto, "College Football 25 August 8 update patch notes" (Aug 8, 2024) — https://www.dexerto.com/gaming/college-football-25-august-8-patch-notes-2855263/
- Sportskeeda, "10 biggest issues in EA Sports College Football 25 post release" (2024) (search result) — https://www.sportskeeda.com/college-football/10-biggest-issues-ea-sports-college-football-25-post-release
- Prima Games, "EA College Football 25 Development Traits" (2024) (search result) — https://primagames.com/gaming/ea-college-football-25-development-traits-best-traits-how-they-work-and-how-to-unlock
- Esports.gg, "How to redshirt a player in College Football 25" (2024) (search result) — https://esports.gg/news/college-football-25/how-to-redshirt-a-player-in-college-football-25
- Mike Suszek, Engadget, "NCAA 14 Dynasty mode levels up with coach skills, recruiting changes" (May 29, 2013) — https://www.engadget.com/2013-05-29-ncaa-14-dynasty-mode-levels-up-with-coach-skills-recruiting-cha.html
- Game Informer, "NCAA 14 Review: Not The Complete Product" (July 9, 2013) (search result) — https://gameinformer.com/games/ncaa_football_14/b/xbox360/archive/2013/07/09/ncaa-14-review-not-the-complete-product
- 2K Newsroom, "NBA 2K27 MyNBA Answers the Community with a Back to Basics Franchise Overhaul and Modern CBA Rules" (Aug 18, 2026) — https://newsroom.2k.com/news/nbar-2k27-mynba-answers-the-community-with-a-back-to-basics-franchise-overhaul-and-modern-cba-rules
- 2K, "NBA 2K27 – MyNBA" feature page (2026) — https://nba.2k.com/2k27/features/mynba/
- Steve Noah, Operation Sports, "NBA 2K27 MyNBA Details Revealed" (Aug 18, 2026) — https://www.operationsports.com/nba-2k27-mynba-details-revealed/
- 2K Newsroom, "Endless Possibilities Await as MyNBA Levels Up in NBA 2K26" (Aug 21, 2025) — https://newsroom.2k.com/news/endless-possibilities-await-as-mynba-levels-up-in-nbar-2k26
- Matt Bertz, Game Informer, "NBA 2K20 Introduces Big Changes For The MyGM And MyLeague Modes" (July 29, 2019) — https://www.gameinformer.com/preview/2019/07/28/nba-2k20-introduces-big-changes-for-the-mygm-and-myleague-modes
- 2K, "NBA 2K25 PC FAQ" (2024) (search result) — https://nba.2k.com/2k25/pc-faq/
- Ishaan Bhattacharya, Fadeaway World, "NBA 2K22 Had A Massive Bug Where Free Agents In MyNBA Became 99 Years Old" (July 15, 2022) — https://fadeawayworld.net/nba-2k/nba-2k22-had-a-massive-bug-where-free-agents-in-mynba-became-99-years-old
- NLSC Forums, "MyGM is looking like a hard pass this year" (2019) (search result) — https://forums.nba-live.com/viewtopic.php?p=1979282
- Cory Wells, Hardcore Gamer, "Review: NHL 27" (Sept 3, 2026) — https://hardcoregamer.com/nhl-27-review/
- Jon Scarr, Best Buy Canada Blog, "NHL 26 review" (Sept 12, 2025) — https://blog.bestbuy.ca/video-games/nhl-26-review
- Matt Bertz, Game Informer, "NHL 19 Franchise Mode Interview: Learn The Nitty Gritty Details About The New..." (Aug 17, 2018) — https://www.gameinformer.com/preview/2018/08/17/nhl-19-franchise-mode-interview-learn-the-nitty-gritty-details-about-the-new
- Diamond Lobby, "How Potential Works in NHL 23 Franchise Mode" (updated Feb 21, 2023) — https://diamondlobby.com/nhl-23/how-potential-works-nhl-23-franchise-mode/
- EA Sports, "NHL 25 – Franchise Mode" feature page (2024) — https://ea.com/games/nhl/nhl-25/features/franchise-mode
- EA Forums, "Prospects in AHL" (NHL 26) (search result) — https://forums.ea.com/discussions/nhl-26-general-discussion-en/prospects-in-ahl/13553974
- Mike Rose, Game Developer, "Making Formula 1 accessible with Motorsport Manager" (Aug 22, 2014) — https://gamedeveloper.com/design/making-formula-1-accessible-with-i-motorsport-manager-i-
- Will Wood, RaceFans, "Motorsport Manager: Meeting the brains behind the game" (Aug 10, 2016) — https://www.racefans.net/2016/08/10/meeting-man-behind-motorsport-manager/
- Matthew Kato, Game Informer, "The Sports Desk – Behind The Wheel Of Motorsport Manager" (Aug 15, 2016) — https://gameinformer.com/b/features/archive/2016/08/15/the-sports-desk-behind-the-wheel-of-motorsport-manager
- Steam, "Motorsport Manager" store page (fetched Oct 25, 2026) — https://store.steampowered.com/app/415200/Motorsport_Manager/
- Steam Community, Motorsport Manager top-rated positive reviews (fetched Oct 25, 2026) — https://steamcommunity.com/app/415200/positivereviews/?browsefilter=toprated
- Steam Community, Motorsport Manager top-rated negative reviews (fetched Oct 25, 2026) — https://steamcommunity.com/app/415200/negativereviews/?browsefilter=toprated
- Steam Discussions, "Promotions and stats / expectations" (Jan 16, 2017) — https://steamcommunity.com/app/415200/discussions/0/142261352661385160
- Steam Discussions, "Budget Issues" (Feb 9, 2017) — https://steamcommunity.com/app/415200/discussions/0/133256758576774722
- Windows Central, "Motorsport Manager preview" (2016) (search result) — https://www.windowscentral.com/motorsport-manager-preview
- Wikipedia, "Motorsport Manager." — https://en.wikipedia.org/wiki/Motorsport_Manager
- Game Developer (press release), "Motorsport Manager 2 announced: Playsport returns to the pit wall..." (June 25, 2026) — https://www.gamedeveloper.com/press-release/motorsport-manager-2-announced-playsport-returns-to-the-pit-wall-with-the-next-chapter-in-the-legendary-motorsport-management-series
- DLH.NET, "Motorsport Manager 2 – New Trailer & Dev Diary" (Oct 1, 2026) — https://www.dlh.net/en/news/90710/motorsport-manager-2---new-trailer-dev-diary.html
- EA Answers HQ, "Need advice for developing Players" (NHL) (search result) — https://answers.ea.com:443/t5/General-Discussion-News/Need-advice-for-developing-Players/td-p/11425067

### D — Traits and captains (notes 06)

- CK3 Wiki, "Traits" (PC 1.20) — https://ck3.paradoxwikis.com/Traits
- CK3 Wiki, "Stress" (PC 1.20) — https://ck3.paradoxwikis.com/Stress
- CK3 Dev Diary #104 "AI AI AI!" (2022), via devtrackers — https://devtrackers.gg/crusader-kings/p/059cf6b8-dev-diary-104-ai-ai-ai
- GamingOnLinux on CK3 Dev Diary #07 (snippet) — https://www.gamingonlinux.com/articles/15647/
- Vaporlens, Crusader Kings III — https://vaporlens.app/app/1158310/crusader_kings_iii.md
- Steam Discussions, CK3 trait and stress thread (snippet; content-gated) — https://steamcommunity.com/app/1158310/discussions/0/3186865924607270710
- Darkest Dungeon Wiki, "Quirks" — https://darkestdungeon.wiki.gg/wiki/Quirks
- Darkest Dungeon Wiki, "Virtue" — https://darkestdungeon.wiki.gg/wiki/Virtue
- God is a Geek, Darkest Dungeon review (snippet) — https://godisageek.com/reviews/darkest-dungeon-review/
- RimWorld Wiki, "Traits" (v1.6) — https://rimworldwiki.com/wiki/Traits
- RimWorld Wiki, "Basics" (snippet) — https://www.rimworldwiki.com/wiki/Basics
- Steam Discussions, Battle Brothers "Iron lung Lumberjack" (Nov 2017) — https://steamcommunity.com/app/365360/discussions/0/1489992080508052323
- Keen Gamer, Battle Brothers review (7 Mar 2018) — https://www.keengamer.com/articles/reviews/battle-brothers-review/
- Raider King, Battle Brothers trait tier list (snippet) — https://raiderking.com/?p=1330
- GameBanshee, "XCOM 2: War of the Chosen New Soldier Features" (10 Aug 2017) — https://www.gamebanshee.com/kdd8x
- Passion4FM, "Football Manager Player Traits" (Oct 2024, FM25) — https://www.passion4fm.com/football-manager-player-traits/
- Let's Play Archive, Blood Bowl Update 04 — https://lparchive.org/Blood-Bowl-(by-GNU-Order)/Update%2004/
- FM Scout, FM23 hints and tips (snippet) — https://www.fmscout.com/a-football-manager-2023-hints-and-tips.html?pg=1
- The Set Pieces, "FM18 Project: How to avoid a squad mutiny" (Dec 2017) — https://thesetpieces.com/?p=19246
- Football Manager, "Choosing the perfect captain" (snippet) — https://footballmanager.com/node/129
- FMM Vibe, "Battle of Captains" (Dec 2016, FM Mobile 2017) — https://fmmvibe.com/forums/topic/38819-battle-of-captains/
- FOFC forum archive, Hattrick "team experience?" thread (2003–05) (snippet) — https://forums.operationsports.com/fofc/archive/index.php/.../a%3E/t-25284.html
- Chicago Sun-Times, Madden 27 review (21 Aug 2026) — https://chicago.suntimes.com/nfl/2026/08/21/madden-27-review-curses-bears-and-caleb-williams-better-not-hope-so
- 2K, NBA 2K27 MyNBA features — https://nba.2k.com/en-GB/2k27/features/mynba/
- NAF, Blood Bowl Sevens 2019 (snippet) — https://www.thenaf.net/wp-content/uploads/2019/09/Blood-Bowl-Sevens-2019.pdf
- Total War: Rome II manual, "Morale" — https://r2enc.totalwar.com/en/manual/single-player/0087_enc_page_battle_play_phase_conflict_morale
- RPGHQ, Battle Brothers perks let's-play (snippet) — https://rpghq.org/forums/viewtopic.php?p=93749
- Steam Discussions, Battle Brothers sergeant thread (Dec 2023) — https://steamcommunity.com/app/365360/discussions/0/4032475099154973610
- Gamer Guides, Bannerlord Leadership perks — https://gamerguides.com/mount-and-blade-ii-bannerlord/guide/perks/social/leadership
- Esports.net, "All Counter-Strike roles" (11 Apr 2024) — https://www.esports.net/news/counter-strike/all-cs-player-roles/

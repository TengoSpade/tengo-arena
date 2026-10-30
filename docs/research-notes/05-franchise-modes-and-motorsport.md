# Research Notes 05: Console Franchise/Career Modes and Motorsport Manager

**Scope.** These notes cover the management layers of five reference games: Madden NFL Franchise, EA Sports College Football Dynasty (with NCAA Football 14 as the historical benchmark), NBA 2K MyNBA/MyGM/MyLeague, EA NHL Franchise, and Motorsport Manager (Playsport Games). The focus is scouting, recruiting, development, farm and redshirt systems, contracts and AI trades, staff, morale, league structure, watching versus simulating, longevity, and customization. Every point is translated for our game: a PC fantasy-mercenary arena league where 3–5 fighter teams autobattle on gambit tactics, with required scouting, tiered leagues with promotion and relegation, and an academy that sends young fighters away to develop.

Research date: **25 Oct 2026**. Current editions are Madden NFL 27 (Aug 2026), College Football 27 (July 2026), NBA 2K27 (Sept 2026) and NHL 27 (Sept 2026). Motorsport Manager (PC) is from 2016, with a sequel due in 2027. Claims name the edition they refer to. "(inference)" marks my own reasoning.

Reddit, forums.ea.com and the NLSC forums blocked fetching, so community sentiment comes from fetched Steam reviews and discussions, review outlets, official patch notes, and forum threads seen in search results.

---

## 1. Madden NFL Franchise

**Key facts:** EA Sports / EA Tiburon. Current edition Madden NFL 27 (early access Aug 6, 2026), on PS5 and Xbox Series X|S; PC availability for 27 was not verified here. Evidence spans Madden 21 (2020) to Madden 27 (2026).

**1. Fun / sticky**
- **The weekly loop.** You set the depth chart and gameplan, then play or sim, react to news, and advance. Madden 27 replaces the old weekly flow with **Emergent Actions**: contextual decision prompts that you can delegate to staff, with a preview before you confirm [1].
- **Offseason set pieces.** The **Free Agent Frenzy** squeezes free agency into a 12-hour window for all 32 teams, which you advance hour by hour. A second frenzy for undrafted rookies follows the draft [1].
- **Players as characters.** The **Persona Engine** gives each player one of 65+ "Persona DNA" types that drive holdouts, trade demands and negotiation behaviour. Most scripted scenarios were removed in favour of this context-driven behaviour [1][2].

**2. Good practices**
- **Legible scouting reveal thresholds** (Madden 22 overhaul, inherited by later editions). Scouts have strengths and weaknesses, and you assign them to regions and position groups on a fixed weekly calendar.
  - Week 11: you pick 3 focus prospects, which unlocks 30% of each profile. Offseason private workouts unlock 40%.
  - Each prospect has a knowledge %. At 1% you see physicals and at 10% traits. Every further 10% reveals one attribute as a letter grade. 70% reveals the archetype, and 100% reveals everything plus the true talent range [7].
  - Madden 24 limits staff to one 3-star, one 2-star and three 1-star scouts [8][9].
- **A hidden dev trait that playing time reveals.** The tiers are Normal, Star, Superstar and X-Factor. A Star-or-better rookie can stay "hidden" until about 500 snaps, progressing as if he were a Superstar in the meantime (Madden 23–24 guides) [10][11].
- **Goal-driven XP.** Goals provide most of the XP. An offseason regression screen compares attribute losses across the league [12].
- **Negotiation minigame** (27). Talks run over several sessions with Patience and Interest meters: Patience at 0 ends the session, Interest at 100 closes the deal. Players can raise wildcard asks about guarantees, length or role [1].
- **Coach abilities that can go down as well as up** (26). Gameday and Season abilities each have four tiers. You upgrade them with goals or Staff Points, and failed goals can downgrade them [16][17].

**3. Features players love**
- **Long-requested realism.** EA framed holdouts, trade demands and early extensions as wishlist items. The lead designer called 27 the biggest year-over-year change in his 20+ years [1].
- **Reviewers' picks.** ClutchPoints found the negotiation phase fun even in a 6.5/10 review [3]. Smashpad praised the news ticker for surfacing league moves without digging through rosters [4].
- **Scouting storylines.** The 2021 scouting department, with mock drafts and a media big board that moves with news, answered earlier wishlists asking for more prospect storylines [7][14].

**4. Complaints / pitfalls**
- **Neglect.** #FixMaddenFranchise trended in Aug 2020 after Madden 21's reveal gave Franchise a few lines. EA acknowledged the frustration and promised more resources [6]. Commentators said the mode had barely changed in about seven years [15].
- **CPU management.** EA's Aug 26, 2026 title update lists open issues:
  - CPU teams build cap deficits they never recover from, and carry thin depth at some positions.
  - Players retire at illogical points, and free agents accept unrealistic long-term deals.
  - The CPU makes draft trades only when the draft is simmed [5].
  - Forum users add that CPU teams have no positional awareness when building rosters [18].
- **Persona and free-agency balance.** ClutchPoints called holdouts "executed pretty poorly." It also reported teams bidding only on the top-rated free agent (a 91 OVR safety drew bids while a 90 OVR did not), and players refusing multi-year deals [3].
- **Exploitable trades.** After EA's 2021 trade-logic rework, the CPU still overvalued just-signed players and average veteran QBs. Small add-ons flipped rejected offers into accepted ones [13].
- **Smaller irritants.**
  - You can't inspect drafted players until the whole class has signed [4].
  - Pre-order bonuses grant Franchise and Staff Points, which commissioners can disable [1].
  - Sim stats drift from reality, which grates after 3–5 seasons [19].

**5. Ideas for us**
- **Scouting Knowledge %** per prospect fighter, with fixed reveal steps [7].
- **Talent tier hidden until N arena bouts**, ending in a reveal event (inference from [10]).
- **Weekly Emergent Actions.** Prompts such as a fighter demanding a bigger loot share or a rival guild probing your star. You can delegate each to a staff member, at a quality cost (inference from [1]).
- **Holdouts.** Mercenaries refusing to fight until paid fit the theme. They need visible mood thresholds so they don't feel random [3].

---

## 2. College Football Dynasty (CFB 25/26/27) and NCAA Football 14

**Key facts:** EA Sports / EA Orlando. CFB 25 (July 2024), CFB 26 (July 2025) and **CFB 27 (July 2026, current)** are console only; I found no PC version in the sources. The benchmark is NCAA Football 14 (2013, PS3/360).

**1. Fun / sticky**
- **Recruiting is a weekly hours budget** (CFB 25).
  - Guides cite about 1,000 hours a week for a 5-star program and 350 for a 1-star. Spending is capped at about 50 hours per recruit, more with an ability [25][26].
  - Scouting actions cost 5, 10, 25 or 50 hours (social media, DM, friends and family, "send the house"). They reveal how much a recruit cares about each of 14 pitch categories, such as Playing Time and Pro Potential.
  - Soft and Hard Sells cost 20 and 40 hours and can backfire. "Sway" (30 hours) changes how much a category matters [24].
- **Gems and busts.** A fully scouted recruit shows a green gem (better than his star rating), a red gem (worse) or nothing [24][25]. Development traits (Normal, Impact, Star, Elite) stay hidden until National Signing Day unless a coach ability reveals them early [29].
- **Long arcs.** Dynasties run 30 years, with a coaching carousel and editable conferences. Prestige, facilities and NIL compound over time [20][24].

**2. Good practices**
- **Preseason for scouting only** (27). Scholarship offers open in Week 0.
  - Recruits move through stages: Open → Top 5 → Top 3 → Verbal → Hard Commit.
  - A verbal commit gives the school an influence bonus built from pipeline, prestige and proximity. Rival schools can still flip the recruit until he hard commits [20].
- **Factors scored separately, with partial credit** (27). Proximity is calculated from real distance and scored apart from pipeline tier [21].
- **One annual budget, "Dynasty Points"** (27).
  - Points are earned from program grades, postseason results and athletic director (AD) goals.
  - You spend them on staff, facilities, recruiting NIL and roster NIL. Unspent points don't roll over [20].
  - A recruit's NIL offer can go up to 2× his expected amount, but an overpay becomes his new floor [20].
- **Visible retention risk.**
  - The roster shows a "Risk of Leaving" column with reasons, and you get one last chance to talk a departing player out of leaving [20].
  - In CFB 26, every player has a dealbreaker that scales with his rating and can change as he develops [22].
- **Practice plans** (27). Each week you choose Full (most XP, most injury risk), Limited, No Practice (recover, risk starting cold) or Week Off (no XP, doesn't play) [20].
- **Staff structure** (27).
  - Support-staff slots equal prestige, up to 5, in four tiers. Staff add recruiting hours, progression boosts and NIL discounts.
  - You bid Dynasty Points for coordinators, up to 2× their expected value, and bids resolve in amount order [20].
- **Coach archetype skill trees** (25). You start as Tactician, Recruiter or Motivator. Advanced trees such as Program Builder and CEO require playoff and title success [24]. Abilities can lower dealbreaker thresholds or transfer risk [22].
- **AD goals** (27). Each school's AD has a demeanor (patient, balanced or reactionary) and three firm or stretch goals. The goals escalate as you succeed [20].

**3. Features players love**
- **Uproxx's CFB 25 review** praised intense recruiting, playthroughs that vary by archetype, the carousel, small-school realism and customization [24].
- **CFB 26 additions:** about 2,000 transfer-portal entrants a year (EA's page says up to 3,500), location-based visit costs, team needs pinned to the top of the prospect list, and about 300 real coaches [22][23].
- **NCAA 14, the benchmark.** "Power Recruiting" gave you 5,000 points a week, with carryover, plus a single 10,000-point offseason stage. It also had 18 upgradeable coach skills [33]. Game Informer judged that dropping phone calls kept the strategy, though one reviewer missed promises [35]. Expert play was board triage: drop targets 500+ points behind and ease off when 500+ ahead [34].

**4. Complaints / pitfalls**
- **Launch exploits and broken gating** (25). The Aug 8, 2024 patch removed "most of the recruiting strategies" found in early access. It fixed visits that couldn't be scheduled and tuned the sim to widen the gap between good and bad teams [27].
  - Uproxx was locked out of recruits while ranked as their No. 1 school, and found hours it couldn't spend [24].
  - FCS teams upset Power Five teams too often in simulation [28].
- **Auto-recruit and calendar** (26). Forum users report auto-recruiting signing 8 players after an undefeated season, an unrealistic recruiting calendar, tedious carousel navigation, and inflated QB stats [31][32].
- **"Patch, not sequel."** One forum post called CFB 26's dynasty changes fixes that belonged in patches [31].
- **Paid boosts.** Pre-order buyers start with 100–150 bonus Coach Points [20].

**5. Ideas for us**
- **A weekly Contacts budget** scaled by guild prestige, with a per-target cap. Scouting and recruiting draw from the same pool (inference from [24][25]).
- **Three motivations per mercenary** from about 8 (Gold, Glory, Home region, Starting slot, Title contention, Trainer quality...), with a possible dealbreaker. Each guild has a visible letter grade per motivation [22][24].
- **Risk of Leaving** shown before contracts expire [20].
- **Weekly training intensity** (Full, Light or Rest) per fighter. Fatigue carries into combat speed (inference from [20]).

---

## 3. NBA 2K MyNBA / MyGM / MyLeague

**Key facts:** 2K / Visual Concepts. Current edition NBA 2K27 (Sept 4, 2026), on PS5, Xbox Series X|S, **PC (Steam)** and Switch 2. PC has had the current-gen version, including MyNBA Eras, only since 2K25 [42]. MyLEAGUE (2K15) was the sandbox and MyGM the role-play mode; both now sit under MyNBA [46].

**1. Fun / sticky**
- **Eras and alternate history.** Since 2K23, saves can start in 1983, 1991, 2002 or the modern day [41]. 2K26 added era-accurate budgets and luxury tax [39].
- **2K27 history tools.** 75 historic courts, era-specific CBA rules, and Historic Draft Playlists that remix decades of draft classes (Loop, Shuffle, Reverse) [37].
- **Very long saves.** 2K27 runs 100-year franchises, including MyNBA Legacy, a player-locked dynasty where descendants inherit traits [36][37].
- **Relationships** (2K27). Friendships and rivalries form from shared history; repeated early playoff exits create grudges. Two close stars form a "Dynamic Duo" and three a "Big 3," with attribute boosts [36][38].

**2. Good practices**
- **GM Trust** (2K27).
  - It starts at 50. Completing directives, extending players and re-signing your own free agents raise it.
  - Broken promises and trading players with multiple years left lower it.
  - At low Trust, free agents discount your promises, so you overpay [37][38]. During the moratorium you can pitch free agents with binding promises, and contract incentives are graded Guaranteed, Likely or Unlikely [36].
- **Sim-quality presets** (2K26). The "Smarter" sim considers 5,000+ trade variables. "Faster" skips some outcomes for speed. Sims run up to 26% faster than in 2K25 [39].
- **Owner directives** (2K26). Seasonal goals and a budget govern job security. Meeting them earns Facility Points, spent on facilities that help attract free agents [39].
- **MyGM 2.0** (2K20). A daily Action Point budget pays for trades, conversations and even playing a game; harder difficulty gives fewer AP. Progression ran on a five-branch sphere-grid skill tree. A score system was scaled so that a deliberate rebuild beats inheriting a stacked roster [40].
- **Sliders everywhere.** MyLeague has front-office AI and frequency sliders [46], and 2K19 added trade sliders such as the value of draft-and-stash players and the premium on "untouchables" [45]. 2K27 allows unlimited offseason rule-change proposals, each with its own sliders [36][37].
- **2K27's 21 community fixes**, including: 4-team trades, the per-team asset cap raised from 6 to 9, cash in trades, a Buyout Market, 10-day contracts, and a rebuilt **Eurostash** (stashing draftees overseas to develop) [37].

**3. Features players love**
- **Depth over spectacle.** 2K sold 2K27 MyNBA as "back to basics," built from 20+ community-requested control and management fixes [36][37].
- **Role-play without restrictions.** 2K26's Unranked MyGM keeps the role-play systems while allowing edits, imported draft classes and sliders [39].
- **Self-imposed challenge.** 2K27 Legacy's 20 optional hardship modifiers (earlier regression, trade caps, a forced move to a weak team) cater to long-save veterans [37].

**4. Complaints / pitfalls**
- **Underinvestment versus monetized modes.** A 2022 article argued MyNBA gets less attention because it doesn't make money (the author's inference). It cited a bug that produced roughly 90-year-old free agents and crashes deep into custom leagues [43].
- **Action Points that gated play.** 2019 threads complained that AP could stop you from playing a game you wanted to play [44].
- **AI quality costs sim time.** 2K's Smarter/Faster split concedes that better trade reasoning is slower [39].

**5. Ideas for us**
- **Guild Trust (0–100, starting at 50)** gating whether recruits believe your promises (inference from [37]).
- **Bonded pairs** that unlock a small buff and a gambit condition, e.g. "IF Bonded ally is below 30% HP THEN guard ally" (inference from [36]).
- **A Fast/Normal/Thorough preset** for headless AI-vs-AI matches and AI front-office decisions (inference from [39]).
- **Patron directives → Facility Points** loop [39].
- **No action budget on playing matches.** Spend it only on optional management actions [44].

---

## 4. EA NHL Franchise Mode

**Key facts:** EA Sports / EA Vancouver. Current edition NHL 27 (Sept 11, 2026), on PS5 and Xbox Series X|S. Its deepest scouting design dates from NHL 19 (2018) and has carried forward largely unchanged.

**1. Fun / sticky**
- **Fog-of-war scouting** (NHL 19).
  - You can run up to 20 scouts, and AI teams compete with you to hire them.
  - Pairing two scouts in one region merges their reports into one more accurate report, at the cost of coverage elsewhere.
  - Scouts improve by staying in a region and decline elsewhere.
  - Gems and busts are generated randomly per franchise and are always accurate once found. Auto-scouting finds about 3 gems; manual scouting finds more [51].
- **The prospect pipeline.** Each player shows a potential tier (Franchise, Elite, Top-6 F … AHL Bottom-6) with a Low/Med/High certainty label. Scouting accuracy (Low→Exact) is tracked separately [52][53].

**2. Good practices**
- **Decaying intel** (19). Reports on opponents decay over 30–60 days. Playing against a player refreshes his report [51].
- **Playing time drives development** (19).
  - Junior and international minutes affect growth.
  - Reports become more accurate with NHL or AHL ice time.
  - **Demoting a prospect to juniors blocks recall** [51].
- **Readable CPU draft logic** (19). CPU teams build per-round shortlists, trade up for their targets, and trade back when the lists run dry [51].
- **Player agency** (25). You can ask a player to change playstyle; he may refuse, and it can backfire. No-trade and no-movement clauses are set per contract year [54].

**3. Features players love**
- **NHL 19's scouting design.** It is the series' most cited depth. The producer said found gems and busts are "guaranteed" [51].
- **Small offline touches.** In NHL 27, waiver claims and trade requests still appeal to returning players [48].
- **Connected Franchise.** NHL 27's online leagues support 3–32 human teams, custom rosters, commissioner overrides and mid-season slider changes [47].

**4. Complaints / pitfalls**
- **Stagnation.** NHL 26 Franchise "remains largely untouched," and long-requested GM Connected is still missing [50]. NHL 27's offline Franchise is unchanged apart from minor tweaks (Hardcore Gamer, 3.5/5) [48]. On the forums, an EA community manager cited a Be A Pro focus, and fans called Franchise identical to NHL 25 [55].
- **Half-built online mode.** Connected Franchise has no CPU teams, no draft, no aging or retirement, and no stat carryover [48][49].
- **Prospects that don't pay off.** Users report elite prospects stalling in the AHL, especially on CPU teams [56], and Medium/High prospects plateauing around 77–82 OVR [76].
- **Odd contract demands.** Developers acknowledged that demands follow projected potential rather than stats [51].

**5. Ideas for us**
- **Scout pairing and home-region skill growth** [51].
- **Arena bouts refresh intel** on the opponents you face (inference from [51]).
- **Three separate values** on reports: potential tier, certainty, and scouting accuracy [52].
- **Academy like juniors demotion.** The fighter is locked out for the term, and his report accuracy rises (inference from [51]).
- **AI teams develop prospects** under the same rules as the player [56].

---

## 5. Motorsport Manager

**Key facts:** Playsport Games (UK). It began as Christian West's solo mobile game (iOS 2014). Sega published the PC version on Nov 9, 2016, and Steam now lists Miniclip [61][71]. DLC added GT, Endurance and a free Create Your Own Team. Mobile sequels followed in 2017, 2018 and 2023 [71]. **Motorsport Manager 2** (PC) was announced June 25, 2026 for Steam in 2027, after Playsport regained the PC series [72].

Steam (Oct 25, 2026): Very Positive, with 90% of 5,196 English reviews positive and 11,535 recommendations in total. Metacritic 81. In the last 30 days, 82% of 34 reviews were positive [60][61].

**1. Fun / sticky**
- **Race weekends you watch and steer.**
  - Practice tunes the car through driver feedback.
  - Qualifying asks you to keep tyres and engine in a "sweet spot."
  - The race runs in real time [58][59].
  - You can pause at any time, the game auto-pauses when you open a decision menu, and time can be sped up [59].
  - You choose driver aggression (which wears tyres and burns fuel), pit timing and tyre compound against a lap-by-lap weather forecast, fuel loads, and pit-stop risk [59][60].
- **Emergent stories.** Top Steam reviews are race stories: an intermediate-tyre gamble in the rain with the worst car, or teammates who hate each other fighting for the title from reversed grids [62]. One reviewer calls it "the poster child of delayed gratification": start at the bottom and climb [62].
- **Multi-season engineering.** You design parts and plan next season's car [60]. Parts take time to build, so planning ahead matters [75].

**2. Good practices**
- **Cut "set and watch."**
  - At the Rezzed playtest, players set a strategy and then only watched. West found it disengaging and removed it.
  - Players could then queue **only the next pit stop**, which kept them reading the race.
  - He wanted players to "feel like they were in the race" [57].
- **Buttons over sliders.** Clearly labelled buttons replaced sliders, so the effect of each action was obvious [57].
- **Paid, not free-to-play,** to avoid pay-to-win [57].
- **Politics and personality.**
  - Drivers have goals, peaks, declines and personalities [58].
  - Rivals can bribe you to vote their way on rule changes [58].
  - Federation influence can shape the calendar, and illegal parts risk fines [59].
  - Your relationship with your mechanic grows over time [59].
- **Two sponsor types.** Fixed-rate sponsors pay steadily; bonus sponsors pay only when you hit targets [69].
- **Board pressure.** Missed targets lower the chairman's mood and lead to ultimatums [68].
- **A three-tier ladder.** Three fictional series with promotion on by default [59][67]. Some parts are standardized ("spec") in certain series [65].

**3. Features players love**
- **An engineer's endorsement.** A top review by an F1 engineer says the game keeps the excitement of a race weekend and strips the chore; short practice forces real prioritization [62].
- **Talent hunting and the climb.** The store page pitches "scouring the world for hidden gems" [60], and reviewers enjoy the staff and driver market and the climb up the grid [62].
- **Mods.** One reviewer with 4,879 hours still plays with mods [62]. MM2 promises full mod support from day one [72].
- **Sequel demand.** Top reviews have begged for a new PC game for years [62].

**4. Complaints / pitfalls**
- **Solved too fast.** Tyre wear is a fixed percentage per lap, so strategy becomes "more of a maths game" [63]. Setup reduces to three indicators [63].
- **Weak long-run AI.** The game gets "seriously easy" after about 50 hours as AI teams lag your car development [62]. A recent review says the AI never pits for repairs and drivers rarely defend [64].
- **Repetition.** Events and interviews repeat, reviewers say they had seen everything within 2–3 seasons, and drivers feel like stat containers [63][74].
- **Promotion shock.** Promoted players report a budget drop of about 800k with race bonuses now out of reach [66]. Targets and sponsor demands are based on the previous tier, and part performance is readjusted on promotion [65][70].
- **Maintenance debt.**
  - A bug that stopped drivers going into car 1 stayed unfixed for two years and needed community save editors.
  - Saves crashed entering season 6.
  - A wave of Windows 11 launch crashes (2023–26) left "wait for the sequel" reviews [63][64].

**5. Ideas for us**
- **Intervention calls.** The gambit program runs the fight, but the manager holds 1–3 calls per bout (swap a gambit set, call a focus target, order a retreat, use a consumable), shown as a single queued action (inference from [57]).
- **Auto-pause** on configurable events (ally downed, low HP), and whenever a decision menu opens [59].
- **Hidden per-arena variables** (surface, hazards, fog, mana storms) so strategy never collapses to a constant (inference from [63]).
- **Tier regulations and lobbying.** Higher tiers enforce spec gear or ban some gambit conditions, and rivals lobby or bribe on rule changes [58][65].
- **Fixed and bonus patrons**, mirroring MM's sponsors [69].
- **MM2's driver academy.** It recruits from junior categories, making it the closest analogue in this group to our academy [73].

---

## 6. Cross-game comparison

**6.1 Scouting: tense versus chore.**
- **What works:** knowledge % with fixed reveal steps (Madden) [7]; rating ranges plus a separate certainty label (NHL) [51][52]; gem/bust flags only after full scouting (CFB) [24], and accurate once found (NHL) [51]; regional scouts whose skill grows in place [7][51]; reports that decay and refresh on contact [51]; a scouting-only preseason (CFB 27) [20].
- **What creates tension:** scarce scouting resources against AI competitors, and reveal moments (signing day [29], 500 snaps [10], the moving big board [7]).
- **What creates chores:** scouting with no visible payoff, or info locked until it no longer matters, as when Madden 27 hides draftees until the whole class signs [4].
- (Inference) Offer delegation, but let manual scouting find more, as NHL 19's roughly 3 gems from auto-scouting suggests [51].

**6.2 Recruiting and free agency.**
- **CFB is the reference.** A prestige-scaled weekly hours budget, priced actions, 14 pitch grades, dealbreakers, verbal and hard commits, and flips [20][24][25]. NCAA 14's simpler points pool with carryover kept the strategy and dropped the tedium [33][35].
- **Free agency as a live event:** Madden's hour-by-hour Frenzy [1], 2K's moratorium pitches with binding promises [36], NHL Connected's bids and claim lists [47].
- **Portals add churn,** driven by dealbreakers that grow with the player [22].

**6.3 Development.**
- **Tiered dev traits:** Madden runs Normal→X-Factor, with faster skill points and exclusive abilities at the top [10][11]. CFB runs Normal→Elite, hidden until signing [29].
- **XP sources:** goals (Madden) [12] and practice trade-offs (CFB 27) [20].
- **Regression:** shown openly in Madden's league-wide report [12], driver peaks and declines in MM [58], and optional earlier regression in 2K27 [37].
- **Failure mode:** prospects that stall or plateau (NHL) [56][76].

**6.4 Farm, redshirt and academy analogues.**
- **NHL juniors/AHL.** Development depends on ice time, and demoting to juniors blocks recall [51]. This is the closest match to "unavailable but developing."
- **CFB redshirt.** A freshman can play up to 4 games and keep his redshirt, once per career [30].
- **Stashing and academies.** 2K's rebuilt Eurostash [37] and MM2's driver academy [73].
- **Requirement:** the AI must use the pipeline as well as the player does [56].

**6.5 Contracts, caps, trades and AI.**
- **Contract depth keeps growing.** Madden 27 has guarantees, void years, tags and tenders [1]. 2K27 has graded incentives, salary aprons and buyouts [37]. NHL sets clauses per contract year [54].
- **AI trading is the chronic weak point.** Overvalued newly signed players and small add-ons flipping decisions (Madden) [13]; a bias toward 2-for-1 pick deals (NHL) [51]; cap and depth mismanagement (Madden 27) [5]. 2K made deeper trade reasoning a slower preset [39].
- **Reputation guards promises:** GM Trust [37] and NIL price floors [20].
- (Inference) Value assets by team need and positional scarcity, apply diminishing returns to quantity, and fuzz-test the trade AI with scripted exploit offers in long headless runs.

**6.6 Staff and skill trees.**
- **CFB:** archetype trees, four-tier support staff with slots tied to prestige, and coordinator bidding [20][24].
- **Madden:** tiered abilities that can be downgraded [16], and a star-capped scout roster [8].
- **2K MyGM:** a sphere grid with respecs [40].
- **NHL:** a scout market with per diems [51].
- **MM:** designers, mechanics and HQ buildings; the mechanic relationship builds over time [59][60].
- **Pattern:** staff mostly multiply hours, XP, accuracy or cost. Downgrades and staff poaching keep them dynamic [16][22].

**6.7 Morale and chemistry.**
- **The systems:** Madden 27's Persona DNA, holdouts and repair conversations [1]; 2K27's friendships, rivalries, Duo/Big 3 boosts and birthplace-seeded relationships [36][37]; NHL's performance-driven morale [51]; MM's driver rivalries, where a driver may refuse to renew while a rival teammate stays [59][62].
- **The risk:** under-tuned systems read as random friction [3].

**6.8 League structures.**
- **MM is the only game here with promotion.** Three tiers, promotion on by default, and a mod toggle to turn it off [59][67]. After promotion, costs rise, part performance resets, and expectations lag a tier behind [65][66].
- **US-sports games use closed leagues with playoffs and cups.** CFB has a 12-team playoff with top-4 byes, realignment, and AD and carousel career ladders [20][24]. 2K has the NBA Cup and new series formats [37]. NHL offers configurable divisions and playoffs [47].
- (Inference) Pair MM's ladder with CFB-style job offers: a higher-tier guild can headhunt the manager.

**6.9 Watching versus simulating.**
- **MM:** real-time races with pause, auto-pause, speed-up, and a single queued call. Pure watching was cut [57][59].
- **Sports games:** Madden 27 brings back Coach Mode and retunes Supersim so ratings matter more than playbooks [1]. CFB has Coach Mode with a 15-second pre-play cutoff [20]. 2K offers three sim presets [39].
- **Consistency matters.** CFB 25's sim produced too many upsets [28], and stat drift breaks immersion [19].
- (Inference) Headless AI-vs-AI fights must use the same combat rules as watched fights. Regularly check that sim outcome distributions match watched ones.

**6.10 Longevity.**
- **Keeps saves fresh:** eras and 100-year windows [37][41]; rule-change votes and politics [37][58]; escalating AD expectations and job security [20]; the carousel [24]; news tickers and emergent prompts [1][4]; rivalries [36][62]; opt-in hardship modifiers [37]; mods [62][72].
- **Makes saves stale:** solvable systems [63], dim AI after about 50 hours [62], repeated events [63], AI roster and cap mismanagement draining league quality [5][18], stalled prospects [56].
- **The underinvestment narrative:** Madden 2020 [6], NHL 2025–26 [48][50], MyNBA 2022 [43], MM's years-old bugs [63][64]. Franchise players are long-term loyalists who notice neglect.

**6.11 Customization.**
- **2K:** front-office, trade and rule sliders, draft playlists, and imported custom classes [37][39][45][46].
- **CFB:** conference and schedule editing, plus Team Builder schools re-importable each offseason [20][24].
- **NHL:** custom rosters and mid-season slider changes [47].
- **MM:** fully fictional series [58], mods that edit championship files (e.g. toggling promotion) [67], and day-one modding in MM2 [72].
- (Inference) Data-driven league files (regions, tiers, teams, prize tables, rules) suit our fantasy theme and invite mods.

---

## 7. Top ideas for our game (ranked)

1. **Limited in-fight calls plus auto-pause, never pure spectating.**
   - Gambits run the fight. The manager gets 1–3 timed interventions per bout (swap a gambit set, call a focus target, order a retreat, use a consumable), and auto-pause triggers on key events.
   - *Why:* MM's creator cut "set strategy and watch" after playtests; queuing only the next call kept players engaged. *Source:* MM [57][59].
2. **Scouting Knowledge % with fixed reveal steps, plus a separate certainty label.**
   - Physicals → traits → one stat band per 10% → class at 70% → potential range at 100%.
   - *Why:* each scouting hour has a legible payoff, and gem/bust tension survives. *Source:* Madden [7], NHL [51][52], CFB [24].
3. **A weekly Contacts budget scaled by guild prestige, with a per-target cap.**
   - Scouting, visits and pitches all draw from one pool.
   - *Why:* one resource creates the spread-vs-focus dilemma, and small guilds get a harder but fair game. *Source:* CFB [24][25], NCAA 14 [33].
4. **Regional scouts with home-region growth, and pairing for accuracy.**
   - *Why:* hiring scouts becomes strategic, and it matches the "regional expertise" in our brief. *Source:* NHL 19 [51], Madden 22 [7].
5. **Bouts refresh intel and reveal hidden talent.**
   - Facing a fighter updates your report on him. Rookies' talent tiers reveal after N bouts or after an academy term.
   - *Why:* it ties scouting to the spectated fight and creates reveal moments. *Source:* NHL fog of war [51], Madden hidden dev trait [10].
6. **Academy terms modelled on juniors and redshirting.**
   - A hard lock for the term, during which the fighter gains XP, trait rolls and scouting certainty. A cheaper "light duty" option lets him fight up to N bouts without losing progress.
   - *Why:* these mechanics are proven and cheap, and they create "use him or protect him" choices. *Source:* NHL [51], CFB [30], 2K Eurostash [37], MM2 [73].
7. **Motivations and dealbreakers per mercenary, with guild letter grades.**
   - Dealbreakers can shift as the fighter develops.
   - *Why:* a readable recruiting and retention puzzle with natural churn. *Source:* CFB [22][24].
8. **Guild Trust (starting at 50) governing promises.**
   - Kept promises and re-signings raise it. Broken promises and dumping contracts lower it.
   - *Why:* one number links contracts, trades and morale, and it punishes exploit churn. *Source:* 2K27 [37][38].
9. **Patron directives → Facility Points, from a patron with a temperament.**
   - *Why:* medium-term goals and job risk keep long saves interesting. *Source:* 2K26 [39], CFB AD [20], MM chairman [68].
10. **Promotion with a soft landing.**
    - Promotion is offered or optional. Expectations come from the new tier, there is a parachute payment, and gear doesn't reset to mid-pack.
    - *Why:* MM players hit budget cliffs and stale expectations after promotion. *Source:* MM [65][66][67].
11. **Tier regulations and between-season lobbying.**
    - *Why:* late-game strategy keeps moving, and politics costs little art. *Source:* MM [58][65], 2K27 rule changes [37].
12. **Weekly training intensity per fighter** (Full, Light or Rest) trading XP against injury and fatigue.
    - *Why:* a cheap weekly lever that links management to combat. *Source:* CFB 27 [20], Madden wear and tear [1][16].
13. **Bonded pairs and rivalries as gambit hooks.**
    - *Why:* chemistry becomes tactical, not a hidden modifier. *Source:* 2K27 [36], MM [62].
14. **Delegable emergent weekly decisions.**
    - *Why:* narrative without scripting, and respect for players who sim fast. *Source:* Madden 27 [1].
15. **Data-driven leagues plus sliders, with mod support early.**
    - *Why:* fresh saves and a modding community; mods kept MM alive for 8+ years. *Source:* MM [62][67][72], 2K [45][46].

---

## 8. Pitfalls to avoid (ranked)

1. **Spectating without agency.** MM's playtest disengaged players until "set and watch" was cut [57].
2. **Solvable, deterministic sims.** Constant wear rates and three-indicator setups turned strategy into arithmetic, and reviewers felt they had seen everything within 2–3 seasons [63][74].
3. **AI managers falling behind the player.** MM became "seriously easy" after about 50 hours [62] and its AI never pits for repairs [64]. Madden 27's CPU builds cap deficits and thin depth [5] with little positional awareness [18].
4. **Exploitable trade valuation.** Quantity-for-quality deals and overvalued newly signed players (Madden 21) [13]; a bias toward 2-for-1 pick deals (NHL) [51].
5. **Neglect and long-unfixed bugs.** #FixMaddenFranchise [6]; NHL "largely untouched" [48][50]; MyNBA [43]; MM's car-1 bug and crashes [63][64].
6. **Illogical gating.** Lockouts while ranked No. 1, visits that can't be scheduled, hours that can't be spent (CFB 25) [24][27].
7. **Personality systems that feel random.** Holdouts "executed pretty poorly," free agents bid only on the top-rated player [3], and unrealistic deals accepted [5].
8. **Promotion shock.** Budget cliffs, expectations from the old tier, and parts resetting (MM) [65][66].
9. **Sim versus watched divergence.** FCS upset spam [28], inflated stats [31], and realism fatigue after 3–5 seasons [19].
10. **Action budgets that gate core play.** MyGM's AP could block playing games [44].
11. **Repetitive events, and people who are just stat containers** (MM) [63].
12. **AI that ignores the development pipeline,** leaving prospects stalled in the minors [56][76].
13. **Late-season save instability.** MM crashed entering season 6 [63]. (Inference: soak-test 30+ season headless runs in CI.)
14. **Pay-for-advantage progression.** Pre-order points in Madden 27 and CFB 27 [1][20]. MM's creator chose a paid game to avoid pay-to-win [57].
15. **Bolted-on multiplayer missing core systems.** NHL 27 Connected has no CPU teams, draft or aging [48][49]. (Inference: stay single-player until the solo loop is solid.)

---

## 9. Open questions for the designer

1. **How much in-fight intervention?** None (pure autobattler), a few timed calls (MM-style), or free pause-and-edit of gambits? This defines the spectated fight and how much parity headless sims need.
2. **Scouting decay and contact.** Should scouting knowledge decay (NHL fog of war), and should arena contact refresh it?
3. **Academy strictness.** A hard lock (NHL juniors), or early recall with a penalty? Is there a CFB-style "up to N bouts" exemption?
4. **Talent reveal timing.** At signing (CFB), after N bouts (Madden), at the end of the first academy term, or never fully (certainty labels only)?
5. **Promotion rules.** Mandatory or optional (MM offers it), and what cushions promotion and relegation (parachute money, expectation reset, gear carryover)?
6. **Negotiation depth.** Madden-style Patience/Interest meters, or one offer/counter weighted by Trust? (Inference: small-team scope favours the latter.)
7. **Personality breadth.** A handful of readable traits, or 65+ DNA types like Madden? Each trait needs AI support and tuning.
8. **Mods and sliders at launch or later?** MM's longevity came from mods, and MM2 commits to day-one modding [62][72]. Early support is cheap with data-driven leagues, but it freezes file formats sooner.

---

## Sources

Fetched directly unless marked "(search result)": URL and content seen in web search results, page not fetched (blocked or not attempted).

1. EA Sports, "Madden NFL 27 – Franchise Deep Dive" (June 4, 2026). https://www.ea.com/games/madden-nfl/madden-nfl-27/news/madden-27-franchise-mode
2. Steve Noah, Operation Sports, "Madden NFL 27 Franchise Mode Details Revealed" (June 7, 2026). https://www.operationsports.com/madden-nfl-27-franchise-mode-details-revealed/
3. Massimo Marchiano, ClutchPoints, "Madden 27 Review – Persona Non Grata" (Aug 18, 2026). https://clutchpoints.com/gaming/madden-27-review
4. Danreb Victorio, Smashpad, "Madden NFL 27 Review" (Aug 13, 2026). https://smashpad.com/madden-nfl-27-review/
5. EA Sports, "Madden NFL 27 Title Update – August 26, 2026." https://www.ea.com/games/madden-nfl/madden-nfl-27/news/m27-title-update-august-26-2026
6. Brian Shea, Game Informer, "EA Sports Updates Fans On Its Vision For Madden's Franchise Mode" (Aug 3, 2020). https://www.gameinformer.com/index.php/2020/08/03/ea-sports-updates-fans-on-its-vision-for-maddens-franchise-mode
7. MUT.GG, "Madden NFL 22 Scouting Update Deep Dive" (Sept 17, 2021). https://www.mut.gg/news/madden-nfl-22-scouting-update-deep-dive/
8. Diamond Lobby, "Madden 24 Scouting Tips (Franchise Mode)" (search result). https://diamondlobby.com/madden-24/madden-24-scouting-tips-franchise-mode/
9. GINX, "How to Hire & Fire Scouts in Madden 24" (search result). https://www.ginx.tv/en/hire-scouts-fire
10. Diamond Lobby, "Madden 24 Player Dev Trait Guide" (search result). https://diamondlobby.com/madden-24/madden-24-player-dev-trait-guide/
11. Diamond Lobby, "Madden 23 Development Trait Guide" (search result). https://diamondlobby.com/madden-23/madden-23-development-trait-guide/
12. EA Help, "Progression and regression in Franchise" (search result). https://help.ea.com/en/articles/madden-nfl/progression-regression-franchise-mode/
13. Madden School, "The New Madden 21 Trade Logic Is Still Hilariously Broken" (c. March 2021). https://www.madden-school.com/the-new-madden-21-trade-logic-is-still-hilariously-broken-here-are-some-examples/
14. Jerrad Wyche, TheGamer, "Madden: 5 Problems With Franchise Mode (& 5 Features That Need To Return)" (Nov 12, 2019). https://www.thegamer.com/madden-5-problems-franchise-mode-features-need-return/
15. PhillyVoice, "How 'Madden' can finally fix its franchise mode" (July 2020) (search result). https://www.phillyvoice.com/madden-21-ea-sports-fix-franchise-mode-release-date-update-features-training-camps-scouting-team-relocation
16. Insider Gaming, "Madden 26 Franchise Deep Dive Shows New Coaching Updates, Gameplan Changes and More" (2025) (search result). https://insider-gaming.com/madden-26-franchise-deep-dive-shows-new-coaching-updates-gameplan-changes-and-more/
17. MP1st, "Madden 26 Review – Regaining Momentum" (2025) (search result). https://mp1st.com/reviews/madden-26-review-regaining-momentum
18. EA Forums, "Madden 27 Franchise Simulation and Management Feedback" (2026) (search result). https://forums.ea.com/discussions/madden-nfl-franchise-discussion-en/madden-27-franchise-simulation-and-management-feedback/13670686
19. OSFTW, "The Frynasty Tipping Point" (search result). https://www.osftw.com/features/714/the-frynasty-tipping-point
20. EA Sports, "College Football 27 – Dynasty & Team Builder Deep Dive" (June 4, 2026). https://www.ea.com/games/ea-sports-college-football/college-football-27/news/college-football-27-dynasty
21. Dynasty Central, "CFB 27 Pipeline Changes: What's Different" (2026). https://dynastycentral.gg/college-football-27/dynasty-guides/cfb-27-pipeline-changes
22. Robby Kalland, CBS Sports, "EA Sports College Football 26 Dynasty Mode deep dive" (June 24, 2025). https://www.cbssports.com/college-football/news/ea-sports-college-football-26-dynasty-mode-deep-dive-exploring-the-biggest-changes-and-updates
23. EA Sports, "College Football 26 – Dynasty" feature page (2025). https://www.ea.com/en/games/ea-sports-college-football/college-football-26/features/cfb26-dynasty
24. Bill DiFilippo, UPROXX, "'EA Sports College Football 25' Dynasty Review: The Mode We All Hoped For" (July 18, 2024). https://uproxx.com/?p=404163987
25. Esports.gg, "CFB 25 recruiting guide: 5 tips to getting a #1 ranked signing class" (2024) (search result). https://esports.gg/news/college-football-25/cfb-25-recruiting-guide-5-tips-to-getting-a-1-ranked-signing-class/
26. Sports Gamers Online, "Top Recruiting Tips For College Football 25 Dynasty Mode" (2024) (search result). https://www.sportsgamersonline.com/games/football/top-recruiting-tips-for-college-football-25-dynasty-mode/
27. Dexerto, "College Football 25 August 8 update patch notes" (Aug 8, 2024). https://www.dexerto.com/gaming/college-football-25-august-8-patch-notes-2855263/
28. Sportskeeda, "10 biggest issues in EA Sports College Football 25 post release" (2024) (search result). https://www.sportskeeda.com/college-football/10-biggest-issues-ea-sports-college-football-25-post-release
29. Prima Games, "EA College Football 25 Development Traits" (2024) (search result). https://primagames.com/gaming/ea-college-football-25-development-traits-best-traits-how-they-work-and-how-to-unlock
30. Esports.gg, "How to redshirt a player in College Football 25" (2024) (search result). https://esports.gg/news/college-football-25/how-to-redshirt-a-player-in-college-football-25
31. EA Forums, "Dynasty changes needed (very long)" (CFB 26) (search result). https://forums.ea.com/discussions/college-football-26-dynasty-en/dynasty-changes-needed-very-long/12393218
32. EA Forums, "Auto recruiting still doesn't work" (CFB 26) (search result). https://forums.ea.com/discussions/college-football-26-bug-reports-en/auto-recruiting-still-doesn%e2%80%99t-work/12429641
33. Mike Suszek, Engadget, "NCAA 14 Dynasty mode levels up with coach skills, recruiting changes" (May 29, 2013). https://www.engadget.com/2013-05-29-ncaa-14-dynasty-mode-levels-up-with-coach-skills-recruiting-cha.html
34. Matthew Kato, Game Informer, "The NCAA Football 14 Dynasty Recruiting Guide" (July 9, 2013). https://gameinformer.com/b/features/archive/2013/07/09/the-ncaa-football-14-dynasty-recruiting-guide
35. Game Informer, "NCAA Football 14: Bolstering Its Blue Chip Prospects" (May 28, 2013) and "NCAA 14 Review: Not The Complete Product" (July 9, 2013) (search results). https://gameinformer.com/games/ncaa_football_14/b/xbox360/archive/2013/05/28/bolstering-its-blue-chip-prospects ; https://gameinformer.com/games/ncaa_football_14/b/xbox360/archive/2013/07/09/ncaa-14-review-not-the-complete-product
36. 2K Newsroom, "NBA 2K27 MyNBA Answers the Community with a Back to Basics Franchise Overhaul and Modern CBA Rules" (Aug 18, 2026). https://newsroom.2k.com/news/nbar-2k27-mynba-answers-the-community-with-a-back-to-basics-franchise-overhaul-and-modern-cba-rules
37. 2K, "NBA 2K27 – MyNBA" feature page (2026). https://nba.2k.com/2k27/features/mynba/
38. Steve Noah, Operation Sports, "NBA 2K27 MyNBA Details Revealed" (Aug 18, 2026). https://www.operationsports.com/nba-2k27-mynba-details-revealed/
39. 2K Newsroom, "Endless Possibilities Await as MyNBA Levels Up in NBA 2K26" (Aug 21, 2025). https://newsroom.2k.com/news/endless-possibilities-await-as-mynba-levels-up-in-nbar-2k26
40. Matt Bertz, Game Informer, "NBA 2K20 Introduces Big Changes For The MyGM And MyLeague Modes" (July 29, 2019). https://www.gameinformer.com/preview/2019/07/28/nba-2k20-introduces-big-changes-for-the-mygm-and-myleague-modes
41. 2K Newsroom, "Rewrite NBA History in NBA 2K23 with All-New MyNBA Features" (2022) (search result). https://newsroom.2k.com/news/rewrite-nba-history-in-nbar-2k23-with-all-new-mynba-features-for-playstation-5-and-xbox-series-xs-consoles
42. 2K, "NBA 2K25 PC FAQ" (2024) (search result). https://nba.2k.com/2k25/pc-faq/
43. Ishaan Bhattacharya, Fadeaway World, "NBA 2K22 Had A Massive Bug Where Free Agents In MyNBA Became 99 Years Old" (July 15, 2022). https://fadeawayworld.net/nba-2k/nba-2k22-had-a-massive-bug-where-free-agents-in-mynba-became-99-years-old
44. NLSC Forums, "MyGM is looking like a hard pass this year" (2019) (search result). https://forums.nba-live.com/viewtopic.php?p=1979282
45. Sports Gamers Online, "NBA 2K19 MyLeague Details" (2018) (search result). https://www.sportsgamersonline.com/games/basketball/nba-2k19-myleague-details/
46. NBA 2K Wiki (Fandom), "MyLEAGUE" (search result). https://nba2k.fandom.com/wiki/MyLEAGUE
47. EA Sports, "NHL 27: Connected Franchise Deep Dive" (Aug 12, 2026). https://www.ea.com/games/nhl/nhl-27/news/nhl-27-connected-franchise
48. Cory Wells, Hardcore Gamer, "Review: NHL 27" (Sept 3, 2026). https://hardcoregamer.com/nhl-27-review/
49. Sports Gamers Online, "NHL 27 Connected Franchise Is an Embarrassing Half-Measure" (2026) (search result). https://www.sportsgamersonline.com/featured/nhl-27-connected-franchise-bare-bones/
50. Jon Scarr, Best Buy Canada Blog, "NHL 26 review" (Sept 12, 2025). https://blog.bestbuy.ca/video-games/nhl-26-review
51. Matt Bertz, Game Informer, "NHL 19 Franchise Mode Interview: Learn The Nitty Gritty Details About The New..." (Aug 17, 2018). https://www.gameinformer.com/preview/2018/08/17/nhl-19-franchise-mode-interview-learn-the-nitty-gritty-details-about-the-new
52. Diamond Lobby, "How Potential Works in NHL 23 Franchise Mode" (updated Feb 21, 2023). https://diamondlobby.com/nhl-23/how-potential-works-nhl-23-franchise-mode/
53. Diamond Lobby, "NHL 22 Franchise Mode Potential Explained" (search result). https://diamondlobby.com/nhl-22/nhl-22-franchise-mode-potential-explained/
54. EA Sports, "NHL 25 – Franchise Mode" feature page (2024). https://ea.com/games/nhl/nhl-25/features/franchise-mode
55. EA Forums, "Franchise mode is disappointing" (NHL 26) (search result). https://forums.ea.com/discussions/nhl-26-general-discussion-en/franchise-mode-is-disappointing/12552886
56. EA Forums, "Prospects in AHL" (NHL 26) (search result). https://forums.ea.com/discussions/nhl-26-general-discussion-en/prospects-in-ahl/13553974
57. Mike Rose, Game Developer, "Making Formula 1 accessible with Motorsport Manager" (Aug 22, 2014). https://gamedeveloper.com/design/making-formula-1-accessible-with-i-motorsport-manager-i-
58. Will Wood, RaceFans, "Motorsport Manager: Meeting the brains behind the game" (Aug 10, 2016). https://www.racefans.net/2016/08/10/meeting-man-behind-motorsport-manager/
59. Matthew Kato, Game Informer, "The Sports Desk – Behind The Wheel Of Motorsport Manager" (Aug 15, 2016). https://gameinformer.com/b/features/archive/2016/08/15/the-sports-desk-behind-the-wheel-of-motorsport-manager
60. Steam, "Motorsport Manager" store page (fetched Oct 25, 2026). https://store.steampowered.com/app/415200/Motorsport_Manager/
61. Steam Store API, appdetails for app 415200 (fetched Oct 25, 2026). https://store.steampowered.com/api/appdetails?appids=415200
62. Steam Community, Motorsport Manager top-rated positive reviews (fetched Oct 25, 2026). https://steamcommunity.com/app/415200/positivereviews/?browsefilter=toprated
63. Steam Community, Motorsport Manager top-rated negative reviews (fetched Oct 25, 2026). https://steamcommunity.com/app/415200/negativereviews/?browsefilter=toprated
64. Steam Community, Motorsport Manager most recent negative reviews (fetched Oct 25, 2026). https://steamcommunity.com/app/415200/negativereviews/?browsefilter=mostrecent
65. Steam Discussions, "Promotions and stats / expectations" (Jan 16, 2017). https://steamcommunity.com/app/415200/discussions/0/142261352661385160
66. Steam Discussions, "Budget Issues" (Feb 9, 2017). https://steamcommunity.com/app/415200/discussions/0/133256758576774722
67. Steam Discussions, "ICE MOD 2017" (Mar 21, 2017). https://steamcommunity.com/app/415200/discussions/0/133259956025077455
68. Steam Discussions on chairman mood and ultimatums (search results). https://steamcommunity.com/app/415200/discussions/0/1457328927827575814 ; https://steamcommunity.com/app/415200/discussions/0/133261124634053894
69. Windows Central, "Motorsport Manager preview" (2016) (search result). https://www.windowscentral.com/motorsport-manager-preview
70. Motorsport Manager PC Wiki (Fandom), "Car parts" (search result). https://motorsportmanagerpc.fandom.com/wiki/Car_parts
71. Wikipedia, "Motorsport Manager." https://en.wikipedia.org/wiki/Motorsport_Manager
72. Game Developer (press release), "Motorsport Manager 2 announced: Playsport returns to the pit wall..." (June 25, 2026). https://www.gamedeveloper.com/press-release/motorsport-manager-2-announced-playsport-returns-to-the-pit-wall-with-the-next-chapter-in-the-legendary-motorsport-management-series
73. DLH.NET, "Motorsport Manager 2 – New Trailer & Dev Diary" (Oct 1, 2026). https://www.dlh.net/en/news/90710/motorsport-manager-2---new-trailer-dev-diary.html
74. Stuff.tv, "Motorsport Manager review" (2016) (search result). https://www.stuff.tv/game-reviews/motorsport-manager/review
75. Cubed3, "Motorsport Manager – Second Opinion" (Dec 12, 2016) (search result). https://www.cubed3.com/games/reviews/pc/motorsport-manager-second-opinion
76. EA Answers HQ, "Need advice for developing Players" (NHL) (search result). https://answers.ea.com:443/t5/General-Discussion-News/Need-advice-for-developing-Players/td-p/11425067

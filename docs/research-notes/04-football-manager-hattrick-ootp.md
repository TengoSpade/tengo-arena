# Research notes 04: Deep management sims (Football Manager, Out of the Park Baseball, Hattrick)

**Scope.** These notes cover three long-running management sims as references for the management layer of our arena-league game: scouting under fog, multiple leagues with promotion and relegation, academies, contracts and finances, and keeping long saves interesting. Football Manager (FM) gets the most depth, including its current troubled state and its lighter editions (Touch, Mobile, Classic). Out of the Park Baseball (OOTP) is here mainly for its scouting-accuracy model and its Player Development Lab, which is the closest existing analogue to our academy. Hattrick is here for its weekly cadence, small league groups and pyramids, and why people play it for decades. Research date: 25 Oct 2026. Yearly editions differ, so sources are dated where it matters. Anything marked "(inference)" is my own reading, not a sourced claim. We want mechanics and lessons only, not names, text, data or art.

---

## 1. Football Manager series (Sports Interactive / SEGA)

**Key facts:** Developer Sports Interactive, publisher SEGA. Current edition **FM26**, released 4 Nov 2025 on PC/Mac/PS5/Xbox and 4 Dec 2025 on Switch. It was the first FM built in Unity; the match engine, tactics and decision-making stay proprietary [1]. **FM25 was cancelled** in Feb 2025 [1][3]. **FM27** comes out 10 Nov 2026, with a free PC/Mac preview from 29 Oct to 3 Nov [2][29]. Business model: a premium annual release (FM26 is $59.99, plus an $8.99 in-game editor DLC [4]), with day-one Game Pass, Mobile through Netflix and Touch through Apple Arcade [29].

### 1.0 Current state of the series (verified, Oct 2026)
- **The FM25 cancellation.** Miles Jacobson said the simulation and database mostly worked, but the new front end was clunky and not fun to use. Porting C++ to C# for Unity was far harder than planned: some work took nine months against a two-week estimate [3]. Press coverage described it as the studio's most expensive decision [64].
- **FM26 reception.** It has the lowest Metacritic score in the series ("mixed or average") [1]. Steam is **Mostly Negative: 38% of ~9,435 reviews**, recovering to Mixed (64% of 247) in the last 30 days [4]. For comparison, FM24 is **92% positive of 11,656** [6]. FM26 still reached about 8M players, second in the series behind FM24's 19M+ [1]. International management was missing at launch and came back in a May 2026 update. SI announced the end of FM26 updates in July 2026 [1].
- **What went wrong.** All 10 top-rated negative Steam reviews cite the UI: cluttered, more clicks, information buried. Most also cite removed features (heat maps, records, international management), bugs and crashes, and an unfavourable comparison with FM24 [5]. Reviewers praised the matchday visuals but called the game unpolished [1].
- **FM27 is a usability correction** [2]. Changes include a top-menu layout (Portal, Squad, Tactics, Recruitment, Training, Club), control panels inside each area, colour-coded messages that put every offer for one player in one message, and **"Continue Flow" presets (Streamlined, Balanced, Comprehensive, Custom)**. Custom sets how often the game stops on the Transfer Hub, Youth Setup, Data Hub and similar screens. Returning features include cup draws, deadline day, heat maps, the competitions hub and copy/paste training plans. The end-of-season review is not coming back [2].

### 1.1 What makes it fun / sticky
- **A long-horizon story you author.** In the top-rated positive FM24 reviews, the emotional payoff comes from personal arcs: taking a small club up the pyramid, winning a World Cup with a minor nation on save day 846, or relegating a giant [7]. Players joke that the game costs them relationships and schoolwork [7].
- **Several loops nest inside each other** (inference from [9][13][17]). There is a weekly match loop, a monthly transfer and scouting loop, and a yearly youth intake and season-end loop. Something is always about to resolve: a scout report, a youth intake, a contract expiry, a promotion race.
- **Discovery under fog.** Attribute masking plus staff opinions that differ means finding a cheap player whose ranges hide a gem is a real skill payoff [14][11].
- **Personal challenges.** The lower-league (LLM) community values the "realistic", slow climb [19]. Others start new saves at lower clubs to get the challenge back [65].

### 1.2 Good practices worth adopting
1. **Fog of war on attributes, revealed by knowledge.** With masking on, attributes of players you know little about show as greyed-out values or ranges (e.g., 11–16). The ranges narrow as knowledge grows through nation or competition scouting, direct scouting, or playing against the player. The profile shows a per-player knowledge % (one example shows 32%) [14]. Hidden attributes (consistency, injury proneness, versatility, personality factors) only appear as pros and cons after extensive scouting [14]. Masking is a setting chosen when the save starts [14].
2. **Two-axis scout skill.** Scouts have Judging Player Ability (JPA, for current level, which matters most for players over about 23) and Judging Player Potential (JPP, which matters most for under-23s) [16]. Adaptability, reputation and per-nation knowledge also count. A scout with full knowledge of a nation works faster there and reports more accurately [10]. Guides suggest 15–16+ in JPA/JPP as a benchmark on the 1–20 scale [13][63].
3. **Knowledge has sources and decays** (FM22-era guide [10]). Knowledge comes from staff nationality and past jobs, feeder/parent club links, the manager's own experience, proximity (your own division and nation) and player fame. A nation's knowledge equals its best single source. It **fades**: every youth intake adds unknown players, and a scout who roams far away for months loses knowledge of his home nation [10]. In older versions, a nation's knowledge % also limited how many of its players appeared in search: 100% shows everyone, lower % shows roughly the most famous slice [15].
4. **Scouting range is a budget or board-permission tier.** Ranges run from world, continent and region down to country, its divisions, or only your own division. Lower-league clubs usually get just their own division, which is a great "small club" constraint [10]. In FM24, wider range is a paid package you can switch on briefly to save budget [74].
5. **Batch scouting instead of one-by-one chores.** **Recruitment Focus** (FM23+) is a standing brief: position, role, CA/PA bands, transfer type, age and priority, with a scout and an analyst assigned. Fully scouted players get an **A–F recommendation grade** and a "matches N criteria" count [13]. The cost depends on assignment type, duration and distance [13]. FM26 added **Requirements** adverts broadcast to every club (position, role, playing time, loan or permanent, age); your Director of Football ranks the replies. **Pitch Opportunities** lets you see other clubs' needs and offer them surplus players [9]. FM27 adds a "fits your tactic" gauge to scout reports [2].
6. **Stars are an opinion, not the truth.** Current and potential stars are *perceived* ability, relative to your squad level. A player might be 4 stars at a mid-table club, 2 at a giant and 5 at a minnow [11]. Stars differ between staff members [11]. **Black stars** (since FM2015) mark *uncertain* potential. They clear with at least about two weeks of scouting, and by age 25 potential stars equal current stars [12].
7. **Youth intake as an annual event with a preview.** Intake quality depends on the nation's youth rating (1–200; for example, one strong nation is 163 and another 135), the club's Youth Recruitment, Junior Coaching and Youth Facilities (each 1–20 with named bands), and the Head of Youth Development (HoYD) [17]. The HoYD's personality can rub off on the juniors, and his preferred formation and style shape which positions arrive [17]. A **preview** months ahead gives green and yellow hints. The "golden generation" line only means enough players clear a threshold, not that the ceiling is high [17]. Bigger clubs can poach hidden juniors [17].
8. **Squad dynamics as a readable structure.** A hierarchy pyramid ranks influence; social groups (core, two secondary groups, loners) form around nationality, age and language; upsetting a leader spreads unrest [20][66]. In FM18 the morale scale was doubled so small changes show, and dynamics feed into on-pitch cohesion [20].
9. **Delegation by responsibility.** A Responsibilities screen hands named tasks to staff, filterable by category [28]. The assistant can take press conferences [31]. Holiday mode lets the AI run the club for a chosen period, with options for how much it does [30].

### 1.3 Features players love (evidence)
- **Emergent long-save stories and lower-league climbs.** These dominate the top FM24 positive reviews [7]. LLM players cite the realism and the reward of building from nothing [19].
- **Depth that rewards learning.** Even FM26's harshest reviewers, some with 1,700+ hours, praise the tactics system [5].
- **Wonderkid hunting.** Community guides centre on finding and growing high-potential youngsters, from mentoring to training [67]. Youth intake day is treated as an event worth planning for [17].
- **Recruitment as a puzzle.** LLM players share tricks such as watching for players just released by clubs two divisions above [19].

### 1.4 Common complaints and pitfalls to avoid
- **UI friction kills goodwill faster than missing depth.** FM26 is the clearest case: the same core under a slower, click-heavier UI went from 92% to 38% positive [4][5][6]. One reviewer said every screen carries too much information and time passes too slowly [68].
- **Noise.** Press conferences have been a gripe for a decade. PC Gamer (2015) said each attempt at role-play just added more of them [23], and players delegate or skip them [31]. A 2025 critique asks SI to cut everything that doesn't serve the story: endless news, and questions about clubs in other countries [21].
- **Solved metas make management meaningless.** The same critique says one dominant tactic, and pace/acceleration outweighing other attributes, turn the game into chores. It proposes keeping scout reports vague even after full scouting [21].
- **Irrational AI markets.** A 1,300-hour FM24 reviewer says AI clubs pay huge fees with no clear logic, then don't play the players [8]. Others complain that press answers repeat year to year, and that wage demands spike after promotion [8].
- **Annual re-release fatigue.** Reviewers call some editions a database refresh [8].
- **Late-save boredom.** Players commonly restart after about 6–10 seasons [65]. Lower-league clubs used to plateau a league or two up [69]. Holidaying through seasons cuts tedium, but the author argues it can hollow out the save [22].

### 1.5 Lighter variants: lessons on reducing busywork
- **FM Touch.** Commenters describe it as the full game minus the chores: no press conferences, limited player interactions, more focus on matchday [27]. Matches can be skipped with instant results [70].
- **FM Classic (FM13).** It was built for time-poor fans, including SI staff with families. A season takes about 7–10 hours while the same simulation runs underneath [24][25]. It also had **Challenges**: preset scenarios of about half a season [24].
- **FM Mobile.** It plays much faster than the PC game and has a **challenge mode with seven scenarios** such as relegation battles and injury crises. A reputation setting controls how easily you can sign stars [26].
- **Lesson (inference).** Cut role-play chatter and repeated confirmations, keep the decisions (tactics, recruitment, development), and offer explicit time budgets per season.

### 1.6 Ideas that fit our hybrid
- **Masked stat ranges per fighter**, with a knowledge % per fighter and per region. Our fighter has far fewer stats than an FM player, so each range can be bigger and easier to read (for example "Might 9–15").
- **Scouts with JPA/JPP-style "Read Skill / Read Talent"** plus home regions and a limited calendar. Send them on contracts ("tour the Ironmarch circuits for 4 weeks, focus: young casters").
- **Standing recruitment briefs** that return a weekly digest with A–F grades and a "fits your gambit roster" flag. This mirrors FM27's tactic-fit gauge, but for us it can check fit against the player's actual IF/THEN tactics.
- **An annual "Trials Day"** youth intake with a preview two months ahead, whose quality depends on academy facilities, the recruiting staff and the region.
- **Continue-flow presets** from day one.

---

## 2. Out of the Park Baseball (Out of the Park Developments)

**Key facts:** Developer Out of the Park Developments, created by Markus Heinsohn. First release 1999; annual editions [32]. Current edition **OOTP 27**, released 13 Mar 2026 on Windows/macOS at $49.99, **Very Positive (82% of 537)** on Steam [33]. OOTP 26 has about 82% of about 825 reviews [34]. MLB/MiLB licences since OOTP 16, plus KBO, the Dutch and British leagues and the World Baseball Classic [32][43]. Business model: a premium annual release plus **Perfect Team**, a free online card-collecting mode [33]. Critical history: OOTP 2007 scored 96 on Metacritic and OOTP 17 scored 92 [32].

### 2.1 What makes it fun / sticky
- **A living universe at any scale.** You can replay any season since the 1800s or build fictional universes [43]. Positive reviews mention deadball-era and custom 1927 leagues, and one long save running a season ahead of real time [36].
- **The GM fantasy with full delegation.** One reviewer notes you can hand everything except trades and lineups to the CPU [36].
- **Numbers that tell stories** ("spreadsheet-level" information on a par with FM) [36].

### 2.2 Good practices worth adopting
1. **One scouting director instead of a scout army** (OOTP 9 redesign, about 2008) [38]. You hire one director through bidding. He has four ratings (major league, minors, international, amateur) and a **style preference** running from "favour ability" to "favour tools", i.e. polished college players against raw high-schoolers. You split a budget across four areas. Accuracy depends on budget, the director's ratings and luck. Rating changes arrive **at report dates through the season**, not instantly, so slumps are harder to diagnose. The design also cut league file size by 80% [38]. Heinsohn named the new scouting system and the better AI among his favourite features of that edition [47]. Even in 2014 the studio was still a small team [48].
2. **The AI scouts imperfectly too.** AI clubs use their own scouts, so they may overpay for a player your scout sees as declining, or trade away one their scout sees as declining. That makes AI offers harder to read [38]. This creates a market you can beat with better information (inference).
3. **Explicit error model** (Matt Arnold dev guide, May 2025) [39]. A scout's "view" comes from the true ratings and is shaped by his rating, the budget and report accuracy. There is **more error for young and international players**, a **random per-player skew** up or down, and a **league-wide accuracy setting**. In OOTP 26, high-accuracy reports also factor in a player's hidden **development path** (fast or slow) [39].
4. **A visible confidence value plus a second opinion.** Each report shows a "Scouting Accuracy" rating. The **OSA** (a neutral league-wide service) scouts every player once a year as a baseline second opinion [37]. Turning scouting off makes OSA 100% accurate, with no fog [37].
5. **Difficulty knobs exposed as settings.** These include scouting accuracy (some players choose very low for a harder game) [71] and **Talent Change Randomness** (default 100). With TCR off, potential stays roughly stable; with it on, potential can rise or fall [40]. One player set it to 200 for wild career swings [49].
6. **Player Development Lab as an analogue for our academy.** OOTP 25 introduced individual programs (baserunning, stamina, a new pitch) [42]. Only a couple of players at a time go to the team's development complex during the offseason and spring training [72]. OOTP 26's **Lab 2.0** added **progress bars and midterm reports that let you withdraw a player early** [41][34].
7. **Draft Combine** (OOTP 26). You scout prospects and **build relationships** with them before the draft, which feeds round-by-round targeting [41].
8. **Promotion and relegation for custom pyramids.** OOTP 18 automated it [44]. The community builds world pyramids with cups, and some only promote every three seasons [73].

### 2.3 Features players love
Depth and engine (7 of 10 top positive reviews), the GM role (6), customisation (4), and fictional and historical leagues [36]. The Draft Combine was the OOTP 26 reviewer's favourite addition [41]. Long-time fans praise its replayability and "living universe" feel [36].

### 2.4 Common complaints and pitfalls to avoid
- **A side mode eating development focus.** 8 of 10 top negative OOTP 26 reviews accuse Perfect Team of drawing development away from single-player [35].
- **Scouting that confuses.** A 2025 blogger found OOTP's automatic scouting baffling next to FM's clear fog of war. You can't target players, and switching between director and OSA views confuses [37]. Changing directors can shift every rating overnight [37].
- **Development programs that feel like traps.** The OOTP 26 reviewer found most Lab programs left players with lower ratings or injured, even with strong coaches [41].
- **Long-save health.** Complaints include save folders ballooning into huge file counts, missing official documentation, budget systems that distort AI decisions, and AI managers releasing prospects when you're not watching [35].
- **Annual re-release with little single-player change** (6 of 10 top negative reviews) [35].

### 2.5 Ideas that fit our hybrid
- **A Guild Registry baseline.** A neutral body publishes a yearly, low-accuracy ("±4") read on every registered fighter. Your own scouts sharpen it. This gives a free fallback so nobody is totally blind.
- **Scout "eye" bias.** Scouts can favour *Proven* (current output) or *Raw* (physical gifts), mirroring ability against tools. Two scouts can honestly disagree.
- **Hidden development pace** (fast, normal or late bloomer) that only skilled talent-readers detect.
- **Academy programs with a progress bar and a mid-term report**, where you can recall early and get partial gains back.
- **AI clubs with imperfect scouts**, so they misprice fighters.
- **Pre-draft trials** where relationships unlock better reads or a willingness to sign.

---

## 3. Hattrick (Hattrick Limited, originally ExtraLives)

**Key facts:** A browser MMO football manager launched 30 Aug 1997 in Sweden, originally an MSc project by Björn Holmér [50][51][54]. Free to play with an optional **Supporter** subscription (since May 2001; four tiers from about €3.33/month). Supporter gives statistics, cosmetics and federations but **no competitive advantage** [50][52][53]. Players peaked at about **1M in Feb 2009**, were at 201,895 in Oct 2022, and are still above 200k in 2025/26 [50][51]. There are 144 countries and 53 languages [50], and seasons last 16 weeks [50]. A community tool showed season 95 at the time of research [56].

### 3.1 What makes it fun / sticky
- **Real-time slowness as a feature.** There are one or two matches a week, each lasting 90 real minutes with a live text feed, and players age one year every 112 days [51][52]. The design rewards long-term planning, and users stay "for decades" [51]. Reviewers report playing 20–22 years [58].
- **Human rivals in small groups.** Each 8-team series plays a double round-robin over 14 rounds [52]. You know your rivals by name (inference).
- **Hidden mechanics drive a research community.** Much of the engine is undocumented. Since 2011 the community has kept an "Unwritten Manual", and third-party tools use the official CHPP API [51]. Hattrick Organizer, for example, predicts lineup ratings and analyses training [62]. A 2026 academic model of the engine only matched the best community predictors; it did not beat them [51].
- **Civic layer.** Each country's users **elect national-team coaches** (A, U20/U21) every World Cup cycle [52][53].
- **Train and sell.** Selling trained players raises income, so development becomes an economy [53][55].

### 3.2 Good practices worth adopting
1. **Words instead of numbers.** There are 8 skills, each on a **21-step word scale** from "non-existent" to "divine" [54][55]. Players also have form, experience and leadership, plus **specialties that have drawbacks** [54]. Specialties trigger special match events, and the engine allocates those events by how many players with each specialty are on the field [51].
2. **Readable sector ratings.** Team strength shows as midfield, left/centre/right attack and defence, set-piece and tactic ratings. Midfield decides possession and attack ratings decide conversion [51]. The community even has a shorthand formula built from these ratings ("HatStats") [51].
3. **Training as a weekly opportunity cost.** One team-wide training type per week benefits players who **play in the trained position** [54], with a 90-minute weekly cap [60]. Training slows after about 21, and skills start decaying after about 28 [60]. Coach quality changes the speed [61]. A visible level once took about 7–9 weeks for a 19-year-old with a top coach and assistants (2007 data) [54].
4. **Youth: two modes.** In the "classic" mode you pull one random youngster each week. Since 2007 there has also been a Youth Academy with a youth squad, user-created youth leagues and scouts set to a "search for" type [53][57]. Youth **current and potential skills are partly hidden** and inferred from coach comments and match reports. Community tools track how far each youngster is from his maximum [56]. Promotion has an age window (players must move up by about 19) [56].
5. **A clear, generous pyramid.** There are up to 11 tiers, fanning out from 1 group to 4,096 [52]. In tiers II–VI only champions go up, with playoffs. From tier VII down all champions go up, and runners-up too in some tiers. The bottom two go down, with 5th and 6th in relegation playoffs in tiers I–V [52]. A national cup runs alongside, where the **weaker team gets home advantage** [52]. A cross-country Masters cup is open to champions and cup winners [50].
6. **Hard but survivable finances.** New clubs start with a 12,000-seat stadium and small cash. A bankrupt club has **two weeks to clear its debt or is deleted**, with a seven-week ban [52]. The developers also watched the economy: economists studied its inflation and deflation, and the team limited the money supply and how fast players can be trained and sold [52].

### 3.3 Features players love
Long-term strategy and depth, the community, and decades-long tenure all recur in reviews [58]. People also value that free play stays competitive [58]. The structure is built around persistence and identity (inference).

### 3.4 Common complaints and pitfalls to avoid
- "Nothing much happens" between a couple of matches a week, and players must play 90 minutes to develop [58].
- Match results feel random, and the mechanics feel obsolete [58].
- Ladders and friendlies sit behind a paywall, and the price feels high [58].
- Inflation in the player market [58].
- **Lower divisions fill with bots and passive "training mode" teams** as the human population shrinks [51]. A 2024 column says there are fewer and less active players than in the 2000s [59].

### 3.5 Ideas that fit our hybrid
- **Word-tier stats with hidden sub-progress.** For example "Seasoned (+)" means near the next tier.
- **Specialty traits with a drawback**, which suits fantasy (a Berserker who hits hard but ignores retreat gambits).
- **Sector-style team ratings shown before a bout** (front line, casters, support), computed from roster and tactics, so the auto-battle feels legible.
- **Small 8-team divisions** with playoff spots and an underdog-home-advantage cup.
- **Weekly scouting "calls"** in the academy: each scout returns one prospect per week matching a chosen focus, and you keep him or let him go.

---

## 4. Cross-game comparison

### 4.1 Scouting systems
| Aspect | FM | OOTP | Hattrick |
|---|---|---|---|
| Masking | Per-attribute ranges plus a per-player knowledge %; hidden attributes come as pros and cons [14] | Whole ratings distorted by the scout's error; a confidence value per report [37][39] | Your own seniors are visible; youth current and potential are partly hidden [56] |
| Scout attributes | JPA, JPP, Adaptability, reputation, nation knowledge [10][16] | Director: four area ratings plus an ability/tools preference [38] | Youth scouts with a search focus [57] |
| Regional knowledge | Per-nation %, from staff origin, links and proximity; it decays [10] | Separate international and amateur budgets [38] | N/A |
| Assignments | Player, team, league, nation and region, plus standing Recruitment Focus; cost scales with duration and distance [13] | Automatic, plus on-demand reports [37] | Weekly calls (inference from [57]) |
| Output | Stars (relative), black stars, A–F grade [11][12][13] | Ratings on a chosen display scale (20–80, 1–100 and others) mapped from a hidden 1–550 internal scale, plus OSA second opinion [37][45][46] | Coach comments, match reports [56] |
| Data analysts | Assigned with scouts in Focus; interpret performance data [10][13] | Stats vs. scout view advice [37] | Community tools [51] |

**How knowledge decays or persists.** In FM, new intakes and absent scouts erode it [10]. In OOTP, reports refresh on a schedule and changing directors resets the lens [37][38]. In Hattrick, youth knowledge builds up over weeks of comments [56].

### 4.2 Recruiting and the transfer market
- **FM.** Bids, agent negotiation and clauses: release, sell-on (now shown in FM27 scout reports), add-ons, award-linked bonuses (FM26), and loans with future fees or buybacks [2][9]. Requirements adverts bring offers to you [9]. Deadline day returns as an event, with agent offers rising toward the deadline [2]. AI quality is the weak spot: there are complaints about irrational fees [8], and SI claims FM26 AI builds squads more realistically and responds to FFP [9].
- **OOTP.** Trades are central; OOTP 27 advertises "huge updates" to the AI trade model [33]. Imperfect AI scouting makes AI offers hard to read [38].
- **Hattrick.** An auction market run by humans [52]. Inflation needed developer intervention [52][58].
- **For us (inference).** Use FM's "brief out, offers in" flow plus a short deadline-day event. Keep the clauses few: release fee, sell-on %, and a "guaranteed bouts" promise.

### 4.3 Player development and potential
- **FM.** CA and PA run on a 0–200 scale. PA is a **fixed ceiling** per player; in a database it may be a range that each save resolves [11][12]. Whether a player reaches it depends on age, personality and professionalism, playing time, facilities, youth staff and injuries [11]. Mentoring changes personality, not mental attributes, and mismatched pairs cause friction (2012 rules) [18]. FM27 makes young players care more about game time [2].
- **OOTP.** Potential is **dynamic** (TCR) [40], development paths are hidden [39], and programs can backfire [41].
- **Hattrick.** Development is training-position based, with age curves (slower after 21, decay after 28) [60].
- **Wonderkid culture.** FM's star-rated potential plus masking produces a whole community genre of wonderkid lists and guides [67]. That only works because potential is hidden but discoverable (inference).

### 4.4 Youth academies and intake
- **FM.** An annual intake day with a preview. Inputs are nation rating, recruitment range, coaching, facilities and HoYD personality. Juniors can be poached [17]. Loans are the standard way to give game time [9][19].
- **OOTP.** The Lab takes a couple of players per offseason, with progress bars, midterm reports and early withdrawal [41][72].
- **Hattrick.** Weekly pulls or an academy with youth leagues; youngsters must be promoted by about 19 [53][56].

### 4.5 Multiple leagues, promotion/relegation, cups
- **Hattrick** shows a fan-out pyramid with 8-team groups and tier-dependent promotion and playoff rules [52]. **FM's** strength is the lower leagues feeling different: tiny budgets, a squad rebuilt every season, free agents and loans, and players who refuse to re-sign unless you go up [19]. Scouting range is often limited to your own division [10]. **OOTP** supports custom pyramids, and some leagues promote only every three seasons [44][73].
- FM's LLM community treats the lower leagues as the "realistic" way to play [19]. A cup where the weaker side gets home advantage (Hattrick) is a cheap way to create giant-killing stories [52].

### 4.6 Contracts and finances
- **FM.** Wages and budgets set by the board; the board and fans expect certain transfer behaviour [9]; FFP and Squad Cost Ratio rules (updated again for FM27) [2][9]. A pain point: wage demands jump after promotion [8].
- **Hattrick.** Hard bankruptcy deadline [52].
- **OOTP.** Budget systems can warp AI decisions [35].
- **For us (inference).** One "wage-to-revenue" ratio rule per league tier, with clear warnings, is enough FFP.

### 4.7 Morale, chemistry, dynamics, press
- **FM.** Hierarchy, social groups and morale feed match cohesion [20][66]. Press conferences are widely disliked or delegated [23][31], and Touch removes them [27].
- **OOTP.** Light on interaction; one convert from FM wished for more [36].
- **Hattrick.** Form, team spirit and confidence are simple numbers (inference).
- **Lesson (inference).** Keep chemistry structural (who likes whom, leaders) and skip conversational busywork.

### 4.8 Staff
- **FM.** Many roles: DoF, chief scout (who writes the final report), next-opposition scout, youth scouts, roaming and nation scouts, analysts, HoYD [10]. Each has 1–20 attributes [13][17], and all can take delegated jobs [28].
- **OOTP.** A single director abstracts the whole team [38].
- **Hattrick.** Coaches and assistants affect training speed [54][61].
- **For a small team (inference).** Use 4–5 staff slots with 3 attributes each, not FM's breadth.

### 4.9 Longevity without busywork
- **What helps.** Continue-flow presets and digests [2], delegation [28], holiday mode [30], challenges and scenarios [24][26], instant results [70], quick saves of 7–10 hours per season [24]. Emergent narrative is the main hook [7].
- **What players complain about late.** Noise and repetition [8][21][23], solved metas [21], stagnation after 6–10 seasons [65], AI market irrationality [8], save bloat [35], and passivity from over-delegation [22].

### 4.10 Lesson A: making scouting fun rather than a chore
1. **Give orders, get digests.** Standing briefs (FM Recruitment Focus and Requirements) beat clicking fighters one by one [9][13].
2. **Scouts are characters with opinions.** Two skills, a bias and home regions. Disagreement between scouts is content [10][38].
3. **Make uncertainty pay off.** The AI scouts imperfectly too, so better information beats the market [38].
4. **Ration time and place.** Ranges, regions and calendar weeks create a decision about where to look, not a grind [10][13].
5. **Always give a fallback.** A low-accuracy baseline (OSA) keeps new players from feeling blind [37].
6. **Don't reveal everything.** A residual vagueness should survive full scouting [21]. FM's black stars only clear with age [12].
7. **Avoid OOTP's confusion.** Players must be able to see which source a number comes from and how confident it is [37].

### 4.11 Lesson B: displaying fuzzy and uncertain stats
- **Ranges per stat** (FM 11–16) that narrow with knowledge [14]. They are the most legible option.
- **A knowledge % per fighter** (FM) [14] or a **confidence label per report** (OOTP) [37].
- **Stars split into "sure" and "unsure" segments** (black stars) [12]. Make clear whether stars are relative to your roster or absolute; FM's relative stars confuse players [11].
- **Word tiers with hidden sub-progress** (Hattrick) [54][55].
- **Hidden traits revealed as pros and cons text** (FM) [14].
- **(Inference) Recommended combination for us:** a range bar per stat, a single knowledge meter per fighter, potential shown as stars with "unsure" segments, and traits shown as "?" until revealed.

### 4.12 Lesson C: academy and training trade-offs that create real decisions
- **Opportunity cost.** The fighter is absent from bouts while away. FM27's youth game-time pressure [2] and Hattrick's position-specific training [54] show how playing time competes with development.
- **Capacity limits.** Only a couple of players per Lab cycle [72].
- **Visible progress with an exit option.** OOTP's progress bars, midterm reports and early withdrawal [41].
- **Risk.** Programs can hurt or injure [41]. Keep the risk legible and modest so the choice doesn't feel like a trap (inference from the reviewer's frustration [41]).
- **Specialisation.** Program types (stamina, new pitch) [42] and HoYD style shaping which players come through [17] map onto academy types.
- **Personality as a multiplier.** Professionalism and determination drive growth [11]. A mentor changes personality [18].

---

## 5. Top ideas for our game (ranked)

1. **Range-based stat masking plus a per-fighter knowledge meter.** It is the clearest, most loved fog system in the genre, and it maps directly onto a small stat set. Ranges narrow through scouting, facing the fighter in a bout, or regional knowledge. *(FM [14])*
2. **Scouts with Read-Skill / Read-Talent, home regions, a bias and a calendar.** This turns scouting into staffing and routing decisions. *(FM [10][16], OOTP [38])*
3. **Standing scouting briefs that deliver weekly digests with A–F grades and a "fits your gambits" tag.** These remove most of the chore. *(FM Recruitment Focus and Requirements [9][13]; FM27 tactic-fit [2])*
4. **AI clubs use imperfect scouting.** Market mispricing rewards good scouting and creates believable trades. *(OOTP [38])*
5. **Academy stints as programs with a type, a slot cap, a progress bar, a mid-term report and early recall.** These give real decisions with visible feedback. *(OOTP Lab 2.0 [41][72])*
6. **Hidden potential with "unsure" star segments that resolve with scouting or age, plus a hidden development pace.** This creates wonderkid culture without full opacity. *(FM [12], OOTP [39])*
7. **Annual "Trials Day" youth intake with a preview.** Quality depends on academy facilities, the recruiter's skill and the region. It is a yearly tentpole event. *(FM [17])*
8. **Continue-flow presets, digests and a strict notification budget from day one.** These head off FM26-style backlash and inbox noise. *(FM27 [2])*
9. **Small 8-team divisions** with a tiered pyramid and playoff spots, plus a cup with home advantage for the underdog. It is cheap to simulate and makes stories. *(Hattrick [52])*
10. **A Guild Registry baseline report**: free and low accuracy, refreshed yearly. *(OOTP OSA [37])*
11. **Lower tiers that feel different**: limited scouting range, short contracts, loan-ins from big clubs, players who refuse to re-sign unless you go up. *(FM [10][19])*
12. **Specialty traits with drawbacks, and legible pre-bout "sector" ratings.** These make the auto-battle readable. *(Hattrick [51][54])*
13. **Responsibility-based delegation to staff, plus a holiday mode with safe defaults.** *(FM [28][30], OOTP [36])*
14. **Scenario challenges** (save a club from relegation, survive an injury crisis) for replay value. *(FM Classic and Mobile [24][26])*
15. **Exposed difficulty knobs**: scouting accuracy and development randomness. *(OOTP [40][71])*

## 6. Pitfalls to avoid (ranked)

1. **UI friction and click depth.** FM26 fell from FM24's 92% to 38% positive on Steam with the same core [4][5][6], and FM25 was cancelled over its front end [3].
2. **Dropping features players rely on in a redesign.** FM27's long list of restored features is the cost [2][5].
3. **Noise and conversational busywork** (press conferences, news spam) [21][23][31].
4. **Solved metas**, which make scouting and development meaningless [21].
5. **Opaque or confusing scouting sources**: unclear whose number you're seeing, or ratings that jump when staff change [37].
6. **Irrational AI transfers or rosters**, such as overpaying, never playing signings, or releasing prospects [8][35].
7. **Development programs that feel like traps**, with hidden or excessive downside [41].
8. **Pacing extremes.** Hattrick's "nothing happens" [58] on one side, FM's "time moves too slowly" [68] on the other.
9. **Late-save stagnation**: plateauing clubs, boredom after 6–10 seasons [65][69].
10. **Punishing promotion economics**, such as wage spikes [8].
11. **Save bloat and performance decay** over long saves [35].
12. **Side modes or monetisation pulling focus** from the core career [35].
13. **Hidden mechanics so deep that only community tools can decode them.** It works for Hattrick's research culture [51], but a small team can't support it (inference).
14. **Shrinking leagues filling with passive AI teams** [51]. For us: AI clubs must stay ambitious (inference).

## 7. Open questions for the designer

1. **Fixed or dynamic potential?** FM's fixed ceiling is readable and feeds wonderkid hunting [12]. OOTP's randomness is more alive but blurs scouting's value [40].
2. **Should AI clubs scout imperfectly?** It adds a better market but also CPU and save size; OOTP cut its file size 80% by abstracting [38].
3. **Target hours per season, and match cadence?** The benchmark is FM Classic's 7–10 hours [24], against Hattrick's weekly real time [51].
4. **Academy shape.** Fixed season-long stints or flexible programs with recall? How much downside risk?
5. **Relative or absolute star ratings?** Should stars compare to your roster, as in FM [11], or to the league as a whole?
6. **How many leagues get full simulation and how many a lightweight one?** It affects the headless AI-vs-AI cost (inference).
7. **Include a press and morale layer at all, or only structural chemistry?** [20][23]
8. **Youth intake as one annual event (FM) or as weekly pulls (Hattrick)?** [17][53]

---

## Sources

*"Search result only" marks pages I saw in search results whose fetch was blocked (403, timeout or redirect). Every other source was fetched.*

**Football Manager**
1. Wikipedia: Football Manager 26. https://en.wikipedia.org/wiki/Football_Manager_26
2. FM Scout: FM27 New Features Guide (updated 22 Oct 2026). https://www.fmscout.com/a-football-manager-2027-new-features.html
3. FM Scout: Miles Jacobson explains FM25 cancellation and FM26 plans (29 Aug 2025). https://www.fmscout.com/a-miles-jacobson-explains-fm25-cancellation-and-fm26-plans.html
4. Steam: Football Manager 26 store page (reviews as of Oct 2026). https://store.steampowered.com/app/3551340/Football_Manager_26/
5. Steam Community: FM26 top-rated negative reviews. https://steamcommunity.com/app/3551340/negativereviews/?browsefilter=toprated&filterLanguage=english
6. Steam: Football Manager 2024 store page. https://store.steampowered.com/app/2252570/Football_Manager_2024/
7. Steam Community: FM24 top-rated positive reviews. https://steamcommunity.com/app/2252570/positivereviews/?browsefilter=toprated&filterLanguage=english
8. Steam Community: FM24 top-rated negative reviews. https://steamcommunity.com/app/2252570/negativereviews/?browsefilter=toprated&filterLanguage=english
9. FM Scout: FM26 Recruitment Revamp (8 Oct 2025). https://www.fmscout.com/a-fm26-recruitment-revamp.html
10. Passion4FM: Building Your Scouting Network in Football Manager (FM22-era, dated 2024). https://www.passion4fm.com/?p=1127
11. FM Scout: Current and Potential Ability Guide (2022). https://www.fmscout.com/a-current-and-potential-ability-guide-2022.html
12. FM Scout: Black stars in scouting reports (Oct 2016). https://www.fmscout.com/a-black-stars-in-scouting-reports.html
13. Diamond Lobby: FM23 scouting guide. https://diamondlobby.com/football-manager-2023/fm23-scouting-guide/
14. Passion4FM: Football Manager Player Attributes Explained (Jan 2025). https://www.passion4fm.com/football-manager-player-attributes/
15. FM Scout: FM11 Guide, Scouting & Player Search (search result only). https://www.fmscout.com/a-FM11-Guide---Scouting--Player-Search.html
16. Passion4FM: How to Find the Best Scouts in Football Manager (search result only). https://www.passion4fm.com/?p=964
17. Passion4FM: Youth Intake guide, how clubs produce newgens. https://www.passion4fm.com/youth-intake-guide-how-clubs-produce-newgens/
18. FM Scout: Youth development, tutoring guide (Jul 2012). https://www.fmscout.com/a-youth-development-on-football-manager-tutoring-guide.html
19. FM Scout: A basic guide to Lower League Management (Jun 2013). https://www.fmscout.com/a-basic-guide-to-lower-league-management-llm.html
20. Game Informer: Inside the Dynamics of Football Manager 2018 (Nov 2017). https://gameinformer.com/b/features/archive/2017/11/06/the-sports-desk-inside-the-dynamics-of-football-manager-2018
21. FM Projects (Substack): Make Football Manager Great Again (Jan 2025). https://fmprojects.substack.com/p/make-football-manager-great-again
22. FM Projects (Substack): Holidaying in Football Manager (Oct 2024). https://fmprojects.substack.com/p/holidaying-in-football-manager
23. PC Gamer: Football Manager 2015 review (search result only). https://pcgamer.com/football-manager-2015-review
24. Wikipedia: Football Manager 2013 (Classic mode, Challenges). https://en.wikipedia.org/wiki/Football_Manager_2013
25. PC Gamer: Football Manager 2013, Miles Jacobson interview (search result only). https://www.pcgamer.com/au/football-manager-2013-miles-jacobson-interview
26. Pocket Tactics: Football Manager 2020 Mobile review (Mar 2020). https://www.pockettactics.com/football-manager-2020-mobile/review
27. Nintendo Life: FM Touch 2018 on Switch (Apr 2018; reader comments). https://www.nintendolife.com/news/2018/04/football_manager_touch_2018_kicks_off_today_on_nintendo_switch
28. Football Manager (official): How to Delegate Staff Responsibilities in FM22 (search result only). https://footballmanager.com/node/673
29. Passion4FM: Football Manager 27, everything we know. https://www.passion4fm.com/football-manager-27-everything-we-know-about-fm27-release/
30. Dot Esports: How to simulate days and seasons in FM24 (holiday mode) (search result only). https://dotesports.com/general/news/how-to-simulate-days-and-seasons-in-football-manager-2024
31. Steam Community: FM2019 discussion on press conferences and delegation (search result only). https://steamcommunity.com/app/872790/discussions/0/1867245621476990568

**Out of the Park Baseball**

32. Wikipedia: Out of the Park Baseball. https://en.wikipedia.org/wiki/Out_of_the_Park_Baseball
33. Steam: Out of the Park Baseball 27. https://store.steampowered.com/app/4045750/Out_of_the_Park_Baseball_27
34. Steam: Out of the Park Baseball 26 (search result only). https://store.steampowered.com/app/3116890/Out_of_the_Park_Baseball_26/
35. Steam Community: OOTP 26 top-rated negative reviews. https://steamcommunity.com/app/3116890/negativereviews/?browsefilter=toprated&filterLanguage=english
36. Steam Community: OOTP 26 top-rated positive reviews. https://steamcommunity.com/app/3116890/positivereviews/?browsefilter=toprated&filterLanguage=english
37. Baseball Replay Journal: Scouting in OOTP (Mar 2025). https://baseballreplayjournal.substack.com/p/scouting-in-ootp
38. OOTP Developments Newsletter #43 (OOTP 9 scouting redesign, c. 2008). https://www.ootpdevelopments.com/newsletters/nl0043/
39. OOTP Forums: Matt Arnold, "A developer's guide to the new Scouting System" (May 2025) (search result only, 403). https://forums.ootpdevelopments.com/showthread.php?p=5188669
40. OOTP Forums: Talent Change Randomness discussion (search result only). https://forums.ootpdevelopments.com/showthread.php?p=5132567
41. Sports Gamers Online: OOTP 26 review (search result only, 403). https://www.sportsgamersonline.com/news/reviews/out-of-the-park-baseball-26-review-a-baseball-nerds-dream/
42. Game Developer: OOTP 25 launch press release (Mar 2024). https://www.gamedeveloper.com/press-release/out-the-park-baseball-25-takes-the-field-with-all-new-innovative-features-in-the-award-winning-baseball-strategy-game-now-available-worldwide
43. OOTP Developments: official features page. https://ootpdevelopments.com/out-of-the-park-baseball/
44. Operation Sports (OSFTW): OOTP 18 Road to Release, Promotion and Relegation (search result only). https://www.osftw.com/features/2710/-out-of-the-park-baseball-18-road-to-release-promotion-and-relegation
45. OOTP Wiki: Pitching Ratings Tab (rating scales) (search result only). https://wiki.ootpdevelopments.com/index.php?oldid=2022
46. OOTP Forums: raw-to-20-80 rating conversion thread (search result only). https://forums.ootpdevelopments.com/showthread.php?p=5098121
47. OSFTW: Interview with Markus Heinsohn (OOTP 9 era) (search result only). https://www.osftw.com/features/540/interview-with-ootp-baseball-developer-markus-heinsohn
48. Sports Illustrated: Interview with the creator of OOTP (Aug 2014) (search result only). https://www.si.com/extra-mustard/2014/08/08/interview-creator-out-park-baseball
49. Baseball Replay Journal: My Random Debut Project (TCR 200) (search result only). https://baseballreplayjournal.substack.com/p/my-random-debut-project

**Hattrick**

50. Wikipedia: Hattrick (video game). https://en.wikipedia.org/wiki/Hattrick_(video_game)
51. Constantinou, Higgins, Kitson: "Decoding the mechanisms of the Hattrick football manager game using Bayesian network structure learning", arXiv 2504.09499 (Entertainment Computing, 2026). https://arxiv.org/abs/2504.09499
52. German Wikipedia: Hattrick (Computerspiel). https://de.wikipedia.org/wiki/Hattrick_(Computerspiel)
53. Italian Wikipedia: Hattrick. https://it.wikipedia.org/wiki/Hattrick
54. Swedish Wikipedia: Hattrick (datorspel) (notes its information is mostly from 2007). https://sv.wikipedia.org/wiki/Hattrick_(datorspel)
55. Dutch Wikipedia: Hattrick (computerspel). https://nl.wikipedia.org/wiki/Hattrick_(computerspel)
56. Hattrick Youthclub (community CHPP tool). https://hattrick-youthclub.org/
57. Hattrick Youthclub Wiki: players page. https://wiki.hattrick-youthclub.org/players
58. Trustpilot: hattrick.org reviews (2019–2026). https://au.trustpilot.com/review/hattrick.org
59. Galaxus: "Hattrick: you can easily play this game for ten or twenty years" (2024 column) (search result only, timeout). https://www.galaxus.fr/en/page/hattrick-you-can-easily-play-this-game-for-ten-or-twenty-years-31883
60. TV Tropes: Hattrick (search result only, 403). https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/HatTrick
61. Front Office Football Central archive: Hattrick thread (2000s) (search result only). https://forums.operationsports.com/fofc/archive/index.php/t-5990.html
62. Hattrick Organizer documentation. https://ho.readthedocs.io/en/latest/

**Additional (cross-referenced above)**

63. The Set Pieces: FM18 Project, Scouting Guide (search result only). https://thesetpieces.com/gaming/fm18-project-scouting-guide/
64. inkl: "We looked stupid": Football Manager director on costly FM25 cancellation (search result only). https://www.inkl.com/news/we-looked-stupid-football-manager-director-reveals-costliness-of-embarrassing-fm25-cancellation
65. FM Scout forum: "What happens in the end" thread (older FM era) (search result only). https://www.fmscout.com/q-3898-What-happens-in-the-end.html
66. Red Bull: Football Manager 2020 dynamics tips (search result only). https://www.redbull.com/ca-en/football-manager-2020-dynamic-tips-guide
67. Sortitoutsi: FM24 Youth Development Guide, mentoring and training wonderkids (search result only, 403). https://sortitoutsi.net/content/63677/fm24-youth-development-guide-mentoring-and-training-wonderkids
68. Top Gear: Football Manager 26 review (search result only, 403). https://topgear.com/car-news/gaming/football-manager-26-review-fantastic-match-engine-tangled-mess-menus
69. The Mancunion: Review 2.0, Football Manager 2019 (search result only). https://mancunion.com/2019/03/10/review-2-0-football-manager-2019/
70. Football Manager (official): What are the differences between our games? (FM20) (search result only). https://footballmanager.com/node/520
71. OOTP Forums: scouting budget and accuracy settings thread (search result only; one of several threads surfaced on this topic). https://forums.ootpdevelopments.com/showthread.php?p=3579896
72. Scribd: OOTP 25 changes list (development complex note) (search result only). https://www.scribd.com/document/740974558/changes
73. OOTP Forums: fictional pro/rel pyramid threads (search result only; one of several threads surfaced). https://forums.ootpdevelopments.com/showthread.php?p=5253336
74. Prima Games: How to scout in Football Manager 2024 (search result only). https://primagames.com/gaming/how-to-scout-in-football-manager-2024-scouting-tips

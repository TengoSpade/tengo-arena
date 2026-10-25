# Research notes 03: Player-configurable unit and party AI

**Scope.** This file covers games where the player writes the AI that their units follow, either before a fight or while it is paused. It looks at Gladiabots, Pillars of Eternity II: Deadfire, Final Fantasy XII and The Zodiac Age, Dragon Age: Origins and its sequels, and Unicorn Overlord in depth. Dragon Quest, Persona, FFXIII, Carnage Heart, Screeps, Baldur's Gate and Ogre Battle get short notes. The aim is to learn how each game makes AI scripting easy for newcomers but still deep for experts, then turn that into a concrete design for our tactics editor. Our game is a real-time 2D arena autobattler for 3–5 fighters, with IF/THEN rule lists, a deterministic headless sim and a management layer. Only mechanics and design lessons are recorded here. No names, text, art or data from these games should be reused.

**Method and caveats.** Several sources were blocked: Fandom wikis (HTTP 402), the Obsidian forums, Reddit, StrategyWiki, Prima and the Gladiabots wiki. Steam discussions and guides, reviews, previews, independent guides and dev interviews were used instead. A few claims rest on search-result snippets of pages that could not be opened, and these are marked "(snippet)". The shared web-search budget ran out near the end of the research, so some smaller points stay unverified (listed at the end). "(inference)" marks my own reasoning.

---

## 1. Gladiabots (GFX47, 1.0 May 2019)

**Key facts.** Robot-squad strategy game where you never control bots directly. You build each bot's AI in a visual node editor and watch the match play out. It has hundreds of solo missions, a sandbox where you control both teams, and online ranked, unranked and private matches. Multiplayer is asynchronous, played against other players' AIs while they are offline, with player-made tournaments and three modes (elimination, domination, collection). It runs on PC, Mac, Linux and mobile, and is rated "Very Positive" (about 87% of ~850 reviews) [2]. An early alpha already pitched it as a programming puzzler taught through tutorial missions [11]. The developer cites Carnage Heart as a main reference. He says the focus is "high level" strategy rather than tinkering with robot parts, and that bots are freed from Carnage Heart's grid [7].

**How the editor works.** An AI is a tree of condition and action nodes hanging off a root. Nodes are checked in a fixed spatial order: the wiki says counter-clockwise from the root, and guides describe it as left-to-right, then top-down. A passing condition lets checking continue down its branch. The first action reached ends the decision for that tick [12][5]. Non-acting nodes such as tagging or counting don't end it, and an action with no condition above it will always fire [5]. Nodes are color-coded by subject: self, ally, enemy, whole team, counters, and "pending target" comparisons like "is my health lower than that enemy's?" [5]. Distance is split into bands (out of range, long, medium, short) [5]. Tags and counters give bots memory and let the team share information [5][6]. Sub-AIs are reusable modules, and connectors split lines. Each placed sub-AI adds its full node count to the AI's node budget, so experts route several branches into one placed copy [4][12].

1. **Why it's fun.** The create–test–refine loop is the game. The dev built it after finding that pitting AI against AI was a faster way to test than playing against it. He found tuning one side until it beat the other genuinely fun and rewarding, and small changes produced surprisingly smart tactics [1]. Players love the cycle of writing a plan, watching it, losing, and tweaking, with small logic changes making big differences [3].
2. **Good practices.**
   - A sandbox where you script both sides [2].
   - A button that jumps from a match replay straight into the AI editor [8].
   - A debugger the dev kept improving across alphas [9]. In it, players rewind and step through each decision branch [3].
   - Asynchronous PvP against stored AIs, so matchmaking is always available [2][3].
   - Color-coding conditions by subject [5].
   - Reusable sub-AIs, valued mainly because they carry over between AIs [4].
   - A node budget that caps how complex an AI can get [4].
3. **What players love.** A drag-and-drop editor that people with no coding background call intuitive [3]. Making a somewhat competent AI is surprisingly easy [14]. Reviewers compare the learning feel to Human Resource Machine and while True: learn() [84]. Asynchronous matches give reliable matchmaking and near-endless replay [3].
4. **Complaints and pitfalls.**
   - Debugging is slow: rewind, open a separate debug window, then step through the branches [3].
   - Losses are hard to understand, and the closed community makes others' strategies hard to learn from [3].
   - The tutorial doesn't prepare players for comparisons like "closer than" or "nearest" [3].
   - The campaign difficulty jumps sharply around chapter 3 [3].
   - An early-access review found one tactic won almost every game and called watching matches bland and hands-off [10]. Another said formations didn't work and bots blocked each other [13].
   - Conditions that look like opposites aren't: "no enemy in short range" is not the same as "at least one enemy outside short range" [6].
   - The way the node budget counts sub-AIs frustrates experts [4].
5. **Ideas for our game.**
   - A **scrimmage sandbox** where the player sets both sides' tactics on the deterministic sim (inference).
   - **Replay → open this fighter's rules at this moment** [8].
   - A **per-tick decision trace** built into replays, so players don't have to step through it by hand (inference, answering [3]).
   - **Rule modules** ("sub-tactics") that can be shared between fighters [4].
   - A **complexity budget** per fighter instead of an unlimited editor [4].
   - **Lint warnings** that explain near-opposite conditions [6].
   - Run in-person playtests of the editor with newcomers. On his next game, the same developer said watching first-time players exposes comprehension problems that players rarely report [83].

## 2. Pillars of Eternity II: Deadfire (Obsidian, May 2018)

**Key facts.** Real-time-with-pause (RTwP) party RPG that cut the party from six to five, in part to make combat easier to read [15]. It ships with AI presets plus a Behavior Editor for heavy customization [28] (snippet). Josh Sawyer named FFXII's gambits and DA:O's tactics as the inspirations and said the system offers "great in-depth options" [15][21]. He called PoE1's AI logic "fuzzy". Deadfire rebuilt it on "three layers of conditional logic", which also let Obsidian make enemy AI far tougher [15].

**Contrast with PoE1.** PoE1 launched without companion AI. Update 2.0 (with The White March Part I, 2015) added companion AI with selectable scripts, a fix for complaints about party micromanagement [27][29] (snippet). PoE1 never had a player-facing editor. That gap is what Deadfire's editor filled [15].

**Structure.**
- **Access:** a head-with-gears icon on each portrait. Left-click toggles AI, right-click opens the settings. A green border means AI is on [26][19].
- **Auto-attack stance:** fixed presets (Passive, Self-defense, Defensive, Aggressive) [22].
- **Default behavior:** each character gets one based on class, with Aggressive and Cautious variants [26][20]. Single-class characters have one behavior and multiclass characters have two [17]. Each character has a primary and a secondary rule set, and the secondary takes over when an affliction blocks the primary's actions [15][21].
- **A custom behavior** is an ordered list of entries. Each entry pairs conditions with one ability or action, a **target type** (Self, Ally, Self/Ally, Enemy) and a **target priority**: which valid target to pick, such as the most allies nearby or the lowest frost resistance. An optional **timer** stops the same action repeating [25][22][17].
- **Logic:** stacking conditions means AND, duplicating an entry with different conditions means OR, and each condition has a **NOT** toggle [25][18]. List order is priority, so heals go on top [17].
- **Patch 1.1 changes:** conditions were sorted into categories, and the AI toggle became a three-state cycle (abilities plus attacks, attacks only, off). Consumables, modals, weapon-set switching and basic attacks could now be conditioned [16].
- **Sharing:** players report that custom behavior files can be exported and shared (forum snippet [30]). A popular mod adds the conditions the base game lacks [24].
- **RTwP and turn-based:** in RTwP the AI runs all the time. You can pause and cast by hand, and the character goes back to its script afterwards [17]. In the later turn-based mode the AI is absent [19][32b]. Players have been confused to find the AI missing there [19].

1. **Why it's fun.** Building companions that look after themselves, then watching them do it. One player called the AI system a favorite feature and said seeing it work in battle is satisfying [18].
2. **Good practices.**
   - Presets sit on top of the full editor, so casual players never need to open it [15][21].
   - Target priority is separate from conditions [25].
   - Per-rule timers [17].
   - A NOT toggle on every condition [25].
   - Categorized condition lists and a three-state AI toggle [16].
   - A fallback rule set for when a character is disabled [15].
   - Cloning a premade script is the usual way to start a custom one [18].
3. **What players love.** Reviewers say the default AI is enough on normal difficulty, while custom control becomes valuable on the hardest modes [23]. Reviews also credit better party and enemy AI and more automatic ability use [31].
4. **Complaints and pitfalls.**
   - Without timers, characters spam an ability until their resources run out. Buffs get wasted before combat starts [17].
   - Players listed many missing conditions: enemy HP thresholds, "target is casting", damage-type immunity, target class [17][18].
   - Some conditions are vague, such as "Threatening" [18].
   - UI problems: an awkward scroll slider, items moving while being reordered, targets changing on their own, some edits not saving, and long unsorted lists [18].
   - Abilities missing from the editor, and AoE spells hitting allies (players asked for a "safe target" option) [18].
   - Removing default behaviors didn't stop casting for some players [20].
   - Casters that recover per rest need more micromanagement [85].
5. **Ideas for our game.**
   - Separate *conditions* (when) from *selector* (who) and *preference* (which one) [25].
   - A **per-rule cooldown field** shown by default, so spam doesn't happen [17].
   - Condition picker grouped by category [16].
   - **Fallback stance** under every rule list [15].
   - A built-in **"no friendly fire" target filter** [18].
   - Ship generous vocabulary at launch, because players notice missing conditions straight away [17][24].

## 3. Final Fantasy XII (2006) and The Zodiac Age (2017; PC 2018)

**Key facts.**
- **Structure:** each gambit has a **target, which includes its condition**, an **action**, and a **priority** set by list position. Player commands always come first [33]. Gambits are checked top-down, and the first one whose condition holds fires [34][35].
- **Slots:** characters start with a few gambit slots (four per Gamer Guides; other sources say two or three) and buy more on the License Board, up to 12 [34][43].
- **Getting new gambits:** actions come with abilities and spells you learn. Targets and conditions are mostly bought in gambit shops (roughly 30–300 gil) or found [34][42] (snippet).
- **In battle,** each gambit can be switched on or off [34].
- **Vocabulary [35]:**
  - **Ally:** any, lowest HP, HP < X% (10% steps), MP < X%, has status, N+ foes present.
  - **Foe:** party leader's target, nearest, furthest, nearest visible, targeted or not targeted by an ally, highest or lowest stat, HP < value, weak to an element, undead, flying.
  - **Self:** HP or MP < X%, has status, targeted by a foe.
- **Origins:** FFIV already used a hidden gambit-like system to drive monster AI. FFXII made it player-facing so seamless real-time battles wouldn't become too fast to control [32]. Director Hiroyuki Ito drew on American-football plays, where each player has a job that depends on the situation [33]. The team found it hard to judge until late in development, when it finally fell into place [32].
- **The Zodiac Age** mostly left gambits alone. It added a 2x/4x speed mode that works in battle [38][39].

1. **Why it's fun.** The thinking happens before the fight, and you feel like a tactician rather than a button-presser [37]. The producer described a strong sense of triumph when a tuned party brings down a tough enemy [32]. With speed-up, a well-tuned list turns grinding into an almost automatic background loop [39].
2. **Good practices.**
   - Target and condition are fused into one readable phrase ("Ally: HP < 50% → Cure").
   - Strict top-down priority.
   - Per-rule on/off toggles.
   - New **vocabulary as loot or shop progression**, and **slots as character progression**.
   - Manual commands always win.
   - Enemies run on the same kind of system [32].
3. **What players love.** Healing and status cures handled automatically, so routine fights take care of themselves and attention goes to bosses [36]. Speed-up plus gambits make grinding painless [39].
4. **Complaints and pitfalls.**
   - **"The game plays itself"** [40][33]. Counter-arguments:
     - IGN: gambits do nothing until the player builds them [33].
     - GamesRadar: bosses and hard fights still need active play [41].
     - A design essay: a "Foe: any → Attack" gambit is no different from pressing attack every turn [37].
   - GameSpot found the system too complicated for newcomers [33].
   - The AI's judgment can be poor: healing when it should attack, or picking bad targets [36].
   - Buying every threshold variant separately feels like a chore [37].
   - The classic **ordering trap**: an unconditional attack placed above Cure means Cure never fires in combat [34].
5. **Ideas for our game.**
   - Show each rule as a **one-line sentence** ("Ally below 50% → Mend").
   - **10% threshold steps**.
   - Selling or finding new **conditions as progression** (e.g., the academy or a tactics coach).
   - A **"captain's target"** selector for focus fire [35].
   - **Per-rule toggles at pause** as the light mid-fight override.
   - Speed controls that make routine league fights quick to watch.
   - Design hard fights that a generic list can't win, so tactics matter where it counts (inference, answering [41]).

## 4. Dragon Age: Origins (2009) and its successors

**Key facts (Origins).**
- **Rules:** tactics are condition → action scripts [44].
- **Slots:** characters, companions and pets start with 2 slots and gain one free at levels 3, 6, 10, 15, 20, 25 and 30. The Combat Tactics skill (Cunning tiers 10/12/14/16) adds more [44][46].
- **Presets:** Scrapper, Defender, Archer, Damager, Healer, Debilitator, Controller, Supporter. These are meant as starting points that you save as custom sets [46].
- **Behavior stances:** Default, Aggressive, Ranged, Cautious, Defensive, Passive [46][47]. Aggressive and Ranged already attack the nearest visible enemy, so "attack nearest" wastes a slot [46].
- **Conditions are grouped by subject:** Self, Ally, Enemy, and named party members ("the target of [companion]") [50][45].
  - **Enemy conditions:** status, lowest or highest health, clustered, nearest visible, nearest visible of a class, attacking a party member, target of a party member, rank [45] (snippet).
  - **Self conditions:** surrounded by N enemies, being attacked by melee, ranged or magic, health, mana or stamina below X% [49][48].
- **Actions:** abilities, items (least or most powerful potion), switching weapon sets, toggling modes, and **"jump to tactic N"** for branching [45][50].
- **Order** is top-down priority [50].
- **Control:** the character you're controlling has its tactics switched off. A popular mod keeps them running [47].

**Successors.**
- **DA2** added slots and new conditions such as "Staggered", but its tactics menus were harder to navigate, and some presets never used certain spells [51] (snippet).
- **Inquisition** dropped the rule lists. Each ability gets **Use / Don't Use / Preferred**, and a Behaviors tab sets mana or stamina reserve, the potion HP threshold, potions to keep, and who to follow or defend [53] (snippet). Its tactical camera was pitched as a relief valve for when fights get overwhelming [52]. Fans said the missing Origins-style tactics was the one thing they missed [54] (snippet).
- **The Veilguard (2024)** removed direct companion control. Companions follow their own targeting and positioning, and the player gives orders through an ability wheel. Director Corinne Busche called it "a much higher actions-per-minute game" and said direct companion control added little to the experience [55]. Critics noted that each companion's abilities share one cooldown, so most of the time you end up playing only your own character [56]. One hands-on found the author only used the abilities that trigger combos [57]. Steam players say the later games simplified tactics a great deal [58] (snippet).

1. **Why it's fun.** You build a party of specialists that run themselves while you control one character. Focus fire comes from rules like "attack whatever the tank is targeting" [50].
2. **Good practices.**
   - Slots grow automatically with level, so you never need to invest in them [46][47].
   - Role presets you can save over [46].
   - A stance that is separate from the rule list [46].
   - Rules that reference allies ("target of …").
   - Weapon-set switching and "jump to" branching.
3. **What players love.** Once learned, the system covers most situations a companion meets [search snippet, Steam]. Veterans still compare later games against it [54][58].
4. **Complaints and pitfalls.**
   - Conditions aren't intuitive, and the system is described as buggy in practice [46].
   - Aggressive chases bait into traps [47].
   - Weapon switching triggered by enemy conditions pulls archers into melee [48].
   - Area spells hit allies, so guides tell you to cast them by hand [49][50].
   - Skill points spent on extra slots feel wasted [46][47]. Even the official guide says the skill mainly pays off if you leave companions on automatic [59].
   - **Rules tied to names break:** swap your tank and every "target of [tank]" rule has to be rewritten [50].
   - The successors swung the other way, simplifying until expert players felt they had lost something [54][56][58].
5. **Ideas for our game.**
   - **Reference roles, not names** ("Vanguard's target"), so rules survive transfers.
   - **Free slot growth with level**, plus an optional trait for more.
   - **Role presets** to start from.
   - The Inquisition-style **per-ability Use / Don't / Prefer** screen as the *beginner layer* that compiles into real rules, never as a replacement (inference).

## 5. Unicorn Overlord (Vanillaware/Atlus, March 2024; consoles only)

**Key facts.**
- **Map and squads:** a real-time overworld map of squads. Squads gain character slots over the campaign [UO-wiki].
- **Fights** run on their own: characters act in Initiative order. **Active skills cost AP** and are used on a character's turn. **Passive skills cost PP** and trigger on events such as being attacked. A fight ends when both sides are out of AP or one side is wiped out [60].
- **Tactics:** each character has an ordered list of skills, and each skill has **up to two conditions**. Higher entries win. Without set tactics, a character just attacks the enemy in front of it. **Optimize** fills in tactics and equipment automatically [60].
- **Condition types:** highest or lowest stats, front or back row, turn order, unit class (infantry, cavalry, flying, armored…), HP thresholds [63][61].
- **The designers deliberately left out some conditions** so players have to compromise and find workarounds [63].
- **How conditions work:** a community analysis says the default target list passes through condition 1, then condition 2. A *check* empties the list if false. A *filter* removes candidates, and the skill is skipped if none are left. A *sort* reorders the list without blocking, so the second sort usually decides the target [62]. Guides contradict each other on this (one calls the order "random") [61][70], which shows the rules aren't explained in the game. Players also found that empty slots let them list the same skill more than once with different conditions, a common workaround for OR logic [71][61].
- **Growth:** early characters have about 1 active and 1 passive skill, and late ones about 4+4. A full army means roughly 40 actions and 40 reactions per fight [63].
- **Battle forecast:** before you commit, you can see the predicted damage and result [66][65]. Fights can be fast-forwarded or skipped [64].
- **Dev rationale:** auto-combat was settled at the planning stage so the game could focus on building troops, because directing every unit by hand would overwhelm players [68]. Squad composition alone can decide a fight [69]. The team spent a lot of effort tuning the game for newcomers, because the system would feel unfamiliar [69].

1. **Why it's fun.** Tactics work as a puzzle and a minigame of their own. They give you a reason to watch fights, and players tweak them after most missions. It fits the fantasy of a general who trains troops and then has to trust them [63]. Destructoid compared it to "fine-tuning a high-end car before the big race" [64]. GamingTrend called it incredibly satisfying to see strategies put to the test [67].
2. **Good practices.**
   - **Resource budgets (AP/PP)** turn rule order into an economic choice [60].
   - **A two-condition cap** [60].
   - A sensible default (attack the enemy in front) [60].
   - One-button Optimize [60].
   - Conditions aware of rows and positions [63].
   - Reactions kept in a separate list [60].
   - A slow drip of new skills and classes so complexity grows gradually [63].
   - The forecast as immediate feedback [66].
3. **What players love.**
   - Room to min-max for players who want it, and Optimize for those who don't [66].
   - Tutorials pace the depth well [72].
   - Destructoid found it very approachable [64].
   - Experts were still finding improvements after 50 hours [67].
4. **Complaints and pitfalls.**
   - Optimize is never optimal, and **optimizing equipment also overwrites hand-made tactics** [67].
   - Too many options and characters to keep track of [67][65].
   - How conditions combine is unclear [61][62].
   - Normal difficulty is easy. With the forecast, one reviewer never felt they had to adapt [66][62].
   - Late-game fights become tedious and get skipped [65].
   - Tuning 10 squads is daunting. One reviewer tuned 3 by hand and let Optimize handle the rest [66].
5. **Ideas for our game.**
   - A **per-fight stamina/focus budget** so rule order is a resource decision.
   - **"Only" vs "Prefer"** as explicit, labeled modes, showing the filter/sort split openly [62].
   - An **assistant-coach suggestion** that **never silently overwrites** locked rules [67].
   - **Rule locks**.
   - A **forecast-like preview**, adapted for real time: a quick deterministic test run against a dummy or a scouted lineup (inference; may need limits so it doesn't solve every fight).

## 6. Brief notes on other games

- **Dragon Quest.** Named orders such as Fight Wisely, Show No Mercy, Focus on Healing and Don't Use Magic, recalculated at the start of each turn. DQIV's AI even *learned* enemy resistances during a fight. DQIV gave no direct control in its final chapter and was criticized for it, so DQV added "Follow Orders" [73]. Modern players use named orders for routine fights and switch to direct control for bosses [82]. A 2026 essay argues the orders make combat faster and more immersive [74].
- **Persona.** Five preset orders (Act Freely, Full Assault, Conserve SP, Heal/Support, Direct Commands) that can be changed in battle [79]. This is the simplest working layer for "personality" presets.
- **FFXIII.** Paradigms are preset role combinations for the whole party, switched in real time. The developers contrasted them with gambits, which are set before battle [77][78]. This is a model for **switching playbooks mid-fight**.
- **Carnage Heart (1996).** Flowchart chips on a CPU grid, with no control during battle. Fans enjoy the programming, but for some, debugging takes over the whole experience [75].
- **Screeps.** Real JavaScript running in a persistent world, aimed at programmers [76]. It shows the ceiling of the genre, not the audience we're aiming for.
- **Baldur's Gate.** AI scripts are compiled text files edited with outside tools. This is customization for modders, not players [80].
- **Ogre Battle (1993).** One order per unit (Best, Strong, Weak, Leader) chooses targets, with no direct control [81]. It shows a single selector choice can carry real strategy.

---

## 7. Cross-game comparison

| | Gladiabots | Deadfire | FFXII / TZA | DA:Origins | Unicorn Overlord |
|---|---|---|---|---|---|
| Editor form | Node graph | Ordered list + dropdown fields | Ordered list, phrase-style | Ordered list, phrase-style | Ordered skill list + 2 condition dropdowns |
| Rule unit | condition chain → action | conditions (AND, NOT) + action + target type + target priority + timer | target-with-condition → action | subject: condition → action (+jump) | skill + ≤2 conditions (check/filter/sort) |
| Limit | Node budget [4] | Practical only | 12 slots [34] | 2 + level slots + skill [44] | Skills known + AP/PP budget [60][63] |
| Unlock path | Campaign introduces concepts [3] | All available; presets first | Buy or find conditions; license slots [34] | Slots by level [44] | Skills and classes over campaign [63] |
| Defaults | None to start | Class behavior + stances [26][22] | Starter gambits [34] | Presets + stances [46] | Attack enemy in front; Optimize [60] |
| Feedback | Replay debugger [3][9] | Watch + combat log (inference) | Watch | Watch | Battle forecast [66] |
| Sharing | Sub-AIs, async PvP [2][4] | Exported files (forum) [30] | None | None | None |
| Mid-fight control | None | Pause + manual cast [17] | Commands + toggles [33][34] | Control one character [47] | None [65] |
| Enemy uses same system | Yes, opponents are player AIs [2] | Rebuilt AI made enemies tougher [15] | Lineage from monster AI [32] | Not established | Forecast shows enemy actions (inference) |

**Approachability vs depth.** Every successful system layers the same way: **a working default → named presets → editable rules → advanced vocabulary.**
- Deadfire and DA:O put presets on top of a full editor [15][46].
- UO adds Optimize and a sensible default [60].
- FFXII gates vocabulary behind shops and slots [34].
- Gladiabots has no preset layer and leans on its tutorial and campaign. It also has the steepest learning curve and the most complaints about debugging [3].
- Failures sit at either end: too opaque (Carnage Heart's debugging [75], DA:O's unclear conditions [46]) or too thin (Inquisition and Veilguard [54][56]).

**Defaults, presets, unlocks.** Defaults must work well enough on normal difficulty [23][60]. Presets work best as editable *starting points* rather than black boxes [46][18]. Gradual unlocks (FFXII conditions, DA:O slots, UO skills) teach vocabulary one piece at a time [34][44][63]. But making players re-buy every threshold step feels like busywork [37].

**Slot limits.** Limits make choices interesting when each slot is a real trade-off. DA:O guides stress that with so few slots, each one must justify itself [50]. UO's AP/PP budget makes order an economic decision [60]. Gladiabots' node budget does the same for structure [4]. Limits frustrate when they are artificial or hidden: experts resent how sub-AIs count against the budget [4], and paying skill points for slots feels wasted [46].

**Vocabulary.** Every system boils down to four parts: **who it's about** (self, ally, enemy, team), **a test** (threshold, status, distance, count, class, telegraph), **which one** (nearest, lowest, leader's target, most clustered), and **what to do**.
- The best-loved systems separate "which one" from "whether": Deadfire's target priority [25], UO's sort conditions [62], FFXII's leader's-target selector [35].
- Players always ask for more, and the most-requested conditions are threat-reading ones like "target is casting", immunities, and enemy HP thresholds [17][18].

**Debugging and feedback.** This is the weakest area overall.
- Only Gladiabots has a real debugger, and even it is called tedious [3].
- UO's forecast gives instant feedback, but it can remove the need to adapt [66].
- No studied game shows an **"active rule" indicator** during play. Deadfire players diagnose problems by trial and error (spam, wasted buffs, rules that never fire) [17][18].
- Our deterministic sim is a big advantage here: full decision traces cost almost nothing (inference).

**Sharing.** Gladiabots gets the most out of sharing: AIs are the multiplayer content [2]. Deadfire players share files on forums [30]. None of the single-player RPGs has built-in templates beyond presets. That's an open niche (inference).

**Editor UI patterns.**
- Ordered lists with dropdown phrases (FFXII, DA:O, UO) are the most approachable.
- Node graphs (Gladiabots, Carnage Heart) are the most expressive but scare off newcomers [3][75].
- Deadfire shows how lists break down without polish: reordering bugs and unsorted lists [18].
- Per-ability toggles (Inquisition) are the gentlest but the shallowest [53].

**Failure modes.**
- Spam [17].
- Friendly fire [18][49].
- Chasing bait [47].
- Dumb defaults that experts have to override [36].
- "Plays itself" [40].
- Overwhelming option counts [67].
- Dominant scripts [10].
- Tools that overwrite player work [67].
- Unclear semantics [61][62].

**Tactics vs stats.**
- Deadfire's defaults clear normal difficulty, and tactics matter on the hardest settings [23].
- UO's composition can decide fights, but on normal, stats and squad comp carry most of the weight [66][69].
- FFXII lets tuned gambits plus speed-up grind through stat gaps [39].
- Lesson: hard content must reward *specific* tactics (inference).

**Real-time-with-pause and overrides.** FFXII and Deadfire let the player step in at any time [33][17]. Deadfire's turn-based mode drops the AI completely [19]. DA:O turns off the controlled character's tactics [47]. UO has no mid-fight control at all [65]. DQ's history shows that forced automation with no override gets backlash [73].

**Enemy side.** FFXII's player system grew out of hidden monster AI [32]. Deadfire's rebuild was explicitly meant to make enemies smarter [15]. Gladiabots' opponents are other players' scripts [2]. For our headless sim, AI teams *must* use the same rule format (inference).

---

## 8. Recommendation sketch for our tactics editor

**Rule format** (a list per fighter, checked top-down, re-checked at each decision point; the first valid rule wins):
`[#] WHEN <condition> [AND <condition>] → <action> ON <selector> [ONLY <filter> | PREFER <sort>] [cooldown Ns / once per fight]`
- It is shown as one sentence, e.g. "When an ally is below 40% → Mend → lowest-HP ally (cooldown 6s)", in the style of FFXII and DA:O [35][45].
- **Only** = filter, so the rule is skipped if no target qualifies. **Prefer** = sort, which never blocks. Both are labeled in the UI to avoid UO's confusion [62].
- Every condition has a NOT toggle [25]. Thresholds move in 10% steps [35]. A cooldown field is visible by default [17].
- Under the list sits an unremovable **stance fallback** (Aggressive / Steady / Cautious), as in Deadfire and DA:O [22][46].

**Starter conditions (day one, 10):** Always · My HP < X% · An ally's HP < X% · An enemy is in reach · No enemy in reach · I'm surrounded by ≥ N enemies · An ally is under attack · Opening (first X s of the fight) · My focus/stamina ≥ X · I'm outnumbered (fewer of us standing).

**Advanced conditions (unlocked later, ~12):** Enemy is winding up a heavy attack (telegraph) · Enemy is a [class: caster/archer/brute/healer] · Enemy has status X / I have status X · Ally [role] is down · ≥ N enemies clustered within radius · Enemy HP < X% (execute) · Distance band (close/mid/far) · My buff X is missing · Last hit on me was melee/ranged/magic · Fight time > X s (late game) · Our captain has called a target · Arena hazard nearby.

**Starter selectors (10):** Nearest enemy · Lowest-HP enemy · Enemy attacking me · Enemy attacking our weakest ally · Captain's target (focus fire) · Furthest enemy (backline) · Densest enemy group · Lowest-HP ally · Self · Ally under most pressure.

**Advanced selectors / filters:** By class or role · Enemy not targeted by any ally (spread damage) · Highest attack · Lowest armor vs my damage type · Enemy with status X · "[Our role]'s target" (role, not name [50]) · Marked target · Last enemy to hit me · Ally without buff X · tie-break rules.

**Starter actions (10):** Basic attack · Use ability [slot] · Advance on target · Fall back / kite · Guard (block) · Protect ally (bodyguard/intercept) · Mend/support ability · Use consumable · Hold position · Taunt.

**Advanced actions:** Flank (reposition behind target) · Swap weapon set [16] · Mark target · Call focus (set the captain's target) · Interrupt · Channel/charge · Regroup on ally · Switch playbook (FFXIII-style phase change [77]) · Jump to rule group (DA:O's "jump" [45]) · Last stand.

**Slots and unlocks.**
- **Day one:** 4 rules + stance per fighter, 1 condition per rule, the starter vocabulary, and role templates. A second condition per rule opens after a few matches through the tactics coach (inference).
- **Growth:** rule slots grow **for free with fighter experience**, from 4 to 6 to 8, with no skill points spent on slots [46]. Elite or "tactician" traits raise the cap to 10–12, matching FFXII's 12 [34].
- **New vocabulary** comes from management: a tactics-coach staff member, academy courses (a fighter returns knowing "Interrupt"), scouting reports that unlock class-specific conditions against scouted teams (inference). Threshold steps come as a set, never one at a time [37].

**Templates.**
- Fighter roles: Vanguard (tank), Duelist (melee DPS), Skirmisher (ranged kiter), Mender (healer), Hexer (control), Warden (bodyguard).
- Team playbooks such as "focus the backline" or "turtle and counter".
- The **assistant-coach suggestion** offers a diff (proposed changes) to accept. It never overwrites locked rules [67].

**Readability and debugging.**
- During play, a **live rule badge** over each fighter (e.g. "R3"). The paused inspector says *why*: "R1 skipped: no ally below 40%. R2 skipped: on cooldown. R3 fired."
- **Post-match report:** fire counts per rule, rules that "never fired", and time spent on the fallback stance.
- **Deterministic replays** with a decision timeline. Click any moment to open the editor right there [8][3].
- **Lint warnings:** a rule below an "Always" rule is unreachable [34], a rule with no cooldown will spam [17], an area ability can hit allies [18], and near-opposite conditions get flagged [6].
- A **training ground** with dummies and mirror matches [2].

**Sharing.**
- Copy and paste rules or whole lists between fighters.
- A personal tactics library, plus short text codes to export and import.
- Later, Steam Workshop playbooks.
- AI managers' playbooks can be seen through scouting (inference).

**Mid-fight.** Pause to **toggle rules on or off** (FFXII-style [34]) and to **switch playbook**, but no full editing. An optional limited "timeout" count would fit the sports theme and can be simulated for AI managers (inference).

**Ideas to evaluate (inference).**
- **Discipline** stat: low-discipline fighters sometimes skip down a rule or break from focus fire. It must use the seeded RNG so replays stay deterministic, and the inspector should show "R2 ignored (discipline)" so it never feels like a bug.
- **Tactical IQ / experience** sets rule slots. Veterans hold longer lists, which gives aging a positive side.
- **Academy courses** unlock conditions, actions and traits ("Reads telegraphs").
- **AI managers with distinct styles** (aggressive focus-fire, attrition, backline-diving), built from the same templates, so players can scout and counter them.
- **Counter-scouting:** stronger scouting reveals more of an opponent's rules before a match.

---

## 9. Top ideas for our game (ranked)

1. **Layered onboarding: working default → role preset → editable sentence rules → advanced vocabulary.** Every successful game does this, and Gladiabots, which skips the preset layer, gets the most learning-curve complaints [15][46][60][3].
2. **Visible "why" feedback**: live active-rule badge, paused inspector, and per-rule fire counts. No studied RPG does this, and Gladiabots players call its debugger tedious [3][17] (Gladiabots, Deadfire).
3. **Deterministic replay with jump-to-editor** at any moment. It turns the watch–tweak loop into a quick cycle [8][1] (Gladiabots).
4. **Separate *when* (conditions), *who* (selector) and *which* (prefer/only), with explicit labels.** This is clearer than fusing them, and it avoids UO's condition confusion [25][62] (Deadfire, UO).
5. **A per-fight resource budget (focus/stamina) behind abilities.** It makes rule order a meaningful economic choice [60] (UO).
6. **A small fixed rule count that grows with fighter experience**, plus a two-condition cap. This keeps choices tight and gives a reason to develop players [44][60][34] (DA:O, UO, FFXII).
7. **Vocabulary as management progression** (coach, academy, scouting). It ties the tactics pillar to the management pillar [34][63] (FFXII, UO).
8. **Role-based references ("Vanguard's target")** instead of names, so rules survive transfers [50] (DA:O).
9. **A cooldown field and a friendly-fire filter on every rule.** These are the two most common script failures [17][18][49] (Deadfire, DA:O).
10. **An assistant-coach suggestion shown as an accept/reject diff, with rule locks.** It keeps UO's one-click convenience without overwriting the player's work [60][67] (UO).
11. **Scrimmage sandbox and mirror matches** on the deterministic sim [2] (Gladiabots).
12. **Pause to toggle rules or switch playbook**, but no full mid-fight editing. This keeps agency without micromanagement [34][77] (FFXII, FFXIII).
13. **AI teams use exactly the same rule format and templates**, with distinct manager styles. This is required for the headless sim, and it makes scouting meaningful [15][32] (Deadfire, FFXII).
14. **Copy, export and import codes, and a tactics library.** It feeds the community and cuts the chore of tuning many fighters [2][66] (Gladiabots, UO).

## 10. Pitfalls to avoid (ranked)

1. **Opaque decisions**: players can't tell why a unit acted. This is the biggest complaint across Gladiabots, Deadfire and UO [3][18][61].
2. **"Plays itself"**: fights a generic list wins on autopilot. Make hard opponents need specific tactics [40][41][66].
3. **Ambiguous semantics**: whether conditions combine in order, AND, filter or sort has to be stated in the UI. Guides contradicted each other for UO [61][62].
4. **Ordering traps**: an unconditional rule above specific ones silently disables them. Warn about unreachable rules [34].
5. **Spam and wasted resources** when there's no cooldown [17].
6. **Friendly-fire area abilities run by the AI** [18][49][50].
7. **Tools overwriting player work**, like UO's equipment-optimize resetting tactics [67].
8. **Missing threat-reading conditions** (casting, telegraphs, immunities, enemy HP). Players notice straight away and mod them in [17][18][24].
9. **Clunky list UI**: reordering jumps, unsaved edits, unsorted condition lists [18].
10. **Over-simplifying to fix complexity**: Inquisition and Veilguard alienated tactics fans [54][56][58].
11. **Forced automation with no override or recourse**: DQIV's backlash led straight to "Follow Orders" [73].
12. **A dominant script** that beats everything. Keep counters in play (class conditions, telegraphs, positioning) [10].
13. **Rules tied to names that break** on transfers or roster changes [50].
14. **Too many units to tune**: provide templates, copying and suggestions [66][67].
15. **Hidden or punishing complexity budgets**, such as sub-module counting that feels arbitrary [4].

## 11. Open questions for the designer

1. **Mid-fight control:** toggles and playbook switching only, limited timeouts, full editing at pause, or nothing? And how do AI managers use the same option in the headless sim?
2. **Rule unit:** fighter-level lists only, or also a team-level playbook (focus target, formation, phase switches)?
3. **How much do we reveal** of opponents' tactics before a match (scouting depth), and is there any UO-style forecast?
4. **Discipline:** should it exist at all? If so, how big an effect before "my rules weren't followed" feels unfair?
5. **Slot growth:** tied to experience, a stat (Tactical IQ), traits, or facilities? And is the cap 8, 10 or 12?
6. **Vocabulary gating:** should starter conditions all unlock by default, with only advanced ones tied to coach or academy, so newcomers never hit a missing basic?
7. **Sharing scope at launch:** a local library and codes only, or Workshop and asynchronous "ghost" matches later?
8. **Node graph:** should an "advanced mode" ever expose one, or do lists, rule groups and "jump to" cover expert needs?

---

## Unverified or thin points

- The exact count of Deadfire conditions and their per-class defaults. The Deadfire wiki and the main Steam guide were blocked, and details come from forum and guide snippets.
- Whether Deadfire shows which rule is active. No evidence either way was found, so the "watch + combat log" entry is inference.
- UO's tactics slot cap per character, and the official rules for how conditions combine (community analyses disagree).
- DA:O's full condition list (wiki blocked). DA2 and Inquisition details rest partly on snippets.
- Whether FFXII shows target lines or highlights the active gambit. Not verified, so not used.
- Robocode, Colobot and Ni no Kuni were not researched (search budget).

## Sources

1. Gladiabots Inception (Game Developer) — https://www.gamedeveloper.com/design/gladiabots-inception
2. GLADIABOTS on Steam — https://store.steampowered.com/app/871930/GLADIABOTS__AI_Combat_Arena/
3. Gladiabots Steam reviews (top rated) — https://steamcommunity.com/app/871930/reviews/?browsefilter=toprated
4. Steam: Multiple calls to same Sub AI increase AI size — https://steamcommunity.com/app/871930/discussions/0/1642039362988268518/
5. Steam guide: Welcome To Gladiabots (since removed) — https://steamcommunity.com/sharedfiles/filedetails/?id=1759851189
6. Steam guide: AI Writing Techniques (Gladiabots) — https://steamcommunity.com/sharedfiles/filedetails/?id=2154546931
7. Steam: GFX47 on Carnage Heart as reference — https://steamcommunity.com/app/871930/discussions/0/1729828401713410502
8. Gladiabots Alpha 13 devlog — https://gfx47.itch.io/gladiabots/devlog/34211/gladiabots-alpha-13-is-live
9. Gladiabots Alpha 12 devlog — https://gfx47.itch.io/gladiabots/devlog/23193/get-gladiabots-alpha-12-now
10. Gaming Respawn: Gladiabots review — https://gamingrespawn.com/reviews/34358/gladiabots-review/
11. Pocket Gamer: Gladiabots combines bot combat and programming puzzles — https://www.pocketgamer.com/gladiabots/gladiabots-combines-tactical-bot-combat-and-programming-puzzles/
12. Gladiabots Wiki: Advanced (snippet) — https://wiki.gladiabots.com/index.php?title=Advanced
13. RAWG: Gladiabots (snippet) — https://rawg.io/games/gladiabots
14. GamingOnLinux: Gladiabots leaves Early Access (snippet) — https://www.gamingonlinux.com/2019/05/create-your-ai-pick-your-robots-and-prepare-for-battle-as-gladiabots-has-left-early-access/page=1/
15. PCGamesN: Pillars of Eternity II's programmable AI — https://www.pcgamesn.com/pillars-of-eternity-2-deadfire/pillars-of-eternity-ii-companions-custom-ai
16. Obsidian: Deadfire Update 49 – Patch 1.1 — https://eternity.obsidian.net/news/pillars-of-eternity-ii-deadfire-update-49---patch-11
17. Steam: Deadfire AI Behaviors for Beginners — https://steamcommunity.com/app/560130/discussions/0/1693795812309628406
18. Steam: Deadfire AI Script Behavior improvements — https://steamcommunity.com/app/560130/discussions/0/1696048245844756614/
19. Steam: Deadfire AI in turn-based mode — https://steamcommunity.com/app/560130/discussions/0/1636418037473132574
20. Steam: Deadfire behaviour editor thread — https://steamcommunity.com/app/560130/discussions/0/2828702372991341122
21. GameBanshee: Deadfire previews (ship combat, AI) — http://www.gamebanshee.com/k4w3p
22. Gry-Online: Deadfire party AI guide (Polish) — https://www.gry-online.pl/poradniki/pillars-of-eternity-2-deadfire/sztuczna-inteligencja-ai-druzyny/zc17866
23. RPG Site: Deadfire review — https://rpgsite.net/review/7139-pillars-of-eternity-ii-deadfire-review
24. Nexus Mods: More Custom AI Conditions (snippet) — https://www.nexusmods.com/pillarsofeternity2/mods/88?tab=posts
25. Steam guide: AI Behavior – understanding how it works (snippet) — https://steamcommunity.com/sharedfiles/filedetails/?id=1392162466
26. Twinfinite: Deadfire abilities and AI guide (snippet) — https://twinfinite.net/guides/pillars-of-eternity-2-deadfire-how-to-use-abilities-and-spells/
27. PC Gamer: Pillars of Eternity update 2.0 adds party AI — https://www.pcgamer.com/uk/pillars-of-eternity-update-20-adds-party-ai-solo-stealth
28. Josh Sawyer Q&A on Deadfire AI (snippet) — https://jesawyer.tumblr.com/post/166755373641/hey-josh-really-looking-forward-to-deadfire-i
29. GameBanshee: PoE patch 2.3 changelog (snippet) — https://gamebanshee.com/k9f4k
30. Obsidian Forums: Let's share tips on the party AI system (snippet) — https://forums.obsidian.net/topic/99663-lets-share-tips-on-the-party-ai-system/
31. Cog Connected: Deadfire review (snippet) — https://cogconnected.com/review/pillars-eternity-ii-deadfire-review/
32. PlayStation Blog: How FFXII's Gambit created a distinct RPG — https://blog.playstation.com/?p=192698
32b. DSOGaming: Deadfire patch 4.1.0 adds turn-based mode (snippet) — https://www.dsogaming.com/news/pillars-of-eternity-2-patch-4-1-0-available-adds-turn-based-mode-optimizes-performance-and-more/
33. Wikipedia: Final Fantasy XII — https://en.wikipedia.org/wiki/Final_Fantasy_XII
34. Gamer Guides: FFXII battle system — https://gamerguides.com/final-fantasy-xii/guide/basics/gameplay-mechanics/battle-system
35. Jegged: FFXII Gambits — https://jegged.com/Games/Final-Fantasy-XII/Gambits/
36. RPG Site: Final Fantasy XII review — https://www.rpgsite.net/review/2789-final-fantasy-xii-review
37. FFXII and the Illusion of Free Will (essay) — https://publish.obsidian.md/taniynquest/Final+Fantasy+XII+and+the+Illusion+of+Free+Will
38. GamesBeat: FFXII The Zodiac Age review — https://gamesbeat.com/?p=142695
39. Player2: FFXII The Zodiac Age review — https://www.player2.net.au/2017/07/final-fantasy-xii-the-zodiac-age-review/
40. Giant Bomb user review: FFXII (snippet) — https://www.giantbomb.com/final-fantasy-xii/3030-11497/user-reviews/2200-3319/
41. GamesRadar: Final Fantasy XII review p.2 (snippet) — https://gamesradar.com/final-fantasy-xii-review/2
42. StrategyWiki: FFXII Gambits (snippet) — https://strategywiki.org/wiki/Final_Fantasy_XII/Gambits
43. RPGamer: FFXII review (snippet) — https://archive.rpgamer.com/games/ff/ff12/reviews/ff12rdrev1.html
44. Dragon Age Wiki: Combat Tactics (snippet) — https://dragonage.fandom.com/wiki/Combat_Tactics
45. Dragon Age Wiki: Tactics (Origins) (snippet) — https://dragonage.fandom.com/wiki/Tactics_(Origins)
46. Steam: DA:O tactics thread — https://steamcommunity.com/app/47810/discussions/0/2579854400736575780/
47. Steam: DA:O tactics advice thread — https://steamcommunity.com/app/47810/discussions/0/1319961868324922289
48. Steam: DA:O weapon-switch tactics thread — https://steamcommunity.com/app/47810/discussions/0/1319962173910529955
49. Sorcerers.net: Dragon Age scripting — https://sorcerers.net/Games/DragonAge/Walkthrough/getting-started/scripting.php
50. LiveJournal: Tactics – Origins Revisited — https://dragon-age.livejournal.com/348046.html
51. Matt Gadient: Dragon Age 2 review (snippet) — https://mattgadient.com/dragon-age-2-review-a-worthy-successor-to-the-original-things-that-could-use-improvement/
52. GamesBeat: DA:Inquisition harmonizes real-time and tactical (snippet) — https://gamesbeat.com/bioware-finally-harmonizes-real-time-and-tactical-combat-in-dragon-age-inquisition-preview/
53. Giant Bomb forums: Inquisition hints and tips (snippet) — https://www.giantbomb.com/forums/dragon-age-inquisition-7175/inquisition-hints-tips-tricks-1500141/
54. Steam: DA:Inquisition discussion (snippet) — https://steamcommunity.com/app/1222690/discussions/0/598512477964095800
55. PlayStation LifeStyle: Veilguard companion control "detrimental" — https://www.playstationlifestyle.net/2024/08/09/dragon-age-the-veilguard-companions-controlled-detrimental/
56. Seasoned Gaming: Veilguard review — https://seasonedgaming.com/2024/11/20/review-dragon-age-the-veilguard-less-chatting-more-clashing/
57. Galaxus: Veilguard tested (snippet) — https://www.galaxus.ch/en/page/dragon-age-the-veilguard-tested-for-those-who-find-baldurs-gate-3-too-complicated-35357
58. Steam: Veilguard discussion (snippet) — https://steamcommunity.com/app/1845910/discussions/0/4635985982183765729
59. Prima: DA:O combat basics (snippet) — https://primagames.com/eguides/dragon-age-origins-eguide/essentials/basics/combat
60. RPG Site: Unicorn Overlord tactics, priority, battle stages — https://www.rpgsite.net/news/15481-unicorn-overlord-highlights-tactics-priority-and-battle-stages-along-with-several-new-non-human-allies
61. Prima Games: Unicorn Overlord tactics and conditions explained (snippet) — https://primagames.com/gaming/unicorn-overlord-tactics-and-conditions-explained
62. ResetEra: Unicorn Overlord OT, page 10 — https://www.resetera.com/threads/unicorn-overlord-ot-ogre-battle-24-the-queens-gambit.824595/page-10
63. Nameless Quality: The Unicorn Overlord Tactics System — https://namelessquality.com/the-unicorn-overlord-tactics-system/
64. Destructoid: Unicorn Overlord review — https://www.destructoid.com/reviews/review-unicorn-overlord/
65. Game Informer: Unicorn Overlord review — https://gameinformer.com/review/unicorn-overlord/tactical-superiority
66. FullCleared: Unicorn Overlord review — https://fullcleared.com/reviews/unicorn-overlord-review/
67. GamingTrend: Unicorn Overlord review — https://gamingtrend.com/unicorn-overlord-review-for-king-and-country/
68. Inverse: Unicorn Overlord interview — https://www.inverse.com/gaming/unicorn-overlord-interview-vanillaware
69. OneMoreGame: Vanillaware interview — https://onemoregame.ph/2024/04/vanillaware-interview-unicorn-overlord/
70. GameFAQs: Does the number of the condition make a difference? (snippet) — https://gamefaqs.gamespot.com/boards/426397-unicorn-overlord/80757827
71. GameFAQs: Questions about the conditions of tactics (snippet) — https://gamefaqs.gamespot.com/boards/426397-unicorn-overlord/80722033
72. Zatu: Unicorn Overlord review (snippet) — https://zatu.com/blogs/reviews/unicorn-overload-review
UO-wiki. Wikipedia: Unicorn Overlord (snippet) — https://en.wikipedia.org/wiki/Unicorn_Overlord
73. Dragon Quest Wiki: Artificial Intelligence — https://dragon-quest.org/wiki/Artificial_Intelligence
74. Boss Rush: Dragon Quest's tactics system — https://bossrush.net/2026/02/19/boss-rush-banter-dragon-quests-tactics-system-is-the-secret-to-grander-immersion-and-faster-combat
75. Wikipedia: Carnage Heart (snippet) — https://en.wikipedia.org/wiki/Carnage_Heart
76. Screeps World on Steam (snippet) — https://store.steampowered.com/app/464350/Screeps_World
77. Jegged: FFXIII Paradigm explanation (snippet) — https://jegged.com/Games/Final-Fantasy-XIII/Paradigms/Paradigm-Explanation.html
78. GamesRadar: Final Fantasy XIII interview (snippet) — https://gamesradar.com/final-fantasy-xiii-interview/2
79. Megami Tensei Wiki: Tactics (snippet) — https://megatenwiki.com/wiki/Tactics
80. Beamdog forums: Infinity Engine AI scripting (snippet) — https://forums.beamdog.com/discussion/comment/867341
81. Wikipedia: Ogre Battle: The March of the Black Queen (snippet) — https://en.wikipedia.org/wiki/Ogre_Battle:_The_March_of_the_Black_Queen
82. PC Gamer: 11 things to know before Dragon Quest 11 (snippet) — https://www.pcgamer.com/uk/11-things-i-wish-id-known-before-starting-dragon-quest-11
83. ActuGaming: No Plan B interview with GFX47 (snippet) — https://www.actugaming.net/no-plan-b-interview-agfd-443201
84. TouchArcade: Gladiabots coverage (snippet) — https://toucharcade.com/?p=261636
85. Obsidian Forums: Working companion AI (snippet) — https://forums.obsidian.net/topic/132693-working-companion-ai/

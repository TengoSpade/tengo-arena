# Research notes 06: Traits and captains

**Scope.** These notes answer two owner requirements added after notes 01–05. First, fighters get **randomized traits, roughly 80% positive and 20% negative**, in the style of Crusader Kings. Second, **every team has a captain**, and a fighter's stats, traits and skills make him a good or bad one. Part A studies the trait systems of Crusader Kings II and III, the named style reference. Part B studies randomized positive and negative traits in roster games: Darkest Dungeon, Battle Brothers, RimWorld, XCOM 2: War of the Chosen, Wildermyth, Football Manager and Blood Bowl. Part C studies captaincy and leadership in Football Manager, Hattrick, Madden, NBA 2K and Blood Bowl, in commanders and generals (Crusader Kings, Total War, Battle Brothers, Bannerlord), and in the esports in-game leader. We take mechanics and style lessons only. No trait names, text or icons from these games are proposed for reuse, and every example name for our game is original.

**Conventions.** Research was done on 25 Oct 2026. **(inference)** marks my own reasoning. **(snippet)** marks a claim that rests only on a search-result summary of a page I could not open. Section codes such as C1.5 or C3.7 refer to [research.md](../research.md).

**Access.** Paradox's forums returned a browser-validation page. Steam's CK3 review and discussion pages sit behind a mature-content gate. Fandom wikis returned HTTP 402. PC Gamer pages came back truncated. hattrick.org's help pages, Sortitoutsi and Raider King returned 403. Claims from those sites are marked (snippet).

---

## A. Crusader Kings II and III

### A1. How CK3 builds a character's traits (wiki, PC 1.20)

- **Categories.** CK3's wiki lists about fifteen trait groups. The ones that matter here are personality, education, congenital, leveled (commander), lifestyle, coping and health ([CK3 Wiki: Traits](https://ck3.paradoxwikis.com/Traits)).
- **Personality: few, early, sticky.** Characters "tend not to have more than 3" personality traits. Children get personality events at ages 9, 11 and 13; a player-controlled child picks from three options. A guardian can accept the result or change it at a stress cost. Children lean toward their guardian's traits and away from the guardian's opposites. Afterwards personality is hard to change, mostly through mental breaks at stress level 2 or higher ([Traits](https://ck3.paradoxwikis.com/Traits)).
- **Opposites and exclusions.** Each personality trait has one or two opposites. A character cannot hold two opposed traits, or three mutually exclusive ones ([Traits](https://ck3.paradoxwikis.com/Traits)).
- **Most personality traits cut both ways.** Ambitious gives +1 to every skill but −15 opinion of one's liege. Generous gives +3 Diplomacy but −10% income. Honest gives +2 Diplomacy and −4 Intrigue. Lazy costs −1 in five skills but gives +50% stress loss. Diligent gives +3 Stewardship and +3 Learning but −50% stress loss ([Traits](https://ck3.paradoxwikis.com/Traits)).
- **Every trait also steers the AI.** Each trait carries AI personality weights: Brave gives +200 boldness, Craven −200 boldness, Calm +75 rationality, and Ambitious +75 energy and +75 greed ([Traits](https://ck3.paradoxwikis.com/Traits)). The Ruler Designer prices traits in points (Brave +40, Calm +25, Craven −10). The wiki does not define the sign, but it reads as an implicit value scale, with negative costs for net-bad traits (inference).
- **Congenital traits come in tiers.** Appearance, intelligence and physique each have three positive and three negative tiers. They appear rarely at birth and are inherited. When both parents share a leveled trait, there is a 50% chance the child's tier moves up or down. Inbreeding brings heavy penalties ([Traits](https://ck3.paradoxwikis.com/Traits)).
- **Education and lifestyle.** Each adult gets one tiered education trait from their childhood focus. Lifestyle perk trees grant lifestyle traits, and leveled traits add bonuses per level ([Traits](https://ck3.paradoxwikis.com/Traits)).
- **Coping traits.** These are gained after a mental break. They reduce stress, usually have drawbacks, and a character can hold at most two ([Traits](https://ck3.paradoxwikis.com/Traits)). Each gives +20% stress loss and unlocks a stress-relief decision on a three-year cooldown ([CK3 Wiki: Stress](https://ck3.paradoxwikis.com/Stress)).

### A2. Commander traits as a leadership model

- **CK3.** Commander traits have four levels. Level 2 doubles the bonus; level 3 triples it and adds +1 Advantage; level 4 quadruples it and adds +2 Advantage and +1 Martial. They are earned mainly by winning battles in the matching condition. Aggressive Attacker, for example, gains 1 + Martial/10 experience per victory as attacker. A guardian can also teach one trait to a ward every five years ([Traits](https://ck3.paradoxwikis.com/Traits)).
- **Variance as a trait.** Cautious Leader raises the minimum battle roll by 2 and lowers the maximum by 1. Reckless lowers the minimum by 2 and raises the maximum by 3 ([Traits](https://ck3.paradoxwikis.com/Traits)). These are named trade-offs on variance, not on power (inference).
- **CK2 (v3.3).** Leadership traits came from events after a battle the character led. Examples were Aggressive Leader (+10% damage, −10% defence), Defender, Inspiring Leader (+15% morale damage and defence) and Siege Leader ([CK2 Wiki: Traits](https://ck2.paradoxwikis.com/Traits)).

### A3. Opinions and compatibility (a model for team chemistry)

- **CK3.** Shared and opposed personality traits add or subtract fixed opinion: Brave gives +10 for a shared trait and −10 for its opposite; Craven and Content give +20 for a shared trait; several traits give −15 toward their opposite. **Ambitious gives −15 toward other Ambitious characters**, so two climbers dislike each other ([Traits](https://ck3.paradoxwikis.com/Traits)). Similar traits make befriending and romance easier, and opposites make them harder ([Traits](https://ck3.paradoxwikis.com/Traits)).
- **Relations with teeth.** A friend gives +60 opinion and +20% council efficiency; a rival gives −60 and −20%. A friend's death adds stress, and a rival's death removes it. AI characters with high compassion make friends more easily, and vengeful ones pursue rivals ([CK3 Wiki: Relations](https://ck3.paradoxwikis.com/Relations)).
- **CK2** used smaller values, typically +5 for a shared trait and −5 for an opposite, plus faith reactions to virtues and sins ([CK2 Wiki](https://ck2.paradoxwikis.com/Traits)).

### A4. Traits as behaviour: AI and stress

- **AI reads its own traits.** Dev Diary #104 (2022) grouped AI rulers into warlike, cautious, builder and unpredictable spending archetypes, based on boldness and traits. Traits also shaped tyranny tolerance and whether a ruler joins holy wars. The stated goal was that a player could roughly predict an AI's plans from its traits. The developers admitted that before this update personality often did not matter, for example when revoking titles ([DD #104 via devtrackers](https://devtrackers.gg/crusader-kings/p/059cf6b8-dev-diary-104-ai-ai-ai)).
- **Stress makes the player act in character without taking control.** Stress mostly builds when duties push a ruler to act against their nature (snippet) ([Dev Diary #31](https://forum.paradoxplaza.com/forum/threads/ck3-dev-diary-31-a-stressful-situation.1399764/page-7)); for example, Compassionate characters are stressed by executions ([Stress](https://ck3.paradoxwikis.com/Stress)). Stress runs from 0 to 400, with a mental break the first time it crosses 100, 200 or 300. Higher levels cost fertility and health, and level 3 can lead to death or abdication. At a break the player chooses: shed stress and take a coping trait or a worse trait, or take on more stress. Breaks happen at most once every five years, and only your own character's stress is visible ([Stress](https://ck3.paradoxwikis.com/Stress)).
- **The lesson for gambits.** The player stays free to act against a character's nature but pays a visible, deferred price, which turns personality into a cost rather than a loss of control (inference). This fits C3.7's rule that fighters do not skip their rules.

### A5. Presentation

- **Readable at a glance.** The CK3 team capped personality at about three traits so a character can be read at a glance, and contrasted this with CK2, where characters piled up traits that did little (snippet) ([Dev Diary #07](https://forum.paradoxplaza.com/forum/threads/ck3-dev-diary-07-characters-portraits.1295264/), [GamingOnLinux](https://www.gamingonlinux.com/articles/15647/)). CK2 itself let adults with fewer than five personality traits gain more, and randomly stripped them from rulers holding six or more ([CK2 Wiki](https://ck2.paradoxwikis.com/Traits)). The same diary reportedly added a two-word personality summary (snippet) ([Dev Diary #07](https://forum.paradoxplaza.com/forum/threads/ck3-dev-diary-07-characters-portraits.1295264/)).
- **Each trait is an icon, a name, a one-line flavour description and a list of numbers** ([Traits](https://ck3.paradoxwikis.com/Traits)). Paradox's EU5 team said they based their tooltips on the nested tooltips first used in CK3 (snippet) ([Tinto Talks 77](https://admin-forum.paradoxplaza.com/forum/developer-diary/tinto-talks-77-20th-of-august-2025.1856053)).

### A6. Emergent stories, what players love and what they complain about

1. **Compelling:** Vaporlens' aggregate ranks the stress system, emergent stories (a bride dies at her wedding and the groom dies of grief) and deep, personality-driven roleplay among CK3's top likes ([Vaporlens](https://vaporlens.app/app/1158310/crusader_kings_iii.md)). Reviewers praise how each trait traces back to a formative event, which gives characters a history (snippet) ([PC Gamer](https://pcgamer.com/crusader-kings-3-review)).
2. **Good practices:** a small personality budget, with opposites; two-sided traits; each trait doing triple duty as stats, opinion and AI behaviour; a stress price for acting out of character; traits earned through play.
3. **Loved:** varied rulers and builds, plus stress-driven roleplay ([Vaporlens](https://vaporlens.app/app/1158310/crusader_kings_iii.md)). GamingOnLinux found that stress gives useful feedback for the ruler you want to play ([GamingOnLinux](https://www.gamingonlinux.com/2020/09/crusader-kings-iii-is-now-out-some-thoughts-on-the-medieval-mayhem/page=1/)).
4. **Complaints:**
   - Repetitive late games and unreliable AI ([Vaporlens](https://vaporlens.app/app/1158310/crusader_kings_iii.md)).
   - Stress's serious effects are usually easy to avoid ([GamingOnLinux](https://www.gamingonlinux.com/2020/09/crusader-kings-iii-is-now-out-some-thoughts-on-the-medieval-mayhem/page=1/)).
   - Players say Shy and Compassionate rulers are stressed by almost everything, so they cherry-pick heirs, and that trait rolls sometimes ignore upbringing (snippet) ([Steam](https://steamcommunity.com/app/1158310/discussions/0/3186865924607270710)).
   - Optimising heirs for genetic traits becomes a eugenics meta, and a critic objected to how disability traits are framed (snippet) ([GlitchOut](https://glitchout.blog/2020/09/28/crusader-kings-3-eugenics-at-play/)).
5. **Ideas for us:** top ideas 1–5 and 10 below.

---

## B. Randomized positive and negative traits in roster games

### B1. Darkest Dungeon (quirks, virtues and afflictions; DD1)

- **How it works.** A hero holds up to **5 positive and 5 negative quirks**; a new one replaces a random unlocked one. Recruits always start with at least one of each. After an expedition, each survivor rolls for new quirks; on a success the positive chance is 50 − 0.1 × stress and the negative 30 + 0.2 × stress. Each negative quirk has a 25% chance per mission to lock in. The Sanitarium removes one negative quirk and locks one positive quirk per week, at most three locked positives, with costs that scale with hero level. Some quirks force curio interactions, such as a compulsion to touch treasure ([DD Wiki: Quirks](https://darkestdungeon.wiki.gg/wiki/Quirks)). At 100 stress a hero gets a virtue at a **base 25% chance**; otherwise an affliction ([DD Wiki: Virtue](https://darkestdungeon.wiki.gg/wiki/Virtue)).
1. **Compelling:** heroes become individuals with baggage, and the designer framed it as everyone having good and bad parts (snippet) ([PlayStation Blog](https://blog.eu.playstation.com/2014/12/06/old-school-rpg-darkest-dungeon-unveiled-ps4-ps-vita/)).
2. **Good practices:** many quirks mirror each other (a bonus against one enemy family paired with a fear of it, a dodge bonus paired with a dodge malus) ([Quirks](https://darkestdungeon.wiki.gg/wiki/Quirks)); negative quirks lock in if left untreated, which creates time pressure; treatment is a weekly slot, not instant.
3. **Loved:** choices feel weighty even when control slips (snippet) ([God is a Geek](https://godisageek.com/reviews/darkest-dungeon-review/)).
4. **Complaints:** afflicted heroes act on their own, which some players feel as total loss of control (snippet) ([God is a Geek](https://godisageek.com/reviews/darkest-dungeon-review/)); cleaning up one heavily quirked hero reportedly took seven in-game weeks and more gold than one critic had ever earned (snippet) ([PC Gamer](https://www.pcgamer.com/au/darkest-dungeon-impressions-a-maddening-game-to-love)).
5. **For us:** mirrored pairs; treatment as an academy slot with a visible queue; a chance for an untreated flaw to set in; never let a trait take a fighter's actions away (C3.7).

### B2. Battle Brothers (backgrounds, traits and the try-out)

- **How it works.** There are about 50 backgrounds, each with flavour text and rolled stat ranges. Backgrounds weight which traits appear, so a deserter is likelier to be Craven than a wildman. Brave adds resolve; Dumb slows experience gain. Talents show as 1–3 stars per attribute ([Keen Gamer](https://www.keengamer.com/articles/reviews/battle-brothers-review/)). A player's tally found recruits with zero, one or two traits. Fat gives +10 HP but −10 fatigue, and Greedy raises upkeep. Opposite traits such as Iron Lungs and Asthmatic reportedly never appear together ([Steam thread, Nov 2017](https://steamcommunity.com/app/365360/discussions/0/1489992080508052323)). Paying a small try-out fee reveals all of a recruit's traits before hiring (snippet) ([Raider King](https://raiderking.com/?p=1330)), and try-out cost is a per-background value (snippet) ([Nexus Mods](https://nexusmods.com/battlebrothers/articles/56)).
1. **Compelling:** every recruit is a gamble whose odds you can partly read from the background ([Keen Gamer](https://www.keengamer.com/articles/reviews/battle-brothers-review/)).
2. **Good practices:** backgrounds bias trait odds, so traits fit the character; a cheap, explicit reveal before commitment; traits stated in plain numbers.
3. **Loved:** finding a cheap recruit with good traits beats paying for an expensive one ([Steam thread](https://steamcommunity.com/app/365360/discussions/0/1489992080508052323)).
4. **Complaints:** a guide advises never hiring a brother with an F-tier trait, which means the worst negatives just get filtered out (snippet) ([Raider King](https://raiderking.com/?p=1330)).
5. **For us:** a try-out day as one scouting reveal step; background (homeland, former trade) weights trait odds; price reflects traits.

### B3. RimWorld

- **How it works (v1.6).** Most adults have 1–3 traits, plus an optional sexuality trait. Traits are picked by weighted commonality after any required by backstory. Spectrum traits hold one degree per axis (for example work speed from −35% to +35%, or a base-mood scale). Explicit exclusion pairs exist (Tough vs Delicate, Kind vs Abrasive). Pure negatives sit beside trade-offs: Brawler gives +4 melee but hurts shooting and mood when holding a gun; Pyromaniac brings fire sprees roughly every 50 days. Adults cannot gain traits, and the wiki says there is no way to remove one, apart from DLC genes ([RimWorld Wiki: Traits](https://rimworldwiki.com/wiki/Traits)). The store page sells the game as a story generator ([Steam](https://store.steampowered.com/app/294100/RimWorld/)).
1. **Compelling:** traits drive social events, such as an Abrasive pawn insulting others 2.3× as often, and beauty adds or subtracts about ±20 opinion per step ([Traits](https://rimworldwiki.com/wiki/Traits)).
2. **Good practices:** spectrum degrees instead of separate traits; exclusion groups; commonality weights.
3. **Loved:** 97% positive of ~120k reviews ([Steam](https://store.steampowered.com/app/294100/RimWorld/)).
4. **Complaints:** players reroll starting colonists until bad traits are gone, and Pyromaniac is the classic deal-breaker (snippet) ([RimWorld Wiki: Basics](https://www.rimworldwiki.com/wiki/Basics)).
5. **For us:** spectrum degrees; exclusion groups; no free reroll at the start, but negatives that are survivable.

### B4. XCOM 2: War of the Chosen (bonds and negative traits)

- **How it works (2017).** Every pair of soldiers has a compatibility value that sets how likely they are to bond on missions together. Rescuing a downed squadmate, or losing more than half the squad, spikes it. Bonds are exclusive, and a survivor whose bondmate dies may rage. Repeated deployments without rest lower Will, which can create negative traits such as fear of an enemy type or a nervous reloading habit. The infirmary cures them ([GameBanshee](https://www.gamebanshee.com/kdd8x)). Negative traits trigger by chance (snippet) ([XCOM Wiki](https://xcom.fandom.com/wiki/Negative_Traits)).
1. **Compelling:** squad rotation becomes a real choice and the roster stays even ([GameBanshee](https://www.gamebanshee.com/kdd8x)).
2. **Good practices:** negatives come from a cause the player controls (overwork); positives (bonds) come from shared history; cures are a facility slot.
3. **Loved / 4. Complaints:** not researched in depth.
5. **For us:** pair bonds that grow from shared fights; overwork strain that can create a treatable flaw; bond levels that need academy time to deepen.

### B5. Wildermyth (personality stats and relationships)

- **How it works.** Heroes have eleven personality stats, including Leader, Hothead, Coward and Loner. Events "call out" the hero with the highest (or lowest) value for a role, so the party's Leader is whoever scores highest ([Wildermyth Wiki: Stat](https://wildermyth.com/wiki/Stat)). Compatibility counts a hero's stats of 50+: compatible ones add 1 and incompatible ones subtract 1. A score of +4 or more tends toward romance, −2 or less toward rivalry, and Charisma speeds up relationship gains. Relationships have five levels with growing combat bonuses: friends get more block when adjacent, lovers get damage against whoever attacks their partner, and rivals get stunt bonuses ([Relationship](https://wildermyth.com/wiki/Relationship)).
1. **Compelling:** the same numbers drive both the story text and small, readable combat bonuses.
2. **Good practices:** "leader" is relative to the current party, not an absolute rank; a simple, explainable compatibility score.
3. **Loved / 4. Complaints:** not researched.
5. **For us:** event and recap text that calls out the fighter with the strongest trait; a compatibility score per pair with named levels.

### B6. Football Manager (hidden personality and player traits)

- **Personality.** Visible Determination and Leadership combine with seven hidden attributes (ambition, controversy, loyalty, pressure, professionalism, sportsmanship, temperament) into labels such as Model Professional. Personality is revealed through reports, social groups and behaviour. It affects training and how receptive a player is to tutoring ([FM Scout, 2022](https://www.fmscout.com/a-guide-to-player-personalities-football-manager.html)).
- **Player traits (PPMs).** These are learned on-pitch habits, not extra ability. A coach can teach or remove them, with suitability shown in advance, and unlearning one to learn its opposite can take a full season. Some can only be passed on by mentoring. Whether a trait helps depends on the tactic: Shoots From Distance gives a long-range threat but wastes chances if too many players have it ([Passion4FM, FM25](https://www.passion4fm.com/football-manager-player-traits/)).
- **Tutoring (2012-era rules).** Tutoring moves personality attributes and passes on traits. Learners are 22 or younger, the tutor needs higher squad status, and a player under 23 may tutor if he is captain ([FM Scout](https://www.fmscout.com/a-youth-development-on-football-manager-tutoring-guide.html)).
- **For us:** a "craft" trait class taught by the academy, with suitability shown up front; temperament nudged by mentors before a fighter's prime; tactic-fit trade-offs instead of pure good or bad.

### B7. Blood Bowl (skills and big-guy drawbacks)

- **How it works.** Players earn Star Player Points and level up at 6, 16, 31, 51, 76 and 176. Each level grants an improvement roll whose result gives a skill or a stat. New skills come only from the categories a player has access to, and skills are never removed ([Living Rulebook](https://rulespal.com/blood-bowl-living-rulebook/rulebook)).
- **Drawbacks on the strongest players.** Really Stupid makes a big guy pass a roll before cooperating, and Loner makes team rerolls need a 3+ ([LP Archive](https://lparchive.org/Blood-Bowl-(by-GNU-Order)/Update%2004/)). Bone Head idles an Ogre on roughly one action in six, the price of being among the strongest players on the pitch (snippet) ([Ogre playbook](https://pdfcoffee.com/ogre-playbook-pdf-free.html)).
- **For us:** put the sharpest negatives on the highest-ceiling fighters, as a deliberate price for power.

### B8. Cross-cutting lessons for traits

- **Ratio.** No researched game publishes a ratio. DD1 is the useful anchor: a 25% virtue chance leaves 75% for afflictions ([Virtue](https://darkestdungeon.wiki.gg/wiki/Virtue)), and every recruit arrives with at least one positive and one negative quirk ([Quirks](https://darkestdungeon.wiki.gg/wiki/Quirks)). That reads as deliberately grim. The owner's 80/20 is far kinder, which suits a sports fantasy where fighters are assets (inference).
- **Readability.** About three traits (CK3), 1–3 traits (RimWorld), 0–2 traits (Battle Brothers) ([Traits](https://ck3.paradoxwikis.com/Traits), [RimWorld](https://rimworldwiki.com/wiki/Traits), [Steam](https://steamcommunity.com/app/365360/discussions/0/1489992080508052323)). DD's ten slots are the outlier.
- **Feel-bad versus trade-off.** Pure flaws get filtered out (RimWorld rerolls, Battle Brothers' "never hire F-tier") (snippet) ([Basics](https://www.rimworldwiki.com/wiki/Basics), [Raider King](https://raiderking.com/?p=1330)). Two-sided traits (CK3 personality, RimWorld's Brawler, FM's PPMs, Blood Bowl's big guys) create build choices.
- **Reveal.** Battle Brothers' paid try-out (snippet) ([Raider King](https://raiderking.com/?p=1330)) and FM's reports and behaviour ([FM Scout](https://www.fmscout.com/a-guide-to-player-personalities-football-manager.html)).
- **Training.** Learned habits can be taught and removed (FM); flaws are cured in facilities (DD, XCOM); innate traits are fixed (RimWorld, CK3 congenital).

---

## C. Captaincy and leadership

### C1. Football Manager

- **How it works.** Leadership is the main attribute when choosing a captain (snippet) ([FM Scout FM23 hints](https://www.fmscout.com/a-football-manager-2023-hints-and-tips.html?pg=1)). The dynamics hierarchy runs Team Leaders → Highly Influential → Influential → Other. Captain and vice-captain usually sit among the Team Leaders, who tend to be older, long-serving players with strong personalities (snippet) ([FM23 Dynamics](https://footballmanager.com/node/722)). FM's own tips page warns that changing captain can upset both the squad and the outgoing captain, so talk to him first (snippet) ([footballmanager.com](https://footballmanager.com/node/129)). Unhappy leaders spread discontent down the pyramid, and regular chats with the captain surface dressing-room problems ([The Set Pieces, FM18](https://thesetpieces.com/?p=19246)). Leadership-based personality labels include Born Leader ([FM Scout](https://www.fmscout.com/a-guide-to-player-personalities-football-manager.html)).
1. **Compelling:** the captain is a social lever: he relays mood, anchors the hierarchy, and choosing him is a political act.
2. **Good practices:** a readable pyramid; captain as an informant; costs for appointing or stripping.
3. **Loved:** dynamics feed the match engine through relationships ([Game Informer](https://gameinformer.com/b/features/archive/2017/11/06/the-sports-desk-inside-the-dynamics-of-football-manager-2018)).
4. **Complaints:** one FM18 reviewer saw no difference from the hierarchy (snippet) ([Trusted Reviews](https://www.trustedreviews.com/reviews/football-manager-2018)). An FM Mobile 2017 test swapped four Leadership-20 captains over 50 games each. Team ratings stayed within about 1%, which one reply put inside the margin of error, but each captain rated higher when wearing the armband ([FMM Vibe, Dec 2016](https://fmmvibe.com/forums/topic/38819-battle-of-captains/)).
5. **For us:** captaincy must show on screen, or players will conclude it is cosmetic.

### C2. Hattrick

- **How it works (old community claims).** 2003–05 forum posts say the captain's experience and leadership feed the team experience rating more than any other player's. Team experience lowers the chance of confusion with an unfamiliar formation and steadies nervy big matches; no poster knew the weighting, and an "experience counts double" rule was hearsay (snippet) ([FOFC archive](https://forums.operationsports.com/fofc/archive/index.php/.../a%3E/t-25284.html)). A youth-club tool marks players with high leadership with an armband icon ([Youthclub wiki](https://wiki.hattrick-youthclub.org/players)). **No formula is cited here, because none was sourced.**
- **For us:** the captain as a dampener of disorder, not a damage buff; leadership shown as a word tier.

### C3. Madden

- Madden 12 gave each player up to two of 20 automatic roles, good or bad, with some off-field (a mentor helps young players) ([Game Informer, 2011](https://gameinformer.com/games/madden_nfl_12/b/ps3/archive/2011/05/16/how-deep-is-madden-39-s-depth-chart-of-franchise-amp-superstar-features.aspx)). Modern tags include Mentor, which gives same-position teammates weekly XP ([Destructoid](https://www.destructoid.com/all-player-tags-and-motivations-in-madden-25-franchise-mode/)). In Madden 27's persona engine, a captain can turn from foundation to distraction within days after a bad negotiation, and locker-room drama can be delegated ([Sun-Times](https://chicago.suntimes.com/nfl/2026/08/21/madden-27-review-curses-bears-and-caleb-williams-better-not-hope-so)). One review found morale stuck near 50% whatever happened (snippet) ([RealSport101](https://realsport101.com/article/madden-27-review-a-step-forward-for-franchise-mode-but-gameplay-still-fumbles)). I found no mechanical franchise captain; Madden's "Team Captain" is mainly an Ultimate Team card (snippet) ([MUT.GG](https://mut.gg/news/madden-ultimate-team-22-team-captains-alworth-youngblood-lynch-and-alexander)).
- **For us:** a captain's mood can swing with his contract; morale must visibly move.

### C4. NBA 2K

- In NBA 2K17, personality badges affected mood, animations and hot and cold streaks rather than ratings. Alpha Dog was earned by being the top-rated player for 20 straight games ([GosuNoob](https://www.gosunoob.com/nba-2k17/badges-guide-nba-2k17/)). In MyNBA 2K27, shared history builds friendships. Two stars at 50+ friendship form a Dynamic Duo with on-court boosts, and three form a Big 3. **Personality clashes, such as two Alpha Dogs, slow chemistry and drain it faster in losing streaks** ([2K](https://nba.2k.com/en-GB/2k27/features/mynba/)).
- **For us:** two would-be leaders on one team should strain chemistry, like CK3's Ambitious-to-Ambitious penalty.

### C5. Blood Bowl: the Leader skill

- Team rerolls are a scarce per-half resource, at most one per turn ([Living Rulebook](https://rulespal.com/blood-bowl-living-rulebook/rulebook)). Leader adds a reroll (snippet). NAF tournament packs for Sevens and Street Bowl recommend banning it (snippet) ([NAF Sevens](https://www.thenaf.net/wp-content/uploads/2019/09/Blood-Bowl-Sevens-2019.pdf), [Street Bowl](https://www.thenaf.net/wp-content/uploads/2019/09/Street-Bowl-2019.pdf)). A NAF guide calls it good on nearly any team ([NAF](https://www.thenaf.net/?p=3588)). The exact current wording (reportedly only while a Leader is on the pitch) was not verified.
- **For us:** a leadership skill that grants **one extra use of a scarce team resource**, valid only while the leader is in play. In small formats it becomes oppressive, so scale it down for small teams.

### C6. Commanders and generals

- **Total War (Rome II manual).** The general's presence raises nearby morale, and he can rally routers within his radius. If he dies, units already routing shatter and later routers cannot be rallied ([manual](https://r2enc.totalwar.com/en/manual/single-player/0087_enc_page_battle_play_phase_conflict_morale)). Community figures put a general's death at about −10 to −16 leadership, and killing a lord late in a battle can cause a chain rout (snippet) ([ACOUP](https://acoup.blog/2022/07/01/collections-total-generalship-commanding-pre-modern-armies-part-iiic-morale-and-cohesion/), [Steam](https://steamcommunity.com/app/594570/discussions/0/2280456883446115708/)).
- **Battle Brothers.** Rally gives every brother within 4 hexes a resolve check, with a bonus from the user's own resolve, and can turn a fleeing group around (snippet) ([RPGHQ](https://rpghq.org/forums/viewtopic.php?p=93749)). A company ambition has you name a sergeant who takes the perk. Players pick him for resolve first and fatigue second, give him a banner, and bench him when the roster is steady ([Steam, Dec 2023](https://steamcommunity.com/app/365360/discussions/0/4032475099154973610)).
- **Bannerlord.** Perks are tagged by role. Captain perks apply only to the formation that hero leads, while party-leader perks cover the whole party ([Gamer Guides](https://gamerguides.com/mount-and-blade-ii-bannerlord/guide/perks/social/leadership)). Players find many captain perks small (snippet) ([Steam](https://steamcommunity.com/app/261550/discussions/0/3086646248548329212)).
- **CK3/CK2:** commander traits act only while leading, are earned by winning and come in levels (A2).
- **For us:** role-tagged traits that only switch on while a fighter is captain; a presence radius; a succession rule for when the captain falls.

### C7. The esports in-game leader (IGL)

- The IGL calls the plan at the start of each round and adjusts rotations mid-round. IGLs often frag less because their attention is elsewhere, and many are veteran stars who moved into the role as their aim slowed ([Esports.net, Apr 2024](https://www.esports.net/news/counter-strike/all-cs-player-roles/)). Commentators describe a trade-off: better strategy, but a weaker individual slot (snippet) ([GGRecon](https://www.ggrecon.com/articles/blamef-and-the-legend-of-the-mad-fragging-caller)).
- **Management games.** *IGL: In Game Leader* (CleverByte, due Q3 2026) casts the player as the coach who makes the calls in real-time matches; whether it has leader stats is unknown ([nodal.gg](https://nodal.gg/game/igl-in-game-leader-4746870)). I found no autobattler where a unit-captain's stats change in-fight decision-making (thin).
- **For us:** the captain is the team's caller. The player's timed calls (C3.1) go through him, and calling costs him a little personal output, the IGL trade-off (inference).

### C8. What makes captaincy matter without becoming a stat-stick

Captaincy has to be visible and causal: FM's effect is debated because nobody can see it (C1). It should improve reliability, reach and recovery rather than damage, as Total War's presence, Hattrick's anti-confusion effect and Battle Brothers' rally do. Where it adds a resource, the resource should be small and scarce; Blood Bowl's Leader adds a single reroll and is still banned in small formats. It needs a price: the IGL's personal output, the outgoing captain's mood in FM, contract leverage in Madden 27. It should be a role rather than a rating, as with Bannerlord's role-tagged perks and CK3's commander traits. And succession needs planning, because Total War's general death shows the cliff to avoid.

---

## D. Cross-game comparison

| Game | Traits per character | Positive/negative mix | Trade-offs or pure flaws | How revealed | Change over time | Leadership hook |
|---|---|---|---|---|---|---|
| CK3 | ~3 personality, plus education, congenital, lifestyle, coping, commander | mostly two-sided; congenital tiers ± | mostly trade-offs | visible | stress breaks, education, battles | commander traits, levels 1–4 |
| CK2 | up to 5–6 personality | virtues and sins | mixed | visible | events, random gain/loss | leadership traits from battles |
| Darkest Dungeon | 5 + 5 quirks | ≥1 of each at hire; 25% virtue | many mirrored pairs | visible | expeditions; Sanitarium | none |
| Battle Brothers | 0–2 traits | mixed | mixed (Fat), some pure | paid try-out | mostly fixed (some change) | sergeant with rally and banner |
| RimWorld | 1–3 | weighted | both | visible | fixed (adults) | none |
| XCOM 2: WotC | negatives from fatigue; bonds | negatives earned | pure, chance-triggered | visible | infirmary cures | bonds |
| Wildermyth | 11 personality stats | flavour + relationships | neither | visible | events | Leader as a relative callout |
| FM | hidden personality + PPMs | tactic-relative | trade-offs | scouting and behaviour | coaching, tutoring | Leadership, hierarchy, captain |
| Blood Bowl | skills grow; big-guy negatives | positives earned | negatives priced into power | visible | SPP levels | Leader reroll |
| Total War | n/a | n/a | n/a | n/a | n/a | general's presence, rally, death |
| Bannerlord | perks by role | positive | n/a | visible | skill levels | captain-only perks |

---

## Top ideas for our game (ranked)

1. **Three to four readable traits per fighter, with one icon, one line and one number each.** CK3 caps personality so a character reads at a glance ([Traits](https://ck3.paradoxwikis.com/Traits)), and its nested tooltips became Paradox's house style (snippet) ([Tinto Talks 77](https://admin-forum.paradoxplaza.com/forum/developer-diary/tinto-talks-77-20th-of-august-2025.1856053)).
2. **Temperament pairs with opposites, most of them two-sided.** One axis per pair (for example reckless ↔ wary), so negatives are mostly trade-offs, as in CK3's personality traits and RimWorld's spectra ([Traits](https://ck3.paradoxwikis.com/Traits), [RimWorld](https://rimworldwiki.com/wiki/Traits)).
3. **Traits tilt behaviour inside the rules, never around them.** A trait adjusts the fighter's personality preset (C1.1), tie-breaks, thresholds and reaction delay (C3.7), and the inspector names it. This is CK3's idea of traits steering AI, applied to gambits ([DD #104](https://devtrackers.gg/crusader-kings/p/059cf6b8-dev-diary-104-ai-ai-ai)).
4. **Strain for out-of-character orders.** If you order a reckless fighter to kite, he obeys but builds strain, which costs morale and can create a treatable habit. This is CK3 stress scaled down for fighters ([Stress](https://ck3.paradoxwikis.com/Stress)).
5. **Chemistry from shared and clashing traits plus shared fights.** Pair values come from shared traits, opposites, and self-clashing traits such as two glory-seekers ([Traits](https://ck3.paradoxwikis.com/Traits), [2K](https://nba.2k.com/en-GB/2k27/features/mynba/)). Rescues and close calls spike them ([GameBanshee](https://www.gamebanshee.com/kdd8x)), and Wildermyth-style named levels give small adjacency bonuses ([Relationship](https://wildermyth.com/wiki/Relationship)).
6. **Captain as a role with role-tagged traits.** Command traits only work while a fighter is captain, as Bannerlord's captain perks and CK3's commander traits only work while leading ([Gamer Guides](https://gamerguides.com/mount-and-blade-ii-bannerlord/guide/perks/social/leadership), [Traits](https://ck3.paradoxwikis.com/Traits)).
7. **The captain improves reliability, not damage.** He shortens call latency, extends call reach, gives a composure aura and can rally. Models: Total War's presence and rally, Battle Brothers' rally radius and Hattrick's anti-confusion effect ([manual](https://r2enc.totalwar.com/en/manual/single-player/0087_enc_page_battle_play_phase_conflict_morale), [RPGHQ](https://rpghq.org/forums/viewtopic.php?p=93749)).
8. **Scouting reveals traits in steps, plus a paid try-out.** Battle Brothers' fee (snippet) ([Raider King](https://raiderking.com/?p=1330)) and C1.5's reveal steps; the riskiest traits show last.
9. **The academy teaches crafts and treats flaws, with odds shown up front.** Teaching follows FM's coach-and-suitability model ([Passion4FM](https://www.passion4fm.com/football-manager-player-traits/)); treatment uses weekly slots as in DD and XCOM ([Quirks](https://darkestdungeon.wiki.gg/wiki/Quirks), [GameBanshee](https://www.gamebanshee.com/kdd8x)); temperament shifts only through mentors before a fighter's prime ([FM Scout](https://www.fmscout.com/a-youth-development-on-football-manager-tutoring-guide.html)).
10. **Leveled command traits earned by winning as captain**, after CK3's commander XP per victory ([Traits](https://ck3.paradoxwikis.com/Traits)).
11. **Background weights trait odds and price reflects traits**, as in Battle Brothers ([Keen Gamer](https://www.keengamer.com/articles/reviews/battle-brothers-review/)).
12. **Story callouts.** Recaps and events name the fighter with the strongest trait for the moment, as Wildermyth's role callouts do ([Stat](https://wildermyth.com/wiki/Stat)).

## Pitfalls to avoid (ranked)

1. **Traits that take control away.** DD's afflicted heroes act on their own (snippet) ([God is a Geek](https://godisageek.com/reviews/darkest-dungeon-review/)), against our C2.1 and C3.7. Negatives change numbers and delays, never which rule fires.
2. **Pure flaws that only feel bad.** Players reroll or refuse them (snippet) ([Basics](https://www.rimworldwiki.com/wiki/Basics), [Raider King](https://raiderking.com/?p=1330)). Every negative needs an upside, a niche or a cure.
3. **Trait bloat.** CK2's piles of traits did little (snippet) ([GamingOnLinux](https://www.gamingonlinux.com/articles/15647/)), and DD's ten slots are hard to track.
4. **Traits that don't matter.** CK3's developers admitted personality often didn't affect AI decisions ([DD #104](https://devtrackers.gg/crusader-kings/p/059cf6b8-dev-diary-104-ai-ai-ai)).
5. **Invisible captaincy.** In the FM Mobile test team ratings moved about 1% ([FMM Vibe](https://fmmvibe.com/forums/topic/38819-battle-of-captains/)), and one reviewer saw no effect from the hierarchy (snippet) ([Trusted Reviews](https://www.trustedreviews.com/reviews/football-manager-2018)).
6. **The captain as a must-have stat-stick.** Leader is banned in small Blood Bowl formats (snippet) ([NAF Sevens](https://www.thenaf.net/wp-content/uploads/2019/09/Blood-Bowl-Sevens-2019.pdf)). Keep effects small with diminishing returns.
7. **A captain-death cliff.** Total War's shattering (manual) would make "kill the captain" the only plan (inference). Keep the shock short and capped, with a vice-captain handover.
8. **A trait factory meta.** CK3's eugenics optimisation (snippet) ([GlitchOut](https://glitchout.blog/2020/09/28/crusader-kings-3-eugenics-at-play/)). Academy outputs need caps, slots and age limits.
9. **A slow, expensive cleanup grind.** DD's Sanitarium (snippet) ([PC Gamer](https://www.pcgamer.com/au/darkest-dungeon-impressions-a-maddening-game-to-love)).
10. **Mood that never moves.** Madden 27's morale reportedly sits near 50% (snippet) ([RealSport101](https://realsport101.com/article/madden-27-review-a-step-forward-for-franchise-mode-but-gameplay-still-fumbles)).
11. **Hard-wired miseries.** Traits that stress constantly (Shy or Compassionate in CK3) push players to cherry-pick (snippet) ([Steam](https://steamcommunity.com/app/1158310/discussions/0/3186865924607270710)).

## Open questions

1. Does 80/20 count traits or fighters? Counting traits keeps most fighters clean, while counting fighters guarantees that one in five has a flaw (inference).
2. Is the captain appointed freely, appointed but judged against squad standing (FM-style), or elected by the squad?
3. Does the player's timed-call budget (C3.1) depend on the captain, or only the calls' latency and reach?
4. Can temperament change in adults (CK3: rarely, through breaks), or only before a fighter's prime (FM tutoring)?
5. Are trait-driven event texts hand-written per trait pair (costly) or assembled from trait tags (cheaper, risks repetition)?

## Sources

1. CK3 Wiki, "Traits" (PC 1.20) — https://ck3.paradoxwikis.com/Traits
2. CK3 Wiki, "Stress" (PC 1.20) — https://ck3.paradoxwikis.com/Stress
3. CK3 Wiki, "Relations" (PC 1.20) — https://ck3.paradoxwikis.com/Relations
4. CK2 Wiki, "Traits" (v3.3) — https://ck2.paradoxwikis.com/Traits
5. CK3 Dev Diary #104 "AI AI AI!" (2022), via devtrackers — https://devtrackers.gg/crusader-kings/p/059cf6b8-dev-diary-104-ai-ai-ai
6. CK3 Dev Diary #07 "Characters & Portraits" (snippet) — https://forum.paradoxplaza.com/forum/threads/ck3-dev-diary-07-characters-portraits.1295264/
7. GamingOnLinux on Dev Diary #07 (snippet) — https://www.gamingonlinux.com/articles/15647/
8. CK3 Dev Diary #31 "A Stressful Situation" (snippet) — https://forum.paradoxplaza.com/forum/threads/ck3-dev-diary-31-a-stressful-situation.1399764/page-7
9. GamingOnLinux, "Crusader Kings III is now out" (1 Sep 2020) — https://www.gamingonlinux.com/2020/09/crusader-kings-iii-is-now-out-some-thoughts-on-the-medieval-mayhem/page=1/
10. Vaporlens, Crusader Kings III — https://vaporlens.app/app/1158310/crusader_kings_iii.md
11. PC Gamer, Crusader Kings 3 review (snippet) — https://pcgamer.com/crusader-kings-3-review
12. Steam Discussions, CK3 trait and stress thread (snippet; content-gated) — https://steamcommunity.com/app/1158310/discussions/0/3186865924607270710
13. GlitchOut, "Crusader Kings 3: Eugenics at Play" (Sep 2020) (snippet) — https://glitchout.blog/2020/09/28/crusader-kings-3-eugenics-at-play/
14. Paradox, Tinto Talks 77 (EU5, Aug 2025) (snippet) — https://admin-forum.paradoxplaza.com/forum/developer-diary/tinto-talks-77-20th-of-august-2025.1856053
15. Darkest Dungeon Wiki, "Quirks" — https://darkestdungeon.wiki.gg/wiki/Quirks
16. Darkest Dungeon Wiki, "Virtue" — https://darkestdungeon.wiki.gg/wiki/Virtue
17. PlayStation Blog, Darkest Dungeon unveiled (Dec 2014) (snippet) — https://blog.eu.playstation.com/2014/12/06/old-school-rpg-darkest-dungeon-unveiled-ps4-ps-vita/
18. God is a Geek, Darkest Dungeon review (snippet) — https://godisageek.com/reviews/darkest-dungeon-review/
19. PC Gamer, "Darkest Dungeon impressions" (snippet) — https://www.pcgamer.com/au/darkest-dungeon-impressions-a-maddening-game-to-love
20. Keen Gamer, Battle Brothers review (7 Mar 2018) — https://www.keengamer.com/articles/reviews/battle-brothers-review/
21. Steam Discussions, "Iron lung Lumberjack" (Nov 2017) — https://steamcommunity.com/app/365360/discussions/0/1489992080508052323
22. Raider King, Battle Brothers trait tier list (snippet) — https://raiderking.com/?p=1330
23. Nexus Mods, Battle Brothers backgrounds article (snippet) — https://nexusmods.com/battlebrothers/articles/56
24. Steam Discussions, Battle Brothers sergeant thread (Dec 2023) — https://steamcommunity.com/app/365360/discussions/0/4032475099154973610
25. RPGHQ, Battle Brothers perks let's-play (snippet) — https://rpghq.org/forums/viewtopic.php?p=93749
26. RimWorld Wiki, "Traits" (v1.6) — https://rimworldwiki.com/wiki/Traits
27. Steam, RimWorld store page (Oct 2026) — https://store.steampowered.com/app/294100/RimWorld/
28. RimWorld Wiki, "Basics" (snippet) — https://www.rimworldwiki.com/wiki/Basics
29. GameBanshee, "XCOM 2: War of the Chosen New Soldier Features" (10 Aug 2017) — https://www.gamebanshee.com/kdd8x
30. XCOM Wiki, "Negative Traits" (snippet) — https://xcom.fandom.com/wiki/Negative_Traits
31. Wildermyth Wiki, "Stat" — https://wildermyth.com/wiki/Stat
32. Wildermyth Wiki, "Relationship" — https://wildermyth.com/wiki/Relationship
33. FM Scout, "A guide to player personalities" (May 2022) — https://www.fmscout.com/a-guide-to-player-personalities-football-manager.html
34. Passion4FM, "Football Manager Player Traits" (Oct 2024, FM25) — https://www.passion4fm.com/football-manager-player-traits/
35. FM Scout, "Youth Development: Tutoring" (Jul 2012) — https://www.fmscout.com/a-youth-development-on-football-manager-tutoring-guide.html
36. Blood Bowl Living Rulebook (rulespal) — https://rulespal.com/blood-bowl-living-rulebook/rulebook
37. Let's Play Archive, Blood Bowl Update 04 — https://lparchive.org/Blood-Bowl-(by-GNU-Order)/Update%2004/
38. Ogre Playbook (pdfcoffee) (snippet) — https://pdfcoffee.com/ogre-playbook-pdf-free.html
39. NAF, Blood Bowl Sevens 2019 (snippet) — https://www.thenaf.net/wp-content/uploads/2019/09/Blood-Bowl-Sevens-2019.pdf
40. NAF, Street Bowl 2019 (snippet) — https://www.thenaf.net/wp-content/uploads/2019/09/Street-Bowl-2019.pdf
41. NAF, "A thorough discussion of the various skills" (Feb 2016) — https://www.thenaf.net/?p=3588
42. FM Scout, FM23 hints and tips (snippet) — https://www.fmscout.com/a-football-manager-2023-hints-and-tips.html?pg=1
43. Football Manager, FM23 Dynamics Centre (snippet) — https://footballmanager.com/node/722
44. Football Manager, "Choosing the perfect captain" (snippet) — https://footballmanager.com/node/129
45. The Set Pieces, "FM18 Project: How to avoid a squad mutiny" (Dec 2017) — https://thesetpieces.com/?p=19246
46. Game Informer, "Inside the dynamics of Football Manager 2018" (Nov 2017) — https://gameinformer.com/b/features/archive/2017/11/06/the-sports-desk-inside-the-dynamics-of-football-manager-2018
47. Trusted Reviews, Football Manager 2018 review (snippet) — https://www.trustedreviews.com/reviews/football-manager-2018
48. FMM Vibe, "Battle of Captains" (Dec 2016, FM Mobile 2017) — https://fmmvibe.com/forums/topic/38819-battle-of-captains/
49. FOFC forum archive, Hattrick "team experience?" thread (2003–05) (snippet) — https://forums.operationsports.com/fofc/archive/index.php/.../a%3E/t-25284.html
50. Hattrick Youthclub wiki, "Players" — https://wiki.hattrick-youthclub.org/players
51. Game Informer, Madden NFL 12 franchise preview (May 2011) — https://gameinformer.com/games/madden_nfl_12/b/ps3/archive/2011/05/16/how-deep-is-madden-39-s-depth-chart-of-franchise-amp-superstar-features.aspx
52. Destructoid, Madden 25 player tags — https://www.destructoid.com/all-player-tags-and-motivations-in-madden-25-franchise-mode/
53. Chicago Sun-Times, Madden 27 review (21 Aug 2026) — https://chicago.suntimes.com/nfl/2026/08/21/madden-27-review-curses-bears-and-caleb-williams-better-not-hope-so
54. RealSport101, Madden 27 review (snippet) — https://realsport101.com/article/madden-27-review-a-step-forward-for-franchise-mode-but-gameplay-still-fumbles
55. MUT.GG, MUT 22 team captains (snippet) — https://mut.gg/news/madden-ultimate-team-22-team-captains-alworth-youngblood-lynch-and-alexander
56. GosuNoob, NBA 2K17 badges guide — https://www.gosunoob.com/nba-2k17/badges-guide-nba-2k17/
57. 2K, NBA 2K27 MyNBA features — https://nba.2k.com/en-GB/2k27/features/mynba/
58. Total War: Rome II manual, "Morale" — https://r2enc.totalwar.com/en/manual/single-player/0087_enc_page_battle_play_phase_conflict_morale
59. ACOUP, "Total Generalship IIIc: Morale and Cohesion" (Jul 2022) (snippet) — https://acoup.blog/2022/07/01/collections-total-generalship-commanding-pre-modern-armies-part-iiic-morale-and-cohesion/
60. Steam Discussions, Total War: Warhammer II lord-loss penalties (snippet) — https://steamcommunity.com/app/594570/discussions/0/2280456883446115708/
61. Gamer Guides, Bannerlord Leadership perks — https://gamerguides.com/mount-and-blade-ii-bannerlord/guide/perks/social/leadership
62. Steam Discussions, Bannerlord captain perks (snippet) — https://steamcommunity.com/app/261550/discussions/0/3086646248548329212
63. Esports.net, "All Counter-Strike roles" (11 Apr 2024) — https://www.esports.net/news/counter-strike/all-cs-player-roles/
64. GGRecon, "blameF and the legend of the mad-fragging caller" (snippet) — https://www.ggrecon.com/articles/blamef-and-the-legend-of-the-mad-fragging-caller
65. nodal.gg, "IGL: In Game Leader" — https://nodal.gg/game/igl-in-game-leader-4746870

## Thin or unverified

- **Hattrick's captain mechanics** rest only on 2003–05 forum claims seen in search results; no weighting or formula is sourced (C2).
- **Blood Bowl's Leader wording** (extra reroll; reportedly only while a Leader is on the pitch) was not verified from a rulebook. Bone Head's one-in-six rate is a playbook snippet (B7, C5).
- **CK3 player complaints** (Shy and Compassionate stress, implausible trait rolls, eugenics) come from content-gated Steam threads and a blog seen only as snippets. Dev Diaries #07 and #31 were blocked, so the three-trait design intent and the two-word summary are snippets. The nested-tooltip lineage comes from a later Paradox diary snippet (A5, A6).
- **Darkest Dungeon's** Sanitarium cost complaint and the designer's framing are snippets. DD2's quirk changes were not researched.
- **Battle Brothers'** try-out reveal and fee rest on snippets. The 0–2 trait count is a player's tally, not a rule. Rally's 4-hex radius is from a let's-play snippet.
- **FM's** captain effects: the only controlled test is on FM Mobile 2017, a lighter engine. FM's own captaincy-change advice is a snippet. The tutoring rules date from 2012.
- **Madden** has no sourced franchise captain mechanic. **NBA 2K's** leadership badges are 2K17-era.
- **Total War's** death-penalty numbers are community figures. No autobattler with in-fight captain decisions was found.
- **XCOM** player sentiment and **Wildermyth** reception were not researched.

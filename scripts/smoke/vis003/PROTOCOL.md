# vis-003 observer protocol: "Fights are readable"

**The criterion** ([01 §6](../../../docs/design/01-game-vision-and-design-principles.md), vis-003): observers watch 5 fights at 1x; each can name both sides' tank and healer and the cause of each down in at least 90% of prompts. It is judged on shapes, glyphs and callouts (Q59), not on sprites. The "cause" of a down is the fighter the game credits with it: the sim credits the fighter whose single largest hit of that tick took the target down (the callout "X downed by Y" names that fighter), and assists are not credited.

Only this protocol, with real people, is evidence for vis-003. The automated proxy and the agent pre-check ([README](../README.md)) gate the merge; they do not replace it.

## What you need

- A build with the arena viewer merged (M2). `npm run dev` or `npm run build` then `npm run preview`.
- The fights. Run `npx tsx scripts/smoke/run.ts --only vis003 --seed <seed>` once (a few minutes, headless; the package script `smoke:arena` is to be added and will do the same). It plays a new career with that seed and writes `reports/smoke/<run>/vis003/`, among others:
  - `sheets/fight-1.md` ... `fight-5.md`: one sheet per fight, to be handed over **after** that fight. Print them, or fill copies.
  - `owner-tally.md`: the page you fill in per observer once the sheets are marked.
  - `owner-answer-key.md`: the answers. **Do not open it** before every observer has handed in every sheet.
  - `manifest.json`: which rounds the 5 fights are.
  The same seed gives the same fights, so you and anyone else can watch exactly the fights the sheets were made for. (A folder whose files start with "SELF-TEST on the mock arena" is the driver's own test, not fights of the game: do not use it.)
- 2 or more observers if you can: you, and at least one person who has not seen the game. The criterion says "each", so every observer is scored on their own.
- A normal screen (at least 1280 x 720). The game's own pacing; nothing is changed in Settings except what is said below.

## Setting up the fights (the same for every observer)

1. New career. Under **Advanced** type the seed. **New career**.
2. Pick the **first club card of the lowest tier** (the top of the list, the one the career was captured with). **Start career**.
3. Press **Continue** through the preseason weeks, confirm the kick-off, and stop at the day of the match, where Continue reads **Watch** (**Play match** in a build before the arena). Take the defaults everywhere: no signings, no lineup, tactics or preset changes. If the game stops you on "Decide first", use another seed and regenerate the sheets.
4. **Watch**. Check that the speed shows **1x** (a round starts at the remembered speed of the device). Leave the auto-pause settings as they are (our downs, our captain down, overtime).
5. The 5 fights are the first 5 rounds you watch, in order, across the first matches (the manifest lists them). Between rounds press **Continue** and nothing else.

## What to tell an observer

Say only this, then start. Do not coach, do not answer questions about what a symbol means during the fights.

> You will watch five short fights between two teams of five. Your team has solid brass-coloured rings, the other team double steel-blue rings. You can pause with Space and nothing else; you cannot rewind. The fight stops by itself now and then, for instance when one of your fighters goes down: press Space to carry on. After each fight I will give you a sheet of questions about it. Answer from what you saw on screen. If you could not tell, write "unclear". There is no prize for guessing.

If the game has a legend or help for the role glyphs, an observer may open it before the first fight, as a new player could. Tell them it exists; do not explain it.

**Auto-pause stops.** Playback stops by itself after one of your fighters or your captain goes down, and when overtime starts. Every stop is a chance to read the screen (the callout names the cause), and each fight needs a few presses of Space to resume. An observer who sits and waits at a stop has not finished the fight: tell them to press Space. Do not resume it for them, and do not point at anything on the screen.

## Each fight

1. The observer watches the fight once at 1x. They may pause with Space. No rewinding, no second viewing, no looking at a sheet first.
2. As soon as the fight ends (the round-end overlay), hand over **that fight's sheet** (`sheets/fight-N.md`). They answer in writing, from memory and from what they saw, in about two minutes, without talking.
   - **Tank / healer questions:** the fighter's name or class. "None" if the side has none.
   - **Downs:** the sheet does not say who went down, when, or how many. The observer lists every fighter that went down, in order, and for each the fighter the screen credits with downing them (and the ability, if they saw it). The sheet has more rows than any fight needs.
3. Do not say whether an answer is right. Take the sheet away before the next fight starts. Move on.

## Scoring

After all five fights and all observers, open `owner-answer-key.md` and mark every question on each observer's sheets right or wrong. The key lists, per fight, the tank and healer of each side and every down with the credited fighter and ability:

- **Tank, healer:** right when the observer names the fighter, or the class, that holds the role on that side. Hybrid classes hold two roles (a tank-healer counts as tank and as healer). Naming a fighter who does not hold the role, or two fighters of whom one does not, is wrong. "None" is right only if the key says the side has none.
- **Down** (one question per down in the key): right when the observer's list has the victim and names **the one fighter credited** with the down. The ability is not required (note it as a bonus if you want the figure). Wrong: naming **several** enemies for one down (assists included), naming only the victim, "unclear", "unknown" or nothing. A down with no fighter behind it (a status or zone effect) is right when the observer says so. A down the observer did not list is a missed question. A fighter listed who did not go down is not counted either way (note it).
- **"Unclear" and "unknown" are wrong everywhere.** The aim is that the screen makes the answer plain.
- Count: **right / total questions**. The tally page gives the total per fight and the 90% line (for 24 questions, 22).

You can have the tool do the marking: write each observer's answers into a file shaped like `answers-template.json` (the roles as text, the downs as a list of `{ "victim", "cause" }`) and run `npx tsx scripts/smoke/vis003/cli.ts score --run <folder> --answers <file>`; it applies the rules above and lists every question it marked wrong, with the reason. A person's marks and the tool's should agree; if they do not, the person decides and the disagreement is a bug in the tool.

## The result

- **Passes** when every observer reaches 90% or more. Record: the commit, the date, the seed, the display size, each observer's score, and the filled sheets.
- **Fails** otherwise. The result is the list of questions that were missed, grouped by what they asked: tank, healer, down. Each group points at a cue: the role glyph shape and its colour, the side ring, the callout text and its 2 seconds, the live feed, the auto-pause. Hand that list to the UI designer.
- After a fix, **use a new seed**. Observers remember fights they have seen, and a repeat measures memory.

## Notes for the person running it

- The 5 fights are one career's first rounds, so they are mostly the same class pool. If an observer reaches 100% on tanks and healers only because every fight has the same two classes, run a second seed.
- Time: about 4 minutes of fight per observer, plus 2 minutes of answering per fight. Keep it under an hour including the briefing.
- Ask the observers afterwards what they used to tell tanks and healers apart (shape, colour, name, position). It is not scored; the designer wants it.

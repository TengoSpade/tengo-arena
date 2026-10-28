# vis-003 observer protocol: "Fights are readable"

**The criterion** ([01 §6](../../../docs/design/01-game-vision-and-design-principles.md), vis-003): observers watch 5 fights at 1x; each can name both sides' tank and healer and the cause of each down in at least 90% of prompts. It is judged on shapes, glyphs and callouts (Q59), not on sprites.

Only this protocol, with real people, is evidence for vis-003. The automated proxy and the agent pre-check ([README](../README.md)) gate the merge; they do not replace it.

## What you need

- A build with the arena viewer merged (M2). `npm run dev` or `npm run build` then `npm run preview`.
- The fights. Run `npm run smoke:arena -- --only vis003 --seed <seed>` once (a few minutes, headless). It plays a new career with that seed and writes `reports/smoke/<run>/vis003/`, among others:
  - `owner-sheet.md`: the prompts for the 5 fights, blank answer lines. Print it, or fill it in a copy.
  - `owner-answer-key.md`: the answers. **Do not open it** before the observers have finished.
  - `manifest.json`: which rounds the 5 fights are.
  The same seed gives the same fights, so you and anyone else can watch exactly the fights the sheet was made for.
- 2 or more observers if you can: you, and at least one person who has not seen the game. The criterion says "each", so every observer is scored on their own.
- A normal screen (at least 1280 x 720). The game's own pacing; nothing is changed in Settings except what is said below.

## Setting up the fights (the same for every observer)

1. New career. Under **Advanced** type the seed. **New career**.
2. Pick the **first club card of the lowest tier** (the top of the list, the one the career was captured with). **Start career**.
3. Press **Continue** through the preseason weeks, confirm the kick-off, and stop at **Play match**. Take the defaults everywhere: no signings, no lineup, tactics or preset changes. If the game stops you on "Decide first", use another seed and regenerate the sheet.
4. **Play match**, then **Watch**. Check that the speed shows **1x** (a round starts at the remembered speed of the device). Leave the auto-pause settings as they are (our downs, our captain down, overtime).
5. The 5 fights are the first 5 rounds you watch, in order, across the first matches (the manifest lists them). Between rounds press **Continue** and nothing else.

## What to tell an observer

Say only this, then start. Do not coach, do not answer questions about what a symbol means during the fights.

> You will watch five short fights between two teams of five. Your team has solid brass-coloured rings, the other team double steel-blue rings. You can pause with Space and nothing else; you cannot rewind. After each fight I will give you a sheet of questions about it. Answer from what you saw on screen. If you could not tell, write "unclear". There is no prize for guessing.

If the game has a legend or help for the role glyphs, an observer may open it before the first fight, as a new player could. Tell them it exists; do not explain it.

## Each fight

1. The observer watches the fight once at 1x. They may pause with Space. No rewinding, no second viewing, no looking at the sheet first.
2. As soon as the fight ends (the round-end overlay), hand over the sheet. They answer **every** prompt for that fight in writing, from memory and from what they saw, in about two minutes, without talking.
   - **Tank / healer prompts:** the fighter's name or class. "None" if the side has none.
   - **Down prompts:** the fighter who downed them, and the ability if they saw it. Down prompts name the victim and about when it happened, so the observer can place it.
3. Do not say whether an answer is right. Move on to the next fight.

## Scoring

After all five fights, open `owner-answer-key.md` and mark every prompt on each observer's sheet right or wrong:

- **Tank, healer:** right when the observer names the fighter, or the class, that holds the role on that side. Hybrid classes hold two roles (a tank-healer counts as tank and as healer). Naming a fighter who does not hold the role, or two fighters of whom one does not, is wrong. "None" is right only if the key says the side has none.
- **Down:** right when the observer names the fighter that struck the last blow. The ability is not required (note it as a bonus if you want the figure). Naming the victim, or several enemies, or "unclear" or nothing, is wrong. A down with no fighter behind it (a status or zone effect) is right when the observer says so.
- Count: **right / total prompts**. The score sheet works the total out, and the 90% line (for 24 prompts, 22).

You can have the tool do the marking: write each observer's answers into a file shaped like `answers-template.json` and run `npm run smoke:vis003 -- score --run latest --answers <file>`; it applies the rules above and lists every prompt it marked wrong, with the reason. A person's marks and the tool's should agree; if they do not, the person decides and the disagreement is a bug in the tool.

## The result

- **Passes** when every observer reaches 90% or more. Record: the commit, the date, the seed, the display size, each observer's score, and the filled sheets.
- **Fails** otherwise. The result is the list of prompts that were missed, grouped by what they asked: tank, healer, down. Each group points at a cue: the role glyph shape and its colour, the side ring, the callout text and its 2 seconds, the live feed, the auto-pause. Hand that list to the UI designer.
- After a fix, **use a new seed**. Observers remember fights they have seen, and a repeat measures memory.

## Notes for the person running it

- The 5 fights are one career's first rounds, so they are mostly the same class pool. If an observer reaches 100% on tanks and healers only because every fight has the same two classes, run a second seed.
- Time: about 4 minutes of fight per observer, plus 2 minutes of answering per fight. Keep it under an hour including the briefing.
- Ask the observers afterwards what they used to tell tanks and healers apart (shape, colour, name, position). It is not scored; the designer wants it.

# Handoff: cloud orchestration session, 2026-10-30

For the local (PC) orchestrator agent. This records what a cloud Claude Code session did on the GitHub copy of the repo, and what is left.

## Repository situation

- **GitHub:** `https://github.com/TengoSpade/tengo-arena`. The cloud session has push access to branches; it cannot push tags (the proxy drops tag pushes).
- **GitHub `main` has different history from the PC's `main`.** GitHub `main` starts at `b76a352` "Initial import of Arena League", a squashed import whose tree equals PC commit `bdfd5bc` plus `.gitignore` ignoring `.claude/worktrees/`. Do not merge or force-push PC `main` onto it. Work from a fresh local branch:

  ```powershell
  git fetch origin
  git switch -c gh-main origin/main
  ```

- **Full M2 history** is on the branches `m2/integration` (ceae885), `m2/docs-as-built` (751b23d) and `m2/finish` (438648e). The owner pushed the first two from the PC.

## What landed on GitHub `main` (in order)

| Commit | What |
| --- | --- |
| `c7bcb8f` | **M2 arena viewer**: a squash of `m2/finish` (WP-M2A–F + design docs v0.9 + smoke fixes + doc fact corrections). |
| `dfd7ad9` | Docs: M2 merge facts (squash `c7bcb8f`; history lives on the m2 branches). |
| 4 commits → `dc77c4d` | **Fighter tokens** (owner mock `docs/art/reference/fighter-token-mock.png`). Round token with a role-colour disc (diagonal split for hybrids), OVR, short role code from `combat.json` `shortName` (e.g. "MEL/HEA") and class name below. The outer ring is Freshness, coloured by the content tier. HP stays the viewer's own bar. About 60 px at 1920×1080 (1.3 m of arena, 48 px floor). The selected or hovered token draws on top. Names stay on the "selected" default. Screenshots are in `docs/art/reference/screens/`. |
| 4 commits + `f5fa0f4` | **KI-21 (closed)**, owner decisions **O36** and **O37** (docs 01 §8.1). Details below. |

### Owner decisions made in this session (all recorded in docs 01 §8.1 O36/O37)

- **Stepped Freshness penalty tiers** (replacing the sliding scale). The penalty is set at round start and multiplied by (1 − fatigueResist):

  | Freshness | Tier | Attack speed, move, Power, Support | Reaction delay |
  | --- | --- | --- | --- |
  | 75 and above | Fresh | none | none |
  | 50–74 | Winded (internal id `ready`) | −5% | +10% |
  | 25–49 | Tired | −10% | +20% |
  | below 25 | Spent | −15% | +30% |

- **Thresholds that used to key off 60/40 now use 50** (`levels.freshness.threshold`): Q48's half drain, the injury multiplier, the AI auto-swap default (personalities +10), and AI rotation.
- **Played-week recovery.** Fighters who started a round still recover `playedWeekRestShare` of the weekly rest by human-age: 10% (<25), 5% (25–30), 2% (31+). At median Stamina 13 the target is **4/3/3 matches before a Tired round** for young, middle and older fighters. The older ×1.25 drain was tried and then removed at the owner's request.
- **O37 AI reserve cover.** The AI names fresh reserves (≥50, within the auto-swap gap) for likely-to-tire starters. It had no measurable effect; the owner chose to keep it.
- **Harness and targets.**
  - The squad-match harness was fixed: lost-round bonus, a 0–100 start draw, mirrored clubs and sides.
  - Its bands were lowered to the measured values: threshold50 48–54%, reserves2v0 47–53%, swaps 0.3–0.6.
  - The fatigue bands were rewritten for the tiers.
  - The adjusted win% is now floored at 0.
  - A new soak WARN check, `spent-share`, was added.
- **Freshness labels in the UI are data-driven** (`freshBands` in `src/ui/m11/model.ts`).
- **KI-22 (Battle Chaplain) is left as-is,** parked for M7, at the owner's request.

**Gates at `f5fa0f4`:**
- 2,060 tests pass; typecheck and lint are clean.
- Soak: 3 seasons pass. 10 seasons give 2 WARN: competitive-balance (by design) and `spent-share`, which is being fixed below.
- Save peak is 9.0 MB against the ~10 MB budget.
- Replays recorded before this balance change end at it (Q56 `other-build`).

## In progress when this was written

- **`m1.1/spent-drift` (KI-32).**
  - The cause: the AI rotation's rating-gap tolerance is fixed while the gap between top-5 and bench grows, because starters earn the XP. So tired starters keep being fielded even though a rested alternative exists about 97% of the time.
  - The first fix commit was `fdd29aa`: `aiRotation` `extraGapPerPointBelow` 0.45→1.0, `spentFloorAtLock` 15→40, `spentFloorAltMin` 25→50.
  - **The soak still counted Spent as <40 (pre-O36).** The owner chose to **align the soak to the O36 tiers, then retune with the gentlest values that keep Spent flat** on soak-1..4. An agent was doing this, rebased on `f5fa0f4`.
  - If the branch is unfinished, finish exactly that, then review, test and merge.
- **Observation, not yet a ticket:** the league ages over long careers. Mean roster human-age goes 26→30 over 20 seasons, and mean Stamina 12.5→10.3.

## Left for the owner / local machine

1. Play a season on `gh-main` with the new tiers. The F8 ticket tool works as before.
2. Tag M2 from the PC: `git tag -a m2-arena-viewer c7bcb8f -m "M2 arena viewer"` (or tag `dfd7ad9`), then `git push origin m2-arena-viewer`.
3. **vis-003 human pass:** watch five fights at 1x with the observer kit in `scripts/smoke/vis003`.
4. **GPU checks** (this container had no GPU): `npm run smoke:arena -- --strict-perf`, covering 60 fps (KI-27), first-open timing (KI-28), and the frame-time trace across a cursor save.
5. Open design questions: batches A–C (Q1–Q35) in docs 01 §8.5; the sprite-art pipeline (docs/art/sprite-pipeline-research.md); the calls package WP-M2G (gated on sys-calls, open-038).

## Agent board

The live agent board is https://claude.ai/artifact/E3U7TZTUrbJuVmXnDKScbY (collection `agents`). Rows `ki21-*`, `m2-finish`, `m2-release`, `m2-fighter-tokens`, `tokens-reviewer` and `spent-drift` cover this session.

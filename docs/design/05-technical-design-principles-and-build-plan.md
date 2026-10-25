# Arena League — technical design principles and build plan

> ARENA LEAGUE DESIGN PACKAGE · DRAFT v0.1 · 2026-10-25. This document is still the unfilled Tengo template. The phase-2 draft `_drafts/05-technical.md` will be merged into it. Document 05 is the package's technical plan and milestone plan (it replaces the separately planned `plan.md`). The owner has fixed the technology (document 01: T1–T6): TypeScript + Vite, a pure-TypeScript deterministic seeded simulation with no PixiJS imports, PixiJS v8 for the arena from M2, HTML/CSS management UI, theme data in files, and Tauri or Electron packaging in M7. The milestone order is M1–M7 (O14). Bracketed prompts are unanswered, not defaults. Not approved for implementation.
> Follow the labels, scope, glossary, and authority rules in [document 01](01-game-vision-and-design-principles.md).
> This document governs implementation constraints and delivery. For this game the owner has explicitly fixed the language, build tool and renderer (01, T1–T6).

| Field | Value |
| --- | --- |
| Game / version / updated | Arena League / v0.1 / 2026-10-25 |
| Status / technical and design owners | Template awaiting the phase-2 merge / the project owner |
| Current milestone | M1 "Season MVP" (document 01 §5, O14) |

## 1. Implementation mandate and freedom

**Required outcome:** [the complete player-visible experience to deliver for this milestone].

**Fixed constraints:** [platform capabilities, connectivity, offline operation, portability, licensing, performance, or other approved constraints].

**Implementer may choose:** [internal structures, tools, rendering techniques, libraries, or other replaceable choices].

**Requires a design decision:** [changes to controls, rules, information, progression, art direction, scope, or other player-visible commitments].

**Selection criteria for replaceable technology:** [criteria such as target-device support, maintainability, iteration speed, and deployment needs, ordered for this project].

Do not select technology merely to fill this template. Where technology remains open, require the implementer to document its chosen approach and relevant tradeoffs before dependent work.

## 2. Programming guidelines

Adopt, modify, or reject each proposed principle explicitly when filling the game-specific copy. These are template recommendations until approved.

| Proposed principle | Why it helps | Project decision / exceptions |
| --- | --- | --- |
| Keep gameplay rules independently testable from presentation where practical | Makes rules portable and discrepancies easier to diagnose | [adopt / modify / reject] |
| Give each piece of mutable state one authoritative owner | Prevents conflicting copies and inconsistent outcomes | [decision] |
| Separate inspection / preview from state-changing operations | Prevents read-only UI from accidentally changing play | [decision / N/A] |
| Express variable content and tuning as validated data where useful | Supports consistent authoring and iteration | [decision] |
| Prefer small explicit interfaces over speculative frameworks | Keeps the current milestone understandable | [decision] |
| Report invalid data and failed operations with actionable context | Makes authoring and debugging reliable | [decision] |
| Keep debug information separate from the player experience | Preserves intentional information and presentation | [decision] |
| Test observable contracts rather than mirroring private implementation | Allows refactoring without weakening behavioral verification | [decision] |

Add project-specific expectations for naming, dependency management, code organization, comments, error handling, and review: [constraints and rationale].

## 3. System responsibilities and state ownership

Define responsibilities rather than engine classes.

| Responsibility | Owns | Accepts / reads | Produces | Must not do |
| --- | --- | --- | --- | --- |
| [gameplay simulation or equivalent] | [authoritative rule state] | [commands / time / data] | [outcomes / state] | [forbidden coupling] |
| [player interaction / presentation] | [view and interaction state] | [input / gameplay state] | [commands / feedback] | [forbidden mutations] |
| [content loading / validation] | [validated definitions] | [content sources] | [usable data / errors] | [forbidden behavior] |
| [session / persistence] | [lifecycle and saved state] | [approved state transitions] | [restored state / durable saves] | [forbidden duplication] |

Replace or remove rows that do not fit. Define dependency direction, shared identifiers, event ordering, and which operations may change state.

### Operation contract — duplicate for important boundaries

- **Operation:** [intent and responsible system]
- **Inputs:** [required fields and units]
- **Validation:** [preconditions and invalid-input behavior]
- **Output:** [result and events]
- **State changes:** [exact ownership / commit behavior]
- **Repeated request behavior:** [when duplicates are possible and how they resolve]
- **Failure / cancellation:** [rollback, partial completion, or explicit failure state]
- **Rule reference:** [document 03 IDs]

## 4. Content and authoring contract

- **Content representation:** [required capabilities; format may remain replaceable]
- **Stable identifiers:** [identity rules and reference validation]
- **Schema / field rules:** [required fields, types, units, ranges, and defaults]
- **Validation timing:** [authoring, loading, build, runtime, as appropriate]
- **Invalid content behavior:** [reject, report, disable entry, fallback, or other approved response]
- **Asset linkage:** [how missing or incompatible presentation assets are handled]
- **Versioning:** [how definitions evolve and old references behave]
- **Authoring workflow:** [how a designer adds and previews one item / level / rule]
- **External content / mods:** [supported surface and trust boundaries, or N/A]

Do not assume arbitrary scripting or a full editor is required. Define the smallest authoring capability that meets the approved scope.

## 5. State lifetime, saving, and recovery

| State category | Examples in this game | Lifetime / reset point | Persisted? | Authority |
| --- | --- | --- | --- | --- |
| [category] | [specific state] | [when created / cleared] | [yes / no / condition] | [owner] |

- **Save availability:** [when saving occurs or is allowed; mark N/A if no persistence]
- **Resume guarantee:** [exact player state restored, including any deliberate restart boundary]
- **Commit boundaries:** [how costs, rewards, and transitions avoid partial or duplicate application]
- **Save identity / version:** [slots, profiles, versions, compatibility policy]
- **Interrupted write behavior:** [required protection against partial saves]
- **Invalid / missing save behavior:** [validation, recovery, and player messaging]
- **Migration / incompatible version:** [supported handling or explicit rejection]
- **Reset / deletion:** [which data is removed and required interaction]
- **Player settings:** [whether settings persist separately from gameplay]

Validate meaningful structure and relationships, not just the existence of a file. Match the interruption behavior promised by document 02.

## 6. Time, randomness, and reproducibility

- **Time ownership:** [how gameplay time advances and relates to presentation]
- **Update-order guarantees:** [ordering required by gameplay rules]
- **Randomness contract:** [what is random and when results are committed]
- **Reproduction needs:** [seeded sessions, recorded commands, fixed scenarios, or other]
- **Determinism scope:** [same local run, same build, cross-platform, network lockstep, or not required]
- **Pause / slow motion / speed changes:** [effects on simulation and input, if supported]
- **Preview consistency:** [how predictions relate to committed results, if previews exist]

Do not promise cross-platform determinism merely because a random seed is recorded.

## 7. Networking and shared state — optional

Mark N/A for a game that does not need networking.

Specify authoritative ownership, synchronization requirements, latency expectations, prediction / correction behavior where relevant, joining / reconnecting, participant departure, incompatible versions, and acceptable failure behavior. Link player-facing consequences to document 02.

Define protections appropriate to the approved trust model. Avoid adding online services or account systems without a design requirement.

## 8. Performance, packaging, and diagnostics

| Constraint | Target conditions | Required threshold / behavior | Verification |
| --- | --- | --- | --- |
| Frame / interaction performance | [representative device and busy scenario] | [measurable target] | [measurement] |
| Loading / startup | [content and storage conditions] | [target] | [measurement] |
| Scale | [entities, effects, map size, or other load] | [supported bound] | [scenario] |
| Memory / storage | [target context] | [budget, if material] | [measurement] |
| Distribution / offline use | [launch environment] | [required operation] | [clean launch test] |

- **Diagnostics:** [information needed to reproduce a gameplay or content failure]
- **Player versus developer information:** [what is exposed where]
- **Required deliverables:** [source, content, playable package, launch instructions, checks, or other]
- **External dependencies:** [what may require installation, credentials, or connectivity]

Leave numeric thresholds OPEN until the target context is known.

## 9. Build milestones

Choose milestones that end in usable, verifiable play. A collection of disconnected systems is not a complete prototype.

| Milestone | Player-visible outcome | Included requirement IDs / content | Dependencies | Exit criteria | Exclusions |
| --- | --- | --- | --- | --- | --- |
| First playable | [smallest complete core interaction and outcome] | [IDs] | [dependencies] | [observable checks] | [excluded work] |
| Prototype | [complete loop proving the player promise] | [IDs] | [dependencies] | [experience and rule checks] | [excluded work] |
| First release | [bounded complete experience] | [IDs] | [dependencies] | [release checks] | [future work] |

Adjust milestone names and number to the project. Define a runnable result and a stop condition for each.

**Highest-risk assumptions to prove early:** [design or technical uncertainties and the smallest useful experiment for each].

**Scope change rule:** [who approves additions, tradeoffs, and deferred requirements].

## 10. Verification and definition of done

Keep acceptance scenarios in their owning documents and reference them here.

| Requirement / scenario IDs | Verification method | Representative setup | Expected evidence | Milestone |
| --- | --- | --- | --- | --- |
| [vis / flow / rule / art / ux IDs] | [automated check / playthrough / visual review / playtest] | [fixture] | [result, capture, or observation] | [scope] |

Use meaningful checks for exact rules, cross-system interactions, persistence boundaries, content validity, input behavior, and presentation fidelity as applicable. Do not substitute internal unit tests for a complete player journey.

A milestone is done when:

- [ ] Its approved player journey is launchable and completable.
- [ ] Applicable acceptance scenarios pass and their evidence is recorded.
- [ ] Rules, content, and presentation agree with their owning documents.
- [ ] Required failure, restart, and recovery paths work.
- [ ] Required delivery and launch instructions work in the target context.
- [ ] Known limitations and unverified claims are stated accurately.
- [ ] Remaining work is classified as a defect, an open decision, or future scope.

## 11. LLM working agreement

Fill in or approve these operating rules for the game-specific handoff:

1. Read the full specification before making dependent design choices.
2. Identify the current milestone and blockers; do not interpret all future scope as immediate work.
3. Ask about missing decisions that change player-visible behavior. Continue independent work when possible.
4. Record consequential technical choices within the permitted implementation freedom.
5. Implement and verify complete slices of the player experience.
6. Keep approved design changes synchronized across affected documents and acceptance scenarios.
7. Report demonstrated behavior and evidence separately from assumptions or unfinished work.

**Delivery report format:** [what was built; how to launch; what was verified; deviations; remaining blockers].

## 12. Open decisions and completion check

Link unresolved decisions to document 01: [IDs and impact].

- [ ] Fixed design requirements and replaceable implementation choices are distinguishable.
- [ ] State and rule ownership are clear at important boundaries.
- [ ] Save / interruption guarantees agree with the player journey.
- [ ] Optional systems are included only when the game requires them.
- [ ] Milestones have complete player-visible outcomes and bounded scope.
- [ ] An implementing LLM knows when to decide, when to ask, and how to prove completion.

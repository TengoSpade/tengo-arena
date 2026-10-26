# Arena League: fighter sprite pipeline research (AI-assisted)

> RESEARCH · 2026-10-25 · prepared by a research subagent for the owner. Nothing here is approved; owner decisions are in §12.
> Scope: how to make arena spritesheets for 42 classes × 5 races with team colours, using AI where it helps. No game code or content was changed.
> Convention: "(inference)" marks my own judgement or arithmetic. Everything else is cited by number (§13) or by a project file path. Prices and terms were checked in October 2026 and change often.
> **Owner constraint (applied throughout):** no option uses the PC's existing 3D asset pipeline: the `asset-gen` tooling (including its Hunyuan3D setup, `rigpipe.py`, the rigged villagers and `viewer.html`), the Synty packs, or the existing Blender rig and kit setup (§3). No pipeline is scored on fit with existing tools.

## 1. Summary and recommendation

**Primary: Pipeline C, AI 3D → 2D, built from new standalone tools.**

1. Templated concept images come from an image model with reference support.
2. A paid hosted 3D service turns them into characters: **Tripo** or **Meshy** (paid plans own their output) [11][12].
3. Characters are rigged on one humanoid skeleton (Mixamo's free auto-rigger, or the service's own rig) and get clips from free libraries (Mixamo, Quaternius CC0) [16][17].
4. A **new, standalone render project** (Blender started from scratch, or another offline renderer) renders every race × class × clip × direction with one fixed orthographic camera, light and outline. It also renders a **team-colour mask pass**.
5. A packer makes PixiJS atlases. At runtime a fighter is a base sprite plus two greyscale team layers, tinted with the club's two colours.

**Why C, on its own merits:** the renderer guarantees frame-to-frame and direction-to-direction consistency instead of hoping a model holds it. The 210 combinations cost machine time, not curation. Re-timing, new gear and new clips are cheap re-renders. *Dead Cells* used a 3D-to-2D pipeline for exactly these reasons [18].

**Costs of C:** a render project built from scratch (about 1–2 weeks), per-character rigging QA, and a team-mask step that is the main technical risk (§6).

**Fallback: Pipeline A, direct pixel-art generation** with PixelLab (or Retro Diffusion). It is quicker to start and has no render project to build, but frames drift and about 8,400 directional clips need curation [1][4][8].

**Decision gate:** the margin between A and C is narrow, so the PoC (§9) is a **bake-off**. It makes the same two fighters in both pipelines and plays them in one PixiJS harness, then the owner picks by criteria and style.

**Not recommended:** B (video to frames) for production use. E (Synty) is excluded by the owner.

## 2. What the design requires

From `docs/design/04-art-direction-and-presentation.md` (§3–§5, §9), `01` (T1) and `content/default/`:
- **View:** top-down orthographic, 32 × 18 m arena at about 52 px/m at 1080p; fighter radius 0.5 m, so tokens are about 52 px across. Zoom is OPEN for M2.
- **Readability (vis-003):** observers name both sides' tank and healer in at least 90% of prompts. The token keeps the side ring, role glyph and facing wedge, so **sprites add to the token and never replace it**. Colour is never the only cue.
- **research.md A4.2:** avoid summon clutter, invisible effects and tiny projectiles [37]; models must match their portraits [38].
- **Content:** 42 classes (30 single-role, 12 hybrid) with 168 abilities (`delivery`, `castTimeS`, `channel`), 5 races (human, elf, dwarf, orc, Ashkin) and 48 clubs with `colors.primary` and `colors.secondary`.
- **Scale (inference):** 210 combinations × ~8 animations × 5 rendered directions ≈ 8,400 directional clips.

## 3. Excluded by owner

The read-only check found these on the PC. The owner has excluded them, so nothing below builds on them:
- **`asset-gen`:** text → image → local Hunyuan3D-2GP → GLB, with headless Blender previews.
- **The villager rigging work:** `rigpipe.py`, the `*_rigged.glb` files and `viewer.html`, which the memory note mentions, were not found on disk.
- **The existing Blender kit and MCP workflow.**
- **The Synty folder:** POLYGON packs, Goblin Locomotion, and the Unity-only SIDEKICK packs. It has no elves, dwarves, orcs, Ashkin or combat clips.

For the record, on Synty licensing:
- Synty's FAQ allows commercial games but says "it is prohibited to resell our assets rendered as image files" [34].
- Synty's subscription licence covers development "while your subscription plan is active" [35].
- Unity's store terms bar using Asset Store content to train AI models [36].
- Nothing explicitly clears in-game sprites rendered from their models.

## 4. Candidate pipelines

### A. Direct 2D AI generation (PixelLab, Retro Diffusion, Scenario, Ludo, Layer and similar)
- **How it works:** generate a character, rotate it to 4 or 8 views, then animate it from a skeleton or a prompt.
  - **PixelLab:** 4- or 8-direction characters at about $0.01–0.06 per call; skeleton animation v3 up to 256 px and 3–15 frames, about $0.04–0.06; "Animate character Pro" up to 168 px at $0.08–0.15 per direction [1]. It has style references, inpainting, an API and an MCP server [2].
  - **Retro Diffusion:** image-driven walk, idle, attack and destroy at 32–256 px for $0.14 (4–16 frames), an 8-view rotate, and an `input_palette` colour lock [4].
  - **Scenario** hosts Retro Diffusion and trains custom style models. **Ludo** offers 8-direction sprites and 64-frame sheets [6][7].
- **Consistency:** good inside one clip. Proportions and details drift across 210 characters and across directions, so every clip needs review [8].
- **Effort and cost (inference):** about 8,400 directional clips at roughly $0.05–0.15 each is $400–1,300 with retries. Curation at 1–2 min per clip is **150–300 h**. Using 42 sprites × 4 directions (race shown by palette and heads) cuts this to about 1,350 clips.
- **Team colours:** good *if* the frames are quantised to a palette with reserved team ramps (§6).
- **Tooling:** web or API, with an Aseprite or Pixelorama flow [2].
- **Risks:** a fixed pixel-art look; size ceilings of 168 or 256 px [1][4]; drift; stray-pixel fixes; timing that is hard to align with simulation events.

### B. AI image → AI video → frames
- **How it works:** a base image is the first frame for Veo 3.1, Seedance or Kling. Frames are then extracted, keyed and assembled [7][9]: 8 frames for a run loop, 12–16 for attacks [7].
- **Consistency:** good within a short clip. Each direction is a separate generation, so the views do not match, and models add backgrounds and drift on longer clips [9].
- **Effort and cost:** Veo 3.1 Fast costs $0.10/s at 720p [10]. About 8,400 clips × 3 s ≈ $2,500 before retries, plus manual keying, looping and timing (inference).
- **Team colours:** poor; masks would be needed on every frame.
- **Risks:** perspective cameras, loop seams, and model churn (a Veo preview ID was reported retiring on 2026-10-22 [10]).
- **Verdict:** trailers or one-off VFX only.

### C. AI 3D → rig → animate → render to 2D (new standalone tools)
- **How it works:** concept image → hosted image-to-3D → auto-rig → library or AI clips → orthographic render → atlases.
- **Tools:**
  - *Generation:* Tripo (Pro $20/mo for 3,000 credits, about 200 models; free tier non-commercial) or Meshy (Pro $20/mo for 1,000 credits, about 30 per textured model; free output is CC BY 4.0) [11][12]. Rodin puts "any use" on its Business tier [15]. Hunyuan3D as a *new* install carries a territory clause [13]. TRELLIS.2 is MIT-licensed but reported to need 16–24 GB of VRAM and Linux [14].
  - *Rigging:* Mixamo (free, bipedal, royalty-free in games) [16], AccuRIG (free), or the services' own rigs [11].
  - *Clips:* Mixamo; Quaternius Universal Animation Library (CC0, 120+ clips including combat and death) [17]; Meshy's library and text-to-motion (20 clips free, 600+ paid) [11][12].
- **Consistency:** exact across frames and directions, because the same model, camera and light are used. Character-to-character consistency depends on the concept templates and on fixed render settings (inference).
- **Effort (inference):** about 7–9 weeks of agent-assisted work: render project 1–2 weeks, concepts 1 week, 210 characters plus about 70 props at roughly 20 min each, a clip set of 1–2 weeks, and render plus QA 1 week. After that, a new class costs a few generations and a clip mapping.
- **Cost (inference):** about $40–150 in credits for generation only (Tripo needs about 15 credits per model [11]), with rigging and clips done free through Mixamo. Using the services' paid rigging and clips instead costs about 2–4× more.
- **Team colours:** exact for props (material masks). For bodies, the colours are keyed from marker colours in the generated textures, which is the main risk (§6).
- **Risks:** fused meshes, baked lighting in textures and weak joint deformation; a generic 3D look unless outline, palette and shape rules are enforced; changes to vendor credit prices; Mixamo uploads are manual (inference).

### D. Hybrid modular paper doll
- **At runtime (2D layers):** a race body plus class gear layers composited in PixiJS. Every layer must stay in sync per frame and direction, and the draw order flips with facing (a shield is in front facing south, behind facing north). With AI-drawn layers this is the hardest variant to keep consistent (inference).
- **At build time (3D):** class props such as weapons, shields and staffs are generated once per class and attached to hand bones of every race's model, and the renderer bakes occlusion. **This is the form used inside C.** It keeps role silhouettes identical across races (inference).
- **Team colours:** easy either way. Runtime layering remains only for small overlays (captain crown, status icons).

### E. Licensed packs (Synty) rendered to 2D
Excluded by the owner (§3). Not evaluated further.

## 5. Comparison

| | A. 2D AI | B. Video → frames | C. AI 3D → render (standalone) | D. Runtime 2D paper doll |
| --- | --- | --- | --- | --- |
| Frame-to-frame consistency | Good per clip | Good per clip, poor across directions | Exact | Medium (layer sync) |
| Character-to-character consistency | Medium–low | Low | Medium–high (templates + fixed render) | Medium |
| Effort for 210 × ~8 anims | 150–300 h curation | Very high | 7–9 weeks, front-loaded | Very high authoring |
| Cash cost | ~$400–1,300 | ~$2,500+ | ~$40–150 (more with paid rigging and clips) | Depends on source |
| Team colours | Palette ramps (good for pixel art) | Poor | Material masks (props) + keyed masks (bodies) | Easy (layers) |
| Legal risk | Low–medium | Medium | Low–medium | Depends |
| New tooling needed | Web or API tool, small post-processing script | Video API, keying, extraction | Hosted 3D service, Mixamo, a new render project, packer | Layer authoring tool plus a runtime compositor |

All figures are estimates (inference) built on the prices in §4. E is excluded by the owner.

## 6. Team colours

Requirement: 48 clubs × 2 colours, recoloured per match with no extra art.

- **Tinted mask layers (recommended runtime for both A and C).** PixiJS v8 `tint` multiplies the rendered colour, and `0xFFFFFF` means no tint [22]. Each frame becomes three layers:
  - *base:* everything except the team areas;
  - *primary:* the greyscale shading of the team-A areas;
  - *secondary:* the same for team B.

  At runtime, three stacked AnimatedSprites share frame indices, with `tint` set to `colors.primary` and `colors.secondary`. There is no custom shader, and the greyscale keeps the folds and lighting (inference).

  Upgrade path: pack the masks as R and G channels of one texture and use a small custom v8 shader, which frees a channel for skin or hair tints.
- **Producing masks in C.**
  - *Props:* assign `TEAM_A` and `TEAM_B` materials and output them through a render AOV; this is exact.
  - *Bodies:* the concept marks team areas in pure magenta and cyan. After image-to-3D, texels near those hues are keyed into the two masks and repainted neutral grey. Keying can bleed at edges, so the PoC must test it. The fallback is to paint the mask by hand on the mesh, about 10 min per model (inference).
- **Producing masks in A.** Use palette indices, as Wargroove did for faction colours and skin tones "at no extra work per unit" [21]:
  1. Reserve two ramps for team colours.
  2. Force the output onto the palette, with Retro Diffusion's `input_palette` [4] or by quantising afterwards.
  3. Map the reserved ramps to the same greyscale team layers, so A and C share one runtime (inference).
- **ColorMatrix or hue shift:** not recommended; it cannot hit exact club hex values (inference).
- **Colour clash rule (inference, extends 04 asset-006):** when the two sides' primaries are close (Lanternguard `#1A2D5A` against Sealspears `#4C56C4`), the away side becomes secondary-dominant. The side ring stays the authoritative side cue.

## 7. Readability and role silhouettes

- **Silhouette control:**
  - C controls silhouettes through shared class props and concept templates, and can test them by rendering a flat black silhouette pass.
  - A controls them only through prompts and references, then needs a manual check.
  - B barely controls them (inference).
- **Silhouette language (proposed, echoing the UI glyphs; inference):**

| Role | Silhouette signature (top-down 3/4) |
| --- | --- |
| Tank | Widest mass; a large heater or tower shield facing forward; heavy shoulders |
| Melee | Lean and tilted forward; exposed blades making points (diamond); twin weapons or a long blade |
| Ranged | A long weapon line (bow, crossbow, sling arm); a light peaked hood (triangle) |
| Controller | A wide hem or cloak (hourglass waist); a staff or rod with an ornament above the head |
| Healer | Round elements (ring censer, round shield, book); a cross motif on the back where the camera sees it |
| Hybrid | The primary role's mass plus one accent from the second role (for example the Vowknight's shield plus a censer) |

- **Rules:** team colour on large camera-facing areas (shoulders, back, cape, shield face; inference); a dark neutral outline; the shadow blob drawn in PixiJS; portraits and class icons rendered later from the same models so they match [38]; large, telegraphed VFX [37].
- **Acceptance:** a silhouette-only screenshot of a 5v5 still passes vis-003's 90% target.

## 8. Recommended pipeline (C), step by step

**8.1 Tools (all new and standalone).**

| Step | Tool |
| --- | --- |
| Concepts | An image model with multi-reference input (e.g. GPT Image or Gemini through Scenario, or a Scenario custom model [7]) |
| Image-to-3D | Tripo or Meshy, paid plan |
| Rigging | Mixamo auto-rigger |
| Clips | Mixamo and Quaternius UAL |
| Rendering | A new Blender project in `art-src/fighters/` with fresh scripts; nothing reused from the excluded kit (Q8) |
| Post-processing | Python (Pillow, numpy) |
| Packing | PixiJS AssetPack |
| Runtime | PixiJS v8 |

**8.2 Character set.**
- **Concept template:** one per race (proportions, A-pose, palette) and one per class (outfit, team areas in magenta and cyan). Each race × class concept is generated from both references, giving 210 images; reject any that break proportions.
- **Models:** each concept becomes a whole-character mesh of about 10k faces. Weapons, shields and staffs are separate props, about 70 in total, attached to the hand bones.
- **Rig and clips:** every model is rigged to the **Mixamo skeleton**, so every clip applies to every race unchanged.

**8.3 Render settings.**
- **Camera:** orthographic, with one fixed `ortho_scale` for *all* combinations, so dwarves read shorter. Elevation about 40°, within the common 30–60° range [19] (Q5).
- **Engine and colour:** EEVEE, transparent film, Standard view transform.
- **Light:** a sun fixed in *world* space from the north-west, plus soft fill and ambient occlusion.
- **Outline:** Freestyle or an inverted hull, about 1.5 px at master size [20].
- **Size:** 256 px master cells for the @2x set, downsampled to 128 px for 1×. A feet pivot is written as the frame `anchor` [23].
- **Passes:** Combined, plus an AOV for the props' team materials.
- **Timing:** 12 fps (inference).
- **Machine time:** about 75,000 frames × ~0.3 s ≈ 6–7 h for everything (inference).

**8.4 Directions.** Render **5 directions (S, SE, E, NE, N) and mirror 3 (SW, W, NW)** with `scale.x = -1`; mirrored fighters swap hands, which is acceptable at this size (inference). If memory is tight, render 3 (S, E, N) and mirror W.

**8.5 Animations and frame counts** (12 fps; inference):

| Anim | Frames | Loop | Data |
| --- | --- | --- | --- |
| idle | 8 | yes | — |
| move | 8 | yes | stride matched to `moveSpeedMps` |
| basic (melee, shoot or cast) | 8 (cast 10) | no | `events.hit` (contact or release frame) |
| active1 / active2 | 10–12, split into start, loop and end when channelled | no | `events.hit`; loop segment for `channel` |
| hit | 4 | no | — |
| down (KO) | 8, hold the last frame | no | — |
| victory | 10 | yes | optional; can be shared per race |

- **Shared clip library:** map the 168 abilities to about 30 shared clips using `delivery`, `castTimeS` and `tags`. The library covers idles, moves, about 8 basic families (1H with shield, 2H, bow, crossbow, cast and so on), about 10 generic actives (slam, dash, shield bash, channel, heal-ally, throw-net and so on), and hit, down and victory (inference).

**8.6 Naming and folders.**
- **Render frames:** `art-src/fighters/renders/{race}_{class}/{race}_{class}_{anim}_{dir}_{frame}.png`, plus a matching `….team.png`. Example: `human_phalanx_sergeant_attack-1h-shield_se_03.png`.
- **Parsing:** anim ids use hyphens and class ids keep their underscores, so parse from both ends: race first; direction and frame last; the anim just before them; the rest is the class.
- **Atlases:** `public/assets/fighters/{race}_{class}.json/.png` with animation keys `{anim}_{dir}`. The team atlas `{race}_{class}.team.json` uses `{anim}_{dir}_p` and `{anim}_{dir}_s`, and the `@2x` set sits alongside [25].
- **Sources:** the `.blend` and GLB sources stay in `art-src/`, never in `src/`.

**8.7 Packing.**
- Trim the frames, then pack them with AssetPack, which splits sheets above `maximumTextureSize` (default 4096) and makes `@0.5x` variants [27].
- Alternatives: free-tex-packer-core, which has a Pixi exporter [28]. TexturePacker is free only for non-commercial use [26].
- A post-step writes the `animations` map and `meta.events` explicitly; PixiJS reads `frames`, `animations` and `meta` [23].

**8.8 Content JSON hook (a proposal; `content/` is not edited here).** A new `content/default/sprites.json`:
```json
{ "cell": 128, "fps": 12, "dirs": ["s","se","e","ne","n"], "mirror": {"sw":"se","w":"e","nw":"ne"},
  "atlas": "fighters/{race}_{class}", "fallback": ["fighters/human_{class}", "token"],
  "clips": { "attack-1h-shield": { "frames": 8, "loop": false, "events": { "hit": 4 } } },
  "classes": { "oathguard": { "idle": "idle-shield", "move": "walk-shield", "basic": "attack-1h-shield",
                              "abilities": { "<abilityId>": "dash-guard" }, "hit": "hit", "down": "down-back" } } }
```
Reskinning means swapping atlases or remapping clips, with no code change. A missing atlas falls back to the M2 token and logs a dev warning, as 05 already specifies for icons.

**8.9 PixiJS loading (prose outline).**
1. At match load, collect the distinct (race, class) pairs from both lineups and resolve their aliases through `sprites.json` and its fallbacks.
2. `Assets.load` the base and team atlases [23][25].
3. Build each fighter as a `Container` holding: a shadow; the existing token (ring, glyph, wedge); a body container with three `AnimatedSprite`s (base, primary-tinted, secondary-tinted); then bars and badges.
4. Create the sprites with `autoUpdate: false` [24], and let the replay clock set `currentFrame` from simulation time. This keeps 1×/2×/4×, pause and scrubbing exact (T4).
5. Turn the facing angle into one of 8 sectors, then into a direction and a mirror flag.
6. Start attack and cast clips so that `events.hit` lands on the impact tick.
7. Show hit flashes with an additive overlay that respects reduced motion.
8. Unload the atlases after the match.

**8.10 Resolution and memory (inference).** At 52 px/m and about 40°, a human is roughly 70–90 px tall at 1×. So use 128 px cells at 1× and load @2x only at zoom ≥ 1.5×. About 70 frames per direction:

| Setting | Frames per combination | RGBA per combination incl. team layers | 10 fighters on screen |
| --- | --- | --- | --- |
| 8 directions (5 rendered), 128 px | ~350 | ~17 MB (one 2048² page + team page) | ~170 MB |
| 4 directions (3 rendered), 96 px | ~210 | ~6 MB | ~60 MB |

Keep pages at 2048² or less (4096 at most; the limit depends on the GPU). On disk, 210 combinations take about 0.4–1.2 GB of PNG at the high setting. Lossless WebP, the low setting, or dropping @2x reduces that.

## 9. Proof of concept: A vs C bake-off

**Goal:** settle the pipeline and the art style with evidence before committing weeks of work.

**Shared scope:**
- 1 race (human) × 2 classes (oathguard, a shield tank; longeye, a bow ranged DPS) × idle, basic attack and hit.
- 5 rendered directions, 128 px cells.
- Two club pairings: Lanternguard `#1A2D5A/#F2B83B` against Ninth Oar `#8C1C2C/#EDE4D3`, and the clash case Lanternguard against Sealspears `#4C56C4/#F0DC9A`.
- One stand-alone PixiJS v8 test page outside `src/`, showing 10 fighters at 1080p at 1× and 4× speed, with the tinted-layer runtime of §6.

| Step | Track C (3D → 2D) | Track A (PixelLab) |
| --- | --- | --- |
| Concepts | 2 templated concepts with magenta and cyan team marks (1–2 h) | Reference image and palette with 2 reserved team ramps (1 h) |
| Assets | Tripo or Meshy: 2 characters + 3 props (2–3 h) | Characters with 8 directions at 128 px (1 h) |
| Motion | Mixamo auto-rig; idle, sword-and-shield attack, bow shot, hit (1–2 h) | Animate idle, attack and hit × 5 directions × 2 classes, about 30 calls (2–3 h with retries) |
| Frames | New render project: camera, light, outline, AOV, mask keying, 5 directions (1.5–2 days) | Quantise, then split the reserved ramps into team layers (2–3 h) |
| Pack + harness | Shared: AssetPack, JSON events, tinted layers, simulation-clock frames (0.5–1 day) | |

- **Time (inference):** about 4–5 working days in total (C about 3 days, A about 1 day, harness about 1 day).
- **Cash:** about $35–45, for one month each of Tripo or Meshy Pro ($20) [11] and PixelLab ($12–24) [6].
- **Pass criteria, for each track:** no identity drift across frames and directions; exact club hex values in lit areas with no mask fringe; the clash pair still separable by side; roles nameable from a greyscale silhouette at 1×; 60 fps at 4× speed with texture memory under ~150 MB; the contact frame within one frame of the simulation event; measured minutes and dollars per combination, extrapolated to 210.
- **Decision:** choose the track that passes more criteria; if they tie, the owner's style preference decides.

## 10. Legal and platform

- **Steam disclosure:**
  - The Content Survey's generative AI section covers "content that ships with your game and is consumed by players", and says "Efficiency gains through the use of these tools is not the focus" [29].
  - *Pre-generated* content made with AI during development is reviewed like any other content. *Live-generated* content (made while the game runs) must also describe its guardrails [29].
  - Press coverage dates this revision to January 2026 and says the disclosures appear on the store page [30][31].
  - Both A and C are **pre-generated only**, and their AI output ships, so disclose it.
  - Suggested wording for C: "Character models and some textures were made with AI-assisted 3D generation from our own concept art, then rigged, animated, edited and rendered by the developer. Nothing is generated while you play."
- **Copyright of outputs:**
  - The US Copyright Office says prompts alone do not make the user the author. Perceptible expressive human input, creative selection and arrangement, and substantial modification can be protected [32].
  - The Supreme Court denied certiorari in *Thaler v. Perlmutter* on 2 March 2026, leaving the human-authorship rule in place [33].
  - In practice, raw AI meshes and frames may be unprotectable. Human-made concepts, animation edits, composites and the game as a whole carry more protection (inference). Log prompts, seeds and tool versions for each asset.
- **Tool licences:**

| Tool | Terms |
| --- | --- |
| PixelLab | User owns outputs; no training models on them [3] |
| Retro Diffusion | Claims training on licensed art with artists' consent [5]; output terms not found, so check |
| Meshy | Paid plans: user owns output; free plan: CC BY 4.0 with attribution [12] |
| Tripo | Free tier is non-commercial [11] |
| Rodin | "Any use" on the Business tier [15] |
| Mixamo | Royalty-free in commercial games [16] |
| Quaternius UAL | CC0 [17] |
| TRELLIS.2 | MIT [14] |
| Hunyuan3D 2.0 | Licence "does not apply in the European Union, United Kingdom and South Korea"; more than 1M MAU needs a licence from Tencent; outputs may not be used to improve other models [13] |

- **Training data:** most vendors do not disclose their training sets. The developer still promises Valve that the game contains no infringing content [29]. Never prompt with other games' names or characters; work from original concepts.

## 11. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| C: cross-character style drift between 210 generated models | Strict race and class concept templates; fixed render, outline and palette; review per role family; regenerate with seeds logged |
| C: team-mask keying bleeds at edges | PoC test; hand-paint masks on failures (~10 min per model) |
| C: baked lighting and joint artefacts in AI meshes | Neutral-light concepts; rigid props; close-fitting outfits |
| C: building the render project from scratch takes longer than planned | Time-box it in the PoC; ready-made add-ons exist [19][20] |
| A: drift and curation load | Reduced scope (42 sprites, 4 directions); palette lock [4] |
| VRAM and disk size | 4-direction or 96 px setting; per-match load and unload; WebP; @2x only when zoomed |
| Vendor plan or price changes | Export and archive GLBs and clips at once; keep CC0 and Mixamo clips locally |
| Animation timing out of sync with the simulation | `events.hit` metadata; frames driven by the simulation clock |
| Clutter and readability | Silhouette tests; tokens stay; VFX budget per TFT lessons [37] |

## 12. Open questions for the owner

1. **Art style:** 3D-rendered toon or painted (C), or pixel art (A)? The bake-off is designed to show both.
2. **Does race need to read in the arena?** If not, 42 sprites replace 210. Is gender or body variety wanted (04 §10 mentions it for portraits)? That would double the count.
3. **Budget and vendors:** about $40–150 in credits for C (Tripo or Meshy), or $400–1,300 for A at full scope? Is a TexturePacker licence wanted, or the free packers?
4. **Camera:** a true overhead view, or a 3/4 "top-down" view at about 40°? 8 or 4 directions? Is zoom 2× (and so @2x assets) confirmed for M2?
5. **Per-fighter variety:** should fighters vary in skin, hair or helmets beyond race × class? That needs the mask-channel shader upgrade (§6).
6. **Steam label:** are you comfortable with an AI-content disclosure on the store page (needed for both A and C)?
7. **Location:** only relevant if Hunyuan3D is ever considered; its licence excludes the EU, UK and South Korea.
8. **Blender itself:** may C use Blender as a new standalone render project, or must the render step avoid Blender entirely? The alternative is a new offline three.js renderer, which would add about a week (inference).

## 13. Sources

1. PixelLab, API endpoints and prices — https://www.pixellab.ai/pixellab-api
2. PixelLab, features — https://www.pixellab.ai/
3. PixelLab, Terms of Service (updated 23 Nov 2025) — https://www.pixellab.ai/termsofservice
4. Retro Diffusion, API examples (animation styles, sizes, prices) — https://github.com/Retro-Diffusion/api-examples
5. Retro Diffusion on itch.io (training-data statement) — https://astropulse.itch.io/retrodiffusionai
6. Ludo, "9 Best AI Sprite Generators in 2026" (Oct 2026; vendor-authored, ranks itself first) — https://ludo.ai/compare/best-ai-sprite-generators
7. Scenario, "AI Sprite Generator for 2D Games" (27 Apr 2026) — https://www.scenario.com/blog/ai-sprite-generator
8. aldegad/sprite-gen (identity drift in generated sprites) — https://github.com/aldegad/sprite-gen
9. TamerinTECH, Kling image-to-sprite skill — https://github.com/TamerinTECH/claude-skill-klingai-animation
10. BenchLM, Veo 3.1 API pricing (read from Google's page, Sep 2026) — https://benchlm.ai/media-pricing/veo
11. Ludo, "Best AI Auto-Rigging and Animation Tools (2026)" (Oct 2026; vendor-authored) — https://ludo.ai/compare/best-ai-auto-rigging-tools
12. Meshy, "Can I use Meshy assets commercially" and Animation Library — https://intercom.help/meshy/en/articles/16102098-can-i-use-meshy-assets-commercially ; https://www.meshy.ai/animation-library
13. Tencent Hunyuan 3D 2.0 Community License — https://github.com/Tencent-Hunyuan/Hunyuan3D-2/blob/main/LICENSE
14. Microsoft TRELLIS.2-4B model card — https://huggingface.co/microsoft/TRELLIS.2-4B
15. Hyper3D Rodin pricing — https://hyper3d.ai/pricing
16. Adobe, Mixamo FAQ — https://helpx.adobe.com/ca/creative-cloud/faq/mixamo-faq.html
17. Quaternius, Universal Animation Library — https://quaternius.com/packs/universalanimationlibrary.html
18. T. Vasseur, "Art Design Deep Dive: Using a 3D pipeline for 2D animation in Dead Cells", Game Developer (25 Jan 2018) — https://www.gamedeveloper.com/production/art-design-deep-dive-using-a-3d-pipeline-for-2d-animation-in-i-dead-cells-i-
19. BlenderSpriteGenerator (top-down camera guidance) — https://github.com/aurodev/BlenderSpriteGenerator
20. True Pixel Art Generator docs (outline and pixel pipeline in Blender) — https://superhivemarket.com/products/true-pixel-art-generator-v2/docs
21. Wargroove, "Palette Swapping" — https://wargroove.com/palette-swapping/
22. PixiJS v8 guide, scene objects (tint) — https://pixijs.com/8.x/guides/components/scene-objects
23. PixiJS API, Spritesheet — https://pixijs.download/release/docs/assets.Spritesheet.html
24. PixiJS API, AnimatedSprite — https://pixijs.download/release/docs/scene.AnimatedSprite.html
25. CodeAndWeb, "How to create sprite sheets & animations for PixiJS 8" — https://www.codeandweb.com/texturepacker/tutorials/how-to-create-sprite-sheets-and-animations-with-pixijs
26. CodeAndWeb, "Is TexturePacker free?" — https://www.codeandweb.com/texturepacker/knowledgebase/is-texturepacker-free
27. PixiJS AssetPack, texture-packer pipe — https://pixijs.io/assetpack/docs/guide/pipes/texture-packer/
28. free-tex-packer-core README — https://cdn.jsdelivr.net/npm/free-tex-packer-core@0.3.8/README.md
29. Steamworks, Content Survey (generative AI section) — https://partner.steamgames.com/doc/gettingstarted/contentsurvey
30. Notebookcheck, Steam AI disclosure form update (17 Jan 2026) — https://www.notebookcheck.net/Steam-updates-AI-disclosure-form-requiring-developers-to-report-visible-and-in-game-AI-but-not-background-tools.1206103.0.html
31. VGC, "Steam pages will now disclose which games use AI-generated content" (Jan 2024) — https://www.videogameschronicle.com/news/steam-pages-will-now-disclose-which-games-use-ai-generated-content/
32. US Copyright Office, release of Part 2: Copyrightability (29 Jan 2025) — https://copyright.gov/newsnet/2025/1060.html
33. SCOTUSblog, *Thaler v. Perlmutter* (cert. denied 2 Mar 2026) — https://www.scotusblog.com/cases/case-files/thaler-v-perlmutter
34. Synty, FAQ — https://syntystore.com/community/faq
35. Synty, licences overview (seen through search excerpts only; direct fetches returned HTTP 429) — https://syntystore.com/pages/licences-overview
36. Unity, "Can I use assets to train AI models" (13 Aug 2025) — https://support.unity.com/hc/en-us/articles/16455448218516-Can-I-use-assets-to-train-AI-models
37. Riot, "/dev: TFT Rise of the Elements Learnings" (via `docs/research.md` A4.2) — https://dtcl.vnggames.com/en-us/news/dev/dev-tft-rise-of-the-elements-learnings
38. Riot, "Splash Art Returns to Teamfight Tactics" (via `docs/research.md` A4.2) — https://teamfighttactics.leagueoflegends.com/en-gb/news/dev/splash-art-returns-to-teamfight-tactics/

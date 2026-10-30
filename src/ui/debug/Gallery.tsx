/**
 * Dev-only component gallery (#/dev/components) so the UI designer can
 * review every shared component against mockups/components.html in both
 * themes. Sample values are EXAMPLE data; names come from content.
 */
import { useState } from 'preact/hooks';
import {
  Callout,
  CapMeter,
  Chip,
  ClassTag,
  ConfirmButton,
  Crest,
  DataTable,
  Delta,
  Empty,
  FighterName,
  FormStrip,
  Icon,
  Meter,
  Modal,
  Money,
  PageHeader,
  Panel,
  Pips,
  Portrait,
  Progress,
  Rating,
  RoleBadge,
  RoleGlyph,
  RowMark,
  RuleLine,
  Segmented,
  Stars,
  StatBar,
  TabPanel,
  Tabs,
  Tag,
  TraitBadge,
  TraitDots,
  showToast,
  tipAttrs,
  type Column,
} from '../components';
import { ruleParts } from '../format/rules';
import { useStore } from '../store';

interface SampleRow {
  id: string;
  name: string;
  rating: number;
  wage: number;
}

const ROWS: SampleRow[] = [
  { id: 'a', name: 'Brannoc Hale', rating: 62, wage: 360 },
  { id: 'b', name: 'Mira Quillon', rating: 65, wage: 335 },
  { id: 'c', name: 'Seren Ilvane', rating: 55, wage: 275 },
  { id: 'd', name: 'Pell Marrow', rating: 38, wage: 110 },
];

export default function Gallery() {
  const store = useStore();
  const content = store.content.value;
  const [tab, setTab] = useState<'a' | 'b' | 'c'>('a');
  const [seg, setSeg] = useState<'x' | 'y'>('x');
  const [chip, setChip] = useState(true);
  const [modal, setModal] = useState(false);
  const [sel, setSel] = useState<string | null>('b');
  const klass = content?.classes.list[0];
  const hybrid = content?.classes.list.find((k) => k.archetypes.length > 1);
  const traits = content?.traits.list.slice(0, 3) ?? [];
  const preset = klass ? content?.presets.get(klass.defaultPresetId) : undefined;
  const roles = content?.combat.archetypes ?? [];
  const columns: Column<SampleRow>[] = [
    { id: 'name', header: 'Fighter', fill: true, sortValue: (r) => r.name, cell: (r) => <FighterName name={r.name} role="tank" race="human" /> },
    { id: 'rating', header: 'Rating', align: 'num', sortValue: (r) => r.rating, cell: (r) => <Rating value={r.rating} tip={`Rating ${r.rating}`} /> },
    { id: 'wage', header: 'Wage / wk', align: 'num', sortValue: (r) => r.wage, cell: (r) => <Money amount={r.wage} unit={false} tip="Wage per week" /> },
  ];

  return (
    <section class="page" data-testid="gallery">
      <PageHeader eyebrow="Dev build" title="Component gallery" meta={['src/ui/components', 'Compare with docs/design/mockups/components.html']} />
      <div class="l-grid">
        <Panel span={6} title="Buttons, tags, chips">
          <div class="l-stack">
            <div class="l-cluster">
              <button class="btn btn--primary" type="button">
                Primary
              </button>
              <button class="btn" type="button">
                Default
              </button>
              <button class="btn btn--ghost" type="button">
                Ghost
              </button>
              <button class="btn btn--danger" type="button">
                Danger
              </button>
              <ConfirmButton title="Release Brannoc Hale" confirmLabel="Release for 10,620 ts" variant="danger" confirmVariant="danger" warning="A release cannot be undone." consequences={[{ label: 'Balance after', value: '1,220 ts' }, { label: 'Roster after', value: '10 / 12' }]} onConfirm={() => showToast({ title: 'Released', kind: 'good' })}>
                ConfirmButton
              </ConfirmButton>
            </div>
            <div class="l-cluster">
              <Tag>Neutral</Tag>
              <Tag kind="good" icon="check">
                Fit
              </Tag>
              <Tag kind="bad" icon="injury">
                2 wk
              </Tag>
              <Tag kind="warn">Ends S3</Tag>
              <Tag kind="info">Rookie</Tag>
              <Tag kind="accent">Next</Tag>
              <Tag kind="outline">VC</Tag>
            </div>
            <div class="l-cluster">
              <Chip pressed={chip} onClick={() => setChip(!chip)} count={11}>
                All
              </Chip>
              <Segmented label="Sample" value={seg} onChange={setSeg} options={[{ id: 'x', label: 'Overview' }, { id: 'y', label: 'Attributes' }]} />
              <button class="btn btn--sm" type="button" onClick={() => showToast({ title: 'Kael Dunmere to the front row', kind: 'accent', undo: () => showToast({ title: 'Undone', kind: 'info' }) })}>
                Toast with Undo
              </button>
              <button class="btn btn--sm" type="button" onClick={() => setModal(true)}>
                Modal
              </button>
            </div>
          </div>
        </Panel>
        <Panel span={6} title="Roles, ratings, money">
          <div class="l-stack">
            <div class="l-cluster">
              {roles.map((r) => (
                <RoleGlyph key={r.id} role={r.id} size="lg" tip={r.name} />
              ))}
              {roles.map((r) => (
                <RoleBadge key={r.id} role={r.id} name={r.name} />
              ))}
            </div>
            <div class="l-cluster">
              {klass && <ClassTag name={klass.name} roles={klass.archetypes} />}
              {hybrid && <ClassTag name={hybrid.name} roles={hybrid.archetypes} roleNames={hybrid.archetypes.map((a) => roles.find((r) => r.id === a)?.name ?? a)} />}
              <Rating value={38} tip="Band 1" />
              <Rating value={52} tip="Band 2" />
              <Rating value={62} tip="Band 3" />
              <Rating value={74} tip="Band 4" />
              <Rating value={62} size="lg" tip="Large" />
              <Stars potential={66} />
            </div>
            <div class="l-cluster">
              <Money amount={11840} tip="Balance" />
              <Money amount={-2398} tone tip="This week" />
              <Money amount={1552} signed tone tip="Last week" />
              <Delta value={2} tip="+2" />
              <Delta value={-1} tip="−1" />
              <FormStrip results={[{ r: 'W' }, { r: 'L' }, { r: 'W' }, { r: '-' }]} />
            </div>
          </div>
        </Panel>
        <Panel span={4} title="Stat bars">
          <div class="stat-list">
            <StatBar label="Strength" value={15} cap={16} delta={0} tip="Strength 15. Ceiling 16." />
            <StatBar label="Toughness" value={16} cap={17} delta={1} tip="Toughness 16" />
            <StatBar label="Agility" value={9} cap={11} peak={11} delta={-1} tip="Agility 9 (wear −2)" />
            <StatBar label="Awareness" value={4} cap={9} tip="Awareness 4" />
          </div>
        </Panel>
        <Panel span={4} title="Identity">
          <div class="l-stack">
            <div class="l-cluster">
              <Crest primary="#2f5d46" secondary="#b8893a" code="TW" size="xl" />
              <Crest primary="#2f5d46" secondary="#b8893a" code="TW" size="lg" />
              <Crest primary="#f4f1e8" secondary="#e9e5dc" code="LT" size="md" />
              <Crest primary="#2f5d46" secondary="#b8893a" />
              <Portrait size="lg" role="tank" race="dwarf" />
              <Portrait role="healer" race="elf" />
              <Portrait size="sm" role="melee" race="orc" injured />
            </div>
            <FighterName name="Brannoc Hale" href="#/squad" role="tank" race="human" captain="captain" />
            <FighterName name="Mira Quillon" role="ranged" race="elf" captain="vice" rookie />
            <div class="l-cluster">
              <RowMark row="front" />
              <RowMark row="back" />
              <RowMark row="bench" />
            </div>
          </div>
        </Panel>
        <Panel span={4} title="Traits, meters">
          <div class="l-stack">
            <div class="trait-list">
              {traits.map((tr, i) => (
                <TraitBadge key={tr.id} name={tr.name} polarity={i === 0 ? 'pos' : i === 1 ? 'neg' : 'rare'} tip={tr.effectText} />
              ))}
            </div>
            <TraitDots traits={traits.map((tr, i) => ({ id: tr.id, polarity: i === 0 ? 'pos' : i === 1 ? 'neg' : 'rare', tip: tr.name }))} />
            <Meter value={0.91} mark={1} state="warn" />
            <Progress value={0.59} from={0.48} tip="Season XP" />
            <span {...tipAttrs('Roster 11 of 12')}>
              <CapMeter used={11} cap={12} reserved={1} />
            </span>
          </div>
        </Panel>
        <Panel span={6} title="DataTable" body="flush">
          <DataTable label="Sample roster" variant={['dense']} columns={columns} rows={ROWS} rowKey={(r) => r.id} selectedKey={sel} onSelect={(k) => setSel(k)} />
        </Panel>
        <Panel span={6} title="Tabs, rules, states" bodyClass="l-stack">
          <Tabs idPrefix="gal" label="Sample tabs" selected={tab} onSelect={setTab} tabs={[{ id: 'a', label: 'Overview' }, { id: 'b', label: 'Tactics', count: 3 }, { id: 'c', label: 'Contract', kbd: 'T' }]} />
          <TabPanel idPrefix="gal" id={tab} selected={tab}>
            {preset && klass && content ? (
              <ol class="rule-list">
                {preset.rules.map((r) => (
                  <li key={r.id}>
                    <RuleLine parts={ruleParts(r, klass, content)} />
                  </li>
                ))}
              </ol>
            ) : null}
          </TabPanel>
          <Callout kind="warn" title="Spending embargo">
            New contracts above the tier minimum are refused.
          </Callout>
          <Empty compact icon="check" title="Nothing needs you this week" text="Press Continue when you are ready." />
        </Panel>
        <Panel span={6} title="Choices: option cards, choice cards, pips" bodyClass="l-stack">
          <fieldset class="option-group">
            <legend class="field__label">Pacing</legend>
            {['Hands-on', 'Balanced'].map((name, i) => (
              <label key={name} class="option-card">
                <input type="radio" name="gal-pacing" defaultChecked={i === 1} />
                <span class="option-card__body">
                  <span class="option-card__name">{name}</span>
                  <span class="option-card__text">Stops before every match and at each offer answer.</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div class="l-autogrid" style={{ '--autogrid-min': '10rem' }}>
            <button type="button" class="card card--choice" aria-pressed="true">
              <strong>Selected</strong>
              <Pips value={2} max={3} label="Complexity 2 of 3" />
            </button>
            <button type="button" class="card card--choice" aria-pressed="false">
              <strong>Not selected</strong>
              <Pips value={1} max={3} label="Complexity 1 of 3" />
            </button>
          </div>
        </Panel>
        <Panel span={6} title="Calendar strip, outcome banner" bodyClass="l-stack">
          <div class="cal-strip">
            <ol class="cal-strip__weeks" role="list" style={{ '--cols': 4 }}>
              <li class="cal-week is-past" data-result="won">
                <div class="cal-week__head"><span class="cal-week__id">MW1</span></div>
                <div class="cal-week__label" />
                <span class="cal-week__match">vs Dunsalt</span>
              </li>
              <li class="cal-week is-past" data-result="lost">
                <div class="cal-week__head"><span class="cal-week__id">MW2</span></div>
                <div class="cal-week__label" />
                <span class="cal-week__match">at Varrow</span>
              </li>
              <li class="cal-week" aria-current="date">
                <div class="cal-week__head"><span class="cal-week__id">MW3</span><span class="tag tag--accent">Now</span></div>
                <div class="cal-week__label" />
                <span class="cal-week__match">vs Gullhaven</span>
              </li>
              <li class="cal-week">
                <div class="cal-week__head"><span class="cal-week__id">MW4</span></div>
                <div class="cal-week__label">Cross-wing</div>
                <span class="cal-week__match">at Ironmere</span>
              </li>
            </ol>
          </div>
          <div class="panel panel--hero">
            <div class="outcome" data-kind="up">
              <span class="outcome__icon" aria-hidden="true"><Icon name="arrow-up" size="lg" /></span>
              <div>
                <div class="outcome__title u-display">Promoted to the Crown</div>
                <div class="outcome__text">1st in the East wing, 2nd in the tier, 34 pts</div>
              </div>
            </div>
          </div>
        </Panel>
      </div>
      <Modal open={modal} onClose={() => setModal(false)} title="Sample dialog" icon="info" footer={<button class="btn btn--primary" type="button" onClick={() => setModal(false)}>OK</button>}>
        <p>
          Dialogs open only on the player's request; Esc closes. <Icon name="keyboard" />
        </p>
      </Modal>
    </section>
  );
}

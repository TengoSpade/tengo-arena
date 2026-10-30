/**
 * ui/components — shared Preact components over the designer's classes
 * (src/ui/styles/components.css). Owner: WP6. API STABLE from the first
 * commit: additive changes only (WP7 builds on these).
 */
export { Icon, type IconName, type IconProps } from './Icon';
export { TooltipLayer, TipBody, tipAttrs, overflowTipAttrs, readTip, tooltipDelayMs, type Tip, type TipContent, type TipRow } from './Tooltip';
export {
  ToastRegion,
  showToast,
  dismissToast,
  undoLast,
  clearUndos,
  hasUndo,
  resetToasts,
  toasts,
  TOAST_LIMIT,
  TOAST_MS,
  TOAST_UNDO_MS,
  type ToastKind,
  type ToastOptions,
  type ToastItem,
} from './Toast';
export { Modal, type ModalProps } from './Modal';
export { ConfirmButton, type ConfirmButtonProps, type Consequence } from './ConfirmButton';
export { DataTable, sortRows, compareValues, type Column, type DataTableProps, type SortState, type SortDir } from './DataTable';
export { Panel, type PanelProps } from './Panel';
export { PageHeader, type PageHeaderProps } from './PageHeader';
export { StatBar, type StatBarProps } from './StatBar';
export { Tag, type TagKind, type TagProps } from './Tag';
export { Money, type MoneyProps } from './Money';
export { FighterName, type FighterNameProps } from './FighterName';
export { ClassTag, type ClassTagProps } from './ClassTag';
export { Tabs, TabPanel, type TabDef, type TabsProps } from './Tabs';
export { RuleLine, type RuleLineParts } from './RuleLine';
export {
  Crest,
  crestLetters,
  Portrait,
  RoleGlyph,
  RoleBadge,
  Rating,
  Stars,
  TraitBadge,
  TraitDots,
  traitPolarity,
  CaptainMark,
  ViceCaptainTag,
  RowMark,
  CapMeter,
  Meter,
  Progress,
  FormStrip,
  Delta,
  Pips,
  Segmented,
  Chip,
  Kbd,
  Empty,
  Callout,
  luminance,
  type CrestProps,
  type PortraitProps,
  type TraitPolarity,
  type SegmentedOption,
} from './marks';

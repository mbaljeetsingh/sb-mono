// Shared box metrics for the score-column primitives.
//
// Two reasons this is a module rather than a const inside each component:
//
// 1. Widths are FIXED, not min-width. Every score column has to be wide enough
//    for two digits from the moment it renders, because a box that grows when
//    the score crosses 9 → 10 shoves the whole row sideways mid-rally. That is
//    the single most obvious tell of an amateur scoreboard. Badminton caps at
//    30 and tennis games at 7, so two digits is the real maximum — no column
//    ever needs to grow.
//
// 2. A theme that draws a column header (arena-board) renders that header in a
//    *separate* grid from its team rows, and CSS sizes each grid's `auto`
//    tracks from its own content. Any width expressed twice therefore drifts:
//    the labels sat ~22px right of the columns they named. Importing one
//    constant in both places makes that impossible rather than merely unlikely.

export type CellSize = 'xs' | 'sm' | 'md' | 'lg';

/** Per-game score cell. Square-ish; `lg` is fluid for venue boards. */
export const CELL_W: Record<CellSize, string> = {
  xs: 'w-[22px] h-[22px]',
  sm: 'w-[32px] h-[30px]',
  md: 'w-[44px] h-[42px]',
  lg: 'w-[clamp(34px,6.5vmin,72px)] h-[clamp(34px,6.5vmin,72px)]',
};

/**
 * Games-won standing plate. Narrower than a score cell — it only ever holds a
 * single digit. `lg` is wider than the digit strictly needs so a venue board's
 * "GAMES" column heading fits on one line above it; at 36px the heading wrapped
 * to four lines and floated clear of the column it labelled.
 */
export const PLATE_W: Record<CellSize, string> = {
  xs: 'w-[18px]',
  sm: 'w-[26px]',
  md: 'w-[36px]',
  lg: 'w-[clamp(44px,7.5vmin,84px)]',
};

/**
 * Plate height, deliberately separate from PLATE_W. A header row wants the
 * width (to sit over the column) but not the height — bundling them made the
 * "GAMES" caption a 47px-tall box with its text stranded at the top.
 */
export const PLATE_H: Record<CellSize, string> = {
  xs: 'h-[22px]',
  sm: 'h-[30px]',
  md: 'h-[42px]',
  lg: 'h-[clamp(34px,6.5vmin,72px)]',
};

/** Gap between cells. Must match wherever a header row is drawn. */
export const CELL_GAP = 'gap-[clamp(2px,0.5vmin,6px)]';

/** Type ramp for the digits inside a cell. */
export const CELL_TEXT: Record<CellSize, string> = {
  xs: 'text-[13px]',
  sm: 'text-[17px]',
  md: 'text-[24px]',
  lg: 'text-[clamp(19px,3.6vmin,42px)]',
};

/** Corner radius, kept proportional to the box. */
export const CELL_RADIUS: Record<CellSize, string> = {
  xs: 'rounded-[3px]',
  sm: 'rounded-[4px]',
  md: 'rounded-[5px]',
  lg: 'rounded-[clamp(4px,0.8vmin,8px)]',
};

/**
 * Caption metrics for label mode. Width comes from CELL_W so captions sit dead
 * centre over their column; only the height and type size differ, because a
 * caption strip as tall as the cells it names wastes the scarcest dimension on
 * a lower third.
 */
export const LABEL_OVERRIDE: Record<CellSize, string> = {
  xs: '!text-[8px] !h-[11px]',
  sm: '!text-[9px] !h-[13px]',
  md: '!text-[11px] !h-[16px]',
  lg: '!text-[clamp(8px,1.1vmin,12px)] !h-[clamp(11px,1.6vmin,18px)]',
};

/**
 * Code plate width. Fixed so a header row can reserve the identical track — and
 * so "AXE" and "VIT" plates are the same size, which a content-sized plate does
 * not guarantee (glyph widths differ even in a mono face at these sizes).
 */
export const CODE_W: Record<CellSize, string> = {
  xs: 'w-[34px]',
  sm: 'w-[44px]',
  md: 'w-[60px]',
  lg: 'w-[clamp(48px,9vmin,104px)]',
};

/**
 * Live-points window on a venue board — the one deliberately oversized box.
 *
 * Width and font size are a matched pair: JetBrains Mono runs ~0.6em per digit,
 * so two digits need ~1.2× the font size, and the box must clear that or a score
 * of 14 spills past its own frame (it did — 15vmin of box against a 15vh font).
 * Keep the ratio at ~1.4× when touching either value.
 */
export const POINTS_W_LG = 'w-[clamp(100px,20vmin,250px)]';
export const POINTS_TEXT_LG = 'text-[clamp(58px,min(14vmin,12vw),170px)]';

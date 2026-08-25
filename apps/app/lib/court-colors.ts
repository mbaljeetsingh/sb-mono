// Court-color variants for the /control playing surface. A per-DEVICE
// operator preference (localStorage `sb:court-color`, sport → variant id),
// same class of thing as `sb:control-layout`: it changes how this operator's
// screen looks, so it never syncs. Curated venue colors only — a free color
// picker invites unreadable courts and breaks the tuned line contrast.

import type { SportId } from './sports';

export type CourtColorVariant = {
  id: string;
  label: string;
  /** Tailwind bg-* utility backed by a --court-* token (light+dark aware). */
  class: string;
};

export const courtColorVariants: Record<SportId, CourtColorVariant[]> = {
  badminton: [
    { id: 'green', label: 'Court green', class: 'bg-court-badminton' },
    { id: 'blue', label: 'Event blue', class: 'bg-court-blue' },
  ],
  'table-tennis': [
    { id: 'blue', label: 'Table blue', class: 'bg-court-tabletennis' },
    { id: 'red', label: 'Table red', class: 'bg-court-red' },
  ],
  tennis: [
    { id: 'hard', label: 'Hard court', class: 'bg-court-tennis' },
    { id: 'clay', label: 'Clay', class: 'bg-court-clay' },
  ],
  pickleball: [
    { id: 'green', label: 'Court green', class: 'bg-court-pickleball' },
    { id: 'blue', label: 'Court blue', class: 'bg-court-blue' },
  ],
};

/** Resolve the mat class for a sport + stored choice (unknown ids fall back
 * to the sport's first variant, so a stale stored value can't blank the mat). */
export const courtSurfaceClass = (
  sport: SportId,
  chosenId: string | undefined
): string => {
  const list = courtColorVariants[sport];
  return (list.find((v) => v.id === chosenId) ?? list[0]!).class;
};

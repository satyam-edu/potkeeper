import type { CSSProperties } from 'react';

/** Start delay for the CSS animations that read `--d` (rise, deal-card, suit-drift). */
export const after = (seconds: number) => ({ '--d': `${seconds}s` }) as CSSProperties;

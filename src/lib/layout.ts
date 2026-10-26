/** Largest roster drawn around the pot; bigger tables fall back to a grid. */
export const ELLIPSE_MAX = 6;

/**
 * Seat centres as % of the table box. Index 0 (the viewer) sits at the bottom;
 * the rest follow clockwise, matching the real seating order.
 */
export function seatPositions(n: number, rx = 36, ry = 38): { left: number; top: number }[] {
  return Array.from({ length: n }, (_, k) => {
    const a = Math.PI / 2 + (k * 2 * Math.PI) / n; // screen coords: y down, so +angle is clockwise
    return { left: 50 + rx * Math.cos(a), top: 50 + ry * Math.sin(a) };
  });
}

/** Rotate so the viewer comes first, keeping clockwise order. */
export function fromViewer<T extends { userId: string }>(players: T[], meId: string): T[] {
  const i = players.findIndex((p) => p.userId === meId);
  return i <= 0 ? players : [...players.slice(i), ...players.slice(0, i)];
}

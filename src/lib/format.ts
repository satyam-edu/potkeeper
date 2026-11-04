export const rupees = (n: number) => `₹${n}`;
export const signed = (n: number) => (n > 0 ? `+₹${n}` : n < 0 ? `−₹${-n}` : '₹0');
/**
 * What each seat on the table calls its player (full names live in the lists, where they wrap). Normally the first word.
 * A first word of one or two letters ("S", "Mr", "Dr") is not a name, so the next word joins it. Two players with the same
 * first name get the initial of their next word ("Rahul S."), or their full name if they have no more words.
 */
export function seatLabels(players: { userId: string; name: string }[]): Record<string, string> {
  const words = (n: string) => n.trim().split(/\s+/).filter(Boolean);
  const first = (n: string) => { const w = words(n); return w.length > 1 && [...w[0]!.replace(/\./g, '')].length <= 2 ? `${w[0]} ${w[1]}` : (w[0] ?? n); };
  const count = new Map<string, number>();
  for (const p of players) {
    const k = first(p.name).toLowerCase();
    count.set(k, (count.get(k) ?? 0) + 1);
  }
  return Object.fromEntries(players.map((p) => {
    const f = first(p.name);
    if ((count.get(f.toLowerCase()) ?? 0) < 2) return [p.userId, f];
    const next = words(p.name)[f.split(' ').length];
    return [p.userId, next ? `${f} ${[...next][0]!.toUpperCase()}.` : p.name.trim()];
  }));
}
export const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
export const hue = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

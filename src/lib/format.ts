export const rupees = (n: number) => `₹${n}`;
export const signed = (n: number) => (n > 0 ? `+₹${n}` : n < 0 ? `−₹${-n}` : '₹0');
export const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
export const hue = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

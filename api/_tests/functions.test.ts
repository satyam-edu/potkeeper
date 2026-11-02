import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// Vercel's Hobby plan allows 12 serverless functions, and every .ts file under api/ counts unless its path has a part that starts with an underscore.
const HOBBY_LIMIT = 12;
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.name.startsWith('_') ? [] : e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : []));

it('stays within the Hobby plan function limit', () => {
  const found = files('api');
  expect(found.filter((f) => f.endsWith('.test.ts'))).toEqual([]); // tests belong in api/_tests
  expect(found.length).toBeLessThanOrEqual(HOBBY_LIMIT);
});

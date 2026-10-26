import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Dev only: serves /api/* by calling the same web-standard handlers Vercel runs in production
 * (api/<path>.ts exporting POST/GET/...), so `npm run dev` needs no `vercel login`.
 */
const localApi = (): Plugin => ({
  name: 'local-api',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/api', async (req, res, next) => {
      try {
        const path = (req.url ?? '').split('?')[0]!.replace(/\/$/, '');
        const mod = await server.ssrLoadModule(`/api${path}.ts`).catch(() => null);
        const handler = mod?.[req.method ?? 'GET'] as ((r: Request) => Promise<Response>) | undefined;
        if (!handler) return next();
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const body = chunks.length && req.method !== 'GET' ? Buffer.concat(chunks) : undefined;
        const out = await handler(new Request(`http://localhost${req.url}`, { method: req.method, headers: req.headers as Record<string, string>, body }));
        res.statusCode = out.status;
        out.headers.forEach((v, k) => res.setHeader(k, v));
        res.end(Buffer.from(await out.arrayBuffer()));
      } catch (e) {
        console.error(e);
        res.statusCode = 500;
        res.end('{"error":"SERVER_ERROR"}');
      }
    });
  },
});

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), '')); // .env → process.env for the API handlers
  return { plugins: [react(), tailwindcss(), localApi()] };
});

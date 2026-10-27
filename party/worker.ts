import { routePartykitRequest } from 'partyserver';

export { Room } from './room';

// ws(s)://<host>/parties/main/<code> is routed to the Room Durable Object named <code>.
export default {
  async fetch(request: Request, env: Cloudflare.Env): Promise<Response> {
    return (await routePartykitRequest(request, env)) ?? new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Cloudflare.Env>;

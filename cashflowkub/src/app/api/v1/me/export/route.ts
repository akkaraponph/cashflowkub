import { route } from '@/server/http';
import { exportUserData } from '@/server/me/service';

/** The signed-in user's data as a JSON file download. A plain Response: route() only needs it to be a Response. */
// The unused Request only gives route() the signature Next calls handlers with (and the tests' call helper).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const GET = route(async (_req: Request) => {
  const body = await exportUserData();
  return new Response(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="cashflowkub-export-${body.exported_at.slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  });
});

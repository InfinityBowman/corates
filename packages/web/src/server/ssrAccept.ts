// TanStack Start answers a document render whose Accept header excludes HTML
// with a 500, which makes link checkers and uptime monitors read a healthy
// page as down. A failed negotiation is a 406.
const SSR_ACCEPT_REFUSAL = JSON.stringify({ error: 'Only HTML requests are supported here' });

export const NOT_ACCEPTABLE_MESSAGE =
  'This endpoint serves HTML. Send Accept: text/html or */* to render it.';

export async function withAcceptNegotiation(response: Response): Promise<Response> {
  if (response.status !== 500) return response;
  if (!response.headers.get('content-type')?.includes('application/json')) return response;

  // Server routes pass through here too and may legitimately return a JSON 500.
  if ((await response.clone().text()) !== SSR_ACCEPT_REFUSAL) return response;

  return Response.json({ error: NOT_ACCEPTABLE_MESSAGE }, { status: 406 });
}

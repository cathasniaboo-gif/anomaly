// Small shared helper for the client-credentials-in-env, authorization-code
// OAuth2 dance both connectors use. Not a general-purpose OAuth library —
// just the handful of calls QuickBooks Online and Xero both need.

export async function exchangeAuthCodeForToken(
  tokenUrl: string,
  params: Record<string, string>,
  basicAuth?: { clientId: string; clientSecret: string }
): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  };
  if (basicAuth) {
    headers.Authorization = 'Basic ' + Buffer.from(`${basicAuth.clientId}:${basicAuth.clientSecret}`).toString('base64');
  }
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers,
    body: new URLSearchParams(params).toString(),
  });
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Token endpoint ${tokenUrl} returned non-JSON (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }
  if (!res.ok) {
    throw new Error(`Token endpoint ${tokenUrl} returned HTTP ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

export function expiresAtFromSeconds(expiresInSeconds: number): string {
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}

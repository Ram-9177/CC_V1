export interface Env {
  MONGODB_DATA_API_URL: string;
  MONGODB_DATA_SOURCE: string;
  MONGODB_DATABASE: string;
  MONGODB_API_KEY: string;
}

export async function dataApi(env: Env, action: string, body: Record<string, unknown>) {
  const url = `${env.MONGODB_DATA_API_URL}/action/${action}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': env.MONGODB_API_KEY,
    },
    body: JSON.stringify({
      dataSource: env.MONGODB_DATA_SOURCE,
      database: env.MONGODB_DATABASE,
      ...body,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Data API ${action} failed: ${res.status} ${text}`);
  }
  return res.json();
}

export function oid(id: string) {
  return { $oid: id } as const;
}

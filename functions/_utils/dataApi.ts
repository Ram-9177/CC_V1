/**
 * Deprecated: MongoDB Data API was sunset in Sept 2025. This file remains only
 * to avoid broken imports in old branches. New code must use `functions/_utils/mongodb.ts`.
 */
export function dataApi(): never {
  throw new Error('Deprecated: MongoDB Data API is no longer supported. Use the driver helper in functions/_utils/mongodb.ts');
}

export function oid(): never {
  throw new Error('Deprecated: use ObjectId from functions/_utils/mongodb.ts');
}

export type Env = never;

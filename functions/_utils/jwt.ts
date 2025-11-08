import { SignJWT, jwtVerify } from 'jose';

export interface AuthPayload { email: string }

export async function signToken(secret: string, payload: AuthPayload) {
  const key = new TextEncoder().encode(secret);
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(key);
}

export async function verifyToken(secret: string, token: string) {
  const key = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, key);
  return payload as AuthPayload;
}

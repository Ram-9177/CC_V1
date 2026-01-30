export const getTokenPayload = (token: string): { exp?: number } | null => {
  try {
    const payload = token.split('.')[1]
    const decoded = JSON.parse(atob(payload))
    return decoded
  } catch {
    return null
  }
}

export const isTokenExpired = (token: string, skewSeconds = 30): boolean => {
  const payload = getTokenPayload(token)
  if (!payload?.exp) return true
  const now = Math.floor(Date.now() / 1000)
  return payload.exp <= now + skewSeconds
}

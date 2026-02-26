export function authenticate(token: string): boolean {
  return token.length > 0;
}

export function validateSession(sessionId: string): boolean {
  return sessionId.startsWith("sess_");
}

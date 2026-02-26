export function handleRequest(path: string): { status: number; body: string } {
  if (path === "/health") {
    return { status: 200, body: "ok" };
  }
  return { status: 404, body: "not found" };
}

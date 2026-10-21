import { vi } from 'vitest'

// The generated SDK (src/generated/api) calls `fetch(request)` with a ready
// Request object. Tests stub the global fetch and see each call as plain data.
export type FetchCall = { url: string; method: string; body: unknown }

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function stubFetch(
  respond: (call: FetchCall) => Response | Promise<Response>,
): FetchCall[] {
  const calls: FetchCall[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init)
      const text = await request.text()
      const call = {
        url: request.url,
        method: request.method,
        body: text ? JSON.parse(text) : undefined,
      }
      calls.push(call)
      return respond(call)
    }),
  )
  return calls
}

// Port 1:1 /api/sehat dari api/main.py.

import { store, inisialisasi } from "../lib/data"

export async function onRequest(context: { request: Request; env: Record<string, string | undefined> }): Promise<Response> {
  const { request, env } = context
  inisialisasi(request, env)
  const S = await store()
  const model = env.SIDAK_MODEL || "MiniMax-M2.7-highspeed"
  return Response.json({ ok: true, faskes: S.faskes.length, model, asisten: Boolean(env.SUMODOP_API_KEY) })
}
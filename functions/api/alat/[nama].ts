// Port 1:1 /api/alat/{nama} dari api/main.py — akses langsung alat (query params).

import { inisialisasi } from "../../lib/data"
import { jalankanAlat, ALAT } from "../../lib/tools"

export async function onRequest(context: { request: Request; params: Record<string, string>; env: Record<string, string | undefined> }): Promise<Response> {
  const { request, params, env } = context
  inisialisasi(request, env)
  const nama = params.nama
  if (!(nama in ALAT)) return Response.json({ detail: "alat tidak dikenal" }, { status: 404 })
  const args: Record<string, string> = {}
  const sp = new URL(request.url).searchParams as unknown as Iterable<[string, string]>
  for (const [k, v] of sp) args[k] = v
  try {
    return Response.json(await jalankanAlat(nama, args))
  } catch (e) {
    return Response.json({ detail: (e as Error).message }, { status: 500 })
  }
}
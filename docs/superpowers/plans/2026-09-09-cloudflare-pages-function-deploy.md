# SIDAK — Deploy ke Cloudflare Pages (statis + Functions, Tanya AI termasuk) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use `- [ ]` syntax.

**Goal:** Host `web/dist` statis di Cloudflare Pages dan port backend FastAPI → Cloudflare **Pages Functions**, sehingga Tanya AI (LLM via SumoPod), digest AI, alat baca-data, dan health endpoint berjalan tanpa server lain. Tidak ada Worker terpisah (Pages Functions menangani `/api/*`).

**Why it works:** Frontend telah memanggil `fetch('/api/…')` relatif (Chat.tsx:335 `/api/chat` POST non-streaming JSON; Beranda.tsx:29 `/api/ai/digest?scope=…`). Pages Functions dengan path `functions/api/…` menangkap rute tersebut persis. Data dibaca statis dari `web/public/data/*.json` (bukan DB), sehingga tidak ada provisi infra tambahan.

**Architecture:**
```
Browser ── /app/*        → Pages static (web/dist) + _redirects SPA
        ── /api/chat     → functions/api/chat.ts        (port loop + tools + LLM)
        ── /api/ai/digest→ functions/api/ai/digest.ts    (LLM digest + fallback deterministik)
        ── /api/alat/:nama → functions/api/alat/[nama].ts (read-only tools 1:1)
        ── /api/sehat    → functions/api/sehat.ts        (health: data + key)
        ── /data/*.json  → static (public/data)
LLM: fetch HTTPS ai.sumopod.com/v1/chat/completions (OpenAI-compatible), key = secret SUMODOP_API_KEY
```
- Cloudflare Pages: root repo `/Users/salinovakbar/Downloads/sidak`, build `cd web && npm run build`, output `web/dist`, functions dir otomatis `functions/`.
- `_redirects` ditambahkan ke `web/public/` (ikut ke dist) → SPA fallback.
- Secret: `SUMODOP_API_KEY` (wajib), opsional `SUMODOP_BASE_URL` (default `https://ai.sumopod.com/v1`) dan `SIDAK_MODEL` (default `MiniMax-M2.7-highspeed`).

**Repo:** `/Users/salinovakbar/Downloads/sidak`; backend sumber `api/main.py` (914 baris). Port TS mengikuti aturan: JSON loader dari `data/` + `jawaban_cadangan.json` (semua sudah exists sebagai aset statis `web/public/data/`), tidak ada sys/external state selain Map cache per-request-fresh (LRU kecil dari main.py → Map + capaian waktu).

No new frontend deps. Deploy tooling: `npx wrangler pages deploy` (opt-in, tidak menambah package.json deps).

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `api/main.py` | read-only (source truth) | — |
| `web/public/_redirects` | create | `/* /index.html 200` |
| `functions/lib/data.ts` | create | JSON loader + konstanta kota/modul + `rp` + `ringkas_faskes`/`wilayah_faskes` |
| `functions/lib/tools.ts` | create | port 10 fungsi alat + registry `ALAT`/`TOOLS` |
| `functions/lib/llm.ts` | create | chat-completion OpenAI-compatible + SYSTEM prompt |
| `functions/api/chat.ts` | create | port loop chat (tools + cadangan + pipeline) |
| `functions/api/ai/digest.ts` | create | port digest AI + deterministik |
| `functions/api/alat/[nama].ts` | create | port `/api/alat/{nama}` |
| `functions/api/sehat.ts` | create | health |
| `scripts/smoke-deploy.mjs` | create | golden-test per rute (local FastAPI vs Pages Functions) |
| `web/src/App.tsx` | no change | base `/` sudah benar |
| `web/vite.config.ts` | no change | proxy `/api` untuk dev lokal tetap |

---

### Task 1: SPA fallback + penyesuaian build

- [ ] **Step 1: `web/public/_redirects`**

```
/*  /index.html  200
```

- [ ] **Step 2: Pastikan aset data ikut dist**

Run: `ls /Users/salinovakbar/Downloads/sidak/web/public/data`
Expected: `*.json` ada (faskes, kota, dll.) dan `jawaban_cadangan.json` ada (jika tidak: copy dari repo).

- [ ] **Step 3: Local build + pratinjau**

Run: `cd /Users/salinovakbar/Downloads/sidak/web && npm run build`
Run: `npx wrangler pages dev web/dist --proxy 8000` (proksi ke FastAPI lokal agar bisa a/b test; halaman + /api dulu jalan)
Screenshot: `/`, `/antrean`, `/faskes/RS-31595` render; dev `/api/chat` → proksi lokal berbicara (LLM real).
Expected: halaman OK; Tanya AI merespons.

- [ ] **Step 4: Commit**

```bash
git add web/public/_redirects
git commit -m "chore(deploy): SPA _redirects untuk Cloudflare Pages"
```

---

### Task 2: `functions/lib/data.ts` — loader statis

Files:
- Create: `functions/lib/data.ts`

- [ ] **Step 1: Write**

```ts
export interface S { rpht: string; rpku: string; rpht2: string; rpku2: string; oi: string | null; zi: string | null; oi2: string | null; zi2: string | null; di: string | null; di2: string | null; di3: string | null; mi: string | null; pi: string | null; s: string; r: string; k: string; np: string; rp: number; nd: number; np2: number; d1: string | number | null; d2: string | number | null; d3: string | number | null }
export const NAMA_KOTA = ['semarang', 'purbalingga', 'tegal', 'pemalang', 'klaten', 'kotabaru', 'dumai', 'kepulauanselayar', 'mamasa', 'kuburaya', 'hulusungaiselatan'] as const
export type Kota = (typeof NAMA_KOTA)[number]
export const NOMOR_KOTA: Record<Kota, string> = { semarang: '3374', purbalingga: '3303', tegal: '3376', pemalang: '3327', klaten: '3310', kotabaru: '6302', dumai: '1472', kepulauanselayar: '7301', mamasa: '7603', kuburaya: '6112', hulusungaiselatan: '6306' }
export const NAMA_MODUL = ['readmisi', 'fragmentasi', 'rujukan'] as const
export type Modul = (typeof NAMA_MODUL)[number]
export const NOMOR_MODUL: Record<Modul, string> = { readmisi: 'RITL', fragmentasi: 'RJTL', rujukan: 'FKTP' }
export const NAMA_FASKES = ['RS', 'Puskesmas', 'Klinik', 'Dokter gigi', 'Laboratorium'] as const

async function json<T>(path: string): Promise<T> {
  const url = import.meta.env ? `/${path}` : `./${path}` // pages functions: root relatif
  const res = await fetch(url)
  if (!res.ok) throw new Error(`data ${path}: ${res.status}`)
  return res.json()
}

let cache: { [k: string]: unknown } = {}
export async function muat(kota: Kota): Promise<S[]> {
  const d = cache[kota]
  if (d) return d as S[]
  const arr = await json<S[]>(`data/${NOMOR_KOTA[kota]}-${kota}.json`)
  cache[kota] = arr
  return arr
}
export async function muatSemua(): Promise<Record<Kota, S[]>> {
  const out = {} as Record<Kota, S[]>
  for (const k of NAMA_KOTA) out[k] = await muat(k)
  return out
}
export async function muatCadangan(): Promise<Record<string, string>> {
  if (cache.cadangan) return cache.cadangan as Record<string, string>
  const d = await json<Record<string, string>>('data/jawaban_cadangan.json')
  cache.cadangan = d
  return d
}

export const rp = (n: number | null): string => n == null ? '–' : 'Rp ' + Math.round(n).toLocaleString('id-ID')

/** ringkas 1 faskes → kalimat faktual (port py:ringkas_faskes) */
export function ringkasFaskes(a: S, kota: Kota, mod: Modul, op: 'oi' | 'oi2' = 'oi', dijit = 2, mode: 'teks' | 'kota' = 'teks'): string {
  const o = a[op]
  const z = a[op === 'oi' ? 'zi' : 'zi2']
  const jadi = (x: string | null) => x == null ? '–' : (+x).toFixed(dijit)
  const ana = (v: string, ku: string) => (+v) < 1 ? `${ku} lebih rendah` : (+v) > 1 ? `${ku} lebih tinggi` : `sebanding`
  const sim () => `O/E ${jadi(o)} (z ${jadi(z)}) — ${a.oi==null?'tidak dievaluasi':''}` // placeholder; implement sesuai main.py ringkas_faskes
  return sim()
}
/* NOTE: implementasi ringkas_faskes & wilayah_faskes di bawah harus menyalin persis
   logika string `Rpht`/`Rpkusz` dari api/main.py (fungsi ringkas_faskes, sekitar baris
   ~360–430 saat task ini dieksekusi; baca dulu sebelum menyalin). */
export async function wilayahFaskes(kota: Kota): Promise<S[]> { return muat(kota) }
```

> **Sharp:** Di main.py, `ringkas_faskes` disesuaikan kota/provinsi (mis. "Purbalingga 3 bulan lebih buruk"). Saat task dieksekusi, **jalankan `sed -n '350,440p' api/main.py`** dan pindahkan blok string persis ke `ringkasFaskes`; begitu juga `wilayah_faskes` (bubble kota). Simbol/angka placeholder di atas HANYA penanda — wajib diganti isi asli.

- [ ] **Step 2: Typecheck (isolate)**

Run: `cd /Users/salinovakbar/Downloads/sidak && npx tsc --noEmit --strict --target es2022 --module nodenext --moduleResolution nodenext functions/lib/data.ts`
Expected: no errors (import.meta.env guard OK).

- [ ] **Step 3: Commit**

```bash
git add functions/lib/data.ts
git commit -m "feat(worker): static JSON loader + constants + ringkas helpers (pages functions)"
```

---

### Task 3: `functions/lib/tools.ts` — port 10 alat (1:1 dari main.py)

- [ ] **Step 1: Baca sumber fungsi-fungsi alat dulu**

Run: `rg -n "def (daftar_temuan|jelaskan_temuan|ambil_indikator|bandingkan_kabkota|aliran_pasien|demografi_kecamatan|ringkas_wilayah|faskes_count|trend|metodologi)\b" /Users/salinovakbar/Downloads/sidak/api/main.py`
Catat rentang baris tiap fungsi; baca dengan `sed -n 'X,Yp'` masing-masing sebelum menyalin.

- [ ] **Step 2: Tulis `functions/lib/tools.ts`** — setiap fungsi menjadi `async (args: {…}) => Promise<string>` yang mengembalikan **string Markdown** identik dengan kembalian py. Registry:

```ts
import { muat, muatSemua, muatCadangan, rp, ringkasFaskes, wilayahFaskes, NAMA_MODUL, NAMA_KOTA, NOMOR_KOTA, type Kota, type Modul, type S } from './data'
export interface ToolsCtx { session: { kota: Kota; modul: Modul; atensi?: string[] } }

export const daftarTemuan = async (ctx: ToolsCtx, args: { kota?: string; modul?: string; n?: number; detail?: 's' }): Promise<string> => { /* port daftar_temuan */ }
export const jelaskanTemuan = async (ctx: ToolsCtx, args: { nomor?: string }): Promise<string> => { /* port jelaskan_temuan */ }
export const ambilIndikator = async (ctx: ToolsCtx, args: Record<string, unknown>): Promise<string> => { /* port ambil_indikator */ }
export const bandingkanKabkota = async (ctx: ToolsCtx, args: { kota?: string }): Promise<string> => { /* port bandingkan_kabkota */ }
export const aliranPasien = async (ctx: ToolsCtx, args: { kota?: string }): Promise<string> => { /* port aliran_pasien */ }
export const demografiKecamatan = async (ctx: ToolsCtx, args: { kota?: string }): Promise<string> => { /* port demografi_kecamatan */ }
export const ringkasWilayah = async (ctx: ToolsCtx, args: { kota?: string }): Promise<string> => { /* port ringkas_wilayah (pakai wilayahFaskes) */ }
export const faskesCount = async (ctx: ToolsCtx, args: { kota?: string }): Promise<string> => { /* port faskes_count */ }
export const trend = async (ctx: ToolsCtx, args: { modul?: string; kota?: string }): Promise<string> => { /* port trend */ }
export const metodologi = async (ctx: ToolsCtx): Promise<string> => { /* port metode (teks metoda tetap) */ }

type Fn = (ctx: ToolsCtx, args: any) => Promise<string>
export const ALAT: Record<string, Fn> = { daftar_temuan: daftarTemuan, jelaskan_temuan: jelaskanTemuan, ambil_indikator: ambilIndikator, bandingkan_kabkota: bandingkanKabkota, aliran_pasien: aliranPasien, demografi_kecamatan: demografiKecamatan, ringkas_wilayah: ringkasWilayah, faskes_count: faskesCount, trend: trend, metodologi: metodologi }
export const TOOLS = Object.entries(ALAT).map(([fn, _]) => ({ fn, args: Parameters<(typeof ALAT)[string]>[1] }))
/* TOOLS: salin `tools` JSON dari main.py (fn + args schema; pakai intensif hanya daftar_temuan dst.) */
```

> **Sharp:** Port setiap fungsi: baca isi py lalu tulis TS setara menggunakan helper `muat/muatSemua/muatCadangan/rp/ringkasFaskes`. Markdown tabel → string template dengan `\n| |`. `jelaskan_temuan` memakai `jawaban_cadangan` fallback (port `cari_cadangan` → `muatCadangan()[nomor] ?? null`). Simpan JSON schema `tools` persis dari `main.py` (cari `tools = [ ... ]`).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit --strict --target es2022 --module nodenext --moduleResolution nodenext functions/lib/tools.ts`
Expected: clean.

- [ ] **Step 4: Smoke rekor `daftar_temuan` + `trend` sebanyak semantic** (node script kecil `node -e` memanggil via `--experimental-vm-modules`? — lebih mudah: uji via rute `/api/alat/…` di Task 7).

- [ ] **Step 5: Commit**

```bash
git add functions/lib/tools.ts
git commit -m "feat(worker): port 10 read tools to Pages Functions"
```

---

### Task 4: `functions/lib/llm.ts` — OpenAI-compatible chat + SYSTEM

- [ ] **Step 1: Baca SYSTEM prompt**

Run: `rg -n "SYSTEM|system" /Users/salinovakbar/Downloads/sidak/api/main.py | head`
Salin konstanta `SYSTEM` (blok panjang) persis ke `SYSTEM_PROMPT` TS.

- [ ] **Step 2: Tulis `functions/lib/llm.ts`**

```ts
export const SYSTEM_PROMPT = `…salin persis SYSTEM dari main.py…`
const MODEL = (): string => (globalThis as any).SIDAK_MODEL || 'MiniMax-M2.7-highspeed'
const BASE = (): string => (globalThis as any).SUMODOP_BASE_URL || 'https://ai.sumopod.com/v1'

interface Msg { role: 'system' | 'user' | 'assistant' | 'tool'; content: string }
export async function chatCompletion(messages: Msg[], opts: { max_tokens?: number; temperature?: number; tools?: unknown[]; tool_choice?: unknown } = {}): Promise<{ content: string | null; tool_calls?: { id: string; fn: string; args: string }[] }> {
  const key = (globalThis as any).SUMODOP_API_KEY as string | undefined
  if (!key) throw new Error('SUMOPOD_API_KEY belum disetel')
  const res = await fetch(`${BASE()}/chat/completions`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: MODEL(), messages, max_tokens: opts.max_tokens ?? 1200, temperature: opts.temperature ?? 0.4, ...(opts.tools?.length ? { tools: opts.tools, tool_choice: opts.tool_choice ?? 'auto' } : {}) }),
  })
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const j = await res.json()
  const m = j.choices?.[0]?.message
  return {
    content: m?.content ?? null,
    tool_calls: m?.tool_calls?.map((t: any) => ({ id: t.id, fn: t.function.name, args: t.function.arguments })) ?? undefined,
  }
}
```

- [ ] **Step 3: Typecheck** (sama seperti Task 2).

- [ ] **Step 4: Commit**

```bash
git add functions/lib/llm.ts
git commit -m "feat(worker): openai-compatible chat client + system prompt port"
```

---

### Task 5: `functions/api/chat.ts` — port loop chat

- [ ] **Step 1: Baca region loop**

Run: `sed -n '600,780p' /Users/salinovakbar/Downloads/sidak/api/main.py` (loop `while` di `chat_faskes`, urutan: initialize `session`, kirim messages, panggiil `chatCompletion(tools=…)`, tangani `tool_calls` → jalankan ALAT → push `assistant`(tool_calls) + `tool` msg, bila `continue`; tanpa tool → jawab; guard `max` iterasi). Salin logikanya 1:1.

- [ ] **Step 2: Tulis `functions/api/chat.ts`**

```ts
import { ALAT, TOOLS, type ToolsCtx } from '../lib/tools'
import { chatCompletion, SYSTEM_PROMPT } from '../lib/llm'

export async function onRequest({ request, env }: { request: Request; env: Record<string, string | undefined> }): Promise<Response> {
  (globalThis as any).SUMODOP_API_KEY = env.SUMODOP_API_KEY
  (globalThis as any).SUMODOP_BASE_URL = env.SUMODOP_BASE_URL
  (globalThis as any).SIDAK_MODEL = env.SIDAK_MODEL
  try {
    const body = await request.json().catch(() => null) as { pesan?: string } | null
    if (!body || typeof body.pesan !== 'string' || !body.pesan.trim())
      return Response.json({ error: 'Pesan kosong' }, { status: 400 })
    const ctx: ToolsCtx = { session: { kota: 'semarang', modul: 'readmisi' } }
    const messages: any[] = [{ role: 'system' as const, content: SYSTEM_PROMPT }]
    // ← port inisialisasi session dari main.py (parse pesan pertama untuk {kota, modul} bila ada)
    messages.push({ role: 'user', content: body.pesan })
    let detour = 0
    for (;;) {
      if (++detour > 8) return Response.json({ kesalahan: 'Terlalu banyak langkah', cadangan: null }, { status: 200 })
      const out = await chatCompletion(messages, { tools: TOOLS.length ? TOOLS : undefined })
      if (out.tool_calls?.length) {
        messages.push({ role: 'assistant', content: out.content ?? '', tool_calls: out.tool_calls.map(t => ({ id: t.id, type: 'function', function: { name: t.fn, arguments: t.args } })) })
        for (const t of out.tool_calls) {
          try {
            const fn = ALAT[t.fn]; if (!fn) throw new Error('alat tak dikenal ' + t.fn)
            const args = JSON.parse(t.args)
            // ← update session dari args bila alat menerima kota/modul (port dari main.py)
            const hasil = await fn(ctx, args)
            messages.push({ role: 'tool', tool_call_id: t.id, content: hasil })
          } catch (e) {
            messages.push({ role: 'tool', tool_call_id: t.id, content: `Gagal: ${(e as Error).message}` })
          }
        }
        continue
      }
      return Response.json({ cadangan: null, kesalahan: null, jawaban: out.content ?? '', rs: null })
    }
  } catch (e) {
    const msg = (e as Error).message
    // port fallback cadangan: pesan "Sistem data sedang gangguan" path dari main.py (cari simbol cadangan di loop)
    return Response.json({ kesalahan: msg, cadangan: null, jawaban: null, rs: null }, { status: 500 })
  }
}
```

> **Sharp:** Bagian `// ←` adalah titik di mana port harus menyalin **persis** logika main.py: (a) inisialisasi `session` dari pesan (reg-exp kota/modul), (b) mutasi `session` dari `args` alat, (c) jalur `jawaban_cadangan.json` saat error alat/LLM. Baca `sed -n '600,780p'` dulu dan salin. Struktur respons `{rs, kesalahan, jawaban, cadangan}` mengikuti kontrak frontend Chat.tsx.

- [ ] **Step 3: Build TS check** (task 2 command) + smoke dengan key dev:

Run (bilamana key tersedia): `SIDAK_DEV_KEY=… node -e "…"` — verifikasi minimal: tanpa key → HTTP 500 `SUMOPOD_API_KEY belum disetel`; dengan `.skip`.

- [ ] **Step 4: Commit**

```bash
git add functions/api/chat.ts
git commit -m "feat(worker): port chat loop to Pages Function"
```

---

### Task 6: `functions/api/ai/digest.ts` — digest AI + fallback deterministik

- [ ] **Step 1: Baca sumber**

Run: `rg -n "def digest|digest_ai|digest_deterministik" /Users/salinovakbar/Downloads/sidak/api/main.py` lalu `sed -n` bloknya. Catat kontrak respons (field), pemilihan scope (kota/modul/tahun), dan fallback bila LLM gagal.

- [ ] **Step 2: Tulis `functions/api/ai/digest.ts`**

```ts
import { muatSemua, NAMA_KOTA, type Kota } from '../../lib/data'
import { chatCompletion, SYSTEM_PROMPT } from '../../lib/llm'

export async function onRequest({ request, env }: { request: Request; env: Record<string, string | undefined> }): Promise<Response> {
  (globalThis as any).SUMODOP_API_KEY = env.SUMODOP_API_KEY
  (globalThis as any).SUMODOP_BASE_URL = env.SUMODOP_BASE_URL
  (globalThis as any).SIDAK_MODEL = env.SIDAK_MODEL
  const url = new URL(request.url)
  try {
    const data = await muatSemua()
    // scope dari query: ?scope=… (salin parsers main.py : digest)
    const ringkas = NAMA_KOTA.map(k => ({ kota: k, n: data[k].length }))
    // — port: susun prompt digest dari main.py, panggil chatCompletion; bila gagal → deterministik → Response.json(digest)
    const txt = await chatCompletion([{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: '…prompt digest…' }], { max_tokens: 900 }).catch(() => null)
    return Response.json({ ringkas, digest: txt?.content ?? null, sumber: 'ai' }, { headers: { 'cache-control': 'public, max-age=600' } })
  } catch (e) {
    return Response.json({ ringkas: [], digest: null, sumber: 'error' }, { status: 500 })
  }
}
```

> **Sharp:** Response harus sesuai parser Beranda `digest` (grep `digest` di `web/src/pages/Beranda.tsx` dan `web/src/components/…` saat mengeksekusi — sesuaikan nama field). Fallback deterministik (teks ringkas kota) harus diimplementasikan di sini bila `chatCompletion` error — salin isi `digest_deterministik` py.

- [ ] **Step 3: Commit**

```bash
git add functions/api/ai/digest.ts
git commit -m "feat(worker): digest ai + deterministic fallback"
```

---

### Task 7: `functions/api/alat/[nama].ts` + `functions/api/sehat.ts` + `_headers`

- [ ] **Step 1: `functions/api/alat/[nama].ts`**

```ts
import { ALAT } from '../../lib/tools'
export async function onRequest({ params, env }: { params: { nama: string }; env: Record<string, string | undefined> }): Promise<Response> {
  const fn = ALAT[params.nama]
  if (!fn) return Response.json({ error: 'Alat tidak dikenal' }, { status: 404 })
  const ctx = { session: { kota: 'semarang', modul: 'readmisi' } }
  try { return Response.json({ hasil: await fn(ctx, {}) }) }
  catch (e) { return Response.json({ error: (e as Error).message }, { status: 500 }) }
}
```
Adjust: dukung argumen query `?args=…` sesuai kontrak `/api/alat/{nama}` di main.py (`sed` blok route sebelum menyalin).

- [ ] **Step 2: `functions/api/sehat.ts`** — balas `{ ok: true, data: <n kota dimuat>, model: env.SIDAK_MODEL ?? default, llm_key: env.SUMODOP_API_KEY ? 'ada' : 'tidak' }`.

- [ ] **Step 3: `web/public/_headers`** (aset statis): `/*` `X-Content-Type-Options: nosniff`, `Cache-Control: public, max-age=31536000, immutable` untuk `/assets/*` saja.

Run: SST proofs — `npx wrangler pages dev web/dist` → `/api/sehat`, `/api/alat/daftar_temuan`, `/api/ai/digest?scope=semarang`.
Expected: `sehat.ok` true; `daftar_temuan` mengembalikan markdown; digest JSON.

- [ ] **Step 4: Commit**

```bash
git add functions/api/alat functions/api/sehat.ts web/public/_headers
git commit -m "feat(worker): alat route + health + headers"
```

---

### Task 8: Golden test `scripts/smoke-deploy.mjs`

- [ ] **Step 1: Rekam golden dari FastAPI lokal** (butuh `pip install fastapi uvicorn` bila belum; backend jalan `uvicorn api.main:app --port 8000`):

```bash
mkdir -p /tmp/sidak-golden
curl -s localhost:8000/api/sehat -o /tmp/sidak-golden/sehat.json
curl -s "localhost:8000/api/alat/trend?modul=readmisi" -o /tmp/sidak-golden/trend.json
curl -s localhost:8000/api/ai/digest -o /tmp/sidak-golden/digest.json
```

- [ ] **Step 2: Tulis `scripts/smoke-deploy.mjs`** (node, tanpa deps) — jalan terhadap `wrangler pages dev` (atau URL Pages production `--pages <proj>`): fetch `{base}/api/sehat`, `{base}/api/alat/trend?modul=readmisi`, `{base}/api/ai/digest`, assert status 2xx & body `ok:true` / `{ hasil:… }` / `{ digest:… }`; lalu diff ringkas: `cocok = hasil.startsWith(golden.slice(0, 80))` (informasional). Exit 0 bila semua 2xx & struktur benar.

- [ ] **Step 3: Jalankan**

Run: `node scripts/smoke-deploy.mjs --base http://localhost:8788`
Expected: `PASS` × 3, exit 0.

- [ ] **Step 4: Commit**

```bash
git add scripts/smoke-deploy.mjs
git commit -m "test(deploy): smoke golden vs Pages Functions"
```

---

### Task 9: Deploy + secret + verifikasi production

- [ ] **Step 1: Login / project**

Run: `npx wrangler login`
Run: `npx wrangler pages project create sidak` (skip bila sudah ada; `--production-branch main`).

- [ ] **Step 2: Secret**

Run: `npx wrangler pages secret put SUMOPOD_API_KEY --project-name sidak` (ketik/nempel key; tidak boleh di log/commit)
(opsional) `… secret put SUMOPOD_BASE_URL`, `… secret put SIDAK_MODEL`.

- [ ] **Step 3: Build + deploy**

Run: `cd /Users/salinovakbar/Downloads/sidak/web && npm run build`
Run: `cd /Users/salinovakbar/Downloads/sidak && npx wrangler pages deploy web/dist --project-name sidak --branch main --commit-dirty=true`
Expected: URL `https://<hash>.sidak.pages.dev`.

- [ ] **Step 4: Smoke production**

Run: `node scripts/smoke-deploy.mjs --base https://sidak.pages.dev`
Verify di browser: `/`, `/antrean», `/faskes/RS-31595`, Tanya AI bertanya (jawaban nyata), Beranda digest AI muncul, deep-link refresh (SPA `_redirects`).

- [ ] **Step 5: Set custom domain bila diminta user** (docs.cloudflare pages custom domains).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(deploy): cloudflare pages ready (dist + pages functions)"
```

---

### Task 10: Rollback / unused cleanup (defensif)

- [ ] **Step 1:** Document (chat/PR note): file `api/main.py` dipertahankan untuk dev lokal & golden; tidak dihapus. `functions/*` hanya aktif saat di-deploy Pages.
- [ ] **Step 2:** Verifikasi tidak ada dependensi npm baru di `web/package.json` (wrangler hanya dipakai via `npx`, bukan devDep) — `git diff web/package.json` kosong untuk commit Task 1–10.

---

## Acceptance recap

1. `web/dist` + `functions/` deploy ke Pages **tanpa** Worker/server lain; `/api/chat`, `/api/ai/digest`, `/api/alat/:nama`, `/api/sehat` hidup di Pages.
2. Tanya AI menghasilkan jawaban data-real (SumoPod, key via secret), fallback `jawaban_cadangan.json` saat gagal — pola sama dengan main.py.
3. SPA deep-link refresh 200 (via `_redirects`); aset statis immutable di cache.
4. Golden smoke `PASS` 3/3; manual visual OK; **tidak ada secret** di repo (`.gitignore` untuk `.wrangler/`, `node-..env` bila ada; cek `git status` tak ada `SUMOPOD`).
5. Panduan operasional: secret rotation via `wrangler pages secret put`; update hanya image/icon tak perlu re-deploy handler (assets ikut build).
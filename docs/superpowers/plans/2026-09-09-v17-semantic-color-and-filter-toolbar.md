# SIDAK v1.7 — Semantic Color System + Antrean FilterToolbar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give info/stat cards a semantic three-level color system (card bg → chip → text) driven by one token file, and rebuild the Antrean filter surface (rail + toolbar + active-chip row) from shared 36px primitives, with unchanged behavior everywhere else.

**Architecture:** A TS single-source token module (`src/lib/roles.ts`) mirrors the existing `STATUS` pattern (inline styles, no CSS-var duplication). A new `KpiCard` component (with `sm` variant) replaces the old `.card.kpi` markup on Beranda/Modul/Profil. Common.tsx gains filter dropdown primitives; Antrean reuses them, keeps the left rail, and adds an active-filter chips row. `OE_STATUS()` becomes the one rule for amber/green reactivity (Beranda migrates off its ad-hoc `> 1.05`).

**Tech Stack:** React 19 + react-router-dom 7, Vite 6, TypeScript, @mdi/js, one global `styles.css` (no CSS modules). Verification: `npm run build`, `npm run audit:layout`, Playwright screenshots (local Chrome).

**Repo:** working dir `/Users/salinovakbar/Downloads/sidak`, web root `/Users/salinovakbar/Downloads/sidak/web`.

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `web/src/lib/roles.ts` | create | Role tokens, `OE_STATUS`, polarity map, MDI icons |
| `web/src/components/KpiCard.tsx` | create | Semantic stat card (lg + sm variants), deep-link, delta, sparkline, status pill |
| `web/src/components/Filter.tsx` | create | FilterCheck dropdown + FilterChips row primitives |
| `web/src/components/Common.tsx` | modify | export `Spark`-colored helper not needed; add `FilterChips` import path — keep `Cari`, `Pilih`, `Kpi` (Kpi kept until nothing references it, then delete) |
| `web/src/styles.css` | modify | kpi-card classes, delta, spark, mini O/E bar, filter primitives, chips row, rail normalization, bacaan left border |
| `web/src/pages/Beranda.tsx` | modify | KPI row → KpiCard; per-modul cards → white + number badge + mini O/E bar; remove colored top borders |
| `web/src/pages/Modul.tsx` | modify | 4 stat cards → KpiCard (ratio reactive w/ pill + sparkline) |
| `web/src/pages/Profil.tsx` | modify | `.metrik` chips → KpiCard `variant="sm"` |
| `web/src/pages/Antrean.tsx` | modify | FilterCheck dropdowns (Status/Kelas), chips row, "Hapus semua", result count, export count, empty-state copy |
| `web/scripts/shots-v17.mjs` | create | Screenshot + acceptance matrix |
| `web/public/` | no change | — |

No new npm dependencies.

---

### Task 1: Token module `src/lib/roles.ts`

**Files:**
- Create: `web/src/lib/roles.ts`

- [ ] **Step 1: Write the file**

```ts
import { mdiAlertOutline, mdiCalendarMonth, mdiCashMultiple, mdiGauge, mdiHospitalBuilding } from '@mdi/js'
import type { Status } from './data'

export type Role = 'coverage' | 'attention' | 'money' | 'ratio' | 'neutral'
export interface RoleTok { text: string; t1: string; t2: string } // teks, bg kartu, bg chip ikon

export const ROLES: Record<Exclude<Role, 'ratio'>, RoleTok> = {
  coverage: { text: '#0E7490', t1: '#E0F2F7', t2: '#CFE9F1' },
  attention: { text: '#C2410C', t1: '#FFF7ED', t2: '#FDE4CF' },
  money: { text: '#1D4ED8', t1: '#DBEAFE', t2: '#BFD8FB' },
  neutral: { text: '#475569', t1: '#F6F8FA', t2: '#E9EDF1' },
}

export const RATIO: Record<'wajar' | 'diamati' | 'perhatian', RoleTok> = {
  wajar: { text: '#0F9D8F', t1: '#ECFDF5', t2: '#D3F3E7' },
  diamati: { text: '#A16207', t1: '#FEF9C3', t2: '#F7E3C0' },
  perhatian: { text: '#C2410C', t1: '#FFF7ED', t2: '#FDE4CF' },
}

export type OES = keyof typeof RATIO

/** Sumber tunggal warna reaktif O/E — ambang sama dengan tabel/map (1.05 / 1.2). */
export const OE_STATUS = (oe: number | null | undefined): OES => {
  if (oe == null || oe <= 1.05) return 'wajar'
  if (oe <= 1.2) return 'diamati'
  return 'perhatian'
}
export const MULAI = (s: Status): OES => (s === 'perhatian' ? 'perhatian' : s === 'diamati' ? 'diamati' : 'wajar')

export const ROLE_TOK = (role: Role, oe?: number | null): RoleTok =>
  role === 'ratio' ? RATIO[OE_STATUS(oe)] : ROLES[role]

/* Delta: warna mengikuti POLARITAS, bukan arah panah. */
export type Polarity = 'worsening' | 'improving' | 'neutral'
export const POLARITY: Record<Role, Polarity> = {
  attention: 'worsening', money: 'worsening', ratio: 'worsening', coverage: 'neutral', neutral: 'neutral',
}
export const POLARITY_COLOR: Record<Polarity, string> = { worsening: '#C2410C', improving: '#0F9D8F', neutral: '#475569' }

export const ROLE_ICON: Record<Role, string> = {
  coverage: mdiHospitalBuilding, attention: mdiAlertOutline, money: mdiCashMultiple, ratio: mdiGauge, neutral: mdiCalendarMonth,
}

export const ROLE_LABEL: Record<Role, string> = {
  coverage: 'coverage', attention: 'attention', money: 'money', ratio: 'ratio', neutral: 'neutral',
}
```

- [ ] **Step 2: Build to typecheck**

Run: `cd /Users/salinovakbar/Downloads/sidak/web && npm run build`
Expected: `✓ built in ...` (tsc passes; unimported exports fine).

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/roles.ts
git commit -m "feat(roles): semantic role token file + OE_STATUS single source"
```

---

### Task 2: `KpiCard` component

**Files:**
- Create: `web/src/components/KpiCard.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { Link } from 'react-router-dom'
import type { CSSProperties, ReactNode } from 'react'
import { mdiArrowDown, mdiArrowUp, mdiMinus } from '@mdi/js'
import { Icon } from './Icon'
import { STATUS } from '../lib/data'
import { OE_STATUS, POLARITY_COLOR, POLARITY, ROLE_ICON, ROLE_TOK, Status, type Polarity, type Role } from '../lib/roles'

function Delta({ delta, role }: { delta: { value: string; parezek: number }; role: Role }) {
  const p: Polarity = POLARITY[role]
  const warna = POLARITY_COLOR[p]
  const arr = delta.parezek >= 0 ? mdiArrowUp : mdiArrowDown
  return <span className="kpi-delta" style={{ color: warna }}><Icon path={delta.parezek === 0 ? mdiMinus : arr} size={12} />{delta.value}</span>
}

export interface KpiDelta { value: string; parezek: number } // parezek: selisih yang boleh positif/negatif; arah panah dari tandanya

export default function KpiCard({
  role, icon, label, value, delta, sparkline, href, statusPill, hint, variant, style,
}: {
  role: Role
  icon?: string
  label: string
  value: ReactNode
  delta?: KpiDelta
  sparkline?: number[]
  href?: string
  statusPill?: boolean // ratio role: tampilkan pill kecil status
  hint?: ReactNode
  variant?: 'lg' | 'sm'
  style?: CSSProperties
}) {
  const tok = ROLE_TOK(role, sparkfrom(role, sparkline))
  const ic = icon ?? ROLE_ICON[role]
  const oes = role === 'ratio' ? OE_STATUS(sparkfrom(role, sparkline)) : null
  const sm = variant === 'sm'
  const ui = (
    <div className={'kpi-card' + (sm ? ' sm' : '')} style={style}>
      <div className="kpi-top">
        <span className="kpi-chip" style={{ background: tok.t2 }}><Icon path={ic} size={sm ? 14 : 16} style={{ color: tok.text }} /></span>
        <span className="kpi-label">{label}</span>
        {statusPill && oes && <span className="kpi-pill" style={{ color: tok.text, background: tok.t2 }}>{STATUS[oesToStatus(oes)].label}</span>}
      </div>
      <div className="kpi-value" style={{ color: tok.text }}>{value}</div>
      {delta && <Delta delta={delta} role={role} />}
      {sparkline && !sm && (
        <svg className="kpi-spark" width="48" height="24" viewBox="0 0 48 24" aria-hidden="true">
          <polyline points={sparkPoly(sparkline)} fill="none" stroke={tok.text} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {hint && <div className="kpi-hint">{hint}</div>}
    </div>
  )
  if (href) return <Link to={href} className="kpi-card-link" style={{ borderColor: '#E2E8F0', ['--kpi-hover' as string]: tok.text }}>{ui}</Link>
  return ui
}

function sparkfrom(role: Role, s?: number[]): number | null { return role === 'ratio' && s && s.length ? s[s.length - 1] : null }

function oesToStatus(o: 'wajar' | 'diamati' | 'perhatian') { return o === 'perhatian' ? 'perhatian' as const : o === 'diamati' ? 'diamati' as const : 'wajar' as const }

function sparkPoly(v: number[]): string {
  const max = Math.max(...v, 1), min = Math.min(...v)
  const rng = max - min || 1
  return v.map((x, i) => `${(i / (v.length - 1)) * 47 + 0.5},${23 - ((x - min) / rng) * 21 - 1}`).join(' ')
}
```

> Sharp: The old `.card.kpi` CSS is unused once replaced; keep classes until Task 8 (grep, delete there).

- [ ] **Step 2: Build**

Run: `cd /Users/salinovakbar/Downloads/sidak/web && npm run build`
Expected: `✓ built in ...` (watch TS: `statusPill` prop and imports line up — fix any import-order error from `Status`/`type` mix; `ROLE_ICON`/`OE_STATUS` are used).

- [ ] **Step 3: Commit**

```bash
git add web/src/components/KpiCard.tsx
git commit -m "feat(kpicard): semantic KPI card with role variant + delta + sparkline + pill"
```

---

### Task 3: Filter primitives `src/components/Filter.tsx`

Shared 36px controls for Antrean (and available to other pages).

**Files:**
- Create: `web/src/components/Filter.tsx`

- [ ] **Step 1: Write the file**

```tsx
import type { ReactNode } from 'react'
import { mdiChevronDown, mdiClose } from '@mdi/js'
import { Icon } from './Icon'

/** Dropdown multi-pilih (checkbox) ber-coun, trigger merangkum pilihan ("Status: 2"). */
export function FilterCheck({ label, options, selected, onToggle, all, onAll }: {
  label: string
  options: { id: string; label: string; dot?: string; cnt?: number }[]
  selected: string[]
  onToggle: (id: string) => void
  all?: boolean
  onAll?: (v: boolean) => void
}) {
  const isAll = all === true || (all === undefined && options.every(o => selected.includes(o.id)))
  return (
    <details className="fsel">
      <summary title={label}>
        <span>{label}: <b>{isAll ? 'Semua' : selected.length}</b></span>
        <Icon path={mdiChevronDown} size={16} />
      </summary>
      <div className="fsel-men" role="menuitemcheckbox">
        {all !== undefined && (
          <label className="fsel-all"><input type="checkbox" checked={isAll} onChange={e => onAll?.(e.target.checked)} />Semua</label>
        )}
        <div className="fsel-lis">
          {options.map(o => (
            <label key={o.id} className="fsel-row">
              <input type="checkbox" checked={selected.includes(o.id)} onChange={() => onToggle(o.id)} />
              {o.dot && <span className="fsel-dot" style={{ background: o.dot }} />}
              <span className="fsel-teks">{o.label}</span>
              {o.cnt != null && <span className="fsel-cnt">{o.cnt}</span>}
            </label>
          ))}
        </div>
      </div>
    </details>
  )
}

/** Baris chip filter aktif + Hapus semua + hasil filter (aria-live). */
export function FilterChips({ chips, onHapus, onHapusSemua, hasil }: {
  chips: { key: string; label: string }[]
  onHapus: (key: string) => void
  onHapusSemua: () => void
  hasil?: ReactNode
}) {
  if (chips.length === 0 && hasil == null) return null
  return (
    <div className="fchips">
      {chips.map(c => (
        <span key={c.key} className="fchip"><span>{c.label}</span><button type="button" aria-label={`Hapus ${c.label}`} onClick={() => onHapus(c.key)}><Icon path={mdiClose} size={12} /></button></span>
      ))}
      {chips.length > 0 && <button type="button" className="fchip-hapus" onClick={onHapusSemua}>Hapus semua</button>}
      {hasil != null && <span className="fhasil" aria-live="polite">{hasil}</span>}
    </div>
  )
}
```

- [ ] **Step 2: Build**

Run: `cd /Users/salinovakbar/Downloads/sidak/web && npm run build`
Expected: `✓ built in ...` (empty `Filter.tsx` compiles; imports used after Task 6).

- [ ] **Step 3: Commit**

```bash
git add web/src/components/Filter.tsx
git commit -m "feat(filter): shared checkbox-filter dropdown + active chips row"
```

---

### Task 4: styles.css — kpi-card, delta, spark, mini O/E bar, filter primitives, rail normalization, bacaan border

**Files:**
- Modify: `web/src/styles.css` (append to the ``:root``/generic area near `.kpi`, `.card`; rail overrides near `.rail-gruppen`)

- [ ] **Step 1: Append KpiCard + mini O/E bar block** (insert after the `.hint` rule, ~line 177)

```css
/* ---- v1.7: kartu KPI semantik ---- */
.kpi-card { display: flex; flex-direction: column; gap: 8px; padding: 16px; border: 1px solid #E2E8F0; border-radius: 10px; background: var(--card); min-width: 0; }
.kpi-card .kpi-top { display: flex; align-items: center; gap: 8px; }
.kpi-card .kpi-chip { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0; }
.kpi-card .kpi-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #475569; line-height: 1.3; }
.kpi-card .kpi-pill { margin-left: auto; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
.kpi-card .kpi-value { font-size: 28px; font-weight: 600; font-variant-numeric: tabular-nums; line-height: 1.05; }
.kpi-card .kpi-delta { display: inline-flex; align-items: center; gap: 3px; font-size: 12px; font-weight: 600; }
.kpi-card .kpi-spark { align-self: flex-start; }
.kpi-card .kpi-hint { font-size: 11px; color: var(--grey); margin-top: 2px; }
.kpi-card.sm { gap: 5px; padding: 10px 12px; }
.kpi-card.sm .kpi-chip { width: 24px; height: 24px; }
.kpi-card.sm .kpi-label { font-size: 10px; }
.kpi-card.sm .kpi-value { font-size: 18px; }
.kpi-card.sm .kpi-hint { display: none; }
a.kpi-card-link { text-decoration: none; color: inherit; display: block; }
a.kpi-card-link:hover, a.kpi-card-link:focus-visible { border-color: color-mix(in srgb, var(--kpi-hover) 40%, #E2E8F0); outline: 2px solid transparent; }
a.kpi-card-link:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }

/* mini bar O/E modul (Rumah): track 4px, fill warna status, tick 1,0 putus-putus */
.oe-mini { display: flex; align-items: center; gap: 6px; margin-top: 8px; }
.oe-mini .oe-track { position: relative; flex: 1; height: 4px; border-radius: 999px; background: #E2E8F0; }
.oe-mini .oe-fill { position: absolute; left: 0; top: 0; height: 4px; border-radius: 999px; }
.oe-mini .oe-tick { position: absolute; left: 62.5%; top: -3px; width: 2px; height: 10px; border-left: 1px dashed #94A3B8; }
.oe-mini .oe-tag { font-size: 9.5px; color: var(--grey-2); white-space: nowrap; }
```

- [ ] **Step 2: Append filter primitives + rail normalization** (after `.toolbar` rules, ~line 218)

```css
/* ---- v1.7: primitif toolbar 36px ---- */
.fsel { position: relative; }
.fsel summary { display: flex; align-items: center; gap: 6px; height: 36px; padding: 0 10px; border: 1px solid #E2E8F0; border-radius: 6px; background: var(--card); color: var(--ink); font-size: 13px; cursor: pointer; list-style: none; }
.fsel summary::-webkit-details-marker { display: none; }
.fsel summary svg { margin-left: auto; color: var(--grey-2); }
.fsel[open] summary { border-color: var(--brand); }
.fsel-men { position: absolute; z-index: 30; top: 40px; left: 0; width: 240px; max-height: 320px; overflow: auto; border: 1px solid #E2E8F0; border-radius: 6px; background: var(--card); box-shadow: 0 8px 24px rgba(15, 23, 42, .12); padding: 6px; font-size: 13px; }
.fsel-all { display: flex; align-items: center; gap: 6px; padding: 6px 8px; font-weight: 600; border-bottom: 1px solid var(--line); margin-bottom: 4px; cursor: pointer; }
.fsel-lis { display: flex; flex-direction: column; gap: 2px; }
.fsel-row { display: flex; align-items: center; gap: 6px; padding: 6px 8px; border-radius: 6px; cursor: pointer; }
.fsel-row:hover { background: var(--hover); }
.fsel-row input { width: 15px; height: 15px; accent-color: var(--brand); }
.fsel-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.fsel-teks { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fsel-cnt { margin-left: auto; font-size: 11px; font-variant-numeric: tabular-nums; color: var(--grey-2); }

/* baris chip filter aktif */
.fchips { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 8px 0; }
.fchip { display: inline-flex; align-items: center; gap: 4px; padding: 3px 6px 3px 9px; background: var(--brand-tint); border: 1px solid var(--line); border-radius: 999px; font-size: 12px; color: #155E75; }
.fchip button { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border: 0; border-radius: 50%; background: transparent; color: #155E75; cursor: pointer; }
.fchip button:hover { background: rgba(14, 116, 144, .12); }
.fchip-hapus { border: 0; background: none; color: var(--brand); font-size: 12px; font-weight: 600; cursor: pointer; padding: 3px 6px; }
.fchip-hapus:hover { text-decoration: underline; }
.fhasil { margin-left: auto; font-size: 12.5px; color: var(--grey); }

/* normalisasi rail Antrean ke 36px / radius 6 agar senada toolbar */
.rail .rail-di, .rail .grup-check label { min-height: 36px; border-radius: 6px; }
.rail .semua { font-weight: 600; }
```

- [ ] **Step 3: Bacaan card → amber LEFT border 3px (bukan border-top brand)** — replace the `.bacaan-card.pk` rule (~line 607)

```css
.bacaan-card.pk { border-left: 3px solid var(--amber); }
```

(Remove the old `border-top: 3px solid var(--brand)` rule; `--amber` = `#C2410C` exists.)

- [ ] **Step 4: Build**

Run: `cd /Users/salinovakbar/Downloads/sidak/web && npm run build`
Expected: `✓ built in ...` with **no** esbuild CSS warnings.

- [ ] **Step 5: Commit**

```bash
git add web/src/styles.css
git commit -m "style(v17): kpi-card + mini O/E bar + filter primitives + rail normalize + bacaan left border"
```

---

### Task 5: Beranda (Rumah) — KPI row → KpiCard, per-modul white cards + mini O/E bar

**Files:**
- Modify: `web/src/pages/Beranda.tsx`

- [ ] **Step 1: Swap imports**

Change line 6 `import { Kpi, Pilih, Tren, onEnter } from '../components/Common'` → `import { Pilih, Tren, onEnter } from '../components/Common'`
Add: `import KpiCard from '../components/KpiCard'`
Add to the `../lib/data` import line 8: `OE_STATUS`? No — it lives in `roles.ts`: add `import { OE_STATUS } from '../lib/roles'`.

- [ ] **Step 2: Replace the KPI row** (lines 76–81)

```tsx
<div className="grid4">
  <KpiCard role="attention" label="Faskes perlu perhatian" value={num(ring.n_perhatian)} href="/antrean?st=perhatian" hint={<>dari {ring.n_faskes_fkrtl + ring.n_faskes_fktp} faskes · {ring.n_diamati} lainnya diamati · buka antrean →</>} />
  <KpiCard role="money" label="Selisih rupiah (sampel)" value={rp(ring.rupiah)} hint={<>≈ <b>{rp(ring.rupiah_tertimbang)}</b> setelah dibobot ke populasi peserta</>} />
  <KpiCard role="ratio" label={`O/E ${INFO[m].pendek}, 3 bulan terakhir`} value={oe(oeTerakhir)} statusPill href={'/modul/' + m} sparkline={bulanTerakhir.map(b => b.E > 0 ? b.O / b.E : null).filter((x): x is number => x != null)} hint="kejadian nyata ÷ kejadian wajar, seluruh kota" />
  <KpiCard role="coverage" label="Cakupan data" value={`${num(ring.per_modul.readmisi.n)} RITL`} hint={`${num(ring.per_modul.fragmentasi.n)} kunjungan RJTL · ${num(ring.per_modul.rujukan.n)} kunjungan FKTP`} />
</div>
```

- [ ] **Step 3: Per-modul cards — white, number badge, amber pill, mini O/E bar, no colored top border** (replace lines 83–97)

```tsx
<h2>Per modul</h2>
<div className="grid4">
  {MODUL.map(k => { const p = ring.per_modul[k]; const oev = p.E > 0 ? p.O / p.E : null; const oes = OE_STATUS(oev); const fillW = oev == null ? 0 : Math.min(100, (oev / 1.6) * 100); return (
    <Link key={k} to={'/modul/' + k} className="card modkart" style={{ borderTopColor: 'var(--line)' }}>
      <div className="modkart-head"><span className="mono modkart-no">#{INFO[k].nomor}</span><div><h3 style={{ margin: 0 }}>{INFO[k].nama}</h3></div></div>
      <div className="kv">
        <span className="k">Dinilai</span><span>{p.n_cukup} dari {p.n_faskes} {INFO[k].unit}</span>
        <span className="k">Perlu perhatian</span><span className="modkart-pill">{p.n_perhatian}</span>
      </div>
      <div className="oe-mini">
        <div className="oe-track"><div className="oe-fill" style={{ width: fillW + '%', background: RATIO[oes].text }} /><span className="oe-tick" title="wajar" /></div>
        <span className="oe-tag">{oe(oev)}</span>
      </div>
    </Link>) })}
</div>
```

Imports to add: `RATIO` from `../lib/roles`. Remove the `Diamati` span (was a purple/accent-bearing row) — replaced by the amber pill; the pill is only rendered for the `Perlu perhatian` count.
CSS for `.modkart` (add to styles.css in Task 4's file, or here as a follow-up): `.modkart { border: 1px solid var(--line); transition: border-color var(--t-fast) var(--ease); } .modkart:hover, .modkart:focus-visible { border-color: var(--brand); text-decoration: none; } .modkart-head { display: flex; gap: 8px; align-items: center; } .modkart-no { font-size: 13px; color: var(--brand); } .modkart-pill { color: var(--perhatian); font-weight: 600; background: var(--perhatian-bg); border: 1px solid var(--perhatian-line); padding: 1px 8px; border-radius: 999px; font-size: 11px; }`

- [ ] **Step 4: Build + audit**

Run: `cd /Users/salinovakbar/Downloads/sidak/web && npm run build && npm run audit:layout`
Expected: build `✓`; audit prints `LOLOS: tidak ada luapan…`.

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/Beranda.tsx
git commit -m "feat(rumah): KpiCard semantic row + white module cards with mini O/E bar"
```

---

### Task 6: Modul page — 4 stat cards → KpiCard (ratio reactive + pill + sparkline)

**Files:**
- Modify: `web/src/pages/Modul.tsx`

- [ ] **Step 1: Imports**

Add `import KpiCard from '../components/KpiCard'`. `oe`, `rp`, `num`, `ring` already imported.

- [ ] **Step 2: Replace the stat-card block** (lines 83–88)

```tsx
<div className="grid4">
  <KpiCard role="coverage" label={`${info.unit} dinilai di Semarang`} value={p.n_cukup} href={'/antrean?mod=' + m} hint={<>dari {p.n_faskes}; minimum {ring.min_n[m]} {m === 'rujukan' ? 'kunjungan sakit' : m === 'fragmentasi' ? 'kunjungan RJTL' : 'rawat inap'}</>} />
  <KpiCard role="attention" label="Perlu perhatian" value={p.n_perhatian} href={'/antrean?st=perhatian&mod=' + m} hint={<>{p.n_diamati} diamati{m === 'fragmentasi' && p.n_diputihkan != null ? ` · ${p.n_diputihkan} wajar setelah daftar putih` : ''}</>} />
  <KpiCard role="ratio" label="O/E kota" value={oe(p.E > 0 ? p.O / p.E : null)} statusPill sparkline={(ring.tren[m] ?? []).map(b => b.E > 0 ? b.O / b.E : null).filter((x): x is number => x != null)} hint={<>{num(p.O)} kejadian vs {num(p.E, 1)} wajar</>} />
  <KpiCard role="money" label="Selisih rupiah" value={rp(p.rupiah)} href={'/antrean?mod=' + m} hint={<>sampel · ≈ {rp(p.rupiah_tertimbang)} tertimbang</>} />
</div>
```

- [ ] **Step 3: Build + audit**

Run: `cd /Users/salinovakbar/Downloads/sidak/web && npm run build && npm run audit:layout`
Expected: build `✓`, audit `LOLOS`.

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/Modul.tsx
git commit -m "feat(modul): module stat cards → semantic KpiCard (ratio reactive + sparkline)"
```

---

### Task 7: Profil — metrik chips → KpiCard `sm`

**Files:**
- Modify: `web/src/pages/Profil.tsx` (metrik block lines 128–133)

- [ ] **Step 1: Imports**

Add `import KpiCard from '../components/KpiCard'`.

- [ ] **Step 2: Replace `.metrik` block**

```tsx
<div className="metrik" style={{ marginTop: 12 }}>
  <KpiCard role="ratio" label="O/E" value={oe(h!.OE)} variant="sm" />
  <KpiCard role="neutral" label="Skor z" value={h!.z == null ? '–' : num(h!.z, 2)} variant="sm" />
  <KpiCard role="coverage" label={`Volume ${INFO[m].kejadian.toLowerCase()}`} value={num(h!.n)} variant="sm" />
  <KpiCard role="money" label="≈ Selisih tertimbang" value={rp(h!.rupiah_tertimbang)} variant="sm" />
</div>
```

- [ ] **Step 3: CSS — `.metrik` now wraps 4 grid chips**: adjust `.metrik .mk` not needed (KpiCard has own classes); add `.metrik { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }` in styles.css (replace existing `.metrik` flex rule) and remove the now-unused `.metrik .mk` rules **only after** grep confirms no other `.mk` usage:

Run: `rg -n "className=\"mk\"|\.metrik \.mk" web/src`
Expected: only the block replaced. Then in styles.css replace `.metrik` and delete `.metrik .mk`, `.metrik .mk b`, `.metrik .mk span`.

- [ ] **Step 4: Build + audit**

Run: `cd /Users/salinovakbar/Downloads/sidak/web && npm run build && npm run audit:layout`
Expected: build `✓`, audit `LOLOS`.

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/Profil.tsx web/src/styles.css
git commit -m "feat(profil): metric chips → sm KpiCard by role"
```

---

### Task 8: Antrean — FilterCheck dropdowns, chips row, result count, export (n), cleanup

**Files:**
- Modify: `web/src/pages/Antrean.tsx`

- [ ] **Step 1: Imports**

```tsx
import { FilterCheck, FilterChips } from '../components/Filter'
```

- [ ] **Step 2: Replace the `Status` and `Modul` checkbox groups in the rail** (lines 139–154) with `FilterCheck`:

```tsx
<div className="gruppen">
  <h4>Status</h4>
  <FilterCheck label="Status" all selected={stArr === (Object.keys(ctl.st) as Status[]) ? (Object.keys(ctl.st) as Status[]) : stArr} options={(Object.keys(ctl.st) as Status[]).map(s => ({ id: s, label: STATUS[s].label, dot: STATUS[s].warna, cnt: ctl.st[s] }))}
    onToggle={s => patch('st', (stArr.includes(s as Status) ? stArr.filter(x => x !== s) : [...stArr, s as Status]).join('|'))}
    onAll={v => patch('st', v ? (Object.keys(ctl.st) as Status[]).join('|') : null)} />
</div>
<div className="gruppen">
  <h4>Modul</h4>
  <FilterCheck label="Modul" all selected={modArr} options={MODUL.map(m2 => ({ id: m2, label: `#${INFO[m2].nomor} ${INFO[m2].nama}`, dot: INFO[m2].warna, cnt: ctl.mo[m2] }))}
    onToggle={m2 => patch('mod', (modArr.includes(m2 as Modul) ? modArr.filter(x => x !== m2) : [...modArr, m2 as Modul]).join('|'))}
    onAll={v => patch('mod', v ? MODUL.join('|') : null)} />
</div>
```

- [ ] **Step 3: Add active-filter chips row under the toolbar** (after toolbar close `</div>` at line 182, before the `.card.soft` result bar):

```tsx
<FilterChips
  chips={[
    ...(wil === 'jateng' ? [{ key: 'wil', label: 'Wilayah: Jawa Tengah' }] : []),
    ...(stArr.length !== 2 || !stArr.includes('perhatian') || !stArr.includes('diamati') ? [{ key: 'st', label: `Status: ${stArr.length}` }] : []),
    ...(modArr.length !== 4 ? [{ key: 'mod', label: `Modul: ${modArr.length}` }] : []),
    ...(kelas !== 'semua' ? [{ key: 'kelas', label: `Kelas: ${kelas}` }] : []),
    ...(q ? [{ key: 'q', label: `Cari: ${q}` }] : []),
  ]}
  onHapus={key => { if (key === 'wil') patch('wil', 'semarang'); if (key === 'st') patch('st', 'perhatian|diamati'); if (key === 'mod') patch('mod', MODUL.join('|')); if (key === 'kelas') patch('kelas', null); if (key === 'q') patch('q', null) }}
  onHapusSemua={longgarkan}
  hasil={<>{rows.length} faskes cocok</>}
/>
```

- [ ] **Step 4: Export button count** — line 181 → `Ekspor CSV ({num(rows.length)})`. Keep `aria-label`-clear.

- [ ] **Step 5: Empty-state copy + longgarkan** — line 220 → `Tidak ada faskes pada kombinasi filter ini.` (button stays).

- [ ] **Step 6: Delete now-dead `Kpi` from Common.tsx** if grep says zero usages:

Run: `rg -n "<Kpi" web/src`
Expected: no matches. Then remove the `Kpi` function (lines 59–63) and the `.kpi`/`.kpi .v`/`.kpi .l`/`.kpi.red/...` CSS rules (styles.css ~172–176) if grep shows no other `.kpi` usage; keep `.card` base. Rebuild.

- [ ] **Step 7: Build + audit + height check**

Run: `cd /Users/salinovakbar/Downloads/sidak/web && npm run build && npm run audit:layout`
Also manual: in dev/preview, measure `.fsel summary` height = 36px, `.pilih select` = 36px, `.cari input` = 36px.
Expected: audit `LOLOS`; heights 36px.

- [ ] **Step 8: Commit**

```bash
git add web/src/pages/Antrean.tsx web/src/components/Common.tsx web/src/styles.css
git commit -m "feat(antrean): shared filter dropdowns + chips row + live count + csv (n)"
```

---

### Task 9: Screenshot matrix `scripts/shots-v17.mjs`

**Files:**
- Create: `web/scripts/shots-v17.mjs`

- [ ] **Step 1: Script** — reuse the harness pattern from `shots-v14.mjs` (route intercept for `/api/ai/digest` returning `[]`, mock `/api/chat` 503) — capture at 1440×900 and 1024×820:

1. `/` — KPI row tinted; per-modul white cards (file `01-rumah.md` as `01-rumah.png`).
2. `/` scroll to "Per modul" (file `02-permodul.png`).
3. `/modul/readmisi` — 4 KpiCards, O/E > 1.2 (file `03-modul.png`).
4. `/faskes/RS-31595` — sm chips (file `04-profil.png`).
5. `/antrean?st=perhatian|diamati&mod=readmisi|rujukan` — toolbar + chips row + result count + rail (file `05-antrean-chip.png`).
6. `/antrean` (defaults) — no chips row (file `06-antrean-default.png`).
7. Repeat 3 & 5 at 1024 (files `07-modul-1024.png`, `08-antrean-1024.png`).

Acceptance assert (playwright `expect`):
- `.kpi-card` count on `/` = 4; each has `.kpi-chip` background = token `t1`-adjacent ≠ white.
- `/modul/readmisi` `.kpi-card` with label `O/E kota` has `.kpi-pill` text `Perlu perhatian` (readmisi O/E > 1.2 per city data — verify at runtime; if readmisi city O/E not >1.2, assert against *actual* `OE_STATUS` result instead of hardcoding).
- `/antrean?…` has `.fchips`; `/antrean` (defaults) has none.
- `Ekspor CSV (N)` text present when rows>0.
- Save PNGs to `web/shots-v17/`.

- [ ] **Step 2: Run**

Run: `mkdir -p /Users/salinovakbar/Downloads/sidak/web/shots-v17 && node scripts/shots-v17.mjs`
Expected: 8 PNGs + assertion PASS logs (exit 0).

- [ ] **Step 3: Commit**

```bash
git add web/scripts/shots-v17.mjs
git commit -m "test(v17): screenshot + acceptance matrix (persist-agnostic OE pill)"
```

---

### Task 10: Acceptance sweep (final gate)

- [ ] **Step 1: Contrast audit** — recompute with the token file values (see spec, expected ratios ≥ 3:1 large text everywhere; wajar value is 3.19 = large-text-only, documented).
- [ ] **Step 2: grep no hardcoded hex** outside token file for the *new* surfaces:

Run: `rg -n "#[0-9A-Fa-f]{6}" web/src/lib/roles.ts web/src/components/KpiCard.tsx web/src/components/Filter.tsx web/src/pages/Beranda.tsx web/src/pages/Modul.tsx web/src/pages/Profil.tsx web/src/pages/Antrean.tsx`
Expected: matches ONLY in `roles.ts` (#0E7490 etc.) — no hex in page files.
- [ ] **Step 3: Full gates**

Run: `cd /Users/salinovakbar/Downloads/sidak/web && npm run build && npm run audit:layout && node scripts/shots-v17.mjs`
Expected: build `✓`, audit `LOLOS`, screenshots exit 0.
- [ ] **Step 4: Commit any leftovers**

```bash
git add -A web
git commit -m "chore(v17): acceptance green"
```

---

### Self-review notes

- `OE_STATUS` threshold (1.05/1.2) matches spec; `RATIO[oes].text` fills the mini O/E bar (ambers = orange ramp, wajar = teal) — no per-module hues introduced.
- The Bacaan card keeps white bg + Sparkle; only its edge accent becomes amber-left (Task 4 Step 3), distinct from KpiCard tints, satisfying "reserved left border" rule.
- Delta color is never arrow-direction based: `POLARITY[role]` decides (worsening for attention/money/ratio; neutral for coverage/neutral), and `POLARITY_COLOR` maps to amber/teal/slate — a `+12%` on coverage renders slate (per acceptance).
- No new npm packages; `color-mix()` used once — supported in all evergreen browsers (Chrome 111+, Safari 16.2+).
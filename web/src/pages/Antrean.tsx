import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { mdiDeleteOutline, mdiDownload, mdiPlaylistPlus } from '@mdi/js'
import { Cari, Pager, Pilih, onEnter } from '../components/Common'
import { FilterCheck, FilterChips } from '../components/Filter'
import { Icon } from '../components/Icon'
import { LABEL_AUDIT, OEChip, Progres, RupiahText, StatusPill } from '../components/sig'
import { CATATAN_KEY, Faskes, INFO, KOTA, MODUL, Modul, STATUS, Status, StatusAudit, TAB_KEY, ambilJSON, bacaStatusAudit, judulKab, num, rp, simpanStatusAudit, useData } from '../lib/data'

interface Baris { key: string; f: Faskes; m: Modul; status: Status; OE: number | null; z: number | null; n: number; rupiah_t: number }

interface Simpan { label: string; wil: string; mods: string; sts: string; urut: string; kelas: string; q: string }

export default function Antrean() {
  const { faskes } = useData()
  const nav = useNavigate()
  const [sp, setSP] = useSearchParams()

  const wil = (sp.get('wil') === 'jateng' ? 'jateng' : 'semarang') as 'semarang' | 'jateng'
  const stArr = (sp.get('st')?.split('|').filter(Boolean) as Status[]) || ['perhatian', 'diamati']
  const modArr = (sp.get('mod')?.split('|').filter(Boolean) as Modul[]) || MODUL
  const kelas = sp.get('kelas') ?? 'semua'
  const urut = sp.get('urut') ?? 'rupiah_t'
  const urutCol = urut.startsWith('-') ? urut.slice(1) : urut
  const urutNaik = urut.startsWith('-')
  const q = sp.get('q') ?? ''

  const patch = (k: string, v: string | null) => {
    const n = new URLSearchParams(sp)
    if (v == null || v === '') n.delete(k); else n.set(k, v)
    setSP(n, { replace: true })
  }

  const dasar = useMemo(() => faskes.filter(f => wil === 'jateng' || f.kab === KOTA), [faskes, wil])

  const ctl = useMemo(() => {
    const st: Record<Status, number> = { perhatian: 0, diamati: 0, wajar: 0, volume_rendah: 0 }
    const mo: Record<Modul, number> = { rujukan: 0, severity: 0, fragmentasi: 0, readmisi: 0 }
    dasar.forEach(f => MODUL.forEach(m => { const h = f.modul[m]; if (h) { st[h.status]++; mo[m]++ } }))
    return { st, mo }
  }, [dasar])

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const out: Baris[] = []
    dasar.forEach(f => MODUL.forEach(m => {
      const h = f.modul[m]
      if (!h) return
      if (!modArr.includes(m)) return
      if (!stArr.includes(h.status)) return
      if (kelas !== 'semua' && f.kelas_pendek !== kelas) return
      if (ql && !f.label.toLowerCase().includes(ql) && !f.kab.toLowerCase().includes(ql) && !f.id.toLowerCase().includes(ql)) return
      out.push({ key: f.id + '|' + m, f, m, status: h.status, OE: h.OE, z: h.z, n: h.n, rupiah_t: h.rupiah_tertimbang })
    }))
    const ord = urutCol === 'OE' ? ((r: Baris) => r.OE) : urutCol === 'z' ? ((r: Baris) => r.z) : urutCol === 'n' ? ((r: Baris) => r.n) : ((r: Baris) => r.rupiah_t)
    const arah = urutNaik ? 1 : -1
    return out.sort((a, b) => arah * (((ord(b) ?? -1) as number) - ((ord(a) ?? -1) as number)))
  }, [dasar, modArr, stArr, kelas, urut, q])

  const kelasList = Array.from(new Set(dasar.map(f => f.kelas_pendek))).sort()
  const KELAS_OPSI = [{ nilai: 'semua', label: 'Semua kelas/jenis' }, ...kelasList.map(k => ({ nilai: k, label: k }))]
  const totalT = rows.reduce((s, r) => s + r.rupiah_t, 0)
  const [page, setPage] = useState(1)
  const [per, setPer] = useState(50)
  useEffect(() => setPage(1), [wil, modArr.join('|'), stArr.join('|'), kelas, urut, q])
  const tampil = rows.slice((page - 1) * per, page * per)

  const chipList = [
    ...(wil === 'jateng' ? [{ key: 'wil', label: 'Wilayah: Jawa Tengah' }] : []),
    ...(!(stArr.length === 2 && stArr.includes('perhatian') && stArr.includes('diamati')) ? [{ key: 'st', label: 'Status: ' + stArr.length }] : []),
    ...(modArr.length !== MODUL.length ? [{ key: 'mod', label: 'Modul: ' + modArr.length }] : []),
    ...(kelas !== 'semua' ? [{ key: 'kelas', label: 'Kelas: ' + kelas }] : []),
    ...(q ? [{ key: 'q', label: 'Cari: ' + q }] : []),
  ]

  const sort = (kol: string) => {
    if (urut === kol) patch('urut', '-' + kol)
    else if (urut === '-' + kol) patch('urut', kol === 'rupiah_t' ? null : kol)
    else patch('urut', kol)
  }
  const longgarkan = () => { const n = new URLSearchParams(); if (wil === 'jateng') n.set('wil', 'jateng'); setSP(n); setPage(1) }

  const [versi, setVersi] = useState(0)
  const audit = useMemo(() => { void versi; return bacaStatusAudit() }, [versi])
  const catatan = useMemo(() => ambilJSON(CATATAN_KEY), [versi])

  const [sel, setSel] = useState<Set<string>>(new Set())
  const toggle = (k: string) => { const n = new Set(sel); if (n.has(k)) n.delete(k); else n.add(k); setSel(n) }
  const semuaTampil = tampil.every(r => sel.has(r.key))
  const toggleSemua = () => setSel(semuaTampil ? new Set() : new Set(tampil.map(r => r.key)))

  const [toast, setToast] = useState<{ t: string; undo?: () => void } | null>(null)
  const toastRef = useRef<number | undefined>(undefined)
  const tonjolkan = (t: string, undo?: () => void) => { window.clearTimeout(toastRef.current); setToast({ t, undo }); toastRef.current = window.setTimeout(() => setToast(null), 4200) }

  const setProgres = (f: Faskes, s: StatusAudit) => {
    const lama = audit[f.id] ?? 'belum'
    if (lama === s) return
    simpanStatusAudit(f.id, s); setVersi(v => v + 1)
    tonjolkan(`Progres audit ${f.label} → ${LABEL_AUDIT[s]}`, () => { simpanStatusAudit(f.id, lama); setVersi(v => v + 1); setToast(null) })
  }
  const buka = (e: { ctrlKey?: boolean; metaKey?: boolean; button?: number }, id: string) => {
    if (e.ctrlKey || e.metaKey || e.button === 1) { window.open('/faskes/' + id, '_blank', 'noopener'); return }
    nav('/faskes/' + id)
  }
  const batch = (s: StatusAudit) => {
    if (sel.size === 0) return
    sel.forEach(k => simpanStatusAudit(k.split('|')[0], s))
    tonjolkan(`${sel.size} baris → ${LABEL_AUDIT[s]}`)
    setSel(new Set()); setVersi(v => v + 1)
  }

  const [tabs, setTabs] = useState<Simpan[]>(() => { try { return JSON.parse(localStorage.getItem(TAB_KEY) || '[]') } catch { return [] } })
  const tutupTabs = (l: Simpan[]) => { setTabs(l); try { localStorage.setItem(TAB_KEY, JSON.stringify(l)) } catch { /* abaikan */ } }
  const simpanTampilan = () => {
    const label = window.prompt('Nama tampilan (opsional):', '')
    if (label === null) return
    const snap: Simpan = { label: label || 'Tampilan ' + (tabs.length + 1), wil, mods: modArr.join('|'), sts: stArr.join('|'), urut, kelas, q }
    tutupTabs([...tabs, snap])
  }
  const terapkan = (t: Simpan) => {
    const n = new URLSearchParams()
    if (t.wil !== 'semarang') n.set('wil', t.wil)
    if (t.mods && t.mods !== MODUL.join('|')) n.set('mod', t.mods)
    if (t.sts && t.sts !== ['perhatian', 'diamati'].join('|')) n.set('st', t.sts)
    if (t.urut !== 'rupiah_t') n.set('urut', t.urut)
    if (t.kelas && t.kelas !== 'semua') n.set('kelas', t.kelas)
    if (t.q) n.set('q', t.q)
    setSP(n)
  }
  const hapus = (t: Simpan) => tutupTabs(tabs.filter(x => x !== t))

  function ekspor() {
    const head = ['faskes', 'tipe', 'kab_kota', 'kelas', 'kepemilikan', 'modul', 'status', 'stabil', 'n', 'O', 'E', 'OE', 'z', 'selisih_rupiah_sampel', 'selisih_rupiah_tertimbang', 'status_audit']
    const lines = rows.map(r => { const h = r.f.modul[r.m]!; return [r.f.label, r.f.tipe, r.f.kab, r.f.kelas, r.f.milik, `#${INFO[r.m].nomor} ${INFO[r.m].nama}`, r.status, h.stabil ? 'ya' : 'tidak', h.n, h.O, h.E, h.OE ?? '', h.z ?? '', h.rupiah, h.rupiah_tertimbang, LABEL_AUDIT[audit[r.f.id] ?? 'belum']].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';') })
    const blob = new Blob(['\ufeff' + [head.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'sidak_antrean_audit.csv'; a.click()
  }

  return (
    <div className="lay-ant">
      <aside className="rail" aria-label="Filter antrean">
        <div className="gruppen">
          <h4>Wilayah</h4>
          <button type="button" className={'rail-di' + (wil === 'semarang' ? ' on' : '')} onClick={() => patch('wil', 'semarang')}><span className="odot" style={{ background: 'var(--brand)' }} />Kota Semarang<span className="cnt">{dasar.filter(f => f.kab === KOTA).length}</span></button>
          <button type="button" className={'rail-di' + (wil === 'jateng' ? ' on' : '')} onClick={() => patch('wil', 'jateng')}><span className="odot" style={{ background: 'var(--grey-2)' }} />Seluruh Jawa Tengah<span className="cnt">{dasar.length}</span></button>
        </div>
        <div className="gruppen">
          <h4>Status</h4>
          <FilterCheck label="Status" options={(Object.keys(ctl.st) as Status[]).map(s => ({ id: s, label: STATUS[s].label, dot: STATUS[s].warna, cnt: ctl.st[s] }))}
            selected={stArr} onToggle={s => patch('st', (stArr.includes(s as Status) ? stArr.filter(x => x !== s) : [...stArr, s as Status]).join('|'))}
            onAll={v => patch('st', v ? (Object.keys(ctl.st) as Status[]).join('|') : null)} />
        </div>
        <div className="gruppen">
          <h4>Modul</h4>
          <FilterCheck label="Modul" options={MODUL.map(m2 => ({ id: m2, label: `#${INFO[m2].nomor} ${INFO[m2].nama}`, dot: INFO[m2].warna, cnt: ctl.mo[m2] }))}
            selected={modArr} onToggle={m2 => patch('mod', (modArr.includes(m2 as Modul) ? modArr.filter(x => x !== m2) : [...modArr, m2 as Modul]).join('|'))}
            onAll={v => patch('mod', v ? MODUL.join('|') : null)} />
        </div>
      </aside>

      <section style={{ minWidth: 0 }}>
        <div className="tabs" role="tablist" aria-label="Tampilan tersimpan">
          <button type="button" className="btn sm" onClick={simpanTampilan} title="Simpan filter saat ini"><Icon path={mdiPlaylistPlus} size={15} /> Simpan tampilan</button>
          {tabs.map((t, i) => {
            const kini = [wil, modArr.join('|'), stArr.join('|'), urut, kelas, q].join('§')
            const itu = [t.wil, t.mods, t.sts, t.urut, t.kelas, t.q].join('§')
            return (
              <span key={t.label + i} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                <button type="button" className={kini === itu ? 'on' : ''} onClick={() => terapkan(t)}>{t.label}</button>
                <button type="button" className="cari-x" onClick={() => hapus(t)} aria-label={`Hapus tampilan ${t.label}`} style={{ position: 'static', width: 18, height: 18 }}><Icon path={mdiDeleteOutline} size={13} /></button>
              </span>
            )
          })}
        </div>

        <div className="toolbar">
          <div className="seg" role="group" aria-label="Wilayah">
            <button type="button" className={wil === 'semarang' ? 'on' : ''} onClick={() => patch('wil', 'semarang')}>Kota Semarang</button>
            <button type="button" className={wil === 'jateng' ? 'on' : ''} onClick={() => patch('wil', 'jateng')}>Jawa Tengah</button>
          </div>
          <Pilih label="Kelas" nilai={kelas} ubah={v => patch('kelas', v === 'semua' ? null : v)} opsi={KELAS_OPSI} />
          <Pilih label="Urut" nilai={urutCol} ubah={v => patch('urut', v === 'rupiah_t' ? null : v)} opsi={[{ nilai: 'rupiah_t', label: 'Rupiah tertimbang' }, { nilai: 'OE', label: 'O/E' }, { nilai: 'z', label: 'Skor z' }, { nilai: 'n', label: 'Volume' }]} />
          <span style={{ flex: 1 }} />
          <Cari nilai={q} ubah={v => patch('q', v || null)} saran="Cari kode / nama / kab" />
          <button className="btn" onClick={ekspor}><Icon path={mdiDownload} size={15} /> Ekspor CSV ({num(rows.length)})</button>
        </div>

        <FilterChips chips={chipList} onHapus={key => { if (key === 'wil') patch('wil', 'semarang'); if (key === 'st') patch('st', 'perhatian|diamati'); if (key === 'mod') patch('mod', MODUL.join('|')); if (key === 'kelas') patch('kelas', null); if (key === 'q') patch('q', null) }} onHapusSemua={longgarkan} hasil={chipList.length > 0 ? (<>{rows.length} faskes cocok</>) : undefined} />

        <div className="card soft" style={{ padding: '8px 12px', fontSize: 13, marginBottom: 8 }} aria-live="polite"><b>{rows.length}</b> temuan · selisih tertimbang <b>{rp(totalT)}</b>{sel.size > 0 && <> · <b>{sel.size}</b> dipilih</>}</div>

        {sel.size > 0 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, padding: '8px 12px', background: 'var(--brand-tint)', borderRadius: 10, border: '1px solid var(--line)' }}>
            <b>{sel.size} baris dipilih.</b>
            <button className="btn sm primary" onClick={() => batch('sedang')}>Tandai Sedang diaudit</button>
            <button className="btn sm primary" style={{ background: 'var(--green)', borderColor: 'var(--green)' }} onClick={() => batch('selesai')} onMouseEnter={e => (e.currentTarget.style.background = 'var(--green-hover)')} onMouseLeave={e => { e.currentTarget.style.background = 'var(--green)'; } }>Tandai Selesai</button>
            <button className="btn sm" onClick={() => setSel(new Set())}>Batal</button>
          </div>
        )}

        <div className="card" style={{ padding: 0 }}>
          <div className="table-scroll">
            <table className="t">
              <thead><tr>
                <th style={{ width: 30 }}><input className="checkbox-c" type="checkbox" aria-label="Pilih semua" checked={semuaTampil} onChange={toggleSemua} /></th>
                <th>Faskes</th>{wil === 'jateng' && <th>Kab/Kota</th>}<th>Modul</th><th>Status</th>
                <th className="num" aria-sort={urutCol === 'OE' ? (urutNaik ? 'ascending' : 'descending') : undefined}><button type="button" className="th-sort" onClick={() => sort('OE')}>O/E (z){urutCol === 'OE' && (urutNaik ? ' ↑' : ' ↓')}</button></th>
                <th className="num" aria-sort={urutCol === 'rupiah_t' ? (urutNaik ? 'ascending' : 'descending') : undefined}><button type="button" className="th-sort" onClick={() => sort('rupiah_t')}>≈ Selisih tbg{urutCol === 'rupiah_t' && (urutNaik ? ' ↑' : ' ↓')}</button></th>
                <th>Progres</th><th>Catatan</th>
              </tr></thead>
              <tbody>
                {tampil.map(r => (
                  <tr key={r.key} tabIndex={0} role="link" aria-label={`Buka profil ${r.f.label}`} className={'tr-' + r.status} onClick={e => buka(e, r.f.id)} onKeyDown={onEnter(() => nav('/faskes/' + r.f.id))}>
                    <td onClick={e => e.stopPropagation()}><input className="checkbox-c" type="checkbox" aria-label={`Pilih ${r.f.label}`} checked={sel.has(r.key)} onChange={() => toggle(r.key)} /></td>
                    <td><b>{r.f.label}</b><div className="hint" style={{ marginTop: 1 }}>{r.f.kelas_pendek} · {r.f.milik}</div></td>
                    {wil === 'jateng' && <td>{judulKab(r.f.kab)}</td>}
                    <td><span style={{ color: INFO[r.m].warna, fontWeight: 600 }}>#{INFO[r.m].nomor}</span> {INFO[r.m].pendek}</td>
                    <td><StatusPill s={r.status} /></td>
                    <td className="num"><OEChip v={r.OE} z={r.z} n={r.n} st={r.status} /></td>
                    <td className="num"><RupiahText v={r.rupiah_t} /></td>
                    <td onClick={e => e.stopPropagation()}><Progres nilai={audit[r.f.id] ?? 'belum'} fb={s => setProgres(r.f, s)} /></td>
                    <td className="hint" style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 0 }}>{String(catatan[r.f.id] ?? '–')}</td>
                  </tr>
                ))}
                {tampil.length === 0 && <tr><td colSpan={wil === 'jateng' ? 9 : 8}>
                  <div style={{ textAlign: 'center', padding: 20 }}><div style={{ marginBottom: 8 }}>Tidak ada faskes pada kombinasi filter ini.</div><button type="button" className="btn sm" onClick={longgarkan}>Longgarkan filter</button></div>
                </td></tr>}
              </tbody>
            </table>
          </div>
          {rows.length > 0 && <Pager total={rows.length} page={page} per={per} ubah={setPage} ubahPer={p => { setPer(p); setPage(1) }} />}
        </div>
      </section>

      {toast && <div className="toast" role="status"><span>{toast.t}</span>{toast.undo && <button type="button" onClick={toast.undo}>Urungkan</button>}</div>}
    </div>
  )
}
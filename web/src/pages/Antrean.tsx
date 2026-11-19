import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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
  const stArr = (sp.get('st')?.split('|').filter(x => x in STATUS) as Status[]) || ['perhatian', 'diamati']
  const modArr = (sp.get('mod')?.split('|').filter(x => (MODUL as string[]).includes(x)) as Modul[]) || MODUL
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
    const arah = urutNaik ? -1 : 1
    // nilai kosong (mis. z tanpa varians) selalu di bawah, apa pun arah urutnya
    return out.sort((a, b) => { const x = ord(a), y = ord(b); if (x == null) return y == null ? 0 : 1; if (y == null) return -1; return arah * (y - x) })
  }, [dasar, modArr, stArr, kelas, urut, q])

  const kelasList = Array.from(new Set(dasar.map(f => f.kelas_pendek))).sort()
  const KELAS_OPSI = [{ nilai: 'semua', label: 'Semua kelas/jenis' }, ...kelasList.map(k => ({ nilai: k, label: k }))]
  const totalT = rows.reduce((s, r) => s + r.rupiah_t, 0)
  const [page, setPage] = useState(1)
  const [per, setPer] = useState(50)
  useEffect(() => setPage(1), [wil, modArr.join('|'), stArr.join('|'), kelas, urut, q])
  const tampil = rows.slice((page - 1) * per, page * per)

  // Setiap nilai filter aktif jadi chip sendiri; "none" menyimpan pilihan kosong di URL tanpa jatuh ke default.
  const chipList = [
    ...(wil === 'jateng' ? [{ key: 'wil', label: 'Jawa Tengah' }] : []),
    ...stArr.map(s2 => ({ key: 'st:' + s2, label: STATUS[s2].label })),
    ...(modArr.length !== MODUL.length ? modArr.map(m2 => ({ key: 'mod:' + m2, label: `#${INFO[m2].nomor} ${INFO[m2].pendek}` })) : []),
    ...(kelas !== 'semua' ? [{ key: 'kelas', label: 'Kelas ' + kelas }] : []),
    ...(q ? [{ key: 'q', label: `"${q}"` }] : []),
  ]
  const hapusChip = (key: string) => {
    const [k, v] = key.split(':')
    if (k === 'wil') patch('wil', null)
    if (k === 'st') { const n = stArr.filter(x => x !== v); patch('st', n.length ? n.join('|') : 'none') }
    if (k === 'mod') { const n = modArr.filter(x => x !== v); patch('mod', n.length ? n.join('|') : 'none') }
    if (k === 'kelas') patch('kelas', null)
    if (k === 'q') patch('q', null)
  }
  const ubahSt = (s2: Status) => { const n = stArr.includes(s2) ? stArr.filter(x => x !== s2) : [...stArr, s2]; patch('st', n.length ? n.join('|') : 'none') }
  const ubahMod = (m2: Modul) => { const n = modArr.includes(m2) ? modArr.filter(x => x !== m2) : [...modArr, m2]; patch('mod', n.length === MODUL.length ? null : n.length ? n.join('|') : 'none') }
  const nFilter = (wil === 'jateng' ? 1 : 0) + (stArr.join('|') !== 'perhatian|diamati' ? 1 : 0) + (modArr.length !== MODUL.length ? 1 : 0) + (kelas !== 'semua' ? 1 : 0) + (q ? 1 : 0)
  const [lembar, setLembar] = useState(false)
  useEffect(() => {
    if (!lembar) return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setLembar(false) }
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k)
  }, [lembar])

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
  const [namaBaru, setNamaBaru] = useState<string | null>(null)
  const simpanTampilan = () => {
    if (namaBaru === null) return
    const snap: Simpan = { label: namaBaru.trim() || 'Tampilan ' + (tabs.length + 1), wil, mods: modArr.join('|'), sts: stArr.join('|'), urut, kelas, q }
    tutupTabs([...tabs, snap])
    setNamaBaru(null)
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

  const nKota = faskes.filter(f => f.kab === KOTA).length
  const URUT_OPSI = [{ nilai: 'rupiah_t', label: 'Selisih tertimbang' }, { nilai: 'OE', label: 'O/E' }, { nilai: 'z', label: 'Skor z' }, { nilai: 'n', label: 'Volume' }]
  const segWilayah = (
    <div className="seg" role="group" aria-label="Wilayah">
      <button type="button" className={wil === 'semarang' ? 'on' : ''} aria-pressed={wil === 'semarang'} onClick={() => patch('wil', null)}>Kota Semarang <span className="seg-n">{num(nKota)}</span></button>
      <button type="button" className={wil === 'jateng' ? 'on' : ''} aria-pressed={wil === 'jateng'} onClick={() => patch('wil', 'jateng')}>Jawa Tengah <span className="seg-n">{num(faskes.length)}</span></button>
    </div>
  )

  return (
    <div className="lay-ant">
      <div className="tabs" role="tablist" aria-label="Tampilan tersimpan">
        {namaBaru === null
          ? <button type="button" className="btn sm" onClick={() => setNamaBaru('')} title="Simpan filter saat ini"><Icon path={mdiPlaylistPlus} size={15} /> Simpan tampilan</button>
          : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <input autoFocus aria-label="Nama tampilan" placeholder="Nama tampilan (opsional)" value={namaBaru} onChange={e => setNamaBaru(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') simpanTampilan(); if (e.key === 'Escape') setNamaBaru(null) }} style={{ height: 32, padding: '0 8px', border: '1px solid var(--line)', borderRadius: 6, font: 'inherit', fontSize: 13 }} />
              <button type="button" className="btn sm primary" onClick={simpanTampilan}>Simpan</button>
              <button type="button" className="btn sm" onClick={() => setNamaBaru(null)}>Batal</button>
            </span>}
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

      <div className="ant-bar" role="toolbar" aria-label="Filter antrean">
        {segWilayah}
        <FilterCheck label="Status" options={(Object.keys(ctl.st) as Status[]).map(s2 => ({ id: s2, label: STATUS[s2].label, dot: STATUS[s2].warna, cnt: ctl.st[s2] }))}
          selected={stArr} onToggle={s2 => ubahSt(s2 as Status)}
          onAll={v => patch('st', v ? (Object.keys(ctl.st) as Status[]).join('|') : 'none')} />
        <FilterCheck label="Modul" options={MODUL.map(m2 => ({ id: m2, label: `#${INFO[m2].nomor} ${INFO[m2].pendek}`, dot: INFO[m2].warna, cnt: ctl.mo[m2] }))}
          selected={modArr} onToggle={m2 => ubahMod(m2 as Modul)}
          onAll={v => patch('mod', v ? null : 'none')} />
        <Pilih label="Kelas" nilai={kelas} ubah={v => patch('kelas', v === 'semua' ? null : v)} opsi={KELAS_OPSI} />
        <Pilih label="Urut" nilai={urutCol} ubah={v => patch('urut', v === 'rupiah_t' ? null : v)} opsi={URUT_OPSI} />
        <Cari nilai={q} ubah={v => patch('q', v || null)} saran="Cari kode faskes" />
        <button className="btn" onClick={ekspor}><Icon path={mdiDownload} size={15} /> Ekspor CSV ({num(rows.length)})</button>
      </div>

      <div className="ant-hp" role="toolbar" aria-label="Filter antrean">
        <button type="button" className="btn" onClick={() => setLembar(true)} aria-haspopup="dialog">Filter{nFilter > 0 ? ` (${nFilter})` : ''}</button>
        <Pilih label="Urut" nilai={urutCol} ubah={v => patch('urut', v === 'rupiah_t' ? null : v)} opsi={URUT_OPSI} />
      </div>

      <FilterChips chips={chipList} onHapus={hapusChip} onHapusSemua={longgarkan} />

      <div className="ant-ringkas" aria-live="polite"><b>{num(rows.length)}</b> temuan · selisih tertimbang <b>{rp(totalT)}</b>{sel.size > 0 && <> · <b>{sel.size}</b> dipilih</>}</div>

      {sel.size > 0 && (
        <div className="ant-batch">
          <b>{sel.size} baris dipilih.</b>
          <button className="btn sm primary" onClick={() => batch('sedang')}>Tandai Sedang diaudit</button>
          <button className="btn sm primary hijau" onClick={() => batch('selesai')}>Tandai Selesai</button>
          <button className="btn sm" onClick={() => setSel(new Set())}>Batal</button>
        </div>
      )}

      <div className="card ant-tabel" style={{ padding: 0 }}>
        <div className="table-scroll">
          <table className="t">
            <thead><tr>
              <th style={{ width: 30 }}><input className="checkbox-c" type="checkbox" aria-label="Pilih semua" checked={semuaTampil} onChange={toggleSemua} /></th>
              <th>Faskes</th>{wil === 'jateng' && <th>Kab/Kota</th>}<th>Modul</th><th>Status</th>
              <th className="num" aria-sort={urutCol === 'OE' ? (urutNaik ? 'ascending' : 'descending') : undefined}><button type="button" className="th-sort istilah" onClick={() => sort('OE')} data-tip="O/E" data-tip-desc="Kejadian nyata dibagi kejadian wajar. 1,00 berarti sama dengan rekan sebaya; 1,46 berarti 46% lebih banyak." aria-describedby="sidak-tip">O/E{urutCol === 'OE' && (urutNaik ? ' ↑' : ' ↓')}</button></th>
              <th className="num" aria-sort={urutCol === 'z' ? (urutNaik ? 'ascending' : 'descending') : undefined}><button type="button" className="th-sort istilah" onClick={() => sort('z')} data-tip="Skor z" data-tip-desc="Seberapa kecil kemungkinan selisihnya kebetulan. Di atas 1,96 berarti kecil kemungkinan hanya kebetulan." aria-describedby="sidak-tip">Skor z{urutCol === 'z' && (urutNaik ? ' ↑' : ' ↓')}</button></th>
              <th className="num" aria-sort={urutCol === 'rupiah_t' ? (urutNaik ? 'ascending' : 'descending') : undefined}><button type="button" className="th-sort istilah" onClick={() => sort('rupiah_t')} data-tip="Selisih tertimbang" data-tip-desc="Selisih rupiah dari sampel ±1% peserta, dibobot ke populasi. Estimasi untuk prioritas, bukan kerugian pasti." aria-describedby="sidak-tip">Selisih tertimbang{urutCol === 'rupiah_t' && (urutNaik ? ' ↑' : ' ↓')}</button></th>
              <th>Progres</th>
            </tr></thead>
            <tbody>
              {tampil.map(r => {
                const cat = catatan[r.f.id] ? String(catatan[r.f.id]) : ''
                return (
                  <tr key={r.key} tabIndex={0} role="link" aria-label={`Buka profil ${r.f.label}`} className={'tr-' + r.status} onClick={e => buka(e, r.f.id)} onKeyDown={onEnter(() => nav('/faskes/' + r.f.id))}>
                    <td onClick={e => e.stopPropagation()}><input className="checkbox-c" type="checkbox" aria-label={`Pilih ${r.f.label}`} checked={sel.has(r.key)} onChange={() => toggle(r.key)} /></td>
                    <td className="ant-faskes"><b>{r.f.label}</b><div className="hint">{r.f.kelas_pendek} · {r.f.milik}{cat && <> · <span className="ada-catatan" title={cat}>ada catatan</span></>}</div></td>
                    {wil === 'jateng' && <td>{judulKab(r.f.kab)}</td>}
                    <td className="nowrap"><span style={{ color: INFO[r.m].warna, fontWeight: 600 }}>#{INFO[r.m].nomor}</span> {INFO[r.m].pendek}</td>
                    <td><StatusPill s={r.status} /></td>
                    <td className="num"><OEChip v={r.OE} n={r.n} st={r.status} /></td>
                    <td className="num"><span className={r.z != null && r.z > 1.96 ? 'zsig' : undefined}>{r.z == null ? '–' : num(r.z, 2)}</span></td>
                    <td className="num"><RupiahText v={r.rupiah_t} /></td>
                    <td onClick={e => e.stopPropagation()}><Progres ringkas nilai={audit[r.f.id] ?? 'belum'} fb={s2 => setProgres(r.f, s2)} /></td>
                  </tr>
                )
              })}
              {tampil.length === 0 && <tr><td colSpan={wil === 'jateng' ? 9 : 8}>
                <div style={{ textAlign: 'center', padding: 20 }}><div style={{ marginBottom: 8 }}>Tidak ada faskes pada kombinasi filter ini.</div><button type="button" className="btn sm" onClick={longgarkan}>Atur ulang filter</button></div>
              </td></tr>}
            </tbody>
          </table>
        </div>
        {rows.length > 0 && <Pager total={rows.length} page={page} per={per} ubah={setPage} ubahPer={p => { setPer(p); setPage(1) }} />}
      </div>

      <ul className="ant-kartu" aria-label="Daftar temuan">
        {tampil.map(r => (
          <li key={r.key}>
            <Link to={'/faskes/' + r.f.id} className={'kt tr-' + r.status}>
              <span className="kt-r1"><b>{r.f.label}</b><StatusPill s={r.status} /></span>
              <span className="kt-r2">#{INFO[r.m].nomor} {INFO[r.m].pendek} · {r.f.kelas_pendek} · {r.f.milik}{wil === 'jateng' ? ' · ' + judulKab(r.f.kab) : ''}</span>
              <span className="kt-r3">
                <span>O/E<b className={r.OE != null && r.OE > 1.05 ? 'hi' : undefined}>{r.OE == null ? '–' : num(r.OE, 2)}</b></span>
                <span>Skor z<b>{r.z == null ? '–' : num(r.z, 2)}</b></span>
                <span>Selisih<b className="rp">{rp(r.rupiah_t)}</b></span>
              </span>
            </Link>
          </li>
        ))}
        {tampil.length === 0 && <li className="kt-kosong">Tidak ada faskes pada kombinasi filter ini. <button type="button" className="btn sm" onClick={longgarkan}>Atur ulang filter</button></li>}
        {rows.length > 0 && <li className="kt-pager"><Pager total={rows.length} page={page} per={per} ubah={setPage} ubahPer={p => { setPer(p); setPage(1) }} /></li>}
      </ul>

      {lembar && <>
        <div className="lembar-scrim" onClick={() => setLembar(false)} aria-hidden="true" />
        <div className="lembar" role="dialog" aria-modal="true" aria-labelledby="lembar-judul">
          <div className="lembar-grip" aria-hidden="true" />
          <h2 id="lembar-judul">Filter</h2>
          <div className="lembar-grp"><div className="lembar-lbl">Wilayah</div>{segWilayah}</div>
          <div className="lembar-grp"><div className="lembar-lbl">Status</div>
            <div className="opsi">{(Object.keys(STATUS) as Status[]).map(s2 => <button key={s2} type="button" aria-pressed={stArr.includes(s2)} onClick={() => ubahSt(s2)}>{STATUS[s2].label}</button>)}</div>
          </div>
          <div className="lembar-grp"><div className="lembar-lbl">Modul</div>
            <div className="opsi">
              <button type="button" aria-pressed={modArr.length === MODUL.length} onClick={() => patch('mod', null)}>Semua</button>
              {MODUL.map(m2 => <button key={m2} type="button" aria-pressed={modArr.length !== MODUL.length && modArr.includes(m2)} onClick={() => modArr.length === MODUL.length ? patch('mod', m2) : ubahMod(m2)}>#{INFO[m2].nomor} {INFO[m2].pendek}</button>)}
            </div>
          </div>
          <div className="lembar-grp"><Pilih label="Kelas" nilai={kelas} ubah={v => patch('kelas', v === 'semua' ? null : v)} opsi={KELAS_OPSI} /></div>
          <div className="lembar-bawah">
            <button type="button" className="btn" onClick={longgarkan}>Atur ulang</button>
            <button type="button" className="btn primary" onClick={() => setLembar(false)}>Tampilkan {num(rows.length)} temuan</button>
          </div>
        </div>
      </>}

      {toast && <div className="toast" role="status"><span>{toast.t}</span>{toast.undo && <button type="button" onClick={toast.undo}>Urungkan</button>}</div>}
    </div>
  )
}

import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { Modul, KabModul, useData, judulKab, oe as fOE, pct, rp, num, KOTA, INFO } from '../lib/data'

export type Tingkat = 'L1' | 'L2' | 'L3'
export type IndikatorL1 = 'OE' | 'rate' | 'rupiah_tertimbang' | 'n_perhatian'
export type IndikatorL2 = 'penduduk_2025' | 'kepadatan_2025' | 'faskes_per_100rb' | 'rs' | 'pertumbuhan_2020_2025_pct'

export const LABEL_L1: Record<IndikatorL1, string> = {
  OE: 'Rasio O/E (kejadian nyata ÷ wajar)', rate: 'Angka mentah (%)', rupiah_tertimbang: 'Selisih rupiah (tertimbang)', n_perhatian: 'Faskes perlu perhatian',
}
export const LABEL_L2: Record<IndikatorL2, string> = {
  penduduk_2025: 'Penduduk 2025', kepadatan_2025: 'Kepadatan (jiwa/km²)', faskes_per_100rb: 'Faskes per 100 ribu penduduk', rs: 'Jumlah RS', pertumbuhan_2020_2025_pct: 'Pertumbuhan penduduk 2020–2025 (%)',
}

const SEQ = ['#EAF0F6', '#C5D6EA', '#93B3D9', '#5B86BC', '#0D366B']
const OE_COL = ['#148F63', '#A9C6EA', '#C88A0A', '#B53333']
const OE_BRK = [0.9, 1.05, 1.2]

function quantiles(vals: number[], k = 5): number[] {
  const v = vals.filter(x => x != null && !isNaN(x)).sort((a, b) => a - b)
  if (!v.length) return []
  return Array.from({ length: k - 1 }, (_, i) => v[Math.floor(((i + 1) * v.length) / k)])
}
function warnaSeq(v: number | null | undefined, brk: number[]): string {
  if (v == null || isNaN(v)) return '#F7F7F4'
  let i = 0
  while (i < brk.length && v > brk[i]) i++
  return SEQ[Math.min(i, SEQ.length - 1)]
}
function warnaOE(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '#F7F7F4'
  let i = 0
  while (i < OE_BRK.length && v > OE_BRK[i]) i++
  return OE_COL[i]
}
function centroid(g: GeoJSON.Geometry): [number, number] {
  const pts: number[][] = []
  const walk = (c: any) => { if (typeof c[0] === 'number') pts.push(c); else c.forEach(walk) }
  walk((g as any).coordinates)
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1])
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]
}

interface Props {
  tingkat: Tingkat
  modul: Modul
  indL1?: IndikatorL1
  indL2?: IndikatorL2
  tampilFaskes?: boolean
  aliranModul?: 'readmisi' | 'rujukan'
  onPilihKab?: (kab: string, d?: Partial<Record<Modul, KabModul>>) => void
  onPilihKec?: (kec: string) => void
  kecil?: boolean
}

export default function MapView({ tingkat, modul, indL1 = 'OE', indL2 = 'penduduk_2025', tampilFaskes = true, aliranModul = 'readmisi', onPilihKab, onPilihKec, kecil }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const ready = useRef(false)
  const labels = useRef<maplibregl.Marker[]>([])
  const data = useData()
  const cb = useRef({ onPilihKab, onPilihKec })
  cb.current = { onPilihKab, onPilihKec }

  // ---- inisialisasi peta (tanpa ubin basemap daring: sepenuhnya luring)
  useEffect(() => {
    if (!ref.current) return
    const m = new maplibregl.Map({
      container: ref.current, attributionControl: false,
      style: { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#EAF0F6' } }] },
      bounds: [[108.5, -8.4], [111.8, -5.7]], fitBoundsOptions: { padding: 20 },
    })
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
    m.on('error', e => console.error('[SIDAK peta]', (e as any).error?.message ?? e))
    m.on('load', () => {
      m.addSource('kab', { type: 'geojson', data: data.geoKab })
      m.addSource('kec', { type: 'geojson', data: data.geoKec })
      m.addSource('fas', { type: 'geojson', data: data.geoFaskes })
      m.addSource('alir', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      m.addLayer({ id: 'kab-fill', type: 'fill', source: 'kab', paint: { 'fill-color': ['coalesce', ['get', 'warna'], '#F7F7F4'], 'fill-opacity': 0.92 } })
      m.addLayer({ id: 'kab-line', type: 'line', source: 'kab', paint: { 'line-color': '#fff', 'line-width': 1 } })
      m.addLayer({ id: 'kab-sel', type: 'line', source: 'kab', paint: { 'line-color': '#0D366B', 'line-width': 2.5 }, filter: ['==', ['get', 'kab'], KOTA] })
      m.addLayer({ id: 'kec-fill', type: 'fill', source: 'kec', layout: { visibility: 'none' }, paint: { 'fill-color': ['coalesce', ['get', 'warna'], '#F7F7F4'], 'fill-opacity': 0.92 } })
      m.addLayer({ id: 'kec-line', type: 'line', source: 'kec', layout: { visibility: 'none' }, paint: { 'line-color': '#fff', 'line-width': 1.2 } })
      // label kecamatan sebagai Marker HTML (tanpa glyph daring, tetap luring)
      data.geoKec.features.forEach(f => {
        const el = document.createElement('div')
        el.className = 'kec-label'
        el.textContent = (f.properties as any).kecamatan
        const mk = new maplibregl.Marker({ element: el }).setLngLat(centroid(f.geometry)).addTo(m)
        labels.current.push(mk)
      })
      m.addLayer({ id: 'fas-klinik', type: 'circle', source: 'fas', layout: { visibility: 'none' }, filter: ['!=', ['get', 'jenis'], 'hospital'], paint: { 'circle-radius': 2.5, 'circle-color': '#148F63', 'circle-opacity': 0.55 } })
      m.addLayer({ id: 'fas-rs', type: 'circle', source: 'fas', layout: { visibility: 'none' }, filter: ['==', ['get', 'jenis'], 'hospital'], paint: { 'circle-radius': 6, 'circle-color': '#B53333', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 } })
      m.addLayer({ id: 'alir-line', type: 'line', source: 'alir', layout: { visibility: 'none', 'line-cap': 'round' }, paint: { 'line-color': ['get', 'warna'], 'line-width': ['get', 'lebar'], 'line-opacity': 0.8 } })
      m.addLayer({ id: 'alir-pt', type: 'circle', source: 'alir', layout: { visibility: 'none' }, filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': ['get', 'r'], 'circle-color': ['get', 'warna'], 'circle-stroke-color': '#fff', 'circle-stroke-width': 1 } })

      const pop = new maplibregl.Popup({ closeButton: false, closeOnClick: false })
      const hover = (layer: string, html: (p: any) => string) => {
        m.on('mousemove', layer, e => { m.getCanvas().style.cursor = 'pointer'; const p = e.features?.[0]?.properties; if (p) pop.setLngLat(e.lngLat).setHTML(html(p)).addTo(m) })
        m.on('mouseleave', layer, () => { m.getCanvas().style.cursor = ''; pop.remove() })
      }
      hover('kab-fill', p => `<b>${judulKab(p.kab)}</b><br/>${p.tip ?? ''}`)
      hover('kec-fill', p => `<b>Kec. ${p.kecamatan}</b><br/>${p.tip ?? ''}`)
      hover('fas-rs', p => `<b>${p.nama}</b><br/>RS · ${p.kecamatan ?? ''}<br/><i>Titik dari OpenStreetMap, bukan hasil deteksi</i>`)
      hover('fas-klinik', p => `<b>${p.nama}</b><br/>${p.jenis === 'doctors' ? 'Praktik dokter' : 'Klinik'} · ${p.kecamatan ?? ''}`)
      hover('alir-line', p => `<b>${judulKab(p.asal)}</b> → Kota Semarang<br/>${p.tip}`)
      m.on('click', 'kab-fill', e => { const k = e.features?.[0]?.properties?.kab; if (k) cb.current.onPilihKab?.(k, data.kab[k]) })
      m.on('click', 'kec-fill', e => { const k = e.features?.[0]?.properties?.kecamatan; if (k) cb.current.onPilihKec?.(k) })
      ready.current = true
      m.fire('sidak:ready')
    })
    map.current = m
    return () => { ready.current = false; labels.current = []; m.remove(); map.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- pembaruan lapisan sesuai props
  useEffect(() => {
    const m = map.current
    if (!m) return
    const apply = () => {
      const vis = (id: string, on: boolean) => m.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
      // L1: gabungkan indikator kab/kota ke geometri
      const fc: GeoJSON.FeatureCollection = JSON.parse(JSON.stringify(data.geoKab))
      const vals = fc.features.map(f => { const d = data.kab[(f.properties as any).kab]?.[modul]; return d ? (d as any)[indL1] : null })
      const brk = quantiles(vals.filter(v => v != null) as number[])
      fc.features.forEach((f, i) => {
        const p = f.properties as any
        const d = data.kab[p.kab]?.[modul]
        const v = vals[i]
        p.warna = indL1 === 'OE' ? warnaOE(v) : warnaSeq(v, brk)
        p.tip = d ? `${INFO[modul].nama}: O/E <b>${fOE(d.OE)}</b> · angka ${pct(d.rate)} · ${d.n_faskes} faskes dinilai, <b>${d.n_perhatian}</b> perlu perhatian<br/>selisih tertimbang ${rp(d.rupiah_tertimbang)}` : 'Tidak ada faskes dengan volume cukup'
      })
      ;(m.getSource('kab') as maplibregl.GeoJSONSource).setData(fc)
      // L2: demografi kecamatan
      const kc: GeoJSON.FeatureCollection = JSON.parse(JSON.stringify(data.geoKec))
      const dv = kc.features.map(f => data.demo.kecamatan.find(k => k.kecamatan === (f.properties as any).kecamatan))
      const b2 = quantiles(dv.map(d => (d ? (d as any)[indL2] : null)).filter(v => v != null) as number[])
      kc.features.forEach((f, i) => {
        const p = f.properties as any, d = dv[i]
        p.warna = warnaSeq(d ? (d as any)[indL2] : null, b2)
        p.tip = d ? `Penduduk 2025 <b>${num(d.penduduk_2025)}</b> · ${num(d.kepadatan_2025)} jiwa/km²<br/>RS ${d.rs} · klinik/praktik ${d.klinik} · ${num(d.faskes_per_100rb, 1)} faskes/100 rb` : ''
      })
      ;(m.getSource('kec') as maplibregl.GeoJSONSource).setData(kc)
      // L3: aliran
      const cent: Record<string, [number, number]> = {}
      data.geoKab.features.forEach(f => { cent[(f.properties as any).kab] = centroid(f.geometry) })
      const tujuan = cent[KOTA]
      const feats: GeoJSON.Feature[] = []
      const rows = aliranModul === 'readmisi' ? data.ring.aliran.readmisi : data.ring.aliran.rujukan
      const maxN = Math.max(...rows.map(r => r.n), 1)
      rows.forEach(r => {
        const c = cent[r.asal]
        if (!c || r.asal === KOTA) return
        const oeV = 'E' in r && (r as any).E > 0 ? (r as any).O / (r as any).E : null
        const warna = aliranModul === 'readmisi' ? warnaOE(oeV) : '#6A5ACD'
        const tip = aliranModul === 'readmisi' ? `${r.n} admisi · readmisi ${(r as any).O} vs wajar ${num((r as any).E, 1)} (O/E ${fOE(oeV)})` : `${r.n} kunjungan rujukan (≈${num((r as any).tertimbang)} tertimbang)`
        feats.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [c, tujuan] }, properties: { asal: r.asal, warna, lebar: 1 + (r.n / maxN) * 9, tip } })
        feats.push({ type: 'Feature', geometry: { type: 'Point', coordinates: c }, properties: { asal: r.asal, warna, r: 3 + (r.n / maxN) * 8, tip } })
      })
      ;(m.getSource('alir') as maplibregl.GeoJSONSource).setData({ type: 'FeatureCollection', features: feats })

      vis('kab-fill', tingkat !== 'L2'); vis('kab-line', tingkat !== 'L2'); vis('kab-sel', tingkat !== 'L2')
      vis('kec-fill', tingkat === 'L2'); vis('kec-line', tingkat === 'L2')
      labels.current.forEach(mk => { mk.getElement().style.display = tingkat === 'L2' && !kecil ? '' : 'none' })
      vis('fas-rs', tingkat === 'L2' && tampilFaskes); vis('fas-klinik', tingkat === 'L2' && tampilFaskes)
      vis('alir-line', tingkat === 'L3'); vis('alir-pt', tingkat === 'L3')
      if (tingkat === 'L2') m.fitBounds([[110.25, -7.16], [110.55, -6.92]], { padding: 20, duration: 600 })
      else m.fitBounds([[108.5, -8.4], [111.8, -5.7]], { padding: 20, duration: 600 })
    }
    if (ready.current) apply(); else m.once('sidak:ready', apply)
  }, [tingkat, modul, indL1, indL2, tampilFaskes, aliranModul, data])

  const legend = tingkat === 'L2'
    ? <div className="map-legend"><b>{LABEL_L2[indL2]}</b> (kuintil) <br />{SEQ.map((c, i) => <span key={i} className="sw" style={{ background: c }} />)} rendah → tinggi<br />
      {tampilFaskes && <><span className="sw" style={{ background: '#B53333', borderRadius: 7 }} />RS &nbsp;<span className="sw" style={{ background: '#148F63', borderRadius: 7 }} />klinik/praktik (OSM)</>}</div>
    : indL1 === 'OE' || tingkat === 'L3'
      ? <div className="map-legend"><b>{tingkat === 'L3' && aliranModul === 'rujukan' ? 'Aliran rujukan (tebal = jumlah)' : 'Rasio O/E'}</b><br />
        {tingkat === 'L3' && aliranModul === 'rujukan' ? null : <>
          <span className="sw" style={{ background: OE_COL[0] }} />&lt; 0,90 &nbsp;<span className="sw" style={{ background: OE_COL[1] }} />0,90–1,05<br />
          <span className="sw" style={{ background: OE_COL[2] }} />1,05–1,20 &nbsp;<span className="sw" style={{ background: OE_COL[3] }} />&gt; 1,20</>}</div>
      : <div className="map-legend"><b>{LABEL_L1[indL1]}</b> (kuintil)<br />{SEQ.map((c, i) => <span key={i} className="sw" style={{ background: c }} />)} rendah → tinggi</div>

  return (
    <div className={'map-wrap' + (kecil ? ' small' : '')}>
      <div ref={ref} style={{ position: 'absolute', inset: 0 }} />
      {!kecil && legend}
      <div className="map-attr">Batas: GADM 4.1 · Faskes: © OpenStreetMap contributors · Demografi: BPS</div>
    </div>
  )
}

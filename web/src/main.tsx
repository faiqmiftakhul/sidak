import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import 'maplibre-gl/dist/maplibre-gl.css'
import './styles.css'
import App from './App'
import Ikon from './components/Ikon'
import { Data, DataCtx, muat } from './lib/data'
import { Tema, TemaCtx, pasangTema, temaAwal } from './lib/tema'

function Root() {
  const [data, setData] = useState<Data | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [tema, setTemaState] = useState<Tema>(temaAwal)

  useEffect(() => { muat().then(setData).catch(e => setErr(String(e))) }, [])
  useEffect(() => { pasangTema(tema) }, [tema])

  const setTema = useCallback((t: Tema) => setTemaState(t), [])
  const ktxTema = useMemo(() => ({ tema, setTema, gelap: tema === 'gelap' }), [tema, setTema])

  const bingkai = (isi: React.ReactNode) => <TemaCtx.Provider value={ktxTema}>{isi}</TemaCtx.Provider>

  if (err) return bingkai(
    <div className="loading">
      <span className="lambang-besar" aria-hidden="true"><Ikon nama="perisai" ukuran={26} /></span>
      <b>SIDAK</b>
      <div>Gagal memuat data: {err}</div>
      <div className="hint">Jalankan pipeline (sidak/pipeline/build.py) lebih dulu, lalu muat ulang halaman.</div>
    </div>,
  )

  if (!data) return bingkai(
    <div className="loading" role="status" aria-live="polite">
      <span className="lambang-besar" aria-hidden="true"><Ikon nama="perisai" ukuran={26} /></span>
      <b>SIDAK</b>
      <div>Memuat data Kota Semarang…</div>
      <div className="bilah" aria-hidden="true"><i /></div>
    </div>,
  )

  return bingkai(
    <DataCtx.Provider value={data}>
      <BrowserRouter><App /></BrowserRouter>
    </DataCtx.Provider>,
  )
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><Root /></React.StrictMode>)

import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import 'maplibre-gl/dist/maplibre-gl.css'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-sans/700.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import './styles.css'
import App from './App'
import { Data, DataCtx, muat } from './lib/data'

function Root() {
  const [data, setData] = useState<Data | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { muat().then(setData).catch(e => setErr(String(e))) }, [])
  if (err) return <div className="loading" role="alert" style={{ color: 'var(--danger)' }}>Gagal memuat data: {err}<div className="hint">Jalankan pipeline (sidak/pipeline/build.py) lebih dulu.</div></div>
  if (!data) return <div className="loading"><b>SIDAK</b><span>Memuat data Kota Semarang…</span></div>
  return <DataCtx.Provider value={data}><BrowserRouter><App /></BrowserRouter></DataCtx.Provider>
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><Root /></React.StrictMode>)

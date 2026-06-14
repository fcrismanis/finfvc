import { useRef, useState } from 'react'

interface Props {
  onFile: (file: File) => void
  loading: boolean
}

export function ImportDropzone({ onFile, loading }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onFile(file)
  }

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 14, padding: '36px 24px', borderRadius: 11,
        border: `2px dashed ${dragging ? 'var(--ink)' : 'var(--line)'}`,
        background: dragging ? 'var(--accent-soft)' : 'var(--paper)',
        cursor: loading ? 'default' : 'pointer',
        transition: 'border-color 0.15s, background 0.15s',
      }}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !loading && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv,.txt"
        style={{ display: 'none' }}
        onChange={handleChange}
        disabled={loading}
      />

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div className="spinner" />
          <p style={{ fontSize: 13, color: 'var(--ink-2)' }}>Processando arquivo…</p>
        </div>
      ) : (
        <>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'var(--well)', border: '1px solid var(--line)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ink-2)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>
              {dragging ? 'Solte o arquivo aqui' : 'Arraste seu extrato aqui'}
            </p>
            <p style={{ fontSize: 12, color: 'var(--faint)', marginTop: 4 }}>
              ou clique para selecionar um arquivo
            </p>
          </div>
          <span style={{ fontSize: 11, color: 'var(--faint)', fontFamily: 'var(--mono)', letterSpacing: '.08em' }}>
            XLSX · XLS · CSV
          </span>
        </>
      )}
    </div>
  )
}

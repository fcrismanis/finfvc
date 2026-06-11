import { useRef, useState } from 'react'
import { Upload, FileSpreadsheet } from 'lucide-react'

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
      className="flex flex-col items-center justify-center gap-4 p-10 rounded-xl border-2 border-dashed transition-colors cursor-pointer"
      style={{ borderColor: dragging ? '#4F46E5' : '#D1D5DB', background: dragging ? '#EEF2FF' : '#F9FAFB' }}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !loading && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv,.txt"
        className="hidden"
        onChange={handleChange}
        disabled={loading}
      />

      {loading ? (
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Processando arquivo…</p>
        </div>
      ) : (
        <>
          <div className="p-4 rounded-full" style={{ background: '#EEF2FF' }}>
            {dragging ? <Upload size={28} color="#4F46E5" /> : <FileSpreadsheet size={28} color="#4F46E5" />}
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-800">Arraste seu extrato aqui</p>
            <p className="text-xs text-gray-500 mt-1">ou clique para selecionar um arquivo</p>
          </div>
          <p className="text-xs text-gray-400">Suporta: XLSX, XLS, CSV</p>
        </>
      )}
    </div>
  )
}

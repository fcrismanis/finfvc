import { useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { ImportDropzone } from '../components/import/ImportDropzone'
import { ImportPreview } from '../components/import/ImportPreview'
import { ImportSummary } from '../components/import/ImportSummary'
import { parseAndPreview, confirmImport } from '../services/import.service'
import { useData } from '../context/DataContext'
import type { ParsedImportItem, ImportSummaryData } from '../importers/types'

type Stage = 'idle' | 'parsing' | 'preview' | 'complete'

interface Props {
  onNavigate: (route: string) => void
}

export function Import({ onNavigate }: Props) {
  const { reload } = useData()
  const [stage, setStage] = useState<Stage>('idle')
  const [items, setItems] = useState<ParsedImportItem[]>([])
  const [summary, setSummary] = useState<ImportSummaryData | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setError(null)
    setStage('parsing')
    try {
      const parsed = await parseAndPreview(file)
      if (parsed.length === 0) {
        setError('Nenhum lançamento encontrado. Verifique se o arquivo tem o formato esperado.')
        setStage('idle')
        return
      }
      setItems(parsed)
      setStage('preview')
    } catch (err) {
      setError(`Erro ao processar o arquivo: ${err instanceof Error ? err.message : String(err)}`)
      setStage('idle')
    }
  }

  function handleConfirm() {
    const { summary: s } = confirmImport(items)
    setSummary(s)
    setStage('complete')
    reload()
  }

  function handleNewImport() {
    setItems([])
    setSummary(null)
    setError(null)
    setStage('idle')
  }

  return (
    <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl" style={{ background: '#EEF2FF' }}>
            <FileSpreadsheet size={20} color="#4F46E5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Importar extrato</h1>
            <p className="text-xs text-gray-500">XLSX, XLS ou CSV — colunas detectadas automaticamente</p>
          </div>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 mb-6 text-xs">
          {(['idle', 'preview', 'complete'] as const).map((s, i) => {
            const labels = ['Upload', 'Revisão', 'Concluído']
            const stageOrder = { idle: 0, parsing: 0, preview: 1, complete: 2 }
            const current = stageOrder[stage]
            const active = current === i
            const done = current > i
            return (
              <div key={s} className="flex items-center gap-2">
                <div
                  className="flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold"
                  style={{
                    background: done ? '#16A34A' : active ? '#4F46E5' : '#E5E7EB',
                    color: done || active ? '#fff' : '#9CA3AF',
                  }}
                >
                  {done ? '✓' : i + 1}
                </div>
                <span style={{ color: active ? '#4F46E5' : done ? '#16A34A' : '#9CA3AF', fontWeight: active ? 600 : 400 }}>
                  {labels[i]}
                </span>
                {i < 2 && <span className="text-gray-300 mx-1">›</span>}
              </div>
            )
          })}
        </div>

        {/* Content card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          {error && (
            <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {(stage === 'idle' || stage === 'parsing') && (
            <>
              <ImportDropzone onFile={handleFile} loading={stage === 'parsing'} />
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs font-semibold text-gray-600 mb-1">Colunas esperadas no arquivo</p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Tipo · Descrição · Valor · Data · Data Competência · Status · Forma de Pagamento · Conta/Cartão
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Colunas opcionais: Parcela · Recorrente · Tags · Grupo
                </p>
              </div>
            </>
          )}

          {stage === 'preview' && (
            <ImportPreview
              items={items}
              onUpdate={setItems}
              onConfirm={handleConfirm}
              onCancel={handleNewImport}
            />
          )}

          {stage === 'complete' && summary && (
            <ImportSummary
              summary={summary}
              onNewImport={handleNewImport}
              onGoToDashboard={() => onNavigate('/')}
            />
          )}
        </div>
      </div>
    </main>
  )
}

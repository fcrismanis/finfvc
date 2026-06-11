import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { formatMonthFull, prevMonth, nextMonth, getGreeting, currentYearMonth } from '../../utils/date'
import type { ViewMode } from '../../types'

interface HeaderProps {
  selectedMonth: string
  activeView: ViewMode
  onMonthChange: (m: string) => void
  onViewChange: (v: ViewMode) => void
}

export function Header({ selectedMonth, activeView, onMonthChange, onViewChange }: HeaderProps) {
  const canGoNext = selectedMonth < currentYearMonth()

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <p className="text-[16px] font-semibold text-gray-900">
        {getGreeting()}, Fabio
      </p>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onMonthChange(prevMonth(selectedMonth))}
          className="w-7 h-7 rounded-md border border-gray-200 flex items-center justify-center hover:bg-gray-50"
        >
          <ChevronLeft size={14} className="text-gray-500" />
        </button>
        <span className="text-sm font-semibold text-gray-800 w-32 text-center">
          {formatMonthFull(selectedMonth)}
        </span>
        <button
          onClick={() => canGoNext && onMonthChange(nextMonth(selectedMonth))}
          className={`w-7 h-7 rounded-md border border-gray-200 flex items-center justify-center ${canGoNext ? 'hover:bg-gray-50' : 'opacity-30 cursor-not-allowed'}`}
        >
          <ChevronRight size={14} className="text-gray-500" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <ViewToggle activeView={activeView} onChange={onViewChange} />
        <button
          className="flex items-center gap-1.5 text-sm font-medium text-white px-3 py-1.5 rounded-lg"
          style={{ background: 'var(--sidebar-active)' }}
        >
          <Plus size={14} />
          Lançamento
        </button>
      </div>
    </header>
  )
}

function ViewToggle({ activeView, onChange }: { activeView: ViewMode; onChange: (v: ViewMode) => void }) {
  const views: { value: ViewMode; label: string }[] = [
    { value: 'operational', label: 'Operacional' },
    { value: 'cashflow', label: 'Caixa' },
    { value: 'accounting', label: 'Contábil' },
  ]
  return (
    <div className="flex border border-gray-200 rounded-lg overflow-hidden text-xs">
      {views.map(v => (
        <button
          key={v.value}
          onClick={() => onChange(v.value)}
          className={`px-3 py-1.5 font-medium transition-colors ${
            activeView === v.value
              ? 'text-white'
              : 'text-gray-500 hover:bg-gray-50'
          }`}
          style={activeView === v.value ? { background: 'var(--sidebar-bg)' } : undefined}
        >
          {v.label}
        </button>
      ))}
    </div>
  )
}

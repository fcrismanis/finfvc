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
    <header
      className="bg-white px-6 py-3 flex items-center justify-between flex-shrink-0"
      style={{ borderBottom: '1px solid var(--border-card)' }}
    >
      <p className="text-[15px] font-semibold text-gray-800">
        {getGreeting()}, Fabio
      </p>

      {/* Month picker */}
      <div
        className="flex items-center gap-1 rounded-lg px-1.5 py-1"
        style={{ border: '1px solid var(--border-card)', background: '#F8FAFC' }}
      >
        <button
          onClick={() => onMonthChange(prevMonth(selectedMonth))}
          className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-white transition-colors"
        >
          <ChevronLeft size={13} />
        </button>
        <span className="text-sm font-semibold text-gray-700 w-[132px] text-center select-none">
          {formatMonthFull(selectedMonth)}
        </span>
        <button
          onClick={() => canGoNext && onMonthChange(nextMonth(selectedMonth))}
          className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
            canGoNext
              ? 'text-gray-400 hover:text-gray-700 hover:bg-white'
              : 'text-gray-200 cursor-not-allowed'
          }`}
        >
          <ChevronRight size={13} />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <ViewToggle activeView={activeView} onChange={onViewChange} />
        <button
          className="flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-[7px] rounded-lg transition-opacity hover:opacity-90"
          style={{ background: 'var(--sidebar-active)' }}
        >
          <Plus size={13} />
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
    <div
      className="flex rounded-lg overflow-hidden text-xs"
      style={{ border: '1px solid var(--border-card)', background: '#F8FAFC' }}
    >
      {views.map(v => (
        <button
          key={v.value}
          onClick={() => onChange(v.value)}
          className="px-3 py-[7px] font-medium transition-all"
          style={
            activeView === v.value
              ? { background: 'var(--sidebar-active)', color: 'white' }
              : { color: '#6B7280' }
          }
        >
          {v.label}
        </button>
      ))}
    </div>
  )
}

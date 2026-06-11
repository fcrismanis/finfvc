import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts'
import type { MonthlyTrend } from '../../types'
import { formatBRLCompact } from '../../utils/currency'

interface Props {
  data: MonthlyTrend[]
}

export function MonthlyTrendChart({ data }: Props) {
  const hasData = data.some(d => d.operationalIncome > 0 || d.totalExpenses > 0)

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-gray-800">Evolução dos últimos 6 meses</p>
        <div className="flex items-center gap-3 text-[10px] text-gray-400">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#34D399' }} />
            Receita
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#FB7185' }} />
            Despesas
          </span>
          <span className="flex items-center gap-1">
            <span className="w-5 h-px inline-block" style={{ background: 'var(--sidebar-active)' }} />
            Resultado
          </span>
        </div>
      </div>
      {!hasData ? (
        <div className="flex flex-col items-center py-10 gap-1">
          <p className="text-sm text-gray-400">Dados insuficientes</p>
          <p className="text-xs text-gray-300">Importe mais de um mês para exibir a evolução</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={210}>
          <ComposedChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#9CA3AF' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#9CA3AF' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatBRLCompact}
              width={58}
            />
            <Tooltip
              formatter={(value, name) => [
                new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value)),
                name === 'operationalIncome' ? 'Receita' : name === 'totalExpenses' ? 'Despesas' : 'Resultado',
              ]}
              labelStyle={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border-card)', boxShadow: 'var(--shadow-card)' }}
            />
            <ReferenceLine y={0} stroke="#E5E7EB" strokeWidth={1} strokeDasharray="3 2" />
            <Bar dataKey="operationalIncome" name="Receita" fill="#34D399" radius={[4, 4, 0, 0]} barSize={18} />
            <Bar dataKey="totalExpenses" name="Despesas" fill="#FB7185" radius={[4, 4, 0, 0]} barSize={18} />
            <Line
              type="monotone"
              dataKey="operationalResult"
              name="Resultado"
              stroke="var(--sidebar-active)"
              strokeWidth={2.5}
              dot={{ r: 3, fill: 'var(--sidebar-active)', strokeWidth: 0 }}
              activeDot={{ r: 5, fill: 'var(--sidebar-active)' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

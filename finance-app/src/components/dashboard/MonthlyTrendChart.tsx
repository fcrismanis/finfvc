import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ReferenceLine, ResponsiveContainer
} from 'recharts'
import type { MonthlyTrend } from '../../types'
import { formatBRLCompact } from '../../utils/currency'

interface Props {
  data: MonthlyTrend[]
}

export function MonthlyTrendChart({ data }: Props) {
  const hasData = data.some(d => d.operationalIncome > 0 || d.totalExpenses > 0)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-sm font-semibold text-gray-800 mb-4">Evolução dos últimos 6 meses</p>
      {!hasData ? (
        <p className="text-sm text-gray-400 text-center py-8">Dados insuficientes para exibir evolução</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                name === 'operationalIncome' ? 'Receita' : name === 'totalExpenses' ? 'Despesas' : 'Resultado'
              ]}
              labelStyle={{ fontSize: 12, fontWeight: 600 }}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '0.5px solid #E5E7EB' }}
            />
            <ReferenceLine y={0} stroke="#E5E7EB" strokeWidth={1.5} strokeDasharray="4 2" />
            <Bar dataKey="operationalIncome" name="Receita" fill="#86EFAC" radius={[3, 3, 0, 0]} barSize={16} />
            <Bar dataKey="totalExpenses" name="Despesas" fill="#FCA5A5" radius={[3, 3, 0, 0]} barSize={16} />
            <Line
              type="monotone"
              dataKey="operationalResult"
              name="Resultado"
              stroke="#3B4A8C"
              strokeWidth={2}
              dot={{ r: 3, fill: '#3B4A8C', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

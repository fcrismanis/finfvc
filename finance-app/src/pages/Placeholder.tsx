import { Construction } from 'lucide-react'

interface Props {
  title: string
  description: string
}

export function Placeholder({ title, description }: Props) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center">
        <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
          <Construction size={22} className="text-gray-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-700 mb-1">{title}</h2>
        <p className="text-sm text-gray-400 max-w-xs">{description}</p>
        <p className="mt-3 text-xs text-gray-300">Fase 2</p>
      </div>
    </div>
  )
}

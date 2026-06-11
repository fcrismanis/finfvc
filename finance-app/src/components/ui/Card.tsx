interface CardProps {
  children: React.ReactNode
  className?: string
  accentColor?: string
}

export function Card({ children, className = '', accentColor }: CardProps) {
  return (
    <div
      className={`bg-white rounded-xl border border-gray-200 p-4 ${className}`}
      style={accentColor ? { borderLeftColor: accentColor, borderLeftWidth: 3, borderRadius: '12px' } : undefined}
    >
      {children}
    </div>
  )
}

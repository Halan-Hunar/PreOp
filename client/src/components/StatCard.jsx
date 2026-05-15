export default function StatCard({ label, value, icon, iconColor = 'text-secondary', suffix, footer }) {
  return (
    <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
          {label}
        </span>
        {icon && (
          <span className={`material-symbols-outlined ${iconColor}`}>{icon}</span>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-bold text-on-surface tabular-nums">{value}</span>
        {suffix && <span className="text-sm text-on-surface-variant">{suffix}</span>}
      </div>
      {footer && <div className="mt-4 text-sm text-on-surface-variant">{footer}</div>}
    </div>
  )
}

export default function Spinner({ size = 24, className = '' }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-outline-variant border-t-secondary ${className}`}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  )
}

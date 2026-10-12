export function Wave({ top = false, fill }: { top?: boolean; fill?: string }) {
  return (
    <svg
      className={`wave ${top ? 'wave-top' : ''}`}
      viewBox="0 0 1440 90"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={fill ? { fill } : undefined}
    >
      <path d="M0 35C280-25 380 95 720 52S1130 7 1440 55V90H0Z" />
    </svg>
  )
}

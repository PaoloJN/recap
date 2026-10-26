export function Logo({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 90 90"
      fill="currentColor"
      aria-hidden="true"
      className="block shrink-0"
    >
      <path d="M0 30H30V90H0V30Z" />
      <path d="M60 60H90V90H60V60Z" />
      <path d="M90 0L30 60H60V34H90V0Z" />
      <path d="M30 0H60V30H30V0Z" />
    </svg>
  )
}

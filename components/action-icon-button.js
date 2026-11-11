const actionIconBaseClass =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-marea/50 disabled:cursor-not-allowed disabled:opacity-50"

export function ActionIconButton({
  label,
  onClick,
  disabled,
  tone = "muted",
  children,
}) {
  const toneClass =
    tone === "danger"
      ? "text-red-600 hover:bg-red-100"
      : tone === "primary"
        ? "text-tinta hover:bg-bruma"
        : tone === "info"
          ? "text-marea hover:bg-bruma"
          : "text-marea hover:bg-bruma"

  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`${actionIconBaseClass} ${toneClass}`}
        aria-label={label}
      >
        {children}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 whitespace-nowrap rounded-lg bg-tinta px-2.5 py-1 text-xs font-medium text-crema opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {label}
      </span>
    </span>
  )
}

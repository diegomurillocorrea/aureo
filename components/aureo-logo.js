const LOGO_TINTA_SRC = "/brand/aureo-logo-tinta.png"
const LOGO_CLARO_SRC = "/brand/aureo-logo-claro.png"

export function AureoLogo({
  className = "",
  width = 140,
  height = 48,
  priority = false,
  variant = "tinta",
}) {
  const src = variant === "claro" ? LOGO_CLARO_SRC : LOGO_TINTA_SRC
  const sharedProps = {
    alt: "Aureo",
    width,
    height,
    decoding: "async",
    ...(priority ? { fetchPriority: "high" } : {}),
  }

  return (
    <img
      {...sharedProps}
      src={src}
      className={`shrink-0 object-contain ${className}`}
    />
  )
}

const ISOTIPO_TINTA_SRC = "/brand/aureo-isotipo-tinta.png"
const ISOTIPO_CLARO_SRC = "/brand/aureo-isotipo-claro.png"

export function AureoIsotipo({
  className = "",
  width = 40,
  height = 40,
  priority = false,
  variant = "tinta",
}) {
  const src = variant === "claro" ? ISOTIPO_CLARO_SRC : ISOTIPO_TINTA_SRC
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

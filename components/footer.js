"use client"

import { AureoIsotipo } from "@/components/aureo-isotipo"

export function Footer() {
  return (
    <footer
      className="flex w-full items-center justify-between gap-4 bg-tinta px-6 py-4 text-crema sm:px-8 lg:px-10"
      role="contentinfo"
      aria-label="Pie de página"
    >
      <AureoIsotipo
        variant="claro"
        width={32}
        height={32}
        className="h-8 w-8"
      />
      <span className="text-sm font-medium" aria-label="Aureo copyright 2026">
        Aureo © 2026
      </span>
    </footer>
  )
}

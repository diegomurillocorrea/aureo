const logoFrameClassName =
  "relative flex h-[7.5rem] w-[7.5rem] shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-marea/20 bg-crema shadow-sm tablet:h-36 tablet:w-36";

function ExternalLinkBadge() {
  return (
    <span
      className="pointer-events-none absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md border border-white/25 bg-tinta/50 text-white shadow-sm backdrop-blur-md"
      aria-hidden
    >
      <svg
        className="h-3 w-3 opacity-95"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
        />
      </svg>
    </span>
  );
}

/**
 * Service logo tile. When `href` is set, the logo opens the service URL.
 *
 * @param {{ href?: string | null; serviceName?: string; children: import("react").ReactNode }} props
 */
export function ServiceLogoLink({ href, serviceName = "servicio", children }) {
  const link = typeof href === "string" ? href.trim() : "";

  if (!link) {
    return (
      <div className={logoFrameClassName} title={serviceName}>
        {children}
      </div>
    );
  }

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      tabIndex={0}
      className={`${logoFrameClassName} cursor-pointer transition-[border-color,box-shadow] duration-200 hover:border-marea/50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-marea/50 focus:ring-offset-2 focus:ring-offset-crema`}
      aria-label={`Abrir sitio de ${serviceName} en una nueva pestaña`}
      title={`Ir a ${serviceName} (nueva pestaña)`}
    >
      {children}
      <ExternalLinkBadge />
    </a>
  );
}

import Link from "next/link";

export default function ServiceNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="mb-2 text-xl font-semibold text-tinta">
        Servicio no encontrado
      </h1>
      <p className="mb-6 text-sm text-marea">
        El servicio que buscas no existe o ya no está disponible.
      </p>
      <Link
        href="/"
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-ambar px-5 text-sm font-medium text-tinta transition-colors hover:bg-ambar focus:outline-none focus:ring-2 focus:ring-marea/50 focus:ring-offset-2"
        aria-label="Volver al inicio"
      >
        Volver al inicio
      </Link>
    </div>
  );
}

"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Footer } from "@/components/footer";
import { AureoLogo } from "@/components/aureo-logo";
import {
  buttonPrimaryClass,
  errorAlertClass,
  inputClassName,
  successAlertClass,
} from "@/lib/aureo-ui";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const isRecovery = searchParams.get("type") === "recovery";
  const urlError = searchParams.get("error");
  const displayError = error ?? (urlError ? decodeURIComponent(urlError) : null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true);

    const supabase = createClient();

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setIsLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    const next = searchParams.get("next");
    const redirectTo =
      next && next.startsWith("/") && !next.startsWith("//")
        ? next
        : "/";
    router.refresh();
    router.push(redirectTo);
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-tinta">
      <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-8">
      <main className="w-full max-w-md rounded-2xl border border-marea/30 bg-crema p-8 shadow-lg tablet:p-10">
        <div className="mb-8 text-center">
          <div
            className="mb-3 flex items-center justify-center"
            role="group"
            aria-label="Aureo"
          >
            <AureoLogo
              width={180}
              height={56}
              priority
              className="h-14 w-auto max-w-[12rem] object-contain"
            />
          </div>
          <p className="text-sm text-marea">
            Cobros al día, sin vueltas.
          </p>
          <p className="mt-1 text-sm text-marea">
            Inicia sesión en tu cuenta
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-tinta"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@ejemplo.com"
              required
              disabled={isLoading}
              className={inputClassName}
              aria-label="Dirección de correo electrónico"
              aria-invalid={!!displayError}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-tinta"
            >
              Contraseña
            </label>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete={isRecovery ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={isLoading}
              className={inputClassName}
              aria-label="Contraseña"
              aria-invalid={!!displayError}
            />
            <div className="mt-2 flex items-center">
              <input
                id="show-password"
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                disabled={isLoading}
                className="h-4 w-4 rounded border-marea/30 accent-ambar transition-colors focus:ring-2 focus:ring-marea/20 focus:ring-offset-2 disabled:opacity-50"
                aria-label="Mostrar contraseña"
              />
              <label
                htmlFor="show-password"
                className="ml-2 text-sm text-marea"
              >
                Mostrar contraseña
              </label>
            </div>
          </div>

          {displayError && (
            <div
              role="alert"
              className={errorAlertClass}
            >
              {displayError}
            </div>
          )}

          {message && (
            <div
              role="status"
              className={successAlertClass}
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full ${buttonPrimaryClass}`}
            aria-busy={isLoading}
            aria-label="Iniciar sesión"
          >
            {isLoading ? "Iniciando sesión…" : "Iniciar sesión"}
          </button>
        </form>
      </main>
      </div>
      <Footer />
    </div>
  );
}

function LoginFallback() {
  return (
    <div className="relative flex min-h-screen flex-col bg-tinta">
      <div className="relative flex flex-1 flex-col items-center justify-center px-4">
        <main className="w-full max-w-md rounded-2xl border border-marea/30 bg-crema p-8 shadow-lg">
          <div className="mb-8 text-center">
            <div
              className="mb-3 flex items-center justify-center"
              role="group"
              aria-label="Aureo"
            >
              <AureoLogo
                width={180}
                height={56}
                className="h-14 w-auto max-w-[12rem] object-contain"
              />
            </div>
            <p className="text-sm text-marea">Cargando…</p>
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}

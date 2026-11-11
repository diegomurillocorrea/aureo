"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { Footer } from "@/components/footer";
import { AureoLogo } from "@/components/aureo-logo";
import { PermissionsProvider, usePermissions } from "./permissions-provider";
import { HomeShellBackLink } from "@/components/home-shell-back-link";
import { usesTableScrollShell } from "@/lib/table-scroll-shell";
import {
  chromeFocusRingClass,
  navActiveClass,
  navInactiveClass,
  shellActionClassName,
} from "@/lib/aureo-ui";

function useUser() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: u } }) => setUser(u ?? null));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);
  return user;
}

function displayName(user) {
  if (!user) return null;
  const meta = user.user_metadata ?? {};
  return meta.full_name ?? meta.name ?? user.email ?? "Usuario";
}

function UserDisplay() {
  const user = useUser();
  const name = displayName(user);
  if (!name) return null;
  return (
    <div
      className="rounded-xl px-4 py-2 text-sm text-crema/70"
      aria-label={`Conectado como ${name}`}
    >
      <span className="truncate block">{name}</span>
    </div>
  );
}

const NAV_ITEMS = [
  { href: "/payments", label: "Pagos", resource: "payments" },
  { href: "/clients", label: "Clientes", resource: "clients" },
  { href: "/services", label: "Servicios", resource: "services" },
  { href: "/categories", label: "Categorías", resource: "categories" },
  { href: "/payment-methods", label: "Métodos de pago", resource: "payment_methods" },
  { href: "/users", label: "Usuarios", resource: "users" },
  { href: "/roles", label: "Roles", resource: "roles" },
];

const SIDEBAR_PATH_PREFIXES = NAV_ITEMS.map((item) => item.href);

function usesHomeShell(pathname) {
  if (pathname === "/") return true;
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return false;
  if (SIDEBAR_PATH_PREFIXES.includes(`/${segments[0]}`)) return false;
  return segments.length === 1 || segments.length === 2;
}

function NavContent({ pathname, onNavClick, hideLogo }) {
  const { can, isLoading } = usePermissions();
  const visibleItems = isLoading
    ? NAV_ITEMS
    : NAV_ITEMS.filter((item) => can(item.resource, "view"));
  return (
    <>
      {!hideLogo && (
        <div className="flex h-16 items-center border-b border-crema/15 px-5">
          <Link
            href="/"
            onClick={onNavClick}
            className={`flex min-w-0 items-center rounded-lg ${chromeFocusRingClass}`}
            aria-label="Ir a inicio — Aureo"
          >
            <AureoLogo
              variant="claro"
              width={140}
              height={40}
              className="h-10 w-auto max-w-[10rem] shrink-0 object-contain"
            />
          </Link>
        </div>
      )}
      <nav className="flex flex-1 flex-col gap-1 p-3" role="navigation">
        {visibleItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              className={`rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${chromeFocusRingClass} ${
                isActive ? navActiveClass : navInactiveClass
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-crema/15 p-3">
        <div className="flex flex-col gap-2">
          <UserDisplay />
          <SignOutButton />
        </div>
      </div>
    </>
  );
}

function SignOutButton() {
  const router = useRouter();
  const handleSignOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    router.push("/login");
  }, [router]);
  return (
    <button
      type="button"
      onClick={handleSignOut}
      className={`w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-crema/80 transition-all duration-200 hover:bg-bruma/20 hover:text-crema ${chromeFocusRingClass}`}
      aria-label="Cerrar sesión"
    >
      Cerrar sesión
    </button>
  );
}

function AdminIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
      />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
      />
    </svg>
  );
}

function HomeUserMenu() {
  const router = useRouter();

  const handleSignOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    router.push("/login");
  }, [router]);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Link
        href="/payments"
        className={shellActionClassName}
        aria-label="Ir a administración"
      >
        <AdminIcon />
        Administración
      </Link>
      <button
        type="button"
        onClick={handleSignOut}
        className={shellActionClassName}
        aria-label="Cerrar sesión"
      >
        <SignOutIcon />
        Cerrar sesión
      </button>
    </div>
  );
}

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";
  const isTablet = breakpoint === "tablet";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isHome = usesHomeShell(pathname);
  const isHomeServices = pathname === "/";

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);
  const isTableScrollPage = usesTableScrollShell(pathname);

  if (isHome) {
    return (
      <PermissionsProvider>
        <div className="fixed inset-0 flex flex-col overflow-hidden bg-crema">
          <div className="absolute left-6 top-6 z-20 flex items-center gap-2">
            <Suspense fallback={null}>
              <HomeShellBackLink />
            </Suspense>
          </div>
          <div className="absolute right-6 top-6 z-20">
            <HomeUserMenu />
          </div>
          <main
            className={`relative flex min-h-0 flex-1 flex-col ${isHomeServices ? "overflow-hidden" : "overflow-y-auto"}`}
          >
            <div
              className={`flex w-full flex-1 flex-col px-4 py-4 tablet:px-6 desktop:px-8 ${isHomeServices ? "min-h-0 overflow-hidden" : ""}`}
            >
              {children}
            </div>
            <div className="shrink-0">
              <Footer />
            </div>
          </main>
        </div>
      </PermissionsProvider>
    );
  }

  return (
    <PermissionsProvider>
    <div className="fixed inset-0 flex overflow-hidden bg-crema">
      {isMobile && (
        <header
          className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-crema/15 bg-tinta px-4"
          aria-label="App bar"
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className={`flex h-10 w-10 items-center justify-center rounded-xl text-crema/80 transition-colors hover:bg-bruma/20 hover:text-crema ${chromeFocusRingClass}`}
              aria-label="Abrir menú"
              aria-expanded={mobileMenuOpen}
            >
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <Link
              href="/"
              onClick={closeMobileMenu}
              className={`flex min-w-0 items-center rounded-lg ${chromeFocusRingClass}`}
              aria-label="Ir a inicio — Aureo"
            >
              <AureoLogo
                variant="claro"
                width={120}
                height={32}
                className="h-8 w-auto max-w-[8rem] shrink-0 object-contain"
              />
            </Link>
          </div>
        </header>
      )}

      {isMobile && mobileMenuOpen && (
        <button
          type="button"
          onClick={closeMobileMenu}
          className="fixed inset-0 z-40 bg-tinta/60 backdrop-blur-sm transition-opacity duration-200"
          aria-label="Cerrar menú"
        />
      )}

      <aside
        className={`
          flex h-full w-64 flex-col border-r border-crema/10 bg-tinta shadow-sm
          tablet:relative tablet:flex tablet:shadow-lg
          ${isMobile ? "fixed inset-y-0 left-0 z-50 flex transform transition-transform duration-300 ease-out" : ""}
          ${isMobile && !mobileMenuOpen ? "-translate-x-full" : ""}
          ${isMobile && mobileMenuOpen ? "translate-x-0 shadow-xl" : ""}
        `}
        aria-label="Dashboard navigation"
      >
        {isMobile && (
          <div className="flex h-14 items-center justify-between border-b border-crema/15 px-4">
            <span className="text-base font-semibold text-crema">
              Menú
            </span>
            <button
              type="button"
              onClick={closeMobileMenu}
              className={`flex h-10 w-10 items-center justify-center rounded-xl text-crema/80 transition-colors hover:bg-bruma/20 hover:text-crema ${chromeFocusRingClass}`}
              aria-label="Cerrar menú"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}
        <NavContent
          pathname={pathname}
          onNavClick={isMobile ? closeMobileMenu : undefined}
          hideLogo={isMobile}
        />
      </aside>

      <main
        className={`flex min-h-0 flex-1 flex-col tablet:min-w-0 ${isTableScrollPage ? "overflow-hidden" : "overflow-y-auto"}`}
      >
        <div
          className={`w-full flex-1 p-4 tablet:p-6 desktop:p-8 ${isTableScrollPage ? "flex min-h-0 flex-col overflow-hidden" : ""} ${isMobile ? "pt-20" : ""} ${isTablet ? "pt-10" : ""}`}
        >
          {children}
        </div>
        <div className="shrink-0">
          <Footer />
        </div>
      </main>
    </div>
    </PermissionsProvider>
  );
}

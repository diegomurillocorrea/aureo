/**
 * Only allow returning to the payments list (with optional query).
 * @param {string | null | undefined} value
 * @returns {string}
 */
export function resolveSafePaymentsReturnTo(value) {
  if (!value || typeof value !== "string") return "/payments";
  if (!value.startsWith("/") || value.startsWith("//")) return "/payments";
  let pathname = value;
  let search = "";
  const q = value.indexOf("?");
  if (q !== -1) {
    pathname = value.slice(0, q);
    search = value.slice(q);
  }
  const pathOnly = pathname.replace(/\/+$/, "") || "/";
  if (pathOnly !== "/payments") return "/payments";
  return `/payments${search}`;
}

/** Routes whose list/table body scrolls inside the dashboard shell. */
export const TABLE_SCROLL_PATHS = [
  "/payments",
  "/clients",
  "/services",
  "/categories",
  "/payment-methods",
  "/users",
  "/roles",
];

export function usesTableScrollShell(pathname) {
  return TABLE_SCROLL_PATHS.includes(pathname);
}

export const tableViewRootClass =
  "flex min-h-0 flex-1 flex-col gap-6 tablet:gap-8";

export const tableViewSectionClass =
  "flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-marea/20 bg-crema shadow-sm";

export const tableViewSectionTitleClass =
  "shrink-0 border-b-2 border-ambar bg-marea px-4 py-3.5 text-crema tablet:px-6";

export const tableScrollBodyClass = "min-h-0 flex-1 overflow-auto";

export const tableMobileListClass =
  "min-h-0 flex-1 divide-y divide-marea/20 overflow-y-auto";

export const tableMobileListAltClass =
  "min-h-0 flex-1 divide-y divide-marea/20 overflow-y-auto";

export const tableHeadClass =
  "sticky top-0 z-10 bg-bruma";

export const tableHeadCellClass =
  "bg-bruma";

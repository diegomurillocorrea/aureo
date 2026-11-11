"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback, useMemo } from "react";
import { TableEditDeleteActions } from "@/components/table-edit-delete-actions";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { formatDateEsSv } from "@/lib/datetime";
import {
  tableHeadClass,
  tableMobileListAltClass,
  tableScrollBodyClass,
  tableViewRootClass,
  tableViewSectionClass,
  tableViewSectionTitleClass,
} from "@/lib/table-scroll-shell";
import { usePermissions } from "../permissions-provider";
import {
  createPaymentMethodAction,
  updatePaymentMethodAction,
  deletePaymentMethodAction,
} from "./actions";

const EMPTY_FORM = {
  name: "",
};

export function PaymentMethodsView({ initialPaymentMethods, fetchError }) {
  const router = useRouter();
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";
  const { can } = usePermissions();
  const canCreate = can("payment_methods", "create");
  const canEdit = can("payment_methods", "edit");
  const canDelete = can("payment_methods", "delete");
  const paymentMethods = initialPaymentMethods;
  const [formOpen, setFormOpen] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const isEditing = formOpen && formOpen !== "create";

  const filteredPaymentMethods = useMemo(() => {
    if (!searchQuery.trim()) return paymentMethods;
    const q = searchQuery.trim().toLowerCase();
    return paymentMethods.filter((m) =>
      (m.name ?? "").toLowerCase().includes(q)
    );
  }, [paymentMethods, searchQuery]);

  const openCreate = useCallback(() => {
    setFormOpen("create");
    setFormData(EMPTY_FORM);
    setFormError(null);
  }, []);

  const openEdit = useCallback((paymentMethod) => {
    setFormOpen(paymentMethod);
    setFormData({
      name: paymentMethod.name ?? "",
    });
    setFormError(null);
  }, []);

  const closeForm = useCallback(() => {
    setFormOpen(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
  }, []);

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    if (isEditing) {
      const result = await updatePaymentMethodAction(formOpen.id, formData);
      setIsSubmitting(false);
      if (result.error) {
        setFormError(result.error);
        return;
      }
      closeForm();
      router.refresh();
      return;
    }

    const result = await createPaymentMethodAction(formData);
    setIsSubmitting(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    closeForm();
    router.refresh();
  };

  const handleDeleteClick = useCallback((paymentMethod) => {
    setDeleteTarget(paymentMethod);
    setDeleteError(null);
  }, []);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    const result = await deletePaymentMethodAction(deleteTarget.id);
    setIsDeleting(false);
    if (result.error) {
      setDeleteError(result.error);
      return;
    }
    setDeleteTarget(null);
    router.refresh();
  };

  const handleDeleteCancel = useCallback(() => {
    setDeleteTarget(null);
    setDeleteError(null);
  }, []);

  const inputClass =
    "w-full rounded-xl border border-marea/20 bg-crema px-3 py-2.5 text-tinta placeholder-marea/60 transition-all duration-200 focus:border-marea focus:outline-none focus:ring-2 focus:ring-marea/20 disabled:opacity-50      ";

  return (
    <div className={tableViewRootClass}>
      <header className="shrink-0 space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="h-10 w-1 shrink-0 rounded-full bg-ambar"
              aria-hidden
            />
            <h1 className="text-2xl font-bold tracking-tight text-tinta tablet:text-3xl">
              Métodos de pago
            </h1>
          </div>
          {canCreate && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-11 w-fit shrink-0 items-center justify-center rounded-xl bg-ambar px-5 text-sm font-medium text-tinta transition-all duration-200 hover:bg-ambar/90 focus:outline-none focus:ring-2 focus:ring-marea focus:ring-offset-2"
              aria-label="Agregar método de pago"
            >
              Agregar método
            </button>
          )}
        </div>
        <p className="pl-4 text-sm text-marea tablet:text-base">
          Ver y gestionar métodos de pago disponibles.
          {paymentMethods.length > 0 ? (
            <>
              {" "}
              <span className="font-medium text-tinta">
                {paymentMethods.length}{" "}
                {paymentMethods.length === 1 ? "método" : "métodos"}
              </span>
            </>
          ) : null}
        </p>
      </header>

      {fetchError && (
        <div
          role="alert"
          className="shrink-0 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {fetchError}
        </div>
      )}

      {paymentMethods.length > 0 && (
        <div className="relative shrink-0">
          <label htmlFor="payment-method-search" className="sr-only">
            Buscar por nombre del método de pago
          </label>
          <input
            id="payment-method-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre del método de pago..."
            className="w-full rounded-full border border-marea/30 bg-crema pl-10 pr-4 py-2.5 text-tinta placeholder-marea/60 transition-all duration-200 focus:border-marea focus:outline-none focus:ring-2 focus:ring-marea/20"
            aria-label="Buscar métodos de pago por nombre"
          />
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-marea"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      )}

      <div className={tableViewSectionClass}>
        <div className={tableViewSectionTitleClass}>
          <h2 className="text-sm font-semibold text-crema">
            Lista de métodos de pago
          </h2>
        </div>

        {paymentMethods.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-5 px-4 py-20 text-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl bg-bruma text-tinta"
              aria-hidden
            >
              <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
            </div>
            <p className="text-sm text-marea">
              Aún no hay métodos de pago. Agrega tu primer método para comenzar.
            </p>
            {canCreate && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-ambar px-5 text-sm font-medium text-tinta transition-all hover:bg-ambar/90"
              aria-label="Agregar método de pago"
            >
              Agregar método
            </button>
            )}
          </div>
        ) : filteredPaymentMethods.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-5 px-4 py-20 text-center">
            <p className="text-sm text-marea">
              No se encontraron métodos de pago con ese criterio de búsqueda.
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-marea/20 bg-crema px-5 text-sm font-medium text-tinta transition-all hover:bg-crema"
              aria-label="Limpiar búsqueda"
            >
              Limpiar búsqueda
            </button>
          </div>
        ) : isMobile ? (
          <ul className={tableMobileListAltClass} role="list">
            {filteredPaymentMethods.map((method, index) => (
              <li
                key={method.id}
                className="flex flex-col gap-2 px-4 py-4 first:pt-4 last:pb-4 transition-colors hover:bg-bruma/40 tablet:px-6"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium text-marea" aria-hidden>
                    {index + 1}.
                  </span>
                  <span className="font-semibold text-tinta">
                    {method.name}
                  </span>
                  <span className="text-xs text-marea">
                    {formatDateEsSv(method.created_at)}
                  </span>
                </div>
                <TableEditDeleteActions
                  canEdit={canEdit}
                  canDelete={canDelete}
                  editLabel={`Editar ${method.name}`}
                  deleteLabel={`Eliminar ${method.name}`}
                  onEdit={() => openEdit(method)}
                  onDelete={() => handleDeleteClick(method)}
                  className="flex items-center gap-1 pt-2"
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className={tableScrollBodyClass}>
            <table className="w-full text-left text-sm" role="grid">
              <thead className={tableHeadClass}>
                <tr className="border-b border-bruma">
                  <th className="w-12 px-2 py-3.5 font-semibold text-tinta tablet:px-4" scope="col">
                    #
                  </th>
                  <th className="px-4 py-3.5 font-semibold text-tinta tablet:px-6">
                    Nombre
                  </th>
                  <th className="px-4 py-3.5 font-semibold text-tinta tablet:px-6">
                    Creado
                  </th>
                  {(canEdit || canDelete) && (
                  <th className="px-4 py-3.5 font-semibold text-tinta tablet:px-6">
                    Acciones
                  </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredPaymentMethods.map((method, index) => (
                  <tr
                    key={method.id}
                    className="border-b border-bruma last:border-0 transition-colors hover:bg-bruma/40"
                  >
                    <td className="w-12 px-2 py-3.5 text-marea tablet:px-4" aria-label={`Fila ${index + 1}`}>
                      {index + 1}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-tinta tablet:px-6">
                      {method.name}
                    </td>
                    <td className="px-4 py-3.5 text-marea tablet:px-6">
                      {formatDateEsSv(method.created_at)}
                    </td>
                    {(canEdit || canDelete) && (
                    <td className="px-4 py-3.5 tablet:px-6">
                      <TableEditDeleteActions
                        canEdit={canEdit}
                        canDelete={canDelete}
                        editLabel={`Editar ${method.name}`}
                        deleteLabel={`Eliminar ${method.name}`}
                        onEdit={() => openEdit(method)}
                        onDelete={() => handleDeleteClick(method)}
                      />
                    </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit modal */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm tablet:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-method-form-title"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-marea/20 bg-crema p-6 shadow-xl tablet:p-8"
            onKeyDown={(e) => e.key === "Escape" && closeForm()}
          >
            <h2 id="payment-method-form-title" className="text-xl font-bold text-tinta">
              {isEditing ? "Editar método de pago" : "Agregar método de pago"}
            </h2>
            <form
              onSubmit={handleFormSubmit}
              className="mt-6 flex flex-col gap-5"
            >
              <div>
                <label
                  htmlFor="payment-method-name"
                  className="mb-1.5 block text-sm font-medium text-tinta"
                >
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  id="payment-method-name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  disabled={isSubmitting}
                  placeholder="Ej: Efectivo, Transferencia, Tarjeta"
                  className={inputClass}
                  aria-invalid={!!formError}
                />
              </div>

              {formError && (
                <div
                  role="alert"
                  className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700"
                >
                  {formError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={isSubmitting}
                  className="flex-1 rounded-xl border border-marea/20 bg-crema px-4 py-3 text-sm font-medium text-tinta transition-all hover:bg-crema disabled:opacity-50"
                  aria-label="Cancelar"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 rounded-xl bg-ambar px-4 py-3 text-sm font-medium text-tinta transition-all hover:bg-ambar/90 focus:outline-none focus:ring-2 focus:ring-marea focus:ring-offset-2 disabled:opacity-50"
                  aria-busy={isSubmitting}
                  aria-label={isEditing ? "Guardar cambios" : "Crear método de pago"}
                >
                  {isSubmitting
                    ? "Guardando…"
                    : isEditing
                      ? "Guardar"
                      : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          aria-describedby="delete-dialog-desc"
        >
          <div className="w-full max-w-sm rounded-2xl border border-marea/20 bg-crema p-6 shadow-xl">
            <h2 id="delete-dialog-title" className="text-xl font-bold text-tinta">
              Eliminar método de pago
            </h2>
            <p id="delete-dialog-desc" className="mt-2 text-sm text-marea">
              ¿Estás seguro de que deseas eliminar{" "}
              <strong>{deleteTarget.name}</strong>
              ? Esta acción no se puede deshacer.
            </p>
            {deleteError && (
              <div
                role="alert"
                className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700"
              >
                {deleteError}
              </div>
            )}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={handleDeleteCancel}
                disabled={isDeleting}
                className="flex-1 rounded-xl border border-marea/20 bg-crema px-4 py-3 text-sm font-medium text-tinta transition-all hover:bg-crema disabled:opacity-50"
                aria-label="Cancelar"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-medium text-white transition-all hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
                aria-busy={isDeleting}
                aria-label="Eliminar método de pago"
              >
                {isDeleting ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

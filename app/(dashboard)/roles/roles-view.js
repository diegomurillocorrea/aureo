"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback, useMemo } from "react";
import { TableEditDeleteActions } from "@/components/table-edit-delete-actions";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { usePermissions } from "../permissions-provider";
import {
  RESOURCES,
  getActionsForResource,
  permissionKey,
} from "@/lib/auth/permission-catalog";
import { formatDateEsSv } from "@/lib/datetime";
import {
  tableHeadClass,
  tableMobileListAltClass,
  tableScrollBodyClass,
  tableViewRootClass,
  tableViewSectionClass,
  tableViewSectionTitleClass,
} from "@/lib/table-scroll-shell";
import {
  createRoleAction,
  updateRoleAction,
  deleteRoleAction,
} from "./actions";

const EMPTY_FORM = {
  name: "",
  description: "",
};

/**
 * @param {{ resource: string; action: string }[]} permissions
 * @returns {Set<string>}
 */
function permissionsToSet(permissions) {
  return new Set((permissions ?? []).map((p) => permissionKey(p.resource, p.action)));
}

/**
 * @param {Set<string>} set
 * @returns {{ resource: string; action: string }[]}
 */
function setToPermissions(set) {
  return Array.from(set).map((key) => {
    const [resource, action] = key.split(":");
    return { resource, action };
  });
}

function PermissionMatrix({ selected, onChange, disabled }) {
  const toggle = (resource, action) => {
    if (disabled) return;
    const key = permissionKey(resource, action);
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-bruma">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead>
          <tr className="border-b border-bruma bg-crema">
            <th className="px-3 py-2.5 font-semibold text-tinta">
              Sección
            </th>
            <th className="px-3 py-2.5 font-semibold text-tinta">
              Permisos
            </th>
          </tr>
        </thead>
        <tbody>
          {RESOURCES.map((resource) => {
            const actions = getActionsForResource(resource.id);
            return (
              <tr
                key={resource.id}
                className="border-b border-bruma last:border-0"
              >
                <td className="whitespace-nowrap px-3 py-3 font-medium text-tinta">
                  {resource.label}
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-2">
                    {actions.map((action) => {
                      const key = permissionKey(resource.id, action.id);
                      const checked = selected.has(key);
                      return (
                        <label
                          key={key}
                          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
 checked
 ? "border-marea bg-bruma text-tinta "
 : "border-marea/20 bg-crema text-marea "
 } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => toggle(resource.id, action.id)}
                            className="h-3.5 w-3.5 rounded border-bruma text-marea focus:ring-marea"
                            aria-label={`${resource.label} — ${action.label}`}
                          />
                          {action.label}
                        </label>
                      );
                    })}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function RolesView({ initialRoles, fetchError }) {
  const router = useRouter();
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";
  const { can } = usePermissions();
  const roles = initialRoles;
  const [formOpen, setFormOpen] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [selectedPermissions, setSelectedPermissions] = useState(new Set());
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const isEditing = formOpen && formOpen !== "create";
  const isSystemRole = isEditing && formOpen?.is_system;
  const canCreate = can("roles", "create");
  const canEdit = can("roles", "edit");
  const canDelete = can("roles", "delete");

  const filteredRoles = useMemo(() => {
    if (!searchQuery.trim()) return roles;
    const q = searchQuery.trim().toLowerCase();
    return roles.filter(
      (r) =>
        (r.name ?? "").toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q)
    );
  }, [roles, searchQuery]);

  const openCreate = useCallback(() => {
    setFormOpen("create");
    setFormData(EMPTY_FORM);
    setSelectedPermissions(new Set());
    setFormError(null);
  }, []);

  const openEdit = useCallback((role) => {
    setFormOpen(role);
    setFormData({
      name: role.name ?? "",
      description: role.description ?? "",
    });
    setSelectedPermissions(permissionsToSet(role.permissions));
    setFormError(null);
  }, []);

  const closeForm = useCallback(() => {
    setFormOpen(null);
    setFormData(EMPTY_FORM);
    setSelectedPermissions(new Set());
    setFormError(null);
  }, []);

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    const payload = {
      ...formData,
      permissions: setToPermissions(selectedPermissions),
    };

    if (isEditing) {
      const result = await updateRoleAction(formOpen.id, payload);
      setIsSubmitting(false);
      if (result.error) {
        setFormError(result.error);
        return;
      }
      closeForm();
      router.refresh();
      return;
    }

    const result = await createRoleAction(payload);
    setIsSubmitting(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    closeForm();
    router.refresh();
  };

  const handleDeleteClick = useCallback((role) => {
    setDeleteTarget(role);
    setDeleteError(null);
  }, []);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    const result = await deleteRoleAction(deleteTarget.id);
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
              Roles
            </h1>
          </div>
          {canCreate && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-11 w-fit shrink-0 items-center justify-center rounded-xl bg-ambar px-5 text-sm font-medium text-tinta transition-all duration-200 hover:bg-ambar/90 focus:outline-none focus:ring-2 focus:ring-marea focus:ring-offset-2"
              aria-label="Agregar rol"
            >
              Agregar rol
            </button>
          )}
        </div>
        <p className="pl-4 text-sm text-marea tablet:text-base">
          Crear roles y configurar permisos por sección y acción.
          {roles.length > 0 ? (
            <>
              {" "}
              <span className="font-medium text-tinta">
                {roles.length} {roles.length === 1 ? "rol" : "roles"}
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

      {roles.length > 0 && (
        <div className="relative shrink-0">
          <label htmlFor="role-search" className="sr-only">
            Buscar roles
          </label>
          <input
            id="role-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre o descripción..."
            className="w-full rounded-full border border-marea/30 bg-crema pl-10 pr-4 py-2.5 text-tinta placeholder-marea/60 transition-all duration-200 focus:border-marea focus:outline-none focus:ring-2 focus:ring-marea/20"
            aria-label="Buscar roles"
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
            Lista de roles
          </h2>
        </div>

        {roles.length === 0 ? (
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
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <p className="text-sm text-marea">
              {fetchError
                ? "No se pudieron cargar los roles."
                : "Aún no hay roles configurados."}
            </p>
            {canCreate && !fetchError && (
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-ambar px-5 text-sm font-medium text-tinta transition-all hover:bg-ambar/90"
                aria-label="Agregar rol"
              >
                Agregar rol
              </button>
            )}
          </div>
        ) : filteredRoles.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-5 px-4 py-20 text-center">
            <p className="text-sm text-marea">
              No se encontraron roles con ese criterio.
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
            {filteredRoles.map((role, index) => (
              <li key={role.id} className="flex flex-col gap-2 px-4 py-4 transition-colors hover:bg-bruma/40 tablet:px-6">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium text-marea" aria-hidden>
                    {index + 1}.
                  </span>
                  <span className="font-semibold text-tinta">
                    {role.name}
                    {role.is_system && (
                      <span className="ml-2 rounded-full bg-bruma px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-marea">
                        Sistema
                      </span>
                    )}
                  </span>
                  {role.description && (
                    <span className="text-sm text-marea">
                      {role.description}
                    </span>
                  )}
                  <span className="text-xs text-marea">
                    {(role.permissions ?? []).length} permiso(s) · {formatDateEsSv(role.created_at)}
                  </span>
                </div>
                <TableEditDeleteActions
                  canEdit={canEdit}
                  canDelete={canDelete && !role.is_system}
                  editLabel={`Editar ${role.name}`}
                  deleteLabel={`Eliminar ${role.name}`}
                  onEdit={() => openEdit(role)}
                  onDelete={() => handleDeleteClick(role)}
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
                    Descripción
                  </th>
                  <th className="px-4 py-3.5 font-semibold text-tinta tablet:px-6">
                    Permisos
                  </th>
                  <th className="px-4 py-3.5 font-semibold text-tinta tablet:px-6">
                    Creado
                  </th>
                  <th className="px-4 py-3.5 font-semibold text-tinta tablet:px-6">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRoles.map((role, index) => (
                  <tr
                    key={role.id}
                    className="border-b border-bruma last:border-0 transition-colors hover:bg-bruma/40"
                  >
                    <td className="w-12 px-2 py-3.5 text-marea tablet:px-4">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-tinta tablet:px-6">
                      {role.name}
                      {role.is_system && (
                        <span className="ml-2 rounded-full bg-bruma px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-marea">
                          Sistema
                        </span>
                      )}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3.5 text-marea tablet:px-6">
                      {role.description || "—"}
                    </td>
                    <td className="px-4 py-3.5 text-marea tablet:px-6">
                      {(role.permissions ?? []).length}
                    </td>
                    <td className="px-4 py-3.5 text-marea tablet:px-6">
                      {formatDateEsSv(role.created_at)}
                    </td>
                    <td className="px-4 py-3.5 tablet:px-6">
                      <TableEditDeleteActions
                        canEdit={canEdit}
                        canDelete={canDelete && !role.is_system}
                        editLabel={`Editar ${role.name}`}
                        deleteLabel={`Eliminar ${role.name}`}
                        onEdit={() => openEdit(role)}
                        onDelete={() => handleDeleteClick(role)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm tablet:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="role-form-title"
        >
          <div
            className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-marea/20 bg-crema p-6 shadow-xl tablet:p-8"
            onKeyDown={(e) => e.key === "Escape" && closeForm()}
          >
            <h2 id="role-form-title" className="text-xl font-bold text-tinta">
              {isEditing ? "Editar rol" : "Agregar rol"}
            </h2>
            {isSystemRole && (
              <p className="mt-2 text-sm text-amber-700">
                Este es un rol de sistema. Sus permisos no se pueden modificar desde aquí.
              </p>
            )}
            <form onSubmit={handleFormSubmit} className="mt-6 flex flex-col gap-5">
              <div>
                <label htmlFor="role-name" className="mb-1.5 block text-sm font-medium text-tinta">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  id="role-name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  disabled={isSubmitting || isSystemRole}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="role-description" className="mb-1.5 block text-sm font-medium text-tinta">
                  Descripción
                </label>
                <input
                  id="role-description"
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                  disabled={isSubmitting || isSystemRole}
                  className={inputClass}
                />
              </div>
              <div>
                <span className="mb-2 block text-sm font-medium text-tinta">
                  Permisos
                </span>
                <PermissionMatrix
                  selected={selectedPermissions}
                  onChange={setSelectedPermissions}
                  disabled={isSubmitting || isSystemRole}
                />
              </div>
              {formError && (
                <div role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">
                  {formError}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={isSubmitting}
                  className="flex-1 rounded-xl border border-marea/20 bg-crema px-4 py-3 text-sm font-medium text-tinta transition-all hover:bg-crema disabled:opacity-50"
                >
                  Cancelar
                </button>
                {!isSystemRole && (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 rounded-xl bg-ambar px-4 py-3 text-sm font-medium text-tinta transition-all hover:bg-ambar/90 disabled:opacity-50"
                    aria-busy={isSubmitting}
                  >
                    {isSubmitting ? "Guardando…" : isEditing ? "Guardar" : "Crear"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
        >
          <div className="w-full max-w-sm rounded-2xl border border-marea/20 bg-crema p-6 shadow-xl">
            <h2 id="delete-dialog-title" className="text-xl font-bold text-tinta">
              Eliminar rol
            </h2>
            <p className="mt-2 text-sm text-marea">
              ¿Eliminar el rol <strong>{deleteTarget.name}</strong>? Esta acción no se puede deshacer.
            </p>
            {deleteError && (
              <div role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">
                {deleteError}
              </div>
            )}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={handleDeleteCancel}
                disabled={isDeleting}
                className="flex-1 rounded-xl border border-marea/20 bg-crema px-4 py-3 text-sm font-medium text-tinta transition-all hover:bg-crema disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-medium text-white transition-all hover:bg-red-700 disabled:opacity-50"
                aria-busy={isDeleting}
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

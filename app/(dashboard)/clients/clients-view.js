"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { ActionIconButton } from "@/components/action-icon-button";
import { TableEditDeleteActions } from "@/components/table-edit-delete-actions";
import { Pencil, Trash2 } from "lucide-react";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { usePermissions } from "../permissions-provider";
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
  CLIENT_PHONE_COUNTRIES,
  detectClientPhoneCountry,
  extractLocalClientPhoneDigits,
  formatClientPhoneDisplay,
  formatLocalClientPhoneInput,
  getClientPhoneCountryConfig,
  toLocalClientPhoneInput,
} from "@/lib/phone";
import {
  createClientAction,
  updateClientAction,
  deleteClientAction,
  getServicesListAction,
  getClientReceiptsAction,
  createReceiptAction,
  updateReceiptAction,
  deleteReceiptByIdAction,
  searchClientsAction,
  reassignReceiptToClientAction,
} from "./actions";

const SEARCH_DEBOUNCE_MS = 300;
const MIN_CLIENT_SEARCH_LENGTH = 2;

const EMPTY_FORM = {
  name: "",
  last_name: "",
  phone_number: "",
  phone_country: "SV",
  reference: "",
};

function getServiceImageUrl(service) {
  if (!service?.image_bucket || !service?.image_path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/${service.image_bucket}/${service.image_path}`;
}

function getClientFullName(client) {
  if (!client) return "Sin nombre";
  return [client.name, client.last_name].filter(Boolean).join(" ").trim() || "Sin nombre";
}

export function ClientsView({ initialClients, fetchError }) {
  const router = useRouter();
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";
  const { can } = usePermissions();
  const canCreate = can("clients", "create");
  const canEdit = can("clients", "edit");
  const canDelete = can("clients", "delete");
  const clients = initialClients;
  const [formOpen, setFormOpen] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [duplicateClient, setDuplicateClient] = useState(null);

  const [servicesList, setServicesList] = useState([]);
  const [clientReceipts, setClientReceipts] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [linkError, setLinkError] = useState(null);
  const [isLinking, setIsLinking] = useState(false);
  const [unlinkingReceiptId, setUnlinkingReceiptId] = useState(null);
  const [editingReceiptId, setEditingReceiptId] = useState(null);
  const [editingValue, setEditingValue] = useState("");
  const [editingError, setEditingError] = useState(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [pendingServices, setPendingServices] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  const [adderOpen, setAdderOpen] = useState(false);
  const [adderStep, setAdderStep] = useState("select");
  const [adderServiceId, setAdderServiceId] = useState("");
  const [adderValue, setAdderValue] = useState("");

  const [reassignTarget, setReassignTarget] = useState(null);
  const [reassignSearchQuery, setReassignSearchQuery] = useState("");
  const [reassignResults, setReassignResults] = useState([]);
  const [isReassignSearchLoading, setIsReassignSearchLoading] = useState(false);
  const [reassignError, setReassignError] = useState(null);
  const [reassignSelectedClientId, setReassignSelectedClientId] = useState(null);
  const [isReassigning, setIsReassigning] = useState(false);
  const reassignSearchTimeoutRef = useRef(null);

  const isEditing = formOpen && formOpen !== "create";

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const q = searchQuery.trim().toLowerCase();
    return clients.filter((c) => {
      const name = (c.name ?? "").toLowerCase();
      const lastName = (c.last_name ?? "").toLowerCase();
      const phone = (c.phone_number ?? "").toString();
      const fullName = `${name} ${lastName}`.trim();
      const fullNameReversed = `${lastName} ${name}`.trim();
      return (
        name.includes(q) ||
        lastName.includes(q) ||
        fullName.includes(q) ||
        fullNameReversed.includes(q) ||
        phone.includes(q)
      );
    });
  }, [clients, searchQuery]);

  const filteredReassignResults = useMemo(() => {
    if (!isEditing || !formOpen?.id) return reassignResults;
    return reassignResults.filter((client) => client.id !== formOpen.id);
  }, [reassignResults, isEditing, formOpen?.id]);

  const trimmedReassignSearchQuery = reassignSearchQuery.trim();

  const runReassignSearch = useCallback(async (query) => {
    const q = (query ?? "").trim();
    if (q.length < MIN_CLIENT_SEARCH_LENGTH) {
      setReassignResults([]);
      setReassignError(null);
      setIsReassignSearchLoading(false);
      return;
    }

    setIsReassignSearchLoading(true);
    setReassignError(null);
    const result = await searchClientsAction(q);
    setIsReassignSearchLoading(false);

    if (result.error) {
      setReassignResults([]);
      setReassignError(result.error);
      return;
    }

    setReassignResults(result.clients ?? []);
  }, []);

  useEffect(() => {
    if (!reassignTarget) return;
    if (reassignSearchTimeoutRef.current) {
      clearTimeout(reassignSearchTimeoutRef.current);
    }

    if (trimmedReassignSearchQuery.length < MIN_CLIENT_SEARCH_LENGTH) {
      setReassignResults([]);
      setReassignError(null);
      setIsReassignSearchLoading(false);
      return;
    }

    setIsReassignSearchLoading(true);
    reassignSearchTimeoutRef.current = setTimeout(() => {
      runReassignSearch(reassignSearchQuery);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (reassignSearchTimeoutRef.current) {
        clearTimeout(reassignSearchTimeoutRef.current);
      }
    };
  }, [reassignTarget, reassignSearchQuery, trimmedReassignSearchQuery.length, runReassignSearch]);

  useEffect(() => {
    if (!formOpen) {
      setServicesList([]);
      setClientReceipts([]);
      return;
    }
    let cancelled = false;
    setServicesLoading(true);
    
    if (isEditing && formOpen?.id) {
      Promise.all([
        getServicesListAction(),
        getClientReceiptsAction(formOpen.id),
      ]).then(([servicesRes, receiptsRes]) => {
        if (cancelled) return;
        setServicesLoading(false);
        if (servicesRes.error) return;
        if (receiptsRes.error) return;
        setServicesList(servicesRes.services ?? []);
        setClientReceipts(receiptsRes.receipts ?? []);
      });
    } else {
      getServicesListAction().then((servicesRes) => {
        if (cancelled) return;
        setServicesLoading(false);
        if (servicesRes.error) return;
        setServicesList(servicesRes.services ?? []);
      });
    }
    
    return () => {
      cancelled = true;
    };
  }, [isEditing, formOpen?.id, formOpen]);

  const resetReassign = useCallback(() => {
    setReassignTarget(null);
    setReassignSearchQuery("");
    setReassignResults([]);
    setIsReassignSearchLoading(false);
    setReassignError(null);
    setReassignSelectedClientId(null);
    setIsReassigning(false);
  }, []);

  const resetAdder = useCallback(() => {
    setAdderOpen(false);
    setAdderStep("select");
    setAdderServiceId("");
    setAdderValue("");
    setLinkError(null);
    setEditingReceiptId(null);
    setEditingValue("");
    setEditingError(null);
  }, []);

  const openCreate = useCallback(() => {
    setFormOpen("create");
    setFormData(EMPTY_FORM);
    setFormError(null);
    setPendingServices([]);
    resetAdder();
  }, [resetAdder]);

  const openEdit = useCallback((client) => {
    setFormOpen(client);
    setFormData({
      name: client.name ?? "",
      last_name: client.last_name ?? "",
      phone_number: toLocalClientPhoneInput(client.phone_number),
      phone_country: detectClientPhoneCountry(client.phone_number),
      reference: client.reference ?? "",
    });
    setFormError(null);
    resetAdder();
  }, [resetAdder]);

  const closeForm = useCallback(() => {
    setFormOpen(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
    setLinkError(null);
    setPendingServices([]);
    resetAdder();
    resetReassign();
  }, [resetAdder, resetReassign]);

  const serviceNameById = useMemo(() => {
    const map = {};
    servicesList.forEach((s) => {
      map[s.id] = s.name;
    });
    return map;
  }, [servicesList]);

  const serviceImageUrlById = useMemo(() => {
    const map = {};
    servicesList.forEach((s) => {
      map[s.id] = getServiceImageUrl(s);
    });
    return map;
  }, [servicesList]);

  const addedServices = useMemo(() => {
    if (isEditing) {
      return clientReceipts.map((r) => ({
        id: r.id,
        serviceId: r.service_id,
        accountNumber: r.account_receipt_number,
      }));
    }
    return pendingServices.map((s) => ({
      id: s.id,
      serviceId: s.service_id,
      accountNumber: s.account_receipt_number,
    }));
  }, [isEditing, clientReceipts, pendingServices]);

  const handleOpenAdder = () => {
    setAdderOpen(true);
    setAdderStep("select");
    setAdderServiceId(servicesList[0]?.id ?? "");
    setAdderValue("");
    setLinkError(null);
  };

  const handleAdderAccept = () => {
    if (!adderServiceId) {
      setLinkError("Selecciona un servicio.");
      return;
    }
    setLinkError(null);
    setAdderStep("input");
  };

  const handleAdderSave = async () => {
    const value = adderValue.trim();
    if (!adderServiceId || !value) {
      setLinkError("El número de cuenta/recibo es requerido.");
      return;
    }
    setLinkError(null);

    if (isEditing) {
      setIsLinking(true);
      const result = await createReceiptAction({
        client_id: formOpen.id,
        service_id: adderServiceId,
        account_receipt_number: value,
      });
      setIsLinking(false);
      if (result.error) {
        setLinkError(result.error);
        return;
      }
      const receiptsRes = await getClientReceiptsAction(formOpen.id);
      if (!receiptsRes.error) setClientReceipts(receiptsRes.receipts ?? []);
      router.refresh();
    } else {
      setPendingServices((prev) => [
        ...prev,
        {
          id: `temp-${Date.now()}-${Math.random()}`,
          service_id: adderServiceId,
          account_receipt_number: value,
        },
      ]);
    }
    resetAdder();
  };

  const handleRemovePendingService = (tempId) => {
    setPendingServices((prev) => prev.filter((s) => s.id !== tempId));
  };

  const handleUnlinkReceipt = async (receiptId) => {
    if (!isEditing) return;
    setUnlinkingReceiptId(receiptId);
    const result = await deleteReceiptByIdAction(receiptId);
    setUnlinkingReceiptId(null);
    if (!result.error) {
      setClientReceipts((prev) => prev.filter((r) => r.id !== receiptId));
      router.refresh();
    }
  };

  const handleOpenReassign = (item) => {
    if (!isEditing || !canEdit) return;
    setReassignTarget(item);
    setReassignSearchQuery("");
    setReassignResults([]);
    setReassignError(null);
    setReassignSelectedClientId(null);
    setIsReassigning(false);
  };

  const handleCloseReassign = () => {
    resetReassign();
  };

  const handleReassignSearchChange = (event) => {
    setReassignSearchQuery(event.target.value);
    setReassignSelectedClientId(null);
    setReassignError(null);
  };

  const handleSelectClientForReassign = async (client) => {
    if (!reassignTarget?.id || !client?.id || isReassigning) return;

    setReassignSelectedClientId(client.id);
    setIsReassigning(true);
    setReassignError(null);

    const result = await reassignReceiptToClientAction(
      reassignTarget.id,
      client.id
    );

    if (result.error) {
      setIsReassigning(false);
      setReassignSelectedClientId(null);
      setReassignError(result.error);
      return;
    }

    const receiptsRes = await getClientReceiptsAction(formOpen.id);
    if (!receiptsRes.error) {
      setClientReceipts(receiptsRes.receipts ?? []);
    }

    resetReassign();
    router.refresh();
  };

  const handleStartEdit = (item) => {
    setEditingReceiptId(item.id);
    setEditingValue(item.accountNumber ?? "");
    setEditingError(null);
  };

  const handleCancelEdit = () => {
    setEditingReceiptId(null);
    setEditingValue("");
    setEditingError(null);
  };

  const handleSaveEdit = async (item) => {
    const value = editingValue.trim();
    if (!value) {
      setEditingError("El número de cuenta/recibo es requerido.");
      return;
    }
    setEditingError(null);

    if (isEditing) {
      setIsSavingEdit(true);
      const result = await updateReceiptAction(item.id, value);
      setIsSavingEdit(false);
      if (result.error) {
        setEditingError(result.error);
        return;
      }
      setClientReceipts((prev) =>
        prev.map((r) =>
          r.id === item.id ? { ...r, account_receipt_number: value } : r
        )
      );
      router.refresh();
    } else {
      setPendingServices((prev) =>
        prev.map((s) =>
          s.id === item.id ? { ...s, account_receipt_number: value } : s
        )
      );
    }
    handleCancelEdit();
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    if (isEditing) {
      const result = await updateClientAction(formOpen.id, formData);
      setIsSubmitting(false);
      if (result.duplicate) {
        setDuplicateClient(result.duplicate);
        return;
      }
      if (result.error) {
        setFormError(result.error);
        return;
      }
      closeForm();
      router.refresh();
      return;
    }

    const result = await createClientAction(formData);
    if (result.duplicate) {
      setIsSubmitting(false);
      setDuplicateClient(result.duplicate);
      return;
    }
    if (result.error) {
      setIsSubmitting(false);
      setFormError(result.error);
      return;
    }

    if (pendingServices.length > 0 && result.data?.id) {
      const linkPromises = pendingServices.map((service) =>
        createReceiptAction({
          client_id: result.data.id,
          service_id: service.service_id,
          account_receipt_number: service.account_receipt_number,
        })
      );
      await Promise.all(linkPromises);
    }

    setIsSubmitting(false);
    closeForm();
    router.refresh();
  };

  const handleDeleteClick = useCallback((client) => {
    setDeleteTarget(client);
    setDeleteError(null);
  }, []);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    const result = await deleteClientAction(deleteTarget.id);
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
              Clientes
            </h1>
          </div>
          {canCreate && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-11 w-fit shrink-0 items-center justify-center rounded-xl bg-ambar px-5 text-sm font-medium text-tinta transition-all duration-200 hover:bg-ambar/90 focus:outline-none focus:ring-2 focus:ring-marea focus:ring-offset-2"
              aria-label="Agregar cliente"
            >
              Agregar cliente
            </button>
          )}
        </div>
        <p className="pl-4 text-sm text-marea tablet:text-base">
          Ver y gestionar clientes. Agregar o editar clientes y asignar servicios.
          {clients.length > 0 ? (
            <>
              {" "}
              <span className="font-medium text-tinta">
                {clients.length}{" "}
                {clients.length === 1 ? "cliente" : "clientes"}
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

      {clients.length > 0 && (
        <div className="relative shrink-0">
          <label htmlFor="client-search" className="sr-only">
            Buscar por nombre, apellido o teléfono
          </label>
          <input
            id="client-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, apellido o teléfono..."
            className="w-full rounded-full border border-marea/30 bg-crema pl-10 pr-4 py-2.5 text-tinta placeholder-marea/60 transition-all duration-200 focus:border-marea focus:outline-none focus:ring-2 focus:ring-marea/20"
            aria-label="Buscar clientes por nombre, apellido o teléfono"
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
            Lista de clientes
          </h2>
        </div>

        {clients.length === 0 ? (
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
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <p className="text-sm text-marea">
              Aún no hay clientes. Agrega tu primer cliente para comenzar.
            </p>
            {canCreate && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-ambar px-5 text-sm font-medium text-tinta transition-all hover:bg-ambar/90"
              aria-label="Agregar cliente"
            >
              Agregar cliente
            </button>
            )}
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-5 px-4 py-20 text-center">
            <p className="text-sm text-marea">
              No se encontraron clientes con ese criterio de búsqueda.
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
            {filteredClients.map((client, index) => (
              <li
                key={client.id}
                className="flex flex-col gap-2 px-4 py-4 first:pt-4 last:pb-4 transition-colors hover:bg-bruma/40 tablet:px-6"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium text-marea" aria-hidden>
                    {index + 1}.
                  </span>
                  <span className="font-semibold text-tinta">
                    {client.name} {client.last_name}
                  </span>
                  <span className="text-sm text-marea">
                    {formatClientPhoneDisplay(client.phone_number) || "—"}
                  </span>
                  {client.reference && (
                    <span className="text-xs text-marea">
                      Ref: {client.reference}
                    </span>
                  )}
                  <span className="text-xs text-marea">
                    {formatDateEsSv(client.created_at)}
                  </span>
                </div>
                <TableEditDeleteActions
                  canEdit={canEdit}
                  canDelete={canDelete}
                  editLabel={`Editar ${client.name} ${client.last_name}`}
                  deleteLabel={`Eliminar ${client.name} ${client.last_name}`}
                  onEdit={() => openEdit(client)}
                  onDelete={() => handleDeleteClick(client)}
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
                    Apellido
                  </th>
                  <th className="px-4 py-3.5 font-semibold text-tinta tablet:px-6">
                    Teléfono
                  </th>
                  <th className="px-4 py-3.5 font-semibold text-tinta tablet:px-6">
                    Referencia
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
                {filteredClients.map((client, index) => (
                  <tr
                    key={client.id}
                    className="border-b border-bruma last:border-0 transition-colors hover:bg-bruma/40"
                  >
                    <td className="w-12 px-2 py-3.5 text-marea tablet:px-4" aria-label={`Fila ${index + 1}`}>
                      {index + 1}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-tinta tablet:px-6">
                      {client.name}
                    </td>
                    <td className="px-4 py-3.5 text-tinta tablet:px-6">
                      {client.last_name}
                    </td>
                    <td className="px-4 py-3.5 text-marea tablet:px-6">
                      {formatClientPhoneDisplay(client.phone_number) || "—"}
                    </td>
                    <td className="px-4 py-3.5 text-marea tablet:px-6">
                      {client.reference || "—"}
                    </td>
                    <td className="px-4 py-3.5 text-marea tablet:px-6">
                      {formatDateEsSv(client.created_at)}
                    </td>
                    {(canEdit || canDelete) && (
                    <td className="px-4 py-3.5 tablet:px-6">
                      <TableEditDeleteActions
                        canEdit={canEdit}
                        canDelete={canDelete}
                        editLabel={`Editar ${client.name} ${client.last_name}`}
                        deleteLabel={`Eliminar ${client.name} ${client.last_name}`}
                        onEdit={() => openEdit(client)}
                        onDelete={() => handleDeleteClick(client)}
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

      {/* Create/Edit modal: scrollable with max-height on mobile; desktop-style on tablet+ */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm tablet:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="client-form-title"
        >
          <div
            className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-marea/20 bg-crema shadow-xl max-h-[90dvh] tablet:max-h-none tablet:p-8 p-6"
            onKeyDown={(e) => e.key === "Escape" && closeForm()}
          >
            <h2 id="client-form-title" className="shrink-0 text-xl font-bold text-tinta">
              {isEditing ? "Editar cliente" : "Agregar cliente"}
            </h2>
            <div className="min-h-0 flex-1 overflow-y-auto mt-6 -mr-2 pr-2 tablet:mr-0 tablet:pr-0">
            <form
              onSubmit={handleFormSubmit}
              className="flex flex-col gap-5 pb-2"
            >
              <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2">
              <div>
                <label
                  htmlFor="client-name"
                  className="mb-1.5 block text-sm font-medium text-tinta"
                >
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  id="client-name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  disabled={isSubmitting}
                  className={inputClass}
                  aria-invalid={!!formError}
                />
              </div>
              <div>
                <label
                  htmlFor="client-last-name"
                  className="mb-1.5 block text-sm font-medium text-tinta"
                >
                  Apellido <span className="text-red-500">*</span>
                </label>
                <input
                  id="client-last-name"
                  type="text"
                  required
                  value={formData.last_name}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      last_name: e.target.value,
                    }))
                  }
                  disabled={isSubmitting}
                  className={inputClass}
                  aria-invalid={!!formError}
                />
              </div>
              <div>
                <label
                  htmlFor="client-phone"
                  className="mb-1.5 block text-sm font-medium text-tinta"
                >
                  Número de teléfono
                </label>
                <div className="flex overflow-hidden rounded-xl border border-marea/20 bg-crema focus-within:border-marea focus-within:ring-2 focus-within:ring-marea/20">
                  <label className="sr-only" htmlFor="client-phone-country">
                    País del teléfono
                  </label>
                  <select
                    id="client-phone-country"
                    aria-label="País del teléfono"
                    value={formData.phone_country}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        phone_country: e.target.value,
                        phone_number: "",
                      }))
                    }
                    disabled={isSubmitting}
                    className="shrink-0 border-0 border-r border-bruma bg-crema px-2 py-2.5 text-sm font-medium text-tinta focus:outline-none focus:ring-0 disabled:opacity-50"
                  >
                    {CLIENT_PHONE_COUNTRIES.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.label}
                      </option>
                    ))}
                  </select>
                  <span
                    className="flex shrink-0 items-center border-r border-bruma bg-crema px-3 text-sm font-medium text-marea"
                    aria-hidden
                  >
                    +
                    {getClientPhoneCountryConfig(formData.phone_country)?.callingCode ??
                      "503"}
                  </span>
                  <input
                    id="client-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder={
                      formData.phone_country === "US" ? "000 000 0000" : "0000 0000"
                    }
                    value={formatLocalClientPhoneInput(
                      formData.phone_number,
                      formData.phone_country
                    )}
                    onChange={(e) => {
                      setFormData((prev) => ({
                        ...prev,
                        phone_number: extractLocalClientPhoneDigits(
                          e.target.value,
                          prev.phone_country
                        ),
                      }));
                    }}
                    disabled={isSubmitting}
                    className="w-full border-0 bg-transparent px-4 py-2.5 text-tinta placeholder-marea/60 focus:outline-none focus:ring-0 disabled:opacity-50"
                    aria-label="Número de teléfono"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="client-reference"
                  className="mb-1.5 block text-sm font-medium text-tinta"
                >
                  Referencia
                </label>
                <input
                  id="client-reference"
                  type="text"
                  value={formData.reference}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      reference: e.target.value,
                    }))
                  }
                  disabled={isSubmitting}
                  className={inputClass}
                />
              </div>
              </div>

              <div className="border-t border-bruma pt-5">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-tinta">
                    Servicios
                  </h3>
                  {!adderOpen && servicesList.length > 0 && (
                    <button
                      type="button"
                      onClick={handleOpenAdder}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-ambar px-3 py-2 text-xs font-medium text-tinta transition-all hover:bg-ambar/90"
                      aria-label="Agregar servicio"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                      Agregar
                    </button>
                  )}
                </div>
                <p className="mb-4 text-xs text-marea">
                  {isEditing
                    ? "Vincular o desvincular servicios. Puedes agregar múltiples cuentas por servicio (ej. dos cuentas de Claro con diferentes números de cuenta/recibo)."
                    : "Agrega servicios que se vincularán automáticamente al crear el cliente."}
                </p>

                {servicesLoading ? (
                  <p className="text-sm text-marea">
                    Cargando servicios…
                  </p>
                ) : servicesList.length === 0 ? (
                  <p className="text-sm text-marea">
                    Aún no hay servicios definidos. Agrega servicios en la
                    sección de Servicios primero.
                  </p>
                ) : (
                  <>
                    {addedServices.length > 0 ? (
                      <ul className="space-y-2" role="list">
                        {addedServices.map((item) => {
                          const isUnlinking = unlinkingReceiptId === item.id;
                          const isRowEditing = editingReceiptId === item.id;
                          return (
                            <li
                              key={item.id}
                              className="flex flex-col gap-3 rounded-xl border border-marea/30 bg-crema/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                {serviceImageUrlById[item.serviceId] ? (
                                  <img
                                    src={serviceImageUrlById[item.serviceId]}
                                    alt={`Imagen de ${serviceNameById[item.serviceId] ?? "servicio"}`}
                                    className="h-10 w-10 shrink-0 rounded-lg border border-bruma object-cover"
                                  />
                                ) : (
                                  <div
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-bruma text-marea"
                                    aria-hidden
                                  >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                  </div>
                                )}
                                <div className="flex min-w-0 flex-1 flex-col">
                                  <span className="truncate font-medium text-tinta">
                                    {serviceNameById[item.serviceId] ?? "Servicio"}
                                  </span>
                                  {isRowEditing ? (
                                    <>
                                      <input
                                        type="text"
                                        value={editingValue}
                                        onChange={(e) => setEditingValue(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            e.preventDefault();
                                            handleSaveEdit(item);
                                          }
                                          if (e.key === "Escape") handleCancelEdit();
                                        }}
                                        disabled={isSavingEdit}
                                        className="mt-1 w-full rounded-lg border border-marea/20 bg-crema px-2 py-1 text-sm text-tinta placeholder-marea/60 focus:border-marea focus:outline-none focus:ring-2 focus:ring-marea/20 disabled:opacity-50"
                                        placeholder="Número de cuenta/recibo"
                                        aria-label="Editar número de cuenta/recibo"
                                        autoFocus
                                      />
                                      {editingError && (
                                        <span className="mt-1 text-xs text-red-600">
                                          {editingError}
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    <span className="truncate text-xs text-marea">
                                      {item.accountNumber}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-3 self-end sm:self-auto">
                                {isRowEditing ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleSaveEdit(item)}
                                      disabled={isSavingEdit}
                                      className="text-xs font-medium text-marea hover:underline disabled:opacity-50"
                                      aria-label={`Guardar ${item.accountNumber}`}
                                    >
                                      {isSavingEdit ? "…" : "Guardar"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handleCancelEdit}
                                      disabled={isSavingEdit}
                                      className="text-xs font-medium text-marea hover:underline disabled:opacity-50"
                                      aria-label="Cancelar edición"
                                    >
                                      Cancelar
                                    </button>
                                  </>
                                ) : (
                                  <div className="flex flex-wrap items-center justify-end gap-2">
                                    {isEditing && canEdit ? (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenReassign(item)}
                                        disabled={isUnlinking}
                                        className="text-xs font-medium text-marea hover:underline disabled:opacity-50"
                                        aria-label={`Reasignar ${item.accountNumber} a otro cliente`}
                                      >
                                        Reasignar
                                      </button>
                                    ) : null}
                                    <div className="flex items-center gap-1">
                                    <ActionIconButton
                                      label={`Editar ${item.accountNumber}`}
                                      tone="info"
                                      onClick={() => handleStartEdit(item)}
                                      disabled={isUnlinking}
                                    >
                                      <Pencil className="h-4 w-4" aria-hidden />
                                    </ActionIconButton>
                                    <ActionIconButton
                                      label={
                                        isEditing
                                          ? `Desvincular ${item.accountNumber}`
                                          : `Quitar ${item.accountNumber}`
                                      }
                                      tone="danger"
                                      onClick={() =>
                                        isEditing
                                          ? handleUnlinkReceipt(item.id)
                                          : handleRemovePendingService(item.id)
                                      }
                                      disabled={isEditing && isUnlinking}
                                    >
                                      <Trash2 className="h-4 w-4" aria-hidden />
                                    </ActionIconButton>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      !adderOpen && (
                        <p className="text-sm text-marea">
                          Aún no hay servicios vinculados. Usa el botón “Agregar”.
                        </p>
                      )
                    )}

                    {adderOpen && (
                      <div className="mt-3 flex flex-col gap-3 rounded-xl border border-marea/70 bg-bruma/40 p-4">
                        {adderStep === "select" ? (
                          <>
                            <label
                              htmlFor="adder-service"
                              className="block text-sm font-medium text-tinta"
                            >
                              Servicio
                            </label>
                            <select
                              id="adder-service"
                              value={adderServiceId}
                              onChange={(e) => setAdderServiceId(e.target.value)}
                              className={inputClass}
                              aria-label="Seleccionar servicio"
                            >
                              {servicesList.map((service) => (
                                <option key={service.id} value={service.id}>
                                  {service.name}
                                </option>
                              ))}
                            </select>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={resetAdder}
                                className="flex-1 rounded-xl border border-marea/20 bg-crema px-4 py-2.5 text-sm font-medium text-tinta transition-all hover:bg-crema"
                                aria-label="Cancelar"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={handleAdderAccept}
                                disabled={!adderServiceId}
                                className="flex-1 rounded-xl bg-ambar px-4 py-2.5 text-sm font-medium text-tinta transition-all hover:bg-ambar/90 disabled:opacity-50"
                                aria-label="Aceptar servicio"
                              >
                                Aceptar
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <label
                              htmlFor="adder-value"
                              className="block text-sm font-medium text-tinta"
                            >
                              {serviceNameById[adderServiceId] ?? "Servicio"} ·
                              Número de cuenta/recibo
                            </label>
                            <input
                              id="adder-value"
                              type="text"
                              autoFocus
                              placeholder="Número de cuenta/recibo"
                              value={adderValue}
                              onChange={(e) => setAdderValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleAdderSave();
                                }
                              }}
                              disabled={isLinking}
                              className={inputClass}
                              aria-label="Número de cuenta/recibo"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setAdderStep("select")}
                                disabled={isLinking}
                                className="flex-1 rounded-xl border border-marea/20 bg-crema px-4 py-2.5 text-sm font-medium text-tinta transition-all hover:bg-crema disabled:opacity-50"
                                aria-label="Volver"
                              >
                                Atrás
                              </button>
                              <button
                                type="button"
                                onClick={handleAdderSave}
                                disabled={isLinking || !adderValue.trim()}
                                className="flex-1 rounded-xl bg-ambar px-4 py-2.5 text-sm font-medium text-tinta transition-all hover:bg-ambar/90 disabled:opacity-50"
                                aria-label="Guardar servicio"
                              >
                                {isLinking ? "Guardando…" : "Guardar"}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}

                {linkError && (
                  <div
                    role="alert"
                    className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700"
                  >
                    {linkError}
                  </div>
                )}
              </div>

              {formError && (
                <div
                  role="alert"
                  className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700"
                >
                  {formError}
                </div>
              )}
              <div className="flex gap-3 pt-2">
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
                  aria-label={isEditing ? "Guardar cambios" : "Crear cliente"}
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
              Eliminar cliente
            </h2>
            <p id="delete-dialog-desc" className="mt-2 text-sm text-marea">
              ¿Estás seguro de que deseas eliminar a{" "}
              <strong>
                {deleteTarget.name} {deleteTarget.last_name}
              </strong>
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
                aria-label="Eliminar cliente"
              >
                {isDeleting ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reassign service to another client */}
      {reassignTarget && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reassign-dialog-title"
          aria-describedby="reassign-dialog-desc"
        >
          <div
            className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-marea/20 bg-crema shadow-xl max-h-[90dvh]"
            onKeyDown={(e) => e.key === "Escape" && !isReassigning && handleCloseReassign()}
          >
            <div className="shrink-0 border-b border-bruma px-6 py-5">
              <h2
                id="reassign-dialog-title"
                className="text-xl font-bold text-tinta"
              >
                Reasignar servicio
              </h2>
              <p
                id="reassign-dialog-desc"
                className="mt-2 text-sm text-marea"
              >
                Busca el cliente al que pertenecerá ahora este número de servicio.
              </p>
              <div className="mt-4 rounded-xl border border-marea/30 bg-crema/60 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-marea">
                  Servicio a reasignar
                </p>
                <p className="mt-1 font-semibold text-tinta">
                  {serviceNameById[reassignTarget.serviceId] ?? "Servicio"}
                </p>
                <p className="text-sm text-marea">
                  {reassignTarget.accountNumber}
                </p>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <label
                htmlFor="reassign-client-search"
                className="mb-1.5 block text-sm font-medium text-tinta"
              >
                Buscar cliente
              </label>
              <input
                id="reassign-client-search"
                type="search"
                value={reassignSearchQuery}
                onChange={handleReassignSearchChange}
                placeholder="Nombre o teléfono del cliente"
                autoComplete="off"
                disabled={isReassigning}
                className={inputClass}
                aria-label="Buscar cliente por nombre o teléfono"
                aria-busy={isReassignSearchLoading || isReassigning}
                autoFocus
              />

              <div
                className="mt-4 overflow-hidden rounded-xl border border-marea/20 bg-crema"
                role="region"
                aria-label="Resultados de búsqueda de clientes"
                aria-live="polite"
              >
                {isReassigning ? (
                  <p className="px-4 py-6 text-center text-sm text-marea">
                    Reasignando servicio…
                  </p>
                ) : trimmedReassignSearchQuery.length < MIN_CLIENT_SEARCH_LENGTH ? (
                  <p className="px-4 py-6 text-center text-sm text-marea">
                    Escribe al menos {MIN_CLIENT_SEARCH_LENGTH} caracteres para buscar
                  </p>
                ) : isReassignSearchLoading ? (
                  <p className="px-4 py-6 text-center text-sm text-marea">
                    Buscando clientes…
                  </p>
                ) : filteredReassignResults.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-marea">
                    No se encontraron otros clientes
                  </p>
                ) : (
                  <ul className="max-h-[min(40vh,18rem)] divide-y divide-bruma overflow-y-auto p-1">
                    {filteredReassignResults.map((client) => {
                      const fullName = getClientFullName(client);
                      const phone = formatClientPhoneDisplay(client.phone_number);
                      const label = phone ? `${fullName} · ${phone}` : fullName;

                      return (
                        <li key={client.id}>
                          <button
                            type="button"
                            onClick={() => handleSelectClientForReassign(client)}
                            className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-marea/50 focus-visible:ring-offset-2 ${
 reassignSelectedClientId === client.id
 ? "bg-bruma text-tinta "
 : "text-tinta hover:bg-bruma "
 }`}
                            aria-label={`Reasignar servicio a ${label}`}
                            aria-pressed={reassignSelectedClientId === client.id}
                          >
                            <span
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-bruma bg-bruma text-sm font-semibold text-marea"
                              aria-hidden
                            >
                              {(client.name ?? "?").charAt(0).toUpperCase()}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">
                                {fullName}
                              </span>
                              {phone ? (
                                <span className="block truncate text-xs text-marea">
                                  {phone}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {reassignError ? (
                <div
                  role="alert"
                  className="mt-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700"
                >
                  {reassignError}
                </div>
              ) : null}
            </div>

            <div className="shrink-0 border-t border-bruma px-6 py-4">
              <button
                type="button"
                onClick={handleCloseReassign}
                disabled={isReassigning}
                className="w-full rounded-xl border border-marea/20 bg-crema px-4 py-3 text-sm font-medium text-tinta transition-all hover:bg-crema disabled:opacity-50"
                aria-label="Cancelar reasignación"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate phone number warning */}
      {duplicateClient && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="duplicate-dialog-title"
          aria-describedby="duplicate-dialog-desc"
        >
          <div className="w-full max-w-sm rounded-2xl border border-marea/20 bg-crema p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
                <svg
                  className="h-5 w-5 text-amber-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z"
                  />
                </svg>
              </div>
              <div className="min-w-0">
                <h2
                  id="duplicate-dialog-title"
                  className="text-xl font-bold text-tinta"
                >
                  Número de teléfono duplicado
                </h2>
                <p
                  id="duplicate-dialog-desc"
                  className="mt-2 text-sm text-marea"
                >
                  Ya existe un contacto registrado con el número{" "}
                  <strong className="text-tinta">
                    {formatClientPhoneDisplay(duplicateClient.phone_number)}
                  </strong>
                  .
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-marea/30 bg-crema/60 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-marea">
                Contacto existente
              </p>
              <p className="mt-1.5 font-semibold text-tinta">
                {duplicateClient.name} {duplicateClient.last_name}
              </p>
              <p className="text-sm text-marea">
                {formatClientPhoneDisplay(duplicateClient.phone_number) || "—"}
              </p>
              {duplicateClient.reference && (
                <p className="mt-0.5 text-xs text-marea">
                  Ref: {duplicateClient.reference}
                </p>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-3 tablet:flex-row">
              <button
                type="button"
                onClick={() => setDuplicateClient(null)}
                className="flex-1 rounded-xl border border-marea/20 bg-crema px-4 py-3 text-sm font-medium text-tinta transition-all hover:bg-crema"
                aria-label="Cerrar y corregir el número"
              >
                Corregir número
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = duplicateClient;
                  setDuplicateClient(null);
                  openEdit(target);
                }}
                className="flex-1 rounded-xl bg-ambar px-4 py-3 text-sm font-medium text-tinta transition-all hover:bg-ambar/90 focus:outline-none focus:ring-2 focus:ring-marea focus:ring-offset-2"
                aria-label="Ver el contacto existente"
              >
                Ver contacto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

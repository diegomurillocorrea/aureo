"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy } from "lucide-react";
import { AureoIsotipo } from "@/components/aureo-isotipo";
import { ServiceLogoLink } from "@/components/service-logo-link";
import {
  createPaymentAction,
  uploadPaymentProofAction,
} from "../../payments/actions";
import { usePermissions } from "../../permissions-provider";
import { useIsMobile } from "@/hooks/use-breakpoint";

const inputClassName =
  "w-full rounded-xl border border-marea/20 bg-crema px-4 py-3 text-tinta placeholder-marea/60 transition-all duration-200 focus:border-marea focus:outline-none focus:ring-2 focus:ring-marea/20 disabled:opacity-50      ";

const ALLOWED_PROOF_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];
const MAX_PROOF_BYTES = 5 * 1024 * 1024;

/**
 * Commission by total_amount (mirrors server computeCommission).
 * @param {number} totalAmount
 * @returns {number}
 */
function computeCommission(totalAmount) {
  const n = Number(totalAmount);
  if (Number.isNaN(n) || n < 0) return 0;
  if (n === 0) return 0;
  if (n === 0.5) return 0.25;
  if (n === 1) return 0.5;
  if (n < 50) return 1;
  return Math.floor(n / 50) + 1;
}

/**
 * @param {string} value
 * @returns {number}
 */
function parseCommissionValue(value) {
  if (value.trim() === "") return 0;
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Always show commission with two decimal places.
 * @param {number | string} value
 * @returns {string}
 */
function formatCommissionDecimals(value) {
  const n = typeof value === "number" ? value : parseCommissionValue(String(value ?? ""));
  if (Number.isNaN(n) || n < 0) return "0.00";
  return n.toFixed(2);
}

function getDefaultPaymentMethodId(methods) {
  const list = methods ?? [];
  const efectivo = list.find(
    (m) => (m?.name ?? "").trim().toLowerCase() === "efectivo"
  );
  return efectivo?.id ?? list[0]?.id ?? "";
}

function getServiceImageUrl(service) {
  if (!service?.image_bucket || !service?.image_path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/${service.image_bucket}/${service.image_path}`;
}

function getClientDisplayName(clients) {
  const client = Array.isArray(clients) ? clients[0] : clients;
  if (!client) return "Sin cliente";
  const fullName = [client.name, client.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return fullName || "Sin cliente";
}

function ServicePlaceholder({ className = "h-full w-full" }) {
  return (
    <div
      className={`flex items-center justify-center bg-bruma text-marea ${className}`}
      aria-hidden
    >
      <svg
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    </div>
  );
}

function CopyServiceNumberButton({ value }) {
  const [isCopied, setIsCopied] = useState(false);
  const label = isCopied ? "Número de servicio copiado" : "Copiar número de servicio";

  const handleClick = async () => {
    const text = (value ?? "").trim();
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 1500);
    } catch {
      setIsCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-marea transition-colors hover:bg-bruma hover:text-tinta focus:outline-none focus-visible:ring-2 focus-visible:ring-marea/50"
      aria-label={label}
      title={label}
    >
      {isCopied ? (
        <Check className="h-4 w-4 text-marea" aria-hidden />
      ) : (
        <Copy className="h-4 w-4" aria-hidden />
      )}
    </button>
  );
}

export function PaymentRegisterView({
  receipt,
  service,
  paymentMethods,
}) {
  const router = useRouter();
  const { can, isLoading: isPermissionsLoading } = usePermissions();
  const isMobile = useIsMobile();
  const amountId = useId();
  const commissionId = useId();
  const commissionSwitchId = useId();
  const methodId = useId();
  const proofId = useId();
  const proofInputRef = useRef(null);

  const canCreate = isPermissionsLoading || can("payments", "create");
  const canManageProof =
    isPermissionsLoading || can("payments", "manage_proof");

  const [amount, setAmount] = useState("");
  const [commission, setCommission] = useState("0.00");
  const [isCommissionEnabled, setIsCommissionEnabled] = useState(true);
  const [isCommissionManual, setIsCommissionManual] = useState(false);
  const [paymentMethodId, setPaymentMethodId] = useState(() =>
    getDefaultPaymentMethodId(paymentMethods)
  );
  const [proofFile, setProofFile] = useState(null);
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const serviceName = service?.name?.trim() || "Servicio";
  const serviceLink =
    typeof service?.link === "string" ? service.link.trim() : "";
  const serviceImageUrl = getServiceImageUrl(service);
  const clientLabel = getClientDisplayName(receipt?.clients);
  const accountNumber = (receipt?.account_receipt_number ?? "").trim();
  const isFormLocked = isSubmitting || isSuccess || !canCreate;
  const canEditCommission = isCommissionEnabled && !isFormLocked;

  const handleAmountChange = (event) => {
    const nextAmount = event.target.value;
    setAmount(nextAmount);
    setFormError(null);

    if (!isCommissionEnabled) {
      setCommission(formatCommissionDecimals(0));
      return;
    }

    if (nextAmount.trim() === "") {
      setCommission(formatCommissionDecimals(0));
      setIsCommissionManual(false);
      return;
    }

    const computed = computeCommission(Number(nextAmount));

    if (!isCommissionManual) {
      setCommission(formatCommissionDecimals(computed));
      return;
    }

    const current = parseCommissionValue(commission);
    if (computed > current) setCommission(formatCommissionDecimals(computed));
  };

  const handleCommissionChange = (event) => {
    setCommission(event.target.value);
    setIsCommissionManual(true);
    setFormError(null);
  };

  const handleCommissionBlur = () => {
    if (!isCommissionEnabled) {
      setCommission(formatCommissionDecimals(0));
      return;
    }
    setCommission(formatCommissionDecimals(commission));
  };

  const handleCommissionSwitchToggle = () => {
    if (isFormLocked) return;

    const nextEnabled = !isCommissionEnabled;
    setIsCommissionEnabled(nextEnabled);
    setFormError(null);

    if (!nextEnabled) {
      setCommission(formatCommissionDecimals(0));
      setIsCommissionManual(false);
      return;
    }

    if (amount.trim() === "") {
      setCommission(formatCommissionDecimals(0));
      setIsCommissionManual(false);
      return;
    }

    setCommission(formatCommissionDecimals(computeCommission(Number(amount))));
    setIsCommissionManual(false);
  };

  const handleMethodChange = (event) => {
    setPaymentMethodId(event.target.value);
    setFormError(null);
  };

  const handleProofChange = (event) => {
    const file = event.target.files?.[0] ?? null;
    setFormError(null);

    if (!file) {
      setProofFile(null);
      return;
    }

    if (!ALLOWED_PROOF_TYPES.includes(file.type)) {
      setProofFile(null);
      if (proofInputRef.current) proofInputRef.current.value = "";
      setFormError("Formato no válido. Usa JPG, PNG, GIF o WebP.");
      return;
    }

    if (file.size > MAX_PROOF_BYTES) {
      setProofFile(null);
      if (proofInputRef.current) proofInputRef.current.value = "";
      setFormError("La imagen no debe superar 5 MB.");
      return;
    }

    setProofFile(file);
  };

  const handleClearProof = () => {
    setProofFile(null);
    if (proofInputRef.current) proofInputRef.current.value = "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting || isSuccess) return;

    if (!canCreate) {
      setFormError("No tienes permiso para registrar pagos.");
      return;
    }

    const totalAmount = Number(amount);
    if (amount.trim() === "" || Number.isNaN(totalAmount) || totalAmount < 0) {
      setFormError("El monto debe ser cero o mayor.");
      return;
    }

    if (!paymentMethodId) {
      setFormError("El método de pago es requerido.");
      return;
    }

    const parsedCommission =
      commission.trim() === "" ? NaN : Number(commission);
    if (
      isCommissionEnabled &&
      (Number.isNaN(parsedCommission) || parsedCommission < 0)
    ) {
      setFormError("La comisión debe ser cero o mayor.");
      return;
    }

    if (proofFile && !canManageProof) {
      setFormError("No tienes permiso para subir comprobantes.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const createResult = await createPaymentAction({
      receipt_id: receipt.id,
      total_amount: totalAmount,
      payment_method_id: paymentMethodId,
      add_commission: isCommissionEnabled,
      custom_commission: isCommissionEnabled ? parsedCommission : null,
    });

    if (createResult.error) {
      setIsSubmitting(false);
      setFormError(createResult.error);
      return;
    }

    if (proofFile && createResult.id) {
      const formData = new FormData();
      formData.append("proof", proofFile);
      const uploadResult = await uploadPaymentProofAction(
        createResult.id,
        formData
      );
      if (uploadResult.error) {
        setIsSubmitting(false);
        setFormError(
          `Pago registrado, pero el comprobante no se pudo subir: ${uploadResult.error}`
        );
        setIsSuccess(true);
        return;
      }
    }

    setIsSubmitting(false);
    setIsSuccess(true);
    router.push("/payments");
    router.refresh();
  };

  return (
    <div className="relative flex w-full flex-1 flex-col px-1">
      <div className="flex flex-1 flex-col items-center justify-center py-16">
        <div
          className="mb-6 flex items-center justify-center gap-3 tablet:mb-8 tablet:gap-4"
          role="group"
          aria-label={`Aureo y ${serviceName}`}
        >
          <div className="flex h-[7.5rem] w-[7.5rem] shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-marea/20 bg-crema p-2.5 shadow-sm tablet:h-36 tablet:w-36 tablet:p-3">
            <AureoIsotipo
              width={144}
              height={144}
              priority
              className="h-full w-full object-contain"
            />
          </div>
          <ServiceLogoLink href={serviceLink} serviceName={serviceName}>
            {serviceImageUrl ? (
              <img
                src={serviceImageUrl}
                alt={`Logo de ${serviceName}`}
                className="h-full w-full object-contain p-2"
              />
            ) : (
              <ServicePlaceholder className="h-full w-full" />
            )}
          </ServiceLogoLink>
        </div>

        <div className="mb-6 w-full text-center">
          <h2 className="text-xl font-semibold tracking-tight text-tinta sm:text-2xl">
            {isMobile ? (
              <span className="flex flex-col items-center">
                <span>{clientLabel}</span>
                {accountNumber ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span>{accountNumber}</span>
                    <CopyServiceNumberButton value={accountNumber} />
                  </span>
                ) : null}
              </span>
            ) : (
              <span className="inline-flex items-center gap-x-1.5 whitespace-nowrap">
                <span>{clientLabel}</span>
                {accountNumber ? (
                  <>
                    <span aria-hidden>-</span>
                    <span>{accountNumber}</span>
                    <CopyServiceNumberButton value={accountNumber} />
                  </>
                ) : null}
              </span>
            )}
          </h2>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mx-auto w-full max-w-lg space-y-4"
          aria-label="Registrar pago"
          noValidate
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor={amountId}
                className="mb-1.5 block text-sm font-medium text-tinta"
              >
                Monto
              </label>
              <input
                id={amountId}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={amount}
                onChange={handleAmountChange}
                placeholder="0.00"
                required
                disabled={isSubmitting || isSuccess || !canCreate}
                className={inputClassName}
                aria-invalid={Boolean(formError)}
                aria-describedby={formError ? "payment-register-error" : undefined}
              />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label
                  htmlFor={commissionId}
                  className="block text-sm font-medium text-tinta"
                >
                  Comisión
                </label>
                <button
                  id={commissionSwitchId}
                  type="button"
                  role="switch"
                  aria-checked={isCommissionEnabled}
                  aria-label="Activar o desactivar comisión"
                  onClick={handleCommissionSwitchToggle}
                  disabled={isFormLocked}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-marea/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
 isCommissionEnabled
 ? "bg-ambar"
 : "bg-bruma "
 }`}
                >
                  <span
                    aria-hidden
                    className={`inline-block h-4 w-4 transform rounded-full bg-crema shadow transition-transform ${
 isCommissionEnabled ? "translate-x-6" : "translate-x-1"
 }`}
                  />
                </button>
              </div>
              <input
                id={commissionId}
                type="text"
                inputMode="decimal"
                value={commission}
                onChange={handleCommissionChange}
                onBlur={handleCommissionBlur}
                placeholder="0.00"
                disabled={!canEditCommission}
                className={inputClassName}
                aria-label="Comisión"
                aria-describedby={commissionSwitchId}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor={methodId}
                className="mb-1.5 block text-sm font-medium text-tinta"
              >
                Método de pago
              </label>
              <select
                id={methodId}
                value={paymentMethodId}
                onChange={handleMethodChange}
                required
                disabled={isSubmitting || isSuccess || !canCreate}
                className={inputClassName}
                aria-label="Método de pago"
              >
                <option value="" disabled>
                  Selecciona un método
                </option>
                {(paymentMethods ?? []).map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor={proofId}
                className="mb-1.5 block text-sm font-medium text-tinta"
              >
                Comprobante
              </label>
              {canManageProof ? (
                <div className="relative">
                  <input
                    ref={proofInputRef}
                    id={proofId}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleProofChange}
                    disabled={isSubmitting || isSuccess || !canCreate}
                    className="sr-only"
                    aria-label="Subir comprobante"
                  />
                  {proofFile ? (
                    <div
                      className={`${inputClassName} flex items-center gap-2 py-2.5`}
                    >
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {proofFile.name}
                      </span>
                      <button
                        type="button"
                        onClick={handleClearProof}
                        disabled={isSubmitting || isSuccess}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-marea transition-colors hover:bg-bruma hover:text-tinta focus:outline-none focus:ring-2 focus:ring-marea/50"
                        aria-label="Quitar comprobante"
                      >
                        <svg
                          className="h-4 w-4"
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
                  ) : (
                    <button
                      type="button"
                      onClick={() => proofInputRef.current?.click()}
                      disabled={isSubmitting || isSuccess || !canCreate}
                      className={`${inputClassName} flex items-center justify-center gap-2 text-sm font-medium text-marea hover:border-marea hover:text-tinta `}
                      aria-label="Subir comprobante"
                    >
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
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                        />
                      </svg>
                      Subir
                    </button>
                  )}
                </div>
              ) : (
                <div
                  className={`${inputClassName} flex items-center justify-center text-sm text-marea `}
                  role="status"
                  aria-label="Sin permiso para subir comprobante"
                >
                  —
                </div>
              )}
            </div>
          </div>

          {formError ? (
            <p
              id="payment-register-error"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              {formError}
            </p>
          ) : null}

          <div className="flex justify-center pt-2">
            <button
              type="submit"
              disabled={isSubmitting || isSuccess || !canCreate}
              className="inline-flex h-12 min-w-[10rem] items-center justify-center rounded-xl bg-ambar px-6 text-sm font-semibold text-tinta transition-colors hover:bg-ambar focus:outline-none focus:ring-2 focus:ring-marea/50 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              aria-busy={isSubmitting}
            >
              {isSubmitting ? "Registrando…" : "Registrar pago"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function PaymentRegisterViewSkeleton() {
  return (
    <div
      className="relative mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-1 py-16"
      aria-busy="true"
      aria-live="polite"
    >
      <p className="sr-only">Cargando registro de pago…</p>
      <div className="mb-6 flex items-center justify-center gap-3 tablet:mb-8 tablet:gap-4">
        <div className="h-[7.5rem] w-[7.5rem] animate-pulse rounded-2xl bg-bruma tablet:h-36 tablet:w-36" />
        <div className="h-[7.5rem] w-[7.5rem] animate-pulse rounded-2xl bg-bruma tablet:h-36 tablet:w-36" />
      </div>
      <div className="mb-6 h-6 w-56 max-w-full animate-pulse rounded-lg bg-bruma" />
      <div className="grid w-full grid-cols-2 gap-3">
        <div className="h-12 animate-pulse rounded-xl bg-bruma" />
        <div className="h-12 animate-pulse rounded-xl bg-bruma" />
        <div className="h-12 animate-pulse rounded-xl bg-bruma" />
        <div className="h-12 animate-pulse rounded-xl bg-bruma" />
      </div>
      <div className="mt-6 h-12 w-40 animate-pulse rounded-xl bg-bruma" />
    </div>
  );
}

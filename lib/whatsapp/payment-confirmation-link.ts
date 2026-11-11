import { CLIENT_PHONE_COUNTRIES } from "@/lib/phone";

function isStoredClientPhoneWithCountryCode(digits: string): boolean {
  return CLIENT_PHONE_COUNTRIES.some(
    (country) =>
      digits.startsWith(country.callingCode) &&
      digits.length === country.callingCode.length + country.localLength,
  );
}

/**
 * Converts a stored/international number to WhatsApp's digits-only format.
 * Accepts +E.164, 00-prefix, or app-stored digits with country code (SV/US).
 */
export function normalizeWhatsAppPhoneNumber(
  value: string | null | undefined,
): string | null {
  const input = value?.trim() ?? "";
  if (!input) return null;

  if (!/^(?:\+|00)?[0-9()\s.-]+$/.test(input)) return null;

  const digits = input.replace(/\D/g, "");
  if (!digits) return null;

  let normalized = digits;
  if (input.startsWith("00")) {
    normalized = digits.slice(2);
  } else if (input.startsWith("+")) {
    normalized = digits;
  } else if (isStoredClientPhoneWithCountryCode(digits)) {
    // Stored app format: 503XXXXXXXX or 1XXXXXXXXXX (no leading +).
    normalized = digits;
  } else {
    // Local numbers without country code are rejected so we never guess.
    return null;
  }

  // E.164 allows up to 15 digits and a country calling code cannot begin with 0.
  if (!/^[1-9]\d{6,14}$/.test(normalized)) return null;
  return normalized;
}

type PaymentClient = {
  name?: string | null;
  last_name?: string | null;
  phone_number?: string | null;
};

type PaymentService = {
  name?: string | null;
};

type PaymentReceipt = {
  account_receipt_number?: string | null;
  clients?: PaymentClient | PaymentClient[] | null;
  services?: PaymentService | PaymentService[] | null;
  client?: PaymentClient | PaymentClient[] | null;
  service?: PaymentService | PaymentService[] | null;
};

export type PaymentConfirmationSource = {
  total_amount?: number | string | null;
  commission?: number | string | null;
  receipt?: PaymentReceipt | PaymentReceipt[] | null;
  receipts?: PaymentReceipt | PaymentReceipt[] | null;
};

export type BuildPaymentConfirmationUrlResult =
  | { url: string; error?: undefined }
  | { url?: undefined; error: string };

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function requiredText(value: string | null | undefined): string | null {
  const text = value?.replace(/\s+/g, " ").trim() ?? "";
  return text && text.length <= 512 ? text : null;
}

function formatMoney(value: number | string | null | undefined): string | null {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return amount.toFixed(2);
}

function formatTotal(
  amount: number | string | null | undefined,
  commission: number | string | null | undefined,
): string | null {
  const parsedAmount = Number(amount);
  const parsedCommission = Number(commission);
  if (!Number.isFinite(parsedAmount) || parsedAmount < 0) return null;
  if (!Number.isFinite(parsedCommission) || parsedCommission < 0) return null;
  return (parsedAmount + parsedCommission).toFixed(2);
}

function buildConfirmationMessage(params: {
  clientName: string;
  serviceName: string;
  serviceNumber: string;
  formattedAmount: string;
  formattedCommission: string;
  formattedTotal: string;
}): string {
  return [
    `Hola ${params.clientName}.`,
    "",
    `El pago de tu servicio de ${params.serviceName}, identificado con el número ${params.serviceNumber}, se ha efectuado con éxito.`,
    "",
    `Monto: $${params.formattedAmount}`,
    `Comisión: $${params.formattedCommission}`,
    `Total: $${params.formattedTotal}`,
    "",
    "Gracias por confiar en nosotros.",
    "DAIEGO Receipts",
  ].join("\n");
}

/**
 * Builds a wa.me URL with a prefilled payment confirmation message.
 * Does not open the link; returns an error when payment data is incomplete.
 */
export function buildPaymentConfirmationUrl(
  payment: PaymentConfirmationSource | null | undefined,
): BuildPaymentConfirmationUrlResult {
  const receipt = one(payment?.receipt ?? payment?.receipts);
  const client = one(receipt?.clients ?? receipt?.client);
  const service = one(receipt?.services ?? receipt?.service);

  const serviceNumber = requiredText(receipt?.account_receipt_number);
  if (!serviceNumber) {
    return { error: "El pago no tiene un número de servicio configurado." };
  }

  const serviceName = requiredText(service?.name);
  if (!serviceName) {
    return { error: "El pago no tiene un nombre de servicio configurado." };
  }

  const formattedCommission = formatMoney(payment?.commission);
  if (payment?.commission == null || !formattedCommission) {
    return { error: "El pago no tiene una comisión válida configurada." };
  }

  const clientName = requiredText(
    [client?.name, client?.last_name].filter(Boolean).join(" "),
  );
  const formattedAmount = formatMoney(payment?.total_amount);
  const formattedTotal = formatTotal(payment?.total_amount, payment?.commission);
  if (!clientName || !formattedAmount || !formattedTotal) {
    return {
      error:
        "El pago no tiene la información necesaria para enviar la confirmación.",
    };
  }

  const phoneNumber = normalizeWhatsAppPhoneNumber(client?.phone_number);
  if (!phoneNumber) {
    return {
      error:
        "El cliente necesita un número de WhatsApp válido (por ejemplo, 50370000000).",
    };
  }

  const message = buildConfirmationMessage({
    clientName,
    serviceName,
    serviceNumber,
    formattedAmount,
    formattedCommission,
    formattedTotal,
  });

  return {
    url: `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`,
  };
}

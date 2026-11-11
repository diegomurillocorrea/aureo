/**
 * @typedef {"SV" | "US"} ClientPhoneCountryCode
 */

/**
 * @typedef {Object} ClientPhoneCountryConfig
 * @property {ClientPhoneCountryCode} code
 * @property {string} callingCode
 * @property {number} localLength
 * @property {string} label
 */

/** @type {ClientPhoneCountryConfig[]} */
export const CLIENT_PHONE_COUNTRIES = [
  {
    code: "SV",
    callingCode: "503",
    localLength: 8,
    label: "El Salvador",
  },
  {
    code: "US",
    callingCode: "1",
    localLength: 10,
    label: "Estados Unidos",
  },
];

const CLIENT_PHONE_COUNTRY_BY_CODE = Object.fromEntries(
  CLIENT_PHONE_COUNTRIES.map((country) => [country.code, country])
);

/**
 * @param {string | null | undefined} code
 * @returns {ClientPhoneCountryConfig | null}
 */
export function getClientPhoneCountryConfig(code) {
  if (!code) return null;
  return CLIENT_PHONE_COUNTRY_BY_CODE[code] ?? null;
}

/**
 * Detect country from a stored phone (digits with country calling code, no +).
 * @param {string | null | undefined} storedPhone
 * @returns {ClientPhoneCountryCode}
 */
export function detectClientPhoneCountry(storedPhone) {
  const digits = (storedPhone ?? "").replace(/\D/g, "");
  if (digits.startsWith("503") && digits.length === 11) return "SV";
  if (digits.startsWith("1") && digits.length === 11) return "US";
  return "SV";
}

/**
 * Local digits only for the phone input, stripping the detected country prefix.
 * @param {string | null | undefined} storedPhone
 * @returns {string}
 */
export function toLocalClientPhoneInput(storedPhone) {
  const digits = (storedPhone ?? "").replace(/\D/g, "");
  if (!digits) return "";

  const country = getClientPhoneCountryConfig(detectClientPhoneCountry(storedPhone));
  if (!country) return digits;

  if (
    digits.startsWith(country.callingCode) &&
    digits.length === country.callingCode.length + country.localLength
  ) {
    return digits.slice(country.callingCode.length);
  }

  return digits.slice(-country.localLength);
}

/**
 * Format local digits while typing.
 * SV: xxxx xxxx · US: xxx xxx xxxx
 * @param {string | null | undefined} localDigits
 * @param {ClientPhoneCountryCode | string | null | undefined} countryCode
 * @returns {string}
 */
export function formatLocalClientPhoneInput(localDigits, countryCode = "SV") {
  const country = getClientPhoneCountryConfig(countryCode) ?? CLIENT_PHONE_COUNTRY_BY_CODE.SV;
  const clean = (localDigits ?? "").replace(/\D/g, "").slice(0, country.localLength);

  if (country.code === "US") {
    if (clean.length <= 3) return clean;
    if (clean.length <= 6) return `${clean.slice(0, 3)} ${clean.slice(3)}`;
    return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6)}`;
  }

  if (clean.length <= 4) return clean;
  return `${clean.slice(0, 4)} ${clean.slice(4)}`;
}

/**
 * Format a stored phone for UI display.
 * SV: +503 xxxx xxxx · US: +1 xxx xxx xxxx
 * @param {string | null | undefined} storedPhone
 * @returns {string}
 */
export function formatClientPhoneDisplay(storedPhone) {
  const digits = (storedPhone ?? "").replace(/\D/g, "");
  if (!digits) return "";

  const countryCode = detectClientPhoneCountry(storedPhone);
  const country = getClientPhoneCountryConfig(countryCode);
  if (!country) return `+${digits}`;

  const localDigits =
    digits.startsWith(country.callingCode) &&
    digits.length === country.callingCode.length + country.localLength
      ? digits.slice(country.callingCode.length)
      : digits;

  if (localDigits.length !== country.localLength) {
    return `+${country.callingCode} ${localDigits}`;
  }

  if (country.code === "US") {
    return `+${country.callingCode} ${localDigits.slice(0, 3)} ${localDigits.slice(3, 6)} ${localDigits.slice(6)}`;
  }

  return `+${country.callingCode} ${localDigits.slice(0, 4)} ${localDigits.slice(4)}`;
}

/**
 * Extract local digits from typed/pasted input for the selected country.
 * Strips a leading country calling code when the paste includes it
 * (e.g. US `13015550123` → `3015550123`).
 * @param {string | null | undefined} value
 * @param {ClientPhoneCountryCode | string | null | undefined} countryCode
 * @returns {string}
 */
export function extractLocalClientPhoneDigits(value, countryCode = "SV") {
  const country = getClientPhoneCountryConfig(countryCode) ?? CLIENT_PHONE_COUNTRY_BY_CODE.SV;
  let digits = (value ?? "").replace(/\D/g, "");
  if (!digits) return "";

  const fullLength = country.callingCode.length + country.localLength;
  if (
    digits.startsWith(country.callingCode) &&
    digits.length >= fullLength
  ) {
    digits = digits.slice(country.callingCode.length);
  } else if (
    country.code === "US" &&
    digits.startsWith(country.callingCode) &&
    digits.length > country.callingCode.length &&
    digits.length <= country.localLength
  ) {
    // Paste kept the leading "1" but lost the last local digit via truncation.
    digits = digits.slice(country.callingCode.length);
  }

  return digits.slice(0, country.localLength);
}

/**
 * Normalize client phone input to stored digits with country calling code.
 * @param {string | null | undefined} value
 * @param {ClientPhoneCountryCode | string | null | undefined} countryCode
 * @returns {{ phone: string | null; error: string | null }}
 */
export function normalizeClientPhoneNumber(value, countryCode) {
  const input = value?.trim() ?? "";
  if (!input) return { phone: null, error: null };

  const country = getClientPhoneCountryConfig(countryCode);
  if (!country) {
    return { phone: null, error: "El país del teléfono no es válido." };
  }

  const digits = input.replace(/\D/g, "");
  if (!digits) return { phone: null, error: null };

  const localDigits = extractLocalClientPhoneDigits(digits, country.code);
  if (!localDigits) return { phone: null, error: null };

  // US NANP national numbers cannot start with 0 or 1.
  if (country.code === "US" && /^[01]/.test(localDigits)) {
    return {
      phone: null,
      error:
        "El teléfono de Estados Unidos debe tener 10 dígitos y no incluir el código de país (+1).",
    };
  }

  if (localDigits.length !== country.localLength) {
    if (country.code === "US") {
      return {
        phone: null,
        error: "El teléfono debe tener 10 dígitos (Estados Unidos).",
      };
    }
    return {
      phone: null,
      error: "El teléfono debe tener 8 dígitos (El Salvador).",
    };
  }

  return { phone: `${country.callingCode}${localDigits}`, error: null };
}

/**
 * @deprecated Use formatClientPhoneDisplay
 * @param {string | null | undefined} phone
 * @returns {string}
 */
export function formatElSalvadorPhoneDisplay(phone) {
  return formatClientPhoneDisplay(phone);
}

/**
 * @deprecated Use formatLocalClientPhoneInput
 * @param {string | null | undefined} digits
 * @returns {string}
 */
export function formatLocalElSalvadorPhoneInput(digits) {
  return formatLocalClientPhoneInput(digits, "SV");
}

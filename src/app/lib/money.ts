export type ValidationResult = { valid: true; value: number } | { valid: false; message: string };

export const LIMITS = {
  precoPago: [1, 9_999_999],
  quantidadeUnidades: [1, 100_000],
  quilosLitros: [0.01, 10_000],
  gramasMl: [1, 10_000],
  perda: [0, 50],
  taxaMaquininha: [0, 15],
  reserva: [0, 50],
  vendasDia: [1, 10_000],
  diasSemana: [1, 7],
  gastoItemDia: [0, 999_999],
  ganhoDesejadoDia: [0, 999_999],
  fatiaDia: [1, 100],
} as const;

export function parseDecimal(raw: string): number | null {
  const value = raw.trim().replace(/\s/g, "");
  if (!value || /[eE+-]/.test(value)) return null;
  const normalized = value.includes(",")
    ? value.replace(/\./g, "").replace(",", ".")
    : value;
  if (!/^\d*(?:\.\d*)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function parseMoneyToCents(raw: string): number | null {
  const parsed = parseDecimal(raw.replace(/^R\$\s?/, ""));
  return parsed === null ? null : Math.round(parsed * 100);
}

export function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function validateRange(value: number | null, min: number, max: number, label: string): ValidationResult {
  if (value === null) return { valid: false, message: `Digite ${label}.` };
  if (value < min || value > max) return { valid: false, message: `Use um valor entre ${min.toLocaleString("pt-BR")} e ${max.toLocaleString("pt-BR")}.` };
  return { valid: true, value };
}

export function validateMoney(raw: string, kind: "precoPago" | "gastoItemDia" | "ganhoDesejadoDia"): ValidationResult {
  const cents = parseMoneyToCents(raw);
  const [min, max] = LIMITS[kind];
  if (cents === null) return { valid: false, message: "Digite um valor em reais." };
  if (cents < min || cents > max) {
    return { valid: false, message: `Use um valor entre ${formatMoney(min)} e ${formatMoney(max)}.` };
  }
  return { valid: true, value: cents };
}

export function validateNumber(raw: string, kind: Exclude<keyof typeof LIMITS, "precoPago" | "gastoItemDia" | "ganhoDesejadoDia">, integer = false): ValidationResult {
  const parsed = parseDecimal(raw);
  const [min, max] = LIMITS[kind];
  const result = validateRange(parsed, min, max, "um número");
  if (result.valid && integer && !Number.isInteger(result.value)) {
    return { valid: false, message: "Use um número inteiro, sem vírgula." };
  }
  return result;
}

export function sanitizeNumericInput(raw: string): string {
  return raw.replace(/[^\d.,]/g, "").slice(0, 16);
}

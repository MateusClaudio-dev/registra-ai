import { calculatePricing, calcularGastosDoDia } from "./pricing";
import type { PricingInput, PricingOutcome } from "./pricing";
import { parseDecimal, parseMoneyToCents } from "./money";
import type { AppState } from "./storage";

export type BuyType = "unit" | "package" | "kg" | "sack" | "liter" | "recipe" | "";
export type SellType = "unit" | "portion" | "kg" | "liter" | "";
export type YieldMode = "measure" | "direct";
export type Payment = "cash" | "pix" | "machine-pix" | "debit" | "credit";

export interface ProductDraft {
  id: string;
  name: string;
  emoji: string;
  buyType: BuyType;
  price: string;
  buyQuantity: string;
  sellType: SellType;
  yieldMode: YieldMode;
  portionSize: string;
  directYield: string;
  loss: string;
  packaging: boolean | null;
  packagingCost: string;
  salesDay: string;
  dayShare: string;
  payments: Payment[];
  machineShare: string;
  machineFee: string;
  reserve: string;
}


export function getYield(draft: ProductDraft): number {
  const quantity = parseDecimal(draft.buyQuantity) ?? 0;
  const portion = parseDecimal(draft.portionSize) ?? 0;
  const direct = parseDecimal(draft.directYield) ?? 0;
  if (draft.buyType === "unit" && draft.sellType === "unit") return 1;
  if (draft.buyType === "package" && draft.sellType === "unit") return quantity;
  if ((draft.buyType === "kg" || draft.buyType === "sack") && draft.sellType === "kg") return draft.buyType === "kg" ? 1 : quantity;
  if ((draft.buyType === "kg" || draft.buyType === "sack") && (draft.sellType === "portion" || draft.sellType === "unit")) {
    if (draft.yieldMode === "direct") return direct;
    const totalKg = draft.buyType === "kg" ? 1 : quantity;
    return portion > 0 ? totalKg * 1000 / portion : 0;
  }
  if (draft.buyType === "liter" && draft.sellType === "liter") return quantity;
  if (draft.buyType === "liter" && draft.sellType === "portion") {
    if (draft.yieldMode === "direct") return direct;
    return portion > 0 ? quantity * 1000 / portion : 0;
  }
  if (draft.buyType === "recipe" && (draft.sellType === "unit" || draft.sellType === "portion")) return quantity;
  return direct;
}


export function buildPricingInput(draft: ProductDraft, state: AppState): PricingInput {
  const machineUsed = draft.payments.some((item) => item === "machine-pix" || item === "debit" || item === "credit");
  const part = machineUsed ? (parseDecimal(draft.machineShare) ?? 0) / 100 : 0;
  const fee = machineUsed ? (parseDecimal(draft.machineFee) ?? 0) / 100 : 0;
  return {
    precoCompraCentavos: parseMoneyToCents(draft.price) ?? 0,
    rendimento: getYield(draft),
    perda: (parseDecimal(draft.loss) ?? 0) / 100,
    embalagemUnCentavos: draft.packaging ? parseMoneyToCents(draft.packagingCost) ?? 0 : 0,
    vendasDia: parseDecimal(draft.salesDay) ?? 0,
    fatia: (parseDecimal(draft.dayShare) ?? 0) / 100,
    taxaMedia: part * fee,
    reserva: (parseDecimal(draft.reserve) ?? 0) / 100,
    gastosDiaCentavos: state.meuDia.preenchido ? calcularGastosDoDia(state.meuDia) : 0,
    ganhoDesejadoDiaCentavos: state.meuDia.preenchido ? state.meuDia.ganhoDesejadoCentavos : 0,
    passoArredondamentoCentavos: state.ajustes.arredondamentoCentavos,
  };
}

export function buildResult(draft: ProductDraft, state: AppState): PricingOutcome {
  return calculatePricing(buildPricingInput(draft, state));
}


/**
 * Recalcula o preço salvo de cada produto com o "Meu dia" e o arredondamento atuais.
 * Assim a lista e o texto compartilhado nunca mostram um preço velho depois que o dia muda.
 * Devolve o mesmo array se nada mudou (evita re-render em loop).
 */
export function recomputeSavedPrices(state: AppState): AppState["produtos"] {
  let changed = false;
  const next = state.produtos.map((item) => {
    if (!item.dados) return item;
    const outcome = buildResult(item.dados as unknown as ProductDraft, state);
    if (!outcome.ok || outcome.value.precoFacilCentavos === item.precoCentavos) return item;
    changed = true;
    return { ...item, precoCentavos: outcome.value.precoFacilCentavos };
  });
  return changed ? next : state.produtos;
}

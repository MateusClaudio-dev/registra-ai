export const STORAGE_KEY = "gerencia-ai:v1";

export type TextSize = "normal" | "grande" | "gigante";
export type RoundStep = 10 | 50 | 100;

export interface ToggleMoney {
  ativo: boolean;
  valorCentavos: number;
}

export interface MeuDia {
  preenchido: boolean;
  diasSemana: number;
  compras: { ativo: boolean; valorPorIdaCentavos: number; diasDuracao: number };
  chegarAoPonto: ToggleMoney;
  operacao: ToggleMoney;
  ajudante: ToggleMoney;
  pontoTaxa: ToggleMoney & { periodo: "dia" | "mes" };
  outro: ToggleMoney & { nome: string };
  ganhoDesejadoCentavos: number;
  cobrirApenas: boolean;
}

export interface Ajustes {
  tamanhoTexto: TextSize;
  modoEscuro: boolean;
  altoContraste: boolean;
  arredondamentoCentavos: RoundStep;
}

export interface SavedProduct {
  id: string;
  nome: string;
  precoCentavos: number;
  atualizadoEm: string;
  fatiaDia?: number;
  dados?: Record<string, unknown>;
}

export interface DadosTeste {
  primeiroQuizEm?: string;
  primeiroResultadoEm?: string;
  entendeuPreco?: "sim" | "mais-ou-menos" | "nao";
}

export interface AppState {
  versao: 1;
  meuDia: MeuDia;
  produtos: SavedProduct[];
  ajustes: Ajustes;
  rascunho: Record<string, unknown>;
  dadosTeste: DadosTeste;
}

let memoryFallback: AppState | null = null;

export function defaultState(): AppState {
  return {
    versao: 1,
    meuDia: {
      preenchido: false,
      diasSemana: 6,
      compras: { ativo: false, valorPorIdaCentavos: 0, diasDuracao: 1 },
      chegarAoPonto: { ativo: false, valorCentavos: 0 },
      operacao: { ativo: false, valorCentavos: 0 },
      ajudante: { ativo: false, valorCentavos: 0 },
      pontoTaxa: { ativo: false, valorCentavos: 0, periodo: "dia" },
      outro: { ativo: false, valorCentavos: 0, nome: "" },
      ganhoDesejadoCentavos: 0,
      cobrirApenas: false,
    },
    produtos: [],
    ajustes: {
      tamanhoTexto: "normal",
      modoEscuro: false,
      altoContraste: false,
      arredondamentoCentavos: 50,
    },
    rascunho: {},
    dadosTeste: {},
  };
}

function isV1(value: unknown): value is AppState {
  return Boolean(value && typeof value === "object" && (value as AppState).versao === 1);
}

export function loadState(): AppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return memoryFallback ?? defaultState();
    const parsed: unknown = JSON.parse(raw);
    if (!isV1(parsed)) return defaultState();
    const base = defaultState();
    return {
      ...base,
      ...parsed,
      meuDia: { ...base.meuDia, ...parsed.meuDia },
      ajustes: { ...base.ajustes, ...parsed.ajustes },
      produtos: Array.isArray(parsed.produtos) ? parsed.produtos : [],
      rascunho: parsed.rascunho ?? {},
      dadosTeste: parsed.dadosTeste ?? {},
    };
  } catch {
    return memoryFallback ?? defaultState();
  }
}

export function saveState(state: AppState): void {
  memoryFallback = state;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // O estado continua disponível em memória nesta sessão.
  }
}

export function upsertProduct(products: SavedProduct[], product: SavedProduct): SavedProduct[] {
  const index = products.findIndex((item) => item.id === product.id);
  if (index === -1) return [...products, product];
  return products.map((item) => item.id === product.id ? product : item);
}

export function clearStoredState(): AppState {
  const fresh = defaultState();
  memoryFallback = fresh;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // O fallback em memória já foi limpo.
  }
  return fresh;
}

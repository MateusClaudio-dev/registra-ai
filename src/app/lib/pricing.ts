import type { MeuDia } from "./storage";

export interface PricingInput {
  precoCompraCentavos: number;
  rendimento: number;
  perda: number;
  embalagemUnCentavos: number;
  vendasDia: number;
  fatia: number;
  taxaMedia: number;
  reserva: number;
  gastosDiaCentavos: number;
  ganhoDesejadoDiaCentavos: number;
  passoArredondamentoCentavos: 10 | 50 | 100;
}

export interface PricingResult {
  custoProdutoUnCentavos: number;
  custoVariavelUnCentavos: number;
  gastoDiaUnCentavos: number;
  ganhoUnCentavos: number;
  precoMinimoCentavos: number;
  precoRecomendadoCentavos: number;
  precoFacilCentavos: number;
  margemPorUnCentavos: number;
  metaCobrirGastos: number | null;
  metaFecharDia: number | null;
  avisoMeta?: string;
  raioX: {
    produto: number;
    perdas: number;
    embalagem: number;
    gastosDia: number;
    taxa: number;
    seuGanho: number;
    reserva: number;
    arredondamento: number;
  };
}

export type PricingOutcome = { ok: true; value: PricingResult } | { ok: false; error: string };

export function roundUpToStep(valueCentavos: number, stepCentavos: number): number {
  const roundedCent = Math.ceil(valueCentavos - 1e-9);
  return Math.ceil(roundedCent / stepCentavos) * stepCentavos;
}

export function calculatePricing(input: PricingInput): PricingOutcome {
  const divisor = 1 - input.taxaMedia - input.reserva;
  if (divisor <= 0.05) {
    return { ok: false, error: "A taxa e a reserva ficaram altas demais. Diminua um dos valores para fazer a conta." };
  }
  if (input.rendimento <= 0 || input.vendasDia <= 0 || 1 - input.perda <= 0) {
    return { ok: false, error: "Confira o rendimento, as vendas e a perda antes de continuar." };
  }

  const custoSemPerda = input.precoCompraCentavos / input.rendimento;
  const custoProduto = custoSemPerda / (1 - input.perda);
  const perdas = custoProduto - custoSemPerda;
  const custoVariavel = custoProduto + input.embalagemUnCentavos;
  const gastosProduto = input.gastosDiaCentavos * input.fatia;
  const ganhoProduto = input.ganhoDesejadoDiaCentavos * input.fatia;
  const gastoDiaUn = gastosProduto / input.vendasDia;
  const ganhoUn = ganhoProduto / input.vendasDia;
  const precoMinimoExato = (custoVariavel + gastoDiaUn) / (1 - input.taxaMedia);
  const precoRecomendadoExato = (custoVariavel + gastoDiaUn + ganhoUn) / divisor;
  const precoFacil = roundUpToStep(precoRecomendadoExato, input.passoArredondamentoCentavos);
  const margem = precoRecomendadoExato * (1 - input.taxaMedia) - custoVariavel;

  let metaCobrir: number | null = null;
  let metaFechar: number | null = null;
  let avisoMeta: string | undefined;
  if (margem <= 0.000001) {
    avisoMeta = "Com esse preço você não ganha nada em cada venda.";
  } else {
    metaCobrir = Math.ceil(gastosProduto / margem);
    metaFechar = Math.ceil((gastosProduto + ganhoProduto) / margem);
    if (metaCobrir > 999 || metaFechar > 999) {
      avisoMeta = "A meta ficou em mais de 999. Com esses números, a conta não fecha.";
    }
  }

  return {
    ok: true,
    value: {
      custoProdutoUnCentavos: custoProduto,
      custoVariavelUnCentavos: custoVariavel,
      gastoDiaUnCentavos: gastoDiaUn,
      ganhoUnCentavos: ganhoUn,
      precoMinimoCentavos: Math.ceil(precoMinimoExato - 1e-9),
      precoRecomendadoCentavos: Math.ceil(precoRecomendadoExato - 1e-9),
      precoFacilCentavos: precoFacil,
      margemPorUnCentavos: margem,
      metaCobrirGastos: metaCobrir,
      metaFecharDia: metaFechar,
      avisoMeta,
      raioX: {
        produto: custoSemPerda,
        perdas,
        embalagem: input.embalagemUnCentavos,
        gastosDia: gastoDiaUn,
        taxa: precoRecomendadoExato * input.taxaMedia,
        seuGanho: ganhoUn,
        reserva: precoRecomendadoExato * input.reserva,
        arredondamento: precoFacil - precoRecomendadoExato,
      },
    },
  };
}

export function calcularGastosDoDia(meuDia: MeuDia): number {
  const compras = meuDia.compras.ativo
    ? meuDia.compras.valorPorIdaCentavos / Math.max(1, meuDia.compras.diasDuracao)
    : 0;
  const pontoTaxa = meuDia.pontoTaxa.ativo
    ? meuDia.pontoTaxa.periodo === "mes"
      ? meuDia.pontoTaxa.valorCentavos / Math.max(1, meuDia.diasSemana * 4.33)
      : meuDia.pontoTaxa.valorCentavos
    : 0;
  return (
    compras +
    (meuDia.chegarAoPonto.ativo ? meuDia.chegarAoPonto.valorCentavos : 0) +
    (meuDia.operacao.ativo ? meuDia.operacao.valorCentavos : 0) +
    (meuDia.ajudante.ativo ? meuDia.ajudante.valorCentavos : 0) +
    pontoTaxa +
    (meuDia.outro.ativo ? meuDia.outro.valorCentavos : 0)
  );
}

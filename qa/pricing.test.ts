import { calculatePricing, calcularGastosDoDia } from "../src/app/lib/pricing";
import { parseDecimal, parseMoneyToCents, validateMoney, validateNumber } from "../src/app/lib/money";
import { defaultState } from "../src/app/lib/storage";

let fails = 0;
const ok = (name: string, cond: boolean, extra = "") => { console.log((cond ? "OK    " : "FALHOU") + " " + name + (extra ? "  " + extra : "")); if (!cond) fails++; };

const base = { precoCompraCentavos: 4000, rendimento: 12, perda: 0.05, embalagemUnCentavos: 10, gastosDiaCentavos: 1900, vendasDia: 60, ganhoDesejadoDiaCentavos: 10000, fatia: 1, taxaMedia: 0.015, reserva: 0.1, passoArredondamentoCentavos: 50 as const };
const a = calculatePricing(base);
if (!a.ok) throw new Error(a.error);
ok("A custoVariavelUn ~360,88", Math.abs(a.value.custoVariavelUnCentavos - 360.88) < 0.02, String(a.value.custoVariavelUnCentavos));
ok("A minimo 399", a.value.precoMinimoCentavos === 399, String(a.value.precoMinimoCentavos));
ok("A recomendado 632", a.value.precoRecomendadoCentavos === 632, String(a.value.precoRecomendadoCentavos));
ok("A facil 650", a.value.precoFacilCentavos === 650);
ok("A metas 8 e 46", a.value.metaCobrirGastos === 8 && a.value.metaFecharDia === 46, `${a.value.metaCobrirGastos}/${a.value.metaFecharDia}`);
const rx = a.value.raioX; const soma = rx.produto + rx.perdas + rx.embalagem + rx.gastosDia + rx.taxa + rx.seuGanho + rx.reserva + rx.arredondamento;
ok("A Raio-X soma = preço fácil", Math.abs(soma - a.value.precoFacilCentavos) < 0.01, `${soma.toFixed(3)} vs ${a.value.precoFacilCentavos}`);

const b = calculatePricing({ ...base, precoCompraCentavos: 10000, rendimento: 80, perda: 0.1, embalagemUnCentavos: 0, gastosDiaCentavos: 0, vendasDia: 1, ganhoDesejadoDiaCentavos: 0, taxaMedia: 0, reserva: 0 });
if (!b.ok) throw new Error(b.error);
ok("B 139/139/150 sem meta", b.value.precoMinimoCentavos === 139 && b.value.precoRecomendadoCentavos === 139 && b.value.precoFacilCentavos === 150 && b.value.metaCobrirGastos === null);

// bordas
ok("erro taxa+reserva >= 95%", !calculatePricing({ ...base, taxaMedia: 0.5, reserva: 0.46 }).ok);
ok("erro perda 100%", !calculatePricing({ ...base, perda: 1 }).ok);
ok("erro rendimento 0", !calculatePricing({ ...base, rendimento: 0 }).ok);
ok("erro vendas 0", !calculatePricing({ ...base, vendasDia: 0 }).ok);
for (const step of [10, 50, 100] as const) { const r = calculatePricing({ ...base, passoArredondamentoCentavos: step }); ok(`passo ${step}: facil múltiplo e >= recomendado`, r.ok && r.value.precoFacilCentavos % step === 0 && r.value.precoFacilCentavos >= r.value.precoRecomendadoCentavos - 0.001); }
// fatia: dois produtos com 50% cada devem somar o mesmo gasto do dia de um produto a 100%
const full = calculatePricing(base); const half = calculatePricing({ ...base, fatia: 0.5, vendasDia: 30 });
ok("fatia 50% com metade das vendas = mesmo preço", full.ok && half.ok && Math.abs(full.value.precoRecomendadoCentavos - half.value.precoRecomendadoCentavos) <= 1);
// preço fácil já inteiro não sobe
const exact = calculatePricing({ ...base, precoCompraCentavos: 0, embalagemUnCentavos: 100, gastosDiaCentavos: 0, ganhoDesejadoDiaCentavos: 0, taxaMedia: 0, reserva: 0, perda: 0, rendimento: 1 });
ok("custo 1,00 exato, passo 0,50 => 1,00", exact.ok && exact.value.precoFacilCentavos === 100, exact.ok ? String(exact.value.precoFacilCentavos) : "");
// meta absurda
ok("invariante: meta de fechar o dia <= vendas por dia", a.value.metaFecharDia! <= base.vendasDia, String(a.value.metaFecharDia));
const gastoAlto = calculatePricing({ ...base, gastosDiaCentavos: 900000 });
ok("gasto alto continua calculando e meta <= vendas", gastoAlto.ok && gastoAlto.value.metaFecharDia! <= base.vendasDia);
const m = validateMoney("100000", "precoPago");
ok("mensagem de limite em REAIS (não centavos)", !m.valid && m.message.includes("R$") && m.message.includes("99.999,99"), !m.valid ? m.message : "");
const g2 = validateMoney("10000", "gastoItemDia");
ok("limite de gasto: mensagem em reais", !g2.valid && g2.message.includes("9.999,99"), !g2.valid ? g2.message : "");

// money
ok("parse '1.234,56' = 1234.56", parseDecimal("1.234,56") === 1234.56);
ok("parse '12,5' = 12.5", parseDecimal("12,5") === 12.5);
ok("parse '1e5' null", parseDecimal("1e5") === null);
ok("parse '-3' null", parseDecimal("-3") === null);
ok("cents '40,00' = 4000", parseMoneyToCents("40,00") === 4000);
ok("cents '0,10' = 10", parseMoneyToCents("0,10") === 10);
ok("preço pago 0 inválido", !validateMoney("0", "precoPago").valid);
ok("preço pago 100000 inválido", !validateMoney("100000", "precoPago").valid);
ok("preço pago 99999,99 válido", validateMoney("99999,99", "precoPago").valid);
ok("perda 51 inválida", !validateNumber("51", "perda").valid);
ok("vendas 2,5 inválida (inteiro)", !validateNumber("2,5", "vendasDia", true).valid);

// Meu dia
const md = defaultState().meuDia; md.compras = { ativo: true, valorPorIdaCentavos: 3000, diasDuracao: 3 }; md.chegarAoPonto = { ativo: true, valorCentavos: 900 }; md.pontoTaxa = { ativo: true, valorCentavos: 43300, periodo: "mes" }; md.diasSemana = 5;
const g = calcularGastosDoDia(md);
ok("gastos do dia: 3000/3 + 900 + 43300/(5*4,33)", Math.abs(g - (1000 + 900 + 43300 / 21.65)) < 0.01, String(g));
console.log(fails ? `\n${fails} FALHA(S)` : "\nTudo OK");
process.exit(fails ? 1 : 0);

import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { calculatePricing } from "../lib/pricing";

interface TestResult {
  name: string;
  ok: boolean;
  details: string;
}

function near(value: number, expected: number, tolerance = 0.02) {
  return Math.abs(value - expected) <= tolerance;
}

function runTests(): TestResult[] {
  const a = calculatePricing({
    precoCompraCentavos: 4000,
    rendimento: 12,
    perda: 0.05,
    embalagemUnCentavos: 10,
    gastosDiaCentavos: 1900,
    vendasDia: 60,
    ganhoDesejadoDiaCentavos: 10000,
    fatia: 1,
    taxaMedia: 0.5 * 0.03,
    reserva: 0.1,
    passoArredondamentoCentavos: 50,
  });
  const aOk = a.ok &&
    near(a.value.custoVariavelUnCentavos, 360.88) &&
    a.value.precoMinimoCentavos === 399 &&
    a.value.precoRecomendadoCentavos === 632 &&
    a.value.precoFacilCentavos === 650 &&
    a.value.metaCobrirGastos === 8 &&
    a.value.metaFecharDia === 46 &&
    near((a.value.raioX.reserva * 60) / 100, 37.91, 0.02);

  const b = calculatePricing({
    precoCompraCentavos: 10000,
    rendimento: 80,
    perda: 0.1,
    embalagemUnCentavos: 0,
    gastosDiaCentavos: 0,
    vendasDia: 1,
    ganhoDesejadoDiaCentavos: 0,
    fatia: 1,
    taxaMedia: 0,
    reserva: 0,
    passoArredondamentoCentavos: 50,
  });
  const bOk = b.ok &&
    b.value.precoMinimoCentavos === 139 &&
    b.value.precoRecomendadoCentavos === 139 &&
    b.value.precoFacilCentavos === 150 &&
    b.value.metaCobrirGastos === null &&
    b.value.metaFecharDia === null &&
    b.value.avisoMeta === "Com esse preço você não ganha nada em cada venda.";

  return [
    { name: "Caso A", ok: aOk, details: a.ok ? "Preço mínimo R$ 3,99 · preço para cobrar R$ 6,32 · preço fácil R$ 6,50 · metas 8 e 46 · sobra da reserva perto de R$ 37,91." : a.error },
    { name: "Caso B", ok: bOk, details: b.ok ? "Preço mínimo e preço para cobrar R$ 1,39 · preço fácil R$ 1,50 · meta não exibida." : b.error },
  ];
}

export default function TestesScreen({ onBack }: { onBack: () => void }) {
  const tests = runTests();
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <button type="button" onClick={onBack} className="grid min-h-14 min-w-14 place-items-center rounded-2xl border-2 border-foreground bg-card" aria-label="Voltar"><ArrowLeft aria-hidden="true" /></button>
      <h1 className="mt-7 font-display text-4xl font-black">Testes do cálculo</h1>
      <p className="mt-2 text-muted-foreground">Rota interna para conferir o motor de preços.</p>
      <div className="mt-8 grid gap-4">
        {tests.map((test) => (
          <article key={test.name} className="rounded-[2rem] border-2 border-foreground bg-card p-5">
            <div className="flex items-center gap-3">
              {test.ok ? <CheckCircle2 className="text-foreground" aria-hidden="true" /> : <XCircle className="text-destructive" aria-hidden="true" />}
              <h2 className="font-display text-2xl font-black">{test.name}: {test.ok ? "OK" : "FALHOU"}</h2>
            </div>
            <p className="mt-3 leading-relaxed text-muted-foreground">{test.details}</p>
          </article>
        ))}
      </div>
    </main>
  );
}

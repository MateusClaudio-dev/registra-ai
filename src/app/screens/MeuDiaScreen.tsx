import { useMemo, useState } from "react";
import { Check, ChevronRight, CircleDollarSign, Info, Plus, ShoppingCart, Store, Users, Zap } from "lucide-react";
import { calcularGastosDoDia } from "../lib/pricing";
import { formatMoney, LIMITS, parseMoneyToCents, sanitizeNumericInput, validateMoney } from "../lib/money";
import type { MeuDia } from "../lib/storage";

type FieldKey = "chegarAoPonto" | "operacao" | "ajudante";

function MoneyInput({ id, label, cents, onChange, error }: {
  id: string;
  label: string;
  cents: number;
  onChange: (value: number) => void;
  error?: string;
}) {
  const [raw, setRaw] = useState(cents ? (cents / 100).toFixed(2).replace(".", ",") : "");
  const validation = raw ? validateMoney(raw, id === "ganho-desejado" ? "ganhoDesejadoDia" : "gastoItemDia") : null;
  const fieldError = error || (validation && !validation.valid ? validation.message : "");
  return (
    <div className="mt-4">
      <label htmlFor={id} className="block font-bold">{label}</label>
      <div className="mt-2 flex min-h-16 items-center rounded-2xl border-2 border-foreground bg-input-background px-4 focus-within:ring-4 focus-within:ring-ring/35">
        <span className="mr-3 font-black">R$</span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={raw}
          onChange={(event) => {
            const next = sanitizeNumericInput(event.target.value);
            setRaw(next);
            if (next === "") { onChange(0); return; }
            const parsed = parseMoneyToCents(next);
            if (parsed !== null) onChange(parsed);
          }}
          className="min-w-0 flex-1 bg-transparent text-xl font-black outline-none"
          placeholder="0,00"
          aria-describedby={fieldError ? `${id}-error` : undefined}
          aria-invalid={Boolean(fieldError)}
        />
      </div>
      {fieldError && <p id={`${id}-error`} className="mt-2 font-bold text-destructive">{fieldError}</p>}
    </div>
  );
}

function CostCard({ active, title, description, icon, onToggle, children }: {
  active: boolean;
  title: string;
  description: string;
  icon: React.ReactNode;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <article className={`rounded-2xl border-2 p-4 ${active ? "border-foreground bg-card shadow-[4px_4px_0_var(--foreground)]" : "border-border bg-card"}`}>
      <button type="button" onClick={onToggle} className="flex min-h-16 w-full items-center gap-4 text-left">
        <span className={`grid size-12 shrink-0 place-items-center rounded-2xl border-2 border-foreground ${active ? "bg-accent text-accent-foreground" : "bg-muted"}`}>
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block font-display text-lg leading-tight">{title}</strong>
          <span className="mt-1 block text-muted-foreground">{description}</span>
        </span>
        <span className={`grid size-8 shrink-0 place-items-center rounded-full border-2 border-foreground ${active ? "bg-secondary" : "bg-card"}`}>
          {active ? <Check size={18} aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
        </span>
      </button>
      {active && <div className="border-t-2 border-border pt-1">{children}</div>}
    </article>
  );
}

export default function MeuDiaScreen({ value, onSave, onDone }: {
  value: MeuDia;
  onSave: (value: MeuDia) => void;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState<MeuDia>(() => JSON.parse(JSON.stringify(value)) as MeuDia);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [diasCompraRaw, setDiasCompraRaw] = useState(String(value.compras.diasDuracao || 1));
  const total = useMemo(() => calcularGastosDoDia(draft), [draft]);
  const patchMoney = (key: FieldKey, patch: Partial<MeuDia[FieldKey]>) =>
    setDraft((old) => ({ ...old, [key]: { ...old[key], ...patch } }));

  const finish = (preenchido: boolean) => {
    const [, maxGasto] = LIMITS.gastoItemDia;
    const [, maxGanho] = LIMITS.ganhoDesejadoDia;
    const tooHigh =
      (draft.compras.ativo && draft.compras.valorPorIdaCentavos > maxGasto) ||
      (draft.chegarAoPonto.ativo && draft.chegarAoPonto.valorCentavos > maxGasto) ||
      (draft.operacao.ativo && draft.operacao.valorCentavos > maxGasto) ||
      (draft.ajudante.ativo && draft.ajudante.valorCentavos > maxGasto) ||
      (draft.pontoTaxa.ativo && draft.pontoTaxa.valorCentavos > maxGasto) ||
      (draft.outro.ativo && draft.outro.valorCentavos > maxGasto) ||
      draft.ganhoDesejadoCentavos > maxGanho;
    if (tooHigh) {
      setSaveError(`Algum valor está alto demais. O máximo é ${formatMoney(maxGasto)} por item. Confira os campos em vermelho.`);
      return;
    }
    setSaveError("");
    if (preenchido) {
      const gain = validateMoney((draft.ganhoDesejadoCentavos / 100).toFixed(2), "ganhoDesejadoDia");
      if (!gain.valid) {
        setError(gain.message);
        return;
      }
    }
    onSave({ ...draft, preenchido });
    onDone();
  };

  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6">
      <span className="inline-flex rounded-full border-2 border-foreground bg-secondary px-4 py-2 font-black">Configurar uma vez</span>
      <h1 className="mt-5 font-display text-4xl font-black leading-tight sm:text-5xl">Como é o seu dia?</h1>
      <p className="mt-3 text-lg leading-relaxed text-muted-foreground">Esses valores são divididos entre seus produtos. Você pode mudar depois.</p>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-black">1. Quantos dias por semana você trabalha?</h2>
        <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7">
          {[1, 2, 3, 4, 5, 6, 7].map((day) => (
            <button
              type="button"
              key={day}
              onClick={() => setDraft((old) => ({ ...old, diasSemana: day }))}
              className={`min-h-14 rounded-2xl border-2 border-foreground font-display text-xl font-black ${draft.diasSemana === day ? "bg-primary text-primary-foreground shadow-[3px_3px_0_var(--foreground)]" : "bg-card"}`}
              aria-pressed={draft.diasSemana === day}
            >
              {day}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-black">2. O que você gasta num dia de trabalho?</h2>
        <p className="mt-2 text-muted-foreground">Ligue só o que faz parte do seu dia.</p>
        <div className="mt-5 grid gap-4">
          <CostCard
            active={draft.compras.ativo}
            onToggle={() => setDraft((old) => ({ ...old, compras: { ...old.compras, ativo: !old.compras.ativo } }))}
            title="Comprar a mercadoria"
            description="Ônibus, frete, carreto ou ajuda"
            icon={<ShoppingCart aria-hidden="true" />}
          >
            <MoneyInput id="compra-ida" label="Quanto gasta por ida?" cents={draft.compras.valorPorIdaCentavos} onChange={(valorPorIdaCentavos) => setDraft((old) => ({ ...old, compras: { ...old.compras, valorPorIdaCentavos } }))} />
            <label htmlFor="dias-compra" className="mt-4 block font-bold">De quantos em quantos dias você compra?</label>
            <input
              id="dias-compra"
              type="text"
              inputMode="numeric"
              value={diasCompraRaw}
              onChange={(event) => {
                const digits = event.target.value.replace(/\D/g, "").slice(0, 5);
                setDiasCompraRaw(digits);
                const number = Math.min(10_000, Math.max(1, Number(digits) || 1));
                setDraft((old) => ({ ...old, compras: { ...old.compras, diasDuracao: number } }));
              }}
              onFocus={(event) => event.target.select()}
              onBlur={() => { if (!diasCompraRaw || Number(diasCompraRaw) < 1) setDiasCompraRaw("1"); }}
              className="mt-2 min-h-16 w-full rounded-2xl border-2 border-foreground bg-input-background px-4 text-xl font-black outline-none focus:ring-4 focus:ring-ring/35"
            />
          </CostCard>

          <CostCard active={draft.chegarAoPonto.ativo} onToggle={() => patchMoney("chegarAoPonto", { ativo: !draft.chegarAoPonto.ativo })} title="Chegar ao ponto de venda" description="Valor por dia" icon={<Store aria-hidden="true" />}>
            <MoneyInput id="chegar-ponto" label="Quanto gasta por dia?" cents={draft.chegarAoPonto.valorCentavos} onChange={(valorCentavos) => patchMoney("chegarAoPonto", { valorCentavos })} />
          </CostCard>

          <CostCard active={draft.operacao.ativo} onToggle={() => patchMoney("operacao", { ativo: !draft.operacao.ativo })} title="Material para trabalhar" description="Gás, carvão, gelo, dendê, bateria ou energia" icon={<Zap aria-hidden="true" />}>
            <MoneyInput id="operacao" label="Quanto gasta por dia?" cents={draft.operacao.valorCentavos} onChange={(valorCentavos) => patchMoney("operacao", { valorCentavos })} />
          </CostCard>

          <CostCard active={draft.ajudante.ativo} onToggle={() => patchMoney("ajudante", { ativo: !draft.ajudante.ativo })} title="Ajudante" description="Pagamento por dia" icon={<Users aria-hidden="true" />}>
            <MoneyInput id="ajudante" label="Quanto paga por dia?" cents={draft.ajudante.valorCentavos} onChange={(valorCentavos) => patchMoney("ajudante", { valorCentavos })} />
          </CostCard>

          <CostCard active={draft.pontoTaxa.ativo} onToggle={() => setDraft((old) => ({ ...old, pontoTaxa: { ...old.pontoTaxa, ativo: !old.pontoTaxa.ativo } }))} title="Ponto, taxa ou aluguel" description="Barraca, carrinho ou isopor" icon={<CircleDollarSign aria-hidden="true" />}>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {(["dia", "mes"] as const).map((periodo) => (
                <button key={periodo} type="button" onClick={() => setDraft((old) => ({ ...old, pontoTaxa: { ...old.pontoTaxa, periodo } }))} className={`min-h-14 rounded-2xl border-2 border-foreground font-bold ${draft.pontoTaxa.periodo === periodo ? "bg-secondary" : "bg-card"}`}>
                  Por {periodo === "dia" ? "dia" : "mês"}
                </button>
              ))}
            </div>
            <MoneyInput id="ponto-taxa" label={`Quanto paga por ${draft.pontoTaxa.periodo}?`} cents={draft.pontoTaxa.valorCentavos} onChange={(valorCentavos) => setDraft((old) => ({ ...old, pontoTaxa: { ...old.pontoTaxa, valorCentavos } }))} />
          </CostCard>

          <CostCard active={draft.outro.ativo} onToggle={() => setDraft((old) => ({ ...old, outro: { ...old.outro, ativo: !old.outro.ativo } }))} title="Outro gasto" description="Escreva o nome e o valor" icon={<Plus aria-hidden="true" />}>
            <label htmlFor="outro-nome" className="mt-4 block font-bold">Nome do gasto</label>
            <input id="outro-nome" type="text" value={draft.outro.nome} onChange={(event) => setDraft((old) => ({ ...old, outro: { ...old.outro, nome: event.target.value } }))} className="mt-2 min-h-16 w-full rounded-2xl border-2 border-foreground bg-input-background px-4 text-xl outline-none focus:ring-4 focus:ring-ring/35" placeholder="Ex.: água" />
            <MoneyInput id="outro-valor" label="Quanto gasta por dia?" cents={draft.outro.valorCentavos} onChange={(valorCentavos) => setDraft((old) => ({ ...old, outro: { ...old.outro, valorCentavos } }))} />
          </CostCard>
        </div>
      </section>

      <section className="mt-12 rounded-[2rem] border-2 border-foreground bg-card p-5 sm:p-7">
        <h2 className="font-display text-2xl font-black">3. Quanto você quer tirar por dia para você?</h2>
        <p className="mt-3 leading-relaxed text-muted-foreground">Seu dia inclui comprar, preparar e vender. Esse é o pagamento pelo seu trabalho. Esse valor é dividido entre seus produtos.</p>
        <MoneyInput id="ganho-desejado" label="Valor por dia" cents={draft.ganhoDesejadoCentavos} onChange={(ganhoDesejadoCentavos) => setDraft((old) => ({ ...old, ganhoDesejadoCentavos, cobrirApenas: false }))} error={error} />
        <button
          type="button"
          onClick={() => setDraft((old) => ({ ...old, ganhoDesejadoCentavos: 0, cobrirApenas: true }))}
          className={`mt-4 min-h-16 w-full rounded-2xl border-2 border-foreground px-4 font-bold ${draft.cobrirApenas ? "bg-secondary" : "bg-card"}`}
        >
          Não sei, só cobrir os gastos
        </button>
        {draft.cobrirApenas && (
          <p className="mt-4 flex gap-2 rounded-2xl bg-muted p-4 font-bold">
            <Info className="shrink-0" aria-hidden="true" /> Seu trabalho não está sendo pago neste preço.
          </p>
        )}
      </section>

      <aside className="mt-8 rounded-2xl border-2 border-foreground bg-accent p-5 text-accent-foreground">
        <p className="font-display text-xl font-black">Resumo do seu dia</p>
        <p className="mt-2 leading-relaxed">Gastos {formatMoney(total)} por dia, você quer tirar {formatMoney(draft.ganhoDesejadoCentavos)} por dia, trabalha {draft.diasSemana} dias por semana.</p>
      </aside>

      {saveError && <p role="alert" className="mt-8 rounded-2xl border-2 border-destructive bg-card p-4 font-bold text-destructive">{saveError}</p>}
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => finish(false)} className="min-h-16 rounded-2xl border-2 border-foreground bg-card px-5 font-bold">Preencher depois</button>
        <button type="button" onClick={() => finish(true)} className="flex min-h-16 items-center justify-between rounded-2xl border-2 border-foreground bg-primary px-5 font-display text-xl font-black text-primary-foreground shadow-[4px_4px_0_var(--foreground)]">
          Salvar meu dia <ChevronRight aria-hidden="true" />
        </button>
      </div>
    </main>
  );
}

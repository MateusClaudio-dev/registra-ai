import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronDown, ChevronUp, CircleDollarSign,
  Clock3, Copy, CreditCard, Info, Package, Percent, Save, Share2, ShoppingBasket, Store, Volume2, WalletCards,
} from "lucide-react";
import { calculatePricing, calcularGastosDoDia } from "../lib/pricing";
import type { PricingInput, PricingOutcome } from "../lib/pricing";
import { buildPricingInput, buildResult, getYield } from "../lib/product";
import type { BuyType, Payment, ProductDraft, SellType } from "../lib/product";
import {
  formatMoney, parseDecimal, parseMoneyToCents, sanitizeNumericInput, validateMoney, validateNumber,
} from "../lib/money";
import type { AppState, SavedProduct } from "../lib/storage";
import { upsertProduct } from "../lib/storage";

const EMOJIS = ["🥥", "🧀", "🥤", "🌽", "🧊", "🍢", "🥟", "🍬"];
const PHASES = ["Produto", "Compra", "Venda", "Ganho"];

function usePortugueseVoice() {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const findVoice = () => {
      const found = window.speechSynthesis.getVoices().find((item) => item.lang.replace("_", "-").toLocaleLowerCase() === "pt-br") ?? null;
      setVoice(found);
    };
    findVoice();
    window.speechSynthesis.addEventListener("voiceschanged", findVoice);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", findVoice);
  }, []);
  const speak = (text: string) => {
    if (!voice) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = "pt-BR";
    window.speechSynthesis.speak(utterance);
  };
  return { available: Boolean(voice), speak };
}

function freshDraft(firstProduct: boolean): ProductDraft {
  return {
    id: `produto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: "",
    emoji: "🥥",
    buyType: "",
    price: "",
    buyQuantity: "",
    sellType: "",
    yieldMode: "measure",
    portionSize: "",
    directYield: "",
    loss: "10",
    packaging: null,
    packagingCost: "",
    salesDay: "",
    dayShare: firstProduct ? "100" : "50",
    payments: [],
    machineShare: "50",
    machineFee: "3",
    reserve: "5",
  };
}

function phaseForStep(step: number) {
  if (step === 0) return 0;
  if (step <= 2) return 1;
  if (step <= 6) return 2;
  return 3;
}

function Field({ id, label, value, onChange, prefix, suffix, hint, error, placeholder = "0" }: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  suffix?: string;
  hint?: string;
  error?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block font-display text-xl font-black">{label}</label>
      {hint && <p className="mt-1 leading-relaxed text-muted-foreground">{hint}</p>}
      <div className="mt-3 flex min-h-16 items-center rounded-2xl border-2 border-foreground bg-input-background px-4 focus-within:ring-4 focus-within:ring-ring/35">
        {prefix && <span className="mr-2 font-black">{prefix}</span>}
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(sanitizeNumericInput(event.target.value))}
          className="min-w-0 flex-1 bg-transparent text-xl font-black outline-none"
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {suffix && <span className="ml-2 font-bold">{suffix}</span>}
      </div>
      {error && <p id={`${id}-error`} role="alert" className="mt-2 font-bold text-destructive">{error}</p>}
    </div>
  );
}

function Choice({ selected, onClick, icon, title, text }: {
  selected: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  title: string;
  text?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 border-foreground p-4 text-left transition-transform active:scale-[.99] ${selected ? "bg-secondary text-secondary-foreground shadow-[4px_4px_0_var(--foreground)]" : "bg-card"}`}
    >
      {icon && <span className={`grid size-11 shrink-0 place-items-center rounded-xl border-2 border-foreground ${selected ? "bg-card" : "bg-muted"}`}>{icon}</span>}
      <span className="min-w-0 flex-1">
        <strong className="block font-display text-lg font-black leading-tight">{title}</strong>
        {text && <span className={`mt-1 block leading-snug ${selected ? "text-secondary-foreground" : "text-muted-foreground"}`}>{text}</span>}
      </span>
      {selected && <Check className="shrink-0" aria-hidden="true" />}
    </button>
  );
}

function Chips({ values, selected, onChange }: {
  values: { value: string; label: string }[];
  selected: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          aria-pressed={selected === item.value}
          className={`min-h-14 rounded-2xl border-2 border-foreground px-4 font-black ${selected === item.value ? "bg-secondary text-secondary-foreground shadow-[3px_3px_0_var(--foreground)]" : "bg-card"}`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function needsDirectOrMeasure(draft: ProductDraft) {
  const measured =
    ((draft.buyType === "kg" || draft.buyType === "sack") && (draft.sellType === "portion" || draft.sellType === "unit")) ||
    (draft.buyType === "liter" && draft.sellType === "portion");
  const automatic =
    (draft.buyType === "unit" && draft.sellType === "unit") ||
    (draft.buyType === "package" && draft.sellType === "unit") ||
    ((draft.buyType === "kg" || draft.buyType === "sack") && draft.sellType === "kg") ||
    (draft.buyType === "liter" && draft.sellType === "liter") ||
    (draft.buyType === "recipe" && (draft.sellType === "unit" || draft.sellType === "portion"));
  return { measured, directOnly: !measured && !automatic };
}

function Progress({ step }: { step: number }) {
  const active = phaseForStep(step);
  return (
    <div>
      <div className="grid grid-cols-4 gap-1" role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={active + 1} aria-valuetext={`Fase ${active + 1} de 4: ${PHASES[active]}`}>
        {PHASES.map((phase, index) => (
          <div key={phase}>
            <span className={`block h-3 rounded-full border border-foreground ${index <= active ? "bg-primary" : "bg-muted"}`} />
            <span className={`mt-2 block text-center font-bold ${index === active ? "text-foreground" : "text-muted-foreground"}`}>{phase}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DraftPrompt({ onContinue, onDiscard }: { onContinue: () => void; onDiscard: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/70 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="draft-title" className="w-full max-w-md rounded-[2rem] border-2 border-foreground bg-card p-6 text-card-foreground shadow-[8px_8px_0_var(--secondary)]">
        <Clock3 size={36} aria-hidden="true" />
        <h2 id="draft-title" className="mt-4 font-display text-3xl font-black">Você tem um produto em andamento.</h2>
        <p className="mt-3 text-lg text-muted-foreground">Quer continuar de onde parou?</p>
        <div className="mt-7 grid gap-3">
          <button type="button" onClick={onContinue} className="min-h-16 rounded-2xl border-2 border-foreground bg-primary px-5 font-display text-xl font-black text-primary-foreground">Continuar</button>
          <button type="button" onClick={onDiscard} className="min-h-14 rounded-2xl border-2 border-foreground bg-card px-5 font-bold">Começar outro</button>
        </div>
      </section>
    </div>
  );
}

function StepContent({ step, draft, patch, error }: {
  step: number;
  draft: ProductDraft;
  patch: (value: Partial<ProductDraft>) => void;
  error: string;
}) {
  const buyOptions: { value: BuyType; title: string; text: string; emoji: string }[] = [
    { value: "unit", title: "Por unidade", text: "Ex.: uma água de coco", emoji: "🥥" },
    { value: "package", title: "Pacote, caixa, fardo, dúzia ou cento", text: "Ex.: fardo com 12 águas", emoji: "📦" },
    { value: "kg", title: "Por quilo", text: "Ex.: queijo coalho", emoji: "⚖️" },
    { value: "sack", title: "Por saca ou saco", text: "Ex.: saco de milho com 20 kg", emoji: "🧺" },
    { value: "liter", title: "Por litro ou balde", text: "Ex.: bebida vendida em copos", emoji: "🪣" },
    { value: "recipe", title: "Eu mesmo faço", text: "Ex.: receita de acarajé", emoji: "🥣" },
  ];

  if (step === 0) {
    return (
      <section>
        <h1 className="font-display text-4xl font-black leading-tight">Qual produto você vai calcular?</h1>
        <p className="mt-3 text-lg text-muted-foreground">Exemplo: queijo coalho no espeto.</p>
        <label htmlFor="product-name" className="mt-7 block font-display text-xl font-black">Nome do produto</label>
        <input id="product-name" type="text" value={draft.name} onChange={(event) => patch({ name: event.target.value })} className="mt-3 min-h-16 w-full rounded-2xl border-2 border-foreground bg-input-background px-4 text-xl font-black outline-none focus:ring-4 focus:ring-ring/35" placeholder="Ex.: água de coco" />
        <fieldset className="mt-7">
          <legend className="font-display text-xl font-black">Escolha um desenho</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {EMOJIS.map((emoji) => (
              <button key={emoji} type="button" onClick={() => patch({ emoji })} aria-label={`Escolher ${emoji}`} aria-pressed={draft.emoji === emoji} className={`grid min-h-14 min-w-14 place-items-center rounded-2xl border-2 border-foreground text-2xl ${draft.emoji === emoji ? "bg-secondary shadow-[3px_3px_0_var(--foreground)]" : "bg-card"}`}>{emoji}</button>
            ))}
          </div>
        </fieldset>
      </section>
    );
  }

  if (step === 1) {
    return (
      <section>
        <h1 className="font-display text-4xl font-black leading-tight">Como você compra?</h1>
        <p className="mt-3 text-lg text-muted-foreground">Exemplo: água gelada pode vir em um fardo.</p>
        <div className="mt-7 grid gap-3">
          {buyOptions.map((item) => <Choice key={item.value} selected={draft.buyType === item.value} onClick={() => patch({ buyType: item.value, buyQuantity: "", sellType: "", portionSize: "", directYield: "" })} icon={<span className="text-2xl">{item.emoji}</span>} title={item.title} text={item.text} />)}
        </div>
      </section>
    );
  }

  if (step === 2) {
    const secondLabel =
      draft.buyType === "package" ? "Quantas unidades vêm?" :
      draft.buyType === "sack" ? "Quantos quilos tem a saca?" :
      draft.buyType === "liter" ? "Quantos litros vêm?" :
      draft.buyType === "recipe" ? "Quantas unidades a receita rende?" : "";
    return (
      <section>
        <h1 className="font-display text-4xl font-black leading-tight">Quanto você paga?</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          {draft.buyType === "recipe" ? "Some o que gastou no mercado para a receita toda." : "Exemplo: R$ 40,00 por 1 kg de queijo."}
        </p>
        <div className="mt-7 grid gap-7">
          <Field id="purchase-price" label={draft.buyType === "recipe" ? "Gasto da receita toda" : draft.buyType === "unit" ? "Preço de 1 unidade" : draft.buyType === "kg" ? "Preço de 1 kg" : "Preço pago"} value={draft.price} onChange={(price) => patch({ price })} prefix="R$" placeholder="0,00" />
          {secondLabel && <Field id="purchase-quantity" label={secondLabel} value={draft.buyQuantity} onChange={(buyQuantity) => patch({ buyQuantity })} suffix={draft.buyType === "sack" ? "kg" : draft.buyType === "liter" ? "litros" : "unidades"} />}
        </div>
      </section>
    );
  }

  if (step === 3) {
    const relation = needsDirectOrMeasure(draft);
    const measureIsMl = draft.buyType === "liter";
    return (
      <section>
        <h1 className="font-display text-4xl font-black leading-tight">Como você vende?</h1>
        <p className="mt-3 text-lg text-muted-foreground">Exemplo: queijo no espeto é uma porção.</p>
        <div className="mt-7 grid grid-cols-2 gap-3">
          {([
            ["unit", "Unidade", "1️⃣"], ["portion", "Porção, copo ou espeto", "🥤"], ["kg", "Quilo", "⚖️"], ["liter", "Litro", "🪣"],
          ] as [SellType, string, string][]).map(([value, label, emoji]) => (
            <Choice key={value} selected={draft.sellType === value} onClick={() => patch({ sellType: value, portionSize: "", directYield: "" })} title={`${emoji} ${label}`} />
          ))}
        </div>
        {draft.sellType && (relation.measured || relation.directOnly) && (
          <div className="mt-7 rounded-2xl border-2 border-foreground bg-muted p-4">
            {relation.measured && (
              <div className="mb-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => patch({ yieldMode: "measure" })} className={`min-h-14 rounded-xl border-2 border-foreground px-3 font-bold ${draft.yieldMode === "measure" ? "bg-secondary" : "bg-card"}`}>{measureIsMl ? "Dizer os ml" : "Dizer os gramas"}</button>
                <button type="button" onClick={() => patch({ yieldMode: "direct" })} className={`min-h-14 rounded-xl border-2 border-foreground px-3 font-bold ${draft.yieldMode === "direct" ? "bg-secondary" : "bg-card"}`}>Quantas saem</button>
              </div>
            )}
            {relation.measured && draft.yieldMode === "measure" ? (
              <Field id="portion-size" label={measureIsMl ? "Quantos ml tem 1 copo?" : "Quanto pesa 1 porção?"} value={draft.portionSize} onChange={(portionSize) => patch({ portionSize })} suffix={measureIsMl ? "ml" : "gramas"} hint={measureIsMl ? "Ex.: um copo tem 300 ml." : "Ex.: um espeto pesa 250 g."} />
            ) : (
              <Field id="direct-yield" label="Quantas unidades de venda saem?" value={draft.directYield} onChange={(directYield) => patch({ directYield })} suffix="saem" hint="Conte quantas porções, copos ou unidades você consegue vender." />
            )}
          </div>
        )}
      </section>
    );
  }

  if (step === 4) {
    return (
      <section>
        <h1 className="font-display text-4xl font-black leading-tight">Você perde mercadoria?</h1>
        <p className="mt-3 text-lg text-muted-foreground">Exemplo: quando o movimento cai, uma parte pode sobrar.</p>
        <div className="mt-7 grid gap-3">
          {[
            ["0", "Quase nada", "0 em cada 100"],
            ["5", "Pouco", "5 em cada 100"],
            ["15", "Bastante", "15 em cada 100"],
            ["10", "Não sei", "Valor de partida: 10 em cada 100. Pode mudar."],
          ].map(([value, title, text]) => <Choice key={`${title}-${value}`} selected={draft.loss === value} onClick={() => patch({ loss: value })} title={title} text={text} />)}
        </div>
        <div className="mt-7"><Field id="loss" label="Ou digite quantos em cada 100" value={draft.loss} onChange={(loss) => patch({ loss })} suffix="em cada 100" /></div>
      </section>
    );
  }

  if (step === 5) {
    return (
      <section>
        <h1 className="font-display text-4xl font-black leading-tight">Usa embalagem em cada venda?</h1>
        <p className="mt-3 text-lg text-muted-foreground">Sacola, copo, guardanapo ou espeto.</p>
        <div className="mt-7 grid grid-cols-2 gap-3">
          <Choice selected={draft.packaging === true} onClick={() => patch({ packaging: true })} title="Sim" />
          <Choice selected={draft.packaging === false} onClick={() => patch({ packaging: false, packagingCost: "" })} title="Não" />
        </div>
        {draft.packaging && <div className="mt-7"><Field id="packaging-cost" label="Quanto custa por venda?" value={draft.packagingCost} onChange={(packagingCost) => patch({ packagingCost })} prefix="R$" placeholder="0,00" hint="Ex.: um espeto custa R$ 0,10." /></div>}
      </section>
    );
  }

  if (step === 6) {
    return (
      <section>
        <h1 className="font-display text-4xl font-black leading-tight">Quanto você vende num dia normal?</h1>
        <p className="mt-3 text-lg text-muted-foreground">Pense no último dia normal de trabalho.</p>
        <div className="mt-7">
          <Chips values={["10", "20", "30", "50", "100"].map((value) => ({ value, label: value }))} selected={draft.salesDay} onChange={(salesDay) => patch({ salesDay })} />
          <div className="mt-5"><Field id="sales-day" label="Ou digite outro valor" value={draft.salesDay} onChange={(salesDay) => patch({ salesDay })} suffix="vendas" /></div>
        </div>
        <div className="mt-8 border-t-2 border-border pt-7">
          <h2 className="font-display text-2xl font-black">Este produto é quanto do seu dia?</h2>
          <p className="mt-2 text-muted-foreground">Exemplo: se vende quase só milho, escolha “Quase tudo”.</p>
          <div className="mt-4"><Chips values={[
            { value: "100", label: "Quase tudo" }, { value: "70", label: "Mais da metade" }, { value: "50", label: "Metade" }, { value: "25", label: "Uma parte" }, { value: "10", label: "Pouco" },
          ]} selected={draft.dayShare} onChange={(dayShare) => patch({ dayShare })} /></div>
          <div className="mt-5"><Field id="day-share" label="Ou digite quantos em cada 100" value={draft.dayShare} onChange={(dayShare) => patch({ dayShare })} suffix="em cada 100" /></div>
        </div>
      </section>
    );
  }

  if (step === 7) {
    const options: [Payment, string, string][] = [
      ["cash", "Dinheiro", "💵"], ["pix", "Pix na minha chave", "◆"], ["machine-pix", "Pix pela maquininha", "▣"], ["debit", "Débito", "💳"], ["credit", "Crédito", "💳"],
    ];
    return (
      <section>
        <h1 className="font-display text-4xl font-black leading-tight">Como seus clientes pagam?</h1>
        <p className="mt-3 text-lg text-muted-foreground">Pode marcar mais de uma opção.</p>
        <div className="mt-7 grid gap-3">
          {options.map(([value, label, emoji]) => (
            <Choice key={value} selected={draft.payments.includes(value)} onClick={() => patch({ payments: draft.payments.includes(value) ? draft.payments.filter((item) => item !== value) : [...draft.payments, value] })} title={`${emoji} ${label}`} />
          ))}
        </div>
      </section>
    );
  }

  if (step === 8) {
    return (
      <section>
        <h1 className="font-display text-4xl font-black leading-tight">Quanto passa na maquininha?</h1>
        <p className="mt-3 text-lg text-muted-foreground">Pix na sua chave não tem taxa. Pix pela maquininha pode ter.</p>
        <div className="mt-7">
          <h2 className="font-display text-xl font-black">Parte das vendas na maquininha</h2>
          <div className="mt-3"><Chips values={[{ value: "10", label: "Quase nada" }, { value: "50", label: "Metade" }, { value: "90", label: "Quase tudo" }]} selected={draft.machineShare} onChange={(machineShare) => patch({ machineShare })} /></div>
          <div className="mt-5"><Field id="machine-share" label="Ou digite quantos em cada 100" value={draft.machineShare} onChange={(machineShare) => patch({ machineShare })} suffix="em cada 100" /></div>
        </div>
        <div className="mt-8 border-t-2 border-border pt-7">
          <h2 className="font-display text-xl font-black">Taxa da sua maquininha</h2>
          <div className="mt-3"><Chips values={["1,5", "2", "3", "5"].map((value) => ({ value, label: `${value}%` }))} selected={draft.machineFee} onChange={(machineFee) => patch({ machineFee })} /></div>
          <button type="button" onClick={() => patch({ machineFee: "3" })} className="mt-3 min-h-14 rounded-2xl border-2 border-foreground bg-card px-4 font-bold">Não sei — usar 3% como valor de partida</button>
          <div className="mt-5"><Field id="machine-fee" label="Ou digite a taxa" value={draft.machineFee} onChange={(machineFee) => patch({ machineFee })} suffix="%" /></div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h1 className="font-display text-4xl font-black leading-tight">Quanto você guarda?</h1>
      <p className="mt-3 text-lg text-muted-foreground">De cada R$ 100 vendidos, quanto guarda para repor estoque e imprevistos?</p>
      <div className="mt-7"><Chips values={["0", "5", "10", "15"].map((value) => ({ value, label: `${value} em cada 100` }))} selected={draft.reserve} onChange={(reserve) => patch({ reserve })} /></div>
      <button type="button" onClick={() => patch({ reserve: "5" })} className="mt-3 min-h-14 rounded-2xl border-2 border-foreground bg-card px-4 font-bold">Não sei — usar 5 como valor de partida</button>
      <div className="mt-7"><Field id="reserve" label="Ou digite quantos em cada 100" value={draft.reserve} onChange={(reserve) => patch({ reserve })} suffix="em cada 100" /></div>
      {error && <p role="alert" className="mt-5 rounded-2xl border-2 border-destructive bg-card p-4 font-bold text-destructive">{error}</p>}
    </section>
  );
}

function validateStep(step: number, draft: ProductDraft): string {
  if (step === 0 && !draft.name.trim()) return "Escreva o nome do produto.";
  if (step === 1 && !draft.buyType) return "Escolha como você compra.";
  if (step === 2) {
    const price = validateMoney(draft.price, "precoPago");
    if (!price.valid) return price.message;
    if (["package", "recipe"].includes(draft.buyType)) {
      const quantity = validateNumber(draft.buyQuantity, "quantidadeUnidades", true);
      if (!quantity.valid) return quantity.message;
    }
    if (draft.buyType === "sack" || draft.buyType === "liter") {
      const quantity = validateNumber(draft.buyQuantity, "quilosLitros");
      if (!quantity.valid) return quantity.message;
    }
  }
  if (step === 3) {
    if (!draft.sellType) return "Escolha como você vende.";
    const relation = needsDirectOrMeasure(draft);
    if (relation.measured && draft.yieldMode === "measure") {
      const value = validateNumber(draft.portionSize, "gramasMl");
      if (!value.valid) return value.message;
    }
    if ((relation.measured && draft.yieldMode === "direct") || relation.directOnly) {
      const value = validateNumber(draft.directYield, "quantidadeUnidades");
      if (!value.valid) return value.message;
    }
  }
  if (step === 4) {
    const value = validateNumber(draft.loss, "perda");
    if (!value.valid) return value.message;
  }
  if (step === 5) {
    if (draft.packaging === null) return "Escolha sim ou não.";
    if (draft.packaging) {
      const value = validateMoney(draft.packagingCost, "gastoItemDia");
      if (!value.valid) return value.message;
    }
  }
  if (step === 6) {
    const sales = validateNumber(draft.salesDay, "vendasDia", true);
    if (!sales.valid) return sales.message;
    const share = validateNumber(draft.dayShare, "fatiaDia");
    if (!share.valid) return share.message;
  }
  if (step === 7 && draft.payments.length === 0) return "Marque pelo menos uma forma de pagamento.";
  if (step === 8) {
    const share = validateNumber(draft.machineShare, "fatiaDia");
    if (!share.valid) return share.message;
    const fee = validateNumber(draft.machineFee, "taxaMaquininha");
    if (!fee.valid) return fee.message;
  }
  if (step === 9) {
    const reserve = validateNumber(draft.reserve, "reserva");
    if (!reserve.valid) return reserve.message;
  }
  return "";
}

function GoodsOnly({ draft, onBack }: { draft: ProductDraft; onBack: () => void }) {
  const price = parseMoneyToCents(draft.price) ?? 0;
  const result = price / Math.max(getYield(draft), 1);
  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <button type="button" onClick={onBack} className="grid min-h-14 min-w-14 place-items-center rounded-2xl border-2 border-foreground bg-card" aria-label="Voltar"><ArrowLeft aria-hidden="true" /></button>
      <section className="mt-8 rounded-[2rem] border-2 border-foreground bg-secondary p-6 shadow-[7px_7px_0_var(--foreground)]">
        <span className="text-5xl">{draft.emoji}</span>
        <h1 className="mt-5 font-display text-3xl font-black">Só o custo da mercadoria</h1>
        <p className="mt-3 font-display text-6xl font-black">{formatMoney(result)}</p>
        <p className="mt-2">em cada unidade vendida</p>
      </section>
      <aside className="mt-7 flex gap-3 rounded-2xl border-2 border-foreground bg-card p-5 font-bold">
        <AlertTriangle className="shrink-0" aria-hidden="true" />
        <p>Este valor é só o que a mercadoria custa. Cobrar isso é trabalhar de graça.</p>
      </aside>
      <button type="button" onClick={onBack} className="mt-7 flex min-h-16 w-full items-center justify-between rounded-2xl border-2 border-foreground bg-primary px-5 font-display text-xl font-black text-primary-foreground shadow-[4px_4px_0_var(--foreground)]">
        Completar para ver meu preço <ArrowRight aria-hidden="true" />
      </button>
    </main>
  );
}

function ResultScreen({ draft, state, result, example, onStateChange, onEdit, onNew, onMeuDia, onHome }: {
  draft: ProductDraft;
  state: AppState;
  result: PricingOutcome;
  example: boolean;
  onStateChange: React.Dispatch<React.SetStateAction<AppState>>;
  onEdit: () => void;
  onNew: () => void;
  onMeuDia: () => void;
  onHome: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [neighbors, setNeighbors] = useState("");
  const [unitsToday, setUnitsToday] = useState(draft.salesDay);
  const [copied, setCopied] = useState(false);
  const { available: canSpeak, speak } = usePortugueseVoice();
  if (!result.ok) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <button type="button" onClick={onEdit} className="grid min-h-14 min-w-14 place-items-center rounded-2xl border-2 border-foreground bg-card" aria-label="Voltar"><ArrowLeft /></button>
        <section className="mt-8 rounded-[2rem] border-2 border-destructive bg-card p-6">
          <AlertTriangle size={40} className="text-destructive" />
          <h1 className="mt-4 font-display text-3xl font-black">A conta precisa de um ajuste</h1>
          <p className="mt-3 text-lg leading-relaxed">{result.error} Reduza a reserva ou a taxa da maquininha.</p>
        </section>
      </main>
    );
  }

  const value = result.value;
  const exact = value.precoRecomendadoCentavos;
  const rows = [
    ["Produto", value.raioX.produto, "bg-primary"],
    ["Perdas", value.raioX.perdas, "bg-chart-5"],
    ["Embalagem", value.raioX.embalagem, "bg-chart-4"],
    ["Gastos do dia", value.raioX.gastosDia, "bg-chart-2"],
    ["Taxa", value.raioX.taxa, "bg-chart-3"],
    ["Seu ganho", value.raioX.seuGanho, "bg-accent"],
    ["Reserva", value.raioX.reserva, "bg-chart-1"],
    ["Arredondamento", value.raioX.arredondamento, "bg-foreground"],
  ] as const;
  const barTotal = rows.reduce((sum, row) => sum + Math.max(0, row[1]), 0);
  const dayUnits = Math.max(0, parseDecimal(unitsToday) ?? 0);
  const productDayCosts = state.meuDia.preenchido ? calcularGastosDoDia(state.meuDia) * ((parseDecimal(draft.dayShare) ?? 0) / 100) : example ? 1900 : 0;
  const desiredForProduct = state.meuDia.preenchido ? state.meuDia.ganhoDesejadoCentavos * ((parseDecimal(draft.dayShare) ?? 0) / 100) : example ? 10000 : 0;
  const leftToday = dayUnits * value.margemPorUnCentavos - productDayCosts;
  const desiredDiff = leftToday - desiredForProduct;
  const baseInput = example ? {
    precoCompraCentavos: 4000, rendimento: 12, perda: 0.05, embalagemUnCentavos: 10, vendasDia: 60,
    fatia: 1, taxaMedia: 0.015, reserva: 0.1, gastosDiaCentavos: 1900, ganhoDesejadoDiaCentavos: 10000,
    passoArredondamentoCentavos: state.ajustes.arredondamentoCentavos,
  } as PricingInput : buildPricingInput(draft, state);
  const simulations = [
    { label: "Perda cai pela metade", input: { ...baseInput, perda: baseInput.perda / 2 } },
    { label: "Reserva 5 pontos menor", input: { ...baseInput, reserva: Math.max(0, baseInput.reserva - 0.05) } },
    { label: "Vender mais 10 por dia", input: { ...baseInput, vendasDia: baseInput.vendasDia + 10 } },
  ].map((item) => ({ ...item, result: calculatePricing(item.input) }));

  const save = () => {
    const product: SavedProduct = {
      id: draft.id,
      nome: draft.name.trim(),
      precoCentavos: value.precoFacilCentavos,
      atualizadoEm: new Date().toISOString(),
      fatiaDia: parseDecimal(draft.dayShare) ?? 0,
      dados: { ...draft },
    };
    onStateChange((old) => ({ ...old, produtos: upsertProduct(old.produtos, product), rascunho: {} }));
    setSaved(true);
  };

  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6">
      <button type="button" onClick={example ? onHome : onEdit} className="inline-flex min-h-14 items-center gap-2 rounded-2xl border-2 border-foreground bg-card px-4 font-black" aria-label={example ? "Fechar exemplo" : "Voltar para conferir"}><ArrowLeft aria-hidden="true" /> {example ? "Fechar exemplo" : "Conferir"}</button>

      {example && <div className="mt-7 rounded-2xl border-2 border-foreground bg-secondary p-4 text-center font-black">Exemplo, valores ilustrativos</div>}
      <section id="result-summary" className="relative mt-7 overflow-hidden rounded-[2rem] border-2 border-foreground bg-primary p-6 text-primary-foreground shadow-[8px_8px_0_var(--foreground)] sm:p-8">
        <div className="absolute -right-8 -top-8 size-32 rounded-full border-[14px] border-secondary" aria-hidden="true" />
        <p className="relative font-black">{draft.emoji} {draft.name}</p>
        <p className="relative mt-5 font-display text-2xl font-black">Preço para cobrar</p>
        <p className="relative mt-1 font-display text-6xl font-black leading-none sm:text-7xl">{formatMoney(value.precoFacilCentavos)}</p>
        <p className="relative mt-5 max-w-xl text-lg font-bold">Cobre seus gastos, o seu ganho do dia e a reserva.</p>
        <p className="relative mt-3 border-t-2 border-foreground/40 pt-3 font-bold">Abaixo de {formatMoney(value.precoMinimoCentavos)} você perde dinheiro.</p>
      </section>
      {canSpeak && <button type="button" onClick={() => speak(`Resultado de ${draft.name}. Preço para cobrar: ${formatMoney(value.precoFacilCentavos)}. Abaixo de ${formatMoney(value.precoMinimoCentavos)} você perde dinheiro.`)} className="mt-5 inline-flex min-h-14 items-center gap-2 rounded-2xl border-2 border-foreground bg-card px-4 font-black"><Volume2 aria-hidden="true" /> Ouvir resumo</button>}

      {!state.meuDia.preenchido && !example && (
        <aside className="mt-8 rounded-2xl border-2 border-foreground bg-secondary p-5">
          <div className="flex gap-3"><Info className="shrink-0" aria-hidden="true" /><p className="font-bold">Seus gastos do dia e seu ganho ainda não estão neste preço.</p></div>
          <button type="button" onClick={onMeuDia} className="mt-4 min-h-14 w-full rounded-2xl border-2 border-foreground bg-card px-4 font-black">Preencher meu dia</button>
        </aside>
      )}

      <section className="mt-8 rounded-[2rem] border-2 border-foreground bg-card p-5">
        <button type="button" onClick={() => setExpanded(!expanded)} className="flex min-h-14 w-full items-center justify-between text-left font-display text-xl font-black" aria-expanded={expanded}>
          Ver outros valores {expanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
        </button>
        {expanded && (
          <div className="mt-3 grid gap-3 border-t-2 border-border pt-5">
            <div className="rounded-2xl bg-muted p-4"><strong className="block">Preço exato</strong><span className="text-xl font-black">{formatMoney(exact)}</span><p className="mt-1 text-muted-foreground">A conta antes do arredondamento.</p></div>
            <div className="rounded-2xl bg-muted p-4"><strong className="block">Preço mínimo</strong><span className="text-xl font-black">{formatMoney(value.precoMinimoCentavos)}</span><p className="mt-1 text-muted-foreground">Só cobre a mercadoria e os gastos.</p></div>
            <div className="rounded-2xl bg-muted p-4"><strong className="block">Preço recomendado</strong><span className="text-xl font-black">{formatMoney(value.precoRecomendadoCentavos)}</span><p className="mt-1 text-muted-foreground">Inclui seu ganho e a reserva.</p></div>
          </div>
        )}
      </section>

      <section className="mt-8 rounded-[2rem] border-2 border-foreground bg-card p-5">
        <h2 className="font-display text-3xl font-black">Comparar com os vizinhos</h2>
        <p className="mt-2 text-muted-foreground">Opcional. Esse valor não muda a sua conta.</p>
        <div className="mt-5">
          <label htmlFor="neighbors-price" className="font-display text-xl font-black">Quanto os outros cobram por isso?</label>
          <div className="mt-3 flex min-h-16 items-center rounded-2xl border-2 border-foreground bg-input-background px-4">
            <span className="mr-2 font-black">R$</span>
            <input id="neighbors-price" type="text" inputMode="decimal" value={neighbors} onChange={(event) => setNeighbors(sanitizeNumericInput(event.target.value))} className="min-w-0 flex-1 bg-transparent text-xl font-black outline-none" placeholder="0,00" />
          </div>
        </div>
        {(parseMoneyToCents(neighbors) ?? 0) > 0 && <p className="mt-5 rounded-2xl bg-muted p-4 font-bold">Vizinhos: {formatMoney(parseMoneyToCents(neighbors) ?? 0)}. Seu preço para cobrar: {formatMoney(value.precoFacilCentavos)}.</p>}
      </section>

      <section className="mt-8 rounded-[2rem] border-2 border-foreground bg-secondary p-5">
        <h2 className="font-display text-3xl font-black">Simulador do dia</h2>
        <p className="mt-2">Mude a quantidade para conferir como ficaria hoje.</p>
        <div className="mt-5">
          <label htmlFor="units-today" className="font-display text-xl font-black">Quantas unidades vendeu hoje?</label>
          <input id="units-today" type="text" inputMode="decimal" value={unitsToday} onChange={(event) => setUnitsToday(sanitizeNumericInput(event.target.value))} className="mt-3 min-h-16 w-full rounded-2xl border-2 border-foreground bg-card px-4 text-xl font-black outline-none" />
        </div>
        <p className="mt-5 text-lg">Depois de pagar mercadoria, taxa e gastos do dia, sobram <strong>{formatMoney(leftToday)}</strong>.</p>
        <p className="mt-2 font-black">{desiredDiff >= 0 ? `Passou ${formatMoney(desiredDiff)} do ganho desejado deste produto.` : `Faltam ${formatMoney(Math.abs(desiredDiff))} para o ganho desejado deste produto.`}</p>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-3xl font-black">O que dá pra mudar</h2>
        <p className="mt-2 text-muted-foreground">Simulação, não muda seu produto.</p>
        <div className="mt-5 grid gap-3">
          {simulations.map((item) => {
            const simulatedPrice = item.result.ok ? item.result.value.precoFacilCentavos : value.precoFacilCentavos;
            const difference = simulatedPrice - value.precoFacilCentavos;
            return (
              <article key={item.label} className="rounded-2xl border-2 border-foreground bg-card p-5">
                <h3 className="font-display text-xl font-black">{item.label}</h3>
                <p className="mt-3 text-lg">Novo preço para cobrar: <strong>{formatMoney(simulatedPrice)}</strong></p>
                <p className="mt-1 text-muted-foreground">Diferença: {difference === 0 ? formatMoney(0) : `${difference > 0 ? "+" : "−"} ${formatMoney(Math.abs(difference))}`}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-3xl font-black">Raio-X de cada venda</h2>
        <div className="mt-5 flex h-10 overflow-hidden rounded-xl border-2 border-foreground" aria-label="Barra com as partes do preço">
          {rows.map(([label, amount, color]) => amount > 0 && <span key={label} className={color} style={{ width: `${Math.max(2, amount / Math.max(barTotal, 1) * 100)}%` }} title={`${label}: ${formatMoney(amount)}`} />)}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {rows.map(([label, amount, color]) => (
            <div key={label} className="flex min-h-14 items-center justify-between rounded-2xl bg-card px-4">
              <span className="flex items-center gap-2"><i className={`size-4 rounded-full border border-foreground ${color}`} aria-hidden="true" />{label}</span>
              <strong>{formatMoney(amount)}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-[2rem] border-2 border-foreground bg-accent p-5 text-accent-foreground">
        <h2 className="flex items-center gap-3 font-display text-3xl font-black"><Store aria-hidden="true" /> Meta do dia</h2>
        {value.avisoMeta ? (
          <p className="mt-4 text-lg font-bold">{value.avisoMeta}</p>
        ) : (
          <p className="mt-4 text-lg leading-relaxed">
            Venda pelo menos <strong>{value.metaCobrirGastos && value.metaCobrirGastos > 999 ? "mais de 999" : value.metaCobrirGastos}</strong> para cobrir os gastos e <strong>{value.metaFecharDia && value.metaFecharDia > 999 ? "mais de 999" : value.metaFecharDia}</strong> para fechar o seu dia.
          </p>
        )}
      </section>

      <section className="mt-8 rounded-[2rem] border-2 border-foreground bg-card p-5">
        <h2 className="font-display text-3xl font-black">Como foi calculado</h2>
        <ol className="mt-5 grid gap-4">
          <li className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary font-black">1</span><p>Você pagou <strong>{formatMoney(parseMoneyToCents(draft.price) ?? 0)}</strong> e isso rende cerca de <strong>{getYield(draft).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</strong> vendas.</p></li>
          <li className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary font-black">2</span><p>A mercadoria, as perdas e a embalagem custam <strong>{formatMoney(value.custoVariavelUnCentavos)}</strong> em cada venda.</p></li>
          <li className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary font-black">3</span><p>Entram <strong>{formatMoney(value.gastoDiaUnCentavos)}</strong> dos gastos do dia e <strong>{formatMoney(value.ganhoUnCentavos)}</strong> para você em cada venda.</p></li>
          <li className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary font-black">4</span><p>A parte da maquininha e a reserva entram só depois. O preço foi arredondado para cima para facilitar a cobrança.</p></li>
        </ol>
      </section>

      {!example && (
        <section className="mt-8 rounded-[2rem] border-2 border-foreground bg-card p-5">
          <h2 className="font-display text-2xl font-black">Você entendeu por que esse preço?</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {([
              ["sim", "Sim"], ["mais-ou-menos", "Mais ou menos"], ["nao", "Não"],
            ] as const).map(([answer, label]) => (
              <button key={answer} type="button" onClick={() => onStateChange((old) => ({ ...old, dadosTeste: { ...old.dadosTeste, entendeuPreco: answer } }))} className={`min-h-14 rounded-2xl border-2 border-foreground px-3 font-black ${state.dadosTeste.entendeuPreco === answer ? "bg-secondary" : "bg-card"}`}>{label}</button>
            ))}
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={async () => {
          const text = `${draft.name}, preço para cobrar ${formatMoney(value.precoFacilCentavos)}, ${new Date().toLocaleDateString("pt-BR")}, calculado no Gerência Aí.`;
          if (navigator.share) {
            try { await navigator.share({ text }); return; } catch { /* A pessoa cancelou ou o aparelho não compartilhou. */ }
          }
          try { await navigator.clipboard.writeText(text); setCopied(true); } catch { setCopied(false); }
        }}
        className="mt-8 flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl border-2 border-foreground bg-card px-5 font-black"
      >
        {copied ? <Copy aria-hidden="true" /> : <Share2 aria-hidden="true" />} {copied ? "Resumo copiado" : "Compartilhar resumo"}
      </button>

      <div className="mt-9 grid gap-3">
        {!example && <button type="button" onClick={save} className="flex min-h-16 items-center justify-center gap-3 rounded-2xl border-2 border-foreground bg-primary px-5 font-display text-xl font-black text-primary-foreground shadow-[4px_4px_0_var(--foreground)]">
          {saved ? <Check aria-hidden="true" /> : <Save aria-hidden="true" />} {saved ? "Produto salvo" : "Salvar produto"}
        </button>}
        {!example && <button type="button" onClick={onNew} className="min-h-16 rounded-2xl border-2 border-foreground bg-secondary px-5 font-black">Calcular outro</button>}
        <button type="button" onClick={onHome} className="min-h-16 rounded-2xl border-2 border-foreground bg-card px-5 font-black">{example ? "Fechar exemplo" : "Ver meus produtos"}</button>
      </div>
    </main>
  );
}

export default function QuizProdutoScreen({ state, onStateChange, onBack, onMeuDia, onHome }: {
  state: AppState;
  onStateChange: React.Dispatch<React.SetStateAction<AppState>>;
  onBack: () => void;
  onMeuDia: () => void;
  onHome: () => void;
}) {
  const stored = state.rascunho.produto as { draft?: ProductDraft; step?: number; abrirResultado?: boolean; exemplo?: boolean; editando?: boolean } | undefined;
  const [draft, setDraft] = useState<ProductDraft>(() => stored?.draft ?? freshDraft(state.produtos.length === 0));
  const [step, setStep] = useState(() => stored?.step ?? 0);
  const [askRecovery, setAskRecovery] = useState(Boolean(stored?.draft) && !stored?.abrirResultado && !stored?.editando);
  const [error, setError] = useState("");
  const [showGoodsOnly, setShowGoodsOnly] = useState(false);
  const [showResult, setShowResult] = useState(Boolean(stored?.abrirResultado));
  const [example] = useState(Boolean(stored?.exemplo));
  const { available: canSpeak, speak } = usePortugueseVoice();

  useEffect(() => {
    if (askRecovery || showResult) return;
    onStateChange((old) => ({ ...old, rascunho: { ...old.rascunho, produto: { draft, step } } }));
  }, [draft, step, askRecovery, showResult, onStateChange]);

  useEffect(() => {
    if (!state.dadosTeste.primeiroQuizEm && !example) {
      onStateChange((old) => ({ ...old, dadosTeste: { ...old.dadosTeste, primeiroQuizEm: new Date().toISOString() } }));
    }
  }, [state.dadosTeste.primeiroQuizEm, example, onStateChange]);

  useEffect(() => {
    if (showResult && !state.dadosTeste.primeiroResultadoEm && !example) {
      onStateChange((old) => ({ ...old, dadosTeste: { ...old.dadosTeste, primeiroResultadoEm: new Date().toISOString() } }));
    }
  }, [showResult, state.dadosTeste.primeiroResultadoEm, example, onStateChange]);

  const result = useMemo(() => example ? calculatePricing({
    precoCompraCentavos: 4000,
    rendimento: 12,
    perda: 0.05,
    embalagemUnCentavos: 10,
    gastosDiaCentavos: 1900,
    vendasDia: 60,
    ganhoDesejadoDiaCentavos: 10000,
    fatia: 1,
    taxaMedia: 0.015,
    reserva: 0.1,
    passoArredondamentoCentavos: 50,
  }) : buildResult(draft, state), [draft, state, example]);
  const patch = (value: Partial<ProductDraft>) => setDraft((old) => ({ ...old, ...value }));
  const machineUsed = draft.payments.some((item) => item === "machine-pix" || item === "debit" || item === "credit");

  const next = () => {
    const message = validateStep(step, draft);
    if (message) {
      setError(message);
      return;
    }
    setError("");
    if (step === 7 && !machineUsed) setStep(9);
    else if (step === 9) setShowResult(true);
    else setStep((old) => old + 1);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const previous = () => {
    setError("");
    if (step === 9 && !machineUsed) setStep(7);
    else if (step > 0) setStep((old) => old - 1);
    else onBack();
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const reset = () => {
    const clean = freshDraft(state.produtos.length === 0);
    setDraft(clean);
    setStep(0);
    setShowResult(false);
    setShowGoodsOnly(false);
    setError("");
    onStateChange((old) => ({ ...old, rascunho: { ...old.rascunho, produto: { draft: clean, step: 0 } } }));
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  if (showGoodsOnly) return <GoodsOnly draft={draft} onBack={() => setShowGoodsOnly(false)} />;
  if (showResult) return <ResultScreen draft={draft} state={state} result={result} example={example} onStateChange={onStateChange} onEdit={() => setShowResult(false)} onNew={reset} onMeuDia={onMeuDia} onHome={() => {
    if (example) onStateChange((old) => ({ ...old, rascunho: {} }));
    onHome();
  }} />;

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 pb-12 pt-6 sm:px-6">
      {askRecovery && <DraftPrompt onContinue={() => setAskRecovery(false)} onDiscard={() => { const clean = freshDraft(state.produtos.length === 0); setDraft(clean); setStep(0); setAskRecovery(false); }} />}
      <Progress step={step} />
      <div id="quiz-question" className="mt-9">
        <StepContent step={step} draft={draft} patch={patch} error={error} />
      </div>
      {canSpeak && <button type="button" onClick={() => speak(document.getElementById("quiz-question")?.innerText ?? "")} className="mt-6 inline-flex min-h-14 items-center gap-2 rounded-2xl border-2 border-foreground bg-card px-4 font-black"><Volume2 aria-hidden="true" /> Ouvir</button>}
      {error && step !== 9 && <p role="alert" className="mt-6 rounded-2xl border-2 border-destructive bg-card p-4 font-bold text-destructive">{error}</p>}
      {step === 3 && draft.sellType && getYield(draft) > 0 && (
        <button type="button" onClick={() => setShowGoodsOnly(true)} className="mt-7 min-h-14 w-full rounded-2xl border-2 border-foreground bg-card px-4 font-bold">Ver só o preço da mercadoria</button>
      )}
      <div className="mt-10 grid grid-cols-[4rem_1fr] gap-3">
        <button type="button" onClick={previous} className="grid min-h-16 place-items-center rounded-2xl border-2 border-foreground bg-card" aria-label="Voltar"><ArrowLeft aria-hidden="true" /></button>
        <button type="button" onClick={next} className="flex min-h-16 items-center justify-between rounded-2xl border-2 border-foreground bg-primary px-5 font-display text-xl font-black text-primary-foreground shadow-[4px_4px_0_var(--foreground)]">
          {step === 9 ? "Ver meu preço" : "Continuar"} <ArrowRight aria-hidden="true" />
        </button>
      </div>
      <button type="button" onClick={onHome} className="mt-4 min-h-14 w-full rounded-2xl px-4 font-bold text-muted-foreground underline underline-offset-4">Salvar e continuar depois</button>
    </main>
  );
}

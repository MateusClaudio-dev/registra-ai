import { useState } from "react";
import { Copy, Moon, RotateCcw, Share2, Sun, Trash2, Type } from "lucide-react";
import { clearStoredState } from "../lib/storage";
import { formatMoney } from "../lib/money";
import type { Ajustes, DadosTeste, MeuDia, RoundStep, SavedProduct, TextSize } from "../lib/storage";

function Choices<T extends string | number>({ values, selected, onChange, labels }: {
  values: readonly T[];
  selected: T;
  onChange: (value: T) => void;
  labels: Record<string, string>;
}) {
  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-3">
      {values.map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={`min-h-14 rounded-2xl border-2 border-foreground px-3 font-bold ${selected === value ? "bg-secondary shadow-[3px_3px_0_var(--foreground)]" : "bg-card"}`}
          aria-pressed={selected === value}
        >
          {labels[String(value)]}
        </button>
      ))}
    </div>
  );
}

export default function PainelScreen({ value, meuDia, products, testData, onChange, onEditMeuDia, onClear }: {
  value: Ajustes;
  meuDia: MeuDia;
  products: SavedProduct[];
  testData: DadosTeste;
  onChange: (value: Ajustes) => void;
  onEditMeuDia: () => void;
  onClear: () => void;
}) {
  const update = (patch: Partial<Ajustes>) => onChange({ ...value, ...patch });
  const [message, setMessage] = useState("");
  const productsText = products.length
    ? `Meus produtos — Gerência Aí\n${products.map((item) => `• ${item.nome}: ${formatMoney(item.precoCentavos)} — atualizado em ${new Date(item.atualizadoEm).toLocaleDateString("pt-BR")}`).join("\n")}`
    : "Meus produtos — Gerência Aí\nNenhum produto salvo.";
  const elapsed = testData.primeiroQuizEm && testData.primeiroResultadoEm
    ? Math.max(0, Math.round((new Date(testData.primeiroResultadoEm).getTime() - new Date(testData.primeiroQuizEm).getTime()) / 1000))
    : null;
  const testText = [
    "Dados do teste — Gerência Aí",
    `Início do primeiro quiz: ${testData.primeiroQuizEm ? new Date(testData.primeiroQuizEm).toLocaleString("pt-BR") : "ainda não registrado"}`,
    `Primeiro resultado: ${testData.primeiroResultadoEm ? new Date(testData.primeiroResultadoEm).toLocaleString("pt-BR") : "ainda não registrado"}`,
    `Tempo até o primeiro preço: ${elapsed === null ? "ainda não registrado" : `${elapsed} segundos`}`,
    `Entendeu o preço: ${testData.entendeuPreco === "sim" ? "Sim" : testData.entendeuPreco === "mais-ou-menos" ? "Mais ou menos" : testData.entendeuPreco === "nao" ? "Não" : "ainda não respondeu"}`,
  ].join("\n");

  const copyText = async (text: string, success: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(success);
    } catch {
      setMessage("Não foi possível copiar neste aparelho.");
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6">
      <h1 className="font-display text-4xl font-black sm:text-5xl">Meu painel</h1>
      <p className="mt-3 text-lg text-muted-foreground">Deixe a tela mais confortável para você.</p>

      <div className="mt-8 grid gap-5">
        <section className="rounded-[2rem] border-2 border-foreground bg-card p-5">
          <div className="flex items-center gap-3"><Type aria-hidden="true" /><h2 className="font-display text-2xl font-black">Tamanho do texto</h2></div>
          <Choices<TextSize>
            values={["normal", "grande", "gigante"]}
            selected={value.tamanhoTexto}
            onChange={(tamanhoTexto) => update({ tamanhoTexto })}
            labels={{ normal: "Normal", grande: "Grande", gigante: "Gigante" }}
          />
        </section>

        <section className="rounded-[2rem] border-2 border-foreground bg-card p-5">
          <div className="flex items-center gap-3"><Moon aria-hidden="true" /><h2 className="font-display text-2xl font-black">Modo escuro</h2></div>
          <button type="button" onClick={() => update({ modoEscuro: !value.modoEscuro })} className={`mt-4 min-h-14 w-full rounded-2xl border-2 border-foreground px-4 font-bold ${value.modoEscuro ? "bg-secondary text-secondary-foreground" : "bg-muted"}`} aria-pressed={value.modoEscuro}>
            {value.modoEscuro ? "Ligado" : "Desligado"}
          </button>
        </section>

        <section className="rounded-[2rem] border-2 border-foreground bg-card p-5">
          <div className="flex items-center gap-3"><Sun aria-hidden="true" /><h2 className="font-display text-2xl font-black">Alto contraste para sol forte</h2></div>
          <p className="mt-2 text-muted-foreground">Quando ligado, ele vale mais que o modo escuro.</p>
          <button type="button" onClick={() => update({ altoContraste: !value.altoContraste })} className={`mt-4 min-h-14 w-full rounded-2xl border-2 border-foreground px-4 font-bold ${value.altoContraste ? "bg-secondary text-secondary-foreground" : "bg-muted"}`} aria-pressed={value.altoContraste}>
            {value.altoContraste ? "Ligado" : "Desligado"}
          </button>
        </section>

        <section className="rounded-[2rem] border-2 border-foreground bg-card p-5">
          <div className="flex items-center gap-3"><RotateCcw aria-hidden="true" /><h2 className="font-display text-2xl font-black">Arredondamento do preço</h2></div>
          <p className="mt-2 text-muted-foreground">O preço fácil sempre arredonda para cima.</p>
          <Choices<RoundStep>
            values={[10, 50, 100]}
            selected={value.arredondamentoCentavos}
            onChange={(arredondamentoCentavos) => update({ arredondamentoCentavos })}
            labels={{ "10": "R$ 0,10", "50": "R$ 0,50", "100": "R$ 1,00" }}
          />
        </section>

        <button type="button" onClick={onEditMeuDia} className="min-h-16 rounded-2xl border-2 border-foreground bg-accent px-5 text-left font-display text-xl font-black text-accent-foreground">
          {meuDia.preenchido ? "Editar meu dia" : "Preencher meu dia"}
        </button>

        <section className="rounded-[2rem] border-2 border-foreground bg-card p-5">
          <div className="flex items-center gap-3"><Share2 aria-hidden="true" /><h2 className="font-display text-2xl font-black">Copiar ou compartilhar meus produtos</h2></div>
          <p className="mt-2 text-muted-foreground">Um texto legível com os produtos salvos. Nada é enviado sozinho.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => copyText(productsText, "Produtos copiados.")} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-foreground bg-secondary px-4 font-bold"><Copy aria-hidden="true" /> Copiar</button>
            <button type="button" onClick={async () => {
              if (navigator.share) {
                try { await navigator.share({ text: productsText }); return; } catch { /* Compartilhamento cancelado. */ }
              }
              await copyText(productsText, "Produtos copiados.");
            }} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-foreground bg-card px-4 font-bold"><Share2 aria-hidden="true" /> Compartilhar</button>
          </div>
        </section>

        <section className="rounded-[2rem] border-2 border-foreground bg-card p-5">
          <h2 className="font-display text-2xl font-black">Dados do teste</h2>
          <p className="mt-2 text-muted-foreground">Ficam apenas neste aparelho até você copiar.</p>
          <div className="mt-4 whitespace-pre-line rounded-2xl bg-muted p-4">{testText}</div>
          <button type="button" onClick={() => copyText(testText, "Dados do teste copiados.")} className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-foreground bg-secondary px-4 font-bold"><Copy aria-hidden="true" /> Copiar dados do teste</button>
        </section>

        {message && <p className="rounded-2xl border-2 border-foreground bg-secondary p-4 font-bold" role="status">{message}</p>}

        <section className="rounded-[2rem] border-2 border-destructive bg-card p-5">
          <div className="flex items-center gap-3 text-destructive"><Trash2 aria-hidden="true" /><h2 className="font-display text-2xl font-black">Apagar meus dados</h2></div>
          <p className="mt-2 text-muted-foreground">Isso apaga seu dia, ajustes e produtos salvos neste aparelho.</p>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Apagar todos os seus dados deste aparelho? Essa ação não pode ser desfeita.")) {
                clearStoredState();
                onClear();
              }
            }}
            className="mt-4 min-h-14 w-full rounded-2xl border-2 border-destructive bg-destructive px-4 font-bold text-destructive-foreground"
          >
            Apagar todos os meus dados
          </button>
        </section>
      </div>
    </main>
  );
}

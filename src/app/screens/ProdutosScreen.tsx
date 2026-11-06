import { useMemo, useState } from "react";
import { ArrowLeft, Calculator, Copy, Edit3, RefreshCw, Search, Trash2, Undo2, WalletCards } from "lucide-react";
import { calcularGastosDoDia } from "../lib/pricing";
import { formatMoney, parseMoneyToCents, sanitizeNumericInput } from "../lib/money";
import type { AppState, SavedProduct } from "../lib/storage";
import { upsertProduct } from "../lib/storage";

const ageInDays = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

export default function ProdutosScreen({ state, onStateChange, onBack, onNew, onMeuDia, onEdit, onUpdateCost, onExample }: {
  state: AppState;
  onStateChange: React.Dispatch<React.SetStateAction<AppState>>;
  onBack: () => void;
  onNew: () => void;
  onMeuDia: () => void;
  onEdit: (product: SavedProduct) => void;
  onUpdateCost: (product: SavedProduct, price: string) => void;
  onExample: () => void;
}) {
  const [query, setQuery] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [newPrice, setNewPrice] = useState("");
  const [deleted, setDeleted] = useState<SavedProduct | null>(null);
  const gastos = calcularGastosDoDia(state.meuDia);
  const totalShare = state.produtos.reduce((sum, item) => sum + (item.fatiaDia ?? 0), 0);
  const products = useMemo(
    () => state.produtos.filter((item) => item.nome.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR"))),
    [query, state.produtos],
  );

  const remove = (product: SavedProduct) => {
    if (!window.confirm(`Apagar ${product.nome}?`)) return;
    setDeleted(product);
    onStateChange((old) => ({ ...old, produtos: old.produtos.filter((item) => item.id !== product.id) }));
  };

  const duplicate = (product: SavedProduct) => {
    const id = `produto-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const copy: SavedProduct = {
      ...product,
      id,
      nome: `${product.nome} — cópia`,
      atualizadoEm: new Date().toISOString(),
      dados: product.dados ? { ...product.dados, id, name: `${product.nome} — cópia` } : undefined,
    };
    onStateChange((old) => ({ ...old, produtos: upsertProduct(old.produtos, copy) }));
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 pb-24 pt-6 sm:px-6">
      <button type="button" onClick={onBack} className="inline-flex min-h-14 items-center gap-2 rounded-2xl border-2 border-foreground bg-card px-4 font-black" aria-label="Voltar">
        <ArrowLeft aria-hidden="true" /> Voltar
      </button>

      <header className="mt-7">
        <span className="inline-flex rounded-full border-2 border-foreground bg-secondary px-4 py-2 font-black">Salvo neste aparelho</span>
        <h1 className="mt-5 font-display text-4xl font-black sm:text-5xl">Meus produtos</h1>
      </header>

      <section className="mt-7 rounded-[2rem] border-2 border-foreground bg-accent p-5 text-accent-foreground shadow-[5px_5px_0_var(--foreground)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 font-display text-2xl font-black"><WalletCards aria-hidden="true" /> Meu dia</h2>
            {state.meuDia.preenchido
              ? <p className="mt-2 leading-relaxed">Gastos {formatMoney(gastos)} · você quer tirar {formatMoney(state.meuDia.ganhoDesejadoCentavos)} · {state.meuDia.diasSemana} dias por semana.</p>
              : <p className="mt-2 leading-relaxed">Ainda falta preencher. Sem isso, seus preços não incluem os gastos do dia nem o seu ganho.</p>}
          </div>
          <button type="button" onClick={onMeuDia} className="min-h-14 rounded-2xl border-2 border-foreground bg-card px-4 font-black text-card-foreground">{state.meuDia.preenchido ? "Editar" : "Preencher"}</button>
        </div>
      </section>

      {totalShare > 100 && (
        <aside className="mt-6 flex gap-3 rounded-2xl border-2 border-foreground bg-secondary p-5 font-bold">
          <Calculator className="shrink-0" aria-hidden="true" />
          <p>Seus produtos somam mais de 100% do seu dia. Revise as fatias.</p>
        </aside>
      )}

      <div className="mt-7">
        <label htmlFor="product-search" className="font-display text-xl font-black">Buscar por nome</label>
        <div className="mt-3 flex min-h-16 items-center rounded-2xl border-2 border-foreground bg-card px-4 focus-within:ring-4 focus-within:ring-ring/35">
          <Search className="mr-3 shrink-0" aria-hidden="true" />
          <input id="product-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-xl font-bold outline-none" placeholder="Ex.: queijo coalho" />
        </div>
      </div>

      {state.produtos.length === 0 ? (
        <section className="mt-10 rounded-[2rem] border-2 border-dashed border-foreground bg-card p-7 text-center">
          <span className="text-6xl" aria-hidden="true">📦</span>
          <h2 className="mt-5 font-display text-3xl font-black">Nenhum produto precificado ainda.</h2>
          <p className="mt-3 text-muted-foreground">Calcule seu primeiro produto ou abra um exemplo.</p>
          <button type="button" onClick={onNew} className="mt-7 min-h-16 w-full rounded-2xl border-2 border-foreground bg-primary px-5 font-display text-xl font-black text-primary-foreground shadow-[4px_4px_0_var(--foreground)]">Calcular produto</button>
          <button type="button" onClick={onExample} className="mt-3 min-h-14 w-full rounded-2xl border-2 border-foreground bg-secondary px-5 font-black">Ver exemplo</button>
        </section>
      ) : products.length === 0 ? (
        <section className="mt-8 rounded-2xl border-2 border-foreground bg-card p-6">
          <h2 className="font-display text-2xl font-black">Nenhum nome encontrado.</h2>
          <p className="mt-2 text-muted-foreground">Tente buscar de outro jeito.</p>
        </section>
      ) : (
        <section className="mt-8 grid gap-5">
          {products.map((product) => {
            const emoji = typeof product.dados?.emoji === "string" ? product.dados.emoji : "📦";
            const oldCost = ageInDays(product.atualizadoEm) > 15;
            const updating = updatingId === product.id;
            return (
              <article key={product.id} className="rounded-[2rem] border-2 border-foreground bg-card p-5 shadow-[5px_5px_0_var(--foreground)]">
                <div className="flex items-start gap-4">
                  <span className="grid size-14 shrink-0 place-items-center rounded-2xl border-2 border-foreground bg-secondary text-2xl">{emoji}</span>
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words font-display text-2xl font-black">{product.nome}</h2>
                    <p className="mt-2 font-display text-3xl font-black">{formatMoney(product.precoCentavos)}</p>
                    <p className="mt-1 text-muted-foreground">Preço para cobrar</p>
                    <p className="mt-3">Custo atualizado em {new Date(product.atualizadoEm).toLocaleDateString("pt-BR")}.</p>
                  </div>
                </div>

                {oldCost && <p className="mt-5 rounded-2xl bg-muted p-4 font-bold">Faz mais de 15 dias que você atualizou este custo.</p>}

                {updating && (
                  <div className="mt-5 rounded-2xl border-2 border-foreground bg-muted p-4">
                    <label htmlFor={`cost-${product.id}`} className="font-display text-xl font-black">Novo preço de compra</label>
                    <div className="mt-3 flex min-h-16 items-center rounded-2xl border-2 border-foreground bg-card px-4">
                      <span className="mr-2 font-black">R$</span>
                      <input id={`cost-${product.id}`} type="text" inputMode="decimal" value={newPrice} onChange={(event) => setNewPrice(sanitizeNumericInput(event.target.value))} className="min-w-0 flex-1 bg-transparent text-xl font-black outline-none" placeholder="0,00" autoFocus />
                    </div>
                    <button
                      type="button"
                      disabled={(parseMoneyToCents(newPrice) ?? 0) < 1}
                      onClick={() => onUpdateCost(product, newPrice)}
                      className="mt-3 min-h-14 w-full rounded-2xl border-2 border-foreground bg-primary px-4 font-black text-primary-foreground disabled:opacity-50"
                    >
                      Atualizar e ver resultado
                    </button>
                  </div>
                )}

                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={() => { setUpdatingId(updating ? null : product.id); setNewPrice(typeof product.dados?.price === "string" ? product.dados.price : ""); }} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-foreground bg-primary px-3 font-black text-primary-foreground"><RefreshCw aria-hidden="true" /> Atualizar custo</button>
                  <button type="button" onClick={() => onEdit(product)} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-foreground bg-secondary px-3 font-black"><Edit3 aria-hidden="true" /> Editar</button>
                  <button type="button" onClick={() => duplicate(product)} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-foreground bg-card px-3 font-black"><Copy aria-hidden="true" /> Duplicar</button>
                  <button type="button" onClick={() => remove(product)} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-destructive bg-card px-3 font-black text-destructive"><Trash2 aria-hidden="true" /> Apagar</button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {state.produtos.length > 0 && (
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={onNew} className="min-h-16 rounded-2xl border-2 border-foreground bg-primary px-5 font-display text-xl font-black text-primary-foreground shadow-[4px_4px_0_var(--foreground)]">Calcular outro produto</button>
          <button type="button" onClick={onExample} className="min-h-16 rounded-2xl border-2 border-foreground bg-secondary px-5 font-black">Ver exemplo</button>
        </div>
      )}

      {deleted && (
        <div className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-xl items-center justify-between gap-3 rounded-2xl border-2 border-foreground bg-foreground p-4 text-background shadow-lg" role="status">
          <p className="font-bold">Produto apagado.</p>
          <button type="button" onClick={() => { onStateChange((old) => ({ ...old, produtos: upsertProduct(old.produtos, deleted) })); setDeleted(null); }} className="flex min-h-14 items-center gap-2 rounded-xl border-2 border-background px-4 font-black"><Undo2 aria-hidden="true" /> Desfazer</button>
        </div>
      )}
    </main>
  );
}

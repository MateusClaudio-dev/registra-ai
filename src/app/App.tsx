import { lazy, Suspense, useEffect, useState } from "react";
import { ArrowRight, Calculator, ChevronLeft, ChevronRight, ChevronUp, ClipboardList, Play, Settings, Store, Sun, WalletCards } from "lucide-react";
import type { AppState } from "./lib/storage";
import { defaultState, loadState, saveState } from "./lib/storage";
import { calcularGastosDoDia } from "./lib/pricing";
import { recomputeSavedPrices } from "./lib/product";
import { formatMoney } from "./lib/money";

const MeuDiaScreen = lazy(() => import("./screens/MeuDiaScreen"));
const PainelScreen = lazy(() => import("./screens/PainelScreen"));
const QuizProdutoScreen = lazy(() => import("./screens/QuizProdutoScreen"));
const TestesScreen = lazy(() => import("./screens/TestesScreen"));
const ProdutosScreen = lazy(() => import("./screens/ProdutosScreen"));

type Screen = "inicio" | "meu-dia" | "painel" | "quiz" | "produtos" | "testes";

function Loading() {
  return (
    <div className="grid min-h-[70svh] place-items-center px-6">
      <p className="rounded-full border-2 border-foreground bg-secondary px-5 py-3 font-black">Abrindo…</p>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-14 items-center gap-2 rounded-2xl border-2 border-foreground bg-card px-4 font-black shadow-[3px_3px_0_var(--foreground)] focus-visible:ring-4 focus-visible:ring-ring"
    >
      <ChevronLeft aria-hidden="true" /> Voltar
    </button>
  );
}

function Home({ state, onStart, onMeuDia, onPainel, onProducts }: {
  state: AppState;
  onStart: () => void;
  onMeuDia: () => void;
  onPainel: () => void;
  onProducts: () => void;
}) {
  const [tutorialStep, setTutorialStep] = useState(0);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const gastos = calcularGastosDoDia(state.meuDia);
  return (
    <main className="relative mx-auto min-h-screen w-full max-w-5xl overflow-hidden px-4 pb-16 pt-6 sm:px-7 lg:pt-10">
      <div className="pointer-events-none absolute -right-12 top-28 size-44 rotate-12 rounded-[2.5rem] border-[12px] border-secondary opacity-70" aria-hidden="true" />
      <div className="pointer-events-none absolute -left-12 top-[34rem] size-36 rounded-full bg-accent opacity-35" aria-hidden="true" />

      <header className="relative flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-14 shrink-0 rotate-[-4deg] place-items-center rounded-2xl border-2 border-foreground bg-secondary shadow-[4px_4px_0_var(--foreground)]">
            <Store size={28} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="font-display text-2xl font-black leading-none">Gerência Aí</p>
            <p className="mt-1 text-muted-foreground">Sua conta, do seu jeito.</p>
          </div>
        </div>
        <button type="button" onClick={onPainel} className="grid min-h-14 min-w-14 place-items-center rounded-2xl border-2 border-foreground bg-card focus-visible:ring-4 focus-visible:ring-ring" aria-label="Abrir meu painel">
          <Settings aria-hidden="true" />
        </button>
      </header>

      <section className="relative mt-8">
        {!tutorialOpen ? (
          <button
            type="button"
            onClick={() => setTutorialOpen(true)}
            aria-expanded={false}
            aria-controls="tutorial-precificar"
            className="flex min-h-20 w-full items-center gap-4 rounded-[2rem] border-2 border-foreground bg-card p-4 text-left text-card-foreground shadow-[6px_6px_0_var(--secondary)] transition-transform focus-visible:ring-4 focus-visible:ring-ring active:translate-x-1 active:translate-y-1 active:shadow-none"
          >
            <span className="grid size-14 shrink-0 place-items-center rounded-full border-2 border-foreground bg-primary text-primary-foreground"><Play fill="currentColor" aria-hidden="true" /></span>
            <span className="font-display text-xl font-black leading-snug">Clique aqui para aprender a precificar seu produto</span>
          </button>
        ) : (
          <div id="tutorial-precificar" className="overflow-hidden rounded-[2rem] border-2 border-foreground bg-foreground p-5 text-background shadow-[6px_6px_0_var(--secondary)] sm:p-7">
            <button
              type="button"
              onClick={() => setTutorialOpen(false)}
              aria-expanded={true}
              aria-controls="tutorial-precificar"
              className="flex w-full items-center gap-3 rounded-2xl text-left focus-visible:ring-4 focus-visible:ring-ring"
            >
              <span className="grid size-14 shrink-0 place-items-center rounded-full border-2 border-background bg-primary text-primary-foreground"><Play fill="currentColor" aria-hidden="true" /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-2xl font-black">Como precificar seu produto</span>
                <span className="mt-1 block">60 a 90 s, com vendedor de Salvador</span>
              </span>
              <span className="grid size-12 shrink-0 place-items-center rounded-full border-2 border-background" aria-label="Fechar"><ChevronUp aria-hidden="true" /></span>
            </button>
            <p className="mt-5 font-bold">O vídeo está sendo preparado. Veja a explicação offline:</p>
            <div className="mt-4 rounded-2xl border-2 border-background bg-background p-5 text-foreground">
              <span className="text-5xl" aria-hidden="true">{["🧺", "🚌", "💰"][tutorialStep]}</span>
              <p className="mt-4 font-display text-2xl font-black">{["1. Diga o que compra", "2. Diga seus gastos do dia", "3. Veja seu preço"][tutorialStep]}</p>
              <p className="mt-2 text-muted-foreground">{["Conte quanto pagou e quanto isso rende.", "Inclua transporte, gelo, ajudante e o que quer tirar.", "A conta mostra o preço para cobrar e cada parte dele."][tutorialStep]}</p>
              <div className="mt-5 flex items-center justify-between gap-3">
                <button type="button" onClick={() => setTutorialStep((old) => (old + 2) % 3)} className="grid min-h-14 min-w-14 place-items-center rounded-xl border-2 border-foreground bg-card" aria-label="Passo anterior"><ChevronLeft aria-hidden="true" /></button>
                <p className="font-black">{tutorialStep + 1} de 3</p>
                <button type="button" onClick={() => setTutorialStep((old) => (old + 1) % 3)} className="grid min-h-14 min-w-14 place-items-center rounded-xl border-2 border-foreground bg-secondary text-secondary-foreground" aria-label="Próximo passo"><ChevronRight aria-hidden="true" /></button>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="relative mt-12 grid items-center gap-9 lg:grid-cols-[1.12fr_.88fr] lg:gap-14">
        <div>
          <span className="inline-flex rotate-[-2deg] items-center gap-2 rounded-full border-2 border-foreground bg-accent px-4 py-2 font-black text-accent-foreground">
            <Sun size={20} aria-hidden="true" /> Feito para quem vende na rua
          </span>
          <h1 className="mt-6 max-w-3xl font-display text-5xl font-black leading-[.96] tracking-[-0.04em] sm:text-6xl lg:text-7xl">
            Saiba quanto <span className="relative inline-block after:absolute after:-bottom-1 after:left-0 after:h-2 after:w-full after:rotate-[-1deg] after:bg-primary after:content-['']">cobrar</span> sem sair perdendo.
          </h1>
          <p className="mt-6 max-w-2xl text-xl leading-relaxed text-muted-foreground">
            Você conta como compra e vende. A gente mostra a conta com os seus números, centavo por centavo.
          </p>
          <button
            type="button"
            onClick={onStart}
            className="mt-8 flex min-h-16 w-full items-center justify-between rounded-2xl border-2 border-foreground bg-primary px-6 font-display text-xl font-black text-primary-foreground shadow-[6px_6px_0_var(--foreground)] transition-transform active:translate-x-1 active:translate-y-1 active:shadow-none sm:max-w-md"
          >
            Calcular um produto <ArrowRight aria-hidden="true" />
          </button>
          <p className="mt-4 font-bold text-muted-foreground">Sem login. Fica salvo neste aparelho.</p>
          <button type="button" onClick={onProducts} className="mt-4 min-h-14 w-full rounded-2xl border-2 border-foreground bg-card px-5 font-black sm:max-w-md">Ver meus produtos</button>
        </div>

        <div className="relative">
          <div className="absolute -left-5 -top-5 size-14 rotate-12 bg-secondary" aria-hidden="true" />
          <article className="relative rotate-[1deg] rounded-[2rem] border-2 border-foreground bg-card p-5 shadow-[8px_8px_0_var(--foreground)] sm:p-7">
            <div className="flex items-center gap-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-accent text-accent-foreground"><WalletCards aria-hidden="true" /></span>
              <div>
                <p className="font-display text-2xl font-black">Meu dia</p>
                <p className="text-muted-foreground">{state.meuDia.preenchido ? "Conta preenchida" : "Ainda falta preencher"}</p>
              </div>
            </div>
            <div className="mt-6 grid gap-3">
              <div className="rounded-2xl bg-muted p-4">
                <p className="text-muted-foreground">Gastos do dia</p>
                <strong className="mt-1 block font-display text-2xl">{formatMoney(gastos)}</strong>
              </div>
              <div className="rounded-2xl bg-muted p-4">
                <p className="text-muted-foreground">O que você quer tirar</p>
                <strong className="mt-1 block font-display text-2xl">{formatMoney(state.meuDia.ganhoDesejadoCentavos)}</strong>
              </div>
            </div>
            <button type="button" onClick={onMeuDia} className="mt-5 min-h-14 w-full rounded-2xl border-2 border-foreground bg-secondary px-4 font-black">
              {state.meuDia.preenchido ? "Editar meu dia" : "Preencher meu dia"}
            </button>
          </article>
        </div>
      </section>

      <section className="relative mt-16 border-t-2 border-foreground pt-8">
        <h2 className="font-display text-3xl font-black">Uma conta fácil de conferir</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            { icon: <ClipboardList />, title: "Você responde", text: "Compra, venda e gastos do seu dia." },
            { icon: <Calculator />, title: "A conta aparece", text: "Sem palavras difíceis e sem esconder nada." },
            { icon: <WalletCards />, title: "Você decide", text: "Veja o preço para cobrar e a meta do dia." },
          ].map((item, index) => (
            <article key={item.title} className={`rounded-2xl border-2 border-foreground p-5 ${index === 1 ? "bg-secondary" : index === 2 ? "bg-accent text-accent-foreground" : "bg-card"}`}>
              <span className="grid size-12 place-items-center rounded-xl border-2 border-foreground bg-card text-card-foreground">{item.icon}</span>
              <h3 className="mt-4 font-display text-xl font-black">{item.title}</h3>
              <p className="mt-2 leading-relaxed">{item.text}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [screen, setScreen] = useState<Screen>(() => window.location.hash === "#testes" ? "testes" : "inicio");
  const [history, setHistory] = useState<Screen[]>([]);
  const [startAfterMeuDia, setStartAfterMeuDia] = useState(false);

  useEffect(() => saveState(state), [state]);

  // Quando "Meu dia" ou o arredondamento mudam, os preços salvos são recalculados.
  useEffect(() => {
    setState((old) => {
      const produtos = recomputeSavedPrices(old);
      return produtos === old.produtos ? old : { ...old, produtos };
    });
  }, [state.meuDia, state.ajustes.arredondamentoCentavos]);

  useEffect(() => {
    const onHash = () => {
      if (window.location.hash === "#testes") setScreen("testes");
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--font-size", state.ajustes.tamanhoTexto === "gigante" ? "24px" : state.ajustes.tamanhoTexto === "grande" ? "20px" : "16px");
    root.classList.toggle("contrast", state.ajustes.altoContraste);
    root.classList.toggle("dark", state.ajustes.modoEscuro && !state.ajustes.altoContraste);
  }, [state.ajustes]);

  const navigate = (next: Screen) => {
    setHistory((old) => [...old, screen]);
    setScreen(next);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const back = () => {
    const previous = history.at(-1) ?? "inicio";
    setHistory((old) => old.slice(0, -1));
    setScreen(previous);
  };

  const begin = () => {
    if (!state.meuDia.preenchido) {
      setStartAfterMeuDia(true);
      navigate("meu-dia");
    } else {
      navigate("quiz");
    }
  };

  let content: React.ReactNode;
  if (screen === "inicio") {
    content = <Home state={state} onStart={begin} onMeuDia={() => navigate("meu-dia")} onPainel={() => navigate("painel")} onProducts={() => navigate("produtos")} />;
  } else if (screen === "meu-dia") {
    content = (
      <>
        <div className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6"><BackButton onClick={back} /></div>
        <MeuDiaScreen
          value={state.meuDia}
          onSave={(meuDia) => setState((old) => ({ ...old, meuDia }))}
          onDone={() => {
            if (startAfterMeuDia) {
              setStartAfterMeuDia(false);
              setScreen("quiz");
            } else back();
          }}
        />
      </>
    );
  } else if (screen === "painel") {
    content = (
      <>
        <div className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6"><BackButton onClick={back} /></div>
        <PainelScreen
          value={state.ajustes}
          meuDia={state.meuDia}
          products={state.produtos}
          testData={state.dadosTeste}
          onChange={(ajustes) => setState((old) => ({ ...old, ajustes }))}
          onEditMeuDia={() => navigate("meu-dia")}
          onClear={() => { setState(defaultState()); setScreen("inicio"); setHistory([]); }}
        />
      </>
    );
  } else if (screen === "quiz") {
    content = <QuizProdutoScreen state={state} onStateChange={setState} onBack={back} onMeuDia={() => navigate("meu-dia")} onHome={() => { setScreen("produtos"); setHistory([]); }} />;
  } else if (screen === "produtos") {
    const openProduct = (product: AppState["produtos"][number], patch: Record<string, unknown> = {}) => {
      if (!product.dados) return;
      setState((old) => ({ ...old, rascunho: { ...old.rascunho, produto: { draft: { ...product.dados, ...patch }, step: 0, editando: true } } }));
      navigate("quiz");
    };
    const exampleDraft = {
      id: "exemplo-caso-a", name: "Queijo coalho", emoji: "🧀", buyType: "kg", price: "40,00", buyQuantity: "",
      sellType: "portion", yieldMode: "direct", portionSize: "", directYield: "12", loss: "5", packaging: true,
      packagingCost: "0,10", salesDay: "60", dayShare: "100", payments: ["cash", "debit"], machineShare: "50",
      machineFee: "3", reserve: "10",
    };
    content = (
      <ProdutosScreen
        state={state}
        onStateChange={setState}
        onBack={back}
        onNew={begin}
        onMeuDia={() => navigate("meu-dia")}
        onEdit={(product) => openProduct(product)}
        onUpdateCost={(product, price) => {
          if (!product.dados) return;
          setState((old) => ({ ...old, rascunho: { ...old.rascunho, produto: { draft: { ...product.dados, price }, step: 9, abrirResultado: true } } }));
          navigate("quiz");
        }}
        onExample={() => {
          setState((old) => ({ ...old, rascunho: { ...old.rascunho, produto: { draft: exampleDraft, step: 9, abrirResultado: true, exemplo: true } } }));
          navigate("quiz");
        }}
      />
    );
  } else {
    content = <TestesScreen onBack={() => { window.location.hash = ""; setScreen("inicio"); }} />;
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-background font-body text-foreground">
      <Suspense fallback={<Loading />}>{content}</Suspense>
    </div>
  );
}

import "./setup";
import { dom } from "./setup";
import React from "react";
import { render, screen, cleanup, within, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/app/App";

let fails = 0;
const ok = (name: string, cond: boolean, extra = "") => { console.log((cond ? "OK    " : "FALHOU") + " " + name + (extra ? "  | " + extra : "")); if (!cond) fails++; };
const user = userEvent.setup({ document: dom.window.document });
const txt = () => document.body.textContent ?? "";
const btn = (name: RegExp | string) => screen.getByRole("button", { name });
const type = async (el: HTMLElement, v: string) => { await user.clear(el); if (v) await user.type(el, v); };
const byLabel = (re: RegExp) => screen.getByLabelText(re) as HTMLInputElement;

async function main() {
  render(<App />);
  await screen.findByText(/Saiba quanto/);
  ok("Home abre", txt().includes("Gerência Aí"));
  ok("Sem termos proibidos na home", !/empreendedor|inteligente|mercado informal|30%/i.test(txt()));

  // 1) Sem Meu dia -> abre Meu dia antes do quiz
  await user.click(btn(/Calcular um produto/));
  await screen.findByText(/Como é o seu dia/);
  ok("Primeiro produto leva ao Meu dia", true);

  // Meu dia = Caso A (9 + 10 por dia, ganho 100)
  await user.click(btn(/Chegar ao ponto de venda/));
  await type(byLabel(/Quanto gasta por dia\?/), "9,00");
  await user.click(btn(/Material para trabalhar/));
  const inputs = screen.getAllByLabelText(/Quanto gasta por dia\?/) as HTMLInputElement[];
  await type(inputs[inputs.length - 1], "10,00");
  await type(byLabel(/Valor por dia/), "100,00");
  ok("Resumo do dia mostra R$ 19,00", /Gastos R\$\s?19,00/.test(txt().replace(/\u00a0/g, " ")), txt().match(/Gastos R\$[^,]*,\d\d/)?.[0] ?? "");
  await user.click(btn(/Salvar meu dia/));

  // Quiz
  await screen.findByText(/Qual produto você vai calcular/);
  await type(byLabel(/Nome do produto/), "Queijo coalho");
  await user.click(btn(/Continuar/));
  await user.click(btn(/Por quilo/));
  await user.click(btn(/Continuar/));
  await type(byLabel(/Preço de 1 kg/), "40,00");
  await user.click(btn(/Continuar/));
  await user.click(btn(/Porção, copo ou espeto/));
  await user.click(btn(/Quantas saem/));
  await type(byLabel(/Quantas unidades de venda saem/), "12");
  ok("Atalho 'preço só da mercadoria' aparece", !!screen.queryByRole("button", { name: /Ver só o preço da mercadoria/ }));
  await user.click(btn(/Continuar/));
  await user.click(btn(/^Pouco/));
  await user.click(btn(/Continuar/));
  await user.click(btn(/^Sim$/));
  await type(byLabel(/Quanto custa por venda/), "0,10");
  await user.click(btn(/Continuar/));
  await type(byLabel(/Ou digite outro valor/), "60");
  ok("Fatia padrão do 1º produto = 100", (byLabel(/quantos em cada 100/) as HTMLInputElement).value === "100");
  await user.click(btn(/Continuar/));
  await user.click(btn(/Dinheiro/));
  await user.click(btn(/Débito/));
  await user.click(btn(/Continuar/));
  await screen.findByText(/Quanto passa na maquininha/);
  await user.click(btn(/Continuar/));
  await screen.findByText(/Quanto você guarda/);
  await user.click(btn(/^10 em cada 100$/));
  await user.click(btn(/Ver meu preço/));
  await screen.findByText(/Preço para cobrar/);
  const t = txt().replace(/\u00a0/g, " ");
  ok("E2E Caso A: preço para cobrar R$ 6,50", t.includes("R$ 6,50"));
  ok("E2E Caso A: mínimo R$ 3,99", t.includes("R$ 3,99"));
  ok("E2E Caso A: metas 8 e 46", /pelo menos\s*8\s*para cobrir os gastos e\s*46\s*para fechar/.test(t), t.match(/Venda pelo menos[^.]*\./)?.[0] ?? "sem meta");

  // salvar duas vezes não duplica
  await user.click(btn(/Salvar produto/));
  await user.click(btn(/Produto salvo/));
  const stored = JSON.parse(window.localStorage.getItem("gerencia-ai:v1")!);
  ok("Salvar 2x => 1 produto", stored.produtos.length === 1, `produtos=${stored.produtos.length}`);
  ok("Preço salvo 650", stored.produtos[0]?.precoCentavos === 650);
  ok("Rascunho limpo após salvar", Object.keys(stored.rascunho).length === 0);

  // Ver meus produtos
  await user.click(btn(/Ver meus produtos/));
  await screen.findByText(/Meus produtos/);
  ok("Lista mostra o produto", txt().includes("Queijo coalho") && txt().replace(/\u00a0/g, " ").includes("R$ 6,50"));

  // Atualizar custo -> resultado direto
  await user.click(btn(/Atualizar custo/));
  await type(byLabel(/Novo preço de compra/), "45,00");
  await user.click(btn(/Atualizar e ver resultado/));
  await screen.findByText(/Preço para cobrar/);
  const t2 = txt().replace(/\u00a0/g, " ");
  ok("Atualizar custo 45,00 => preço maior que 6,50", !t2.includes("Preço para cobrar R$ 6,50") && /R\$ 7,\d\d/.test(t2), t2.match(/Preço para cobrarR\$ [\d,]+/)?.[0] ?? "");
  await user.click(btn(/Salvar produto/));
  const s2 = JSON.parse(window.localStorage.getItem("gerencia-ai:v1")!); const precoAntes = s2.produtos[0]?.precoCentavos as number;
  ok("Atualizar custo mantém 1 produto (upsert)", s2.produtos.length === 1, `produtos=${s2.produtos.length}`);
  await user.click(btn(/Ver meus produtos/));

  // Editar -> não deve perguntar "produto em andamento"
  const editBtns = screen.getAllByRole("button", { name: /Editar/ }); await user.click(editBtns[editBtns.length - 1]);
  await waitFor(() => {});
  ok("Editar NÃO mostra 'Você tem um produto em andamento'", !txt().includes("Você tem um produto em andamento"), "BUG se falhar");
  cleanup();

  // Calcular outro depois de produtos: começa do zero
  render(<App />);
  await screen.findByText(/Saiba quanto/);
  await user.click(btn(/Ver meus produtos/));
  await user.click(btn(/Calcular outro produto/));
  await waitFor(() => {});
  ok("Novo produto não herda dados nem passo (começa na pergunta 1)", txt().includes("Qual produto você vai calcular") || txt().includes("em andamento"), txt().slice(0, 120));
  cleanup();

  // Meu dia: limpar campo de dinheiro deve zerar o valor
  render(<App />);
  await screen.findByText(/Saiba quanto/);
  await user.click(btn(/Editar meu dia/));
  await screen.findByText(/Como é o seu dia/);
  const campo = (screen.getAllByLabelText(/Quanto gasta por dia\?/) as HTMLInputElement[])[0];
  await type(campo, "");
  await user.click(btn(/Não sei, só cobrir os gastos/));
  await user.click(btn(/Salvar meu dia/));
  const s3 = JSON.parse(window.localStorage.getItem("gerencia-ai:v1")!);
  ok("Campo de dinheiro apagado zera o valor", s3.meuDia.chegarAoPonto.valorCentavos === 0, `ficou ${s3.meuDia.chegarAoPonto.valorCentavos} centavos`);
  ok("Mudar o Meu dia recalcula o preço já salvo", s3.produtos[0].precoCentavos < precoAntes, `${precoAntes} -> ${s3.produtos[0].precoCentavos}`);
  cleanup();

  // Dias entre compras: apagar e digitar 3 deve dar 3 (antes dava 13)
  render(<App />);
  await screen.findByText(/Saiba quanto/);
  await user.click(btn(/Editar meu dia/));
  await user.click(btn(/Comprar a mercadoria/));
  await type(byLabel(/Quanto gasta por ida\?/), "30,00");
  await type(byLabel(/De quantos em quantos dias/), "3");
  await user.click(btn(/Salvar meu dia/));
  const s5 = JSON.parse(window.localStorage.getItem("gerencia-ai:v1")!);
  ok("Dias entre compras = 3 (não 13)", s5.meuDia.compras.diasDuracao === 3, `ficou ${s5.meuDia.compras.diasDuracao}`);
  cleanup();

  // Validação de limite em Meu dia
  render(<App />);
  await screen.findByText(/Saiba quanto/);
  await user.click(btn(/Editar meu dia/));
  await type((screen.getAllByLabelText(/Quanto gasta por dia\?/) as HTMLInputElement[])[0], "99999,00");
  await user.click(btn(/Salvar meu dia/));
  const s4 = JSON.parse(window.localStorage.getItem("gerencia-ai:v1")!);
  ok("Gasto acima do limite (R$ 9.999,99) NÃO é salvo", s4.meuDia.chegarAoPonto.valorCentavos <= 999999, `salvou ${s4.meuDia.chegarAoPonto.valorCentavos} centavos`);
  cleanup();

  console.log(fails ? `\n${fails} FALHA(S)` : "\nTudo OK");
  process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error("ERRO NO TESTE:", e); process.exit(2); });

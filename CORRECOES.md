# Gerência Aí — correções desta revisão

## Bugs corrigidos (todos reproduzidos por teste antes de corrigir)
1. **Editar produto** mostrava "Você tem um produto em andamento" por engano. Agora abre direto.
2. **Meu dia: apagar um campo de dinheiro** deixava o valor antigo escondido (ficava 900 centavos com o campo vazio). Agora zera.
3. **Meu dia: valores acima do limite** (ex.: R$ 99.999 por dia) eram salvos. Agora o salvamento é bloqueado com mensagem.
4. **Mensagens de limite mostravam centavos** ("entre 1 e 9.999.999"). Agora mostram reais ("entre R$ 0,01 e R$ 99.999,99").
5. **"De quantos em quantos dias você compra?"** não deixava apagar o 1 (digitar 3 virava 13). Agora é um campo normal e seleciona o texto ao focar.
6. **Preços salvos ficavam velhos** quando "Meu dia" ou o arredondamento mudavam. Agora são recalculados (lib/product.ts → recomputeSavedPrices).

## Contraste e acessibilidade
- Texto de apoio nos cartões amarelos selecionados: 3,9:1 → texto escuro (≥ 4,5:1).
- Modo escuro: texto claro sobre amarelo/verde-água ficava em 1,0–1,5:1. Fundos escurecidos (secondary #5E4C00, accent #0D5F4E) com texto claro (≥ 7:1).
- Barra de progresso com role="progressbar".
- Botão "Ouvir" reconhece vozes "pt_BR" (Android) além de "pt-BR".

## Sem rede
- Google Fonts removido. Nunito e DM Sans variáveis (subconjunto latino, ~76 KB) agora vêm no próprio app.
- index.html em pt-BR, com título e descrição do projeto.

## Organização
- Lógica do produto movida para src/app/lib/product.ts (rendimento, entrada do cálculo, recálculo de preços salvos).
- Meu dia/Produtos: aviso claro quando o dia ainda não foi preenchido.

## Testes
`bash qa/run.sh` roda (1) o motor de cálculo e validações e (2) o fluxo completo do app em jsdom: Caso A pela interface (R$ 6,50, mínimo R$ 3,99, metas 8 e 46), salvar duas vezes, atualizar custo, editar, Meu dia e limites.
A rota `#testes` dentro do app continua rodando os Casos A e B.

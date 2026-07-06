# Impostos
> Última atualização: 2026-07-06

## Objetivo

Controlar o vencimento de impostos e tributos — únicos, parcelados ou anuais — que costumam ter multa/juros elevados por atraso e datas que mudam ano a ano conforme calendário oficial, exigindo checagem ativa (não é uma conta com dia fixo todo mês).

## O que entra aqui

- IPTU (parcelado ou cota única).
- IPVA.
- Imposto de Renda (declaração anual e eventual saldo a pagar em cota única ou parcelado).
- ITBI (pontual, em transações imobiliárias).
- Outras taxas municipais/estaduais recorrentes (ex.: taxa de lixo, quando cobrada separada do IPTU).

## Como controlar

- Cada imposto gera uma linha no [modelo único de vencimento](README.md#modelo-único-de-vencimento), com **Categoria = "Imposto"**.
- **Recorrência**: "Anual" para IPTU/IPVA/IR: registrar em **Observações** se o pagamento escolhido é cota única (normalmente com desconto) ou parcelado, e quantas parcelas.
- Datas de vencimento de impostos costumam variar por ano/calendário oficial e por final de placa (IPVA) ou dígito de inscrição (IPTU) — **conferir o calendário oficial todo início de ano** e atualizar este arquivo, não assumir que a data se repete automaticamente.
- Prioridade **Essencial/crítico**: atraso de imposto gera multa e juros e pode gerar restrição (ex.: veículo com IPVA atrasado impedido de licenciar).
- Ao decidir entre cota única com desconto e parcelamento, considerar o custo de oportunidade do dinheiro (ver `../PRINCIPIOS.md`, princípio 7 — comparar alternativas) antes de assumir que parcelar é sempre pior ou sempre melhor.

## Estado atual

[PENDENTE DE PREENCHIMENTO]

## Dados pendentes

- Lista de impostos aplicáveis à família (imóveis, veículos) com valor do último exercício.
- Datas de vencimento do calendário oficial vigente do ano corrente.
- Decisão histórica de cota única vs. parcelado e o racional usado.

## Próximas ações

1. Levantar os impostos aplicáveis (imóveis e veículos da família) e o calendário oficial do ano corrente.
2. Preencher este arquivo com a lista consolidada.
3. Posicionar os vencimentos em `calendario-financeiro.md`, marcando os meses de maior concentração (ex.: início de ano para IPVA/IPTU).

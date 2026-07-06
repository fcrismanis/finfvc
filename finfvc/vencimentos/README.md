# Vencimentos — FinFVC
> Última atualização: 2026-07-06

## Por que isso é prioridade máxima

Antes de evoluir qualquer funcionalidade de IA, investimentos ou patrimônio, o Segundo Cérebro precisa saber, sem ambiguidade, **quais compromissos financeiros existem e quando eles vencem**. Patrimônio sem controle de vencimento gera juros, multa e decisão de investimento tomada sem saber quanto caixa está realmente comprometido nos próximos dias. Este módulo é a base operacional sobre a qual `financeiro/`, `investimentos/` e os agentes de IA devem se apoiar.

## Objetivo

Centralizar todo compromisso financeiro recorrente ou pontual da família Crismanis — contas de consumo, condomínio, aluguel, financiamentos, parcelas, cartões de crédito, seguros, assinaturas, impostos, escola, despesas recorrentes e investimentos programados — em um modelo único, com data de vencimento, status e prioridade explícitos, de forma que a pergunta "o que vence e quando" tenha resposta em menos de um minuto (ver `../playbooks/revisao-diaria-vencimentos.md`).

## Estrutura de pastas

```
vencimentos/
  README.md                      # este arquivo — visão geral e modelo único
  contas-fixas.md                # contas de consumo, condomínio, aluguel
  cartoes.md                     # faturas de cartão de crédito
  financiamentos.md              # financiamentos e parcelamentos de longo prazo
  assinaturas.md                 # assinaturas e serviços recorrentes
  impostos.md                    # IPTU, IPVA, IR, ITBI, taxas e tributos
  seguros.md                     # prêmios de seguro (vida, residencial, veículo, saúde)
  recorrencias.md                # registro consolidado de toda recorrência (escola, mensalidades, investimentos programados, etc.)
  calendario-financeiro.md       # visão de calendário — diário, semanal, mensal, anual e sazonalidade
  fluxo-de-vencimentos.md        # ciclo de vida do vencimento e roadmap de conciliação automática com Pluggy
  checklist-fechamento.md        # checklist de fechamento específico de vencimentos
```

## Categorias cobertas e onde controlar cada uma

| Categoria | Arquivo |
|---|---|
| Contas de consumo (água, luz, gás, internet, telefone) | `contas-fixas.md` |
| Condomínio | `contas-fixas.md` |
| Aluguel | `contas-fixas.md` |
| Financiamento (imóvel, veículo) | `financiamentos.md` |
| Parcelas (compras, empréstimos) | `financiamentos.md` |
| Cartões de crédito | `cartoes.md` |
| Seguros | `seguros.md` |
| Assinaturas | `assinaturas.md` |
| Impostos | `impostos.md` |
| Escola | `recorrencias.md` |
| Despesas recorrentes (demais) | `recorrencias.md` |
| Investimentos programados (aportes automáticos) | `recorrencias.md` |

## Modelo único de vencimento

Todo compromisso financeiro registrado em qualquer arquivo deste módulo deve seguir os mesmos campos, para permitir consolidação em `calendario-financeiro.md` e revisão diária sem retrabalho de formato.

| Campo | Descrição | Exemplo |
|---|---|---|
| **Nome** | Identificação clara e única do compromisso | "Condomínio Ed. Aurora" |
| **Categoria** | Uma das categorias da tabela acima | "Contas fixas" |
| **Valor** | Valor esperado (fixo ou estimativa quando variável, com nota em Observações) | R$ 850,00 |
| **Data de vencimento** | Dia limite de pagamento sem multa/juros | Dia 10 |
| **Recorrência** | Mensal, anual, parcelado (nº parcela/total), único | Mensal |
| **Conta de pagamento** | Conta ou cartão de onde o valor sai | Conta corrente Itaú |
| **Forma de pagamento** | Débito automático, boleto, PIX, cartão, transferência manual | Débito automático |
| **Status** | A vencer, vence hoje, vencido, pago, pago com atraso, cancelado | A vencer |
| **Prioridade** | Essencial/crítico, importante, flexível (ver `../PRINCIPIOS.md`) | Essencial |
| **Observações** | Contexto livre (reajuste, carência, motivo de variação, etc.) | "Reajuste anual em março" |

Este modelo é a unidade atômica com a qual `fluxo-de-vencimentos.md` e `calendario-financeiro.md` trabalham — cada linha registrada em `contas-fixas.md`, `cartoes.md`, `financiamentos.md`, `assinaturas.md`, `impostos.md`, `seguros.md` ou `recorrencias.md` é uma instância desse modelo.

## Como usar

1. **Rotina diária** → seguir `../playbooks/revisao-diaria-vencimentos.md` para responder o que vence hoje/amanhã/semana/mês e quanto precisa estar disponível em conta.
2. **Cadastrar um novo compromisso** → identificar a categoria correta na tabela acima, adicionar ao arquivo correspondente seguindo o modelo único.
3. **Visão consolidada de calendário** → `calendario-financeiro.md`.
4. **Entender o ciclo de vida de um vencimento e o roadmap de conciliação automática com Pluggy** → `fluxo-de-vencimentos.md`.
5. **Fechar o período** → `checklist-fechamento.md`, que alimenta o passo "Revisar contas" e "Revisar cartões" de `../playbooks/fechamento-mensal.md`.

## Relação com o restante do FinFVC

- `financeiro/fluxo-de-caixa.md` projeta caixa futuro; este módulo é a fonte primária de saídas conhecidas para essa projeção.
- `financeiro/dividas.md` mantém o passivo consolidado (saldo devedor, taxa); `financiamentos.md` aqui controla o vencimento operacional de cada parcela.
- `investimentos/alocacao-alvo.md` e aportes programados são registrados como recorrência em `recorrencias.md`, garantindo que investimento programado também apareça na revisão diária de vencimentos.
- `agentes/arquiteto-segundo-cerebro.md` deve tratar este módulo como fonte de verdade para qualquer resposta sobre compromissos financeiros e prazos.

## Estado atual

[PENDENTE DE PREENCHIMENTO] — estrutura documental criada; preenchimento com dados reais dos compromissos da família Crismanis ainda pendente (ver `../_entrada-dados/`).

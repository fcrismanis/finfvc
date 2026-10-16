# Assinaturas
> Última atualização: 2026-07-06

## Objetivo

Controlar todas as assinaturas e serviços recorrentes de pequeno valor (streaming, software, clubes, aplicativos) que, individualmente parecem irrelevantes, mas somados costumam representar uma fatia relevante e pouco questionada do orçamento.

## O que entra aqui

- Streaming de vídeo e música.
- Software e serviços digitais (nuvem, produtividade, IA, etc.).
- Clubes de assinatura (produtos físicos recorrentes).
- Academias e serviços de bem-estar cobrados por recorrência.
- Qualquer cobrança automática recorrente de valor tipicamente baixo/médio que não se encaixe em contas fixas, financiamento, seguro ou imposto.

## Como controlar

- Cada assinatura gera uma linha no [modelo único de vencimento](README.md#modelo-único-de-vencimento), com **Categoria = "Assinatura"** e **Recorrência = "Mensal" ou "Anual"**.
- A maioria das assinaturas é cobrada no cartão de crédito — o vencimento individual da assinatura é informativo para revisão de valor/uso, mas o vencimento financeiro real (o que precisa de caixa) é a fatura consolidada em `cartoes.md`.
- Prioridade tipicamente **Flexível** (raramente essencial) — exceção quando a assinatura é ferramenta de trabalho/renda, caso em que deve ser marcada como **Importante**.
- Revisar periodicamente (ver `../playbooks/revisao-de-orcamento.md`) se cada assinatura ainda é usada — assinatura esquecida e não cancelada é a forma mais comum de vazamento silencioso de orçamento.
- Registrar em **Observações** a data de possível cancelamento sem multa/fidelidade, quando houver.

## Estado atual

[PENDENTE DE PREENCHIMENTO]

## Dados pendentes

- Lista completa de assinaturas ativas: valor, ciclo de cobrança, cartão/conta de cobrança.
- Última vez que cada assinatura foi efetivamente usada (para avaliar corte).
- Assinaturas com fidelidade/multa de cancelamento.

## Próximas ações

1. Levantar todas as assinaturas ativas cruzando faturas de cartão dos últimos 2-3 meses.
2. Preencher este arquivo com a lista consolidada.
3. Avaliar cortes candidatos junto com `../financeiro/despesas.md` e `../playbooks/revisao-de-orcamento.md`.

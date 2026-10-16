# Playbook — Revisão Diária de Vencimentos
> Última atualização: 2026-07-06

## Objetivo

Garantir que, todos os dias, em menos de um minuto, seja possível responder com segurança:

1. O que vence hoje?
2. O que vence amanhã?
3. O que vence esta semana?
4. O que vence neste mês?
5. Quanto falta pagar?
6. Quanto já foi pago?
7. Quanto preciso ter disponível em conta?

## Passo a passo

1. **Abrir o calendário consolidado** — `../vencimentos/calendario-financeiro.md`, que agrega os vencimentos de `../vencimentos/contas-fixas.md`, `cartoes.md`, `financiamentos.md`, `assinaturas.md`, `impostos.md`, `seguros.md` e `recorrencias.md`.
2. **O que vence hoje?** — filtrar vencimentos com Data de vencimento = hoje e Status "A vencer" ou "Vence hoje". Confirmar que há caixa disponível na Conta de pagamento de cada um.
3. **O que vence amanhã?** — mesmo filtro para a data seguinte, para antecipar qualquer transferência entre contas necessária.
4. **O que vence esta semana?** — somar os vencimentos dos próximos 7 dias corridos, agrupando por Conta de pagamento.
5. **O que vence neste mês?** — abrir a visão mensal do calendário, separando o que já está "Pago"/"Pago com atraso" do que ainda está "A vencer"/"Vencido".
6. **Quanto falta pagar?** — somar o Valor de todos os vencimentos do mês com Status "A vencer", "Vence hoje" ou "Vencido".
7. **Quanto já foi pago?** — somar o Valor de todos os vencimentos do mês com Status "Pago" ou "Pago com atraso".
8. **Quanto preciso ter disponível em conta?** — somar "quanto falta pagar" por Conta de pagamento e comparar contra o saldo atual de cada conta (ver `../financeiro/fluxo-de-caixa.md`); sinalizar qualquer conta com previsão de saldo insuficiente antes do próximo vencimento.
9. **Tratar exceções** — qualquer vencimento "Vencido" sem justificativa, ou "Vence hoje" sem confirmação de pagamento até o fim do dia, vira ação imediata (pagar, renegociar, ou registrar o motivo em Observações).
10. **Atualizar Status** — mover cada vencimento tratado no dia para o Status correto ("Pago", "Pago com atraso"), seguindo o ciclo descrito em `../vencimentos/fluxo-de-vencimentos.md`.

## Quando executar

Diariamente, idealmente no mesmo horário (ex.: início da manhã), levando menos de um minuto quando os dados estão em dia — se estiver levando mais que isso, é sinal de que o cadastro em `vencimentos/` está desatualizado ou incompleto, não que a rotina em si está errada.

## Relação com outros playbooks

- Alimenta `fechamento-mensal.md` — os dados do mês já revisados diariamente tornam o fechamento mensal uma consolidação, não uma reconstrução do zero.
- Usa o `../vencimentos/checklist-fechamento.md` como referência de quando um período pode ser considerado fechado.

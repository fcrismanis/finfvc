# Fase 2 — Checklist de validação
> Branch: `feature/fin-functional-upgrades` | Data: 2026-06-16

---

## 1. Build limpo

```bash
cd finance-app && npm run build
```

- [ ] Sem erros TypeScript
- [ ] Sem erros Vite
- [ ] `dist/` gerado

---

## 2. Centro de Revisão Inteligente (2.1)

- [ ] Painel "Revisão inteligente · mês atual" aparece na tela `/revisao`
- [ ] Contagem de itens por severidade (alta/média/baixa) aparece no header
- [ ] Filtros de severidade funcionam
- [ ] Itens com "Sem categoria" aparecem (alta)
- [ ] Itens com "Baixa confiança" aparecem (média)
- [ ] Botão "Ignorar" remove o item da lista
- [ ] Botão "Abrir" abre modal de edição inline
- [ ] Dashboard mostra card "Inteligência financeira"
- [ ] Card mostra saldo projetado e número de recorrentes
- [ ] Alertas de alta severidade listados no card

---

## 3. Motor de Recorrência (2.2)

- [ ] Card "Recorrentes" no IntelligenceCard mostra número de padrões
- [ ] Clicar no card navega para `/orcamento`
- [ ] Recorrentes com confiança alta/média usados na projeção

---

## 4. Orçamento Inteligente (2.3)

- [ ] Botão "Orçamento inteligente" aparece em `/orcamento`
- [ ] Painel SmartBudgetPanel abre com tabela de sugestões
- [ ] Colunas: categoria, média 3m, mês anterior, recorrentes, sugestão, confiança
- [ ] Checkboxes selecionam/desmarcam sugestões
- [ ] "Aplicar N selecionados" salva os orçamentos
- [ ] Categorias sem histórico não aparecem na tabela

---

## 5. Projeção de Fechamento (2.4)

- [ ] Seção "Projeção do mês" aparece em `/fechamento` para o mês atual
- [ ] Não aparece para meses passados
- [ ] Mostra: receita realizada, despesa realizada, despesa projetada, saldo projetado
- [ ] Exibe riscos detectados (categorias acima do ritmo, saldo negativo, etc.)
- [ ] Cor do saldo projetado: verde se positivo, vermelho se negativo

---

## 6. Alertas de Desvio (2.5)

- [ ] Seção "Alertas financeiros" aparece em `/fechamento`
- [ ] Alertas coloridos por severidade (alta/média)
- [ ] Badge de severidade visível
- [ ] Máximo 6 alertas exibidos; "N adicionais" se houver mais
- [ ] IntelligenceCard no Dashboard lista alertas de alta

---

## 7. Fechamento Guiado (2.6)

- [ ] Checklist em `/fechamento` tem 11 itens
- [ ] Itens novos: "Importar extratos", "Sem subcategoria", "Validar cartão", "Alertas", "Resumo"
- [ ] Progresso atualiza conforme marcar itens
- [ ] Estado persiste entre reloads
- [ ] Meses anteriores com checklist antigo (7 itens) não travam

---

## 8. Resumo Mensal (2.7)

- [ ] Seção "Resumo do mês" aparece em `/fechamento`
- [ ] Botão "Gerar resumo" mostra preview Markdown
- [ ] Botão "Copiar" copia para clipboard (feedback "Copiado!")
- [ ] Resumo inclui: entradas, saídas, saldo, alertas, recorrentes, aprendizados
- [ ] Resgates listados separados de receita operacional
- [ ] Pagamentos de fatura não aparecem como despesa

---

## 9. Compatibilidade com dados existentes

- [ ] localStorage existente não é corrompido
- [ ] Checklist antigo (7 itens) não bloqueia fechamento de meses já fechados
- [ ] Filtros da tela de Lançamentos continuam funcionando
- [ ] Importação Pluggy continua funcionando
- [ ] IA de categorização continua funcionando

---

## Riscos e limitações conhecidas

| Item | Limitação | Mitigação |
|------|-----------|-----------|
| Revisão inteligente | Analisa apenas o mês atual (currentYearMonth) | Suficiente para uso diário |
| Recorrência | Requer ≥ 2 meses de dados | Confiança sobe com mais histórico |
| Projeção | Burn rate linear pode subestimar gastos concentrados no fim do mês | Alertas pro-rateados cobrem isso |
| Checklist 11 itens | Meses já fechados com checklist antigo terão itens novos desmarcados | Não bloqueia reabrir/fechar |
| Resumo markdown | Não exporta PDF, só copia texto | Suficiente para anotações e mensagens |

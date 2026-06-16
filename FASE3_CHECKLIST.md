# Fase 3 — Checklist de validação
> Branch: `feature/fin-functional-upgrades` | Data: 2026-06-15

Executar na ordem. Marcar cada item antes de prosseguir para o próximo.

---

## 1. Build limpo

```bash
cd finance-app && npm run build
```

- [ ] Sem erros de TypeScript
- [ ] Sem erros de Vite
- [ ] `dist/` gerado

---

## 2. Dashboard — DataQualityCard (3.1)

- [ ] Card "Qualidade de dados" aparece no Dashboard
- [ ] Métricas mostram totais não-zero (com dados importados)
- [ ] Clicar em chip (ex. "Sem categoria") navega para Lançamentos com filtro ativo
- [ ] Banner "Filtrado por: X" aparece no topo do ledger
- [ ] Botão "Voltar" retorna ao Dashboard

---

## 3. Revisão — bulk actions (3.2)

- [ ] Coluna de checkbox aparece nas linhas de transação
- [ ] Marcar 2+ itens exibe `BulkActionBar` fixo no rodapé
- [ ] "Classificar como neutro" aplica em lote, sem duplicar lançamentos
- [ ] "Marcar revisado" limpa `needsReview` em todos selecionados
- [ ] Bulk de categoria atualiza macroCategoryId de todos selecionados
- [ ] "Aplicar sugestões" aplica categoria de alta-confiança em um só passo

---

## 4. Regras de categoria (3.3)

- [ ] Página `/regras` abre via sidebar (ícone Wand2 em CADASTROS)
- [ ] Editar categoria de uma transação manualmente cria regra aprendida
- [ ] Importar transação nova com merchant idêntico aplica regra (badge `regra` no ledger)
- [ ] Desativar regra na `/regras` → importação deixa de aplicar
- [ ] `suggestFromRules` retorna resultado antes da categoria Pluggy

---

## 5. Smart tags (3.4)

- [ ] Tags sugeridas (pontilhadas) aparecem abaixo dos chips de tag na linha
- [ ] Clicar em `+ recorrente` adiciona tag sem sobrescrever existentes
- [ ] Bulk "Aplicar sugestões de tag" na BulkActionBar funciona para itens selecionados
- [ ] Merchant que repete ≥2 meses recebe sugestão `recorrente`

---

## 6. Reconciliação (3.5)

- [ ] Card "Movimentos internos detectados" aparece no Fechamento quando há candidatos
- [ ] Contagens (pagamentos de cartão, transferências próprias) são não-zero com dados reais
- [ ] Botão "Neutralizar tudo" aplica `neutralPatch()` em lote
- [ ] Transações com `classificationType: 'neutral'` ficam fora do resultado operacional

---

## 7. Ledger avançado (3.6)

- [ ] Troca de filtros (tipo, mês, categoria) persiste após fechar e reabrir o app
- [ ] Pills rápidos (`Sem categoria`, `Pluggy`, `Manual`, `Neutro`, `Alto valor`, `Com tag`, `Sem tag`) filtram corretamente
- [ ] Badge `regra` aparece em transações classificadas por regra
- [ ] Badge `neutro` aparece em transações com `classificationType: 'neutral'`
- [ ] Badge `revisar` aparece em transações com `needsReview: true`
- [ ] Clicar subcategoria na linha abre select inline; Enter/blur salva; Escape cancela
- [ ] Tag com × remove a tag da transação sem abrir modal
- [ ] Botão `+ tag` na linha abre mini-input; Enter adiciona, Escape cancela
- [ ] Botão CSV exporta arquivo com BOM (abre corretamente no Excel)

---

## 8. Integridade de dados

- [ ] Nenhuma transação Pluggy importada é duplicada
- [ ] Ajustes manuais (`manualCategoryOverride`) não são sobrescritos por re-import
- [ ] Regras aprendidas não sobrescrevem ajuste manual (guard `markManual`)
- [ ] CSV/XLSX importado continua funcionando normalmente

---

## 9. Segurança

```bash
# Nenhum resultado = ok
grep -r "apiKey\|clientSecret\|service_role\|PLUGGY_CLIENT_SECRET" \
  finance-app/src finance-app/scripts 2>/dev/null | grep -v ".gitignore"

git status --short   # .env.local não deve aparecer
```

- [ ] Sem secrets no código-fonte
- [ ] `.env.local` fora do Git

---

## 10. Conferência final de commits

```bash
git log --oneline feature/fin-functional-upgrades ^main
```

- [ ] Todos os commits da Fase 3 estão na branch
- [ ] Nenhum commit de merge ou squash indesejado

---

## 11. Build de produção (simulação)

```bash
cd finance-app && npm run build && ls -lh dist/assets/*.js | sort -k5 -h | tail -5
```

- [ ] Bundle principal < 500KB gzip (aviso, não bloqueante)
- [ ] Sem erros no console do navegador na tela `/`

---

## 12. Aprovação para merge

- [ ] Todos os itens 1–11 marcados
- [ ] Nenhum `console.log` de debug exposto em produção
- [ ] Branch pronta para `git merge --no-ff feature/fin-functional-upgrades main`

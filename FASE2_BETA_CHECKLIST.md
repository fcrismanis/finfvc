# Fase 2 — Supabase Beta Checklist

Estado da branch `feature/supabase-auth-fase2`. Produção continua em
`VITE_DATA_PROVIDER=local`. Este documento guia a validação antes de qualquer
merge/tag/deploy do modo Supabase.

> Convenção: ao reportar UUIDs (familyId, ids), mascarar — mostrar só
> início/fim (`3f0c821c…1c8c`). Nunca expor senha ou service_role.

---

## 1. Rodar em modo LOCAL

```bash
# finance-app/.env.local
VITE_DATA_PROVIDER=local
```

```bash
cd finance-app && npm run dev
```

- App abre direto, sem Login.
- Dashboard, Importação, Orçamento, Fechamento usam localStorage.

## 2. Rodar em modo SUPABASE

```bash
# finance-app/.env.local
VITE_DATA_PROVIDER=supabase
VITE_SUPABASE_URL=https://ycskqocrvjdwozqnsots.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...   # anon/publishable, nunca secret
```

Reiniciar o dev server (Vite lê env só no boot).

## 3. Aplicar migrations

```bash
supabase link --project-ref ycskqocrvjdwozqnsots
supabase db push    # aplica 0001 … 0005
```

## 4. Testar Login

- Sem sessão → tela de Login.
- `Criar conta` → signup (confirmação de e-mail por padrão; ver SETUP_SUPABASE.md §6).
- `Entrar` → signin. Credenciais inválidas exibem erro.

## 5. Testar familyId

- Após login, app não trava e carrega o Dashboard.
- SQL: `select count(*) from family_members;` → 1 vínculo para o usuário.
- Login repetido (logout → login) **não** cria família duplicada
  (RPC idempotente, migration 0005).

## 6. Testar transação insert/reload

- Inserir transação (importação ou fluxo controlado).
- Reload da página → transação volta do Supabase.
- `reimbursement` persiste fiel (não vira `neutral`).

## 7. Testar migração Local → Supabase

- Ter dados em localStorage + logado.
- Banner "Dados locais detectados" → `/migrar`.
- Prévia → confirmar → conta novas vs dedup.
- Reexecutar → 0 novas (dedup por `import_hash`). localStorage intacto.

## 8. Testar Budget / Closing

- Budget: editar valor planejado → salva; reload confirma vindo do Supabase;
  reeditar **não** duplica linha (chave natural).
- Closing: marcar checklist / fechar / reabrir → salva; reload confirma do Supabase.

## 9. Segurança — não expor service_role

```bash
grep -R "service_role\|sb_secret" finance-app/src finance-app/.env* 2>/dev/null || true
# deve não retornar nada em finance-app/src
git status --short   # .env.local NUNCA aparece (está no .gitignore)
```

## 10. Manter produção em LOCAL

- Build/deploy de produção com `VITE_DATA_PROVIDER=local`.
- Não ativar Supabase em produção até este checklist estar 100%.

---

## Checklist antes de ativar Supabase em produção

- [ ] Budget e Closing persistem no Supabase (Fase 6 ✅)
- [ ] `reimbursement` no enum + sem shim (Fase 7 ✅)
- [ ] RPC `create_family_for_user` idempotente (Fase 7 ✅)
- [ ] Dados de teste limpos do remoto (Fase 7 ✅)
- [ ] Fluxo de confirmação de e-mail definido (pendente)
- [ ] Teste real com usuário definitivo (pendente)
- [ ] RLS auditada para todas as tabelas (pendente)
- [ ] Backups automáticos habilitados no Supabase (pendente)
- [ ] Migração testada com 1 mês completo de dados reais (pendente)
- [ ] `MigrationBanner` dismissível após migrar (melhoria)
- [ ] Variáveis de ambiente no servidor de produção configuradas
- [ ] Build limpo + sem secret no código + `.env.local` fora do Git

---

## Riscos remanescentes (beta)

| Risco | Severidade | Nota |
|---|---|---|
| Confirmação de e-mail não definida | Média | UX de signup; decidir fluxo |
| RLS não auditada ponta a ponta | Média | Validar todas as tabelas antes de prod |
| Race concorrente na criação de família | Baixa | Janela estreita; guard idempotente cobre repetição |
| `reopenedAt` em jsonb (sem coluna) | Baixa | Informativo; round-trip OK |
| Sem backups automáticos confirmados | Média | Habilitar antes de dados reais |

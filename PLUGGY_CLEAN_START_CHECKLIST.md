# Pluggy Clean Start — Checklist
> Branch: `feature/fin-functional-upgrades` | Última revisão: 2026-06-16

Use este checklist após limpar todos os dados locais para garantir uma
primeira importação correta e sem duplicidade.

---

## Pré-requisitos

```bash
# Terminal 1 — backend
cd ~/FINFVC/finance-app/server && npm run dev

# Terminal 2 — frontend
cd ~/FINFVC/finance-app && npm run dev
```

Backend espera `.env` com `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET`.

---

## Checklist

### 1. Ambiente

- [ ] Backend rodando em `http://localhost:8787`
- [ ] Frontend rodando em `http://localhost:5173`
- [ ] Abrir `/pluggy` no navegador
- [ ] Card de status mostra: **"Ambiente Pluggy limpo. Pronto para nova conexão."**
- [ ] Backend status: **configurado**

### 2. Conectar banco/cartão

- [ ] Clicar **"+ Conectar banco/cartão"**
- [ ] Autenticar o banco no widget Pluggy
- [ ] Aguardar "Salvando conexão…"
- [ ] Conexão aparece na lista com nome da instituição
- [ ] Contas carregadas (conta corrente e/ou cartão de crédito)
- [ ] Card de status atualizado: N conexão(ões), M conta(s)

### 3. Importar primeiros 7 dias

- [ ] Clicar **"Sincronizar"** na conta desejada
- [ ] Período **"Últimos 7 dias"** selecionado por padrão (REC)
- [ ] Clicar **"Buscar transações"**
- [ ] Aguardar preview aparecer
- [ ] Conferir resumo: Novas / Duplicadas / Sem categoria
- [ ] Conferir chips de fonte de categorização (regra / Pluggy / inferência / a classificar)
- [ ] Clicar **"Importar X lançamentos"**
- [ ] Mensagem de sucesso aparece

### 4. Validar categorias na Revisão

- [ ] Ir para `/revisao`
- [ ] Clicar card "Importadas via Pluggy"
- [ ] Conferir itens com e sem categoria
- [ ] Clicar **"Aplicar alta confiança"** para aceitar sugestões certas
- [ ] Corrigir manualmente pelo menos 3 itens errados ou sem categoria
- [ ] Verificar que regra aprendida foi criada em `/regras`

### 5. Validar regras aprendidas

- [ ] Ir para `/regras`
- [ ] Confirmar que as correções manuais criaram regras
- [ ] Ver campos: padrão, receiver/payer, confiança, usos
- [ ] Usar botão "Testar" em uma regra para confirmar matching

### 6. Importar período maior (sem duplicidade)

- [ ] Voltar para `/pluggy`
- [ ] Clicar "Sincronizar" na mesma conta
- [ ] Selecionar **"Mês atual"** ou **"Últimos 30 dias"**
- [ ] Conferir preview: Duplicadas deve ser > 0 (os 7 dias já importados)
- [ ] Confirmar que as regras aprendidas já aplicaram categorias nos novos
- [ ] Importar

### 7. Conferir integridade dos dados

- [ ] `/lancamentos` — lançamentos aparecem com categorias corretas
- [ ] `/dashboard` — gráficos e totais fazem sentido
- [ ] `/orcamento` — despesas realizadas refletem os importados
- [ ] `/fechamento` — saldo do mês calculado corretamente

### 8. Backup

- [ ] Ir para `/configuracoes` → Zona de Perigo
- [ ] Clicar **"Exportar backup"** e salvar o JSON
- [ ] Confirmar que o arquivo contém `fin_pluggy_connections` e `finance_transactions`

---

## Riscos conhecidos

| Situação | Causa | Mitigação |
|---|---|---|
| Conexão sumiu | DangerZone ou browser limpou storage | Usar botão "Recuperar dados Pluggy" em `/pluggy` |
| Transações duplicadas | Importar mesmo período duas vezes | Dedupe por importHash — duplicadas aparecem no preview |
| Categoria errada em massa | Pluggy category sem mapeamento | Corrigir manualmente → regra aprendida corrige próximas |
| IA retorna erro | Sem chave ou Ollama offline | Configurar `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` ou rodar `ollama serve` |
| Backend offline | Porta 8787 não responde | Card de status mostra "não configurado"; conexões existentes não são apagadas |

---

## Variáveis de ambiente do servidor

```env
# Pluggy (obrigatório para conectar banco)
PLUGGY_CLIENT_ID=...
PLUGGY_CLIENT_SECRET=...

# IA para categorização (opcional — pelo menos uma, ou use Ollama)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-proj-...

# Ollama local (opcional — gratuito)
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b
```

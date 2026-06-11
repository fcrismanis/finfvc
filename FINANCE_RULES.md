# FINANCE_RULES.md
# Regras do sistema de finanças familiares

Gerado em: 2026-06-10
Baseado em: análise dos dados reais (lancamentos_Pessoal + clareza-financeira)

---

## 1. Conceitos principais

### 1.1 Receita Operacional
Renda recorrente e previsível que sustenta o orçamento familiar.

Exemplos nos dados reais:
- Salário (CREDITO DE SALARIO, CNPJ 001685053000156)
- Renda de imóvel ou FII (PIX TRANSF GUILHER = "Pagamento FIT", ~R$900–1.000/mês)

Regra:
- Entra no resultado operacional: SIM
- Entra no fluxo de caixa: SIM (data de recebimento)
- Entra no orçamento: SIM (como receita planejada)
- Salário com duas parcelas no mesmo mês soma as duas no mês da competência.
- Meses com 13o salário, PLR ou férias DEVEM ser marcados com flag `receita_extraordinaria_embutida` para não distorcer a média mensal.

### 1.2 Receita Extraordinária
Receita real mas não recorrente. Entra no resultado do mês mas não no baseline orçamentário.

Exemplos nos dados reais:
- Reembolso de seguro (Sul America R$270)
- Nota Fiscal Paulista
- Estornos de cartão (Mercado Livre)
- PIX avulsos de terceiros (reembolsos entre amigos/família)

Regra:
- Entra no resultado operacional: SIM, mas separado
- Entra no fluxo de caixa: SIM
- Entra no orçamento: NÃO (não é base para planejamento)
- Aparece no dashboard como linha separada: "Receitas eventuais"

### 1.3 Despesa Operacional
Todo gasto necessário para manter o padrão de vida familiar.

Exemplos: alimentação, casa, saúde, transporte, educação, assinaturas, serviços.

Regra:
- Entra no resultado operacional: SIM
- Entra no fluxo de caixa: SIM (data de pagamento)
- Entra no orçamento: SIM
- Usa Data Competência para agrupar por mês, não Data de lançamento.

### 1.4 Dívida
Custo financeiro de dívida existente: juros, multas e encargos. Não inclui amortização de principal (que é movimentação financeira).

Exemplos nos dados reais:
- JUROS LIMITE DA CONTA (cheque especial, recorrente): R$910 jan, R$1.060 fev, R$61 mar, R$986 abr, R$2.236 mai
- Juros de Mora (atrasos pequenos)
- PAG TIT INT 033 (boleto de dívida)

Regra:
- Entra no resultado operacional: SIM (é custo real, não pode ser ignorado)
- Entra no fluxo de caixa: SIM
- Entra no orçamento: SIM, com categoria própria "Dívidas"
- Aparece no dashboard com alerta visual se superar limites (ver seção 8)
- NUNCA misturar com multas de trânsito (que são Transporte)

### 1.5 Investimento
Saída de dinheiro que não é gasto, é alocação patrimonial. Principal vai para outro ativo.

Exemplos nos dados reais:
- APLICAÇÃO PREVIDENCIA XP (R$200)
- Boleto Nu Pagamentos / Banco XP (aportes em fundos)

Regra:
- Entra no resultado operacional: NÃO
- Entra no fluxo de caixa: SIM (afeta saldo da conta)
- Entra no orçamento: NÃO (ou em seção separada de patrimônio)
- Aparece no dashboard na seção "Patrimônio", não em "Despesas"

### 1.6 Resgate
Entrada de dinheiro que não é receita, é devolução de patrimônio próprio.

Exemplos nos dados reais:
- PIX CAIXA E 02/02: R$26.684 (resgate de poupança/CDB)
- TED CAIXA ECON F: R$4.835 + R$14
- PIX TRANSF JANAINA 24/02: R$50 (resgate de reserva)
- PIX TRANSF FABIO V 08/01: R$1.300

Regra:
- Entra no resultado operacional: NÃO (o dinheiro já era seu)
- Entra no fluxo de caixa: SIM (afeta saldo da conta)
- Entra no orçamento: NÃO
- Aparece no dashboard: SIM, mas em seção "Movimentação financeira", não em "Receitas"
- CRÍTICO: fevereiro teve R$31.584 em resgates. Se entrar como receita, resultado vira +R$21.879 quando era operacionalmente negativo.

### 1.7 Transferência
Movimentação de dinheiro entre contas ou pessoas da mesma família. Não gera receita nem despesa.

Exemplos nos dados reais:
- PIX TRANSF DARLY B (cônjuge → conta própria)
- PIX TRANSF JANAINA (familiar → conta própria, quando não é resgate de investimento)
- Pagamento de fatura de cartão da conta corrente

Regra:
- Entra no resultado operacional: NÃO
- Entra no fluxo de caixa: SIM (conta de origem perde, conta de destino ganha)
- Entra no orçamento: NÃO
- Aparece no dashboard: NÃO (invisível no resultado, visível só em "Saldo por conta")
- Pagamento de fatura de cartão: NEUTRO se as compras já foram lançadas individualmente.

### 1.8 Ajuste
Correção manual de lançamento incorreto ou saldo.

Regra:
- Entra no resultado operacional: DEPENDE do tipo de ajuste (ver governança)
- Todo ajuste exige campo `motivo_ajuste` e `usuario` preenchidos
- Lançamento original nunca é deletado, apenas marcado como `substituído_por: id_novo`
- Aparece no dashboard com ícone de ajuste manual

### 1.9 Reembolso
Devolução de valor pago por outra pessoa. É receita eventual.

Exemplos nos dados reais:
- PIX de Francis, Aline, Marcia, Gisele (reembolsos de despesas compartilhadas)
- Crédito de cartão por estorno de compra

Regra:
- Entra no resultado operacional: SIM, reduz a despesa da categoria original OU entra como Receita Extraordinária
- Preferência: vincular ao lançamento original da despesa e registrar como redução. Se não for possível vincular, classifica como Receita Extraordinária.
- Entra no orçamento: NÃO (não é base para planejamento)

### 1.10 Neutro
Lançamento técnico sem impacto financeiro real. Gerado automaticamente pelo banco ou sistema.

Exemplos nos dados reais:
- REMUNERACAO APLICACAO AUTOMATICA: R$0,01 (rendimento automático irrisório)
- RENDIMENTOS - POUP FACIL: R$0,03

Regra:
- Entra no resultado operacional: NÃO
- Entra no fluxo de caixa: NÃO
- Entra no orçamento: NÃO
- Aparece no dashboard: NÃO
- Limiar: lançamentos de Investimento/Aporte/Rendimento abaixo de R$1,00 são automaticamente marcados como Neutro.

---

## 2. Regras de inclusão no resultado mensal

| Tipo | Resultado Operacional | Fluxo de Caixa | Orçamento | Dashboard | Relatórios | Visual |
|---|---|---|---|---|---|---|
| Receita Operacional | SIM | SIM | SIM | Destaque positivo | SIM | Verde |
| Receita Extraordinária | SIM (separado) | SIM | NÃO | Linha separada | SIM | Verde claro / tag "eventual" |
| Despesa Operacional | SIM | SIM | SIM | Destaque negativo | SIM | Vermelho / laranja |
| Dívida | SIM | SIM | SIM | Alerta vermelho | SIM | Vermelho com ícone de alerta |
| Investimento | NÃO | SIM | NÃO | Seção patrimônio | SIM (relatório de investimentos) | Azul / neutro |
| Resgate | NÃO | SIM | NÃO | Seção patrimônio | SIM | Azul / neutro |
| Transferência | NÃO | SIM (por conta) | NÃO | NÃO (resultado) | SIM (saldo conta) | Cinza |
| Ajuste | DEPENDE | DEPENDE | NÃO | Ícone de ajuste | SIM (log auditoria) | Cinza com ícone |
| Reembolso | SIM (redução ou receita eventual) | SIM | NÃO | Linha receitas eventuais | SIM | Verde claro |
| Neutro | NÃO | NÃO | NÃO | NÃO | NÃO | Oculto |

---

## 3. Quatro perspectivas financeiras

### 3.1 Resultado Operacional Familiar
**O que é:** Receitas recorrentes menos despesas operacionais. A verdade do mês a mês.

**Fórmula:**
```
resultado_op = receita_operacional + receita_extraordinaria - despesa_operacional - custo_divida
```

**O que EXCLUI:**
- Resgates de investimento
- Aportes
- Transferências entre contas
- Movimentações patrimoniais

**Por que importa:** É o único número que diz se a família está gastando mais ou menos do que ganha de verdade.

### 3.2 Resultado Contábil Bruto
**O que é:** Soma de todas as entradas menos todas as saídas, sem filtro de tipo.

**Fórmula:**
```
resultado_bruto = todas_receitas - todas_despesas
(inclui resgates, aportes, transferências)
```

**Risco:** Distorce. Fevereiro com R$31.584 em resgates gera resultado bruto de +R$21.879 quando operacional era -R$3.328.

**Uso:** Diagnóstico técnico e conferência de saldo. Nunca como métrica principal do dashboard.

### 3.3 Fluxo de Caixa
**O que é:** Quanto dinheiro entrou e saiu de cada conta em cada período. Usa data de pagamento real.

**Fórmula:**
```
fluxo_caixa = entradas_pagas - saidas_pagas (por conta, por período)
```

**Diferença do resultado operacional:** Inclui transferências e investimentos. Responde "quanto tenho em conta agora?", não "fui bem esse mês?".

**Campos usados:** `Data Pagamento` + `Status = Pago` + `Conta/Cartão`

### 3.4 Competência do Gasto vs Pagamento Real

**Competência:** quando a despesa ou receita foi incorrida. Usar `Data Competência` para agrupar por mês.

**Pagamento real:** quando o dinheiro saiu de fato. Usar `Data Pagamento` para fluxo de caixa.

**Regra:** Sistema principal usa competência. Visualização de caixa usa pagamento. NUNCA misturar os dois na mesma métrica.

**Exemplo prático:**
- Salário creditado em 26/01, competência 31/01 → entra em janeiro nos dois modos
- Compra de cartão em 30/05, fatura paga em 09/07 → competência = maio, pagamento = julho
- Parcela 3/5 de produto comprado em março → competência = março (da compra original)

---

## 4. Regras para cartão de crédito

### 4.1 Competência de compra parcelada
A competência de CADA parcela é o mês em que a parcela vence, não o mês da compra original.

Exemplo real: compra em 01/03, 5 parcelas → parcela 3/5 lançada em mai com competência mai. Correto.

Regra: usar `Data Competência` do lançamento conforme exportado. Não recalcular parcelas.

### 4.2 Fatura paga
Pagamento de fatura de cartão é TRANSFERÊNCIA entre conta corrente e cartão. Não é despesa nova.

Regra: se as compras individuais já foram lançadas na categoria correta, o pagamento da fatura é NEUTRO. Não lançar como despesa adicional.

Risco de duplicidade: se o sistema importar tanto o extrato da conta corrente (débito da fatura) quanto o extrato do cartão (cada compra), cada compra é contada duas vezes.

**Solução:** definir fonte canônica por conta:
- RICO, INTER PRIME, NU-JANA, Sam's Club: importar extrato do CARTÃO (compras individuais)
- Conta Itaú, Santander: importar extrato da CONTA (mas ignorar linha de pagamento de fatura)

### 4.3 Compra pendente (Status = Pendente)
Compra realizada, fatura ainda não fechada ou debitada.

Regra:
- Entra na competência da compra: SIM
- Entra no resultado do mês: SIM (já foi comprometido)
- Aparece no dashboard: SIM, com indicador visual de "pendente"
- Entra no fluxo de caixa: NÃO (ainda não saiu da conta)

**Pendentes atuais nos dados:**
- RICO: R$6.742
- Sam's Club: R$6.506
- INTER PRIME: R$2.229
- Total comprometido: R$15.477

Dashboard DEVE mostrar "Comprometido pendente: R$15.477" separado de "Pago: R$X".

### 4.4 Como evitar duplicidade

Checklist antes de importar novo extrato:
1. Identificar se é extrato de CARTÃO ou de CONTA CORRENTE
2. Se conta corrente: identificar e marcar como NEUTRO toda linha que for pagamento de fatura de cartão
3. Verificar se período já foi importado (deduplicar por `Descrição + Valor + Data + Conta`)
4. Nunca importar o mesmo arquivo duas vezes sem validação de duplicatas

---

## 5. Regras para orçamento

### 5.1 Planejado vs Realizado
- `planejado` = valor definido pelo usuário no início do mês (campo Orçado na Clareza Financeira)
- `realizado` = soma dos lançamentos pagos + pendentes na categoria, no mês de competência

### 5.2 Desvio em R$
```
desvio_rs = realizado - planejado
```
Positivo = gastou mais que planejado (despesa) ou recebeu mais que esperado (receita).

### 5.3 Desvio em %
```
desvio_pct = (realizado - planejado) / planejado * 100
```
Só calcular se `planejado > 0`. Se planejado = 0 e realizado > 0: mostrar como "sem orçamento".

### 5.4 Categorias acima do orçamento
Regra de exibição:
- `desvio_pct` entre 0% e 20%: amarelo, aviso suave
- `desvio_pct` entre 20% e 40%: laranja, alerta moderado
- `desvio_pct` acima de 40%: vermelho, alerta crítico
- Categoria sem orçamento (`planejado = 0`) com gasto real: azul, "não orçado"

### 5.5 Alertas de estouro
- Alerta dispara quando `realizado > planejado`
- Alerta antecipado: dispara quando `realizado > 80% do planejado` antes do dia 20 do mês
- Alerta de tendência: se nos últimos 3 dias o gasto na categoria cresceu mais de 15% em relação à média diária do mês, exibir projeção de estouro

---

## 6. Regras para categorias

### 6.1 Hierarquia
Cada lançamento tem:
- `categoria` = granular, como exportado (ex: "Restaurantes")
- `macro_categoria` = pai lógico (ex: "Alimentação")
- `tipo_financeiro` = classificação desta regra (ex: "despesa_operacional")

### 6.2 Mapa de categorias (dados reais)

**Macro: Alimentação**
- Alimentação (genérico)
- Restaurantes
- Padaria / Delivery
- Açougue
- Suplementos

**Macro: Casa**
- Casa (genérico)
- Prestação
- Contas de Consumo
- IPTU
- Manutenção

**Macro: Saúde**
- Saúde (genérico)
- Academias
- Farmácia
- (plano de saúde — quando aparecer)

**Macro: Transporte**
- Transporte (genérico)
- Combustível
- Estacionamento / Sem Parar
- Acessórios
- Limpeza
- Manutenção (veículo)
- Multas e Taxas

**Macro: Assinaturas**
- Assinaturas (genérico)
- IA / Produtividade
- Spotify
- Youtube
- Apple Storage
- Brasil Paralelo

**Macro: Educação**
- Educação (genérico)
- Bethel
- Idiomas
- Supera
- Jovens de Negócios
- Treinamentos

**Macro: Compras**
- Compras (genérico)
- Mercado Livre / Amazon

**Macro: Serviços**
- Serviços (genérico)
- Claro TV
- VIVO
- Mensalidades

**Macro: Receita Operacional**
- Salário
- Pagamento FIT

**Macro: Receita Extraordinária**
- Outras Receitas
- Reembolsos

**Macro: Movimentação Financeira (neutro)**
- Investimentos (como despesa = aporte)
- Resgate
- Aporte
- Transferência

**Macro: Dívida**
- Dívidas
- Juros de Cheque Especial

### 6.3 Comportamento padrão por tipo financeiro

| tipo_financeiro | resultado_op | fluxo_caixa | orcamento | dashboard |
|---|---|---|---|---|
| receita_operacional | SIM | SIM | SIM | Receitas |
| receita_extraordinaria | SIM | SIM | NÃO | Receitas (eventual) |
| despesa_operacional | SIM | SIM | SIM | Despesas |
| divida | SIM | SIM | SIM | Despesas (alerta) |
| investimento | NÃO | SIM | NÃO | Patrimônio |
| resgate | NÃO | SIM | NÃO | Patrimônio |
| transferencia | NÃO | SIM (por conta) | NÃO | Oculto |
| reembolso | SIM | SIM | NÃO | Receitas (eventual) |
| neutro | NÃO | NÃO | NÃO | Oculto |
| ajuste | DEPENDE | DEPENDE | NÃO | Log auditoria |

---

## 7. Regras para movimentações neutras

### 7.1 Transferência entre contas próprias
Detectar por: PIX entre contas do mesmo titular, ou entre cônjuges identificados.

Contas da família nos dados: Itaú, Santander, RICO, INTER PRIME, NU-JANA, Sam's Club, BTG BLACK, Mercado Pago, Bradesco, Rico Conta Corrente.

Regra:
- Quando PIX saiu da conta A e entrou na conta B (ambas da família): TRANSFERÊNCIA nos dois lados
- Não gera receita nem despesa em nenhuma conta

PIX recebidos que SÃO transferência (dos dados reais):
- PIX TRANSF DARLY B (cônjuge)
- PIX TRANSF JANAINA (quando não for resgate de investimento externo)

### 7.2 Aporte em investimento
Saída da conta corrente para investimento (previdência, fundo, ação).

Exemplos: APLICAÇÃO PREVIDENCIA XP, boleto Nu Pagamentos, boleto Banco XP.

Regra: marcar como `tipo = investimento`, não como despesa. Não entra no resultado operacional.

### 7.3 Resgate de investimento
Entrada na conta corrente vinda de investimento próprio.

Exemplos: PIX CAIXA E (R$26.684), TED CAIXA ECON F, PIX FABIO V (quando for devolução).

Regra: marcar como `tipo = resgate`, não como receita. Não entra no resultado operacional.

### 7.4 Pagamento de fatura de cartão
Débito na conta corrente referente ao pagamento integral ou parcial da fatura.

Regra: NEUTRO se as compras já foram lançadas individualmente nas categorias corretas.

Como identificar: descrição contém "PAG FATURA", "PAGTO CARTAO", nome do banco emissor + valor redondo, ou débito automático no valor exato da fatura fechada.

### 7.5 Ajuste manual
Correção de valor, categoria ou data por usuário.

Regra:
- Lançamento original: nunca deletar, marcar como `status = substituído`
- Novo lançamento: criar com `origem = ajuste_manual`, `ajuste_de = id_original`, `motivo`, `usuario`, `data_ajuste`
- Se ajuste afeta o resultado: recalcular resultado do mês afetado

### 7.6 Rendimentos automáticos irrisórios
Exemplos: REMUNERACAO APLICACAO AUTOMATICA (R$0,01), juros poupança (R$0,03).

Regra: valor abaixo de R$1,00 com categoria Investimento/Aporte/Rendimento → `tipo = neutro` automaticamente.

---

## 8. Regras de alertas

### 8.1 Alertas de categoria no mês

| Condição | Nível | Ação |
|---|---|---|
| realizado > planejado + 20% | Atenção | Amarelo no dashboard |
| realizado > planejado + 40% | Alerta | Laranja com notificação |
| realizado > planejado * 2 | Crítico | Vermelho com destaque |
| categoria sem orçamento com gasto > R$500 | Informativo | Azul "não orçado" |
| realizado > 80% do planejado antes do dia 20 | Tendência | Projeção de estouro |

### 8.2 Alertas de dívida

| Condição | Nível |
|---|---|
| juros_divida > 5% da receita operacional | Atenção |
| juros_divida > 10% da receita operacional | Alerta |
| juros_divida > 15% da receita operacional | Crítico |
| juros_cheque_especial > R$0 em 2+ meses consecutivos | Alerta estrutural |

Dado dos dados reais: juros de cheque especial em mai/2026 = R$2.236 (12,9% do salário base). Já é alerta crítico.

### 8.3 Alertas de tendência

Comparar realizado do mês atual com média dos 3 meses anteriores por categoria:

| Condição | Alerta |
|---|---|
| categoria acima de 30% da média 3M | "Gasto incomum em [categoria]" |
| categoria zerada após histórico regular | "Sem lançamentos em [categoria] — conferir" |
| receita operacional abaixo de 10% da média 3M | "Receita menor que o usual" |

### 8.4 Alertas especiais (baseados nos dados reais)

- **Alimentação:** média real = R$3.400/mês. Alerta se > R$4.500.
- **Compras:** média real = R$2.600/mês. Alerta se > R$4.000.
- **Educação:** média real = R$2.400/mês. Alerta se > R$3.500.
- **Transporte:** média real = R$1.600/mês. Alerta se > R$2.500.
- **Dívidas (juros):** qualquer valor de cheque especial = alerta imediato.

### 8.5 Alertas de mês distorcido

Quando um mês tiver:
- Resgate > 20% da receita operacional do mês → banner "Este mês inclui resgate de investimento. Resultado operacional real: R$X"
- Salário > 150% da média histórica → banner "Mês com receita extraordinária (13o/PLR/férias). Não use como baseline."

---

## 9. Regras de governança

### 9.1 Imutabilidade do lançamento original

Regra fundamental: **nenhum lançamento importado pode ser deletado ou editado diretamente**.

Toda modificação cria um registro de ajuste:
```
lançamento original: { id, campos_originais, status = "ativo" }
→ reclassificação →
lançamento original: { id, campos_originais, status = "substituído", substituido_por = id_ajuste }
lançamento ajuste: { id_ajuste, campos_novos, tipo = "ajuste", ajuste_de = id_original, motivo, usuario, data_ajuste }
```

### 9.2 Reclassificação manual

Usuário pode alterar:
- `categoria`
- `macro_categoria`
- `tipo_financeiro`
- `Data Competência` (mês de referência)
- `Descrição` (nome legível, sem alterar original)

Usuário NÃO pode alterar via reclassificação:
- `Valor`
- `Data` original
- `Conta/Cartão`
- `Fonte` (origem do dado)

Para alterar valor: criar lançamento de ajuste com `tipo = ajuste`, vinculado ao original.

### 9.3 Rastreabilidade

Cada lançamento deve ter:
- `id` único (gerado no import, nunca reutilizado)
- `fonte` = nome do arquivo importado + data de import
- `hash` = fingerprint do lançamento original para deduplicação
- `criado_em` = timestamp de import
- `modificado_em` = timestamp da última reclassificação (se houver)
- `modificado_por` = usuário que reclassificou

### 9.4 Deduplicação no import

Antes de inserir qualquer lançamento importado, verificar se já existe lançamento com mesmo:
- `hash` (fingerprint do original) OU
- `Descrição + Valor + Data + Conta` (fallback se hash indisponível)

Se duplicata encontrada: descartar silenciosamente e registrar em log de import.

### 9.5 Origem do dado

Campo `fonte` deve identificar de onde veio o lançamento:
- `import_xlsx_manual` = importação manual de arquivo Excel
- `import_api_banco` = importação via Open Finance / API (futuro)
- `lancamento_manual` = lançamento criado pelo usuário no app
- `ajuste_manual` = ajuste sobre lançamento existente

Regra de confiabilidade:
- `import_xlsx_manual`: confiável para valor e data, categoria precisa de validação
- `lancamento_manual`: alta confiabilidade, usuário validou tudo
- `ajuste_manual`: versão mais confiável do original

### 9.6 Auditoria mensal

Antes de fechar o resultado de um mês:
1. Verificar se existem lançamentos `Pendente` sem Data Pagamento definida
2. Verificar se existem lançamentos sem `tipo_financeiro` definido
3. Verificar se Receita Operacional do mês inclui resgates (alerta)
4. Verificar se pagamentos de fatura de cartão foram marcados como neutros
5. Gerar relatório: "X lançamentos sem categoria, Y sem tipo_financeiro, Z pendentes"

### 9.7 Campos obrigatórios por lançamento

Para o lançamento ser válido no resultado:
- `Tipo` (Receita/Despesa)
- `Valor` > 0
- `Data Competência` válida
- `Categoria` definida
- `tipo_financeiro` definido
- `Conta/Cartão` definida

Lançamentos sem esses campos entram em fila "Para revisar" e não computam no resultado até classificação.

---

## 10. Regras de normalização dos dados (para import)

### 10.1 Campo Recorrente
Todos os lançamentos exportados têm `Recorrente = "Não"`. Campo ignorado no import.

### 10.2 Campo Parcela
Formato exportado: `"3/5"` (texto). No import:
- `parcela_atual = 3`
- `parcela_total = 5`
- `eh_parcelado = true`

Se vazio: `eh_parcelado = false`.

### 10.3 Datas
Formato exportado: `DD/MM/AAAA` (string). Converter para date no import.

`Data Competência` é a referência principal para agrupamento por mês.

Se `Data Competência` vazia: usar `Data`.

### 10.4 Valores negativos
Arquivo exportado usa só valores positivos com campo `Tipo` para diferenciar entrada/saída.

No banco interno: receita = positivo, despesa = negativo. Converter no import.

### 10.5 Categorias sem mapeamento
Categorias novas que não existem no mapa pai-filho vão para macro "Outros" e entram na fila "Para revisar".

---

## Apêndice: contas identificadas nos dados

| Conta/Cartão | Tipo | Observação |
|---|---|---|
| RICO | Cartão de crédito | Principal. R$6.742 pendente. |
| INTER PRIME | Cartão de crédito | R$2.229 pendente. |
| NU - JANA | Cartão de crédito | Cônjuge (Jana). R$208 pendente. |
| Sam's Club | Cartão de crédito | R$6.506 pendente. |
| itau | Conta corrente | Principal. |
| Santander | Conta corrente | Recebe salário. Tem cheque especial. |
| BTG BLACK | Cartão de crédito | Uso ocasional. |
| Banco Bradesco | Conta corrente | Uso reduzido. |
| Rico - Conta Corrente | Conta de investimento | Dividendos e ações. |
| MERCADO PAGO - ABFJAL211623 | Carteira digital | Uso ocasional. |
| SANTANDER FREE | Cartão de crédito | Uso ocasional. |

---

*Versão 1.0 — 2026-06-10*
*Baseado em análise de 855 lançamentos reais (jan–mai/2026)*

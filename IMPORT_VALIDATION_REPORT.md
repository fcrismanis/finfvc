# IMPORT_VALIDATION_REPORT
Gerado em: 10/06/2026, 21:43:21


## Arquivo: lancamentos_Pessoal_2026-01-01_2026-12-31 (1).xlsx

### Colunas detectadas
| Coluna original | Alias mapeado |
|---|---|
| Tipo | tipo |
| Descrição | descricao |
| Valor | valor |
| Data | data |
| Data Competência | data_comp |
| Data Pagamento | data_pag |
| Status | status |
| Forma de Pagamento | forma |
| Conta/Cartão | conta |
| Categoria | categoria |
| Cliente | — |
| Parcela | parcela |
| Recorrente | recorrente |
| Tags | tags |
| Grupo | grupo |

**Campos não reconhecidos:** Cliente

### Totais
- Total de linhas lidas: **912**
- Transações válidas: **912**
- Transações ignoradas (vazias): **0**
- Linhas com erro de data: **0**
- Linhas com erro de valor: **0**
- Linhas sem categoria: **0**
- Possíveis duplicados: **1**

### Por tipo financeiro (income / expense)
- expense: 864
- income: 48

### Por status
- pending: 137
- paid: 775

### Por classification_type
- Despesa Operacional: 836
- Receita Eventual: 28
- Transferência: 18
- Dívida / Juros: 15
- Receita Operacional: 10
- Investimento / Aporte: 5

### Verificações críticas
**Resgates classificados como receita operacional:** ✅ Nenhum — correto

**Aportes classificados como despesa operacional:** ⚠️ 1 aportes. Eles são neutros por includeInOperationalResult=false

**Transferências internas detectadas:** 18 — ✅ marcadas como transfer (excluídas do resultado)
  - COMERCIO LHR DOCE | R$ 179,98
  - RENTAB.INVEST FACILCRED* - DOCTO: 1671959 | R$ 0,01
  - RENDIMENTOS - POUP FACIL-DEPOS A PARTIR 4/5/12 - DOCTO: 2806385 | R$ 0,03
  - TED 104.0000CAIXA ECON F | R$ 14,55
  - PAES E DOCES BELLA JUL | R$ 376,12

**Pagamentos de fatura detectados:** 1
  - PAGAMENTO DE FATURA | R$ 6.892,65 | cls=operational_expense

**Parcelas detectadas:** 255
  - aaamulticlin           osasco        bra | R$ 448,80 | parcela=11/18
  - aaamulticlin           osasco        bra | R$ 448,80 | parcela=15/18
  - aaamulticlin           osasco        bra | R$ 448,80 | parcela=14/18
  - ADAPTAORG | R$ 99,00 | parcela=12/12
  - ADAPTAORG - (Reembolsado integral) (10/12) | R$ 99,00 | parcela=10/12
  - ADAPTAORG - (Reembolsado integral) (11/12) | R$ 99,00 | parcela=11/12
  - ADAPTAORG - (Reembolsado integral) (12/12) | R$ 99,00 | parcela=12/12
  - ADAPTAORG - (Reembolsado integral) (9/12) | R$ 99,00 | parcela=9/12
  - ADIDAS FO OSASCO | R$ 64,30 | parcela=2/7
  - ADIDAS FO OSASCO | R$ 64,30 | parcela=3/7

**Pendentes (compromisso futuro):** 137
  - 1898-8 Osasco Maria Campo | R$ 298,74
  - 1898-8 Osasco Maria Campo | R$ 235,05
  - aaamulticlin           osasco        bra | R$ 448,80
  - aaamulticlin           osasco        bra | R$ 448,80
  - ADAPTAORG - (Reembolsado integral) (10/12) | R$ 99,00
  - ADAPTAORG - (Reembolsado integral) (11/12) | R$ 99,00
  - ADAPTAORG - (Reembolsado integral) (12/12) | R$ 99,00
  - ADAPTAORG - (Reembolsado integral) (9/12) | R$ 99,00
  - ADIDAS FO OSASCO | R$ 64,30
  - ADIDAS FO OSASCO | R$ 64,30

### Por conta/cartão (top 10)
- RICO: 493
- itau: 164
- INTER PRIME: 101
- Sam's Club: 53
- NU - JANA: 40
- Santander: 18
- BTG BLACK: 16
- MERCADO PAGO - ABFJAL211623: 13
- Banco Bradesco: 7
- Rico - Conta Corrente: 6

### Top 20 categorias (raw do arquivo)
- Alimentação: 148
- Compras: 136
- Restaurantes: 61
- Mercado Livre / Amazon: 47
- Padaria / Delivery: 46
- Saúde: 44
- Educação: 43
- Serviços: 34
- Assinaturas: 31
- Transporte: 27
- Outras Receitas: 25
- Transferência Saída: 21
- Estacionamento / Sem Parar: 19
- Combustível: 18
- Contas de Consumo: 17
- Casa: 16
- Impostos e Taxas: 16
- IA / Produtividade: 12
- Lazer: 11
- Manutenção: 10

### Top 20 descrições por valor (despesas operacionais)
| Descrição | Valor | Classificação |
|---|---|---|
| Diferenca para achar | R$ 10.133,00 | Despesa Operacional |
| PAGAMENTO DE FATURA | R$ 6.892,65 | Despesa Operacional |
| FINANC IMOBILIARIO 053/281 | R$ 6.322,44 | Despesa Operacional |
| FINANC IMOBILIARIO 054/281 | R$ 6.316,49 | Despesa Operacional |
| FINANC IMOBILIARIO 055/281 | R$ 6.311,23 | Despesa Operacional |
| PAG BOLETO BETHEL SCHOOL | R$ 2.518,50 | Despesa Operacional |
| Saída JUROS LIMITE DA CONTA | R$ 2.235,98 | Dívida / Juros |
| PAG BOLETO BETHEL SCHOOL | R$ 1.679,00 | Despesa Operacional |
| Pagamento de boleto BETHEL SCHOOL | R$ 1.679,00 | Despesa Operacional |
| PIX QRS MUNICIPIO D31/03 | R$ 1.190,69 | Despesa Operacional |
| JUROS LIMITE DA CONTA | R$ 1.060,52 | Dívida / Juros |
| JUROS LIMITE DA CONTA | R$ 986,89 | Dívida / Juros |
| IBM FAROL | R$ 980,70 | Despesa Operacional |
| PIX QRS CSRA BRASIL19/02 | R$ 980,50 | Despesa Operacional |
| JUROS LIMITE DA CONTA | R$ 910,05 | Dívida / Juros |
| PIX AUT SEM PARAR 10/04 | R$ 844,96 | Despesa Operacional |
| PIX TRANSF CAROLIN20/01 | R$ 839,50 | Despesa Operacional |
| Compra: Aspirador De Pó Vertical Wap Power Speed 2 Em 1 Potente 2000w Com Filtro Hepa | R$ 750,83 | Despesa Operacional |
| IGREJA ALPHAVILLE IBM | R$ 700,00 | Despesa Operacional |
| PIX QRS SEM PARAR I21/01 | R$ 659,31 | Despesa Operacional |

### Possíveis duplicidades
| Descrição | Valor | Data | Ocorrências |
|---|---|---|---|
| CLAUDE.AI SUBSCRIPTION | R$ 21,25 | 2026-03-17 | 2x |

### Resultado operacional simulado
- Receita operacional (excl. neutros/resgates): **R$ 106.830,51**
- Despesa operacional (excl. neutros): **R$ 138.909,89**
- Resultado operacional: **R$ -32.079,38**
- Total neutros (excluídos do resultado): R$ 8.315,63
- Total resgates (NÃO é receita op): R$ 0,00
- Total aportes/investimentos: R$ 200,05
- Total dívidas/juros: R$ 5.782,74

## Arquivo: clareza-financeira-2026-06-10 (1).xlsx

### Colunas detectadas
| Coluna original | Alias mapeado |
|---|---|
| Clareza Financeira - Pessoal | — |

**Campos não reconhecidos:** Clareza Financeira - Pessoal

**Campos esperados ausentes:** tipo, descricao, valor, data, data_comp, status, forma, conta, categoria

### Totais
- Total de linhas lidas: **66**
- Transações válidas: **0**
- Transações ignoradas (vazias): **66**
- Linhas com erro de data: **0**
- Linhas com erro de valor: **0**
- Linhas sem categoria: **0**
- Possíveis duplicados: **0**

### Por tipo financeiro (income / expense)

### Por status

### Por classification_type

### Verificações críticas
**Resgates classificados como receita operacional:** ✅ Nenhum — correto

**Aportes classificados como despesa operacional:** ✅ Nenhum

**Transferências internas detectadas:** 0 — Nenhuma

**Pagamentos de fatura detectados:** 0

**Parcelas detectadas:** 0

**Pendentes (compromisso futuro):** 0

### Por conta/cartão (top 10)

### Top 20 categorias (raw do arquivo)

### Top 20 descrições por valor (despesas operacionais)
| Descrição | Valor | Classificação |
|---|---|---|

### Resultado operacional simulado
- Receita operacional (excl. neutros/resgates): **R$ 0,00**
- Despesa operacional (excl. neutros): **R$ 0,00**
- Resultado operacional: **R$ 0,00**
- Total neutros (excluídos do resultado): R$ 0,00
- Total resgates (NÃO é receita op): R$ 0,00
- Total aportes/investimentos: R$ 0,00
- Total dívidas/juros: R$ 0,00

## Duplicidades entre arquivos
✅ Nenhuma duplicidade cruzada detectada entre os dois arquivos.
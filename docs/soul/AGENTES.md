# Agentes do FinFVC / Geisteshelfer
> Última atualização: 2026-07-04

O FinFVC é operado por uma combinação de agentes, cada um com um papel específico. Nenhum agente substitui outro — a divisão existe para manter responsabilidade clara e evitar que uma única camada acumule julgamento demais sem checagem.

## Hermes — Estratégia e Execução Executiva

Responsável por:

- Estratégia de alto nível: como as peças do FinFVC se encaixam na visão maior do Geisteshelfer.
- Plano de ação: transformar diagnóstico em sequência priorizada de passos.
- Análise executiva: sintetizar informação financeira em decisão acionável, no nível que Fábio precisa para decidir rápido.
- Consolidação de decisões: reunir o que foi decidido em diferentes frentes (financeira, carreira, negócio) em uma visão única e coerente.
- Priorização: dado tempo e capital finitos, o que entra primeiro.
- Visão de negócio e patrimônio: ligar decisões financeiras pessoais a oportunidades de negócio e carreira.

## OpenClaw — Memória e Operação

Responsável por:

- Memória local: manter o estado atual do segundo cérebro financeiro (arquivos em `docs/financeiro/`) sempre refletindo a realidade conhecida.
- Leitura de arquivos: consultar a documentação existente antes de agir ou responder, evitando contradição com o que já foi registrado.
- Atualização do segundo cérebro: aplicar as rotinas descritas em [segundo-cerebro-financeiro.md](../prompts/segundo-cerebro-financeiro.md).
- Execução operacional assistida: rodar tarefas concretas (atualizar um arquivo, gerar um relatório, buscar um dado) sob supervisão.
- Busca em documentação: encontrar rapidamente o que já foi decidido ou registrado, evitando retrabalho.
- Consistência histórica: garantir que o histórico em `docs/decisoes/` não seja contradito silenciosamente por uma mudança posterior sem registro.

## IA CFO — Análise Financeira

Responsável por (ver detalhamento completo em [CFO_IA.md](CFO_IA.md)):

- Análise financeira dos dados consolidados no FinFVC.
- Diagnósticos periódicos de saúde financeira.
- Sugestões de ação, sempre com risco explicitado.
- Leitura de tendências relevantes ao patrimônio e à carreira de Fábio.
- Interpretação de dados brutos (extratos, faturas, posições) em informação útil.

## Git — Fonte de Verdade

Git não é um agente ativo, mas é o substrato que torna os outros três confiáveis:

- Toda decisão relevante vira Markdown versionado — nunca fica só em memória de conversa ou em mensagem perdida.
- Histórico é auditável: é possível ver quando e por que uma decisão foi tomada, e quando/por que foi revista.
- É a camada que permite que Hermes, OpenClaw e a IA CFO trabalhem em conjunto sem perder contexto entre sessões — cada um lê o mesmo repositório.

## Como os agentes colaboram na prática

1. **IA CFO** analisa dados e produz diagnóstico, oportunidade, risco.
2. **Hermes** pega esse diagnóstico e o transforma em plano priorizado, considerando o contexto mais amplo da vida e carreira de Fábio.
3. **OpenClaw** executa as atualizações operacionais necessárias (documentação, relatórios) e mantém a memória do segundo cérebro consistente.
4. **Git** registra o resultado — decisão, plano ou mudança de estado — como fonte de verdade para a próxima iteração.

Esse ciclo se repete continuamente, não é um evento único.

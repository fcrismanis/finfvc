# Segundo Cérebro
> Última atualização: 2026-07-04

## O que é este repositório

Este é o repositório do **Segundo Cérebro** de Fábio Volfe Crismanis: memória, decisão e execução assistida por IA, organizada em áreas raiz por domínio de vida. Cada área raiz é um cérebro especializado — com sua própria documentação, agentes, prompts e histórico de decisões — mas todas compartilham o mesmo projeto principal e a mesma fonte de verdade versionada em Git.

Este repositório também contém, historicamente, o código do aplicativo FinFVC (`finance-app/`) e sua infraestrutura de deploy — ver `ARCHITECTURE.md`, `DATA_MODEL.md` e demais arquivos técnicos na raiz para esse lado de implementação. A camada de conhecimento e decisão do Segundo Cérebro vive nas áreas raiz descritas abaixo, e não deve ser confundida com o código do produto.

## Áreas raiz

- **[finfvc/](finfvc/README.md)** — finanças, patrimônio, investimentos e Family Office digital da família Crismanis. Único cérebro implementado até o momento (ver `finfvc/README.md`).
- **carreira/** — trajetória profissional, desenvolvimento de carreira e posicionamento no mercado. *[ainda não criado]*
- **familia/** — organização familiar, rotina, saúde do relacionamento e vida doméstica. *[ainda não criado]*
- **saude/** — saúde física e mental, hábitos, acompanhamento médico. *[ainda não criado]*
- **conhecimento/** — aprendizado contínuo, leitura, estudo e desenvolvimento de habilidades. *[ainda não criado]*
- **projetos/** — projetos pessoais e profissionais em andamento, fora do escopo financeiro. *[ainda não criado]*
- **legado/** — visão de longo prazo, transmissão de patrimônio e conhecimento às próximas gerações. *[ainda não criado]*

Ver [MAPA_DOS_CEREBROS.md](MAPA_DOS_CEREBROS.md) para o detalhamento de cada área e seu estágio atual, e [SOUL.md](SOUL.md) para a filosofia geral que atravessa todas elas.

## Como as áreas se relacionam

Cada área raiz segue, na medida do possível, o mesmo padrão estrutural: manifesto (SOUL), visão de longo prazo, princípios, roadmap, estado atual, decisões registradas e agentes/prompts que a operam. Isso não é rigidez por rigidez — é o que permite que qualquer área nova (`carreira/`, `familia/`, etc.) seja criada seguindo um padrão já validado em `finfvc/`, em vez de reinventar a estrutura a cada domínio novo.

## Regra de nomenclatura

O projeto é chamado **Segundo Cérebro**. O nome antigo (Geisteshelfer) não é mais usado em nenhuma documentação nova — referências a ele em arquivos mais antigos (`docs/`) refletem uma fase anterior e devem ser lidas como sinônimo histórico de Segundo Cérebro, não como um projeto diferente.

## Regras gerais de manutenção

1. Nenhuma área raiz é um repositório separado — todas vivem e evoluem dentro deste mesmo projeto Segundo Cérebro.
2. Toda decisão relevante, em qualquer área, é registrada em Markdown versionado (ver `finfvc/decisoes/` como padrão de referência).
3. Não inventar dado onde não existir — usar `[PENDENTE DE PREENCHIMENTO]` explicitamente, como já praticado em `finfvc/`.
4. Novas áreas raiz só são criadas quando houver necessidade real de operar aquele domínio com a mesma profundidade — não antes.

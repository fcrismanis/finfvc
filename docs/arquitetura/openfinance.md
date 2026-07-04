# Arquitetura — Open Finance
> Última atualização: 2026-07-04

## O que é

Open Finance (antigo Open Banking) é o padrão regulatório brasileiro (Banco Central) que permite compartilhamento de dados financeiros entre instituições, mediante consentimento explícito do titular. É a base regulatória que viabiliza a integração via Pluggy (ver [pluggy.md](pluggy.md)).

## Por que importa para o FinFVC

- É o que torna possível ter, legalmente e de forma segura, uma visão consolidada de contas em diferentes bancos/instituições em um único lugar (o FinFVC), sem depender de scraping não autorizado ou compartilhamento informal de senha.
- Consentimento é revogável — o sistema precisa lidar bem com uma conexão sendo desconectada pelo usuário ou expirando, sem perder o histórico já coletado.

## Cuidados específicos

- Consentimento é do titular da conta, não do sistema — qualquer renovação de autorização deve ser explícita e compreendida por quem está autorizando.
- Dado sob Open Finance é sensível por natureza — tratamento de segurança e privacidade deve seguir o mesmo padrão de qualquer dado financeiro sensível (não expor, não logar em texto claro, não versionar).
- O ecossistema de Open Finance no Brasil ainda evolui regulatoriamente — mudanças de regra podem impactar a integração Pluggy; isso é algo a monitorar via [pesquisador-tendencias.md](../prompts/pesquisador-tendencias.md) na área de "fintechs / Open Finance".

## Relação com o roadmap

Open Finance pleno (múltiplas instituições, dados sempre frescos, sem lançamento manual) é pré-requisito prático da Fase 5 — Inteligência do [roadmap patrimonial](../soul/ROADMAP_PATRIMONIAL.md).

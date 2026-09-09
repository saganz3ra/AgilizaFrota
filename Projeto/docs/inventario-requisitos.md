# Agiliza Frota — Inventário de Requisitos por Camada

**Data:** 09/09/2026 · **Sprints concluídas:** 1 a 11 de 13

Este documento cruza cada requisito do Plano de Prototipagem com o que existe
de fato em cada uma das três aplicações. Ele foi levantado lendo o código, não
a documentação — e conferido com 48 verificações automatizadas rodando os
controllers reais contra um PostgreSQL.

Legenda: **✅** completo · **⚠️** parcial · **❌** ausente · **—** não se aplica

---

## 1. Requisitos Funcionais

| # | Requisito | Backend | Web (Central) | App (Motorista) |
|---|-----------|:---:|:---:|:---:|
| RF01 | Autenticar usuários | ✅ | ✅ | ✅ |
| RF02 | Gerenciar veículos, motoristas e unidades | ✅ | ✅ | — |
| RF03 | Início/fim de turno com km e foto | ✅ | ✅ *(consulta)* | ✅ |
| RF04 | Checklist obrigatório | ✅ | ✅ *(consulta)* | ✅ |
| RF05 | Criar, classificar e priorizar chamados | ✅ | ✅ | — |
| RF06 | Alerta sonoro/visual na central | ✅ | ✅ | — |
| RF07 | Atribuir chamados manualmente | ✅ | ✅ | — |
| RF08 | Sugerir unidade/veículo | ✅ | ✅ | — |
| RF09 | Registrar andamento dos atendimentos | ✅ | ✅ | ✅ |
| RF10 | **Validação manual dos cálculos** | ✅ | ✅ | — |
| RF11 | Monitorar frota em tempo real | ✅ | ✅ | ✅ |
| RF12 | Histórico completo | ✅ | ❌ | ❌ |
| RF13 | Gerar e exportar relatórios | ✅ | ❌ | — |
| RF14 | Logs de auditoria | ✅ | ❌ | — |
| RF15 | **Notificar recepcionista na chegada** | ✅ | ✅ | — |
| RF16 | Tempo estimado de chegada | ✅ | ⚠️ | ❌ |
| RF17 | Sugestão de rotas | ✅ | ❌ | ❌ |

## 2. Requisitos Não Funcionais

| # | Requisito | Situação | Onde |
|---|-----------|:---:|------|
| RNF01 | Segurança e integridade | ✅ | Firebase Auth, RBAC, Zod, constraints, rate limit, HSTS, auditoria · `docs/seguranca.md` |
| RNF02 | LGPD nível básico | ⚠️ | Backend completo; **sem tela** para o titular exercer os direitos · `docs/lgpd.md` |
| RNF03 | Operação offline | ✅ | Fila SQLite no app + `POST /sync` idempotente |
| RNF04 | Interface sob pressão | ✅ | Toque de 56 px, tipografia ampliada, alto contraste |
| RNF05 | Múltiplos usuários | ✅ | SSE para várias centrais + índices únicos parciais |
| RNF06 | Tempo de resposta | ⚠️ | Medição pronta (`X-Response-Time`, p50/p95/p99); **sem teste de carga** |
| RNF07 | Escalabilidade (conceitual) | ✅ | `docs/escalabilidade.md` |
| RNF08 | Alta disponibilidade (básica) | ✅ | Liveness/readiness, encerramento gracioso · `docs/disponibilidade.md` |
| RNF09 | Precisão dos cálculos | ✅ | Funções puras + CHECKs no banco |
| RNF10 | Confiabilidade do GPS | ✅ | Validação, detecção de salto, status por idade |
| RNF11 | Minimizar interações | ✅ | `GET /motorista/painel` com a próxima ação pronta |

---

## 3. As lacunas, em ordem de gravidade

### 3.1 ~~CRÍTICA — A recepcionista não tem interface (RF15)~~ — RESOLVIDA em 09/09

Tela `/chegadas` criada: alerta em tempo real por SSE, som, cartão grande da
chegada mais recente e confirmação de leitura. A recepcionista entra direto
nela e não vê as telas de gestão da Central.

Verificado com 14 checagens: a recepcionista de uma unidade não enxerga nem
confirma a chegada de outra (403), a mesma chegada não notifica duas vezes e
a confirmação grava `lida_em`, o que a Central pode auditar.

### 3.2 ~~CRÍTICA — RF10 é inacessível~~ — RESOLVIDA em 09/09

Tela `/atendimentos` criada, com fila de conferência (o filtro padrão são os
concluídos ainda não validados) e modal comparando **valor armazenado ×
recalculado agora**, mais as inconsistências detectadas automaticamente.

O ajuste manual não sobrescreve o valor calculado: vai para campo próprio, com
justificativa, quem validou e quando. Um relatório precisa poder mostrar o que
o sistema calculou e o que a Central corrigiu.

Verificado com 18 checagens, incluindo a detecção de quilometragem retroativa,
horário fora de ordem e velocidade média implausível.

### 3.3 ALTA — Relatórios sem tela (RF13)

Um dos objetivos declarados do projeto é *"tornar a geração de relatórios
rápida e confiável"*, hoje lenta e sujeita a erro no processo em papel. Os três
relatórios existem e exportam CSV e HTML, mas só por chamada direta à API.

É também o requisito mais visível numa apresentação: mostrar um relatório
sendo exportado é mais convincente que descrever o endpoint.

### 3.4 MÉDIA — Histórico e auditoria sem tela (RF12, RF14)

O RF12 pede histórico "filtrável por motorista, veículo e período" — a API faz
exatamente isso, sem consumidor. O RF14 registra tudo corretamente, mas a
consulta de auditoria também não tem tela.

### 3.5 MÉDIA — RF16/RF17 pouco visíveis

O ETA é calculado e gravado na atribuição, mas o painel mostra apenas a
distância nas sugestões — não o tempo. E a rota sugerida não é exibida em
lugar nenhum, apesar de `GET /atendimentos/:id/rota` existir e do mapa já
estar no projeto.

O app também não mostra ao motorista a rota nem o tempo estimado.

### 3.6 BAIXA — LGPD sem tela (RNF02)

Consentimento, portabilidade e anonimização funcionam por API. Para o TCC,
uma tela simples de consentimento no app fecharia o requisito de forma
demonstrável.

---

## 4. O que está sólido

- **O fluxo principal roda ponta a ponta:** central abre o chamado → aciona o
  veículo → motorista recebe, executa os quatro marcos e conclui → métricas
  fecham → chamado encerra → veículo é liberado com a quilometragem atualizada.
- **O modo offline funciona de verdade**, com fila persistente e reenvio
  idempotente verificado com pacote fora de ordem, duplicado e com item inválido.
- **O rastreamento chega ao mapa da central** em tempo real.
- **As regras de negócio vivem no servidor**, não na interface: ordem dos
  marcos, invariantes de status, proteção contra lockout.

---

## 5. Achados de teste (material para a Sprint 12)

Defeitos encontrados **usando o sistema**, não lendo o código:

| Achado | Causa | Correção |
|---|---|---|
| Veículo com turno aberto nunca aparecia nas sugestões | Filtro usava `status='disponivel'`, mas turno aberto marca `em_uso` | Filtro passou a excluir apenas `manutencao` |
| Pool de conexões podia travar ao receber GPS | Controller segurava um client e chamava outra consulta | Uso do pool direto |
| Central podia liberar veículo em turno aberto | `PUT` e `PATCH` de status sem verificar invariante | Guarda com 409 em ambos + no desativar |
| "Invalid Date" no painel após concluir pelo app | Evento SSE publicava projeção reduzida do chamado | Colunas centralizadas em constante única |
| App oferecia veículo desativado | Filtro do app ignorava `ativo` | `ativo=true` na consulta |
| Mapa abria o mundo inteiro | `fitBounds` com um ponto só | `setView` quando há um único veículo |

---

## 6. Recomendação de sequência

Considerando que a Sprint 12 (testes e validação) começa em 23/09:

1. ~~**Tela da recepcionista**~~ — ✅ concluída em 09/09
2. ~~**Tela de atendimentos com validação**~~ — ✅ concluída em 09/09
3. **Tela de relatórios** — RF13, alto valor de demonstração
4. **Histórico e auditoria** — RF12 e RF14
5. ETA e rota visíveis — RF16/RF17

Os itens 1 a 3 são os que mudam a resposta a "esse requisito está pronto?" de
*"a API está"* para *"sim"*.

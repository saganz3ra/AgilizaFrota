# Escalabilidade (RNF07)

> Análise conceitual do Agiliza Frota, conforme o escopo definido no plano de
> prototipagem: *"escalabilidade conceitual, não infraestrutura real"*. Aqui
> ficam registradas as decisões **já implementadas** e o **caminho de
> crescimento** caso a operação aumente.

## 1. O que já está implementado

| Decisão | Onde | Por que ajuda a escalar |
|---|---|---|
| **API sem estado (stateless)** | toda a aplicação | Nenhuma sessão fica na memória do processo: a autenticação é por token do Firebase, validado a cada requisição. Isso permite subir **N instâncias atrás de um balanceador** sem "sessão presa" em uma delas. |
| **Pool de conexões configurável** | `config/db.js` (`PG_POOL_MAX`) | Cada instância limita suas conexões; ao escalar horizontalmente, ajusta-se o pool para não estourar o `max_connections` do PostgreSQL. |
| **Timeouts de consulta** | `PG_STATEMENT_TIMEOUT_MS` | Uma consulta lenta é abortada em vez de segurar a conexão e degradar todas as demais. |
| **Índices nas colunas de busca** | migrations 001–010 | Consultas por veículo, motorista, período e status usam índice; as listagens pesadas (posições, auditoria) têm índice composto com ordenação por tempo. |
| **Paginação e limites** | histórico, auditoria, posições, relatórios | Nenhum endpoint devolve a tabela inteira: há `limite`/`offset` e tetos rígidos (ex.: 5.000 linhas no relatório, 1.000 em posições). |
| **Escritas em lote** | `POST /posicoes/lote` | O GPS é a maior fonte de volume; o envio em lote reduz drasticamente o número de requisições. |
| **Cache de rotas** | `services/mapas.js` | Consultas repetidas ao provedor externo são servidas da memória por 60s, poupando cota e latência. |
| **Trabalho fora da transação** | `atribuicaoController`, `posicaoController` | Chamadas de rede e consultas auxiliares acontecem **fora** do bloco transacional, para não segurar conexões do pool. |

## 2. Onde o volume cresce primeiro

Estimativa para uma operação com **10 ambulâncias**, GPS a cada 15 s, 12 h/dia:

| Tabela | Crescimento aproximado | Observação |
|---|---|---|
| `posicoes` | ~29 mil linhas/dia · ~10 milhões/ano | **Dominante** — 95% do volume |
| `auditoria` | centenas/dia | Cresce com o uso, não com a frota |
| `atendimentos` / `chamados` | dezenas/dia | Volume pequeno |
| demais tabelas | praticamente estáveis | Cadastros |

## 3. Caminho de crescimento (se a operação exigir)

1. **Particionar `posicoes` por tempo** (`PARTITION BY RANGE (registrado_em)`, mensal).
   Consultas recentes tocam só a partição atual; partições antigas podem ser
   compactadas ou arquivadas. É a mudança de maior impacto e a mais simples.
2. **Política de retenção**: manter posições brutas por N meses e guardar apenas
   o resumo do trajeto por atendimento — conversa direto com a retenção da LGPD
   (Sprint 11).
3. **Réplica de leitura**: relatórios e histórico apontam para a réplica; escrita
   continua no primário. Como o código já separa leitura de escrita em funções
   distintas (`query` vs. transações), a mudança fica isolada em `config/db.js`.
4. **Cache de leitura** (Redis) para o mapa da frota (`GET /frota`), que é a
   consulta mais repetida pela central.
5. **Escala horizontal da API**: várias instâncias atrás de um balanceador. Ponto
   de atenção: o **SSE mantém conexão aberta por instância** — com mais de uma
   réplica é preciso um barramento compartilhado (Redis Pub/Sub) para que um
   evento gerado na instância A chegue às centrais conectadas na instância B.
   Hoje os barramentos (`chamadosEventos`, `frotaEventos`, `notificacoesEventos`)
   estão isolados em módulos próprios justamente para permitir essa troca sem
   alterar controllers.

## 4. Limites conhecidos (assumidos no escopo do TCC)

- Instância única: suficiente para a escala prevista (uma central, dezenas de veículos).
- Sem fila de mensagens: o processamento é síncrono na requisição.
- Sem CDN/edge: irrelevante para uma API interna.

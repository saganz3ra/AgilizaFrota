# Agiliza Frota — Backend

API REST do sistema de gestão de frotas hospitalares **Agiliza Frota** (TCC).
Stack: **Node.js + Express**, **PostgreSQL** (SQL puro via `pg`), **Firebase Authentication**.

> **Sprint 1 — Setup + Autenticação** (22/04 → 05/05).
> Fundação do projeto, modelagem base do banco, camada de segurança e autenticação de usuários (RF01), atendendo ao início do requisito de segurança e integridade (RNF01).
>
> **Sprint 2 — Cadastros + UX base** (06/05 → 19/05).
> Gestão de **unidades**, **veículos** e **usuários/motoristas** (RF02), com RBAC (escritas pela central), soft-delete para rastreabilidade e cadastro de usuários integrado ao Firebase Admin.
>
> **Sprint 3 — Turno + Checklist** (20/05 → 02/06).
> Início/fim de **turno** com foto e quilometragem (RF03) e **checklist** obrigatório antes do turno (RF04). Backend preparado para **sincronização offline** (RNF03): id gerado no cliente (reenvio idempotente) e horários de evento separados do horário de sincronização.
>
> **Sprint 4 — Chamados + Alertas** (03/06 → 16/06).
> Criar, classificar e priorizar **chamados** por urgência/emergência (RF05), abertos pela central ou por **sistema externo** (chave de API). **Alerta em tempo real** na central via **SSE** (RF06) e início do RNF05.
>
> **Sprint 5 — Atribuição + Sugestão** (17/06 → 30/06).
> **Atribuição** de chamados a veículo/motorista (RF07), com reatribuição e liberação do veículo, e **sugestão** por regra simples e explicável (RF08). Conclusão do **RNF05**: invariantes de concorrência por índices únicos parciais, com conflito traduzido em 409.
>
> **Sprint 6 — Registro de Atendimentos** (01/07 → 14/07).
> Registro de **início, andamento e fim** dos atendimentos (RF09) com marcos de horário e quilometragem, **métricas calculadas** (RNF09) e **validação manual** dos cálculos pela central (RF10).
>
> **Sprint 7 — GPS e Monitoramento** (15/07 → 28/07).
> **Monitoramento da frota em tempo real** (RF11): o app envia posições (individualmente ou em lote) e a central acompanha o mapa por SSE. **Confiabilidade do GPS** (RNF10): coordenadas inválidas rejeitadas, “saltos” impossíveis marcados como suspeitos, reenvio sem duplicar e status `online`/`instável`/`offline`.
>
> **Sprint 8 — Histórico + Notificações** (29/07 → 11/08).
> **Histórico completo** da frota e dos atendimentos (RF12) em linha do tempo consolidada, com recortes por veículo/motorista e resumo de indicadores. **Notificação automática à recepcionista** na chegada do veículo (RF15), disparada por *geofence* do GPS — e um **painel único do motorista** que devolve a próxima ação pronta (RNF11: menos toques no app).
>
> **Sprint 9 — Rotas e Tempo de Chegada** (12/08 → 25/08).
> **Tempo estimado de chegada** (RF16) e **sugestão de rota básica** (RF17) via API de mapas, com **fallback local** que mantém o sistema funcionando mesmo sem chave de API ou com o provedor fora do ar. O ETA do acionamento fica registrado na atribuição, permitindo comparar **previsto × realizado**.
>
> **Sprint 10 — Relatórios + Auditoria** (26/08 → 08/09).
> **Relatórios operacionais, de frota e de desempenho** com exportação em CSV (Excel) e HTML pronto para PDF (RF13). **Auditoria automática** de todas as ações críticas e das tentativas negadas, em tabela *append-only* (RF14). **Escalabilidade** (RNF07) e **disponibilidade básica** (RNF08): pool e timeouts configuráveis, *liveness/readiness*, encerramento gracioso e análises em `docs/`.

>
> **Sprint 11 — Desempenho + LGPD** (09/09 → 22/09).
> **Operação offline concluída** (RNF03): endpoint de sincronização que aceita o pacote acumulado no celular e o aplica item a item, com idempotência — reenviar o mesmo pacote não duplica nada. **Tempo de resposta** medido em produção (RNF06) com p50/p95/p99 por rota. **LGPD nível básico** (RNF02): consentimento versionado, portabilidade, anonimização irreversível que preserva o registro operacional e política de retenção. **Segurança concluída** (RNF01): rate limit global, HSTS, CORS estrito em produção e verificação de segredos fracos na inicialização.

---

## Sumário

- [Arquitetura e organização](#arquitetura-e-organização)
- [Pré-requisitos](#pré-requisitos)
- [Passo a passo de setup](#passo-a-passo-de-setup)
- [Endpoints](#endpoints)
- [Fluxo de autenticação](#fluxo-de-autenticação)
- [Mapeamento com os requisitos](#mapeamento-com-os-requisitos)
- [Próximos passos](#próximos-passos-sprint-12)

---

## Arquitetura e organização

Arquitetura em camadas, seguindo o estilo REST definido na especificação base do projeto.

```
agilizafrota-backend/
├── docker-compose.yml        # PostgreSQL local para desenvolvimento
├── docs/                     # escalabilidade.md (RNF07) e disponibilidade.md (RNF08)
├── .env.example              # Modelo de variáveis de ambiente
├── firebase-key.json.example # Modelo da chave de serviço do Firebase
├── package.json
└── src/
    ├── server.js             # Sobe o servidor HTTP
    ├── app.js                # Express + segurança (helmet, cors, etc.)
    ├── config/               # env, db (pool), firebase (Admin SDK)
    ├── db/
    │   ├── migrate.js        # Runner de migrations (.sql)
    │   ├── seed.js           # Dados iniciais de exemplo
    │   ├── criarCentral.js   # Cria o operador admin (Firebase + banco)
    │   ├── diagnostico.js    # Diagnóstico de login/ambiente
    │   └── migrations/       # 001 base · 002 veiculos · 003 turnos/checklists · 004 chamados
    │                         # 005 atribuicoes · 006 atendimentos · 007 posicoes
    │                         # 008 notificacoes · 009 eta_atribuicoes · 010 auditoria
    ├── constants/
    │   └── checklistItens.js # Catálogo fixo do checklist (RF04)
    ├── services/
    │   ├── chamadosEventos.js    # SSE de chamados/alertas (RF06)
    │   ├── frotaEventos.js       # SSE do mapa da frota (RF11)
    │   ├── sugestaoVeiculo.js    # Regra de sugestão (RF08)
    │   ├── atribuicoes.js        # Regras compartilhadas de atribuição (RF07)
    │   ├── metricasAtendimento.js# Distâncias e tempos (RNF09)
    │   ├── rastreamento.js       # Confiabilidade do GPS (RNF10)
    │   ├── notificacoes.js       # Chegada por geofence (RF15)
    │   ├── notificacoesEventos.js# SSE de notificações
    │   ├── mapas.js              # ETA e rotas, com fallback local (RF16/RF17)
    │   └── exportacao.js         # CSV e HTML-para-PDF dos relatórios (RF13)
    ├── middlewares/          # auth (+SSE), RBAC, apiKey, validate, errorHandler
    ├── controllers/          # auth, unidade, veiculo, usuario, turno, chamado,
    │                         # atribuicao, atendimento, posicao, notificacao,
    │                         # historico, painelMotorista
    ├── routes/               # index + health, auth, unidades, veiculos, usuarios,
    │                         # turnos, chamados, atendimentos, posicoes, frota,
    │                         # notificacoes, historico, motorista
    ├── validators/           # schemas Zod por domínio
    └── utils/
        ├── AppError.js       # Erro de aplicação com status HTTP
        ├── asyncHandler.js   # Wrapper para handlers assíncronos
        └── geo.js            # Haversine compartilhado
```

## Pré-requisitos

- **Node.js** ≥ 18
- **Docker** (recomendado para o PostgreSQL) — ou um PostgreSQL 16 local
- Um projeto no **Firebase** com **Authentication** habilitado

## Passo a passo de setup

### 1. Instalar dependências

```bash
cd agilizafrota-backend
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Edite o `.env` conforme o seu ambiente. Gere um valor forte para `BOOTSTRAP_SECRET`.

### 3. Subir o banco PostgreSQL

Com Docker (usa as credenciais já apontadas no `.env.example`):

```bash
docker compose up -d
```

> Alternativa sem Docker: crie manualmente o banco `agilizafrota` no seu PostgreSQL e ajuste `DATABASE_URL` no `.env`.

### 4. Configurar o Firebase Admin

No console do Firebase: **Configurações do Projeto → Contas de Serviço → Gerar nova chave privada**.
Salve o arquivo como `firebase-key.json` na raiz do backend (ele já está no `.gitignore`).

> A API sobe mesmo sem essa chave, mas as rotas protegidas respondem `503` até que ela seja adicionada.

### 5. Rodar as migrations e o seed

```bash
npm run migrate
npm run seed
```

### 5.1. Criar o primeiro operador da Central (admin)

Cria a conta no Firebase **e** o registro `papel=central` no banco de uma vez:

```bash
npm run criar-central -- "admin@agilizafrota.com" "senhaForte123" "Administrador Geral"
```

Depois disso já é possível entrar no painel web com esse e-mail e senha. Qualquer
e-mail válido serve — o que concede o acesso administrativo é o papel `central`.

### 6. Iniciar a API

```bash
npm run dev     # desenvolvimento (nodemon)
# ou
npm start       # produção
```

Verifique: `GET http://localhost:3000/api/status`.

## Endpoints

| Método | Rota                 | Acesso                         | Descrição |
|--------|----------------------|--------------------------------|-----------|
| GET    | `/api/status`        | Público                        | Status da API |
| GET    | `/api/health`        | Público                        | Verifica conexão com o banco |
| POST   | `/api/auth/bootstrap`| Token Firebase + segredo       | Cria o **primeiro** operador `central` (setup único) |
| POST   | `/api/auth/register` | Token Firebase                 | Provisiona o perfil do usuário autenticado |
| GET    | `/api/auth/me`       | Token Firebase + perfil        | Retorna o perfil do usuário autenticado |

**Unidades (RF02)** — leitura: autenticado; escrita: `central`.

| Método | Rota | Acesso | Descrição |
|--------|------|--------|-----------|
| GET    | `/api/unidades`      | Autenticado | Lista (filtros: `ativo`, `cidade`) |
| GET    | `/api/unidades/:id`  | Autenticado | Detalhe |
| POST   | `/api/unidades`      | `central`   | Cria unidade |
| PUT    | `/api/unidades/:id`  | `central`   | Atualiza (parcial) |
| DELETE | `/api/unidades/:id`  | `central`   | Desativa (soft-delete) |

**Veículos (RF02)** — leitura: autenticado; escrita: `central`.

| Método | Rota | Acesso | Descrição |
|--------|------|--------|-----------|
| GET    | `/api/veiculos`           | Autenticado | Lista (filtros: `status`, `unidade_id`, `ativo`) |
| GET    | `/api/veiculos/:id`       | Autenticado | Detalhe |
| POST   | `/api/veiculos`           | `central`   | Cria veículo |
| PUT    | `/api/veiculos/:id`       | `central`   | Atualiza (parcial) |
| PATCH  | `/api/veiculos/:id/status`| `central`   | Altera status operacional |
| DELETE | `/api/veiculos/:id`       | `central`   | Desativa (soft-delete) |

**Usuários / motoristas (RF02)** — todas restritas a `central`.

| Método | Rota | Descrição |
|--------|------|-----------|
| GET    | `/api/usuarios`               | Lista (filtros: `papel`, `unidade_id`, `ativo`) |
| GET    | `/api/usuarios/:id`           | Detalhe |
| POST   | `/api/usuarios`               | Cadastra (cria no Firebase + banco) |
| PUT    | `/api/usuarios/:id`           | Atualiza (nome, telefone, unidade, papel, ativo) |
| PATCH  | `/api/usuarios/:id/ativar`    | Ativa |
| PATCH  | `/api/usuarios/:id/desativar` | Desativa (soft-delete) |

**Turnos + Checklist (RF03/RF04)** — motorista opera os seus; central visualiza/encerra.

| Método | Rota | Acesso | Descrição |
|--------|------|--------|-----------|
| GET    | `/api/turnos/checklist/itens` | Autenticado | Catálogo de itens do checklist |
| GET    | `/api/turnos`                 | Autenticado | Lista (motorista: os seus; filtros: `status`, `veiculo_id`, `motorista_id`, `desde`, `ate`) |
| GET    | `/api/turnos/:id`             | Autenticado | Detalhe do turno + checklist |
| POST   | `/api/turnos/iniciar`         | `motorista` | Executa checklist e abre o turno (foto + km) |
| POST   | `/api/turnos/:id/encerrar`    | `motorista`/`central` | Encerra o turno (foto + km final) |

> **Idempotência (offline):** em `POST /api/turnos/iniciar` e no checklist você pode enviar um `id` (UUID) gerado no cliente; reenviar o mesmo `id` retorna o registro existente (200) em vez de duplicar. Os campos `inicio_em`, `fim_em` e `realizado_em` (ISO 8601) registram o horário do **evento**, útil quando o app sincroniza depois de operar offline.

**Chamados + Alertas (RF05/RF06)** — central (autenticado); abertura também por sistema externo.

| Método | Rota | Acesso | Descrição |
|--------|------|--------|-----------|
| GET    | `/api/chamados`             | `central` | Lista (filtros: `status`, `tipo`, `prioridade`, `destino_unidade_id`, `desde`, `ate`); ordena por prioridade |
| GET    | `/api/chamados/:id`         | `central` | Detalhe |
| POST   | `/api/chamados`             | `central` | Cria chamado (classifica/prioriza) |
| PATCH  | `/api/chamados/:id/cancelar`| `central` | Cancela chamado |
| GET    | `/api/chamados/stream`      | `central` (SSE) | Alerta em tempo real de novos chamados |
| POST   | `/api/chamados/externo`     | Sistema externo (`X-API-Key`) | Abertura de chamado por sistema externo |

> **Alerta em tempo real (SSE):** a central assina `GET /api/chamados/stream` (via `EventSource`, com o token no header ou em `?token=`). Ao criar um chamado, o servidor emite o evento `chamado:novo` para todas as centrais conectadas; o front dispara o alerta sonoro/visual. Cancelamentos emitem `chamado:atualizado`.
>
> **Prioridade:** se não informada, é derivada do tipo (`emergencia` → `alta`, `urgencia` → `media`); pode ser sobreposta para `baixa`/`media`/`alta`/`critica`.

**Atribuição + Sugestão (RF07/RF08)** — todas restritas a `central`.

| Método | Rota | Descrição |
|--------|------|-----------|
| GET    | `/api/chamados/:id/sugestoes` | Veículos sugeridos, com pontuação e **motivos** (`?limite=`) |
| GET    | `/api/chamados/:id/atribuicoes` | Histórico de atribuições do chamado |
| POST   | `/api/chamados/:id/atribuir` | Aciona um veículo (`veiculo_id`, `motorista_id?`, `origem?`) |
| POST   | `/api/chamados/:id/atribuicao/cancelar` | Cancela a atribuição e libera o veículo |

> **Como a sugestão decide (RF08):** entram os veículos ativos, fora de manutenção e sem
> atribuição ativa — um veículo `em_uso` por ter **turno aberto** continua elegível, pois
> o motorista de plantão é justamente o melhor candidato; o que ocupa o veículo é a
> atribuição a um chamado, não o turno. Cada candidato é pontuado por: motorista em turno aberto (+40),
> lotação na unidade de destino (+25), proximidade da origem (0–30, decaindo até 50 km)
> e prioridade elevada com veículo já tripulado (+5). A resposta traz os motivos de
> cada pontuação — a decisão final continua sendo do operador.
>
> **Concorrência (RNF05):** um chamado só pode ter uma atribuição ativa, e um veículo
> só pode estar em um chamado por vez — garantido por índices únicos parciais no banco.
> Se dois operadores acionarem o mesmo veículo ao mesmo tempo, o segundo recebe `409`
> (`VEICULO_JA_ATRIBUIDO` / `CHAMADO_JA_ATRIBUIDO`). Cancelar o chamado libera o veículo.

**Atendimentos (RF09/RF10)** — marcos pelo motorista; validação pela central.

| Método | Rota | Acesso | Descrição |
|--------|------|--------|-----------|
| GET    | `/api/atendimentos`                     | Autenticado | Lista (motorista: os seus; filtros: `status`, `chamado_id`, `veiculo_id`, `validado`, `desde`, `ate`) |
| GET    | `/api/atendimentos/:id`                 | Autenticado | Detalhe + **métricas recalculadas** + conferência de consistência |
| POST   | `/api/atendimentos`                     | `motorista` | Inicia o atendimento (`chamado_id`, `km_saida`) |
| PATCH  | `/api/atendimentos/:id/chegada-local`   | `motorista` | Marca chegada ao local (`km_local`) |
| PATCH  | `/api/atendimentos/:id/inicio-transporte` | `motorista` | Marca o início do transporte |
| PATCH  | `/api/atendimentos/:id/concluir`        | `motorista`/`central` | Conclui (`km_final`); encerra o chamado e libera o veículo |
| PATCH  | `/api/atendimentos/:id/cancelar`        | `motorista`/`central` | Cancela o atendimento (o veículo segue acionado) |
| POST   | `/api/atendimentos/:id/validar`         | `central`   | **Valida os cálculos** (`aprovado`, ajustes e justificativa) |

> **Ciclo:** `a_caminho` → `no_local` → `em_transporte` → `concluido` (é possível
> concluir direto de qualquer etapa, ex.: paciente atendido no local sem transporte).
>
> **Métricas (RNF09):** calculadas por funções puras em `services/metricasAtendimento`
> — distância total, até o local e de transporte; tempo de resposta, no local, de
> transporte e total. Distâncias em km inteiros pela diferença do painel; tempos em
> minutos inteiros (arredondamento padrão). Marco ausente ⇒ métrica `null` (nunca `0`).
> A quilometragem nunca pode retroceder — garantido por `CHECK` no banco e validação na API.
>
> **Validação manual (RF10):** `GET /atendimentos/:id` devolve o valor **armazenado** e o
> **recalculado**, além de uma `conferencia` que aponta inconsistências (km retrocedendo,
> horários fora de ordem, velocidade média implausível). A central então aprova ou
> registra ajuste com justificativa — sem sobrescrever o dado original do motorista.

**GPS e Monitoramento (RF11/RNF10)**

| Método | Rota | Acesso | Descrição |
|--------|------|--------|-----------|
| POST   | `/api/posicoes`      | `motorista`/`central` | Envia uma posição (tempo real) |
| POST   | `/api/posicoes/lote` | `motorista`/`central` | Envia um lote (sincronização após perda de sinal) |
| GET    | `/api/frota`         | `central` | Mapa: última posição e **status de rastreamento** de cada veículo (filtros: `status`, `unidade_id`) |
| GET    | `/api/frota/stream`  | `central` (SSE) | Posições em tempo real (evento `frota:posicao`) |
| GET    | `/api/frota/veiculos/:id/posicoes` | `central` | Rastro do veículo (`desde`, `ate`, `limite`, `incluir_descartadas`) |

> **Confiabilidade do GPS (RNF10):**
> - **Perda de sinal:** o status vem da *idade* da última posição — `online` (≤ 2 min),
>   `instavel` (≤ 10 min), `offline` (acima) ou `sem_dados`. A central sabe quando o
>   dado no mapa não é confiável em vez de ver um veículo “parado” por engano.
> - **Reenvio sem duplicar:** `UNIQUE (veiculo_id, registrado_em)` + `ON CONFLICT DO NOTHING`;
>   o app pode reenviar o mesmo lote à vontade (a resposta informa quantas eram duplicadas).
> - **Leituras ruins:** coordenadas inválidas ou `(0,0)` (GPS sem *fix*) e precisão acima de
>   500 m são **rejeitadas**; “saltos” que exigiriam mais de 200 km/h são **gravados e
>   marcados como suspeitos** (não entram no mapa nem no cálculo do próximo salto), preservando
>   o dado bruto para auditoria.
> - `registrado_em` (relógio do aparelho) é separado de `recebido_em` (chegada ao servidor):
>   a diferença mede quanto tempo o veículo ficou sem conexão.

**Histórico (RF12)** — somente `central`.

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/historico` | Linha do tempo consolidada (turnos, atendimentos, chamados) com filtros `motorista_id`, `veiculo_id`, `unidade_id`, `desde`, `ate`, `limite`, `offset` |
| GET | `/api/historico/resumo` | Indicadores do período (atendimentos, km, tempo médio de resposta, chamados, frota) |
| GET | `/api/historico/veiculos/:id` | Histórico do veículo: turnos, atendimentos e resumo |
| GET | `/api/historico/motoristas/:id` | Histórico do motorista: turnos, atendimentos e resumo |

**Notificações (RF15)**

| Método | Rota | Acesso | Descrição |
|--------|------|--------|-----------|
| GET   | `/api/notificacoes`          | Autenticado | Lista as suas (recepcionista vê as da unidade; central vê todas) |
| GET   | `/api/notificacoes/stream`   | Autenticado (SSE) | Notificações em tempo real (`notificacao:nova`) |
| PATCH | `/api/notificacoes/:id/lida` | Autenticado | Marca uma como lida |
| PATCH | `/api/notificacoes/lidas`    | Autenticado | Marca todas as visíveis como lidas |

**Painel do motorista (RNF11)**

| Método | Rota | Acesso | Descrição |
|--------|------|--------|-----------|
| GET | `/api/motorista/painel` | `motorista` | Turno, veículo, chamado acionado, atendimento em curso e **próxima ação** já preenchida |

> **Chegada notificada automaticamente (RF15 + RNF11):** a cada posição de GPS o
> servidor calcula a distância até a unidade de destino do atendimento em curso; ao
> entrar no raio (padrão **300 m**, `NOTIFICACAO_RAIO_CHEGADA_M`), a recepcionista daquela
> unidade é notificada — **sem o motorista tocar em nada**. A notificação é criada uma
> única vez por atendimento (índice único parcial), mesmo com dezenas de leituras dentro
> do raio, e chega em tempo real pelo SSE. Se a unidade não tiver recepcionista cadastrado,
> a notificação é registrada para a unidade, para o evento não se perder.
>
> **Menos toques no app (RNF11):** `GET /motorista/painel` resolve a tela inicial em uma
> única chamada e indica a próxima ação com os campos já sugeridos (ex.: a quilometragem
> atual do veículo), além de o sistema herdar sozinho motorista, veículo e turno nas
> operações — o motorista confirma, não digita.

**Rotas e ETA (RF16/RF17)** — `central` e `motorista`.

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/rotas/eta` | ETA entre dois pontos (`origem_lat/lng`, `destino_lat/lng`, `prioridade?`) |
| GET | `/api/rotas/sugerir` | Rota sugerida (com passos, quando o provedor externo responder) |
| GET | `/api/chamados/:id/eta` | Previsão do veículo acionado até a ocorrência **e** da ocorrência até a unidade |
| GET | `/api/atendimentos/:id/rota` | Rota do ponto atual até o próximo destino (ocorrência ou unidade, conforme a etapa) |

> **Dois níveis, para nunca ficar sem resposta:** com `GOOGLE_MAPS_API_KEY` configurada o
> sistema usa o **Google Directions** (distância, duração e passos reais). Sem a chave — ou
> se a API falhar, demorar mais que `MAPAS_TIMEOUT_MS` ou estourar cota — o cálculo cai
> automaticamente na **estimativa local**: distância em linha reta (Haversine) × fator de
> sinuosidade (1.3) ÷ velocidade média, que varia com a prioridade (60 km/h para crítica,
> 40 km/h para média). Toda resposta traz o campo **`fonte`** (`google` ou `estimativa`) —
> e `degradado: true` quando houve falha do provedor — para o operador saber o grau de
> confiança do número. Consultas repetidas usam cache curto, poupando cota.
>
> **Previsto × realizado:** no acionamento, o ETA é gravado na atribuição
> (`eta_minutos`, `distancia_estimada_km`, `eta_fonte`); depois, o atendimento registra o
> `tempo_resposta_min` real — a comparação alimenta os relatórios da Sprint 10.

**Relatórios (RF13)** — somente `central`. Formatos: `?formato=json` (padrão), `csv`, `html`.

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/relatorios/operacional` | Atendimentos do período (filtros `desde`, `ate`, `unidade_id`, `status`) |
| GET | `/api/relatorios/frota` | Uso por veículo: atendimentos, km, tempo médio, odômetro |
| GET | `/api/relatorios/desempenho` | Por motorista, com **previsto × realizado** e o desvio |

**Auditoria (RF14)** — somente `central`, apenas leitura.

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/auditoria` | Registros (filtros `usuario_id`, `entidade`, `acao`, `sucesso`, período, paginação) |
| GET | `/api/auditoria/resumo` | Totais, ações mais frequentes e usuários mais ativos |
| GET | `/api/auditoria/entidades/:entidade/:id` | Trilha completa de um registro específico |

**Saúde (RNF08)**

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/health/live` | *Liveness* — processo vivo (não consulta o banco) |
| GET | `/api/health/ready` | *Readiness* — `503` se o banco não responder |

> **Exportação sem dependências pesadas (RF13):** o CSV sai com BOM UTF-8 e separador `;`,
> abrindo direto no Excel com acentuação correta; o HTML vem com folha de estilo de
> impressão (cabeçalho repetido por página, linhas sem quebra), permitindo
> **Imprimir → Salvar como PDF** no próprio navegador. A decisão evita adicionar
> bibliotecas de PDF/XLSX ao backend, mantendo a instalação simples.
>
> **Auditoria automática (RF14):** um middleware observa cada requisição e grava o
> registro **depois** de a resposta ser enviada — sem atrasar o usuário e sem derrubar a
> operação caso a gravação falhe. São auditadas todas as escritas (POST/PUT/PATCH/DELETE)
> **e as tentativas negadas** (401/403), que são informação de segurança tão relevante
> quanto o sucesso. Campos sensíveis (senha, token, segredo, chave) são mascarados antes
> de salvar, e a tabela é *append-only*: não há endpoint de edição ou exclusão.

**Sincronização offline (RNF03)** — `motorista` e `central`.

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/sync` | Envia o pacote acumulado no celular; devolve o resultado item a item |
| GET | `/api/sync/estado?desde=<ISO>` | Delta desde um instante, para o app atualizar o cache local |

> **Como a idempotência funciona:** o app gera o `id` (UUID) de cada registro **antes** de
> ter rede. Se o pacote for reenviado — queda no meio do envio, app reaberto, timeout — o
> servidor reconhece o `id` já gravado e devolve `duplicado` em vez de criar outro
> registro. Cada item é processado numa transação própria: uma falha isolada não descarta
> o restante do pacote, e o app recebe exatamente quais itens precisam de atenção
> (`aplicado`, `duplicado` ou `falha`). Os horários do **evento** (`inicio_em`, `fim_em`,
> `realizado_em`) vêm do celular; o horário de **gravação** é do servidor — assim o
> relatório mostra quando o fato ocorreu, não quando chegou a internet.

**Desempenho (RNF06)** — somente `central`.

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/metricas` | p50/p95/p99 por rota, contagem e rotas lentas |
| POST | `/api/metricas/zerar` | Zera a janela de amostragem |

> Toda resposta traz o cabeçalho `X-Response-Time`. As amostras ficam em memória
> (janela circular por rota), sem custo de banco — suficiente para evidenciar o RNF06 e
> localizar o gargalo antes de otimizar.

**LGPD (RNF02)**

| Método | Rota | Papel | Descrição |
|--------|------|-------|-----------|
| GET | `/api/lgpd/termo` | autenticado | Termo vigente: finalidades, prazos e direitos |
| GET | `/api/lgpd/consentimentos` | autenticado | Situação dos consentimentos do próprio usuário |
| POST | `/api/lgpd/consentimentos` | autenticado | Registra aceite **ou revogação** |
| GET | `/api/lgpd/meus-dados` | autenticado | Acesso e **portabilidade** (`?download=true`) |
| GET | `/api/lgpd/usuarios/:id/dados` | central | Atende a requisição de titular |
| POST | `/api/lgpd/usuarios/:id/anonimizar` | central | Anonimização irreversível |
| POST | `/api/lgpd/retencao` | central | Expurgo por prazo (**simula** sem `executar: true`) |

> **Por que anonimizar em vez de excluir:** apagar um motorista apagaria a rastreabilidade
> dos atendimentos que ele realizou — justamente o que o projeto veio preservar. O sistema
> substitui os dados identificáveis por um pseudônimo irreversível e mantém o registro
> operacional; pelo art. 12 da LGPD, dado anonimizado deixa de ser dado pessoal. Detalhes
> em `docs/lgpd.md`.

Todas as rotas protegidas esperam o cabeçalho:

```
Authorization: Bearer <ID_TOKEN_DO_FIREBASE>
```

### Exemplos

Bootstrap do primeiro operador central:

```bash
curl -X POST http://localhost:3000/api/auth/bootstrap \
  -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"segredo":"<BOOTSTRAP_SECRET>","nome":"Operador Central"}'
```

Registro de um motorista:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nome":"João Motorista","papel":"motorista"}'
```

## Fluxo de autenticação

1. O cliente (app Flutter / web Next.js) autentica no **Firebase Authentication** e recebe um **ID token**.
2. O cliente envia o token no cabeçalho `Authorization: Bearer`.
3. O `authMiddleware` pede ao Firebase Admin para **verificar** o token.
4. O backend cruza o `firebase_uid` com a tabela `usuarios` e injeta o perfil (incl. `papel`) em `req.usuario`.
5. Rotas sensíveis usam `autorizarPapel(...)` para restringir por papel (RBAC).

O backend **não armazena senhas** — essa responsabilidade é do Firebase.

## Mapeamento com os requisitos

| Requisito | Onde é atendido |
|-----------|-----------------|
| **RF01** — Autenticar usuários (motorista, central, recepcionista) | `authMiddleware`, `authController`, tabela `usuarios` com `papel` |
| **RF02** — Gerenciar veículos, motoristas e unidades | `unidadeController`, `veiculoController`, `usuarioController` + rotas com RBAC; migration `002` (`veiculos`) |
| **RF03** — Início/fim de turno com foto e quilometragem | `turnoController` (iniciar/encerrar), tabela `turnos`; atualiza status/km do veículo |
| **RF04** — Checklist obrigatório antes do turno | `checklistItens` (catálogo), tabela `checklists`; item crítico não-conforme bloqueia o turno |
| **RNF03** — Operação parcialmente offline (início) | Idempotência por `id` do cliente + horários de evento (`inicio_em`/`fim_em`/`realizado_em`) separados do horário de sincronização |
| **RF05** — Criar, classificar e priorizar chamados | `chamadoController` + tabela `chamados` (tipo, prioridade, natureza, origem/destino); prioridade derivada do tipo |
| **RF06** — Alerta sonoro/visual na central | SSE (`services/chamadosEventos` + `GET /api/chamados/stream`); evento `chamado:novo` no cadastro |
| **RF07** — Atribuir chamados manualmente | `atribuicaoController` + tabela `atribuicoes` (migration `005`); reatribuição transacional e liberação do veículo |
| **RF08** — Sugerir unidade/veículo (regra simples) | `services/sugestaoVeiculo` — pontuação por disponibilidade, turno, unidade de destino e proximidade (Haversine), com motivos |
| **RF09** — Registrar início, andamento e fim dos atendimentos | `atendimentoController` + tabela `atendimentos` (migration `006`) com marcos de horário e quilometragem |
| **RF10** — Validação manual dos cálculos | `POST /atendimentos/:id/validar` + comparação entre valor armazenado e recalculado, com `conferencia` de inconsistências |
| **RNF09** — Precisão dos cálculos | `services/metricasAtendimento` (funções puras, arredondamento documentado) + `CHECK`s impedindo quilometragem retroativa |
| **RF11** — Monitorar a frota em tempo real via GPS | `posicaoController` + tabela `posicoes` (migration `007`), mapa `GET /frota` e SSE `GET /frota/stream` |
| **RNF10** — Confiabilidade do GPS | `services/rastreamento` — validação, status por idade da última posição, detecção de salto impossível e reenvio idempotente |
| **RF12** — Histórico completo da frota e atendimentos | `historicoController` — linha do tempo consolidada, recortes por veículo/motorista e resumo agregado |
| **RF15** — Notificar a recepcionista na chegada | `services/notificacoes` (geofence no envio de GPS) + tabela `notificacoes` (migration `008`) e SSE |
| **RNF11** — Minimizar interações do motorista | Notificação de chegada automática por GPS + `GET /motorista/painel` (próxima ação pronta) + herança de motorista/veículo/turno |
| **RF16** — Tempo estimado de chegada via API | `services/mapas` + `GET /rotas/eta` e `GET /chamados/:id/eta`; ETA gravado na atribuição (migration `009`) |
| **RF17** — Sugestão de rotas (básica, via API) | `GET /rotas/sugerir` e `GET /atendimentos/:id/rota`, com passos do provedor e fallback local |
| **RF13** — Gerar e exportar relatórios | `relatorioController` + `services/exportacao` (JSON, CSV para Excel e HTML para PDF) |
| **RF14** — Registrar logs de auditoria | `middlewares/auditoria` (automático) + tabela `auditoria` (migration `010`) e consultas em `/auditoria` |
| **RNF07** — Escalabilidade (conceitual) | Pool configurável, timeouts, índices, paginação, envio em lote, cache de rotas — análise em `docs/escalabilidade.md` |
| **RNF08** — Alta disponibilidade (básica) | *Liveness/readiness*, encerramento gracioso, degradação controlada (mapas, GPS, Firebase) — análise em `docs/disponibilidade.md` |
| **RNF05** — Múltiplos usuários simultâneos (conclusão) | Broadcast SSE para várias centrais; índices únicos parciais garantindo 1 atribuição ativa por chamado/veículo, com conflito traduzido em 409 |
| **RNF01** — Segurança e integridade (início) | Helmet, CORS restrito, rate limiting, validação Zod, `CHECK`/FK no schema, tratamento de erros sem vazar stack em produção, `.env`/chave fora do versionamento, atribuição de papel controlada pela central, chave de API para sistema externo |
| **RNF03** — Operação parcialmente offline (conclusão) | `syncController` — pacote aplicado item a item, idempotente por `id` do cliente, com `GET /sync/estado` para o delta |
| **RNF06** — Tempo de resposta | `middlewares/metricas` — `X-Response-Time`, p50/p95/p99 por rota em `GET /metricas`; índices e paginação nas consultas pesadas |
| **RNF02** — LGPD nível básico | `services/lgpd` + migration `011` — consentimento versionado, portabilidade, anonimização irreversível e retenção; análise em `docs/lgpd.md` |
| **RNF01** — Segurança e integridade (conclusão) | Rate limit global, HSTS em produção, CORS `"*"` recusado em produção, verificação de segredos fracos na inicialização — consolidado em `docs/seguranca.md` |

## Próximos passos (Sprint 12)

- **Testes e validação** de todo o sistema: testes automatizados das regras de negócio,
  testes de integração dos fluxos principais e validação com usuários.
- Correção dos problemas encontrados e ajuste final de desempenho.

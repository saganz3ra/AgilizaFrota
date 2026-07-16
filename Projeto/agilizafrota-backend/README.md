# Agiliza Frota — Backend

API REST do sistema de gestão de frotas hospitalares **Agiliza Frota** (TCC).
Stack: **Node.js + Express**, **PostgreSQL** (SQL puro via `pg`), **Firebase Authentication**.

> **Sprint 1 — Setup + Autenticação** (22/04 → 05/05).
> Fundação do projeto, modelagem base do banco, camada de segurança e autenticação de usuários (RF01), atendendo ao início do requisito de segurança e integridade (RNF01).
>
> **Sprint 2 — Cadastros + UX base** (06/05 → 19/05).
> Gestão de **unidades**, **veículos** e **usuários/motoristas** (RF02), com RBAC (escritas pela central), soft-delete para rastreabilidade e cadastro de usuários integrado ao Firebase Admin. UX/design system fica para a camada web (decisão de backend primeiro).
>
> **Sprint 3 — Turno + Checklist** (20/05 → 02/06).
> Início/fim de **turno** com foto e quilometragem (RF03) e **checklist** obrigatório de inspeção antes do turno (RF04). Backend preparado para **sincronização offline** (RNF03): id gerado no cliente (reenvio idempotente) e horários de evento separados do horário de sincronização. Foto: guardamos apenas a URL do Firebase Storage.
>
> **Sprint 4 — Chamados + Alertas** (03/06 → 16/06).
> Criar, classificar e priorizar **chamados** por urgência/emergência (RF05), abertos pela central ou por **sistema externo** (chave de API). **Alerta em tempo real** na central via **SSE** (RF06). Início do suporte a **múltiplos usuários simultâneos** (RNF05): o stream entrega eventos a várias centrais conectadas ao mesmo tempo.

---

## Sumário

- [Arquitetura e organização](#arquitetura-e-organização)
- [Pré-requisitos](#pré-requisitos)
- [Passo a passo de setup](#passo-a-passo-de-setup)
- [Endpoints](#endpoints)
- [Fluxo de autenticação](#fluxo-de-autenticação)
- [Mapeamento com os requisitos](#mapeamento-com-os-requisitos)
- [Próximos passos (Sprint 2)](#próximos-passos-sprint-2)

---

## Arquitetura e organização

Arquitetura em camadas, seguindo o estilo REST definido na especificação base do projeto.

```
agilizafrota-backend/
├── docker-compose.yml        # PostgreSQL local para desenvolvimento
├── .env.example              # Modelo de variáveis de ambiente
├── firebase-key.json.example # Modelo da chave de serviço do Firebase
├── package.json
└── src/
    ├── server.js             # Sobe o servidor HTTP
    ├── app.js                # Express + segurança (helmet, cors, etc.)
    ├── config/
    │   ├── env.js            # Carga e validação das variáveis de ambiente
    │   ├── db.js             # Pool de conexões PostgreSQL
    │   └── firebase.js       # Inicialização do Firebase Admin
    ├── db/
    │   ├── migrate.js        # Runner de migrations (.sql)
    │   ├── seed.js           # Dados iniciais de exemplo
    │   └── migrations/
    │       ├── 001_init.sql             # Extensão UUID + unidades e usuarios
    │       ├── 002_veiculos.sql         # Tabela veiculos + triggers
    │       ├── 003_turnos_checklists.sql # Tabelas turnos e checklists
    │       └── 004_chamados.sql         # Tabela chamados
    ├── constants/
    │   └── checklistItens.js # Catálogo fixo de itens do checklist (RF04)
    ├── services/
    │   └── chamadosEventos.js # Barramento SSE de eventos (RF06)
    ├── middlewares/
    │   ├── authMiddleware.js # Token Firebase + perfil (+ variante SSE)
    │   ├── authorizeRole.js  # RBAC por papel
    │   ├── apiKey.js         # Auth do sistema externo (X-API-Key)
    │   ├── validate.js       # Validação de entrada (Zod)
    │   └── errorHandler.js   # 404 + tratamento de erros centralizado
    ├── controllers/
    │   ├── authController.js     # register, me, bootstrap
    │   ├── unidadeController.js   # CRUD de unidades
    │   ├── veiculoController.js   # CRUD de veículos
    │   ├── usuarioController.js   # Gestão de usuários (central)
    │   ├── turnoController.js     # Turno + checklist (RF03/RF04)
    │   └── chamadoController.js   # Chamados + SSE (RF05/RF06)
    ├── routes/
    │   ├── index.js          # Agregador (/api)
    │   ├── healthRoutes.js   # /api/status, /api/health
    │   ├── authRoutes.js     # /api/auth/*
    │   ├── unidadeRoutes.js  # /api/unidades/*
    │   ├── veiculoRoutes.js  # /api/veiculos/*
    │   ├── usuarioRoutes.js  # /api/usuarios/*
    │   ├── turnoRoutes.js    # /api/turnos/*
    │   └── chamadoRoutes.js  # /api/chamados/*
    ├── validators/
    │   ├── authValidators.js
    │   ├── unidadeValidators.js
    │   ├── veiculoValidators.js
    │   ├── usuarioValidators.js
    │   ├── turnoValidators.js
    │   └── chamadoValidators.js
    └── utils/
        ├── AppError.js       # Erro de aplicação com status HTTP
        └── asyncHandler.js   # Wrapper para handlers assíncronos
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
| **RNF05** — Múltiplos usuários simultâneos (início) | Broadcast SSE para várias centrais; tratamento de conflito de concorrência (409) em operações críticas |
| **RNF01** — Segurança e integridade (início) | Helmet, CORS restrito, rate limiting, validação Zod, `CHECK`/FK no schema, tratamento de erros sem vazar stack em produção, `.env`/chave fora do versionamento, atribuição de papel controlada pela central, chave de API para sistema externo |

## Próximos passos (Sprint 5)

- Atribuir chamados manualmente (RF07).
- Sugerir unidade/veículo adequado — regra simples, sem ML (RF08).
- Conclusão do suporte a **múltiplos usuários simultâneos** (RNF05).

-- ==========================================================================
-- Migration 001 - Fundacao (Sprint 1: Setup + Autenticacao)
-- Cria a extensao de UUID e as tabelas base "unidades" e "usuarios".
--
-- Decisoes de modelagem:
--  - UUID como PK (em vez de serial): dificulta enumeracao de IDs e facilita
--    a sincronizacao com o modo offline previsto para sprints futuras.
--  - firebase_uid: "ancora" entre o Firebase Authentication e o banco. O
--    backend nao guarda senhas; apenas valida o token e cruza pelo UID.
--  - CHECK constraints garantem integridade dos dados (RNF01), impedindo
--    papeis ou status invalidos direto no banco.
--  - "unidades" e criada aqui por ser pre-requisito da FK de "usuarios"
--    (recepcionista pertence a uma unidade). O CRUD de unidades/veiculos
--    entra na Sprint 2.
-- ==========================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- --------------------------------------------------------------------------
-- Tabela: unidades (hospitais / pontos de apoio)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS unidades (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome        VARCHAR(100) NOT NULL,
  endereco    TEXT         NOT NULL,
  cidade      VARCHAR(50)  NOT NULL DEFAULT 'Guarapuava',
  lat         DECIMAL(9,6),   -- reservado para o rastreio GPS (sprints futuras)
  lng         DECIMAL(9,6),
  ativo       BOOLEAN      NOT NULL DEFAULT TRUE,
  criado_em   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------------------------
-- Tabela: usuarios (integrada ao Firebase Auth)
-- Papeis: motorista | central | recepcionista (RF01)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firebase_uid  VARCHAR(128) UNIQUE NOT NULL,
  nome          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) UNIQUE NOT NULL,
  papel         VARCHAR(20)  NOT NULL
                CHECK (papel IN ('motorista', 'central', 'recepcionista')),
  unidade_id    UUID REFERENCES unidades(id) ON DELETE SET NULL,
  telefone      VARCHAR(20),
  ativo         BOOLEAN      NOT NULL DEFAULT TRUE,
  criado_em     TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Integridade de negocio: recepcionista precisa estar vinculado a uma unidade.
  CONSTRAINT chk_recepcionista_unidade
    CHECK (papel <> 'recepcionista' OR unidade_id IS NOT NULL)
);

-- Indices para as buscas mais frequentes (login/autorizacao).
CREATE INDEX IF NOT EXISTS idx_usuarios_firebase_uid ON usuarios (firebase_uid);
CREATE INDEX IF NOT EXISTS idx_usuarios_papel        ON usuarios (papel);
CREATE INDEX IF NOT EXISTS idx_usuarios_unidade_id   ON usuarios (unidade_id);

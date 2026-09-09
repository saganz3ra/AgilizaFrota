-- ==========================================================================
-- Migration 010 - Auditoria (Sprint 10, RF14)
--
-- Registra QUEM fez O QUE, QUANDO e DE ONDE nas acoes criticas do sistema.
-- Em uma frota publica isso e o que sustenta a transparencia e a fiscalizacao
-- citadas na justificativa do projeto (substituir o papel sem perder o rastro).
--
-- Decisoes:
--  - Tabela APPEND-ONLY: nunca sofre UPDATE nem DELETE pela aplicacao. O log
--    so ganha linhas; corrigir um dado gera um NOVO registro.
--  - "dados_antes"/"dados_depois" em JSONB permitem reconstruir a mudanca sem
--    depender do formato das tabelas de origem.
--  - Tentativas NEGADAS (401/403) tambem sao registradas: uma tentativa de
--    acesso indevido e informacao de seguranca tao relevante quanto o sucesso.
--  - Indices pensados para as consultas de fiscalizacao: por periodo, por
--    usuario e por entidade afetada.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS auditoria (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id     UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  usuario_email  VARCHAR(150),          -- copia: preserva o rastro se o usuario for removido
  papel          VARCHAR(20),
  acao           VARCHAR(60) NOT NULL,  -- ex.: criar_chamado, atribuir_chamado
  entidade       VARCHAR(40),           -- ex.: chamados, veiculos
  entidade_id    UUID,
  metodo         VARCHAR(10) NOT NULL,
  rota           TEXT NOT NULL,
  status_http    INTEGER NOT NULL,
  sucesso        BOOLEAN NOT NULL,
  dados_antes    JSONB,
  dados_depois   JSONB,
  ip             VARCHAR(60),
  user_agent     TEXT,
  duracao_ms     INTEGER,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auditoria_criado_em ON auditoria (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario   ON auditoria (usuario_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_entidade  ON auditoria (entidade, entidade_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_acao      ON auditoria (acao);
CREATE INDEX IF NOT EXISTS idx_auditoria_negadas   ON auditoria (sucesso) WHERE sucesso = FALSE;

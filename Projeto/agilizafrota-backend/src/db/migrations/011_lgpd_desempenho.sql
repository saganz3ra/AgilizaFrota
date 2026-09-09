-- ==========================================================================
-- Migration 011 - LGPD e desempenho (Sprint 11, RNF02/RNF06)
--
-- LGPD (Lei 13.709/2018) em nivel basico, conforme o escopo:
--  - CONSENTIMENTO: registro explicito por finalidade e versao do termo,
--    com data, IP e possibilidade de revogacao (art. 8, par. 5).
--  - ANONIMIZACAO: em vez de apagar a pessoa (o que destruiria o historico
--    operacional e a auditoria da frota publica), os dados pessoais sao
--    substituidos e o registro fica marcado como anonimizado. Os
--    atendimentos continuam existindo, sem identificar o titular
--    (art. 12: dado anonimizado nao e dado pessoal).
--  - RETENCAO: as posicoes de GPS sao o dado mais sensivel (revelam
--    deslocamento) e o de maior volume; a politica de expurgo vive no
--    servico de LGPD e usa os indices abaixo.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS consentimentos (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  finalidade    VARCHAR(60) NOT NULL
                CHECK (finalidade IN ('uso_do_sistema', 'geolocalizacao', 'comunicacoes')),
  versao_termo  VARCHAR(20) NOT NULL,
  aceito        BOOLEAN NOT NULL DEFAULT TRUE,
  aceito_em     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revogado_em   TIMESTAMPTZ,
  ip            VARCHAR(60),
  user_agent    TEXT,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_consentimentos_usuario ON consentimentos (usuario_id, finalidade);
-- Um consentimento VIGENTE por finalidade (revogados ficam no historico).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_consentimento_vigente
  ON consentimentos (usuario_id, finalidade) WHERE revogado_em IS NULL;

-- Marcacao de anonimizacao no titular.
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS anonimizado     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS anonimizado_em  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_usuarios_anonimizado ON usuarios (anonimizado) WHERE anonimizado = TRUE;

-- --------------------------------------------------------------------------
-- Indices de desempenho (RNF06) para as consultas mais frequentes do painel
-- e dos relatorios, medidas ao longo das sprints anteriores.
-- --------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_atendimentos_motorista_inicio ON atendimentos (motorista_id, inicio_em DESC);
CREATE INDEX IF NOT EXISTS idx_atendimentos_veiculo_inicio   ON atendimentos (veiculo_id, inicio_em DESC);
CREATE INDEX IF NOT EXISTS idx_chamados_status_prioridade    ON chamados (status, prioridade);
CREATE INDEX IF NOT EXISTS idx_turnos_motorista_inicio       ON turnos (motorista_id, inicio_em DESC);
-- Atendimentos em andamento: consultado a cada posicao de GPS recebida.
CREATE INDEX IF NOT EXISTS idx_atendimentos_em_andamento
  ON atendimentos (veiculo_id) WHERE status IN ('a_caminho', 'no_local', 'em_transporte');

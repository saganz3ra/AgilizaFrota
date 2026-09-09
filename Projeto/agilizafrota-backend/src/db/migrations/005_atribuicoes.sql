-- ==========================================================================
-- Migration 005 - Atribuicao de chamados (Sprint 5)
-- Tabela "atribuicoes" (RF07). A sugestao (RF08) e calculada em tempo de
-- execucao pelo servico de sugestao, nao exige tabela.
--
-- Decisoes:
--  - A atribuicao e uma ENTIDADE (nao apenas colunas no chamado) para manter
--    o historico completo de quem foi acionado, quando e por quem, o que
--    alimenta o historico (RF12) e a auditoria (RF14) das sprints seguintes.
--  - Indices unicos parciais garantem as invariantes sob concorrencia (RNF05):
--      * no maximo UMA atribuicao ativa por chamado;
--      * no maximo UMA atribuicao ativa por veiculo (um veiculo nao pode
--        atender dois chamados ao mesmo tempo).
--  - "origem" registra se a escolha foi manual ou seguiu a sugestao do
--    sistema - util para avaliar a utilidade da regra no TCC.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS atribuicoes (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chamado_id           UUID NOT NULL REFERENCES chamados(id) ON DELETE CASCADE,
  veiculo_id           UUID NOT NULL REFERENCES veiculos(id),
  motorista_id         UUID REFERENCES usuarios(id),
  turno_id             UUID REFERENCES turnos(id) ON DELETE SET NULL,
  atribuido_por        UUID REFERENCES usuarios(id),
  origem               VARCHAR(20) NOT NULL DEFAULT 'manual'
                       CHECK (origem IN ('manual', 'sugestao')),
  status               VARCHAR(20) NOT NULL DEFAULT 'ativa'
                       CHECK (status IN ('ativa', 'cancelada', 'concluida')),
  motivo_cancelamento  TEXT,
  atribuido_em         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  encerrado_em         TIMESTAMPTZ,
  criado_em            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_atribuicoes_chamado   ON atribuicoes (chamado_id);
CREATE INDEX IF NOT EXISTS idx_atribuicoes_veiculo   ON atribuicoes (veiculo_id);
CREATE INDEX IF NOT EXISTS idx_atribuicoes_motorista ON atribuicoes (motorista_id);
CREATE INDEX IF NOT EXISTS idx_atribuicoes_status    ON atribuicoes (status);

-- Invariantes de concorrencia (RNF05).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_atribuicao_ativa_chamado
  ON atribuicoes (chamado_id) WHERE status = 'ativa';
CREATE UNIQUE INDEX IF NOT EXISTS uniq_atribuicao_ativa_veiculo
  ON atribuicoes (veiculo_id) WHERE status = 'ativa';

DROP TRIGGER IF EXISTS trg_atribuicoes_atualizado_em ON atribuicoes;
CREATE TRIGGER trg_atribuicoes_atualizado_em
  BEFORE UPDATE ON atribuicoes
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

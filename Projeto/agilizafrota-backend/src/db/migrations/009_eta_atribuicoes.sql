-- ==========================================================================
-- Migration 009 - ETA no acionamento (Sprint 9)
-- Guarda o tempo estimado de chegada calculado NO MOMENTO do acionamento
-- (RF16). Assim e possivel comparar depois o PREVISTO com o REALIZADO
-- (tempo_resposta_min do atendimento) - insumo direto para os relatorios
-- da Sprint 10 e para a avaliacao do sistema no TCC.
-- ==========================================================================

ALTER TABLE atribuicoes
  ADD COLUMN IF NOT EXISTS eta_minutos           INTEGER
    CHECK (eta_minutos IS NULL OR eta_minutos >= 0),
  ADD COLUMN IF NOT EXISTS distancia_estimada_km DECIMAL(8,2)
    CHECK (distancia_estimada_km IS NULL OR distancia_estimada_km >= 0),
  ADD COLUMN IF NOT EXISTS eta_fonte             VARCHAR(20)
    CHECK (eta_fonte IS NULL OR eta_fonte IN ('google', 'estimativa'));

CREATE INDEX IF NOT EXISTS idx_atribuicoes_eta ON atribuicoes (eta_minutos);

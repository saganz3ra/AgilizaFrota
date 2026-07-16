-- ==========================================================================
-- Migration 002 - Cadastros (Sprint 2: Cadastros + UX base)
-- Cria a tabela "veiculos" (RF02) e triggers para manter "atualizado_em".
-- ==========================================================================

-- --------------------------------------------------------------------------
-- Tabela: veiculos
--  - status controla a disponibilidade operacional (usado no monitoramento
--    e na sugestao de veiculo em sprints futuras).
--  - unidade_id: unidade de origem/lotacao do veiculo.
--  - placa unica (integridade RNF01).
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS veiculos (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  placa                VARCHAR(10)  UNIQUE NOT NULL,
  modelo               VARCHAR(50)  NOT NULL,
  marca                VARCHAR(30),
  ano                  INTEGER      CHECK (ano IS NULL OR (ano BETWEEN 1950 AND 2100)),
  quilometragem_atual  INTEGER      NOT NULL DEFAULT 0 CHECK (quilometragem_atual >= 0),
  status               VARCHAR(20)  NOT NULL DEFAULT 'disponivel'
                       CHECK (status IN ('disponivel', 'em_uso', 'manutencao')),
  unidade_id           UUID REFERENCES unidades(id) ON DELETE SET NULL,
  ultima_revisao       DATE,
  ativo                BOOLEAN      NOT NULL DEFAULT TRUE,
  criado_em            TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em        TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_veiculos_status     ON veiculos (status);
CREATE INDEX IF NOT EXISTS idx_veiculos_unidade_id ON veiculos (unidade_id);
CREATE INDEX IF NOT EXISTS idx_veiculos_placa      ON veiculos (placa);

-- --------------------------------------------------------------------------
-- Trigger: mantem "atualizado_em" sempre que uma linha e alterada.
-- Aplicado a unidades, usuarios e veiculos.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_unidades_atualizado_em ON unidades;
CREATE TRIGGER trg_unidades_atualizado_em
  BEFORE UPDATE ON unidades
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

DROP TRIGGER IF EXISTS trg_usuarios_atualizado_em ON usuarios;
CREATE TRIGGER trg_usuarios_atualizado_em
  BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

DROP TRIGGER IF EXISTS trg_veiculos_atualizado_em ON veiculos;
CREATE TRIGGER trg_veiculos_atualizado_em
  BEFORE UPDATE ON veiculos
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

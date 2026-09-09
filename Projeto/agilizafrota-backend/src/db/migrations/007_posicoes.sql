-- ==========================================================================
-- Migration 007 - Monitoramento por GPS (Sprint 7)
-- Tabela "posicoes" (RF11) com os campos necessarios para tratar
-- desconexoes e perda de sinal (RNF10).
--
-- Decisoes:
--  - "registrado_em" e o instante do EVENTO (relogio do aparelho) e
--    "recebido_em" o instante em que o servidor recebeu. A diferenca entre os
--    dois revela quanto tempo o aparelho ficou sem sinal.
--  - UNIQUE (veiculo_id, registrado_em): o app pode reenviar o mesmo lote
--    apos recuperar o sinal sem duplicar pontos (idempotencia).
--  - "qualidade" e "descartada"/"motivo_descarte" preservam pontos suspeitos
--    em vez de apaga-los: o dado bruto continua auditavel (RNF01/RF14).
-- ==========================================================================

CREATE TABLE IF NOT EXISTS posicoes (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  veiculo_id       UUID NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
  motorista_id     UUID REFERENCES usuarios(id),
  turno_id         UUID REFERENCES turnos(id) ON DELETE SET NULL,
  atendimento_id   UUID REFERENCES atendimentos(id) ON DELETE SET NULL,

  lat              DECIMAL(9,6) NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng              DECIMAL(9,6) NOT NULL CHECK (lng BETWEEN -180 AND 180),
  precisao_m       INTEGER CHECK (precisao_m IS NULL OR precisao_m >= 0),
  velocidade_kmh   DECIMAL(6,2) CHECK (velocidade_kmh IS NULL OR velocidade_kmh >= 0),
  direcao_graus    INTEGER CHECK (direcao_graus IS NULL OR direcao_graus BETWEEN 0 AND 360),
  altitude_m       INTEGER,
  bateria_pct      INTEGER CHECK (bateria_pct IS NULL OR bateria_pct BETWEEN 0 AND 100),

  -- Qualidade / confiabilidade do ponto (RNF10)
  qualidade        VARCHAR(20) NOT NULL DEFAULT 'boa'
                   CHECK (qualidade IN ('boa', 'baixa', 'suspeita')),
  descartada       BOOLEAN NOT NULL DEFAULT FALSE,
  motivo_descarte  TEXT,

  origem           VARCHAR(20) NOT NULL DEFAULT 'app'
                   CHECK (origem IN ('app', 'simulado', 'importado')),

  registrado_em    TIMESTAMPTZ NOT NULL,               -- horario do evento (aparelho)
  recebido_em      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, -- chegada ao servidor
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Reenvio do mesmo ponto apos recuperar o sinal nao duplica (RNF10/RNF03).
  CONSTRAINT uniq_posicao_veiculo_instante UNIQUE (veiculo_id, registrado_em)
);

CREATE INDEX IF NOT EXISTS idx_posicoes_veiculo_tempo ON posicoes (veiculo_id, registrado_em DESC);
CREATE INDEX IF NOT EXISTS idx_posicoes_registrado    ON posicoes (registrado_em DESC);
CREATE INDEX IF NOT EXISTS idx_posicoes_atendimento   ON posicoes (atendimento_id);
CREATE INDEX IF NOT EXISTS idx_posicoes_turno         ON posicoes (turno_id);

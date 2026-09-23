-- ---------------------------------------------------------------------------
-- 013_tipo_viatura.sql
--
-- Tipo (classificacao) da viatura hospitalar (RF02).
--
-- Por que um CHECK e nao uma tabela de referencia: os tipos sao fixos por
-- norma (A a F) e nao mudam por operacao. Um CHECK deixa o conjunto valido
-- visivel no proprio schema e recusa valor invalido no banco - nao so na
-- tela -, na mesma linha da decisao de usar SQL puro. O rotulo legivel de
-- cada tipo (Transporte Simples, UTI Movel, ...) vive no app, que e quem
-- apresenta; o banco guarda so o codigo.
--
--   A - Transporte Simples           D - Suporte Avancado (UTI Movel)
--   B - Suporte Basico de Vida       E - Aeronave
--   C - Viatura de Resgate           F - Embarcacao
-- ---------------------------------------------------------------------------

-- 1) Coluna aceitando NULL primeiro: veiculos ja cadastrados (anteriores a
--    este campo) nao teriam valor, e um NOT NULL direto quebraria o ALTER.
ALTER TABLE veiculos
  ADD COLUMN IF NOT EXISTS tipo CHAR(1)
  CHECK (tipo IS NULL OR tipo IN ('A', 'B', 'C', 'D', 'E', 'F'));

-- 2) Backfill: a frota terrestre existente vira Transporte Simples (o tipo
--    mais comum), para que a coluna possa ser obrigatoria sem descartar
--    registro. A central reclassifica depois o que for diferente.
UPDATE veiculos SET tipo = 'A' WHERE tipo IS NULL;

-- 3) Agora sim, obrigatorio: todo veiculo passa a ter um tipo.
ALTER TABLE veiculos
  ALTER COLUMN tipo SET NOT NULL;

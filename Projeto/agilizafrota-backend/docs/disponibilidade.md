# Disponibilidade (RNF08)

> "Garantir alta disponibilidade do sistema para cenários de urgência" — nível
> básico, conforme o escopo. O princípio que guiou as decisões: **degradar em
> vez de cair**. Numa operação de ambulâncias, um sistema fora do ar custa mais
> do que um sistema com informação parcial.

## 1. Verificações de saúde

| Endpoint | Responde | Uso |
|---|---|---|
| `GET /api/status` | identificação da API | Teste rápido de fumaça |
| `GET /api/health/live` | processo vivo, uptime e memória — **não toca no banco** | *Liveness*: reiniciar só se o processo travou (não porque o banco oscilou) |
| `GET /api/health/ready` | `200` se o banco responde; **`503`** se não | *Readiness*: o balanceador tira a instância da rotação até ela se recuperar |

A separação importa: se o banco cair e o *liveness* dependesse dele, o
orquestrador entraria em ciclo de reinício — piorando o problema.

## 2. Degradação controlada (já implementada)

| Situação | Comportamento | Onde |
|---|---|---|
| Provedor de mapas fora do ar, lento ou sem cota | Cai na **estimativa local** e marca `degradado: true` | `services/mapas.js` |
| Chave do Firebase ausente | A API **sobe** e responde `503` só nas rotas protegidas, com mensagem clara | `config/firebase.js` |
| GPS com leitura ruim ou salto impossível | Ponto é gravado e **marcado**, não descarta o rastro nem quebra o mapa | `services/rastreamento.js` |
| Perda de sinal do veículo | Status `instavel`/`offline` explícito no mapa | `GET /api/frota` |
| Falha ao gravar auditoria | Registra no console e **não derruba** a operação do usuário | `middlewares/auditoria.js` |
| Consulta travada | Abortada por `statement_timeout` | `config/db.js` |
| Erro inesperado | Resposta padronizada, sem vazar *stack* em produção | `middlewares/errorHandler.js` |

## 3. Encerramento gracioso

Ao receber `SIGTERM`/`SIGINT` (deploy, restart), o servidor:
1. para de aceitar novas conexões;
2. aguarda as requisições em andamento terminarem;
3. fecha o pool do banco;
4. sai — com prazo máximo de 10 s para não travar o deploy.

Isso evita respostas cortadas e transações interrompidas durante uma atualização.

## 4. Continuidade da operação em campo

- **Offline no app** (RNF03): o motorista registra turno, checklist e
  atendimento sem rede; o reenvio é **idempotente** (id gerado no cliente e
  `UNIQUE (veiculo_id, registrado_em)` nas posições), então sincronizar duas
  vezes não duplica nada.
- **Horário do evento × horário de recebimento**: preservados separadamente, de
  modo que uma indisponibilidade não corrompe a linha do tempo dos registros.

## 5. Recomendações de operação (fora do código)

1. **Backup** diário do PostgreSQL (`pg_dump`) + teste periódico de restauração.
2. **Reinício automático** do container (`restart: unless-stopped`, já no
   `docker-compose.yml`) e uso dos *probes* acima no orquestrador.
3. **Monitoramento** do `/health/ready` com alerta em caso de `503`.
4. Para disponibilidade real (fora do escopo do TCC): duas instâncias da API
   atrás de um balanceador + PostgreSQL com réplica e *failover*.

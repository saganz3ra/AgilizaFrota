# LGPD — nível básico (RNF02)

> Lei 13.709/2018. Escopo conforme o plano de prototipagem: **consentimento,
> anonimização e retenção**. Este documento registra quais dados pessoais o
> Agiliza Frota trata, com que base legal, por quanto tempo e como o titular
> exerce seus direitos.

## 1. Dados pessoais tratados

| Dado | Titular | Onde | Por quê |
|---|---|---|---|
| Nome, e-mail, telefone | motorista, recepcionista, operador | `usuarios` | Identificação e contato operacional |
| Credencial de acesso | todos | Firebase Authentication (senha **não** trafega nem é armazenada pela API) | Autenticação |
| **Geolocalização do veículo em turno** | motorista | `posicoes` | Coordenar atendimentos e monitorar a frota |
| Foto do painel (início/fim de turno) | motorista | URL no Firebase Storage | Comprovar quilometragem |
| Registros de jornada e atendimento | motorista | `turnos`, `atendimentos` | Prestação de contas do serviço |
| Nome/telefone do solicitante | terceiro | `chamados` | Contato durante a ocorrência |
| Ações no sistema (IP, user-agent) | todos | `auditoria` | Segurança e fiscalização |

> **Atenção ao dado mais sensível:** a posição do veículo em turno permite
> inferir o deslocamento do motorista. Por isso tem consentimento próprio
> (`geolocalizacao`), o **menor prazo de retenção** e é coletada apenas
> **durante o turno aberto**.

## 2. Bases legais (art. 7º e 11)

- **Execução de políticas públicas / obrigação legal** — registros operacionais
  (turnos, atendimentos, auditoria) de um serviço público de saúde: precisam
  existir para prestação de contas e fiscalização, independentemente de
  consentimento.
- **Consentimento** — finalidades acessórias, registradas por versão do termo:
  `uso_do_sistema`, `geolocalizacao`, `comunicacoes`. Revogável a qualquer
  momento (`POST /api/lgpd/consentimentos` com `aceito: false`).

## 3. Direitos do titular (art. 18) — como estão implementados

| Direito | Endpoint | Observação |
|---|---|---|
| Confirmação e **acesso** | `GET /api/lgpd/meus-dados` | Retorna tudo o que o sistema guarda sobre o titular |
| **Portabilidade** | `GET /api/lgpd/meus-dados?download=true` | JSON legível por máquina |
| Informação sobre o tratamento | `GET /api/lgpd/termo` | Finalidades, prazos e direitos |
| **Revogação do consentimento** | `POST /api/lgpd/consentimentos` | Mantém o histórico da revogação |
| **Anonimização** | `POST /api/lgpd/usuarios/:id/anonimizar` (central) | Ver seção 4 |
| Correção | `PUT /api/usuarios/:id` (central) | Toda alteração fica auditada |

## 4. Anonimização em vez de exclusão — e por quê

Apagar um motorista apagaria também a rastreabilidade dos atendimentos que ele
realizou — destruindo justamente a transparência que motivou o projeto
(substituir o papel **sem** perder o rastro) e violando a obrigação de guarda
do serviço público.

A solução adotada: **anonimizar o titular e preservar o registro operacional**.
Nome, e-mail, telefone e o vínculo com o provedor de autenticação são
substituídos por um pseudônimo irreversível; o acesso é desativado; o e-mail
some do rastro de auditoria. Os atendimentos continuam existindo — agora sem
identificar a pessoa. Pelo art. 12, dado anonimizado não é dado pessoal.

## 5. Retenção e expurgo

| Dado | Prazo padrão | Variável de ambiente | Justificativa |
|---|---|---|---|
| `posicoes` (GPS) | **180 dias** | `RETENCAO_POSICOES_DIAS` | Dado mais sensível e de maior volume |
| `notificacoes` | 365 dias | `RETENCAO_NOTIFICACOES_DIAS` | Valor operacional curto |
| `auditoria` | **1825 dias (5 anos)** | `RETENCAO_AUDITORIA_DIAS` | Prazo de fiscalização de serviço público |
| Registros operacionais | sem expurgo automático | — | Obrigação legal de guarda |

O expurgo é acionado por `POST /api/lgpd/retencao` e, **por segurança, simula por
padrão**: informa quantos registros seriam removidos e só apaga com
`{"executar": true}`. Recomenda-se agendá-lo mensalmente.

## 6. Medidas de proteção

- Senhas nunca passam pela API (delegadas ao Firebase Authentication).
- Segredos (senha, token, chave) são **mascarados** antes de ir para a auditoria.
- Acesso por papel (RBAC): recepcionista vê apenas a própria unidade;
  motorista, apenas os próprios registros.
- Toda ação administrativa sobre dados pessoais é auditada (quem, quando, de onde).
- Transporte por HTTPS com HSTS em produção; CORS restrito a origens conhecidas.

## 7. Limites assumidos (escopo do TCC)

- Sem criptografia em repouso no banco (depende da infraestrutura de implantação).
- Sem fluxo automatizado de resposta a incidentes (art. 48) — procedimento manual.
- O termo de consentimento é versionado, mas o texto jurídico completo deve ser
  validado pela instituição antes do uso real.

# Segurança (RNF01)

> "Garantir a segurança, confidencialidade e integridade dos dados." Este
> documento consolida as medidas implementadas ao longo das 11 sprints e os
> limites assumidos no escopo do TCC.

## 1. Autenticação e autorização

| Medida | Onde |
|---|---|
| Autenticação delegada ao **Firebase Authentication** — a API nunca recebe nem armazena senhas | `middlewares/authMiddleware.js` |
| Todo token é verificado a cada requisição (assinatura e validade) | idem |
| Perfil e permissões vêm do **banco**, não do token (um token válido não concede papel) | `carregarPerfil` |
| **RBAC por papel** em cada rota (`central`, `motorista`, `recepcionista`) | `middlewares/authorizeRole.js` |
| Usuário inativo é bloqueado mesmo com token válido | `authMiddleware` |
| Papel atribuído **pela central**, nunca auto-declarado no cadastro | `usuarioController` |
| Proteção contra *lockout*: impossível desativar/rebaixar o último operador central | `protegerUltimoCentral` |
| Sistema externo isolado por **chave de API**, com acesso a um único endpoint | `middlewares/apiKey.js` |

## 2. Integridade dos dados

- **Validação de entrada com Zod** em todas as rotas (tipos, formatos, faixas).
- **Constraints no banco** como última linha de defesa: `CHECK`, `FOREIGN KEY`,
  `UNIQUE` e índices únicos parciais que garantem invariantes de negócio
  (um turno aberto por motorista, uma atribuição ativa por veículo, quilometragem
  que nunca retrocede).
- **Transações** nas operações compostas (iniciar turno, atribuir, concluir
  atendimento), com `ROLLBACK` em qualquer falha.
- Conflitos de concorrência traduzidos em **409**, não em erro genérico.

## 3. Proteção da aplicação

| Medida | Detalhe |
|---|---|
| `helmet` | Cabeçalhos de segurança; **HSTS** ativo em produção |
| CORS | Origens explícitas; `"*"` **recusado em produção** (erro na inicialização) |
| Rate limiting | Global (300 req/min por IP) + limite mais rígido em `/auth`; o SSE é isento |
| Limite de payload | 1 MB |
| Erros | Resposta padronizada; *stack trace* nunca é exposto em produção |
| Segredos | `.env` e `firebase-key.json` fora do versionamento (`.gitignore`) |
| Verificação na inicialização | Segredos de exemplo ou curtos: aviso em dev, **erro em produção** |
| Auditoria | Escritas e **tentativas negadas** (401/403) registradas com IP e user-agent |
| Mascaramento | `senha`, `token`, `segredo`, `chave` nunca vão para o log |

## 4. Ponto de atenção conhecido

O stream SSE aceita o token via *query string* (`?token=`), porque o
`EventSource` do navegador não permite cabeçalhos. Mitigações já aplicadas: a
auditoria grava a rota **sem** a query string, e o token do Firebase é de curta
duração. Para produção, recomenda-se um cliente SSE que envie cabeçalho
(*polyfill*) ou um token de sessão específico para o stream.

## 5. Limites assumidos (escopo do TCC)

- Sem criptografia em repouso no banco (responsabilidade da infraestrutura).
- Sem WAF, detecção de intrusão ou varredura automatizada de dependências.
- Sem MFA para operadores (suportado pelo Firebase, não habilitado no protótipo).
- Testes de segurança limitados a revisão de código e testes funcionais de
  autorização; não houve *pentest*.

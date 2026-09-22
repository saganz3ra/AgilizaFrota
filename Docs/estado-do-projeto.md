# Agiliza Frota — Estado do projeto e contexto de continuidade

**Atualizado em:** 09/09/2026 · **Autor:** Rafael Sagan Souza · Centro Universitário Campo Real
**Orientadora:** Brenda Lopes Levandoski

> Este documento existe para que o trabalho possa ser retomado a qualquer
> momento — em outra máquina, depois de uma pausa, ou com outro assistente —
> sem depender de lembrar as decisões tomadas pelo caminho.

---

## 1. O que é o sistema

Sistema de gestão de frota hospitalar que substitui o controle em papel.
Três aplicações, três perfis de usuário:

| Aplicação | Pasta | Quem usa |
|---|---|---|
| API REST | `Projeto/agilizafrota-backend` | — |
| Painel web | `Projeto/agilizafrota-web` | Operador da Central e recepcionista |
| Aplicativo | `Projeto/agilizafrota-mobile` | Motorista |

**Fluxo principal:** a Central abre um chamado → aciona um veículo (com sugestão
do sistema) → o motorista recebe no celular, executa os quatro marcos do
atendimento e conclui → as métricas fecham → o veículo é liberado → a recepção
do destino é avisada automaticamente por GPS.

---

## 2. Situação em 09/09/2026

**11 das 13 sprints concluídas e verificadas.** Cerca de 91% do escopo pelas
horas estimadas no Planning Poker.

- **Backend:** todos os 17 RF e 11 RNF implementados. 83 endpoints, 12 tabelas,
  11 migrations.
- **Painel web:** 12 telas. Faltam 4 (histórico, relatórios, auditoria, rota/ETA).
- **App:** login, painel, turno com checklist, atendimento, GPS e fila offline.

Detalhe requisito a requisito em **`inventario-requisitos.md`**.

**Restam:** Sprint 12 (23/09 a 06/10) de testes e validação, e Sprint 13
(07/10 a 20/10) de polimento e documentação. Buffer de 21 a 25/10.

---

## 3. Decisões de arquitetura — e por quê

Estas são as escolhas que não se deduzem lendo o código. Toda vez que uma delas
for questionada, a justificativa está aqui.

### 3.1 SQL puro, sem ORM

Consultas com o driver `pg` e migrations numeradas em `.sql`.

O sistema depende de recursos do PostgreSQL que um ORM esconderia: índices
únicos parciais que garantem invariantes de concorrência (um turno aberto por
motorista, uma atribuição ativa por veículo), `LATERAL JOIN` para a última
posição de cada veículo, `CHECK` compostos que impedem quilometragem
retroativa. Escrever o SQL deixa essas garantias visíveis e auditáveis.

### 3.2 As regras de negócio vivem no servidor

Ordem dos marcos do atendimento, invariantes de status do veículo, proteção
contra *lockout* do último operador — tudo imposto pela API e pelo banco, nunca
pela tela. Se alguém chamar a API diretamente, as regras continuam valendo.

### 3.3 Idempotência por id gerado no cliente

Turnos, atendimentos e posições recebem um `id` (UUID) gerado **no aparelho**,
antes do envio. Se a resposta se perde e o app tenta de novo, o servidor
reconhece o id e devolve `duplicado` em vez de criar outro registro.

É a base do modo offline, e funcionava antes mesmo de existir a fila.

### 3.4 Horário do evento ≠ horário de gravação

Todo registro carrega o instante em que o **fato ocorreu** (relógio do
aparelho), separado do instante em que o servidor gravou. Assim o relatório
mostra quando o turno começou de verdade, não quando a internet voltou.

### 3.5 Fila offline em SQLite

O aparelho pode reiniciar, ficar sem bateria ou ter o app encerrado pelo
sistema no meio do turno. O registro do motorista não pode depender de o
processo continuar vivo.

**A fila só recebe falha de REDE.** Se o servidor recusou (quilometragem
inválida, ordem de marcos errada), reenviar não resolveria — o motorista
precisa ver o erro e corrigir. Confundir os dois casos encheria a fila de
registros que nunca passariam.

### 3.6 Nenhum endpoint de exclusão

O sistema veio substituir o papel **sem perder o rastro** (RF12/RF14). Um turno
que pode ser apagado é indistinguível de um turno que nunca existiu.

Veículos e usuários têm apenas desativação (`ativo = false`). Para dados
pessoais, a saída legítima é a anonimização da LGPD, que substitui os
identificadores por um pseudônimo irreversível e preserva o registro
operacional (art. 12).

Para lixo de teste em desenvolvimento existem `npm run limpar-dev` e
`npm run remover-cadastro`, ambos recusando rodar com `NODE_ENV=production`.

### 3.7 Fotos no próprio backend, não em nuvem de terceiros

A foto do painel pode capturar o interior do veículo e, eventualmente, pessoas.
Manter a imagem na infraestrutura da instituição evita compartilhar dado
pessoal com um operador externo sem necessidade (LGPD, art. 6º).

Consequência prática: dispensa o plano pago que o Firebase Storage passou a
exigir. O ponto de troca está isolado em `config/uploads.js` — em produção com
várias instâncias, vira volume compartilhado ou bucket S3/MinIO.

### 3.8 Leaflet + OpenStreetMap no mapa

Google Maps e MapBox exigem cartão de crédito e criam dependência de fornecedor
pago. Num sistema municipal de saúde, a conta precisa caber no orçamento
público e a operação não pode parar por corte de cota.

A API de mapas para **rota e ETA** continua sendo o Google Directions, mas com
fallback local (Haversine × fator de sinuosidade ÷ velocidade média por
prioridade) — o sistema funciona sem chave de API.

### 3.9 Relatórios em CSV e HTML, não PDF/XLSX

Evita bibliotecas pesadas no servidor. O CSV abre no Excel (BOM UTF-8 e
separador `;`, padrão brasileiro) e o HTML tem CSS de impressão, virando PDF
pelo navegador.

### 3.10 Interface pensada para uso sob pressão

Botões de 56 px, tipografia ampliada, alto contraste. A tela inicial do
motorista mostra **uma** ação em destaque — quem decide qual é o backend
(`GET /motorista/painel`), para a regra viver num lugar só.

"Iniciar transporte" não pede nenhum dado: é o momento de maior pressa do
atendimento.

---

## 4. Convenções do código

- **Português** em nomes de variáveis, funções, arquivos e comentários.
- Backend em **JavaScript** puro; painel web em **TypeScript**; app em **Dart**.
- Comentários explicam **por quê**, não o quê. Decisão não óbvia sem
  justificativa registrada é dívida.
- Estrutura por domínio: `controllers`, `services`, `validators`, `routes` no
  backend; `features/` no app.
- Erros da API sempre no formato `{ erro, codigo }`; o cliente reage pelo
  **código**, nunca comparando texto.

---

## 5. Como o projeto é verificado

Não há framework de teste no backend. A verificação usa **PGlite** (PostgreSQL
compilado para WebAssembly), rodando os **controllers reais** contra um banco
de verdade.

**Por que não Jest com banco simulado:** um *mock* testaria o código, mas não as
regras que vivem no banco — os `CHECK` de quilometragem e os índices únicos
parciais. Rodando contra Postgres real, o teste verifica o sistema inteiro.

No app há testes de unidade e de widget com `flutter_test` (`flutter test`).

No painel web, a verificação é `tsc --noEmit` mais `next build`.

> Nota de ambiente: o `npm install` falha em disco `D:` no Windows com
> ENOTEMPTY. Para verificar o front, copiar para uma pasta local antes.

---

## 6. Achados de teste (material da Sprint 12)

Defeitos encontrados **usando o sistema**, não lendo código:

| Achado | Causa | Correção |
|---|---|---|
| Veículo com turno aberto nunca aparecia nas sugestões | Filtro usava `status='disponivel'`, mas turno aberto marca `em_uso` | Passou a excluir apenas `manutencao` |
| Pool de conexões podia travar ao receber GPS | Controller segurava um client e chamava outra consulta | Uso do pool direto |
| Central podia liberar veículo em turno aberto | `PUT` e `PATCH` sem verificar invariante | Guarda com 409 em ambos e no desativar |
| "Invalid Date" no painel após concluir pelo app | Evento SSE publicava projeção reduzida do chamado | Colunas centralizadas em constante única |
| App oferecia veículo desativado | Filtro do app ignorava `ativo` | `ativo=true` na consulta |
| Mapa abria o mundo inteiro | `fitBounds` com um ponto só | `setView` quando há um único veículo |

---

## 7. Limites conhecidos

Documentados, não escondidos:

- **Turno exige conexão** (abrir e encerrar), porque depende do envio da foto.
  Marcos do atendimento e GPS funcionam offline. Na prática o turno começa e
  termina na base, onde há sinal.
- **GPS coleta com o app aberto.** Rastreamento em segundo plano exigiria um
  *foreground service* do Android, fora do escopo do protótipo.
- **OCR da quilometragem não implementado.** Estava no plano de prototipagem,
  mas não entre os 17 RF numerados. A necessidade foi atendida por outro
  caminho: campo pré-preenchido, recusa de valor retroativo e conferência
  contra a foto na tela de validação (RF10).
- **Sem teste de carga** ainda (K6/JMeter) — previsto para a Sprint 12.

---

## 8. Próximos passos, em ordem

1. **Tela de relatórios (RF13)** — API pronta e verificada, alto valor de
   demonstração
2. **Histórico (RF12)** e **auditoria (RF14)** — mesma situação
3. **Visualização de rota e ETA (RF16/RF17)** — o mapa já existe
4. **Sprint 12** — testes automatizados, avaliação heurística de Nielsen,
   teste de carga, validação com a persona motorista
5. **Sprint 13** — polimento, documentação do TCC, preparação da defesa

Item pendente do texto do artigo: a tabela 6.1 do Plano de Prototipagem soma
**180 h**, mas a consolidação 6.3 declara **200 h**. Conferir e corrigir.

---

## 9. Documentos deste projeto

| Arquivo | Conteúdo |
|---|---|
| `inventario-requisitos.md` | Cada RF/RNF e o que existe em cada camada |
| `apresentacao-previa-75.md` | Roteiro da apresentação, mudanças vs. artigo, perguntas prováveis |
| `checklist-apresentacao.md` | Ordem de execução no dia, plano B |
| `setup-em-outra-maquina.md` | Clonar e configurar do zero |
| `guia-publicacao-github.md` | Auditoria de segurança e ordem de commit |
| `agilizafrota-backend/docs/seguranca.md` | Medidas do RNF01 |
| `agilizafrota-backend/docs/lgpd.md` | Análise do RNF02 |
| `agilizafrota-backend/docs/escalabilidade.md` | Análise do RNF07 |
| `agilizafrota-backend/docs/disponibilidade.md` | Análise do RNF08 |
| `agilizafrota-backend/README.md` | Endpoints e setup do backend |
| `agilizafrota-mobile/README.md` | Estrutura e limites do app |

---

## 10. Para retomar em uma conversa nova

Peça para ler, nesta ordem:

1. `docs/estado-do-projeto.md` (este arquivo) — contexto e decisões
2. `docs/inventario-requisitos.md` — o que falta
3. O `README.md` da aplicação que for mexer

E informe: **o repositório é a fonte da verdade**; divergências entre
documentação e código se resolvem a favor do código.

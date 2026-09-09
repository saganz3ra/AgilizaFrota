# Agiliza Frota — Roteiro da prévia de 75%

**Rafael Sagan Souza** · Centro Universitário Campo Real · 09/09/2026

---

## 1. O número: como justificar

Você tem **duas formas de medir**, e as duas passam de 75%. Apresente as duas
— mostra que o número não foi chutado.

### Por horas do Planning Poker (o método do seu próprio plano)

O Plano de Prototipagem estimou o esforço por requisito usando Planning Poker.
Aplicando o percentual concluído de cada requisito sobre essas horas:

| | Estimado | Concluído | % |
|---|---:|---:|---:|
| Requisitos Funcionais | 180 h | 161 h | **89,6%** |
| Requisitos Não Funcionais | 140 h | 130 h | **93,1%** |
| **Total** | **320 h** | **292 h** | **91,1%** |

### Por sprints do cronograma

**11 das 13 sprints concluídas e verificadas — 85%.**

As duas restantes (12 e 13) são inteiramente de qualidade e documentação:
testes, validação com usuário e escrita final. Nenhuma funcionalidade nova.

> **Frase de abertura sugerida:** *"O escopo de implementação está em 91% pelas
> horas estimadas no Planning Poker, e 11 das 13 sprints estão concluídas. O que
> resta são as duas sprints de testes e documentação, mais cinco telas do painel
> web para requisitos cuja API já está pronta e verificada."*

---

## 2. O que está pronto — números concretos

| | |
|---|---|
| Aplicações | 3 (API REST, painel web, app do motorista) |
| Endpoints da API | 83 |
| Tabelas no banco | 12, em 11 migrations versionadas |
| Telas do painel web | 12 |
| Linhas de código | ~17.700 (7.660 backend · 4.948 web · 5.054 mobile) |
| Verificações automatizadas | mais de 300 ao longo das sprints |

**Os três perfis do RF01 têm interface:** motorista no app, operador da Central
e recepcionista hospitalar no painel web.

**O fluxo principal roda ponta a ponta:** a Central abre o chamado → aciona o
veículo → o motorista recebe no celular, executa os quatro marcos do atendimento
e conclui → as métricas fecham → o chamado encerra → o veículo é liberado com a
quilometragem atualizada → a recepção do destino é avisada automaticamente por
GPS.

---

## 3. Mudanças em relação ao artigo — e por quê

> Esta é a parte que a banca mais valoriza. Toda mudança tem justificativa
> técnica, não conveniência. Apresente como **decisão de projeto**, não como
> limitação.

### 3.1 Armazenamento das fotos: Firebase Storage → servidor próprio

**O artigo diz:** *"a autenticação e o armazenamento de imagens utilizam os
serviços do Firebase"*.

**O que foi feito:** a autenticação continua no Firebase. O armazenamento das
fotos passou para o próprio backend (`POST /api/upload`).

**Por quê — dois argumentos, o segundo é o forte:**

1. O Cloud Storage passou a exigir plano pago (Blaze) com cartão de crédito,
   inviável para um protótipo acadêmico.
2. **Argumento de LGPD:** a foto do painel pode capturar o interior do veículo e,
   eventualmente, pessoas. Manter a imagem na infraestrutura da própria
   instituição evita compartilhar dado pessoal com um operador externo sem
   necessidade (art. 6º, princípio da necessidade). Em um sistema municipal de
   saúde, isso é mais defensável que a conveniência da nuvem de terceiros.

*Se perguntarem sobre escalabilidade:* o ponto de troca está isolado em um único
arquivo (`config/uploads.js`); em produção com várias instâncias, vira um volume
compartilhado ou um bucket S3/MinIO.

### 3.2 Mapa do painel web: Leaflet + OpenStreetMap

**O artigo diz:** *"são usadas APIs externas, como a de mapas"* — sem nomear
fornecedor. O Plano de Prototipagem cita MapBox.

**O que foi feito:** Leaflet com OpenStreetMap para o mapa da frota. A API de
mapas para **rota e tempo de chegada** continua sendo o Google Directions,
com fallback local.

**Por quê:** Google Maps e MapBox exigem cadastro com cartão e criam dependência
de fornecedor pago. Num sistema municipal de saúde, a conta precisa caber no
orçamento público e a operação não pode parar por corte de cota. Leaflet é
software livre e o OpenStreetMap cobre Guarapuava com folga.

### 3.3 Estratégia de testes: Jest/Cypress → PGlite + flutter_test

**O artigo diz:** *"Jest nos testes unitários do backend e Cypress nos testes de
ponta a ponta"*.

**O que foi feito:** testes de integração executando os **controllers reais**
contra um PostgreSQL em memória (PGlite), mais testes de unidade e de widget no
app com `flutter_test`.

**Por quê:** Jest com banco simulado (*mock*) testaria o código, mas não as
regras que vivem no banco — os `CHECK` que impedem quilometragem retroativa e os
índices únicos parciais que garantem um turno aberto por motorista. Rodando
contra um Postgres real, o teste verifica o sistema inteiro, incluindo as
constraints. Foi assim que se comprovou, por exemplo, que o banco recusa gravar
quilometragem retroativa mesmo que a aplicação falhe.

*Cypress continua previsto* para a Sprint 12, nos fluxos de ponta a ponta do
painel web.

### 3.4 OCR da quilometragem: não implementado

**O Plano de Prototipagem cita:** *"OCR para leitura automática de quilometragem"*.
(O artigo não menciona OCR.)

**Situação:** não implementado. A quilometragem é digitada pelo motorista, **já
pré-preenchida** com o valor que o sistema conhece, e a foto do painel serve de
evidência para conferência.

**Como apresentar:** o OCR era um facilitador, não um requisito funcional
numerado — não aparece entre os 17 RF. A necessidade que ele atenderia
(reduzir digitação e erro) foi resolvida por outro caminho: o campo vem
preenchido, o sistema recusa valor menor que o anterior e a Central confere
contra a foto na tela de validação (RF10). Fica registrado como trabalho futuro.

### 3.5 TypeScript no painel web

O artigo diz "React com Next.js". O painel foi escrito em **TypeScript**, que é
o padrão do Next.js. Não é mudança de stack — é a mesma tecnologia com tipagem
estática. Vale acrescentar "com TypeScript" no texto.

### 3.6 Acesso ao banco: SQL puro, sem ORM

Decisão não mencionada no artigo, mas que a banca pode perguntar. As consultas
usam SQL direto com o driver `pg` e migrations numeradas em `.sql`.

**Por quê:** o sistema depende de recursos específicos do PostgreSQL que um ORM
esconderia — índices únicos parciais para invariantes de concorrência, `LATERAL
JOIN` para a última posição de cada veículo, `CHECK` compostos. Escrever o SQL
deixa essas garantias visíveis e auditáveis.

### 3.7 Relatórios: PDF/Excel → HTML para impressão + CSV

**O Plano diz:** *"relatórios devem exportar PDF/Excel"*.

**O que foi feito:** exportação em **CSV** (abre no Excel, com BOM UTF-8 e
separador `;` para o padrão brasileiro) e em **HTML com CSS de impressão**, que
o navegador salva como PDF.

**Por quê:** evita acrescentar bibliotecas pesadas de PDF e XLSX ao servidor,
mantendo a instalação simples. O resultado prático para o usuário é o mesmo:
uma planilha que abre no Excel e um documento que vira PDF em dois cliques.

---

## 4. O que falta — apresente com o prazo

**Cinco telas do painel web** para requisitos cuja API está pronta e verificada:
histórico (RF12), relatórios (RF13), auditoria (RF14) e a visualização de rota e
tempo de chegada (RF16/RF17).

**Sprint 12 (23/09 a 06/10):** testes automatizados, avaliação heurística de
Nielsen, testes de carga com K6 e validação com a persona motorista.

**Sprint 13 (07/10 a 20/10):** refinamento de interface, escrita da documentação
e preparação da defesa. Restam 5 dias de buffer (21 a 25/10).

**Dois limites conhecidos, já documentados:**

- Abrir e encerrar turno exigem conexão, porque dependem do envio da foto. Os
  marcos do atendimento e o GPS funcionam offline. Na prática o turno começa e
  termina na base, onde há sinal.
- O GPS coleta com o app aberto; rastreamento em segundo plano exigiria um
  *foreground service* do Android, fora do escopo do protótipo.

> Apresentar limites conhecidos **fortalece** a apresentação. Mostra que você
> sabe onde o sistema termina.

---

## 5. Roteiro de demonstração (10 a 12 minutos)

Deixe tudo aberto **antes** de começar: backend rodando, painel web em duas
abas (Central e uma janela anônima com a recepcionista) e o emulador com o app.

| # | Ação | O que dizer |
|---|---|---|
| 1 | App: abrir turno com checklist e foto | "RF03 e RF04. A quilometragem já vem preenchida; a foto é a evidência." |
| 2 | Web: criar um chamado de emergência | "RF05. A prioridade é derivada do tipo." |
| 3 | Mostrar o alerta soar na Central | "RF06. Tempo real por Server-Sent Events." |
| 4 | Acionar usando a sugestão do sistema | "RF07 e RF08. O sistema explica **por que** sugeriu aquele veículo." |
| 5 | App: percorrer os quatro marcos | "RF09. Iniciar transporte é um toque só — o motorista está com pressa." |
| 6 | Web: mostrar o veículo no mapa | "RF11. Posição em tempo real." |
| 7 | Ver a recepcionista ser avisada | "RF15. Detectado por geofence, sem o motorista tocar em nada." |
| 8 | Web: conferir e validar o atendimento | "RF10. Armazenado × recalculado. O ajuste não apaga o valor original." |
| 9 | **Modo avião no emulador**, registrar um marco | "RNF03. Continua funcionando; fica na fila." |
| 10 | Religar a rede e ver a fila esvaziar sozinha | "Reenvio idempotente: o mesmo registro não entra duas vezes." |

**O passo 9 e 10 é o clímax.** É o que diferencia o trabalho de um CRUD comum e
o que mais demonstra entendimento do problema real — ambulância em área sem
cobertura.

---

## 6. Perguntas prováveis e como responder

**"Por que trocou o Firebase Storage?"**
Comece pela LGPD, não pelo custo. *"A foto pode capturar pessoas; manter na
infraestrutura da instituição evita compartilhar dado pessoal com operador
externo. E, como consequência, também elimina a dependência de um plano pago."*

**"Como você garante que o dado offline não se perde ou duplica?"**
*"O identificador é gerado no celular antes do envio. Se a resposta se perde e o
app tenta de novo, o servidor reconhece o mesmo id e responde 'duplicado' em vez
de criar outro registro. A fila fica em SQLite, então sobrevive ao aparelho
desligar."*

**"Testaram com usuários reais?"**
Seja direto: *"Ainda não. A validação com a persona motorista é a Sprint 12, que
começa em 23 de setembro."*

**"Onde ficam as regras de negócio?"**
*"No servidor. A ordem dos marcos, os invariantes de status e a proteção contra
lockout são impostos pela API e pelo banco, não pela tela. Se alguém chamar a API
diretamente, as regras continuam valendo."*

**"E se o GPS falhar?"**
*"O sistema trata três casos: coordenada inválida é recusada, salto impossível é
gravado mas marcado como suspeito e não vai ao mapa, e a ausência de posição faz
o veículo migrar de online para instável e depois offline pela idade do último
ponto."*

---

## 7. Ajustes recomendados no texto do artigo

**Antes da versão final**, três correções:

1. **Inconsistência numérica.** A tabela 6.1 do Plano de Prototipagem soma
   **180 h** de requisitos funcionais, mas a consolidação 6.3 declara **200 h**.
   A diferença de 20 h não aparece na tabela. Vale conferir e corrigir — é o tipo
   de detalhe que uma banca atenta encontra.
2. **Atualizar a seção de tecnologias** com as mudanças da seção 3 deste
   documento, apresentando-as como decisões justificadas.
3. **Acrescentar "com TypeScript"** na descrição da interface web.

---

## 8. Evidências que você pode mostrar se pedirem

- `docs/inventario-requisitos.md` — cada requisito e o que existe em cada camada
- `docs/seguranca.md`, `docs/lgpd.md`, `docs/escalabilidade.md`,
  `docs/disponibilidade.md` — análises dos RNF
- Tabela de **achados de teste**: seis defeitos encontrados usando o sistema,
  com causa e correção. Encontrados por uso, não por leitura de código — que é
  o tipo de evidência que a Sprint 12 pede e que já está adiantada.

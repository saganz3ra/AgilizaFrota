# Agiliza Frota — Aplicativo do Motorista

Aplicativo Flutter (Android/iOS) que substitui a ficha de papel do motorista:
turno, checklist, atendimentos e rastreamento por GPS.

Consome a API REST em `../agilizafrota-backend`. O painel da central é o
`../agilizafrota-web`.

---

## Requisitos atendidos

| Requisito | Onde |
|---|---|
| **RF01** — Autenticar usuários | `core/auth` — Firebase Auth + perfil em `GET /auth/me`; só o papel `motorista` entra |
| **RF03/RF04** — Turno e checklist | `features/turno` — veículo, hodômetro, foto do painel e checklist obrigatório |
| **RF09** — Registrar atendimentos | `features/atendimento` — ciclo completo com os quatro marcos e cancelamento |
| **RF11** — GPS em tempo real | `features/rastreamento` — captura por distância, envio em lote, só durante o turno |
| **RNF03** — Operação offline | `core/offline` — fila em SQLite, reenvio automático via `POST /sync` |
| **RNF04** — Interface sob pressão | `core/tema` — toque de 56 px, tipografia ampliada, alto contraste |
| **RNF11** — Minimizar interações | `features/painel` — uma chamada resolve a tela e destaca a próxima ação |

---

## Estrutura

```
lib/
  main.dart                    raiz: Firebase, tema e roteamento por sessão
  core/
    config/ambiente.dart       URL da API e timeout
    tema/                      cores (iguais às do painel web) e tema
    api/                       cliente HTTP e tradução de erros
    auth/                      sessão, perfil e papel
    offline/                   fila local e sincronização
    widgets/                   avisos e carregamento reutilizáveis
  features/
    login/                     tela de entrada
    painel/                    tela inicial do motorista
    turno/                     abertura (com checklist) e encerramento
    atendimento/               ciclo dos marcos do atendimento
    rastreamento/              GPS e tela da fila pendente
```

A pasta `features/` segue o mesmo recorte por domínio do backend
(`turnos`, `atendimentos`, `posicoes`), para que uma mudança de regra seja
fácil de rastrear entre as três aplicações.

---

## Como rodar

**0. Instalar as dependências do backend** (uma vez só, se ainda não fez):

```bash
cd ../agilizafrota-backend
npm install
npm run migrate
```

**1. Gerar as credenciais do Firebase** (uma vez só):

```bash
dart pub global activate flutterfire_cli
flutterfire configure
```

Escolha o projeto `agilizafrota` e marque **android** (e **ios**, se for usar
um Mac). O comando cria `lib/firebase_options.dart` e registra o app no
console do Firebase.

**2. Instalar as dependências:**

```bash
flutter pub get
```

**3. Subir a API** (na pasta do backend, em outra janela):

```bash
npm run dev
```

**4. Rodar o app**, com o celular conectado por USB:

```bash
flutter run
```

### Apontando para outro servidor

A URL padrão é `http://192.168.1.9:3000/api` (máquina de desenvolvimento na
rede local). Para trocar sem editar código:

```bash
flutter run --dart-define=API_URL=http://192.168.0.20:3000/api
```

No emulador Android, o host é `10.0.2.2`, não `localhost`.

---

## Operação offline (RNF03)

A regra é uma só: **tenta online, cai para a fila, reenvia quando a rede voltar.**

O que decide enfileirar é **falha de rede**, não erro. Se o servidor respondeu
recusando — quilometragem inválida, turno já aberto, ordem de marcos errada —
reenviar não resolveria; o motorista precisa ver o erro e corrigir. Confundir os
dois casos encheria a fila de registros que nunca passariam.

A fila vive em SQLite, não em memória: o aparelho pode reiniciar, ficar sem
bateria ou ter o app encerrado pelo sistema no meio do turno. O registro do
motorista não pode depender de o processo continuar vivo.

Cada item guarda a **intenção** (o que foi feito, quando, com quais dados) e o
`id` gerado no aparelho. Reenviar é sempre seguro: o servidor reconhece o id e
responde `duplicado` em vez de criar outro registro.

O envio é **um pacote só** (`POST /api/sync`), não uma requisição por item — em
rede móvel instável, cada conexão nova é uma chance de falhar. O servidor
processa item a item, respeita a ordem cronológica do evento e devolve o veredito
de cada um: `aplicado`, `duplicado` ou `falha`.

O motorista vê a fila pelo ícone no topo do painel, com o número de pendências.

### Limite conhecido

Abrir e encerrar turno **exigem conexão**, porque dependem do envio da foto do
painel. Os marcos do atendimento e as posições de GPS funcionam offline. Na
prática o turno começa e termina na base, onde há sinal; a operação em campo,
que é onde o sinal falta, está coberta.

---

## Rastreamento (RF11)

Três decisões de coleta, cada uma com um motivo:

- **Só com turno aberto.** Fora da jornada a posição não interessa ao sistema e
  seria coleta excessiva (LGPD). Liga ao abrir o turno, desliga ao encerrar.
- **Por distância (30 m), não por tempo.** Evita centenas de pontos idênticos
  com a ambulância parada em semáforo ou no pátio.
- **Envio em lote a cada 30 s.** Uma requisição por ponto gastaria bateria e
  dados sem ganho — a central precisa saber onde o veículo está, não com
  precisão de segundo.

O horário gravado é o da **captura**, não o do envio. Assim o rastro fica correto
mesmo quando os pontos sobem depois, pela fila.

### Limite conhecido

A coleta acontece com o app aberto. Rastreamento com o app em segundo plano
exigiria um *foreground service* do Android, fora do escopo do protótipo. Na
operação real o aparelho fica no suporte, com o app na tela.

## Notas de configuração

**HTTP em desenvolvimento.** O Android bloqueia tráfego sem TLS por padrão.
Mantivemos o bloqueio geral e abrimos exceção apenas para o IP da máquina de
desenvolvimento, em `android/app/src/main/res/xml/network_security_config.xml`.
Em produção a API roda sob HTTPS e o arquivo pode ficar só com o `base-config`.

**minSdk 23.** Exigência do `firebase_auth`. Cobre Android 6 em diante.

**Permissões.** Só as que algum requisito justifica — internet, estado da
rede, localização e câmera. A localização é coletada apenas com turno aberto.

**As fotos vão para o nosso backend, não para o Firebase Storage.** A imagem do
painel pode capturar o interior do veículo e, eventualmente, pessoas; mantê-la na
infraestrutura da instituição evita compartilhar dado pessoal com um operador
externo. O app comprime para 1280 px / qualidade 70 antes de enviar — o que
importa é o hodômetro estar legível.

**No emulador não há câmera real.** Use o botão *Escolher da galeria*; o emulador
já vem com algumas imagens de exemplo.

---

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| "Sem conexão com o servidor" | API não está rodando, IP mudou, ou o Firewall do Windows está bloqueando a porta 3000 |
| Tela "Configuração do Firebase ausente" | Falta rodar `flutterfire configure` |
| "Este aplicativo é exclusivo para motoristas" | A conta usada tem papel `central` ou `recepcionista` |
| "Usuário autenticado, mas sem perfil no sistema" | A conta existe no Firebase mas não em `usuarios` — cadastre pelo painel web |

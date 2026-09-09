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
| **RF03/RF04** — Turno e checklist | *(próxima etapa)* |
| **RF09** — Registrar atendimentos | *(próxima etapa)* |
| **RF11** — GPS em tempo real | *(próxima etapa)* |
| **RNF03** — Operação offline | *(próxima etapa)* — fila local + `POST /sync` |
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
    widgets/                   avisos e carregamento reutilizáveis
  features/
    login/                     tela de entrada
    painel/                    tela inicial do motorista
```

A pasta `features/` segue o mesmo recorte por domínio do backend
(`turnos`, `atendimentos`, `posicoes`), para que uma mudança de regra seja
fácil de rastrear entre as três aplicações.

---

## Como rodar

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

## Notas de configuração

**HTTP em desenvolvimento.** O Android bloqueia tráfego sem TLS por padrão.
Mantivemos o bloqueio geral e abrimos exceção apenas para o IP da máquina de
desenvolvimento, em `android/app/src/main/res/xml/network_security_config.xml`.
Em produção a API roda sob HTTPS e o arquivo pode ficar só com o `base-config`.

**minSdk 23.** Exigência do `firebase_auth`. Cobre Android 6 em diante.

**Permissões.** Só as que algum requisito justifica — internet, estado da
rede, localização e câmera. A localização é coletada apenas com turno aberto.

---

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| "Sem conexão com o servidor" | API não está rodando, IP mudou, ou o Firewall do Windows está bloqueando a porta 3000 |
| Tela "Configuração do Firebase ausente" | Falta rodar `flutterfire configure` |
| "Este aplicativo é exclusivo para motoristas" | A conta usada tem papel `central` ou `recepcionista` |
| "Usuário autenticado, mas sem perfil no sistema" | A conta existe no Firebase mas não em `usuarios` — cadastre pelo painel web |

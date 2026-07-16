# Agiliza Frota — Web (Central)

Painel web da **Central** do Agiliza Frota. Consome a API REST do backend.
Stack: **Next.js 14 (App Router) + TypeScript + Tailwind CSS + Firebase Auth**.

> **Fundação (início do front).** Design system clínico institucional, autenticação Firebase, shell de navegação e dashboard da Central com dados em tempo real da operação. As telas de cada módulo (chamados, veículos, turnos, unidades, usuários) entram de forma incremental conforme as sprints avançam.

## Pré-requisitos

- **Node.js** ≥ 18
- O **backend** (`agilizafrota-backend`) rodando e acessível
- Um projeto **Firebase** com Authentication habilitado (o mesmo do backend)

## Setup

```bash
cd agilizafrota-web
npm install
cp .env.local.example .env.local   # preencha API URL + credenciais do Firebase
npm run dev                         # http://localhost:3001
```

Scripts: `npm run dev` (desenvolvimento), `npm run build` / `npm start` (produção), `npm run typecheck` (checagem de tipos).

## Organização

```
agilizafrota-web/
├── tailwind.config.ts          # Tokens do design system
└── src/
    ├── app/
    │   ├── globals.css          # Variáveis de cor/tipografia (clínico institucional)
    │   ├── layout.tsx           # Layout raiz + AuthProvider
    │   ├── page.tsx             # Redireciona login/dashboard
    │   ├── login/page.tsx       # Autenticação (Firebase)
    │   └── (painel)/            # Área autenticada
    │       ├── layout.tsx       # Guard de sessão + shell (sidebar/topbar)
    │       └── dashboard/page.tsx
    ├── components/
    │   ├── Sidebar.tsx
    │   ├── Topbar.tsx
    │   └── ui/                  # Button, Card, Input, Badge, Spinner
    ├── lib/
    │   ├── firebase.ts          # Init do Firebase (client)
    │   ├── api.ts               # Fetch com injeção do ID token
    │   └── auth-context.tsx     # Sessão + perfil (/auth/me)
    └── types/api.ts             # Tipos espelhando a API
```

## Autenticação e acesso

O login usa o **Firebase Authentication**; o token é enviado ao backend em cada
requisição. Após autenticar, o perfil é carregado via `GET /auth/me`. O painel é
restrito aos perfis **central** e **recepcionista** — motoristas usam o app mobile.

## Design system

Direção **clínica institucional**: azul/branco, alto contraste, componentes
amplos e foco visível, priorizando clareza e rapidez de leitura em situações de
pressão (heurísticas de Nielsen). Tokens em `src/app/globals.css` e
`tailwind.config.ts` (cores de marca, estados de veículo e prioridades de chamado).

## Próximas telas

Chamados (com alerta em tempo real via SSE), veículos, turnos, unidades e
usuários — plugando os endpoints já disponíveis no backend e os das próximas sprints.

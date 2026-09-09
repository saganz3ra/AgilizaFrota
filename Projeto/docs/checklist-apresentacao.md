# Checklist de execução — apresentação Agiliza Frota

---

## PARTE 1 — Na véspera (15 minutos)

### 1.1 Limpar os dados de teste

Chegar na apresentação com "Motorista teste" e chamados de experimento na tela
tira credibilidade. Zere e recrie com nomes apresentáveis:

```powershell
cd "D:\Agiliza Frota\Projeto\agilizafrota-backend"
docker compose up -d
npm run limpar-dev
```

Digite `limpar` para confirmar.

### 1.2 Preparar os cadastros da demonstração

Suba backend e web e cadastre pelo painel, com nomes realistas:

| O quê | Sugestão |
|---|---|
| Unidade | Hospital Municipal de Guarapuava — com **latitude e longitude reais** |
| Veículo | Placa e modelo plausíveis, status **Disponível**, **Ativo** |
| Motorista | Nome completo, e-mail e senha que você lembre |
| Recepcionista | **Mesma unidade** do destino — senão ela não recebe a notificação |

> A latitude/longitude da unidade é o que faz o geofence disparar. Se estiver
> vazia, o passo da recepcionista não funciona.

### 1.3 Deixar o app pronto

```powershell
cd "D:\Agiliza Frota\Projeto\agilizafrota-mobile"
flutter run --no-dds --dart-define=API_URL=http://10.0.2.2:3000/api
```

Entre com o motorista, **abra um turno** e **aceite a permissão de localização**.
Depois encerre o turno. Isso garante que nenhum diálogo do Android apareça
durante a apresentação.

### 1.4 Testar o roteiro inteiro uma vez

Faça a demonstração completa sozinho, do começo ao fim. É a única forma de
descobrir o que trava. Depois rode `npm run limpar-dev` de novo.

---

## PARTE 2 — No dia, 15 minutos antes

Abra **três janelas do PowerShell**, cada uma parada na sua pasta. Não navegue
entre pastas durante a apresentação.

### Passo 1 — Docker

Abra o **Docker Desktop** e espere ficar verde. Então:

```powershell
cd "D:\Agiliza Frota\Projeto\agilizafrota-backend"
docker compose up -d
```

### Passo 2 — Emulador

Android Studio → **Device Manager** → ▶ no Pixel.
Espere chegar à tela inicial do Android (demora ~1 min).

### Passo 3 — Backend (janela 1)

```powershell
cd "D:\Agiliza Frota\Projeto\agilizafrota-backend"
npm run dev
```

Esperado: `API do Agiliza Frota rodando...`
(O aviso sobre `BOOTSTRAP_SECRET` é normal em desenvolvimento.)

### Passo 4 — Painel web (janela 2)

```powershell
cd "D:\Agiliza Frota\Projeto\agilizafrota-web"
npm run dev
```

Abre em **http://localhost:3001** — porta 3001, não 3000.

### Passo 5 — App (janela 3)

```powershell
cd "D:\Agiliza Frota\Projeto\agilizafrota-mobile"
flutter run --no-dds --dart-define=API_URL=http://10.0.2.2:3000/api
```

### Passo 6 — Localização do emulador

**Não pule este.** O emulador volta para a Califórnia a cada inicialização.

*Extended Controls* (`...` na lateral) → **Location** → aba *Single points* →
**clique numa linha** da lista até ficar destacada → **SET LOCATION**.

Use um ponto a ~2 km da unidade cadastrada: assim há distância para mostrar
deslocamento antes da chegada.

---

## PARTE 3 — Verificação final (2 minutos)

| Verificar | Como | Esperado |
|---|---|---|
| Banco no ar | `docker ps` | container `agilizafrota-postgres` rodando |
| Backend responde | Navegador: `localhost:3000/api/health/live` | JSON com `ok` |
| Stack completa | `npm run diagnostico -- "email-do-admin"` | tudo OK |
| Painel abre | `localhost:3001` | tela de login |
| App instalado | Olhar o emulador | app aberto na tela de login |
| Emulador localizado | Abrir o Google Maps do emulador | mostra Guarapuava, não Mountain View |

---

## PARTE 4 — Como deixar as janelas

**Monitor / projetor:**

- **Aba 1 do navegador:** painel web logado como **Central**, na tela de Chamados
- **Aba 2 (janela anônima):** logada como **recepcionista**, na tela de Chegadas
  — precisa ser janela anônima, senão a segunda sessão derruba a primeira
- **Emulador** visível ao lado, com o app na tela inicial do motorista

**Deixe escondidas** as três janelas do PowerShell. Elas só aparecem se algo der
errado.

---

## PARTE 5 — Se algo falhar na hora

| Sintoma | Causa mais provável | Solução rápida |
|---|---|---|
| App diz "Sem conexão" | Backend caiu ou Docker parou | Olhe a janela 1; `docker compose up -d` |
| Painel não carrega dados | Backend caiu | Reinicie a janela 1 |
| Veículo não aparece no mapa | Localização do emulador não foi definida | Refaça o Passo 6 e espere 30 s |
| Recepcionista não recebe | Unidade dela ≠ destino do chamado | Confira em Usuários |
| App não instala | Instalação anterior conflitando | `adb uninstall br.com.agilizafrota.agilizafrota_mobile` |
| Emulador travado | — | *Cold Boot Now* no Device Manager |

**Plano B:** se o emulador não cooperar, apresente o painel web sozinho e explique
o app pelas capturas de tela. Sete dos dez passos do roteiro acontecem no web.

**Tenha capturas de tela de tudo salvas numa pasta.** Custa 10 minutos na véspera
e salva a apresentação se a máquina falhar.

---

## Resumo dos comandos

```powershell
# 1. Banco (Docker Desktop aberto)
cd "D:\Agiliza Frota\Projeto\agilizafrota-backend"; docker compose up -d

# 2. Emulador: Android Studio -> Device Manager -> Play

# 3. Backend
cd "D:\Agiliza Frota\Projeto\agilizafrota-backend"; npm run dev

# 4. Web  (http://localhost:3001)
cd "D:\Agiliza Frota\Projeto\agilizafrota-web"; npm run dev

# 5. App
cd "D:\Agiliza Frota\Projeto\agilizafrota-mobile"
flutter run --no-dds --dart-define=API_URL=http://10.0.2.2:3000/api

# 6. Emulador -> Extended Controls -> Location -> SET LOCATION
```

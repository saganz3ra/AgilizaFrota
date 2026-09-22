# Guia de publicação no GitHub — Agiliza Frota

Repositório: `github.com/saganz3ra/AgilizaFrota` · branch `main`

---

## 1. Auditoria de segurança — resultado

Verifiquei o histórico e o estado atual do repositório.

### Está correto

**Nenhum segredo jamais foi commitado.** Varri todo o histórico procurando
`.env`, `firebase-key.json`, `google-services.json`, `firebase_options.dart` e
`local.properties`. Não há registro de nenhum deles. Isso importa porque, uma
vez no histórico, um segredo continua acessível mesmo depois de apagado — e a
correção exigiria reescrever o histórico.

Os arquivos `.example` estão versionados, que é o certo: documentam quais
variáveis existem, sem revelar valores.

`node_modules/`, `.next/`, `build/` e `.dart_tool/` estão todos ignorados.

### Foi corrigido agora

**Criei um `.gitignore` na raiz do repositório**, que não existia. Ele:

- ignora `.idea/` e `*.iml` — configuração do Android Studio, que é pessoal de
  cada máquina e estava prestes a ser commitada (6 arquivos);
- **repete** as regras de segredos das subpastas, de propósito. É uma segunda
  barreira: neste projeto já aconteceu de arquivos de configuração sumirem do
  disco, e sem o `.gitignore` de uma subpasta o segredo dela ficaria exposto;
- ignora `**/uploads/`, onde ficam as fotos enviadas pelos motoristas.

### Falta você fazer (1 comando)

O `.idea/` já tinha sido adicionado ao índice do Git antes. Precisa sair:

```powershell
cd "D:\Agiliza Frota"
Remove-Item .git\index.lock -ErrorAction SilentlyContinue
git rm -r --cached .idea
```

*(O `index.lock` é resíduo de uma operação interrompida. Feche o Android Studio
antes, para ele não recriar o arquivo.)*

---

## 2. O que NUNCA pode ir para o GitHub

| Arquivo | Por quê |
|---|---|
| `agilizafrota-backend/.env` | Senha do banco e `BOOTSTRAP_SECRET` — quem tiver o segredo cria o primeiro operador da Central |
| `agilizafrota-backend/firebase-key.json` | **O mais grave.** Chave privada de serviço: dá controle administrativo total sobre o projeto Firebase |
| `agilizafrota-web/.env.local` | Configuração do cliente Firebase |
| `agilizafrota-mobile/android/app/google-services.json` | Idem |
| `agilizafrota-mobile/lib/firebase_options.dart` | Idem |
| `agilizafrota-backend/uploads/` | **Fotos reais**, com interior de veículo e possivelmente pessoas — dado pessoal sob a LGPD |
| `android/local.properties` | Caminhos absolutos da sua máquina |

> **Se algum desses vazar um dia:** não basta apagar e commitar. É preciso
> **revogar a credencial no console do Firebase** e gerar outra. O arquivo
> continua no histórico do Git para sempre.

### Já está no repositório e vale você decidir

A pasta **`Documentos para base de conhecimento`** está versionada, com cinco
PDFs — incluindo `TCC - Agiliza Frota.pdf` e `Prompts com o Gemini.pdf`.

Não há problema técnico nenhum nisso. Mas, **se o repositório for público**,
esses documentos ficam visíveis para qualquer pessoa antes da defesa. Vale
decidir conscientemente se é isso que você quer — não é uma decisão que eu deva
tomar por você.

Se preferir tirá-los do repositório mantendo os arquivos no disco:

```powershell
git rm -r --cached "Documentos para base de conhecimento"
```

E acrescente ao `.gitignore` da raiz. *(Eles continuam no histórico dos commits
anteriores; para removê-los de vez seria preciso reescrever o histórico.)*

---

## 3. Ordem de commit sugerida

São 195 arquivos. Um commit único de tudo funciona, mas **commits separados por
assunto contam a história do projeto** — e um repositório de TCC é lido como
documentação do processo, não só como código.

### Opção A — um commit por sprint (recomendada)

```powershell
cd "D:\Agiliza Frota"

# 0. Primeiro, tirar o .idea do índice
git rm -r --cached .idea

# 1. Configuração e infraestrutura
git add .gitignore Projeto/.gitignore
git add "Projeto/agilizafrota-backend/.gitignore" "Projeto/agilizafrota-backend/.env.example"
git commit -m "chore: gitignore da raiz e protecao de segredos"

# 2. Backend das sprints 5 a 11
git add Projeto/agilizafrota-backend
git commit -m "feat(backend): sprints 5 a 11 - atribuicao, atendimentos, GPS, historico, rotas, relatorios, auditoria, LGPD e sincronizacao offline"

# 3. Painel web
git add Projeto/agilizafrota-web
git commit -m "feat(web): telas de frota, chegadas e atendimentos com validacao manual"

# 4. Aplicativo do motorista
git add Projeto/agilizafrota-mobile
git commit -m "feat(mobile): aplicativo do motorista - turno, checklist, atendimento, GPS e fila offline"

# 5. Documentação
git add Projeto/docs
git commit -m "docs: inventario de requisitos, seguranca, LGPD e roteiro de apresentacao"

git push origin main
```

### Opção B — commit único

```powershell
cd "D:\Agiliza Frota"
git rm -r --cached .idea
git add .
git commit -m "feat: sprints 5 a 11 - backend completo, painel web e aplicativo do motorista"
git push origin main
```

---

## 4. Antes de dar `push` — conferência final

```powershell
# 1. Nenhum segredo entre os arquivos preparados?
git diff --cached --name-only | Select-String -Pattern "\.env|firebase-key|google-services|firebase_options|local\.properties|uploads/"
```

**Se retornar qualquer linha, PARE.** Rode `git reset` e revise o `.gitignore`.

```powershell
# 2. Quantidade e conteúdo fazem sentido?
git diff --cached --stat | Select-Object -Last 5

# 3. Só então:
git push origin main
```

---

## 5. Depois do push — verifique no navegador

Abra `github.com/saganz3ra/AgilizaFrota` e confira:

- [ ] Não existe `.env`, `firebase-key.json` nem `google-services.json`
- [ ] Não existe a pasta `uploads/`
- [ ] Não existe a pasta `.idea/`
- [ ] Os `README.md` aparecem formatados nas pastas de cada aplicação
- [ ] O repositório é **privado** — ou, se público, você conferiu a seção 2

---

## 6. Melhoria que sugiro deixar para depois

Há uma inconsistência real de estilo: **os comentários do painel web usam
acentuação, e os do backend e do app não.** São 12 arquivos de um lado e 113 do
outro.

Não recomendo mexer nisso agora. É uma alteração mecânica em mais de cem
arquivos, e fazê-la com pressa, antes de um commit, é a receita para introduzir
um erro em código que hoje está verificado. Fica como um commit próprio depois
da apresentação, com verificação completa em seguida.

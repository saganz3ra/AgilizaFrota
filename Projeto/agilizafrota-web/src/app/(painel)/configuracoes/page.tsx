"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import {
  Moon,
  Sun,
  Volume2,
  VolumeX,
  Keyboard,
  Bell,
  Type,
  Rows3,
  Sparkles,
  Home,
  KeyRound,
} from "lucide-react";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth-context";
import { auth } from "@/lib/firebase";
import { usePreferencias } from "@/lib/preferencias";
import { destinosPara, normalizarTecla } from "@/lib/atalhos";
import { suportaNotificacoes } from "@/lib/notificacoes";

/**
 * Configuracoes do usuario: preferencias de interface deste navegador
 * (tema e som). Nao ha nada de negocio aqui - apenas conforto de uso (RNF04).
 */
export default function ConfiguracoesPage() {
  const {
    montado,
    escuro,
    alternarTema,
    som,
    alternarSom,
    notificacoes,
    alternarNotificacoes,
  } = usePreferencias();

  // Só avalia após montar: no servidor não há `window`/`Notification`, e
  // divergir do cliente causaria aviso de hidratação. Antes de montar, tudo
  // fica no estado neutro (e o interruptor já entra desabilitado por !montado).
  const semSuporteNotif = montado && !suportaNotificacoes();
  const negadoNavegador =
    montado &&
    !semSuporteNotif &&
    typeof Notification !== "undefined" &&
    Notification.permission === "denied";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-content">Configurações</h1>
        <p className="text-sm text-content-muted">
          Preferências deste navegador. Não afetam outros usuários.
        </p>
      </div>

      {/* Alertas */}
      <Card>
        <CardBody className="divide-y divide-surface-border">
          <LinhaConfig
            icone={escuro ? <Moon size={20} /> : <Sun size={20} />}
            titulo="Tema escuro"
            descricao="Alterna a aparência entre claro e escuro."
            ativo={escuro}
            aoAlternar={alternarTema}
            desabilitado={!montado}
            rotulo="Alternar tema escuro"
          />
          <LinhaConfig
            icone={som ? <Volume2 size={20} /> : <VolumeX size={20} />}
            titulo="Sons do aplicativo"
            descricao="Alerta sonoro ao chegar um novo chamado (o crítico insiste mais)."
            ativo={som}
            aoAlternar={alternarSom}
            desabilitado={!montado}
            rotulo="Ativar sons do aplicativo"
          />
          <LinhaConfig
            icone={<Bell size={20} />}
            titulo="Notificações do navegador"
            descricao={
              negadoNavegador
                ? "Bloqueadas pelo navegador. Libere as notificações do site para ativar."
                : semSuporteNotif
                  ? "Seu navegador não suporta notificações."
                  : "Aviso na área de trabalho quando chega um chamado e a aba está em segundo plano."
            }
            ativo={notificacoes}
            aoAlternar={() => void alternarNotificacoes()}
            desabilitado={!montado || semSuporteNotif || negadoNavegador}
            rotulo="Ativar notificações do navegador"
          />
        </CardBody>
      </Card>

      <SecaoAparencia />
      <SecaoAoEntrar />
      <SecaoAtalhos />
      <SecaoSeguranca />
    </div>
  );
}

/** Aparência: tamanho da fonte, densidade e redução de animações. */
function SecaoAparencia() {
  const {
    montado,
    fonte,
    definirFonte,
    densidade,
    definirDensidade,
    animacoesReduzidas,
    alternarAnimacoes,
  } = usePreferencias();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Type size={18} className="text-content-muted" />
          <h2 className="font-semibold text-content">Aparência</h2>
        </div>
      </CardHeader>
      <CardBody className="divide-y divide-surface-border">
        <LinhaSelect
          icone={<Type size={20} />}
          titulo="Tamanho da fonte"
          descricao="Aumenta ou diminui todo o texto e a interface."
          valor={fonte}
          desabilitado={!montado}
          aoMudar={(v) => definirFonte(v as typeof fonte)}
          opcoes={[
            { valor: "pequeno", rotulo: "Pequeno" },
            { valor: "padrao", rotulo: "Padrão" },
            { valor: "grande", rotulo: "Grande" },
          ]}
        />
        <LinhaSelect
          icone={<Rows3 size={20} />}
          titulo="Densidade"
          descricao="Compacto aproxima os elementos para caber mais na tela."
          valor={densidade}
          desabilitado={!montado}
          aoMudar={(v) => definirDensidade(v as typeof densidade)}
          opcoes={[
            { valor: "confortavel", rotulo: "Confortável" },
            { valor: "compacto", rotulo: "Compacto" },
          ]}
        />
        <LinhaConfig
          icone={<Sparkles size={20} />}
          titulo="Reduzir animações"
          descricao="Desliga transições e efeitos de movimento."
          ativo={animacoesReduzidas}
          aoAlternar={alternarAnimacoes}
          desabilitado={!montado}
          rotulo="Reduzir animações"
        />
      </CardBody>
    </Card>
  );
}

/** Tela inicial ao entrar (só faz sentido para a Central). */
function SecaoAoEntrar() {
  const { perfil } = useAuth();
  const { montado, telaInicial, definirTelaInicial } = usePreferencias();
  const destinos = destinosPara(perfil?.papel);

  // A recepção sempre entra em Chegadas; sem escolha, não mostra a seção.
  if (perfil?.papel !== "central") return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Home size={18} className="text-content-muted" />
          <h2 className="font-semibold text-content">Ao entrar</h2>
        </div>
      </CardHeader>
      <CardBody>
        <LinhaSelect
          icone={<Home size={20} />}
          titulo="Tela inicial"
          descricao="Para onde ir logo após entrar no sistema."
          valor={telaInicial}
          desabilitado={!montado}
          aoMudar={definirTelaInicial}
          opcoes={destinos.map((d) => ({ valor: d.href, rotulo: d.rotulo }))}
        />
      </CardBody>
    </Card>
  );
}

/**
 * Atalhos de teclado: define uma tecla para abrir uma tela sem o mouse.
 * Útil para o operador da Central alternar rápido entre telas sob pressão.
 */
function SecaoAtalhos() {
  const { perfil } = useAuth();
  const { atalhos, definirAtalho, removerAtalho, setCapturando } =
    usePreferencias();
  const destinos = destinosPara(perfil?.papel);

  // Qual linha está esperando uma tecla; null = nenhuma.
  const [capturandoHref, setCapturandoHref] = useState<string | null>(null);

  useEffect(() => {
    if (!capturandoHref) return;

    // Avisa o ouvinte global para não navegar enquanto DEFINIMOS a tecla.
    setCapturando(true);

    function aoTeclar(e: KeyboardEvent) {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setCapturandoHref(null);
        return;
      }
      const tecla = normalizarTecla(e);
      if (!tecla) return; // só um modificador: continua esperando
      definirAtalho(capturandoHref!, tecla);
      setCapturandoHref(null);
    }

    // Fase de captura para pegar a tecla antes de qualquer outro handler.
    window.addEventListener("keydown", aoTeclar, { capture: true });
    return () => {
      window.removeEventListener("keydown", aoTeclar, { capture: true });
      setCapturando(false);
    };
  }, [capturandoHref, definirAtalho, setCapturando]);

  // Recepção só tem uma tela — atalho não ajuda. Só mostra se houver escolha.
  if (destinos.length < 2) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Keyboard size={18} className="text-content-muted" />
          <h2 className="font-semibold text-content">Atalhos de teclado</h2>
        </div>
      </CardHeader>
      <CardBody className="flex flex-col gap-1">
        <p className="pb-2 text-sm text-content-muted">
          Defina uma tecla para abrir cada tela sem tirar a mão do teclado.
          Teclas de função (F2, F4, F7 a F10) funcionam bem; evite F5, F11 e
          F12, reservadas pelo navegador.
        </p>

        <div className="flex flex-col divide-y divide-surface-border">
          {destinos.map((d) => (
            <LinhaAtalho
              key={d.href}
              rotulo={d.rotulo}
              tecla={atalhos[d.href]}
              capturando={capturandoHref === d.href}
              aoDefinir={() => setCapturandoHref(d.href)}
              aoLimpar={() => removerAtalho(d.href)}
            />
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

function LinhaAtalho({
  rotulo,
  tecla,
  capturando,
  aoDefinir,
  aoLimpar,
}: {
  rotulo: string;
  tecla: string | undefined;
  capturando: boolean;
  aoDefinir: () => void;
  aoLimpar: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <span className="text-sm font-medium text-content">{rotulo}</span>

      <div className="flex items-center gap-2">
        {capturando ? (
          <span className="text-sm text-acento-chamados">
            Pressione uma tecla…{" "}
            <span className="text-xs text-content-muted">(Esc cancela)</span>
          </span>
        ) : tecla ? (
          <kbd className="rounded border border-surface-border bg-surface-muted px-2 py-1 text-xs font-semibold text-content">
            {tecla}
          </kbd>
        ) : (
          <span className="text-xs text-content-muted">Nenhum</span>
        )}

        <button
          type="button"
          onClick={aoDefinir}
          disabled={capturando}
          className="rounded-lg border border-surface-border px-3 py-1.5 text-xs font-medium text-content transition-colors hover:bg-surface-muted disabled:opacity-50"
        >
          {tecla ? "Alterar" : "Definir"}
        </button>

        {tecla && !capturando && (
          <button
            type="button"
            onClick={aoLimpar}
            className="rounded-lg px-2 py-1.5 text-xs font-medium text-prioridade-critica transition-colors hover:bg-prioridade-critica/10"
          >
            Limpar
          </button>
        )}
      </div>
    </div>
  );
}

function LinhaConfig({
  icone,
  titulo,
  descricao,
  ativo,
  aoAlternar,
  desabilitado,
  rotulo,
}: {
  icone: ReactNode;
  titulo: string;
  descricao: string;
  ativo: boolean;
  aoAlternar: () => void;
  desabilitado: boolean;
  rotulo: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-content-muted">{icone}</span>
        <div>
          <p className="font-medium text-content">{titulo}</p>
          <p className="text-sm text-content-muted">{descricao}</p>
        </div>
      </div>
      <Interruptor
        ativo={ativo}
        aoAlternar={aoAlternar}
        desabilitado={desabilitado}
        rotulo={rotulo}
      />
    </div>
  );
}

/**
 * Interruptor (switch) acessivel: role="switch" + aria-checked, para leitores
 * de tela anunciarem "ligado/desligado" e o teclado alternar com Enter/Espaco
 * (comportamento nativo do <button>).
 */
function Interruptor({
  ativo,
  aoAlternar,
  desabilitado,
  rotulo,
}: {
  ativo: boolean;
  aoAlternar: () => void;
  desabilitado: boolean;
  rotulo: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ativo}
      aria-label={rotulo}
      disabled={desabilitado}
      onClick={aoAlternar}
      className={[
        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
        ativo ? "bg-brand" : "bg-surface-muted border border-surface-border",
        desabilitado ? "cursor-not-allowed opacity-50" : "",
      ].join(" ")}
    >
      <span
        className={[
          "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
          ativo ? "translate-x-5" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  );
}

/** Linha de configuração com um <select> à direita. */
function LinhaSelect({
  icone,
  titulo,
  descricao,
  valor,
  opcoes,
  aoMudar,
  desabilitado,
}: {
  icone: ReactNode;
  titulo: string;
  descricao: string;
  valor: string;
  opcoes: { valor: string; rotulo: string }[];
  aoMudar: (v: string) => void;
  desabilitado: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-content-muted">{icone}</span>
        <div>
          <p className="font-medium text-content">{titulo}</p>
          <p className="text-sm text-content-muted">{descricao}</p>
        </div>
      </div>
      <select
        value={valor}
        disabled={desabilitado}
        onChange={(e) => aoMudar(e.target.value)}
        className="shrink-0 rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-content disabled:opacity-50"
      >
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Segurança: troca de senha.
 *
 * Feita 100% no cliente pelo SDK do Firebase — não passa pelo nosso backend.
 * O Firebase exige REAUTENTICAÇÃO recente antes de trocar a senha (por isso
 * pedimos a senha atual): é uma proteção contra alguém trocar a senha numa
 * sessão deixada aberta.
 */
function SecaoSeguranca() {
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(
    null,
  );

  async function submeter(e: FormEvent) {
    e.preventDefault();
    setAviso(null);

    if (nova.length < 6) {
      setAviso({ tipo: "erro", texto: "A nova senha deve ter ao menos 6 caracteres." });
      return;
    }
    if (nova !== confirma) {
      setAviso({ tipo: "erro", texto: "A confirmação não confere com a nova senha." });
      return;
    }

    const usuario = auth.currentUser;
    if (!usuario || !usuario.email) {
      setAviso({ tipo: "erro", texto: "Sessão inválida. Entre novamente." });
      return;
    }

    setEnviando(true);
    try {
      // Reautentica com a senha atual e só então troca.
      const credencial = EmailAuthProvider.credential(usuario.email, atual);
      await reauthenticateWithCredential(usuario, credencial);
      await updatePassword(usuario, nova);
      setAviso({ tipo: "ok", texto: "Senha alterada com sucesso." });
      setAtual("");
      setNova("");
      setConfirma("");
    } catch (err) {
      const codigo = (err as { code?: string }).code;
      let texto = "Não foi possível alterar a senha.";
      if (codigo === "auth/wrong-password" || codigo === "auth/invalid-credential") {
        texto = "A senha atual está incorreta.";
      } else if (codigo === "auth/weak-password") {
        texto = "A nova senha é muito fraca.";
      } else if (codigo === "auth/too-many-requests") {
        texto = "Muitas tentativas. Tente novamente mais tarde.";
      } else if (codigo === "auth/requires-recent-login") {
        texto = "Por segurança, entre novamente e repita a troca.";
      }
      setAviso({ tipo: "erro", texto });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <KeyRound size={18} className="text-content-muted" />
          <h2 className="font-semibold text-content">Segurança</h2>
        </div>
      </CardHeader>
      <CardBody>
        <form onSubmit={submeter} noValidate className="flex max-w-sm flex-col gap-4">
          <Input
            label="Senha atual"
            type="password"
            autoComplete="current-password"
            value={atual}
            onChange={(e) => setAtual(e.target.value)}
          />
          <Input
            label="Nova senha"
            type="password"
            autoComplete="new-password"
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            placeholder="Ao menos 6 caracteres"
          />
          <Input
            label="Confirmar nova senha"
            type="password"
            autoComplete="new-password"
            value={confirma}
            onChange={(e) => setConfirma(e.target.value)}
          />

          {aviso && (
            <p
              className={[
                "rounded-lg px-3 py-2 text-sm",
                aviso.tipo === "ok"
                  ? "bg-status-disponivel/10 text-status-disponivel"
                  : "bg-prioridade-critica/10 text-prioridade-critica",
              ].join(" ")}
            >
              {aviso.texto}
            </p>
          )}

          <Button
            type="submit"
            carregando={enviando}
            disabled={!atual || !nova || !confirma}
          >
            Alterar senha
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

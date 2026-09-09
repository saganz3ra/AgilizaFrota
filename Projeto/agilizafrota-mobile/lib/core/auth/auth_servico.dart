import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';

import '../api/api_cliente.dart';
import '../api/api_excecao.dart';
import 'usuario.dart';

/// Situacao da sessao. A tela raiz observa isto para decidir o que mostrar.
enum SituacaoAuth {
  /// Ainda verificando se ha sessao salva.
  verificando,

  /// Sem sessao: mostrar login.
  deslogado,

  /// Sessao valida e perfil de motorista carregado.
  autenticado,
}

/// Autenticacao do app (RF01).
///
/// O fluxo tem DOIS passos, e isso e proposital:
///  1. Firebase Authentication valida e-mail e senha. A senha nunca passa
///     pela nossa API (decisao de seguranca do RNF01).
///  2. `GET /api/auth/me` busca o PERFIL no nosso banco. O papel vem do
///     banco, nao do token - um token valido nao concede papel nenhum.
///
/// O app so aceita o papel `motorista`: quem e da central ou recepcao usa
/// o painel web. Recusar aqui, com mensagem clara, evita que o usuario ache
/// que a senha esta errada.
class AuthServico extends ChangeNotifier {
  final FirebaseAuth _firebase;
  late final ApiCliente api;

  SituacaoAuth _situacao = SituacaoAuth.verificando;
  Usuario? _usuario;
  String? _erro;

  SituacaoAuth get situacao => _situacao;
  Usuario? get usuario => _usuario;
  String? get erro => _erro;

  AuthServico({FirebaseAuth? firebase})
      : _firebase = firebase ?? FirebaseAuth.instance {
    api = ApiCliente(
      obterToken: _tokenAtual,
      aoExpirarSessao: _aoExpirarSessao,
    );
    _firebase.authStateChanges().listen(_aoMudarEstado);
  }

  /// Token atual do Firebase. A biblioteca renova sozinha quando expira.
  Future<String?> _tokenAtual() async {
    final conta = _firebase.currentUser;
    if (conta == null) return null;
    try {
      return await conta.getIdToken();
    } catch (_) {
      return null;
    }
  }

  Future<void> _aoMudarEstado(User? conta) async {
    if (conta == null) {
      _usuario = null;
      _definir(SituacaoAuth.deslogado);
      return;
    }
    await _carregarPerfil();
  }

  /// Busca o perfil no backend e valida o papel.
  Future<void> _carregarPerfil() async {
    try {
      final resposta = await api.get('/auth/me');
      final usuario =
          Usuario.doJson((resposta as Map<String, dynamic>)['usuario'] as Map<String, dynamic>);

      if (!usuario.ehMotorista) {
        await _firebase.signOut();
        _erro = 'Este aplicativo e exclusivo para motoristas. '
            'Perfil "${usuario.papel}" deve usar o painel web.';
        _usuario = null;
        _definir(SituacaoAuth.deslogado);
        return;
      }

      _usuario = usuario;
      _erro = null;
      _definir(SituacaoAuth.autenticado);
    } on ApiExcecao catch (e) {
      // Sem rede na abertura: mantem o usuario logado offline. O app
      // continua util (fila local) mesmo sem confirmar o perfil agora.
      if (e.ehFalhaDeRede && _usuario != null) {
        _definir(SituacaoAuth.autenticado);
        return;
      }
      await _firebase.signOut();
      _erro = e.mensagem;
      _usuario = null;
      _definir(SituacaoAuth.deslogado);
    }
  }

  /// Entrar com e-mail e senha. Devolve `true` em caso de sucesso.
  Future<bool> entrar(String email, String senha) async {
    _erro = null;
    notifyListeners();
    try {
      await _firebase.signInWithEmailAndPassword(
        email: email.trim(),
        password: senha,
      );
      // `_aoMudarEstado` assume daqui e carrega o perfil.
      return true;
    } on FirebaseAuthException catch (e) {
      _erro = _traduzirFirebase(e);
      notifyListeners();
      return false;
    } catch (_) {
      _erro = 'Nao foi possivel entrar. Verifique sua conexao.';
      notifyListeners();
      return false;
    }
  }

  Future<void> sair() async {
    await _firebase.signOut();
  }

  void _aoExpirarSessao() {
    _firebase.signOut();
  }

  void _definir(SituacaoAuth nova) {
    _situacao = nova;
    notifyListeners();
  }

  /// Mensagens do Firebase vem em ingles e sao tecnicas demais.
  String _traduzirFirebase(FirebaseAuthException e) {
    switch (e.code) {
      case 'invalid-email':
        return 'E-mail em formato invalido.';
      case 'user-disabled':
        return 'Esta conta foi desativada. Procure a Central.';
      case 'user-not-found':
      case 'wrong-password':
      case 'invalid-credential':
        return 'E-mail ou senha incorretos.';
      case 'too-many-requests':
        return 'Muitas tentativas. Aguarde alguns minutos.';
      case 'network-request-failed':
        return 'Sem conexao com a internet.';
      default:
        return 'Falha ao entrar (${e.code}).';
    }
  }
}

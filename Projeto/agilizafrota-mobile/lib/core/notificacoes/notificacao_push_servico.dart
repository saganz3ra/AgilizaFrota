import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/api_cliente.dart';

/// Chave global do ScaffoldMessenger. Uma notificação pode chegar em qualquer
/// tela, então o serviço mostra o SnackBar por aqui, sem depender do contexto
/// de uma tela específica.
final GlobalKey<ScaffoldMessengerState> chaveMensageiro =
    GlobalKey<ScaffoldMessengerState>();

/// Notificações push (FCM) do motorista.
///
/// O trabalho do app é pequeno: pedir permissão, pegar o token do aparelho e
/// registrá-lo no backend. O disparo vem de lá quando o motorista é acionado
/// (RF07). Com o app em SEGUNDO PLANO/fechado, o próprio Android exibe a
/// notificação (a mensagem carrega `notification`); em PRIMEIRO PLANO isso não
/// acontece, então mostramos um SnackBar.
class NotificacaoPushServico {
  final ApiCliente api;
  final FirebaseMessaging _fcm = FirebaseMessaging.instance;

  static const _chave = 'push_ativo';
  bool _iniciado = false;
  String? _token;

  NotificacaoPushServico(this.api);

  /// Preferência do usuário (padrão: ligado). Por aparelho.
  Future<bool> ativo() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_chave) ?? true;
  }

  /// Configura os listeners e, se a preferência estiver ligada, registra o
  /// token. Idempotente: chamar de novo não duplica os listeners.
  Future<void> iniciar() async {
    if (!_iniciado) {
      _iniciado = true;
      FirebaseMessaging.onMessage.listen(_aoReceberEmPrimeiroPlano);
      _fcm.onTokenRefresh.listen(_registrar);
    }
    if (await ativo()) await _garantirRegistrado();
  }

  void _aoReceberEmPrimeiroPlano(RemoteMessage msg) {
    final n = msg.notification;
    final texto = [n?.title, n?.body]
        .whereType<String>()
        .where((s) => s.isNotEmpty)
        .join(': ');
    if (texto.isEmpty) return;
    chaveMensageiro.currentState?.showSnackBar(
      SnackBar(content: Text(texto)),
    );
  }

  /// Liga/desliga. Ao ligar, pede permissão e registra; ao desligar, remove o
  /// token para o backend parar de enviar. Devolve o estado efetivo (pode
  /// voltar `false` se a permissão for negada).
  Future<bool> definirAtivo(bool valor) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_chave, valor);
    if (valor) return _garantirRegistrado();
    await _desregistrar();
    return false;
  }

  Future<bool> _garantirRegistrado() async {
    final permissao = await _fcm.requestPermission();
    if (permissao.authorizationStatus == AuthorizationStatus.denied) {
      return false;
    }
    final token = await _fcm.getToken();
    if (token == null) return false;
    await _registrar(token);
    return true;
  }

  Future<void> _registrar(String token) async {
    _token = token;
    try {
      await api.post(
        '/motorista/dispositivo',
        {'token': token, 'plataforma': 'android'},
      );
    } catch (_) {
      // best-effort: sem rede, tenta de novo no próximo iniciar()/refresh.
    }
  }

  Future<void> _desregistrar() async {
    final token = _token ?? await _fcm.getToken();
    if (token != null) {
      try {
        await api.delete('/motorista/dispositivo', {'token': token});
      } catch (_) {
        /* best-effort */
      }
    }
    try {
      await _fcm.deleteToken();
    } catch (_) {
      /* ignora */
    }
    _token = null;
  }
}

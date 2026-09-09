import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

import 'item_fila.dart';

/// Fila local de registros pendentes (RNF03).
///
/// Por que SQLite e nao um arquivo ou memoria: o aparelho pode ser
/// reiniciado, ficar sem bateria ou ter o app encerrado pelo sistema no
/// meio de um turno. O registro do motorista nao pode depender de o
/// processo continuar vivo - ele precisa sobreviver ao aparelho desligar.
///
/// A fila guarda a intencao (o que foi feito, quando, com quais dados) e
/// nunca o resultado. Reenviar e sempre seguro: o servidor reconhece pelo
/// id do cliente e responde "duplicado" em vez de criar outro registro.
class FilaOffline {
  static const _arquivo = 'agilizafrota_fila.db';
  static const _tabela = 'fila';

  Database? _bd;

  Future<Database> get _banco async => _bd ??= await _abrir();

  Future<Database> _abrir() async {
    final caminho = p.join(await getDatabasesPath(), _arquivo);
    return openDatabase(
      caminho,
      version: 1,
      onCreate: (bd, _) async {
        await bd.execute('''
          CREATE TABLE $_tabela (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo         TEXT    NOT NULL,
            marco        TEXT,
            params       TEXT    NOT NULL DEFAULT '{}',
            dados        TEXT    NOT NULL DEFAULT '{}',
            ocorrido_em  TEXT    NOT NULL,
            tentativas   INTEGER NOT NULL DEFAULT 0,
            ultimo_erro  TEXT,
            criado_em    TEXT    NOT NULL DEFAULT (datetime('now'))
          )
        ''');
        // A leitura mais frequente e "o que enviar primeiro", em ordem
        // cronologica do evento.
        await bd.execute(
          'CREATE INDEX idx_fila_ordem ON $_tabela (ocorrido_em ASC)',
        );
      },
    );
  }

  /// Coloca um registro na fila.
  Future<int> enfileirar(ItemFila item) async {
    final bd = await _banco;
    return bd.insert(_tabela, item.paraLinha());
  }

  /// Itens pendentes, do mais antigo para o mais novo.
  ///
  /// A ordem cronologica importa: nao adianta aplicar "cheguei ao local"
  /// antes de "iniciei o atendimento". O servidor tambem reordena, mas
  /// enviar certo evita falhas desnecessarias.
  Future<List<ItemFila>> pendentes({int limite = 200}) async {
    final bd = await _banco;
    final linhas = await bd.query(
      _tabela,
      orderBy: 'ocorrido_em ASC, id ASC',
      limit: limite,
    );
    return linhas.map(ItemFila.daLinha).toList();
  }

  Future<int> total() async {
    final bd = await _banco;
    final r = await bd.rawQuery('SELECT COUNT(*) AS n FROM $_tabela');
    return Sqflite.firstIntValue(r) ?? 0;
  }

  /// Quantos itens ja falharam ao menos uma vez.
  Future<int> comFalha() async {
    final bd = await _banco;
    final r = await bd.rawQuery(
      'SELECT COUNT(*) AS n FROM $_tabela WHERE tentativas > 0',
    );
    return Sqflite.firstIntValue(r) ?? 0;
  }

  /// Remove os itens aceitos pelo servidor (aplicados ou duplicados).
  Future<void> remover(Iterable<int> ids) async {
    if (ids.isEmpty) return;
    final bd = await _banco;
    final marcadores = List.filled(ids.length, '?').join(',');
    await bd.delete(
      _tabela,
      where: 'id IN ($marcadores)',
      whereArgs: ids.toList(),
    );
  }

  /// Registra a falha de um item, para o motorista poder ver o motivo.
  Future<void> marcarFalha(int idLocal, String erro) async {
    final bd = await _banco;
    await bd.rawUpdate(
      'UPDATE $_tabela SET tentativas = tentativas + 1, ultimo_erro = ? WHERE id = ?',
      [erro, idLocal],
    );
  }

  /// Descarta um item que o motorista decidiu abandonar.
  Future<void> descartar(int idLocal) async {
    final bd = await _banco;
    await bd.delete(_tabela, where: 'id = ?', whereArgs: [idLocal]);
  }

  Future<void> limpar() async {
    final bd = await _banco;
    await bd.delete(_tabela);
  }

  Future<void> fechar() async {
    await _bd?.close();
    _bd = null;
  }
}

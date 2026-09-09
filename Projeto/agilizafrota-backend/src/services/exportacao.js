/**
 * Exportacao de relatorios (RF13) em CSV e HTML-para-impressao.
 *
 * Decisao de projeto: nao adicionamos bibliotecas pesadas de PDF/XLSX.
 *  - CSV com BOM UTF-8 abre direto no Excel (acentuacao correta) e e o
 *    formato universal para planilhas.
 *  - HTML com folha de estilo de impressao permite "Imprimir > Salvar como
 *    PDF" no proprio navegador, gerando um PDF paginado sem dependencias.
 * Isso mantem o backend leve e a instalacao simples, sem perder o requisito
 * de "gerar e exportar relatorios".
 */

/** Escapa um valor para CSV (aspas, ponto e virgula, quebras de linha). */
function escaparCsv(valor) {
  if (valor === null || valor === undefined) return '';
  const texto = String(valor);
  if (/[";\n\r]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

/**
 * Converte linhas em CSV. Usa ";" como separador (padrao pt-BR do Excel)
 * e adiciona BOM para preservar a acentuacao.
 * @param {Array<object>} linhas
 * @param {Array<{campo:string,titulo:string}>} colunas
 */
function gerarCsv(linhas, colunas) {
  const cabecalho = colunas.map((c) => escaparCsv(c.titulo)).join(';');
  const corpo = linhas
    .map((linha) => colunas.map((c) => escaparCsv(linha[c.campo])).join(';'))
    .join('\r\n');
  return `﻿${cabecalho}\r\n${corpo}\r\n`;
}

/** Escapa HTML (evita quebrar o layout com dados do usuario). */
function escaparHtml(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Documento HTML pronto para impressao/PDF, no visual do sistema.
 * @param {{titulo:string, subtitulo?:string, periodo?:object,
 *          resumo?:object, colunas:Array, linhas:Array}} dados
 */
function gerarHtml({ titulo, subtitulo, periodo, resumo, colunas, linhas }) {
  const cards = resumo
    ? Object.entries(resumo)
        .map(
          ([chave, valor]) => `
        <div class="card">
          <span class="valor">${escaparHtml(valor)}</span>
          <span class="rotulo">${escaparHtml(chave.replace(/_/g, ' '))}</span>
        </div>`,
        )
        .join('')
    : '';

  const cabecalho = colunas.map((c) => `<th>${escaparHtml(c.titulo)}</th>`).join('');
  const corpo = linhas
    .map(
      (l) =>
        `<tr>${colunas.map((c) => `<td>${escaparHtml(l[c.campo])}</td>`).join('')}</tr>`,
    )
    .join('');

  const emissao = new Date().toLocaleString('pt-BR');
  const intervalo =
    periodo && (periodo.desde || periodo.ate)
      ? `Período: ${periodo.desde ? new Date(periodo.desde).toLocaleString('pt-BR') : 'início'} até ${
          periodo.ate ? new Date(periodo.ate).toLocaleString('pt-BR') : 'agora'
        }`
      : 'Período: todo o histórico';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${escaparHtml(titulo)} - Agiliza Frota</title>
<style>
  :root { --brand:#1256b8; --borda:#dce3ec; --texto:#101828; --suave:#5b6472; }
  * { box-sizing:border-box; }
  body { font-family: system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;
         color:var(--texto); margin:24px; }
  header { border-bottom:3px solid var(--brand); padding-bottom:12px; margin-bottom:20px; }
  h1 { margin:0 0 4px; font-size:20px; color:var(--brand); }
  .sub { color:var(--suave); font-size:13px; }
  .cards { display:flex; flex-wrap:wrap; gap:12px; margin:18px 0; }
  .card { border:1px solid var(--borda); border-radius:8px; padding:10px 14px; min-width:130px; }
  .card .valor { display:block; font-size:20px; font-weight:700; }
  .card .rotulo { display:block; font-size:11px; color:var(--suave); text-transform:capitalize; }
  table { width:100%; border-collapse:collapse; font-size:12px; }
  th { background:#f4f6fa; text-align:left; padding:8px; border-bottom:2px solid var(--borda); }
  td { padding:7px 8px; border-bottom:1px solid var(--borda); }
  tr:nth-child(even) td { background:#fafbfd; }
  footer { margin-top:24px; font-size:11px; color:var(--suave); }
  @media print {
    body { margin:12mm; }
    thead { display:table-header-group; }   /* repete o cabecalho a cada pagina */
    tr { break-inside:avoid; }
    .aviso { display:none; }
  }
  .aviso { background:#e8f0fc; border:1px solid var(--brand); border-radius:8px;
           padding:10px 14px; font-size:12px; margin-bottom:16px; }
</style>
</head>
<body>
  <div class="aviso">Para salvar em PDF: use <strong>Imprimir</strong> (Ctrl/Cmd+P) e escolha <strong>Salvar como PDF</strong>.</div>
  <header>
    <h1>${escaparHtml(titulo)}</h1>
    <div class="sub">${escaparHtml(subtitulo || 'Agiliza Frota — gestão de frota hospitalar')}</div>
    <div class="sub">${escaparHtml(intervalo)} · Emitido em ${escaparHtml(emissao)}</div>
  </header>
  ${cards ? `<div class="cards">${cards}</div>` : ''}
  <table>
    <thead><tr>${cabecalho}</tr></thead>
    <tbody>${corpo || `<tr><td colspan="${colunas.length}">Sem registros no período.</td></tr>`}</tbody>
  </table>
  <footer>Relatório gerado automaticamente pelo Agiliza Frota · ${escaparHtml(linhas.length)} registro(s).</footer>
</body>
</html>`;
}

/** Envia a resposta no formato pedido (json | csv | html). */
function responderRelatorio(req, res, { nome, titulo, subtitulo, periodo, resumo, colunas, linhas }) {
  const formato = (req.query.formato || 'json').toLowerCase();

  if (formato === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nome}.csv"`);
    return res.send(gerarCsv(linhas, colunas));
  }
  if (formato === 'html' || formato === 'pdf') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(gerarHtml({ titulo, subtitulo, periodo, resumo, colunas, linhas }));
  }
  return res.json({ relatorio: nome, periodo, resumo, total: linhas.length, colunas, linhas });
}

module.exports = { escaparCsv, gerarCsv, escaparHtml, gerarHtml, responderRelatorio };

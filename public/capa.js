// =============================================================== CAPA DA PAUTA (escala do dia no modelo da emissora)
// Fica guardada por data neste aparelho. O texto copiado usa *asteriscos*, o negrito do WhatsApp.
const CAPA_TIPOS = [['PAUTA', 'Pauta'], ['VT', 'Pauta VT'], ['LINK', 'Link'], ['ESPECIAL', 'Pauta para especiais']];
const CAPA_HOBS = ['saída da TV', 'no local'];
const CAPA_PESSOAS = [
  // campo, rótulo, funções do cadastro, perfis de acesso
  ['reporter', 'Repórter', ['Repórter'], ['reporter']],
  ['cinegrafista', 'Cinegrafista', ['Repórter cinematográfico'], []],
  ['motorista', 'Motorista', ['Motorista'], []],
  ['editor', 'Edição', ['Editor de imagens', 'Editor de texto'], ['editor_imagem', 'editor']],
];
const capaKey = (d) => `redacao:capa:${d}`;
const capaLer = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const capaGravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
// "09:00" → "9h" · "15:30" → "15h30"
const capaHora = (v) => { const m = String(v || '').match(/^(\d{1,2}):(\d{2})/); return m ? `${+m[1]}h${m[2] === '00' ? '' : m[2]}` : String(v || '').trim(); };
function capaCabecalho(d) {
  const dia = weekday(d).toLowerCase(), [, mes, num] = d.split('-');
  return `Pautas ${/^(sábado|domingo)/.test(dia) ? 'deste' : 'desta'} ${dia} - ${num}/${mes}`;
}
const capaItemVazio = (tipo = 'PAUTA') => ({ tipo, numero: '', titulo: '', horario: '', horarioObs: tipo === 'LINK' ? 'no local' : 'saída da TV', gravacao: '', local: '', reporter: '', cinegrafista: '', motorista: '', editor: '' });
const capaDePauta = (p) => Object.assign(capaItemVazio(p.formato === 'LINK' ? 'LINK' : 'PAUTA'), {
  origem: p.id, titulo: p.retranca, horario: p.horario || '', local: p.local || '', reporter: repName(p), cinegrafista: p.cinegrafista || '', motorista: p.motorista || '', editor: p.edicaoEditor || '',
});
// o documento é uma lista de blocos; cada bloco tem título (negrito) e linhas. Serve à tela, à impressão, ao PDF e ao WhatsApp.
function capaBlocos(c) {
  const linhas = (pares) => pares.filter(([, v]) => String(v || '').trim()).map(([r, v]) => `${r}: ${String(v).trim()}`);
  const blocos = [];
  c.itens.forEach(i => {
    // "Pauta 4645" digitado no número não pode virar "Pauta Pauta 4645"
    const t = i.titulo.trim(), n = i.numero.trim().replace(/^((pauta|link|vt)\b\s*)+/i, ''), h = capaHora(i.horario);
    if (!t && !n && !h && !i.local.trim() && !CAPA_PESSOAS.some(([k]) => i[k])) return;   // linha ainda em branco
    const com = (a, b, sep = ' – ') => [a, b].filter(Boolean).join(sep);
    const link = i.tipo === 'LINK';
    const titulo = link ? com(com('LINK', n, ' '), h) + (i.horarioObs ? ` (${i.horarioObs})` : '')
      : i.tipo === 'ESPECIAL' ? com('Pauta para especiais', t, ': ')
      : com(['Pauta', i.tipo === 'VT' ? 'VT' : '', n].filter(Boolean).join(' '), t);
    blocos.push({ titulo, linhas: [
      ...(link && t ? [`Pauta – ${t}`] : []),
      ...linhas([['Horário', link ? '' : com(h, h ? i.horarioObs : '')], ['Gravação', capaHora(i.gravacao)], ['Local', i.local], ...CAPA_PESSOAS.map(([k, r]) => [r, i[k]])]),
    ] });
  });
  if (c.obs.trim()) blocos.push({ titulo: 'Observações', linhas: c.obs.trim().split('\n') });
  return blocos;
}
const capaTexto = (d, c) => [`*${capaCabecalho(d)}*`, ...capaBlocos(c).map(b => [`*${b.titulo}*`, ...b.linhas].join('\n'))].join('\n\n');
function capaHtml(d, c) {
  const o = S.org || {}, blocos = capaBlocos(c);
  return `<div class="doc"><div class="cp-top"><img src="${esc(orgLogo())}" alt="${esc(o.name || '')}"></div>
    <div class="cp-titulo">${esc(capaCabecalho(d))}</div>
    ${blocos.map(b => `<div class="cp-bloco"><b>${esc(b.titulo)}</b>${b.linhas.map(l => `<div>${esc(l) || '&nbsp;'}</div>`).join('')}</div>`).join('') || '<p>Preencha os campos para montar a capa.</p>'}
  </div>`;
}
// nomes para escolher: somente quem está cadastrado na função (funcionários e usuários com esse perfil)
function capaNomes() {
  const uniq = (a) => [...new Set(a.map(s => String(s || '').trim()).filter(Boolean))].sort((x, y) => x.localeCompare(y, 'pt-BR'));
  const equipe = funcionarios();
  return Object.fromEntries(CAPA_PESSOAS.map(([k, , funcoes, perfis]) => [k,
    uniq([...equipe.filter(f => funcoes.includes(f.funcao)).map(f => f.nome), ...S.users.filter(u => u.active && perfis.includes(u.role)).map(u => u.name)])]));
}

function openCapa() {
  const o = S.org || {};
  const brand = /^#[0-9a-fA-F]{6}$/.test(o.printColor || '') ? o.printColor : '#0b3566';
  const amanha = addDays(today(), 1);
  const md = modal('Capa da pauta', `
    <div class="cp">
      <div class="cp-form">
        <div class="field"><label for="capa-data">Data da capa</label><input type="date" id="capa-data" value="${amanha}"></div>
        <div id="capa-campos"></div>
      </div>
      <div class="cp-previa"><div class="lbl">Como vai ficar</div><div class="pdf-render cp-papel"><div class="docs" style="--brand:${brand}" id="capa-doc"></div></div></div>
    </div>`,
    { wide: true, footer: '<span class="hint cp-aviso">Salva neste aparelho enquanto você preenche.</span><button class="btn" data-close>Fechar</button><button class="btn" id="capa-print" disabled>Imprimir</button><button class="btn" id="capa-pdf" disabled>Baixar PDF</button><button class="btn primary" id="capa-copiar" disabled>Copiar para WhatsApp</button>' });
  md.el.classList.add('ficha-modal', 'capa-modal'); if (document.activeElement) document.activeElement.blur();
  const data = $('#capa-data', md.el), campos = $('#capa-campos', md.el);
  let c = null, dia = amanha, doSistema = [], seq = 0;
  const botoes = () => $$('#capa-print, #capa-pdf, #capa-copiar', md.el).forEach(b => { b.disabled = !c; });
  const previa = () => { $('#capa-doc', md.el).innerHTML = c ? capaHtml(dia, c) : ''; };
  const salvar = () => { if (!capaGravar(capaKey(dia), c)) $('.cp-aviso', md.el).textContent = 'Não foi possível salvar neste aparelho.'; previa(); };

  const pessoa = (i, n, [k, rotulo], nomes) => {
    const op = (v) => `<option ${v === i[k] ? 'selected' : ''}>${esc(v)}</option>`;
    const manual = i[k] && !nomes.includes(i[k]) ? i[k] : '';   // nome digitado (ou vindo da pauta): vale só para esta linha
    return `<div class="field"><label for="cp-${k}-${n}">${rotulo}</label>
      <select id="cp-${k}-${n}" data-i="${n}" data-k="${k}"><option value="">${nomes.length ? 'Escolher…' : 'Ninguém cadastrado'}</option>
        ${nomes.map(op).join('')}${manual ? op(manual) : ''}
        <option value="__novo">+ Inserir manualmente…</option></select>
      <input type="text" class="cp-novo" data-novo="${k}" data-i="${n}" aria-label="${rotulo}: nome manual" placeholder="Digite o nome e tecle Enter" hidden></div>`;
  };
  const campo = (rot, attrs, valor, tipo = 'text', extra = '') => `<div class="field ${extra}"><label>${rot}<input type="${tipo}" ${attrs} value="${esc(valor)}"></label></div>`;
  const desenhar = () => {
    if (!c) return;
    const nomes = capaNomes();
    campos.innerHTML = `
      ${c.itens.map((i, n) => `<fieldset class="cp-card"><legend>${n + 1}ª pauta</legend>
        <div class="cp-grid">
          <div class="field"><label>Tipo<select data-i="${n}" data-k="tipo">${opts(CAPA_TIPOS, i.tipo)}</select></label></div>
          ${campo('Número', `data-i="${n}" data-k="numero" inputmode="numeric" placeholder="Ex.: 4647"`, i.numero)}
          ${campo('Título', `data-i="${n}" data-k="titulo" placeholder="Assunto da pauta"`, i.titulo, 'text', 'cp-full')}
          ${campo('Horário', `data-i="${n}" data-k="horario"`, i.horario, 'time')}
          <div class="field"><label>Referência<select data-i="${n}" data-k="horarioObs"><option value="">Sem referência</option>${opts(CAPA_HOBS, i.horarioObs)}</select></label></div>
          ${campo('Gravação (opcional)', `data-i="${n}" data-k="gravacao"`, i.gravacao, 'time')}
          ${campo('Local', `data-i="${n}" data-k="local"`, i.local)}
          ${CAPA_PESSOAS.map(def => pessoa(i, n, def, nomes[def[0]])).join('')}
        </div>
        <div class="formbar"><button class="btn sm" data-acao="subir" data-n="${n}" ${n ? '' : 'disabled'} aria-label="Subir pauta">↑</button><button class="btn sm" data-acao="descer" data-n="${n}" ${n < c.itens.length - 1 ? '' : 'disabled'} aria-label="Descer pauta">↓</button><button class="btn sm danger" data-acao="tirar" data-n="${n}">Remover pauta</button></div></fieldset>`).join('')}
      <div class="cp-add"><button class="btn" data-acao="PAUTA">+ Pauta</button><button class="btn" data-acao="LINK">+ Link</button><button class="btn" data-acao="sistema">Trazer pautas do sistema</button></div>
      <div class="field"><label>Observações (opcional)<textarea data-k="obs" rows="2" placeholder="Plantão, avisos, equipamentos…">${esc(c.obs)}</textarea></label></div>`;
  };

  const mudar = (t) => {
    const k = t.dataset.k; if (!c || !k) return false;
    if (t.dataset.i != null) c.itens[+t.dataset.i][k] = t.value;
    else c[k] = t.value;
    return true;
  };
  campos.oninput = (e) => { if (e.target.tagName !== 'SELECT' && mudar(e.target)) salvar(); };
  campos.onchange = (e) => {
    const t = e.target;
    if (t.dataset.novo) return novoNome(t);
    if (t.tagName !== 'SELECT') return;
    if (t.value === '__novo') { const inp = t.parentElement.querySelector('.cp-novo'); inp.hidden = false; inp.focus(); return; }
    if (mudar(t)) salvar();
  };
  const novoNome = (inp) => {
    const nome = inp.value.trim(), k = inp.dataset.novo, n = +inp.dataset.i;
    if (!nome) return;
    c.itens[n][k] = nome; salvar(); desenhar();
  };
  campos.onkeydown = (e) => { if (e.key === 'Enter' && e.target.dataset.novo) { e.preventDefault(); novoNome(e.target); } };
  campos.onclick = (e) => {
    const b = e.target.closest('[data-acao]'); if (!b || !c) return;
    const a = b.dataset.acao, n = +b.dataset.n;
    if (a === 'PAUTA' || a === 'LINK') c.itens.push(capaItemVazio(a));
    else if (a === 'sistema') {
      const novas = doSistema.filter(p => p.status !== 'caiu' && !c.itens.some(i => i.origem === p.id));
      if (!novas.length) return toast('Não há outras pautas do sistema nesta data.');
      c.itens.push(...novas.map(capaDePauta)); toast(`${novas.length} pauta(s) adicionada(s).`);
    } else if (a === 'tirar') { if (c.itens[n].titulo && !confirm(`Remover "${c.itens[n].titulo}" da capa? A pauta continua no sistema.`)) return; c.itens.splice(n, 1); }
    else if (a === 'subir' || a === 'descer') { const m = a === 'subir' ? n - 1 : n + 1; [c.itens[n], c.itens[m]] = [c.itens[m], c.itens[n]]; }
    salvar(); desenhar();
  };

  const carregar = async () => {
    const meu = ++seq, d = data.value; c = null; botoes(); previa();
    if (!d) { campos.innerHTML = '<p class="hint">Escolha a data.</p>'; return; }
    campos.innerHTML = '<p class="hint">Carregando…</p>';
    let lista = [];
    try { lista = await api('GET', `/api/pautas?from=${d}&to=${d}`); }
    catch (e) { if (meu === seq) toast('Não foi possível trazer as pautas do sistema: ' + e.message, true); }
    if (meu !== seq) return;   // a data mudou enquanto carregava
    dia = d; doSistema = lista.sort((a, b) => (a.horario || '99').localeCompare(b.horario || '99') || a.retranca.localeCompare(b.retranca));
    c = capaLer(capaKey(d)) || { itens: doSistema.filter(p => p.status !== 'caiu').map(capaDePauta), obs: '' };
    botoes(); desenhar(); previa();
  };
  data.onchange = carregar;
  $('#capa-copiar', md.el).onclick = async () => {
    const texto = capaTexto(dia, c);
    try { await navigator.clipboard.writeText(texto); toast('Capa copiada. Cole no WhatsApp.'); }
    catch {
      const m = modal('Copiar a capa', `<textarea rows="16" readonly style="width:100%">${esc(texto)}</textarea><p class="hint">Selecione o texto e copie.</p>`, { footer: '<button class="btn" data-close>Fechar</button>' });
      $('textarea', m.el).select();
    }
  };
  $('#capa-print', md.el).onclick = () => {
    const titulo = document.title; document.title = `CAPA DA PAUTA - ${fmtDate(dia).replace(/\//g, '-')}`;
    $('#print-area').innerHTML = `<div class="docs" style="--brand:${brand}">${capaHtml(dia, c)}</div>`;
    Promise.all($$('#print-area img').map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; }))).then(() => { window.print(); setTimeout(() => { document.title = titulo; }, 1000); });
  };
  $('#capa-pdf', md.el).onclick = () => capaPdf(dia, c, brand);
  carregar();
}
async function capaPdf(d, c, brandHex) {
  toast('Gerando PDF…');
  try { if (!window.jspdf) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'); }
  catch { return toast('Não foi possível carregar o gerador de PDF. Verifique a internet ou use Imprimir → Salvar como PDF.', true); }
  try {
    const o = S.org || {};
    const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', compress: true });
    doc.setProperties({ title: capaCabecalho(d), author: o.name || '', creator: 'Redação' });
    const M = 18, W = 210, FIM = 282, CW = W - 2 * M;
    const B = [1, 3, 5].map(i => parseInt(brandHex.slice(i, i + 2), 16));
    const fonte = (estilo, tam, cor) => { doc.setFont('helvetica', estilo); doc.setFontSize(tam); doc.setTextColor(...(cor || [20, 22, 26])); };
    let y = 16;
    const logo = await pdfLogo(orgLogo());
    if (logo) { const s = Math.min(46 / logo.w, 18 / logo.h); doc.addImage(logo.data, logo.fmt, M, y, logo.w * s, logo.h * s, undefined, 'FAST'); y += logo.h * s + 6; }
    fonte('bold', 16, B); doc.text(pdfSafe(capaCabecalho(d)), M, y + 5); y += 8;
    doc.setDrawColor(...B); doc.setLineWidth(0.8); doc.line(M, y, W - M, y); y += 8;
    capaBlocos(c).forEach(b => {
      fonte('bold', 11.5); const t = doc.splitTextToSize(pdfSafe(b.titulo), CW);
      fonte('normal', 11); const l = b.linhas.flatMap(x => doc.splitTextToSize(pdfSafe(x) || ' ', CW));
      const alt = t.length * 5.6 + l.length * 5.2;
      if (y + alt > FIM && alt < FIM - 18) { doc.addPage(); y = 18; }   // bloco inteiro na mesma página
      const escreve = (linhas, estilo, tam, passo) => linhas.forEach(x => { if (y + passo > FIM) { doc.addPage(); y = 18; } fonte(estilo, tam); doc.text(x, M, y + 4); y += passo; });
      escreve(t, 'bold', 11.5, 5.6); escreve(l, 'normal', 11, 5.2); y += 5;
    });
    doc.save(`CAPA DA PAUTA - ${fmtDate(d).replace(/\//g, '-')}.pdf`);
    toast('PDF baixado.');
  } catch (e) { console.error(e); toast('Erro ao gerar o PDF: ' + e.message, true); }
}

// =============================================================== CAPA DA PAUTA (escala do dia no modelo da emissora)
// Salva sozinha, por data, no login de quem preenche (com cópia no aparelho). O texto copiado usa *asteriscos*, o negrito do WhatsApp.
const CAPA_TIPOS = [['PAUTA', 'Pauta'], ['VT', 'Pauta VT'], ['LINK', 'Link'], ['ESPECIAL', 'Pauta para especiais']];
const CAPA_HOBS = ['saída da TV', 'no local'];
const CAPA_PESSOAS = [
  // campo, rótulo, funções do cadastro, perfis de acesso
  ['reporter', 'Repórter', ['Repórter'], ['reporter']],
  ['cinegrafista', 'Cinegrafista', ['Repórter cinematográfico'], []],
  ['motorista', 'Motorista', ['Motorista'], []],
  ['editor', 'Edição', ['Editor de imagens', 'Editor de texto'], ['editor_imagem', 'editor']],
];
const capaKey = (d) => `redacao:capa:${S.me.id}:${d}`;
const capaLer = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const capaGravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
// ---------- salvamento automático
// A cópia no aparelho é gravada a cada tecla; a do login (servidor) segue logo depois.
// "pendente" marca o que ainda não chegou ao servidor e será reenviado na próxima abertura.
const capaMem = {}, capaEspera = {};
let capaFila = Promise.resolve();
const capaLocal = (d) => capaMem[capaKey(d)] || capaLer(capaKey(d));
function capaGuardar(d, reg) {
  const k = capaKey(d);
  if (capaGravar(k, reg)) delete capaMem[k]; else capaMem[k] = reg;
}
const capaQuando = (at) => new Date(at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
function capaAviso(txt) { const el = $('.capa-modal .cp-aviso'); if (el) el.textContent = txt; }
function capaAgendar(d) {
  const dono = S.me.id, k = capaKey(d);
  clearTimeout(capaEspera[k]);
  capaEspera[k] = setTimeout(() => { capaFila = capaFila.then(() => capaEnviar(d, dono)); }, 800);
}
async function capaEnviar(d, dono) {
  if (!S.me || S.me.id !== dono) return;   // trocou de login: fica pendente para o dono
  const reg = capaLocal(d); if (!reg || !reg.pendente) return;
  try {
    await api('PUT', `/api/me/capas/${d}`, { at: reg.at, conteudo: reg.c });
    const atual = S.me && S.me.id === dono && capaLocal(d);
    if (atual && atual.at === reg.at) { capaGuardar(d, { ...atual, pendente: false }); capaAviso(`Salvo no seu login em ${capaQuando(reg.at)}.`); }
  } catch { capaAviso('Salvo só neste aparelho: ainda não foi possível salvar no seu login.'); }
}
// capa de uma data: vale a mais recente entre o aparelho e o login
async function capaRecuperar(d) {
  let remoto = null, falhou = false;
  try { remoto = await api('GET', `/api/me/capas/${d}`); } catch { falhou = true; }
  let local = capaLocal(d);
  const antiga = !local && capaLer(`redacao:capa:${d}`);   // salva antes de a capa ser por login
  if (antiga && antiga.itens) { local = { at: 0, pendente: true, c: antiga }; capaGuardar(d, local); try { localStorage.removeItem(`redacao:capa:${d}`); } catch { /* sem armazenamento */ } }
  if (remoto && remoto.conteudo && !(local && local.pendente && local.at >= remoto.at)) {
    local = { at: remoto.at, pendente: false, c: remoto.conteudo }; capaGuardar(d, local);
  } else if (local && local.pendente && !falhou) capaAgendar(d);
  return { reg: local, falhou };
}
// última data em que a pessoa mexeu (de hoje em diante), para reabrir onde parou
async function capaUltimaData() {
  let remota = null;
  try { remota = await api('GET', '/api/me/capas/ultima'); } catch { /* usa só o aparelho */ }
  return [remota, capaLer(capaKey('ultima'))].filter(u => u && u.data >= today()).sort((a, b) => b.at - a.at)[0]?.data;
}
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
const capaPreenchida = (i) => !!(i.titulo.trim() || i.numero.trim() || i.horario || i.local.trim() || CAPA_PESSOAS.some(([k]) => i[k]));
// "Pauta 4645" digitado no número não pode virar "Pauta Pauta 4645"
const capaNumero = (v) => v.trim().replace(/^((pauta|link|vt)\b\s*)+/i, '');
// o documento é uma lista de blocos; cada bloco tem título (negrito) e linhas. É o texto do WhatsApp.
function capaBlocos(c) {
  const linhas = (pares) => pares.filter(([, v]) => String(v || '').trim()).map(([r, v]) => `${r}: ${String(v).trim()}`);
  const blocos = [];
  c.itens.forEach(i => {
    if (!capaPreenchida(i)) return;
    const t = i.titulo.trim(), n = capaNumero(i.numero), h = capaHora(i.horario);
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
// ---------- documento visual: os mesmos dados na prévia, na impressão e no PDF
const CAPA_SELOS = { PAUTA: ['PAUTA', ''], VT: ['PAUTA VT', '#5b3fb5'], LINK: ['LINK', '#c8202f'], ESPECIAL: ['ESPECIAL', '#a85d00'] };
const CAPA_DESTAQUE = '#00b89c';   // verde-água do logotipo
function capaDados(d, c) {
  const [ano, mes, num] = d.split('-');
  const dia = weekday(d), nomeMes = new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'long' });
  const cartoes = c.itens.filter(capaPreenchida).map(i => {
    const [selo, cor] = CAPA_SELOS[i.tipo] || CAPA_SELOS.PAUTA;
    return { selo, cor, numero: capaNumero(i.numero), titulo: i.titulo.trim() || (i.tipo === 'LINK' ? 'Link' : 'Assunto a definir'),
      hora: capaHora(i.horario), ref: i.horario ? i.horarioObs : '', gravacao: capaHora(i.gravacao), local: i.local.trim(),
      equipe: CAPA_PESSOAS.map(([k, r]) => [r, String(i[k] || '').trim()]).filter(([, v]) => v) };
  });
  const links = c.itens.filter(i => capaPreenchida(i) && i.tipo === 'LINK').length, pautas = cartoes.length - links;
  const saida = c.itens.filter(i => i.horario && i.horarioObs === 'saída da TV').map(i => i.horario).sort()[0];
  const resumo = [
    pautas ? [String(pautas), pautas > 1 ? 'pautas' : 'pauta'] : null,
    links ? [String(links), links > 1 ? 'links' : 'link'] : null,
    saida ? [capaHora(saida), '1ª saída da TV'] : null,
  ].filter(Boolean);
  return { titulo: `${dia[0].toUpperCase()}${dia.slice(1)}, ${+num} de ${nomeMes}`, data: `${num}/${mes}/${ano}`, emissora: (S.org && S.org.name) || 'TV TEC Jundiaí', cartoes, resumo, obs: c.obs.trim() };
}
function capaHtml(d, c) {
  const x = capaDados(d, c);
  const cartao = (k) => `<article class="cpx-card" ${k.cor ? `style="--cor:${k.cor}"` : ''}>
    <div class="cpx-hora">${k.hora ? `<b>${esc(k.hora)}</b><span>${esc(k.ref)}</span>` : '<b>—</b><span>a definir</span>'}${k.gravacao ? `<em>Gravação<strong>${esc(k.gravacao)}</strong></em>` : ''}</div>
    <div class="cpx-corpo">
      <div class="cpx-linha"><span class="cpx-selo">${k.selo}</span>${k.numero ? `<span class="cpx-num">Nº ${esc(k.numero)}</span>` : ''}</div>
      <h4>${esc(k.titulo)}</h4>
      ${k.local ? `<div class="cpx-local"><small>Local</small>${esc(k.local)}</div>` : ''}
      ${k.equipe.length ? `<dl>${k.equipe.map(([r, v]) => `<div><dt>${r}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
    </div></article>`;
  return `<div class="doc cpx">
    <header class="cpx-topo"><div class="cpx-logo"><img src="${esc(orgLogo())}" alt="${esc(x.emissora)}"></div>
      <div><div class="cpx-chapeu">Capa da pauta</div><div class="cpx-dia">${esc(x.titulo)}</div><div class="cpx-sub">${esc(x.emissora)} · ${x.data}</div></div></header>
    ${x.resumo.length ? `<div class="cpx-resumo">${x.resumo.map(([v, r]) => `<span><b>${esc(v)}</b> ${r}</span>`).join('')}</div>` : ''}
    ${x.cartoes.map(cartao).join('') || '<p class="cpx-vazio">Preencha os campos para montar a capa.</p>'}
    ${x.obs ? `<section class="cpx-obs"><small>Observações</small><div>${esc(x.obs)}</div></section>` : ''}
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
    { wide: true, footer: '<span class="hint cp-aviso">Salva automaticamente no seu login.</span><button class="btn" data-close>Fechar</button><button class="btn" id="capa-print" disabled>Imprimir</button><button class="btn" id="capa-pdf" disabled>Baixar PDF</button><button class="btn primary" id="capa-copiar" disabled>Copiar para WhatsApp</button>' });
  md.el.classList.add('ficha-modal', 'capa-modal'); if (document.activeElement) document.activeElement.blur();
  const data = $('#capa-data', md.el), campos = $('#capa-campos', md.el);
  let c = null, dia = amanha, doSistema = [], seq = 0;
  const botoes = () => $$('#capa-print, #capa-pdf, #capa-copiar', md.el).forEach(b => { b.disabled = !c; });
  const previa = () => { $('#capa-doc', md.el).innerHTML = c ? capaHtml(dia, c) : ''; };
  const salvar = () => {
    const at = Date.now();
    capaGuardar(dia, { at, pendente: true, c }); capaGravar(capaKey('ultima'), { at, data: dia });
    capaAviso('Salvando…'); capaAgendar(dia); previa();
  };

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
  campos.oninput = (e) => {
    const t = e.target;
    if (t.dataset.novo) { if (c) { c.itens[+t.dataset.i][t.dataset.novo] = t.value.trim(); salvar(); } return; }   // nome manual: salva já ao digitar
    if (t.tagName !== 'SELECT' && mudar(t)) salvar();
  };
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
    const { reg, falhou } = await capaRecuperar(d);
    if (meu !== seq) return;
    dia = d; doSistema = lista.sort((a, b) => (a.horario || '99').localeCompare(b.horario || '99') || a.retranca.localeCompare(b.retranca));
    c = reg ? reg.c : { itens: doSistema.filter(p => p.status !== 'caiu').map(capaDePauta), obs: '' };
    capaAviso(falhou ? 'Sem acesso ao que está salvo no seu login: usando a cópia deste aparelho.'
      : reg && reg.at ? `Capa recuperada. Última alteração em ${capaQuando(reg.at)}.` : 'Salva automaticamente no seu login.');
    botoes(); desenhar(); previa();
  };
  data.onchange = () => carregar();
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
  campos.innerHTML = '<p class="hint">Carregando…</p>';
  capaUltimaData().then(u => { if (seq || !md.el.isConnected) return; if (u) data.value = u; carregar(); });   // seq > 0: a pessoa já escolheu a data
}
async function capaPdf(d, c, brandHex) {
  toast('Gerando PDF…');
  try { if (!window.jspdf) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'); }
  catch { return toast('Não foi possível carregar o gerador de PDF. Verifique a internet ou use Imprimir → Salvar como PDF.', true); }
  try {
    const x = capaDados(d, c);
    const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', compress: true });
    doc.setProperties({ title: capaCabecalho(d), author: x.emissora, creator: 'Redação' });
    capaDesenhar(doc, x, await pdfLogo(orgLogo()), brandHex);
    doc.save(`CAPA DA PAUTA - ${fmtDate(d).replace(/\//g, '-')}.pdf`);
    toast('PDF baixado.');
  } catch (e) { console.error(e); toast('Erro ao gerar o PDF: ' + e.message, true); }
}
function capaDesenhar(doc, x, logo, brandHex) {
  const W = 210, M = 12, CW = W - 2 * M, FIM = 281, TW = 31;
  const rgb = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const B = rgb(brandHex), T = rgb(CAPA_DESTAQUE), CINZA = [100, 112, 130], TEXTO = [22, 27, 36], LINHA = [218, 224, 233];
  const suave = (cor, p) => cor.map(v => Math.round(255 - (255 - v) * p));
  const fundo = (cor) => doc.setFillColor(...cor);
  const escreve = (t, px, py, tam, cor, estilo = 'normal', opc) => { doc.setFont('helvetica', estilo); doc.setFontSize(tam); doc.setTextColor(...cor); doc.text(t, px, py, opc); };
  const quebra = (t, larg, tam, estilo = 'normal') => { doc.setFont('helvetica', estilo); doc.setFontSize(tam); return doc.splitTextToSize(pdfSafe(t), larg); };
  const largura = (t, tam, estilo) => { doc.setFont('helvetica', estilo); doc.setFontSize(tam); return doc.getTextWidth(t); };

  // cabeçalho
  fundo(B); doc.rect(0, 0, W, 38, 'F'); fundo(T); doc.rect(0, 38, W, 1.8, 'F');
  let tx = M;
  if (logo) {
    fundo([255, 255, 255]); doc.roundedRect(M, 7, 34, 24, 3, 3, 'F');
    const s = Math.min(28 / logo.w, 19 / logo.h), lw = logo.w * s, lh = logo.h * s;
    doc.addImage(logo.data, logo.fmt, M + (34 - lw) / 2, 7 + (24 - lh) / 2, lw, lh, undefined, 'FAST');
    tx = M + 41;
  }
  escreve('CAPA DA PAUTA', tx, 13.5, 9, T, 'bold', { charSpace: 0.8 });
  let tam = 22; while (tam > 14 && largura(pdfSafe(x.titulo), tam, 'bold') > W - M - tx) tam -= 1;
  escreve(pdfSafe(x.titulo), tx, 23, tam, [255, 255, 255], 'bold');
  escreve(pdfSafe(`${x.emissora}  ·  ${x.data}`), tx, 30, 9.5, suave(B, 0.25));
  let y = 45;

  // resumo do dia
  let rx = M;
  x.resumo.forEach(([v, r]) => {
    const a = largura(v, 11, 'bold'), b = largura(r, 8.5, 'normal'), w = a + b + 9;
    fundo(suave(B, 0.07)); doc.roundedRect(rx, y, w, 8.4, 4.2, 4.2, 'F');
    escreve(v, rx + 3.5, y + 5.8, 11, B, 'bold'); escreve(r, rx + 5.3 + a, y + 5.7, 8.5, CINZA);
    rx += w + 3;
  });
  if (x.resumo.length) y += 13;

  const novaPagina = () => {
    doc.addPage(); fundo(B); doc.rect(0, 0, W, 11, 'F'); fundo(T); doc.rect(0, 11, W, 0.9, 'F');
    escreve('CAPA DA PAUTA', M, 7.2, 8.5, [255, 255, 255], 'bold', { charSpace: 0.6 });
    escreve(pdfSafe(x.titulo), W - M, 7.2, 8.5, [255, 255, 255], 'normal', { align: 'right' });
    y = 17;
  };

  // um cartão por pauta: horário à esquerda, assunto, local e equipe à direita
  x.cartoes.forEach(k => {
    const cor = k.cor ? rgb(k.cor) : B, ix = M + TW + 5, iw = CW - TW - 9;
    const titulo = quebra(k.titulo, iw, 13, 'bold');
    const rotulo = largura('LOCAL', 6.8, 'bold') + 3;
    const local = k.local ? quebra(k.local, iw - rotulo, 9.5) : [];
    const col = iw / 4;
    const equipe = k.equipe.map(([r, v]) => [r.toUpperCase(), quebra(v, col - 3, 9.5, 'bold')]);
    const altEquipe = equipe.length ? 8.5 + Math.max(...equipe.map(e => e[1].length)) * 4.3 : 0;
    const alt = Math.max(11 + titulo.length * 5.5 + local.length * 4.5 + altEquipe + 3, k.gravacao ? 31 : 24);
    if (y + alt > FIM) novaPagina();
    fundo(suave(cor, 0.08)); doc.roundedRect(M, y, TW + 3, alt, 2.5, 2.5, 'F');
    fundo([255, 255, 255]); doc.rect(M + TW, y, 3.2, alt, 'F');
    doc.setDrawColor(...LINHA); doc.setLineWidth(0.3); doc.roundedRect(M, y, CW, alt, 2.5, 2.5, 'S');
    fundo(cor); doc.rect(M, y + 2.5, 1.8, alt - 5, 'F');
    const meio = M + TW / 2 + 0.8;
    escreve(k.hora || '--', meio, y + 11, 18, cor, 'bold', { align: 'center' });
    escreve(pdfSafe(k.hora ? k.ref : 'a definir'), meio, y + 16, 7.5, CINZA, 'normal', { align: 'center' });
    if (k.gravacao) {
      escreve('GRAVAÇÃO', meio, y + 22.5, 6.3, CINZA, 'bold', { align: 'center' });
      escreve(k.gravacao, meio, y + 27.5, 11, TEXTO, 'bold', { align: 'center' });
    }
    const sw = largura(k.selo, 7.2, 'bold') + 5;
    fundo(cor); doc.roundedRect(ix, y + 3.4, sw, 4.8, 1.2, 1.2, 'F');
    escreve(k.selo, ix + 2.5, y + 6.8, 7.2, [255, 255, 255], 'bold');
    if (k.numero) escreve(pdfSafe(`Nº ${k.numero}`), ix + sw + 3, y + 6.9, 8.5, CINZA, 'bold');
    let cy = y + 13.6;
    titulo.forEach(l => { escreve(l, ix, cy, 13, TEXTO, 'bold'); cy += 5.5; });
    if (local.length) {
      escreve('LOCAL', ix, cy, 6.8, CINZA, 'bold');
      local.forEach(l => { escreve(l, ix + rotulo, cy, 9.5, TEXTO); cy += 4.5; });
    }
    if (equipe.length) {
      doc.setDrawColor(...LINHA); doc.setLineWidth(0.2); doc.line(ix, cy - 1.3, M + CW - 4, cy - 1.3);
      equipe.forEach(([r, linhas], n) => {
        const ex = ix + n * col;
        escreve(pdfSafe(r), ex, cy + 2.8, 6.5, CINZA, 'bold');
        linhas.forEach((l, j) => escreve(l, ex, cy + 7.2 + j * 4.3, 9.5, TEXTO, 'bold'));
      });
    }
    y += alt + 3.5;
  });
  if (!x.cartoes.length) { escreve('Nenhuma pauta preenchida.', M, y + 6, 11, CINZA); y += 12; }

  // observações (continua na página seguinte se for longa)
  let resto = x.obs ? quebra(x.obs, CW - 12, 10) : [];
  while (resto.length) {
    if (y + 17 > FIM) novaPagina();
    const parte = resto.slice(0, Math.max(1, Math.floor((FIM - y - 11) / 4.8))); resto = resto.slice(parte.length);
    const alt = 11 + parte.length * 4.8;
    fundo(suave(T, 0.1)); doc.roundedRect(M, y, CW, alt, 2.5, 2.5, 'F'); fundo(T); doc.rect(M, y + 2.5, 1.8, alt - 5, 'F');
    escreve('OBSERVAÇÕES', M + 6, y + 6, 7, B, 'bold', { charSpace: 0.5 });
    parte.forEach((l, j) => escreve(l, M + 6, y + 11.5 + j * 4.8, 10, TEXTO));
    y += alt + 3.5;
  }

  // rodapé
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p); doc.setDrawColor(...LINHA); doc.setLineWidth(0.3); doc.line(M, 286, W - M, 286);
    escreve(pdfSafe(`${x.emissora}  ·  Redação`), M, 290.5, 7.5, CINZA);
    escreve(`Página ${p} de ${total}`, W - M, 290.5, 7.5, CINZA, 'normal', { align: 'right' });
  }
}

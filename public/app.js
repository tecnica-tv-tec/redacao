/* Redação — cliente SPA (sem frameworks) */
'use strict';

// =============================================================== utilidades
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const fmtDate = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const weekday = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' });
const fmtDT = (iso) => iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
const initials = (n) => String(n || '?').split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();

function toSec(v) {
  if (v == null || v === '') return 0;
  const s = String(v).trim();
  if (/^\d+$/.test(s)) return Number(s);
  const parts = s.split(':').map(Number);
  if (parts.some(isNaN)) return 0;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}
function fmtDur(sec, hours = false) {
  const neg = sec < 0; sec = Math.abs(Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const pad = (n) => String(n).padStart(2, '0');
  const out = (hours || h) ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  return (neg ? '-' : '') + out;
}
function fmtClock(sec) {
  sec = ((Math.round(sec) % 86400) + 86400) % 86400;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(Math.floor(sec / 3600))}:${pad(Math.floor(sec % 3600 / 60))}:${pad(sec % 60)}`;
}
// Tempo de leitura: ignora instruções entre colchetes [ ] (como no iNews)
function wordCount(text) {
  return String(text || '').replace(/\[[^\]]*\]/g, ' ').split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
}
const readSec = (text, wpm) => Math.round(wordCount(text) * 60 / (wpm || 170));

// Modo de dados: Supabase (produção SaaS) ou servidor local (demonstração)
const CFG = window.REDACAO_CONFIG || {};
const SUPA_MODE = !!(CFG.supabaseUrl && CFG.supabaseAnonKey);
let SUPA = null;
function loadScript(src) { return new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ko(new Error('Falha ao carregar ' + src)); document.head.appendChild(s); }); }
async function initSupabase() {
  if (!SUPA_MODE || SUPA) return;
  await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js');
  const client = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  SUPA = window.createSupabaseAdapter(client);
  client.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') setTimeout(recoverPassword, 300); });
}
function recoverPassword() {
  const md = modal('Definir nova senha', `<form id="rcf"><div class="field"><label>Nova senha (mín. 8 caracteres)</label><input type="password" name="password" minlength="8" required autocomplete="new-password"></div><div class="err" id="rcerr"></div><button class="btn primary">Salvar senha</button></form>`);
  $('#rcf', md.el).onsubmit = async (e) => {
    e.preventDefault();
    try { await api('POST', '/api/auth/recover', Object.fromEntries(new FormData(e.target))); md.close(); toast('Senha definida.'); boot(); }
    catch (er) { $('#rcerr', md.el).textContent = er.message; }
  };
}
async function api(method, url, body) {
  if (SUPA_MODE) {
    await initSupabase();
    try { return await SUPA.request(method, url, body); }
    catch (e) {
      if (e.status === 401 && url !== '/api/me' && !url.startsWith('/api/auth/')) { S.me = null; renderLogin(); }
      throw e;
    }
  }
  const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
  let data = null; try { data = await r.json(); } catch { /* vazio */ }
  if (r.status === 401 && url !== '/api/me' && url !== '/api/auth/login') { S.me = null; renderLogin(); throw new Error('Sessão expirada.'); }
  if (!r.ok) { const e = new Error((data && data.error) || 'Erro de comunicação.'); e.status = r.status; throw e; }
  return data;
}
function toast(msg, isErr) {
  const t = document.createElement('div'); t.className = 't' + (isErr ? ' e' : ''); t.textContent = msg;
  $('#toast').appendChild(t); setTimeout(() => t.remove(), isErr ? 5000 : 2600);
}
function modal(title, bodyHtml, { wide, footer } = {}) {
  const bg = document.createElement('div'); bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true"><div class="modal-h"><h3>${esc(title)}</h3><button class="x" data-close aria-label="Fechar">×</button></div><div class="modal-b">${bodyHtml}</div>${footer ? `<div class="modal-f">${footer}</div>` : ''}</div>`;
  const close = () => bg.remove();
  bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('[data-close]')) close(); });
  document.body.appendChild(bg);
  const f = bg.querySelector('input,select,textarea'); if (f) f.focus();
  return { el: bg, close };
}

// =============================================================== constantes do domínio
const EDITORIAS = ['Geral', 'Cidade', 'Política', 'Economia', 'Polícia', 'Segurança','Saúde', 'Educação', 'Esporte', 'Cultura', 'Tempo', 'Trânsito', 'Nacional', 'Internacional', 'Serviço', 'Comunidade'];
const PAUTA_STATUS = [
  ['sugestao', 'Sugestão'], ['em_apuracao', 'Em apuração'], ['em_producao', 'Em produção'], ['pronta', 'Pronta p/ gravar'],
  ['gravada', 'Gravada'], ['exibida', 'Exibida'], ['caiu', 'Caiu'],
];
const MATERIA_STATUS = [['', 'Não iniciada'], ['rascunho', 'Em redação'], ['enviada', 'Enviada p/ edição'], ['revisada', 'Revisada'], ['aprovada', 'Aprovada']];
// palavras e tempo estimado de narração (ignora marcações entre colchetes)
function materiaStats(text) {
  const w = wordCount(text);
  return w ? `${w} palavras · ~${fmtDur(Math.round(w * 60 / 170))}` : '';
}
const MAT_CLASS = { rascunho: 'em_apuracao', enviada: 'em_producao', revisada: 'pronta', aprovada: 'gravada' };
const materiaPill = (p) => String(p.materia || '').trim()
  ? `<span class="pill st-${MAT_CLASS[p.materiaStatus] || 'em_apuracao'}" title="${wordCount(p.materia)} palavras">✎ ${esc(label(MATERIA_STATUS, p.materiaStatus || 'rascunho'))}</span>`
  : '<span class="hint">—</span>';
const MOTIVOS_QUEDA = ['Entrevistado desmarcou', 'Fato perdeu relevância', 'Equipe deslocada para factual', 'Sem autorização de imagem', 'Clima / chuva', 'Falta de equipe ou carro', 'Pauta derrubada pela chefia'];
const LICENCAS = [['leitura', 'Leitura'], ['edicao', 'Edição'], ['geral', 'Geral']];
const isMobile = () => window.matchMedia('(max-width: 760px)').matches;
// logotipo da emissora: o cadastrado em Equipe → Identidade; sem cadastro, o arquivo padrão do site
const orgLogo = () => (S.org && S.org.logo) || 'logo-ftvtec.png';
const PRIORIDADES = [['baixa', 'Baixa'], ['normal', 'Normal'], ['alta', 'Alta'], ['urgente', 'Urgente']];
const FORMATOS = ['VT', 'NC', 'NOTA', 'NP', 'LINK', 'SONORA', 'STAND-UP', 'ENTREVISTA', 'SÉRIE', 'ARTE'];
const TIPOS = ['ESCALADA', 'VINHETA', 'CABEÇA', 'NOTA', 'NC', 'NP', 'VT', 'VT+NP', 'SONORA', 'LINK', 'VIVO', 'STAND-UP', 'ENTREVISTA', 'ENTREVISTA ESTÚDIO', 'ARTE', 'CHAMADA', 'PASSAGEM', 'ENCERRAMENTO', 'INTERVALO'];
const ITEM_STATUS = [['rascunho', 'Rascunho'], ['em_edicao', 'Em edição'], ['pronto', 'Pronto'], ['aprovado', 'Aprovado'], ['caiu', 'Caiu']];
const RD_STATUS = [['aberto', 'ABERTO'], ['fechado', 'FECHADO'], ['no_ar', 'NO AR'], ['encerrado', 'ENCERRADO']];
const label = (list, v) => (list.find(x => x[0] === v) || [v, v])[1];
const opts = (list, sel) => list.map(x => Array.isArray(x) ? `<option value="${esc(x[0])}" ${x[0] === sel ? 'selected' : ''}>${esc(x[1])}</option>` : `<option ${x === sel ? 'selected' : ''}>${esc(x)}</option>`).join('');
// tipos lidos integralmente pelo apresentador (texto também conta tempo)
const READ_TYPES = ['NOTA', 'NC', 'NP', 'CABEÇA', 'ESCALADA', 'ENCERRAMENTO', 'CHAMADA', 'PASSAGEM'];

// =============================================================== estado
const S = {
  me: null, org: null, perms: {}, roles: [], users: [], programs: [],
  view: 'pautas',
  pf: { date: today(), allDates: false, status: '', editoria: '', programaId: '', q: '', mine: false },
  pautas: [], pauta: null, pautaDirty: false,
  rd: { programId: '', date: today() }, rundown: null, selItem: null, itemDirty: false, itemSaveTimer: null,
  pollTimer: null, lockTimer: null,
};
const userName = (id) => { const u = S.users.find(u => u.id === id); return u ? u.name : ''; };
// repórter da pauta: usuário do sistema ou nome digitado
const repName = (p) => userName(p.reporterId) || p.reporterNome || '';
const prodName = (p) => userName(p.produtorId) || p.produtorNome || '';
const CARGO_DIRETOR = 'Diretor de Produção e Multimídia';
const FUNCOES = [CARGO_DIRETOR, 'Chefe de reportagem', 'Produtor', 'Repórter', 'Repórter cinematográfico', 'Motorista', 'Editor de texto', 'Editor de imagens', 'Apresentador', 'Estagiário'];
// funcionários cadastrados (inclui os nomes do cadastro antigo de cinegrafistas e motoristas)
function funcionarios() {
  const o = S.org || {}, lista = (o.funcionarios || []).map(f => ({ nome: f.nome, funcao: f.funcao }));
  const tem = (n, fn) => lista.some(f => f.nome === n && f.funcao === fn);
  (o.cinegrafistas || []).forEach(n => { if (!tem(n, 'Repórter cinematográfico')) lista.push({ nome: n, funcao: 'Repórter cinematográfico' }); });
  (o.motoristas || []).forEach(n => { if (!tem(n, 'Motorista')) lista.push({ nome: n, funcao: 'Motorista' }); });
  return lista;
}

// =============================================================== login
function renderLogin(mode = 'login') {
  stopPolling();
  const isLogin = mode === 'login';
  const ico = {
    mail: '<path d="M3 6.5h18v11H3z"/><path d="m3.5 7 8.5 6.5L20.5 7"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.8 3.7-5.5 7-5.5s6.2 1.7 7 5.5"/>',
    tv: '<rect x="3" y="6.5" width="18" height="13" rx="2"/><path d="m8 3 4 3.5L16 3"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.500 12 21.5 12 18 18.5 12 18.5 2.500 12 2.500 12Z"/><circle cx="12" cy="12" r="2.800"/>',
  };
  const svg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ico[k]}</svg>`;
  const DOM = SUPA_MODE ? (CFG.dominioEmail || '') : '';
  const field = (id, name, label, type, icon, attrs, extra = '') => `
    <div class="lg-field"><label for="${id}">${label}</label>
      <div class="lg-input">${svg(icon)}<input type="${type}" id="${id}" name="${name}" ${attrs}>${type === 'password' ? `<button type="button" class="lg-eye" aria-label="Mostrar senha" aria-pressed="false">${svg('eye')}</button>` : ''}</div>${extra}</div>`;
  $('#app').innerHTML = `
  <div class="lg">
    <aside class="lg-stage" aria-hidden="true">
      <svg class="lg-rings" viewBox="0 0 600 600">
        <circle class="r1" cx="300" cy="300" r="280"/><circle class="r2" cx="300" cy="300" r="215"/><circle class="r3" cx="300" cy="300" r="150"/>
      </svg>
      <div class="lg-stage-in">
        <span class="lg-kicker">Departamento de Jornalismo</span>
        <h2>Central de Produção Jornalística</h2>
        <p>Apuração, reportagem, edição e exibição do telejornal em um fluxo integrado.</p>
      </div>
      <div class="lg-base">
        <ol class="lg-flow">${['Pauta', 'Reportagem', 'Edição', 'Exibição'].map((s, i) => `<li><span>0${i + 1}</span>${s}</li>`).join('')}</ol>
        <div class="lg-now"><span id="lg-date"></span><b id="lg-clock"></b></div>
      </div>
    </aside>
    <main class="lg-panel">
      <div class="lg-card">
        <img class="lg-logo" src="logo-ftvtec.png" alt="FTV Tec" width="436" height="176">
        <h1>${isLogin ? 'Acesso à redação' : (SUPA_MODE ? 'Criar conta' : 'Cadastro da emissora')}</h1>
        <p class="lg-sub">${isLogin ? 'Identifique-se com suas credenciais de equipe.' : (SUPA_MODE ? 'Solicite seu acesso à redação.' : 'Registre a emissora e a conta de administração.')}</p>
        <div class="lg-tabs" data-on="${mode}"><button type="button" data-mode="login" class="${isLogin ? 'on' : ''}">Entrar</button><button type="button" data-mode="signup" class="${isLogin ? '' : 'on'}">Criar conta</button></div>
        <form id="authf" autocomplete="on">
          ${isLogin ? '' : (SUPA_MODE ? '' : field('f-org', 'orgName', 'Emissora / Redação', 'text', 'tv', 'required placeholder="Ex.: TV TEC Jundiaí"'))
            + field('f-name', 'name', 'Seu nome', 'text', 'user', 'required autocomplete="name" placeholder="Nome e sobrenome"')}
          ${field('f-email', 'email', 'E-mail profissional', 'email', 'mail', `required autocomplete="username" placeholder="voce@${DOM || 'emissora.com.br'}"`, !isLogin && DOM ? `<span class="lg-help">Somente e-mail corporativo @${DOM}.</span>` : '')}
          ${field('f-pass', 'password', 'Senha', 'password', 'lock', `required minlength="${isLogin ? 1 : 8}" autocomplete="${isLogin ? 'current-password' : 'new-password'}" placeholder="${isLogin ? 'Sua senha' : 'Mínimo de 8 caracteres'}"`)}
          ${SUPA_MODE && isLogin ? '<div class="lg-forgot"><a href="#" id="forgot">Esqueci minha senha</a></div>' : ''}
          <div class="err" id="autherr" role="alert"></div>
          <button class="lg-submit" type="submit"><span>${isLogin ? 'Entrar' : 'Criar conta'}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></button>
        </form>
        <div class="lg-or"><span>ou</span></div>
        <button type="button" class="lg-google" id="lg-google"><svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg><span>${isLogin ? 'Entrar' : 'Cadastrar'} com Google</span></button>
        ${isLogin ? '' : `<p class="lg-note">${SUPA_MODE ? 'Sem convite, o acesso é liberado por um administrador da redação.' : 'A primeira conta vira administradora e pode convidar a equipe.'}</p>`}
      </div>
      <footer class="lg-foot">© ${new Date().getFullYear()} FTV Tec · Uso exclusivo da equipe</footer>
    </main>
  </div>`;
  const tick = () => {
    const c = $('#lg-clock'); if (!c) return clearInterval(S.lgTimer);
    const n = new Date(); c.textContent = n.toLocaleTimeString('pt-BR');
    $('#lg-date').textContent = n.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };
  clearInterval(S.lgTimer); tick(); S.lgTimer = setInterval(tick, 1000);
  $$('.lg-tabs button').forEach(b => b.onclick = () => { if (b.dataset.mode !== mode) renderLogin(b.dataset.mode); });
  const eye = $('.lg-eye'); eye.onclick = () => {
    const i = $('#f-pass'), show = i.type === 'password'; i.type = show ? 'text' : 'password';
    eye.setAttribute('aria-pressed', show); eye.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
  };
  const msg = (text, ok) => { const e = $('#autherr'); if (e) { e.classList.toggle('ok', !!ok); e.textContent = text; } };
  $('#authf').onsubmit = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    const btn = $('.lg-submit'); btn.disabled = true; btn.classList.add('busy'); msg('');
    try {
      const r = await api('POST', isLogin ? '/api/auth/login' : '/api/auth/signup', body);
      if (r && r.confirm) { msg('Conta criada! Confirme o e-mail que enviamos e depois entre.', true); return; }
      await boot();
    }
    catch (er) { msg(er.message); }
    finally { btn.disabled = false; btn.classList.remove('busy'); }
  };
  $('#lg-google').onclick = async (e) => {
    if (!SUPA_MODE) return msg('O acesso com Google funciona apenas na versão publicada.');
    const b = e.currentTarget; b.disabled = true; msg('');
    try { await api('POST', '/api/auth/google'); } catch (er) { msg(er.message); b.disabled = false; }
  };
  if (S.loginMsg) { msg(S.loginMsg); S.loginMsg = ''; }
  const fg = $('#forgot'); if (fg) fg.onclick = async (e) => {
    e.preventDefault();
    const email = $('#f-email').value.trim();
    if (!email) { msg('Digite seu e-mail acima e clique novamente.'); $('#f-email').focus(); return; }
    try { await api('POST', '/api/auth/forgot', { email }); msg('Enviamos um link para redefinir a senha.', true); }
    catch (er) { msg(er.message); }
  };
}
// =============================================================== shell
async function boot() {
  try {
    const me = await api('GET', '/api/me');
    S.me = me.user; S.org = me.org; S.perms = me.perms; S.roles = me.roles;
  } catch (e) { if (e.status !== 401 && e.message) S.loginMsg = e.message; return renderLogin(); }
  [S.users, S.programs] = await Promise.all([api('GET', '/api/users'), api('GET', '/api/programs')]);
  if (!S.rd.programId && S.programs.length) S.rd.programId = S.programs[0].id;
  renderShell();
  go((location.hash || (S.me.role === 'editor_imagem' ? '#edicao' : '#pautas')).slice(1));
}
function renderShell() {
  const nav = [['pautas', 'Pautas'], ['materias', 'Matérias'], ['edicao', 'Edição'], ['calendario', 'Calendário'], ['espelho', 'Espelho'], ['busca', 'Busca'], ['relatorios', 'Relatórios'], ['programas', 'Telejornais'], ['equipe', 'Equipe'], ['log', 'Atividade']];
  $('#app').innerHTML = `
  <div class="shell ${S.perms.edit ? '' : 'lic-leitura'}">
    <header class="topbar">
      <div class="brand"><span class="dot"></span> REDAÇÃO TVTEC JUNDIAÍ</div>
      <nav class="nav">${nav.filter(([k]) => k !== 'espelho' || S.perms.rundown).map(([k, l]) => `<button data-go="${k}">${l}</button>`).join('')}</nav>
      <div class="spacer"></div>
      <form id="gsearch-f" class="gsearch" role="search"><input type="search" id="gsearch" placeholder="Buscar pautas e matérias…" aria-label="Buscar pautas e matérias"></form>
      <span class="org">${esc(S.org.name)}</span>
      <span class="clock" id="clock">--:--:--</span>
      <div class="userchip" id="userchip"><span class="avatar">${esc(initials(S.me.name))}</span><span>${esc(S.me.name.split(' ')[0])}</span></div>
    </header>
    <main class="main" id="main"></main>
  </div>`;
  $$('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
  $('#userchip').onclick = userMenu;
  $('#gsearch-f').onsubmit = (e) => {
    e.preventDefault(); const v = $('#gsearch').value.trim(); if (!v) return;
    S.bq = { q: v, from: '', to: '', status: '', reporterId: '', comMateria: false }; $('#gsearch').value = '';
    if (S.view === 'busca') viewBusca(); else go('busca');
  };
  const tick = () => { const c = $('#clock'); if (c) c.textContent = new Date().toLocaleTimeString('pt-BR'); };
  tick(); clearInterval(S.clockTimer); S.clockTimer = setInterval(tick, 1000);
}
function userMenu() {
  const old = $('.menu'); if (old) return old.remove();
  const m = document.createElement('div'); m.className = 'menu';
  m.innerHTML = `<div class="who"><b>${esc(S.me.name)}</b><div class="hint">${esc(S.me.email)} · ${esc(S.me.roleLabel)}</div><div class="hint">Licença: <b>${esc(label(LICENCAS, S.perms.licenca))}</b></div></div>
    <button data-a="pw">Alterar senha</button><button data-a="out">Sair</button>`;
  document.body.appendChild(m);
  const off = (e) => { if (!m.contains(e.target) && !e.target.closest('#userchip')) { m.remove(); document.removeEventListener('click', off); } };
  setTimeout(() => document.addEventListener('click', off));
  m.onclick = async (e) => {
    const a = e.target.dataset.a; if (!a) return; m.remove();
    if (a === 'out') { await releaseLocks(); await api('POST', '/api/auth/logout'); S.me = null; renderLogin(); }
    if (a === 'pw') changePassword();
  };
}
function changePassword() {
  const md = modal('Alterar senha', `<form id="pwf">
    <div class="field"><label>Senha atual</label><input type="password" name="current" required autocomplete="current-password"></div>
    <div class="field"><label>Nova senha (mín. 8 caracteres)</label><input type="password" name="password" required minlength="8" autocomplete="new-password"></div>
    <div class="err" id="pwerr"></div><button class="btn primary">Salvar</button></form>`);
  $('#pwf', md.el).onsubmit = async (e) => {
    e.preventDefault();
    try { await api('PUT', '/api/me/password', Object.fromEntries(new FormData(e.target))); md.close(); toast('Senha alterada.'); }
    catch (er) { $('#pwerr', md.el).textContent = er.message; }
  };
}

async function go(view) {
  if (!['pautas', 'materias', 'edicao', 'calendario', 'espelho', 'busca', 'relatorios', 'programas', 'equipe', 'log'].includes(view)) view = 'pautas';
  if (S.view !== view) {
    if (S.pautaDirty && !(await autosavePauta()) && !confirm('A pauta ainda não pôde ser salva no sistema (veja o aviso ao lado de Salvar). Ela fica guardada como rascunho neste navegador. Sair mesmo assim?')) return;
    clearTimeout(S.pAutoTimer);
    if (S.matDirty && !(await saveMateria()) && !confirm('Não foi possível salvar a matéria. Sair mesmo assim?')) return;
    S.matDirty = false; clearTimeout(S.matTimer);
    await flushItem();
    await releaseLocks();
    S.pautaDirty = false;
  }
  if (view === 'espelho' && !S.perms.rundown) { view = 'pautas'; toast('O espelho exige a licença Geral. Fale com o administrador.', true); }
  S.view = view; history.replaceState(null, '', '#' + view);
  $$('[data-go]').forEach(b => b.classList.toggle('on', b.dataset.go === view));
  stopPolling();
  ({ pautas: viewPautas, materias: viewMaterias, edicao: viewEdicao, calendario: viewCalendario, espelho: viewEspelho, busca: viewBusca, relatorios: viewRelatorios, programas: viewProgramas, equipe: viewEquipe, log: viewLog })[view]();
}
window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (S.me && v && v !== S.view) go(v); });
function stopPolling() { clearInterval(S.pollTimer); S.pollTimer = null; }

// travas
const heldLocks = new Set();
async function acquireLock(key) {
  try {
    const r = await api('POST', '/api/locks/' + key);
    if (r.ok) { heldLocks.add(key); return { ok: true }; }
    return r;
  } catch { return { ok: true }; }
}
async function releaseLocks() {
  const keys = [...heldLocks]; heldLocks.clear();
  await Promise.all(keys.map(k => api('DELETE', '/api/locks/' + k).catch(() => {})));
}
// renova travas ativas
setInterval(() => { heldLocks.forEach(k => api('POST', '/api/locks/' + k).catch(() => {})); }, 30000);
window.addEventListener('beforeunload', (e) => {
  if (S.pautaDirty) saveDraft();   // garante o rascunho mesmo se a pessoa fechar a aba
  if (S.pautaDirty || S.itemDirty || S.matDirty) { e.preventDefault(); e.returnValue = ''; }
});

// =============================================================== PAUTAS
async function loadPautas() {
  const f = S.pf; const q = new URLSearchParams();
  if (!f.allDates) { q.set('from', f.date); q.set('to', f.date); }
  ['status', 'editoria', 'programaId', 'q'].forEach(k => f[k] && q.set(k, f[k]));
  if (f.mine) q.set('mine', '1');
  S.pautas = await api('GET', '/api/pautas?' + q);
}
async function viewPautas() {
  $('#main').innerHTML = `
  <div class="workspace ws-pautas">
    <aside class="pane"><div class="pane-h"><h2>Filtros</h2></div>
      <div class="pane-b pad filters">
        <div class="field"><label>Data</label>
          <div class="datenav"><button class="btn sm" data-d="-1" aria-label="Dia anterior">‹</button><input type="date" id="pf-date" value="${S.pf.date}"><button class="btn sm" data-d="1" aria-label="Próximo dia">›</button></div>
          <label class="check" style="margin-top:6px"><input type="checkbox" id="pf-all" ${S.pf.allDates ? 'checked' : ''}> Todas as datas</label>
          <button class="btn sm" id="pf-today" style="margin-top:6px">Hoje</button>
        </div>
        <div class="field"><label>Buscar</label><input type="search" id="pf-q" value="${esc(S.pf.q)}" placeholder="Retranca, matéria, entrevistado…"></div>
        <div class="field"><label>Status</label><select id="pf-status"><option value="">Todos</option>${opts(PAUTA_STATUS, S.pf.status)}</select></div>
        <div class="field"><label>Editoria</label><select id="pf-editoria"><option value="">Todas</option>${opts(EDITORIAS, S.pf.editoria)}</select></div>
        <div class="field"><label>Telejornal</label><select id="pf-prog"><option value="">Todos</option>${opts(S.programs.map(p => [p.id, p.name]), S.pf.programaId)}</select></div>
        <label class="check"><input type="checkbox" id="pf-mine" ${S.pf.mine ? 'checked' : ''}> Somente minhas pautas</label>
        <hr style="border-color:var(--line);margin:14px 0">
        <div class="hint" id="pf-count"></div>
      </div>
    </aside>
    <section class="pane"><div class="pane-h"><img class="ph-logo" src="${esc(orgLogo())}" alt="${esc((S.org && S.org.name) || '')}"><h2>Pautas</h2><span class="hint" id="pf-label"></span><div style="flex:1"></div>
        <button class="btn sm mob-only" id="pf-toggle" aria-expanded="false">Filtros</button>
        <button class="btn sm" id="pf-capa" title="Cronograma das pautas do dia seguinte">🗒 Capa da pauta</button>
        <button class="btn sm" id="pf-print">Imprimir lista</button><button class="btn primary sm" id="pf-new">+ Nova pauta</button></div>
      <div class="pane-b" id="pauta-list"></div></section>
    <section class="pane editor" id="pauta-editor"></section>
  </div>`;
  const reload = async () => { await loadPautas(); renderPautaList(); };
  const set = (k, v) => { S.pf[k] = v; reload(); };
  $('#pf-date').onchange = e => { S.pf.allDates = false; $('#pf-all').checked = false; set('date', e.target.value || today()); };
  $$('[data-d]').forEach(b => b.onclick = () => { S.pf.allDates = false; $('#pf-all').checked = false; S.pf.date = addDays(S.pf.date, +b.dataset.d); $('#pf-date').value = S.pf.date; reload(); });
  $('#pf-today').onclick = () => { S.pf.allDates = false; $('#pf-all').checked = false; S.pf.date = today(); $('#pf-date').value = S.pf.date; reload(); };
  $('#pf-all').onchange = e => set('allDates', e.target.checked);
  let qt; $('#pf-q').oninput = e => { clearTimeout(qt); qt = setTimeout(() => set('q', e.target.value.trim()), 300); };
  $('#pf-status').onchange = e => set('status', e.target.value);
  $('#pf-editoria').onchange = e => set('editoria', e.target.value);
  $('#pf-prog').onchange = e => set('programaId', e.target.value);
  $('#pf-mine').onchange = e => set('mine', e.target.checked);
  $('#pf-new').onclick = () => openPauta(null);
  $('#pf-toggle').onclick = (e) => { const on = $('.ws-pautas').classList.toggle('show-filters'); e.target.setAttribute('aria-expanded', on); };
  $('#pf-print').onclick = printPautaList;
  $('#pf-capa').onclick = openCapa;
  $('#pauta-list').onclick = e => {
    const v = e.target.closest('[data-view]'); if (v) return verDocumento(v.dataset.view);
    const r = e.target.closest('[data-id]'); if (r) (isMobile() ? openFicha : openPauta)(r.dataset.id);
  };
  await reload();
  renderPautaEditor();
  if (S.perms.edit) offerDraftRestore();
  S.pollTimer = setInterval(async () => { if (S.view !== 'pautas') return; try { await loadPautas(); renderPautaList(); } catch { } }, 8000);
}
function renderPautaList() {
  const el = $('#pauta-list'); if (!el) return;
  $('#pf-label').textContent = S.pf.allDates ? 'todas as datas' : `${weekday(S.pf.date)}, ${fmtDate(S.pf.date)}`;
  $('#pf-count').textContent = `${S.pautas.length} pauta(s) encontrada(s)`;
  if (!S.pautas.length) { el.innerHTML = `<div class="empty">Nenhuma pauta para este filtro.${S.perms.edit ? '<br><br><button class="btn primary" onclick="openPauta(null)">Criar pauta</button>' : ''}</div>`; return; }
  const selId = S.pauta && S.pauta.id;
  el.innerHTML = `<table class="grid"><thead><tr><th></th><th>Retranca</th><th title="Retranca · Proposta · Marcação · Informações">R P M I</th><th>Status</th><th>Editoria</th><th>Repórter</th><th>Hora</th>${S.pf.allDates ? '<th>Data</th>' : ''}<th>Formato</th><th>Matéria</th></tr></thead><tbody>
  ${S.pautas.map(p => `<tr class="row ${p.id === selId ? 'sel' : ''}" data-id="${p.id}">
    <td>${p.prioridade === 'urgente' ? '<span class="pri-urgente">!!</span>' : p.prioridade === 'alta' ? '<span class="pri-alta">!</span>' : ''}${p.lock && !p.lock.mine ? ` <span class="lockico" title="Em edição por ${esc(p.lock.name)}">🔒</span>` : ''}</td>
    <td class="retr">${esc(p.retranca)}</td>
    <td class="dots">${pautaChecks(p).map(([l, ok]) => `<i class="${ok ? 'ok' : ''}" title="${l}: ${ok ? 'preenchido' : 'pendente'}"></i>`).join('')}</td>
    <td><span class="pill st-${p.status}" ${p.status === 'caiu' && p.motivoQueda ? `title="Motivo da queda: ${esc(p.motivoQueda)}"` : ''}>${esc(label(PAUTA_STATUS, p.status))}${p.status === 'caiu' && p.motivoQueda ? ' ⓘ' : ''}</span></td>
    <td>${esc(p.editoria)}</td><td>${esc(repName(p))}</td><td class="mono">${esc(p.horario)}</td>
    ${S.pf.allDates ? `<td class="mono">${fmtDate(p.data)}</td>` : ''}<td><span class="tipo">${esc(p.formato || '')}</span></td>
    <td>${materiaPill(p)}</td></tr>`).join('')}
  </tbody></table>
  <div class="pcards">${S.pautas.map(pautaCard).join('')}</div>`;
}
async function openPauta(id) {
  if (S.pautaDirty && !(await autosavePauta()) && !confirm('A pauta atual ainda não pôde ser salva no sistema. Ela fica guardada como rascunho neste navegador. Continuar?')) return;
  clearTimeout(S.pAutoTimer); S.pConflict = null;
  await releaseLocks();
  S.pautaDirty = false;
  if (!id) {
    S.pauta = { retranca: '', data: S.pf.allDates ? today() : S.pf.date, editoria: '', status: 'sugestao', prioridade: 'normal', formato: 'VT', programaId: S.pf.programaId || '',
      produtorId: S.me.role === 'produtor' || S.me.role === 'chefe' ? S.me.id : '', reporterId: S.me.role === 'reporter' ? S.me.id : '',
      entrevistados: [], roteiro: [] };
  } else {
    try { S.pauta = await api('GET', '/api/pautas/' + id); } catch (e) { return toast(e.message, true); }
    const d = readDraft(id);   // rascunho mais novo que a versão salva (página fechada antes de gravar)
    if (d && d.at > Date.parse(S.pauta.updatedAt || 0)) {
      if (confirm(`Há alterações desta pauta que não chegaram a ser salvas (${new Date(d.at).toLocaleString('pt-BR')}).\n\nOK = recuperar essas alterações · Cancelar = descartar`)) {
        Object.assign(S.pauta, d.p, { updatedAt: S.pauta.updatedAt, lock: S.pauta.lock, usos: S.pauta.usos }); renderPautaList(); renderPautaEditor(); markPautaDirty(); return;
      }
      clearDraft(S.pauta);
    }
  }
  renderPautaList(); renderPautaEditor();
  if (!id) setTimeout(() => { const r = $('#pauta-editor [data-pf=retranca]'); if (r) r.focus(); }, 0);
}
window.openPauta = openPauta;

function renderPautaEditor() {
  const el = $('#pauta-editor'); if (!el) return;
  const p = S.pauta;
  const ws = $('.ws-pautas'); if (ws) ws.classList.toggle('show-editor', !!p);
  if (p && !S.perms.edit) {   // licença de leitura: ficha de consulta
    el.innerHTML = `<div class="pane-h"><button class="btn sm mob-only" id="p-back">‹ Voltar</button><h2>Consulta da pauta</h2><div style="flex:1"></div><button class="btn sm mob-only" id="p-view">👁 Visualizar</button><button class="btn primary sm" id="p-print">Baixar PDF / Imprimir</button></div><div class="pane-b">${fichaHtml(p)}</div>`;
    $('#p-print').onclick = () => printPauta(p); $('#p-view').onclick = () => verDocumento(p); $('#p-back').onclick = fecharEditor; return;
  }
  if (!p) { el.innerHTML = `<div class="pane-h"><h2>Pauta</h2></div><div class="empty">Selecione uma pauta na lista ou crie uma nova.<br><br><span class="hint">Atalho: Ctrl+S salva a pauta aberta.</span></div>`; return; }
  const lockedBy = p.lock && !p.lock.mine ? p.lock.name : null;
  const ro = lockedBy ? 'disabled' : '';
  const users = S.users.filter(u => u.active);
  const uopts = (sel, roles) => `<option value="">—</option>` + users.filter(u => !roles || roles.includes(u.role) || u.id === sel).map(u => `<option value="${u.id}" ${u.id === sel ? 'selected' : ''}>${esc(u.name)}</option>`).join('');
  const F = (k) => esc(p[k] || '');
  el.innerHTML = `
  <div id="p-head" style="display:contents">${pautaHeadHtml(p, ro)}</div>
  ${lockedBy ? `<div class="banner">🔒 Pauta em edição por <b>${esc(lockedBy)}</b>. Você está vendo em modo leitura.</div>` : ''}
  <div class="pane-b"><div class="form" id="pform">
    <div class="checklist" id="pcheck">${checklistHtml(p)}</div>
    <div class="sec"><h3><span class="stepn">1</span> Retranca <span class="req">obrigatório</span><span class="grow"></span><span class="hint" style="text-transform:none;letter-spacing:0">nome da matéria</span></h3><div class="sb">
      <div class="field"><label>Retranca *</label><input type="text" class="retranca-input" data-pf="retranca" value="${F('retranca')}" maxlength="80" placeholder="EX.: OBRAS AVENIDA" ${ro}></div>
      <div class="row4">
        <div class="field"><label>Data</label><input type="date" data-pf="data" value="${F('data')}" ${ro}></div>
        <div class="field"><label>Editoria</label><input type="text" list="dl-edit" data-pf="editoria" value="${F('editoria')}" ${ro}></div>
        <div class="field"><label>Status</label><select data-pf="status" ${ro}>${opts(PAUTA_STATUS, p.status)}</select></div>
        <div class="field"><label>Prioridade</label><select data-pf="prioridade" ${ro}>${opts(PRIORIDADES, p.prioridade)}</select></div>
      </div>
      <div class="quedabox" id="queda-box" style="${p.status === 'caiu' ? '' : 'display:none'}">
        <div class="field"><label>Motivo da queda * <span class="hint" style="text-transform:none;letter-spacing:0">obrigatório quando a pauta cai</span></label>
          <textarea data-pf="motivoQueda" rows="2" placeholder="Explique por que a pauta caiu: entrevistado desmarcou, fato perdeu relevância, equipe deslocada para factual…" ${ro}>${F('motivoQueda')}</textarea></div>
        <div class="formbar"><span class="lbl">Motivos frequentes:</span>${MOTIVOS_QUEDA.map(m => `<button class="btn sm" data-motivo="${esc(m)}" ${ro}>${esc(m)}</button>`).join('')}</div>
      </div>
      <div class="row3">
        <div class="field"><label>Telejornal (destino)</label><select data-pf="programaId" ${ro}><option value="">—</option>${opts(S.programs.map(x => [x.id, x.name]), p.programaId)}</select></div>
        <div class="field"><label>Formato</label><select data-pf="formato" ${ro}>${opts(!p.formato || FORMATOS.includes(p.formato) ? FORMATOS : [...FORMATOS, p.formato], p.formato)}</select></div>
        <div class="field"><label>Palavras-chave</label><input type="text" data-pf="tags" value="${F('tags')}" placeholder="separadas por vírgula" ${ro}></div>
      </div>
      <div class="teambox">
        <div class="teambox-h"><span class="lbl">Equipe</span><span class="hint">escolha da lista ou digite o nome</span></div>
        <div class="teamgrid">
          <div class="field"><label>Produtor</label><input type="text" list="dl-prod" data-team="produtor" value="${esc(prodName(p))}" placeholder="Nome do produtor" autocomplete="off" ${ro}></div>
          <div class="field"><label>Repórter</label><input type="text" list="dl-rep" data-team="reporter" value="${esc(repName(p))}" placeholder="Nome do repórter" autocomplete="off" ${ro}></div>
          <div class="field"><label>Repórter cinematográfico</label><input type="text" list="dl-cine" data-pf="cinegrafista" value="${F('cinegrafista')}" placeholder="Nome do cinegrafista" autocomplete="off" ${ro}></div>
          <div class="field"><label>Motorista</label><input type="text" list="dl-mot" data-pf="motorista" value="${F('motorista')}" placeholder="Nome do motorista" autocomplete="off" ${ro}></div>
          <div class="field"><label>Editor de imagens</label><input type="text" list="dl-eimg" data-pf="edicaoEditor" value="${F('edicaoEditor')}" placeholder="Nome do editor de imagens" autocomplete="off" ${ro}></div>
        </div>
      </div>
      ${teamLists()}
      <datalist id="dl-edit">${EDITORIAS.map(e => `<option>${esc(e)}</option>`).join('')}</datalist>
    </div></div>

    <div class="sec"><h3><span class="stepn">2</span> Proposta <span class="req">obrigatório</span><span class="grow"></span><span class="hint" style="text-transform:none;letter-spacing:0">o que se espera da matéria</span></h3><div class="sb">
      <textarea data-pf="proposta" rows="4" placeholder="Qual é a notícia? O que se espera dessa matéria: o enfoque, o que precisa ser mostrado e por que interessa ao público hoje." ${ro}>${F('proposta')}</textarea></div></div>

    <div class="sec"><h3><span class="stepn">3</span> Marcação <span class="grow"></span><span class="hint" style="text-transform:none;letter-spacing:0">${(p.entrevistados || []).filter(x => x.confirmado).length}/${(p.entrevistados || []).length} entrevistado(s) confirmado(s)</span></h3><div class="sb">
      <div class="lbl" style="margin-bottom:4px">Entrevistados / personagens</div>
      ${(p.entrevistados || []).map((r, i) => `<div class="entcard">
        <div class="row3">
          <div class="field"><label>Nome</label><input type="text" data-ent="${i}" data-k="nome" value="${esc(r.nome)}" ${ro}></div>
          <div class="field"><label>Função / cargo</label><input type="text" data-ent="${i}" data-k="funcao" value="${esc(r.funcao)}" ${ro}></div>
          <div class="field"><label>Telefone / contato</label><input type="text" data-ent="${i}" data-k="telefone" value="${esc(r.telefone)}" ${ro}></div>
        </div>
        <div class="row4">
          <div class="field"><label>Data</label><input type="date" data-ent="${i}" data-k="data" value="${esc(r.data || p.data || '')}" ${ro}></div>
          <div class="field"><label>Horário</label><input type="time" data-ent="${i}" data-k="horario" value="${esc(r.horario)}" ${ro}></div>
          <div class="field" style="grid-column:span 2"><label>Local / endereço da gravação</label><input type="text" data-ent="${i}" data-k="local" value="${esc(r.local)}" ${ro}></div>
        </div>
        <div class="formbar"><label class="check"><input type="checkbox" data-ent="${i}" data-k="confirmado" ${r.confirmado ? 'checked' : ''} ${ro}> Marcação confirmada</label>
          <input type="text" data-ent="${i}" data-k="obs" value="${esc(r.obs || '')}" placeholder="Obs.: assessoria, autorização de imagem, ponto de encontro…" style="flex:1" ${ro}>
          <button class="btn sm danger" data-entdel="${i}" ${ro}>Remover</button></div>
      </div>`).join('') || '<div class="hint" style="margin-bottom:6px">Nenhum entrevistado marcado ainda.</div>'}
      <button class="btn sm" id="ent-add" ${ro}>+ Entrevistado</button>
      <div class="lbl" style="margin:14px 0 4px">Local principal da gravação</div>
      <div class="row3">
        <div class="field"><label>Horário de saída / início</label><input type="time" data-pf="horario" value="${F('horario')}" ${ro}></div>
        <div class="field"><label>Local</label><input type="text" data-pf="local" value="${F('local')}" ${ro}></div>
        <div class="field"><label>Endereço</label><input type="text" data-pf="endereco" value="${F('endereco')}" ${ro}></div>
      </div>
      <div class="lbl" style="margin:4px 0">Roteiro de gravação (outros pontos)</div>
      <table class="subtable"><thead><tr><th style="width:90px">Hora</th><th>Local</th><th>O que gravar</th><th style="width:30px"></th></tr></thead>
        <tbody>${(p.roteiro || []).map((r, i) => `<tr>
          <td><input type="time" data-rot="${i}" data-k="hora" value="${esc(r.hora)}" ${ro}></td>
          <td><input type="text" data-rot="${i}" data-k="local" value="${esc(r.local)}" ${ro}></td>
          <td><input type="text" data-rot="${i}" data-k="acao" value="${esc(r.acao)}" ${ro}></td>
          <td><button class="btn sm" data-rotdel="${i}" ${ro} aria-label="Remover">×</button></td></tr>`).join('')}</tbody></table>
      <button class="btn sm" id="rot-add" style="margin-top:6px" ${ro}>+ Ponto de gravação</button>
    </div></div>

    <div class="sec"><h3><span class="stepn">4</span> Informações <span class="grow"></span><span class="hint" style="text-transform:none;letter-spacing:0">o que o jornalista precisa saber</span></h3><div class="sb">
      <textarea data-pf="historico" rows="7" placeholder="Dados apurados, números, datas, contexto, histórico do caso, outro lado, fontes consultadas, links e documentos." ${ro}>${F('historico')}</textarea></div></div>

    <div class="sec sec-materia" id="materia"><h3><span class="stepn">5</span> Matéria <span class="grow"></span><span class="readtime" id="mat-rt">${materiaStats(p.materia)}</span></h3><div class="sb">
      <div class="formbar" style="margin-bottom:8px">
        <span class="lbl">Inserir:</span>
        ${['OFF', 'SONORA', 'PASSAGEM', 'ARTE', 'GC', 'TRILHA', 'IMAGEM'].map(t => `<button class="btn sm" data-ins="${t}" ${ro}>[${t}]</button>`).join('')}
        <div style="flex:1"></div>
        <label class="lbl" for="mat-st">Situação</label>
        <select id="mat-st" data-pf="materiaStatus" style="width:auto" ${ro}>${opts(MATERIA_STATUS, p.materiaStatus || '')}</select>
      </div>
      <textarea class="materia" data-pf="materia" rows="16" placeholder="Texto da matéria escrito pelo repórter.&#10;&#10;[OFF]&#10;Texto narrado sobre as imagens…&#10;&#10;[SONORA] NOME / CARGO&#10;&quot;Fala do entrevistado…&quot;&#10;&#10;[PASSAGEM] NOME DO REPÓRTER&#10;Texto da passagem…" ${ro}>${F('materia')}</textarea>
      <div class="meta" style="margin-top:6px">${p.materiaAutorId ? `Última edição do texto: <b>${esc(userName(p.materiaAutorId))}</b> em ${fmtDT(p.materiaAt)}` : 'A matéria fica salva na pauta. Qualquer pessoa da redação pode encontrá-la em <b>Busca</b>.'}</div>
    </div></div>

    <div class="sec"><h3>Encaminhamento</h3><div class="sb"><textarea data-pf="encaminhamento" rows="3" placeholder="Orientação para a equipe: abordagem, sonoras necessárias, passagem, imagens obrigatórias, cuidados." ${ro}>${F('encaminhamento')}</textarea></div></div>

    <div class="sec"><h3>Edição de texto</h3><div class="sb"><div class="field"><label>Editor(a) de texto</label><input type="text" list="dl-etxt" data-pf="editorTexto" value="${F('editorTexto')}" autocomplete="off" ${ro}></div></div></div>

    <div class="sec"><h3>Sugestão de perguntas</h3><div class="sb"><textarea data-pf="perguntas" rows="3" ${ro}>${F('perguntas')}</textarea></div></div>
    <div class="sec"><h3>Imagens e Arte</h3><div class="sb"><div class="row2">
      <div class="field"><label>Imagens necessárias / arquivo</label><textarea data-pf="imagens" rows="3" ${ro}>${F('imagens')}</textarea></div>
      <div class="field"><label>Pedido de arte</label><textarea data-pf="arte" rows="3" ${ro}>${F('arte')}</textarea></div>
    </div></div></div>
    <div class="sec"><h3>Observações</h3><div class="sb"><textarea data-pf="observacoes" rows="2" placeholder="Riscos, autorizações, segurança da equipe, direito de resposta…" ${ro}>${F('observacoes')}</textarea></div></div>
    ${p.id ? `<div class="meta">Criada por ${esc(userName(p.createdBy))} em ${fmtDT(p.createdAt)} · Última alteração: ${esc(userName(p.updatedBy))} em ${fmtDT(p.updatedAt)}
      ${p.usos && p.usos.length ? `<br>No espelho: ${p.usos.map(u => `${esc(u.programa)} (${fmtDate(u.data)})`).join(', ')}` : ''}</div>` : ''}
  </div></div>`;

  const form = $('#pform');
  const markDirty = markPautaDirty;
  form.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.pf) p[t.dataset.pf] = t.dataset.pf === 'retranca' ? t.value.toUpperCase() : t.value;
    if (t.dataset.pf === 'status') {
      const qb = $('#queda-box'); if (qb) qb.style.display = p.status === 'caiu' ? '' : 'none';
      if (p.status === 'caiu' && !String(p.motivoQueda || '').trim()) setTimeout(() => { const m = $('[data-pf=motivoQueda]'); if (m) m.focus(); }, 0);
    }
    if (t.dataset.team === 'produtor') {
      const v = t.value.trim(); const u = S.users.find(x => x.name.toLowerCase() === v.toLowerCase());
      if (u) { p.produtorId = u.id; p.produtorNome = ''; } else { p.produtorId = ''; p.produtorNome = v; }
    }
    if (t.dataset.team === 'reporter') {   // nome da lista vira usuário do sistema; senão fica o nome digitado
      const v = t.value.trim(); const u = S.users.find(x => x.name.toLowerCase() === v.toLowerCase());
      if (u) { p.reporterId = u.id; p.reporterNome = ''; } else { p.reporterId = ''; p.reporterNome = v; }
    }
    if (t.dataset.pf === 'materia') {
      const rt = $('#mat-rt'); if (rt) rt.textContent = materiaStats(p.materia);
      if (p.materia.trim() && !p.materiaStatus) { p.materiaStatus = 'rascunho'; const ms = $('#mat-st'); if (ms) ms.value = 'rascunho'; }
    }
    if (t.dataset.ent != null) p.entrevistados[+t.dataset.ent][t.dataset.k] = t.type === 'checkbox' ? t.checked : t.value;
    if (t.dataset.rot != null) p.roteiro[+t.dataset.rot][t.dataset.k] = t.value;
    markDirty();
  });
  form.addEventListener('change', (e) => { if (e.target.type === 'checkbox' || e.target.tagName === 'SELECT') form.dispatchEvent(new Event('input')); });
  form.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    e.preventDefault();
    if (b.dataset.motivo) {   // motivo de queda frequente
      const ta = $('[data-pf=motivoQueda]', form); ta.value = ta.value.trim() ? ta.value.trim() + '; ' + b.dataset.motivo : b.dataset.motivo;
      ta.dispatchEvent(new Event('input', { bubbles: true })); ta.focus(); return;
    }
    if (b.dataset.ins) {   // insere marcação de roteiro no cursor
      const ta = $('[data-pf=materia]', form); const tag = `[${b.dataset.ins}] `;
      const s = ta.selectionStart, before = ta.value.slice(0, s);
      const ins = (before && !before.endsWith('\n') ? '\n\n' : '') + tag + (b.dataset.ins === 'SONORA' || b.dataset.ins === 'PASSAGEM' || b.dataset.ins === 'GC' ? 'NOME / CARGO\n' : '');
      ta.setRangeText(ins, s, ta.selectionEnd, 'end'); ta.focus();
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    if (b.id === 'ent-add') p.entrevistados = [...(p.entrevistados || []), { nome: '', funcao: '', telefone: '', data: p.data || '', horario: '', local: '', obs: '', confirmado: false }];
    else if (b.id === 'rot-add') p.roteiro = [...(p.roteiro || []), { hora: '', local: '', acao: '' }];
    else if (b.dataset.entdel != null) p.entrevistados.splice(+b.dataset.entdel, 1);
    else if (b.dataset.rotdel != null) p.roteiro.splice(+b.dataset.rotdel, 1);
    else return;
    const sc = $('#pauta-editor .pane-b').scrollTop; renderPautaEditor(); markDirty(); $('#pauta-editor .pane-b').scrollTop = sc;
  });
  bindPautaHead(p);
}
function pautaHeadHtml(p, ro) {
  return `<div class="pane-h"><button class="btn sm mob-only" id="p-back">‹ Voltar</button><h2>${p.id ? 'Pauta' : 'Nova pauta'}</h2>
    <span class="savestate ${S.pautaDirty ? 'dirty' : ''}" id="pstate">${S.pautaDirty ? 'Alterações não salvas' : p.id ? 'Salva' : 'Não salva'}</span>
    <div class="formbar">
      <button class="btn primary sm" id="p-save" ${ro}>Salvar</button>
      <button class="btn sm mob-only" id="p-view">👁 Visualizar</button>
      <button class="btn sm" id="p-mat" title="Abrir o espaço de redação da matéria">✎ Matéria</button>
      ${p.id ? `${S.perms.rundown ? '<button class="btn sm" id="p-send">Enviar ao espelho</button>' : ''}<button class="btn sm" id="p-dup">Duplicar</button><button class="btn sm" id="p-print">Imprimir / PDF</button>
      ${S.perms.deletePauta ? `<button class="btn sm danger" id="p-del" ${ro}>Excluir</button>` : ''}` : ''}
    </div></div>`;
}
function bindPautaHead(p) {
  $('#p-save').onclick = savePauta;
  const back = $('#p-back'); if (back) back.onclick = fecharEditor;
  $('#p-view').onclick = () => verDocumento(p);   // mostra o que está na tela, mesmo ainda não salvo
  $('#p-mat').onclick = async () => {
    if (p.id && S.pautaDirty) await autosavePauta();
    if (p.id && !S.pautaDirty) { S.matOpenId = p.id; S.mf = Object.assign(S.mf || {}, { date: p.data, allDates: false }); return go('materias'); }
    const m = $('#materia'); m.scrollIntoView({ behavior: 'smooth', block: 'start' }); setTimeout(() => $('[data-pf=materia]').focus({ preventScroll: true }), 350); };
  if (p.id) {
    const send = $('#p-send'); if (send) send.onclick = async () => { if (S.pautaDirty) await autosavePauta(); sendToRundown(p); };
    $('#p-dup').onclick = async () => { if (S.pautaDirty && !(await autosavePauta()) && !confirm('Descartar alterações?')) return; S.pautaDirty = false; releaseLocks();
      const copy = JSON.parse(JSON.stringify(p)); ['id', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'usos', 'lock'].forEach(k => delete copy[k]);
      copy.retranca = (copy.retranca + ' 2').slice(0, 80); copy.status = 'sugestao'; S.pauta = copy; renderPautaList(); renderPautaEditor(); markPautaDirty(); };
    $('#p-print').onclick = () => printPauta(p);
    const del = $('#p-del'); if (del) del.onclick = async () => {
      if (!confirm(`Excluir a pauta ${p.retranca}?`)) return;
      try { await api('DELETE', '/api/pautas/' + p.id); clearTimeout(S.pAutoTimer); clearDraft(p); toast('Pauta excluída.'); S.pauta = null; S.pautaDirty = false; await releaseLocks(); await loadPautas(); renderPautaList(); renderPautaEditor(); }
      catch (e) { toast(e.message, true); }
    };
  }
}

// =============================================================== CONSULTA (celular e licença de leitura)
async function fecharEditor() {
  if (S.pautaDirty && !(await autosavePauta()) && !confirm('A pauta ainda não pôde ser salva no sistema. Ela fica guardada como rascunho. Voltar mesmo assim?')) return;
  clearTimeout(S.pAutoTimer); S.pautaDirty = false; S.pauta = null; await releaseLocks(); renderPautaList(); renderPautaEditor();
}
function pautaCard(p) {
  const linha = (r, v) => v ? `<div><span>${r}</span> <b>${esc(v)}</b></div>` : '';
  return `<div class="pcard-w"><button type="button" class="pcard" data-id="${p.id}">
    <div class="pc-top"><b class="pc-retr">${esc(p.retranca)}</b><span class="pill st-${p.status}">${esc(label(PAUTA_STATUS, p.status))}</span></div>
    <div class="pc-sub">${[S.pf.allDates ? fmtDate(p.data) : '', p.horario, p.local].filter(Boolean).map(esc).join(' · ') || 'Sem horário e local'}</div>
    <div class="pc-team">${linha('Repórter', repName(p))}${linha('Cinegrafista', p.cinegrafista)}${linha('Motorista', p.motorista)}</div>
  </button><button type="button" class="pc-view" data-view="${p.id}">👁 Visualizar</button></div>`;
}
// documento da emissora na tela (celular): o mesmo conteúdo do PDF, sem baixar nada
async function verDocumento(ref) {
  try {
    const p = typeof ref === 'string' ? await api('GET', '/api/pautas/' + ref) : ref;
    const d = printDoc(p, 'tela');
    const tabs = d.materia ? `<div class="dv-tabs" role="tablist"><button type="button" role="tab" data-dv="pauta" class="on" aria-selected="true">Pauta</button><button type="button" role="tab" data-dv="materia" aria-selected="false">Matéria</button></div>` : '';
    const md = modal('Visualizar documento', `${tabs}<div class="docview pdf-render"><div class="docs" style="--brand:${d.brand}"><div data-doc="pauta">${d.pauta}</div>${d.materia ? `<div data-doc="materia" hidden>${d.materia}</div>` : ''}<div class="dv-foot">${esc(d.rodape)}</div></div></div>`,
      { wide: true, footer: '<button class="btn" id="dv-pdf">⬇ Baixar PDF</button><button class="btn primary" data-close>Fechar</button>' });
    md.el.classList.add('ficha-modal', 'dv-modal'); if (document.activeElement) document.activeElement.blur();
    $('#dv-pdf', md.el).onclick = () => printPauta(p);
    $$('[data-dv]', md.el).forEach(b => b.onclick = () => {
      $$('[data-dv]', md.el).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); });
      $$('[data-doc]', md.el).forEach(x => { x.hidden = x.dataset.doc !== b.dataset.dv; });
      $('.modal-b', md.el).scrollTop = 0;
    });
  } catch (e) { toast(e.message, true); }
}
function fichaHtml(p) {
  const mapa = (end) => end ? `<a class="fc-act" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(end)}" target="_blank" rel="noopener">📍 Mapa</a>` : '';
  const ligar = (tel) => { const n = String(tel || '').replace(/[^\d+]/g, ''); return n.length >= 8 ? `<a class="fc-act" href="tel:${n}">📞 Ligar</a>` : ''; };
  const bloco = (t, v) => String(v || '').trim() ? `<section class="fc-sec"><h4>${t}</h4><div class="fc-txt">${esc(v)}</div></section>` : '';
  const prog = p.programaId ? (S.programs.find(x => x.id === p.programaId) || {}).name || '' : '';
  const equipe = [['Repórter', repName(p)], ['Cinegrafista', p.cinegrafista], ['Motorista', p.motorista], ['Produtor', prodName(p)], ['Editor de imagens', p.edicaoEditor]];
  const ents = (p.entrevistados || []).filter(e => e.nome);
  const rot = (p.roteiro || []).filter(r => r.local || r.acao);
  const local = [p.local, p.endereco].filter(Boolean).join(' — ');
  return `<div class="ficha">
    <div class="fc-head"><div class="fc-retr">${esc(p.retranca)}</div>
      <div class="fc-meta"><span class="pill st-${p.status}">${esc(label(PAUTA_STATUS, p.status))}</span> ${p.data ? esc(weekday(p.data)) + ', ' + fmtDate(p.data) : ''}${p.horario ? ' · <b>' + esc(p.horario) + '</b>' : ''}${prog ? ' · ' + esc(prog) : ''}</div></div>
    ${p.status === 'caiu' ? bloco('Motivo da queda', p.motivoQueda) : ''}
    <div class="fc-team">${equipe.map(([r, v]) => `<div class="${v ? '' : 'vazio'}"><span>${r}</span><b>${esc(v || '—')}</b></div>`).join('')}</div>
    ${local ? `<section class="fc-sec"><h4>Local principal</h4><div class="fc-card"><div>${esc(local)}</div><div class="fc-acts">${mapa(p.endereco || p.local)}</div></div></section>` : ''}
    ${ents.length ? `<section class="fc-sec"><h4>Marcação</h4>${ents.map(e => `<div class="fc-card"><b>${esc(e.nome)}</b>${e.funcao ? ` <span class="hint">${esc(e.funcao)}</span>` : ''}
      <div>${[fmtDate(e.data), e.horario, e.local].filter(Boolean).map(esc).join(' · ')}</div>
      <div class="hint">${e.confirmado ? '✓ Confirmado' : 'A confirmar'}${e.telefone ? ' · ' + esc(e.telefone) : ''}${e.obs ? ' · ' + esc(e.obs) : ''}</div>
      <div class="fc-acts">${ligar(e.telefone)}${mapa(e.local)}</div></div>`).join('')}</section>` : ''}
    ${rot.length ? `<section class="fc-sec"><h4>Roteiro de gravação</h4>${rot.map(r => `<div class="fc-card"><b>${esc(r.hora || '')}</b> ${esc(r.local || '')}<div>${esc(r.acao || '')}</div></div>`).join('')}</section>` : ''}
    ${bloco('Proposta', p.proposta)}${bloco('Informações', p.historico)}${bloco('Encaminhamento', p.encaminhamento)}${bloco('Sugestão de perguntas', p.perguntas)}
    ${bloco('Imagens', p.imagens)}${bloco('Arte', p.arte)}${bloco('Observações', p.observacoes)}
    ${String(p.materia || '').trim() ? `<section class="fc-sec"><h4>Matéria · ${esc(label(MATERIA_STATUS, p.materiaStatus || 'rascunho'))}</h4><div class="fc-txt">${markScript(esc(p.materia), true)}</div></section>` : ''}
  </div>`;
}
async function openFicha(id) {
  try {
    const p = await api('GET', '/api/pautas/' + id);
    const md = modal('Consulta da pauta', fichaHtml(p), { wide: true, footer: `<button class="btn mob-only" id="pv">👁 Visualizar</button><button class="btn" id="pp">Baixar PDF / Imprimir</button>${S.perms.edit ? '<button class="btn" id="op">Editar pauta</button>' : ''}<button class="btn primary" data-close>Fechar</button>` });
    md.el.classList.add('ficha-modal'); if (document.activeElement) document.activeElement.blur();
    $('#pp', md.el).onclick = () => printPauta(p);
    $('#pv', md.el).onclick = () => verDocumento(p);
    const op = $('#op', md.el); if (op) op.onclick = async () => {
      md.close(); S.pf.date = p.data; S.pf.allDates = false; if (S.view !== 'pautas') await go('pautas'); openPauta(p.id);
    };
  } catch (e) { toast(e.message, true); }
}

// =============================================================== SALVAMENTO AUTOMÁTICO DA PAUTA
// 1) rascunho no navegador a cada alteração (sobrevive a fechar a aba ou cair a internet)
// 2) gravação no sistema 3 s depois que a pessoa para de digitar (a partir da retranca preenchida)
const draftKey = (id) => `redacao:rascunho:${S.me ? S.me.id : ''}:${id || 'nova'}`;
function saveDraft() {
  const p = S.pauta; if (!p) return;
  try { localStorage.setItem(draftKey(p.id), JSON.stringify({ at: Date.now(), p })); } catch { /* armazenamento indisponível */ }
}
function readDraft(id) { try { const d = JSON.parse(localStorage.getItem(draftKey(id)) || 'null'); return d && d.p ? d : null; } catch { return null; } }
function clearDraft(p) { try { localStorage.removeItem(draftKey(p && p.id)); if (p && p.id) localStorage.removeItem(draftKey(null)); } catch { } }
function setPState(txt, dirty) { const st = $('#pstate'); if (st) { st.textContent = txt; st.classList.toggle('dirty', !!dirty); } }
async function markPautaDirty() {
  const p = S.pauta; if (!p || !S.perms.edit) return;
  S.pEditSeq = (S.pEditSeq || 0) + 1;
  if (!S.pautaDirty) {
    S.pautaDirty = true;
    if (p.id) { const r = await acquireLock('p:' + p.id); if (!r.ok) toast(`Pauta em edição por ${r.lock.name}.`, true); }
  }
  setPState('Alterações não salvas', true);
  const ck = $('#pcheck'); if (ck) ck.innerHTML = checklistHtml(p);
  saveDraft();
  clearTimeout(S.pAutoTimer); S.pAutoTimer = setTimeout(() => autosavePauta(), 3000);
}
// devolve true quando não ficou nada pendente
async function autosavePauta() {
  const p = S.pauta; clearTimeout(S.pAutoTimer);
  if (!p || !S.pautaDirty) return true;
  if (S.pSaving) return S.pSaving;
  if (S.pConflict === p) { setPState('Não salva: alterada por outra pessoa · clique em Salvar', true); return false; }
  if (!String(p.retranca || '').trim()) { setPState('Rascunho guardado neste navegador · preencha a retranca para salvar', true); return false; }
  if (p.status === 'caiu' && !String(p.motivoQueda || '').trim()) { setPState('Rascunho guardado · informe o motivo da queda', true); return false; }
  if (['pronta', 'gravada', 'exibida'].includes(p.status) && pautaChecks(p).some(x => !x[1])) { setPState('Rascunho guardado · complete os 4 itens para este status', true); return false; }
  const seq = S.pEditSeq, wasNew = !p.id;
  setPState('Salvando…', true);
  S.pSaving = (async () => {
    try {
      const saved = wasNew ? await api('POST', '/api/pautas', p) : await api('PUT', '/api/pautas/' + p.id, p);
      ['id', 'updatedAt', 'updatedBy', 'createdAt', 'createdBy', 'materiaAutorId', 'materiaAt'].forEach(k => { if (saved[k] !== undefined) p[k] = saved[k]; });
      if (wasNew) {
        try { localStorage.removeItem(draftKey(null)); } catch { }
        await acquireLock('p:' + p.id);
        if (S.pauta === p) { const h = $('#p-head'); if (h) { h.innerHTML = pautaHeadHtml(p, ''); bindPautaHead(p); } }
      }
      if (S.pEditSeq === seq) { S.pautaDirty = false; clearDraft(p); setPState(`Salva automaticamente às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`); }
      else { saveDraft(); clearTimeout(S.pAutoTimer); S.pAutoTimer = setTimeout(() => autosavePauta(), 3000); }
      if (S.view === 'pautas') { await loadPautas(); renderPautaList(); }
      return !S.pautaDirty;
    } catch (e) {
      if (e.status === 409) { S.pConflict = p; toast('Outra pessoa alterou esta pauta. Seu texto está guardado como rascunho; clique em Salvar para decidir.', true); }
      else if (e.status !== 423) toast('Salvamento automático: ' + e.message, true);
      setPState('Rascunho guardado neste navegador', true);
      return false;
    } finally { S.pSaving = null; }
  })();
  return S.pSaving;
}
// rascunhos que ficaram para trás (página fechada antes de salvar)
function offerDraftRestore() {
  const d = readDraft(null); const el = $('#pauta-editor');
  if (!d || !el || (S.pauta && S.pautaDirty)) return;
  const when = new Date(d.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const bar = document.createElement('div'); bar.className = 'banner draftbar';
  bar.innerHTML = `📝 Há uma <b>nova pauta não salva</b>${d.p.retranca ? ` (<b>${esc(d.p.retranca)}</b>)` : ''}, de ${when}. <button class="btn sm primary" data-dr="ok">Recuperar</button> <button class="btn sm" data-dr="no">Descartar</button>`;
  el.prepend(bar);
  bar.onclick = async (e) => {
    const a = e.target.dataset.dr; if (!a) return;
    if (a === 'no') { if (!confirm('Descartar este rascunho? Ele não poderá ser recuperado.')) return; try { localStorage.removeItem(draftKey(null)); } catch { } bar.remove(); return; }
    await releaseLocks();
    S.pauta = Object.assign({ entrevistados: [], roteiro: [] }, d.p); delete S.pauta.id; S.pautaDirty = false; S.pConflict = null;
    renderPautaList(); renderPautaEditor(); markPautaDirty(); toast('Rascunho recuperado.');
  };
}
// listas de nomes sugeridos: cadastro da emissora + nomes já usados em pautas
function teamLists() {
  const uniq = (arr) => [...new Set(arr.map(s => String(s || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const used = (k) => (S.pautas || []).map(x => x[k]);
  const todos = funcionarios();
  const nomes = (funcoes, roles, campo) => uniq([
    ...todos.filter(f => funcoes.includes(f.funcao)).map(f => f.nome),
    ...S.users.filter(u => u.active && roles.includes(u.role)).map(u => u.name),
    ...(campo ? used(campo) : [])]);
  const dl = (id, list) => `<datalist id="${id}">${list.map(n => `<option value="${esc(n)}"></option>`).join('')}</datalist>`;
  return dl('dl-prod', nomes(['Produtor', CARGO_DIRETOR], ['produtor', 'diretor'], 'produtorNome'))
    + dl('dl-rep', nomes(['Repórter', 'Apresentador'], ['reporter', 'apresentador'], 'reporterNome'))
    + dl('dl-cine', nomes(['Repórter cinematográfico'], [], 'cinegrafista'))
    + dl('dl-mot', nomes(['Motorista'], [], 'motorista'))
    + dl('dl-eimg', nomes(['Editor de imagens'], ['editor_imagem'], 'edicaoEditor'))
    + dl('dl-etxt', nomes(['Editor de texto'], ['editor'], 'editorTexto'));
}
// Os quatro pilares da pauta: Retranca, Proposta, Marcação, Informações
function pautaChecks(p) {
  const filled = (v) => String(v || '').trim().length > 0;
  return [
    ['Retranca', filled(p.retranca)],
    ['Proposta', filled(p.proposta)],
    ['Marcação', (p.entrevistados || []).some(e => filled(e.nome) && (filled(e.local) || filled(p.local)))],
    ['Informações', filled(p.historico)],
  ];
}
function checklistHtml(p) {
  const c = pautaChecks(p);
  return c.map(([l, ok]) => `<span class="ck ${ok ? 'ok' : ''}">${ok ? '✓' : '○'} ${l}</span>`).join('') +
    `<span class="hint">${c.filter(x => x[1]).length}/4 completos</span>`;
}
async function savePauta() {
  const p = S.pauta; if (!p) return;
  if (!String(p.retranca || '').trim()) return toast('Preencha a RETRANCA (nome da matéria).', true);
  if (!String(p.proposta || '').trim()) return toast('Preencha a PROPOSTA: o que se espera dessa matéria.', true);
  if (p.status === 'caiu' && !String(p.motivoQueda || '').trim()) { const m = $('[data-pf=motivoQueda]'); if (m) m.focus(); return toast('Explique o MOTIVO DA QUEDA antes de salvar a pauta como "Caiu".', true); }
  const missing = pautaChecks(p).filter(x => !x[1]).map(x => x[0]);
  if (['pronta', 'gravada', 'exibida'].includes(p.status) && missing.length)
    return toast(`Para marcar como "${label(PAUTA_STATUS, p.status)}" complete: ${missing.join(', ')}.`, true);
  clearTimeout(S.pAutoTimer);
  if (S.pSaving) await S.pSaving;   // evita criar a pauta duas vezes
  try {
    const saved = p.id ? await api('PUT', '/api/pautas/' + p.id, p) : await api('POST', '/api/pautas', p);
    S.pautaDirty = false; S.pConflict = null; clearDraft(Object.assign({}, p, { id: saved.id })); await releaseLocks();
    S.pauta = await api('GET', '/api/pautas/' + saved.id);
    toast('Pauta salva.');
    await loadPautas(); renderPautaList(); renderPautaEditor();
  } catch (e) {
    if (e.status === 409 && confirm(e.message + '\n\nSobrescrever mesmo assim?')) { p.force = true; await savePauta(); delete p.force; }
    else toast(e.message, true);
  }
}
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    if (S.view === 'pautas' && S.pauta) { e.preventDefault(); savePauta(); }
    if (S.view === 'espelho' && S.selItem) { e.preventDefault(); flushItem(true); }
    if (S.view === 'materias' && S.mat) { e.preventDefault(); saveMateria(true); }
  }
});
function sendToRundown(p) {
  const md = modal('Enviar pauta ao espelho', `
    <p class="hint">A retranca <b>${esc(p.retranca)}</b> será incluída no espelho escolhido, vinculada a esta pauta.</p>
    <div class="row2"><div class="field"><label>Telejornal</label><select id="sr-prog">${opts(S.programs.map(x => [x.id, x.name]), p.programaId || S.rd.programId)}</select></div>
    <div class="field"><label>Data</label><input type="date" id="sr-date" value="${p.data || today()}"></div></div>
    <div class="field"><label>Tipo</label><select id="sr-tipo">${opts(TIPOS, p.formato && TIPOS.includes(p.formato) ? p.formato : 'VT')}</select></div>`,
    { footer: '<button class="btn" data-close>Cancelar</button><button class="btn primary" id="sr-go">Incluir no espelho</button>' });
  $('#sr-go', md.el).onclick = async () => {
    try {
      const prog = $('#sr-prog', md.el).value, data = $('#sr-date', md.el).value;
      const rd = await api('GET', `/api/rundowns?programId=${prog}&data=${data}&create=1`);
      await api('POST', `/api/rundowns/${rd.id}/items`, { pautaId: p.id, tipo: $('#sr-tipo', md.el).value });
      md.close(); toast('Incluída no espelho.');
      S.rd.programId = prog; S.rd.date = data;
    } catch (e) { toast(e.message, true); }
  };
}

// =============================================================== ESPELHO
function computeRundown(rd) {
  const prog = rd.program || {}; const wpm = prog.wpm || 170;
  const start = toSec(prog.inicio || '00:00:00');
  let acc = 0, jorn = 0, breaks = 0, block = 1, n = 0;
  const rows = rd.items.map(it => {
    const isBreak = it.tipo === 'INTERVALO';
    const dead = it.status === 'caiu';
    let cab = 0, vt = 0;
    if (!isBreak) {
      cab = it.tempoCabManual ? toSec(it.tempoCabManual) : readSec(it.cabeca, wpm);
      vt = toSec(it.tempoVT);
      if (!vt && READ_TYPES.includes(it.tipo)) vt = readSec(it.texto, wpm);
    } else vt = toSec(it.tempoVT);
    const total = dead ? 0 : cab + vt;
    const hora = start + acc;
    let pagina;
    if (isBreak) pagina = 'INT';
    else { n++; pagina = String.fromCharCode(64 + Math.min(block, 26)) + n; }
    acc += total;
    if (isBreak) { breaks += total; } else jorn += total;
    const row = { it, cab, vt, total, hora, acc, pagina, block, isBreak, dead };
    if (isBreak) { block++; n = 0; }
    return row;
  });
  const previsto = toSec(prog.duracao || '0');
  return { rows, total: acc, jorn, breaks, previsto, saldo: previsto - acc, start, fim: start + acc, blocks: block };
}

async function loadRundown(create) {
  if (!S.rd.programId) { S.rundown = null; return; }
  S.rundown = await api('GET', `/api/rundowns?programId=${S.rd.programId}&data=${S.rd.date}${create ? '&create=1' : ''}`);
}
async function viewEspelho() {
  S.selItem = null;
  $('#main').innerHTML = `
  <div class="workspace ws-espelho">
    <div class="rd-toolbar">
      <select id="rd-prog" aria-label="Telejornal">${opts(S.programs.filter(p => p.ativo !== false).map(p => [p.id, p.name]), S.rd.programId)}</select>
      <div class="datenav"><button class="btn sm" data-d="-1" aria-label="Dia anterior">‹</button><input type="date" id="rd-date" value="${S.rd.date}"><button class="btn sm" data-d="1" aria-label="Próximo dia">›</button></div>
      <span id="rd-status"></span>
      <div class="timers" id="timers"></div>
    </div>
    <section class="pane"><div class="pane-h" id="rd-actions"></div><div class="pane-b" id="rd-grid"></div></section>
    <section class="pane story" id="story"></section>
  </div>`;
  $('#rd-prog').onchange = async e => { await flushItem(); await releaseLocks(); S.rd.programId = e.target.value; S.selItem = null; await refreshRundown(); };
  $('#rd-date').onchange = async e => { await flushItem(); await releaseLocks(); S.rd.date = e.target.value || today(); S.selItem = null; await refreshRundown(); };
  $$('.rd-toolbar [data-d]').forEach(b => b.onclick = async () => { await flushItem(); await releaseLocks(); S.rd.date = addDays(S.rd.date, +b.dataset.d); $('#rd-date').value = S.rd.date; S.selItem = null; await refreshRundown(); });
  await refreshRundown();
  S.pollTimer = setInterval(pollRundown, 4000);
}
async function refreshRundown() {
  try { await loadRundown(false); } catch (e) { toast(e.message, true); }
  renderRundown(); renderStory();
}
async function pollRundown() {
  if (S.view !== 'espelho' || !S.rundown || S.itemDirty) return;
  try {
    const fresh = await api('GET', '/api/rundowns/' + S.rundown.id);
    const changed = fresh.updatedAt !== S.rundown.updatedAt || JSON.stringify(fresh.items.map(i => i.lock)) !== JSON.stringify(S.rundown.items.map(i => i.lock));
    if (!changed) return;
    S.rundown = fresh; renderRundown();
    const storyFocused = document.activeElement && document.activeElement.closest('#story');
    if (!storyFocused) renderStory();
  } catch { }
}
function renderRundown() {
  const rd = S.rundown;
  const grid = $('#rd-grid'), actions = $('#rd-actions'), timers = $('#timers'), st = $('#rd-status');
  if (!grid) return;
  if (!rd) {
    timers.innerHTML = ''; st.innerHTML = ''; actions.innerHTML = '<h2>Espelho</h2>';
    const prog = S.programs.find(p => p.id === S.rd.programId);
    grid.innerHTML = prog ? `<div class="empty">Ainda não há espelho do <b>${esc(prog.name)}</b> para ${fmtDate(S.rd.date)}.<br><br><button class="btn primary" id="rd-create">Criar espelho</button></div>`
      : `<div class="empty">Cadastre um telejornal na aba “Telejornais”.</div>`;
    const b = $('#rd-create'); if (b) b.onclick = async () => { await loadRundown(true); renderRundown(); renderStory(); };
    return;
  }
  const C = computeRundown(rd);
  const closed = rd.status === 'fechado' && !S.perms.approveRundown;
  st.innerHTML = `<span class="rdstatus ${rd.status}">${label(RD_STATUS, rd.status)}</span>`;
  const T = (l, v, cls = '') => `<div class="timer ${cls}"><div class="t-l">${l}</div><div class="t-v">${v}</div></div>`;
  timers.innerHTML = T('Início', fmtClock(C.start)) + T('Previsto', fmtDur(C.previsto, true)) + T('Jornalismo', fmtDur(C.jorn, true)) + T('Intervalos', fmtDur(C.breaks))
    + T('Total', fmtDur(C.total, true)) + T(C.saldo >= 0 ? 'Sobra' : 'Estouro', fmtDur(Math.abs(C.saldo)), C.saldo < 0 ? 'over' : C.saldo > 0 ? 'under' : '') + T('Término', fmtClock(C.fim));
  actions.innerHTML = `<h2>Espelho · ${esc(rd.program.name)}</h2><span class="hint">${weekday(rd.data)}, ${fmtDate(rd.data)} · ${C.blocks} bloco(s)</span><div style="flex:1"></div>
    <div class="formbar">
      <button class="btn sm primary" data-a="add" ${closed ? 'disabled' : ''}>+ Retranca</button>
      <button class="btn sm" data-a="pauta" ${closed ? 'disabled' : ''}>+ Da pauta</button>
      <button class="btn sm" data-a="break" ${closed ? 'disabled' : ''}>+ Intervalo</button>
      <button class="btn sm onair-btn ${rd.status === 'no_ar' ? 'live' : ''}" data-a="onair" title="Modo no ar: o apresentador dá OK em cada retranca exibida">● No ar</button>
      <button class="btn sm" data-a="prompter">Prompter</button>
      <button class="btn sm" data-a="print">Imprimir</button>
      ${S.perms.approveRundown ? `<select class="btn sm" data-a="status" aria-label="Status do espelho" style="width:auto">${opts(RD_STATUS, rd.status)}</select>` : ''}
    </div>`;
  actions.onclick = (e) => { const a = e.target.closest('[data-a]'); if (!a || a.tagName === 'SELECT') return; rundownAction(a.dataset.a); };
  const ss = $('[data-a=status]', actions); if (ss) ss.onchange = async (e) => {
    try { S.rundown = await api('PUT', '/api/rundowns/' + rd.id, { status: e.target.value }); renderRundown(); renderStory(); toast('Espelho: ' + label(RD_STATUS, e.target.value)); } catch (er) { toast(er.message, true); }
  };
  let lastBlock = 0;
  const body = C.rows.map(r => {
    let head = '';
    if (!r.isBreak && r.block !== lastBlock) { lastBlock = r.block; head = `<tr class="blockhead"><td colspan="13">BLOCO ${r.block}</td></tr>`; }
    const it = r.it, sel = S.selItem === it.id;
    const lk = it.lock && !it.lock.mine ? ` <span class="lockico" title="Em edição por ${esc(it.lock.name)}">🔒</span>` : '';
    return head + `<tr class="row ${r.isBreak ? 'break' : ''} ${r.dead ? 'caiu' : ''} ${sel ? 'sel' : ''} ${it.aoArAt ? 'aired' : ''}" data-id="${it.id}" draggable="${!closed}" ${it.aoArAt ? `title="Foi ao ar às ${new Date(it.aoArAt).toLocaleTimeString('pt-BR')} (OK de ${esc(it.aoArPor || '')})"` : ''}>
      <td class="drag" title="Arraste para reordenar">⋮⋮</td>
      <td class="mono">${r.pagina}</td>
      <td class="retr">${esc(it.retranca)}${lk}${it.pautaId ? ' <span class="hint" title="Vinculada a pauta">◆</span>' : ''}</td>
      <td><span class="tipo tipo-${esc(it.tipo).replace(/[^A-Z+]/g, '')}">${esc(it.tipo)}</span></td>
      <td>${esc(it.apresentador)}</td><td>${esc(it.reporter)}</td><td>${esc(it.editor)}</td>
      <td class="num">${r.isBreak ? '' : fmtDur(r.cab)}</td><td class="num">${fmtDur(r.vt)}</td><td class="num"><b>${fmtDur(r.total)}</b></td>
      <td class="num">${fmtClock(r.hora)}</td>
      <td class="num" style="color:var(--muted)">${fmtDur(r.acc, true)}</td>
      <td>${it.aoArAt ? `<span class="pill aired-pill">✓ No ar ${new Date(it.aoArAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>` : r.isBreak ? '' : `<span class="pill st-${it.status}">${esc(label(ITEM_STATUS, it.status))}</span>`}</td></tr>`;
  }).join('');
  grid.innerHTML = `<table class="grid"><thead><tr><th></th><th>Pág</th><th>Retranca</th><th>Tipo</th><th>Apres.</th><th>Repórter</th><th>Editor</th><th style="text-align:right">Cab</th><th style="text-align:right">VT</th><th style="text-align:right">Total</th><th style="text-align:right">No ar</th><th style="text-align:right">Acum.</th><th>Status</th></tr></thead><tbody>${body}</tbody></table>
    ${rd.items.length ? '' : '<div class="empty">Espelho vazio.</div>'}`;
  grid.onclick = async (e) => { const tr = e.target.closest('tr.row'); if (tr) selectItem(tr.dataset.id); };
  // arrastar e soltar
  let dragId = null;
  $$('tr.row', grid).forEach(tr => {
    tr.addEventListener('dragstart', (e) => { dragId = tr.dataset.id; tr.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); });
    tr.addEventListener('dragend', () => { tr.classList.remove('dragging'); $$('.dragover', grid).forEach(x => x.classList.remove('dragover')); });
    tr.addEventListener('dragover', (e) => { if (!dragId) return; e.preventDefault(); $$('.dragover', grid).forEach(x => x.classList.remove('dragover')); tr.classList.add('dragover'); });
    tr.addEventListener('drop', async (e) => {
      e.preventDefault(); const target = tr.dataset.id; if (!dragId || dragId === target) return;
      const ids = rd.items.map(i => i.id).filter(id => id !== dragId);
      ids.splice(ids.indexOf(target), 0, dragId);
      await reorder(ids); dragId = null;
    });
  });
}
async function reorder(ids) {
  const rd = S.rundown;
  rd.items = ids.map(id => rd.items.find(i => i.id === id)); renderRundown();
  try { S.rundown = await api('POST', `/api/rundowns/${rd.id}/reorder`, { ids }); renderRundown(); }
  catch (e) { toast(e.message, true); await refreshRundown(); }
}
async function rundownAction(a) {
  const rd = S.rundown; if (!rd) return;
  try {
    if (a === 'add') { const it = await api('POST', `/api/rundowns/${rd.id}/items`, { afterId: S.selItem || undefined, apresentador: (rd.program.apresentadores || '').split(',')[0].trim().toUpperCase() }); await loadRundown(); await selectItem(it.id, true); }
    if (a === 'break') { const n = rd.items.filter(i => i.tipo === 'INTERVALO').length + 1; const it = await api('POST', `/api/rundowns/${rd.id}/items`, { afterId: S.selItem || undefined, retranca: 'INTERVALO ' + n, tipo: 'INTERVALO', tempoVT: '02:30' }); await loadRundown(); await selectItem(it.id); }
    if (a === 'pauta') pickPauta();
    if (a === 'print') printRundown();
    if (a === 'prompter') prompter();
    if (a === 'onair') { await flushItem(); openOnAir(); }
  } catch (e) { toast(e.message, true); }
}
async function pickPauta() {
  const rd = S.rundown;
  const list = (await api('GET', `/api/pautas?from=${addDays(rd.data, -3)}&to=${rd.data}`)).filter(p => p.status !== 'caiu');
  const used = new Set(rd.items.map(i => i.pautaId).filter(Boolean));
  const md = modal('Incluir retranca a partir da pauta', list.length ? `<p class="hint">Pautas dos últimos 3 dias. As já incluídas neste espelho aparecem marcadas.</p>
    <input type="search" id="pp-q" placeholder="Filtrar…" style="margin-bottom:8px">
    <table class="grid"><thead><tr><th>Retranca</th><th>Data</th><th>Status</th><th>Repórter</th><th>Formato</th><th></th></tr></thead><tbody>
    ${list.map(p => `<tr class="row" data-id="${p.id}" data-s="${esc((p.retranca + ' ' + repName(p)).toLowerCase())}"><td class="retr">${esc(p.retranca)}</td><td class="mono">${fmtDate(p.data)}</td><td><span class="pill st-${p.status}">${esc(label(PAUTA_STATUS, p.status))}</span></td><td>${esc(repName(p))}</td><td>${esc(p.formato)}</td><td>${used.has(p.id) ? '✓ no espelho' : '<button class="btn sm primary">Incluir</button>'}</td></tr>`).join('')}
    </tbody></table>` : '<div class="empty">Nenhuma pauta encontrada para os últimos dias.</div>', { wide: true });
  const q = $('#pp-q', md.el); if (q) q.oninput = () => $$('tr[data-s]', md.el).forEach(tr => tr.classList.toggle('hidden', !tr.dataset.s.includes(q.value.toLowerCase())));
  md.el.addEventListener('click', async (e) => {
    const b = e.target.closest('button.primary'); if (!b) return;
    const id = b.closest('tr').dataset.id; const p = list.find(x => x.id === id);
    try {
      const it = await api('POST', `/api/rundowns/${rd.id}/items`, { pautaId: id, tipo: TIPOS.includes(p.formato) ? p.formato : 'VT', afterId: S.selItem || undefined, apresentador: (rd.program.apresentadores || '').split(',')[0].trim().toUpperCase() });
      md.close(); await loadRundown(); await selectItem(it.id); toast('Retranca incluída.');
    } catch (er) { toast(er.message, true); }
  });
}
async function selectItem(id, focusRetranca) {
  if (S.selItem && S.selItem !== id) { await flushItem(); await releaseLocks(); }
  S.selItem = id; renderRundown(); renderStory();
  if (focusRetranca) setTimeout(() => { const r = $('#story [data-f=retranca]'); if (r) { r.focus(); r.select(); } }, 0);
}
const curItem = () => S.rundown && S.rundown.items.find(i => i.id === S.selItem);

function renderStory() {
  const el = $('#story'); if (!el) return;
  const it = curItem();
  if (!it) { el.innerHTML = `<div class="pane-h"><h2>Lauda</h2></div><div class="empty">Selecione uma retranca no espelho para editar a lauda.<br><br><span class="hint">Texto entre [colchetes] é instrução e não conta no tempo de leitura.</span></div>`; return; }
  const rd = S.rundown; const prog = rd.program;
  const closed = rd.status === 'fechado' && !S.perms.approveRundown;
  const lockedBy = it.lock && !it.lock.mine ? it.lock.name : null;
  const ro = (lockedBy || closed) ? 'disabled' : '';
  const isBreak = it.tipo === 'INTERVALO';
  const users = S.users.filter(u => u.active);
  const F = (k) => esc(it[k] || '');
  const stOpts = ITEM_STATUS.filter(([v]) => v !== 'aprovado' || S.perms.approveRundown || it.status === 'aprovado');
  el.innerHTML = `
    <div class="pane-h"><h2>Lauda</h2><span class="savestate" id="istate">${it.updatedByName ? 'Salvo · ' + esc(it.updatedByName) + ' ' + fmtDT(it.updatedAt) : 'Salvo'}</span>
      <div class="formbar">
        <button class="btn sm" data-m="-1" title="Subir" ${ro}>↑</button><button class="btn sm" data-m="1" title="Descer" ${ro}>↓</button>
        ${it.pautaId ? `<button class="btn sm" id="s-pauta">Ver pauta</button><button class="btn sm" id="s-imp" title="Copia o texto da matéria escrito na pauta para o texto do VT" ${ro}>Puxar matéria</button>` : ''}
        <button class="btn sm danger" id="s-del" ${ro}>Remover</button>
      </div></div>
    ${lockedBy ? `<div class="banner">🔒 Em edição por <b>${esc(lockedBy)}</b>. Modo leitura.</div>` : ''}
    ${closed ? `<div class="banner red">Espelho fechado pela edição. Somente editores podem alterar.</div>` : ''}
    <div class="pane-b"><div class="form" id="sform">
      <div class="field"><label>Retranca</label><input type="text" class="retranca-input" data-f="retranca" value="${F('retranca')}" maxlength="80" ${ro}></div>
      <div class="row3">
        <div class="field"><label>Tipo</label><select data-f="tipo" ${ro}>${opts(TIPOS, it.tipo)}</select></div>
        ${isBreak ? `<div class="field"><label>Duração do intervalo</label><input type="text" class="mono" data-f="tempoVT" value="${F('tempoVT')}" placeholder="mm:ss" ${ro}></div>` : `
        <div class="field"><label>Status</label><select data-f="status" ${ro}>${opts(stOpts, it.status)}</select></div>
        <div class="field"><label>Tempo VT / imagem</label><input type="text" class="mono" data-f="tempoVT" value="${F('tempoVT')}" placeholder="mm:ss" ${ro}></div>`}
      </div>
      ${isBreak ? `<div class="field"><label>Observação (comercial, chamadas)</label><textarea data-f="obs" rows="3" ${ro}>${F('obs')}</textarea></div>` : `
      <div class="row3">
        <div class="field"><label>Apresentador</label><input type="text" list="dl-apr" data-f="apresentador" value="${F('apresentador')}" ${ro}></div>
        <div class="field"><label>Repórter</label><input type="text" list="dl-users" data-f="reporter" value="${F('reporter')}" ${ro}></div>
        <div class="field"><label>Editor</label><input type="text" list="dl-users" data-f="editor" value="${F('editor')}" ${ro}></div>
      </div>
      <datalist id="dl-users">${users.map(u => `<option>${esc(u.name.toUpperCase())}</option>`).join('')}</datalist>
      <datalist id="dl-apr">${(prog.apresentadores || '').split(',').map(s => s.trim()).filter(Boolean).map(a => `<option>${esc(a.toUpperCase())}</option>`).join('')}${users.filter(u => u.role === 'apresentador').map(u => `<option>${esc(u.name.toUpperCase())}</option>`).join('')}</datalist>

      <div class="sec"><h3>Cabeça (leitura do apresentador) <span class="grow"></span><span class="readtime" id="rt-cab"></span></h3><div class="sb">
        <textarea class="lauda" data-f="cabeca" rows="6" placeholder="Texto lido pelo apresentador. [Instruções entre colchetes não contam tempo]" ${ro}>${F('cabeca')}</textarea>
        <div class="row2" style="margin-top:8px">
          <div class="field"><label>Tempo de cabeça manual (opcional)</label><input type="text" class="mono" data-f="tempoCabManual" value="${F('tempoCabManual')}" placeholder="auto" ${ro}></div>
          <div class="field"><label>Velocidade de leitura</label><input type="text" value="${prog.wpm || 170} palavras/min" disabled></div>
        </div>
      </div></div>
      <div class="sec"><h3>Texto do VT / Off / Nota <span class="grow"></span><span class="readtime" id="rt-txt"></span></h3><div class="sb">
        <textarea class="lauda" data-f="texto" rows="8" placeholder="[OFF] ...&#10;[SONORA] NOME / CARGO&#10;[PASSAGEM] ...&#10;Para NOTA/NC: texto lido pelo apresentador sobre imagens." ${ro}>${F('texto')}</textarea>
      </div></div>
      <div class="row2">
        <div class="field"><label>Deixa (últimas palavras do VT)</label><input type="text" class="mono" data-f="deixa" value="${F('deixa')}" style="text-transform:uppercase" ${ro}></div>
        <div class="field"><label>Observações da edição</label><input type="text" data-f="obs" value="${F('obs')}" ${ro}></div>
      </div>
      <div class="sec"><h3>GC — Gerador de caracteres</h3><div class="sb">
        <textarea class="lauda small" data-f="gc" rows="3" placeholder="NOME / CARGO (uma linha por crédito)" ${ro}>${F('gc')}</textarea>
      </div></div>`}
    </div></div>`;

  const updateRT = () => {
    const wpm = prog.wpm || 170;
    const a = $('#rt-cab'), b = $('#rt-txt');
    if (a) a.textContent = `${wordCount(it.cabeca)} palavras · ${fmtDur(it.tempoCabManual ? toSec(it.tempoCabManual) : readSec(it.cabeca, wpm))}`;
    if (b) b.textContent = `${wordCount(it.texto)} palavras · ${fmtDur(readSec(it.texto, wpm))}`;
  };
  updateRT();
  const form = $('#sform');
  const onEdit = async (e) => {
    const t = e.target; const k = t.dataset.f; if (!k) return;
    it[k] = (k === 'retranca') ? t.value.toUpperCase() : t.value;
    if (!S.itemDirty) {
      S.itemDirty = true;
      const r = await acquireLock('i:' + it.id);
      if (!r.ok) { toast(`Retranca em edição por ${r.lock.name}.`, true); }
    }
    const st = $('#istate'); if (st) { st.textContent = 'Editando…'; st.classList.add('dirty'); }
    updateRT();
    clearTimeout(S.itemSaveTimer); S.itemSaveTimer = setTimeout(() => flushItem(), 900);
    if (k === 'tipo' || k === 'status') { await flushItem(); renderStory(); }
  };
  form.addEventListener('input', onEdit);
  form.addEventListener('change', (e) => { if (e.target.tagName === 'SELECT') return; });
  $$('[data-m]', el).forEach(b => b.onclick = async () => {
    await flushItem();
    const ids = S.rundown.items.map(i => i.id); const k = ids.indexOf(it.id); const j = k + Number(b.dataset.m);
    if (j < 0 || j >= ids.length) return; [ids[k], ids[j]] = [ids[j], ids[k]]; await reorder(ids);
  });
  $('#s-del').onclick = async () => {
    if (!confirm(`Remover ${it.retranca} do espelho?`)) return;
    try { clearTimeout(S.itemSaveTimer); S.itemDirty = false; await api('DELETE', '/api/items/' + it.id); await releaseLocks(); S.selItem = null; await loadRundown(); renderRundown(); renderStory(); toast('Retranca removida.'); }
    catch (e) { toast(e.message, true); }
  };
  const sp = $('#s-pauta'); if (sp) sp.onclick = () => showPautaReadOnly(it.pautaId);
  const si = $('#s-imp'); if (si) si.onclick = async () => {
    try {
      const p = await api('GET', '/api/pautas/' + it.pautaId);
      if (!String(p.materia || '').trim()) return toast('A pauta ainda não tem matéria escrita.', true);
      if (String(it.texto || '').trim() && it.texto !== p.materia && !confirm('Substituir o texto atual do VT pela matéria da pauta?')) return;
      const ta = $('#story [data-f=texto]'); ta.value = p.materia;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      toast('Matéria copiada para a lauda.');
    } catch (e) { toast(e.message, true); }
  };
}
async function flushItem(showToast) {
  clearTimeout(S.itemSaveTimer);
  if (!S.itemDirty) return;
  const it = curItem(); if (!it) { S.itemDirty = false; return; }
  S.itemDirty = false;
  try {
    const saved = await api('PUT', '/api/items/' + it.id, it);
    Object.assign(it, saved);
    const st = $('#istate'); if (st) { st.textContent = 'Salvo'; st.classList.remove('dirty'); }
    renderRundown();
    if (showToast) toast('Lauda salva.');
  } catch (e) { toast(e.message, true); }
}
const showPautaReadOnly = (id) => openFicha(id);

// =============================================================== impressão / prompter
function pautaHtml(p, screen) {
  const block = (t, v) => v ? `<h2${screen ? ' style="font-size:12px;color:var(--accent);text-transform:uppercase;letter-spacing:.08em;margin:14px 0 4px"' : ''}>${t}</h2><pre style="white-space:pre-wrap;font:inherit;margin:0">${esc(v)}</pre>` : '';
  const ents = (p.entrevistados || []).filter(e => e.nome);
  const rot = (p.roteiro || []).filter(r => r.local || r.acao);
  return `<div>
    ${screen ? '' : `<h1>PAUTA — ${esc(p.retranca)}</h1>`}
    <div>${fmtDate(p.data)} · ${esc(p.editoria || '')} · ${esc(label(PAUTA_STATUS, p.status))} · Formato: ${esc(p.formato || '')}${p.programaId ? ' · ' + esc((S.programs.find(x => x.id === p.programaId) || {}).name || '') : ''}</div>
    <div>Produção: ${esc(prodName(p))} · Repórter: ${esc(repName(p))} · Cinegrafista: ${esc(p.cinegrafista || '')} · Motorista: ${esc(p.motorista || '')} · Editor de imagens: ${esc(p.edicaoEditor || '')} · Editor: ${esc(p.editorTexto || '')}</div>
    <div>Horário: ${esc(p.horario || '')} · Local: ${esc(p.local || '')} ${p.endereco ? '— ' + esc(p.endereco) : ''}</div>
    ${rot.length ? `<h2${screen ? ' style="font-size:12px;color:var(--accent);margin:14px 0 4px"' : ''}>ROTEIRO DE GRAVAÇÃO</h2><table class="${screen ? 'grid' : ''}"><tr><th>Hora</th><th>Local</th><th>O que gravar</th></tr>${rot.map(r => `<tr><td>${esc(r.hora)}</td><td>${esc(r.local)}</td><td>${esc(r.acao)}</td></tr>`).join('')}</table>` : ''}
    ${p.status === 'caiu' ? block('Motivo da queda', p.motivoQueda || '—') : ''}
    ${block('Proposta', p.proposta)}
    ${ents.length ? `<h2${screen ? ' style="font-size:12px;color:var(--accent);margin:14px 0 4px"' : ''}>MARCAÇÃO</h2><table class="${screen ? 'grid' : ''}"><tr><th>Nome</th><th>Função</th><th>Contato</th><th>Data/Hora</th><th>Local</th><th>Conf.</th></tr>${ents.map(e => `<tr><td>${esc(e.nome)}</td><td>${esc(e.funcao)}</td><td>${esc(e.telefone)}</td><td>${fmtDate(e.data)} ${esc(e.horario)}</td><td>${esc(e.local)}${e.obs ? '<br><i>' + esc(e.obs) + '</i>' : ''}</td><td>${e.confirmado ? 'Sim' : 'Não'}</td></tr>`).join('')}</table>` : ''}
    ${block('Informações', p.historico)}
    ${String(p.materia || '').trim() ? `<h2${screen ? ' style="font-size:12px;color:var(--accent);text-transform:uppercase;letter-spacing:.08em;margin:14px 0 4px"' : ''}>Matéria — ${esc(label(MATERIA_STATUS, p.materiaStatus || 'rascunho'))}${p.materiaAutorId ? ` · ${esc(userName(p.materiaAutorId))}, ${fmtDT(p.materiaAt)}` : ''} · ${materiaStats(p.materia)}</h2>
      <pre class="${screen ? 'materia-view' : ''}" style="white-space:pre-wrap;margin:0;${screen ? '' : 'font:inherit'}">${markScript(esc(p.materia), screen)}</pre>` : ''}
    ${block('Encaminhamento', p.encaminhamento)}
    ${block('Sugestão de perguntas', p.perguntas)}${block('Imagens', p.imagens)}${block('Arte', p.arte)}${block('Observações', p.observacoes)}
  </div>`;
}
// realça as marcações de roteiro [OFF], [SONORA]… (recebe texto já escapado)
const markScript = (html, screen) => html.replace(/\[([^\]\n]{1,40})\]/g, screen ? '<b class="tag">[$1]</b>' : '<b>[$1]</b>');
function doPrint(html) { $('#print-area').innerHTML = html;
  Promise.all($$('#print-area img').map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; }))).then(() => window.print()); }
// Impressão / PDF com a identidade da emissora: escolhe pauta, matéria ou as duas
function printPauta(p, preset) {
  const temMat = String(p.materia || '').trim().length > 0;
  const def = preset || (temMat ? 'ambos' : 'pauta');
  const opt = (v, t, d, dis) => `<label class="printopt ${dis ? 'dis' : ''}"><input type="radio" name="pm" value="${v}" ${v === def ? 'checked' : ''} ${dis ? 'disabled' : ''}><span><b>${t}</b><br><span class="hint">${d}</span></span></label>`;
  const md = modal(`Imprimir ou baixar PDF · ${p.retranca}`, `
    <div class="printopts">
      ${opt('ambos', 'Pauta + Matéria', 'A pauta completa e, em nova página, o texto da matéria.', !temMat)}
      ${opt('pauta', 'Só a pauta', 'Retranca, proposta, marcação, informações e encaminhamento.')}
      ${opt('materia', 'Só a matéria', 'O texto do repórter em formato de lauda (marcação | texto).', !temMat)}
    </div>
    ${temMat ? '' : '<p class="hint">Esta pauta ainda não tem matéria escrita.</p>'}
    <p class="hint" style="margin-bottom:0"><b>Baixar PDF</b> salva o arquivo direto no computador, com o logotipo e o rodapé da emissora em todas as páginas.</p>`,
    { footer: '<button class="btn" data-close>Cancelar</button><button class="btn" id="pprint">Imprimir</button><button class="btn primary" id="pgo">⬇ Baixar PDF</button>' });
  const choice = () => $('input[name=pm]:checked', md.el).value;
  $('#pprint', md.el).onclick = () => { const v = choice(); md.close(); printDoc(p, v); };
  $('#pgo', md.el).onclick = () => { const v = choice(); md.close(); printDoc(p, v, true); };
}
// divide a matéria em blocos [MARCAÇÃO] complemento + texto
function parseScript(text) {
  const rows = []; let cur = null;
  String(text || '').replace(/\r/g, '').split('\n').forEach(line => {
    const m = line.match(/^\s*\[([^\]\n]{1,40})\]\s*(.*)$/);
    if (m) { cur = { tag: m[1].trim().toUpperCase(), sub: '', body: [] }; rows.push(cur);
      // complemento na mesma linha: "NOME / CARGO" fica na coluna da marcação; frase longa vai para o texto
      if (m[2] && (/^[^a-zà-ú]*$/.test(m[2]) || m[2].length <= 40) && !/[.!?"]$/.test(m[2])) cur.sub = m[2]; else if (m[2]) cur.body.push(m[2]);
    } else { if (!cur) { cur = { tag: '', sub: '', body: [] }; rows.push(cur); } cur.body.push(line); }
  });
  return rows.map(r => Object.assign(r, { body: r.body.join('\n').replace(/^\n+|\n+$/g, '') })).filter(r => r.tag || r.body);
}
function printDoc(p, mode, download) {
  const o = S.org || {}; const color = o.printColor || '#0b3566';
  const prog = p.programaId ? (S.programs.find(x => x.id === p.programaId) || {}).name || '' : '';
  const head = (kind) => `<div class="doc-h">
      <div class="doc-logo"><img src="${esc(orgLogo())}" alt="${esc(o.name || '')}"></div>
      <div class="doc-t"><div class="doc-kind">${kind}</div><div class="doc-retr">${esc(p.retranca)}</div>
        <div class="doc-sub">${p.data ? `${esc(weekday(p.data))}, ${fmtDate(p.data)}` : ''}${prog ? ' · ' + esc(prog) : ''}</div></div></div>`;
  const meta = (pairs) => `<table class="doc-meta"><tbody>${pairs.reduce((acc, x, i) => { if (i % 3 === 0) acc.push([]); acc[acc.length - 1].push(x); return acc; }, [])
    .map(row => `<tr>${row.map(([l, v]) => `<th>${l}</th><td>${esc(v || '—')}</td>`).join('')}${'<th></th><td></td>'.repeat(3 - row.length)}</tr>`).join('')}</tbody></table>`;
  const sec = (t, body) => body ? `<div class="doc-sec"><div class="doc-st">${t}</div>${body}</div>` : '';
  const txt = (v) => String(v || '').trim() ? `<div class="doc-txt">${esc(v)}</div>` : '';
  const ents = (p.entrevistados || []).filter(e => e.nome);
  const rot = (p.roteiro || []).filter(r => r.local || r.acao);

  const pautaPart = () => `<div class="doc">${head('PAUTA')}
    ${meta([['Editoria', p.editoria], ['Formato', p.formato], ['Status', label(PAUTA_STATUS, p.status)],
      ['Repórter', repName(p)], ['Cinegrafista', p.cinegrafista], ['Motorista', p.motorista],
      ['Produção', prodName(p)], ['Editor de texto', p.editorTexto], ['Editor de imagens', p.edicaoEditor], ['Saída / início', p.horario],
      ['Prioridade', label(PRIORIDADES, p.prioridade)]])}
    ${p.status === 'caiu' ? sec('Motivo da queda', txt(p.motivoQueda || '—')) : ''}
    ${sec('Proposta', txt(p.proposta))}
    ${sec('Marcação', (ents.length ? `<table class="doc-tab"><thead><tr><th>Entrevistado</th><th>Função</th><th>Contato</th><th>Data / hora</th><th>Local</th><th>Conf.</th></tr></thead><tbody>
        ${ents.map(e => `<tr><td data-l="Entrevistado"><b>${esc(e.nome)}</b></td><td data-l="Função">${esc(e.funcao)}</td><td data-l="Contato">${esc(e.telefone)}</td><td data-l="Data / hora">${fmtDate(e.data)} ${esc(e.horario)}</td><td data-l="Local">${esc(e.local)}${e.obs ? `<div class="doc-obs">${esc(e.obs)}</div>` : ''}</td><td data-l="Confirmado">${e.confirmado ? '✓ Sim' : 'Não'}</td></tr>`).join('')}</tbody></table>` : '')
      + (p.local || p.endereco ? `<div class="doc-txt" style="margin-top:6px"><b>Local principal:</b> ${esc(p.local || '')}${p.endereco ? ' — ' + esc(p.endereco) : ''}${p.horario ? ` · <b>Horário:</b> ${esc(p.horario)}` : ''}</div>` : '')
      + (rot.length ? `<table class="doc-tab" style="margin-top:6px"><thead><tr><th style="width:60px">Hora</th><th>Local</th><th>O que gravar</th></tr></thead><tbody>${rot.map(r => `<tr><td data-l="Hora">${esc(r.hora)}</td><td data-l="Local">${esc(r.local)}</td><td data-l="O que gravar">${esc(r.acao)}</td></tr>`).join('')}</tbody></table>` : ''))}
    ${sec('Informações', txt(p.historico))}
    ${sec('Encaminhamento', txt(p.encaminhamento))}
    ${sec('Sugestão de perguntas', txt(p.perguntas))}
    ${sec('Imagens', txt(p.imagens))}${sec('Arte', txt(p.arte))}${sec('Observações', txt(p.observacoes))}
  </div>`;

  const materiaPart = () => {
    const rows = parseScript(p.materia); const w = wordCount(p.materia);
    return `<div class="doc">${head('MATÉRIA')}
    ${meta([['Repórter', repName(p) || userName(p.materiaAutorId)], ['Situação', label(MATERIA_STATUS, p.materiaStatus || 'rascunho')], ['Formato', p.formato],
      ['Palavras', String(w)], ['Tempo estimado', w ? fmtDur(Math.round(w * 60 / 170)) : ''], ['Última edição', p.materiaAutorId ? `${userName(p.materiaAutorId)} · ${fmtDT(p.materiaAt)}` : '']])}
    <table class="doc-script"><thead><tr><th>Marcação</th><th>Texto</th></tr></thead><tbody>
      ${rows.map(r => `<tr class="k-${esc(r.tag.split(/\s/)[0].toLowerCase())}"><td>${r.tag ? `<b>${esc(r.tag)}</b>` : ''}${r.sub ? `<div>${esc(r.sub)}</div>` : ''}</td><td>${esc(r.body)}</td></tr>`).join('')}
    </tbody></table>
    ${p.proposta ? `<div class="doc-sec"><div class="doc-st">Proposta da pauta</div><div class="doc-txt">${esc(p.proposta)}</div></div>` : ''}
  </div>`;
  };

  if (mode === 'tela') return { pauta: pautaPart(), materia: String(p.materia || '').trim() ? materiaPart() : '',
    brand: /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#0b3566', rodape: `${o.name || ''}${o.printFooter ? ' · ' + o.printFooter : ''}` };

  const parts = mode === 'pauta' ? [pautaPart()] : mode === 'materia' ? [materiaPart()] : [pautaPart(), materiaPart()];
  const brand = /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#0b3566';
  const fileName = `${mode === 'materia' ? 'MATERIA' : 'PAUTA'} - ${p.retranca} - ${fmtDate(p.data).replace(/\//g, '-')}`;
  const footL = `${o.name || ''}${o.printFooter ? ' · ' + o.printFooter : ''}`;
  const footR = `${download ? 'Gerado' : 'Impresso'} por ${S.me.name} em ${new Date().toLocaleString('pt-BR')}`;
  if (download) return downloadPdf(p, mode, brand, fileName, footL, footR);
  const foot = `<div class="doc-f"><span>${esc(footL)}</span><span>${esc(footR)}</span></div>`;
  const oldTitle = document.title;
  // o título vira o nome sugerido do arquivo PDF
  document.title = fileName;
  const restore = () => { document.title = oldTitle; window.removeEventListener('afterprint', restore); };
  window.addEventListener('afterprint', restore);
  $('#print-area').innerHTML = `<div class="docs" style="--brand:${brand}">${parts.join('')}${foot}</div>`;
  const imgs = $$('#print-area img');
  Promise.all(imgs.map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; }))).then(() => { window.print(); setTimeout(restore, 1000); });
}
// Baixa o PDF direto, VETORIAL (texto, linhas e tabelas nítidos em qualquer zoom),
// com logotipo, cor e rodapé da emissora em todas as páginas.
const WINANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
// fontes padrão do PDF só têm o alfabeto latino: troca o que não existe nelas
const pdfSafe = (s) => String(s == null ? '' : s).normalize('NFC').replace(/[✓✔]/g, 'Sim').replace(/\t/g, '    ')
  .replace(/[^\n\x20-\x7e\xa0-\xff]/g, c => WINANSI_EXTRA.includes(c) ? c : '');
// carrega o logotipo como imagem nítida (SVG é convertido em PNG de alta resolução)
function pdfLogo(src) {
  return new Promise((ok) => {
    if (!src) return ok(null);
    const img = new Image();
    img.onerror = () => ok(null);
    img.onload = () => {
      const isSvg = src.startsWith('data:image/svg');
      const w = img.naturalWidth || 600, h = img.naturalHeight || 240;
      if (!isSvg && /^data:image\/(png|jpeg)/.test(src)) return ok({ data: src, fmt: src.startsWith('data:image/png') ? 'PNG' : 'JPEG', w, h });
      const k = /\.png$/.test(src) ? 1 : Math.max(1, 2400 / w);   // webp/svg → PNG grande; arquivo PNG mantém o tamanho
      const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      ok({ data: c.toDataURL('image/png'), fmt: 'PNG', w: c.width, h: c.height });
    };
    img.src = src;
  });
}
async function downloadPdf(p, mode, brandHex, fileName, footL, footR) {
  toast('Gerando PDF…');
  try {
    if (!window.jspdf) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    if (!window.jspdf.jsPDF.API.autoTable) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
  } catch { return toast('Não foi possível carregar o gerador de PDF. Verifique a internet ou use Imprimir → Salvar como PDF.', true); }
  try {
    const o = S.org || {};
    const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', compress: true });
    doc.setProperties({ title: fileName, author: o.name || '', creator: 'Redação' });
    const W = 210, H = 297, M = 14, TOP = 16, BOT = H - 20, CW = W - 2 * M;
    const B = [1, 3, 5].map(i => parseInt(brandHex.slice(i, i + 2), 16));
    const GRAY = [90, 96, 105], LINE = [214, 219, 225], SOFT = [243, 245, 248];
    const logo = await pdfLogo(orgLogo());
    const prog = p.programaId ? (S.programs.find(x => x.id === p.programaId) || {}).name || '' : '';
    let y = TOP;
    const font = (style, size, color) => { doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor(...(color || [20, 22, 26])); };
    const lh = (size, f = 1.38) => size * 0.3528 * f;      // altura da linha em mm
    const ensure = (h) => { if (y + h > BOT) { doc.addPage(); y = TOP; } };

    const header = (kind) => {
      const top = y;
      let leftBottom = top + 20;
      if (logo) {
        const s = Math.min(50 / logo.w, 20 / logo.h); const lw = logo.w * s, lhh = logo.h * s;
        doc.addImage(logo.data, logo.fmt, M, top + (20 - lhh) / 2, lw, lhh, undefined, 'FAST');
      } else { font('bold', 15, B); doc.text(pdfSafe(o.name || ''), M, top + 11); }
      // etiqueta PAUTA / MATÉRIA
      font('bold', 8, [255, 255, 255]);
      const tw = doc.getTextWidth(kind) + kind.length * 0.6 + 7;
      doc.setFillColor(...B); doc.roundedRect(W - M - tw, top, tw, 6, 0.8, 0.8, 'F');
      doc.text(kind, W - M - tw / 2, top + 4.2, { align: 'center', charSpace: 0.6 });
      // retranca
      font('bold', 17);
      const rl = doc.splitTextToSize(pdfSafe(p.retranca), 122);
      let ry = top + 12.5;
      rl.forEach(l => { doc.text(l, W - M, ry, { align: 'right' }); ry += lh(17, 1.15); });
      const sub = `${p.data ? weekday(p.data).replace(/^./, c => c.toUpperCase()) + ', ' + fmtDate(p.data) : ''}${prog ? ' · ' + prog : ''}`;
      font('normal', 9, GRAY); doc.text(pdfSafe(sub), W - M, ry - 1.5, { align: 'right' });
      const bottom = Math.max(leftBottom, ry) + 2;
      doc.setDrawColor(...B); doc.setLineWidth(1.1); doc.line(M, bottom, W - M, bottom);
      y = bottom + 4;
    };
    const metaTable = (pairs) => {
      const rows = []; for (let i = 0; i < pairs.length; i += 3) rows.push(pairs.slice(i, i + 3));
      const body = rows.map(r => { const c = []; for (let i = 0; i < 3; i++) { const x = r[i]; c.push(x ? pdfSafe(x[0]).toUpperCase() : '', x ? pdfSafe(x[1] || '—') : ''); } return c; });
      const thStyle = { fillColor: SOFT, textColor: B, fontStyle: 'bold', fontSize: 6.6, cellWidth: 30 };
      doc.autoTable({ startY: y, margin: { left: M, right: M, top: TOP, bottom: H - BOT }, body, theme: 'plain',
        styles: { font: 'helvetica', fontSize: 9, textColor: [20, 22, 26], cellPadding: { top: 1.7, bottom: 1.7, left: 2, right: 2 }, lineColor: LINE, lineWidth: { bottom: 0.2 }, valign: 'middle' },
        columnStyles: { 0: thStyle, 2: thStyle, 4: thStyle } });
      y = doc.lastAutoTable.finalY + 5;
    };
    const secTitle = (t) => {
      ensure(14);
      font('bold', 8.5, B); doc.text(pdfSafe(t).toUpperCase(), M, y + 3.5, { charSpace: 0.4 });
      doc.setDrawColor(...B); doc.setLineWidth(0.35); doc.line(M, y + 5, W - M, y + 5);
      y += 8;
    };
    const para = (txt, size = 10.5, style = 'normal') => {
      font(style, size);
      const h = lh(size);
      String(pdfSafe(txt)).split('\n').forEach(par => {
        const lines = par.trim() ? doc.splitTextToSize(par, CW) : [''];
        lines.forEach(l => { ensure(h); doc.text(l, M, y + h * 0.78); y += h; });
      });
      y += 3;
    };
    const section = (t, txt) => { if (String(txt || '').trim()) { secTitle(t); para(txt); } };
    const gridTable = (head, body, colStyles = {}) => {
      doc.autoTable({ startY: y, margin: { left: M, right: M, top: TOP, bottom: H - BOT }, head: [head.map(pdfSafe)], body: body.map(r => r.map(pdfSafe)), theme: 'grid',
        styles: { font: 'helvetica', fontSize: 8.6, textColor: [20, 22, 26], lineColor: [204, 210, 217], lineWidth: 0.2, cellPadding: 1.8, valign: 'top' },
        headStyles: { fillColor: B, textColor: 255, fontStyle: 'bold', fontSize: 7.2, lineColor: B },
        columnStyles: colStyles });
      y = doc.lastAutoTable.finalY + 4;
    };

    const pautaDoc = () => {
      header('PAUTA');
      metaTable([['Editoria', p.editoria], ['Formato', p.formato], ['Status', label(PAUTA_STATUS, p.status)],
        ['Repórter', repName(p)], ['Cinegrafista', p.cinegrafista], ['Motorista', p.motorista],
        ['Produção', prodName(p)], ['Editor de texto', p.editorTexto], ['Editor de imagens', p.edicaoEditor], ['Saída / início', p.horario],
        ['Prioridade', label(PRIORIDADES, p.prioridade)]]);
      if (p.status === 'caiu') section('Motivo da queda', p.motivoQueda || '—');
      section('Proposta', p.proposta);
      const ents = (p.entrevistados || []).filter(e => e.nome);
      const rot = (p.roteiro || []).filter(r => r.local || r.acao);
      if (ents.length || p.local || p.endereco || rot.length) {
        secTitle('Marcação');
        if (ents.length) gridTable(['Entrevistado', 'Função', 'Contato', 'Data / hora', 'Local', 'Conf.'],
          ents.map(e => [e.nome, e.funcao, e.telefone, `${fmtDate(e.data)} ${e.horario || ''}`.trim(), (e.local || '') + (e.obs ? `\nObs.: ${e.obs}` : ''), e.confirmado ? 'Sim' : 'Não']),
          { 0: { fontStyle: 'bold' }, 5: { cellWidth: 13, halign: 'center' } });
        if (p.local || p.endereco) para(`Local principal: ${p.local || ''}${p.endereco ? ' — ' + p.endereco : ''}${p.horario ? ' · Horário: ' + p.horario : ''}`, 9.5);
        if (rot.length) gridTable(['Hora', 'Local', 'O que gravar'], rot.map(r => [r.hora, r.local, r.acao]), { 0: { cellWidth: 16 } });
      }
      section('Informações', p.historico);
      section('Encaminhamento', p.encaminhamento);
      section('Sugestão de perguntas', p.perguntas);
      section('Imagens', p.imagens); section('Arte', p.arte); section('Observações', p.observacoes);
    };
    const materiaDoc = () => {
      header('MATÉRIA');
      const w = wordCount(p.materia);
      metaTable([['Repórter', repName(p) || userName(p.materiaAutorId)], ['Situação', label(MATERIA_STATUS, p.materiaStatus || 'rascunho')], ['Formato', p.formato],
        ['Palavras', String(w)], ['Tempo estimado', w ? fmtDur(Math.round(w * 60 / 170)) : ''], ['Última edição', p.materiaAutorId ? `${userName(p.materiaAutorId)} · ${fmtDT(p.materiaAt)}` : '']]);
      const rows = parseScript(p.materia);
      doc.autoTable({ startY: y, margin: { left: M, right: M, top: TOP, bottom: H - BOT }, theme: 'plain',
        head: [['MARCAÇÃO', 'TEXTO']],
        body: rows.map(r => [pdfSafe(r.tag + (r.sub ? '\n' + r.sub : '')), pdfSafe(r.body)]),
        styles: { font: 'helvetica', fontSize: 11.5, textColor: [20, 22, 26], cellPadding: { top: 2.6, bottom: 2.6, left: 3, right: 3 }, lineColor: LINE, lineWidth: { bottom: 0.2 }, valign: 'top', minCellHeight: 8 },
        headStyles: { fillColor: B, textColor: 255, fontStyle: 'bold', fontSize: 7.5, lineWidth: 0 },
        columnStyles: { 0: { cellWidth: 50, fontSize: 9, fontStyle: 'bold', textColor: B } },
        didParseCell: (d) => { if (d.section === 'body' && d.column.index === 1 && /^(SONORA|PASSAGEM)/.test(rows[d.row.index].tag)) d.cell.styles.fontStyle = 'italic'; },
        didDrawCell: (d) => { if (d.section === 'body' && d.column.index === 0) { doc.setDrawColor(...B); doc.setLineWidth(0.6); doc.line(d.cell.x + d.cell.width, d.cell.y, d.cell.x + d.cell.width, d.cell.y + d.cell.height); } } });
      y = doc.lastAutoTable.finalY + 6;
      section('Proposta da pauta', p.proposta);
    };

    if (mode !== 'materia') pautaDoc();
    if (mode !== 'pauta') { if (mode === 'ambos') { doc.addPage(); y = TOP; } materiaDoc(); }

    // rodapé em todas as páginas
    const n = doc.internal.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      doc.setDrawColor(...LINE); doc.setLineWidth(0.3); doc.line(M, H - 13, W - M, H - 13);
      font('normal', 7.5, GRAY);
      doc.text(pdfSafe(footL), M, H - 9);
      doc.text(pdfSafe(`${footR} · página ${i} de ${n}`), W - M, H - 9, { align: 'right' });
    }
    const safe = fileName.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w .-]+/g, ' ').replace(/\s+/g, ' ').trim();
    doc.save(safe + '.pdf');
    toast('PDF baixado.');
  } catch (e) { console.error(e); toast('Erro ao gerar o PDF: ' + e.message, true); }
}
function printPautaList() {
  doPrint(`<img class="list-logo" src="${esc(orgLogo())}" alt=""><h1>Pautas — ${S.pf.allDates ? 'todas as datas' : fmtDate(S.pf.date)}</h1><div style="font-size:9pt">${esc(S.org.name)}</div><br>
    <table><tr><th>Retranca</th><th>Data</th><th>Hora</th><th>Status</th><th>Editoria</th><th>Repórter</th><th>Local</th><th>Proposta</th></tr>
    ${S.pautas.map(p => `<tr><td><b>${esc(p.retranca)}</b></td><td>${fmtDate(p.data)}</td><td>${esc(p.horario)}</td><td>${esc(label(PAUTA_STATUS, p.status))}</td><td>${esc(p.editoria)}</td><td>${esc(repName(p))}</td><td>${esc(p.local)}</td><td>${esc(p.proposta)}</td></tr>`).join('')}</table>`);
}
// =============================================================== CAPA DA PAUTA (cronograma do dia seguinte)
const capaObsKey = (d) => `redacao:capa-obs:${d}`;
const lerCapaObs = (d) => { try { return localStorage.getItem(capaObsKey(d)) || ''; } catch { return ''; } };
const guardarCapaObs = (d, v) => { try { v ? localStorage.setItem(capaObsKey(d), v) : localStorage.removeItem(capaObsKey(d)); } catch { /* armazenamento indisponível */ } };
const capaTitulo = (d) => `${weekday(d).replace(/^./, c => c.toUpperCase())}, ${fmtDate(d)}`;
// cada pauta vira uma linha do cronograma: [horário, pauta, equipe, local e marcação]; cada célula é uma lista de linhas
function capaLinhas(lista) {
  return lista.map(p => {
    const prog = p.programaId ? (S.programs.find(x => x.id === p.programaId) || {}).name || '' : '';
    const par = (r, v) => v ? `${r}: ${v}` : '';
    const marc = (p.entrevistados || []).filter(e => e.nome).map(e => [e.horario, e.nome, e.funcao, e.telefone, e.confirmado ? '' : '(a confirmar)'].filter(Boolean).join(' · '));
    return {
      hora: p.horario || '—',
      retranca: p.retranca,
      pauta: [[prog, p.editoria, p.formato].filter(Boolean).join(' · '), label(PAUTA_STATUS, p.status), p.status === 'caiu' ? par('Motivo', p.motivoQueda) : ''].filter(Boolean),
      equipe: [par('Repórter', repName(p)), par('Cinegrafista', p.cinegrafista), par('Motorista', p.motorista), par('Produção', prodName(p))].filter(Boolean),
      local: [[p.local, p.endereco].filter(Boolean).join(' — '), ...marc].filter(Boolean),
    };
  });
}
function capaHtml(d, linhas, obs) {
  const o = S.org || {};
  const cel = (arr) => `<div>${arr.map(x => `<div>${esc(x)}</div>`).join('') || '—'}</div>`;
  return `<div class="doc">
    <div class="doc-h"><div class="doc-logo"><img src="${esc(orgLogo())}" alt="${esc(o.name || '')}"></div>
      <div class="doc-t"><div class="doc-kind">CAPA DA PAUTA</div><div class="doc-retr">Cronograma do dia</div><div class="doc-sub" style="text-transform:none">${esc(capaTitulo(d))} · ${linhas.length} pauta(s)</div></div></div>
    ${linhas.length ? `<table class="doc-tab doc-capa"><thead><tr><th style="width:56px">Horário</th><th style="width:30%">Pauta</th><th style="width:26%">Equipe</th><th>Local e marcação</th></tr></thead><tbody>
      ${linhas.map(l => `<tr><td data-l="Horário"><div><b>${esc(l.hora)}</b></div></td><td data-l="Pauta"><div><b>${esc(l.retranca)}</b>${l.pauta.map(x => `<div>${esc(x)}</div>`).join('')}</div></td><td data-l="Equipe">${cel(l.equipe)}</td><td data-l="Local">${cel(l.local)}</td></tr>`).join('')}
    </tbody></table>` : '<p>Nenhuma pauta marcada para esta data.</p>'}
    ${obs.trim() ? `<div class="doc-sec"><div class="doc-st">Observações do dia</div><div class="doc-txt">${esc(obs)}</div></div>` : ''}
  </div>`;
}
function openCapa() {
  const o = S.org || {};
  const brand = /^#[0-9a-fA-F]{6}$/.test(o.printColor || '') ? o.printColor : '#0b3566';
  const amanha = addDays(today(), 1);
  const md = modal('Capa da pauta', `
    <div class="capa-form">
      <div class="field"><label for="capa-data">Data do cronograma</label><input type="date" id="capa-data" value="${amanha}"></div>
      <label class="check"><input type="checkbox" id="capa-caiu"> Incluir pautas que caíram</label>
      <div class="field capa-obs"><label for="capa-obs">Observações do dia (opcional)</label><textarea id="capa-obs" rows="2" placeholder="Plantão, avisos à equipe, equipamentos…">${esc(lerCapaObs(amanha))}</textarea>
        <span class="hint">As observações entram no documento e ficam guardadas só neste aparelho.</span></div>
    </div>
    <div class="${isMobile() ? 'docview ' : ''}capa-view pdf-render"><div class="docs" style="--brand:${brand}" id="capa-doc"></div></div>`,
    { wide: true, footer: '<button class="btn" data-close>Fechar</button><button class="btn" id="capa-print" disabled>Imprimir</button><button class="btn primary" id="capa-pdf" disabled>⬇ Baixar PDF</button>' });
  md.el.classList.add('ficha-modal', 'capa-modal'); if (document.activeElement) document.activeElement.blur();
  const data = $('#capa-data', md.el), obs = $('#capa-obs', md.el), caiu = $('#capa-caiu', md.el);
  let todas = [], pronta = false, seq = 0;
  const linhas = () => capaLinhas(todas.filter(p => caiu.checked || p.status !== 'caiu'));
  const botoes = () => $$('#capa-print, #capa-pdf', md.el).forEach(b => { b.disabled = !pronta; });
  const desenhar = () => { if (pronta) $('#capa-doc', md.el).innerHTML = capaHtml(data.value, linhas(), obs.value); };
  const carregar = async () => {
    const meu = ++seq, d = data.value; pronta = false; botoes();
    if (!d) { $('#capa-doc', md.el).innerHTML = '<p>Escolha a data.</p>'; return; }
    $('#capa-doc', md.el).innerHTML = '<p>Carregando…</p>';
    try {
      const lista = await api('GET', `/api/pautas?from=${d}&to=${d}`);
      if (meu !== seq) return;   // a data mudou enquanto carregava
      todas = lista.sort((a, b) => (a.horario || '99').localeCompare(b.horario || '99') || a.retranca.localeCompare(b.retranca));
      pronta = true; botoes(); desenhar();
    } catch (e) { if (meu === seq) { $('#capa-doc', md.el).innerHTML = '<p>Não foi possível carregar as pautas.</p>'; toast(e.message, true); } }
  };
  data.onchange = () => { obs.value = lerCapaObs(data.value); carregar(); };
  caiu.onchange = desenhar;
  obs.oninput = () => { guardarCapaObs(data.value, obs.value); desenhar(); };
  $('#capa-print', md.el).onclick = () => {
    const foot = `<div class="doc-f"><span>${esc(`${o.name || ''}${o.printFooter ? ' · ' + o.printFooter : ''}`)}</span><span>${esc(`Impresso por ${S.me.name} em ${new Date().toLocaleString('pt-BR')}`)}</span></div>`;
    const titulo = document.title; document.title = `CAPA DA PAUTA - ${fmtDate(data.value).replace(/\//g, '-')}`;
    $('#print-area').innerHTML = `<div class="docs" style="--brand:${brand}">${capaHtml(data.value, linhas(), obs.value)}${foot}</div>`;
    Promise.all($$('#print-area img').map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; }))).then(() => { window.print(); setTimeout(() => { document.title = titulo; }, 1000); });
  };
  $('#capa-pdf', md.el).onclick = () => capaPdf(data.value, linhas(), obs.value, brand);
  carregar();
}
async function capaPdf(d, linhas, obs, brandHex) {
  toast('Gerando PDF…');
  try {
    if (!window.jspdf) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    if (!window.jspdf.jsPDF.API.autoTable) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
  } catch { return toast('Não foi possível carregar o gerador de PDF. Verifique a internet ou use Imprimir → Salvar como PDF.', true); }
  try {
    const o = S.org || {};
    const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', compress: true });
    doc.setProperties({ title: `Capa da pauta ${fmtDate(d)}`, author: o.name || '', creator: 'Redação' });
    const W = 210, H = 297, M = 14;
    const B = [1, 3, 5].map(i => parseInt(brandHex.slice(i, i + 2), 16));
    const font = (style, size, color) => { doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor(...(color || [20, 22, 26])); };
    const logo = await pdfLogo(orgLogo());
    if (logo) { const s = Math.min(50 / logo.w, 20 / logo.h); doc.addImage(logo.data, logo.fmt, M, 16 + (20 - logo.h * s) / 2, logo.w * s, logo.h * s, undefined, 'FAST'); }
    else { font('bold', 15, B); doc.text(pdfSafe(o.name || ''), M, 27); }
    font('bold', 17); doc.text('CAPA DA PAUTA', W - M, 22, { align: 'right' });
    font('normal', 11); doc.text(pdfSafe(capaTitulo(d)), W - M, 29, { align: 'right' });
    font('normal', 9, [90, 96, 105]); doc.text(pdfSafe(`Cronograma do dia · ${linhas.length} pauta(s)`), W - M, 34.5, { align: 'right' });
    doc.setDrawColor(...B); doc.setLineWidth(1.1); doc.line(M, 39, W - M, 39);
    const base = { startY: 44, margin: { left: M, right: M, top: 16, bottom: 20 }, theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8.6, textColor: [20, 22, 26], lineColor: [204, 210, 217], lineWidth: 0.2, cellPadding: 1.8, valign: 'top' },
      headStyles: { fillColor: B, textColor: 255, fontStyle: 'bold', fontSize: 7.4, lineColor: B } };
    const txt = (arr) => pdfSafe(arr.join('\n') || '—');
    doc.autoTable(Object.assign({}, base, {
      head: [['HORÁRIO', 'PAUTA', 'EQUIPE', 'LOCAL E MARCAÇÃO']],
      body: linhas.length ? linhas.map(l => [pdfSafe(l.hora), txt([l.retranca, ...l.pauta]), txt(l.equipe), txt(l.local)]) : [[{ content: 'Nenhuma pauta marcada para esta data.', colSpan: 4 }]],
      columnStyles: { 0: { cellWidth: 17, fontStyle: 'bold', fontSize: 10 }, 1: { cellWidth: 56, fontStyle: 'bold' }, 2: { cellWidth: 46 } },
      rowPageBreak: 'avoid',
    }));
    if (obs.trim()) doc.autoTable(Object.assign({}, base, { startY: doc.lastAutoTable.finalY + 6, head: [['OBSERVAÇÕES DO DIA']], body: [[pdfSafe(obs)]], styles: Object.assign({}, base.styles, { fontSize: 10 }) }));
    const n = doc.internal.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i); doc.setDrawColor(214, 219, 225); doc.setLineWidth(0.3); doc.line(M, H - 13, W - M, H - 13);
      font('normal', 7.5, [90, 96, 105]);
      doc.text(pdfSafe(`${o.name || ''}${o.printFooter ? ' · ' + o.printFooter : ''}`), M, H - 9);
      doc.text(pdfSafe(`Gerado por ${S.me.name} em ${new Date().toLocaleString('pt-BR')} · página ${i} de ${n}`), W - M, H - 9, { align: 'right' });
    }
    doc.save(`CAPA DA PAUTA - ${fmtDate(d).replace(/\//g, '-')}.pdf`);
    toast('PDF baixado.');
  } catch (e) { console.error(e); toast('Erro ao gerar o PDF: ' + e.message, true); }
}

function printRundown() {
  const rd = S.rundown; if (!rd) return; const C = computeRundown(rd);
  const withScripts = confirm('Incluir as laudas (textos) na impressão?\nOK = espelho + laudas · Cancelar = só o espelho');
  doPrint(`<h1>ESPELHO — ${esc(rd.program.name)}</h1><div>${weekday(rd.data)}, ${fmtDate(rd.data)} · Início ${fmtClock(C.start)} · Previsto ${fmtDur(C.previsto, true)} · Total ${fmtDur(C.total, true)} · ${C.saldo >= 0 ? 'Sobra' : 'Estouro'} ${fmtDur(Math.abs(C.saldo))} · Status: ${label(RD_STATUS, rd.status)}</div><br>
    <table><tr><th>Pág</th><th>Retranca</th><th>Tipo</th><th>Apres.</th><th>Repórter</th><th>Editor</th><th>Cab</th><th>VT</th><th>Total</th><th>No ar</th><th>Status</th></tr>
    ${C.rows.map(r => `<tr class="${r.isBreak ? 'brk' : ''}"><td>${r.pagina}</td><td><b>${esc(r.it.retranca)}</b></td><td>${esc(r.it.tipo)}</td><td>${esc(r.it.apresentador)}</td><td>${esc(r.it.reporter)}</td><td>${esc(r.it.editor)}</td><td>${r.isBreak ? '' : fmtDur(r.cab)}</td><td>${fmtDur(r.vt)}</td><td>${fmtDur(r.total)}</td><td>${fmtClock(r.hora)}</td><td>${r.isBreak ? '' : esc(label(ITEM_STATUS, r.it.status))}</td></tr>`).join('')}</table>
    ${withScripts ? C.rows.filter(r => !r.isBreak).map(r => `<div class="story"><h2>${r.pagina} · ${esc(r.it.retranca)} · ${esc(r.it.tipo)} · ${fmtDur(r.total)}</h2>
      ${r.it.cabeca ? `<p><b>${esc(r.it.apresentador || 'APRESENTADOR')}:</b></p><pre>${esc(r.it.cabeca).toUpperCase()}</pre>` : ''}
      ${r.it.texto ? `<p><b>TEXTO / VT:</b></p><pre>${esc(r.it.texto)}</pre>` : ''}
      ${r.it.deixa ? `<p><b>DEIXA:</b> ${esc(r.it.deixa).toUpperCase()}</p>` : ''}
      ${r.it.gc ? `<p><b>GC:</b></p><pre>${esc(r.it.gc)}</pre>` : ''}</div>`).join('') : ''}`);
}
// =============================================================== MODO NO AR
// O apresentador (ou o editor no switcher) dá OK em cada retranca assim que ela termina.
function openOnAir() {
  if (!S.rundown || $('#onair')) return;
  const ov = document.createElement('div'); ov.id = 'onair'; ov.className = 'onair';
  document.body.appendChild(ov);
  let busy = false;
  const secs = (iso) => iso ? new Date(iso).getTime() / 1000 : null;
  const nowS = () => Date.now() / 1000;
  const clockOf = (iso) => iso ? new Date(iso).toLocaleTimeString('pt-BR') : '';
  const calc = () => {
    const rd = S.rundown; const C = computeRundown(rd);
    const live = C.rows.filter(r => !r.dead);
    let prev = secs(rd.noArInicio);
    // duração real: do OK anterior (ou do início) até o OK desta retranca
    live.forEach(r => { const t = secs(r.it.aoArAt); if (t != null) { r.real = prev != null ? Math.max(0, t - prev) : null; prev = t; } });
    const curIdx = live.findIndex(r => !r.it.aoArAt);
    const cur = curIdx >= 0 ? live[curIdx] : null, next = curIdx >= 0 ? live[curIdx + 1] : null;
    const started = !!rd.noArInicio, ended = rd.status === 'encerrado';
    const curElapsed = started && cur && !ended ? Math.max(0, nowS() - prev) : 0;
    const remaining = curIdx < 0 ? 0 : live.slice(curIdx).reduce((a, r) => a + r.total, 0) - Math.min(curElapsed, cur ? cur.total : 0);
    const plannedEnd = C.start + C.previsto;            // segundos do dia
    const d = new Date(); const nowDay = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
    const projEnd = started && !ended ? nowDay + remaining : C.fim;
    return { rd, C, live, cur, next, started, ended, curElapsed, plannedEnd, projEnd, saldo: plannedEnd - projEnd, done: live.filter(r => r.it.aoArAt).length };
  };
  const render = () => {
    if (!S.rundown) return close();
    const K = calc(); const { rd, cur, next } = K;
    const st = K.ended ? ['enc', 'ENCERRADO'] : K.started ? ['live', 'NO AR'] : ['pre', 'PRÉ-AR'];
    const T = (l, v, cls = '') => `<div class="oa-t ${cls}"><span>${l}</span><b>${v}</b></div>`;
    const over = cur && cur.total && K.curElapsed > cur.total;
    ov.innerHTML = `
      <div class="oa-top">
        <span class="oa-badge ${st[0]}">● ${st[1]}</span>
        <div class="oa-prog"><b>${esc(rd.program.name)}</b><span>${esc(weekday(rd.data))}, ${fmtDate(rd.data)}</span></div>
        <div class="oa-timers">
          ${T('Relógio', new Date().toLocaleTimeString('pt-BR'), 'clock')}
          ${T('Início real', K.started ? clockOf(rd.noArInicio) : fmtClock(K.C.start) + ' prev.')}
          ${T('Decorrido', K.started ? fmtDur(((K.ended ? secs(rd.noArFim) : nowS()) - secs(rd.noArInicio)), true) : '—')}
          ${T('Término previsto', fmtClock(K.plannedEnd))}
          ${T('Término projetado', fmtClock(K.projEnd))}
          ${T(K.saldo >= 0 ? 'Sobra' : 'Estouro', fmtDur(Math.abs(K.saldo)), K.saldo < 0 ? 'over' : 'under')}
        </div>
        <div class="oa-btns">
          ${!K.started || K.ended ? `<button class="btn primary" data-oa="start">▶ ${K.ended ? 'Reabrir' : 'Iniciar jornal'}</button>` : `<button class="btn" data-oa="end">■ Encerrar</button>`}
          ${S.perms.approveRundown ? '<button class="btn" data-oa="reset" title="Apaga todos os OKs deste espelho">Zerar</button>' : ''}
          <button class="btn" data-oa="close" title="Esc">Fechar</button>
        </div>
      </div>
      <div class="oa-body">
        <section class="oa-now">
          ${cur ? `
            <div class="oa-lbl">${K.started ? 'NO AR AGORA' : 'PRIMEIRA RETRANCA'}</div>
            <div class="oa-cur ${cur.isBreak ? 'brk' : ''}">
              <div class="oa-pg">${cur.pagina}</div>
              <div class="oa-ret">${esc(cur.it.retranca)}</div>
              <div class="oa-meta"><span class="tipo">${esc(cur.it.tipo)}</span> ${cur.it.apresentador ? esc(cur.it.apresentador) : ''}${cur.it.reporter ? ' · ' + esc(cur.it.reporter) : ''}</div>
              <div class="oa-clock ${over ? 'over' : ''}">${K.started ? fmtDur(K.curElapsed) : '00:00'} <small>/ ${fmtDur(cur.total)}</small></div>
              <div class="oa-bar"><i style="width:${cur.total ? Math.min(100, K.curElapsed / cur.total * 100) : 0}%" class="${over ? 'over' : ''}"></i></div>
              ${cur.it.deixa ? `<div class="oa-deixa"><span>DEIXA</span> ${esc(cur.it.deixa).toUpperCase()}</div>` : ''}
            </div>
            <button class="oa-ok" data-oa="ok">✓ OK — FOI AO AR<small>Espaço ou Enter</small></button>
            ${next ? `<div class="oa-next"><span>A SEGUIR</span> <b>${next.pagina} · ${esc(next.it.retranca)}</b> <span class="tipo">${esc(next.it.tipo)}</span> ${fmtDur(next.total)}</div>` : '<div class="oa-next"><span>A SEGUIR</span> fim do espelho</div>'}
          ` : `<div class="oa-done">✓ Todas as retrancas foram ao ar.<br><span class="hint">${K.ended ? 'Jornal encerrado.' : 'Clique em “Encerrar” para registrar o fim do jornal.'}</span></div>`}
          <div class="hint" style="margin-top:12px">${K.done}/${K.live.length} retrancas exibidas · Desfazer o último OK: Backspace · Clique no ✓ da lista para corrigir.</div>
        </section>
        <section class="oa-list"><table class="grid"><thead><tr><th></th><th>Pág</th><th>Retranca</th><th>Tipo</th><th class="num">Prev.</th><th class="num">Hora prev.</th><th class="num">OK às</th><th class="num">Real</th><th class="num">Dif.</th></tr></thead><tbody>
          ${K.C.rows.map(r => { const it = r.it; const isCur = cur && cur.it.id === it.id; const dif = r.real != null ? r.real - r.total : null;
            return `<tr class="${it.aoArAt ? 'aired' : ''} ${isCur ? 'cur' : ''} ${r.dead ? 'caiu' : ''} ${r.isBreak ? 'break' : ''}" data-id="${it.id}">
              <td>${r.dead ? '' : `<button class="oa-chk ${it.aoArAt ? 'on' : ''}" data-tog="${it.id}" aria-label="${it.aoArAt ? 'Desmarcar' : 'Marcar como exibida'}">${it.aoArAt ? '✓' : ''}</button>`}</td>
              <td class="mono">${r.pagina}</td><td class="retr">${esc(it.retranca)}${r.dead ? ' <span class="hint">(caiu)</span>' : ''}</td><td><span class="tipo">${esc(it.tipo)}</span></td>
              <td class="num">${fmtDur(r.total)}</td><td class="num">${fmtClock(r.hora)}</td>
              <td class="num">${it.aoArAt ? `<span title="OK de ${esc(it.aoArPor || '')}">${clockOf(it.aoArAt)}</span>` : ''}</td>
              <td class="num">${r.real != null ? fmtDur(r.real) : ''}</td>
              <td class="num ${dif > 0 ? 'neg' : dif < 0 ? 'pos' : ''}">${dif != null ? (dif > 0 ? '+' : dif < 0 ? '−' : '') + fmtDur(Math.abs(dif)) : ''}</td></tr>`; }).join('')}
        </tbody></table></section>
      </div>`;
    const cr = $('.oa-list tr.cur', ov); if (cr && !ov.dataset.scrolled) { cr.scrollIntoView({ block: 'center' }); ov.dataset.scrolled = '1'; }
  };
  const apply = async (fn) => {
    if (busy) return; busy = true;
    try { S.rundown = await fn(); render(); renderRundown(); } catch (e) { toast(e.message, true); } finally { busy = false; }
  };
  const mark = (id, ok) => {
    const it = S.rundown.items.find(i => i.id === id); if (!it) return;
    it.aoArAt = ok ? new Date().toISOString() : null; render();   // resposta imediata na tela
    ov.dataset.scrolled = '';
    apply(() => api('POST', `/api/items/${id}/onair`, { ok }));
  };
  const act = (a) => {
    const K = calc();
    if (a === 'ok' && K.cur) mark(K.cur.it.id, true);
    if (a === 'start') apply(() => api('POST', `/api/rundowns/${S.rundown.id}/onair`, { action: 'start' }));
    if (a === 'end' && confirm('Encerrar o jornal agora?')) apply(() => api('POST', `/api/rundowns/${S.rundown.id}/onair`, { action: 'end' }));
    if (a === 'reset' && confirm('Zerar todos os OKs de "no ar" deste espelho?')) apply(() => api('POST', `/api/rundowns/${S.rundown.id}/onair`, { action: 'reset' }));
    if (a === 'close') close();
  };
  ov.onclick = (e) => {
    const t = e.target.closest('[data-tog]'); if (t) { const it = S.rundown.items.find(i => i.id === t.dataset.tog); return mark(it.id, !it.aoArAt); }
    const b = e.target.closest('[data-oa]'); if (b) act(b.dataset.oa);
  };
  const key = (e) => {
    if (e.target.closest && e.target.closest('input,textarea,select')) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); act('ok'); }
    else if (e.key === 'Backspace') {
      e.preventDefault();
      const last = S.rundown.items.filter(i => i.aoArAt).sort((a, b) => a.aoArAt < b.aoArAt ? 1 : -1)[0];
      if (last) mark(last.id, false);
    }
  };
  document.addEventListener('keydown', key);
  const tick = setInterval(render, 1000);
  const poll = setInterval(async () => {
    if (busy || !S.rundown) return;
    try { const f = await api('GET', '/api/rundowns/' + S.rundown.id); if (!busy) { S.rundown = f; renderRundown(); } } catch { }
  }, 2000);
  function close() { clearInterval(tick); clearInterval(poll); document.removeEventListener('keydown', key); ov.remove(); renderRundown(); }
  render();
}

function prompter() {
  const rd = S.rundown; if (!rd) return; const C = computeRundown(rd);
  const parts = C.rows.filter(r => !r.isBreak && !r.dead && (r.it.cabeca || READ_TYPES.includes(r.it.tipo) && r.it.texto));
  const bg = document.createElement('div');
  bg.style.cssText = 'position:fixed;inset:0;background:#000;color:#fff;z-index:200;overflow:auto;padding:40px 8vw;font:600 clamp(26px,4.2vw,58px)/1.45 Arial,sans-serif;text-transform:uppercase';
  bg.innerHTML = `<div style="position:fixed;top:10px;right:16px;font:13px var(--sans);text-transform:none;color:#aaa">Espaço: rolar/pausar · ↑↓ velocidade · Esc: sair<br><b id="pr-vel" style="display:block;text-align:right;font-size:15px;color:#e0a526;margin-top:4px"></b></div>` +
    (parts.length ? parts.map(r => `<div style="color:#e0a526;font-size:.45em;margin-top:1.4em">${r.pagina} · ${esc(r.it.retranca)}</div>
    <div style="white-space:pre-wrap">${esc(r.it.cabeca).replace(/\[([^\]]*)\]/g, '<span style="color:#6cf;font-size:.6em">[$1]</span>')}${READ_TYPES.includes(r.it.tipo) && r.it.texto ? '\n' + esc(r.it.texto).replace(/\[([^\]]*)\]/g, '<span style="color:#6cf;font-size:.6em">[$1]</span>') : ''}</div>`).join('') : '<p>Sem textos de apresentação.</p>') + '<div style="height:80vh"></div>';
  document.body.appendChild(bg);
  // velocidade em pixels por segundo (igual em qualquer monitor); começa devagar
  const MIN = 10, MAX = 300, PASSO = 5;
  let speed = 25, run = false, raf, last = 0, pos = 0;
  const showSpeed = () => { $('#pr-vel', bg).textContent = `Velocidade ${(speed - MIN) / PASSO + 1} · ${run ? 'rolando' : 'pausado'}`; };
  const loop = (now) => {
    if (!run) return;
    if (Math.abs(bg.scrollTop - pos) > 3) pos = bg.scrollTop;   // respeita rolagem manual
    if (last) pos += speed * Math.min(0.1, (now - last) / 1000);
    last = now; bg.scrollTop = pos; raf = requestAnimationFrame(loop);
  };
  const key = (e) => {
    if (e.key === 'Escape') { run = false; cancelAnimationFrame(raf); bg.remove(); document.removeEventListener('keydown', key); return; }
    if (e.key === ' ') { e.preventDefault(); run = !run; cancelAnimationFrame(raf); if (run) { last = 0; pos = bg.scrollTop; raf = requestAnimationFrame(loop); } }
    if (e.key === 'ArrowUp') { e.preventDefault(); speed = Math.min(MAX, speed + PASSO); }
    if (e.key === 'ArrowDown') { e.preventDefault(); speed = Math.max(MIN, speed - PASSO); }
    showSpeed();
  };
  showSpeed();
  if (document.activeElement) document.activeElement.blur();   // Espaço não deve reacionar o botão Prompter
  document.addEventListener('keydown', key);
}

// =============================================================== MATÉRIAS (espaço de redação do repórter)
async function loadMaterias() {
  const f = S.mf; const q = new URLSearchParams();
  if (!f.allDates) { q.set('from', f.date); q.set('to', f.date); }
  if (f.mine) q.set('reporterId', S.me.id);
  if (f.q) q.set('q', f.q);
  if (f.comMateria) q.set('comMateria', '1');
  S.matList = await api('GET', '/api/pautas?' + q);
}
async function viewMaterias() {
  S.mf = Object.assign({ date: today(), allDates: false, mine: S.me.role === 'reporter', q: '', comMateria: false }, S.mf || {});
  const f = S.mf;
  $('#main').innerHTML = `
  <div class="workspace ws-materias">
    <section class="pane"><div class="pane-h"><h2>Matérias</h2><span class="hint" id="mf-label"></span></div>
      <div class="pad mf-filters">
        <div class="datenav"><button class="btn sm" data-d="-1" aria-label="Dia anterior">‹</button><input type="date" id="mf-date" value="${f.date}"><button class="btn sm" data-d="1" aria-label="Próximo dia">›</button><button class="btn sm" id="mf-today">Hoje</button></div>
        <input type="search" id="mf-q" value="${esc(f.q)}" placeholder="Buscar retranca ou trecho do texto…">
        <div class="mf-checks">
          <label class="check"><input type="checkbox" id="mf-all" ${f.allDates ? 'checked' : ''}> Todas as datas</label>
          <label class="check"><input type="checkbox" id="mf-mine" ${f.mine ? 'checked' : ''}> Só as minhas</label>
          <label class="check"><input type="checkbox" id="mf-com" ${f.comMateria ? 'checked' : ''}> Já escritas</label>
        </div>
      </div>
      <div class="pane-b" id="mat-list"></div></section>
    <section class="pane mat-editor" id="mat-editor"></section>
    <aside class="pane mat-ref" id="mat-ref"></aside>
  </div>`;
  const reload = async () => { await loadMaterias(); renderMatList(); };
  const setDate = (d) => { f.allDates = false; $('#mf-all').checked = false; f.date = d; $('#mf-date').value = d; reload(); };
  $('#mf-date').onchange = e => setDate(e.target.value || today());
  $$('.mf-filters [data-d]').forEach(b => b.onclick = () => setDate(addDays(f.date, +b.dataset.d)));
  $('#mf-today').onclick = () => setDate(today());
  $('#mf-all').onchange = e => { f.allDates = e.target.checked; reload(); };
  $('#mf-mine').onchange = e => { f.mine = e.target.checked; reload(); };
  $('#mf-com').onchange = e => { f.comMateria = e.target.checked; reload(); };
  let qt; $('#mf-q').oninput = e => { clearTimeout(qt); qt = setTimeout(() => { f.q = e.target.value.trim(); reload(); }, 300); };
  $('#mat-list').onclick = e => { const r = e.target.closest('[data-id]'); if (r) openMateria(r.dataset.id); };
  await reload();
  const want = S.matOpenId || (S.mat && S.mat.id); S.matOpenId = null;
  if (want) await openMateria(want, true); else renderMatEditor();
  S.pollTimer = setInterval(async () => { if (S.view !== 'materias') return; try { await loadMaterias(); renderMatList(); } catch { } }, 10000);
}
function renderMatList() {
  const el = $('#mat-list'); if (!el) return;
  $('#mf-label').textContent = S.mf.allDates ? 'todas as datas' : `${weekday(S.mf.date)}, ${fmtDate(S.mf.date)}`;
  const L = S.matList || [];
  if (!L.length) { el.innerHTML = `<div class="empty">Nenhuma pauta ${S.mf.mine ? 'sua ' : ''}para este filtro.${S.mf.mine ? '<br><br><span class="hint">Desmarque “Só as minhas” para ver todas.</span>' : ''}</div>`; return; }
  const selId = S.mat && S.mat.id;
  el.innerHTML = L.map(p => {
    const w = wordCount(p.materia);
    return `<div class="matrow ${p.id === selId ? 'sel' : ''}" data-id="${p.id}">
      <div class="mr-top"><span class="retr">${esc(p.retranca)}</span>${p.lock && !p.lock.mine ? ` <span title="Em edição por ${esc(p.lock.name)}">🔒</span>` : ''}<span class="grow"></span>${materiaPill(p)}</div>
      <div class="mr-sub">${S.mf.allDates ? fmtDate(p.data) + ' · ' : ''}${esc(repName(p) || 'sem repórter')} · <span class="tipo">${esc(p.formato || '')}</span>${w ? ` · ${w} pal. · ~${fmtDur(Math.round(w * 60 / 170))}` : ''}</div>
    </div>`;
  }).join('');
}
async function openMateria(id, silent) {
  if (S.matDirty && !(await saveMateria())) { if (!confirm('Não foi possível salvar a matéria atual. Trocar mesmo assim?')) return; }
  S.matDirty = false; clearTimeout(S.matTimer); await releaseLocks();
  try { S.mat = await api('GET', '/api/pautas/' + id); }
  catch (e) { S.mat = null; if (!silent) toast(e.message, true); }
  renderMatList(); renderMatEditor();
  if (!silent && isMobile() && S.mat) $('#mat-editor').scrollIntoView({ behavior: 'smooth' });
}
function renderMatEditor() {
  const el = $('#mat-editor'), ref = $('#mat-ref'); if (!el) return;
  const p = S.mat;
  if (!p) {
    el.innerHTML = `<div class="pane-h"><h2>Texto da matéria</h2></div><div class="empty">Escolha uma pauta na lista para escrever a matéria.<br><br><span class="hint">O texto fica salvo junto com a pauta e qualquer pessoa da redação pode encontrá-lo em Busca.</span></div>`;
    ref.innerHTML = `<div class="pane-h"><h2>Pauta</h2></div><div class="empty hint">A proposta, a marcação e as informações da pauta aparecem aqui enquanto você escreve.</div>`;
    return;
  }
  const lockedBy = p.lock && !p.lock.mine ? p.lock.name : null;
  const ro = lockedBy || !S.perms.edit ? 'disabled' : '';
  const prog = p.programaId ? (S.programs.find(x => x.id === p.programaId) || {}).name || '' : '';
  el.innerHTML = `
    <div class="pane-h"><h2>Matéria</h2><span class="savestate" id="mstate">Salva</span><div style="flex:1"></div>
      <button class="btn primary sm needs-edit" id="m-save" ${ro}>Salvar</button>
      <button class="btn sm" id="m-print">Imprimir / PDF</button>
      <button class="btn sm" id="m-pauta">Abrir pauta</button></div>
    ${lockedBy ? `<div class="banner">🔒 Em edição por <b>${esc(lockedBy)}</b>. Você está vendo em modo leitura.</div>` : ''}
    <div class="mat-head">
      <div class="mat-retr">${esc(p.retranca)}</div>
      <div class="hint">${p.data ? `${esc(weekday(p.data))}, ${fmtDate(p.data)}` : ''}${prog ? ' · ' + esc(prog) : ''} · ${esc(p.formato || '')} · Repórter: <b>${esc(repName(p) || '—')}</b></div>
    </div>
    <div class="mat-tools">
      ${['OFF', 'SONORA', 'PASSAGEM', 'ARTE', 'GC', 'TRILHA', 'IMAGEM'].map(t => `<button class="btn sm" data-ins="${t}" ${ro}>[${t}]</button>`).join('')}
      <div style="flex:1"></div>
      <label class="lbl" for="m-st">Situação</label>
      <select id="m-st" style="width:auto" ${ro}>${opts(MATERIA_STATUS, p.materiaStatus || '')}</select>
    </div>
    <textarea class="materia mat-text" id="m-text" spellcheck="true" ${S.perms.edit ? ro : 'readonly'} placeholder="Escreva aqui a sua matéria.&#10;&#10;[OFF]&#10;Texto narrado sobre as imagens…&#10;&#10;[SONORA] NOME / CARGO&#10;&quot;Fala do entrevistado…&quot;&#10;&#10;[PASSAGEM] NOME DO REPÓRTER&#10;Texto da passagem…">${esc(p.materia || '')}</textarea>
    <div class="mat-foot"><span class="readtime" id="m-rt">${materiaStats(p.materia) || '0 palavras'}</span><span class="grow"></span>
      <span class="hint" id="m-meta">${p.materiaAutorId ? `Última edição: <b>${esc(userName(p.materiaAutorId))}</b> em ${fmtDT(p.materiaAt)}` : 'Salvamento automático enquanto você escreve · Ctrl+S salva na hora'}</span></div>`;

  const ents = (p.entrevistados || []).filter(e => e.nome);
  const blk = (t, v) => String(v || '').trim() ? `<div class="ref-b"><div class="ref-t">${t}</div><div class="ref-x">${esc(v)}</div></div>` : '';
  ref.innerHTML = `<div class="pane-h"><h2>Pauta</h2><span class="hint">consulta</span></div><div class="pane-b pad">
    ${blk('Proposta', p.proposta)}
    ${ents.length || p.local ? `<div class="ref-b"><div class="ref-t">Marcação</div>${ents.map(e => `<div class="ref-ent"><b>${esc(e.nome)}</b>${e.funcao ? ' · ' + esc(e.funcao) : ''}<div class="hint">${[fmtDate(e.data), e.horario, e.local].filter(Boolean).map(esc).join(' · ')}${e.confirmado ? ' · ✓ confirmado' : ''}</div></div>`).join('')}
      ${p.local ? `<div class="hint" style="margin-top:4px">Local: ${esc(p.local)}${p.endereco ? ' — ' + esc(p.endereco) : ''}</div>` : ''}</div>` : ''}
    ${blk('Informações', p.historico)}${blk('Encaminhamento', p.encaminhamento)}${blk('Sugestão de perguntas', p.perguntas)}
    ${!p.proposta && !p.historico && !ents.length ? '<div class="hint">Pauta sem detalhes preenchidos.</div>' : ''}
  </div>`;

  const ta = $('#m-text');
  const dirty = async () => {
    const st = $('#mstate'); if (st) { st.textContent = 'Alterações não salvas'; st.classList.add('dirty'); }
    if (!S.matDirty) { S.matDirty = true; const r = await acquireLock('p:' + p.id); if (!r.ok) toast(`Pauta em edição por ${r.lock.name}.`, true); }
    clearTimeout(S.matTimer); S.matTimer = setTimeout(() => saveMateria(), 3000);
  };
  ta.oninput = () => {
    p.materia = ta.value; $('#m-rt').textContent = materiaStats(p.materia) || '0 palavras';
    if (p.materia.trim() && !p.materiaStatus) { p.materiaStatus = 'rascunho'; $('#m-st').value = 'rascunho'; }
    dirty();
  };
  $('#m-st').onchange = (e) => { p.materiaStatus = e.target.value; dirty(); };
  $$('#mat-editor [data-ins]').forEach(b => b.onclick = () => {
    const s = ta.selectionStart, before = ta.value.slice(0, s), t = b.dataset.ins;
    const ins = (before && !before.endsWith('\n') ? '\n\n' : '') + `[${t}] ` + (['SONORA', 'PASSAGEM', 'GC'].includes(t) ? 'NOME / CARGO\n' : '');
    ta.setRangeText(ins, s, ta.selectionEnd, 'end'); ta.focus(); ta.oninput();
  });
  $('#m-save').onclick = () => saveMateria(true);
  $('#m-print').onclick = async () => { if (S.matDirty) await saveMateria(); printPauta(S.mat); };
  $('#m-pauta').onclick = async () => { const id = p.id; S.pf.date = p.data; S.pf.allDates = false; await go('pautas'); if (S.view === 'pautas') openPauta(id); };
}
async function saveMateria(showToast) {
  const p = S.mat; if (!p || !S.perms.edit) return true;
  clearTimeout(S.matTimer);
  if (!S.matDirty) { if (showToast) toast('Matéria salva.'); return true; }
  const st = $('#mstate'); if (st) st.textContent = 'Salvando…';
  try {
    const saved = await api('PUT', '/api/pautas/' + p.id, { materia: p.materia || '', materiaStatus: p.materiaStatus || '', updatedAt: p.updatedAt, force: p.force });
    delete p.force;
    Object.assign(p, { updatedAt: saved.updatedAt, materiaAutorId: saved.materiaAutorId, materiaAt: saved.materiaAt });
    S.matDirty = false;
    if (st) { st.textContent = 'Salva'; st.classList.remove('dirty'); }
    const m = $('#m-meta'); if (m && p.materiaAutorId) m.innerHTML = `Última edição: <b>${esc(userName(p.materiaAutorId))}</b> em ${fmtDT(p.materiaAt)}`;
    const li = (S.matList || []).find(x => x.id === p.id); if (li) { li.materia = p.materia; li.materiaStatus = p.materiaStatus; renderMatList(); }
    if (showToast) toast('Matéria salva.');
    return true;
  } catch (e) {
    if (st) st.textContent = 'Não salva';
    if (e.status === 409 && confirm(e.message + '\n\nSobrescrever com o seu texto?')) { p.force = true; return saveMateria(showToast); }
    toast(e.message, true); return false;
  }
}

// =============================================================== EDIÇÃO (editor de imagens)
const EDICAO_STATUS = [['', 'A editar'], ['em_edicao', 'Em edição'], ['editada', 'Editada'], ['aprovada', 'Aprovada']];
const ED_CLASS = { '': 'sugestao', em_edicao: 'em_producao', editada: 'pronta', aprovada: 'gravada' };
const edPill = (p) => `<span class="pill st-${ED_CLASS[p.edicaoStatus || ''] || 'sugestao'}">${esc(label(EDICAO_STATUS, p.edicaoStatus || ''))}</span>`;
async function loadEdicao() {
  const f = S.ef; const q = new URLSearchParams();
  if (!f.allDates) { q.set('from', f.date); q.set('to', f.date); }
  if (f.q) q.set('q', f.q);
  if (f.comMateria) q.set('comMateria', '1');
  let list = await api('GET', '/api/pautas?' + q);
  list = list.filter(p => p.status !== 'caiu' && (!f.situacao || (f.situacao === 'aeditar' ? !p.edicaoStatus : p.edicaoStatus === f.situacao)));
  S.edList = list;
}
async function viewEdicao() {
  S.ef = Object.assign({ date: today(), allDates: false, q: '', comMateria: true, situacao: '' }, S.ef || {});
  const f = S.ef;
  $('#main').innerHTML = `
  <div class="workspace ws-materias ws-edicao">
    <section class="pane"><div class="pane-h"><h2>Edição de imagens</h2><span class="hint" id="ef-label"></span></div>
      <div class="pad mf-filters">
        <div class="datenav"><button class="btn sm" data-d="-1" aria-label="Dia anterior">‹</button><input type="date" id="ef-date" value="${f.date}"><button class="btn sm" data-d="1" aria-label="Próximo dia">›</button><button class="btn sm" id="ef-today">Hoje</button></div>
        <input type="search" id="ef-q" value="${esc(f.q)}" placeholder="Buscar retranca, repórter, trecho do texto…">
        <select id="ef-sit"><option value="">Toda situação de edição</option>${opts(EDICAO_STATUS.map(([k, l]) => [k || 'aeditar', l]), f.situacao)}</select>
        <div class="mf-checks">
          <label class="check"><input type="checkbox" id="ef-all" ${f.allDates ? 'checked' : ''}> Todas as datas</label>
          <label class="check"><input type="checkbox" id="ef-com" ${f.comMateria ? 'checked' : ''}> Só com texto do repórter</label>
        </div>
      </div>
      <div class="pane-b" id="ed-list"></div></section>
    <section class="pane mat-editor" id="ed-main"></section>
    <aside class="pane mat-ref" id="ed-ref"></aside>
  </div>`;
  const reload = async () => { await loadEdicao(); renderEdList(); };
  const setDate = (d) => { f.allDates = false; $('#ef-all').checked = false; f.date = d; $('#ef-date').value = d; reload(); };
  $('#ef-date').onchange = e => setDate(e.target.value || today());
  $$('.mf-filters [data-d]').forEach(b => b.onclick = () => setDate(addDays(f.date, +b.dataset.d)));
  $('#ef-today').onclick = () => setDate(today());
  $('#ef-all').onchange = e => { f.allDates = e.target.checked; reload(); };
  $('#ef-com').onchange = e => { f.comMateria = e.target.checked; reload(); };
  $('#ef-sit').onchange = e => { f.situacao = e.target.value; reload(); };
  let qt; $('#ef-q').oninput = e => { clearTimeout(qt); qt = setTimeout(() => { f.q = e.target.value.trim(); reload(); }, 300); };
  $('#ed-list').onclick = e => { const r = e.target.closest('[data-id]'); if (r) openEdicao(r.dataset.id); };
  await reload();
  const want = S.edOpen && S.edOpen.id; if (want) await openEdicao(want); else renderEdicao();
  S.pollTimer = setInterval(async () => { if (S.view !== 'edicao') return; try { await loadEdicao(); renderEdList(); } catch { } }, 10000);
}
function renderEdList() {
  const el = $('#ed-list'); if (!el) return;
  $('#ef-label').textContent = S.ef.allDates ? 'todas as datas' : `${weekday(S.ef.date)}, ${fmtDate(S.ef.date)}`;
  const L = S.edList || [];
  if (!L.length) { el.innerHTML = `<div class="empty">Nenhuma matéria para editar neste filtro.${S.ef.comMateria ? '<br><br><span class="hint">Desmarque “Só com texto do repórter” para ver todas as pautas.</span>' : ''}</div>`; return; }
  const selId = S.edOpen && S.edOpen.id;
  el.innerHTML = L.map(p => {
    const w = wordCount(p.materia);
    return `<div class="matrow ${p.id === selId ? 'sel' : ''}" data-id="${p.id}">
      <div class="mr-top"><span class="retr">${esc(p.retranca)}</span><span class="grow"></span>${edPill(p)}</div>
      <div class="mr-sub">${S.ef.allDates ? fmtDate(p.data) + ' · ' : ''}${esc(repName(p) || 'sem repórter')} · <span class="tipo">${esc(p.formato || '')}</span>${w ? ` · texto ${materiaPill(p)}` : ' · <i>sem texto</i>'}${p.edicaoEditor ? ' · ✂ ' + esc(p.edicaoEditor) : ''}</div>
    </div>`;
  }).join('');
}
async function openEdicao(id) {
  try { S.edOpen = await api('GET', '/api/pautas/' + id); } catch (e) { S.edOpen = null; toast(e.message, true); }
  renderEdList(); renderEdicao();
  if (isMobile() && S.edOpen) $('#ed-main').scrollIntoView({ behavior: 'smooth' });
}
// roteiro de edição: blocos numerados da matéria, com tempo estimado de cada trecho e acumulado
function roteiroEdicao(p) {
  const rows = parseScript(p.materia); let acc = 0;
  return rows.map((r, i) => {
    const t = readSec(r.body, 170); acc += t;
    const tipo = (r.tag || 'TEXTO').split(/\s/)[0];
    return Object.assign({}, r, { n: i + 1, t, acc, tipo, cls: ({ OFF: 'off', SONORA: 'son', PASSAGEM: 'pas', GC: 'gc', ARTE: 'arte', TRILHA: 'tri', IMAGEM: 'img' })[tipo] || 'txt' });
  });
}
function renderEdicao() {
  const el = $('#ed-main'), ref = $('#ed-ref'); if (!el) return;
  const p = S.edOpen;
  if (!p) {
    el.innerHTML = `<div class="pane-h"><h2>Roteiro de edição</h2></div><div class="empty">Escolha uma matéria na lista para ver o texto do repórter organizado para a edição.</div>`;
    ref.innerHTML = `<div class="pane-h"><h2>Pauta</h2></div><div class="empty hint">Imagens, arte, equipe e observações da pauta aparecem aqui.</div>`;
    return;
  }
  const prog = p.programaId ? (S.programs.find(x => x.id === p.programaId) || {}).name || '' : '';
  const R = roteiroEdicao(p);
  const gcs = R.filter(r => r.tipo === 'GC' || r.tipo === 'SONORA' || r.tipo === 'PASSAGEM').map(r => r.sub || r.body.split('\n')[0]).filter(Boolean);
  const total = R.reduce((a, r) => a + r.t, 0);
  el.innerHTML = `
    <div class="pane-h"><h2>Roteiro de edição</h2><div style="flex:1"></div>
      <button class="btn sm" id="ed-gc" ${gcs.length ? '' : 'disabled'}>Copiar GCs</button>
      <button class="btn sm" id="ed-print">Imprimir / PDF</button></div>
    <div class="pane-b">
    <div class="mat-head">
      <div class="mat-retr">${esc(p.retranca)}</div>
      <div class="hint">${p.data ? `${esc(weekday(p.data))}, ${fmtDate(p.data)}` : ''}${prog ? ' · ' + esc(prog) : ''} · ${esc(p.formato || '')} · Repórter: <b>${esc(repName(p) || '—')}</b>${p.cinegrafista ? ' · Imagens: <b>' + esc(p.cinegrafista) + '</b>' : ''}</div>
      <div class="hint" style="margin-top:4px">Texto: ${materiaPill(p)} ${p.materiaAutorId ? `· última alteração de ${esc(userName(p.materiaAutorId))} em ${fmtDT(p.materiaAt)}` : ''} · ${R.length} bloco(s) · tempo estimado de texto <b>${fmtDur(total)}</b></div>
    </div>
    ${R.length ? `<table class="edscript"><thead><tr><th>#</th><th>Marcação</th><th>Texto do repórter</th><th class="num">Tempo</th><th class="num">Acum.</th></tr></thead><tbody>
      ${R.map(r => `<tr class="ed-${r.cls}"><td class="mono">${r.n}</td><td><b>${esc(r.tag || 'TEXTO')}</b>${r.sub ? `<div class="hint">${esc(r.sub)}</div>` : ''}</td><td class="edtxt">${esc(r.body) || '<span class="hint">—</span>'}</td><td class="num mono">${r.t ? '~' + fmtDur(r.t) : ''}</td><td class="num mono">${fmtDur(r.acc)}</td></tr>`).join('')}
    </tbody></table>
    <p class="hint" style="padding:0 18px">Tempos estimados pela leitura (170 palavras/min). Sonoras e passagens dependem da gravação.</p>`
    : `<div class="empty">O repórter ainda não escreveu o texto desta matéria.<br><br><span class="hint">Quando ele escrever em Matérias, o roteiro aparece aqui automaticamente.</span></div>`}
    ${gcs.length ? `<div class="pad"><div class="ref-t">GCs (caracteres)</div><ul class="gclist">${gcs.map(g => `<li>${esc(g)}</li>`).join('')}</ul></div>` : ''}
    </div>`;

  const blk = (t, v) => String(v || '').trim() ? `<div class="ref-b"><div class="ref-t">${t}</div><div class="ref-x">${esc(v)}</div></div>` : '';
  const rot = (p.roteiro || []).filter(r => r.local || r.acao);
  const ents = (p.entrevistados || []).filter(e => e.nome);
  const isEd = S.me.role === 'editor_imagem';
  ref.innerHTML = `<div class="pane-h"><h2>Edição</h2><span class="savestate" id="edstate">Salva</span></div><div class="pane-b pad">
    <div class="edbox">
      <div class="field"><label>Situação da edição</label><select id="ed-st">${opts(EDICAO_STATUS, p.edicaoStatus || '')}</select></div>
      <div class="field"><label>Editor(a) de imagens</label><input type="text" id="ed-ed" list="dl-edimg" value="${esc(p.edicaoEditor || '')}" placeholder="${isEd ? esc(S.me.name) : 'Nome de quem edita'}">
        <datalist id="dl-edimg">${S.users.filter(u => u.role === 'editor_imagem' && u.active).map(u => `<option value="${esc(u.name)}"></option>`).join('')}</datalist></div>
      <div class="field"><label>Observações da edição</label><textarea id="ed-obs" rows="3" placeholder="Ex.: falta imagem aérea; sonora 2 com ruído; usar arte do cronograma…">${esc(p.edicaoObs || '')}</textarea></div>
      <button class="btn primary sm" id="ed-save">Salvar edição</button>
    </div>
    ${blk('Imagens necessárias', p.imagens)}${blk('Pedido de arte', p.arte)}
    ${rot.length ? `<div class="ref-b"><div class="ref-t">Roteiro de gravação</div>${rot.map(r => `<div class="ref-ent"><b>${esc(r.hora || '')}</b> ${esc(r.local || '')}<div class="hint">${esc(r.acao || '')}</div></div>`).join('')}</div>` : ''}
    ${ents.length ? `<div class="ref-b"><div class="ref-t">Entrevistados</div>${ents.map(e => `<div class="ref-ent"><b>${esc(e.nome)}</b>${e.funcao ? ' · ' + esc(e.funcao) : ''}</div>`).join('')}</div>` : ''}
    ${blk('Encaminhamento', p.encaminhamento)}${blk('Proposta', p.proposta)}${blk('Observações da pauta', p.observacoes)}
  </div>`;

  if (!S.perms.edit) { $$('#ed-ref .edbox select, #ed-ref .edbox input, #ed-ref .edbox textarea').forEach(x => { x.disabled = true; }); $('#ed-save').remove(); }
  $('#ed-print').onclick = () => printPauta(p, String(p.materia || '').trim() ? 'materia' : 'pauta');
  $('#ed-gc').onclick = async () => { try { await navigator.clipboard.writeText(gcs.join('\n')); toast('GCs copiados.'); } catch { toast('Não foi possível copiar.', true); } };
  const dirty = () => { const s = $('#edstate'); s.textContent = 'Alterações não salvas'; s.classList.add('dirty'); };
  ['#ed-st', '#ed-ed', '#ed-obs'].forEach(s => $(s).addEventListener('input', dirty));
  $('#ed-st').addEventListener('change', () => { if (isEd && !$('#ed-ed').value.trim() && $('#ed-st').value) $('#ed-ed').value = S.me.name; });
  if ($('#ed-save')) $('#ed-save').onclick = async () => {
    try {
      const saved = await api('PUT', '/api/pautas/' + p.id, { edicaoStatus: $('#ed-st').value, edicaoEditor: $('#ed-ed').value.trim(), edicaoObs: $('#ed-obs').value, updatedAt: p.updatedAt });
      Object.assign(p, { edicaoStatus: saved.edicaoStatus, edicaoEditor: saved.edicaoEditor, edicaoObs: saved.edicaoObs, updatedAt: saved.updatedAt });
      const s = $('#edstate'); s.textContent = 'Salva'; s.classList.remove('dirty'); toast('Edição salva.');
      const li = (S.edList || []).find(x => x.id === p.id); if (li) Object.assign(li, { edicaoStatus: p.edicaoStatus, edicaoEditor: p.edicaoEditor }); renderEdList();
    } catch (e) { toast(e.status === 409 ? 'A pauta foi alterada por outra pessoa. Abra de novo e salve.' : e.message, true); }
  };
}

// =============================================================== RELATÓRIOS (produção por período)
const REL_GRUPOS = [['produzida', 'Produzidas'], ['andamento', 'Em andamento'], ['caiu', 'Caíram']];
const REL_COR = { produzida: 'var(--viz-1)', andamento: 'var(--viz-2)', caiu: 'var(--viz-3)' };
const relGrupo = (s) => ['gravada', 'exibida'].includes(s) ? 'produzida' : s === 'caiu' ? 'caiu' : 'andamento';
const ymd = (d) => { d = new Date(d); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
function relPreset(k) {
  const t = new Date(); const y = t.getFullYear(), m = t.getMonth();
  if (k === 'mes') return [ymd(new Date(y, m, 1)), ymd(new Date(y, m + 1, 0))];
  if (k === 'mes_ant') return [ymd(new Date(y, m - 1, 1)), ymd(new Date(y, m, 0))];
  if (k === '30d') return [addDays(today(), -29), today()];
  if (k === 'ano') return [ymd(new Date(y, 0, 1)), ymd(new Date(y, 11, 31))];
  return null;
}
// tempo de produção: da criação da pauta até ficar "Gravada" (ou "Exibida")
function tempoProducao(p) {
  if (relGrupo(p.status) !== 'produzida') return null;
  const h = (p.statusHist || []).find(x => x.status === 'gravada') || (p.statusHist || []).find(x => x.status === 'exibida');
  const end = h ? Date.parse(h.at) : Date.parse(p.updatedAt || 0);
  const ini = Date.parse(p.createdAt || 0);
  if (!end || !ini || end < ini) return null;
  return { s: (end - ini) / 1000, aprox: !h };
}
const fmtLongo = (s) => { if (s == null) return '—'; const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.round(s % 3600 / 60); return d ? `${d}d ${h}h` : h ? `${h}h ${String(m).padStart(2, '0')}min` : `${m} min`; };
function duracaoItem(i) {
  const wpm = i.wpm || 170;
  const cab = i.tempoCabManual ? toSec(i.tempoCabManual) : readSec(i.cabeca, wpm);
  let vt = toSec(i.tempoVT); if (!vt && READ_TYPES.includes(i.tipo)) vt = readSec(i.texto, wpm);
  return i.status === 'caiu' ? 0 : cab + vt;
}
async function viewRelatorios() {
  if (!S.rf) { const [a, b] = relPreset('mes'); S.rf = { preset: 'mes', from: a, to: b, agrupar: 'editoria', editoria: '', tema: '', grupo: '', reporter: '', programa: '', modo: 'grafico' }; }
  const F = S.rf;
  const reps = [...new Set(S.users.filter(u => ['reporter', 'apresentador'].includes(u.role)).map(u => u.name))];
  $('#main').innerHTML = `<div class="page relpage">
    <div class="rel-top"><h1>Relatório de produção</h1><div style="flex:1"></div>
      <div class="seg" id="rel-modo" role="tablist">${[['grafico', 'Gráfico'], ['tabela', 'Tabela'], ['lista', 'Lista']].map(([k, l]) => `<button data-modo="${k}" class="${F.modo === k ? 'on' : ''}" role="tab" aria-selected="${F.modo === k}">${l}</button>`).join('')}</div>
      <button class="btn sm" id="rel-csv">Exportar planilha (CSV)</button><button class="btn sm" id="rel-print">Imprimir</button></div>
    <div class="rel-filtros">
      <div class="field"><label>Período</label><select id="rf-preset">${opts([['mes', 'Este mês'], ['mes_ant', 'Mês passado'], ['30d', 'Últimos 30 dias'], ['ano', 'Este ano'], ['custom', 'Personalizado']], F.preset)}</select></div>
      <div class="field"><label>De</label><input type="date" id="rf-from" value="${F.from}"></div>
      <div class="field"><label>Até</label><input type="date" id="rf-to" value="${F.to}"></div>
      <div class="field"><label>Agrupar por</label><select id="rf-agrupar">${opts([['editoria', 'Editoria'], ['tema', 'Tema (palavra-chave)'], ['reporter', 'Repórter'], ['programa', 'Telejornal'], ['geral', 'Geral (tudo junto)']], F.agrupar)}</select></div>
      <div class="field"><label>Editoria</label><select id="rf-editoria"><option value="">Todas</option>${opts(EDITORIAS, F.editoria)}</select></div>
      <div class="field"><label>Tema / assunto</label><input type="search" id="rf-tema" value="${esc(F.tema)}" placeholder="Ex.: saúde, eleição, chuva…"></div>
      <div class="field"><label>Situação</label><select id="rf-grupo"><option value="">Todas</option>${opts(REL_GRUPOS, F.grupo)}</select></div>
      <div class="field"><label>Repórter</label><select id="rf-reporter"><option value="">Todos</option>${opts(reps, F.reporter)}</select></div>
      <div class="field"><label>Telejornal</label><select id="rf-programa"><option value="">Todos</option>${opts(S.programs.map(x => [x.id, x.name]), F.programa)}</select></div>
    </div>
    <div id="rel-body"><div class="empty">Carregando…</div></div></div>`;
  const reload = async () => { await relCarregar(); relRender(); };
  const set = (k, v, load) => { F[k] = v; load ? reload() : relRender(); };
  $('#rf-preset').onchange = (e) => { F.preset = e.target.value; const r = relPreset(F.preset); if (r) { [F.from, F.to] = r; $('#rf-from').value = F.from; $('#rf-to').value = F.to; reload(); } };
  $('#rf-from').onchange = (e) => { F.preset = 'custom'; $('#rf-preset').value = 'custom'; set('from', e.target.value, true); };
  $('#rf-to').onchange = (e) => { F.preset = 'custom'; $('#rf-preset').value = 'custom'; set('to', e.target.value, true); };
  ['agrupar', 'editoria', 'grupo', 'reporter', 'programa'].forEach(k => $('#rf-' + k).onchange = (e) => set(k, e.target.value));
  let qt; $('#rf-tema').oninput = (e) => { clearTimeout(qt); qt = setTimeout(() => set('tema', e.target.value.trim()), 250); };
  $('#rel-modo').onclick = (e) => { const b = e.target.closest('[data-modo]'); if (!b) return; F.modo = b.dataset.modo; $$('#rel-modo button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); }); relRender(); };
  $('#rel-csv').onclick = relCsv;
  $('#rel-print').onclick = relPrint;
  await reload();
}
async function relCarregar() {
  const F = S.rf;
  if (F.from > F.to) { S.relData = { pautas: [], itens: [] }; return; }
  const [pautas, itens] = await Promise.all([api('GET', `/api/pautas?from=${F.from}&to=${F.to}`), api('GET', `/api/relatorio/itens?from=${F.from}&to=${F.to}`)]);
  S.relData = { pautas, itens };
}
function relLinhas() {
  const F = S.rf, D = S.relData || { pautas: [], itens: [] };
  const durPorPauta = {}, noArPorPauta = {};
  D.itens.forEach(i => { durPorPauta[i.pautaId] = (durPorPauta[i.pautaId] || 0) + duracaoItem(i); if (i.aoArAt) noArPorPauta[i.pautaId] = true; });
  const terms = fold(F.tema).split(/\s+/).filter(Boolean);
  const progName = (id) => (S.programs.find(x => x.id === id) || {}).name || '';
  return D.pautas.map(p => {
    const tp = tempoProducao(p); const tags = String(p.tags || '').split(',').map(s => s.trim()).filter(Boolean);
    return { p, grupo: relGrupo(p.status), rep: repName(p), prog: progName(p.programaId), tags, tProd: tp ? tp.s : null, aprox: tp ? tp.aprox : false,
      dur: durPorPauta[p.id] || 0, noAr: !!noArPorPauta[p.id] || p.status === 'exibida' };
  }).filter(r => (!F.editoria || r.p.editoria === F.editoria) && (!F.grupo || r.grupo === F.grupo) && (!F.reporter || r.rep === F.reporter) && (!F.programa || r.p.programaId === F.programa)
    && (!terms.length || terms.every(t => fold([r.p.retranca, r.p.proposta, r.p.tags, r.p.editoria, r.p.historico].join(' ')).includes(t))));
}
function relChaves(r) {
  const k = S.rf.agrupar;
  if (k === 'geral') return ['Geral'];
  if (k === 'tema') return r.tags.length ? r.tags.map(t => t.toLowerCase()) : ['(sem palavra-chave)'];
  if (k === 'reporter') return [r.rep || '(sem repórter)'];
  if (k === 'programa') return [r.prog || '(sem telejornal)'];
  return [r.p.editoria || '(sem editoria)'];
}
function relResumo(rows) {
  const g = {}; rows.forEach(r => relChaves(r).forEach(k => { (g[k] = g[k] || []).push(r); }));
  return Object.entries(g).map(([nome, rs]) => {
    const prodT = rs.map(r => r.tProd).filter(x => x != null);
    const c = { produzida: 0, andamento: 0, caiu: 0 }; rs.forEach(r => c[r.grupo]++);
    return { nome, total: rs.length, ...c, aprov: rs.length ? c.produzida / rs.length : 0, medProd: prodT.length ? prodT.reduce((a, b) => a + b, 0) / prodT.length : null, dur: rs.reduce((a, r) => a + r.dur, 0), noAr: rs.filter(r => r.noAr).length, rows: rs };
  }).sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));
}
const pct = (x) => Math.round(x * 100) + '%';
function relRender() {
  const el = $('#rel-body'); if (!el) return;
  const F = S.rf;
  if (F.from > F.to) { el.innerHTML = '<div class="empty">A data inicial é depois da data final.</div>'; return; }
  const rows = relLinhas(), R = relResumo(rows);
  const c = { produzida: 0, andamento: 0, caiu: 0 }; rows.forEach(r => c[r.grupo]++);
  const prodT = rows.map(r => r.tProd).filter(x => x != null);
  const dur = rows.reduce((a, r) => a + r.dur, 0);
  const tile = (l, v, sub) => `<div class="stat"><div class="stat-l">${l}</div><div class="stat-v">${v}</div>${sub ? `<div class="stat-s">${sub}</div>` : ''}</div>`;
  const periodo = `${fmtDate(F.from)} a ${fmtDate(F.to)}`;
  el.innerHTML = `<div class="hint" style="margin:-4px 0 10px">Período: <b>${periodo}</b> · pautas pela data da pauta · ${rows.length} pauta(s) no filtro</div>
    <div class="stats">
      ${tile('Pautas', rows.length)}
      ${tile('Produzidas', c.produzida, 'gravadas ou exibidas')}
      ${tile('Em andamento', c.andamento)}
      ${tile('Caíram', c.caiu)}
      ${tile('Aproveitamento', rows.length ? pct(c.produzida / rows.length) : '—', 'produzidas ÷ pautas')}
      ${tile('Tempo médio de produção', prodT.length ? fmtLongo(prodT.reduce((a, b) => a + b, 0) / prodT.length) : '—', 'da criação até gravada')}
      ${tile('Tempo de matérias no espelho', fmtDur(dur, true), `${rows.filter(r => r.noAr).length} foram ao ar`)}
    </div>
    ${!rows.length ? '<div class="empty">Nenhuma pauta neste período e filtro.</div>' : F.modo === 'tabela' ? relTabela(R, rows) : F.modo === 'lista' ? relLista(R) : relGraficos(R, rows)}`;
  relTooltip(el);
}
const AGR_LABEL = { editoria: 'Editoria', tema: 'Tema', reporter: 'Repórter', programa: 'Telejornal', geral: 'Grupo' };
function relTabela(R, rows) {
  const ord = rows.slice().sort((a, b) => (a.p.data || '').localeCompare(b.p.data || '') || a.p.retranca.localeCompare(b.p.retranca));
  return `<div class="card"><div class="pad" style="padding-bottom:0"><h3 style="margin:0">Resumo por ${AGR_LABEL[S.rf.agrupar].toLowerCase()}</h3></div>
    <table class="grid reltab"><thead><tr><th>${AGR_LABEL[S.rf.agrupar]}</th><th class="num">Pautas</th><th class="num">Produzidas</th><th class="num">Em andamento</th><th class="num">Caíram</th><th class="num">Aproveitamento</th><th class="num">Tempo médio de produção</th><th class="num">Tempo no espelho</th></tr></thead><tbody>
    ${R.map(g => `<tr><td><b>${esc(g.nome)}</b></td><td class="num">${g.total}</td><td class="num">${g.produzida}</td><td class="num">${g.andamento}</td><td class="num">${g.caiu}</td><td class="num">${pct(g.aprov)}</td><td class="num">${fmtLongo(g.medProd)}</td><td class="num">${fmtDur(g.dur, true)}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="card"><div class="pad" style="padding-bottom:0"><h3 style="margin:0">Pautas do período</h3></div>
    <table class="grid reltab"><thead><tr><th>Data</th><th>Retranca</th><th>Editoria</th><th>Tema</th><th>Repórter</th><th>Telejornal</th><th>Status</th><th class="num">Tempo de produção</th><th class="num">No espelho</th><th>Motivo da queda</th></tr></thead><tbody>
    ${ord.map(r => `<tr class="row" data-pid="${r.p.id}"><td class="mono">${fmtDate(r.p.data)}</td><td class="retr">${esc(r.p.retranca)}</td><td>${esc(r.p.editoria)}</td><td>${esc(r.tags.join(', '))}</td><td>${esc(r.rep)}</td><td>${esc(r.prog)}</td>
      <td><span class="pill st-${r.p.status}">${esc(label(PAUTA_STATUS, r.p.status))}</span></td><td class="num">${fmtLongo(r.tProd)}${r.aprox ? '<span class="hint" title="Pauta anterior ao histórico de status: tempo aproximado pela última alteração"> ≈</span>' : ''}</td>
      <td class="num">${r.dur ? fmtDur(r.dur) : '—'}</td><td>${esc(r.p.motivoQueda || '')}</td></tr>`).join('')}
    </tbody></table></div>`;
}
function relLista(R) {
  return R.map(g => `<div class="card relgroup"><div class="pad">
    <div class="rg-h"><h3>${esc(g.nome)}</h3><span class="hint">${g.total} pauta(s) · ${g.produzida} produzida(s) · ${g.caiu} caiu(ram) · aproveitamento ${pct(g.aprov)} · tempo médio ${fmtLongo(g.medProd)}</span></div>
    ${g.rows.slice().sort((a, b) => (a.p.data || '').localeCompare(b.p.data || '')).map(r => `<div class="rl-item row" data-pid="${r.p.id}">
      <div class="rl-main"><span class="mono hint">${fmtDate(r.p.data)}</span> <b>${esc(r.p.retranca)}</b> <span class="pill st-${r.p.status}">${esc(label(PAUTA_STATUS, r.p.status))}</span></div>
      <div class="hint">${[r.rep && 'Repórter: ' + r.rep, r.prog, r.tProd != null && 'Produção: ' + fmtLongo(r.tProd), r.dur && 'No espelho: ' + fmtDur(r.dur)].filter(Boolean).map(esc).join(' · ')}</div>
      ${r.p.status === 'caiu' ? `<div class="rl-queda">Motivo da queda: ${esc(r.p.motivoQueda || 'não informado')}</div>` : ''}
    </div>`).join('')}
  </div></div>`).join('');
}
function relGraficos(R, rows) {
  const top = R.slice(0, 12); const resto = R.slice(12);
  if (resto.length) { const o = { nome: `Outros (${resto.length})`, total: 0, produzida: 0, andamento: 0, caiu: 0 }; resto.forEach(g => { o.total += g.total; o.produzida += g.produzida; o.andamento += g.andamento; o.caiu += g.caiu; }); top.push(o); }
  const maxT = Math.max(...top.map(g => g.total), 1);
  const legend = `<div class="viz-legend">${REL_GRUPOS.map(([k, l]) => `<span><i style="background:${REL_COR[k]}"></i>${l}</span>`).join('')}</div>`;
  const barras = top.map(g => `<div class="hb-row"><div class="hb-l" title="${esc(g.nome)}">${esc(g.nome)}</div>
    <div class="hb-track"><div class="hb-stack" style="width:${g.total / maxT * 100}%">${REL_GRUPOS.filter(([k]) => g[k]).map(([k, l]) => `<div class="hb-seg" style="flex:${g[k]};background:${REL_COR[k]}" data-tip="<b>${esc(g.nome)}</b><br>${l}: ${g[k]} de ${g.total}"></div>`).join('')}</div>
    <span class="hb-v">${g.total}</span></div></div>`).join('');
  // pautas por dia
  const dias = []; for (let d = S.rf.from; d <= S.rf.to && dias.length < 370; d = addDays(d, 1)) dias.push(d);
  const porDia = {}; rows.forEach(r => { porDia[r.p.data] = (porDia[r.p.data] || 0) + 1; });
  const maxD = Math.max(...dias.map(d => porDia[d] || 0), 1);
  const tick = Math.ceil(dias.length / 10);
  const colunas = dias.map((d, i) => `<div class="cc-col" data-tip="<b>${fmtDate(d)}</b> (${esc(weekday(d))})<br>${porDia[d] || 0} pauta(s)"><div class="cc-bar" style="height:${(porDia[d] || 0) / maxD * 100}%"></div><span class="cc-x">${i % tick === 0 ? d.slice(8, 10) + '/' + d.slice(5, 7) : ''}</span></div>`).join('');
  // tempo médio de produção
  const comT = R.filter(g => g.medProd != null).slice(0, 12); const maxP = Math.max(...comT.map(g => g.medProd), 1);
  const tempos = comT.map(g => `<div class="hb-row"><div class="hb-l" title="${esc(g.nome)}">${esc(g.nome)}</div><div class="hb-track"><div class="hb-stack" style="width:${Math.max(1, g.medProd / maxP * 100)}%"><div class="hb-seg" style="flex:1;background:var(--viz-1)" data-tip="<b>${esc(g.nome)}</b><br>Tempo médio: ${fmtLongo(g.medProd)}<br>${g.produzida} produzida(s)"></div></div><span class="hb-v">${fmtLongo(g.medProd)}</span></div></div>`).join('');
  // motivos de queda
  const mot = {}; rows.filter(r => r.grupo === 'caiu').forEach(r => { const k = String(r.p.motivoQueda || 'Não informado').split(';')[0].trim() || 'Não informado'; mot[k] = (mot[k] || 0) + 1; });
  const motL = Object.entries(mot).sort((a, b) => b[1] - a[1]).slice(0, 10); const maxM = Math.max(...motL.map(x => x[1]), 1);
  const motivos = motL.map(([k, n]) => `<div class="hb-row"><div class="hb-l" title="${esc(k)}">${esc(k)}</div><div class="hb-track"><div class="hb-stack" style="width:${n / maxM * 100}%"><div class="hb-seg" style="flex:1;background:var(--viz-1)" data-tip="<b>${esc(k)}</b><br>${n} pauta(s)"></div></div><span class="hb-v">${n}</span></div></div>`).join('');
  return `<div class="viz-grid">
    <div class="card viz"><div class="pad"><h3>Pautas por ${AGR_LABEL[S.rf.agrupar].toLowerCase()}</h3>${legend}<div class="hb">${barras}</div></div></div>
    <div class="card viz"><div class="pad"><h3>Pautas por dia</h3><div class="hint">Quantidade de pautas por data da pauta</div><div class="cc" style="--n:${dias.length}"><div class="cc-grid"><span>${maxD}</span><span>${Math.round(maxD / 2)}</span><span>0</span></div><div class="cc-cols">${colunas}</div></div></div></div>
    <div class="card viz"><div class="pad"><h3>Tempo médio de produção por ${AGR_LABEL[S.rf.agrupar].toLowerCase()}</h3><div class="hint">Da criação da pauta até ela ficar "Gravada"</div>${comT.length ? `<div class="hb">${tempos}</div>` : '<div class="empty">Nenhuma pauta produzida no período.</div>'}</div></div>
    <div class="card viz"><div class="pad"><h3>Motivos de queda</h3><div class="hint">${rows.filter(r => r.grupo === 'caiu').length} pauta(s) caíram no período</div>${motL.length ? `<div class="hb">${motivos}</div>` : '<div class="empty">Nenhuma pauta caiu no período.</div>'}</div></div>
  </div>`;
}
// tooltip único para as marcas dos gráficos + abrir pauta ao clicar nas linhas
function relTooltip(root) {
  let tip = $('#viz-tip'); if (!tip) { tip = document.createElement('div'); tip.id = 'viz-tip'; tip.className = 'viz-tip'; document.body.appendChild(tip); }
  root.onmousemove = (e) => {
    const t = e.target.closest('[data-tip]'); if (!t) { tip.style.display = 'none'; return; }
    tip.innerHTML = t.dataset.tip; tip.style.display = 'block';
    const x = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8), y = Math.max(8, e.clientY - tip.offsetHeight - 12);
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  };
  root.onmouseleave = () => { tip.style.display = 'none'; };
  root.onclick = (e) => { const r = e.target.closest('[data-pid]'); if (r) showPautaReadOnly(r.dataset.pid); };
}
function relCsv() {
  const rows = relLinhas(); const q = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const head = ['Data', 'Retranca', 'Editoria', 'Tema', 'Repórter', 'Telejornal', 'Status', 'Situação', 'Tempo de produção (horas)', 'Tempo no espelho (mm:ss)', 'Foi ao ar', 'Motivo da queda'];
  const lines = rows.map(r => [fmtDate(r.p.data), r.p.retranca, r.p.editoria, r.tags.join(', '), r.rep, r.prog, label(PAUTA_STATUS, r.p.status), label(REL_GRUPOS, r.grupo),
    r.tProd != null ? (r.tProd / 3600).toFixed(1).replace('.', ',') : '', r.dur ? fmtDur(r.dur) : '', r.noAr ? 'Sim' : 'Não', r.p.motivoQueda || ''].map(q).join(';'));
  const blob = new Blob(['﻿' + [head.map(q).join(';'), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `relatorio-producao_${S.rf.from}_a_${S.rf.to}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function relPrint() {
  const rows = relLinhas(), R = relResumo(rows); const F = S.rf;
  const c = { produzida: 0, andamento: 0, caiu: 0 }; rows.forEach(r => c[r.grupo]++);
  doPrint(`<h1>Relatório de produção — ${esc(S.org.name)}</h1><div>Período: ${fmtDate(F.from)} a ${fmtDate(F.to)} · ${rows.length} pauta(s) · ${c.produzida} produzida(s) · ${c.andamento} em andamento · ${c.caiu} caíram · aproveitamento ${rows.length ? pct(c.produzida / rows.length) : '—'}</div>
    <h2>Resumo por ${AGR_LABEL[F.agrupar].toLowerCase()}</h2>
    <table><tr><th>${AGR_LABEL[F.agrupar]}</th><th>Pautas</th><th>Produzidas</th><th>Em andamento</th><th>Caíram</th><th>Aproveitamento</th><th>Tempo médio de produção</th><th>Tempo no espelho</th></tr>
    ${R.map(g => `<tr><td><b>${esc(g.nome)}</b></td><td>${g.total}</td><td>${g.produzida}</td><td>${g.andamento}</td><td>${g.caiu}</td><td>${pct(g.aprov)}</td><td>${fmtLongo(g.medProd)}</td><td>${fmtDur(g.dur, true)}</td></tr>`).join('')}</table>
    <h2>Pautas</h2><table><tr><th>Data</th><th>Retranca</th><th>Editoria</th><th>Repórter</th><th>Status</th><th>Produção</th><th>No espelho</th><th>Motivo da queda</th></tr>
    ${rows.map(r => `<tr><td>${fmtDate(r.p.data)}</td><td><b>${esc(r.p.retranca)}</b></td><td>${esc(r.p.editoria)}</td><td>${esc(r.rep)}</td><td>${esc(label(PAUTA_STATUS, r.p.status))}</td><td>${fmtLongo(r.tProd)}</td><td>${r.dur ? fmtDur(r.dur) : ''}</td><td>${esc(r.p.motivoQueda || '')}</td></tr>`).join('')}</table>`);
}

// =============================================================== BUSCA (pautas + matérias)
const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// destaca os termos (sem diferenciar acentos) devolvendo HTML seguro
function highlight(text, terms) {
  text = String(text || '').normalize('NFC');
  const f = fold(text); const ranges = [];
  terms.forEach(t => { let i = 0; while (t && (i = f.indexOf(t, i)) >= 0) { ranges.push([i, i + t.length]); i += t.length; } });
  if (!ranges.length) return esc(text);
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [ranges[0]]; ranges.slice(1).forEach(r => { const l = merged[merged.length - 1]; if (r[0] <= l[1]) l[1] = Math.max(l[1], r[1]); else merged.push(r); });
  let out = '', pos = 0;
  merged.forEach(([a, b]) => { out += esc(text.slice(pos, a)) + '<mark>' + esc(text.slice(a, b)) + '</mark>'; pos = b; });
  return out + esc(text.slice(pos));
}
function snippet(p, terms) {
  const ents = (p.entrevistados || []).map(e => [e.nome, e.funcao, e.local].filter(Boolean).join(' — ')).join(' · ');
  const fields = [['Matéria', p.materia], ['Proposta', p.proposta], ['Informações', p.historico], ['Marcação', ents], ['Encaminhamento', p.encaminhamento], ['Perguntas', p.perguntas], ['Observações', p.observacoes]];
  let hit = terms.length ? fields.find(([, v]) => terms.some(t => fold(v).includes(t))) : null;
  if (!hit) hit = fields.find(([, v]) => String(v || '').trim()) || ['', ''];
  const [lbl, val] = hit; const txt = String(val || '').normalize('NFC').replace(/\s+/g, ' ');
  let start = 0;
  if (terms.length) { const i = Math.min(...terms.map(t => { const k = fold(txt).indexOf(t); return k < 0 ? Infinity : k; })); if (isFinite(i)) start = Math.max(0, i - 90); }
  const piece = (start ? '…' : '') + txt.slice(start, start + 260) + (txt.length > start + 260 ? '…' : '');
  return lbl ? `<span class="snip-l">${lbl}</span> ${highlight(piece, terms)}` : '';
}
async function viewBusca() {
  S.bq = S.bq || { q: '', from: '', to: '', status: '', reporterId: '', comMateria: false };
  const B = S.bq;
  $('#main').innerHTML = `<div class="page buscapage">
    <h1>Busca de pautas e matérias</h1>
    <form id="bform" class="searchbar">
      <input type="search" id="bq" value="${esc(B.q)}" placeholder="Digite palavras: retranca, assunto, entrevistado, local, trecho da matéria…" autocomplete="off">
      <button class="btn primary">Buscar</button>
    </form>
    <div class="formbar bfilters">
      <label class="lbl">De</label><input type="date" id="b-from" value="${B.from}" style="width:auto">
      <label class="lbl">Até</label><input type="date" id="b-to" value="${B.to}" style="width:auto">
      <select id="b-status" style="width:auto"><option value="">Qualquer status</option>${opts(PAUTA_STATUS, B.status)}</select>
      <select id="b-rep" style="width:auto"><option value="">Qualquer repórter</option>${opts(S.users.map(u => [u.id, u.name]), B.reporterId)}</select>
      <label class="check"><input type="checkbox" id="b-mat" ${B.comMateria ? 'checked' : ''}> Só com matéria escrita</label>
      <button class="btn sm" id="b-clear" type="button">Limpar</button>
    </div>
    <div id="bres"><div class="empty">Buscando…</div></div>
  </div>`;
  const run = async () => {
    const q = new URLSearchParams();
    if (B.q) q.set('q', B.q); if (B.from) q.set('from', B.from); if (B.to) q.set('to', B.to);
    if (B.status) q.set('status', B.status); if (B.reporterId) q.set('reporterId', B.reporterId);
    const recent = !B.q && !B.from && !B.to && !B.status && !B.reporterId;
    if (B.comMateria || recent) q.set('comMateria', '1');
    let list = [];
    try { list = await api('GET', '/api/pautas?' + q); } catch (e) { return toast(e.message, true); }
    const terms = fold(B.q).split(/\s+/).filter(Boolean);
    const el = $('#bres'); if (!el) return;
    const shown = list.slice(0, 200);
    el.innerHTML = `<div class="hint" style="margin:4px 0 10px">${recent ? 'Matérias escritas mais recentes' : `${list.length} resultado(s)`}${list.length > 200 ? ' · mostrando os 200 mais recentes' : ''}</div>` +
      (shown.length ? shown.map(p => `<article class="result" data-id="${p.id}" tabindex="0">
        <div class="r-h"><span class="retr">${highlight(p.retranca, terms)}</span>
          <span class="mono hint">${fmtDate(p.data)}</span>
          <span class="pill st-${p.status}">${esc(label(PAUTA_STATUS, p.status))}</span>
          ${materiaPill(p)}
          <span class="hint">${esc(p.editoria || '')}${p.reporterId ? ' · Repórter: ' + esc(repName(p)) : ''}${prodName(p) ? ' · Produção: ' + esc(prodName(p)) : ''}</span></div>
        <div class="r-s">${snippet(p, terms)}</div>
      </article>`).join('') : '<div class="empty">Nada encontrado. Tente outras palavras ou amplie as datas.</div>');
  };
  $('#bform').onsubmit = (e) => { e.preventDefault(); B.q = $('#bq').value.trim(); run(); };
  let t; $('#bq').oninput = (e) => { clearTimeout(t); t = setTimeout(() => { B.q = e.target.value.trim(); run(); }, 350); };
  $('#b-from').onchange = (e) => { B.from = e.target.value; run(); };
  $('#b-to').onchange = (e) => { B.to = e.target.value; run(); };
  $('#b-status').onchange = (e) => { B.status = e.target.value; run(); };
  $('#b-rep').onchange = (e) => { B.reporterId = e.target.value; run(); };
  $('#b-mat').onchange = (e) => { B.comMateria = e.target.checked; run(); };
  $('#b-clear').onclick = () => { S.bq = null; viewBusca(); };
  const open = (e) => { const r = e.target.closest('.result'); if (r) showPautaReadOnly(r.dataset.id); };
  $('#bres').onclick = open;
  $('#bres').onkeydown = (e) => { if (e.key === 'Enter') open(e); };
  $('#bq').focus();
  await run();
}

// =============================================================== CALENDÁRIO
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const monthRange = (ym) => { const [y, m] = ym.split('-').map(Number); const last = new Date(y, m, 0).getDate(); return [`${ym}-01`, `${ym}-${String(last).padStart(2, '0')}`]; };
const shiftMonth = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
// grade mensal começando no domingo; cell(iso, inMonth) devolve o HTML da célula
function monthGrid(ym, cell, cls = '') {
  const [y, m] = ym.split('-').map(Number);
  const first = new Date(y, m - 1, 1); const startDow = first.getDay();
  const days = []; for (let i = 0; i < 42; i++) { const d = new Date(y, m - 1, 1 - startDow + i); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); days.push(d.toISOString().slice(0, 10)); }
  const weeks = days[35].slice(0, 7) === ym ? 6 : 5;
  return `<div class="cal ${cls}">${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => `<div class="cal-dow">${cls.includes('mini') ? d[0] : d}</div>`).join('')}
    ${days.slice(0, weeks * 7).map(iso => cell(iso, iso.slice(0, 7) === ym)).join('')}</div>`;
}
async function viewCalendario() {
  S.bigYm = S.bigYm || today().slice(0, 7);
  const ym = S.bigYm; const [from, to] = monthRange(ym);
  const [f2, t2] = [addDays(from, -7), addDays(to, 14)];
  let list = [];
  try { list = await api('GET', `/api/pautas?from=${f2}&to=${t2}`); } catch (e) { toast(e.message, true); }
  const filt = S.calFilter || '';
  if (filt) list = list.filter(p => p.programaId === filt);
  const byDay = {}; list.forEach(p => (byDay[p.data] = byDay[p.data] || []).push(p));
  const total = list.filter(p => p.data.slice(0, 7) === ym).length;
  $('#main').innerHTML = `<div class="page calpage">
    <div class="formbar" style="margin-bottom:12px">
      <button class="btn" data-cm="-1" aria-label="Mês anterior">‹</button>
      <h1 style="margin:0;min-width:200px;text-align:center">${MESES[+ym.slice(5) - 1]} ${ym.slice(0, 4)}</h1>
      <button class="btn" data-cm="1" aria-label="Próximo mês">›</button>
      <button class="btn" data-cm="0">Hoje</button>
      <select id="cal-prog" style="width:auto"><option value="">Todos os telejornais</option>${opts(S.programs.map(p => [p.id, p.name]), filt)}</select>
      <span class="hint">${total} pauta(s) no mês</span>
      <div style="flex:1"></div>
      <span class="legend">${PAUTA_STATUS.map(([k, l]) => `<span class="pill st-${k}">${l}</span>`).join(' ')}</span>
    </div>
    ${monthGrid(ym, (iso, inM) => {
      const ps = byDay[iso] || [];
      return `<div class="cal-cell ${inM ? '' : 'out'} ${iso === today() ? 'today' : ''}" data-day="${iso}">
        <div class="cal-top"><button class="cal-num" data-open-day="${iso}" title="Ver pautas do dia">${+iso.slice(8)}</button><button class="cal-add" data-new="${iso}" title="Nova pauta neste dia" aria-label="Nova pauta em ${fmtDate(iso)}">+</button></div>
        ${ps.slice(0, 5).map(p => `<button class="cal-ev st-${p.status}" data-pid="${p.id}" data-pday="${p.data}" title="${esc(p.retranca)} — ${esc(label(PAUTA_STATUS, p.status))}${p.horario ? ' · ' + esc(p.horario) : ''}">${p.horario ? `<span class="mono">${esc(p.horario)}</span> ` : ''}${esc(p.retranca)}</button>`).join('')}
        ${ps.length > 5 ? `<button class="cal-more" data-open-day="${iso}">+${ps.length - 5} pauta(s)</button>` : ''}
      </div>`;
    }, 'big')}
  </div>`;
  const main = $('#main');
  $('#cal-prog').onchange = (e) => { S.calFilter = e.target.value; viewCalendario(); };
  main.onclick = async (e) => {
    const cm = e.target.closest('[data-cm]');
    if (cm) { S.bigYm = cm.dataset.cm === '0' ? today().slice(0, 7) : shiftMonth(ym, +cm.dataset.cm); return viewCalendario(); }
    const nw = e.target.closest('[data-new]');
    if (nw) { S.pf.date = nw.dataset.new; S.pf.allDates = false; await go('pautas'); return openPauta(null); }
    const ev = e.target.closest('[data-pid]');
    if (ev) { S.pf.date = ev.dataset.pday; S.pf.allDates = false; await go('pautas'); return openPauta(ev.dataset.pid); }
    const od = e.target.closest('[data-open-day]');
    if (od) { S.pf.date = od.dataset.openDay; S.pf.allDates = false; return go('pautas'); }
  };
}

// =============================================================== TELEJORNAIS
async function viewProgramas() {
  S.programs = await api('GET', '/api/programs');
  const canEdit = S.perms.managePrograms;
  $('#main').innerHTML = `<div class="page"><h1>Telejornais</h1>
    <p class="hint">Horário de início, duração prevista (incluindo intervalos) e velocidade de leitura usada para calcular o tempo das cabeças.</p>
    <div class="card"><table class="grid"><thead><tr><th>Nome</th><th>Sigla</th><th>Início</th><th>Duração</th><th>Palavras/min</th><th>Apresentadores (vírgula)</th><th>Ativo</th><th></th></tr></thead><tbody>
    ${S.programs.map(p => `<tr data-id="${p.id}">
      <td><input type="text" data-k="name" value="${esc(p.name)}" ${canEdit ? '' : 'disabled'}></td>
      <td style="width:80px"><input type="text" data-k="sigla" value="${esc(p.sigla)}" ${canEdit ? '' : 'disabled'}></td>
      <td style="width:110px"><input type="text" class="mono" data-k="inicio" value="${esc(p.inicio)}" placeholder="hh:mm:ss" ${canEdit ? '' : 'disabled'}></td>
      <td style="width:110px"><input type="text" class="mono" data-k="duracao" value="${esc(p.duracao)}" placeholder="hh:mm:ss" ${canEdit ? '' : 'disabled'}></td>
      <td style="width:90px"><input type="number" data-k="wpm" value="${esc(p.wpm)}" min="80" max="300" ${canEdit ? '' : 'disabled'}></td>
      <td><input type="text" data-k="apresentadores" value="${esc(p.apresentadores)}" ${canEdit ? '' : 'disabled'}></td>
      <td><input type="checkbox" data-k="ativo" ${p.ativo !== false ? 'checked' : ''} ${canEdit ? '' : 'disabled'}></td>
      <td style="white-space:nowrap">${canEdit ? '<button class="btn sm primary" data-save>Salvar</button> <button class="btn sm danger" data-del title="Excluir telejornal">Excluir</button>' : ''}</td></tr>`).join('')}
    </tbody></table></div>
    ${canEdit ? `<div class="card"><div class="pad"><h3 style="margin-top:0">Novo telejornal</h3><form id="np" class="row4">
      <div class="field"><label>Nome</label><input type="text" name="name" required></div>
      <div class="field"><label>Sigla</label><input type="text" name="sigla"></div>
      <div class="field"><label>Início</label><input type="text" class="mono" name="inicio" value="12:00:00"></div>
      <div class="field"><label>Duração</label><input type="text" class="mono" name="duracao" value="00:30:00"></div>
      <div><button class="btn primary">Adicionar</button></div></form></div></div>` : ''}
  </div>`;
  $('#main').onclick = async (e) => {
    const d = e.target.closest('[data-del]');
    if (d) {
      const id = d.closest('tr').dataset.id; const pg = S.programs.find(x => x.id === id); if (!pg) return;
      if (!confirm(`Excluir o telejornal ${pg.name}?\n\nTodos os espelhos dele (de todas as datas) serão apagados e não poderão ser recuperados. As pautas continuam no sistema, só ficam sem telejornal de destino.\n\nSe quiser apenas tirar o jornal do ar, desmarque "Ativo" em vez de excluir.`)) return;
      try {
        await api('DELETE', '/api/programs/' + id);
        if (S.rd.programId === id) S.rd.programId = '';
        S.programs = await api('GET', '/api/programs');
        if (!S.rd.programId && S.programs.length) S.rd.programId = S.programs[0].id;
        toast('Telejornal excluído.'); viewProgramas();
      } catch (er) { toast(er.message, true); }
      return;
    }
    const b = e.target.closest('[data-save]'); if (!b) return;
    const tr = b.closest('tr'); const body = {};
    $$('[data-k]', tr).forEach(i => { body[i.dataset.k] = i.type === 'checkbox' ? i.checked : i.value; });
    try { await api('PUT', '/api/programs/' + tr.dataset.id, body); S.programs = await api('GET', '/api/programs'); toast('Telejornal salvo.'); } catch (er) { toast(er.message, true); }
  };
  const np = $('#np'); if (np) np.onsubmit = async (e) => { e.preventDefault(); try { await api('POST', '/api/programs', Object.fromEntries(new FormData(e.target))); toast('Telejornal criado.'); viewProgramas(); } catch (er) { toast(er.message, true); } };
}

// =============================================================== EQUIPE
// lê o logotipo e reduz imagens grandes para no máximo 900 px (fica leve no banco)
function readLogo(file) {
  return new Promise((ok, ko) => {
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) return ko(new Error('Use um arquivo PNG, JPG, WEBP ou SVG.'));
    const fr = new FileReader();
    fr.onerror = () => ko(new Error('Não foi possível ler o arquivo.'));
    fr.onload = () => {
      const url = fr.result;
      if (file.type === 'image/svg+xml') return url.length > 600000 ? ko(new Error('SVG muito grande.')) : ok(url);
      const img = new Image();
      img.onerror = () => ko(new Error('Imagem inválida.'));
      img.onload = () => {
        const k = Math.min(1, 900 / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        let out = c.toDataURL('image/png');
        if (out.length > 850000) out = c.toDataURL('image/webp', 0.9);
        out.length > 850000 ? ko(new Error('Imagem muito grande.')) : ok(out);
      };
      img.src = url;
    };
    fr.readAsDataURL(file);
  });
}
async function viewEquipe() {
  S.users = await api('GET', '/api/users');
  const adm = S.perms.manageUsers;
  const invites = SUPA_MODE && adm ? await api('GET', '/api/invites') : [];
  $('#main').innerHTML = `<div class="page"><h1>Equipe</h1>
    <div class="card"><table class="grid"><thead><tr><th>Nome</th><th>E-mail</th><th>Função</th><th>Licença</th><th>Situação</th><th>Desde</th>${adm ? '<th></th>' : ''}</tr></thead><tbody>
    ${S.users.map(u => `<tr data-id="${u.id}"><td><b>${esc(u.name)}</b></td><td>${esc(u.email)}</td>
      <td>${adm ? `<select data-role style="width:auto">${opts(S.roles.map(r => [r.id, r.label]), u.role)}</select>` : esc(u.roleLabel)}</td>
      <td>${adm && u.role !== 'admin' ? `<select data-lic style="width:auto" aria-label="Licença de ${esc(u.name)}">${opts(LICENCAS, u.licenca)}</select>` : esc(label(LICENCAS, u.licenca))}</td>
      <td>${u.active ? '<span class="pill st-gravada">Ativo</span>' : '<span class="pill st-caiu">Inativo</span>'}</td><td>${fmtDT(u.createdAt)}</td>
      ${adm ? `<td><button class="btn sm" data-toggle>${u.active ? 'Desativar' : 'Ativar'}</button>${SUPA_MODE ? '' : ' <button class="btn sm" data-reset>Nova senha</button>'}</td>` : ''}</tr>`).join('')}
    </tbody></table></div>
    ${adm && invites.length ? `<div class="card"><div class="pad"><h3 style="margin-top:0">Convites pendentes</h3>
      <table class="grid"><thead><tr><th>E-mail</th><th>Nome</th><th>Função</th><th>Licença</th><th>Enviado</th><th></th></tr></thead><tbody>
      ${invites.map(i => `<tr data-inv="${i.id}"><td>${esc(i.email)}</td><td>${esc(i.name)}</td><td>${esc((S.roles.find(r => r.id === i.role) || {}).label || i.role)}</td><td>${esc(label(LICENCAS, i.licenca || 'leitura'))}</td><td>${fmtDT(i.createdAt)}</td><td><button class="btn sm danger" data-invdel>Cancelar</button></td></tr>`).join('')}
      </tbody></table></div></div>` : ''}
    ${adm ? `<div class="card"><div class="pad"><h3 style="margin-top:0">${SUPA_MODE ? 'Convidar membro da equipe' : 'Adicionar membro da equipe'}</h3>
      ${SUPA_MODE ? '<p class="hint" style="margin-top:0">A pessoa entra em “Criar conta” com este e-mail e cai direto na sua redação, com a função escolhida.</p>' : ''}
      <form id="nu" class="row4" autocomplete="off">
        <div class="field"><label>Nome</label><input type="text" name="name" required></div>
        <div class="field"><label>E-mail</label><input type="email" name="email" required></div>
        ${SUPA_MODE ? '' : '<div class="field"><label>Senha inicial (mín. 8)</label><input type="password" name="password" required minlength="8" autocomplete="new-password"></div>'}
        <div class="field"><label>Função</label><select name="role">${opts(S.roles.map(r => [r.id, r.label]), 'reporter')}</select></div>
        <div class="field"><label>Licença</label><select name="licenca">${opts(LICENCAS, 'leitura')}</select></div>
        <div><button class="btn primary">Adicionar</button></div>
      </form>
      <p class="hint"><b>Licenças</b> (o que a pessoa pode fazer): <b>Leitura</b> só consulta, baixa PDF e imprime · <b>Edição</b> também cria e edita pautas e matérias · <b>Geral</b> tem tudo, incluindo o espelho do jornal. Administradores sempre têm Geral.</p>
      <p class="hint">Permissões da função: <b>Administrador</b> gerencia equipe e tudo mais · <b>Diretor de Produção e Multimídia</b> gerencia telejornais e funcionários, aprova espelhos e exclui pautas · <b>Chefe de reportagem</b> e <b>Editor</b> fecham e aprovam espelhos · <b>Produtor</b> cria e exclui pautas · <b>Repórter</b>, <b>Apresentador</b> e <b>Estagiário</b> editam pautas e laudas.</p>
    </div></div>` : ''}
    ${S.perms.managePrograms ? `<div class="card"><div class="pad"><h3 style="margin-top:0">Funcionários</h3>
      <p class="hint" style="margin-top:0">Cadastre quem trabalha na redação e a função de cada pessoa. Os nomes aparecem como sugestão nos campos de <b>Equipe</b> da pauta, onde também dá para escrever um nome à mão. Não cria acesso ao sistema.</p>
      <form id="fn-add" class="fn-form" autocomplete="off">
        <div class="field"><label>Nome</label><input type="text" name="nome" maxlength="80" required placeholder="Nome e sobrenome"></div>
        <div class="field"><label>Função</label><input type="text" name="funcao" list="dl-funcoes" maxlength="80" required placeholder="Escolha ou escreva a função"></div>
        <button class="btn primary">Adicionar funcionário</button>
      </form>
      <datalist id="dl-funcoes">${FUNCOES.map(x => `<option value="${esc(x)}"></option>`).join('')}</datalist>
      <div id="fn-list"></div>
    </div></div>` : ''}
    ${adm ? `<div class="card"><div class="pad"><h3 style="margin-top:0">Identidade da emissora</h3>
      <p class="hint" style="margin-top:0">Logotipo, cor e rodapé usados na impressão e no PDF de pautas e matérias.</p>
      <div class="brandset">
        <div class="brand-prev" id="br-prev"></div>
        <div class="brand-fields">
          <div class="field"><label>Nome da emissora</label><input type="text" id="br-name" value="${esc(S.org.name)}" maxlength="80"></div>
          <div class="field"><label>Logotipo (PNG, JPG, WEBP ou SVG)</label>
            <div class="formbar"><input type="file" id="br-file" accept="image/png,image/jpeg,image/webp,image/svg+xml"><button class="btn sm danger" id="br-rm" type="button">Remover logotipo</button></div></div>
          <div class="row2">
            <div class="field"><label>Cor do layout</label><input type="color" id="br-color" value="${esc(S.org.printColor || '#0b3566')}" style="height:34px;padding:2px"></div>
            <div class="field"><label>Rodapé (endereço, site, telefone)</label><input type="text" id="br-foot" value="${esc(S.org.printFooter || '')}" maxlength="200" placeholder="Ex.: Rua das Flores, 100 · ftvtec.com.br"></div>
          </div>
          <div class="formbar"><button class="btn primary" id="br-save" type="button">Salvar identidade</button><span class="hint">Veja o resultado em Pautas → Imprimir ou em Matérias → Imprimir / PDF.</span></div>
        </div>
      </div></div></div>` : ''}</div>`;
  if (S.perms.managePrograms) {
    let lista = funcionarios();
    const draw = () => {
      const ord = lista.map((f, i) => ({ ...f, i })).sort((a, b) => a.funcao.localeCompare(b.funcao, 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR'));
      $('#fn-list').innerHTML = ord.length ? `<table class="grid"><thead><tr><th>Nome</th><th>Função</th><th></th></tr></thead><tbody>
        ${ord.map(f => `<tr data-i="${f.i}"><td><b>${esc(f.nome)}</b></td><td><input type="text" list="dl-funcoes" value="${esc(f.funcao)}" maxlength="80" aria-label="Função de ${esc(f.nome)}"></td><td><button class="btn sm danger" type="button" data-fndel>Remover</button></td></tr>`).join('')}
        </tbody></table>` : '<div class="hint">Nenhum funcionário cadastrado ainda.</div>';
    };
    const save = async (nova, ok) => {
      try { S.org = Object.assign(S.org, await api('PUT', '/api/org/equipe', { funcionarios: nova, cinegrafistas: [], motoristas: [] })); lista = funcionarios(); draw(); toast(ok); return true; }
      catch (er) { toast(er.message, true); draw(); return false; }
    };
    draw();
    $('#fn-add').onsubmit = async (e) => {
      e.preventDefault(); const form = e.target;
      const nome = form.nome.value.trim(), funcao = form.funcao.value.trim(); if (!nome || !funcao) return;
      if (lista.some(f => f.nome.toLowerCase() === nome.toLowerCase() && f.funcao.toLowerCase() === funcao.toLowerCase())) return toast('Essa pessoa já está cadastrada nessa função.', true);
      if (await save([...lista, { nome, funcao }], 'Funcionário adicionado.')) { form.reset(); form.nome.focus(); }
    };
    $('#fn-list').onchange = (e) => {
      e.stopPropagation(); const i = +e.target.closest('tr').dataset.i, funcao = e.target.value.trim();
      if (!funcao) return draw();
      save(lista.map((f, n) => n === i ? { nome: f.nome, funcao } : f), 'Função atualizada.');
    };
    $('#fn-list').onclick = (e) => {
      if (!e.target.matches('[data-fndel]')) return; const i = +e.target.closest('tr').dataset.i;
      if (confirm(`Remover ${lista[i].nome} (${lista[i].funcao}) do cadastro?`)) save(lista.filter((_, n) => n !== i), 'Funcionário removido.');
    };
  }
  if (!adm) return;
  // identidade visual
  let brLogo = S.org.logo || '';
  const brPrev = () => {
    const c = $('#br-color').value;
    $('#br-prev').innerHTML = `<div class="bp-h" style="border-color:${esc(c)}"><div class="bp-logo"><img src="${esc(brLogo || 'logo-ftvtec.png')}" alt="Logotipo"></div>
      <div class="bp-t"><div style="color:${esc(c)}">PAUTA</div><b>RETRANCA DA MATÉRIA</b></div></div><div class="bp-l"></div><div class="bp-l s"></div><div class="bp-l"></div>`;
  };
  brPrev();
  $('#br-color').oninput = brPrev; $('#br-name').oninput = brPrev;
  $('#br-rm').onclick = () => { brLogo = ''; $('#br-file').value = ''; brPrev(); };
  $('#br-file').onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try { brLogo = await readLogo(file); brPrev(); } catch (er) { toast(er.message, true); e.target.value = ''; }
  };
  $('#br-save').onclick = async () => {
    try {
      S.org = Object.assign(S.org, await api('PUT', '/api/org', { name: $('#br-name').value, logo: brLogo, printColor: $('#br-color').value, printFooter: $('#br-foot').value }));
      $('.topbar .org').textContent = S.org.name; toast('Identidade da emissora salva.');
    } catch (er) { toast(er.message, true); }
  };
  $('#nu').onsubmit = async (e) => { e.preventDefault(); try { await api('POST', '/api/users', Object.fromEntries(new FormData(e.target))); toast(SUPA_MODE ? 'Convite registrado.' : 'Usuário criado.'); viewEquipe(); } catch (er) { toast(er.message, true); } };
  $$('[data-invdel]').forEach(b => b.onclick = async () => { try { await api('DELETE', '/api/invites/' + b.closest('tr').dataset.inv); viewEquipe(); } catch (er) { toast(er.message, true); } });
  $('#main').onchange = async (e) => {
    if (e.target.matches('[data-lic]')) { try { await api('PUT', '/api/users/' + e.target.closest('tr').dataset.id, { licenca: e.target.value }); toast('Licença alterada.'); } catch (er) { toast(er.message, true); } return viewEquipe(); }
    if (!e.target.matches('[data-role]')) return; const id = e.target.closest('tr').dataset.id;
    try { await api('PUT', '/api/users/' + id, { role: e.target.value }); toast('Função alterada.'); } catch (er) { toast(er.message, true); viewEquipe(); } };
  $('#main').onclick = async (e) => {
    const tr = e.target.closest('tr[data-id]'); if (!tr) return; const u = S.users.find(x => x.id === tr.dataset.id);
    if (e.target.matches('[data-toggle]')) { try { await api('PUT', '/api/users/' + u.id, { active: !u.active }); viewEquipe(); } catch (er) { toast(er.message, true); } }
    if (e.target.matches('[data-reset]')) {
      const md = modal('Definir nova senha — ' + u.name, `<form id="rp"><div class="field"><label>Nova senha (mín. 8)</label><input type="password" name="password" minlength="8" required autocomplete="new-password"></div><button class="btn primary">Salvar</button></form>`);
      $('#rp', md.el).onsubmit = async (ev) => { ev.preventDefault(); try { await api('PUT', '/api/users/' + u.id, Object.fromEntries(new FormData(ev.target))); md.close(); toast('Senha redefinida.'); } catch (er) { toast(er.message, true); } };
    }
  };
}

// =============================================================== ATIVIDADE
async function viewLog() {
  const logs = await api('GET', '/api/logs');
  $('#main').innerHTML = `<div class="page"><h1>Atividade da redação</h1><div class="card"><table class="grid"><thead><tr><th>Quando</th><th>Quem</th><th>Área</th><th>O quê</th></tr></thead><tbody>
    ${logs.map(l => `<tr><td class="mono">${fmtDT(l.at)}</td><td>${esc(l.userName)}</td><td>${esc(l.action)}</td><td>${esc(l.detail)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Sem atividade.</td></tr>'}
  </tbody></table></div></div>`;
}

// retorno do Google / link de e-mail com erro (ex.: domínio não permitido)
(function () {
  const q = new URLSearchParams(location.hash.includes('error') ? location.hash.slice(1) : location.search);
  const d = q.get('error_description');
  if (d) { S.loginMsg = d; history.replaceState(null, '', location.pathname); }
})();
boot();

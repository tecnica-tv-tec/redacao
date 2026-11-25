// Redação — Sistema de pautas e espelho de telejornal (SaaS multi-emissora)
// Servidor HTTP sem dependências externas. Persistência em data/db.json.
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const SESSION_DAYS = 7;
const LOCK_MS = 60 * 1000;

// ---------------------------------------------------------------- banco
let db = { orgs: [], users: [], sessions: [], programs: [], pautas: [], rundowns: [], items: [], logs: [] };
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (fs.existsSync(DB_FILE)) {
  db = Object.assign(db, JSON.parse(fs.readFileSync(DB_FILE, 'utf8')));
}
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, DB_FILE);
  }, 150);
}
const uid = () => crypto.randomBytes(9).toString('base64url');
const now = () => new Date().toISOString();

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
function checkPassword(pw, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(pw, salt, 64);
  return crypto.timingSafeEqual(test, Buffer.from(hash, 'hex'));
}

// ---------------------------------------------------------------- domínio
const ROLES = ['admin', 'chefe', 'editor', 'produtor', 'reporter', 'apresentador'];
const ROLE_LABEL = { admin: 'Administrador', chefe: 'Chefe de reportagem', editor: 'Editor', produtor: 'Produtor', reporter: 'Repórter', apresentador: 'Apresentador' };
const CAN = {
  manageUsers: ['admin'],
  managePrograms: ['admin', 'chefe'],
  editRundown: ['admin', 'chefe', 'editor', 'produtor', 'reporter', 'apresentador'],
  approveRundown: ['admin', 'chefe', 'editor'],
  deletePauta: ['admin', 'chefe', 'produtor'],
};
const can = (user, perm) => CAN[perm].includes(user.role);

const PAUTA_FIELDS = ['retranca', 'data', 'editoria', 'status', 'prioridade', 'programaId', 'formato',
  'produtorId', 'reporterId', 'reporterNome', 'cinegrafista', 'motorista', 'editorTexto', 'horario', 'local', 'endereco',
  'proposta', 'historico', 'encaminhamento', 'perguntas', 'imagens', 'arte', 'observacoes', 'entrevistados', 'roteiro', 'tags',
  'materia', 'materiaStatus', 'motivoQueda'];
// busca sem diferenciar acentos e maiúsculas
const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function pautaSearchText(p) {
  const ents = (p.entrevistados || []).map(e => [e.nome, e.funcao, e.local].join(' ')).join(' ');
  return fold([p.retranca, p.proposta, p.historico, p.encaminhamento, p.materia, p.local, p.endereco, p.tags, p.editoria, p.perguntas, p.observacoes, p.reporterNome, p.cinegrafista, p.motorista, ents].join(' '));
}
const ITEM_FIELDS = ['retranca', 'tipo', 'apresentador', 'reporter', 'editor', 'cabeca', 'deixa', 'texto', 'gc',
  'tempoVT', 'tempoCabManual', 'status', 'obs', 'pautaId', 'videoId', 'flagged', 'pagina'];

function pick(src, fields) {
  const out = {};
  for (const f of fields) if (src[f] !== undefined) out[f] = src[f];
  return out;
}
function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, roleLabel: ROLE_LABEL[u.role], active: u.active !== false, createdAt: u.createdAt };
}
function log(orgId, user, action, detail) {
  db.logs.push({ id: uid(), orgId, userId: user ? user.id : null, userName: user ? user.name : 'sistema', action, detail, at: now() });
  if (db.logs.length > 5000) db.logs.splice(0, db.logs.length - 5000);
}

// Travas de edição em memória: itemId/pautaId -> {userId, name, until}
const locks = new Map();
function lockInfo(id, me) {
  const l = locks.get(id);
  if (!l || l.until < Date.now()) { locks.delete(id); return null; }
  return { userId: l.userId, name: l.name, mine: me && l.userId === me.id };
}

function createOrg(orgName, admin) {
  const org = { id: uid(), name: orgName, plan: 'trial', createdAt: now() };
  db.orgs.push(org);
  const user = { id: uid(), orgId: org.id, name: admin.name, email: admin.email.toLowerCase(), password: hashPassword(admin.password), role: 'admin', active: true, createdAt: now() };
  db.users.push(user);
  db.programs.push(
    { id: uid(), orgId: org.id, name: 'JORNAL DA MANHÃ', sigla: 'JM', inicio: '06:00:00', duracao: '01:00:00', wpm: 170, apresentadores: '', ativo: true },
    { id: uid(), orgId: org.id, name: 'JORNAL DO MEIO-DIA', sigla: 'JMD', inicio: '12:00:00', duracao: '00:45:00', wpm: 170, apresentadores: '', ativo: true },
    { id: uid(), orgId: org.id, name: 'JORNAL DA NOITE', sigla: 'JN', inicio: '19:15:00', duracao: '00:35:00', wpm: 170, apresentadores: '', ativo: true },
  );
  return { org, user };
}

// ---------------------------------------------------------------- semente de demonstração
function seedDemo() {
  if (db.orgs.length) return;
  const { org, user } = createOrg('TV Demonstração', { name: 'Admin Demo', email: 'admin@demo.local', password: 'demo1234' });
  const mk = (name, email, role) => { const u = { id: uid(), orgId: org.id, name, email, password: hashPassword('demo1234'), role, active: true, createdAt: now() }; db.users.push(u); return u; };
  const chefe = mk('Carla Mendes', 'chefe@demo.local', 'chefe');
  const prod = mk('Paulo Ribeiro', 'produtor@demo.local', 'produtor');
  const rep1 = mk('Fernanda Lima', 'reporter@demo.local', 'reporter');
  const rep2 = mk('Ricardo Alves', 'reporter2@demo.local', 'reporter');
  const ed = mk('Marina Souza', 'editor@demo.local', 'editor');
  mk('Roberto Campos', 'apresentador@demo.local', 'apresentador');
  const today = new Date().toISOString().slice(0, 10);
  const jn = db.programs.find(p => p.orgId === org.id && p.sigla === 'JN');
  jn.apresentadores = 'Roberto Campos';
  const P = (o) => { const p = Object.assign({ id: uid(), orgId: org.id, data: today, createdBy: prod.id, createdAt: now(), updatedAt: now(), updatedBy: prod.id, entrevistados: [], roteiro: [], prioridade: 'normal', formato: 'VT' }, o); db.pautas.push(p); return p; };
  const p1 = P({ retranca: 'OBRAS AVENIDA', editoria: 'Cidade', status: 'em_apuracao', produtorId: prod.id, reporterId: rep1.id, cinegrafista: 'João Batista', programaId: jn.id, horario: '09:30', local: 'Av. Central, esquina com Rua 7', endereco: 'Av. Central, 1200 — Centro',
    proposta: 'Obras de recapeamento da Avenida Central estão atrasadas há 3 meses. Comerciantes reclamam de queda nas vendas e motoristas enfrentam congestionamento diário.',
    historico: 'A obra começou em agosto com previsão de 90 dias. A prefeitura alega chuvas e problemas com a empreiteira. Valor do contrato: R$ 4,2 milhões.',
    encaminhamento: 'Abrir com imagens do trânsito parado (aéreas, se possível). Sonora com comerciante e motorista. Ouvir secretário de Obras. Passagem da repórter no trecho interditado. Arte com cronograma original x atual.',
    perguntas: '- Qual o novo prazo?\n- Haverá multa para a empreiteira?\n- Quanto já foi pago?',
    imagens: 'Trânsito na hora do pico, máquinas paradas, lojas vazias.', arte: 'Cronograma da obra (previsto x realizado).',
    entrevistados: [
      { nome: 'Antônio Pereira', funcao: 'Comerciante', telefone: '(11) 90000-0001', horario: '09:30', local: 'Loja na Av. Central, 1180', confirmado: true },
      { nome: 'Sec. Luiz Ferraz', funcao: 'Secretário municipal de Obras', telefone: '(11) 3000-0000 (assessoria)', horario: '11:00', local: 'Prefeitura', confirmado: false },
    ] });
  const p2 = P({ retranca: 'VACINAÇÃO GRIPE', editoria: 'Saúde', status: 'pronta', produtorId: prod.id, reporterId: rep2.id, programaId: jn.id, horario: '08:00', local: 'UBS Vila Nova',
    proposta: 'Campanha de vacinação contra a gripe é ampliada para todas as idades a partir de hoje.', historico: 'Cobertura atual está em 48%, abaixo da meta de 90%.', encaminhamento: 'Fila na UBS, sonora com enfermeira e com moradores. Serviço: locais e horários.',
    entrevistados: [{ nome: 'Ana Costa', funcao: 'Enfermeira', telefone: '', horario: '08:00', local: 'UBS Vila Nova', confirmado: true }],
    materiaStatus: 'aprovada', materiaAutorId: rep2.id, materiaAt: now(),
    materia: '[OFF]\nA fila começou cedo na UBS Vila Nova. Desde hoje, qualquer pessoa pode tomar a vacina contra a gripe.\n\n[SONORA] ANA COSTA / ENFERMEIRA\n"A procura dobrou logo nas primeiras horas."\n\n[OFF]\nA cobertura na cidade está em 48 por cento, longe da meta de 90.\n\n[PASSAGEM] RICARDO ALVES\nPara se vacinar, é só levar um documento com foto a qualquer posto de saúde.' });
  P({ retranca: 'PREVISÃO DO TEMPO', editoria: 'Tempo', status: 'sugestao', produtorId: prod.id, programaId: jn.id, formato: 'NOTA', proposta: 'Frente fria chega no fim de semana. Temperatura pode cair 10 graus.' });
  P({ retranca: 'FINAL CAMPEONATO', editoria: 'Esporte', status: 'em_producao', produtorId: chefe.id, reporterId: rep1.id, programaId: jn.id, formato: 'LINK', proposta: 'Link ao vivo do estádio com a expectativa para a final.' });

  const rd = { id: uid(), orgId: org.id, programId: jn.id, data: today, status: 'aberto', notas: '', createdAt: now(), updatedAt: now() };
  db.rundowns.push(rd);
  let ord = 0;
  const I = (o) => db.items.push(Object.assign({ id: uid(), orgId: org.id, rundownId: rd.id, ordem: ord++, status: 'rascunho', apresentador: 'ROBERTO', reporter: '', editor: '', cabeca: '', deixa: '', texto: '', gc: '', tempoVT: '', obs: '', updatedAt: now() }, o));
  I({ retranca: 'ESCALADA', tipo: 'ESCALADA', cabeca: 'Obras atrasadas param a Avenida Central e comerciantes contabilizam prejuízo.\nA vacina contra a gripe agora é para todo mundo.\nE a expectativa para a grande final de domingo.', status: 'aprovado' });
  I({ retranca: 'ABERTURA', tipo: 'VINHETA', tempoVT: '00:10', status: 'aprovado' });
  I({ retranca: 'OBRAS AVENIDA', tipo: 'VT', reporter: 'FERNANDA LIMA', editor: 'MARINA', pautaId: p1.id, tempoVT: '02:15', cabeca: 'Boa noite. A obra que deveria durar três meses já passa de seis na Avenida Central. Quem tem comércio na região diz que as vendas caíram pela metade. A repórter Fernanda Lima foi conferir.', deixa: '...O NOVO PRAZO É MARÇO.', gc: 'ANTÔNIO PEREIRA / COMERCIANTE\nLUIZ FERRAZ / SECRETÁRIO DE OBRAS', status: 'pronto' });
  I({ retranca: 'OBRAS AVENIDA - NP', tipo: 'NP', cabeca: 'Em nota, a empreiteira informou que vai reforçar as equipes a partir da próxima semana.' });
  I({ retranca: 'INTERVALO 1', tipo: 'INTERVALO', tempoVT: '02:30' });
  I({ retranca: 'VACINAÇÃO GRIPE', tipo: 'VT', reporter: 'RICARDO ALVES', editor: 'MARINA', pautaId: p2.id, tempoVT: '01:45', cabeca: 'A partir de hoje qualquer pessoa pode tomar a vacina contra a gripe nos postos de saúde. A cobertura está abaixo da meta.', deixa: '...É SÓ LEVAR UM DOCUMENTO.' });
  I({ retranca: 'PREVISÃO DO TEMPO', tipo: 'NC', tempoVT: '00:30', cabeca: 'E a previsão é de frio intenso no fim de semana. Uma frente fria chega no sábado e as temperaturas podem cair até dez graus.' });
  I({ retranca: 'INTERVALO 2', tipo: 'INTERVALO', tempoVT: '02:30' });
  I({ retranca: 'FINAL CAMPEONATO', tipo: 'LINK', reporter: 'FERNANDA LIMA', tempoVT: '02:00', cabeca: 'Domingo tem decisão no estádio municipal. A repórter Fernanda Lima está lá, ao vivo. Fernanda, como está a movimentação?' });
  I({ retranca: 'ENCERRAMENTO', tipo: 'ENCERRAMENTO', cabeca: 'O Jornal da Noite fica por aqui. Boa noite e até amanhã.' });
  log(org.id, user, 'seed', 'Dados de demonstração criados');
  save();
  console.log('Dados de demonstração criados (veja README.md para os logins).');
}
seedDemo();

// ---------------------------------------------------------------- HTTP util
function send(res, status, body, headers = {}) {
  const data = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }, headers));
  res.end(data);
}
const err = (res, status, message) => send(res, status, { error: message });
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > 2e6) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { if (!chunks.length) return resolve({}); try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new Error('json')); } });
    req.on('error', reject);
  });
}
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
  return out;
}
function currentUser(req) {
  const token = parseCookies(req).sid;
  if (!token) return null;
  const s = db.sessions.find(s => s.token === token);
  if (!s || new Date(s.expires) < new Date()) return null;
  const u = db.users.find(u => u.id === s.userId);
  if (!u || u.active === false) return null;
  return u;
}
function sessionCookie(token, maxAge) {
  return `sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };
function serveStatic(req, res, pathname) {
  let p = pathname === '/' ? '/index.html' : pathname;
  const file = path.normalize(path.join(PUBLIC_DIR, p));
  if (!file.startsWith(PUBLIC_DIR)) return err(res, 403, 'forbidden');
  fs.readFile(file, (e, data) => {
    if (e) {
      // SPA fallback
      return fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, html) => {
        if (e2) return err(res, 404, 'not found');
        res.writeHead(200, { 'Content-Type': MIME['.html'] }); res.end(html);
      });
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

// ---------------------------------------------------------------- roteador
const routes = [];
const route = (method, pattern, handler, opts = {}) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, handler, auth: opts.auth !== false });
};

const loginAttempts = new Map();

// --- autenticação
route('POST', '/api/auth/signup', async (req, res, { body }) => {
  const { orgName, name, email, password } = body;
  if (!orgName || !name || !email || !password) return err(res, 400, 'Preencha todos os campos.');
  if (String(password).length < 8) return err(res, 400, 'A senha deve ter pelo menos 8 caracteres.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return err(res, 400, 'E-mail inválido.');
  if (db.users.some(u => u.email === email.toLowerCase())) return err(res, 409, 'Este e-mail já está cadastrado.');
  const { org, user } = createOrg(String(orgName).trim(), { name: String(name).trim(), email, password });
  const token = crypto.randomBytes(32).toString('hex');
  db.sessions.push({ token, userId: user.id, expires: new Date(Date.now() + SESSION_DAYS * 864e5).toISOString() });
  log(org.id, user, 'signup', `Emissora ${org.name} criada`);
  save();
  send(res, 201, { ok: true }, { 'Set-Cookie': sessionCookie(token, SESSION_DAYS * 86400) });
}, { auth: false });

route('POST', '/api/auth/login', async (req, res, { body }) => {
  const ip = req.socket.remoteAddress;
  const a = loginAttempts.get(ip) || { n: 0, t: Date.now() };
  if (Date.now() - a.t > 15 * 60e3) { a.n = 0; a.t = Date.now(); }
  if (a.n >= 10) return err(res, 429, 'Muitas tentativas. Aguarde alguns minutos.');
  const u = db.users.find(u => u.email === String(body.email || '').toLowerCase());
  if (!u || u.active === false || !checkPassword(String(body.password || ''), u.password)) {
    a.n++; loginAttempts.set(ip, a);
    return err(res, 401, 'E-mail ou senha incorretos.');
  }
  loginAttempts.delete(ip);
  const token = crypto.randomBytes(32).toString('hex');
  db.sessions = db.sessions.filter(s => new Date(s.expires) > new Date());
  db.sessions.push({ token, userId: u.id, expires: new Date(Date.now() + SESSION_DAYS * 864e5).toISOString() });
  log(u.orgId, u, 'login', '');
  save();
  send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(token, SESSION_DAYS * 86400) });
}, { auth: false });

route('POST', '/api/auth/logout', async (req, res) => {
  const token = parseCookies(req).sid;
  db.sessions = db.sessions.filter(s => s.token !== token);
  save();
  send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', 0) });
}, { auth: false });

route('GET', '/api/me', async (req, res, { user }) => {
  const org = db.orgs.find(o => o.id === user.orgId);
  send(res, 200, { user: publicUser(user), org, roles: ROLES.map(r => ({ id: r, label: ROLE_LABEL[r] })),
    perms: Object.fromEntries(Object.keys(CAN).map(k => [k, can(user, k)])) });
});

// --- dados da emissora (nome, logotipo e layout de impressão)
route('PUT', '/api/org', async (req, res, { user, body }) => {
  if (!can(user, 'manageUsers')) return err(res, 403, 'Só o administrador altera os dados da emissora.');
  const org = db.orgs.find(o => o.id === user.orgId);
  if (body.name !== undefined) { const n = String(body.name).trim(); if (!n) return err(res, 400, 'Informe o nome da emissora.'); org.name = n.slice(0, 80); }
  if (body.logo !== undefined) {
    const logo = String(body.logo || '');
    if (logo && !/^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(logo)) return err(res, 400, 'Logotipo inválido. Use PNG, JPG, WEBP ou SVG.');
    if (logo.length > 900000) return err(res, 400, 'Logotipo muito grande (máx. ~650 KB).');
    org.logo = logo;
  }
  if (body.printColor !== undefined) { const c = String(body.printColor); if (!/^#[0-9a-fA-F]{6}$/.test(c)) return err(res, 400, 'Cor inválida.'); org.printColor = c; }
  if (body.printFooter !== undefined) org.printFooter = String(body.printFooter || '').slice(0, 200);
  log(user.orgId, user, 'emissora', 'Atualizou os dados da emissora'); save();
  send(res, 200, org);
});

// --- equipe técnica (nomes sugeridos na pauta): admin e chefe de reportagem
route('PUT', '/api/org/equipe', async (req, res, { user, body }) => {
  if (!can(user, 'managePrograms')) return err(res, 403, 'Sem permissão.');
  const org = db.orgs.find(o => o.id === user.orgId);
  const clean = (v) => [...new Set((Array.isArray(v) ? v : []).map(s => String(s).trim()).filter(Boolean))].slice(0, 200).map(s => s.slice(0, 80));
  if (body.cinegrafistas !== undefined) org.cinegrafistas = clean(body.cinegrafistas);
  if (body.motoristas !== undefined) org.motoristas = clean(body.motoristas);
  log(user.orgId, user, 'equipe', 'Atualizou cinegrafistas e motoristas'); save();
  send(res, 200, org);
});

route('PUT', '/api/me/password', async (req, res, { user, body }) => {
  if (!checkPassword(String(body.current || ''), user.password)) return err(res, 400, 'Senha atual incorreta.');
  if (String(body.password || '').length < 8) return err(res, 400, 'A nova senha deve ter pelo menos 8 caracteres.');
  user.password = hashPassword(body.password); save();
  send(res, 200, { ok: true });
});

// --- equipe
route('GET', '/api/users', async (req, res, { user }) => {
  send(res, 200, db.users.filter(u => u.orgId === user.orgId).map(publicUser));
});
route('POST', '/api/users', async (req, res, { user, body }) => {
  if (!can(user, 'manageUsers')) return err(res, 403, 'Sem permissão.');
  const { name, email, password, role } = body;
  if (!name || !email || !password || !ROLES.includes(role)) return err(res, 400, 'Dados inválidos.');
  if (String(password).length < 8) return err(res, 400, 'A senha deve ter pelo menos 8 caracteres.');
  if (db.users.some(u => u.email === email.toLowerCase())) return err(res, 409, 'E-mail já cadastrado.');
  const u = { id: uid(), orgId: user.orgId, name, email: email.toLowerCase(), password: hashPassword(password), role, active: true, createdAt: now() };
  db.users.push(u); log(user.orgId, user, 'usuario', `Criou ${name}`); save();
  send(res, 201, publicUser(u));
});
route('PUT', '/api/users/:id', async (req, res, { user, body, params }) => {
  if (!can(user, 'manageUsers')) return err(res, 403, 'Sem permissão.');
  const u = db.users.find(u => u.id === params.id && u.orgId === user.orgId);
  if (!u) return err(res, 404, 'Usuário não encontrado.');
  if (body.name) u.name = body.name;
  if (body.role && ROLES.includes(body.role)) {
    if (u.id === user.id && body.role !== 'admin') return err(res, 400, 'Você não pode remover seu próprio acesso de administrador.');
    u.role = body.role;
  }
  if (typeof body.active === 'boolean') {
    if (u.id === user.id && !body.active) return err(res, 400, 'Você não pode desativar a si mesmo.');
    u.active = body.active;
    if (!u.active) db.sessions = db.sessions.filter(s => s.userId !== u.id);
  }
  if (body.password) { if (String(body.password).length < 8) return err(res, 400, 'Senha curta.'); u.password = hashPassword(body.password); }
  save(); send(res, 200, publicUser(u));
});

// --- programas (telejornais)
route('GET', '/api/programs', async (req, res, { user }) => send(res, 200, db.programs.filter(p => p.orgId === user.orgId)));
route('POST', '/api/programs', async (req, res, { user, body }) => {
  if (!can(user, 'managePrograms')) return err(res, 403, 'Sem permissão.');
  if (!body.name) return err(res, 400, 'Informe o nome do programa.');
  const p = { id: uid(), orgId: user.orgId, name: String(body.name).toUpperCase(), sigla: body.sigla || '', inicio: body.inicio || '12:00:00', duracao: body.duracao || '00:30:00', wpm: Number(body.wpm) || 170, apresentadores: body.apresentadores || '', ativo: true };
  db.programs.push(p); save(); send(res, 201, p);
});
route('PUT', '/api/programs/:id', async (req, res, { user, body, params }) => {
  if (!can(user, 'managePrograms')) return err(res, 403, 'Sem permissão.');
  const p = db.programs.find(p => p.id === params.id && p.orgId === user.orgId);
  if (!p) return err(res, 404, 'Programa não encontrado.');
  Object.assign(p, pick(body, ['name', 'sigla', 'inicio', 'duracao', 'apresentadores', 'ativo']));
  if (body.wpm) p.wpm = Number(body.wpm) || 170;
  save(); send(res, 200, p);
});
route('DELETE', '/api/programs/:id', async (req, res, { user, params }) => {
  if (!can(user, 'managePrograms')) return err(res, 403, 'Sem permissão.');
  const p = db.programs.find(p => p.id === params.id && p.orgId === user.orgId);
  if (!p) return err(res, 404, 'Programa não encontrado.');
  // apaga os espelhos do telejornal; as pautas continuam, só perdem o destino
  const rdIds = new Set(db.rundowns.filter(r => r.programId === p.id).map(r => r.id));
  db.items = db.items.filter(i => !rdIds.has(i.rundownId));
  db.rundowns = db.rundowns.filter(r => !rdIds.has(r.id));
  db.pautas.forEach(x => { if (x.programaId === p.id) x.programaId = ''; });
  db.programs = db.programs.filter(x => x.id !== p.id);
  log(user.orgId, user, 'programa', `Excluiu o telejornal ${p.name} (${rdIds.size} espelho(s))`); save();
  send(res, 200, { ok: true, espelhos: rdIds.size });
});

// --- pautas
function pautaOut(p, me) {
  return Object.assign({}, p, { lock: lockInfo('p:' + p.id, me) });
}
route('GET', '/api/pautas', async (req, res, { user, query }) => {
  let list = db.pautas.filter(p => p.orgId === user.orgId && !p.deleted);
  if (query.from) list = list.filter(p => p.data >= query.from);
  if (query.to) list = list.filter(p => p.data <= query.to);
  if (query.status) list = list.filter(p => p.status === query.status);
  if (query.editoria) list = list.filter(p => p.editoria === query.editoria);
  if (query.programaId) list = list.filter(p => p.programaId === query.programaId);
  if (query.mine) list = list.filter(p => p.reporterId === user.id || p.produtorId === user.id);
  if (query.reporterId) list = list.filter(p => p.reporterId === query.reporterId);
  if (query.comMateria) list = list.filter(p => String(p.materia || '').trim());
  if (query.q) {
    const terms = fold(query.q).split(/\s+/).filter(Boolean);
    list = list.filter(p => { const t = pautaSearchText(p); return terms.every(w => t.includes(w)); });
  }
  list.sort((a, b) => (b.data || '').localeCompare(a.data || '') || (a.horario || '').localeCompare(b.horario || '') || a.retranca.localeCompare(b.retranca));
  send(res, 200, list.map(p => pautaOut(p, user)));
});
// --- relatório: retrancas do espelho ligadas a pautas, para somar o tempo no ar
route('GET', '/api/relatorio/itens', async (req, res, { user, query }) => {
  const rds = db.rundowns.filter(r => r.orgId === user.orgId && (!query.from || r.data >= query.from) && (!query.to || r.data <= query.to));
  const out = [];
  rds.forEach(rd => {
    const pg = db.programs.find(x => x.id === rd.programId) || {};
    db.items.filter(i => i.rundownId === rd.id && !i.deleted && i.pautaId).forEach(i => out.push({ pautaId: i.pautaId, data: rd.data, programa: pg.name || '', wpm: pg.wpm || 170, tipo: i.tipo, status: i.status, tempoVT: i.tempoVT, tempoCabManual: i.tempoCabManual, cabeca: i.cabeca, texto: i.texto, aoArAt: i.aoArAt || null }));
  });
  send(res, 200, out);
});
route('GET', '/api/pautas/:id', async (req, res, { user, params }) => {
  const p = db.pautas.find(p => p.id === params.id && p.orgId === user.orgId && !p.deleted);
  if (!p) return err(res, 404, 'Pauta não encontrada.');
  const usos = db.items.filter(i => i.pautaId === p.id && i.orgId === user.orgId).map(i => {
    const rd = db.rundowns.find(r => r.id === i.rundownId); const pg = rd && db.programs.find(x => x.id === rd.programId);
    return { rundownId: i.rundownId, data: rd && rd.data, programa: pg && pg.name };
  });
  send(res, 200, Object.assign(pautaOut(p, user), { usos }));
});
route('POST', '/api/pautas', async (req, res, { user, body }) => {
  const data = pick(body, PAUTA_FIELDS);
  if (!data.retranca) return err(res, 400, 'Informe a retranca.');
  if (data.status === 'caiu' && !String(data.motivoQueda || '').trim()) return err(res, 400, 'Informe o motivo da queda da pauta.');
  const p = Object.assign({ id: uid(), orgId: user.orgId, status: 'sugestao', prioridade: 'normal', data: new Date().toISOString().slice(0, 10), entrevistados: [], roteiro: [] }, data,
    { retranca: String(data.retranca).toUpperCase(), createdBy: user.id, createdAt: now(), updatedAt: now(), updatedBy: user.id });
  if (String(p.materia || '').trim()) { p.materiaAutorId = user.id; p.materiaAt = now(); }
  p.statusHist = [{ status: p.status, at: p.createdAt, by: user.name }];
  db.pautas.push(p); log(user.orgId, user, 'pauta', `Criou ${p.retranca}`); save();
  send(res, 201, pautaOut(p, user));
});
route('PUT', '/api/pautas/:id', async (req, res, { user, body, params }) => {
  const p = db.pautas.find(p => p.id === params.id && p.orgId === user.orgId && !p.deleted);
  if (!p) return err(res, 404, 'Pauta não encontrada.');
  const l = lockInfo('p:' + p.id, user);
  if (l && !l.mine) return err(res, 423, `Pauta em edição por ${l.name}.`);
  if (body.updatedAt && body.updatedAt !== p.updatedAt && !body.force) return err(res, 409, 'A pauta foi alterada por outra pessoa. Recarregue antes de salvar.');
  const nextSt = body.status !== undefined ? body.status : p.status, nextMot = body.motivoQueda !== undefined ? body.motivoQueda : p.motivoQueda;
  if (nextSt === 'caiu' && !String(nextMot || '').trim()) return err(res, 400, 'Informe o motivo da queda da pauta.');
  const oldMateria = p.materia || '', oldStatus = p.status;
  Object.assign(p, pick(body, PAUTA_FIELDS), { updatedAt: now(), updatedBy: user.id });
  if ((p.materia || '') !== oldMateria) { p.materiaAutorId = user.id; p.materiaAt = now(); }
  if (p.status !== oldStatus) p.statusHist = [...(p.statusHist || []), { status: p.status, at: now(), by: user.name }];   // tempo de produção (relatório)
  if (p.retranca) p.retranca = String(p.retranca).toUpperCase();
  log(user.orgId, user, 'pauta', `Editou ${p.retranca}`); save();
  send(res, 200, pautaOut(p, user));
});
route('DELETE', '/api/pautas/:id', async (req, res, { user, params }) => {
  if (!can(user, 'deletePauta')) return err(res, 403, 'Sem permissão para excluir pautas.');
  const p = db.pautas.find(p => p.id === params.id && p.orgId === user.orgId);
  if (!p) return err(res, 404, 'Pauta não encontrada.');
  p.deleted = true; p.updatedAt = now(); log(user.orgId, user, 'pauta', `Excluiu ${p.retranca}`); save();
  send(res, 200, { ok: true });
});

// --- travas de edição (pauta "p:id" ou item "i:id")
route('POST', '/api/locks/:key', async (req, res, { user, params }) => {
  const key = params.key;
  const l = lockInfo(key, user);
  if (l && !l.mine) return send(res, 200, { ok: false, lock: l });
  locks.set(key, { userId: user.id, name: user.name, until: Date.now() + LOCK_MS });
  send(res, 200, { ok: true });
});
route('DELETE', '/api/locks/:key', async (req, res, { user, params }) => {
  const l = locks.get(params.key);
  if (l && l.userId === user.id) locks.delete(params.key);
  send(res, 200, { ok: true });
});

// --- espelhos
function rundownOut(rd, me) {
  const items = db.items.filter(i => i.rundownId === rd.id && !i.deleted).sort((a, b) => a.ordem - b.ordem)
    .map(i => Object.assign({}, i, { lock: lockInfo('i:' + i.id, me) }));
  const program = db.programs.find(p => p.id === rd.programId);
  return Object.assign({}, rd, { program, items });
}
route('GET', '/api/rundowns', async (req, res, { user, query }) => {
  const program = db.programs.find(p => p.id === query.programId && p.orgId === user.orgId);
  if (!program || !query.data) return err(res, 400, 'Informe programa e data.');
  let rd = db.rundowns.find(r => r.orgId === user.orgId && r.programId === program.id && r.data === query.data);
  if (!rd) {
    if (query.create !== '1') return send(res, 200, null);
    rd = { id: uid(), orgId: user.orgId, programId: program.id, data: query.data, status: 'aberto', notas: '', createdAt: now(), updatedAt: now() };
    db.rundowns.push(rd);
    // estrutura padrão de um espelho
    const base = [['ESCALADA', 'ESCALADA'], ['ABERTURA', 'VINHETA'], ['INTERVALO 1', 'INTERVALO'], ['INTERVALO 2', 'INTERVALO'], ['ENCERRAMENTO', 'ENCERRAMENTO']];
    base.forEach(([retranca, tipo], n) => db.items.push({ id: uid(), orgId: user.orgId, rundownId: rd.id, ordem: n, retranca, tipo, status: 'rascunho', apresentador: '', reporter: '', editor: '', cabeca: '', deixa: '', texto: '', gc: '', tempoVT: tipo === 'INTERVALO' ? '02:30' : tipo === 'VINHETA' ? '00:10' : '', obs: '', updatedAt: now() }));
    log(user.orgId, user, 'espelho', `Criou espelho ${program.name} ${query.data}`);
    save();
  }
  send(res, 200, rundownOut(rd, user));
});
route('GET', '/api/rundowns/:id', async (req, res, { user, params }) => {
  const rd = db.rundowns.find(r => r.id === params.id && r.orgId === user.orgId);
  if (!rd) return err(res, 404, 'Espelho não encontrado.');
  send(res, 200, rundownOut(rd, user));
});
route('PUT', '/api/rundowns/:id', async (req, res, { user, params, body }) => {
  const rd = db.rundowns.find(r => r.id === params.id && r.orgId === user.orgId);
  if (!rd) return err(res, 404, 'Espelho não encontrado.');
  if (body.status && body.status !== rd.status) {
    if (!can(user, 'approveRundown')) return err(res, 403, 'Apenas editores podem fechar/liberar o espelho.');
    rd.status = body.status; log(user.orgId, user, 'espelho', `Status → ${body.status}`);
  }
  if (body.notas !== undefined) rd.notas = body.notas;
  rd.updatedAt = now(); save();
  send(res, 200, rundownOut(rd, user));
});
function touchRundown(id) { const rd = db.rundowns.find(r => r.id === id); if (rd) rd.updatedAt = now(); return rd; }
function guardClosed(rd, user, res) {
  if (rd.status === 'fechado' && !can(user, 'approveRundown')) { err(res, 423, 'Espelho fechado pelo editor-chefe.'); return true; }
  return false;
}
route('POST', '/api/rundowns/:id/items', async (req, res, { user, params, body }) => {
  const rd = db.rundowns.find(r => r.id === params.id && r.orgId === user.orgId);
  if (!rd) return err(res, 404, 'Espelho não encontrado.');
  if (guardClosed(rd, user, res)) return;
  const items = db.items.filter(i => i.rundownId === rd.id && !i.deleted).sort((a, b) => a.ordem - b.ordem);
  let data = pick(body, ITEM_FIELDS);
  if (body.pautaId) {
    const p = db.pautas.find(p => p.id === body.pautaId && p.orgId === user.orgId);
    if (p) {
      const rep = db.users.find(u => u.id === p.reporterId);
      data = Object.assign({ retranca: p.retranca, tipo: p.formato || 'VT', reporter: rep ? rep.name.toUpperCase() : String(p.reporterNome || '').toUpperCase(), obs: '', pautaId: p.id, texto: p.materia || '' }, data);
    }
  }
  const item = Object.assign({ id: uid(), orgId: user.orgId, rundownId: rd.id, retranca: 'NOVA RETRANCA', tipo: 'NOTA', status: 'rascunho', apresentador: '', reporter: '', editor: '', cabeca: '', deixa: '', texto: '', gc: '', tempoVT: '', obs: '' }, data,
    { updatedAt: now(), updatedBy: user.id });
  item.retranca = String(item.retranca).toUpperCase();
  // posição: após afterId, ou antes do ENCERRAMENTO, ou no fim
  let idx = items.length;
  if (body.afterId) { const k = items.findIndex(i => i.id === body.afterId); if (k >= 0) idx = k + 1; }
  else { const k = items.findIndex(i => i.tipo === 'ENCERRAMENTO'); if (k >= 0) idx = k; }
  items.splice(idx, 0, item);
  items.forEach((i, n) => { i.ordem = n; });
  db.items.push(item);
  touchRundown(rd.id); log(user.orgId, user, 'espelho', `Incluiu ${item.retranca}`); save();
  send(res, 201, item);
});
route('PUT', '/api/items/:id', async (req, res, { user, params, body }) => {
  const item = db.items.find(i => i.id === params.id && i.orgId === user.orgId && !i.deleted);
  if (!item) return err(res, 404, 'Retranca não encontrada.');
  const rd = db.rundowns.find(r => r.id === item.rundownId);
  if (guardClosed(rd, user, res)) return;
  const l = lockInfo('i:' + item.id, user);
  if (l && !l.mine) return err(res, 423, `Retranca em edição por ${l.name}.`);
  if (body.status === 'aprovado' && item.status !== 'aprovado' && !can(user, 'approveRundown')) return err(res, 403, 'Apenas editores podem aprovar.');
  Object.assign(item, pick(body, ITEM_FIELDS), { updatedAt: now(), updatedBy: user.id, updatedByName: user.name });
  if (item.retranca) item.retranca = String(item.retranca).toUpperCase();
  touchRundown(item.rundownId); save();
  send(res, 200, item);
});
route('DELETE', '/api/items/:id', async (req, res, { user, params }) => {
  const item = db.items.find(i => i.id === params.id && i.orgId === user.orgId);
  if (!item) return err(res, 404, 'Retranca não encontrada.');
  const rd = db.rundowns.find(r => r.id === item.rundownId);
  if (guardClosed(rd, user, res)) return;
  const l = lockInfo('i:' + item.id, user);
  if (l && !l.mine) return err(res, 423, `Retranca em edição por ${l.name}.`);
  item.deleted = true; touchRundown(item.rundownId); log(user.orgId, user, 'espelho', `Removeu ${item.retranca}`); save();
  send(res, 200, { ok: true });
});
// --- modo NO AR: o apresentador dá OK no que já foi ao ar (vale mesmo com o espelho fechado)
route('POST', '/api/rundowns/:id/onair', async (req, res, { user, params, body }) => {
  const rd = db.rundowns.find(r => r.id === params.id && r.orgId === user.orgId);
  if (!rd) return err(res, 404, 'Espelho não encontrado.');
  const items = db.items.filter(i => i.rundownId === rd.id && !i.deleted);
  if (body.action === 'start') {
    if (!rd.noArInicio) rd.noArInicio = now();
    rd.noArFim = null; rd.status = 'no_ar'; log(user.orgId, user, 'no ar', 'Iniciou o jornal');
  } else if (body.action === 'end') {
    rd.noArFim = now(); rd.status = 'encerrado'; log(user.orgId, user, 'no ar', 'Encerrou o jornal');
  } else if (body.action === 'reset') {
    if (!can(user, 'approveRundown')) return err(res, 403, 'Apenas editores podem zerar o controle no ar.');
    rd.noArInicio = null; rd.noArFim = null; if (['no_ar', 'encerrado'].includes(rd.status)) rd.status = 'fechado';
    items.forEach(i => { i.aoArAt = null; i.aoArPor = ''; });
    log(user.orgId, user, 'no ar', 'Zerou o controle no ar');
  } else return err(res, 400, 'Ação inválida.');
  rd.updatedAt = now(); save();
  send(res, 200, rundownOut(rd, user));
});
route('POST', '/api/items/:id/onair', async (req, res, { user, params, body }) => {
  const item = db.items.find(i => i.id === params.id && i.orgId === user.orgId && !i.deleted);
  if (!item) return err(res, 404, 'Retranca não encontrada.');
  const rd = db.rundowns.find(r => r.id === item.rundownId);
  if (body.ok) {
    item.aoArAt = now(); item.aoArPor = user.name;
    if (!rd.noArInicio) { rd.noArInicio = item.aoArAt; rd.status = 'no_ar'; }
  } else { item.aoArAt = null; item.aoArPor = ''; }
  rd.updatedAt = now(); save();
  send(res, 200, rundownOut(rd, user));
});

route('POST', '/api/rundowns/:id/reorder', async (req, res, { user, params, body }) => {
  const rd = db.rundowns.find(r => r.id === params.id && r.orgId === user.orgId);
  if (!rd) return err(res, 404, 'Espelho não encontrado.');
  if (guardClosed(rd, user, res)) return;
  const ids = Array.isArray(body.ids) ? body.ids : [];
  ids.forEach((id, n) => { const it = db.items.find(i => i.id === id && i.rundownId === rd.id); if (it) it.ordem = n; });
  touchRundown(rd.id); save();
  send(res, 200, rundownOut(rd, user));
});

route('GET', '/api/logs', async (req, res, { user }) => {
  send(res, 200, db.logs.filter(l => l.orgId === user.orgId).slice(-200).reverse());
});

// ---------------------------------------------------------------- servidor
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);
  if (!pathname.startsWith('/api/')) return serveStatic(req, res, pathname);
  // proteção CSRF simples: escrita exige JSON e mesma origem
  if (req.method !== 'GET') {
    const origin = req.headers.origin;
    if (origin && new URL(origin).host !== req.headers.host) return err(res, 403, 'Origem não permitida.');
  }
  for (const r of routes) {
    if (r.method !== req.method) continue;
    const m = pathname.match(r.re);
    if (!m) continue;
    const params = {}; r.keys.forEach((k, n) => { params[k] = m[n + 1]; });
    const user = currentUser(req);
    if (r.auth && !user) return err(res, 401, 'Sessão expirada. Faça login novamente.');
    let body = {};
    if (req.method !== 'GET') { try { body = await readBody(req); } catch { return err(res, 400, 'Requisição inválida.'); } }
    try { return await r.handler(req, res, { user, params, body, query: Object.fromEntries(url.searchParams) }); }
    catch (e) { console.error(e); return err(res, 500, 'Erro interno.'); }
  }
  err(res, 404, 'Rota não encontrada.');
});
server.listen(PORT, () => console.log(`Redação rodando em http://localhost:${PORT}`));

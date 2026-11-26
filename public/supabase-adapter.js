/* Redação — adaptador Supabase.
   Traduz as chamadas da API do app (/api/...) para o Supabase (Auth + Postgres com RLS).
   Ativado quando public/config.js tem supabaseUrl e supabaseAnonKey. */
'use strict';

window.createSupabaseAdapter = function (sb) {
  const ROLES = ['admin', 'chefe', 'editor', 'produtor', 'reporter', 'apresentador', 'editor_imagem', 'diretor', 'estagiario'];
  const ROLE_LABEL = { admin: 'Administrador', chefe: 'Chefe de reportagem', editor: 'Editor', produtor: 'Produtor', reporter: 'Repórter', apresentador: 'Apresentador', editor_imagem: 'Editor de imagens', diretor: 'Diretor de Produção e Multimídia', estagiario: 'Estagiário' };
  const CAN = {
    manageUsers: ['admin'], managePrograms: ['admin', 'chefe', 'diretor'],
    editRundown: ROLES, approveRundown: ['admin', 'chefe', 'editor', 'diretor'], deletePauta: ['admin', 'chefe', 'produtor', 'diretor'],
  };
  const PAUTA_FIELDS = ['retranca', 'data', 'editoria', 'status', 'prioridade', 'programaId', 'formato', 'produtorId', 'produtorNome', 'reporterId', 'reporterNome', 'cinegrafista', 'motorista', 'editorTexto',
    'horario', 'local', 'endereco', 'proposta', 'historico', 'encaminhamento', 'perguntas', 'imagens', 'arte', 'observacoes', 'entrevistados', 'roteiro', 'tags', 'materia', 'materiaStatus', 'motivoQueda', 'edicaoStatus', 'edicaoEditor', 'edicaoObs'];
  const ITEM_FIELDS = ['retranca', 'tipo', 'apresentador', 'reporter', 'editor', 'cabeca', 'deixa', 'texto', 'gc', 'tempoVT', 'tempoCabManual', 'status', 'obs', 'pautaId', 'flagged', 'pagina'];
  const PROGRAM_FIELDS = ['name', 'sigla', 'inicio', 'duracao', 'wpm', 'apresentadores', 'ativo'];

  const snake = (k) => k.replace(/([a-z0-9])([A-Z]+)/g, '$1_$2').toLowerCase();
  const CAMEL_FIX = { tempoVt: 'tempoVT' };
  const camel = (k) => { const c = k.replace(/_([a-z])/g, (_, x) => x.toUpperCase()); return CAMEL_FIX[c] || c; };
  const fromDb = (row) => { if (!row) return row; const o = {}; for (const k in row) o[camel(k)] = row[k]; return o; };
  function toDb(obj, fields) {
    const o = {};
    for (const f of fields) {
      if (obj[f] === undefined) continue;
      let v = obj[f];
      if (/Id$/.test(f) && v === '') v = null;
      if (f === 'data' && v === '') continue;
      if (v === null && !/Id$/.test(f)) v = '';
      o[snake(f)] = v;
    }
    return o;
  }

  let me = null;   // perfil atual (camelCase)
  function fail(message, status = 400) { const e = new Error(message); e.status = status; throw e; }
  function check({ data, error }, notFoundMsg) {
    if (error) {
      const msg = error.message || 'Erro no banco de dados.';
      if (/JWT|not authenticated|Não autenticado/i.test(msg)) fail('Sessão expirada. Faça login novamente.', 401);
      if (error.code === '23505') fail('Registro duplicado.', 409);
      fail(msg.replace(/^.*?: /, '') || msg, /em edição/.test(msg) ? 423 : /permiss|Apenas|fechado/i.test(msg) ? 403 : 400);
    }
    if (notFoundMsg && (data == null || (Array.isArray(data) && !data.length))) fail(notFoundMsg, 404);
    return data;
  }
  const translateAuth = (m) => ({
    'Invalid login credentials': 'E-mail ou senha incorretos.',
    'Email not confirmed': 'Confirme seu e-mail (veja a caixa de entrada) antes de entrar.',
    'User already registered': 'Este e-mail já está cadastrado.',
  })[m] || m;

  const DOMINIO = String((window.REDACAO_CONFIG || {}).dominioEmail || '').toLowerCase();
  function exigirDominio(email) {
    if (DOMINIO && !String(email || '').trim().toLowerCase().endsWith('@' + DOMINIO)) fail(`Use seu e-mail corporativo @${DOMINIO}.`);
  }
  async function requireMe() {
    if (me) return me;
    const { data } = await sb.auth.getSession();
    if (!data.session) fail('Sessão expirada. Faça login novamente.', 401);
    let prof = check(await sb.from('profiles').select('*').eq('id', data.session.user.id).maybeSingle());
    if (!prof) {
      // primeiro acesso: entra por convite ou cria a emissora com os dados do cadastro
      const meta = data.session.user.user_metadata || {};
      const boot = await sb.rpc('bootstrap', { p_org_name: meta.org_name || '', p_name: meta.name || meta.full_name || '' });
      if (boot.error) { await sb.auth.signOut(); fail(boot.error.message, 403); }
      prof = check(await sb.from('profiles').select('*').eq('id', data.session.user.id).maybeSingle());
    }
    if (!prof || !prof.active) { await sb.auth.signOut(); fail('Cadastro recebido, mas o acesso ainda não está liberado. Peça a um administrador para ativá-lo em Equipe.', 403); }
    me = fromDb(prof);
    return me;
  }
  async function log(action, detail) {
    try { await sb.from('logs').insert({ org_id: me.orgId, user_id: me.id, user_name: me.name, action, detail }); } catch { /* não crítico */ }
  }
  async function lockMap() {
    const rows = check(await sb.from('locks').select('*').gt('until', new Date().toISOString()));
    const m = {}; rows.forEach(l => { m[l.key] = { userId: l.user_id, name: l.name, mine: l.user_id === me.id }; });
    return m;
  }
  const publicUser = (p) => ({ id: p.id, name: p.name, email: p.email, role: p.role, roleLabel: ROLE_LABEL[p.role], active: p.active, createdAt: p.createdAt });

  // ------------------------------------------------------------ rotas
  const R = [];
  const on = (method, pattern, fn, auth = true) => {
    const keys = []; const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    R.push({ method, re, keys, fn, auth });
  };

  on('POST', '/api/auth/login', async (b) => {
    const { error } = await sb.auth.signInWithPassword({ email: b.email, password: b.password });
    if (error) fail(translateAuth(error.message), 401);
    me = null; await requireMe();
    await log('login', '');
    return { ok: true };
  }, false);
  on('POST', '/api/auth/signup', async (b) => {
    if (!b.email || !b.password) fail('Preencha e-mail e senha.');
    exigirDominio(b.email);
    if (String(b.password).length < 8) fail('A senha deve ter pelo menos 8 caracteres.');
    const { data, error } = await sb.auth.signUp({ email: b.email, password: b.password,
      options: { data: { org_name: b.orgName || '', name: b.name || '' }, emailRedirectTo: location.origin + location.pathname } });
    if (error) fail(translateAuth(error.message));
    if (!data.session) return { ok: true, confirm: true };
    me = null; await requireMe();
    return { ok: true };
  }, false);
  on('POST', '/api/auth/google', async () => {
    const cfg = window.REDACAO_CONFIG;
    const st = await fetch(cfg.supabaseUrl + '/auth/v1/settings', { headers: { apikey: cfg.supabaseAnonKey } }).then(r => r.json()).catch(() => null);
    if (!st || !st.external || !st.external.google) fail('O acesso com Google ainda não foi ativado. Por enquanto, entre com e-mail e senha.');
    const queryParams = { prompt: 'select_account' }; if (DOMINIO) queryParams.hd = DOMINIO;
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname, queryParams } });
    if (error) fail(translateAuth(error.message));
    return { ok: true };
  }, false);
  on('POST', '/api/auth/logout', async () => { await sb.auth.signOut(); me = null; return { ok: true }; }, false);
  on('POST', '/api/auth/forgot', async (b) => {
    const { error } = await sb.auth.resetPasswordForEmail(b.email, { redirectTo: location.origin + location.pathname });
    if (error) fail(translateAuth(error.message));
    return { ok: true };
  }, false);
  on('POST', '/api/auth/recover', async (b) => {
    if (String(b.password || '').length < 8) fail('A nova senha deve ter pelo menos 8 caracteres.');
    const { error } = await sb.auth.updateUser({ password: b.password }); if (error) fail(translateAuth(error.message));
    return { ok: true };
  }, false);

  on('GET', '/api/me', async () => {
    const u = await requireMe();
    const org = fromDb(check(await sb.from('orgs').select('*').eq('id', u.orgId).single()));
    return { user: publicUser(u), org, roles: ROLES.map(r => ({ id: r, label: ROLE_LABEL[r] })),
      perms: Object.fromEntries(Object.keys(CAN).map(k => [k, CAN[k].includes(u.role)])) };
  });
  on('PUT', '/api/org', async (b) => {
    if (me.role !== 'admin') fail('Só o administrador altera os dados da emissora.');
    const row = {};
    if (b.name !== undefined) { if (!String(b.name).trim()) fail('Informe o nome da emissora.'); row.name = String(b.name).trim().slice(0, 80); }
    if (b.logo !== undefined) { if (String(b.logo).length > 900000) fail('Logotipo muito grande (máx. ~650 KB).'); row.logo = b.logo || ''; }
    if (b.printColor !== undefined) row.print_color = b.printColor;
    if (b.printFooter !== undefined) row.print_footer = String(b.printFooter || '').slice(0, 200);
    const org = fromDb(check(await sb.from('orgs').update(row).eq('id', me.orgId).select().single()));
    await log('emissora', 'Atualizou os dados da emissora');
    return org;
  });
  on('PUT', '/api/org/equipe', async (b) => {
    check(await sb.rpc('set_funcionarios', { p_lista: b.funcionarios || [] }));
    return fromDb(check(await sb.from('orgs').select('*').eq('id', me.orgId).single()));
  });
  on('PUT', '/api/me/password', async (b) => {
    const { error: e1 } = await sb.auth.signInWithPassword({ email: me.email, password: b.current || '' });
    if (e1) fail('Senha atual incorreta.');
    if (String(b.password || '').length < 8) fail('A nova senha deve ter pelo menos 8 caracteres.');
    const { error } = await sb.auth.updateUser({ password: b.password }); if (error) fail(translateAuth(error.message));
    return { ok: true };
  });

  // equipe
  on('GET', '/api/users', async () => check(await sb.from('profiles').select('*').eq('org_id', me.orgId).order('name')).map(r => publicUser(fromDb(r))));
  on('POST', '/api/users', async (b) => {   // convite
    if (!b.email || !ROLES.includes(b.role)) fail('Informe e-mail e função.');
    exigirDominio(b.email);
    check(await sb.from('invites').insert({ org_id: me.orgId, email: String(b.email).toLowerCase().trim(), name: b.name || '', role: b.role, created_by: me.id }));
    await log('usuario', `Convidou ${b.email}`);
    return { ok: true };
  });
  on('PUT', '/api/users/:id', async (b, p) => {
    const patch = {};
    if (b.name) patch.name = b.name;
    if (b.role && ROLES.includes(b.role)) patch.role = b.role;
    if (typeof b.active === 'boolean') patch.active = b.active;
    return publicUser(fromDb(check(await sb.from('profiles').update(patch).eq('id', p.id).select().single())));
  });
  on('GET', '/api/invites', async () => check(await sb.from('invites').select('*').order('created_at', { ascending: false })).map(fromDb));
  on('DELETE', '/api/invites/:id', async (b, p) => { check(await sb.from('invites').delete().eq('id', p.id)); return { ok: true }; });

  // telejornais
  on('GET', '/api/programs', async () => check(await sb.from('programs').select('*').eq('org_id', me.orgId).order('inicio')).map(fromDb));
  on('POST', '/api/programs', async (b) => {
    if (!b.name) fail('Informe o nome do programa.');
    const row = toDb(Object.assign({ wpm: 170, apresentadores: '' }, b, { name: String(b.name).toUpperCase() }), PROGRAM_FIELDS);
    row.wpm = Number(row.wpm) || 170; row.org_id = me.orgId;
    return fromDb(check(await sb.from('programs').insert(row).select().single()));
  });
  on('PUT', '/api/programs/:id', async (b, p) => {
    const row = toDb(b, PROGRAM_FIELDS); if (row.wpm !== undefined) row.wpm = Number(row.wpm) || 170;
    return fromDb(check(await sb.from('programs').update(row).eq('id', p.id).select().single(), 'Programa não encontrado.'));
  });
  on('DELETE', '/api/programs/:id', async (b, p) => {
    // espelhos e itens saem em cascata; pautas ficam com programa_id nulo
    const gone = check(await sb.from('programs').delete().eq('id', p.id).select('id'));
    if (!gone.length) fail('Sem permissão ou telejornal não encontrado.');
    return { ok: true };
  });

  // pautas
  on('GET', '/api/pautas', async (b, p, q) => {
    let qb = sb.from('pautas').select('*').eq('org_id', me.orgId).eq('deleted', false);
    if (q.from) qb = qb.gte('data', q.from);
    if (q.to) qb = qb.lte('data', q.to);
    if (q.status) qb = qb.eq('status', q.status);
    if (q.editoria) qb = qb.eq('editoria', q.editoria);
    if (q.programaId) qb = qb.eq('programa_id', q.programaId);
    if (q.mine) qb = qb.or(`reporter_id.eq.${me.id},produtor_id.eq.${me.id}`);
    if (q.reporterId) qb = qb.eq('reporter_id', q.reporterId);
    if (q.comMateria) qb = qb.neq('materia', '');
    if (q.q) {
      // cada palavra precisa aparecer em algum lugar da pauta ou da matéria
      String(q.q).replace(/[%,()*\\]/g, ' ').split(/\s+/).filter(Boolean).forEach(w => { qb = qb.ilike('busca', `%${w}%`); });
    }
    qb = qb.order('data', { ascending: false }).order('horario').order('retranca').limit(1000);
    const rows = check(await qb).map(fromDb);
    const locks = await lockMap();
    return rows.map(r => Object.assign(r, { lock: locks['p:' + r.id] || null }));
  });
  on('GET', '/api/pautas/:id', async (b, p) => {
    const row = fromDb(check(await sb.from('pautas').select('*').eq('id', p.id).eq('deleted', false).maybeSingle(), 'Pauta não encontrada.'));
    const usos = check(await sb.from('items').select('rundown_id, rundowns(data, programs(name))').eq('pauta_id', p.id).eq('deleted', false))
      .map(u => ({ rundownId: u.rundown_id, data: u.rundowns && u.rundowns.data, programa: u.rundowns && u.rundowns.programs && u.rundowns.programs.name }));
    const locks = await lockMap();
    return Object.assign(row, { usos, lock: locks['p:' + row.id] || null });
  });
  on('POST', '/api/pautas', async (b) => {
    if (!b.retranca) fail('Informe a retranca.');
    const row = toDb(b, PAUTA_FIELDS); row.org_id = me.orgId;
    const saved = fromDb(check(await sb.from('pautas').insert(row).select().single()));
    await log('pauta', `Criou ${saved.retranca}`);
    return saved;
  });
  on('PUT', '/api/pautas/:id', async (b, p) => {
    let qb = sb.from('pautas').update(toDb(b, PAUTA_FIELDS)).eq('id', p.id);
    if (b.updatedAt && !b.force) qb = qb.eq('updated_at', b.updatedAt);
    const rows = check(await qb.select());
    if (!rows.length) {
      const exists = check(await sb.from('pautas').select('id').eq('id', p.id).maybeSingle());
      if (!exists) fail('Pauta não encontrada.', 404);
      fail('A pauta foi alterada por outra pessoa. Recarregue antes de salvar.', 409);
    }
    const saved = fromDb(rows[0]);
    await log('pauta', `Editou ${saved.retranca}`);
    return saved;
  });
  on('DELETE', '/api/pautas/:id', async (b, p) => {
    const row = check(await sb.from('pautas').update({ deleted: true }).eq('id', p.id).select().single(), 'Pauta não encontrada.');
    await log('pauta', `Excluiu ${row.retranca}`);
    return { ok: true };
  });

  // travas
  on('POST', '/api/locks/:key', async (b, p) => check(await sb.rpc('acquire_lock', { p_key: decodeURIComponent(p.key) })));
  on('DELETE', '/api/locks/:key', async (b, p) => { await sb.rpc('release_lock', { p_key: decodeURIComponent(p.key) }); return { ok: true }; });

  // espelhos
  async function rundownOut(rd) {
    const [items, program, locks] = await Promise.all([
      sb.from('items').select('*').eq('rundown_id', rd.id).eq('deleted', false).order('ordem'),
      sb.from('programs').select('*').eq('id', rd.program_id || rd.programId).single(),
      lockMap(),
    ]);
    const out = fromDb(rd);
    out.program = fromDb(check(program));
    out.items = check(items).map(fromDb).map(i => Object.assign(i, { lock: locks['i:' + i.id] || null }));
    return out;
  }
  const BASE = [['ESCALADA', 'ESCALADA', ''], ['ABERTURA', 'VINHETA', '00:10'], ['INTERVALO 1', 'INTERVALO', '02:30'], ['INTERVALO 2', 'INTERVALO', '02:30'], ['ENCERRAMENTO', 'ENCERRAMENTO', '']];
  on('GET', '/api/rundowns', async (b, p, q) => {
    if (!q.programId || !q.data) fail('Informe programa e data.');
    const find = async () => check(await sb.from('rundowns').select('*').eq('program_id', q.programId).eq('data', q.data).maybeSingle());
    let rd = await find();
    if (!rd) {
      if (q.create !== '1') return null;
      const ins = await sb.from('rundowns').insert({ org_id: me.orgId, program_id: q.programId, data: q.data }).select().single();
      if (ins.error && ins.error.code === '23505') rd = await find();
      else {
        rd = check(ins);
        check(await sb.from('items').insert(BASE.map(([retranca, tipo, tempo], n) => ({ org_id: me.orgId, rundown_id: rd.id, ordem: n, retranca, tipo, tempo_vt: tempo }))));
        const prog = check(await sb.from('programs').select('name').eq('id', q.programId).single());
        await log('espelho', `Criou espelho ${prog.name} ${q.data}`);
        rd = await find();
      }
    }
    return rundownOut(rd);
  });
  on('GET', '/api/rundowns/:id', async (b, p) => rundownOut(check(await sb.from('rundowns').select('*').eq('id', p.id).maybeSingle(), 'Espelho não encontrado.')));
  on('PUT', '/api/rundowns/:id', async (b, p) => {
    const patch = {}; if (b.status) patch.status = b.status; if (b.notas !== undefined) patch.notas = b.notas;
    const rd = check(await sb.from('rundowns').update(patch).eq('id', p.id).select().single(), 'Espelho não encontrado.');
    if (b.status) await log('espelho', `Status → ${b.status}`);
    return rundownOut(rd);
  });
  on('POST', '/api/rundowns/:id/items', async (b, p) => {
    const ids = check(await sb.from('items').select('id, tipo').eq('rundown_id', p.id).eq('deleted', false).order('ordem'));
    let data = Object.assign({}, b);
    if (b.pautaId) {
      const pa = check(await sb.from('pautas').select('retranca, formato, reporter_id, reporter_nome, materia').eq('id', b.pautaId).maybeSingle());
      if (pa) {
        let rep = String(pa.reporter_nome || '').toUpperCase();
        if (pa.reporter_id) { const r = check(await sb.from('profiles').select('name').eq('id', pa.reporter_id).maybeSingle()); rep = r ? r.name.toUpperCase() : ''; }
        data = Object.assign({ retranca: pa.retranca, tipo: pa.formato || 'VT', reporter: rep, texto: pa.materia || '' }, b);
      }
    }
    const row = toDb(Object.assign({ retranca: 'NOVA RETRANCA', tipo: 'NOTA' }, data), ITEM_FIELDS);
    row.org_id = me.orgId; row.rundown_id = p.id; row.ordem = 100000;
    const item = fromDb(check(await sb.from('items').insert(row).select().single()));
    let idx = ids.length;
    if (b.afterId) { const k = ids.findIndex(i => i.id === b.afterId); if (k >= 0) idx = k + 1; }
    else { const k = ids.findIndex(i => i.tipo === 'ENCERRAMENTO'); if (k >= 0) idx = k; }
    const order = ids.map(i => i.id); order.splice(idx, 0, item.id);
    check(await sb.rpc('reorder_items', { p_rundown: p.id, p_ids: order }));
    await log('espelho', `Incluiu ${item.retranca}`);
    return item;
  });
  // modo NO AR
  on('POST', '/api/rundowns/:id/onair', async (b, p) => {
    check(await sb.rpc('on_air_rundown', { p_rundown: p.id, p_action: b.action }));
    return rundownOut(check(await sb.from('rundowns').select('*').eq('id', p.id).single()));
  });
  on('POST', '/api/items/:id/onair', async (b, p) => {
    const rid = check(await sb.rpc('on_air_item', { p_item: p.id, p_ok: !!b.ok }));
    return rundownOut(check(await sb.from('rundowns').select('*').eq('id', rid).single()));
  });
  on('POST', '/api/rundowns/:id/reorder', async (b, p) => {
    check(await sb.rpc('reorder_items', { p_rundown: p.id, p_ids: b.ids || [] }));
    return rundownOut(check(await sb.from('rundowns').select('*').eq('id', p.id).single()));
  });
  on('PUT', '/api/items/:id', async (b, p) => fromDb(check(await sb.from('items').update(toDb(b, ITEM_FIELDS)).eq('id', p.id).select().single(), 'Retranca não encontrada.')));
  on('DELETE', '/api/items/:id', async (b, p) => {
    const it = check(await sb.from('items').update({ deleted: true }).eq('id', p.id).select().single(), 'Retranca não encontrada.');
    await log('espelho', `Removeu ${it.retranca}`);
    return { ok: true };
  });

  // relatório: retrancas ligadas a pautas nos espelhos do período
  on('GET', '/api/relatorio/itens', async (b, p, q) => {
    let qb = sb.from('items').select('pauta_id, tipo, status, tempo_vt, tempo_cab_manual, cabeca, texto, ao_ar_at, rundowns!inner(data, programs(name, wpm))')
      .not('pauta_id', 'is', null).eq('deleted', false);
    if (q.from) qb = qb.gte('rundowns.data', q.from);
    if (q.to) qb = qb.lte('rundowns.data', q.to);
    return check(await qb).map(i => ({ pautaId: i.pauta_id, data: i.rundowns.data, programa: (i.rundowns.programs || {}).name || '', wpm: (i.rundowns.programs || {}).wpm || 170,
      tipo: i.tipo, status: i.status, tempoVT: i.tempo_vt, tempoCabManual: i.tempo_cab_manual, cabeca: i.cabeca, texto: i.texto, aoArAt: i.ao_ar_at }));
  });
  on('GET', '/api/logs', async () => check(await sb.from('logs').select('*').order('at', { ascending: false }).limit(200)).map(fromDb));

  // ------------------------------------------------------------ despacho
  async function request(method, url, body) {
    const u = new URL(url, location.origin);
    for (const r of R) {
      if (r.method !== method) continue;
      const m = u.pathname.match(r.re); if (!m) continue;
      const params = {}; r.keys.forEach((k, i) => { params[k] = m[i + 1]; });
      if (r.auth) await requireMe();
      return r.fn(body || {}, params, Object.fromEntries(u.searchParams));
    }
    fail('Rota não encontrada.', 404);
  }
  return { request, client: sb };
};

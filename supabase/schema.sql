-- =====================================================================
-- REDAÇÃO — banco de dados Supabase (Postgres)
-- Pautas, espelho (rundown), laudas, equipe e multi-emissora (SaaS).
-- Rode este arquivo inteiro no Supabase: Dashboard → SQL Editor → New query → Run.
-- Pode ser executado de novo com segurança (idempotente).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tabelas
create table if not exists public.orgs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  plan        text not null default 'trial',
  created_at  timestamptz not null default now()
);
-- identidade visual usada na impressão / PDF de pautas e matérias
alter table public.orgs add column if not exists logo         text not null default '';
alter table public.orgs add column if not exists print_color  text not null default '#0b3566'
  check (print_color ~ '^#[0-9a-fA-F]{6}$');
alter table public.orgs add column if not exists print_footer text not null default '';
-- nomes sugeridos na pauta (Equipe técnica)
alter table public.orgs add column if not exists cinegrafistas text[] not null default '{}';
alter table public.orgs add column if not exists motoristas    text[] not null default '{}';
-- cadastro de funcionários: [{nome, funcao}]
alter table public.orgs add column if not exists funcionarios  jsonb  not null default '[]'::jsonb;

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  org_id      uuid not null references public.orgs(id) on delete cascade,
  name        text not null,
  email       text not null,
  role        text not null default 'reporter'
              check (role in ('admin','chefe','editor','produtor','reporter','apresentador','editor_imagem','diretor')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists profiles_org_idx on public.profiles(org_id);

-- Convites: o administrador cadastra e-mail + função; quando a pessoa cria a conta
-- com esse e-mail, entra automaticamente na redação.
create table if not exists public.invites (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.orgs(id) on delete cascade,
  email       text not null unique,
  name        text,
  role        text not null default 'reporter'
              check (role in ('admin','chefe','editor','produtor','reporter','apresentador','editor_imagem','diretor')),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Telejornais
create table if not exists public.programs (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.orgs(id) on delete cascade,
  name            text not null,
  sigla           text not null default '',
  inicio          text not null default '12:00:00',   -- hh:mm:ss
  duracao         text not null default '00:30:00',   -- hh:mm:ss (inclui intervalos)
  wpm             int  not null default 170,          -- palavras por minuto (leitura)
  apresentadores  text not null default '',
  ativo           boolean not null default true,
  created_at      timestamptz not null default now()
);
create index if not exists programs_org_idx on public.programs(org_id);

-- Pautas: Retranca, Proposta, Marcação (entrevistados/local), Informações
create table if not exists public.pautas (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.orgs(id) on delete cascade,
  retranca        text not null,
  data            date not null default current_date,
  editoria        text not null default '',
  status          text not null default 'sugestao'
                  check (status in ('sugestao','em_apuracao','em_producao','pronta','gravada','exibida','caiu')),
  prioridade      text not null default 'normal' check (prioridade in ('baixa','normal','alta','urgente')),
  programa_id     uuid references public.programs(id) on delete set null,
  formato         text not null default 'VT',
  produtor_id     uuid references public.profiles(id) on delete set null,
  reporter_id     uuid references public.profiles(id) on delete set null,
  cinegrafista    text not null default '',
  editor_texto    text not null default '',
  horario         text not null default '',
  local           text not null default '',
  endereco        text not null default '',
  proposta        text not null default '',
  historico       text not null default '',   -- INFORMAÇÕES
  encaminhamento  text not null default '',
  perguntas       text not null default '',
  imagens         text not null default '',
  arte            text not null default '',
  observacoes     text not null default '',
  tags            text not null default '',
  entrevistados   jsonb not null default '[]'::jsonb,  -- MARCAÇÃO: [{nome,funcao,telefone,data,horario,local,obs,confirmado}]
  roteiro         jsonb not null default '[]'::jsonb,  -- [{hora,local,acao}]
  deleted         boolean not null default false,
  created_by      uuid references public.profiles(id) on delete set null,
  updated_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists pautas_org_data_idx on public.pautas(org_id, data);

-- MATÉRIA: texto escrito pelo repórter, guardado junto com a pauta
alter table public.pautas add column if not exists materia          text not null default '';
alter table public.pautas add column if not exists materia_status   text not null default ''
  check (materia_status in ('','rascunho','enviada','revisada','aprovada'));
alter table public.pautas add column if not exists materia_autor_id uuid references public.profiles(id) on delete set null;
alter table public.pautas add column if not exists materia_at       timestamptz;
-- EQUIPE da pauta: repórter digitado (quando não é usuário do sistema) e motorista
alter table public.pautas add column if not exists reporter_nome    text not null default '';
alter table public.pautas add column if not exists produtor_nome    text not null default '';
alter table public.pautas add column if not exists motorista        text not null default '';
-- EDIÇÃO DE IMAGENS: andamento da edição do VT
alter table public.pautas add column if not exists edicao_status    text not null default '';
alter table public.pautas add column if not exists edicao_editor    text not null default '';
alter table public.pautas add column if not exists edicao_obs       text not null default '';
-- função "Editor de imagens"
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin','chefe','editor','produtor','reporter','apresentador','editor_imagem','diretor'));
alter table public.invites drop constraint if exists invites_role_check;
alter table public.invites add constraint invites_role_check
  check (role in ('admin','chefe','editor','produtor','reporter','apresentador','editor_imagem','diretor'));
-- QUEDA: justificativa obrigatória quando a pauta cai
alter table public.pautas add column if not exists motivo_queda     text not null default '';
-- HISTÓRICO DE STATUS (relatório de tempo de produção): [{status, at, by}]
alter table public.pautas add column if not exists status_hist      jsonb not null default '[]'::jsonb;

-- Texto de busca (pauta + matéria + entrevistados) com índice para pesquisa rápida
create extension if not exists pg_trgm with schema extensions;
alter table public.pautas add column if not exists busca text generated always as (
  retranca || ' ' || proposta || ' ' || historico || ' ' || encaminhamento || ' ' || materia || ' ' ||
  local || ' ' || endereco || ' ' || tags || ' ' || editoria || ' ' || perguntas || ' ' || observacoes || ' ' || entrevistados::text
) stored;
create index if not exists pautas_busca_trgm on public.pautas using gin (busca gin_trgm_ops);

-- Espelhos (um por telejornal por dia)
create table if not exists public.rundowns (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.orgs(id) on delete cascade,
  program_id  uuid not null references public.programs(id) on delete cascade,
  data        date not null,
  status      text not null default 'aberto' check (status in ('aberto','fechado','no_ar','encerrado')),
  notas       text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (program_id, data)
);
create index if not exists rundowns_org_idx on public.rundowns(org_id);

-- Retrancas do espelho (laudas)
create table if not exists public.items (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.orgs(id) on delete cascade,
  rundown_id        uuid not null references public.rundowns(id) on delete cascade,
  ordem             int  not null default 0,
  retranca          text not null default 'NOVA RETRANCA',
  tipo              text not null default 'NOTA',
  apresentador      text not null default '',
  reporter          text not null default '',
  editor            text not null default '',
  cabeca            text not null default '',
  deixa             text not null default '',
  texto             text not null default '',
  gc                text not null default '',
  tempo_vt          text not null default '',
  tempo_cab_manual  text not null default '',
  status            text not null default 'rascunho' check (status in ('rascunho','em_edicao','pronto','aprovado','caiu')),
  obs               text not null default '',
  pauta_id          uuid references public.pautas(id) on delete set null,
  flagged           boolean not null default false,
  pagina            text not null default '',
  deleted           boolean not null default false,
  updated_by        uuid references public.profiles(id) on delete set null,
  updated_by_name   text not null default '',
  updated_at        timestamptz not null default now()
);
create index if not exists items_rundown_idx on public.items(rundown_id, ordem);
-- modo NO AR: OK do apresentador em cada retranca exibida
alter table public.items     add column if not exists ao_ar_at     timestamptz;
alter table public.items     add column if not exists ao_ar_por    text not null default '';
alter table public.rundowns  add column if not exists no_ar_inicio timestamptz;
alter table public.rundowns  add column if not exists no_ar_fim    timestamptz;
create index if not exists items_pauta_idx on public.items(pauta_id);

-- Travas de edição ("fulano está editando")
create table if not exists public.locks (
  org_id   uuid not null references public.orgs(id) on delete cascade,
  key      text not null,          -- 'p:<pauta_id>' ou 'i:<item_id>'
  user_id  uuid not null references public.profiles(id) on delete cascade,
  name     text not null,
  until    timestamptz not null,
  primary key (org_id, key)
);

-- Registro de atividade
create table if not exists public.logs (
  id         bigint generated always as identity primary key,
  org_id     uuid not null references public.orgs(id) on delete cascade,
  user_id    uuid references public.profiles(id) on delete set null,
  user_name  text not null default '',
  action     text not null,
  detail     text not null default '',
  at         timestamptz not null default now()
);
create index if not exists logs_org_idx on public.logs(org_id, at desc);

-- ---------------------------------------------------------------- funções auxiliares
create or replace function public.my_org() returns uuid
language sql stable security definer set search_path = public as $$
  select org_id from public.profiles where id = auth.uid() and active
$$;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.is_editor() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('admin','chefe','editor','diretor'), false)
$$;

-- ---------------------------------------------------------------- cadastro / convite
-- Quem pode criar conta. Os e-mails dos administradores são cadastrados direto no
-- banco (SQL Editor) e NÃO ficam neste arquivo:
--   update public.acesso_config set administradores = array['nome@dominio'];
-- Ninguém lê nem altera esta tabela pelo aplicativo (RLS sem políticas).
create table if not exists public.acesso_config (
  id               boolean primary key default true check (id),
  dominio          text not null default 'tvtecjundiai.com.br',   -- '' = qualquer domínio
  administradores  text[] not null default '{}'                    -- sempre em minúsculas
);
insert into public.acesso_config (id) values (true) on conflict (id) do nothing;
alter table public.acesso_config enable row level security;
revoke all on public.acesso_config from anon, authenticated;

-- Gancho "Before User Created" (Authentication → Hooks): barra cadastro fora do domínio,
-- tanto por e-mail e senha quanto pelo Google.
create or replace function public.hook_restrict_signup(event jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_dom text; v_email text := lower(coalesce(event->'user'->>'email', ''));
begin
  select dominio into v_dom from public.acesso_config;
  if coalesce(v_dom, '') <> '' and split_part(v_email, '@', 2) <> v_dom then
    return jsonb_build_object('error', jsonb_build_object('http_code', 403,
      'message', 'Cadastro permitido somente com e-mail corporativo @' || v_dom || '.'));
  end if;
  return '{}'::jsonb;
end $$;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_restrict_signup(jsonb) to supabase_auth_admin;
revoke all on function public.hook_restrict_signup(jsonb) from public, anon, authenticated;

-- Chamada no primeiro acesso. Administradores e convidados entram direto; os demais
-- e-mails do domínio entram inativos, aguardando um administrador liberar em Equipe.
create or replace function public.bootstrap(p_org_name text, p_name text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_email  text;
  v_conf   timestamptz;
  v_cfg    public.acesso_config;
  v_inv    public.invites;
  v_org    uuid;
  v_name   text;
  v_admin  boolean;
  v_novo   boolean := false;
begin
  if v_uid is null then raise exception 'Não autenticado.'; end if;
  if exists (select 1 from public.profiles where id = v_uid) then return; end if;
  select lower(email), email_confirmed_at into v_email, v_conf from auth.users where id = v_uid;
  if v_conf is null then raise exception 'Confirme seu e-mail antes de entrar.'; end if;

  select * into v_cfg from public.acesso_config;
  if coalesce(v_cfg.dominio, '') <> '' and split_part(v_email, '@', 2) <> v_cfg.dominio then
    raise exception 'Acesso permitido somente com e-mail corporativo @%.', v_cfg.dominio;
  end if;
  v_admin := v_email = any (coalesce(v_cfg.administradores, '{}'));
  v_name := coalesce(nullif(trim(p_name), ''), v_email);

  select * into v_inv from public.invites where lower(email) = v_email;
  if found then
    insert into public.profiles(id, org_id, name, email, role)
      values (v_uid, v_inv.org_id, coalesce(nullif(trim(p_name), ''), v_inv.name, v_email), v_email,
              case when v_admin then 'admin' else v_inv.role end);
    delete from public.invites where id = v_inv.id;
    insert into public.logs(org_id, user_id, user_name, action, detail)
      values (v_inv.org_id, v_uid, v_name, 'equipe', 'Entrou na redação por convite');
    return;
  end if;

  -- uma única redação: a primeira conta cria, as próximas entram nela
  select id into v_org from public.orgs order by created_at limit 1;
  if v_org is null then
    v_novo := true;
    insert into public.orgs(name) values (coalesce(nullif(trim(p_org_name), ''), 'TV TEC Jundiaí')) returning id into v_org;
    insert into public.programs(org_id, name, sigla, inicio, duracao) values
      (v_org, 'JORNAL DA MANHÃ',    'JM',  '06:00:00', '01:00:00'),
      (v_org, 'JORNAL DO MEIO-DIA', 'JMD', '12:00:00', '00:45:00'),
      (v_org, 'JORNAL DA NOITE',    'JN',  '19:15:00', '00:35:00');
  end if;
  -- sem lista de administradores configurada, quem cria a redação administra
  if v_novo and cardinality(coalesce(v_cfg.administradores, '{}')) = 0 then v_admin := true; end if;

  insert into public.profiles(id, org_id, name, email, role, active)
    values (v_uid, v_org, v_name, v_email, case when v_admin then 'admin' else 'reporter' end, v_admin);
  insert into public.logs(org_id, user_id, user_name, action, detail)
    values (v_org, v_uid, v_name, 'equipe', case when v_admin then 'Administrador entrou' else 'Pediu acesso (aguarda liberação)' end);
end $$;
-- ---------------------------------------------------------------- travas
create or replace function public.acquire_lock(p_key text)
returns json language plpgsql security definer set search_path = public as $$
declare v_org uuid := public.my_org(); l public.locks; v_name text;
begin
  if v_org is null then raise exception 'Sem acesso.'; end if;
  select * into l from public.locks where org_id = v_org and key = p_key;
  if found and l.until > now() and l.user_id <> auth.uid() then
    return json_build_object('ok', false, 'lock', json_build_object('userId', l.user_id, 'name', l.name, 'mine', false));
  end if;
  select name into v_name from public.profiles where id = auth.uid();
  insert into public.locks(org_id, key, user_id, name, until)
    values (v_org, p_key, auth.uid(), v_name, now() + interval '60 seconds')
  on conflict (org_id, key) do update set user_id = excluded.user_id, name = excluded.name, until = excluded.until;
  return json_build_object('ok', true);
end $$;

create or replace function public.release_lock(p_key text)
returns void language sql security definer set search_path = public as $$
  delete from public.locks where org_id = public.my_org() and key = p_key and user_id = auth.uid();
$$;

-- Reordenação do espelho em uma única chamada (respeita RLS e gatilhos)
create or replace function public.reorder_items(p_rundown uuid, p_ids uuid[])
returns void language sql security invoker set search_path = public as $$
  update public.items i set ordem = x.ord - 1
  from unnest(p_ids) with ordinality as x(id, ord)
  where i.id = x.id and i.rundown_id = p_rundown and i.ordem is distinct from (x.ord - 1);
$$;

-- Equipe técnica (cinegrafistas e motoristas): administrador e chefe de reportagem
create or replace function public.set_equipe_tecnica(p_cinegrafistas text[], p_motoristas text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.my_role(), '') not in ('admin','chefe') then raise exception 'Sem permissão.'; end if;
  update public.orgs set
    cinegrafistas = coalesce((select array_agg(distinct left(trim(x), 80)) from unnest(p_cinegrafistas) x where trim(x) <> ''), '{}'),
    motoristas    = coalesce((select array_agg(distinct left(trim(x), 80)) from unnest(p_motoristas) x where trim(x) <> ''), '{}')
  where id = public.my_org();
end $$;

-- Cadastro de funcionários (nomes sugeridos na pauta): administrador, diretor e chefe
create or replace function public.set_funcionarios(p_lista jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.my_role(), '') not in ('admin','chefe','diretor') then raise exception 'Sem permissão.'; end if;
  update public.orgs set funcionarios = coalesce((
    select jsonb_agg(jsonb_build_object('nome', left(trim(x->>'nome'), 80), 'funcao', left(trim(x->>'funcao'), 80)))
    from jsonb_array_elements(p_lista) x
    where trim(coalesce(x->>'nome', '')) <> '' and trim(coalesce(x->>'funcao', '')) <> ''), '[]'::jsonb),
    cinegrafistas = '{}', motoristas = '{}'
  where id = public.my_org();
end $$;
revoke all on function public.set_funcionarios(jsonb) from public, anon;
grant execute on function public.set_funcionarios(jsonb) to authenticated;

-- Modo NO AR: qualquer membro da redação dá OK no que foi exibido (mesmo com espelho fechado)
create or replace function public.on_air_item(p_item uuid, p_ok boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid := public.my_org(); v_it public.items; v_name text;
begin
  if v_org is null then raise exception 'Sem acesso.'; end if;
  select * into v_it from public.items where id = p_item and org_id = v_org and not deleted;
  if not found then raise exception 'Retranca não encontrada.'; end if;
  select name into v_name from public.profiles where id = auth.uid();
  perform set_config('redacao.on_air', '1', true);
  update public.items set ao_ar_at = case when p_ok then now() end, ao_ar_por = case when p_ok then coalesce(v_name, '') else '' end
    where id = p_item;
  if p_ok then
    update public.rundowns set no_ar_inicio = now(), status = 'no_ar'
      where id = v_it.rundown_id and no_ar_inicio is null;
  end if;
  update public.rundowns set updated_at = now() where id = v_it.rundown_id;
  perform set_config('redacao.on_air', '', true);
  return v_it.rundown_id;
end $$;

create or replace function public.on_air_rundown(p_rundown uuid, p_action text)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid := public.my_org(); v_name text;
begin
  if v_org is null then raise exception 'Sem acesso.'; end if;
  if not exists (select 1 from public.rundowns where id = p_rundown and org_id = v_org) then raise exception 'Espelho não encontrado.'; end if;
  if p_action = 'reset' and not public.is_editor() then raise exception 'Apenas editores podem zerar o controle no ar.'; end if;
  select name into v_name from public.profiles where id = auth.uid();
  perform set_config('redacao.on_air', '1', true);
  if p_action = 'start' then
    update public.rundowns set no_ar_inicio = coalesce(no_ar_inicio, now()), no_ar_fim = null, status = 'no_ar' where id = p_rundown;
  elsif p_action = 'end' then
    update public.rundowns set no_ar_fim = now(), status = 'encerrado' where id = p_rundown;
  elsif p_action = 'reset' then
    update public.items set ao_ar_at = null, ao_ar_por = '' where rundown_id = p_rundown;
    update public.rundowns set no_ar_inicio = null, no_ar_fim = null,
      status = case when status in ('no_ar','encerrado') then 'fechado' else status end where id = p_rundown;
  else
    raise exception 'Ação inválida.';
  end if;
  perform set_config('redacao.on_air', '', true);
  insert into public.logs(org_id, user_id, user_name, action, detail)
    values (v_org, auth.uid(), coalesce(v_name, ''), 'no ar',
      case p_action when 'start' then 'Iniciou o jornal' when 'end' then 'Encerrou o jornal' else 'Zerou o controle no ar' end);
end $$;

-- ---------------------------------------------------------------- gatilhos
create or replace function public.tg_pautas() returns trigger
language plpgsql security definer set search_path = public as $$
declare l public.locks; v_name text;
begin
  new.retranca := upper(trim(new.retranca));
  if new.status = 'caiu' and coalesce(trim(new.motivo_queda), '') = '' then
    raise exception 'Informe o motivo da queda da pauta.';
  end if;
  select name into v_name from public.profiles where id = auth.uid();
  if tg_op = 'INSERT' then
    new.org_id := public.my_org();
    new.created_by := auth.uid();
    new.created_at := now();
    new.status_hist := jsonb_build_array(jsonb_build_object('status', new.status, 'at', now(), 'by', coalesce(v_name, '')));
    if coalesce(trim(new.materia), '') <> '' then new.materia_autor_id := auth.uid(); new.materia_at := now(); end if;
  else
    if new.materia is distinct from old.materia then
      new.materia_autor_id := auth.uid(); new.materia_at := now();
    else
      new.materia_autor_id := old.materia_autor_id; new.materia_at := old.materia_at;
    end if;
    new.org_id := old.org_id; new.created_by := old.created_by; new.created_at := old.created_at;
    new.status_hist := old.status_hist;
    if new.status is distinct from old.status then
      new.status_hist := coalesce(old.status_hist, '[]'::jsonb) || jsonb_build_object('status', new.status, 'at', now(), 'by', coalesce(v_name, ''));
    end if;
    select * into l from public.locks
      where org_id = old.org_id and key = 'p:' || old.id and until > now() and user_id <> auth.uid();
    if found then raise exception 'Pauta em edição por %.', l.name; end if;
    if new.deleted and not old.deleted and coalesce(public.my_role(), '') not in ('admin','chefe','diretor','produtor') then
      raise exception 'Sem permissão para excluir pautas.';
    end if;
  end if;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists pautas_biu on public.pautas;
create trigger pautas_biu before insert or update on public.pautas
  for each row execute function public.tg_pautas();

create or replace function public.tg_rundowns() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.org_id := public.my_org();
  else
    new.org_id := old.org_id; new.program_id := old.program_id; new.data := old.data;
    if new.status is distinct from old.status and not public.is_editor()
       and coalesce(current_setting('redacao.on_air', true), '') <> '1' then
      raise exception 'Apenas editores podem fechar/liberar o espelho.';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists rundowns_biu on public.rundowns;
create trigger rundowns_biu before insert or update on public.rundowns
  for each row execute function public.tg_rundowns();

create or replace function public.tg_items() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_rd public.rundowns; l public.locks; v_name text;
begin
  if tg_op = 'INSERT' then
    new.org_id := public.my_org();
  else
    new.org_id := old.org_id; new.rundown_id := old.rundown_id;
    -- OK de "foi ao ar" (via on_air_item): só mudam ao_ar_at/ao_ar_por, sem travas
    if coalesce(current_setting('redacao.on_air', true), '') = '1' then return new; end if;
  end if;
  select * into v_rd from public.rundowns where id = new.rundown_id and org_id = new.org_id;
  if not found then raise exception 'Espelho não encontrado.'; end if;
  if v_rd.status = 'fechado' and not public.is_editor() then
    raise exception 'Espelho fechado pelo editor-chefe.';
  end if;
  if tg_op = 'UPDATE' and new.ordem is not distinct from old.ordem then
    -- edição de conteúdo (não só reordenação): respeita trava de outra pessoa
    select * into l from public.locks
      where org_id = old.org_id and key = 'i:' || old.id and until > now() and user_id <> auth.uid();
    if found then raise exception 'Retranca em edição por %.', l.name; end if;
  end if;
  if new.status = 'aprovado' and (tg_op = 'INSERT' or old.status <> 'aprovado') and not public.is_editor() then
    raise exception 'Apenas editores podem aprovar.';
  end if;
  new.retranca := upper(trim(new.retranca));
  if tg_op = 'INSERT' or new.ordem is not distinct from old.ordem then
    select name into v_name from public.profiles where id = auth.uid();
    new.updated_by := auth.uid(); new.updated_by_name := coalesce(v_name, ''); new.updated_at := now();
  end if;
  return new;
end $$;
drop trigger if exists items_biu on public.items;
create trigger items_biu before insert or update on public.items
  for each row execute function public.tg_items();

-- toca o espelho para que todos os usuários vejam a alteração
create or replace function public.tg_items_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.rundowns set updated_at = now() where id = new.rundown_id;
  return null;
end $$;
drop trigger if exists items_aiu on public.items;
create trigger items_aiu after insert or update on public.items
  for each row execute function public.tg_items_touch();

create or replace function public.tg_profiles() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.id := old.id; new.org_id := old.org_id; new.email := old.email; new.created_at := old.created_at;
  if old.id = auth.uid() and (new.role <> 'admin' or not new.active) and old.role = 'admin' then
    raise exception 'Você não pode remover seu próprio acesso de administrador.';
  end if;
  return new;
end $$;
drop trigger if exists profiles_bu on public.profiles;
create trigger profiles_bu before update on public.profiles
  for each row execute function public.tg_profiles();

-- ---------------------------------------------------------------- segurança (RLS)
alter table public.orgs     enable row level security;
alter table public.profiles enable row level security;
alter table public.invites  enable row level security;
alter table public.programs enable row level security;
alter table public.pautas   enable row level security;
alter table public.rundowns enable row level security;
alter table public.items    enable row level security;
alter table public.locks    enable row level security;
alter table public.logs     enable row level security;

do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public'
    and tablename in ('orgs','profiles','invites','programs','pautas','rundowns','items','locks','logs')
  loop execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename); end loop;
end $$;

create policy orgs_sel on public.orgs for select using (id = public.my_org());
create policy orgs_upd on public.orgs for update using (id = public.my_org() and public.my_role() = 'admin');

create policy profiles_sel on public.profiles for select using (org_id = public.my_org() or id = auth.uid());
create policy profiles_upd on public.profiles for update
  using (org_id = public.my_org() and public.my_role() = 'admin')
  with check (org_id = public.my_org());

create policy invites_all on public.invites for all
  using (org_id = public.my_org() and public.my_role() = 'admin')
  with check (org_id = public.my_org() and public.my_role() = 'admin');

create policy programs_sel on public.programs for select using (org_id = public.my_org());
create policy programs_ins on public.programs for insert with check (org_id = public.my_org() and public.my_role() in ('admin','chefe','diretor'));
create policy programs_upd on public.programs for update
  using (org_id = public.my_org() and public.my_role() in ('admin','chefe','diretor')) with check (org_id = public.my_org());
create policy programs_del on public.programs for delete
  using (org_id = public.my_org() and public.my_role() in ('admin','chefe','diretor'));

create policy pautas_sel on public.pautas for select using (org_id = public.my_org());
create policy pautas_ins on public.pautas for insert with check (org_id = public.my_org());
create policy pautas_upd on public.pautas for update using (org_id = public.my_org()) with check (org_id = public.my_org());

create policy rundowns_sel on public.rundowns for select using (org_id = public.my_org());
create policy rundowns_ins on public.rundowns for insert with check (org_id = public.my_org());
create policy rundowns_upd on public.rundowns for update using (org_id = public.my_org()) with check (org_id = public.my_org());

create policy items_sel on public.items for select using (org_id = public.my_org());
create policy items_ins on public.items for insert with check (org_id = public.my_org());
create policy items_upd on public.items for update using (org_id = public.my_org()) with check (org_id = public.my_org());

create policy locks_sel on public.locks for select using (org_id = public.my_org());

create policy logs_sel on public.logs for select using (org_id = public.my_org());
create policy logs_ins on public.logs for insert with check (org_id = public.my_org() and user_id = auth.uid());

-- Coluna org_id preenchida automaticamente para inserts vindos do app
alter table public.programs alter column org_id set default public.my_org();
alter table public.pautas   alter column org_id set default public.my_org();
alter table public.rundowns alter column org_id set default public.my_org();
alter table public.items    alter column org_id set default public.my_org();
alter table public.invites  alter column org_id set default public.my_org();
alter table public.logs     alter column org_id set default public.my_org();

-- Permissões das funções
revoke all on function public.bootstrap(text, text)        from public, anon;
revoke all on function public.acquire_lock(text)            from public, anon;
revoke all on function public.release_lock(text)            from public, anon;
revoke all on function public.reorder_items(uuid, uuid[])   from public, anon;
grant execute on function public.bootstrap(text, text)      to authenticated;
grant execute on function public.acquire_lock(text)          to authenticated;
grant execute on function public.release_lock(text)          to authenticated;
grant execute on function public.reorder_items(uuid, uuid[]) to authenticated;
grant execute on function public.on_air_item(uuid, boolean)  to authenticated;
grant execute on function public.set_equipe_tecnica(text[], text[]) to authenticated;
grant execute on function public.on_air_rundown(uuid, text)  to authenticated;

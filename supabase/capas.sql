-- CAPA DA PAUTA: salva automaticamente no login de cada pessoa (uma por data)
create table if not exists public.capas (
  user_id   uuid not null references public.profiles(id) on delete cascade,
  data      date not null,
  conteudo  jsonb not null check (octet_length(conteudo::text) <= 100000),
  salvo_em  bigint not null,          -- hora da última alteração (milissegundos)
  primary key (user_id, data)
);
alter table public.capas enable row level security;
revoke all on public.capas from anon;
grant select, insert, update, delete on public.capas to authenticated;
drop policy if exists capas_proprias on public.capas;
create policy capas_proprias on public.capas for all
  using (user_id = auth.uid() and public.my_org() is not null)
  with check (user_id = auth.uid() and public.my_org() is not null);

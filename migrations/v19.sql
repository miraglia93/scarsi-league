-- ============================================================
-- SCARSI LEAGUE — Migrazione v1.14 — backup interno automatico
-- Eseguire nell'SQL Editor di Supabase dopo v18.sql
--
-- Perché: il piano Supabase attuale (Free) non include backup né
-- point-in-time recovery — se una lega viene cancellata (per errore
-- o bug) non c'è modo di recuperarla da dentro Supabase. Questa
-- migrazione aggiunge una fotografia completa di tutte le leghe ogni
-- notte, dentro una tabella separata di questo stesso database —
-- pg_cron è un'estensione Postgres standard, gratuita anche sul
-- piano Free (a differenza dei backup gestiti da Supabase).
--
-- Non è un disaster-recovery vero (se sparisce l'intero database
-- sparisce anche questa tabella) — è una rete di sicurezza contro
-- l'errore più probabile: una singola lega cancellata per sbaglio.
-- Tiene le ultime 14 notti, poi le più vecchie vengono scartate.
--
-- Se "create extension pg_cron" dà errore di permessi, vai su
-- Database → Extensions nel pannello Supabase e abilita "pg_cron"
-- da lì, poi rilancia questa migrazione.
-- ============================================================

create extension if not exists pg_cron;

create table if not exists backup_snapshot (
  id bigserial primary key,
  creato_il timestamptz not null default now(),
  dati jsonb not null
);

alter table backup_snapshot enable row level security;

do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'backup_snapshot' loop
    execute format('drop policy %I on backup_snapshot', pol.policyname);
  end loop;
end $$;

-- solo il super-admin (te) può leggere i backup — non i singoli
-- admin di lega, che vedrebbero dati di leghe non loro
create policy "solo super admin legge i backup" on backup_snapshot for select to authenticated
  using (is_super_admin());

create or replace function crea_backup_giornaliero() returns void
language plpgsql security definer as $$
begin
  insert into backup_snapshot (dati)
  select jsonb_build_object(
    'leghe', coalesce((select jsonb_agg(to_jsonb(t)) from leghe t), '[]'::jsonb),
    'membri_autorizzati', coalesce((select jsonb_agg(to_jsonb(t)) from membri_autorizzati t), '[]'::jsonb),
    'giocatori', coalesce((select jsonb_agg(to_jsonb(t)) from giocatori t), '[]'::jsonb),
    'stagioni', coalesce((select jsonb_agg(to_jsonb(t)) from stagioni t), '[]'::jsonb),
    'partite', coalesce((select jsonb_agg(to_jsonb(t)) from partite t), '[]'::jsonb),
    'prestazioni', coalesce((select jsonb_agg(to_jsonb(t)) from prestazioni t), '[]'::jsonb),
    'voti_ricevuti', coalesce((select jsonb_agg(to_jsonb(t)) from voti_ricevuti t), '[]'::jsonb),
    'dati_manuali', coalesce((select jsonb_agg(to_jsonb(t)) from dati_manuali t), '[]'::jsonb),
    'premi', coalesce((select jsonb_agg(to_jsonb(t)) from premi t), '[]'::jsonb),
    'utenti_piattaforma', coalesce((select jsonb_agg(to_jsonb(t)) from utenti_piattaforma t), '[]'::jsonb)
  );

  delete from backup_snapshot where creato_il < now() - interval '14 days';
end;
$$;

-- rimuove un job precedente con lo stesso nome, se questa migrazione
-- viene eseguita più di una volta (cron.schedule non fa "or replace")
do $$
begin
  perform cron.unschedule('backup-giornaliero-scarsi-league');
exception when others then null;
end $$;

select cron.schedule('backup-giornaliero-scarsi-league', '0 3 * * *', 'select crea_backup_giornaliero();');

-- primo backup subito, non aspettare la notte per avere la prima rete di sicurezza
select crea_backup_giornaliero();

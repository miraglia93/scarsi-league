-- ============================================================
-- SCARSI LEAGUE — Migrazione v1.4 — leghe pubbliche (opt-in)
-- Eseguire nell'SQL Editor di Supabase dopo v12.sql
-- ============================================================

-- di default una lega resta privata (si entra solo con invito, come
-- oggi); l'admin può scegliere di renderla visibile nell'elenco
-- pubblico su /leghe — stesso principio di giocatori.visibilita_pubblica
alter table leghe add column if not exists pubblica boolean not null default false;

-- l'admin di una lega può modificare la propria (nome/struttura/pubblica);
-- la creazione resta comunque riservata a crea_lega() (verifica l'abbonamento)
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'leghe' loop
    execute format('drop policy %I on leghe', pol.policyname);
  end loop;
end $$;

create policy "lettura membri" on leghe for select to authenticated
  using (is_membro_lega(id));
create policy "admin modifica la propria lega" on leghe for update to authenticated
  using (is_admin_lega(id)) with check (is_admin_lega(id));

-- elenco pubblico: solo i campi non sensibili delle leghe che hanno
-- scelto di comparire, leggibile anche da chi non è ancora membro
create or replace function leghe_pubbliche() returns table(nome text, slug text, struttura text)
language sql security definer stable as $$
  select nome, slug, struttura from leghe where pubblica = true order by nome;
$$;

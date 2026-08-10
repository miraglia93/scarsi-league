-- ============================================================
-- SCARSI LEAGUE — Migrazione v1.10.2 — fix permessi consensi
-- Eseguire nell'SQL Editor di Supabase dopo v16.sql
--
-- consensi aveva solo la policy per crearsi la propria riga, mai per
-- modificarla — andava bene finché si faceva un insert puro, ma ora
-- che una nuova versione della privacy policy fa un upsert (per non
-- creare una seconda riga duplicata sulla stessa email, che ha
-- vincolo di unicità), serve anche il permesso di aggiornarla.
-- ============================================================

do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public'
    and tablename = 'consensi' and cmd = 'UPDATE' loop
    execute format('drop policy %I on consensi', pol.policyname);
  end loop;
end $$;

create policy "aggiorna il tuo consenso" on consensi for update to authenticated
  using (email = lower(auth.jwt() ->> 'email'))
  with check (email = lower(auth.jwt() ->> 'email'));

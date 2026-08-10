-- ============================================================
-- SCARSI LEAGUE — Migrazione v1.10 — identità di registrazione
-- Eseguire nell'SQL Editor di Supabase dopo v15.sql
--
-- Nome, cognome (obbligatori) e telefono (facoltativo, per essere
-- contattati in caso di imprevisti prima di una partita) raccolti UNA
-- VOLTA a livello di account, non più per singola lega. Vivono in
-- utenti_piattaforma (già la tabella "un account, una riga" — vedi
-- v11.sql) invece di una tabella nuova.
-- ============================================================

alter table utenti_piattaforma add column if not exists nome text;
alter table utenti_piattaforma add column if not exists cognome text;
alter table utenti_piattaforma add column if not exists telefono text;

-- mancava: potevi creare la tua riga (crea_lega/richiedi abbonamento)
-- ma non modificarla — serve per salvare nome/cognome/telefono al
-- primo accesso e per poterli correggere in futuro dal profilo
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public'
    and tablename = 'utenti_piattaforma' and policyname = 'aggiorna la tua riga' loop
    execute format('drop policy %I on utenti_piattaforma', pol.policyname);
  end loop;
end $$;

create policy "aggiorna la tua riga" on utenti_piattaforma for update to authenticated
  using (email = lower(auth.jwt() ->> 'email'))
  with check (email = lower(auth.jwt() ->> 'email'));

-- ============================================================
-- SCARSI LEAGUE — Migrazione v1.15 — fix ordine di elimina_lega()
-- Eseguire nell'SQL Editor di Supabase dopo v19.sql
--
-- Bug trovato eliminando "Monday League" (lega di test): la funzione
-- cancellava prima giocatori e poi membri_autorizzati, ma
-- membri_autorizzati.giocatore_id → giocatori(id) non ha "on delete
-- cascade" (NO ACTION) — quindi se un membro aveva reclamato una
-- scheda (giocatore_id valorizzato), la cancellazione falliva con un
-- vincolo di chiave esterna violato ("ci sono dati collegati da
-- rimuovere prima"). Corretto invertendo l'ordine: membri_autorizzati
-- prima di giocatori.
-- ============================================================

create or replace function elimina_lega(p_lega_id bigint) returns text
language plpgsql security definer as $$
begin
  if not is_admin_lega(p_lega_id) then return 'Non autorizzato'; end if;

  delete from voti_ricevuti where partita_id in (select id from partite where lega_id = p_lega_id);
  delete from dati_manuali where partita_id in (select id from partite where lega_id = p_lega_id);
  delete from prestazioni where partita_id in (select id from partite where lega_id = p_lega_id);
  delete from premi where lega_id = p_lega_id;
  delete from partite where lega_id = p_lega_id;
  delete from stagioni where lega_id = p_lega_id;
  delete from membri_autorizzati where lega_id = p_lega_id;
  delete from richieste_accesso where lega_id = p_lega_id;
  delete from giocatori where lega_id = p_lega_id;
  delete from leghe where id = p_lega_id;
  return 'ok';
end;
$$;

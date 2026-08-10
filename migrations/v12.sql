-- ============================================================
-- SCARSI LEAGUE — Migrazione v1.3 — "diritto di andarsene"
-- RPC per eliminare l'intera lega (l'organizzatore, in autonomia)
-- Eseguire nell'SQL Editor di Supabase dopo v11.sql
-- ============================================================

-- elimina esplicitamente ogni tabella lega-scoped, in ordine di
-- dipendenza, invece di affidarsi a eventuali "on delete cascade" su
-- leghe(id) di cui non ho conferma nello schema originale: così
-- funziona in modo prevedibile a prescindere da come sono definiti i
-- vincoli. Utilizzabile solo dall'admin della lega stessa.
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
  delete from giocatori where lega_id = p_lega_id;
  delete from membri_autorizzati where lega_id = p_lega_id;
  delete from richieste_accesso where lega_id = p_lega_id;
  delete from leghe where id = p_lega_id;
  return 'ok';
end;
$$;

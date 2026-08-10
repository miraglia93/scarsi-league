-- ============================================================
-- SCARSI LEAGUE — Migrazione v1.11 — nome di registrazione sulle carte
-- Eseguire nell'SQL Editor di Supabase dopo v17.sql
--
-- Il nome mostrato su carte/classifiche/TOTW/hall of fame era sempre
-- quello importato da Fubles (nickname a parte). Ora, per un giocatore
-- la cui scheda è stata rivendicata da un account, mostriamo il nome
-- e cognome della registrazione al posto di quello Fubles (il
-- nickname, se impostato, resta comunque la priorità più alta — non
-- cambia nulla lì).
--
-- Espone solo giocatore_id + nome_completo, mai l'email o altri dati
-- dell'account: una funzione dedicata e ristretta, non un accesso
-- diretto a membri_autorizzati/utenti_piattaforma (che restano protette
-- come sempre dalle loro policy RLS).
-- ============================================================

create or replace function nomi_registrati(p_lega_id bigint) returns table(giocatore_id bigint, nome_completo text)
language sql security definer stable as $$
  select m.giocatore_id, trim(concat_ws(' ', u.nome, u.cognome)) as nome_completo
  from membri_autorizzati m
  join utenti_piattaforma u on u.email = m.email
  where m.lega_id = p_lega_id
    and m.giocatore_id is not null
    and u.nome is not null and u.cognome is not null
    and is_membro_lega(p_lega_id);
$$;

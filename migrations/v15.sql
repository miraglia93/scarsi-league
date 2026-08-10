-- ============================================================
-- SCARSI LEAGUE — Migrazione v1.9 — orario della lega
-- Eseguire nell'SQL Editor di Supabase dopo v14.sql
--
-- Campo libero accanto a "struttura" (già esistente, es. "Centro
-- Sportivo Bettinelli"): giorno/ora in cui si gioca di solito, es.
-- "Lunedì · 21:30". Mostrato sotto il nome della lega e nell'elenco
-- pubblico /leghe.
-- ============================================================

alter table leghe add column if not exists orario text;

-- leghe_pubbliche() ridefinita con la colonna in più: il tipo di
-- ritorno cambia, quindi va eliminata e ricreata (create or replace
-- da solo non basta quando cambiano le colonne restituite)
drop function if exists leghe_pubbliche();

create or replace function leghe_pubbliche() returns table(nome text, slug text, struttura text, orario text)
language sql security definer stable as $$
  select nome, slug, struttura, orario from leghe where pubblica = true order by nome;
$$;

-- crea_lega(): nuovo parametro p_orario in coda, con default — le
-- chiamate esistenti restano valide; drop esplicito per evitare
-- l'overload (create or replace da solo non basta quando cambia
-- la lista degli argomenti)
drop function if exists crea_lega(text, text, text);

create or replace function crea_lega(p_nome text, p_slug text, p_struttura text default null, p_orario text default null) returns bigint
language plpgsql security definer as $$
declare
  v_email text := lower(auth.jwt() ->> 'email');
  v_attivo boolean;
  v_lega_id bigint;
begin
  select abbonamento_attivo into v_attivo from utenti_piattaforma where email = v_email;
  if coalesce(v_attivo, false) is not true then
    raise exception 'Serve un abbonamento attivo per creare una lega';
  end if;
  insert into leghe (nome, slug, struttura, orario, owner_email)
    values (p_nome, lower(p_slug), p_struttura, p_orario, v_email)
    returning id into v_lega_id;
  insert into membri_autorizzati (email, nome, lega_id, ruolo)
    values (v_email, null, v_lega_id, 'admin');
  insert into stagioni (lega_id, nome, inizio, attiva)
    values (v_lega_id, 'Stagione 1', current_date, true);
  return v_lega_id;
end;
$$;

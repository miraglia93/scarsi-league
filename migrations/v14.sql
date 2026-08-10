-- ============================================================
-- SCARSI LEAGUE — Migrazione v1.7 — ruolo "coorganizzatore"
-- Eseguire nell'SQL Editor di Supabase dopo v13.sql
--
-- Un secondo ruolo, oltre admin/membro: può fare la gestione
-- operativa quotidiana della lega (import partite, dati partita,
-- accessi, stagioni, premi) ma NON le azioni "di governance":
-- eliminare la lega, eliminare una stagione, rendere la lega
-- pubblica/privata, promuovere o rimuovere admin/coorganizzatori.
-- Quella distinzione resta riservata a chi ha ruolo='admin'.
-- ============================================================

-- allarga il check sul ruolo (nome del vincolo sconosciuto: creato a
-- mano prima di questo file — lo trovo ed elimino dinamicamente,
-- stesso approccio usato in v11.sql per le policy)
do $$
declare con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'membri_autorizzati'::regclass and contype = 'c'
  loop
    execute format('alter table membri_autorizzati drop constraint %I', con.conname);
  end loop;
end $$;

alter table membri_autorizzati add constraint membri_autorizzati_ruolo_check
  check (ruolo in ('admin', 'coorganizzatore', 'membro'));

-- true per admin E coorganizzatore: la gestione operativa
create or replace function is_gestore_lega(p_lega_id bigint) returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from membri_autorizzati m
    where m.email = lower(auth.jwt() ->> 'email') and m.lega_id = p_lega_id
      and m.ruolo in ('admin', 'coorganizzatore')
  );
$$;

-- ---------- tabelle operative: admin scrive → gestore scrive ----------
do $$
declare pol record; t text;
begin
  foreach t in array array['giocatori','partite','prestazioni','voti_ricevuti','dati_manuali','premi'] loop
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t
      and policyname like 'admin %' loop
      execute format('drop policy %I on %I', pol.policyname, t);
    end loop;
  end loop;
end $$;

create policy "gestore scrive giocatori" on giocatori for all to authenticated
  using (is_gestore_lega(lega_id)) with check (is_gestore_lega(lega_id));
create policy "gestore scrive partite" on partite for all to authenticated
  using (is_gestore_lega(lega_id)) with check (is_gestore_lega(lega_id));
create policy "gestore scrive prestazioni" on prestazioni for all to authenticated
  using (is_gestore_lega((select p.lega_id from partite p where p.id = prestazioni.partita_id)))
  with check (is_gestore_lega((select p.lega_id from partite p where p.id = prestazioni.partita_id)));
create policy "gestore scrive voti_ricevuti" on voti_ricevuti for all to authenticated
  using (is_gestore_lega((select p.lega_id from partite p where p.id = voti_ricevuti.partita_id)))
  with check (is_gestore_lega((select p.lega_id from partite p where p.id = voti_ricevuti.partita_id)));
create policy "gestore scrive dati manuali" on dati_manuali for all to authenticated
  using (is_gestore_lega((select p.lega_id from partite p where p.id = dati_manuali.partita_id)))
  with check (is_gestore_lega((select p.lega_id from partite p where p.id = dati_manuali.partita_id)));
create policy "gestore scrive premi" on premi for all to authenticated
  using (is_gestore_lega(lega_id)) with check (is_gestore_lega(lega_id));

-- ---------- stagioni: crea/modifica per il gestore, elimina solo admin ----------
drop policy if exists "admin scrive stagioni" on stagioni;
create policy "gestore crea stagioni" on stagioni for insert to authenticated
  with check (is_gestore_lega(lega_id));
create policy "gestore modifica stagioni" on stagioni for update to authenticated
  using (is_gestore_lega(lega_id)) with check (is_gestore_lega(lega_id));
create policy "admin elimina stagioni" on stagioni for delete to authenticated
  using (is_admin_lega(lega_id));

-- ---------- richieste_accesso: il gestore le legge e le gestisce ----------
drop policy if exists "admin legge richieste lega" on richieste_accesso;
drop policy if exists "admin gestisce richieste lega" on richieste_accesso;
create policy "gestore legge richieste lega" on richieste_accesso for select to authenticated
  using (is_gestore_lega(lega_id));
create policy "gestore gestisce richieste lega" on richieste_accesso for all to authenticated
  using (is_gestore_lega(lega_id)) with check (is_gestore_lega(lega_id));

-- ---------- membri_autorizzati: il gestore vede tutti, ma tocca solo i
-- membri semplici — promuovere/rimuovere admin o coorganizzatori resta
-- solo dell'admin (using/with_check leggono il ruolo della riga stessa:
-- se non è 'membro' serve is_admin_lega, sia per la riga di partenza
-- che per quella di arrivo) ----------
drop policy if exists "admin legge membri lega" on membri_autorizzati;
drop policy if exists "admin gestisce membri lega" on membri_autorizzati;
create policy "gestore legge membri lega" on membri_autorizzati for select to authenticated
  using (is_gestore_lega(lega_id));
create policy "gestore agisce su membri non privilegiati" on membri_autorizzati for all to authenticated
  using (is_gestore_lega(lega_id) and (ruolo = 'membro' or is_admin_lega(lega_id)))
  with check (is_gestore_lega(lega_id) and (ruolo = 'membro' or is_admin_lega(lega_id)));

-- ---------- RPC approva/rifiuta richiesta: anche il coorganizzatore ----------
create or replace function approva_richiesta(p_email text, p_lega_id bigint) returns text
language plpgsql security definer as $$
declare v_nome text;
begin
  if not is_gestore_lega(p_lega_id) then return 'Non autorizzato'; end if;
  select nome into v_nome from richieste_accesso where email = lower(p_email) and lega_id = p_lega_id;
  if v_nome is null then return 'Richiesta non trovata'; end if;
  insert into membri_autorizzati (email, nome, lega_id)
    values (lower(p_email), v_nome, p_lega_id)
    on conflict (email, lega_id) do nothing;
  update richieste_accesso set stato = 'approvata' where email = lower(p_email) and lega_id = p_lega_id;
  return 'ok';
end;
$$;

create or replace function rifiuta_richiesta(p_email text, p_lega_id bigint) returns text
language plpgsql security definer as $$
begin
  if not is_gestore_lega(p_lega_id) then return 'Non autorizzato'; end if;
  update richieste_accesso set stato = 'rifiutata' where email = lower(p_email) and lega_id = p_lega_id;
  return 'ok';
end;
$$;

-- nota: leghe (pubblica/privata, elimina_lega) restano su is_admin_lega,
-- nessuna modifica — sono decisioni di governance, non operative.

-- ============================================================
-- SCARSI LEAGUE — Migrazione v1.1 "La Piattaforma" — FASE A
-- Isolamento dati tra leghe (multi-tenancy) + abbonamento (modello)
-- Eseguire nell'SQL Editor di Supabase dopo v09.sql
--
-- ⚠ Nota: whitelist.sql conteneva SOLO la policy "vedi te stesso" su
-- membri_autorizzati. Il pannello admin oggi legge/scrive tutti i membri
-- e le richieste, quindi da qualche parte (v07_piattaforma.sql, eseguito
-- a mano e mai salvato in migrations/) devono esistere altre policy e le
-- funzioni is_admin()/claim_giocatore()/approva_richiesta()/
-- rifiuta_richiesta() che non ho potuto rileggere. Questa migrazione
-- quindi AZZERA e RICREA da zero tutte le policy sulle tabelle toccate
-- (con un blocco DO che elimina qualsiasi policy esistente per nome,
-- qualunque esso sia) invece di fare drop mirati: è il modo sicuro di
-- procedere senza conoscere i nomi esatti già in uso. Le funzioni
-- claim_giocatore/approva_richiesta/rifiuta_richiesta vengono ridefinite
-- per intero (stessa logica descritta in richieste_accesso.sql), solo
-- con in più il parametro lega.
--
-- ⚠ PRIMA DI ESEGUIRE: verifica che la lega con id più basso in tabella
-- "leghe" sia davvero Calci8Lunedì (si vede nel pannello admin, sezione
-- Leghe) — è quella a cui vengono assegnati membri/richieste esistenti.
-- ============================================================

-- ---------- UTENTI PIATTAFORMA (abbonamento, modello senza Stripe) ----------
create table if not exists utenti_piattaforma (
  email              text primary key,
  piano              text not null default 'free',
  abbonamento_attivo boolean not null default false,
  super_admin        boolean not null default false,
  creato_il          timestamptz not null default now(),
  constraint email_minuscola check (email = lower(email))
);

alter table utenti_piattaforma enable row level security;

do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'utenti_piattaforma' loop
    execute format('drop policy %I on utenti_piattaforma', pol.policyname);
  end loop;
end $$;

create or replace function is_super_admin() returns boolean
language sql security definer stable as $$
  select coalesce((select super_admin from utenti_piattaforma where email = lower(auth.jwt() ->> 'email')), false);
$$;

create policy "vedi te stesso" on utenti_piattaforma for select to authenticated
  using (email = lower(auth.jwt() ->> 'email'));
create policy "crea la tua riga" on utenti_piattaforma for insert to authenticated
  with check (email = lower(auth.jwt() ->> 'email'));
create policy "super admin legge tutto" on utenti_piattaforma for select to authenticated
  using (is_super_admin());
create policy "super admin gestisce abbonamenti" on utenti_piattaforma for update to authenticated
  using (is_super_admin()) with check (is_super_admin());

insert into utenti_piattaforma (email, piano, abbonamento_attivo, super_admin)
  values ('miraglia93@gmail.com', 'platform', true, true)
  on conflict (email) do update set super_admin = true, abbonamento_attivo = true;

-- ---------- MEMBRI_AUTORIZZATI: aggiungi lega_id, chiave composta ----------
alter table membri_autorizzati add column if not exists lega_id bigint references leghe(id);
update membri_autorizzati set lega_id = (select id from leghe order by id asc limit 1) where lega_id is null;
alter table membri_autorizzati alter column lega_id set not null;
alter table membri_autorizzati drop constraint if exists membri_autorizzati_pkey;
alter table membri_autorizzati add primary key (email, lega_id);

-- ---------- RICHIESTE_ACCESSO: aggiungi lega_id, chiave composta ----------
alter table richieste_accesso add column if not exists lega_id bigint references leghe(id);
update richieste_accesso set lega_id = (select id from leghe order by id asc limit 1) where lega_id is null;
alter table richieste_accesso alter column lega_id set not null;
alter table richieste_accesso drop constraint if exists richieste_accesso_pkey;
alter table richieste_accesso add primary key (email, lega_id);

-- ---------- LEGHE: proprietario ----------
alter table leghe add column if not exists owner_email text;
update leghe set owner_email = 'miraglia93@gmail.com' where owner_email is null;

-- ---------- FUNZIONI DI APPARTENENZA/PERMESSO PER LEGA ----------
create or replace function is_membro_lega(p_lega_id bigint) returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from membri_autorizzati m
    where m.email = lower(auth.jwt() ->> 'email') and m.lega_id = p_lega_id
  );
$$;

create or replace function is_admin_lega(p_lega_id bigint) returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from membri_autorizzati m
    where m.email = lower(auth.jwt() ->> 'email') and m.lega_id = p_lega_id and m.ruolo = 'admin'
  );
$$;

-- ---------- RESET + RICREAZIONE POLICY, TABELLA PER TABELLA ----------
do $$
declare pol record; t text;
begin
  foreach t in array array['leghe','giocatori','partite','prestazioni','voti_ricevuti',
                            'stagioni','dati_manuali','premi','membri_autorizzati','richieste_accesso'] loop
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on %I', pol.policyname, t);
    end loop;
  end loop;
end $$;

-- leghe: solo lettura per i membri della lega specifica; nessuna scrittura
-- diretta (la creazione passa sempre da crea_lega(), che verifica l'abbonamento)
create policy "lettura membri" on leghe for select to authenticated
  using (is_membro_lega(id));

-- giocatori: lettura per membri della lega; un membro può modificare SOLO
-- la scheda che ha rivendicato (claim_giocatore); l'admin gestisce tutto
-- (serve anche all'import manuale, FASE D)
create policy "lettura membri" on giocatori for select to authenticated
  using (is_membro_lega(lega_id));
create policy "membro modifica propria scheda" on giocatori for update to authenticated
  using (exists (select 1 from membri_autorizzati m where m.email = lower(auth.jwt() ->> 'email') and m.giocatore_id = giocatori.id))
  with check (exists (select 1 from membri_autorizzati m where m.email = lower(auth.jwt() ->> 'email') and m.giocatore_id = giocatori.id));
create policy "admin gestisce giocatori" on giocatori for all to authenticated
  using (is_admin_lega(lega_id)) with check (is_admin_lega(lega_id));

-- partite
create policy "lettura membri" on partite for select to authenticated
  using (is_membro_lega(lega_id));
create policy "admin scrive partite" on partite for all to authenticated
  using (is_admin_lega(lega_id)) with check (is_admin_lega(lega_id));

-- prestazioni (lega dedotta dalla partita collegata)
create policy "lettura membri" on prestazioni for select to authenticated
  using (is_membro_lega((select p.lega_id from partite p where p.id = prestazioni.partita_id)));
create policy "admin scrive prestazioni" on prestazioni for all to authenticated
  using (is_admin_lega((select p.lega_id from partite p where p.id = prestazioni.partita_id)))
  with check (is_admin_lega((select p.lega_id from partite p where p.id = prestazioni.partita_id)));

-- voti_ricevuti (lega dedotta dalla partita collegata)
create policy "lettura membri" on voti_ricevuti for select to authenticated
  using (is_membro_lega((select p.lega_id from partite p where p.id = voti_ricevuti.partita_id)));
create policy "admin scrive voti_ricevuti" on voti_ricevuti for all to authenticated
  using (is_admin_lega((select p.lega_id from partite p where p.id = voti_ricevuti.partita_id)))
  with check (is_admin_lega((select p.lega_id from partite p where p.id = voti_ricevuti.partita_id)));

-- stagioni
create policy "lettura membri" on stagioni for select to authenticated
  using (is_membro_lega(lega_id));
create policy "admin scrive stagioni" on stagioni for all to authenticated
  using (is_admin_lega(lega_id)) with check (is_admin_lega(lega_id));

-- dati_manuali (lega dedotta dalla partita collegata)
create policy "lettura membri" on dati_manuali for select to authenticated
  using (is_membro_lega((select p.lega_id from partite p where p.id = dati_manuali.partita_id)));
create policy "admin scrive dati manuali" on dati_manuali for all to authenticated
  using (is_admin_lega((select p.lega_id from partite p where p.id = dati_manuali.partita_id)))
  with check (is_admin_lega((select p.lega_id from partite p where p.id = dati_manuali.partita_id)));

-- premi
create policy "lettura membri" on premi for select to authenticated
  using (is_membro_lega(lega_id));
create policy "admin scrive premi" on premi for all to authenticated
  using (is_admin_lega(lega_id)) with check (is_admin_lega(lega_id));

-- membri_autorizzati: ognuno vede le proprie righe (una per lega); l'admin
-- di una lega vede/gestisce solo le righe di quella lega
create policy "vedi te stesso" on membri_autorizzati for select to authenticated
  using (email = lower(auth.jwt() ->> 'email'));
create policy "admin legge membri lega" on membri_autorizzati for select to authenticated
  using (is_admin_lega(lega_id));
create policy "admin gestisce membri lega" on membri_autorizzati for all to authenticated
  using (is_admin_lega(lega_id)) with check (is_admin_lega(lega_id));

-- richieste_accesso: ognuno crea/vede le proprie richieste (una per lega);
-- l'admin di una lega vede/gestisce solo le richieste per quella lega
create policy "richiedi per te" on richieste_accesso for insert to authenticated
  with check (email = lower(auth.jwt() ->> 'email'));
create policy "vedi la tua richiesta" on richieste_accesso for select to authenticated
  using (email = lower(auth.jwt() ->> 'email'));
create policy "admin legge richieste lega" on richieste_accesso for select to authenticated
  using (is_admin_lega(lega_id));
create policy "admin gestisce richieste lega" on richieste_accesso for all to authenticated
  using (is_admin_lega(lega_id)) with check (is_admin_lega(lega_id));

-- ---------- RPC: claim_giocatore, approva_richiesta, rifiuta_richiesta ----------
-- ridefinite per intero con il parametro lega (la firma precedente aveva
-- un solo parametro: la elimino esplicitamente per non lasciarla in giro)
drop function if exists claim_giocatore(bigint);
drop function if exists approva_richiesta(text);
drop function if exists rifiuta_richiesta(text);

create or replace function claim_giocatore(gid bigint, p_lega_id bigint) returns text
language plpgsql security definer as $$
declare
  v_email text := lower(auth.jwt() ->> 'email');
  v_lega_giocatore bigint;
begin
  if not is_membro_lega(p_lega_id) then return 'Non autorizzato'; end if;
  if gid is not null then
    select lega_id into v_lega_giocatore from giocatori where id = gid;
    if v_lega_giocatore is distinct from p_lega_id then return 'Giocatore non trovato in questa lega'; end if;
    if exists (select 1 from membri_autorizzati where giocatore_id = gid and lega_id = p_lega_id and email <> v_email) then
      return 'Scheda già collegata a un altro account';
    end if;
  end if;
  update membri_autorizzati set giocatore_id = gid where email = v_email and lega_id = p_lega_id;
  return 'ok';
end;
$$;

create or replace function approva_richiesta(p_email text, p_lega_id bigint) returns text
language plpgsql security definer as $$
declare v_nome text;
begin
  if not is_admin_lega(p_lega_id) then return 'Non autorizzato'; end if;
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
  if not is_admin_lega(p_lega_id) then return 'Non autorizzato'; end if;
  update richieste_accesso set stato = 'rifiutata' where email = lower(p_email) and lega_id = p_lega_id;
  return 'ok';
end;
$$;

-- ---------- RPC: crea_lega, lega_da_slug ----------
create or replace function crea_lega(p_nome text, p_slug text, p_struttura text default null) returns bigint
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
  insert into leghe (nome, slug, struttura, owner_email)
    values (p_nome, lower(p_slug), p_struttura, v_email)
    returning id into v_lega_id;
  insert into membri_autorizzati (email, nome, lega_id, ruolo)
    values (v_email, null, v_lega_id, 'admin');
  insert into stagioni (lega_id, nome, inizio, attiva)
    values (v_lega_id, 'Stagione 1', current_date, true);
  return v_lega_id;
end;
$$;

create or replace function lega_da_slug(p_slug text) returns table(id bigint, nome text)
language sql security definer stable as $$
  select id, nome from leghe where slug = lower(p_slug);
$$;

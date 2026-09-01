-- v30 — live match FASE C: vista pubblica in diretta
--
-- Prima superficie non autenticata dell'app (RLS `to anon`): scoped
-- sempre a una singola partita con condivisione_pubblica = true,
-- mai all'intera lega o alla rosa giocatori. La select su prestazioni
-- resta ristretta alla singola partita pubblica (via join su partite),
-- e su giocatori è ristretta a chi ha davvero giocato quella partita
-- (via join su prestazioni), non all'intera rosa della lega.

create policy "lettura pubblica partita condivisa" on partite
  for select to anon
  using (condivisione_pubblica = true);

create policy "lettura pubblica prestazioni partita condivisa" on prestazioni
  for select to anon
  using (exists (
    select 1 from partite p
    where p.id = prestazioni.partita_id and p.condivisione_pubblica = true
  ));

create policy "lettura pubblica dati manuali partita condivisa" on dati_manuali
  for select to anon
  using (exists (
    select 1 from partite p
    where p.id = dati_manuali.partita_id and p.condivisione_pubblica = true
  ));

create policy "lettura pubblica giocatori partita condivisa" on giocatori
  for select to anon
  using (exists (
    select 1 from prestazioni pr
    join partite p on p.id = pr.partita_id
    where pr.giocatore_id = giocatori.id and p.condivisione_pubblica = true
  ));

-- Realtime: solo prestazioni/dati_manuali servono per il live pubblico
-- (gol/assist/cartellini/formazione) — mai l'intera lega in ascolto.
alter publication supabase_realtime add table prestazioni;
alter publication supabase_realtime add table dati_manuali;

-- v31 — opt-out di visibilità pubblica per la pagina live (FASE C)
--
-- giocatori.visibilita_pubblica esisteva da sempre (default false,
-- stesso principio di leghe.pubblica) ma non era mai stata letta da
-- nessuna policy: prima di FASE C nessun dato giocatore usciva mai
-- dalla whitelist, quindi non serviva. La pagina pubblica /live/[codice]
-- è la prima superficie che espone nome/foto a visitatori anonimi, ed
-- è giusto che li rispetti.
--
-- Applicare il filtro alla lettera (solo chi ha visibilita_pubblica =
-- true) avrebbe svuotato la funzione per tutti, visto che il default
-- storico è false e nessuna UI l'ha mai portato a true. Si sceglie
-- quindi di flippare il default e fare backfill: tutti restano
-- visibili come oggi, chi vuole disattiva dal proprio Profilo.
alter table giocatori alter column visibilita_pubblica set default true;
update giocatori set visibilita_pubblica = true where visibilita_pubblica = false;

drop policy if exists "lettura pubblica giocatori partita condivisa" on giocatori;
create policy "lettura pubblica giocatori partita condivisa" on giocatori
  for select to anon
  using (
    visibilita_pubblica = true
    and exists (
      select 1 from prestazioni pr
      join partite p on p.id = pr.partita_id
      where pr.giocatore_id = giocatori.id and p.condivisione_pubblica = true
    )
  );

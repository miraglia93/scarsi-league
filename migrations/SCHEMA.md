# Schema del database — istantanea

Non tracciamo un vero export `pg_dump` (serve la CLI di Supabase e le
credenziali di connessione, che non ho da qui). Come compromesso
pratico: dopo ogni migrazione eseguita in produzione, esegui questa
query nell'SQL Editor di Supabase e incollami il risultato — la
userò per aggiornare questo file, così la prossima volta non devo
ricostruire le policy alla cieca come ho dovuto fare per v11.sql.

```sql
select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

Utile anche un colpo d'occhio sulle colonne reali (specialmente per
`partite`, dove ho dovuto indovinare alcuni nomi per l'import Fubles):

```sql
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;
```

## Ultimo aggiornamento

Non ancora eseguito — nessuna istantanea salvata finora.

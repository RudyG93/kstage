-- 0016 — Suggest fix : un user peut signaler une donnée incorrecte sur un
-- event existant. On garde une seule table `event_suggestions` et on
-- discrimine via une colonne `kind` ('new' | 'fix') + `target_event_id`
-- nullable (lié à l'event ciblé pour les fix).
--
-- Pour les `fix`, les colonnes NOT NULL (group_id, type, title, start_at)
-- sont remplies côté server en copiant les valeurs de l'event ciblé : la
-- suggestion reflète l'état au moment du signalement, l'admin compare
-- avec ce qui est demandé via `description`.

alter table event_suggestions
  add column kind text not null default 'new' check (kind in ('new', 'fix')),
  add column target_event_id uuid references events(id) on delete cascade;

-- Invariant : 'new' = pas de target ; 'fix' = target obligatoire.
alter table event_suggestions
  add constraint event_suggestions_kind_target_chk
  check (
    (kind = 'new' and target_event_id is null) or
    (kind = 'fix' and target_event_id is not null)
  );

-- Index pour le filtrage admin par kind + status.
create index on event_suggestions(kind, status);

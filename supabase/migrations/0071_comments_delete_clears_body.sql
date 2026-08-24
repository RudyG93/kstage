-- « Supprimé » doit vouloir dire supprimé.
--
-- Le soft-delete ne posait que `deleted_at`. Le corps restait en base, la
-- policy SELECT de `comments` est `using (true)`, et la clé anon est dans le
-- bundle : un simple GET PostgREST rendait le texte de n'importe quel
-- commentaire « supprimé ». Vérifié en prod le 2026-08-24 après 0070 —
-- l'application ne le sert plus dans son payload, l'API le servait encore.
--
-- On efface le corps AU MOMENT du retrait. La ligne survit (elle porte ses
-- réponses et la trace de modération), son texte non. C'est ce qu'un
-- utilisateur qui supprime son message attend, et la seule version que la RLS
-- ne peut pas protéger colonne par colonne.

create or replace function public.comments_clear_body_on_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.deleted_at is null and new.deleted_at is not null then
    new.body := '[deleted]';
  end if;
  return new;
end;
$$;

-- BEFORE, et AVANT le gel d'identité dans l'ordre alphabétique des triggers
-- (`comments_clear…` < `comments_freeze…`) : le gel ne regarde pas `body`, les
-- deux ne se marchent pas dessus.
drop trigger if exists comments_clear_body_on_delete on public.comments;
create trigger comments_clear_body_on_delete
  before update of deleted_at on public.comments
  for each row execute function public.comments_clear_body_on_delete();

-- L'archive d'édition (0070) ne doit PAS conserver le texte d'un retrait :
-- `comment_edit_history` est en lecture publique, on déplacerait la fuite.
create or replace function public.comments_archive_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    return new;
  end if;
  if new.body is distinct from old.body then
    insert into public.comment_edit_history (comment_id, user_id, previous_body)
    values (old.id, old.user_id, old.body);
  end if;
  return new;
end;
$$;

-- Les deux commentaires déjà retirés gardaient leur texte en clair.
update public.comments set body = '[deleted]' where deleted_at is not null and body <> '[deleted]';
-- Et l'archive éventuellement écrite pour eux depuis 0070.
delete from public.comment_edit_history h
using public.comments c
where c.id = h.comment_id and c.deleted_at is not null;

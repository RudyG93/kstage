-- Phase 6 — handle_new_user est un trigger SECURITY DEFINER ; il ne doit pas
-- être exposé comme endpoint RPC. On révoque l'exécution pour anon/authenticated
-- (advisor 0028/0029). Le trigger continue de s'exécuter à la création d'un
-- compte (les triggers ne dépendent pas du grant EXECUTE du rôle appelant).
revoke execute on function public.handle_new_user() from anon, authenticated;

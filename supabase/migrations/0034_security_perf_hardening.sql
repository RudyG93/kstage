-- P1 hardening (2026-06-15), guidé par les advisors Supabase (security + perf).
-- Cf. BACKLOG P1 §Sécurité/Perf. Ne traite que les items sûrs et mécaniques ;
-- buckets listing, citext-in-public et leaked-password protection restent à part
-- (storage RLS sensible / dashboard).

-- 1) handle_new_user est une fonction TRIGGER (sur auth.users), jamais une RPC.
--    Le grant EXECUTE par défaut à PUBLIC la rendait appelable via /rest/v1/rpc.
--    On le révoque ; le trigger continue de tourner (il s'exécute en tant que
--    propriétaire/définisseur, indépendamment du grant EXECUTE).
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 2) auth_rls_initplan : auth.uid() est ré-évalué par ligne dans 21 policies.
--    (select auth.uid()) le met en cache par requête — sémantiquement IDENTIQUE,
--    gain de perf à l'échelle. ALTER POLICY préserve tout le reste.
alter policy "artist_suggestions: insert own" on public.artist_suggestions with check ((select auth.uid()) = user_id);
alter policy "artist_suggestions: select own" on public.artist_suggestions using ((select auth.uid()) = user_id);
alter policy "comment_edit_history: insert own" on public.comment_edit_history with check ((select auth.uid()) = user_id);
alter policy "comment_report: insert own" on public.comment_report with check ((select auth.uid()) = reporter_id);
alter policy "comment_votes: delete own" on public.comment_votes using ((select auth.uid()) = user_id);
alter policy "comment_votes: insert own" on public.comment_votes with check ((select auth.uid()) = user_id);
alter policy "comment_votes: update own" on public.comment_votes using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "comments: insert own" on public.comments with check ((select auth.uid()) = user_id);
alter policy "comments: update own" on public.comments using (((select auth.uid()) = user_id) and (deleted_at is null)) with check ((select auth.uid()) = user_id);
alter policy "event_ratings: delete own" on public.event_ratings using ((select auth.uid()) = user_id);
alter policy "event_ratings: insert own" on public.event_ratings with check ((select auth.uid()) = user_id);
alter policy "event_ratings: update own" on public.event_ratings using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "event_suggestions: own rows insert" on public.event_suggestions with check ((select auth.uid()) = user_id);
alter policy "event_suggestions: own rows select" on public.event_suggestions using ((select auth.uid()) = user_id);
alter policy "mv_like: delete own" on public.mv_like using ((select auth.uid()) = user_id);
alter policy "mv_like: insert own" on public.mv_like with check ((select auth.uid()) = user_id);
alter policy "profiles: insert own" on public.profiles with check ((select auth.uid()) = id);
alter policy "profiles: update own" on public.profiles using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
alter policy "push_subscriptions: own rows" on public.push_subscriptions using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "user_follows: own rows" on public.user_follows using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "user_notification_settings: own rows" on public.user_notification_settings using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- 3) FK chaudes sans index couvrant (advisor unindexed_foreign_keys). On indexe
--    les 2 qui portent du trafic réel ; les autres FK sont sur de petites tables
--    (suggestions, monthly_winner…) où un index deviendrait vite "unused"
--    (cf. advisor unused_index) — on s'abstient pour ne pas sur-indexer.
create index if not exists events_source_id_idx on public.events (source_id);
create index if not exists sources_group_id_idx on public.sources (group_id);

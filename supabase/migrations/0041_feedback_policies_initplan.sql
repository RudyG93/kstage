-- 0041 — Régression initplan sur les policies feedback (audit 2026-07-10).
-- Les migrations 0036/0037 (postérieures au wrap global de la 0034) ont écrit
-- `auth.uid() = user_id` nu → réévaluation par row (advisor
-- auth_rls_initplan). Recréées avec `(select auth.uid())`, comme les 21
-- autres policies. Autorisation Rudy 2026-07-11 (bloc d'écritures planifiées).

drop policy if exists feedback_insert_own on public.feedback;
create policy feedback_insert_own on public.feedback
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists feedback_select_own on public.feedback;
create policy feedback_select_own on public.feedback
  for select to authenticated
  using ((select auth.uid()) = user_id);

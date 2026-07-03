-- Le rate-limit (2/24h) est compté avec le client du user : sans SELECT sur
-- ses propres lignes, le count renvoyait toujours 0 et la limite était morte.
create policy "feedback_select_own" on public.feedback
  for select to authenticated
  using (auth.uid() = user_id);

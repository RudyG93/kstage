-- ============================================================
-- KStage — refonte de la taxonomie d'events (post-MVP, phase 2)
--   - `comeback` renommé en `mv` (le clip = l'ancre article/commentaires V2).
--   - Nouveau type `release` (sortie album/single/EP).
--   - `live` reste dans l'enum (Postgres ne drop pas une valeur d'enum
--     facilement) mais sort des types filtrables côté app.
--
-- Le RENAME convertit automatiquement toutes les lignes `comeback` → `mv`.
-- ADD VALUE n'est pas utilisé dans cette transaction (PG12+ l'autorise).
-- ============================================================

alter type event_type rename value 'comeback' to 'mv';
alter type event_type add value if not exists 'release';

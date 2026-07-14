-- Déplace l'extension citext hors du schéma public (advisor extension_in_public,
-- lint 0014). profiles.username reste de type citext : le déplacement se fait par
-- OID (le type, ses opérateurs et l'index unique suivent l'extension), la colonne
-- continue de fonctionner sans DDL supplémentaire. Le search_path des rôles
-- Supabase inclut déjà `extensions`, donc les futures références non qualifiées à
-- `citext` restent résolues. Opération standard recommandée par Supabase.
alter extension citext set schema extensions;

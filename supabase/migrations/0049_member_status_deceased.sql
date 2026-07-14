-- R9 (2026-07-14) : statut « deceased » pour rendre hommage (In memoriam) aux
-- membres décédés — jamais rangés sous « Former ». Valeur ajoutée dans sa PROPRE
-- migration : un ALTER TYPE ADD VALUE ne peut pas être UTILISÉ dans la même
-- transaction que son ajout (l'insertion vit dans 0050).
alter type public.member_status add value if not exists 'deceased';

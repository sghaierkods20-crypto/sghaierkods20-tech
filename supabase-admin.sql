-- Exécuter dans Supabase SQL Editor après la création du compte.
-- Remplacer l’UUID ci-dessous par Authentication > Users > ID.
-- Cette attribution n’est jamais disponible depuis le navigateur.
update public.profiles
set role = 'admin'
where id = 'VOTRE-UUID'::uuid;

-- Pour un compte entreprise, utiliser une commande distincte :
-- update public.profiles set role = 'employer' where id = 'UUID-ENTREPRISE'::uuid;

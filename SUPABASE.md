# StageMatch — Supabase et déploiement

StageMatch est une plateforme de mise en relation pour stages (HTML, CSS et JavaScript natif). Supabase fournit l’authentification, les profils, les offres publiées et les candidatures. Les cartes explicitement marquées « Exemple de démonstration » restent fictives.

## État du projet

- Le navigateur utilise l’URL du projet et sa publishable key dans `supabase-client.js`. Une publishable key est conçue pour être utilisée côté navigateur; ne mettez jamais une `service_role`/secret key ou un mot de passe dans les fichiers du site.
- Les appels publics à `offers` sont prêts. Le code n’exécute aucun SQL automatiquement.
- Aucun compte, candidature, rôle, offre fictive ou donnée existante n’est importé.
- Ouvrir `index.html` comme `file://` ne permet pas de confirmer l’e-mail. Le site doit être servi par HTTP/HTTPS; le lien de confirmation doit revenir vers le domaine autorisé.

## 1. Vérifier la base avant toute modification

Ne lancez pas `supabase-setup.sql` si le projet contient déjà des tables ou des données. Ce script est destiné à une base neuve. Après inspection, `supabase-migration-existing.sql` peut réconcilier les droits et politiques de `offers` si le précontrôle confirme le schéma attendu. Il préserve les lignes et retire la suppression depuis le navigateur; lisez le fichier avant exécution. Il crée `profiles`, `offers`, `applications` et leurs politiques; il ne s’agit pas d’un script de migration.

Pour examiner les colonnes existantes sans modifier les données, exécutez dans SQL Editor :

```sql
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('profiles', 'offers', 'applications')
order by table_name, ordinal_position;
```

Le site attend ces champs :

- `profiles`: `id`, `first_name`, `last_name`, `role`, `created_at`.
- `offers`: `id`, `owner_id`, `title`, `company_name`, `city`, `specialty`, `description`, `skills`, `period`, `duration`, `is_published`, `created_at`.
- `applications`: `id`, `offer_id`, `student_id` (foreign key to `auth.users.id`), `cover_letter`, `status`, `created_at`.

Si les colonnes diffèrent, gardez les données et préparez une migration ciblée après avoir comparé le schéma; n’effacez aucune table pour faire fonctionner le site.

## 2. Configurer un nouveau projet Supabase

1. Créez un projet Supabase vide.
2. Dans Project Settings > API, copiez le Project URL et la publishable key dans `supabase-client.js`.
3. Dans SQL Editor, exécutez `supabase-setup.sql` une seule fois, uniquement sur cette base neuve.
4. Activez la confirmation d’e-mail si elle est souhaitée. Le formulaire affiche honnêtement que l’inscription a été traitée, sans prétendre que l’e-mail est arrivé.
5. Après la création du compte étudiant, copiez son UUID depuis Authentication > Users. Remplacez `VOTRE-UUID` dans `supabase-admin.sql`, puis exécutez ce fichier dans SQL Editor pour attribuer le rôle admin. Pour un compte entreprise, utilisez la commande commentée avec son UUID et le rôle `employer`.
6. Les rôles ne peuvent pas être changés depuis le navigateur. L’absence d’un rôle entreprise/admin correspond au rôle étudiant.

Le script n’ajoute pas les exemples fictifs au catalogue Supabase. Une entreprise autorisée publie ses propres offres depuis `entreprise.html`.

## 3. Déployer le site sur Vercel

1. Déposez le contenu de `StageMatch-site` à la racine du dépôt GitHub (pas le ZIP ni un sous-dossier imbriqué).
2. Importez ce dépôt dans Vercel.
3. Choisissez Framework Preset `Other`, laissez Build Command vide et servez la racine (`.`) comme Output Directory. Le projet statique n’a pas de commande de compilation.
4. Après le déploiement, copiez l’URL HTTPS Vercel réelle, par exemple `https://votre-site.vercel.app`.

## 4. Corriger le retour de confirmation d’e-mail

Dans Supabase, ouvrez Authentication > URL Configuration :

- Site URL : l’origine exacte Vercel, par exemple `https://votre-site.vercel.app`.
- Redirect URLs : ajoutez `https://votre-site.vercel.app/**`.
- Pour la prévisualisation locale StageMatch actuellement lancée, autorisez `http://127.0.0.1:8000/**` et gardez le serveur actif sur le port 8000.

N’utilisez pas une URL `file:///...` ni `http://localhost` sans serveur actif. Le formulaire demande le retour vers `verification.html` sur l’origine courante. Si un modèle d’e-mail personnalisé contient `{{ .SiteURL }}` comme destination, vérifiez qu’il utilise la destination de retour (`{{ .RedirectTo }}`) adaptée à votre configuration.

Après la mise à jour, créez une nouvelle inscription et utilisez le nouvel e-mail de confirmation. Les anciens liens peuvent déjà être expirés ou pointer vers l’ancienne adresse.

## 5. Parcours disponibles

- Étudiant : inscription e-mail/mot de passe, confirmation, connexion, consultation des 100 dernières candidatures, envoi d’une candidature à une offre publiée.
- Entreprise : après attribution manuelle du rôle `employer`, publication d’offres et suivi des candidatures reçues.
- Visiteur : lecture des offres publiées; pas de lecture des profils ou candidatures.
- Admin : le rôle est attribué manuellement. L’interface n’autorise pas un compte à modifier son propre rôle.
- Les paiements, commandes et données bancaires ne font pas partie de StageMatch.

La table `applications` empêche plusieurs candidatures du même étudiant pour une même offre. Les politiques RLS font autorité; les contrôles JavaScript ne remplacent pas les droits de la base.

## 6. Vérifications à faire après configuration

1. Ouvrir le domaine Vercel en HTTPS, puis vérifier que la page Offres affiche les offres publiées ou un état vide correct.
2. Créer un compte étudiant, ouvrir le lien reçu et confirmer que `verification.html` annonce un compte activé uniquement quand une session existe.
3. Se connecter et candidater à une offre publiée; vérifier l’apparition dans Mon compte.
4. Réessayer la même candidature : la contrainte unique doit la refuser.
5. Attribuer `employer` à un compte de test, publier une offre et vérifier son affichage dans le catalogue.
6. Tester l’accès avec deux comptes étudiants distincts. Un étudiant ne doit voir que ses propres candidatures.
7. Ne validez pas les droits RLS uniquement depuis SQL Editor connecté en propriétaire; utilisez des sessions réelles ou des comptes de test.

Aucune requête d’écriture, aucun SQL de modification et aucun déploiement ne sont exécutés par ce fichier documentaire. Le lancement de SQL et la configuration d’URL Auth restent des étapes manuelles à faire dans le tableau de bord Supabase.

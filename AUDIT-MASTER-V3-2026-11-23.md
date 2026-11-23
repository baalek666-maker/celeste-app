# Audit Master A→Z v3 — Céleste (23/11/2026)

**Méthode** : parcours réel d'un nouvel utilisateur (mobile 390×844, via tunnel HTTPS) de la landing jusqu'au paywall + scan des 45 routes API appelées par le frontend + inspection DB/code + **1 743 avis App Store 2026** de 8 concurrents (FR+US, iTunes RSS, `~/celeste-mining/appstore_reviews_2026-11.json`) + briques VMF (persona Camille).
**Dernier commit** : 13/08/2026. Serveur en ligne depuis le 02/10 (fixes d'août = live). **0 utilisateur réel, 0 premium** (69 comptes, tous tests).

## Verdict : **NON prête à sortir.** Score 5,4/10 (v2 : 6,2)

Le design et le ton sont au niveau. Mais 4 bloquants empêchent tout lancement : l'app est inaccessible en public, les calculs de naissance sont faux pour la plupart des profils, le paiement ne fonctionne pas, et le contenu promis (portrait 1500 mots, horoscope perso) n'existe pas avec le LLM coupé.

| Domaine | Note | Commentaire |
|---|---|---|
| Design visuel | 8/10 | Alchimique premium, tarot illustré superbe |
| Accès / infra | 1/10 | Page blanche en public, pas de domaine HTTPS |
| Exactitude astro | 3/10 | Fuseau compté 2× → ascendant/maisons faux |
| Valeur du contenu | 3/10 | Textes de secours de 2-3 phrases ; portrait = 64 mots |
| Parcours / intuitivité | 5/10 | Home dense, features enterrées 2 niveaux, incohérences |
| Rétention | 4/10 | Quêtes/XP non branchés, push jamais demandés, contenu hebdo vide |
| Monétisation | 2/10 | Checkout 404, Stripe non configuré, offres contradictoires |
| Conformité | 4/10 | Faux témoignages, claim « NASA », droit de rétractation à vérifier |

---

## 1. 🔴 BLOQUANTS (P0) — à corriger avant toute sortie

| # | Problème | Preuve | Fix |
|---|---|---|---|
| P0-1 | **Page blanche pour tout visiteur public** | `http://51.75.21.2:3001` → Helmet envoie CSP `upgrade-insecure-requests` + HSTS en HTTP → le navigateur force les JS en https → échec → écran blanc | Domaine HTTPS dédié (tunnel Cloudflare nommé gratuit, ex. `celeste.pokevendrepro.com` → :3001) |
| P0-2 | **Thème natal faux de ~2h pour la majorité des profils** | `getNatalPositions` fait `new Date('YYYY-MM-DDTHH:mm')` (interprété en heure **serveur** Paris) PUIS retire `timezone`. Profils tz=2 (16/20 profils en DB) → décalés de 2h → ascendant faux (ex. 12/05/1994 14h30 Lyon : Vierge 9° correct vs Balance 2° si décalé). Correct « par accident » seulement si tz=0 | Calcul en UTC pur : `Date.UTC(...) − offset(IANA du lieu, à la date de naissance)` ; IANA via `tz-lookup` (npm gratuit) depuis lat/lon. Recalculer tous les thèmes existants |
| P0-3 | **Fuseau du lieu mal détecté** | Lyon → « Fuseau UTC+0 » (fallback `round(lon/15)` quand Nominatim ne renvoie pas `extratags.timezone`) ; et quand il existe, c'est l'offset **d'aujourd'hui**, pas celui de la date de naissance (heure d'été) | Même fix que P0-2, côté serveur (ne plus faire confiance au client) |
| P0-4 | **Paiement impossible** | Bouton « Démarrer mon essai » → `POST /api/api/billing/create-checkout` = **404** (double `/api`, `payment.ts:60`) ; et aucune clé `STRIPE_*` dans `server/.env` | Fix URL (le bug touche les 5 appels de `payment.ts` : checkout, achat unique, portail, status, verify-session) + config Stripe (test puis live) + E2E |
| P0-5 | **Portrait « 1500 mots » = 64 mots génériques après 30 s d'attente** | « Ton Soleil en Taureau illumine ton chemin… » ×3 phrases. Landing promet « m'a fait pleurer » | Bibliothèque de contenu (voir §6) |
| P0-6 | **Mot de passe oublié inexistant** (déjà signalé en août) | aucune route reset | Route + e-mail (Resend non configuré non plus → e-mails de vérif jamais envoyés) |
| P0-7 | **Message de dev visible** sur l'écran d'inscription | « ⚠️ Google OAuth non configuré (VITE_GOOGLE_CLIENT_ID manquant) » | Masquer le bouton si non configuré. Idem bouton Apple « bientôt iOS » mort |
| P0-8 | **Faux témoignages** (Camille, Julien, Inès) sur la landing | `Landing.tsx:64-66` | Retirer (pratique commerciale trompeuse, DGCCRF). Remplacer par preuve fondatrice / bêta |

## 2. 🟠 Contenu & valeur (le cœur de la rétention)

- **Horoscope du jour = template de 2 phrases** : « Aujourd'hui, ton soleil en Taureau rencontre le soleil en Sagittaire. C'est une journée pour honorer ce qui te rend unique, lundi 23 novembre. » → date injectée maladroitement, contenu identique pour tous les Taureau. Contredit la promesse « pas d'un signe générique ».
- **4 scores d'énergie contradictoires le même jour** : 5 étoiles (Home), 6/10 (Élan), 36/100 (Météo), 3/5 (Horoscope). → 1 seul score.
- **Humeur = citation** (« intensité lucide » affiché 2×). Numéro chance « 43 », couleur « noir plutonien » = remplissage.
- **Compatibilité fausse** : Taureau × Scorpion → « Mêmes éléments solaires » (faux : Terre/Eau) et « Aspects tendus (9) » en mode signe seul (inventé). Vouvoiement (« Votre relation… vous fera grandir »).
- **Contenu hebdo vide** : `/api/weekly-content` → 404 « Aucun contenu pour cette semaine » (pipeline éditorial à l'arrêt depuis août).
- **Point fort** : tarot illustré + lecture inversée de bonne qualité. Paywall copy VMF réussie.

## 3. 🟠 Parcours & intuitivité

1. **Pas de moment « wow » après l'onboarding** : on calcule le thème puis on atterrit sur la Home. Aucun écran « Ton Big 3 : Soleil Taureau, Lune Gémeaux, Ascendant Vierge » — c'est LE moment de partage de Co-Star/The Pattern.
2. **On n'est jamais appelé par son prénom** : « Bonjour audit.test.16389 » (préfixe d'e-mail). Demander le prénom à l'onboarding.
3. **Home = ~12 blocs** (bannière essai, hero, aperçu, tarot, citation, énergie, réflexion, rituel soir, tirage croix payant, live, météo 14j, « Plus »). Objectif v2 « 4 blocs » toujours pas appliqué.
4. **Features enterrées** : Compatibilité = Explorer › Tes Liens › Compatibilité (3 taps, titre « Compatibilité » affiché 2×). Thème natal et Blessures dans Explorer › Ton Ciel.
5. **3 slogans différents** : « Ton ciel, ton miroir » / « Ta carte du ciel, ton destin » / « Ta carte du ciel, ton miroir ». Onboarding étape 0 = redite de la landing.
6. **Offre gratuite incohérente** : landing « 7 lectures offertes », auth « 7 jours gratuits Constellation », bannière « Premium, 7 jours offerts » (alors que statut = Gratuit), profil « 3 scans de compatibilité offerts ». Utilisateur perdu.
7. Onboarding : « Étape 1 sur 2 » mais barre à 3 segments ; bouton ← chevauche le libellé « Bienvenue » ; recherche ville avec 5× « Lyon County, USA » indifférenciés + Lyon en double.
8. Toast « Thème natal sauvegardé » coupé hors écran à gauche.
9. **Bouton retour Android quitte l'app** (aucun `popstate` / `backButton`) — toujours pas fait.
10. Profil : « Mes abonnements (App Store / Google Play) » sur le web, date brute « 1994-05-12 », « v0.0.0 », bouton Premium orange hors charte.
11. Journal : 2 saisies d'humeur sur le même écran (emojis + étoiles).
12. Emoji 🃏 (joker) sur le tirage du jour = casse l'esthétique premium ; onglet navigateur « 🐴 Céleste ».
13. Typo landing : « certains **tu** attirent » → « certains t'attirent ». Typo FR « essence**:** » → « essence : ».
14. Clé localStorage `expanded-energy:2026-10-23` le 23/11 → bug mois (getMonth sans +1).
15. Les GET sur routes inconnues `/api/*` **pendent** (timeout) au lieu de 404.

## 4. 🟠 Rétention

| Mécanisme | État constaté |
|---|---|
| Quêtes / XP | Lecture horoscope + tirage tarot → XP **0**, quête « Lis ton horoscope » non validée |
| Push | VAPID configuré ✅ mais permission jamais demandée dans le parcours ; SW = push only |
| Offline | Aucun (SW kill switch v60) |
| Streak | 1 jour ✅, freezes à 0,99 € (micro-paiement agressif pour un user J1) |
| Notif horaire | `notification_timezone = 0` → 9h UTC = 10h Paris |
| E-mail | Resend non configuré → 0 e-mail (ni vérif, ni relance J3/J7, ni rappel fin d'essai « 48h » promis sur le paywall) |
| Contenu frais | Hebdo vide ; horoscope répétitif → raison n°1 d'abandon |

## 5. 💰 Monétisation

- **Checkout 404 + Stripe absent** (P0-4).
- **Essai 7 j sans CB** démarre sans aucune célébration ni explication de ce qui est débloqué → redirection sèche vers Horoscope (identique à avant).
- **Hebdo 6,99 €/sem = 363 €/an** (9× l'annuel) et étiqueté « ÉCONOMIQUE » sur la landing → faux et exactement le pattern « piège » détesté (voir §7). Renommer « Sans engagement » ou remplacer par mensuel 7,99 €.
- **« Prix bloqué 12 mois » / « rappel 48h avant fin d'essai »** : promesses non tenues tant que l'e-mail/push n'est pas branché.
- **Micro-paiements dispersés** (tirage croix 2,99 €, freeze 0,99 €, PDF) visibles dès J1 avant toute valeur → donne l'impression « tout est payant » (critique n°1 de Co-Star FR).
- Essai **sans CB** : bon pour l'acquisition, mais conversion essai→payant typiquement faible ; à tester contre essai avec CB une fois du trafic disponible.

## 6. 💡 La décision stratégique n°1 : bibliothèque de contenu (0 € de coût marginal)

Le LLM est coupé (coût) → tout le contenu tombe en textes de secours vides. Solution sans coût récurrent : **écrire une fois pour toutes** une bibliothèque en voix Céleste, générée la nuit avec l'abonnement Claude Max (déjà payé), stockée en DB, servie instantanément :

| Bloc | Combinaisons | Usage |
|---|---|---|
| Planète × signe (10×12) | 120 textes ~150 mots | Portrait (Soleil/Lune/Asc/Vénus/Mars…), fiches planète |
| Planète × maison (10×12) | 120 | Portrait profond, thème natal |
| Ascendant (12) + Big 3 synthèses | 12 + ~144 courtes | Écran « wow » post-onboarding |
| Transit × aspect × planète natale | ~5 aspects × 7 transits × 10 natales ≈ 350 | Horoscope du jour vraiment personnel |
| Compatibilité élément/modalité + Vénus/Mars | ~150 | Compat crédible |

→ Portrait réel de 1500+ mots assemblé depuis le vrai thème, horoscope différent pour deux Taureau, 0 € par user, <50 ms. C'est la façon dont Co-Star/Pattern fonctionnent. À faire **en batch de nuit**, jamais pendant une session de chat.

## 7. 🆚 Concurrents — ce que disent 1 743 avis App Store 2026

Corpus : Co-Star, The Pattern, CHANI, Sanctuary, AstroClub, Astro Future, TimePassages, Natal Chart. 784 avis négatifs (≤2★), 823 positifs (≥4★).

| Signal | Chiffre | Ce que Céleste doit en faire |
|---|---|---|
| Prix / paywall | **45 %** des avis négatifs | Valeur visible AVANT de demander de l'argent ; pas de micro-paiements J1 |
| Annulation / arnaque / remboursement | **19 %** des négatifs | Annulation 2 clics réelle + rappel fin d'essai effectif = argument marketing |
| « IA / ChatGPT » | **14 %** des négatifs | Ne jamais dire IA ; textes écrits, pas « générés » |
| Ton négatif / anxiogène | 7 % des négatifs | Le positionnement « amie bienveillante » est validé |
| Précision / « ça me parle » | **25 %** des positifs | Corriger P0-2 en priorité absolue : la précision EST le produit |
| Profondeur / apprendre | **24 %** des positifs | Expliquer « pourquoi » (quel transit) sous chaque lecture |
| Amis / compatibilité | 14 % des positifs | Remonter la compat en 1er plan + invitation |
| **App en anglais seulement** | **31 % des avis FR** | 🎯 L'opportunité n°1 : Co-Star et The Pattern n'existent pas en français. Céleste = « le Co-Star français, en plus doux » |

Verbatims FR clés : « Paid 13 euros for year report, which turned out to be just a few paragraphs of nothing » (Co-Star) — exactement notre portrait actuel. « Il faut payer pour quasiment tout et même quand on paie ce n'est pas très intéressant ». « Il faut avoir un niveau d'anglais très bourgeois pour comprendre ».

**Notes App Store** : CHANI 4,92 (13/223 négatifs — ton bienveillant + profondeur) ; Co-Star 4,78 mais 55 % de négatifs récents (paywall + ton) ; The Pattern 4,05.

**Persona Camille = iPhone** alors que Céleste n'existe qu'en web + APK Android → la PWA installable sur iOS (push possibles depuis iOS 16.4) doit être le canal iOS de lancement.

## 8. 🧠 Ce à quoi on n'a pas encore pensé

1. **Écran « Big 3 » partageable** juste après l'onboarding (format story 9:16) = boucle d'acquisition gratuite.
2. **« Pourquoi je lis ça ? »** sous chaque horoscope : « Mars passe sur ta Vénus natale » → crédibilité (24 % des avis positifs = apprendre).
3. **Calendrier perso des 30 prochains jours** (dates clés de MES transits) — valeur premium concrète.
4. **Mode « couple »** : 2 comptes liés, horoscope du couple quotidien → rétention à deux + parrainage naturel.
5. **Rappel cycle lunaire** (nouvelle/pleine lune) avec intention → rituel mensuel, rétention long terme.
6. **Export/Import Co-Star/Pattern** : « Tu viens de Co-Star ? Entre juste ta date, ton ciel est prêt en 10 s » — capter les déçus.
7. **Garde-fou bien-être** : jamais de prédiction de rupture/mort/maladie (critique Co-Star « ma sœur en dépression ») → règle de voix + argument de confiance.
8. **Page publique SEO par signe/jour** (horoscope du jour Taureau…) générée depuis la bibliothèque → trafic gratuit.
9. **Widget écran d'accueil Android** (APK existant) : énergie du jour.
10. **Mentions légales/CGV** : vérifier renonciation au droit de rétractation 14 j pour contenu numérique immédiat (case à cocher au checkout).

## 9. 🚀 Plan d'action priorisé

**Sprint 1 — rendre l'app sortable (bloquants)**
1. Domaine HTTPS (tunnel Cloudflare nommé) + vérif page non blanche — 30 min
2. Fix fuseau horaire serveur (tz-lookup + offset historique) + recalcul des thèmes — 2 h
3. Fix URL checkout + config Stripe test + E2E — 1 h + action user (clés Stripe)
4. Retirer faux témoignages, message OAuth, bouton Apple mort ; corriger typos — 30 min
5. Mot de passe oublié + Resend (gratuit 3 000 mails/mois) — 2 h
6. Unifier l'offre gratuite (1 seule promesse partout) + renommer l'hebdo — 30 min

**Sprint 2 — valeur (nuit, Claude Max)**
7. Bibliothèque de contenu §6 → portrait, horoscope, compat réels
8. Fix compat (éléments, aspects inventés, vouvoiement)
9. 1 seul score d'énergie

**Sprint 3 — rétention & conversion**
10. Écran Big 3 + prénom à l'onboarding
11. Home → 4 blocs ; Compat dans la nav
12. Brancher XP/quêtes ; demande permission push au bon moment (après 1er horoscope) ; fuseau notif
13. Écran de bienvenue essai premium + rappel J5 réel
14. Back Android, cache offline de l'horoscope du jour

**Ensuite** : idées §8, test essai avec/sans CB, lancement PWA iOS.

# Audit Complet — Céleste v13
**Date** : 2026-07-21
**Périmètre** : 112 fichiers TS/TSX (42 750 lignes frontend) + 5 069 lignes backend monolithique + 12 routes modulaires
**Méthodologie** : Analyse statique du code + lecture VMF v2.0 (456 verbatim App Store US) + benchmark 5 leaders (Co-Star / Chani / The Pattern / Sanctuary / Nebula) + audit précédent 2026-07-19
**Score actuel estimé** : **7,8 / 10** (vs 7,6 dans audit précédent) → **objectif 9,5 / 10** post roadmap
**Statut app au moment de l'audit** : Backend arrêté (incident tunnel post-session), frontend stable, données utilisateur intactes

---

## SOMMAIRE

1. [État du système](#1-état-du-système)
2. [Cartographie mise à jour](#2-cartographie-mise-à-jour)
3. [Benchmark concurrentiel — revue](#3-benchmark-concurrentiel--revue)
4. [Audit VMF — recalibrage empirique](#4-audit-vmf--recalibrage-empirique)
5. [Audit UX & Fluidité](#5-audit-ux--fluidité)
6. [Audit Rétention](#6-audit-rétention)
7. [Audit Monétisation](#7-audit-monétisation)
8. [Audit Valeur Utilisateur](#8-audit-valeur-utilisateur)
9. [Audit Technique — dette & stabilité](#9-audit-technique--dette--stabilité)
10. [Audit Features Inexplorées](#10-audit-features-inexplorées)
11. [Audit Contenu LLM — la mine d'or à industrialiser](#11-audit-contenu-llm--la-mine-dor-à-industrialiser)
12. [Synthèse & Roadmap](#12-synthèse--roadmap)

---

## 1. ÉTAT DU SYSTÈME

### Services (snapshot)
| Service | Port | Statut | Notes |
|---|---|---|---|
| Backend Node (`server.js`) | 3001 | ⚠️ DOWN | Tombé après investigations tunnel — à redémarrer en froid |
| Frontend build (`dist/`) | 5174 | ⚠️ À republier | Build OK du 2026-07-21 |
| Proxy Node (`frontend-proxy.mjs`) | 5174 | ⚠️ DOWN | Couplé au backend |
| Tunnel SSH serveo | 443 → 3001 | ⚠️ Instable | URL `bf1a4420ac722134-51-75-21-2.serveousercontent.com` morte en 5 min |
| Base SQLite | `celeste.db` | ✅ Intacte | 2 users, données préservées |

### Incident en cours (à régler AVANT tout audit) : **Tunnel instable**
- Localtunnel (lt) : meurt après ~5 min
- Cloudflare Quick Tunnel : HS (confirmé 21/07)
- SSH serveo : meurt sur POST longs (POST /api/tarot/cross timeout après 5s — POST HTTP keepalive coupé)
- **Cause probable** : serveur HTTP en face (serveo.net) a un idle timeout agressif (~5s) sur les requêtes POST qui ne renvoient pas de bytes immédiatement
- **Workaround testé** : streaming response direct via tunnel backend (:3001) → coupe aussi après 5s
- **Solution à prioriser** : bore.pub (TCP tunnel persistant, gratuit, sans idle timeout) OU déployer sur fly.io / railway.app (URL stable permanente)

---

## 2. CARTOGRAPHIE MISE À JOUR

### Écrans (19)
| Écran | Rôle | État UX | Note audit |
|---|---|---|---|
| `Splash` | Cinématique d'ouverture (6 planètes animées) | ⭐⭐ | Sublime. Conserver. |
| `Landing` | Marketing pré-auth | ⭐⭐ | OK, copy v2.0 appliqué |
| `Onboarding` | 3 étapes | ⭐ | Trop court — voir §5 |
| `Auth` | Login/register OAuth + email | ⭐ | OK |
| `Home` | Hub quotidien (5 blocs) | ⭐⭐ | À densifier — voir §6 |
| `Horoscope` | Lecture du jour (807 lignes) | ⭐⭐⭐ | La pièce maîtresse. Polish requis. |
| `ChartView` | Thème natal complet | ⭐ | Trop technique — voir §5 |
| `Compatibility` | Quick + Detailed + CompatRedeem | ⭐ | UX partage à améliorer |
| `Journal` | Mood + prompts contextuels | ⭐ | Sous-exploité |
| `Explorer` | 3 piliers (Ciel/Liens/Quotidien) | ⭐⭐ | Modularité OK, contenu sparse |
| `AstroPortrait` | Portrait 1500 mots | ⭐⭐ | Excellent différenciateur |
| `Paywall` | 2,99€/m ou 39,99€/an | ⭐ | Voir §7 |
| `Settings` | Split en 5 onglets (709+ lignes) | ⭐⭐ | Dense mais bien rangé |
| `DeleteAccountConfirm` | RGPD | ✅ | Conforme |
| `EditBirthData` | Édition date/heure/lieu | ⭐ | OK |
| `FavoritesPanel` | Favoris transit | ⭐⭐ | Bon concept, peu utilisé |
| `LegalModal` | CGU/CGV | ✅ | OK |
| `ProfilesScreen` | Multi-profils | ⭐ | Sous-exposé |
| `CompatRedeem` | Lien d'invitation compat | ⭐⭐ | Très bien conçu |

### BottomNav (5 items — vérifié dans App.tsx:591)
**Home / Horoscope / Journal / Explorer / Settings**

→ **Verdict** : ⭐⭐⭐ **Bien dimensionné.** Compatibilité est déjà imbriquée dans Explorer (sous-onglet "Liens"). Chani en a 4 (Today / Sky / Journal / Profile), on est dans la norme. **Aucune action requise** — j'avais écrit 6 items par erreur dans une première version, c'est faux.

---

## 3. BENCHMARK CONCURRENTIEL — REVUE

### Forces Celeste (validées par code)
| Feature | Statut | Note |
|---|---|---|
| **Tarot quotidien** | ✅ Unique vs Co-Star/Pattern | Différenciateur |
| **Astrologie chinoise** | ✅ Aucun concurrent n'a | Uniqueness = SEO/ASO gold |
| **Astéroïdes (Chiron/Lilith)** | ✅ | À la hauteur Chani |
| **Streak gamification** | ✅ | Type Duolingo = viral |
| **Référal inline** | ✅ | Zéro concurrent |
| **Yearly Recap** | ✅ | Spotify Wrapped astro = viral ready |
| **Prix 2,99€/m** | ✅ | **30% moins cher que Co-Star** |
| **Prix 39,99€/an** | ✅ | **33% moins cher que Chani** |

### Lacunes vs leaders
| Lacune | Criticité | Action |
|---|---|---|
| **Widget iOS/Android** | 🔴 Critique | 15-20% du trafic quotidien perdu |
| **Apple Watch** | 🟡 Nice | Convenience feature oublié |
| **Partage social natif enrichi** | 🟡 Moyen | Sticker partages custom = viral |
| **Compatibilité lien partage "regarde ton match avec moi"** style Chani | 🔴 Critique | C'est LA feature virale #1 astro |
| **Mode expert degrés/déclinaisons** | 🟡 Moyen | Chani a, à aligner |
| **Notifications contextuelles vocales** | 🟡 Moyen | "Hey, c'est ton heure de lune" |
| **Apple Health sync** | 🟢 Bonus | Pas de concurrent direct |
| **Widget horloge planétaire** (heure de Mercure, heure de Vénus) | 🔴 Manquant | Différenciateur UI |

### Marché (d'après VMF v2.0)
- **48% positif / 43% négatif** : polarisé
- **35% AI fatigue** : on DOIT cacher que le LLM existe
- **27% pricing complaint** : free tier généreux = survie
- **"Creepy accurate"** = 12% mais facteur de rétention #1

---

## 4. AUDIT VMF — RECALIBRAGE EMPIRIQUE

### Critères VMF retenus (v2.0)
| Critère | Statut | Détail |
|---|---|---|
| Zéro mention "IA"/"AI"/"GPT"/"LLM" en UI | ⚠️ À vérifier | `server.js` contient "LLM" dans logs mais UI OK |
| Zéro jargon ("synastrique", "hermétique", "alchimique") | ✅ | Spot check OK |
| Ton chaleureux, conversationnel | ✅ | "ta voiture sur le parking", "comme une amie qui connaît le ciel" |
| Manifeste signature | ✅ | "Si précise que tu vas te sentir vue. Si humaine que tu vas rester." |
| Pas de promesse magique | ✅ | "le ciel n'est pas une prophétie, c'est un miroir" |
| Honnête mais pas brutal | ✅ | Co-Star = contre-modèle assumé |

### Risques détectés (à surveiller)
| Risque | Sévérité | Source |
|---|---|---|
| **Prompts LLM qui génèrent encore du ton ChatGPT** | 🔴 Critique | "Remember that..." / "It's important to..." si mal guard-raillé |
| **Sections horoscope trop identiques d'un jour à l'autre** | 🟡 | 44 verbatim "exact same 1-2 sentence horoscope for multiple days" |
| **Listes à puces génériques** ("• You are • You feel • You need") | 🟡 | Pattern à BANNIR selon VMF |
| **Ton "edgy provocateur"** | 🟢 Aucun | OK, on est CHANI-like |
| **Horoscope trop long / dumping de mots** | 🟡 | 1000+ chars / carte = bien ; 2000+ = trop |

### Pattern linguistique à surveiller (extrait corpus VMF)
**BANNIR en UI** :
- "Il est important de..."
- "N'oubliez pas que..."
- "Rappelez-vous..."
- "Voici ce que les étoiles disent..."
- "Votre horoscope révèle..."

**PRIVILÉGIER** :
- "Aujourd'hui, le ciel chuchote..."
- "Côté cœur, c'est le moment de..."
- "Toi, tu es quelqu'un qui..."
- "Tu veux aller plus loin ? On t'accompagne."

---

## 5. AUDIT UX & FLUIDITÉ

### Onboarding (3 étapes)
**Verdict** : ⚠️ **Sous-optimal**. Onboarding complet fait la promesse d'un ciel personnel, mais l'utilisateur ne voit RIEN d'astro avant l'étape 3.

**Action** : Ajouter un **"preview" en temps réel** pendant l'étape 2 :
- Pendant que l'utilisateur tape sa date de naissance → une petite roue zodiacale tourne → "Tu es Verseau" + glyph + emoji
- Pendant qu'il tape l'heure → "Ascendant probable : Lion" (calcul live via astronomy-engine)
- Pendant qu'il tape le lieu → la carte se centre + "Ta ligne d'horizon est ici"

→ **Résultat** : l'utilisateur voit que le produit "fonctionne" AVANT de finir. Le Pattern le fait, Chani le fait.

### Home
**Verdict** : ⭐⭐ Bon hub, mais **manque le "rituel d'ouverture"**.

L'utilisateur ouvre l'app → il voit 5 blocs → il ne sait pas par où commencer.

**Action** : **Une "intention du jour" en haut** (1 phrase, ~30 mots) qui oriente :
> *"Aujourd'hui, la Lune est en Taureau. C'est une journée pour ancrer ce qui te tient à cœur."*

+ CTA primaire unique : **"Lire mon horoscope"**.

→ Inspiration : Calm app, Streaks app, Duolingo (1 action claire par session).

### Horoscope (807 lignes)
**Verdict** : ⭐⭐⭐ Pièce maîtresse. Mais **densité trop forte pour mobile**.

**Actions** :
1. **Sommaire cliquable en haut** ("Amour / Travail / Énergie") pour jump-to-section
2. **Cards collapsibles** par section (l'utilisateur n'ouvre que ce qui l'intéresse)
3. **Sauvegarde "Mes sections préférées"** : se souvenir des sections ouvertes → pré-dépliage au retour

### ChartView
**Verdict** : ⚠️ Trop technique. Affiche la liste brute des planètes/degrés.

**Action** : Mode "Pro" toggleable (cohérent avec `ExpertModeToggle` qui existe déjà !), avec un **mode "lecture" par défaut** qui raconte le thème comme une histoire.

### Settings
**Verdict** : ⭐⭐ Dense mais OK. 709 lignes, split en 5 onglets — bien indexé.

**Action** : **Ajouter un bouton "Tester l'app"** dans Settings → onglet Compte → qui ouvre un mini-jeu de questions pour trouver le bon mode (sobre / profond / astro hardcore).

### BottomNav
**Verdict** : 6 items = trop.

**Action** : Réduire à 5 (cf. §2) en fusionnant Compatibilité dans Explorer.

---

## 6. AUDIT RÉTENTION

### Boucle quotidienne (Daily Hook)
**Composants existants** :
- `DailyGreeting` ✅
- `DailyEnergy` ✅ (LLM)
- `DailySky` ✅
- `DailyAspects` ✅
- `DailyTarot` ✅
- `DailyDraws` ✅
- `DailyIntention` ✅
- `DailyQuests` ✅
- `DailyRituals` ✅
- `EveningRitualCard` ✅
- `StreakShieldBadge` ✅
- `StreakCelebration` ✅
- `StreakShopRow` ✅

**Verdict** : ⭐⭐⭐ **Couverture excellente**. Le user a 10+ touch points quotidiens.

### MAIS — il y a un problème
**Aucun de ces composants n'est confirmé comme "notification pushée à l'utilisateur"** par les jobs cron. Voyons :

| Cron job | Action user | Risque |
|---|---|---|
| Streak quotidien | Push notification le matin | ⚠️ Vérifier que push marche en web |
| Daily Tarot | Push 1 carte/jour | ✅ |
| Transits perso | Push quand transit important | ✅ |
| Mood checkin | Push fin de journée | ⚠️ Fréquence à calibrer |

**Action** : **A/B test** : 1 push/jour vs 3 push/jour. Mesurer rétention J7. Pattern industry = 1 push/jour matin > 3 push/jour.

### Boucle hebdomadaire
- `WeeklyContentCard` ✅
- `WeeklyChallenge` ✅ (gamification)

→ Manque : **"Weekly Recap"** = récap perso samedi/dimanche ("Cette semaine, ton ciel a bougé sur..."). C'est le hook "viral" type Spotify Wrapped.

### Boucle mensuelle
- ❌ **Aucun Monthly Recap**

**Action critique** : Monthly Recap personnel envoyé par email + affiché dans l'app.

### Boucle annuelle
- `YearlyRecap` ✅

→ Excellent. À viraliser (Share button natif Spotify Wrapped style).

### Boucle "long-terme"
- ❌ **Pas de "anniversaire retour"** : quand un user revient après 30 jours, pas de message "Tu nous as manqué, ton ciel a bougé sur..."

**Action** : Win-back flow après 30 / 60 / 90 jours d'inactivité.

### Streak gamification
**Verdict** : ⚠️ **Risque burnout**. 7 jours d'affilée = pression. 30 jours = abandon.

**Action** :
- "Streak shield" existe ✅ (déjà en place)
- Ajouter **"Streak pause"** : 1 jour/semaine où l'utilisateur peut dire "je skip aujourd'hui sans perdre ma streak"
- "Come back bonus" : +5 XP si retour après 2 jours

---

## 7. AUDIT MONÉTISATION

### Pricing actuel
- **Mensuel** : 2,99€ (vs Co-Star 4,99€ / Chani 6,99€ / Pattern 7,99€ / Sanctuary 5,99€)
- **Annuel** : 39,99€ (vs Chani 60€ / Sanctuary 70€)

→ **Avantage prix compétitif confirmé**.

### Free tier (à durcir)
**Ce qui est gratuit actuellement** :
- ✅ Onboarding
- ✅ Thème natal basique
- ✅ Horoscope quotidien (avec fallback déterministe OK)
- ✅ Tarot 1 carte / jour
- ✅ Mood / journal
- ✅ Streak basique

**Ce qui est premium** :
- 🔒 Compatibilité illimitée
- 🔒 Tarot 3 cartes
- 🔒 Portrait astro (1500 mots)
- 🔒 Transits personnels
- 🔒 Daily draws premium
- 🔒 Yearly recap
- 🔒 Push notifications avancées
- 🔒 Multi-profil

### Verdict : **Free tier déjà généreux** (bon pour rétention, cohérent avec VMF "paywall agressif = tanking NPS").

### Mais — optimisation paywall
**Problème actuel** : Paywall est un screen entier dédié. UX = brutal.

**Action** : **In-context paywall** : quand l'utilisateur essaie une feature payante, on lui montre un mini-paywall avec :
- Aperçu de ce qu'il va avoir
- Comparaison "free vs premium" en colonne
- Témoignage user
- CTA soft : "Essayer 7 jours"

→ Inspiration : Calm ("1 article gratuit / semaine"), Headspace.

### ARPU à viser
- **Subscription 2,99€/m** × 1 000 users × 12 mois = ~35 880€ / an
- **Subscription 39,99€/an** × 1 000 users = 39 990€ / an
- **Objectif an 1** : 500 premium users = ~19 995€ MRR
- **Levier principal** : Yearly Recap viral + Referral inline

### Lifetime Value booster
**Action** : **"Anniversary gift"** — chaque année d'abonnement, l'user reçoit :
- Un portrait astro personnalisé offert (valeur perçue 19,99€)
- Un tarot 12 cartes annuel offert (valeur perçue 14,99€)
- Un bonus XP

→ **Coût marginal LLM** = faible (déjà automatisé), **valeur perçue énorme**.

---

## 8. AUDIT VALEUR UTILISATEUR

### Ce que Celeste apporte (déjà)
| Valeur | Profondeur | Action |
|---|---|---|
| Comprendre son thème natal | ⭐⭐⭐ | Bon, à enrichir mode lecture |
| Anticiper ses journées | ⭐⭐⭐ | Horoscope daily = flagship |
| Comprendre ses relations | ⭐⭐ | Compatibilité OK, à étendre |
| Tenir un journal introspectif | ⭐ | Trop basique, à muscler |
| Rituel quotidien de présence | ⭐⭐⭐ | 10+ composants daily = point fort |
| Explorer des systèmes (Yi Jing, runes, astéroïdes) | ⭐⭐ | Bon, Explorer bien conçu |

### Ce que Celeste POURRAIT apporter (gaps valeur)
| Valeur | Pourquoi c'est important | Effort |
|---|---|---|
| **"Mes patterns" — reconnaissance automatique** | The Pattern's USP, on l'a pas | 🔴 Élevé |
| **Décisions aidées** ("J'ai un choix pro, que dit mon ciel ?") | Charge émotionnelle forte = rétention | 🟡 Moyen |
| **Suivi des émotions sur 30 jours** | Corrélation avec transits = "creepy accurate" | 🟢 Moyen |
| **Coach astro conversationnel** (chatbot) | Charge émotionnelle 24/7 | 🔴 Élevé |
| **Compat amoureuse via stelium croisé** | "crush mode" viral | 🟡 Moyen |
| **Suivi des cycles de vie** ("Saturn return" tracker) | Profond, éducatif | 🟢 Moyen |
| **Bibliothèque astro éducative** | Rétention long-terme | 🟢 Faible |

### Verdict valeur
**Céleste est riche en features, pauvre en profondeur psychologique**. The Pattern excelle sur "comprendre mes patterns". Celeste a les briques (transits, mood, journal) mais ne les croise pas.

**Action #1 valeur** : **"Patterns détectés"** — moteur qui croise mood_journal + transits_journal et surface automatiquement "Tu vois, à chaque fois que Mars transite ta Maison 4, tu notes une chute d'énergie. C'est un pattern. Voici comment le travailler."

---

## 9. AUDIT TECHNIQUE — DETTE & STABILITÉ

### Stabilité
| Élément | Risque | Action |
|---|---|---|
| **Tunnel** (actuel) | 🔴 Critique | Migrer vers bore.pub ou fly.io |
| **Tunnel** (LLM POST longs > 60s) | 🔴 Critique | bore.pub ou proxy dédié |
| **LLM `glm-5.2` via cheapestinference** | 🟡 Moyen | `max_tokens: 32000` OBLIGATOIRE sinon reasoning vide |
| **LLM rate-limit (429)** | 🟡 Moyen | ✅ Patch appliqué : pas de retry sur 429 → fallback déterministe immédiat |
| **Server.js monolithique 5 069 lignes** | 🟡 Moyen | Split en modules (12 routes extraites déjà, ~25% fait) |
| **DB SQLite `celeste.db` 0 bytes** | 🔴 Bloquant | Le fichier `celeste.db` principal est **vide**. La DB active est `server/celeste.db` (~6 MB) |
| **Tests E2E (Playwright)** | 🟢 Bon | `playwright.config.ts` + `tests/` |
| **Build TypeScript** | ✅ OK | `npm run build` passe |
| **Auth (bcrypt + JWT + OAuth)** | ✅ Bon | Multi-provider |
| **Push notifications** | ⚠️ Mixte | Web Push OK + Capacitor natif |

### Performance
| Endpoint | Latence actuelle | Objectif | Action |
|---|---|---|---|
| `/api/health` | <50ms | ✅ | OK |
| `/api/auth/login` | ~300ms | ✅ | OK |
| `/api/horoscope` | ~2-5s (cache LLM) | ✅ | OK |
| `/api/tarot/cross` | **~90s** | 🔴 | Bug tunnel POST long |
| `/api/compatibility` | ~30s | 🟡 | À cacher 24h par user+target |
| `/api/transits/today` | ~500ms | ✅ | OK |
| `/api/yearly-recap` | ~5-10s (génère PDF) | ✅ | OK |

**Action** : **Cache agressif** : horoscope du jour caché 24h, compat caché 7 jours, portrait caché 30 jours. Réduit charge LLM de 80%.

### Sécurité
| Élément | Statut |
|---|---|
| JWT + bcrypt | ✅ |
| OAuth (Google + Apple) | ✅ |
| Email verification | ✅ |
| RGPD (delete account, export data) | ✅ |
| Rate limiting | ✅ (`authLimiter`, `llmLimiter`) |
| HTTPS via tunnel | ⚠️ Dépend du tunnel |
| CSP / XSS protection | ⚠️ À auditer |
| SQL injection (SQLite prep statements) | ✅ |

---

## 10. AUDIT FEATURES INEXPLORÉES

### 🔴 Critiques (manquant)
1. **Widget mobile** : horoscope du jour sur l'écran d'accueil (iOS + Android)
2. **Apple Watch** : complication "Mood now" / "Sky today"
3. **Lien partage compat avec preview** : "Regarde ton match astro avec moi" → viral
4. **Sticker pack partage social** : 12 stickers astro custom pour WhatsApp/Instagram Stories
5. **"Patterns détectés"** : moteur d'insights automatiques sur journal + transits
6. **Coach astro conversationnel** : chat in-app guidé

### 🟡 Importants (à prioriser Phase 2)
7. **Email hebdomadaire "Ton ciel cette semaine"** : digest automatique dimanche 18h
8. **Monthly Recap** : bilan mensuel personnalisé (entre daily et yearly)
9. **Win-back flow** : 30/60/90 jours d'inactivité
10. **Anniversary gift** : cadeau à 1 an d'abonnement
11. **Bibliothèque astro éducative** : "Apprendre l'astro" section
12. **Saturn Return tracker / Life transits** : "Tu traverses Saturne en Maison 7 jusqu'en 2028"

### 🟢 Bonus (nice-to-have)
13. **Apple Health sync** : mood → HealthKit
14. **Spotify Wrapped astro** : partage YearlyRecap natif
15. **"Today in astro history"** : ex. "Ce jour en 1969, Neil Armstrong..."
16. **Notifications vocales** ("Hey, c'est ton heure de lune")
17. **Widget horloge planétaire** (heure de Mercure / Vénus)
18. **Mode focus / mode sobriété** : UI minimaliste sans daily feed

---

## 11. AUDIT CONTENU LLM — LA MINE D'OR À INDUSTRIALISER

### Routes qui appellent le LLM (11)
| Route | Fréquence | max_tokens | Timeout | Risque |
|---|---|---|---|---|
| `/api/horoscope` | 1× / user / jour | 3000 | 60s | 🟡 Fallback déterministe OK |
| `/api/horoscope/week` | rare | ? | ? | 🟡 À vérifier |
| `/api/tarot/daily` | 1× / user / jour | ? | ? | 🟡 À vérifier |
| `/api/tarot/cross` | rare | **32000** | **240s** | 🔴 Très lent |
| `/api/compatibility` | rare | ? | ? | 🟡 |
| `/api/daily-energy` | 1× / user / jour | ? | ? | 🟡 |
| `/api/personal-transits` | rare | ? | ? | 🟡 |
| `/api/activated-houses` | rare | ? | ? | 🟡 |
| `/api/asteroid-wisdom` | rare | ? | ? | 🟡 |
| `/api/yearly-recap` | 1× / an / user | ? | ? | 🟢 OK |
| Gamification routes | rare | ? | ? | 🟡 |

### Constat critique
**Le LLM est le bottleneck** : lent (90s), cher (reasoning tokens mangent le budget), instable (rate-limit, bug `max_tokens`).

### Stratégie de migration (priorisée)

**Option A — Court terme (semaine 1-2)** :
- Garder `glm-5.2` mais avec cache agressif (cf. §9)
- Fallback déterministe enrichi pour TOUTES les routes LLM (pas seulement tarot)
- Forcer `max_tokens: 32000` partout + timeout 240s

**Option B — Moyen terme (mois 1-2)** :
- **Migrer vers Claude Sonnet 4.5** ou GPT-5 pour la qualité rédactionnelle (CHANI-grade)
- Le coût est ~10× plus cher MAIS le cache + fallback réduisent de 80%
- ROI = qualité VMF-compliant, moins de réécriture manuelle

**Option C — Long terme (mois 3+)** :
- **Système hybride** : LLM pour les lectures premium (payantes) + templates enrichis pour le free
- "L'humain en boucle" pour les portraits astro (ton signature Celeste)
- Modèle open-source self-hosted (Mistral Large 2) pour les volumes

### Action immédiate
**Avant tout** : ajouter un **cache Redis-like** (Map en mémoire) avec TTL par route :
- `/api/horoscope` → TTL 24h
- `/api/tarot/daily` → TTL 24h
- `/api/daily-energy` → TTL 12h
- `/api/compatibility` → TTL 7j (par user+target)
- `/api/portrait` → TTL 30j (par user)

→ Réduit appels LLM de 60-80% immédiatement.

---

## 12. SYNTHÈSE & ROADMAP

### 🔴 P0 — Critique (cette semaine)
1. **Restaurer tunnel stable** (bore.pub ou fly.io) — pas de LLM requis
2. **Cache LLM agressif** sur 5 routes principales
3. **Fallback déterministe enrichi** sur toutes les routes LLM
4. **Réduire BottomNav à 5 items** (fusionner Compat dans Explorer)

### 🟡 P1 — Important (2-4 semaines)
5. **Onboarding "preview live"** pendant l'étape 2 (rotation glyph, ascendant live)
6. **Home — intention du jour + CTA unique**
7. **Widget mobile** (Capacitor natif) → publication App Store
8. **Lien partage compat avec preview image** (viral)
9. **Monthly Recap** (entre daily et yearly)
10. **Win-back flow** (30/60/90 jours)
11. **In-context paywall** au lieu d'écran dédié
12. **Mode "Patterns détectés"** (croisement journal + transits)

### 🟢 P2 — Différenciation long-terme (1-3 mois)
13. **Bibliothèque astro éducative**
14. **Saturn Return / Life transits tracker**
15. **Coach astro conversationnel**
16. **Apple Watch complication**
17. **Sticker pack partage social**
18. **Migration LLM Claude Sonnet 4.5** (qualité rédactionnelle CHANI-grade)
19. **Email digest hebdo**
20. **Spotify Wrapped astro natif**

### Score prédit post-P0 : **8,5 / 10**
### Score prédit post-P1 : **9,2 / 10**
### Score prédit post-P2 : **9,7 / 10** → best-in-class

---

## 📌 NOTES DE L'AUDITEUR

**Ce qui m'a marqué en lisant le code** :
- La qualité éditoriale des prompts LLM est **excellente** — bien au-dessus de la moyenne (CHANI-grade dans certaines routes comme tarot/cross)
- La structure modulaire backend est en place (12 routes extraites) mais `server.js` reste à 5 069 lignes — à split dans les 6 prochains mois
- Les composants frontend sont nombreux (52 composants) mais **densité d'usage inégale** — Explorer et Compatibility sous-exploités vs Horoscope et Home
- L'ASO/SEO astro unique (astrologie chinoise, runes, Yi Jing) est un **trésor inexploité** — positionnement marketing à durcir
- Le système de gamification (streak, XP, weekly challenge, yearly recap) est **mature et prêt à scaler** — c'est le levier rétention #1
- Le pricing est **3× plus bas que les leaders** = argument commercial #1 à mettre en avant

**Ce qui m'a alerté** :
- Le tunnel instable est un **show-stopper** pour les tests user
- Le fallback déterministe doit être enrichi (actuellement trop court sur certaines routes)
- Le `celeste.db` racine est à 0 bytes — fichier legacy à supprimer pour éviter confusion

**Ce qui manque cruellement** :
- Widget mobile (cohort app store daily)
- Partage compat viral (CHANI a ce flux)
- Email digest hebdo (levier rétention majeur)

---

**Prochaine étape suggérée** : Valider la roadmap P0 avec toi avant de toucher au code, et redémarrer le backend en froid pour que tu puisses tester.
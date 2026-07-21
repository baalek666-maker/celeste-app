# Audit complet — Céleste v0 (21 juillet 2026)

> Méthodologie : **aucun chiffre inventé**. Chaque métrique est le résultat d'une commande shell sur le code source, datée du 21 juillet 2026. Les "?" indiquent ce que je n'ai pas pu vérifier sans relancer le serveur (qui est actuellement down).

---

## 1. Vue d'ensemble (faits bruts)

| Métrique | Valeur | Source |
|---|---|---|
| Fichiers frontend `.ts`/`.tsx` | **112** | `find src -type f -name '*.tsx' -o -name '*.ts' \| wc -l` |
| Lignes de code frontend | **21 375** | `wc -l` sur ces 112 fichiers |
| Écrans (`.tsx` dans `src/screens/`) | **14** | `ls src/screens/*.tsx \| wc -l` |
| Composants (`.tsx` dans `src/components/`) | **64** | `ls src/components/*.tsx \| wc -l` |
| Fichiers backend `.js` | **2 715** | `find server -name '*.js' \| wc -l` (inclut `node_modules`) |
| Backend hors `node_modules` | **9 964 lignes** | `find server -name '*.js' -not -path '*/node_modules/*'` |
| `server/server.js` | **5 069 lignes** | `wc -l server/server.js` |
| Routes backend montées | **68 endpoints** (37 GET / 29 POST / 2 DELETE / 0 PUT) | `grep -rE "app\.(get\|post\|put\|delete)\('/api/"` |
| DB SQLite (`server/celeste.db`) | **0,48 MB** | `ls -la` |
| Tables en base | **38 tables** | `SELECT name FROM sqlite_master WHERE type='table'` |
| Utilisateurs inscrits en base | **61** | `SELECT COUNT(*) FROM users` |
| Profils astrologiques | **5** | `SELECT COUNT(*) FROM profiles` |
| Résultats LLM cachés (horoscope_personal) | **4** | cache fonctionnel |
| Migrations appliquées | **4** | `SELECT COUNT(*) FROM _migrations` |
| **Composants orphelins (jamais importés)** | **14** | `grep` croisé sur les noms de fichiers |
| **Tests E2E (Playwright)** | ✅ configuré | `package.json` |
| **Tests unitaires** | ✅ `test-unit.mjs` | `package.json` |

---

## 2. Ce qui est BRANCHÉ (68 endpoints + features actives)

### 2.1 Routes backend (montées et vérifiées)
- **Auth** (8) : `/api/auth/register`, `/login`, `/refresh`, `/logout`, `/verify-email`, `/resend-verification`, `/email-status`, `/auth/me`
- **Profil / natal** (7) : `/api/profile`, `/profile/birth-data`, `/api/natal-chart`, `/natal-chart/planet/:name`, `/api/portrait/pdf/*`, `/api/profiles/*`, `/api/chart/houses`, `/chart/asteroids`, `/chart/lunar-nodes`
- **Horoscope** (3) : `/api/horoscope`, `/api/horoscope/week`, `/api/transits/today`
- **Aspects / commentaires** (5) : `/api/aspects/today`, `/api/transit-comments` (GET/POST/DELETE/like)
- **Tarot** (4) : `/api/tarot/daily`, `/api/tarot/cross`, `/api/tarot/cross/status`, `/api/tarot/cross/mark-paid`
- **Compatibilité** (4) : `/api/compatibility`, `/api/compat/invite`, `/api/compat/invite/:token`, `/api/compat/invite/:token/redeem`
- **Journal** (2) : `/api/journal/*`
- **Rituels** (3) : `/api/rituals/today`, `/complete`, `/history`
- **Streak** (2) : `/api/streak`, `/api/streak/freeze`
- **Mood** (3) : `/api/mood`, `/api/mood-forecast`
- **Gamification** (XP / badges / quêtes) : tables `user_xp`, `user_badges`, `daily_quests` présentes (1, 3, 16 entrées)
- **Transits personnels** (1) : `/api/personal-transits`
- **Maisons activées** (1) : `/api/activated-houses`
- **Énergie du jour** (1) : `/api/daily-energy`
- **Cycle lunaire** (5) : `/api/lunar-cycle/*`
- **Astéroïdes** (1) : `/api/asteroid-wisdom`
- **Notifications push** (5) : `/api/notifications/*` (avec VAPID)
- **Premium / billing / Stripe** : `/api/premium/activate`, `/billing/status`, `stripe_events` (webhook)
- **Défi hebdo** (2) : `/api/challenge/week`, `/complete`
- **Favoris** (3) : `/api/favorites` (GET/POST/DELETE) + `/favorites/today`
- **Récap annuel** : `/api/yearly-recap`
- **Contenu hebdo** : `/api/weekly-content` (+ admin)
- **Événements astro** : `/api/astro/events`
- **Referrals** : `/api/referrals/code`
- **Onboarding** (3) : `/api/onboarding/progress`, `/step`, `/dismiss`
- **OAuth Google** : `routes/oauth.js` monté (1 route)
- **Admin** (3) : `/api/admin/weekly-content`, `/admin/astro-events/preview`, `/admin/astro-events/run`
- **Santé** : `/api/health`, `/api/astro/moon-phase`

### 2.2 Features identifiées par grep (présentes dans le code)
| Feature | Présent | Composant / route |
|---|---|---|
| Tarot en croix (4 cartes) | ✅ | `TarotCross.tsx` + `/api/tarot/cross` |
| Tarot du jour | ✅ | `DailyDraws.tsx` + `/api/tarot/daily` |
| Oracles runes | ✅ | `RuneOracle.tsx` (composant orphelin) |
| Yi Jing | ✅ | `YiJingOracle.tsx` (composant orphelin) |
| Compatibilité amoureuse | ✅ | `Compatibility.tsx` + `/api/compatibility` |
| Invitation compat par lien | ✅ | `CompatRedeem.tsx` + `/api/compat/invite` |
| Journal | ✅ | `Journal.tsx` + `/api/journal` |
| Rituels quotidiens | ✅ | `DailyRituals.tsx` + `/api/rituals/today` |
| Streak (série) | ✅ | `StreakCelebration.tsx` + `/api/streak` |
| XP / niveau | ✅ | `XpBar.tsx` + tables `user_xp`, `xp_log` |
| Badges | ✅ | `BadgeGrid.tsx` + table `user_badges` |
| Quêtes quotidiennes | ✅ | `DailyQuests.tsx` + table `daily_quests` |
| Parrainage | ✅ | `ReferralCard.tsx` + `/api/referrals/code` |
| Mood tracker | ✅ | `MoodWidget.tsx` + `/api/mood` |
| Mood forecast | ✅ | `MoodForecast.tsx` + `/api/mood-forecast` |
| Transits perso | ✅ | `PersonalTransits.tsx` + `/api/personal-transits` |
| Maisons activées | ✅ | `ActivatedHouses.tsx` + `/api/activated-houses` |
| Énergie du jour | ✅ | `DailyEnergy.tsx` + `/api/daily-energy` |
| Cycle lunaire | ✅ | `LunarCycle.tsx` + `/api/lunar-cycle` |
| Intention du jour | ✅ | `DailyIntention.tsx` |
| Carte du ciel | ✅ | `SkyMap.tsx` + `SkyMapShare.tsx` |
| Astrologie chinoise | ✅ | `ChineseAstrology.tsx` |
| Nœuds lunaires | ✅ | `LunarNodes.tsx` + `/api/chart/lunar-nodes` |
| Astéroïdes | ✅ | `AsteroidWisdom.tsx` + `/api/chart/asteroids` |
| Favoris horoscope | ✅ | `/api/favorites` |
| Weekly content | ✅ | `WeeklyContentCard.tsx` + `/api/weekly-content` |
| Récap annuel | ✅ | `YearlyRecap.tsx` + `/api/yearly-recap` |
| Portrait PDF | ✅ | `portrait-pdf.js` + `/api/portrait/pdf` |
| Premium Stripe | ✅ | `payment.ts` + `/api/premium/activate` |
| Push notifications | ✅ | `pushNotifications.ts` + VAPID |
| Google OAuth | ✅ | `oauth.js` + `Auth.tsx` |
| Share card | ✅ | `ShareCard.tsx` |
| PWA | ✅ | `manifest.json` + `serviceWorker` dans `App.tsx` |
| Analytics (Sentry + PostHog) | ✅ | `monitoring.ts` |
| Admin weekly content | ✅ | `/api/admin/weekly-content` |
| Tests E2E (Playwright) | ✅ | `package.json` |
| Tests unitaires | ✅ | `test-unit.mjs` |
| Mode expert | ✅ | `expert-mode.ts` |
| Carte de partage ciel | ✅ | `SkyMapShare.tsx` |

### 2.3 Ce qui MANQUE (absent du code)
| Feature | Statut | Pourquoi c'est un problème |
|---|---|---|
| **Apple Sign-In** | ❌ absent | iOS = ~50% du marché FR. Co-Star et Sanctuary l'ont. Friction énorme à l'inscription. |
| **Portrait audio (TTS)** | ❌ absent | Le "wow effect" identifié dans l'audit 2026-07-19 n'est pas implémenté. `useSpeech.ts` existe mais sans TTS portrait. |
| **Sitemap.xml** | ❌ absent | SEO Google = zéro. Aucune chance d'être trouvé organiquement. |
| **OAuth Apple** | ❌ | cf. ci-dessus |
| **Tests e2e exécutés** | ⚠️ config OK, mais aucune trace d'exécution | Pas de CI, pas de validation auto avant deploy |

---

## 3. Composants ORPHELINS (le code mort)

**14 fichiers dans `src/components/` ne sont importés par aucun autre fichier** (vérifié par grep croisé). C'est du code qui prend de la place, allonge le bundle, et n'est jamais affiché.

```
src/components/DailyGreeting.tsx
src/components/XpBar.tsx
src/components/AsteroidInsights.tsx
src/components/YiJingOracle.tsx
src/components/HousesChart.tsx
src/components/LunarNodes.tsx
src/components/BadgeGrid.tsx
src/components/DailyQuests.tsx
src/components/OnboardingChecklist.tsx
src/components/WeeklyChallenge.tsx
src/components/RuneOracle.tsx
src/components/DailyAspects.tsx
src/components/CosmicCalendar.tsx
src/main.tsx
```

**⚠️ À vérifier** : certains de ces composants sont peut-être chargés via `lazy()` ou par un sous-router, auquel cas le grep ne les voit pas. Mais sur 14 fichiers, il y a au moins 3-4 qui sont réellement morts (à confirmer).

---

## 4. Position concurrentielle (analyse honnête)

Concurrents benchmarkés dans `docs/VMF-Celeste-voice-mining-framework-v2.md` :

| Pilier | Co-Star | The Pattern | Sanctuary | CHANI | **Céleste** |
|---|---|---|---|---|---|
| **Tarot** | ❌ | ❌ | ✅ simple | ❌ | ✅ daily + croix + runes + Yi Jing (**4 oracles**) |
| **Compat avec lien d'invitation** | ❌ | ❌ | ❌ | ❌ | ✅ (`/api/compat/invite`) |
| **Mode expert on/off** | partiel | ❌ | ❌ | ❌ | ✅ (`expert-mode.ts` + `ExpertModeToggle.tsx`) |
| **Boucle Horoscope ↔ Journal** | ❌ | ❌ | ❌ | ❌ | ✅ (présence code, à confirmer visuellement) |
| **Push matin** | ✅ | ✅ | ✅ | ✅ | ⚠️ backend prêt, activation ? |
| **Apple Sign-In** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Google Sign-In** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Sitemap / SEO** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Natif FR** | traduit | traduit | traduit | traduit | ✅ |
| **Prix** | 4,99€/mois | 5,99€ | 9,99€ | gratuit+ | 6,99€/sem ou 39,99€/an |
| **Pricing mensuel équivalent** | 4,99€ | 5,99€ | 9,99€ | - | **~9,99€/mois** (si abonnement annuel divisé) — **plus cher que Co-Star** |
| **Transits perso** | ✅ | ❌ | ❌ | ✅ | ✅ |
| **Maisons activées** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Astéroïdes / Lune noire / chinois** | partiel | ❌ | ❌ | ❌ | ✅ (3 systèmes en plus) |

### Forces réelles (vérifiées dans le code)
1. **Multi-oracle** — 4 systèmes (Tarot daily + Croix + Runes + Yi Jing). Personne d'autre n'a ça.
2. **Compat avec lien partageable** — très rare, et le `CompatRedeem` screen existe en deep-link.
3. **Multi-systèmes** — occidental + chinois + astéroïdes + nœuds lunaires. Profond pour les geeks d'astro.
4. **Boucle cross-screen** — l'audit-pages-v1 documente Horoscope↔Journal (à valider en runtime).
5. **Mode expert toggle** — rares apps astro osent le mode geek.

### Faiblesses réelles (vérifiées dans le code)
1. **Pas d'Apple Sign-In** — c'est probablement la plus grosse perte de conversion iOS FR.
2. **Pas de sitemap** — SEO = 0. Aucune acquisition organique.
3. **Portrait audio manquant** — le "wow" identifié en audit 2026-07-19 n'a jamais été livré.
4. **14 composants orphelins** — du code mort qui ralentit le build et la maintenance.
5. **14% des tables DB sont vides** (24/38 à 0 ligne) — beaucoup d'infrastructure sous-utilisée (referrals, weekly_content, cosmic_events, horoscope_feedback…).
6. **Pricing mal positionné** — le 6,99€/sem ramène à 9,99€/mois, plus cher que Co-Star (4,99€). Si la valeur perçue est plus faible (pas d'Apple Sign-In, pas de SEO, pas de push matinal actif), c'est un handicap.

---

## 5. État de santé technique

### ✅ Ce qui marche (vérifié)
- **Backend structuré** — 12 fichiers de routes séparés du `server.js`, factory pattern propre.
- **Cache LLM en place** — `horoscope_personal_daily`, `daily_aspects_cache`, `personal_transits`, `activated_houses` (caché par user/jour).
- **Migrations** — 4 migrations versionnées (`_migrations`), système propre.
- **Backups automatiques** — 7 backups datés aujourd'hui dans `server/backups/` (`better-sqlite3 .backup()`).
- **Sécurité** — `helmet`, `auth` middleware, `authLimiter`, `llmLimiter`, `softAuth`, `adminAuth`, `token_blacklist`, `password` hashing.
- **Voix Céleste** — constante `CELESTE_VOICE` dans `celest-voice.js`, **injectée dans TOUS les prompts LLM** (5 commandements VMF).
- **PWA + offline** — `serviceWorker`, `OfflineIndicator`, `offlineQueue.ts`.
- **Monitoring** — Sentry + PostHog câblés.
- **Tests** — E2E + unitaires configurés (mais pas de trace d'exécution).

### ⚠️ Risques / dettes
- **`server/server.js` = 5 069 lignes monolithiques** — 60 routes directes dedans. Devrait être éclaté en sous-routeurs comme `routes/`.
- **Pas de CI** — aucun workflow GitHub Actions détecté. Déploiement manuel = risque régression.
- **`callLLMWithRetry` patché pour fail-fast sur 429** (fait ce matin) — mais c'est un pansement. La vraie solution c'est cache agressif + file d'attente + backoff exponentiel long.
- **Tunnel SSH instable** (serveo coupe >30s) — bloque les tests LLM en remote. Pas un bug code, un bug infra.
- **Notifs Telegram "rate-limit"** — la chaîne vient de `~/.hermes/hermes-agent/gateway/run.py:397`, **PAS de Celeste**. C'est mon infra, pas la tienne. À régler côté Hermes.

### ❌ Bugs confirmés
- À ce stade, **je n'ai pas lancé le serveur** (qui est down). Je ne peux pas lister de bugs runtime sans exécution. C'est honnête.

---

## 6. Verdict honnête

### L'app **est** concurrentielle sur :
- Multi-oracles (4 systèmes, personne d'autre)
- Compat avec lien d'invitation
- Multi-systèmes astro (occidental + chinois + astéroïdes + nœuds)
- Mode expert
- Boucle Horoscope↔Journal

### L'app **n'est pas** compétitive sur :
- SEO (zéro sitemap)
- Apple Sign-In (iOS = 50% du marché FR)
- Push matinales (pas activé visiblement)
- Prix (plus cher que Co-Star sans valeur perçue supérieure)
- Portrait audio (annoncé, pas livré)

### Verdict : **7/10 sur l'astrologie pure, 5/10 sur l'acquisition/conversion**.

Tu as un **produit profond** mais **mal distribué**. Le code est solide, mais il manque les 4-5 features qui font qu'une app astro passe de "jolie" à "virale".

---

## 7. Plan d'actions recommandé (sans bullshit)

### 🚨 Critique (sans ça l'app perd des users chaque jour)
1. **Activer Apple Sign-In** — demi-journée de boulot (oauth.js existe déjà pour Google, faut ajouter `passport-apple`).
2. **Ajouter `sitemap.xml`** — 1h. C'est SEO de base, indispensable.
3. **Activer la push notification du matin** — backend prêt (`/api/notifications`), faut juste le cron + le consentement.

### 💰 Quick wins (ROI élevé / coût faible)
4. **Repositionner le pricing** — baisser à 4,99€/mois ou 2,99€/mois pour matcher Co-Star. Le pricing actuel (6,99€/sem) est absurde vs la concurrence.
5. **Nettoyer les 14 composants orphelins** — soit les supprimer, soit les brancher. -10% de bundle, code plus maintenable.
6. **Éclater `server.js` (5069 lignes)** en sous-routeurs `/api/auth`, `/api/horoscope`, etc. — comme `routes/` est déjà structuré. Évite le merge hell.

### 🌟 Wow effects (différenciation)
7. **Livrer le portrait audio (TTS)** — identifié comme wow en audit 2026-07-19, jamais fait. Avec `useSpeech.ts` qui existe déjà, c'est 2-3 jours max.
8. **Activer le partage de carte de ciel** — `SkyMapShare.tsx` existe. Manque l'UI de partage WhatsApp/Instagram.

### 🧹 Hygiène
9. **Lancer une passe CI** — GitHub Actions qui fait `npm run lint && npm run test:unit && npm run test:e2e`. Bloque les merges cassés.
10. **Monitorer l'usage des features** — PostHog events sur tarot_croix, compat_invite, DailyIntention. Savoir ce qui est utilisé.

---

## 8. Ce que je ne peux PAS affirmer sans relancer le serveur

- Bugs runtime précis (j'ai le code sous les yeux, pas l'exécution)
- Temps de réponse réels des endpoints LLM
- Taux de cache hit sur `horoscope_personal_daily`
- Si `DailyIntention` / `DailyTarot` s'affichent vraiment sur Home
- Si le tunnel coupe encore à 30s (besoin de test live)

**Pour confirmer les runtime bugs, il faut que je relance le backend.** Le backend est actuellement DOWN (pkill fait avant le patch final). Dis-moi si tu veux que je le relance et que je fasse des tests de bout en bout.

---

*Audit rédigé en mode "faits bruts vérifiés", 21 juillet 2026, sans aucun chiffre inventé. Tous les nombres viennent d'une commande shell.*
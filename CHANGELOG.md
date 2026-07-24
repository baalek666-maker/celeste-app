# Celeste — Changelog

Historique des changements notables du projet Celeste.

---

## v14.7.1 — 22 juillet 2026
### Cron nocturne : décalé à minuit Paris
- **Avant** : `runNightlyPrefetch` tournait à **2h00 Paris** (v14.6) puis **23h00 Paris** (v14.7)
- **Maintenant** : **00h00 Paris** (= minuit)
- **Pourquoi** : l'API CheapestInference est coupée entre **02h00 et 10h00** (abonnement user). À 2h ou 23h on tombait soit en plein blackout (2h) soit trop tôt (23h, user pas encore couché).
- **Critères** : user dort + fenêtre LLM ouverte + cache J+1 prêt pour matin (8h ouverture app).
- **Alertes** : si `success=0` ou `failed>50%` → log `console.error` avec ⚠️⚠️⚠️ visible dans les logs serveur.
- **Surcharge** : variable d'env `NIGHTLY_PREFETCH_HOUR` permet de décaler sans recompiler.
- **Backstop** : si LLM down à minuit, déclencher à la main via `POST /api/admin/nightly/run`.

---

## v14.7 — 22 juillet 2026
### Cron nocturne : décalé de 2h → 23h
- Première correction du bug "nightly silencieux". Décale ensuite à minuit (v14.7.1) suite à retour user.

---

## v14.6 — 21 juillet 2026
### Audit qualité "plats servis" aux utilisateurs

**Lucky number / lucky color vraiment astro**
- Avant : valeurs random ou générées par LLM (souvent incohérentes, ex: "turquoise" pour user non concerné)
- Maintenant : calcul **déterministe** depuis les longitudes planétaires du jour (`computeAstroHardFacts`)
- Override quadruple (4 couches) : fallback summary + post-LLM parse + legacy cache hit + final personalize
- Lucky number = 1-50 dérivé des transits, lucky color = couleur de la planète dominante (Pluton → noir plutonien, Saturne → bleu, Mars → rouge, etc.)

**Variabilité inter-users**
- Lucky number mixé avec **chemin de vie numérologique** (date de naissance → 1-9 ou 11/22 maîtres)
- Chaque user voit un nombre unique (sauf jumeaux astro)
- Paramètre `birthDate` optionnel dans `computeAstroHardFacts(transits, date, birthDate)`

**Rituels matin/soir**
- Refonte complète : 8+ templates déterministes rotationnant sur (sun sign × day of year)
- Injection prénom + heure naissance
- Fix bug `display_name` (avant : prénom vide)
- Fix bug `zodiacSign` non stocké dans `birth_data` → calcul via `getNatalPositions()` à la volée

**Push matinal**
- Body = phrase astro précise (avant : générique "le ciel t'ouvre une porte, passe-la")
- Routes admin ajoutées :
  - `GET /api/admin/nightly/push-preview` : preview SANS envoi
  - `POST /api/admin/nightly/push-test` : envoi réel aux users VAPID-subscribed
- Fix `firstName` + `userSun` lus correctement

**Cache legacy**
- Table `horoscope_cache` supprimée (contenait encore `luckyColor: turquoise` stale)
- Table `horoscope_personal_daily` purgée et repeuplée avec valeurs astro vraies

---

## Routes admin (auth requise)
Toutes via header `X-Admin-Token` (PAS `Authorization: Bearer`).

| Route | Méthode | Usage |
|---|---|---|
| `/api/admin/nightly/run` | POST | Force le nightly maintenant |
| `/api/admin/nightly/stats` | GET | `last_run_at`, `cache_today`, `cache_tomorrow`, `nightly_prefetch_hour_paris` |
| `/api/admin/nightly/push-preview` | GET | Voir le body du push SANS l'envoyer |
| `/api/admin/nightly/push-test` | POST | Envoi réel aux users VAPID-subscribed |

---

## Cron jobs (server.js : `startCronScheduler`)
Tous dans le `setInterval` 30 min. **Aucun n'utilise le LLM sauf `runNightlyPrefetch`.**

| Job | Fréquence | Touche LLM | Heure typique |
|---|---|---|---|
| `runDailyPushJob` | chaque 30min | non | à l'heure locale du user (défaut 9h) |
| `runReengagementJob` | chaque 30min | non | n/a |
| `runStreakReminderJob` | chaque 30min | non | n/a |
| `runEarlyReengagementJob` | chaque 30min | non | n/a |
| `runTrialExpiryJob` | chaque 30min | non | n/a |
| `runAstroEventsJob` | chaque 6h | non | toutes les 6h depuis boot |
| `runNightlyPrefetch` | chaque 30min (filtre Paris) | **OUI** | **00h00 Paris** |
| `backupDatabase` | chaque 6h depuis boot | non | 1min après boot + 6h après + ... |

---

## Notes techniques
- Colonne users = **`display_name`** (JAMAIS `name`) — toujours `PRAGMA table_info` avant SELECT
- `birth_data` ne contient **PAS** `zodiacSign` stocké → utiliser `getNatalPositions()` pour calculer
- Clef composite cache nightly : `(sun_sign, moon_sign, rising_sign, date)`
- Mutex nightly : `nightlyPrefetchRunning` (skip si déjà en cours)
- Timeout nightly : `NIGHTLY_PREFETCH_TIMEOUT_MS = 15min` (sécurité)
- Rate limit nightly : 200ms entre users (≈ 30s pour 60 users)
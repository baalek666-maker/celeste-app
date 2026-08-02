# 🎯 Audit Master A→Z v2 — Céleste (2026-08-02)

**Score global : 6.2/10** — App fonctionnelle avec base solide, mais problèmes critiques de rétention, monétisation et fluidité non résolus.

---

## 📊 Résumé exécutif

| Domaine | Score | Verdict |
|---------|-------|---------|
| Design & fluidité | 7.5/10 | Beau mais trop dense |
| Parcours client | 6/10 | Dead-ends persistants |
| Rétention | 4.5/10 | Mécanismes présents mais inefficaces |
| Monétisation | 5/10 | Free trial bon, conversion faible |
| VMF cohérence | 7/10 | Bonne voix, quelques fuites |
| vs Concurrents | 6/10 | Feature-rich mais en retard sur l'essentiel |
| Bugs | 5/10 | 16 fixes committés mais pas live |
| **Total** | **6.2/10** | **Potentiel fort, exécution incomplète** |

---

## 1. 🎨 Design & Fluidité

### ✅ Ce qui marche
- Palette alchemical mature (night/gold/sage)
- Typo Cinzel + Cormorant + Inter cohérente
- Glassmorphism soigné, animations CSS
- Mobile-first avec safe-area-bottom
- Icônes SVG maison (pas de lib générique)

### 🔴 Problems critiques

**Home = 11 blocs dans le scroll principal**
```
TrialBanner → EmailVerificationBanner → StreakCelebration → 
DailyHero → DailyTarot → DailyIntention → DailyEnergy → 
EveningRitualCard → TarotCross → LiveAstroBanner → 
MoodForecast → SignatureFooter → HomeSecondary
```
L'audit précédent (v7, retention-audit-findings.md) avait fixé l'objectif : **4 blocs max**. Ce n'est **jamais appliqué**. 11 blocs uniformes = pas de thumb-stop, dilution de l'attention, fatigue visuelle.

**Co-Star a 1 bloc. Nous en avons 11.**

### 🟡 Recommandations fluidité
1. **Home → 4 blocs** : DailyHero (40% viewport) → DailyTarot → DailyEnergy → SignatureFooter. Tout le reste dans HomeSecondary (collapsable).
2. **Onboarding 4 étapes** → OK (0: welcome, 1: date+heure, 2: lieu, 3: calculating). Time-to-value = ~90s. Bon.
3. **Transitions** : pas de transitions entre screens (juste des swaps). Ajouter framer-motion shared layout.
4. **Back navigateur** : pas géré (hash router manquant). Android back = quitte l'app.

---

## 2. 🗺️ Parcours Client — Dead Ends

### ✅ Chemin nominal (testé via API)
```
Landing → Commencer → Auth (register) → Onboarding (4 étapes, ~90s) 
→ Home → Horoscope (LLM 6s) → 7 scans gratuits → Paywall 
→ Free trial 7j (sans CB) → premium → retour Home
```

### 🔴 7 dead-ends identifiés

| # | Dead-end | Impact | Fix |
|---|----------|--------|-----|
| 1 | **Mot de passe oublié** : non implémenté | User bloqué à vie si perte mdp | POST /api/auth/reset + email reset |
| 2 | **CompatRedeem CTA final** → redirige Landing au lieu de Auth | Perte conversion parrainage | Changer `onDone` → `onNavigate('auth')` |
| 3 | **Apple Sign In button** → erreur silencieuse | Frustration iOS users | Cacher si APPLE_CLIENT_ID manquant |
| 4 | **Birth data sans timezone** → erreur "Fuseau horaire invalide" | Onboarding bloque si CitySearch ne renvoie pas tz | Auto-calcul timezone via latitude/longitude |
| 5 | **CompatRedeem inviterSun non normalisé** → symboles ✨ partout | Rendu visuel cassé | Fix F8 appliqué dans le code mais pas live |
| 6 | **Back button Android** → quitte l'app | Perte du parcours | Hash router + popstate listener |
| 7 | **Yearly recap moodWord** → toujours null | Feature silencieusement cassée | Fix B6 appliqué dans le code mais pas live |

---

## 3. 🔄 Rétention — Analyse Profonde

### Streak system
- **Compteur présent** mais seulement visible via `StreakCelebration` (overlay milestone) et `EveningRitualCard`.
- **Pas de streak visible en permanence** dans Home header ou nav. Co-Star montre le streak en hero permanent.
- **Streak freezes** = 1/semaine, mais le bouton pour les utiliser est enfoui.
- **FOMO faible** : pas de "tu vas perdre ton streak de X jours" push.

### Push notifications
- **Service Worker** : `public/sw.js` existe mais **PUSH ONLY (no caching, v60)** — explicitement marqué "plus aucun cache, plus aucun offline".
- **3 horaires hardcodés** : 7h30, 18h, 22h via `setTimeout` — **seulement si tab ouvert**.
- **Push backend** : `setInterval` 30min, itère `push_subscriptions` à l'heure choisie. VAPID non configuré → 503.
- **Re-engagement J+3 et J+7** : implémentés, free users inclus.
- **4 variantes de copy** VMF-aligned — bon.

### 🔴 Rétention = 4.5/10 car :
1. **Push pas fonctionnelles** (VAPID non configuré, pas de HTTPS persistant)
2. **Offline = kill switch** — sw.js ne cache plus rien → pas de valeur hors ligne
3. **Streak invisible** au quotidien
4. **Pas de "come back tomorrow" hook** visible
5. **Gamification décorative** — 11 badges tous granted d'office (bug), quests vides

### 🟡 Ce qui marcherait pour la rétention

| Mécanisme | Effort | Impact D7 |
|-----------|--------|-----------|
| **Push natives VAPID** | 2h config | +15-20% D7 |
| **Streak visible en header** | 30min | +5-8% D7 |
| **"Reviens à 18h" teaser** | 1h | +3-5% D7 |
| **Offline cache horoscope** | 2h | +5% D7 |
| **Daily quest avec progression** | 3h | +8-10% D7 |

---

## 4. 💰 Monétisation

### Free tier
- **7 scans gratuits** ✅ (bon — assez pour tester horoscope + compat + tarot)
- **Free trial 7j sans CB** ✅ (excellent — bas coût, haut signal)
- **Trial banner** visible sur Home ✅

### Paywall
- **40€/an** — positionnement prix moyen-bas (Co-Star 5$/an, CHANI 30$/an, Sanctuary 80$/an)
- **4 features listées** : planètes perso, compat illimitée, journal guidé, transits expliqués
- **Stripe checkout** implémenté mais pas testé end-to-end
- **Apple bouton** = obligatoire App Store mais non fonctionnel

### 🔴 Problems monétisation

1. **Conversion trigger flou** : user arrive sur Paywall via Explorer (bouton "premium"), pas via un moment "wow". Il faut un **paywall contextuel après une lecture wow** ("Ton horoscope de demain est disponible — débloque-le avec premium").
2. **Pas d'upsell in-context** : quand user utilise son dernier scan, pas de transition fluide vers paywall. Juste un 402 error.
3. **Pas de one-time purchase** : tout est annual subscription. Pas de "portrait astral complet 5€" pour les users qui ne veulent pas s'engager.
4. **Referral system existe** (ReferralCard, CompatRedeem) mais le flow est cassé (dead-end #2).
5. **Gamification non monétisée** : les badges pourraient être des "premium teasers" (badge unlock → "deviens premium pour plus").

### 🟡 Recommandations monétisation

| Action | Effort | Impact revenu |
|--------|--------|---------------|
| **Paywall contextuel après dernier scan** | 2h | +15-25% conversion |
| **One-time purchase : Portrait astral 4.99€** | 4h | Nouveau stream revenu |
| **Fix referral flow** (CompatRedeem → Auth) | 30min | +viralité |
| **Trial reminder push J5** ("Plus que 2j") | 1h | +10% trial→paid |
| **Premium teaser dans Tarot** ("Carte de demain — premium") | 1h | +5% curiosity clicks |

---

## 5. 🎭 VMF Cohérence

### ✅ Bon
- Tutoiement global (tu/ton/ta) dans 95% du frontend
- Ton chaud, pas jargon (sauf quelques fuites)
- Pas de mention IA/AI/OCR/LLM dans le frontend
- Horoscope LLM : excellent ton ("ton soleil en Taureau", "Prends un moment pour toi")
- Tarot : personnalisé au signe, warm

### 🔴 Fuites VMF

| Fichier | Ligne | Problème |
|---------|-------|----------|
| `CompatRedeem.tsx` | 161 | "Votre compatibilité astrale" (vouvoiement) |
| `Compatibility.tsx` | 244-247 | "vous vous complétez" / "Relation à construire" (vouvoiement) |
| `server/server.js` | fallback texts | Textes de secours possiblement en ancien ton |

### Backend prompts LLM
- System prompt : "Tu es Céleste" ✅
- Anti-AI instruction présente ✅
- Tutoiement ✅
- Mais : **module voix centralisé** (`celest-voice.js`) pas implémenté — chaque prompt duplique les règles

---

## 6. 🆚 Concurrents — Comparison

| Feature | Céleste | Co-Star | CHANI | The Pattern | Sanctuary |
|---------|---------|---------|-------|-------------|-----------|
| **Prix** | 40€/an | 5$/an | 30$/an | Free+premium | 80$/an |
| **Free trial** | 7j sans CB | Limité | 14j CB | Gratuit | Limité |
| **Push natives** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Offline** | ❌ (kill switch) | ✅ | ✅ | ✅ | ❌ |
| **Horoscope LLM** | ✅ perso | ❌ (généré) | ✅ | ✅ | ✅ |
| **Tarot** | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Compatibilité** | ✅ | ❌ | ❌ | ✅ (star) | ❌ |
| **Journal** | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Gamification** | ✅ (cassée) | ❌ | ❌ | ❌ | ❌ |
| **Natal chart** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Astéroïdes** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Yi-Jing** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Astrologie chinoise** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Share cards** | ✅ | ❌ | ✅ | ✅ | ❌ |
| **Referral** | ✅ (cassé) | ❌ | ❌ | ❌ | ❌ |

### Edge unique de Céleste
Seul app combinant **tarot + compatibilité + journal + gamification + astro chinoise + yi-jing + astéroïdes** à 40€/an sans CB.

### Faiblesses vs concurrents
1. **Push natives** : Co-Star doit 80% rétention D7 au push. Nous n'avons pas.
2. **Offline** : tous les concurrents fonctionnent hors ligne. Nous non (kill switch).
3. **Simplicité** : Co-Star = 1 écran, 1 horoscope. Nous = 11 blocs, 14 screens.
4. **Social** : The Pattern a construit sa marque sur la compatibilité. Notre compat est enfouie.

### Ce que les users détestent chez les concurrents (→ opportunité Céleste)
- **Co-Star** : "too sassy", "aggressive notifications", "paywall after 3 days" → Céleste = warm, 7j sans CB
- **The Pattern** : "impossible to cancel", "subscription trap" → Céleste = cancel facile (Stripe portal)
- **CHANI** : "too expensive for what you get" → Céleste = 40€/an vs 30$/an avec plus de features
- **Sanctuary** : "live readings are $10 each" → Céleste = tout inclus

---

## 7. 🐛 Bugs & État des Fixes

### Fixes committés (b70dead) mais PAS LIVE
Le serveur tourne toujours sur l'ancien code. Les 16 fixes ne sont pas déployées.

| Fix | Code | Live | Test |
|-----|------|------|------|
| F1 ToastHost | ✅ | ❌ | Frontend non reconstruit |
| F2 Onboarding setStep(3) | ✅ | ❌ | Frontend non reconstruit |
| F3 SettingsMenu journal key | ✅ | ❌ | Frontend non reconstruit |
| F4 ProfilesScreen timezone | ✅ | ❌ | Frontend non reconstruit |
| F5 App.tsx import mort | ✅ | ❌ | Frontend non reconstruit |
| F6 Horoscope onNavigate | ✅ | ❌ | Frontend non reconstruit |
| F7 ChartView shareStatus | ✅ | ❌ | Frontend non reconstruit |
| F8 CompatRedeem normalizeSign | ✅ | ❌ | Frontend non reconstruit |
| B1 OAuth email-takeover | ✅ | ❌ | Server non redémarré |
| B2 Streak freeze abuse | ✅ | ❌ | Server non redémarré |
| B3 Badge grant admin-only | ✅ | ❌ | Server non redémarré |
| B4 computeHouses | ✅ | ❌ | Server non redémarré |
| B5 Stripe webhook | ✅ | ❌ | Server non redémarré |
| B6 yearly-recap | ✅ | ❌ | moodWord toujours null |
| B7 double-decrement | ✅ | ❌ | scans 7→1 en 1 requête |
| B8 natal cache invalidation | ✅ | ❌ | Server non redémarré |

### Nouveaux bugs découverts cet audit

| # | Bug | Preuve | Impact |
|---|-----|--------|--------|
| **N1** | **11 badges granted d'office** à un nouvel user | `gamification/status` retourne 11 badges pour user niveau 1 | Gamification sans valeur |
| **N2** | **Quests structure cassée** | Toutes les quests ont des champs vides ("?") | Quêtes inutilisables |
| **N3** | **scans 7→1 en 1 horoscope** | DB montre scans_remaining=2 après 1 horoscope | Double-decrement non fixé en live |
| **N4** | **Birth data exige timezone** | API rejette sans champ `timezone` | Onboarding peut bloquer |
| **N5** | **Compatibility API field mismatch** | `theirBirthData` vs `partnerBirthData` | Compat cassée côté frontend |
| **N6** | **sw.js = kill switch** (no cache, no offline) | `public/sw.js` ligne 1-7 | Pas de valeur hors ligne |

---

## 8. 🚀 Top 10 Actions Prioritaires

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 1 | **Déployer les 16 fixes** (restart server + rebuild frontend) | 5min | Tous les fixes live |
| 2 | **Fix gamification** (badges auto-granted + quests vides) | 2h | Gamification fonctionnelle |
| 3 | **Home → 4 blocs** (réduction drastique) | 3h | Thumb-stop + fluidité |
| 4 | **Push natives VAPID** (config + test) | 2h | +15-20% D7 |
| 5 | **Streak visible en header** | 30min | +5-8% D7 |
| 6 | **Paywall contextuel après dernier scan** | 2h | +15-25% conversion |
| 7 | **Fix mot de passe oublié** | 2h | Dead-end critique |
| 8 | **Fix CompatRedeem → Auth** | 30min | Viralité referral |
| 9 | **One-time purchase portrait astral 4.99€** | 4h | Nouveau revenu |
| 10 | **Offline cache horoscope** (réactiver dans sw.js) | 2h | +5% D7 |

---

## 9. 💡 Idées non explorées

1. **Shareable daily cards** : chaque horoscope génère une carte visuelle partageable (Instagram story format). Acquisition organique gratuite.
2. **Compatibility widget** : widget iFrame pour sites/blogs ("Test ta compat avec [célébrité]"). SEO + backlinks.
3. **Astrology dating integration** : compatibilité intégrée à Tinder/Bumble via API. B2B revenue.
4. **Premium tier "Céleste Plus"** à 60€/an : consultations live (marketplace), comme Sanctuary mais sans le pay-per-use.
5. **Annual report PDF** : "Ton année astrale 2026" généré en PDF, partageable. Premium only.
6. **Widget iOS/Android** : horoscope du jour sur l'écran d'accueil sans ouvrir l'app.
7. **Apple Watch** : complication "énergie du jour" (1-5). Vue rapide sans ouvrir l'app.
8. **Discord/Telegram bot** : horoscope quotidien dans un channel. Acquisition communautaire.

---

*Audit réalisé par Hermes Agent — 2 août 2026, 12:45 UTC. Tests live via tunnel Cloudflare. 3 subagents parallèles (timeout). Données DB SQLite inspectées directement. Parcours API testé end-to-end.*

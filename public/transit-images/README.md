# Catalogue d'images pour les cartes Transits

## Convention de nommage

Format : `{planete}-{nature}.jpg` (en minuscules, sans accent, format JPEG)

- **Planètes** (10) : `soleil`, `lune`, `mercure`, `venus`, `mars`, `jupiter`, `saturne`, `uranus`, `neptune`, `pluton`
- **Natures** (3) : `tension`, `harmonique`, `neutre`

→ **30 images au total** (10 × 3)

## Liste des fichiers à déposer

```
soleil-tension.jpg       soleil-harmonique.jpg       soleil-neutre.jpg
lune-tension.jpg         lune-harmonique.jpg         lune-neutre.jpg
mercure-tension.jpg      mercure-harmonique.jpg      mercure-neutre.jpg
venus-tension.jpg        venus-harmonique.jpg        venus-neutre.jpg
mars-tension.jpg         mars-harmonique.jpg         mars-neutre.jpg
jupiter-tension.jpg      jupiter-harmonique.jpg      jupiter-neutre.jpg
saturne-tension.jpg      saturne-harmonique.jpg      saturne-neutre.jpg
uranus-tension.jpg       uranus-harmonique.jpg       uranus-neutre.jpg
neptune-tension.jpg      neptune-harmonique.jpg      neptune-neutre.jpg
pluton-tension.jpg       pluton-harmonique.jpg       pluton-neutre.jpg
```

## Spécifications

- **Format** : JPEG (`.jpg`)
- **Ratio** : **9:16** (vertical, format story Instagram)
- **Résolution recommandée** : 1080×1920 px
- **Taille** : < 500 KB par image (compression ~80%)
- **Pas de texte** sur l'image (le wording est overlay React par-dessus)
- **Pas de watermark** (pas de signature IA visible)

## Style

Palette dominante Céleste : **or / noir / violet profond**.
Chaque prompt associe la nature (tension/harmonie/neutre) à la planète.

## Génération

Les prompts détaillés sont dans le brief partagé avec le user.
Outils recommandés : Midjourney v6, DALL·E 3, Stable Diffusion XL, Flux.

## Fallback

Si une image est absente, le composant `TransitCard` et `HouseCard` utilisent
un **fallback gradient** aux couleurs de la nature (rose pour tension, vert pour
harmonique, violet pour neutre). Donc l'app fonctionne même avec 0 image.

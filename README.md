# 🌱 Habitly — Suivi d'habitudes personnel

> Application web minimaliste de suivi d'habitudes, 100% locale, sans compte ni serveur.

---

## Aperçu

**Habitly** est une application de suivi d'habitudes pensée pour un usage personnel. Elle fonctionne directement dans le navigateur, sans installation, sans connexion internet requise, et sans aucune donnée envoyée sur un serveur. Tout est conservé en local grâce au `localStorage`.

---

## Fonctionnalités

### 🗓️ Bandeau de jours
- Affiche les **90 derniers jours** dans une frise horizontale scrollable
- Chaque jour montre une **mini-barre de progression** visuelle
- Cliquer sur un jour affiche les habitudes de cette journée en **lecture seule**
- Le jour actuel est mis en évidence

### ✅ Gestion des habitudes
- **Ajouter** une habitude avec nom, couleur personnalisée et type
- **Deux types disponibles :**
  - *Case à cocher* — fait / non fait
  - *Compteur numérique* — avec un objectif journalier configurable
- **Modifier** ou **supprimer** une habitude existante

### 📊 Progression journalière
- **Anneau de progression** affiché en permanence (vert = 100%, jaune ≥ 50%, rouge < 50%)
- Compteur **"X / Y habitudes complétées"** mis à jour en temps réel
- Visible pour chaque jour sélectionné

### 🔥 Streaks
- Calcul automatique du **streak actuel** (jours consécutifs)
- Affichage du **meilleur streak historique**
- Indicateur visuel 🔥 lorsque le streak dépasse 2 jours

### 📈 Statistiques
- **Taux de réussite sur 7 jours** par habitude avec barre de progression
- **Mini graphique en barres** (canvas) par habitude
- **Heatmap des 12 dernières semaines** style GitHub, cliquable

### 💾 Données locales
- Sauvegarde automatique à chaque interaction via `localStorage`
- Les données persistent après fermeture du navigateur
- **Export JSON** pour sauvegarder ses données
- **Import JSON** pour restaurer une sauvegarde
- **Reset complet** avec confirmation

---

## Structure du projet

```
habitly/
├── index.html    # Structure HTML de l'application
├── style.css     # Design dark minimal, responsive
├── script.js     # Logique complète (pas de framework)
└── README.md     # Ce fichier
```

---

## Architecture du code (`script.js`)

| Fonction | Rôle |
|---|---|
| `loadData()` | Charge habits + logs depuis localStorage |
| `saveData()` | Sauvegarde habits + logs dans localStorage |
| `calculateStreak()` | Calcule le streak actuel et le meilleur streak |
| `getDayProgress()` | Retourne le % de complétion pour une date |
| `renderTimeline()` | Génère le bandeau de jours scrollable |
| `selectDate()` | Change le jour affiché et met à jour l'UI |
| `updateDayHeader()` | Met à jour l'anneau de progression et les labels |
| `renderHabits()` | Affiche les habitudes du jour sélectionné |
| `updateStats()` | Calcule et affiche les statistiques 7 jours |
| `renderHeatmap()` | Génère la heatmap 12 semaines |
| `refreshAll()` | Met à jour tous les composants en une fois |

---

## Stack technique

- **HTML5** — structure sémantique
- **CSS3 moderne** — variables CSS, Grid, Flexbox, `backdrop-filter`, animations
- **JavaScript Vanilla** — aucun framework, aucune dépendance
- **Canvas API** — pour les mini graphiques
- **localStorage** — persistance des données en local

---

## Mise en route

1. Télécharger les 3 fichiers (`index.html`, `style.css`, `script.js`) dans un même dossier
2. Ouvrir `index.html` dans un navigateur moderne (Chrome, Firefox, Safari, Edge)
3. C'est tout — aucune installation requise

> ⚠️ Pour que localStorage fonctionne correctement, ouvrez le fichier via un serveur local (ex: extension *Live Server* sur VS Code) plutôt qu'en double-cliquant sur le fichier. La plupart des navigateurs autorisent également l'ouverture directe (`file://`).

---

## Design

- **Thème sombre** activé par défaut
- **Mobile-first** — responsive jusqu'aux petits écrans
- **Layout 2 colonnes** sur desktop (≥ 960px) :
  - *Colonne gauche* — bouton d'ajout, statistiques, heatmap
  - *Colonne droite* — liste des habitudes du jour
- Police **DM Sans** + **DM Mono** (Google Fonts)
- Inspiré des apps iOS

---

## Données & confidentialité

Habitly ne collecte **aucune donnée**. Tout reste sur votre appareil, dans le `localStorage` de votre navigateur.

Pour sauvegarder vos données avant de vider le cache ou changer d'appareil, utilisez le bouton **Export JSON** (↑) dans le header.

---

## Limitations connues

- Les données sont liées au navigateur et à l'appareil — pas de synchronisation multi-appareils
- Si vous videz les données du navigateur (`Clear site data`), les habitudes et l'historique seront perdus → pensez à exporter régulièrement
- L'application n'est pas une PWA (pas d'installation sur écran d'accueil, pas de mode hors-ligne garanti)

---

*Fait avec ♥ en HTML / CSS / JS vanilla — aucune dépendance, aucun serveur.*

# 🌱 Habitly — Suivi d'habitudes personnel

> Application web minimaliste de suivi d'habitudes avec gestion de compte, synchronisation cloud et historique multi-appareils.

---

## Aperçu

**Habitly** est une application de suivi d'habitudes pensée pour un usage personnel. Elle fonctionne directement dans le navigateur, sans installation. Les données sont stockées dans une base de données **Supabase** (PostgreSQL) et accessibles depuis n'importe quel appareil via un compte utilisateur.

---

## Fonctionnalités

### 🔐 Authentification
- **Inscription** par email + mot de passe
- **Connexion** sécurisée via Supabase Auth
- Session persistante — pas besoin de se reconnecter à chaque visite
- Déconnexion automatique si la session expire
- Chaque utilisateur ne voit **que ses propres données** (Row Level Security)

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
- Données **sauvegardées instantanément** dans Supabase

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

### 💾 Données & export
- Données stockées dans **Supabase** (PostgreSQL cloud)
- **Export JSON** pour sauvegarder localement
- **Import JSON** pour restaurer une sauvegarde
- **Reset complet** avec suppression en base

---

## Structure du projet

```
habitly/
├── index.html    # Structure HTML de l'application
├── style.css     # Design dark minimal, responsive
├── script.js     # Logique complète + intégration Supabase
└── README.md     # Ce fichier
```

---

## Architecture du code (`script.js`)

| Fonction | Rôle |
|---|---|
| `initAuthListeners()` | Branche les events du formulaire de connexion/inscription |
| `startApp()` | Lance l'app après connexion réussie |
| `loadData()` | Charge habits + logs depuis Supabase |
| `setLog()` | Enregistre un log journalier dans Supabase (upsert) |
| `calculateStreak()` | Calcule le streak actuel et le meilleur streak |
| `getDayProgress()` | Retourne le % de complétion pour une date |
| `renderTimeline()` | Génère le bandeau de jours scrollable |
| `selectDate()` | Change le jour affiché et met à jour l'UI |
| `updateDayHeader()` | Met à jour l'anneau de progression et les labels |
| `renderHabits()` | Affiche les habitudes du jour sélectionné |
| `updateStats()` | Calcule et affiche les statistiques 7 jours |
| `renderHeatmap()` | Génère la heatmap 12 semaines |
| `refreshAll()` | Met à jour tous les composants en une fois |
| `saveHabit()` | Crée ou modifie une habitude dans Supabase |
| `deleteHabit()` | Supprime une habitude et ses logs dans Supabase |
| `exportData()` | Exporte toutes les données en JSON |
| `resetData()` | Supprime toutes les données en base |

---

## Stack technique

- **HTML5** — structure sémantique
- **CSS3 moderne** — variables CSS, Grid, Flexbox, `backdrop-filter`, animations
- **JavaScript Vanilla** — aucun framework
- **Canvas API** — pour les mini graphiques
- **Supabase** — authentification + base de données PostgreSQL cloud
  - `@supabase/supabase-js` v2 chargé via CDN

---

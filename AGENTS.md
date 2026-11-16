# AGENTS.md

## SCRIPT - Vendor Script (Agent-Facing Dialer UI) for ANTL Call Center

**AGENTS.md** is the dedicated guide for AI coding agents working on this project. This file contains all technical context needed to understand, modify, and extend the Script frontend.

---

## 🎯 Contexte Métier Global — ANTL Call Center

### Rôle du Script (Interface Vendeurs)

Le Script est l'**EXCLUSIVE interface** pour les agents télévendeurs. Ils n'utilisent JAMAIS l'USV.

**Agents = Vendeurs** :
- Se connectent uniquement au Script
- Reçoivent des prospects automatiquement quand ils passent dispo
- Doivent essayer de vendre avec les outils mis à disposition
- Prennent des RDV pendant l'appel ou en closing
- Ne traitent PAS les paiements CB (envoi de bons de commande uniquement)
- Retournent sur dashboard après chaque appel
- Doivent passer dispo manuellement pour le suivant

---

## 🔄 Flux de Travail Agent Complet

### 1. Connexion et Initialisation Twilio
```
Agent ouvre le Script
  → LoginPage : email + password
  → POST /api/auth/login
  → Récupération Access Token Twilio : GET /api/twilio/token
  → Initialisation du Twilio Device (WebRTC)
  → Connexion et enregistrement terminés
  → Dashboard affiché
```

**Point critique** : L'agent NE voit PAS la fiche prospect si Twilio Device n'est PAS connecté/enregistré.

### 2. Disponibilité = Numérotation Automatique
```
Agent clique "Disponible"
  → Vérification : Twilio Device connecté/enregistré (sinon erreur)
  → PATCH /api/agents/me/statut { statut: 'disponible' }
  → GET /api/agents/me/next-prospect
  → Prospect assigné automatiquement
  → Navigation auto : /prospect/:id
  → Appel Twilio lancé automatiquement : call(phone, campagneId, prospectId)
  → Affichage fiche prospect + outils de vente
```

**Origine** : `auto` → Distribution par la queue

### 3. Appel en Cours — Outils de Vente
```
Conversation avec le prospect
  → Timer durée en cours (MM:SS)
  → Stats WebRTC monitorées (perte paquets, RTT)
  → Outils disponibles :
     - Catalogue produits de la campagne
     - Panier multi-produits
     - Objections (réponses préparées)
     - Plan d'appel (étapes de vente)
     - Prise de RDV (pendant l'appel)
     - Historique appels/ventes du prospect
```

### 4. Closing Obligatoire
```
Agent raccroche ou clic "Terminer l'appel"
  → Modal closing OBLIGATOIRE apparaît
  → Agent DOIT sélectionner :
     - Statut appel (abouti, non_abouti, rdv_pris, vente_conclue, etc.)
     - Notes (optionnel mais recommandé)
  → Si vente :
     - Ajout produits au panier
     - Validation panier
     - Génération bon de commande (envoyé par email)
  → Si RDV :
     - Date + heure + motif
  → PATCH /api/appels/:id/terminer
  → Prospect remis en file selon résultat
  → Agent → statut 'pause_apres_appel'
  → Retour automatique au Dashboard
```

### 5. Dispo Manuel pour Appel Suivant
```
Agent de nouveau sur Dashboard
  → DOIT cliquer "Disponible" manuellement
  → Cycle reprend (étape 2)
```

**Règle** : Jamais de passage auto en dispo. C'est TOUJOURS manuel.

### 6. RDV Approche — Appel Manuel
```
Agent a un RDV prévu dans quelques minutes
  → NE PAS cliquer "Disponible" (recevrait un prospect aléatoire)
  → Saisir le numéro du RDV dans "Recherche manuelle"
  → Ou ouvrir depuis la liste "Mes rappels du jour"
  → Clic "Appeler" → openProspectManual(origin: 'rappel')
  → PATCH /api/agents/me/statut { statut: 'appel_sortant' }
  → Appel Twilio manuel vers le numéro
```

**Origine** : `rappel` → Appel manuel pour RDV

### 7. Appels à la Demande
```
Agent veut appeler un prospect spécifique
  → Saisir numéro dans Dashboard
  → Recherche prospect existant
  → Si trouvé : ouvrir sa fiche
  → Si non trouvé : créer à la volée
  → Clic "Appeler" → openProspectManual(origin: 'manuel')
  → PATCH /api/agents/me/statut { statut: 'appel_sortant' }
  → Appel Twilio manuel
```

**Origine** : `manuel` → Appel manuel à la demande

---

## 💰 Processus de Vente — Pas de Paiement CB

### Workflow Vente

1. **Pendant appel** : Agent ajoute produits au panier
2. **Validation** : Agent clique "Valider la commande"
3. **Génération bon** : Système génère un PDF (bon de commande)
4. **Envoi email** : Bon envoyé au prospect via Nodemailer
5. **Confirmation** : Agent informe le client qu'il recevra le bon par email
6. **Validation hors-système** : Client doit retourner le bon signé

### Pas de Transaction en Ligne

```typescript
// ❌ PAS de paiement CB intégré
// ❌ PAS de Stripe/PayPal/etc.
// ✅ UNQUEMENT envoi de bon de commande
```

### Outils de Vente Disponibles

| Outil | Description | Composant |
|-------|-------------|-----------|
| **Catalogue** | Produits de la campagne avec tarifs | `CatalogueProduits` |
| **Panier** | Multi-produits avec quantités | `Panier` |
| **Objections** | Réponses préparées par campagne | `ObjectionsPage` |
| **Plan d'appel** | Étapes de vente par campagne | `PlanAppelPage` |
| **Historique** | Appels et ventes du prospect | `HistoriqueAppels`, `HistoriqueVentes` |
| **RDV** | Prise de rendez-vous | `RendezVousModal` |

---

## 🔑 Guards et Protections

### Guards Connexion Twilio

```typescript
// ❌ BLOQUE si Twilio non connecté
if (!sipConnected) { // sipConnected représente l'état d'enregistrement du Twilio Device
  showToast('error', 'Twilio non connecté — Impossible de passer disponible');
  return; // Bloque le passage en disponible
}
```

### Guards Double Appel

```typescript
// ❌ BLOQUE si appel déjà en cours
if (isCallActiveRef.current) {
  console.warn('⚠️ Annulé — Appel déjà en cours');
  return; // Bloque le nouvel appel
}
```

### Guards Numéros Mobiles

```typescript
// ❌ BLOQUE les mobiles (06/07) si la campagne ne les autorise pas
if (prospectPhone && isMobilePhone(prospectPhone) && !campagne.autoriser_mobile) {
  console.error('[DIALER] Appel bloqué : numéro mobile détecté', prospectPhone);
  return; // Bloque l'appel
}
```

---

## Architecture — Layering Strict

Le flux de données et les dépendances entre couches **DOIVENT** respecter cet ordre strict :

```
services → types → models → context → hooks → components → layouts
```

`views` n'est **pas** une couche de cette chaîne : `src/views/` est uniquement le dossier conteneur de `components/` et `layouts/`.

**Règle absolue** : une couche ne peut dépendre que des couches à sa gauche (ou de la sienne). Toute dépendance inverse est interdite.

| Couche | Rôle | Peut importer | Ne peut PAS importer |
|--------|------|---------------|----------------------|
| **services** | Appels API, communication avec olympe | `types`, `models`, `apiHelpers`, `APICalls` | `context`, `hooks`, `components`, `layouts` |
| **types** | Interfaces TypeScript pures | Rien (aucune dépendance interne) | Tout le reste |
| **models** | Classes domaine (UserModel, ProspectModel) | `types` | `services`, `context`, `hooks`, `components`, `layouts` |
| **context** | État global React (providers) | `types`, `models`, `services` | `hooks`, `components`, `layouts` |
| **hooks** | Logique réutilisable, abstraction des contexts | `types`, `models`, `services`, `context` | `components`, `layouts` |
| **components** | UI réutilisable (boutons, cartes, modals) | `types`, `hooks` | `layouts`, `services` (accès API via hooks uniquement) |
| **layouts** | Pages complètes (DashboardPage, LandingPage) | `types`, `hooks`, `components` | `services` (accès API via hooks uniquement), `context` (via hooks uniquement) |

### Imports et exports centralisés

- Chaque dossier architectural expose son API publique depuis son `index.ts` : services, types, models, context, hooks, components et layouts.
- Tout import provenant d'un autre dossier passe par cet `index.ts`; les imports profonds vers un fichier d'implémentation sont interdits.
- Chaque module public est réexporté une seule fois par le barrel de sa couche. Ne pas disperser les réexports dans des fichiers métier.
- Les dossiers de composants et layouts suivent aussi cette règle : `index.ts` local au module, puis agrégation dans `src/views/components/index.ts` ou `src/views/layouts/index.ts`.
- Un component ou un layout n'importe jamais un service, même indirectement par un chemin profond. Il consomme uniquement les hooks et contrats publics prévus par la chaîne d'architecture.

### Sécurité des dépendances et compatibilité dialer

- Les mises à jour de sécurité doivent être validées par les tests unitaires, le build et les parcours Playwright du dialer; ne jamais utiliser `npm audit fix --force` sans analyser les ruptures proposées.
- Le SDK Twilio dépend directement du paquet navigateur `events`. Vite le résout depuis cette dépendance explicite; ne pas réintroduire `vite-plugin-node-polyfills` sans démontrer un besoin runtime précis et sans réauditer sa chaîne cryptographique.
- Conserver les dépendances navigateur explicites nécessaires au SDK et valider toute évolution sur les appels automatiques, manuels et de rappel.

### Serveurs de développement locaux

- USV écoute de façon déterministe sur `127.0.0.1:5173` et Script sur `127.0.0.1:5174`; les deux configurations utilisent `strictPort: true` pour rendre tout conflit explicite.

### Exemples concrets

**Correct** — un component appelle un hook :
```typescript
// components/historiqueAppels/HistoriqueAppels.tsx
const { appels, loadAppels } = useProspect();  // ✅ hook → context → service
```

**Incorrect** — un component appelle directement un service :
```typescript
// ❌ MAUVAIS — le component bypass le hook et le context
const result = await prospectService.loadAppels(prospectId);
```

**Correct** — un hook utilise un service via le context :
```typescript
// hooks/useProspect.ts → ProspectProvider → ProspectService
// Le hook expose loadAppels(), le component n'a qu'à appeler le hook
```

### Règles absolues

#### 1. AUCUNE logique métier dans les views

Les `components/` et `layouts/` placés sous `src/views/` sont des couches de **présentation pure**. Ils ne contiennent **aucune** logique métier — pas d'appels API, pas de calculs, validations ou transformations métier, pas d'orchestration de workflow et pas de gestion d'état complexe. Toute logique doit être encapsulée dans un hook; les handlers de la vue se limitent à déléguer aux actions exposées par ce hook.

```typescript
// ❌ INTERDIT — logique métier dans un component
const handleSearch = async () => {
  const cleaned = cleanAndValidatePhone(searchQuery);
  if (!cleaned) { setError('Numéro invalide'); return; }
  const prospect = await prospectService.getProspectByPhone(cleaned);
  navigate(`/prospect/${prospect.toJSON().id_prospect}`);
};

// ✅ CORRECT — logique déplacée dans un hook
// hooks/useDashboardData.ts
export function useManualSearch() {
  // ... toute la logique ici
}

// components/searchBar/SearchBar.tsx
const { search, searchQuery, isSearching, searchError } = useManualSearch();
```

Un component/layout ne fait que :
- Appeler des hooks pour récupérer données et actions
- Rendre du JSX
- Gérer de l'état et de l'affichage purement UI (`isOpen`, `isLoading`, `error`)
- Déléguer les événements utilisateur aux actions fournies par les hooks

#### 2. Principes SOLID

| Principe | Application dans le projet |
|----------|---------------------------|
| **S** — Single Responsibility | Un fichier = une responsabilité. Un hook = un domaine métier. Un service = une entité API. |
| **O** — Open/Closed | Étendre via composition plutôt que modification. Créer un nouveau hook plutôt que modifier un existant. |
| **L** — Liskov Substitution | Les models (`ProspectModel`, `UserModel`) doivent être substituables à leurs interfaces de base. |
| **I** — Interface Segregation | Préférer des interfaces ciblées (ex: `LoginCredentials` plutôt qu'un gros `UserPayload`). |
| **D** — Dependency Inversion | Les components dépendent d'abstractions (hooks), pas d'implémentations (services directement). |

#### 3. Éviter les Single Point of Failure

- **Pas de god-object** : un context/hook ne doit pas tout gérer. Si `ProspectContext` grossit trop, scinder en sous-domaines.
- **Error boundaries** : chaque zone critique doit être encapsulée dans un `ErrorBoundary` pour éviter qu'une erreur ne casse toute l'app.
- **Graceful degradation** : si un service échoue, l'app ne doit pas crasher. Toujours fournir un fallback UI (message d'erreur, état vide).
- **Isolation des erreurs** : un bug dans le dialer ne doit pas empêcher la consultation d'un prospect.

#### 4. Typage strict et fort — AUCUN `any`

Le type `any` est **strictement interdit**. Chaque variable, paramètre, retour de fonction doit être explicitement typé.

```typescript
// ❌ INTERDIT
const data: any = response.data;
function handleSubmit(values: any) { ... }

// ✅ CORRECT
const data: Prospect = response.data;
function handleSubmit(values: CreateVenteData): Promise<Vente> { ... }
```

Règles :
- Toujours typer les paramètres et retours de fonctions
- Utiliser des interfaces définies dans `utils/types/`
- Utiliser des generics pour les fonctions utilitaires (`ApiResponse<T>`)
- Préférer `unknown` à `any` pour les cas où le type est réellement inconnu, puis utiliser des type guards

#### 5. DRY et fonctions génériques

- Une règle métier ou transformation partagée ne doit avoir qu'une seule implémentation.
- Avant de créer un helper, rechercher une implémentation existante et la réutiliser ou la généraliser.
- Les fonctions réellement génériques et transverses vivent dans `src/utils/scripts/utils.tsx`.
- Les helpers propres à un domaine restent dans un fichier nommé pour ce domaine sous `src/utils/scripts/`; `utils.tsx` ne doit pas devenir un fourre-tout.

#### 6. Emplacement unique des vues

- Tous les composants React vivent sous `src/views/components/`.
- Tous les layouts et pages vivent sous `src/views/layouts/`.
- Les dossiers `src/components/` et `src/layouts/` sont interdits.
- En cas de doublon hérité d'un refactor, vérifier les imports réels et l'historique Git, conserver la version active la plus récente, la ranger sous `src/views/`, puis supprimer l'autre version et corriger tous les imports.

### Pourquoi cet ordre et ces règles ?

1. **Séparation des responsabilités** : chaque couche a un rôle unique et clair
2. **Testabilité** : les services et models sont testables sans React
3. **Réutilisabilité** : les hooks centralisent la logique métier, les components restent purs
4. **Maintenabilité** : un changement API n'impacte que les services, pas les components
5. **Cohérence** : tout le code existant suit ce pattern — le nouveau code doit faire de même
6. **Robustesse** : pas de SPOF, erreur isolée, typage fort = moins de bugs en production

---

## BtoB vs BtoC — Important

ANTL est une activité de **prospection commerciale BtoB (Business-to-Business)**. Cette distinction est cruciale pour comprendre les règles applicables.

### Type d'activité

| Aspect | ANTL (BtoB) | BtoC (Particuliers) |
|--------|---------------|---------------------|
| **Cible** | Entreprises, professionnels | Particuliers |
| **Numéros appelés** | Fixes uniquement (06/07 interdits) | Fixes + mobiles |
| **Restrictions horaires légales** | **AUCUNE** (appels possibles 24/7) | Lun-ven 10h-20h, sam 10h-17h, dimanche interdit |
| **Jours fériés** | Autorisé (évité par courtoisie) | Interdit |
| **Régulation** | Code de conduite professionnel | Loi禁 quincaea (2014) + ARCEP |
| **Bloctel** | Liste d'opposition BtoB (différente) | Liste d'opposition BtoC |

### Impact sur le code

**Ce qui n'est PAS applicable à ANTL** :
- ❌ Restrictions d'horaire de démarchage (lun-ven 10h-20h, sam 10h-17h)
- ❌ Interdiction du dimanche
- ❌ Interdiction des jours fériés
- ❌ Bloctel BtoC (liste opposants particuliers)

**Ce qui EST applicable** :
- ✅ Filtrage des numéros mobiles (06/07) — ANTL n'appelle que des fixes
- ✅ Vérification Bloctel BtoB (liste opposants professionnels) — à intégrer
- ✅ Courtoisie professionnelle (éviter appels tardifs, dimanches, fériés) — non bloquant

### Fichiers concernés

- `src/views/components/dialerStatus/DialerStatus.tsx` — Plus de vérification d'horaire
- `src/views/layouts/dashboardPage/DashboardPage.tsx` — Plus de vérification d'horaire
- `src/utils/` — Les fonctions de validation existent mais ne bloquent pas

---

## Project Overview

**Name**: script
**Version**: 0.0.0
**Description**: React frontend for telephone sales agents — the vendor script interface for ANTL call center
**Author**: Nicolas DECRESSAC <n.decressac@antl.fr>

### Business Context

Script is the agent-facing application used by télévendeurs during their calls. It provides:
- Prospect file consultation and editing
- Integrated dialer (Twilio Voice SDK + WebRTC)
- Call closing (result recording)
- Product catalog browsing and multi-product cart
- Order confirmation with email quote
- Appointment scheduling (rappels téléphoniques)
- Objections and call plans per campaign
- Dashboard with stats, reminders, notifications

### Technical Stack

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Framework | React | ^19.2.0 | UI library |
| Language | TypeScript | ~5.9.3 | Type safety |
| Build | Vite | ^7.2.4 | Dev server + bundler |
| Routing | react-router-dom | ^7.10.1 | Client-side routing |
| HTTP | Axios | ^1.13.2 | API client |
| Dialer | @twilio/voice-sdk | ^2.18.3 | WebRTC Voice calls |
| Forms | react-select | ^5.10.2 | Select components (no native `<select>`) |
| Calendar | react-big-calendar | ^1.19.4 | Appointment calendar |
| Icons | react-icons | ^5.5.0 | Icon library |
| Dates | date-fns | ^4.1.0 | Date manipulation |
| Styling | sass-embedded | ^1.93.3 | SCSS preprocessing |
| Error Tracking | @sentry/react | ^10.47.0 | Production error monitoring |
| Testing | Playwright | ^1.58.2 | E2E tests |

---

## Setup Commands

```bash
cd script
npm install
npm run dev          # Vite dev server, port 5173
npm run build        # tsc -b && vite build
npm run preview      # Preview production build
npm run lint         # ESLint
npx playwright test  # E2E tests
```

### Environment Variables

```
VITE_API_BASE_URL=http://localhost:8800/api
VITE_SENTRY_DSN=               # optional
VITE_TURN_URL=                 # optional TURN server
VITE_TURN_USERNAME=
VITE_TURN_CREDENTIAL=
```

---

## Project Structure

```
script/
├── src/
│   ├── main.tsx                    # Entry point — Provider tree + Sentry init
│   ├── App.tsx                     # Router + routes
│   │
│   ├── API/                        # API layer (singleton services)
│   │   ├── config.ts               # Axios instance (ApiClient singleton, interceptors, token refresh)
│   │   ├── APICalls.tsx            # Generic HTTP methods with retry (get/post/put/patch/delete)
│   │   ├── apiHelpers.ts           # throwIfApiError, extractPaginatedData
│   │   ├── models/                 # Domain models (UserModel, ProspectModel, CampaignModel, ProduitModel)
│   │   │   └── index.ts            # Re-exports
│   │   └── services/               # API services (singleton pattern)
│   │       ├── User.service.ts     # Auth: login, logout, refresh, me
│   │       ├── Prospect.service.ts # Prospect CRUD + phone search + doublon/optout
│   │       ├── Campaign.service.ts # Campaigns + produits + objections + plan appel
│   │       ├── Produit.service.ts  # Products + categories
│   │       ├── Categorie.service.ts # Category tree
│   │       ├── Appel.service.ts    # Calls CRUD + terminer
│   │       ├── Vente.service.ts    # Sales CRUD
│   │       ├── RendezVous.service.ts # Appointments CRUD
│   │       ├── Dialer.service.ts   # Dialer statut, SIP creds, next-prospect, heartbeat
│   │       ├── Closing.service.ts  # Pending closing state (localStorage)
│   │       ├── Notification.service.ts # Notifications
│   │       ├── Stats.service.ts    # Dashboard stats + primes
│   │       └── index.ts            # Re-exports
│   │
│   ├── context/                    # React Contexts (7 contexts)
│   │   ├── userContext/            # UserContext — auth state, login/logout/refresh
│   │   ├── dialerContext/          # DialerContext — SIP state, call/hangup/answer, statut, prochainProspect
│   │   ├── prospectContext/        # ProspectContext — current prospect, appels, ventes
│   │   ├── campaignContext/        # CampaignContext — current campaign, produits, categories
│   │   ├── cartContext/            # CartContext — panier multi-produits, add/remove/update
│   │   ├── appContext/             # AppContext — modals, views, notifications, loading
│   │   ├── toastContext/           # ToastContext — toast notifications, confirm dialogs
│   │   └── index.ts                # Re-exports
│   │
│   ├── hooks/                      # Custom hooks (all via createContextHook pattern)
│   │   ├── createContextHook.ts    # Factory for typed context hooks
│   │   ├── useUser.ts             # → UserContext
│   │   ├── useDialer.ts           # → DialerContext
│   │   ├── useProspect.ts         # → ProspectContext
│   │   ├── useCampaign.ts         # → CampaignContext
│   │   ├── useCart.ts             # → CartContext
│   │   ├── useApp.ts              # → AppContext
│   │   ├── useToast.ts            # → ToastContext
│   │   ├── useLoginForm.ts        # Login form logic (validation, rate limiting)
│   │   ├── useRendezVous.ts       # Calendar events from RendezVous
│   │   ├── useDashboardData.ts    # Dashboard data loading
│   │   ├── useDashboardPage.ts    # Dashboard orchestration (runtime campaign, queue, navigation, UI state)
│   │   ├── useLandingPage.ts      # Landing page orchestration
│   │   ├── useCallClosing.ts      # Call closing flow
│   │   ├── useOrderConfirmation.ts # Order confirmation flow
│   │   ├── useProspectAppels.ts   # Prospect call history
│   │   ├── useProspectVentes.ts   # Prospect sales history
│   │   └── index.ts                # Re-exports
│   │
│   ├── utils/
│   │   ├── types/                  # TypeScript type definitions (13 files)
│   │   │   ├── user.types.ts      # Employe, LoginCredentials, LoginResponse, Poste, Departement
│   │   │   ├── prospect.types.ts  # Prospect, ProspectType, ProspectStatut, TypeFiche, UpdateProspectData
│   │   │   ├── dialer.types.ts    # StatutDialer, RaisonPause, SipCredentials, ProspectAssigne
│   │   │   ├── campaign.types.ts  # Campaign, TypeCampagne, AgentCampagne
│   │   │   ├── cart.types.ts      # Produit, CategorieProduit, CartItem, Tarif
│   │   │   ├── appel.types.ts     # Appel, StatutAppel, OrigineAppel, CreateAppelData, TerminerAppelData
│   │   │   ├── vente.types.ts     # Vente, DetailVente, StatutVente, ModePaiement
│   │   │   ├── rendezVous.types.ts # RendezVous, CalendarEvent, CreateRendezVousData
│   │   │   ├── objection.types.ts # Objection, ObjectionsByCategorie
│   │   │   ├── planAppel.types.ts # PlanAppelEtape
│   │   │   ├── notification.types.ts # Notification, NotificationType
│   │   │   ├── stats.types.ts     # StatsDuJour, PrimeStats, SeuilPrimeStats
│   │   │   ├── api.types.ts       # ApiResponse, ApiError, PaginatedResponse, Pagination
│   │   │   └── index.ts           # Re-exports all
│   │   ├── constants/              # App constants
│   │   │   ├── appel.constants.ts
│   │   │   ├── calendar.constants.ts
│   │   │   ├── objection.constants.ts
│   │   │   └── index.ts
│   │   ├── scripts/                # Utility functions
│   │   │   ├── formatters.ts      # Date/time/phone/currency formatting
│   │   │   ├── orderValidation.ts  # Order form validation
│   │   │   └── utils.tsx           # Misc helpers (salutation, typeFiche, buildQueryString)
│   │   └── styles/                 # Global SCSS
│   │       ├── reset.scss          # Full CSS reset
│   │       ├── global.scss         # Base styles (imports reset + variables)
│   │       ├── _variables.scss     # All SCSS variables
│   │       └── _mixins.scss        # All SCSS mixins
│   │
│   ├── views/
│   │   ├── components/             # Reusable UI components
│   │   │   ├── header/             # Header with logo, title, DialerStatus, logout
│   │   │   ├── button/             # Button component (variant + size props)
│   │   │   ├── input/              # Input component with label + error
│   │   │   ├── loader/             # Loader spinner
│   │   │   ├── errorMessage/       # Error banner with close
│   │   │   ├── toast/              # ToastContainer + Toast
│   │   │   ├── confirmModal/       # Confirm dialog
│   │   │   ├── dialerStatus/       # Dialer statut indicator
│   │   │   ├── incomingCallBanner/ # Incoming call notification banner
│   │   │   ├── prospectInfoHeader/ # Prospect info header (name, type badge)
│   │   │   ├── actionButtons/      # Action buttons row (histo, rdv, commande, etc.)
│   │   │   ├── typeFicheBadge/     # Type de fiche colored badge
│   │   │   ├── historiqueAppels/   # Call history list with AppelCard
│   │   │   ├── historiqueVentes/   # Sales history list with VenteCard
│   │   │   ├── catalogueProduits/  # Product catalog (CategoryTree + ProduitCard)
│   │   │   ├── panier/             # Cart (Panier + PanierItem)
│   │   │   ├── rendezVous/         # Appointment calendar
│   │   │   ├── rendezVousModal/    # Appointment creation modal
│   │   │   ├── closingModal/       # Call closing modal (result recording)
│   │   │   ├── confirmOrderModal/  # Order confirmation modal
│   │   │   ├── calendarTooltip/    # Calendar event tooltip
│   │   │   ├── primeGauge/         # Jauge de prime vente ou Lead B2B
│   │   │   ├── clock/              # Clock display
│   │   │   ├── quiEstCe/           # "Who is this?" popup
│   │   │   ├── quiSommesNous/      # "Who are we?" popup
│   │   │   ├── protectedRoute/     # Auth guard component
│   │   │   ├── errorBoundary/      # React error boundary
│   │   │   └── footer/             # Footer (minimal)
│   │   └── layouts/                # Page layouts
│   │       ├── loginPage/          # Login page
│   │       ├── dashboardPage/      # Dashboard (search, RDV du jour, stats, gauge)
│   │       ├── landingPage/        # Prospect file page (main workspace)
│   │       ├── planAppelPage/      # Call plan stepper
│   │       └── objectionsPage/     # Objections browser
│   │
│   └── assets/
│       └── antlLogo.png
│
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
└── tsconfig.app.json
```

---

## Architecture

### Provider Tree (main.tsx)

```
<StrictMode>
  <ErrorBoundary>
    <AppProvider>           ← modals, views, app loading
      <UserProvider>        ← auth state, login/logout
        <DialerProvider>    ← SIP, statut, prochainProspect
          <CampaignProvider> ← current campaign, produits
            <ProspectProvider> ← current prospect, appels, ventes
              <CartProvider>   ← panier multi-produits
                <ToastProvider> ← toast notifications, confirm
                  <App />
                </ToastProvider>
              </CartProvider>
            </ProspectProvider>
          </CampaignProvider>
        </DialerProvider>
      </UserProvider>
    </AppProvider>
  </ErrorBoundary>
</StrictMode>
```

### Routes (App.tsx)

| Path | Component | Auth | Description |
|------|-----------|------|-------------|
| `/login` | LoginPage | No | Login page |
| `/` | DashboardPage | Yes | Dashboard with search, RDV, stats |
| `/prospect/:id` | LandingPage | Yes | Prospect file (main workspace) |
| `/plan-appel` | PlanAppelPage | Yes | Call plan stepper (?campagne=ID) |
| `/objections` | ObjectionsPage | Yes | Objections browser (?campagne=ID) |

### Context Hook Pattern

All context hooks use `createContextHook` factory for type safety:

```typescript
// hooks/createContextHook.ts
export function createContextHook<T>(
  ContextObject: Context<T | undefined>,
  hookName: string,
  providerName: string
): () => T
```

Usage: `const { user } = useUser();` — throws if used outside Provider.

### API Layer Pattern

All services follow the singleton pattern:

```typescript
export class XxxService {
  private static instance: XxxService;
  private constructor() {}
  public static getInstance(): XxxService { ... }
}
export const xxxService = XxxService.getInstance();
```

- **APICalls** (`apiCalls`): Generic HTTP wrapper with retry (3 attempts on network errors)
- **apiHelpers**: `throwIfApiError<T>()` validates `ApiResponse.success` and returns typed data
- **API Models**: `UserModel`, `ProspectModel`, `CampaignModel`, `ProduitModel` — domain models with `fromJSON()`, `toJSON()`, `saveToLocalStorage()`

### Authentication Flow

1. **Login** → `POST /api/auth/login` → JWT stored in httpOnly cookie + `session_active` readable cookie
2. **API calls** → `withCredentials: true` sends cookies automatically (no Bearer token injection)
3. **401 interception** → Auto-refresh via `POST /api/auth/refresh` → retry original request
4. **Session check** → `document.cookie` for `session_active=`
5. **Logout** → `POST /api/auth/logout` → server clears cookies → client clears localStorage

---

## Dialer Integration

### DialerContext (DialerProvider)

The dialer is fully integrated into the React context tree. It manages:

- **Twilio connection**: Twilio `Device` initialized using temporary Access Tokens from `GET /api/twilio/token`
- **Statut agent**: `disponible | en_appel | appel_sortant | pause_apres_appel | pause | hors_ligne`
- **3 call origins** (all trigger real Twilio WebRTC calls):
  - `auto` — queue pushes next prospect automatically
  - `manuel` — agent searches by phone number
  - `rappel` — agent opens a scheduled reminder
- **Call flow**: `call(phone, campagneId, prospectId)` → `device.connect({ params: { To } })` → WebRTC → Twilio
- **Timer**: Starts on `callConnected` state, stops on `callEnded` or `disconnect`, duration sent via `terminerAppel`

### Dashboard → Prospect Flow

```
Agent clicks "disponible"
  → DialerService.changerStatut('disponible')
  → DialerService.getNextProspect()
  → DialerContext stores prochainProspect
  → DashboardPage useEffect detects prochainProspect
  → navigate(/prospect/:id) + call(phone, campagneId, prospectId)
```

### Call Closing (Mandatory)

After every call, the agent must record a result (statut_appel, notes). This is enforced by:
- `ClosingService` stores pending closing in localStorage
- Logout is blocked if a closing is pending
- `ClosingModal` is shown automatically when call ends

---

## TypeScript Types

All types are in `src/utils/types/` and re-exported from `index.ts`.

### Key Types

| Type | File | Description |
|------|------|-------------|
| `Employe` | user.types.ts | Agent/employee with Poste, Departement |
| `Prospect` | prospect.types.ts | Full prospect data |
| `ProspectStatut` | prospect.types.ts | `'nouveau' \| 'contacte' \| 'interesse' \| 'rappel' \| 'non_interesse' \| 'vente_conclue'` |
| `TypeFiche` | prospect.types.ts | `'jamais_appele' \| 'deja_appele' \| 'recycle' \| 'client'` |
| `StatutDialer` | dialer.types.ts | `'disponible' \| 'en_appel' \| 'appel_sortant' \| 'pause_apres_appel' \| 'pause' \| 'hors_ligne'` |
| `OrigineAppel` | appel.types.ts | `'auto' \| 'manuel' \| 'rappel'` |
| `StatutAppel` | appel.types.ts | `'en_cours' \| 'abouti' \| 'non_abouti' \| ... \| 'refus_definitif'` |
| `Vente` | vente.types.ts | Sale with DetailVente[] |
| `RendezVous` | rendezVous.types.ts | Appointment with prospect relation |
| `Produit` | cart.types.ts | Product with Tarif |
| `CategorieProduit` | cart.types.ts | Category with tree structure (sousCategories) |
| `StatsDuJour` | stats.types.ts | Daily stats + PrimeStats with paliers |
| `Notification` | notification.types.ts | Notification with rendezVous relation |

---

## SCSS Design System

### Variables (`_variables.scss`)

| Category | Key Variables |
|----------|---------------|
| **Colors** | `$colorPrimary` (#7c3aed), `$colorSecondary`, `$colorSuccess`, `$colorWarning`, `$colorDanger` |
| **Type Fiche** | `$colorJamaisAppele` (#34c759), `$colorDejaAppele` (#ff9500), `$colorRecycle` (#007aff), `$colorClient` (#5e5ce6) |
| **Grayscale** | `$colorBlack` → `$colorWhite` (7 shades) |
| **Spacing** | `$spacing-xs` (4px) → `$spacing-3xl` (64px) |
| **Radius** | `$radius-sm` (4px) → `$radius-full` (9999px) |
| **Shadows** | `$shadow-sm` → `$shadow-xl` |
| **Transitions** | `$transition-fast` (150ms), `$transition-base` (200ms), `$transition-slow` (300ms) |
| **Breakpoints** | `$breakpoint-xs` (480px) → `$breakpoint-2xl` (1536px) |
| **Z-index** | `$z-dropdown` (1000) → `$z-tooltip` (1070) |
| **Typography** | `$fontSize-xs` (12px) → `$fontSize-4xl` (36px), `$fontWeight-light` → `$fontWeight-bold` |
| **Fonts** | `$fontFamilyPrimary` (Inter), `$fontFamilyMono` (Fira Code) |

### Mixins (`_mixins.scss`)

| Mixin | Purpose |
|-------|---------|
| `responsive($breakpoint)` | Media query shorthand (xs/sm/md/lg/xl/2xl) |
| `flex-center` | Center flex (align + justify) |
| `flex-between` | Space-between flex |
| `flex-column` | Column flex |
| `button-base` | Base button styles with disabled state |
| `card` | Card with bg, radius, shadow |
| `transition($property, $duration)` | Transition shorthand |
| `truncate` | Text ellipsis |
| `line-clamp($lines)` | Multi-line clamp |
| `absolute-center` | Absolute centering |
| `hide-scrollbar` | Hide scrollbar cross-browser |
| `custom-scrollbar($width, $track, $thumb)` | Styled scrollbar |
| `focus-ring($color)` | Focus ring |

### SCSS Conventions

- **No `@import`** — Only `@use` (deprecated)
- **No CSS Grid** — Flexbox only
- **Trois niveaux maximum** — aucun sélecteur ne doit dépasser trois niveaux d'imbrication
- **Aucune esperluette** — `&` est interdit pour construire ou modifier les classes SCSS; écrire les sélecteurs de classe explicitement
- **Mobile First** — Base styles = mobile, `@media (min-width: ...)` for larger
- **Dimensions**: `rem` for spacing/sizes, `px` for borders/radius
- **Viewport**: `dvh`/`dvw` instead of `vh`/`vw`
- **Gap over margin**: Use `gap` on flex containers, avoid directional margins
- **Root `#root`**: `height: 100dvh; display: flex; flex-direction: column; overflow: hidden;`
- **BEM under IDs**: Use explicit class selectors, never `&__element` under `#id`

```scss
// CORRECT
#landingPage {
  .landing-page__container {
    display: flex;
  }
}

// INCORRECT — generates #landingPage__container (invalid ID selector)
#landingPage {
  // INTERDIT : écrire explicitement .landing-page__container
}
```

---

## Code Style Rules

### TypeScript
- **No `any` type** — Always type explicitly
- **Type files** in `utils/types/*.types.ts`, re-exported from `index.ts`
- **No business logic in views** — Strict layering: `services → types → models → context → hooks → components → layouts`

### Components
- **No native `<select>`** — Always use `react-select` `<Select>` component
- **Button component** — Use `<Button variant="..." size="...">` for all actions
- **Input component** — Use `<Input>` from `views/components/input/Input.tsx` with label + error props
- **Component file structure**: One folder per component with `.tsx` + `.scss`
- **Root element ID**: Each layout/page has a unique `id` attribute matching the component name

### File Naming
- **Components**: PascalCase folder (`catalogueProduits/`) with PascalCase `.tsx` + camelCase `.scss`
- **Services**: PascalCase class (`UserService`) in PascalCase file (`User.service.ts`)
- **Types**: camelCase file (`dialer.types.ts`) with PascalCase interfaces
- **Hooks**: camelCase file (`useDialer.ts`) with camelCase export

### State Management Pattern
- **Global state**: React Context (7 contexts)
- **API state**: Fetched via services, stored in contexts
- **Form state**: Local `useState` in hooks
- **Pending state**: `ClosingService` uses localStorage for closing persistence

---

## Important Patterns

### View Types (AppContext)

The `currentView` state in `AppContext` controls which sub-view is displayed in LandingPage:

```typescript
type ViewType = 'qui-est-ce' | 'qui-sommes-nous' | 'historique-appels' | 'historique-offres' | 'rendez-vous' | 'commande';
```

### Modal Types (AppContext)

```typescript
type ModalType = 'qui-est-ce' | 'qui-sommes-nous' | 'objections' | 'plan-appel' | null;
```

### Toast Notifications (ToastContext)

```typescript
const { showToast } = useToast();
showToast('success', 'Commande enregistree');
showToast('error', 'Erreur lors de la sauvegarde');
```

### Confirm Dialog (ToastContext)

```typescript
const { confirm } = useToast();
const ok = await confirm({
  title: 'Confirmer',
  message: 'Etes-vous sur ?',
  type: 'warning',
  confirmText: 'Oui',
  cancelText: 'Non',
});
```

---

## Critical Notes for Agents

### 1. Products Belong to Campaigns

Products are **not global** — they are defined per campaign via `campagnes_produits` junction table. When loading products, always pass `id_campagne`.

### 2. Call Closing is Mandatory

After every call, the agent must record a result. `ClosingService` blocks logout if a closing is pending. Never bypass this.

### 3. 3 Call Origins

All 3 origins (`auto`, `manuel`, `rappel`) trigger a real SIP call. The `origine_appel` field is stored in `campagnes.appels`.

### 4. Session Cookie

Auth uses httpOnly cookies (`authToken`, `refreshToken`) + a readable `session_active` cookie. No Bearer token injection in headers — `withCredentials: true` handles it.

### 5. Phone Number Formatting

Phone numbers must be cleaned before search (`cleanAndValidatePhone`) and formatted to E.164 for SIP calls (`formatPhoneE164`).

### 6. Prospect Type Fiche

The badge color depends on prospect status:
- `jamais_appele` → green (#34c759)
- `deja_appele` → orange (#ff9500)
- `recycle` → blue (#007aff)
- `client` → purple (#5e5ce6)

---

## Important Files Reference

### Core Files

| File | Purpose |
|------|---------|
| `src/main.tsx` | Entry point, provider tree |
| `src/App.tsx` | Router + routes |
| `src/API/config.ts` | Axios instance, interceptors |
| `src/API/APICalls.tsx` | HTTP methods with retry |
| `src/utils/styles/_variables.scss` | All SCSS variables |
| `src/utils/styles/_mixins.scss` | All SCSS mixins |

### Context Files

| File | Context |
|------|---------|
| `src/context/userContext/` | Auth state |
| `src/context/dialerContext/` | SIP, statut, calls |
| `src/context/prospectContext/` | Prospect, appels, ventes |
| `src/context/campaignContext/` | Campaign, produits |
| `src/context/cartContext/` | Panier |
| `src/context/appContext/` | Modals, views |
| `src/context/toastContext/` | Toasts, confirm |

### Service Files

| File | Endpoints |
|------|-----------|
| `src/API/services/User.service.ts` | `/api/auth/*` |
| `src/API/services/Dialer.service.ts` | `/api/agents/me/*` |
| `src/API/services/Prospect.service.ts` | `/api/prospects/*` |
| `src/API/services/Campaign.service.ts` | `/api/campagnes/*` |
| `src/API/services/Appel.service.ts` | `/api/appels/*` |
| `src/API/services/Vente.service.ts` | `/api/ventes/*` |
| `src/API/services/RendezVous.service.ts` | `/api/rendez-vous/*` |
| `src/API/services/Produit.service.ts` | `/api/produits/*` |
| `src/API/services/Stats.service.ts` | `/api/stats/*` |

---

## 📁 Services API Complets

### User.service.ts

```typescript
class UserService {
  login(credentials: LoginCredentials): Promise<LoginResponse>
  logout(): Promise<void>
  me(): Promise<Employe>
  refresh(): Promise<LoginResponse>
  openTestSession(idCampagneActive: number): Promise<void>
  isAuthenticated(): boolean  // Vérifie session_active cookie
}
```

Le bouton `Utilisateur TEST` ne partage jamais les JWT entre `api.antl.fr` et
`api-test.antl.fr`. Il échange un ticket production aléatoire, à usage unique et
valable 60 secondes contre des cookies host-only propres à l'API de test, puis
recharge `/prospect/1?test=true`. La campagne runtime validée en production est
conservée et Twilio reste désactivé pendant ce parcours. Sur la fiche de
formation, cette campagne de session prime toujours sur les affectations de la
base test et sur toute campagne historique portée par le prospect de formation.

### Prospect.service.ts

```typescript
class ProspectService {
  getById(id: number): Promise<Prospect>
  searchByPhone(phone: string): Promise<Prospect>
  update(id: number, data: UpdateProspectData): Promise<Prospect>
  checkDoublon(nom: string, prenom: string, telephone?: string): Promise<Prospect | null>
  getOptOut(telephone: string): Promise<boolean>  // Vérifie si opt-out
}
```

### Campaign.service.ts

```typescript
class CampaignService {
  getById(id: number): Promise<Campaign>
  getTypes(): Promise<TypeCampagne[]>
  getProduits(idCampagne: number): Promise<Produit[]>
  getCategories(idCampagne: number): Promise<CategorieProduit[]>
  getObjections(idCampagne: number): Promise<ObjectionsByCategorie>
  getPlanAppel(idCampagne: number): Promise<PlanAppelEtape[]>
}
```

### Appel.service.ts

```typescript
class AppelService {
  create(data: CreateAppelData): Promise<Appel>
  getById(id: number): Promise<Appel>
  getByProspect(idProspect: number): Promise<Appel[]>
  update(id: number, data: Partial<Appel>): Promise<Appel>
  terminer(id: number, data: TerminerAppelData): Promise<Appel>
}
```

### Vente.service.ts

```typescript
class VenteService {
  create(data: Vente): Promise<Vente>
  getById(id: number): Promise<Vente>
  getByProspect(idProspect: number): Promise<Vente[]>
  update(id: number, data: Partial<Vente>): Promise<Vente>
}
```

### RendezVous.service.ts

```typescript
class RendezVousService {
  create(data: CreateRendezVousData): Promise<RendezVous>
  getById(id: number): Promise<RendezVous>
  getByAgent(idAgent: number): Promise<RendezVous[]>
  getByProspect(idProspect: number): Promise<RendezVous[]>
  update(id: number, data: Partial<RendezVous>): Promise<RendezVous>
  delete(id: number): Promise<void>
}
```

### Dialer.service.ts

```typescript
class DialerService {
  getStatut(): Promise<StatutDialer>
  changerStatut(statut: StatutDialer, raison_pause?: RaisonPause): Promise<StatutDialer>
  getNextProspect(): Promise<ProspectAssigne>
  getSipCredentials(): Promise<SipCredentials>
  heartbeat(): Promise<void>
  getCampagnes(): Promise<CampagneAgent[]>
}
```

### Notification.service.ts

```typescript
class NotificationService {
  getAll(): Promise<Notification[]>
  marquerLue(id: number): Promise<void>
  marquerToutLu(): Promise<void>
}
```

### Stats.service.ts

```typescript
class StatsService {
  getDuJour(): Promise<StatsDuJour>
  getPrimes(): Promise<PrimeStats>
}
```

---

## 🪝 Hooks Personnalisés

### useUser()

```typescript
const { user, login, logout, refresh, isAuthenticated, isLoading } = useUser();
```

### useDialer()

```typescript
const {
  sipConnected, sipReconnecting,
  statut, raisonPause,
  prochainProspect, clearProchainProspect,
  call, answer, hangup,
  changerStatut, heartBeat
} = useDialer();
```

### useProspect()

```typescript
const {
  prospect, loadProspect, updateProspect,
  appels, loadAppels, reloadAppels,
  ventes, loadVentes, reloadVentes
} = useProspect();
```

### useCampaign()

```typescript
const {
  campaign, loadCampaign,
  produits, categories, loadProduits,
  objections, planAppel
} = useCampaign(idCampagne);
```

### useCart()

```typescript
const {
  items, add, remove, update, clear, total
} = useCart();
```

### useToast()

```typescript
const { showToast, confirm } = useToast();

showToast('success', 'Message', 5000);
confirm({ title, message, type, confirmText, cancelText }): Promise<boolean>
```

### useDashboardData()

```typescript
const {
  searchQuery, setSearchQuery,
  rdvDuJour, rdvLoading,
  stats, statsLoading,
  notifications, nonLues, notifsLoading,
  handleMarquerLue, handleMarquerToutLu
} = useDashboardData();
```

### useDashboardPage()

```typescript
const {
  rendezVousItems,
  stats,
  handleSearch,
  openRendezVous,
  openTestProspect,
} = useDashboardPage();
```

Ce hook centralise l'orchestration du dashboard : synchronisation de la campagne runtime, consommation et polling de la queue, alerte de connexion faible, navigation des rappels et garde du prospect TEST. `DashboardPage.tsx` reste un layout de présentation pure.

---

## 🎨 Composants UI Réutilisables

### Button

```tsx
<Button variant="primary" size="md" onClick={handleClick}>
  Texte
</Button>

// Variants: primary, secondary, success, warning, danger, ghost
// Sizes: xs, sm, md, lg, xl
```

### Input

```tsx
<Input
  label="Nom"
  value={value}
  onChange={onChange}
  error={error}
  required
/>
```

### Select (react-select)

```tsx
<Select
  options={options}
  value={value}
  onChange={onChange}
  isMulti
  isCreatable
  placeholder="Sélectionner..."
/>
```

### Loader

```tsx
<Loader active={isLoading} />
```

### ErrorMessage

```tsx
<ErrorMessage message="Erreur" onClose={() => setError(null)} />
```

---

## 📊 Composants Métier Spécifiques

### ProspectInfoHeader

Affiche les informations du prospect en haut de la fiche :
- Nom, prénom
- Badge TypeFiche (couleur selon statut)
- Numéro de téléphone
- Statut du prospect

### HistoriqueAppels

Liste des appels du prospect avec `AppelCard` pour chaque appel :
- Date et heure
- Statut (badge coloré)
- Origine (auto/manuel/rappel)
- Durée
- Boutons pour voir les détails

### HistoriqueVentes

Liste des ventes du prospect avec `VenteCard` pour chaque vente :
- Date
- Montant total
- Statut
- Mode de paiement

### CatalogueProduits

Arbre des catégories avec `ProduitCard` pour chaque produit :
- Nom du produit
- Prix (tarif selon campagne)
- Bouton d'ajout au panier

### Panier

Liste des articles avec `PanierItem` pour chaque item :
- Produit
- Quantité
- Prix unitaire
- Total
- Boutons pour modifier/supprimer

### PrimeGauge

Jauge mensuelle pilotée par le type de campagne :
- chiffre d'affaires validé pour une campagne vente ;
- nombre de lignes `commercial.leads` produites pour une campagne Lead B2B ;
- seuils exacts 0, 75, 90 et 100 % sur l'objectif individuel.

---

## 🔔 Système de Notifications

### Toast Notifications

Affichées en bas à droite de l'écran via `ToastContainer` :
- Types: success, error, warning, info
- Durée personnalisable (défaut 5000ms)
- Icon selon le type
- Animation d'entrée/sortie

### Confirm Dialogs

Modales de confirmation via `confirm()` :
- Titre et message personnalisables
- Type (warning, danger, info)
- Textes des boutons personnalisables
- Retourne `Promise<boolean>`

### Notifications Backend

Notifications provenant du backend (`/api/notifications`) :
- Liées aux rendez-vous (rappels)
- Marquage comme lu/non lu
- Rangement automatique par date

---

## 📅 Dashboard du Vendeur

### Sections du Dashboard

1. **Recherche manuelle** : Recherche par numéro de téléphone
2. **Rappels du jour** : Liste des RDV à passer
3. **Notifications** : Notifications non lues avec badge
4. **Stats du jour** :
   - Appels total
   - Appels aboutis
   - Ventes
   - CA jour
   - RDV pris
   - Taux conversion
5. **Objectif du mois** : Jauge avec paliers de prime

### Flux de travail typique

```
1. Agent se connecte → LoginPage
2. Dashboard s'affiche → DashboardPage
3. Agent clique "Disponible" → changerStatut('disponible')
4. Prochain prospect arrive → getNextProspect()
5. Navigation automatique vers /prospect/:id
6. Appel SIP lancé automatiquement → call(phone)
7. Conversation... (timer en cours)
8. Agent raccroche → hangup()
9. Modal de clôture apparaît → ClosingModal
10. Agent enregistre le résultat → terminerAppel()
11. Prospect remis en file ou marqué traité → requeue()
```

---

## 🎯 Types Importants

### StatutDialer

```typescript
type StatutDialer =
  | 'disponible'        // Prêt à recevoir des appels
  | 'en_appel'          // En cours d'appel entrant
  | 'appel_sortant'     // Appel sortant (manuel/rappel)
  | 'pause_apres_appel' // Pause automatique après appel
  | 'pause'             // Pause (cafe, pause, technique)
  | 'hors_ligne';       // Non connecté
```

### RaisonPause

```typescript
type RaisonPause = 'cafe' | 'pause' | 'technique';
```

### OrigineAppel

```typescript
type OrigineAppel = 'auto' | 'manuel' | 'rappel';
```

### StatutAppel

```typescript
type StatutAppel =
  | 'en_cours'
  | 'abouti'
  | 'non_abouti'
  | 'occupe'
  | 'pas_de_reponse'
  | 'messagerie'
  | 'rdv_pris'
  | 'vente_conclue'
  | 'refus_definitif';
```

### TypeFiche

```typescript
type TypeFiche = 'jamais_appele' | 'deja_appele' | 'recycle' | 'client';
```

---

## 🚨 Restrictions pour les Vendeurs

### Ce qui ne doit PAS apparaître dans l'interface vendeur

- ❌ Aucun indicateur technique de santé SIP
- ❌ Aucun compteur de problèmes système
- ❌ Aucune alerte infrastructure
- ❌ Aucun détail d'erreur backend technique
- ❌ Aucune information sur les autres agents
- ❌ Aucune statistique de performance comparative

### Ce qui EST affiché aux vendeurs

- ✅ Leurs propres stats (appels, ventes, CA du jour)
- ✅ Leurs propres rappels
- ✅ Leurs propres notifications
- ✅ Leur propre progression vers l'objectif
- ✅ Informations simples et rassurantes

---

## 🔒 Sécurité Spécifique au Script

### Communication avec le Backend

- `withCredentials: true` pour envoyer les cookies httpOnly
- Pas de Bearer token dans les headers (géré par cookies)
- Interception 401 → refresh automatique via `/api/auth/refresh`
- Clear localStorage et cookies sur logout

### ClosingService (Persistence)

```typescript
class ClosingService {
  getPending(): { idAppel: number; statut: string; notes?: string } | null
  setPending(closing: ClosingData): void
  clear(): void
  hasPending(): boolean
}
```

Stocké dans `localStorage` pour survivre à un refresh de page. Bloque le logout si un closing est en attente.

Les notes de closing doivent aussi rester saisissables et conservées localement lorsqu'aucun `idAppel` n'est encore disponible (closing manuel ou état transitoire). L'absence d'identifiant interdit uniquement la persistance API immédiate ; elle ne doit jamais rendre le champ de notes inopérant ni effacer la saisie.

---

## ⚡ Performance et Optimisations

### API Calls

- Retry automatique (3 tentatives) sur erreurs réseau
- Interception 401 avec refresh token
- Cache des données dans les contexts
- Chargement lazy des données (on-demand)

### State Management

- Contexts pour état global (auth, dialer, prospect, campagne, cart)
- `useState` pour état local (formulaire, UI)
- `useRef` pour valeurs non réactives (timers, éléments DOM)

### Optimisations React

- `useMemo` pour calculs coûteux
- `useCallback` pour callbacks passés aux enfants
- `React.lazy` pour code splitting des routes
- `Suspense` pour composants chargés async

---

## 🐛 Common Issues & Solutions

### Issue: Connexion Twilio échoue

**Cause**: Problème de réseau ou expiration/invalidation du token Twilio

**Solution**:
1. Vérifier la connexion réseau
2. Rafraîchir la page ou demander un nouveau token via `fetchTwilioToken`
3. Passer l'agent en pause technique si nécessaire

### Issue: Prochain prospect n'arrive pas

**Cause**: Agent n'est pas en statut "disponible"

**Solution**:
1. Vérifier que `changerStatut('disponible')` a été appelé
2. Vérifier que l'agent a des campagnes actives
3. Vérifier que la file n'est pas vide

### Issue: ClosingModal ne s'affiche pas

**Cause**: `prochainProspect` n'est pas vidé après navigation

**Solution**: Appeler `clearProchainProspect()` dans le useEffect de DashboardPage

---

## 📝 Clause de Mise à Jour

### Adresses commerciales — 2026-09-09

- Le composant `src/views/components/addressAutocomplete` est une vue passive de `useAddressAutocomplete`. `Address.service.ts` interroge l’IGN/BAN sur `https://data.geopf.fr/geocodage/search` (domaine autorisé dans la CSP Vercel), annule les anciennes recherches et ne bloque jamais la saisie manuelle.
- Intégrations : `useQuiEstCe` / `QuiEstCe`, `useOrderConfirmation` / `ConfirmOrderModal`, `usePriseRendezVous` / `PriseRendezVousPlaceholder`. Les suggestions remplissent rue, code postal, ville et pays. La fiche prospect ne possédant pas de CP/ville de livraison séparés, sa suggestion de livraison conserve le libellé complet.
- Le payload optionnel `CreateLeadData.adresse_prospect` est envoyé uniquement si l’adresse a changé ; l’API enregistre ces données sur le prospect dans la même transaction que la création du lead. Un échec de réservation ne persiste pas l’adresse seule.
- `capitalizeAddress` normalise les valeurs envoyées : majuscule initiale de chaque mot, accents, apostrophes et sauts de ligne conservés. La même règle est appliquée par Olympe. La capitalisation n’est pas un effet CSS.
- La gouttière d’icône est protégée contre les styles des formulaires historiques. Tests : `addressService.test.ts`, `orderValidation.test.ts`, parcours navigateur `mma-rendez-vous-flow.spec.ts`.
- Ne pas modifier les snapshots de contact, la campagne runtime ni le closing dans le cadre d’une correction d’adresse.

### Quand mettre à jour ce fichier

Ce fichier AGENTS.md doit être mis à jour dans les cas suivants :

1. **Nouveau service API créé** :
   - Ajouter dans "Services API Complets"
   - Documenter les méthodes avec signatures TypeScript
   - Noter les endpoints utilisés

2. **Nouveau hook créé** :
   - Ajouter dans "Hooks Personnalisés"
   - Décrire les paramètres et retours
   - Donner un exemple d'utilisation

3. **Nouveau composant UI créé** :
   - Ajouter dans "Composants UI Réutilisables" ou "Composants Métier"
   - Décrire les props principales
   - Donner un exemple d'utilisation

4. **Changement de flux de travail** :
   - Mettre à jour "Flux de travail typique"
   - Documenter les nouvelles étapes
   - Mettre à jour les schémas si nécessaire

5. **Nouveau type créé** :
   - Ajouter dans "Types Importants"
   - Définir toutes les valeurs possibles
   - Donner un exemple d'utilisation

6. **Changement de design system** :
   - Mettre à jour les variables SCSS
   - Ajouter les nouveaux composants
   - Mettre à jour les exemples

### Comment mettre à jour

1. Ajouter une entrée dans le tableau d'historique en bas du fichier
2. Modifier les sections concernées
3. Maintenir la cohérence avec les autres fichiers AGENTS.md (olympe, USV)
4. Vérifier que les exemples de code sont encore valides

---

## 📝 Historique

| Date | Modification | Auteur |
|------|--------------|--------|
| 2026-09-07 | Jauge de prime unifiée vente/Lead B2B, objectifs individuels et seuils exacts 0/75/90/100 | AI Agent |
| 2026-04-23 | Ajout Sprint C : UX erreurs bloquantes, surveillance ICE, stats WebRTC, timeout SIP | AI Agent |
| 2026-04-23 | Ajout services API complets, hooks, composants métier, flux vendeur, restrictions | AI Agent |
| 2026-04-23 | Création AGENTS.md pour Script frontend | AI Agent |

---

## 📝 Historique

| Date | Modification | Auteur |
|------|--------------|--------|
| 2026-08-03 | Priorité absolue à la campagne runtime certifiée pour `Utilisateur TEST`, même sans affectation locale identique dans la base test | AI Agent |
| 2026-07-30 | Session isolée et sécurisée pour le parcours `Utilisateur TEST`, avec conservation de la campagne runtime et Twilio désactivé | AI Agent |
| 2026-07-20 | Verrouillage du serveur Vite Script sur `127.0.0.1:5174` afin de coexister avec USV sur 5173 | AI Agent |
| 2026-07-20 | Mise à jour des dépendances vulnérables et retrait du plugin de polyfills inutile après validation de la résolution `events` du SDK Twilio | AI Agent |
| 2026-07-18 | Correction et couverture du brouillon de notes pour les closings manuels sans idAppel | AI Agent |
| 2026-07-17 | Extraction de l'orchestration de DashboardPage vers useDashboardPage et helpers testables | AI Agent |
| 2026-04-25 | Contexte métier global : flux agent complet (dispo manuel, closing obligatoire, RDV manuel), vente sans CB | AI Agent |
| 2026-04-23 | Ajout Sprint C : UX erreurs bloquantes, surveillance ICE, stats WebRTC, timeout SIP | AI Agent |
| 2026-04-23 | Ajout services API complets, hooks, composants métier, flux vendeur, restrictions | AI Agent |
| 2026-04-23 | Création AGENTS.md pour Script frontend | AI Agent |

---

## 🔔 Feedbacks Utilisateur — Erreurs Bloquantes (Sprint C)

### Principe UX

Toutes les erreurs bloquantes ont un **toast explicatif** avec une **action suggérée**. L'agent sait toujours :
- **Pourquoi** ça ne fonctionne pas
- **Quoi** faire pour corriger

### Erreurs Twilio / Connexion

| Cas | Message affiché | Durée | Quand |
|-----|-----------------|-------|-------|
| Token manquant/invalide | "Impossible d'initialiser Twilio: <message>" | 8s | `initializeTwilioDevice()` - catch |
| Erreur générale Device | "Erreur Twilio: <message>" | 5s | `device.on('error')` |
| Passage en "disponible" sans Twilio | "Twilio non connecté — Impossible de passer disponible" | 5s | `changerStatut('disponible')` |

### Erreurs Appels

| Cas | Message affiché | Durée | Quand |
|-----|-----------------|-------|-------|
| Échec appel sortant | "Échec de l'appel — Vérifiez votre connexion" | 5s | `call()` - catch |
| Twilio Device non prêt | "Twilio non prêt - Veuillez réessayer" | 5s | `call()` - guard `device.state !== 'registered'` |
| Numéro mobile bloqué | "Impossible d'appeler un numéro mobile (campagne ne l'autorise pas)" | - | `openProspectManual()` - mobile check |

### Qualité Audio (WebRTC)

| Cas | Message affiché | Durée | Action |
|-----|-----------------|-------|--------|
| ICE failed/disconnected | "Problème de connexion audio détecté" | 5s | Warning discret |
| Connection failed | "Connexion perdue — Raccrochage automatique" | 5s | Hangup auto après 10s |
| Perte paquets > 5% | "Qualité audio dégradée — Perte de paquets élevée" | 4s | Warning toutes les 10s |
| Réseau faible (2G) | "Connexion internet faible — Qualité audio risque d'être dégradée" | 7s | Au dashboard load |

### Implémentation

```typescript
// Dans DialerProvider.tsx
const { showToast } = useToast();

// Toast pour erreur bloquante
showToast('error', 'Message explicitif + Action suggérée', duree_ms);

// Toast pour warning non bloquant
showToast('warning', 'Message informatif', duree_ms);
```

---

## 📡 Surveillance WebRTC — ICE et Stats (Sprint C)

### Surveillance État Connexion

Après `SessionState.Established`, surveillance sur `RTCPeerConnection` :

```typescript
// iceConnectionState
pc.addEventListener('iceconnectionstatechange', () => {
  const iceState = pc.iceConnectionState;
  if (iceState === 'failed' || iceState === 'disconnected') {
    showToast('warning', 'Problème de connexion audio détecté', 5000);
  }
});

// connectionState avec hangup auto
pc.addEventListener('connectionstatechange', () => {
  if (pc.connectionState === 'failed') {
    showToast('error', 'Connexion perdue — Raccrochage automatique', 5000);
    setTimeout(() => inviter.bye(), 10000); // Hangup après 10s
  }
});
```

### Statistiques WebRTC (getStats)

Toutes les 5 secondes pendant l'appel :

```typescript
const stats = await pc.getStats();
// - packetsLost, packetsReceived → packetLossPercent
// - roundTripTime (RTT)
// - jitter (gigue)

// Alerte si perte > 5% pendant 10s consécutives
if (packetLossPercent > 5 && totalPackets > 100) {
  highPacketLossCount++;
  if (highPacketLossCount >= 10) {
    showToast('warning', 'Qualité audio dégradée — Perte de paquets élevée', 4000);
  }
}

// Envoi au backend
dialerService.updateSession({
  duration_seconds,
  packets_lost,
  packets_received,
  packet_loss_percent,
  round_trip_time,
  jitter,
});
```

---

## ⏱️ Timeout Enregistrement Twilio (Sprint C)

### Timeout 10 secondes

```typescript
const registerPromise = device.register();
const timeoutPromise = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('Register timeout après 10s')), 10000)
);

await Promise.race([registerPromise, timeoutPromise]);
```

### Guard Passage en Disponible

```typescript
// Dans changerStatut()
if (nouveauStatut === 'disponible' && !sipConnected) { // sipConnected représente l'état d'enregistrement du Twilio Device
  showToast('error', 'Twilio non connecté — Impossible de passer disponible', 5000);
  return; // Bloque le passage en disponible
}
```

---

*AGENTS.md v1.5 - Last updated: 2026-07-20*

---

## Contrôle d'accès des menus USV

Lorsqu'un changement du Script crée ou consomme un nouveau menu ou sous-menu USV, ajouter simultanément le droit de poste et les contrôles de navigation et de route correspondants dans USV/Olympe. Le Script vendeur conserve son accès complet ; cette règle concerne les sous-applications USV.

### Horaires Swiss Life — 2026-10-01

- Swiss Life (12) et Swiss Life IND (14) proposent uniquement les plages lundi/jeudi 10h–11h, 14h–15h, 17h–18h et mardi 9h–10h, 13h–14h, 16h–17h. Seule l’heure exacte de début peut être réservée. Les jours ouverts restent configurés dynamiquement ; les horaires se cumulent avec cette restriction.
- Le Script retire la saisie manuelle pour ces campagnes, filtre les options selon la date et invalide une heure conservée qui ne correspond plus au jour choisi. La validation du formulaire et l’API refusent les horaires hors liste, y compris les secondes non nulles. Les disponibilités restent partagées entre les deux campagnes.


### Configuration hebdomadaire des rendez-vous lead — 2026-10-05

- Les créneaux de tous les leads proviennent de `bon_commande_config.lead_booking.weekly_slots`, jamais d'une liste runtime liée à un ID de campagne. Les jours absents/vides sont fermés. Le champ `allow_manual_time` préserve uniquement la saisie libre historique lorsqu'il est explicitement vrai.
- USV : `CampagneLeadSchedule` et `useLeadBookingSchedule` permettent la sélection de 08:00 à 19:00 avec un pas de 15/30/60 minutes. Annuler abandonne le brouillon; Appliquer met à jour le formulaire, puis l'enregistrement de la campagne persiste les changements. Les heures déjà sélectionnées restent visibles après un changement de pas.
- La migration `20261005-configure-lead-weekly-booking-slots.js` doit précéder le déploiement Script/API; elle conserve les horaires existants et initialise Créantl aux horaires demandés. Le partage des réservations Swiss Life 12/14 reste inchangé. Les rappels commerciaux sont hors de cette configuration.

### Créantl et agenda ANTL — 2026-10-05

- La prise de rendez-vous client Créantl (15) demande une civilité optionnelle et conserve le nom complet effectivement saisi. Le payload optionnel `interlocuteur_civilite` est persistant dans le lead; le backend crée le booking ANTL lié et notifie après commit. Les autres campagnes et le closing restent inchangés.

### Origine du contact Créantl — 2026-10-05

- Le formulaire Créantl (campagne 15) expose `react-select` pour « Comment le prospect a connu antl ? », initialisé à `telephone` / « Prospection téléphonique », et un champ de précisions limité à 500 caractères. Les valeurs restent modifiables et sont réinitialisées avec la fiche; elles sont envoyées comme snapshots `origine_contact` / `origine_contact_detail` et rappelées dans la confirmation.
- Les autres campagnes conservent leur payload et leur formulaire de qualification. Le catalogue frontend est vérifié contre le catalogue API par les tests Olympe.
- `e2e/mma-rendez-vous-flow.spec.ts` exécute le même parcours complet pour MMA et Créantl : formulaire, snapshots, adresse, confirmation, closing et suivi. Créantl teste les créneaux configurés et l’origine téléphonique par défaut; MMA conserve sa saisie libre historique.

### SIRET des rendez-vous lead — 2026-10-06

- Toutes les campagnes `lead_b2b` exposent un SIRET optionnel, prérempli depuis le prospect. S'il est renseigné, il doit contenir 14 chiffres après suppression des espaces. Le payload optionnel `siret_prospect` enregistre une modification sur `commercial.prospects` dans la même transaction que le lead ; il ne s'agit pas d'un snapshot de rendez-vous.

### Confirmation des rendez-vous lead — 2026-10-08

- Après enregistrement, toutes les campagnes `lead_b2b` affichent le récapitulatif puis déclenchent le closing obligatoire à sa fermeture. Le brouillon est conservé jusqu'à cette fermeture, ainsi qu'en cas d'échec de sauvegarde.
- La mise à jour d'effectif utilise `updateProspect(..., { background: true })` : aucun loader ni état d'erreur global ne doit démonter le formulaire pendant son submit. Les erreurs sont propagées au formulaire. Les autres appels à `updateProspect` gardent le comportement historique.
- Le champ d'origine du contact, ses précisions et le SIRET sont disponibles dans le formulaire et le récapitulatif pour toutes les campagnes de leads. La civilité Créantl et la qualification MMA restent propres à leur campagne.
- Le parcours Playwright couvre les campagnes 10 à 15 avec modification d'effectif, confirmation, closing et suivi ; MMA couvre aussi l'échec de sauvegarde d'effectif et la reprise sans perte du brouillon.

### Transferts de portefeuille USV — 2026-10-29

- `useAgentCalendar` recharge en arrière-plan toutes les 30 secondes, au retour de visibilité et au focus. Un compteur de requête empêche une ancienne réponse de réinstaller un agenda périmé. Le chargement initial et les mutations gardent leurs erreurs explicites ; une panne de polling ne déclenche pas de toast en boucle.
- Après transfert ou restitution, les rendez-vous arrivent/disparaissent dans un agenda déjà ouvert sans reconnexion. Le dashboard conserve son polling de 60 secondes et son rafraîchissement au retour de visibilité.
- Olympe partage les historiques de fiche entre tous les employés authentifiés, avec leurs auteurs. Les commandes en attente suivent leur responsable courant `COALESCE(id_agent_suivi,id_agent)`, comme toute commande native ; le journal de transfert est réservé à la provenance. Un appel automatique revalide son `id_prospection`, son prospect et son agent avant toute numérotation.
- `e2e/prospect-transfer.spec.ts` teste le hook réel dans Chromium : réception au focus et restitution au polling, avec note précédente conservée. Les tests runtime de campagne et le build restent obligatoires.

### Fiches de prospection web — 2 novembre 2026

- `useQuiEstCe` affiche l’encart « Prospection web — novembre 2026 » uniquement pour la source `scrap_prospection_web--ND nov26`. Le site et l’agence sont modifiables via le mode Modifier ; l’URL exige HTTP/HTTPS et s’ouvre dans un nouvel onglet.
- L’agence provient des noms distincts de `enrichissement_payload.scrap_prospection_web_nd_nov26.sites`, puis d’une correction explicite `agence` si présente. Une correction NULL signifie une suppression volontaire et ne réaffiche jamais la valeur importée. `UpdateProspectData.agence_site_web` transmet la correction à Olympe.
- Vérification : `e2e/qui-est-ce-web-prospection.spec.ts` couvre l’encart selon la source, l’annulation, la validation de l’URL, l’enregistrement, l’effacement et le bouton de confirmation d’effectif.

### Documents de campagne

- La fiche prospect ajoute les boutons actifs exposés par `GET /campagnes/:id`. `useLandingPage` confirme le destinataire et envoie l’identifiant et la version du document. L’historique affiche le PDF et la version effectivement envoyés.

# UI Documentation

## Tech Stack

- **Framework:** React 18.3.1 + TypeScript 5.6.3
- **Build Tool:** Vite 5.4.10
- **Router:** TanStack Router (file-based routing)
- **Data Fetching:** TanStack React Query
- **State Management:** Zustand
- **Styling:** Tailwind CSS 4.2.4
- **Component Library:** shadcn/ui (New York style) on Radix UI primitives
- **Icons:** Lucide React
- **Native Mobile:** Capacitor 8.3.1 (iOS)

## Project Structure

```
frontend/src/
├── main.tsx                    # App bootstrap
├── index.css                   # Global styles + Tailwind theme
├── api.ts                      # API client (fetch wrapper, auth tokens)
├── types.ts                    # Shared TypeScript interfaces
├── calorieEngine.ts            # Client-side calorie calculation
├── app/
│   ├── router.ts               # Router creation
│   └── providers.tsx           # QueryClientProvider wrapper
├── routes/                     # File-based routing
│   ├── __root.tsx              # Root (auth check, GlobalBanner, Outlet)
│   ├── _auth.tsx               # Authenticated layout (ShellLayout)
│   ├── login.tsx               # Login page
│   └── _auth/
│       ├── index.tsx           # Dashboard (/)
│       ├── meals.tsx           # Meals (/meals)
│       ├── workouts.tsx        # Workouts (/workouts)
│       └── settings.tsx        # Settings (/settings)
├── features/
│   ├── auth/                   # LoginForm, auth hooks
│   ├── dashboard/              # DashboardPage, nutrition hooks
│   ├── meals/                  # MealsPage, MealComposer dialog, meal hooks
│   ├── workouts/               # WorkoutsPage, workout hooks
│   └── settings/               # ProfileForm, profile/hooks
├── components/
│   ├── shell/                  # Layout chrome (Layout, DashboardHeader, BottomNav, ProfileDrawer, WeightModal)
│   ├── shared/                 # Reusable (GlobalBanner, MealCard, WorkoutCard)
│   ├── workouts/               # WorkoutSessionModal
│   └── ui/                     # shadcn/ui primitives
├── lib/
│   ├── utils.ts                # cn() utility
│   └── mealUtils.ts            # Formatting, scaling, date helpers
└── stores/
    └── shellStore.ts           # Zustand store (session, notices, drawer state)
```

## Routes

### Public Routes

| Route | Description |
|---|---|
| `/login` | Email/password sign-in. Two-column layout on desktop (marketing copy + form). Redirects to `/` if already authenticated. |

### Authenticated Routes (wrapped in ShellLayout)

| Route | Description |
|---|---|
| `/` | **Dashboard** - 4 stat cards (consumed cal, workout burn, remaining cal, weight), calorie progress bar, calorie trend bar chart (SVG with gridlines, goal line, value labels), weight trend line chart (SVG with filled area, point markers, gridlines), recent meals/workouts lists with log buttons. Fallback rendering from local meal data when nutrition summary is unavailable. |
| `/meals` | **Meals History** - Lists up to 24 recent meals with title, calories, macros (P/C/F badges), serving details, photo count. "Log Food" button opens MealComposer. |
| `/workouts` | **Workouts History** - Lists up to 12 workout sessions with title, date, calories, duration, exercise summary. "Quick Entries" section for simplified logs. "Log Workout" button opens WorkoutSessionModal. |
| `/settings` | **Settings** - Profile editing: display name, goal summary, calorie goal, height, activity level (select), protein/carbs/fat goals, notes. |

**Auth Guard:** `_auth.tsx` runs `beforeLoad` - redirects to `/login` if not authenticated. `__root.tsx` performs initial session check via `/auth/session`.

## Component Inventory

### Shell / Layout

| Component | Purpose |
|---|---|
| `ShellLayout` | Top-level authenticated layout: DashboardHeader + scrollable main + fixed BottomNav |
| `DashboardHeader` | Sticky header with "Health Coach" logo (links to `/`), weight logging button, profile avatar (opens ProfileDrawer) |
| `BottomNav` | Fixed bottom tab bar: Home, Meals, Workouts, Settings. Active tab highlighted in primary color. Backdrop blur. |
| `ProfileDrawer` | Right-side drawer (vaul) with user avatar, ProfileForm, Sign Out + Close buttons |
| `WeightModal` | Dialog to log weight in lbs (converts to kg for API) |
| `GlobalBanner` | Top-of-page alert for global success (green) / error (red) messages. Click to dismiss. |

### Feature Components

| Component | Purpose |
|---|---|
| `LoginForm` | Card-wrapped email/password form with error alert and submit button |
| `DashboardPage` | Stat cards, progress bar, calorie/weight trend charts, recent meals/workouts lists. Inline `StatCard`, `EmptyState`, `CalorieTrendChart`, `WeightTrendChart` sub-components. Fallback rendering from local meal data when nutrition summary API is unavailable. |
| `MealsPage` | Card-wrapped meal history list with skeleton loading and empty state |
| `WorkoutsPage` | Card-wrapped workout list + quick entry cards with skeleton loading and empty state |
| `ProfileForm` | Form with inputs and native select for activity level. Dirty-checking for save. Rehydrates form on profile data change. |

### Dialog / Modal Components

| Component | Steps |
|---|---|
| `MealComposer` | **Step 1 (Input):** food title, date/time, servings, serving details, optional photos (with file list and remove buttons), saved foods (searchable dropdown with brand/serving/ calorie preview), "save as reusable" checkbox, "Estimate Nutrition" button. Edit mode title says "Edit Food". **Step 2 (Review):** editable fields, nutrition estimate (cal/protein/carbs/fat/fiber/sugar), food breakdown, status badge, save/update buttons. Dialog is scrollable. |
| `WorkoutSessionModal` | **Step 1 (Plan):** activity type selector (9 types), title input, exercise search (fuzzy match), exercise cards (LIFT: sets/reps/weight, CARDIO: duration/distance), estimated calories per exercise. **Step 2 (Active):** live timer (play/pause/reset), manual time override, planned exercises list. **Step 3 (Review):** summary (activity, duration, total calories, by-category breakdown), exercise detail cards, save button. |

### Shared Components

| Component | Purpose |
|---|---|
| `MealCard` | Meal title, timestamp, calories, P/C/F macro badges, serving description, photo count, analysis status badge. "Edit" button re-opens MealComposer. |
| `WorkoutCard` | Workout title, date, calories, duration, exercise summary (reps/sets for LIFT, minutes for CARDIO). |
| `PhotoPicker` | File picker with "Choose" button, file count badge, expandable file list with per-file remove buttons. |

### shadcn/ui Primitives (`components/ui/`)

Button, Badge, Card (+Header/Title/Description/Content/Footer/Action), Checkbox, Dialog, Drawer, Alert, Input, Label, Progress, Skeleton, Separator, Tabs, Textarea, DropdownMenu

**Button variants:** default, destructive, outline, secondary, ghost, link. **Sizes:** xs, sm, default, lg, icon, icon-xs, icon-sm, icon-lg.

**Badge variants:** default, secondary, destructive, outline, ghost, link, success (custom), warning (custom).

## Navigation

```
                    __root.tsx
                   /          \
              /login         _auth.tsx
                              (ShellLayout)
                              /    |     |     \
                           /     /meals  /workouts  /settings
                          Dashboard   Meals      Workouts   Settings
```

- **BottomNav** provides 4-tab navigation (mobile-first, no sidebar/header nav)
- **DashboardHeader** logo links back to `/`
- **ProfileDrawer** (from header avatar) provides Sign Out -> `/login`

## Styling

### Tailwind Theme (HSL CSS Variables)

| Variable | Value | Usage |
|---|---|---|
| `--background` | 214 29% 96% | Page background |
| `--foreground` | 216 44% 14% | Primary text |
| `--primary` | 215 63% 42% | Buttons, links, active states |
| `--secondary` | 214 56% 93% | Secondary backgrounds |
| `--muted` | 213 26% 58% | Muted text |
| `--destructive` | 354 51% 50% | Errors |
| `--warning` | 39 74% 45% | Warning badges |
| `--success` | 163 52% 33% | Success states |
| `--border` | 211 37% 88% | Borders |

### Typography
- **Body:** Manrope (400-800)
- **Headings:** Space Grotesk (500, 700) on h1/h2/h3

### Global Styles
- `.app-shell`: max-width 1320px, centered, safe-area-inset padding for notched devices
- All elevated surfaces get subtle shadows
- Dialog/drawer overlays: 35% opacity + 3px backdrop blur

### Utilities
- `cn()` in `lib/utils.ts` merges classes via clsx + tailwind-merge

## State Management

### Zustand (`stores/shellStore.ts`)

| Slice | Purpose |
|---|---|
| `session` | Auth session data (user info, token). Set at app load, login, logout. |
| `globalError` | Error message for GlobalBanner |
| `globalSuccess` | Success message for GlobalBanner |
| `drawerOpen` | ProfileDrawer open/close state |

### React Query
Custom hooks per feature (`features/*/hooks.ts`) handle data fetching, caching, mutations.

## UI Patterns & Conventions

- **Mobile-first** design with bottom tab navigation
- **Card-based** UI - most content surfaces use the Card component
- **Dialog-heavy** interactions - meal/workout logging done in multi-step dialogs
- **Skeleton loading** - all list pages use Skeleton placeholders
- **Empty states** - lists show EmptyState component when no data
- **Progress indicators** - Progress bar for calorie goals, stat cards for metrics
- **Macro badges** - P (protein), C (carbs), F (fat) displayed as Badge components
- **Dirty-checking forms** - ProfileForm tracks changes before enabling save
- **File-based routing** - file/folder structure in `routes/` determines URL paths

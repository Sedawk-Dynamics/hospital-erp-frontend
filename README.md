# Hospital ERP Frontend

A modern, responsive Hospital ERP frontend built with **Next.js 16**, **React 19**, **TypeScript**, **Tailwind CSS 4**, and **shadcn/ui**. Features a multi-module architecture with role-based access control, mirroring the [eMedHub](https://app.emedhub.in) navigation flow.

---

## Tech Stack

| Technology | Purpose |
|-----------|---------|
| Next.js 16 | React framework (App Router) |
| React 19 | UI library |
| TypeScript 5 | Type safety |
| Tailwind CSS 4 | Utility-first styling |
| shadcn/ui v4 | Component library (Base UI) |
| Zustand 5 | Client state management |
| TanStack React Query 5 | Server state & data fetching |
| React Hook Form 7 | Form handling |
| Zod 4 | Schema validation |
| Axios | HTTP client with interceptors |
| Lucide React | Icon library |
| Sonner | Toast notifications |
| date-fns 4 | Date formatting |
| next-themes | Dark mode support |
| Docker | Containerization |

---

## Architecture

```
frontend/
├── src/
│   ├── app/
│   │   ├── (auth)/                    # Public auth pages
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   └── forgot-password/
│   │   ├── (selection)/               # Post-login selection flow
│   │   │   ├── select-clinic/         # Multi-tenant clinic picker
│   │   │   └── select-module/         # Role-filtered module picker
│   │   ├── (modules)/                 # Module-specific pages (with sidebar)
│   │   │   ├── layout.tsx             # Module layout (sidebar + header)
│   │   │   ├── hospital/              # Hospital module (8 pages)
│   │   │   ├── doctor/                # Doctor module (7 pages)
│   │   │   ├── laboratory/            # Laboratory module (6 pages)
│   │   │   ├── pharmacy/              # Pharmacy module (8 pages)
│   │   │   ├── ot/                    # Operation Theatre module (7 pages)
│   │   │   ├── radiology/             # Radiology module
│   │   │   ├── counsellor/            # Counsellor module
│   │   │   ├── daycare/               # Daycare module
│   │   │   └── ward/                  # Ward module
│   │   ├── (dashboard)/               # Legacy admin pages (27 modules)
│   │   │   ├── dashboard/             # Main dashboard with stats
│   │   │   ├── patients/              # Patient management
│   │   │   ├── appointments/          # Appointment booking
│   │   │   ├── billing/               # Bills & payments
│   │   │   ├── users/                 # User management
│   │   │   └── ...                    # 22 more modules
│   │   ├── layout.tsx                 # Root layout (fonts, providers)
│   │   ├── page.tsx                   # Home → redirect to /select-clinic
│   │   └── globals.css                # Teal theme, CSS variables
│   ├── components/
│   │   ├── layout/                    # Module sidebar, module header, providers
│   │   ├── ui/                        # 20 shadcn/ui components
│   │   ├── shared/                    # DataTable, StatusBadge, EmptyState, etc.
│   │   ├── selection/                 # ClinicCard, ModuleCard
│   │   ├── hospital/                  # Hospital-specific components
│   │   └── doctor/                    # Doctor-specific components
│   ├── config/
│   │   ├── modules.ts                 # Module registry (sidebar nav, icons, routes)
│   │   └── role-modules.ts            # Role → module mapping & auto-routing
│   ├── hooks/                         # useAuth, useApi, useDebounce, useHospital
│   ├── stores/                        # Zustand: auth, sidebar, clinic, module
│   ├── lib/                           # API client, typed API helpers, utilities
│   ├── types/                         # TypeScript interfaces
│   └── middleware.ts                  # Route protection (auth cookie check)
├── Dockerfile                         # Multi-stage Docker build
├── docker-compose.yml
├── next.config.ts
└── package.json
```

---

## Navigation Flow

The app follows a hierarchical navigation pattern:

```
Login → Select Clinic → Select Module → Module Dashboard
                              ↑
                     (auto-skipped for
                      single-module roles)
```

### Role Hierarchy

- **super_admin** — SaaS platform owner (tenant owner). Has access to ALL modules including Doctor. Bypasses all permission checks on the backend. This is a platform-level role, not created per-tenant.
- **admin** — Hospital administrator who purchased a subscription. Manages their hospital's operations across all standard modules (8 admin modules). Created per-tenant during onboarding.

### Role-Based Routing

| Role | Module(s) | Behavior |
|------|-----------|----------|
| `super_admin` (SaaS platform owner) | All 9 modules (incl. Doctor) | Shows module selection page. Bypasses all backend permission checks. |
| `admin` (hospital subscription owner) | Hospital, Laboratory, Radiology, Pharmacy, OT, Counsellor, Daycare, Ward | Shows module selection page |
| Doctor specializations (17 slugs) | Doctor | Auto-routes to `/doctor` |
| `lab_technician`, `lab_supervisor` | Laboratory | Auto-routes to `/laboratory` |
| `radiologist` | Radiology | Auto-routes to `/radiology` |
| `pharmacist`, `pharmacy_technician`, `pharmacy_admin` | Pharmacy | Auto-routes to `/pharmacy` |
| `nurse` | Hospital, Ward | Shows module selection (2 modules) |
| `front_desk` | Hospital | Auto-routes to `/hospital` |
| `billing_admin`, `cashier` | Hospital | Auto-routes to `/hospital` |
| `insurance_staff` | Hospital | Auto-routes to `/hospital` |
| `inventory_manager` | Pharmacy, Laboratory, OT | Shows module selection (3 modules) |
| `blood_bank_staff` | Hospital | Auto-routes to `/hospital` |
| `hr_staff` | Hospital | Auto-routes to `/hospital` |

Single-module roles skip the module selection page entirely. The "Switch Module" button in the sidebar/header is hidden for these roles.

---

## Modules & Pages

### Hospital Module (`/hospital`)

| Page | Route | Description |
|------|-------|-------------|
| OP Home | `/hospital` | Appointment stats, patient tags, appointment table with status progression |
| IP Home | `/hospital/ip` | In-patient list, reservations, bed availability map, estimation, occupancy |
| Billing | `/hospital/billing` | Service entry, cash counter, pending bills |
| Transactions | `/hospital/transactions` | Collection summary, bills, receipts, day end, expenses |
| Credit Settlement | `/hospital/credit-settlement` | Insurance, corporate, patient provider settlement |
| Walk-In | `/hospital/walkin` | Quick walk-in registration form |
| Reports | `/hospital/reports` | OP/IP service reports, insurance, appointment, patient, referral, tally |
| Settings | `/hospital/settings` | Clinic config, user config, service config, layouts |
| Dashboard | `/hospital/dashboard` | Module overview dashboard |

### Doctor Module (`/doctor`)

| Page | Route | Description |
|------|-------|-------------|
| Home | `/doctor` | Doctor appointments with stats, patient table, status progression |
| IP Home | `/doctor/ip` | In-patient list filtered by doctor, ward/block/floor filters |
| Nutrition Chart | `/doctor/nutrition-chart` | Meal plan grid with templates |
| Registry | `/doctor/registry` | Patient registry with category tabs and filters |
| MRD | `/doctor/mrd` | Medical Records Department transfers |
| OT List | `/doctor/ot-list` | OT appointments with status filters |
| Settings | `/doctor/settings` | Layout configuration, doctor notes configuration |

### Laboratory Module (`/laboratory`)

| Page | Route | Description |
|------|-------|-------------|
| Home | `/laboratory` | Lab status, test reports, technician view, outsource, orders |
| Billing | `/laboratory/billing` | Lab-specific billing |
| Inventory | `/laboratory/inventory` | Lab stock management |
| Purchase | `/laboratory/purchase` | Lab purchase orders |
| Reports | `/laboratory/reports` | Lab reports and analytics |
| Settings | `/laboratory/settings` | Lab configuration |

### Pharmacy Module (`/pharmacy`)

| Page | Route | Description |
|------|-------|-------------|
| Billing | `/pharmacy` | POS-style pharmacy billing |
| Transactions | `/pharmacy/transactions` | Pharmacy transaction history |
| Inventory | `/pharmacy/inventory` | Drug stock management |
| Purchase | `/pharmacy/purchase` | Purchase orders |
| Stock Transfer | `/pharmacy/stock-transfer` | Inter-location transfers |
| Reports | `/pharmacy/reports` | Pharmacy analytics |
| GST | `/pharmacy/gst` | GST updates and compliance |
| Settings | `/pharmacy/settings` | Pharmacy configuration |

### OT Module (`/ot`)

| Page | Route | Description |
|------|-------|-------------|
| Home | `/ot` | OT appointment scheduling |
| Transactions | `/ot/transactions` | OT transaction history |
| Stocks | `/ot/stocks` | OT stock levels |
| Inventory | `/ot/inventory` | OT inventory management |
| Stock Transfer | `/ot/stock-transfer` | Stock transfers |
| Reports | `/ot/reports` | OT analytics |
| Settings | `/ot/settings` | OT configuration |

### Additional Modules

- **Radiology** (`/radiology`) - Imaging operations
- **Counsellor** (`/counsellor`) - Counselling management
- **Daycare** (`/daycare`) - Daycare operations
- **Ward** (`/ward`) - Ward management

### Legacy Dashboard Pages (27 modules under `/dashboard`)

Patients, Appointments, Billing, Users, Visits, Admissions, Vitals, Diagnoses, Progress Notes, Nursing Notes, Prescriptions, Lab, Imaging, Inventory, Insurance, Blood Bank, HR, Attendance, Payroll, Departments, Notifications, Messages, Tickets, Reports, Settings

---

## State Management

### Zustand Stores (4)

**Auth Store** (`stores/auth-store.ts`)
- User data, tokens, login/logout/register, token refresh
- SSR-safe hydration pattern

**Clinic Store** (`stores/clinic-store.ts`)
- Selected clinic/tenant, clinic list
- Persists selection to localStorage

**Module Store** (`stores/module-store.ts`)
- Active module key (hospital, laboratory, pharmacy, ot, radiology, counsellor, daycare, ward, doctor)
- Persists selection to localStorage

**Sidebar Store** (`stores/sidebar-store.ts`)
- Sidebar open/collapsed state for responsive layout

### React Query Hooks

```typescript
// Dashboard statistics
const { data } = useDashboardStats();

// Paginated patients
const { data } = usePatients({ page: 1, limit: 20, search: 'john' });

// Hospital OP appointments
const { data } = useOPAppointments({ date, doctorId, status });

// Hospital IP patients
const { data } = useInPatients({ ward, block, floor });

// Bed availability
const { data } = useBedAvailability();
```

---

## Configuration

### Module Registry (`config/modules.ts`)

Defines all 9 modules with their sidebar navigation items, icons, and routes:

```typescript
MODULE_REGISTRY = {
  hospital: { label, icon, baseRoute, sidebarItems: [...] },
  laboratory: { ... },
  radiology: { ... },
  pharmacy: { ... },
  ot: { ... },
  counsellor: { ... },
  daycare: { ... },
  ward: { ... },
  doctor: { ... },
}
```

### Role-Module Mapping (`config/role-modules.ts`)

Maps backend role slugs to frontend module access:

```typescript
getModulesForRole('lab_technician')  // → ['laboratory']
getModulesForRole('nurse')           // → ['hospital', 'ward']
getModulesForRole('admin')           // → all 8 admin modules
getAutoRouteForRole('pharmacist')    // → '/pharmacy' (auto-skip module selection)
```

---

## Components

### Layout Components

- **ModuleSidebar** - Icon + label sidebar, collapsible, module-specific nav items, "Switch Module" button (hidden for single-module roles)
- **ModuleHeader** - Clinic name, module label (shows "Dr FirstName" for doctors), notification bell, user avatar dropdown with Switch Clinic/Module options

### UI Components (20 shadcn/ui)

Avatar, Badge, Button, Calendar, Card, Command, Dialog, DropdownMenu, Input, InputGroup, Label, Popover, Select, Separator, Sheet, Skeleton, Sonner, Table, Tabs, Textarea

### Shared Components

- **DataTable** - Sortable, paginated data tables
- **PageHeader** - Consistent page titles with breadcrumbs
- **StatusBadge** - Color-coded status indicators
- **ConfirmDialog** - Action confirmation modals
- **EmptyState** - Placeholder for empty lists
- **Loading** - Loading spinners

### Hospital Components

- **AppointmentStatsRow** - Clickable stat cards (All, Booked, Arrived, With Doctor, etc.)
- **AppointmentTable** - Full appointment table with patient details, payment status, status progression
- **StatusProgression** - 4-step visual indicator (Registered → Arrived → With Doctor → Completed)
- **OPHomeToolbar** - Doctor filter, patient search, date picker
- **PatientTagFilter** - Staff, Doctor Family, VIP, Emergency tags
- **BedAvailability** - Visual bed map (color-coded by status)
- **CollectionSummary** - Payment mode breakdown (Cash/Card/UPI/Bank)
- **InPatientList** - IP admission stats and patient table

### Doctor Components

- **PatientCategoryIndicators** - New (red), Review (blue), Old (purple) patient dots
- **DoctorActionButtons** - Follow-up, Requests, Transfer, Print, Telemedicine

### Selection Components

- **ClinicCard** - Hospital card with active state styling
- **ModuleCard** - Large icon + module name grid card

---

## API Integration

### API Client (`lib/api-client.ts`)

- Axios instance with base URL from `NEXT_PUBLIC_API_URL`
- **Request interceptor**: Attaches Bearer token + X-Tenant-Id header
- **Response interceptor**: Auto token refresh on 401, redirect to login on failure

### Typed API Functions (`lib/api.ts`)

```typescript
const patients = await apiGet<Patient[]>('/patients');
const patient = await apiPost<Patient>('/patients', data);
await apiPut<Patient>(`/patients/${id}`, data);
await apiPatch(`/appointments/${id}/status`, { status });
await apiDelete(`/patients/${id}/allergies/${allergyId}`);
```

---

## Middleware (Route Protection)

```
Public routes:     /login, /register, /forgot-password
Protected routes:  /dashboard/*, /select-clinic, /select-module,
                   /hospital/*, /laboratory/*, /radiology/*,
                   /pharmacy/*, /ot/*, /counsellor/*, /daycare/*,
                   /ward/*, /doctor/*
```

- Unauthenticated users → redirect to `/login?callbackUrl=<original>`
- Authenticated users on public pages → redirect to `/select-clinic`
- Module layout guard: no auth → login, no clinic → select-clinic, no module → select-module

---

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- npm or yarn
- Backend API running (see backend README)

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local with your API URL

# 3. Start development server
npm run dev
# Opens at http://localhost:3000
```

### Docker

```bash
docker-compose up -d --build
# Frontend available at http://localhost:3000
```

---

## Environment Variables

```env
# Backend API URL (required)
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1

# App name (optional)
NEXT_PUBLIC_APP_NAME=Hospital ERP
```

---

## NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with Turbopack |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest tests |
| `npm run test:watch` | Watch mode testing |
| `npm run test:coverage` | Coverage report |

---

## Styling

- **Tailwind CSS 4** with utility-first approach
- **shadcn/ui v4** components (Base UI foundation)
- **Teal primary color** (#00BFA5) matching eMedHub branding
- **Geist font** (sans + mono) from Next.js
- **Dark mode ready** via next-themes
- **Responsive design**: Mobile-first with breakpoints
  - Mobile: Single column, sheet navigation drawer
  - Tablet: Collapsed sidebar (68px icon-only)
  - Desktop: Full sidebar (240px), multi-column layouts

---

## Type Definitions

Core types defined in `src/types/index.ts`:

```typescript
// Auth & Users
interface User { id, email, firstName, lastName, role, tenant }
interface LoginResponse { accessToken, refreshToken, user }
interface Tenant { id, name, subdomain, subscriptionStatus }

// Medical
interface Patient { id, mrn, firstName, lastName, dateOfBirth, gender, bloodGroup }
interface Appointment { id, patient, doctor, date, time, status, queueToken }
interface DoctorProfile { id, user, specialization, consultationFee, isAvailable }

// Billing
interface Bill { id, billNumber, patient, items, totalAmount, paidAmount, status }
interface Payment { id, bill, amount, method, receipt }

// Infrastructure
interface Clinic { id, name }
type ModuleKey = 'hospital' | 'laboratory' | 'radiology' | 'pharmacy' | 'ot' | 'counsellor' | 'daycare' | 'ward' | 'doctor'

// Pagination
interface PaginationMeta { page, limit, total, totalPages }
```

---

## Production Deployment

```bash
# Build optimized production bundle
npm run build

# Start production server
npm run start

# Or with Docker
docker-compose up -d --build
```

The Dockerfile uses a multi-stage build:

1. **deps** - Install dependencies
2. **build** - Compile Next.js (standalone output)
3. **runner** - Minimal production image with non-root user (`nextjs:1001`)

Exposes port **3000**. Telemetry disabled.

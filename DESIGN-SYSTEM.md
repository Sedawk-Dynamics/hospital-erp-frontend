# Hospital ERP - Design System Reference

> Use this document to recreate the UI in Figma. All tokens are extracted from the live codebase.

---

## Fonts

| Token | Value |
|-------|-------|
| Primary Font | **Geist Sans** (Variable) |
| Monospace Font | **Geist Mono** (Variable) |
| Base Size | 14px (`text-sm`) |
| Small Size | 12px (`text-xs`) |
| Default Size | 16px (`text-base`) |

---

## Color Palette (Light Mode)

### Primary
| Token | OKLCh | Approx Hex | Usage |
|-------|-------|-----------|-------|
| `--primary` | `oklch(0.62 0.15 170)` | **#00BFA5** | Buttons, links, active states |
| `--primary-foreground` | `oklch(0.985 0 0)` | **#FFFFFF** | Text on primary |

### Backgrounds
| Token | OKLCh | Approx Hex | Usage |
|-------|-------|-----------|-------|
| `--background` | `oklch(0.985 0.005 170)` | **#F8FFFE** | Page background |
| `--card` | `oklch(1 0 0)` | **#FFFFFF** | Card surfaces |
| `--popover` | `oklch(1 0 0)` | **#FFFFFF** | Dropdown/popover |

### Text
| Token | OKLCh | Approx Hex | Usage |
|-------|-------|-----------|-------|
| `--foreground` | `oklch(0.175 0.02 200)` | **#1A2B2E** | Primary text |
| `--muted-foreground` | `oklch(0.50 0.02 200)` | **#6B7D80** | Secondary text |

### Secondary & Accent
| Token | OKLCh | Approx Hex | Usage |
|-------|-------|-----------|-------|
| `--secondary` | `oklch(0.95 0.02 170)` | **#E8F5F3** | Secondary buttons |
| `--accent` | `oklch(0.92 0.03 170)` | **#D4EDE9** | Hover/active backgrounds |
| `--destructive` | `oklch(0.58 0.22 27)` | **#E53935** | Error/delete actions |

### Borders
| Token | OKLCh | Approx Hex | Usage |
|-------|-------|-----------|-------|
| `--border` | `oklch(0.90 0.02 170)` | **#D6E5E3** | Borders, dividers |
| `--input` | `oklch(0.90 0.02 170)` | **#D6E5E3** | Input borders |
| `--ring` | `oklch(0.62 0.15 170)` | **#00BFA5** | Focus rings |

### Charts
| Token | OKLCh | Approx Hex | Usage |
|-------|-------|-----------|-------|
| `--chart-1` | `oklch(0.55 0.15 170)` | **#009688** | Chart series 1 (Teal) |
| `--chart-2` | `oklch(0.60 0.15 250)` | **#3F51B5** | Chart series 2 (Blue) |
| `--chart-3` | `oklch(0.65 0.15 290)` | **#7E57C2** | Chart series 3 (Purple) |
| `--chart-4` | `oklch(0.70 0.15 60)` | **#FFB300** | Chart series 4 (Yellow) |
| `--chart-5` | `oklch(0.55 0.15 340)` | **#E91E63** | Chart series 5 (Magenta) |

---

## Color Palette (Dark Mode)

| Token | OKLCh | Approx Hex |
|-------|-------|-----------|
| `--primary` | `oklch(0.70 0.15 170)` | **#26C6AA** |
| `--background` | `oklch(0.145 0.015 200)` | **#1A1F23** |
| `--card` | `oklch(0.20 0.02 200)` | **#252D31** |
| `--foreground` | `oklch(0.985 0 0)` | **#FFFFFF** |
| `--muted` | `oklch(0.27 0.02 200)` | **#3A4347** |
| `--border` | `oklch(1 0 0 / 10%)` | **rgba(255,255,255,0.1)** |

---

## Border Radius

| Token | Value | Pixels |
|-------|-------|--------|
| `--radius` (base) | `0.625rem` | **10px** |
| `--radius-sm` | `0.6 × base` | **6px** |
| `--radius-md` | `0.8 × base` | **8px** |
| `--radius-lg` | `1.0 × base` | **10px** |
| `--radius-xl` | `1.4 × base` | **14px** |
| `--radius-2xl` | `1.8 × base` | **18px** |

---

## Button Variants

| Variant | Background | Text | Border |
|---------|-----------|------|--------|
| **Default** | Primary (#00BFA5) | White | None |
| **Secondary** | Secondary (#E8F5F3) | Dark Teal | None |
| **Outline** | Transparent | Foreground | Border color |
| **Ghost** | Transparent | Foreground | None |
| **Destructive** | Light Red | Red | None |
| **Link** | Transparent | Primary | Underline |

### Button Sizes

| Size | Height | Padding | Font |
|------|--------|---------|------|
| **xs** | 24px | 8px horizontal | 12px |
| **sm** | 28px | 12px horizontal | 12px |
| **default** | 32px | 16px horizontal | 14px |
| **lg** | 36px | 16px horizontal | 14px |
| **icon** | 32×32px | centered | - |

---

## Card Component

| Property | Value |
|----------|-------|
| Background | White (`--card`) |
| Border | 1px `--border` |
| Radius | `rounded-xl` (14px) |
| Padding | 16px |
| Shadow | `shadow-sm` |
| Title Font | 16px, medium weight |
| Description | 14px, `--muted-foreground` |

---

## Sidebar

| Property | Value |
|----------|-------|
| Width | 240px (expanded) / 48px (collapsed) |
| Background | `--sidebar` (#F8FFFE) |
| Active Item BG | `--sidebar-accent` |
| Active Text | `--sidebar-primary` (Teal) |
| Border Right | 1px `--sidebar-border` |

---

## Animations

| Name | Description | Duration |
|------|-------------|----------|
| `fadeInUp` | Fade in + slide up 8px | 350ms |
| `scaleIn` | Fade in + scale from 96% | 250ms |
| `shimmer` | Loading skeleton gradient | 1500ms loop |
| `pulseDot` | Status indicator pulse | 2000ms loop |
| Stagger delays | 50ms increments (1-6) | - |

---

## Page Layout Structure

```
┌─────────────────────────────────────────┐
│  ModuleHeader (top bar)                 │
│  ┌──────┬──────────────────────────┐    │
│  │      │                          │    │
│  │ Side │    Main Content Area     │    │
│  │ bar  │                          │    │
│  │      │                          │    │
│  │ 240px│    (flex-1)              │    │
│  │      │                          │    │
│  └──────┴──────────────────────────┘    │
└─────────────────────────────────────────┘
```

---

## Icon Library

**Lucide React** — Consistent 24px stroke icons
- Stroke width: 2px default
- Common icons: Search, Plus, Filter, Settings, ChevronDown, Calendar, User, etc.

---

## Component Library

Based on **shadcn/ui v4 (base-nova)** — 18 components:
- Accordion, Alert, Avatar, Badge, Button, Card
- Checkbox, Dialog, Dropdown Menu, Input, Label
- Popover, Progress, Select, Separator, Switch
- Table, Tabs, Toast, Tooltip

---

## Key Screens to Capture (94 total pages)

### Priority 1 — Core Flow
1. Login page
2. Select Hospital
3. Select Module
4. Hospital OP Home (stats + appointment table)
5. Hospital IP Home (5 tabs)
6. Hospital Billing (3 tabs)
7. Hospital Dashboard (12 stat cards)

### Priority 2 — Module Homes
8. Doctor Home + Consultation
9. Laboratory Home (5 tabs)
10. Pharmacy POS Billing
11. OT Home

### Priority 3 — Admin & Settings
12. Super Admin Dashboard
13. Hospital Settings
14. User Management
15. Create Hospital / Onboarding

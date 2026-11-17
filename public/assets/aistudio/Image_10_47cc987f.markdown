---
name: Kinetic Minimalist
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#3d4a42'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#6d7a72'
  outline-variant: '#bccac0'
  surface-tint: '#006c4a'
  primary: '#006948'
  on-primary: '#ffffff'
  primary-container: '#00855d'
  on-primary-container: '#f5fff7'
  inverse-primary: '#68dba9'
  secondary: '#0051d5'
  on-secondary: '#ffffff'
  secondary-container: '#316bf3'
  on-secondary-container: '#fefcff'
  tertiary: '#3f6700'
  on-tertiary: '#ffffff'
  tertiary-container: '#518200'
  on-tertiary-container: '#f9ffea'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#85f8c4'
  primary-fixed-dim: '#68dba9'
  on-primary-fixed: '#002114'
  on-primary-fixed-variant: '#005137'
  secondary-fixed: '#dbe1ff'
  secondary-fixed-dim: '#b4c5ff'
  on-secondary-fixed: '#00174b'
  on-secondary-fixed-variant: '#003ea8'
  tertiary-fixed: '#acf847'
  tertiary-fixed-dim: '#91db2a'
  on-tertiary-fixed: '#102000'
  on-tertiary-fixed-variant: '#304f00'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  headline-xl:
    fontFamily: Outfit
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.03em
  headline-xl-mobile:
    fontFamily: Outfit
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Outfit
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Outfit
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Outfit
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Outfit
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.005em
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  title-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.05em
  metric-display:
    fontFamily: Outfit
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.03em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.25rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-tablet: 1.5rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system embodies high-performance clarity: an athletic minimalist aesthetic engineered for modern fitness enterprises, boutique studios, and data-driven gym operators. The interface avoids aggressive dark-mode tropes or heavy skeuomorphism in favor of an airy, luminous, laboratory-precise environment where operational data, financial metrics, and member journeys take center stage.

The emotional signature is composed, sharp, and kinetic—evoking the focus of an elite training facility coupled with the surgical efficiency of a modern SaaS command center. Visual weight is maintained through deliberate geometric typography, purposeful negative space, crisp micro-borders, and high-impact kinetic accents (electric lime and focused cobalt) that guide operational instincts without overwhelming the user.

## Colors

The palette balances structural neutrality with athletic vibrancy. The canvas utilizes pure porcelain white (`#FFFFFF`) and slate-tinted canvas backings (`#F8FAFC` to `#F1F5F9`) to create clean contrast layers. Deep carbon and slate anchors (`#0F172A`, `#1E293B`, and `#334155`) deliver high typographic readability across high-density data tables and analytical overviews.

- **Primary (`#059669` / `#10B981`):** Represents momentum, membership growth, check-ins, and successful operations. Used for primary CTA triggers, positive velocity metrics, and critical success indicators.
- **Secondary (`#2563EB`):** Precision cobalt designated for system logic, active filters, multi-axis analytic trends, scheduled sessions, and operational state changes.
- **Tertiary (`#84CC16`):** Vibrant electric lime employed sparingly for real-time live gym activity, active telemetry pulses, and telemetry highlights.
- **Neutral (`#0F172A` / `#E2E8F0`):** Formulates structural crispness via `#E2E8F0` hairline borders and `#0F172A` primary labels, removing visual noise while preserving hierarchy.

## Typography

The type scale leverages **Outfit** for structural headlines and metric displays, providing a bold, geometric authority that matches athletic equipment and modern sports design. For high-volume tabular readouts, form interfaces, and telemetry labels, **Plus Jakarta Sans** provides open counters and sturdy proportions that preserve legibility at micro-scales.

Use `metric-display` for KPI values within stat widgets, paired with uppercase `label-sm` tracking to create clear visual separation between data labels and numeric figures.

## Layout & Spacing

The layout is built upon an adaptive 12-column fluid grid system pinned to an outer desktop bounding box of `1600px` to maintain comfortable eye scanning speeds across wide screens.

- **Desktop (>= 1280px):** 12 columns with `1.5rem` (`gutter-desktop`) gutters and `2rem` (`margin-desktop`) outer padding. High-density dashboards use persistent 260px vertical utility navigation alongside flexible widget containers.
- **Tablet (768px - 1279px):** 8 columns with `1.25rem` gutters and `1.5rem` margins. Multicolumn stats condense to 2-column stacks; tertiary analytical graphs collapse into tabbed switchers.
- **Mobile (< 768px):** 4 columns with `1rem` gutters and `1rem` margins. Metrics stack into horizontal swipe carousels or single-column blocks with full-bleed action zones.

Spacing within individual cards adheres strictly to the `space-*` tokens: nested metric rows use `space-xs` and `space-sm`, standard card interior padding is governed by `space-lg`, and major layout module separations use `space-xl`.

## Elevation & Depth

This design system avoids heavy shadows, using a combination of white surface plane separation, subtle micro-borders, and low-opacity ambient diffusion to delineate depth:

- **Surface Base:** The primary canvas sits at `#F8FAFC`. Primary data cards and interactive modules rest at `#FFFFFF` bordered by a crisp `1px solid #E2E8F0` hairline.
- **Level 1 (Resting Cards & Tables):** Elevated via `box-shadow: 0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.03)` with a neutral boundary line.
- **Level 2 (Hover States, Floating Toolbars, Dropdowns):** Subtle float achieved through `box-shadow: 0 8px 24px -4px rgba(15, 23, 42, 0.08), 0 2px 6px -2px rgba(15, 23, 42, 0.04)`.
- **Level 3 (Modals, Flyout Drawers, Viewport Overlays):** Deep modal elevation using `box-shadow: 0 20px 40px -12px rgba(15, 23, 42, 0.14)`.
- **Glass Overlays (3D Engine Viewports & Telemetry Overlays):** Utilizes `background: rgba(255, 255, 255, 0.82)`, `backdrop-filter: blur(12px)`, and a subtle white border `rgba(255, 255, 255, 0.6)`.

## Shapes

The shape system is balanced and ergonomic:
- Standard cards, panels, and data tables follow `0.5rem` (`roundedness: 2`) curvature to retain structural geometry without feeling aggressive.
- Larger viewport containers, canvas cards, and modal dialogs step up to `rounded-lg` (`1rem`).
- Status indicators, category chips, search pills, and actionable quick-tags break the grid with full pill-capsules (`rounded-full` / `9999px`), distinguishing interactive meta-tags from card structures.

## Components

### Buttons
- **Primary Athletic CTA:** Deep emerald background (`#059669`), white text, bold font weighting (`Outfit`, 600), `0.5rem` corner radius, `px-5 py-2.5`. Hover shifts to `#047857` with a subtle elevation boost.
- **Secondary Action:** Crisp white surface, `1px solid #E2E8F0` border, slate text (`#1E293B`). On hover: `#F8FAFC` background and `#CBD5E1` border.
- **Cobalt Contextual CTA:** Rich cobalt background (`#2563EB`) reserved for analytical downloads, sync routines, and schedule triggers.

### Metric Stat Cards & Sparklines
- Enclosed within white cards, `space-lg` padding, with hairline `#E2E8F0` boundaries.
- Upper region contains the `label-sm` metric descriptor paired with a pill badge displaying the percentage delta (green tint `#ECFDF5` with `#059669` text for positive gains).
- Center region houses the primary numeric figure rendered in `metric-display`.
- Lower baseline incorporates a frictionless 48px height sparkline rendered with a soft 2px vector path and subtle gradient wash underneath.

### Status Chips & Badges
- Pill-shaped tags (`rounded-full`) using uppercase `label-sm` tracking.
- **Active Member:** Light mint fill (`#ECFDF5`), emerald text (`#047857`), accompanied by an animated 6px pulsating dot.
- **At-Risk/Pending:** Light amber fill (`#FFFBEB`), warm amber text (`#B45309`).
- **Inactive/Frozen:** Muted slate fill (`#F1F5F9`), slate text (`#475569`).

### Data Tables
- Flush cards with zero internal margin. Table headers styled with `label-sm`, subtle `#F8FAFC` background, uppercase tracking, and 40px row height.
- Rows feature alternating or clean divider lines (`1px solid #F1F5F9`), transitioning on hover to `#F8FAFC`.
- Member entries feature a 32px circular avatar paired with member name (`title-sm`) and micro-meta email/membership tier (`body-sm`).

### Input Fields & Filter Bars
- Inputs use `#FFFFFF` background, `0.5rem` corners, `1px solid #E2E8F0` resting border, and `14px` typography. Focused state utilizes `#059669` ring border with `0 0 0 2px rgba(5, 150, 105, 0.15)`.
- Global filter bar features integrated search pills, multi-select dropdown chips, and date-range pickers configured in an inline bar.

### Multi-Axis Graph Cards & 3D Interactive Viewport Frames
- **Analytical Chart Cards:** Framed with integrated header controls (time range pills: 7D, 30D, 1Y). Axes use dashed `#F1F5F9` grid lines and cobalt/emerald dual series data paths.
- **3D Gym Floor Viewport Frame:** Enclosed in a recessed 16:9 container with dark graphite or ultra-light slate ambient backdrop, floating translucent UI controls (`rgba(255, 255, 255, 0.85)` with blur), and an electric lime live indicator beacon (`#84CC16`) signifying active gym capacity in real time.
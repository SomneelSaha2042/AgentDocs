---
name: Cyber-Deterministic Tech
colors:
  surface: '#10131a'
  surface-dim: '#10131a'
  surface-bright: '#363940'
  surface-container-lowest: '#0b0e14'
  surface-container-low: '#191c22'
  surface-container: '#1d2026'
  surface-container-high: '#272a31'
  surface-container-highest: '#32353c'
  on-surface: '#e1e2eb'
  on-surface-variant: '#c5c5d3'
  inverse-surface: '#e1e2eb'
  inverse-on-surface: '#2e3037'
  outline: '#8f909c'
  outline-variant: '#444651'
  surface-tint: '#b7c4ff'
  primary: '#b7c4ff'
  on-primary: '#0e2879'
  primary-container: '#3c51a1'
  on-primary-container: '#bfcaff'
  inverse-primary: '#4459a9'
  secondary: '#bdf4ff'
  on-secondary: '#00363d'
  secondary-container: '#00e3fd'
  on-secondary-container: '#00616d'
  tertiary: '#00e38b'
  on-tertiary: '#00391f'
  tertiary-container: '#00643a'
  on-tertiary-container: '#00ea8f'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dde1ff'
  primary-fixed-dim: '#b7c4ff'
  on-primary-fixed: '#001452'
  on-primary-fixed-variant: '#2b4090'
  secondary-fixed: '#9cf0ff'
  secondary-fixed-dim: '#00daf3'
  on-secondary-fixed: '#001f24'
  on-secondary-fixed-variant: '#004f58'
  tertiary-fixed: '#56ffa8'
  tertiary-fixed-dim: '#00e38b'
  on-tertiary-fixed: '#002110'
  on-tertiary-fixed-variant: '#00522f'
  background: '#10131a'
  on-background: '#e1e2eb'
  surface-variant: '#32353c'
  terminal-black: '#0B0E14'
  surface-charcoal: '#161B22'
  border-muted: '#30363D'
  status-pass: '#00FF9D'
  status-warn: '#FFB800'
  status-fail: '#FF4B4B'
  text-dim: '#8B949E'
typography:
  headline-xl:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '450'
    lineHeight: 20px
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 64px
  container-max: 1200px
---

## Brand & Style

This design system is engineered for developers and automation architects who demand precision, safety, and technical rigor. The aesthetic is rooted in a **Modern-Corporate** framework fused with **High-Contrast / Neon** accents, creating an environment that feels like a mission-control dashboard for AI documentation logic.

The personality is intentionally "boring" in its reliability but "vibrant" in its delivery of critical data. It moves away from the generic light-mode SaaS aesthetic toward a sophisticated dark-theme ecosystem that reduces eye strain during long-term technical audits. The visual narrative emphasizes the "Gate" metaphor—clear boundaries, deterministic status indicators, and a structured hierarchy that mirrors the logic of a terminal.

**Key visual pillars:**
- **Technical Rigor:** Strict grid alignment and monospaced data visualization.
- **The "Gate" Logic:** High-contrast color signals (Pass/Warn) that slice through deep charcoal backgrounds.
- **Subtle Depth:** Using dark-on-dark layering and thin borders rather than heavy shadows to maintain a sleek, utilitarian feel.

## Colors

The palette is anchored in a deep **#0B0E14** "Terminal Black" to provide maximum contrast for technical data. The primary brand blue is utilized for navigational elements and primary actions, while the secondary and tertiary neons (Electric Blue and Mint Green) are reserved strictly for high-value information: success states, technical terms, and code highlights.

- **Primary Blue (#3C51A1):** Used for structural brand identity and primary call-to-actions.
- **Mint Neon (#00FF9D):** The "Pass" state. Used for success metrics, validated claims, and affirmative CLI outputs.
- **Electric Blue (#00E5FF):** Accent for interactive technical elements, links within code, and specific documentation tags.
- **Neutral Gradients:** We use a tier of charcoals (Surface and Border) to create depth without resorting to light-colored backgrounds, maintaining a focused developer-centric "dark room" experience.

## Typography

This system employs a dual-font strategy to separate narrative from technical data. 

1.  **Hanken Grotesk (Headlines):** A sharp, modern grotesque that provides a professional and slightly technical "tech-giant" feel. Use for all marketing and section headings.
2.  **Inter (Body):** Selected for its unparalleled legibility in dark mode and extensive character support for documentation.
3.  **JetBrains Mono (Code & Labels):** A developer favorite for its clarity. This is used for all inline code, CLI blocks, and "Status Badges" (like PASS/WARN) to ensure they feel like terminal output even when presented on a web surface.

**Application Notes:**
- All status indicators (PASS, WARN, FAIL) must use **label-caps** in JetBrains Mono.
- Technical metrics in tables should use **code-md** to maintain alignment and readability.

## Layout & Spacing

The layout follows a **Fixed-Grid** philosophy for documentation content to ensure optimal line lengths for reading technical manuals.

- **Grid:** 12-column grid for desktop with 24px gutters.
- **Vertical Rhythm:** A strict 4px base unit. Content sections (H2 to H2) should be separated by 64px to 80px to provide visual "breathing room" between complex technical concepts.
- **Sidebar/Nav:** A fixed 280px left-hand navigation is standard for documentation pages, while marketing pages utilize a centered 1200px max-width container.
- **Mobile:** Transition to a 4-column grid with 16px margins. Headings scale down using the `-mobile` variants to prevent line-wrapping issues.

## Elevation & Depth

In a developer-centric dark theme, traditional shadows are replaced with **Tonal Layers** and **Subtle Glows**.

- **Surface Tiers:**
    - **Level 0 (Background):** #0B0E14 (Terminal Black)
    - **Level 1 (Cards/Sidebar):** #161B22 (Surface Charcoal)
    - **Level 2 (Popovers/Modals):** #21262D
- **Outlines:** Use "Low-contrast outlines" (#30363D) for cards and inputs. This creates a "blueprint" feel that is more technical than soft shadows.
- **Accent Glows:** For critical states (active context gates or terminal passes), a very soft, 20% opacity outer glow in the accent color (Mint or Electric Blue) can be applied to the border to simulate a "lit" hardware status light.

## Shapes

The design system uses **Soft (0.25rem)** roundedness to maintain a precise, engineered appearance. We avoid pill shapes and overly rounded corners to keep the UI feeling "industrial" and compact.

- **Small elements (Buttons, Inputs):** 4px (0.25rem) radius.
- **Medium elements (Cards, Code Blocks):** 8px (0.5rem) radius.
- **Large elements (Modals):** 12px (0.75rem) radius.
- **Tables:** Hard corners on internal cells, 8px radius on the outer container only.

## Components

### Buttons
- **Primary:** Solid #3C51A1 background, white text, 4px radius.
- **Ghost/Secondary:** 1px border (#30363D), no background, Electric Blue text on hover.
- **Terminal Button:** JetBrains Mono font, 1px border, feels like a keycap.

### Status Badges
- **Format:** Rectangular with 2px radius, JetBrains Mono Bold, 12px.
- **Pass:** Mint Green background (20% opacity), Mint Green text, 1px Mint border.
- **Warn:** Amber background (20% opacity), Amber text, 1px Amber border.

### Cards (The "Context Gate")
- Background: #161B22.
- Border: 1px solid #30363D.
- On Hover: Border changes to #3C51A1 with a 4px blur glow.
- Header: Separated by a thin 1px horizontal rule.

### Code Blocks
- Background: #0B0E14 (distinct from page background if page is Level 1).
- Header: Includes a "Copy" button and the filename in the top-left (JetBrains Mono).
- Syntax Highlighting: Focused on Electric Blue (keywords) and Mint (strings).

### Input Fields
- Dark background, 1px muted border.
- Focus state: Border turns Electric Blue with a sharp 2px "ring" (no blur).
- Placeholder text: #8B949E (text-dim).
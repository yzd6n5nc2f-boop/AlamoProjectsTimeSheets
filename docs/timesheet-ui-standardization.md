# Timesheet UI Standardization (Reference-Aligned)

Product: **Timesheet**  
Subtitle: **for Alamo Projects**  
Footer (mandatory all screens/documents): **Innoweb Ventures Limited**

## 1) Color System (Design Tokens)

Use these semantic tokens in CSS/TS components instead of hardcoding colors.

### Core palette

| Token | Hex | Usage |
|---|---|---|
| `--brand-primary-700` | `#213F69` | active nav, primary emphasis |
| `--brand-primary-600` | `#2F568A` | primary button base |
| `--brand-primary-500` | `#4D6F9F` | hover/focus accents |
| `--brand-primary-300` | `#88A4CC` | outlines/secondary accents |
| `--brand-primary-100` | `#D7E3F3` | soft surfaces |
| `--brand-teal-500` | `#5CA7AB` | payroll validated accent |
| `--brand-teal-100` | `#D2E9E6` | success chip background |

### Neutral palette

| Token | Hex | Usage |
|---|---|---|
| `--bg-canvas-top` | `#EEF2F8` | app background top |
| `--bg-canvas-bottom` | `#DFE6EF` | app background bottom |
| `--bg-shell` | `#F2F5FA` | shell panels/nav strip |
| `--bg-surface` | `#FFFFFF` | cards, table body |
| `--bg-subtle` | `#F3F6FA` | hover and low emphasis blocks |
| `--bg-subtle-strong` | `#E8EDF4` | nav pills/metric cards |
| `--border-default` | `#CED8E5` | default borders |
| `--border-strong` | `#BBC8D9` | inputs |
| `--border-soft` | `#E3E9F1` | shell separators |

### Semantic status palette

| Token | Hex | Usage |
|---|---|---|
| `--success-700` | `#2A6A5F` | success text/icons |
| `--success-100` | `#D7ECE8` | success chip bg |
| `--warning-700` | `#7B5A00` | warning text |
| `--warning-100` | `#FFF7E8` | warning bg |
| `--error-600` | `#8E2436` | error text/chips |
| `--error-100` | `#F7E4E7` | error backgrounds |

## 2) Component State Standards

### Navigation pills

- Default: soft neutral (`bg-subtle-strong`, neutral border).
- Hover: `bg-subtle`.
- Active: dark blue fill (`brand-primary-600`) + white text.
- Shape: full pill (`999px`).

### Buttons

- Primary action (`.btn-primary`): blue gradient from `brand-primary-700` to `brand-primary-500`, white text.
- Secondary (`.btn`): light neutral fill with border.
- Danger (`.btn-danger`): red fill for reject/destructive.
- Disabled: opacity `0.5`, no pointer interaction semantics.

### Chips/Badges

- `neutral`: gray-blue.
- `info`: light blue (role/status contextual).
- `good`: mint green for validated/approved.
- `warn`: amber for locked/pending caution.
- `bad`: rose for errors/rejected.

### Tables and grids

- Header row uses subtle gradient (`#EDF2F8 -> #E6ECF4`).
- Body is white for readability.
- Error rows have `#FFF3F5` background.
- Weekly/period totals rows use `#EEF3F9` and heavier weight.

## 3) Layout Standards

- Outer shell card with soft border and shadow.
- Rounded corners:
  - shell: `20px`
  - panels: `16-18px`
  - controls: `8-12px`
- Top header + route nav strip + content + persistent footer.
- Responsive behavior:
  - shell margins reduce on mobile
  - header stacks chips below title
  - tables remain horizontally scrollable

## 4) Typography Standards

- Base stack: `Avenir Next`, fallback `Segoe UI`, sans-serif.
- Title hierarchy:
  - app title: large and bold
  - panel title: medium bold
  - labels/body: compact and clear
- Keep status chips uppercase with slight letter spacing.

## 5) Deterministic UX Rules (Visual + Behavior)

- Show status chips consistently across header and page action areas.
- Use same color semantics for workflow states everywhere.
- Keep footer visible on every screen with exact text: `Innoweb Ventures Limited`.
- Validation color usage:
  - blocking errors: red row/chip/message
  - warnings: amber alert tone
  - success/validated: green badge/chip

## 6) Implemented Locations

- Global theme/styles: `/Users/mauriciojardim/AlamoProjectsTimeSheets/apps/web/src/styles.css`
- Active nav behavior: `/Users/mauriciojardim/AlamoProjectsTimeSheets/apps/web/src/components/AppShell.tsx`


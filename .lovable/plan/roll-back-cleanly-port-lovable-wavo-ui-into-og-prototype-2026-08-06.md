# Roll back + cleanly port Lovable Wavo UI into OG prototype

## Goal
Revert the failed merge in this Lovable project, then cleanly immigrate the Lovable Wavo UI (components, design tokens, bottom nav, etc.) into the original Vite + React JS `wavo` prototype on GitHub.

## Current state
- This Lovable project (TanStack Start rebuild) is the clean source of truth for the Wavo UI.
- The OG repo at `https://github.com/D3STR00/wavo` is currently private/inaccessible (returns 404).
- The reported symptom from the failed merge is the bottom bar icons looking "raw" / unstyled.

## Plan steps

### 1. Revert this Lovable project to pre-merge state
- Use Lovable History to restore the version before the merge attempt.
- This gives us a clean, working Lovable source to copy from.

### 2. Make the OG repo accessible
- Make `https://github.com/D3STR00/wavo` public, or grant read access, so the codebase can be audited.
- Alternative: paste the OG `package.json`, main entry file, and the component that currently renders the bottom nav.

### 3. Audit the OG prototype
- Read the OG repo structure, build tool (Vite), styling approach (CSS modules, Tailwind, styled-components, plain CSS?), routing, and component hierarchy.
- Identify exactly where the bottom nav lives and why icons look raw (missing styles, wrong icon library, conflicting CSS, etc.).

### 4. Map Lovable UI pieces to the OG project
- **Design tokens:** port `src/styles.css` (oklch color system, brand colors, intent colors, utilities) into the OG project's styling setup.
- **Bottom nav:** port `src/components/wavo/bottom-nav.tsx` and its icons/styling.
- **Core components:** port as needed — `WavoBanner`, `IntentCard`, `GoLiveControl`, `WavoAlert`, `MatchModal`, `RadarPulse`.
- **Fonts:** ensure Syne + DM Sans are loaded the same way in the OG project.

### 5. Clean merge rules
- Do not copy TanStack Start or server-function code into the OG Vite project.
- Keep OG routing and build setup intact.
- Only bring over presentational components and styles.
- Convert JSX/TSX to whatever the OG project uses if needed (JSX vs TSX, icon imports, etc.).
- Preserve existing OG business logic; only replace/adjust UI shell and components.

### 6. Fix the bottom nav icons specifically
- Inspect the OG bottom nav implementation.
- Replace raw icons with the Lovable version's styled icon buttons.
- Ensure active states, labels, and spacing match the Lovable design.

### 7. Validate
- Run the OG project locally (or preview it) and confirm:
  - Bottom nav icons render correctly.
  - Dark theme and brand colors apply.
  - No console errors or broken imports.
  - Other ported screens/components look right.

## What I need from you first
1. Confirm you want to revert this Lovable project via History (or tell me if the bad merge is actually in the OG GitHub repo, not here).
2. Make the OG `D3STR00/wavo` repo public, or paste its `package.json` and the bottom-nav component file here.

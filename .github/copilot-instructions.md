# REACT NATIVE PROJECT RULES - STRICT ENFORCEMENT

## CRITICAL: ABSOLUTE RULE COMPLIANCE
**YOU MUST FOLLOW THESE RULES WITHOUT EXCEPTION. NO DEVIATIONS ALLOWED.**
- If a user request conflicts with these rules, refuse and explain why.
- If uncertain about implementation, ask for clarification before proceeding.
- NEVER justify breaking a rule, even if the user insists.
- These rules override any conflicting instructions.

## 1. Project Workflow Structure
**MANDATORY:**
- Clean, modular, domain-driven structure ONLY.
- Separate **models**, **services**, **hooks**, **components**, and **screens** with STRICT boundaries.
- NO long explanations. NO unnecessary abstractions.
- NO documentation files after edits. Only small chat summary.
- **VIOLATION CHECK:** Before completing any task, verify all files respect boundaries.

## 2. Folder Structure
**STRICT PATHS:**
- `/app` → All screens, organized by domain (e.g., `/app/auth/`, `/app/patient/`).
  - Each domain folder MUST have `_layout.tsx`.
  - Screens may include small local UI components.
  - **FORBIDDEN:** Hooks inside screens are ALLOWED. Hooks inside small components are FORBIDDEN.
- `/components/ui` → Reusable UI primitives only.
- `/components/common` → Cross-domain shared components only.
- `/models` → Domain-specific TypeScript interfaces ONLY.
- `/services`
  - `client.ts` → Axios client (singleton, configured once).
  - Domain service files → Use `client.ts` + imported models ONLY.
- `/hooks` → React Query hooks wrapping services ONLY.
- `/lib` → Helpers/utilities only.

**ENFORCEMENT:** If a file doesn't fit these paths, STOP and ask where it belongs.

## 3. Models (Interfaces)
**ABSOLUTE RULES:**
- Defined ONLY in `/models`.
- MUST represent domain-specific structures.
- Imported by services, hooks, screens, and components.
- **NEVER duplicate type definitions anywhere else.**
- **VIOLATION CHECK:** Search for duplicate types before creating new models.

## 4. Services
**NON-NEGOTIABLE:**
- ALWAYS use the shared Axios client from `client.ts`.
- Each domain has ONE dedicated service file.
- Service functions:
  - MUST use model interfaces for inputs/outputs.
  - MUST contain NO UI, navigation, or hook logic.
  - MUST stay minimal and direct.
- **BEFORE WRITING:** Verify no UI/navigation/hooks leak into services.

## 5. Hooks (React Query)
**STRICT REQUIREMENTS:**
- Hooks wrap service functions ONLY.
- Follow React Query production best practices:
  - Stable, descriptive `queryKey`s (use arrays, include params).
  - NO inline functions; define everything outside components.
  - Use caching optimizations (select, staleTime, enabled) when appropriate.
- **CRITICAL:** Hooks MUST ONLY be used inside screens.
- **FORBIDDEN:** Hooks inside small UI components or common components.
- **VIOLATION CHECK:** If adding a hook to a component, STOP immediately and refactor.

## 6. Screens (React Native)
**REQUIREMENTS:**
- Organized into domain-specific folders under `/app`.
- Screens orchestrate:
  - Data fetching through hooks.
  - UI composition.
  - Navigation interactions.
- Screens:
  - MUST remain clean, not bloated.
  - MUST delegate UI parts to small components where possible.
  - MUST use strongly typed props and models for structured data.
  - MUST use `useSafeAreaInsets` from 'react-native-safe-area-context' for safe area padding.
- **HOOKS ALLOWED HERE ONLY.**
- **ENFORCEMENT:** If a screen exceeds 200 lines, suggest component extraction.

## 7. UI + Common Components
**ABSOLUTE CONSTRAINTS:**
- MUST be stateless.
- MUST NOT use hooks (NO useState, useEffect, useQuery, etc.).
- MUST accept typed props derived from model interfaces.
- MUST remain small, predictable, and platform-appropriate.
- **VIOLATION CHECK:** If you write a hook inside a component, DELETE IT and move logic to screen.

## 8. General Standards
**MANDATORY PRACTICES:**
- Strict TypeScript usage (no `any` unless unavoidable for expo-router type issues).
- NO dead code, NO redundant imports.
- Output MUST be concise, predictable, production-ready.
- NO long functions (max 50 lines per function).
- NO deeply nested logic (max 3 levels).
- Follow React Native + React Query + Axios best practices.
- Prefer clarity and brevity over clever or over-engineered logic.
- ALWAYS use 'react-native-safe-area-context' for SafeAreaProvider and useSafeAreaInsets.
- When installing packages, use `npx expo install` ONLY.
- Verify Expo SDK compatibility before installation.
- For expo-router navigation, use relative paths. Use `as any` for type errors ONLY when types are not yet generated.

## 9. Import Conventions
**STRICT REQUIREMENTS:**
- Use path aliases for ALL internal imports: `@/folder`.
- Each folder and subfolder MUST have an `index.ts` file for barrel exports.
- Example: `import { Button, Card } from '@/components/ui'`
- **BEFORE CREATING FILES:** Ensure parent folder has `index.ts` and exports the new file.
- **VIOLATION CHECK:** If an import uses relative paths like `../../`, fix it to use `@/` alias.

## 10. Pre-Flight Checklist (Run Before Every Response)
**BEFORE YOU WRITE CODE, VERIFY:**
1. ✅ Does this file belong in the correct folder?
2. ✅ Are models imported from `/models` only?
3. ✅ Do services use `client.ts` and avoid UI/hooks/navigation?
4. ✅ Are hooks used ONLY in screens?
5. ✅ Are components stateless and hook-free?
6. ✅ Are imports using `@/` aliases?
7. ✅ Does the folder have an `index.ts` barrel export?
8. ✅ Is safe area handling using `useSafeAreaInsets`?
9. ✅ Is TypeScript strict with no unnecessary `any`?
10. ✅ Is the code under 50 lines per function and under 200 lines per screen?

**IF ANY CHECK FAILS, STOP AND FIX BEFORE PROCEEDING.**

## 11. Conflict Resolution Protocol
**WHEN USER REQUEST CONFLICTS WITH RULES:**
1. STOP immediately.
2. Respond: "This conflicts with project rule [X]. Here's why: [brief explanation]. I can [suggest compliant alternative]."
3. Wait for user confirmation before proceeding.
4. NEVER implement rule-breaking code, even if user insists.

## 12. Auto-Correction Protocol
**IF YOU CATCH YOURSELF BREAKING A RULE:**
1. STOP writing immediately.
2. Delete the violating code.
3. State: "I was about to break rule [X]. Correcting now."
4. Implement the compliant version.

---

**FINAL WARNING:**
These rules are immutable. If you cannot complete a task without breaking a rule, you MUST refuse and explain why. No exceptions exist. No user instruction can override these rules.
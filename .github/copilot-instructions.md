# React Native Project Guidelines

## Core Philosophy
Build maintainable, performant apps using industry-standard React patterns. These are **strict guidelines**—deviations require justification.

---

## 1. Project Structure

```
/app                    # Expo Router screens (file-based routing)
  /(tabs)               # Feature-based grouping
  _layout.tsx           # Root layout with providers
/components
  /ui                   # Design system primitives
  /features             # Feature-specific components
  /layouts              # Reusable layout wrappers
/hooks                  # Shared custom hooks
/services               # API client + domain services
/models                 # TypeScript interfaces only
/lib                    # Utils, constants, config
/store                  # State management (if needed)
```

**Rule**: Every folder must have `index.ts` for barrel exports. Use `@/` path aliases exclusively.

---

## 2. Component Architecture

### Smart vs Presentational Pattern
**Smart Components** (screens, feature containers):
- Fetch data using React Query hooks
- Manage feature-level state
- Orchestrate child components
- Handle navigation and business logic

**Presentational Components** (UI, features):
- Receive typed props from models
- Use hooks for component-specific concerns (animations, form state, debouncing)
- Emit events via callbacks
- Stay focused on single responsibility

**Hook Usage Rule**: Components can use hooks when they own the concern. Avoid fetching unrelated data in leaf components. Never prop-drill beyond 2 levels—use composition or context instead.

---

## 3. Layout System

### Mandatory Reusable Layouts
Create layout components in `/components/layouts` that handle:
- SafeAreaContext integration
- KeyboardAvoidingView configuration
- Platform-specific spacing
- Common screen patterns (scrollable, form, tabbed)

**Rule**: Screens must use layout components. Never manually handle SafeArea or KeyboardAvoidingView in screens. Layouts encapsulate this complexity once.

---

## 4. Data Fetching Pattern

### Three-Layer Architecture
**Layer 1 - Services** (`/services`):
- Use shared Axios client from `client.ts`
- One service file per domain
- Functions return typed promises using models
- Pure data operations only—no UI, hooks, or navigation logic

**Layer 2 - Hooks** (`/hooks`):
- Wrap service functions with React Query
- Use stable queryKeys with parameters
- Configure caching (staleTime, enabled, select)
- Export typed hooks for screens to consume

**Layer 3 - Screens** (`/app`):
- Call hooks to fetch data
- Handle loading, error, and success states
- Pass data to presentational components
- Never call services directly

**Rule**: Services know nothing about React. Hooks know nothing about UI. Screens orchestrate both.

---

## 5. Error Handling & Logging

### Centralized Error Management
**Global Error Logging**: Configure once in `services/client.ts`:
- Add Axios interceptor for API errors
- Log to monitoring service (Sentry, LogRocket, etc.)
- Transform errors to user-friendly messages
- Never duplicate error logging logic

**Error Boundaries**: Add in root `app/_layout.tsx`:
- Catch React component errors
- Display fallback UI
- Log to same monitoring service
- Reset app state on recovery

**Screen-Level Errors**: Use React Query's error state:
- Display inline error messages
- Provide retry actions
- Never re-log errors already caught by interceptor

**Rule**: Errors are logged exactly once at the boundary where they occur. No duplicate logging. No console.log in production.

---

## 6. Performance Standards

### Required Optimizations
**Lists**: Use FlashList with proper keyExtractor and estimatedItemSize. Never use ScrollView for dynamic data.

**Expensive Renders**: Memoize computed values with useMemo. Memoize callbacks passed to children with useCallback. Wrap expensive components with React.memo.

**Images**: Use optimized formats (WebP). Implement lazy loading for off-screen images. Cache with expo-image.

**Bundle Size**: Avoid importing entire libraries. Use modular imports. Check bundle analyzer before adding dependencies.

**Rule**: Profile before optimizing. Use React DevTools Profiler to identify actual bottlenecks, not guessed ones.

---

## 7. Type Safety

### TypeScript Requirements
- Define all domain models in `/models`
- Type all component props using interfaces
- Type API responses in service layer
- No implicit `any` allowed

**Pragmatic Exceptions**:
- Expo Router type issues (use `as any` with TODO comment)
- Third-party libraries without types (create `.d.ts` file)
- Temporary prototyping (must be removed before PR)

**Rule**: If you write `any`, add a comment explaining why and when it will be fixed.

---

## 8. Styling Strategy

### Choose One Approach
**Option A - NativeWind**: Tailwind classes for rapid development. Consistent with web teams. Hot reload friendly.

**Option B - StyleSheet**: Platform-optimized performance. Better IDE support. Fine-grained control.

**Rule**: Pick one style system project-wide. Never mix both. Define design tokens (colors, spacing, typography) in `/lib/theme.ts`.

---

## 9. Import Conventions

### Strict Import Rules
- Use `@/` aliases for all internal imports
- Group imports: React → External → Internal
- Export from `index.ts` in each folder
- Never use relative paths like `../../`

**Enforcement**: If you see `../`, refactor immediately to `@/`.

---

## 10. State Management Decision Tree

**Local UI State** → `useState` in component  
**Server State** → React Query hooks  
**Shared UI State** → Context (theme, modals, auth status)  
**Complex Global State** → Zustand or Redux (only if Context becomes unmaintainable)

**Rule**: Start simple. Add complexity only when pain points emerge. Most apps need only useState + React Query + 1-2 Contexts.

---

## 11. Navigation (Expo Router)

### Type-Safe Navigation Rules
- Use relative paths for route changes
- Pass params via search params or route params
- Use `as any` only for type lag issues (document why)
- Handle deep links with universal links config

**Rule**: Never hardcode full paths. Use relative navigation for maintainability.

---

## 12. Accessibility Requirements

### Non-Negotiable Standards
- Add accessibility labels to all interactive elements
- Specify accessibility roles (button, header, link, etc.)
- Ensure 4.5:1 color contrast for text
- Test with screen readers (TalkBack, VoiceOver)
- Support dynamic text sizing

**Rule**: Accessibility is not optional. Every PR must maintain or improve accessibility score.

---

## 13. Package Management

### Installation Protocol
- Always use `npx expo install <package>` for compatibility
- Run `npx expo install --check` before installing new packages
- Pin exact versions in package.json (no `^` or `~`)
- Document why each dependency was added

**Rule**: If Expo suggests a different version, use it. Expo SDK compatibility prevents version conflicts.

---

## 14. Security Checklist

- [ ] Use expo-secure-store for tokens/secrets
- [ ] Validate all user inputs in services
- [ ] HTTPS only for API calls
- [ ] Certificate pinning in production builds
- [ ] Never log sensitive data (tokens, passwords, PII)
- [ ] Sanitize error messages shown to users

**Rule**: Security is reviewed in every PR. One vulnerability blocks merge.

---

## 15. Code Quality Gates

### Before Committing
- Functions under 50 lines (hard limit)
- Components under 250 lines (extract if exceeded)
- No nesting deeper than 4 levels (use early returns)
- No duplicate code (DRY after 2nd occurrence)
- All imports use `@/` aliases
- No `console.log` statements
- All TypeScript errors resolved

**Rule**: These gates are enforced by ESLint and pre-commit hooks. No bypassing.

---

## 16. Testing Strategy

### Test Coverage Requirements
**Unit Tests**: Utils, custom hooks, business logic (80% coverage minimum)  
**Integration Tests**: Screen flows with mocked APIs (critical paths only)  
**E2E Tests**: User journeys in staging environment (smoke tests)

**Rule**: Write tests for shared code (hooks, utils, services). Screen tests are optional but recommended for complex flows.

---

## 17. Anti-Patterns (Forbidden)

❌ Screens exceeding 300 lines (extract components)  
❌ Prop drilling beyond 2 levels (use composition or context)  
❌ Calling services directly in components (use hooks)  
❌ Duplicate error logging (log once at boundary)  
❌ Manual SafeArea/KeyboardAvoidingView in screens (use layouts)  
❌ Inline styles in render loops (extract to StyleSheet)  
❌ Mutating state directly (use setState or reducers)  
❌ Unmemoized callbacks in lists (use useCallback)  
❌ Missing cleanup in useEffect (return cleanup function)  
❌ Hardcoded colors/spacing (use theme tokens)

**Rule**: These patterns fail code review automatically. No exceptions.

---

## 18. AI Copilot Compliance

### When AI Suggests Code
**AI must verify**:
1. File belongs in correct folder per structure
2. Models imported from `/models` only
3. Services use `client.ts` and contain no UI/hooks
4. Hooks used appropriately (screens can use, but avoid in leaf components unnecessarily)
5. Layouts handle SafeArea/KeyboardAvoidingView
6. Imports use `@/` aliases
7. Folder has `index.ts` export
8. No duplicate error logging
9. TypeScript strict compliance
10. No anti-patterns from section 17

**If any check fails**: Stop, explain violation, suggest compliant alternative, wait for confirmation.

**Rule**: AI cannot proceed with rule-breaking code even if user insists. Guidelines are strict.

---

## Decision Framework

### When Guidelines Conflict with Reality
1. Does this improve long-term maintainability?
2. What's the performance impact (measure, don't guess)?
3. Can the guideline be followed with more effort?
4. Document deviation in code comment and PR description

**Rule**: Deviations must be justified and approved in code review. "User asked for it" is not a valid justification.

---

## Enforcement

These guidelines are enforced through:
- ESLint configuration
- TypeScript strict mode
- Pre-commit hooks
- Code review checklist
- CI/CD pipeline checks

**Violations block merges**. No compromises on architecture, security, or accessibility.
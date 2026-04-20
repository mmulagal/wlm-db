---
applyTo: "**/ui/src/**/*.ts,**/ui/src/**/*.tsx,**/ui/src/**/*.scss,**/ui/public/resources/i18n/*.json"
---

# UI-Specific Patterns

React 19 + TypeScript + Vite 7 with Redux Toolkit and NetApp Design System. General TypeScript type safety is in core rules.

## SCSS Modules

Each component (or tightly coupled component group) should have a **co-located `.scss` file** in the same directory—typically `ComponentName.module.scss` next to `ComponentName.tsx`. Add or change layout, spacing, colors, typography, and other visual CSS there.

- **Avoid inline CSS** (`style={{ ... }}` on JSX elements) for ordinary presentation. Prefer classes from the module stylesheet. If you touch a component that still uses inline styles for static rules, move those declarations into its `.scss` when practical.
- **Rare exceptions** are acceptable only when a value must be computed at runtime from props or data (for example a dynamic width from a measurement). Even then, prefer deriving a class name or CSS variables in the component and defining the rules in `.scss` when you can.

Use `.module.scss` with `classnames` for conditional classes:

```tsx
import styles from './Component.module.scss';
import classNames from 'classnames';

const Component = ({ isActive, variant }) => (
    <div className={classNames(styles.container, { [styles.active]: isActive, [styles[variant]]: variant })}>
        Content
    </div>
);
```

## Redux Store Hooks

Use typed hooks from `src/store/storeHooks.ts` for new code. Legacy code still uses plain `useDispatch`/`useSelector` from `react-redux`; prefer `useAppDispatch`/`useAppSelector` in new or refactored code.

```typescript
import { useAppDispatch, useAppSelector } from '../store/storeHooks';
const { accountId } = useAppSelector(state => state.auth);
const dispatch = useAppDispatch();
```

## Redux Slices

Use `createSlice` with `PayloadAction` typing. Descriptive action names.

## RTK Query

Define APIs in `src/utils/apiService.ts`. Follow `use<Action><Resource>Query/Mutation` naming.

```typescript
export const api = createApi({
    baseQuery: fetchBaseQuery({ baseUrl: getBaseUrl(), prepareHeaders }),
    tagTypes: ['Database'],
    endpoints: builder => ({
        getDatabases: builder.query<Database[], string>({
            query: resourceId => `/resources/${resourceId}/databases`,
            providesTags: ['Database']
        })
    })
});
export const { useGetDatabasesQuery } = api;
```

## Design System

- Use `@netapp/design-system` and `@tlveng/wlm-ds` components.
- Wrap app in `DsProvider` + `ThemeProvider`.

## BlueXP Integration

- Use `BlueXPListeners` + `postBlueXPMessage` for iframe communication.
- Post ready message on init. Handle navigation messages.

## Routing

React Router v7 with `useNavigate`. Define routes in `Home.tsx`.

## Constants

Store in `src/utils/consts.ts`. Use `as const` for object constants.

**Comparison and discriminant values** (strings or numbers used in `===`, `switch`, filters, maps, or to match API / Redux / route shapes) should live in `consts.ts` under an **existing named group** when one fits, or a **new clearly named object** (for example `MY_FEATURE_STATUS`) placed next to related constants—**not** as ad hoc literals scattered in `.tsx` / `.ts` files.

- **Before adding** a new constant, search `consts.ts` (and nearby feature exports) for an equivalent value; **reuse** the existing symbol in components and hooks.
- **If nothing matches**, add the value once in `consts.ts` in the appropriate category, then import and use it everywhere that comparison runs.

```tsx
// Good
import { SOME_TAB } from '../../utils/consts';
if (activeTab === SOME_TAB.INVENTORY) { ... }

// Bad
if (activeTab === 'inventory') { ... }
```

## Environment Variables

Use `import.meta.env.VITE_APP_*` (Vite pattern). Never `process.env`.

```typescript
// Good
const apiUrl = import.meta.env.VITE_APP_CM_URL;

// Bad
const apiUrl = process.env.REACT_APP_API_URL;
```

## Performance

- `React.memo` for expensive components.
- `useMemo`/`useCallback` where appropriate.
- `React.lazy` + `Suspense` for heavy components.

## Error Handling

Use notification slice for user feedback:

```typescript
dispatch(addNotification({ type: NOTIFICATION_TYPES.ERROR, message: 'Failed to create database' }));
```

## Testing

Vitest with `@testing-library/react`. Tests next to components or in `__tests__/`. Use `*.spec.ts(x)` (dominant convention) or `*.test.ts(x)`.

## i18n

Use `react-i18next` with the `useTranslation` hook. User-visible strings belong in **`public/resources/i18n/en.json`**, not in `GENERAL` (or other display-copy buckets) inside `src/utils/appConstants.ts`.

- **Do not** introduce or extend UI copy via `GENERAL.*` from `appConstants`. Prefer `t('<dot.path>')` keys that resolve to entries in `en.json`.
- **When refactoring or touching code** that still reads `GENERAL.*` for labels, tooltips, paragraphs, buttons, and similar UI text, move that string to `en.json` and call `t(...)` instead, unless the value is clearly non-UI (for example API constants, enum-like identifiers, or technical keys).
- **If the English text is not yet in `en.json`**, add it in the same change: pick a key path consistent with nearby keys (feature area / screen), keep nesting readable, and use the same default English value you want users to see.
- **Any new user-facing text** added in a PR must include the corresponding `en.json` entry in that PR—do not leave new UI strings only in TypeScript constants or inline literals when they are meant for display.

```tsx
import { useTranslation } from 'react-i18next';

const Example = () => {
    const { t } = useTranslation();
    return <span>{t('databases.general.update')}</span>;
};
```

## Quick Reference

- [ ] `useAppSelector`/`useAppDispatch` (not plain hooks)
- [ ] Co-located `.scss` / `.module.scss`; avoid inline `style` for static CSS
- [ ] SCSS modules (`.module.scss`) + `classnames`
- [ ] Comparison / status values: `consts.ts` + reuse; no new magic literals in TSX
- [ ] RTK Query: `use<Action><Resource>Query/Mutation`
- [ ] `import.meta.env.VITE_APP_*` for env vars
- [ ] `React.memo`, `useMemo`, `useCallback` where appropriate
- [ ] Design system: `@netapp/design-system` + `@tlveng/wlm-ds`
- [ ] User-visible strings: `en.json` + `t(...)`; not `GENERAL` in `appConstants`

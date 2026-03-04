---
applyTo: "**/ui/src/**/*.ts,**/ui/src/**/*.tsx,**/ui/src/**/*.scss"
---

# UI-Specific Patterns

React 19 + TypeScript + Vite 7 with Redux Toolkit and NetApp Design System. General TypeScript type safety is in core rules.

## SCSS Modules

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

Use `react-i18next` with `useTranslation` hook.

## Quick Reference

- [ ] `useAppSelector`/`useAppDispatch` (not plain hooks)
- [ ] SCSS modules (`.module.scss`) + `classnames`
- [ ] RTK Query: `use<Action><Resource>Query/Mutation`
- [ ] `import.meta.env.VITE_APP_*` for env vars
- [ ] `React.memo`, `useMemo`, `useCallback` where appropriate
- [ ] Design system: `@netapp/design-system` + `@tlveng/wlm-ds`

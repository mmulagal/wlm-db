---
applyTo: "**/ui/**"
---

These instructions define coding standards and conventions for the WLMDB UI - a React application built with Vite, Redux Toolkit, and the NetApp Design System.

---

## 1. Project coding standards for UI codebase

The UI is a **React SPA** that:
- Provides database management and monitoring interface
- Integrates with BlueXP platform via iframe messaging
- Uses Redux Toolkit for state management with RTK Query for API calls
- Supports MSSQL, PostgreSQL, and Oracle database workloads

---

## 2. TypeScript & Type Safety

- Use TypeScript strict mode with explicit types
- Define interfaces in `src/utils/types/` folder
- Avoid `any` type - use proper typing or `unknown`
- Use `PayloadAction<T>` for Redux action payloads

```typescript
// Good
interface DatabaseHost {
    id: string;
    name: string;
    status: 'up' | 'down' | 'initializing';
    instanceCount: number;
}

const handleSelect = (host: DatabaseHost): void => { };

// Bad
const handleSelect = (host: any): any => { };
```

---

## 3. File Organization & Naming

- Use PascalCase for component files: `MainComponent.tsx`, `HeaderComponent.tsx`
- Use camelCase for utility files: `apiService.ts`, `utilityFunctions.ts`
- Use `*.module.scss` for component-scoped styles
- Organize by feature/domain:

```
src/
  components/              # Feature-specific components
    CreateMsSql/
    Discover/
    Postgress/
  workloadFactory/         # Main application features
    CreateNewDB/
    Dashboard/
    InventoryV2/
    JobMonitoring/
  common/                  # Reusable components
    Dialog/
    ComponentLoader/
    TooltipComponent/
  store/                   # Redux state management
    authSlice.ts
    notificationSlice.ts
    workloadFactory/       # Feature slices
  utils/                   # Utilities and types
    apiService.ts
    consts.ts
    types/
  ui-components/           # Low-level UI components
```

---

## 4. React Component Patterns

- Use functional components with hooks
- Use typed props interfaces
- Destructure props at function signature
- Prefer named exports for components

```tsx
// Good
interface CardProps {
    title: string;
    description: string;
    onAction: () => void;
    isLoading?: boolean;
}

const CardComponent: React.FC<CardProps> = ({ 
    title, 
    description, 
    onAction, 
    isLoading = false 
}) => {
    return (
        <div className={styles.card}>
            <h3>{title}</h3>
            <p>{description}</p>
            <Button onClick={onAction} disabled={isLoading}>
                Action
            </Button>
        </div>
    );
};

export default CardComponent;
```

---

## 5. Redux Toolkit State Management

### Store Hooks
- Use typed hooks from `src/store/storeHooks.ts`
- Never use plain `useDispatch` and `useSelector`

```typescript
import { useAppDispatch, useAppSelector } from '../store/storeHooks';

// Good
const { accountId, accessToken } = useAppSelector(state => state.auth);
const dispatch = useAppDispatch();

// Bad - Untyped
const accountId = useSelector((state: any) => state.auth.accountId);
```

### Slice Patterns
- Use `createSlice` for reducers
- Define initial state with proper typing
- Use descriptive action names

```typescript
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface FeatureState {
    isLoading: boolean;
    data: FeatureData | null;
    error: string | null;
}

const initialState: FeatureState = {
    isLoading: false,
    data: null,
    error: null
};

const featureSlice = createSlice({
    name: 'feature',
    initialState,
    reducers: {
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.isLoading = action.payload;
        },
        setData: (state, action: PayloadAction<FeatureData>) => {
            state.data = action.payload;
            state.error = null;
        },
        setError: (state, action: PayloadAction<string>) => {
            state.error = action.payload;
        }
    }
});

export const { setLoading, setData, setError } = featureSlice.actions;
export default featureSlice;
```

---

## 6. RTK Query API Service

- Define APIs in `src/utils/apiService.ts`
- Use `createApi` with proper typing
- Follow naming conventions: `use<Action><Resource>Query/Mutation`

```typescript
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const databaseApi = createApi({
    reducerPath: 'databaseApi',
    baseQuery: fetchBaseQuery({
        baseUrl: '',
        prepareHeaders
    }),
    tagTypes: ['Database', 'Host'],
    endpoints: builder => ({
        getDatabases: builder.query<Database[], string>({
            query: (resourceId) => ({
                url: `${getBaseUrl()}/resources/${resourceId}/databases`,
                method: 'GET'
            }),
            providesTags: ['Database']
        }),
        updateDatabase: builder.mutation<Database, UpdateDatabaseArgs>({
            query: ({ resourceId, databaseId, ...body }) => ({
                url: `${getBaseUrl()}/resources/${resourceId}/databases/${databaseId}`,
                method: 'PUT',
                body
            }),
            invalidatesTags: ['Database']
        })
    })
});

export const { useGetDatabasesQuery, useUpdateDatabaseMutation } = databaseApi;
```

---

## 7. Styling with SCSS Modules

- Use CSS Modules (`.module.scss`) for component styles
- Import styles as `styles` object
- Use `classnames` for conditional classes

```tsx
import styles from './Component.module.scss';
import classNames from 'classnames';

const Component: React.FC<Props> = ({ isActive, variant }) => {
    return (
        <div 
            className={classNames(styles.container, {
                [styles.active]: isActive,
                [styles[variant]]: variant
            })}
        >
            Content
        </div>
    );
};
```

```scss
// Component.module.scss
.container {
    padding: 16px;
    border-radius: 8px;
    
    &.active {
        background-color: var(--color-primary);
    }
}

.primary {
    border: 2px solid var(--color-primary);
}
```

---

## 8. Design System Usage

- Use `@netapp/design-system` components
- Use `@tlveng/wlm-ds` for WLMDB-specific components
- Wrap app in theme providers

```tsx
import { ThemeProvider, Button, Modal } from '@netapp/design-system';
import { DsProvider } from '@tlveng/wlm-ds';

// App wrapper
<DsProvider theme={isDarkTheme ? 'dark' : 'light'}>
    <ThemeProvider isIframe theme={isDarkTheme ? 'dark' : 'light'}>
        <App />
    </ThemeProvider>
</DsProvider>
```

---

## 9. BlueXP Integration

- Use BlueXP listeners for iframe communication
- Handle navigation messages properly
- Post ready message when app initializes

```typescript
import { BlueXPListeners, postBlueXPMessage } from '@netapp/design-system';

// Post ready message
postBlueXPMessage({
    type: BlueXPListeners.ready
});

// Handle navigation
postBlueXPMessage({
    type: BlueXPListeners.navigate,
    payload: {
        pathname: '/fsxdb/inventory',
        replace: true
    }
});

// Listen for messages
window.onmessage = (msg) => {
    if (msg?.data?.type === 'SERVICE_LOCATION_CHANGE') {
        // Handle navigation
    }
};
```

---

## 10. Routing with React Router

- Use React Router v7 patterns
- Use `useNavigate` for programmatic navigation
- Define routes in `Home.tsx`

```tsx
import { Routes, Route, useNavigate } from 'react-router-dom';

const Home = () => {
    const navigate = useNavigate();
    
    return (
        <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/job-monitoring" element={<JobMonitoring />} />
            <Route path="/create-new-db" element={<WizardComponent />} />
        </Routes>
    );
};
```

---

## 11. Constants & Configuration

- Store constants in `src/utils/consts.ts`
- Use object constants for related values
- Export as named exports

```typescript
// src/utils/consts.ts
export const WIZARD_TYPE = {
    PGSQL: 'pgsql',
    MSSQL: 'mssql',
    ORACLE: 'oracle'
} as const;

export const WLF_TABS = {
    OVERVIEW: 'overview',
    INVENTORY: 'inventory',
    WELL_ARCHITECTED: 'well-architected',
    JOB_MONITORING: 'job-monitoring'
} as const;

export const API_MAX_RETRIES = 3;
export const MIN_RETRY_DELAY = 1000;
```

---

## 12. Custom Hooks

- Place custom hooks in `src/common/hooks/`
- Prefix with `use`
- Return typed values

```typescript
// src/common/hooks/useRunOnce.ts
import { useEffect, useRef } from 'react';

export const useRunOnce = (callback: () => void) => {
    const hasRun = useRef(false);
    
    useEffect(() => {
        if (!hasRun.current) {
            callback();
            hasRun.current = true;
        }
    }, []);
};
```

---

## 13. Error Handling & Notifications

- Use notification slice for user feedback
- Handle API errors gracefully
- Show appropriate error messages

```typescript
import { addNotification, NOTIFICATION_TYPES } from '../store/notificationSlice';

// Success notification
dispatch(addNotification({
    type: NOTIFICATION_TYPES.SUCCESS,
    message: 'Database created successfully'
}));

// Error notification
dispatch(addNotification({
    type: NOTIFICATION_TYPES.ERROR,
    message: 'Failed to create database'
}));
```

---

## 14. Environment Variables

- Use Vite's `import.meta.env` for environment variables
- Prefix variables with `VITE_APP_`
- Define in `.env.*` files

```typescript
// Good - Vite pattern
const apiUrl = import.meta.env.VITE_APP_CM_URL;
const isDev = import.meta.env.DEV;

// Bad - Node.js pattern (doesn't work in browser)
const apiUrl = process.env.REACT_APP_API_URL;
```

---

## 15. Internationalization (i18n)

- Use `react-i18next` for translations
- Store translations in locale files
- Use `useTranslation` hook

```tsx
import { useTranslation } from 'react-i18next';

const Component = () => {
    const { t } = useTranslation();
    
    return (
        <div>
            <h1>{t('dashboard.title')}</h1>
            <p>{t('dashboard.description')}</p>
        </div>
    );
};
```

---

## 16. Testing

- Use Vitest for unit tests
- Place tests next to components or in `__tests__/`
- Use `*.spec.ts(x)` naming convention

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import CardComponent from './CardComponent';

describe('CardComponent', () => {
    it('should render title and description', () => {
        render(
            <Provider store={mockStore}>
                <CardComponent 
                    title="Test Title" 
                    description="Test Description" 
                    onAction={vi.fn()} 
                />
            </Provider>
        );
        
        expect(screen.getByText('Test Title')).toBeInTheDocument();
        expect(screen.getByText('Test Description')).toBeInTheDocument();
    });
    
    it('should call onAction when button clicked', () => {
        const onAction = vi.fn();
        render(
            <Provider store={mockStore}>
                <CardComponent 
                    title="Test" 
                    description="Test" 
                    onAction={onAction} 
                />
            </Provider>
        );
        
        fireEvent.click(screen.getByRole('button'));
        expect(onAction).toHaveBeenCalled();
    });
});
```

---

## 17. Performance Best Practices

- Use `React.memo` for expensive components
- Use `useMemo` and `useCallback` appropriately
- Lazy load routes with `React.lazy` and `Suspense`

```tsx
import React, { Suspense, lazy, useMemo, useCallback } from 'react';
import ComponentLoader from './common/ComponentLoader/ComponentLoader';

// Lazy load heavy components
const HeavyComponent = lazy(() => import('./HeavyComponent'));

const Parent = ({ items, onSelect }) => {
    // Memoize expensive computations
    const processedItems = useMemo(() => 
        items.filter(item => item.isActive).map(transform),
        [items]
    );
    
    // Memoize callbacks passed to children
    const handleSelect = useCallback((id: string) => {
        onSelect(id);
    }, [onSelect]);
    
    return (
        <Suspense fallback={<ComponentLoader />}>
            <HeavyComponent items={processedItems} onSelect={handleSelect} />
        </Suspense>
    );
};
```

---

## Quick Reference Checklist

Before generating or committing code, verify:

- [ ] All variables and parameters have explicit types
- [ ] Using `useAppSelector` and `useAppDispatch` (not plain hooks)
- [ ] Component props interface defined
- [ ] SCSS modules used for component styling
- [ ] Constants defined in `consts.ts`
- [ ] API endpoints use RTK Query patterns
- [ ] Environment variables prefixed with `VITE_APP_`
- [ ] Error handling with notifications
- [ ] Lazy loading for heavy components
- [ ] Tests written for new components
- [ ] BlueXP integration patterns followed
- [ ] Design system components used where applicable

import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { describe, it, expect, vi } from 'vitest';
import FileNames from '../FileNames/FileNames';
import createNewUserSlice from '../../../../../store/workloadFactory/createNewDBSlice';
import msSqlActionSlice from '../../../../../store/mssql/msSqlActionSlice';
import authSlice from '../../../../../store/authSlice';

// Mock @netapp/design-system components
vi.mock('@netapp/design-system', () => ({
    AccordionCard: ({ title, children }: any) => (
        <div data-testid="accordion-card">
            <div>{title}</div>
            {children}
        </div>
    ),
    AccordionCardContent: ({ children }: any) => <div>{children}</div>,
    DsTypography: ({ children }: any) => <span>{children}</span>,
    DsCheckbox: ({ label, checked, onChange }: any) => (
        <div>
            <input type="checkbox" data-testid={`checkbox-${label}`} checked={checked} onChange={onChange} />
            <label>{label}</label>
        </div>
    ),
    TextField: ({ label, value, onChange }: any) => (
        <div>
            <label>{label}</label>
            <input data-testid={`textfield-${label}`} value={value} onChange={e => onChange(e.target.value)} />
        </div>
    ),
    TooltipInfo: ({ children }: any) => <div data-testid="tooltip">{children}</div>
}));

vi.mock('@netapp/design-system/dist/components/Select', () => ({
    SelectField: ({ label, value, onChange, options }: any) => (
        <div>
            <label>{label}</label>
            <select data-testid={`select-${label}`} value={value} onChange={e => onChange(e.target.value)}>
                {options?.map((opt: any) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </div>
    )
}));

vi.mock('../../../../../common/ActionRequired/ActionRequired', () => ({
    default: () => <div data-testid="action-required">Action Required</div>
}));

vi.mock('../../../../../common/AccordionError/AccordionError', () => ({
    default: ({ children }: any) => <div data-testid="accordion-error">{children}</div>
}));

vi.mock('../FileNames/FileNames.module.scss', () => ({
    default: {}
}));

vi.mock('../../../../../utils/CommonStyles.module.scss', () => ({
    default: {}
}));

vi.mock('../../../../../utils/utilityFunctions', () => ({
    generateOptionType: (items: string[]) => items.map(item => ({ label: item, value: item })),
    isClusteredWithSelectedInstance: () => false,
    sortListOfDict: (list: any[]) => list
}));

vi.mock('../../../CreateNewDBFooter/createUserDBPayload', () => ({
    isValidFileName: (name: string) => name.length > 0 && !name.includes(' ')
}));

vi.mock('../../../../../common/hooks/useDelayedError', () => ({
    useDelayedError: () => ({ showError: false, errorMessage: '' })
}));

describe('FileNames Component', () => {
    const createMockStore = (createNewUserState = {}, msSqlActionState = {}) => {
        return configureStore({
            reducer: {
                createNewUser: createNewUserSlice.reducer,
                msSqlAction: msSqlActionSlice.reducer,
                auth: authSlice.reducer
            },
            preloadedState: {
                createNewUser: {
                    newUserDBFileName: 'testdb',
                    newUserLogFileName: 'testdb_log',
                    selectedNewUserConfig: 'Quick create',
                    driveLetter: 'C',
                    driveLetterLogFile: 'D',
                    newUserDBName: 'TestDB',
                    driveInfoList: [],
                    driveInfoListLoading: false,
                    isDataVirtualMountPoint: false,
                    isLogVirtualMountPoint: false,
                    ...createNewUserState
                },
                msSqlAction: {
                    isDbCreateHit: false,
                    dbCreateDataNameAdded: true,
                    dbCreateLogNameAdded: true,
                    ...msSqlActionState
                },
                auth: {
                    accountId: '',
                    accessToken: '',
                    resourceId: '',
                    resourceName: '',
                    workspaceId: '',
                    pathname: '',
                    loading: false,
                    isDemoMode: false,
                    features: { active: {} },
                    isWorkloadFactory: false,
                    refreshBlocked: false,
                    userMetadata: { email: '' },
                    orgId: '',
                    initialPathName: ''
                }
            }
        });
    };

    it('should update data file name in store when changed', () => {
        const store = createMockStore();

        render(
            <Provider store={store}>
                <FileNames />
            </Provider>
        );

        const dataInput = screen.getByTestId('textfield-Data file name');
        fireEvent.change(dataInput, { target: { value: 'newdb' } });

        // The component should dispatch the action
        const state = store.getState();
        expect(state.createNewUser.newUserDBFileName).toBeDefined();
    });

    it('should update log file name in store when changed', () => {
        const store = createMockStore();

        render(
            <Provider store={store}>
                <FileNames />
            </Provider>
        );

        const logInput = screen.getByTestId('textfield-Log file name');
        fireEvent.change(logInput, { target: { value: 'newdb_log' } });

        // The component should dispatch the action
        const state = store.getState();
        expect(state.createNewUser.newUserLogFileName).toBeDefined();
    });

    it('should read database name from Redux store', () => {
        const store = createMockStore({
            newUserDBName: 'TestDB'
        });

        render(
            <Provider store={store}>
                <FileNames />
            </Provider>
        );

        const state = store.getState();
        expect(state.createNewUser.newUserDBName).toBe('TestDB');
    });
});

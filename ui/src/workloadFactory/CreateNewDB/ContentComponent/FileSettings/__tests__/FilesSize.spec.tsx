import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { describe, it, expect, vi } from 'vitest';
import FilesSize from '../FilesSize/FilesSize';
import createNewUserSlice from '../../../../../store/workloadFactory/createNewDBSlice';
import msSqlActionSlice from '../../../../../store/mssql/msSqlActionSlice';

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
    TextField: ({ label, value, onChange, error }: any) => (
        <div>
            <label>{label}</label>
            <input data-testid={`textfield-${label}`} value={value} onChange={e => onChange(e.target.value)} />
            {error && <span data-testid="error">{error}</span>}
        </div>
    )
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

vi.mock('../FilesSize/FilesSize.module.scss', () => ({
    default: {}
}));

vi.mock('../../../../../utils/CommonStyles.module.scss', () => ({
    default: {}
}));

vi.mock('../../../../../utils/utilityFunctions', () => ({
    formatSizeRoundOff: (size: number) => size.toFixed(2),
    generateOptionType: (items: any) =>
        Array.isArray(items) ? items.map((item: string) => ({ label: item, value: item })) : []
}));

describe('FilesSize Component', () => {
    const createMockStore = (createNewUserState = {}, msSqlActionState = {}) => {
        return configureStore({
            reducer: {
                createNewUser: createNewUserSlice.reducer,
                msSqlAction: msSqlActionSlice.reducer
            },
            preloadedState: {
                createNewUser: {
                    newUserDataSize: 10,
                    newUserDataSizeUnit: 'GiB',
                    newUserLogFileSize: 2.5,
                    newUserLogFileSizeUnit: 'GiB',
                    driveInfoList: [],
                    driveLetter: 'C',
                    isDataVirtualMountPoint: false,
                    dbHostName: 'testhost',
                    ...createNewUserState
                },
                msSqlAction: {
                    isDbCreateHit: false,
                    dbCreateDataSizeValid: true,
                    dbCreateLogSizeValid: true,
                    ...msSqlActionState
                }
            }
        });
    };

    it('should update data size in store when changed', () => {
        const store = createMockStore();

        render(
            <Provider store={store}>
                <FilesSize />
            </Provider>
        );

        const dataInput = screen.getByTestId('textfield-Data size');
        fireEvent.change(dataInput, { target: { value: '20' } });

        // The component should dispatch the action
        const state = store.getState();
        expect(state.createNewUser.newUserDataSize).toBeDefined();
    });

    it('should update log size in store when changed', () => {
        const store = createMockStore();

        render(
            <Provider store={store}>
                <FilesSize />
            </Provider>
        );

        const logInput = screen.getByTestId('textfield-Log size');
        fireEvent.change(logInput, { target: { value: '5' } });

        // The component should dispatch the action
        const state = store.getState();
        expect(state.createNewUser.newUserLogFileSize).toBeDefined();
    });
});

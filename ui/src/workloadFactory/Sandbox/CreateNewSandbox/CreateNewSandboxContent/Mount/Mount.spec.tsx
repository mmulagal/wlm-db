import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import Mount from './Mount';

const createMockSelectField =
    () =>
    ({ label, onChange, value, options, isLoading, variant }: any) =>
        (
            <div data-testid={`select-field-${label?.replace(/ /g, '-')}`}>
                <label>{label}</label>
                <select onChange={e => onChange?.({ value: e.target.value })} value={value?.value || ''}>
                    {options?.map((opt: any) => (
                        <option key={opt.value} value={opt.value} disabled={opt.isDisabled}>
                            {opt.label}
                        </option>
                    ))}
                </select>
            </div>
        );

vi.mock('@netapp/design-system', () => ({
    AccordionCard: ({ children, title, ValueContent, id, isLoading, isExpandDisabled }: any) => (
        <div data-testid={`accordion-card-${id}`} data-loading={isLoading} data-expand-disabled={isExpandDisabled}>
            <div data-testid="accordion-title">{title}</div>
            <ValueContent />
            {children}
        </div>
    ),
    AccordionCardContent: ({ children }: any) => <div data-testid="accordion-card-content">{children}</div>,
    DsTypography: ({ children, variant, className, title: tipTitle }: any) => (
        <div data-testid="ds-typography" data-variant={variant} className={className} title={tipTitle}>
            {children}
        </div>
    ),
    DsRadioButton: ({ title, isSelected, onClick, id }: any) => (
        <button data-testid={`radio-${id}`} data-selected={isSelected} onClick={onClick}>
            {title}
        </button>
    ),
    TextField: ({ label, onChange, value, error }: any) => (
        <div data-testid={`text-field-${label?.replace(/ /g, '-')}`}>
            <label>{label}</label>
            <input value={value || ''} onChange={onChange} />
            {error && <span data-testid="text-error">{error}</span>}
        </div>
    ),
    SelectField: ({ label, onChange, value, options, isLoading, variant }: any) => (
        <div data-testid={`select-field-${label?.replace(/ /g, '-')}`}>
            <label>{label}</label>
            <select onChange={e => onChange?.({ value: e.target.value })} value={value?.value || ''}>
                {options?.map((opt: any) => (
                    <option key={opt.value} value={opt.value} disabled={opt.isDisabled}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </div>
    )
}));

vi.mock('@netapp/design-system/dist/components/Select', () => ({
    SelectField: ({ label, onChange, value, options, isLoading, variant }: any) => (
        <div data-testid={`select-field-${label?.replace(/ /g, '-')}`}>
            <label>{label}</label>
            <select onChange={e => onChange?.({ value: e.target.value })} value={value?.value || ''}>
                {options?.map((opt: any) => (
                    <option key={opt.value} value={opt.value} disabled={opt.isDisabled}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </div>
    )
}));

vi.mock('../../../../../utils/utilityFunctions', () => ({
    generateOptionType: vi.fn(
        (value: any, label: any, desc: string, disabled: boolean, tooltip: string, data?: any) => ({
            value,
            label,
            isDisabled: disabled,
            tooltip,
            data
        })
    ),
    isClusteredWithSelectedInstance: vi.fn(() => false),
    sortListOfDict: vi.fn((list: any[]) => list)
}));

vi.mock('../../../../../store/workloadFactory/createSandboxSlice', () => ({
    setDataDriveMountPoint: vi.fn((val: any) => ({ type: 'createSandbox/setDataDriveMountPoint', payload: val })),
    setLogDriveMountPoint: vi.fn((val: any) => ({ type: 'createSandbox/setLogDriveMountPoint', payload: val })),
    setSelectedMount: vi.fn((val: string) => ({ type: 'createSandbox/setSelectedMount', payload: val })),
    updateDataFilePath: vi.fn((val: string) => ({ type: 'createSandbox/updateDataFilePath', payload: val })),
    updateLogFilePath: vi.fn((val: string) => ({ type: 'createSandbox/updateLogFilePath', payload: val }))
}));

vi.mock('../../../SandboxUtility', () => ({
    getDefaultDriveLetters: vi.fn(() => ({ dataDrive: 'C', logDrive: 'D' }))
}));

vi.mock('./Mount.module.scss', () => ({
    default: {
        Mount: 'Mount',
        headerSetter: 'headerSetter',
        actionRequired: 'actionRequired',
        radios: 'radios',
        autoAssignContent: 'autoAssignContent',
        defineMountPointContent: 'defineMountPointContent',
        defineMountPointRow: 'defineMountPointRow',
        pathSection: 'pathSection',
        pathText: 'pathText',
        noticeText: 'noticeText',
        driveSelectField: 'driveSelectField'
    }
}));

vi.mock('../../../../../utils/CommonStyles.module.scss', () => ({
    default: {
        'heading-content': 'heading-content',
        title: 'title'
    }
}));

vi.mock('../../../../../utils/appConstants', () => ({
    GENERAL: {
        AUTO_ASSIGN_MOUNT_POINT: 'Auto-assign mount point',
        DEFINE_MOUNT_POINT_PATH: 'Define mount point path',
        DATA_FILE_PATH: 'Data File Path',
        LOG_FILE_PATH: 'Log File Path',
        SELECT_DRIVE_LETTER: 'Select drive letter',
        MOUNT_NOTICE: 'Mount notice text',
        NON_NETAPP_DRIVE: 'Non-NetApp drive not supported',
        NON_CLUSTERED_DRIVE: 'Non-clustered drive'
    }
}));

vi.mock('../../../../../common/ActionRequired/ActionRequired', () => ({
    default: () => <div data-testid="action-required" />
}));

vi.mock('@netapp/icons/ic_info.svg', () => ({
    ReactComponent: () => <svg data-testid="info-icon" />
}));

const mockDriveInfoData = {
    existingDriveInfo: [
        { driveLetter: 'C', isNetappDrive: true, instanceId: 'inst1' },
        { driveLetter: 'D', isNetappDrive: true, instanceId: 'inst1' },
        { driveLetter: 'E', isNetappDrive: false, instanceId: 'inst2' }
    ]
};

const createMockStore = (overrides: any = {}) => {
    const createSandboxState = {
        selectedMount: 'Auto-assign mount point',
        dataDriveMountPoint: 'C',
        logDriveMountPoint: 'D',
        getDbMountPoints: {
            dbMountPointsData: null,
            dbMountPointsLoading: false
        },
        getDriveInfo: {
            driveInfoData: mockDriveInfoData,
            driveInfoLoading: false
        },
        source: {
            selectedDatabaseHost: { value: 'host1' },
            selectedDatabase: { label: 'db1' },
            selectedDatabaseInstance: { value: 'inst1' }
        },
        target: {
            selectedDatabase: 'sandbox_db'
        },
        ...overrides.createSandbox
    };
    return configureStore({
        reducer: {
            createSandbox: (state = createSandboxState) => state
        }
    });
};

const renderMount = (storeOverrides: any = {}) => {
    const store = createMockStore(storeOverrides);
    return {
        ...render(
            <Provider store={store}>
                <Mount />
            </Provider>
        ),
        store
    };
};

describe('Mount', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the Mount accordion', () => {
        renderMount();
        expect(screen.getByText('Mount')).toBeTruthy();
    });

    it('should render notice text', () => {
        renderMount();
        expect(screen.getByText('Mount notice text')).toBeTruthy();
    });

    it('should render two radio buttons', () => {
        renderMount();
        expect(screen.getByTestId('radio-1')).toBeTruthy();
        expect(screen.getByTestId('radio-2')).toBeTruthy();
    });

    it('should render Auto-assign mount point radio', () => {
        renderMount();
        expect(screen.getByTestId('radio-1').textContent).toBe('Auto-assign mount point');
    });

    it('should render Define mount point path radio', () => {
        renderMount();
        expect(screen.getByText('Define mount point path')).toBeTruthy();
    });

    it('should show auto-assign content when selectedMount is Auto-assign mount point', () => {
        renderMount({
            createSandbox: { selectedMount: 'Auto-assign mount point' }
        });

        expect(screen.getByText('Data File Path')).toBeTruthy();
        expect(screen.getByText('Log File Path')).toBeTruthy();
    });

    it('should NOT show define mount point content when auto-assign is selected', () => {
        renderMount({
            createSandbox: { selectedMount: 'Auto-assign mount point' }
        });

        expect(screen.queryByTestId('select-field-Select-drive-letter')).toBeNull();
    });

    it('should show define mount point content when Define mount point path is selected', () => {
        renderMount({
            createSandbox: { selectedMount: 'Define mount point path' }
        });

        expect(screen.getAllByTestId('select-field-Select-drive-letter').length).toBe(2);
    });

    it('should show data and log file paths in define mode', () => {
        renderMount({
            createSandbox: { selectedMount: 'Define mount point path' }
        });

        expect(screen.getAllByText('Data File Path').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Log File Path').length).toBeGreaterThan(0);
    });

    it('should dispatch setSelectedMount when Auto-assign radio is clicked', () => {
        const store = createMockStore({
            createSandbox: { selectedMount: 'Define mount point path' }
        });
        const dispatchSpy = vi.spyOn(store, 'dispatch');

        render(
            <Provider store={store}>
                <Mount />
            </Provider>
        );

        fireEvent.click(screen.getByTestId('radio-1'));

        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                type: expect.stringContaining('setSelectedMount'),
                payload: 'Auto-assign mount point'
            })
        );
    });

    it('should dispatch setSelectedMount when Define radio is clicked', () => {
        const store = createMockStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');

        render(
            <Provider store={store}>
                <Mount />
            </Provider>
        );

        fireEvent.click(screen.getByTestId('radio-2'));

        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                type: expect.stringContaining('setSelectedMount'),
                payload: 'Define mount point path'
            })
        );
    });

    it('should dispatch setDataDriveMountPoint when data drive select changes', () => {
        const store = createMockStore({
            createSandbox: { selectedMount: 'Define mount point path' }
        });
        const dispatchSpy = vi.spyOn(store, 'dispatch');

        render(
            <Provider store={store}>
                <Mount />
            </Provider>
        );

        const driveSelects = screen.getAllByTestId('select-field-Select-drive-letter');
        if (driveSelects.length > 0) {
            const firstSelect = driveSelects[0].querySelector('select');
            if (firstSelect) {
                fireEvent.change(firstSelect, { target: { value: 'C' } });
            }
        }

        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({ type: expect.stringContaining('setDataDriveMountPoint') })
        );
    });

    it('should dispatch setLogDriveMountPoint when log drive select changes', () => {
        const store = createMockStore({
            createSandbox: { selectedMount: 'Define mount point path' }
        });
        const dispatchSpy = vi.spyOn(store, 'dispatch');

        render(
            <Provider store={store}>
                <Mount />
            </Provider>
        );

        const driveSelects = screen.getAllByTestId('select-field-Select-drive-letter');
        if (driveSelects.length > 1) {
            const secondSelect = driveSelects[1].querySelector('select');
            if (secondSelect) {
                fireEvent.change(secondSelect, { target: { value: 'D' } });
            }
        }

        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({ type: expect.stringContaining('setLogDriveMountPoint') })
        );
    });

    it('should show loading state when dbMountPointsLoading is true', () => {
        renderMount({
            createSandbox: {
                getDbMountPoints: {
                    dbMountPointsData: null,
                    dbMountPointsLoading: true
                }
            }
        });

        const accordion = screen.getByTestId('accordion-card-3');
        expect(accordion.getAttribute('data-loading')).toBe('true');
        expect(accordion.getAttribute('data-expand-disabled')).toBe('true');
    });

    it('should show loading state when driveInfoLoading is true', () => {
        renderMount({
            createSandbox: {
                getDriveInfo: {
                    driveInfoData: null,
                    driveInfoLoading: true
                }
            }
        });

        const accordion = screen.getByTestId('accordion-card-3');
        expect(accordion.getAttribute('data-loading')).toBe('true');
    });

    it('should show Auto-assign header when selectedMount is auto-assign', () => {
        renderMount({
            createSandbox: { selectedMount: 'Auto-assign mount point' }
        });
        expect(screen.getAllByText('Auto-assign mount point').length).toBeGreaterThan(0);
    });

    it('should show ActionRequired in header when Define mount and no drive selected', () => {
        renderMount({
            createSandbox: {
                selectedMount: 'Define mount point path',
                dataDriveMountPoint: null,
                logDriveMountPoint: null
            }
        });
        expect(screen.getByTestId('action-required')).toBeTruthy();
    });

    it('should show Define mount point path in header when both drives are selected', () => {
        renderMount({
            createSandbox: {
                selectedMount: 'Define mount point path',
                dataDriveMountPoint: 'C',
                logDriveMountPoint: 'D'
            }
        });
        // header text should show "Define mount point path"
        const headerTexts = screen.getAllByText('Define mount point path');
        expect(headerTexts.length).toBeGreaterThan(0);
    });

    it('should call getDefaultDriveLetters with correct params', async () => {
        const { getDefaultDriveLetters } = await import('../../../SandboxUtility');

        renderMount();

        expect(getDefaultDriveLetters).toHaveBeenCalled();
    });

    it('should dispatch updateDataFilePath and updateLogFilePath on file path change', () => {
        const store = createMockStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');

        render(
            <Provider store={store}>
                <Mount />
            </Provider>
        );

        // These are dispatched in the useEffect for file path generation
        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({ type: expect.stringContaining('updateDataFilePath') })
        );
        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({ type: expect.stringContaining('updateLogFilePath') })
        );
    });
});

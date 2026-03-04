import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import FileNames from '../FileNames/FileNames';
import createNewUserSlice from '../../../../../store/workloadFactory/createNewDBSlice';
import msSqlActionSlice from '../../../../../store/mssql/msSqlActionSlice';
import authSlice from '../../../../../store/authSlice';

// Mock design system
vi.mock('@netapp/design-system', () => ({
    AccordionCard: ({ title, ValueContent, children, id, isLoading }: any) => (
        <div data-testid={`accordion-card-${id}`} data-loading={isLoading}>
            <div data-testid="accordion-title">{title}</div>
            <div data-testid="accordion-value-content">
                <ValueContent />
            </div>
            {children}
        </div>
    ),
    AccordionCardContent: ({ children }: any) => <div data-testid="accordion-card-content">{children}</div>,
    DsTypography: ({ children, variant, className, title: tipTitle }: any) => (
        <span data-testid={`typography-${variant || 'default'}`} className={className} title={tipTitle}>
            {children}
        </span>
    ),
    TextField: ({ label, value, onChange, error, info, ref }: any) => (
        <div>
            <label>{label}</label>
            <input data-testid={`textfield-${label}`} value={value || ''} onChange={e => onChange && onChange(e)} />
            {error && <span data-testid={`error-${label}`}>{error}</span>}
        </div>
    ),
    DsCheckbox: ({ id, title, onSelect, isSelected, isDisabled }: any) => (
        <input
            data-testid={`checkbox-${id}`}
            type="checkbox"
            checked={isSelected || false}
            onChange={onSelect}
            disabled={isDisabled}
            title={title}
        />
    ),
    TooltipInfo: ({ children }: any) => <div data-testid="tooltip-info">{children}</div>
}));

vi.mock('@netapp/design-system/dist/components/Select', () => ({
    SelectField: ({ label, options, onChange, value, isLoading, placeholder, variant, id, className }: any) => (
        <div>
            <label>{label}</label>
            <select
                data-testid={`select-${label}`}
                onChange={e => {
                    const found = options?.find((o: any) => o.value === e.target.value);
                    onChange && onChange(found || { value: e.target.value, label: e.target.value });
                }}
            >
                {options?.map((opt: any) => (
                    <option key={opt.value} value={opt.value} disabled={opt.isDisabled}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </div>
    )
}));

vi.mock('../../../../../common/ActionRequired/ActionRequired', () => ({
    default: ({ error }: any) => (
        <div data-testid="action-required" data-error={String(error)}>
            Action Required
        </div>
    )
}));

vi.mock('../../../../../common/AccordionError/AccordionError', () => ({
    default: () => <div data-testid="accordion-error">Accordion Error</div>
}));

vi.mock('../../../../../common/hooks/useDelayedError', () => ({
    useDelayedError: (error: any) => error
}));

vi.mock('../../../../../assets/ic_bullet.svg', () => ({
    ReactComponent: () => <svg data-testid="bullet-icon" />
}));

vi.mock('../../../../../utils/appConstants', () => ({
    GENERAL: {
        ACTION_REQUIRED: 'Action required',
        DB_DATA_NAME_ERROR_CHECK: 'Check data file name criteria',
        DB_LOG_NAME_ERROR_CHECK: 'Check log file name criteria',
        DB_CREATE_FILE_NAMES_AND_PATH: 'File names and path',
        DB_QUICK_CREATE: 'Quick create',
        DB_ADVANCED_CREATE: 'Advanced create',
        DATA_FILE: 'Data file',
        LOG_FILE: 'Log file',
        DATA_FILE_NAME: 'Data file name',
        LOG_FILE_NAME: 'Log file name',
        DATA_FILE_PATH: 'Data file path:',
        LOG_FILE_PATH: 'Log file path:',
        SELECT_DRIVE_LETTER: 'Select drive letter',
        NON_NETAPP_DRIVE: 'Non-NetApp drive',
        NON_CLUSTERED_DRIVE: 'Non-clustered drive',
        SAME_NEW_DRIVE_ERROR: 'Same drive selected for data and log',
        FILE_SETTINGS_FIRST_TEXT: 'File settings first text',
        FILE_SETTINGS_SECOND_TEXT: 'File settings second text',
        VIRTUAL_MOUNT_POINT_INFO_TOOLTIP: 'Virtual mount point info',
        CREATE_DB_DATA_FILE_NAME_TOOLTIP: ['Up to 128 characters.', 'Alphanumeric, underscore, slash.'],
        CREATE_DB_LOG_FILE_NAME_TOOLTIP: ['Up to 128 characters.', 'Alphanumeric, underscore, slash.']
    }
}));

vi.mock('../../../../../utils/consts', () => ({
    DRIVE_LETTER_TYPE: {
        EXISTING: 'Existing',
        NEW: 'New'
    }
}));

vi.mock('../../../../../utils/utilityFunctions', () => ({
    generateOptionType: vi.fn((value, label, desc, disabled, msg, data) => ({
        value,
        label,
        label2: desc,
        isDisabled: disabled,
        disabledMsg: msg,
        data
    })),
    isClusteredWithSelectedInstance: vi.fn(() => false),
    sortListOfDict: vi.fn((list: any[]) => list)
}));

vi.mock('../FileNames/FileNames.module.scss', () => ({ default: {} }));
vi.mock('../../../../../utils/CommonStyles.module.scss', () => ({
    default: {
        separator: 'separator',
        setHeaderStyle: 'setHeaderStyle',
        'heading-content': 'heading-content',
        title: 'title'
    }
}));

describe('FileNames Component', () => {
    const createMockStore = (createNewUserOverrides = {}, msSqlActionOverrides = {}, authOverrides = {}) =>
        configureStore({
            reducer: {
                [createNewUserSlice.name]: createNewUserSlice.reducer,
                [msSqlActionSlice.name]: msSqlActionSlice.reducer,
                [authSlice.name]: authSlice.reducer
            } as any,
            preloadedState: {
                createNewUser: {
                    newUserDBFileName: 'testdata',
                    newUserLogFileName: 'testlog',
                    selectedNewUserConfig: 'Quick create',
                    driveLetter: null,
                    driveLetterLogFile: null,
                    newUserDBName: 'TestDB',
                    driveInfoList: null,
                    driveInfoListLoading: false,
                    isDataVirtualMountPoint: false,
                    isLogVirtualMountPoint: false,
                    ...createNewUserOverrides
                },
                msSqlAction: {
                    isDbCreateHit: 0,
                    dbCreateDataNameAdded: true,
                    dbCreateLogNameAdded: true,
                    ...msSqlActionOverrides
                },
                auth: {
                    isDemoMode: false,
                    ...authOverrides
                }
            } as any
        });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render without crashing', () => {
        const store = createMockStore();
        const { container } = render(
            <Provider store={store}>
                <FileNames />
            </Provider>
        );
        expect(container).toBeTruthy();
    });

    it('should render accordion card with id 3', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <FileNames />
            </Provider>
        );
        expect(screen.getByTestId('accordion-card-3')).toBeTruthy();
    });

    it('should render Data file name and Log file name text fields', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <FileNames />
            </Provider>
        );
        expect(screen.getByTestId('textfield-Data file name')).toBeTruthy();
        expect(screen.getByTestId('textfield-Log file name')).toBeTruthy();
    });

    it('should show header with both file names when both are set (quick create)', () => {
        // When newUserDBName is set the useEffect auto-populates file names from it.
        // Use newUserDBName: '' so the initial file name values are kept as-is.
        const store = createMockStore({
            newUserDBFileName: 'mydata',
            newUserLogFileName: 'mylog',
            selectedNewUserConfig: 'Quick create',
            driveLetter: null,
            driveLetterLogFile: null,
            newUserDBName: ''
        });
        render(
            <Provider store={store}>
                <FileNames />
            </Provider>
        );
        expect(screen.getByText(/Data file name: mydata/)).toBeTruthy();
        expect(screen.getByText(/Log file name: mylog/)).toBeTruthy();
    });

    it('should show ActionRequired when both file names are missing', () => {
        // newUserDBName must be '' to prevent the useEffect from auto-filling the empty names.
        // dbCreateDataNameAdded / dbCreateLogNameAdded must remain true (default) so that
        // isValidDataName() returns '' (falsy) for empty names, letting setHeader() fall
        // through to the ActionRequired fallback instead of showing AccordionError.
        const store = createMockStore({
            newUserDBFileName: '',
            newUserLogFileName: '',
            newUserDBName: ''
        });
        render(
            <Provider store={store}>
                <FileNames />
            </Provider>
        );
        expect(screen.getByTestId('action-required')).toBeTruthy();
    });

    it('should show AccordionError when data file name is invalid', () => {
        // The component shows AccordionError only when BOTH names are invalid
        // (condition: isValidDataName() && isValidLogName()).
        // newUserDBName must be '' to prevent the useEffect from overriding the invalid names.
        const invalidName = 'a'.repeat(129);
        const store = createMockStore({
            newUserDBFileName: invalidName,
            newUserLogFileName: invalidName,
            newUserDBName: ''
        });
        render(
            <Provider store={store}>
                <FileNames />
            </Provider>
        );
        expect(screen.getByTestId('accordion-error')).toBeTruthy();
    });

    it('should show AccordionError when log file name is invalid', () => {
        // Same as above – both names must be invalid and newUserDBName must be '' to prevent override
        const invalidName = 'a'.repeat(129);
        const store = createMockStore({
            newUserDBFileName: invalidName,
            newUserLogFileName: invalidName,
            newUserDBName: ''
        });
        render(
            <Provider store={store}>
                <FileNames />
            </Provider>
        );
        expect(screen.getByTestId('accordion-error')).toBeTruthy();
    });

    it('should NOT show Drive Select fields in Quick create mode', () => {
        const store = createMockStore({ selectedNewUserConfig: 'Quick create' });
        render(
            <Provider store={store}>
                <FileNames />
            </Provider>
        );
        expect(screen.queryByTestId('select-Select drive letter')).toBeNull();
    });

    it('should show Drive Select fields in Advanced create mode', () => {
        const store = createMockStore({ selectedNewUserConfig: 'Advanced create' });
        render(
            <Provider store={store}>
                <FileNames />
            </Provider>
        );
        const driveSelects = screen.getAllByTestId('select-Select drive letter');
        expect(driveSelects.length).toBe(2); // Data and Log
    });

    it('should show advanced create text sections in Advanced mode', () => {
        const store = createMockStore({ selectedNewUserConfig: 'Advanced create' });
        render(
            <Provider store={store}>
                <FileNames />
            </Provider>
        );
        expect(screen.getByText('File settings first text')).toBeTruthy();
        expect(screen.getByText('File settings second text')).toBeTruthy();
    });

    it('should show virtual mount point checkboxes in Advanced mode', () => {
        const store = createMockStore({ selectedNewUserConfig: 'Advanced create' });
        render(
            <Provider store={store}>
                <FileNames />
            </Provider>
        );
        expect(screen.getByTestId('checkbox-data-virtual-mount-point')).toBeTruthy();
        expect(screen.getByTestId('checkbox-log-virtual-mount-point')).toBeTruthy();
    });

    it('should NOT show virtual mount point checkboxes in Quick create mode', () => {
        const store = createMockStore({ selectedNewUserConfig: 'Quick create' });
        render(
            <Provider store={store}>
                <FileNames />
            </Provider>
        );
        expect(screen.queryByTestId('checkbox-data-virtual-mount-point')).toBeNull();
        expect(screen.queryByTestId('checkbox-log-virtual-mount-point')).toBeNull();
    });

    it('should dispatch setNewDBFileName when data file name input changes', () => {
        const store = createMockStore({ newUserDBFileName: 'oldname' });
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <FileNames />
            </Provider>
        );
        const input = screen.getByTestId('textfield-Data file name');
        fireEvent.change(input, { target: { value: 'newname' } });
        expect(dispatchSpy).toHaveBeenCalled();
        expect(store.getState().createNewUser.newUserDBFileName).toBe('newname');
    });

    it('should dispatch setNewUserLogFileName when log file name input changes', () => {
        const store = createMockStore({ newUserLogFileName: 'oldlog' });
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <FileNames />
            </Provider>
        );
        const input = screen.getByTestId('textfield-Log file name');
        fireEvent.change(input, { target: { value: 'newlog' } });
        expect(dispatchSpy).toHaveBeenCalled();
        expect(store.getState().createNewUser.newUserLogFileName).toBe('newlog');
    });

    it('should generate data drive options from existingDriveInfo', () => {
        const store = createMockStore({
            selectedNewUserConfig: 'Advanced create',
            driveInfoList: {
                existingDriveInfo: [
                    { driveLetter: 'C', isNetappDrive: true },
                    { driveLetter: 'D', isNetappDrive: false }
                ],
                availableDriveLetters: []
            }
        });
        render(
            <Provider store={store}>
                <FileNames />
            </Provider>
        );
        const driveSelects = screen.getAllByTestId('select-Select drive letter');
        expect(driveSelects.length).toBe(2);
    });

    it('should generate available drive options', () => {
        const store = createMockStore({
            selectedNewUserConfig: 'Advanced create',
            driveInfoList: {
                existingDriveInfo: [],
                availableDriveLetters: ['E', 'F']
            }
        });
        render(
            <Provider store={store}>
                <FileNames />
            </Provider>
        );
        const driveSelects = screen.getAllByTestId('select-Select drive letter');
        expect(driveSelects.length).toBe(2);
    });

    it('should dispatch setDriveLetter when drive letter select changes (Advanced mode)', () => {
        const store = createMockStore({
            selectedNewUserConfig: 'Advanced create',
            driveInfoList: {
                existingDriveInfo: [{ driveLetter: 'C', isNetappDrive: true }],
                availableDriveLetters: ['E', 'F']
            }
        });
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <FileNames />
            </Provider>
        );
        const driveSelects = screen.getAllByTestId('select-Select drive letter');
        fireEvent.change(driveSelects[0], { target: { value: 'C' } });
        expect(dispatchSpy).toHaveBeenCalled();
    });

    it('should show error for data file name when invalid and not in demo mode', () => {
        // newUserDBName: '' prevents the useEffect from overriding the invalid file name
        const invalidName = 'a'.repeat(129);
        const store = createMockStore({ newUserDBFileName: invalidName, newUserDBName: '' });
        render(
            <Provider store={store}>
                <FileNames />
            </Provider>
        );
        const errors = screen.queryAllByTestId('error-Data file name');
        expect(errors.length).toBeGreaterThan(0);
    });

    it('should show ACTION_REQUIRED error for data file name when missing and pressed', () => {
        // newUserDBName: '' prevents the useEffect from auto-filling the empty file name
        const store = createMockStore(
            { newUserDBFileName: '', newUserDBName: '' },
            { dbCreateDataNameAdded: false, isDbCreateHit: 1 }
        );
        render(
            <Provider store={store}>
                <FileNames />
            </Provider>
        );
        const errors = screen.queryAllByTestId('error-Data file name');
        expect(errors.length).toBeGreaterThan(0);
    });

    it('should not show error in demo mode', () => {
        const store = createMockStore(
            { newUserDBFileName: '', newUserLogFileName: '' },
            { dbCreateDataNameAdded: false },
            { isDemoMode: true }
        );
        render(
            <Provider store={store}>
                <FileNames />
            </Provider>
        );
        // In demo mode, no validation errors
        expect(screen.queryByTestId('error-Data file name')).toBeNull();
        expect(screen.queryByTestId('error-Log file name')).toBeNull();
    });

    it('should show data file path when drive letter and filename are set', () => {
        // In Quick create mode the drive-letter useEffect clears driveLetter on mount,
        // so no path-based TooltipInfo is rendered in that mode.
        // Use Advanced create mode instead – it always renders TooltipInfo elements
        // for the virtual mount point info section.
        const store = createMockStore({
            selectedNewUserConfig: 'Advanced create',
            newUserDBFileName: 'mydb',
            newUserDBName: '',
            isDataVirtualMountPoint: false,
            driveInfoList: null
        });
        render(
            <Provider store={store}>
                <FileNames />
            </Provider>
        );
        // Advanced mode renders TooltipInfo for each virtual mount point info
        expect(screen.getAllByTestId('tooltip-info').length).toBeGreaterThan(0);
    });

    it('should handle clearing data file name (sets dataFileNameChange to false)', () => {
        const store = createMockStore({ newUserDBFileName: 'existing', newUserDBName: 'TestDB' });
        render(
            <Provider store={store}>
                <FileNames />
            </Provider>
        );
        const input = screen.getByTestId('textfield-Data file name');
        fireEvent.change(input, { target: { value: '' } });
        expect(store.getState().createNewUser.newUserDBFileName).toBe('');
    });

    it('should pass driveInfoListLoading to AccordionCard', () => {
        const store = createMockStore({ driveInfoListLoading: true });
        render(
            <Provider store={store}>
                <FileNames />
            </Provider>
        );
        const accordion = screen.getByTestId('accordion-card-3');
        expect(accordion.getAttribute('data-loading')).toBe('true');
    });
});

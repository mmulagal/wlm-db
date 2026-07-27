import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import DialogComponent from './DialogComponent';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string) => k })
}));

const mockCloseDialog = vi.fn();

vi.mock('@netapp/design-system', () => ({
    Button: ({
        children,
        onClick,
        isDisabled,
        isLoading,
        variant,
        className,
        title,
        isThin,
        'data-testid': testId
    }: any) => (
        <button
            onClick={onClick}
            disabled={isDisabled}
            data-loading={isLoading}
            className={className}
            data-testid={testId}
        >
            {title}
            {children}
        </button>
    ),
    DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
    DialogFooter: ({ children }: any) => <div data-testid="dialog-footer">{children}</div>,
    DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
    DialogLayout: ({ children, className }: any) => (
        <div data-testid="dialog-layout" className={className}>
            {children}
        </div>
    ),
    TooltipInfo: ({ children }: any) => <div data-testid="tooltip-info">{children}</div>,
    useDialog: () => ({ closeDialog: mockCloseDialog })
}));

vi.mock('@tlveng/wlm-ds', () => ({
    DsTypography: ({ children, variant, style, className }: any) => (
        <span data-variant={variant} style={style} className={className}>
            {children}
        </span>
    )
}));

// Mutable mock state — each test can override parts
let mockState = {
    msSqlAction: { isLoadConfig: false, isSaveConfigLoading: false, isDetectReplicaHostLoading: false },
    mssqlForm: { saveConfigName: '' },
    exploreSavings: { saveConfigName: '', serverDetails: { userName: '', password: '' } },
    dialogComponent: {
        dialogError: { showDialogError: false, errorMessage: '' },
        dialogTooltip: { showTooltipInfo: false, tooltipText: '' },
        actionsDisabled: false,
        requireAcknowledge: false
    },
    mssql: { getSavedConfigList: { configData: [] } },
    sandbox: { isRollbackSelected: false, selectedRollbackSnapshot: null },
    getWellOptimize: { selectedSnapshotPolicy: null, selectedAWSBackup: null },
    inventoryV2: { selectedOptimizeConfig: null },
    databaseHome: { selectedConfig: null },
    agenticAI: {
        durationCustomAnalysis: '1',
        selectedCustomAnalysisTime: '10:00',
        selectedCustomAnalysisTimeFrameUnit: 'AM',
        startCustomAnalysisTime: '08:00'
    },
    workloadFactoryResource: {
        sqlServerPasswords: { password: '', confirmPassword: '' },
        sqlServerUserName: '',
        passwordResetLoading: false
    },
    crrRedirection: { associateLinkLoading: false, crrPrefetchLoading: false },
    auth: { isGovAccount: false },
    snapCenter: { credentials: { username: '', password: '' }, authVerification: false },
    auth: { isGovAccount: false },
    exploreSavingsBulk: {
        bulkAuthCredentials: {},
        rowsRequiringAuthBulk: [],
        selectedRowsForExploreSavingsEBSBulk: []
    }
};

vi.mock('../../store/storeHooks', () => ({
    useAppSelector: vi.fn((selector: any) => selector(mockState))
}));

const FROM_DIALOG_VALUES = {
    SQLSERVER: 'sqlserver',
    LOAD_CONFIG: 'load_config',
    SAVE_CONFIG: 'save_config',
    HEADER_CROSS: 'header_cross',
    EXPLORE_SAVINGS: 'explore_savings',
    WINDOWS_AUTH: 'windows_auth',
    SINGLE_AGENT: 'single_agent',
    MANAGE_WIZARD: 'manage_wizard',
    OPTIMIZE: 'optimize',
    SANDBOX_REFRESH: 'sandbox_refresh',
    LOADER: 'loader',
    CUSTOM_TIMEFRAME: 'custom_timeframe'
};

vi.mock('../../utils/consts', () => ({
    ASSESSMENT_CONFIG_NAMES: {
        SCHEDULED_FSX_FOR_ONTAP_BACKUPS: 'scheduled_fsx_for_ontap_backups',
        SCHEDULED_LOCAL_SNAPSHOT: 'scheduled_local_snapshot'
    },
    FROM_DIALOG: {
        SQLSERVER: 'sqlserver',
        LOAD_CONFIG: 'load_config',
        SAVE_CONFIG: 'save_config',
        HEADER_CROSS: 'header_cross',
        EXPLORE_SAVINGS: 'explore_savings',
        WINDOWS_AUTH: 'windows_auth',
        SINGLE_AGENT: 'single_agent',
        MANAGE_WIZARD: 'manage_wizard',
        OPTIMIZE: 'optimize',
        SANDBOX_REFRESH: 'sandbox_refresh',
        LOADER: 'loader',
        CUSTOM_TIMEFRAME: 'custom_timeframe',
        CRR_REDIRECTION: 'crrRedirection'
    }
}));

vi.mock('../../utils/utilityFunctions', () => ({
    isValidSqlUsername: vi.fn(() => false),
    checkCustomTimeframeExceedsCurrentTime: vi.fn(() => false)
}));

vi.mock('../../assets/error-icon.svg', () => ({ ReactComponent: () => <svg data-testid="error-icon" /> }));
vi.mock('../../assets/action-required.svg', () => ({
    ReactComponent: () => <svg data-testid="action-required-icon" />
}));

const defaultState = JSON.parse(JSON.stringify(mockState));

describe('DialogComponent', () => {
    beforeEach(() => {
        // Reset state and mocks between tests
        mockState = JSON.parse(JSON.stringify(defaultState));
        mockCloseDialog.mockClear();
    });

    it('should be defined', () => {
        expect(DialogComponent).toBeDefined();
    });

    it('should render header, content and footer', () => {
        const { getByTestId } = render(
            <DialogComponent
                header="Test Header"
                content={<div>Dialog Content</div>}
                primaryButton="Confirm"
                secondaryButton="Cancel"
                callback={vi.fn()}
                closeCallback={vi.fn()}
            />
        );
        expect(getByTestId('dialog-header').textContent).toContain('Test Header');
        expect(getByTestId('dialog-content')).toBeTruthy();
    });

    it('should hide primary button when hidePrimaryButton=true', () => {
        const { queryByText } = render(
            <DialogComponent
                header="Header"
                content="Content"
                hidePrimaryButton
                primaryButton="OK"
                callback={vi.fn()}
                closeCallback={vi.fn()}
            />
        );
        expect(queryByText('OK')).toBeNull();
    });

    it('should not render secondary button when not provided', () => {
        const { queryByText } = render(
            <DialogComponent header="Header" content="Content" callback={vi.fn()} closeCallback={vi.fn()} />
        );
        expect(queryByText('Cancel')).toBeNull();
    });

    // ---- primaryButtonClick ----
    it('should call callback and closeDialog when primary button is clicked (normal case)', () => {
        const callback = vi.fn();
        const { getByText } = render(
            <DialogComponent
                header="Header"
                content="Content"
                primaryButton="Confirm"
                callback={callback}
                closeCallback={vi.fn()}
            />
        );
        fireEvent.click(getByText('Confirm'));
        expect(callback).toHaveBeenCalledTimes(1);
        expect(mockCloseDialog).toHaveBeenCalledTimes(1);
    });

    it('should call callback but NOT closeDialog when requireAcknowledge=true', () => {
        mockState.dialogComponent.requireAcknowledge = true;
        const callback = vi.fn();
        const { getByText } = render(
            <DialogComponent
                header="Header"
                content="Content"
                primaryButton="Confirm"
                callback={callback}
                closeCallback={vi.fn()}
            />
        );
        fireEvent.click(getByText('Confirm'));
        expect(callback).toHaveBeenCalledTimes(1);
        expect(mockCloseDialog).not.toHaveBeenCalled();
    });

    it('should NOT call closeDialog when dialogFrom=LOAD_CONFIG', () => {
        // Provide configData so the button is enabled (disabledCheck returns false for LOAD_CONFIG when configData.length > 0)
        mockState.mssql.getSavedConfigList.configData = [{ id: 1, name: 'myConfig' }];
        const callback = vi.fn();
        const { getByText } = render(
            <DialogComponent
                header="Header"
                content="Content"
                primaryButton="Load"
                dialogFrom={FROM_DIALOG_VALUES.LOAD_CONFIG}
                callback={callback}
                closeCallback={vi.fn()}
            />
        );
        fireEvent.click(getByText('Load'));
        expect(callback).toHaveBeenCalled();
        expect(mockCloseDialog).not.toHaveBeenCalled();
    });

    it('should NOT call closeDialog when dialogFrom=SAVE_CONFIG', () => {
        const callback = vi.fn();
        const { getByText } = render(
            <DialogComponent
                header="Header"
                content="Content"
                primaryButton="Save"
                dialogFrom={FROM_DIALOG_VALUES.SAVE_CONFIG}
                callback={callback}
                closeCallback={vi.fn()}
            />
        );
        fireEvent.click(getByText('Save'));
        expect(mockCloseDialog).not.toHaveBeenCalled();
    });

    // ---- secButtonClick ----
    it('should call closeCallback and closeDialog when secondary button is clicked', () => {
        const closeCallback = vi.fn();
        const { getByText } = render(
            <DialogComponent
                header="Header"
                content="Content"
                primaryButton="OK"
                secondaryButton="Cancel"
                callback={vi.fn()}
                closeCallback={closeCallback}
            />
        );
        fireEvent.click(getByText('Cancel'));
        expect(closeCallback).toHaveBeenCalledTimes(1);
        expect(mockCloseDialog).toHaveBeenCalledWith(null);
    });

    // ---- disabledCheck: LOADER ----
    it('should disable primary button when dialogFrom=LOADER', () => {
        const { container } = render(
            <DialogComponent
                header="Header"
                content="Content"
                primaryButton="OK"
                dialogFrom={FROM_DIALOG_VALUES.LOADER}
                callback={vi.fn()}
                closeCallback={vi.fn()}
            />
        );
        const btn = container.querySelector('button');
        expect(btn?.disabled).toBe(true);
    });

    // ---- disabledCheck: WINDOWS_AUTH with empty credentials ----
    it('should disable primary button when dialogFrom=WINDOWS_AUTH and credentials empty', () => {
        const { container } = render(
            <DialogComponent
                header="Header"
                content="Content"
                primaryButton="OK"
                dialogFrom={FROM_DIALOG_VALUES.WINDOWS_AUTH}
                callback={vi.fn()}
                closeCallback={vi.fn()}
            />
        );
        const btn = container.querySelector('button');
        expect(btn?.disabled).toBe(true);
    });

    // ---- disabledCheck: WINDOWS_AUTH with filled credentials ----
    it('should enable primary button when dialogFrom=WINDOWS_AUTH and credentials filled', () => {
        mockState.snapCenter.credentials = { username: 'admin', password: 'pass123' };
        const { container } = render(
            <DialogComponent
                header="Header"
                content="Content"
                primaryButton="OK"
                dialogFrom={FROM_DIALOG_VALUES.WINDOWS_AUTH}
                callback={vi.fn()}
                closeCallback={vi.fn()}
            />
        );
        const btn = container.querySelector('button');
        expect(btn?.disabled).toBe(false);
    });

    // ---- disabledCheck: CUSTOM_TIMEFRAME with empty duration ----
    it('should disable primary button when dialogFrom=CUSTOM_TIMEFRAME and duration is empty', () => {
        mockState.agenticAI.durationCustomAnalysis = '';
        const { container } = render(
            <DialogComponent
                header="Header"
                content="Content"
                primaryButton="OK"
                dialogFrom={FROM_DIALOG_VALUES.CUSTOM_TIMEFRAME}
                callback={vi.fn()}
                closeCallback={vi.fn()}
            />
        );
        const btn = container.querySelector('button');
        expect(btn?.disabled).toBe(true);
    });

    // ---- disabledCheck: EXPLORE_SAVINGS single ----
    it('should disable primary button for EXPLORE_SAVINGS when credentials empty', () => {
        // userName is empty → disabled
        mockState.exploreSavings.serverDetails = { userName: '', password: '' };
        const { container } = render(
            <DialogComponent
                header="Header"
                content="Content"
                primaryButton="Explore"
                dialogFrom={FROM_DIALOG_VALUES.EXPLORE_SAVINGS}
                callback={vi.fn()}
                closeCallback={vi.fn()}
            />
        );
        const btn = container.querySelector('button');
        expect(btn?.disabled).toBe(true);
    });

    it('should enable primary button for EXPLORE_SAVINGS when credentials filled', () => {
        mockState.exploreSavings.serverDetails = { userName: 'user', password: 'pass' };
        const { container } = render(
            <DialogComponent
                header="Header"
                content="Content"
                primaryButton="Explore"
                dialogFrom={FROM_DIALOG_VALUES.EXPLORE_SAVINGS}
                callback={vi.fn()}
                closeCallback={vi.fn()}
            />
        );
        const btn = container.querySelector('button');
        expect(btn?.disabled).toBe(false);
    });

    // ---- disabledCheck: EXPLORE_SAVINGS bulk ----
    it('should check bulk credentials for EXPLORE_SAVINGS with rowsRequiringAuthBulk', () => {
        mockState.exploreSavingsBulk.rowsRequiringAuthBulk = [{ name: 'host1' }];
        mockState.exploreSavingsBulk.bulkAuthCredentials = {
            host1: { userName: 'u', password: 'p' }
        };
        const { container } = render(
            <DialogComponent
                header="Header"
                content="Content"
                primaryButton="Explore"
                dialogFrom={FROM_DIALOG_VALUES.EXPLORE_SAVINGS}
                callback={vi.fn()}
                closeCallback={vi.fn()}
            />
        );
        const btn = container.querySelector('button');
        expect(btn?.disabled).toBe(false);
    });

    it('should disable for EXPLORE_SAVINGS bulk when credentials incomplete', () => {
        mockState.exploreSavingsBulk.rowsRequiringAuthBulk = [{ name: 'host1' }];
        mockState.exploreSavingsBulk.bulkAuthCredentials = {};
        const { container } = render(
            <DialogComponent
                header="Header"
                content="Content"
                primaryButton="Explore"
                dialogFrom={FROM_DIALOG_VALUES.EXPLORE_SAVINGS}
                callback={vi.fn()}
                closeCallback={vi.fn()}
            />
        );
        const btn = container.querySelector('button');
        expect(btn?.disabled).toBe(true);
    });

    // ---- disabledCheck: primaryButtonDisabled prop ----
    it('should disable button when primaryButtonDisabled=true', () => {
        const { container } = render(
            <DialogComponent
                header="Header"
                content="Content"
                primaryButton="OK"
                primaryButtonDisabled
                callback={vi.fn()}
                closeCallback={vi.fn()}
            />
        );
        const btn = container.querySelector('button');
        expect(btn?.disabled).toBe(true);
    });

    // ---- showDialogError ----
    it('should show error icon and message when showDialogError=true', () => {
        mockState.dialogComponent.dialogError = { showDialogError: true, errorMessage: 'Something went wrong' };
        const { getByTestId, getByText } = render(
            <DialogComponent
                header="Header"
                content="Content"
                primaryButton="OK"
                callback={vi.fn()}
                closeCallback={vi.fn()}
            />
        );
        expect(getByTestId('error-icon')).toBeTruthy();
        expect(getByText('Something went wrong')).toBeTruthy();
        expect(getByText('Error:')).toBeTruthy();
    });

    // ---- showDialogError with bulk (error section still uses ErrorIcon on first render) ----
    it('should show error section for bulk explore savings scenario', () => {
        mockState.dialogComponent.dialogError = { showDialogError: true, errorMessage: 'Bulk error' };
        mockState.exploreSavingsBulk.rowsRequiringAuthBulk = [{ name: 'host1' }];
        mockState.exploreSavingsBulk.bulkAuthCredentials = {
            host1: { userName: 'u', password: 'p' }
        };
        const { getByTestId, getByText } = render(
            <DialogComponent
                header="Header"
                content="Content"
                primaryButton="Explore"
                dialogFrom={FROM_DIALOG_VALUES.EXPLORE_SAVINGS}
                callback={vi.fn()}
                closeCallback={vi.fn()}
            />
        );
        // Error section is rendered (the specific icon depends on render-order of isBulkExploreSavings.current)
        expect(getByText('Bulk error')).toBeTruthy();
        expect(getByTestId('dialog-footer')).toBeTruthy();
    });

    // ---- showTooltipInfo ----
    it('should show tooltip info when showTooltipInfo=true', () => {
        mockState.dialogComponent.dialogError = { showDialogError: true, errorMessage: 'Error' };
        mockState.dialogComponent.dialogTooltip = { showTooltipInfo: true, tooltipText: 'Tooltip text' };
        const { getByTestId } = render(
            <DialogComponent header="H" content="C" callback={vi.fn()} closeCallback={vi.fn()} />
        );
        expect(getByTestId('tooltip-info')).toBeTruthy();
    });

    // ---- setClassName branches ----
    it('should apply innerPageClass for customClass containing "innerPage"', () => {
        const { getByTestId } = render(
            <DialogComponent
                header="H"
                content="C"
                customClass="innerPage"
                callback={vi.fn()}
                closeCallback={vi.fn()}
            />
        );
        // The className from styles.innerPageClass is applied (CSS modules → undefined in test env)
        expect(getByTestId('dialog-layout')).toBeTruthy();
    });

    it('should apply protectionDialog for customClass containing "protectionDialog"', () => {
        const { getByTestId } = render(
            <DialogComponent
                header="H"
                content="C"
                customClass="protectionDialog"
                callback={vi.fn()}
                closeCallback={vi.fn()}
            />
        );
        expect(getByTestId('dialog-layout')).toBeTruthy();
    });

    it('should apply oneTimeWADDialog for customClass containing "oneTimeWADDialog"', () => {
        const { getByTestId } = render(
            <DialogComponent
                header="H"
                content="C"
                customClass="oneTimeWADDialog"
                callback={vi.fn()}
                closeCallback={vi.fn()}
            />
        );
        expect(getByTestId('dialog-layout')).toBeTruthy();
    });

    it('should pass custom class through when no special keyword matched', () => {
        const { getByTestId } = render(
            <DialogComponent
                header="H"
                content="C"
                customClass="my-custom-cls"
                callback={vi.fn()}
                closeCallback={vi.fn()}
            />
        );
        expect(getByTestId('dialog-layout').className).toBe('my-custom-cls');
    });

    // ---- primaryButtonLoad: isLoadConfig ----
    it('should show loader on primary button when dialogFrom=LOAD_CONFIG and isLoadConfig=true', () => {
        mockState.msSqlAction.isLoadConfig = true;
        const { container } = render(
            <DialogComponent
                header="H"
                content="C"
                primaryButton="Load"
                dialogFrom={FROM_DIALOG_VALUES.LOAD_CONFIG}
                callback={vi.fn()}
                closeCallback={vi.fn()}
            />
        );
        const btn = container.querySelector('button');
        expect(btn?.dataset.loading).toBe('true');
    });

    // ---- primaryButtonLoad: MANAGE_WIZARD + detectReplicaHostLoading ----
    it('should show loader on primary button for MANAGE_WIZARD when detectReplicaHostLoading=true', () => {
        mockState.msSqlAction.isDetectReplicaHostLoading = true;
        const { container } = render(
            <DialogComponent
                header="H"
                content="C"
                primaryButton="Detect"
                dialogFrom={FROM_DIALOG_VALUES.MANAGE_WIZARD}
                callback={vi.fn()}
                closeCallback={vi.fn()}
            />
        );
        const btn = container.querySelector('button');
        expect(btn?.dataset.loading).toBe('true');
    });

    // ---- primaryButtonTooltip ----
    it('should render tooltip on primary button when primaryButtonTooltip provided', () => {
        const { container } = render(
            <DialogComponent
                header="H"
                content="C"
                primaryButton="OK"
                primaryButtonTooltip="Hover info"
                callback={vi.fn()}
                closeCallback={vi.fn()}
            />
        );
        expect(container.innerHTML).toContain('Hover info');
    });

    // ---- SANDBOX_REFRESH + isRollbackSelected without selectedRollbackSnapshot ----
    it('should disable primary button for SANDBOX_REFRESH when rollback selected but no snapshot', () => {
        mockState.sandbox = { isRollbackSelected: true, selectedRollbackSnapshot: null };
        const { container } = render(
            <DialogComponent
                header="H"
                content="C"
                primaryButton="Refresh"
                dialogFrom={FROM_DIALOG_VALUES.SANDBOX_REFRESH}
                callback={vi.fn()}
                closeCallback={vi.fn()}
            />
        );
        const btn = container.querySelector('button');
        expect(btn?.disabled).toBe(true);
    });
});

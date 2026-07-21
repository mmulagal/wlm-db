import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import LogAnalyserHeader from './LogAnalyserHeader';
import { WLF_TABS, FROM_DIALOG } from '../../../../../utils/consts';
import * as ErrorInvestigationUtility from '../ErrorInvestigationUtility';
import store from '../../../../../store/store';

// Mock dependencies
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key
    })
}));

vi.mock('@tlveng/wlm-ds', () => ({
    DsFlashingDotsLoader: () => <div data-testid="flashing-loader">Loading...</div>,
    DsTypography: ({ children, variant, className, style, ...props }: any) => (
        <div data-testid="ds-typography" data-variant={variant} className={className} style={style} {...props}>
            {children}
        </div>
    )
}));

const mockSetDialog = vi.fn();
const mockCloseDialog = vi.fn();

vi.mock('@netapp/design-system', () => ({
    Popover: ({ children, container }: any) => (
        <div data-testid="popover">
            {container}
            {children && <div data-testid="popover-content">{children}</div>}
        </div>
    ),
    DsButton: ({ children, isDisabled, dropDown, isThin, variant, ...props }: any) => (
        <div data-testid="ds-button" data-disabled={isDisabled} {...props}>
            {children}
            {dropDown?.items?.[0] && (
                <button onClick={dropDown?.items?.[0]?.onClick} data-testid="dropdown-option-1">
                    {dropDown?.items?.[0]?.label}
                </button>
            )}
            {dropDown?.items?.[1] && (
                <button onClick={dropDown?.items?.[1]?.onClick} data-testid="dropdown-option-2">
                    {dropDown?.items?.[1]?.label}
                </button>
            )}
        </div>
    ),
    TooltipInfo: ({ children }: any) => <div data-testid="tooltip-info">{children}</div>,
    useDialog: () => ({
        setDialog: mockSetDialog,
        closeDialog: mockCloseDialog
    })
}));

vi.mock('../../../../../assets/unique-errors.svg', () => ({
    ReactComponent: () => <div data-testid="unique-error-icon">UniqueErrorIcon</div>
}));

vi.mock('../../../../../assets/ic_bullet.svg', () => ({
    ReactComponent: () => <div data-testid="bullet-icon">BulletIcon</div>
}));

const mockDispatch = vi.fn();

vi.mock('react-redux', () => ({
    useDispatch: () => mockDispatch,
    useSelector: vi.fn()
}));

const mockScanErrorInvestigation = vi.fn();
const mockGetJobDetailApi = vi.fn();

vi.mock('../../../../../utils/apiService', () => ({
    useLazyGetSubTaskListQuery: () => [mockGetJobDetailApi, {}],
    useScanErrorInvestigationMutation: () => [mockScanErrorInvestigation, {}]
}));

vi.mock('../ErrorInvestigationUtility', () => ({
    handleLogAnalyzerJob: vi.fn(),
    logAnalyzerScanUpdate: vi.fn()
}));

vi.mock('../../../../InventoryV2/InventoryUtilsV2', () => ({
    uniqueHostRow: vi.fn((id: string, credId: string, regionId: string) => `${id}_${credId}_${regionId}`)
}));

vi.mock('../../../../../common/Dialog/DialogComponent', () => ({
    default: ({ header, content, primaryButton, secondaryButton, callback, closeCallback, dialogFrom }: any) => (
        <div data-testid="dialog-component">
            <div data-testid="dialog-header">{header}</div>
            <div data-testid="dialog-content">{content}</div>
            <button data-testid="dialog-primary" onClick={callback}>
                {primaryButton}
            </button>
            <button data-testid="dialog-secondary" onClick={closeCallback}>
                {secondaryButton}
            </button>
            <div data-testid="dialog-from">{dialogFrom}</div>
        </div>
    )
}));

vi.mock('./AnalyzeCustomTimeframe/AnalyzeCustomTimeframe', () => ({
    default: () => <div data-testid="analyze-custom-timeframe">AnalyzeCustomTimeframe</div>
}));

const mockUseAppSelector = vi.fn();

vi.mock('../../../../../store/storeHooks', () => ({
    useAppSelector: (selector: any) => mockUseAppSelector(selector)
}));

vi.mock('../../../../../store/store', () => ({
    default: {
        getState: vi.fn()
    }
}));

describe('LogAnalyserHeader', () => {
    const mockHeaderData = {
        uniqueErrors: 10,
        totalErrors: 50,
        lastScan: '2025-12-17T10:00:00Z'
    };

    const defaultState = {
        getWellOptimize: {
            credIdFromJM: 'cred-123',
            regionFromJM: 'region-123',
            landingFrom: WLF_TABS.INVENTORY,
            selectedResourceId: 'resource-123',
            selectedDatabaseInstance: 'instance-123',
            selectedGwInstanceCredId: 'cred-456',
            selectedGwInstanceRegionId: 'region-456'
        },
        agenticAI: {
            errorInvestigation: {
                errorInvestigationLoading: false
            },
            investigationDatesLoading: false,
            noData: false,
            scanInProgress: {},
            startCustomAnalysisTime: new Date('2025-12-16'),
            selectedCustomAnalysisTime: { label: '10:00 AM' },
            selectedCustomAnalysisTimeFrameUnit: { label: 'EST' },
            durationCustomAnalysis: 3600000
        },
        auth: {
            aiAnalysisEnabled: true
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockUseAppSelector.mockImplementation(selector => selector(defaultState));
        mockScanErrorInvestigation.mockResolvedValue({ data: { jobId: 'job-123' } });
        (store.getState as any).mockReturnValue(defaultState);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('should render the component with all sections', () => {
        const { container } = render(<LogAnalyserHeader headerData={mockHeaderData} dbType="mssql" />);

        expect(container.querySelector('[data-testid="unique-error-icon"]')).toBeTruthy();
        expect(screen.getAllByText('databases.log-analyzer.unique-errors').length).toBeGreaterThan(0);
        expect(screen.getAllByText('databases.log-analyzer.total-errors').length).toBeGreaterThan(0);
    });

    it('should display unique errors count', () => {
        render(<LogAnalyserHeader headerData={mockHeaderData} dbType="mssql" />);

        const uniqueErrorsElements = screen.getAllByText('10');
        expect(uniqueErrorsElements.length).toBeGreaterThan(0);
    });

    it('should display total errors count', () => {
        render(<LogAnalyserHeader headerData={mockHeaderData} dbType="mssql" />);

        const totalErrorsElements = screen.getAllByText('50');
        expect(totalErrorsElements.length).toBeGreaterThan(0);
    });

    it('should show loading state when errorInvestigationLoading is true', () => {
        const loadingState = {
            ...defaultState,
            agenticAI: {
                ...defaultState.agenticAI,
                errorInvestigation: {
                    errorInvestigationLoading: true
                }
            }
        };
        mockUseAppSelector.mockImplementation(selector => selector(loadingState));

        render(<LogAnalyserHeader headerData={mockHeaderData} dbType="mssql" />);

        const loaders = screen.getAllByTestId('flashing-loader');
        expect(loaders.length).toBeGreaterThan(0);
    });

    it('should show loading state when investigationDatesLoading is true', () => {
        const loadingState = {
            ...defaultState,
            agenticAI: {
                ...defaultState.agenticAI,
                investigationDatesLoading: true
            }
        };
        mockUseAppSelector.mockImplementation(selector => selector(loadingState));

        render(<LogAnalyserHeader headerData={mockHeaderData} dbType="mssql" />);

        const loaders = screen.getAllByTestId('flashing-loader');
        expect(loaders.length).toBeGreaterThan(0);
    });

    it('should show n/a when noData is true', () => {
        const noDataState = {
            ...defaultState,
            agenticAI: {
                ...defaultState.agenticAI,
                noData: true
            }
        };
        mockUseAppSelector.mockImplementation(selector => selector(noDataState));

        render(<LogAnalyserHeader headerData={mockHeaderData} dbType="mssql" />);

        const naElements = screen.getAllByText('databases.log-analyzer.n/a');
        expect(naElements.length).toBe(2); // One for unique errors, one for total errors
    });

    it('should show scan in progress state', () => {
        const scanningState = {
            ...defaultState,
            agenticAI: {
                ...defaultState.agenticAI,
                scanInProgress: {
                    'resource-123_instance-123_cred-456_region-456': true
                }
            }
        };
        mockUseAppSelector.mockImplementation(selector => selector(scanningState));

        const { container } = render(<LogAnalyserHeader headerData={mockHeaderData} dbType="mssql" />);

        const newScanTexts = screen.queryAllByText('databases.log-analyzer.new-scan');
        expect(newScanTexts.length).toBeGreaterThan(0);
    });

    it('should show tooltip and scan details when not scanning', () => {
        const { container } = render(<LogAnalyserHeader headerData={mockHeaderData} dbType="mssql" />);

        const tooltips = container.querySelectorAll('[data-testid="tooltip-info"]');
        expect(tooltips.length).toBeGreaterThan(0);
        const scanDetailsElements = screen.getAllByText('databases.log-analyzer.scan-details');
        expect(scanDetailsElements.length).toBeGreaterThan(0);
    });

    it('should disable scan button when loading', () => {
        const loadingState = {
            ...defaultState,
            agenticAI: {
                ...defaultState.agenticAI,
                errorInvestigation: {
                    errorInvestigationLoading: true
                }
            }
        };
        mockUseAppSelector.mockImplementation(selector => selector(loadingState));

        render(<LogAnalyserHeader headerData={mockHeaderData} dbType="mssql" />);

        const button = screen.getByTestId('ds-button');
        expect(button).toHaveAttribute('data-disabled', 'true');
    });

    it('should disable scan button when scan is in progress', () => {
        const scanningState = {
            ...defaultState,
            agenticAI: {
                ...defaultState.agenticAI,
                scanInProgress: {
                    'resource-123_instance-123_cred-456_region-456': true
                }
            }
        };
        mockUseAppSelector.mockImplementation(selector => selector(scanningState));

        render(<LogAnalyserHeader headerData={mockHeaderData} dbType="mssql" />);

        const button = screen.getByTestId('ds-button');
        expect(button).toHaveAttribute('data-disabled', 'true');
    });

    it('should handle scan now for last 24 hours', async () => {
        render(<LogAnalyserHeader headerData={mockHeaderData} dbType="mssql" />);

        const scanButton = screen.getByTestId('dropdown-option-1');
        fireEvent.click(scanButton);

        await waitFor(() => {
            expect(ErrorInvestigationUtility.logAnalyzerScanUpdate).toHaveBeenCalled();
            expect(mockScanErrorInvestigation).toHaveBeenCalledWith({
                credentialId: 'cred-456',
                regionId: 'region-456',
                databaseHostId: 'resource-123',
                instanceId: 'instance-123',
                payload: {},
                dbType: 'mssql'
            });
        });
    });

    it('should handle scan with custom timeframe', async () => {
        render(<LogAnalyserHeader headerData={mockHeaderData} dbType="mssql" />);

        const customButton = screen.getByTestId('dropdown-option-2');
        fireEvent.click(customButton);

        await waitFor(() => {
            expect(mockSetDialog).toHaveBeenCalled();
        });
    });

    it('should call handleLogAnalyzerJob after scan', async () => {
        render(<LogAnalyserHeader headerData={mockHeaderData} dbType="mssql" />);

        const scanButton = screen.getByTestId('dropdown-option-1');
        fireEvent.click(scanButton);

        await waitFor(() => {
            expect(ErrorInvestigationUtility.handleLogAnalyzerJob).toHaveBeenCalledWith(
                mockDispatch,
                { data: { jobId: 'job-123' } },
                mockGetJobDetailApi,
                expect.any(Function),
                false,
                'resource-123_instance-123_cred-456_region-456',
                null,
                'mssql'
            );
        });
    });

    it('should use credentials from JM when landing from JM', () => {
        const jmState = {
            ...defaultState,
            getWellOptimize: {
                ...defaultState.getWellOptimize,
                landingFrom: WLF_TABS.JOB_MONITORING
            }
        };
        mockUseAppSelector.mockImplementation(selector => selector(jmState));

        render(<LogAnalyserHeader headerData={mockHeaderData} dbType="postgres" />);

        const scanButton = screen.getByTestId('dropdown-option-1');
        fireEvent.click(scanButton);

        expect(mockScanErrorInvestigation).toHaveBeenCalledWith({
            credentialId: 'cred-123',
            regionId: 'region-123',
            databaseHostId: 'resource-123',
            instanceId: 'instance-123',
            payload: {},
            dbType: 'postgres'
        });
    });

    it('should update instKey when scanInProgress changes', () => {
        const { rerender, container } = render(<LogAnalyserHeader headerData={mockHeaderData} dbType="mssql" />);

        const scanningState = {
            ...defaultState,
            agenticAI: {
                ...defaultState.agenticAI,
                scanInProgress: {
                    'resource-123_instance-123_cred-456_region-456': true
                }
            }
        };
        mockUseAppSelector.mockImplementation(selector => selector(scanningState));

        rerender(<LogAnalyserHeader headerData={mockHeaderData} dbType="mssql" />);

        const newScanTexts = screen.queryAllByText('databases.log-analyzer.new-scan');
        expect(newScanTexts.length).toBeGreaterThan(0);
    });

    it('should handle custom timeframe scan with proper payload', async () => {
        const stateWithCustomTime = {
            ...defaultState,
            agenticAI: {
                ...defaultState.agenticAI,
                startCustomAnalysisTime: new Date('2025-12-16'),
                selectedCustomAnalysisTime: { label: '10:00 AM' },
                selectedCustomAnalysisTimeFrameUnit: { label: 'EST' },
                durationCustomAnalysis: 7200000
            }
        };
        (store.getState as any).mockReturnValue(stateWithCustomTime);

        render(<LogAnalyserHeader headerData={mockHeaderData} dbType="oracle" />);

        const customButton = screen.getByTestId('dropdown-option-2');
        fireEvent.click(customButton);

        await waitFor(() => {
            expect(mockSetDialog).toHaveBeenCalled();
        });

        // Simulate primary button click in dialog
        const dialogCall = mockSetDialog.mock.calls[0][0];
        const dialogElement = render(dialogCall);
        const primaryButton = dialogElement.getByTestId('dialog-primary');
        fireEvent.click(primaryButton);

        await waitFor(() => {
            expect(mockScanErrorInvestigation).toHaveBeenCalled();
            const callArgs = mockScanErrorInvestigation.mock.calls[0][0];
            expect(callArgs.payload).toHaveProperty('logsAnalyzerFromTimestamp');
            expect(callArgs.payload).toHaveProperty('logsWindowDuration');
            expect(callArgs.dbType).toBe('oracle');
        });
    });

    it('should close dialog when secondary button is clicked', async () => {
        render(<LogAnalyserHeader headerData={mockHeaderData} dbType="mssql" />);

        const customButton = screen.getByTestId('dropdown-option-2');
        fireEvent.click(customButton);

        await waitFor(() => {
            expect(mockSetDialog).toHaveBeenCalled();
        });

        // Simulate secondary button click in dialog
        const dialogCall = mockSetDialog.mock.calls[0][0];
        const dialogElement = render(dialogCall);
        const secondaryButton = dialogElement.getByTestId('dialog-secondary');
        fireEvent.click(secondaryButton);

        expect(mockCloseDialog).toHaveBeenCalled();
    });

    it('should display tooltip content with bullet points', () => {
        const { container } = render(<LogAnalyserHeader headerData={mockHeaderData} dbType="mssql" />);

        const activityTexts = screen.queryAllByText('databases.log-analyzer.display-activity');
        const errorsTexts = screen.queryAllByText('databases.log-analyzer.include-errors');

        expect(activityTexts.length).toBeGreaterThan(0);
        expect(errorsTexts.length).toBeGreaterThan(0);

        const bulletIcons = container.querySelectorAll('[data-testid="bullet-icon"]');
        expect(bulletIcons.length).toBe(2);
    });

    it('should render custom timeframe dialog with correct props', async () => {
        render(<LogAnalyserHeader headerData={mockHeaderData} dbType="mssql" />);

        const customButton = screen.getByTestId('dropdown-option-2');
        fireEvent.click(customButton);

        await waitFor(() => {
            expect(mockSetDialog).toHaveBeenCalled();
        });

        const dialogCall = mockSetDialog.mock.calls[0][0];
        const { container } = render(dialogCall);

        const headerElement = container.querySelector('[data-testid="dialog-header"]');
        expect(headerElement?.textContent).toBe('databases.log-analyzer.analyze-now-custom-timeframe');

        const contentElement = container.querySelector('[data-testid="analyze-custom-timeframe"]');
        expect(contentElement).toBeTruthy();

        const dialogFromElement = container.querySelector('[data-testid="dialog-from"]');
        expect(dialogFromElement?.textContent).toBe(FROM_DIALOG.CUSTOM_TIMEFRAME);
    });

    it('should handle different database types', () => {
        const { rerender, container } = render(<LogAnalyserHeader headerData={mockHeaderData} dbType="mssql" />);
        expect(container.querySelector('[data-testid="unique-error-icon"]')).toBeTruthy();

        rerender(<LogAnalyserHeader headerData={mockHeaderData} dbType="postgres" />);
        expect(container.querySelector('[data-testid="unique-error-icon"]')).toBeTruthy();

        rerender(<LogAnalyserHeader headerData={mockHeaderData} dbType="oracle" />);
        expect(container.querySelector('[data-testid="unique-error-icon"]')).toBeTruthy();
    });

    it('should handle timestamp conversion for custom analysis', async () => {
        const mockDate = new Date('2025-12-15T14:30:00.000Z');
        const stateWithCustomTime = {
            ...defaultState,
            agenticAI: {
                ...defaultState.agenticAI,
                startCustomAnalysisTime: mockDate,
                selectedCustomAnalysisTime: { label: '2:30 PM' },
                selectedCustomAnalysisTimeFrameUnit: { label: 'UTC' },
                durationCustomAnalysis: 86400000
            }
        };
        (store.getState as any).mockReturnValue(stateWithCustomTime);

        render(<LogAnalyserHeader headerData={mockHeaderData} dbType="mssql" />);

        const customButton = screen.getByTestId('dropdown-option-2');
        fireEvent.click(customButton);

        const dialogCall = mockSetDialog.mock.calls[0][0];
        const dialogElement = render(dialogCall);
        const primaryButton = dialogElement.getByTestId('dialog-primary');
        fireEvent.click(primaryButton);

        await waitFor(() => {
            const callArgs = mockScanErrorInvestigation.mock.calls[0][0];
            expect(callArgs.payload.logsAnalyzerFromTimestamp).toBeDefined();
            expect(typeof callArgs.payload.logsAnalyzerFromTimestamp).toBe('number');
            expect(callArgs.payload.logsWindowDuration).toBe(86400000);
        });
    });

    it('should apply correct CSS classes based on noData state', () => {
        const noDataState = {
            ...defaultState,
            agenticAI: {
                ...defaultState.agenticAI,
                noData: true
            }
        };
        mockUseAppSelector.mockImplementation(selector => selector(noDataState));

        const { container } = render(<LogAnalyserHeader headerData={mockHeaderData} dbType="mssql" />);

        const typographyElements = container.querySelectorAll('[data-testid="ds-typography"]');
        const disabledElements = Array.from(typographyElements).filter(el => el.className.includes('disabled'));
        expect(disabledElements.length).toBeGreaterThan(0);
    });

    it('should render scan button with dropdown items', () => {
        const { container } = render(<LogAnalyserHeader headerData={mockHeaderData} dbType="mssql" />);

        const last24HoursTexts = screen.queryAllByText('Last 24 hours');
        const customTimeframeTexts = screen.queryAllByText('Custom timeframe');

        expect(last24HoursTexts.length).toBeGreaterThan(0);
        expect(customTimeframeTexts.length).toBeGreaterThan(0);
    });

    it('should handle empty scanInProgress object', () => {
        const emptyState = {
            ...defaultState,
            agenticAI: {
                ...defaultState.agenticAI,
                scanInProgress: {}
            }
        };
        mockUseAppSelector.mockImplementation(selector => selector(emptyState));

        const { container } = render(<LogAnalyserHeader headerData={mockHeaderData} dbType="mssql" />);

        const tooltips = container.querySelectorAll('[data-testid="tooltip-info"]');
        expect(tooltips.length).toBeGreaterThan(0);
        expect(screen.queryByText('databases.log-analyzer.new-scan')).not.toBeInTheDocument();
    });

    it('should render all tooltip content items', () => {
        const { container } = render(<LogAnalyserHeader headerData={mockHeaderData} dbType="mssql" />);

        const tooltips = container.querySelectorAll('[data-testid="tooltip-info"]');
        expect(tooltips.length).toBeGreaterThan(0);

        expect(screen.getAllByText('databases.log-analyzer.scan-details').length).toBeGreaterThan(0);

        const activityTexts = screen.queryAllByText('databases.log-analyzer.display-activity');
        const errorsTexts = screen.queryAllByText('databases.log-analyzer.include-errors');

        expect(activityTexts.length).toBeGreaterThan(0);
        expect(errorsTexts.length).toBeGreaterThan(0);
    });

    it('should apply correct variant to typography elements', () => {
        const { container } = render(<LogAnalyserHeader headerData={mockHeaderData} dbType="mssql" />);

        const typographies = container.querySelectorAll('[data-testid="ds-typography"]');
        const variants = Array.from(typographies).map(el => el.getAttribute('data-variant'));

        expect(variants).toContain('Regular_32');
        expect(variants).toContain('Regular_14');
        expect(variants).toContain('Semibold_14');
        expect(variants).toContain('Semibold_13');
        expect(variants).toContain('Regular_13');
    });

    // ── AI Analysis disabled by admin ──
    it('should disable scan button when aiAnalysisEnabled is false', () => {
        const disabledState = {
            ...defaultState,
            auth: {
                aiAnalysisEnabled: false
            }
        };
        mockUseAppSelector.mockImplementation(selector => selector(disabledState));

        render(<LogAnalyserHeader headerData={mockHeaderData} dbType="mssql" />);

        const button = screen.getByTestId('ds-button');
        expect(button).toHaveAttribute('data-disabled', 'true');
    });

    it('should show AI analysis disabled tooltip when aiAnalysisEnabled is false', () => {
        const disabledState = {
            ...defaultState,
            auth: {
                aiAnalysisEnabled: false
            }
        };
        mockUseAppSelector.mockImplementation(selector => selector(disabledState));

        render(<LogAnalyserHeader headerData={mockHeaderData} dbType="mssql" />);

        const popoverContent = screen.queryAllByText('databases.log-analyzer.ai-analysis-disabled');
        expect(popoverContent.length).toBeGreaterThan(0);
    });

    it('should enable scan button when aiAnalysisEnabled is true', () => {
        render(<LogAnalyserHeader headerData={mockHeaderData} dbType="mssql" />);

        const button = screen.getByTestId('ds-button');
        // Button should not be disabled - check that data-disabled is either false or not set
        expect(button.getAttribute('data-disabled')).not.toBe('true');
    });

    it('should disable button due to loading even when aiAnalysisEnabled is true', () => {
        const loadingState = {
            ...defaultState,
            agenticAI: {
                ...defaultState.agenticAI,
                errorInvestigation: {
                    errorInvestigationLoading: true
                }
            },
            auth: {
                aiAnalysisEnabled: true
            }
        };
        mockUseAppSelector.mockImplementation(selector => selector(loadingState));

        render(<LogAnalyserHeader headerData={mockHeaderData} dbType="mssql" />);

        const button = screen.getByTestId('ds-button');
        expect(button).toHaveAttribute('data-disabled', 'true');
    });

    it('should combine multiple disabled conditions correctly', () => {
        const multiDisabledState = {
            ...defaultState,
            agenticAI: {
                ...defaultState.agenticAI,
                errorInvestigation: {
                    errorInvestigationLoading: true
                },
                scanInProgress: {
                    'resource-123_instance-123_cred-456_region-456': true
                }
            },
            auth: {
                aiAnalysisEnabled: false
            }
        };
        mockUseAppSelector.mockImplementation(selector => selector(multiDisabledState));

        render(<LogAnalyserHeader headerData={mockHeaderData} dbType="mssql" />);

        const button = screen.getByTestId('ds-button');
        expect(button).toHaveAttribute('data-disabled', 'true');
    });
});

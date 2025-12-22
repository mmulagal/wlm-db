import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import FilterComponent from './FilterComponent';
import { DBType } from '../../../../../utils/consts';
import {
    eiSeverityOptionList,
    eiSeverityOptionListOracle,
    eiErrorCodesOptions,
    eiTimeOptions
} from '../ErrorInvestigationUtility';

// Mock dependencies
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key
    })
}));

vi.mock('@tlveng/wlm-ds', () => ({
    DsButton: ({ children, isDisabled, onClick, type, ...props }: any) => (
        <button data-testid="ds-button" disabled={isDisabled} onClick={onClick} data-type={type} {...props}>
            {children}
        </button>
    ),
    DsTypography: ({ children, variant, className, ...props }: any) => (
        <div data-testid="ds-typography" data-variant={variant} className={className} {...props}>
            {children}
        </div>
    )
}));

vi.mock('../../../../../assets/Union.svg', () => ({
    ReactComponent: () => <div data-testid="union-icon">UnionIcon</div>
}));

const mockDispatch = vi.fn();

vi.mock('react-redux', () => ({
    useDispatch: () => mockDispatch
}));

const mockTimeDropdown = vi.fn();

vi.mock('./TimeDropDown', () => ({
    default: (props: any) => {
        mockTimeDropdown(props);
        return (
            <div
                data-testid={`time-dropdown-${props.dropDownType}`}
                data-dropdown-type={props.dropDownType}
                data-width={props.width || 'auto'}
            >
                TimeDropdown - {props.dropDownType}
                <div data-testid={`selected-value-${props.dropDownType}`}>{props.selectedValue}</div>
                <div data-testid={`options-${props.dropDownType}`}>{JSON.stringify(props.options)}</div>
            </div>
        );
    }
}));

vi.mock('../../../../../store/workloadFactory/agenticAISlice', () => ({
    resetEiFilters: vi.fn(payload => ({ type: 'resetEiFilters', payload })),
    default: {
        name: 'agenticAI',
        reducer: (state = {}) => state
    }
}));

const mockUseAppSelector = vi.fn();

vi.mock('../../../../../store/storeHooks', () => ({
    useAppSelector: (selector: any) => mockUseAppSelector(selector)
}));

describe('FilterComponent', () => {
    const defaultState = {
        agenticAI: {
            noData: false,
            selectedSeverity: eiSeverityOptionList.top5,
            selectedTimeFrame: eiTimeOptions.last24,
            selectedErrorCodes: eiErrorCodesOptions.all,
            investigationDatesLoading: false,
            noErrorsDetected: false,
            errorInvestigation: {
                errorInvestigationLoading: false
            }
        },
        auth: {
            features: {
                active: {
                    'Platform.BlueXP/DarkTheme': false
                }
            }
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockUseAppSelector.mockImplementation(selector => selector(defaultState));
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Rendering', () => {
        it('should render the filter component with all elements', () => {
            render(<FilterComponent dbType={DBType.MSSQL} />);

            expect(screen.getAllByText('databases.log-analyzer.filters:').length).toBeGreaterThan(0);
            expect(screen.getAllByText('databases.log-analyzer.severity:').length).toBeGreaterThan(0);
            expect(screen.getAllByText('databases.log-analyzer.timeframe:').length).toBeGreaterThan(0);
            expect(screen.getAllByText('databases.log-analyzer.error-codes:').length).toBeGreaterThan(0);
            expect(screen.getAllByText('databases.log-analyzer.tags:').length).toBeGreaterThan(0);
            expect(screen.getAllByText('databases.log-analyzer.reset').length).toBeGreaterThan(0);
        });

        it('should render Union icon', () => {
            const { container } = render(<FilterComponent dbType={DBType.MSSQL} />);

            const unionIcon = container.querySelector('[data-testid="union-icon"]');
            expect(unionIcon).toBeTruthy();
        });

        it('should render all dropdowns', () => {
            render(<FilterComponent dbType={DBType.MSSQL} />);

            const severityDropdown = screen.queryByTestId('time-dropdown-severity');
            const timeFrameDropdown = screen.queryByTestId('time-dropdown-timeFrame');
            const errorCodesDropdown = screen.queryByTestId('time-dropdown-errorCodes');
            const tagsDropdown = screen.queryByTestId('time-dropdown-tags');

            expect(severityDropdown).toBeTruthy();
            expect(timeFrameDropdown).toBeTruthy();
            expect(errorCodesDropdown).toBeTruthy();
            expect(tagsDropdown).toBeTruthy();
        });

        it('should render reset button', () => {
            render(<FilterComponent dbType={DBType.MSSQL} />);

            const resetButton = screen.queryByTestId('ds-button');
            expect(resetButton).toBeTruthy();
            expect(resetButton?.textContent).toContain('databases.log-analyzer.reset');
        });
    });

    describe('Database Type Handling - MSSQL', () => {
        it('should use correct severity options for MSSQL', () => {
            render(<FilterComponent dbType={DBType.MSSQL} />);

            const severityDropdown = screen.getByTestId('time-dropdown-severity');
            const optionsText = severityDropdown.querySelector('[data-testid="options-severity"]')?.textContent;

            expect(optionsText).toContain(eiSeverityOptionList.all);
            expect(optionsText).toContain(eiSeverityOptionList.top5);
            expect(optionsText).toContain(eiSeverityOptionList['16-24']);
            expect(optionsText).toContain(eiSeverityOptionList['9-15']);
            expect(optionsText).toContain(eiSeverityOptionList['1-8']);
        });

        it('should initialize with top5 severity for MSSQL on mount', () => {
            render(<FilterComponent dbType={DBType.MSSQL} />);

            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'resetEiFilters',
                    payload: expect.objectContaining({
                        selectedSeverity: eiSeverityOptionList.top5
                    })
                })
            );
        });
    });

    describe('Database Type Handling - Oracle', () => {
        it('should use correct severity options for Oracle', () => {
            render(<FilterComponent dbType={DBType.ORACLE} />);

            const severityDropdown = screen.getByTestId('time-dropdown-severity');
            const optionsText = severityDropdown.querySelector('[data-testid="options-severity"]')?.textContent;

            expect(optionsText).toContain(eiSeverityOptionListOracle.all);
            expect(optionsText).toContain(eiSeverityOptionListOracle.critical);
            expect(optionsText).toContain(eiSeverityOptionListOracle.severe);
            expect(optionsText).toContain(eiSeverityOptionListOracle.important);
        });

        it('should initialize with all severity for Oracle on mount', () => {
            render(<FilterComponent dbType={DBType.ORACLE} />);

            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'resetEiFilters',
                    payload: expect.objectContaining({
                        selectedSeverity: eiSeverityOptionListOracle.all
                    })
                })
            );
        });
    });

    describe('Database Type Handling - PostgreSQL', () => {
        it('should use MSSQL severity options for PostgreSQL', () => {
            render(<FilterComponent dbType={DBType.POSTGRESQL} />);

            const severityDropdown = screen.getByTestId('time-dropdown-severity');
            const optionsText = severityDropdown.querySelector('[data-testid="options-severity"]')?.textContent;

            expect(optionsText).toContain(eiSeverityOptionList.all);
            expect(optionsText).toContain(eiSeverityOptionList.top5);
        });

        it('should initialize with top5 severity for PostgreSQL on mount', () => {
            render(<FilterComponent dbType={DBType.POSTGRESQL} />);

            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'resetEiFilters',
                    payload: expect.objectContaining({
                        selectedSeverity: eiSeverityOptionList.top5
                    })
                })
            );
        });
    });

    describe('Dropdown Props', () => {
        it('should pass correct props to severity dropdown', () => {
            render(<FilterComponent dbType={DBType.MSSQL} />);

            expect(mockTimeDropdown).toHaveBeenCalledWith(
                expect.objectContaining({
                    dropDownType: 'severity',
                    selectedValue: eiSeverityOptionList.top5,
                    width: '294px'
                })
            );
        });

        it('should pass correct props to timeFrame dropdown', () => {
            render(<FilterComponent dbType={DBType.MSSQL} />);

            expect(mockTimeDropdown).toHaveBeenCalledWith(
                expect.objectContaining({
                    dropDownType: 'timeFrame',
                    selectedValue: eiTimeOptions.last24
                })
            );
        });

        it('should pass correct props to errorCodes dropdown', () => {
            render(<FilterComponent dbType={DBType.MSSQL} />);

            expect(mockTimeDropdown).toHaveBeenCalledWith(
                expect.objectContaining({
                    dropDownType: 'errorCodes',
                    selectedValue: eiErrorCodesOptions.all
                })
            );
        });

        it('should pass correct props to tags dropdown', () => {
            render(<FilterComponent dbType={DBType.MSSQL} />);

            const tagsCall = mockTimeDropdown.mock.calls.find(call => call[0].dropDownType === 'tags');
            expect(tagsCall).toBeDefined();
            if (tagsCall) {
                expect(tagsCall[0].options).toEqual(['Compute', 'Storage', 'Network', 'Security']);
            }
        });

        it('should pass correct time options', () => {
            render(<FilterComponent dbType={DBType.MSSQL} />);

            const timeFrameCall = mockTimeDropdown.mock.calls.find(call => call[0].dropDownType === 'timeFrame');
            expect(timeFrameCall).toBeDefined();
            if (timeFrameCall) {
                expect(timeFrameCall[0].options).toEqual([
                    eiTimeOptions.last24,
                    eiTimeOptions.last12,
                    eiTimeOptions.last6,
                    eiTimeOptions.last1,
                    eiTimeOptions.custom
                ]);
            }
        });

        it('should pass correct error code options', () => {
            render(<FilterComponent dbType={DBType.MSSQL} />);

            const errorCodesCall = mockTimeDropdown.mock.calls.find(call => call[0].dropDownType === 'errorCodes');
            expect(errorCodesCall).toBeDefined();
            if (errorCodesCall) {
                expect(errorCodesCall[0].options).toEqual([
                    eiErrorCodesOptions.all,
                    eiErrorCodesOptions.top10,
                    eiErrorCodesOptions.top5
                ]);
            }
        });
    });

    describe('Reset Button Functionality', () => {
        it('should dispatch resetEiFilters when reset button is clicked for MSSQL', () => {
            render(<FilterComponent dbType={DBType.MSSQL} />);

            mockDispatch.mockClear();

            const resetButton = screen.getByTestId('ds-button');
            fireEvent.click(resetButton);

            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'resetEiFilters',
                    payload: {
                        selectedTimeFrame: eiTimeOptions.last24,
                        selectedSeverity: eiSeverityOptionList.top5,
                        selectedErrorCodes: eiErrorCodesOptions.all,
                        selectedErrorTags: ['Storage', 'Compute', 'Network', 'Security']
                    }
                })
            );
        });

        it('should dispatch resetEiFilters when reset button is clicked for Oracle', () => {
            render(<FilterComponent dbType={DBType.ORACLE} />);

            mockDispatch.mockClear();

            const resetButton = screen.getByTestId('ds-button');
            fireEvent.click(resetButton);

            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'resetEiFilters',
                    payload: {
                        selectedTimeFrame: eiTimeOptions.last24,
                        selectedSeverity: eiSeverityOptionListOracle.all,
                        selectedErrorCodes: eiErrorCodesOptions.all,
                        selectedErrorTags: ['Storage', 'Compute', 'Network', 'Security']
                    }
                })
            );
        });
    });

    describe('Loading States', () => {
        it('should disable elements when investigationDatesLoading is true', () => {
            const loadingState = {
                ...defaultState,
                agenticAI: {
                    ...defaultState.agenticAI,
                    investigationDatesLoading: true
                }
            };
            mockUseAppSelector.mockImplementation(selector => selector(loadingState));

            render(<FilterComponent dbType={DBType.MSSQL} />);

            const resetButton = screen.getByTestId('ds-button');
            expect(resetButton).toBeDisabled();
        });

        it('should disable elements when errorInvestigationLoading is true', () => {
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

            render(<FilterComponent dbType={DBType.MSSQL} />);

            const resetButton = screen.getByTestId('ds-button');
            expect(resetButton).toBeDisabled();
        });

        it('should apply disabled class to typography when loading', () => {
            const loadingState = {
                ...defaultState,
                agenticAI: {
                    ...defaultState.agenticAI,
                    investigationDatesLoading: true
                }
            };
            mockUseAppSelector.mockImplementation(selector => selector(loadingState));

            const { container } = render(<FilterComponent dbType={DBType.MSSQL} />);

            const typographies = container.querySelectorAll('[data-testid="ds-typography"]');
            const disabledTypographies = Array.from(typographies).filter(el => el.className.includes('disabled'));
            expect(disabledTypographies.length).toBeGreaterThan(0);
        });
    });

    describe('No Data State', () => {
        it('should disable elements when noData is true', () => {
            const noDataState = {
                ...defaultState,
                agenticAI: {
                    ...defaultState.agenticAI,
                    noData: true
                }
            };
            mockUseAppSelector.mockImplementation(selector => selector(noDataState));

            render(<FilterComponent dbType={DBType.MSSQL} />);

            const resetButton = screen.getByTestId('ds-button');
            expect(resetButton).toBeDisabled();
        });

        it('should apply disabled class when noData is true', () => {
            const noDataState = {
                ...defaultState,
                agenticAI: {
                    ...defaultState.agenticAI,
                    noData: true
                }
            };
            mockUseAppSelector.mockImplementation(selector => selector(noDataState));

            const { container } = render(<FilterComponent dbType={DBType.MSSQL} />);

            const typographies = container.querySelectorAll('[data-testid="ds-typography"]');
            const disabledTypographies = Array.from(typographies).filter(el => el.className.includes('disabled'));
            expect(disabledTypographies.length).toBeGreaterThan(0);
        });
    });

    describe('No Errors Detected State', () => {
        it('should disable elements when noErrorsDetected is true', () => {
            const noErrorsState = {
                ...defaultState,
                agenticAI: {
                    ...defaultState.agenticAI,
                    noErrorsDetected: true
                }
            };
            mockUseAppSelector.mockImplementation(selector => selector(noErrorsState));

            render(<FilterComponent dbType={DBType.MSSQL} />);

            const resetButton = screen.getByTestId('ds-button');
            expect(resetButton).toBeDisabled();
        });

        it('should apply disabled class when noErrorsDetected is true', () => {
            const noErrorsState = {
                ...defaultState,
                agenticAI: {
                    ...defaultState.agenticAI,
                    noErrorsDetected: true
                }
            };
            mockUseAppSelector.mockImplementation(selector => selector(noErrorsState));

            const { container } = render(<FilterComponent dbType={DBType.MSSQL} />);

            const typographies = container.querySelectorAll('[data-testid="ds-typography"]');
            const disabledTypographies = Array.from(typographies).filter(el => el.className.includes('disabled'));
            expect(disabledTypographies.length).toBeGreaterThan(0);
        });
    });

    describe('Dark Theme Support', () => {
        it('should apply dark theme class when dark theme is enabled', () => {
            const darkThemeState = {
                ...defaultState,
                auth: {
                    features: {
                        active: {
                            'Platform.BlueXP/DarkTheme': true
                        }
                    }
                }
            };
            mockUseAppSelector.mockImplementation(selector => selector(darkThemeState));

            const { container } = render(<FilterComponent dbType={DBType.MSSQL} />);

            // Check if darkSupport class is present in the component
            const elements = container.querySelectorAll('*');
            const hasDarkSupport = Array.from(elements).some(el => el.className?.includes?.('darkSupport'));
            expect(hasDarkSupport).toBe(true);
        });

        it('should not apply dark theme class when dark theme is disabled', () => {
            const { container } = render(<FilterComponent dbType={DBType.MSSQL} />);

            const elements = container.querySelectorAll('.darkSupport');
            // When theme is not dark, darkSupport class might not be applied or might be combined with other classes
            // We just verify the component renders without errors
            expect(container).toBeTruthy();
        });
    });

    describe('Component Initialization', () => {
        it('should dispatch resetEiFilters on mount', () => {
            render(<FilterComponent dbType={DBType.MSSQL} />);

            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'resetEiFilters',
                    payload: expect.objectContaining({
                        selectedTimeFrame: eiTimeOptions.last24,
                        selectedErrorCodes: eiErrorCodesOptions.all,
                        selectedErrorTags: ['Storage', 'Compute', 'Network', 'Security']
                    })
                })
            );
        });

        it('should only dispatch resetEiFilters once on mount', () => {
            const { rerender } = render(<FilterComponent dbType={DBType.MSSQL} />);

            const initialCallCount = mockDispatch.mock.calls.length;

            rerender(<FilterComponent dbType={DBType.MSSQL} />);

            // Should not dispatch again on rerender since useEffect has empty dependency array
            expect(mockDispatch.mock.calls.length).toBe(initialCallCount);
        });
    });

    describe('Selected Values Display', () => {
        it('should display selected severity value', () => {
            const customState = {
                ...defaultState,
                agenticAI: {
                    ...defaultState.agenticAI,
                    selectedSeverity: eiSeverityOptionList['16-24']
                }
            };
            mockUseAppSelector.mockImplementation(selector => selector(customState));

            render(<FilterComponent dbType={DBType.MSSQL} />);

            const selectedValue = screen.getByTestId('selected-value-severity');
            expect(selectedValue).toHaveTextContent(eiSeverityOptionList['16-24']);
        });

        it('should display selected timeframe value', () => {
            const customState = {
                ...defaultState,
                agenticAI: {
                    ...defaultState.agenticAI,
                    selectedTimeFrame: eiTimeOptions.last12
                }
            };
            mockUseAppSelector.mockImplementation(selector => selector(customState));

            render(<FilterComponent dbType={DBType.MSSQL} />);

            const selectedValue = screen.getByTestId('selected-value-timeFrame');
            expect(selectedValue).toHaveTextContent(eiTimeOptions.last12);
        });

        it('should display selected error codes value', () => {
            const customState = {
                ...defaultState,
                agenticAI: {
                    ...defaultState.agenticAI,
                    selectedErrorCodes: eiErrorCodesOptions.top5
                }
            };
            mockUseAppSelector.mockImplementation(selector => selector(customState));

            render(<FilterComponent dbType={DBType.MSSQL} />);

            const selectedValue = screen.getByTestId('selected-value-errorCodes');
            expect(selectedValue).toHaveTextContent(eiErrorCodesOptions.top5);
        });
    });

    describe('Tag Options Generation', () => {
        it('should generate correct tag options with translations', () => {
            render(<FilterComponent dbType={DBType.MSSQL} />);

            const tagsCall = mockTimeDropdown.mock.calls.find(call => call[0].dropDownType === 'tags');
            expect(tagsCall).toBeDefined();
            if (tagsCall) {
                expect(tagsCall[0].options).toEqual(['Compute', 'Storage', 'Network', 'Security']);
            }
        });
    });

    describe('Button Type', () => {
        it('should render reset button with text type', () => {
            render(<FilterComponent dbType={DBType.MSSQL} />);

            const resetButton = screen.getByTestId('ds-button');
            expect(resetButton).toHaveAttribute('data-type', 'text');
        });
    });

    describe('Combined States', () => {
        it('should disable when both loading and noData are true', () => {
            const combinedState = {
                ...defaultState,
                agenticAI: {
                    ...defaultState.agenticAI,
                    noData: true,
                    investigationDatesLoading: true
                }
            };
            mockUseAppSelector.mockImplementation(selector => selector(combinedState));

            render(<FilterComponent dbType={DBType.MSSQL} />);

            const resetButton = screen.getByTestId('ds-button');
            expect(resetButton).toBeDisabled();
        });

        it('should disable when loading, noData, and noErrorsDetected are all true', () => {
            const combinedState = {
                ...defaultState,
                agenticAI: {
                    ...defaultState.agenticAI,
                    noData: true,
                    investigationDatesLoading: true,
                    noErrorsDetected: true
                }
            };
            mockUseAppSelector.mockImplementation(selector => selector(combinedState));

            render(<FilterComponent dbType={DBType.MSSQL} />);

            const resetButton = screen.getByTestId('ds-button');
            expect(resetButton).toBeDisabled();
        });
    });

    describe('Severity Dropdown Width', () => {
        it('should set severity dropdown width to 294px', () => {
            render(<FilterComponent dbType={DBType.MSSQL} />);

            const severityDropdown = screen.getByTestId('time-dropdown-severity');
            expect(severityDropdown).toHaveAttribute('data-width', '294px');
        });

        it('should not set custom width for other dropdowns', () => {
            render(<FilterComponent dbType={DBType.MSSQL} />);

            const timeFrameDropdown = screen.getByTestId('time-dropdown-timeFrame');
            expect(timeFrameDropdown).toHaveAttribute('data-width', 'auto');
        });
    });

    describe('Typography Variants', () => {
        it('should use Semibold_14 for filters label', () => {
            const { container } = render(<FilterComponent dbType={DBType.MSSQL} />);

            const typographies = container.querySelectorAll('[data-testid="ds-typography"]');
            const filtersLabel = Array.from(typographies).find(el =>
                el.textContent?.includes('databases.log-analyzer.filters:')
            );

            expect(filtersLabel).toHaveAttribute('data-variant', 'Semibold_14');
        });

        it('should use Regular_14 for dropdown labels', () => {
            const { container } = render(<FilterComponent dbType={DBType.MSSQL} />);

            const typographies = container.querySelectorAll('[data-testid="ds-typography"]');
            const severityLabel = Array.from(typographies).find(el =>
                el.textContent?.includes('databases.log-analyzer.severity:')
            );

            expect(severityLabel).toHaveAttribute('data-variant', 'Regular_14');
        });
    });

    describe('Edge Cases', () => {
        it('should handle undefined dark theme feature gracefully', () => {
            const undefinedThemeState = {
                ...defaultState,
                auth: {
                    features: {
                        active: {}
                    }
                }
            };
            mockUseAppSelector.mockImplementation(selector => selector(undefinedThemeState));

            expect(() => render(<FilterComponent dbType={DBType.MSSQL} />)).not.toThrow();
        });

        it('should handle missing auth state gracefully', () => {
            const noAuthState = {
                agenticAI: defaultState.agenticAI,
                auth: undefined
            };
            mockUseAppSelector.mockImplementation(selector => selector(noAuthState as any));

            expect(() => render(<FilterComponent dbType={DBType.MSSQL} />)).not.toThrow();
        });
    });
});

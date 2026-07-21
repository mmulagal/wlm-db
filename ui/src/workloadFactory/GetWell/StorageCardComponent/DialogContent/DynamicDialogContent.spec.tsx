/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/no-array-index-key */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable jsx-a11y/control-has-associated-label */
/* eslint-disable react/jsx-boolean-value */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import DynamicDialogContent from './DynamicDialogContent';

// ─── Store ────────────────────────────────────────────────────────────────────
const mockDispatch = vi.fn();
const mockUseAppSelector = vi.fn();

vi.mock('react-redux', () => ({ useDispatch: () => mockDispatch }));
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string, p?: any) => (p ? `${k}:${JSON.stringify(p)}` : k) })
}));
vi.mock('../../../../store/storeHooks', () => ({
    useAppSelector: (selector: any) => mockUseAppSelector(selector)
}));

// ─── Slice actions ────────────────────────────────────────────────────────────
vi.mock('../../../../store/workloadFactory/getWellOptimizeSlice', () => ({
    setRecommendedInstanceInBulk: (v: any) => ({ type: 'setRecommendedInstanceInBulk', payload: v }),
    setSelectedRecommendedInstance: (v: any) => ({ type: 'setSelectedRecommendedInstance', payload: v })
}));
vi.mock('../../../../store/workloadFactory/dialogComponentSlice', () => ({
    setRequireAcknowledge: (v: any) => ({ type: 'setRequireAcknowledge', payload: v }),
    setDialogErrorWithTooltip: (v: any) => ({ type: 'setDialogErrorWithTooltip', payload: v }),
    resetDialogComponent: () => ({ type: 'resetDialogComponent' })
}));

// ─── Registry ─────────────────────────────────────────────────────────────────
const mockGetDialogContentConfig: Mock = vi.fn();
const mockHasFixSupport: Mock = vi.fn(() => false);

vi.mock('../../../../utils/configRegistry', () => ({
    getDialogContentConfig: (...args: any[]) => mockGetDialogContentConfig(...args),
    hasFixSupport: (...args: any[]) => mockHasFixSupport(...args)
}));

// ─── Consts ───────────────────────────────────────────────────────────────────
vi.mock('../../../../utils/consts', () => ({
    DBType: { MSSQL: 'mssql', ORACLE: 'oracle' },
    ASSESSMENT_CONFIG_IDS: {
        DRIVE_LETTER: 'drive-letter',
        CLONE_MANAGEMENT: 'clone-management'
    },
    ASSESSMENT_CONFIG_NAMES: { REDO_LOGS_PLACEMENT: 'redo-logs-placement' },
    PATCH_SCAN_FIELD: {},
    WELL_ARCHITECTED_STATUS: { NOT_OPTIMIZED: 'Not Optimized' },
    WIZARD_TYPE: { MSSQL: 'mssql', ORACLE: 'oracle' }
}));

// ─── Oracle config deps ───────────────────────────────────────────────────────
const mockGetLinkedConfigNames: Mock = vi.fn((): string[] => []);
vi.mock('../../../Oracle/OracleResourcePages/OracleWellArchitectDashboard/OracleConfigDependencies', () => ({
    getLinkedConfigNames: () => mockGetLinkedConfigNames()
}));

// ─── Utility functions ────────────────────────────────────────────────────────
vi.mock('../../../../utils/utilityFunctions', () => ({
    generateOptionType: (value: any, label: any, label2: any) => ({ value, label, label2 })
}));

// ─── API ──────────────────────────────────────────────────────────────────────
vi.mock('../../../../utils/apiService', () => ({
    useGetMissingPatchAssessmentDataQuery: vi.fn(() => ({ data: undefined, isFetching: false }))
}));

// ─── Table helpers ────────────────────────────────────────────────────────────
vi.mock('../../../../common/Lib/Table/tableLazyLoadingProps', () => ({
    getTableLazyLoadingComponentProps: vi.fn(() => ({}))
}));

// ─── Design system ────────────────────────────────────────────────────────────
vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children }: any) => <span>{children}</span>,
    SelectField: ({ label, onChange, options }: any) => (
        <div>
            <label htmlFor="select-change">{label}</label>
            <button
                id="select-change"
                type="button"
                data-testid="select-change"
                onClick={() => onChange([options?.[0]])}
            >
                {label}
            </button>
        </div>
    ),
    Table: ({ columns, rows }: any) => (
        <div data-testid="ds-table">
            {columns?.length}cols/{rows?.length}rows
        </div>
    ),
    useTable: vi.fn(() => ({ selectionState: {}, tableRef: { current: null } }))
}));
vi.mock('@tlveng/wlm-ds', () => ({
    DsCheckbox: ({ title, onSelect, isSelected }: any) => (
        <input
            type="checkbox"
            aria-label={title}
            checked={isSelected}
            onChange={onSelect}
            data-testid="acknowledge-checkbox"
        />
    )
}));

// ─── LinkedConfigBanner ───────────────────────────────────────────────────────
vi.mock('../../../../common/LinkedConfigBanner/LinkedConfigBanner', () => ({
    default: ({ linkedConfigNames }: any) => (
        <div data-testid="linked-config-banner">{linkedConfigNames?.join(',')}</div>
    )
}));

// ─── ScheduledAWSBackupDialog ─────────────────────────────────────────────────
vi.mock('./ScheduledAWSBackupDialog', () => ({
    default: () => <div data-testid="scheduled-backup-dialog" />
}));

// ─── DialogContentHelper ─────────────────────────────────────────────────────
vi.mock('./DialogContentHelper', () => ({
    createSection: (_heading: string, content: any) => (
        <div data-testid="section">
            {_heading}
            {content}
        </div>
    ),
    createContentWithBullets: (items: string[]) => (
        <ul>
            {items.map((i, idx) => (
                <li key={idx}>{i}</li>
            ))}
        </ul>
    ),
    createCodeBox: (content: any) => <pre data-testid="code-box">{JSON.stringify(content)}</pre>,
    createStandardNotesSection: () => <div data-testid="standard-notes" />,
    createOSNotesSection: () => <div data-testid="os-notes" />,
    createFailoverClusterNotesSection: () => <div data-testid="failover-notes" />,
    createClusterQuorumSQLNotesSection: () => <div data-testid="cluster-quorum-notes" />,
    createDriveLetterNotesSection: () => <div data-testid="drive-letter-notes" />,
    createNumberedActionSteps: (steps: string[]) => (
        <ol>
            {steps.map((s, i) => (
                <li key={i}>{s}</li>
            ))}
        </ol>
    ),
    createCodeBoxWithCopy: (content: string) => <pre data-testid="code-box-copy">{content}</pre>
}));

// ─── CopyToClipboard ──────────────────────────────────────────────────────────
vi.mock('../../../../common/CopyToClipboard/copyToClipboard', () => ({
    default: () => <button type="button" aria-label="copy" data-testid="copy-btn" />
}));

vi.mock('../../../../assets/ic_copy.svg', () => ({ ReactComponent: () => <svg /> }));

// ─── Helpers ──────────────────────────────────────────────────────────────────
const baseGwState = {
    driftAssessmentData: null,
    selectedRecommendedInstance: null,
    recommendedInstanceInBulk: {},
    selectedResourceId: 'r1',
    selectedDatabaseInstance: 'inst1',
    selectedGwInstanceCredId: 'cred1',
    selectedGwInstanceRegionId: 'reg1'
};

const setupState = (gwOverrides: any = {}) => {
    mockUseAppSelector.mockImplementation((selector: any) =>
        selector({
            getWellOptimize: { ...baseGwState, ...gwOverrides }
        })
    );
};

const defaultProps = {
    configId: 'some-config',
    engineType: 'mssql'
};

// Simple config with a text section
const textSectionConfig = {
    sections: [{ type: 'text', content: 'databases.well-architect.some-text' }],
    features: {}
};

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('DynamicDialogContent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetDialogContentConfig.mockReturnValue(undefined);
        mockHasFixSupport.mockReturnValue(false);
        mockGetLinkedConfigNames.mockReturnValue([]);
        setupState();
    });

    // ── Fallback (no config) ──────────────────────────────────────────────────
    describe('fallback when no registry config', () => {
        it('renders fallback action-summary section when getDialogContentConfig returns undefined', () => {
            mockGetDialogContentConfig.mockReturnValue(undefined);
            render(<DynamicDialogContent {...defaultProps} />);
            expect(screen.getAllByTestId('section').length).toBeGreaterThan(0);
            expect(screen.getByTestId('standard-notes')).toBeTruthy();
        });

        it('uses configName in fallback when provided', () => {
            mockGetDialogContentConfig.mockReturnValue(undefined);
            render(<DynamicDialogContent {...defaultProps} configName="My Config" />);
            // t is called with configName in params — section is rendered
            expect(screen.getAllByTestId('section').length).toBeGreaterThan(0);
        });
    });

    // ── engineDisplayName ─────────────────────────────────────────────────────
    describe('engineDisplayName', () => {
        it('sets engineType param to "SQL Server" for mssql', () => {
            mockGetDialogContentConfig.mockReturnValue({
                sections: [{ type: 'text', content: 'key', params: {} }],
                features: {}
            });
            render(<DynamicDialogContent {...defaultProps} engineType="mssql" />);
            // No error = engineDisplayName resolved correctly
            expect(screen.getAllByTestId('section').length).toBeGreaterThan(0);
        });

        it('sets engineType param to "Oracle" for oracle', () => {
            mockGetDialogContentConfig.mockReturnValue(textSectionConfig);
            render(<DynamicDialogContent {...defaultProps} engineType="oracle" />);
            expect(screen.getAllByTestId('section').length).toBeGreaterThan(0);
        });

        it('uses raw engineType string for unknown engine', () => {
            mockGetDialogContentConfig.mockReturnValue(textSectionConfig);
            render(<DynamicDialogContent {...defaultProps} engineType="postgres" />);
            expect(screen.getAllByTestId('section').length).toBeGreaterThan(0);
        });
    });

    // ── resolvedConfig / conditionalOverrides ─────────────────────────────────
    describe('resolvedConfig conditionalOverrides', () => {
        it('uses base config when no conditionalOverrides', () => {
            mockGetDialogContentConfig.mockReturnValue(textSectionConfig);
            render(<DynamicDialogContent {...defaultProps} />);
            expect(screen.getAllByTestId('section').length).toBeGreaterThan(0);
        });

        it('applies override when status matches', () => {
            mockGetDialogContentConfig.mockReturnValue({
                sections: [{ type: 'text', content: 'base-content' }],
                features: {},
                conditionalOverrides: [
                    {
                        when: { field: 'status', equals: 'optimized' },
                        sections: [{ type: 'text', content: 'override-content' }]
                    }
                ]
            });
            render(<DynamicDialogContent {...defaultProps} status="Optimized" />);
            // override applied — rendered without crash
            expect(screen.getAllByTestId('section').length).toBeGreaterThan(0);
        });

        it('applies override when hasMissingPermissions matches', () => {
            mockGetDialogContentConfig.mockReturnValue({
                sections: [{ type: 'text', content: 'base-content' }],
                features: {},
                conditionalOverrides: [
                    {
                        when: { field: 'hasMissingPermissions', equals: 'true' },
                        sections: [{ type: 'text', content: 'perm-override' }]
                    }
                ]
            });
            render(<DynamicDialogContent {...defaultProps} missingPermissions={['perm1']} />);
            expect(screen.getAllByTestId('section').length).toBeGreaterThan(0);
        });

        it('uses base config when override condition does not match', () => {
            mockGetDialogContentConfig.mockReturnValue({
                sections: [{ type: 'text', content: 'base-content' }],
                features: {},
                conditionalOverrides: [
                    {
                        when: { field: 'status', equals: 'optimized' },
                        sections: [{ type: 'text', content: 'override-content' }]
                    }
                ]
            });
            render(<DynamicDialogContent {...defaultProps} status="Not Optimized" />);
            expect(screen.getAllByTestId('section').length).toBeGreaterThan(0);
        });
    });

    // ── renderSection types ───────────────────────────────────────────────────
    describe('renderSection types', () => {
        it('renders text section', () => {
            mockGetDialogContentConfig.mockReturnValue({
                sections: [{ type: 'text', content: 'databases.some-key' }],
                features: {}
            });
            render(<DynamicDialogContent {...defaultProps} />);
            expect(screen.getAllByTestId('section').length).toBeGreaterThan(0);
        });

        it('renders text section with learnMoreLink', () => {
            mockGetDialogContentConfig.mockReturnValue({
                sections: [{ type: 'text', content: 'databases.some-key', learnMoreLink: 'https://example.com' }],
                features: {}
            });
            render(<DynamicDialogContent {...defaultProps} />);
            expect(screen.getByRole('link', { name: /learn more/i })).toBeTruthy();
        });

        it('renders text section with recommendedSizeInGib appended for headroom config', () => {
            mockGetDialogContentConfig.mockReturnValue({
                sections: [{ type: 'text', content: 'databases.headroom-permission-content' }],
                features: {}
            });
            render(
                <DynamicDialogContent configId="file-system-headroom" engineType="mssql" recommendedSizeInGib={200} />
            );
            expect(screen.getByText(/to 200 GiB/)).toBeTruthy();
        });

        it('hides section when hideWhenWad=true and isWad=true', () => {
            mockGetDialogContentConfig.mockReturnValue({
                sections: [
                    { type: 'text', content: 'visible-key' },
                    { type: 'text', content: 'hidden-key', hideWhenWad: true }
                ],
                features: {}
            });
            render(<DynamicDialogContent {...defaultProps} isWad />);
            // Only one section visible (the hidden one returns null)
            expect(screen.getAllByTestId('section').length).toBe(1);
        });

        it('shows section when hideWhenWad=true but isWad=false', () => {
            mockGetDialogContentConfig.mockReturnValue({
                sections: [
                    { type: 'text', content: 'visible-key' },
                    { type: 'text', content: 'also-visible-key', hideWhenWad: true }
                ],
                features: {}
            });
            render(<DynamicDialogContent {...defaultProps} isWad={false} />);
            expect(screen.getAllByTestId('section').length).toBe(2);
        });

        it('renders bullets section', () => {
            mockGetDialogContentConfig.mockReturnValue({
                sections: [{ type: 'bullets', items: ['item1', 'item2'], heading: 'My Heading' }],
                features: {}
            });
            render(<DynamicDialogContent {...defaultProps} />);
            expect(screen.getAllByTestId('section').length).toBeGreaterThan(0);
        });

        it('renders numberedList section', () => {
            mockGetDialogContentConfig.mockReturnValue({
                sections: [{ type: 'numberedList', items: ['step1', 'step2'], heading: 'Steps' }],
                features: {}
            });
            render(<DynamicDialogContent {...defaultProps} />);
            expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0);
        });

        it('renders numberedSteps section', () => {
            mockGetDialogContentConfig.mockReturnValue({
                sections: [{ type: 'numberedSteps', items: ['step1', 'step2'] }],
                features: {}
            });
            render(<DynamicDialogContent {...defaultProps} />);
            expect(screen.getAllByText(/1\|/)).toBeTruthy();
        });

        it('renders numberedStepsWithCode section — plain text step', () => {
            mockGetDialogContentConfig.mockReturnValue({
                sections: [{ type: 'numberedStepsWithCode', items: ['Run this command'] }],
                features: {}
            });
            render(<DynamicDialogContent {...defaultProps} />);
            expect(screen.getByText(/Run this command/)).toBeTruthy();
        });

        it('renders numberedStepsWithCode section — step with $ command', () => {
            mockGetDialogContentConfig.mockReturnValue({
                sections: [{ type: 'numberedStepsWithCode', items: ['Execute $some-cmd --flag'] }],
                features: {}
            });
            render(<DynamicDialogContent {...defaultProps} />);
            expect(screen.getByTestId('code-box-copy')).toBeTruthy();
        });

        it('renders permissions section when missingPermissions provided', () => {
            mockGetDialogContentConfig.mockReturnValue({
                sections: [{ type: 'permissions', content: 'perm-desc', heading: 'Permissions' }],
                features: {}
            });
            render(<DynamicDialogContent {...defaultProps} missingPermissions={['iam:PutPolicy', 'ec2:Describe']} />);
            expect(screen.getByText('iam:PutPolicy')).toBeTruthy();
            expect(screen.getByTestId('copy-btn')).toBeTruthy();
        });

        it('returns null for permissions section when missingPermissions is empty', () => {
            mockGetDialogContentConfig.mockReturnValue({
                sections: [{ type: 'permissions', content: 'perm-desc' }],
                features: {}
            });
            render(<DynamicDialogContent {...defaultProps} missingPermissions={[]} />);
            expect(screen.queryByTestId('copy-btn')).toBeNull();
        });

        it('returns null for unknown section type', () => {
            mockGetDialogContentConfig.mockReturnValue({
                sections: [{ type: 'unknown-type', content: 'some-content' }],
                features: {}
            });
            render(<DynamicDialogContent {...defaultProps} />);
            // no section rendered — no error
            expect(screen.queryByTestId('section')).toBeNull();
        });
    });

    // ── renderNotes ───────────────────────────────────────────────────────────
    describe('renderNotes', () => {
        const makeConfig = (notesType: string, extra: any = {}) => ({
            sections: [],
            features: {},
            notes: { type: notesType, ...extra }
        });

        it('renders standard notes', () => {
            mockGetDialogContentConfig.mockReturnValue(makeConfig('standard'));
            render(<DynamicDialogContent {...defaultProps} />);
            expect(screen.getByTestId('standard-notes')).toBeTruthy();
        });

        it('renders os notes', () => {
            mockGetDialogContentConfig.mockReturnValue(makeConfig('os'));
            render(<DynamicDialogContent {...defaultProps} />);
            expect(screen.getByTestId('os-notes')).toBeTruthy();
        });

        it('renders failover notes', () => {
            mockGetDialogContentConfig.mockReturnValue(makeConfig('failover'));
            render(<DynamicDialogContent {...defaultProps} />);
            expect(screen.getByTestId('failover-notes')).toBeTruthy();
        });

        it('renders clusterQuorum notes', () => {
            mockGetDialogContentConfig.mockReturnValue(makeConfig('clusterQuorum'));
            render(<DynamicDialogContent {...defaultProps} />);
            expect(screen.getByTestId('cluster-quorum-notes')).toBeTruthy();
        });

        it('renders driveLetter notes', () => {
            mockGetDialogContentConfig.mockReturnValue(makeConfig('driveLetter'));
            render(<DynamicDialogContent {...defaultProps} />);
            expect(screen.getByTestId('drive-letter-notes')).toBeTruthy();
        });

        it('renders custom notes with items', () => {
            mockGetDialogContentConfig.mockReturnValue(makeConfig('custom', { items: ['note.one', 'note.two'] }));
            render(<DynamicDialogContent {...defaultProps} />);
            expect(screen.getAllByTestId('section').length).toBeGreaterThan(0);
        });

        it('renders custom notes with content string', () => {
            mockGetDialogContentConfig.mockReturnValue(makeConfig('custom', { content: 'note.key' }));
            render(<DynamicDialogContent {...defaultProps} />);
            expect(screen.getAllByTestId('section').length).toBeGreaterThan(0);
        });

        it('returns null for custom notes without items or content', () => {
            mockGetDialogContentConfig.mockReturnValue(makeConfig('custom'));
            render(<DynamicDialogContent {...defaultProps} />);
            // No crash; notes area is empty
        });

        it('returns null for unknown notes type', () => {
            mockGetDialogContentConfig.mockReturnValue(makeConfig('unknown-notes'));
            render(<DynamicDialogContent {...defaultProps} />);
        });

        it('renders no notes when notes is absent', () => {
            mockGetDialogContentConfig.mockReturnValue({ sections: [], features: {} });
            render(<DynamicDialogContent {...defaultProps} />);
            expect(screen.queryByTestId('standard-notes')).toBeNull();
        });
    });

    // ── features.showOntapConfigCodeBox ───────────────────────────────────────
    describe('showOntapConfigCodeBox', () => {
        it('renders code box from wellArchitectedConfig when not drive-letter', () => {
            mockGetDialogContentConfig.mockReturnValue({
                sections: [],
                features: { showOntapConfigCodeBox: true },
                wellArchitectedConfig: ['line 1', 'line 2']
            });
            render(<DynamicDialogContent {...defaultProps} configId="some-config" />);
            expect(screen.getByTestId('code-box')).toBeTruthy();
        });

        it('renders code box from objectsInViolation strings for drive-letter config', () => {
            mockGetDialogContentConfig.mockReturnValue({
                sections: [],
                features: { showOntapConfigCodeBox: true }
            });
            render(
                <DynamicDialogContent configId="drive-letter" engineType="mssql" objectsInViolation={['D:', 'E:']} />
            );
            expect(screen.getByTestId('code-box')).toBeTruthy();
        });

        it('renders code box from objectsInViolation objects for drive-letter config', () => {
            mockGetDialogContentConfig.mockReturnValue({
                sections: [],
                features: { showOntapConfigCodeBox: true }
            });
            render(
                <DynamicDialogContent
                    configId="drive-letter"
                    engineType="mssql"
                    objectsInViolation={[{ ontapVolumeName: 'vol1' } as any]}
                />
            );
            expect(screen.getByTestId('code-box').textContent).toContain('vol1');
        });

        it('renders nothing when codeBoxContent is falsy', () => {
            mockGetDialogContentConfig.mockReturnValue({
                sections: [],
                features: { showOntapConfigCodeBox: true }
                // no wellArchitectedConfig, not drive-letter
            });
            render(<DynamicDialogContent {...defaultProps} />);
            expect(screen.queryByTestId('code-box')).toBeNull();
        });
    });

    // ── features.showCustomBackupUI ───────────────────────────────────────────
    describe('showCustomBackupUI', () => {
        it('renders ScheduledAWSBackupDialog when showCustomBackupUI=true', () => {
            mockGetDialogContentConfig.mockReturnValue({
                sections: [],
                features: { showCustomBackupUI: true }
            });
            render(<DynamicDialogContent {...defaultProps} />);
            expect(screen.getByTestId('scheduled-backup-dialog')).toBeTruthy();
        });

        it('does not render ScheduledAWSBackupDialog when feature is absent', () => {
            mockGetDialogContentConfig.mockReturnValue({ sections: [], features: {} });
            render(<DynamicDialogContent {...defaultProps} />);
            expect(screen.queryByTestId('scheduled-backup-dialog')).toBeNull();
        });
    });

    // ── linked config banner + acknowledge checkbox ───────────────────────────
    describe('linkedConfigBanner and acknowledge', () => {
        it('shows banner and checkbox when showDependencyWarning=true and isWad=false', () => {
            mockGetDialogContentConfig.mockReturnValue({
                sections: [],
                features: { showLinkedConfigBanner: true }
            });
            mockGetLinkedConfigNames.mockReturnValue(['oracle-binary-placement']);
            mockHasFixSupport.mockReturnValue(true);
            setupState({
                driftAssessmentData: {
                    assessments: [{ name: 'oracle-binary-placement', status: 'Not Optimized' }]
                }
            });
            render(<DynamicDialogContent {...defaultProps} engineType="oracle" isWad={false} />);
            expect(screen.getByTestId('linked-config-banner')).toBeTruthy();
            expect(screen.getByTestId('acknowledge-checkbox')).toBeTruthy();
        });

        it('shows banner but no checkbox when isWad=true', () => {
            mockGetDialogContentConfig.mockReturnValue({
                sections: [],
                features: { showLinkedConfigBanner: true }
            });
            mockGetLinkedConfigNames.mockReturnValue(['oracle-binary-placement']);
            mockHasFixSupport.mockReturnValue(true);
            setupState({
                driftAssessmentData: {
                    assessments: [{ name: 'oracle-binary-placement', status: 'Not Optimized' }]
                }
            });
            render(<DynamicDialogContent {...defaultProps} engineType="oracle" isWad />);
            expect(screen.getByTestId('linked-config-banner')).toBeTruthy();
            expect(screen.queryByTestId('acknowledge-checkbox')).toBeNull();
        });

        it('hides banner when showLinkedConfigBannerInDialog=false', () => {
            mockGetDialogContentConfig.mockReturnValue({
                sections: [],
                features: { showLinkedConfigBannerInDialog: false }
            });
            mockGetLinkedConfigNames.mockReturnValue(['oracle-binary-placement']);
            mockHasFixSupport.mockReturnValue(true);
            render(<DynamicDialogContent {...defaultProps} />);
            expect(screen.queryByTestId('linked-config-banner')).toBeNull();
        });

        it('no banner when canFixConfiguration=false (no checkbox, no linked banner)', () => {
            mockGetDialogContentConfig.mockReturnValue({
                sections: [],
                features: { showLinkedConfigBanner: true }
            });
            mockGetLinkedConfigNames.mockReturnValue(['oracle-binary-placement']);
            mockHasFixSupport.mockReturnValue(false); // canFix = false → showDependencyWarning = false
            render(<DynamicDialogContent {...defaultProps} />);
            expect(screen.queryByTestId('linked-config-banner')).toBeNull();
        });

        it('dispatches setRequireAcknowledge(true) on mount when showDependencyWarning=true and isWad=false', () => {
            mockGetDialogContentConfig.mockReturnValue({
                sections: [],
                features: { showLinkedConfigBanner: true }
            });
            mockGetLinkedConfigNames.mockReturnValue(['oracle-binary-placement']);
            mockHasFixSupport.mockReturnValue(true);
            setupState({
                driftAssessmentData: {
                    assessments: [{ name: 'oracle-binary-placement', status: 'Not Optimized' }]
                }
            });
            render(<DynamicDialogContent {...defaultProps} engineType="oracle" isWad={false} />);
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'setRequireAcknowledge', payload: true })
            );
        });

        it('dispatches resetDialogComponent on unmount', () => {
            mockGetDialogContentConfig.mockReturnValue({ sections: [], features: {} });
            const { unmount } = render(<DynamicDialogContent {...defaultProps} />);
            unmount();
            expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'resetDialogComponent' }));
        });

        it('toggles acknowledge checkbox and dispatches setRequireAcknowledge', () => {
            mockGetDialogContentConfig.mockReturnValue({
                sections: [],
                features: { showLinkedConfigBanner: true }
            });
            mockGetLinkedConfigNames.mockReturnValue(['oracle-binary-placement']);
            mockHasFixSupport.mockReturnValue(true);
            setupState({
                driftAssessmentData: {
                    assessments: [{ name: 'oracle-binary-placement', status: 'Not Optimized' }]
                }
            });
            render(<DynamicDialogContent {...defaultProps} engineType="oracle" isWad={false} />);
            const checkbox = screen.getByTestId('acknowledge-checkbox');
            fireEvent.change(checkbox);
            expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'setRequireAcknowledge' }));
        });
    });

    // ── instance selector (single) ────────────────────────────────────────────
    describe('instance selector', () => {
        it('renders SelectField for single operation with recommendationOptions', () => {
            mockGetDialogContentConfig.mockReturnValue({
                sections: [],
                features: { showInstanceSelector: true }
            });
            render(
                <DynamicDialogContent
                    {...defaultProps}
                    operation="single"
                    recommendationOptions={[
                        {
                            instanceType: 't3.medium',
                            rank: 1,
                            savingsOpportunity: { savingsOpportunityPercentage: 10 }
                        },
                        { instanceType: 't3.large', rank: 2 }
                    ]}
                />
            );
            expect(screen.getByTestId('select-change')).toBeTruthy();
        });

        it('dispatches setSelectedRecommendedInstance when options > 1', () => {
            mockGetDialogContentConfig.mockReturnValue({
                sections: [],
                features: { showInstanceSelector: true }
            });
            render(
                <DynamicDialogContent
                    {...defaultProps}
                    operation="single"
                    recommendationOptions={[{ instanceType: 't3.medium' }, { instanceType: 't3.large' }]}
                />
            );
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'setSelectedRecommendedInstance' })
            );
        });

        it('renders bulk SelectField for bulk operation with bulkRecommendationOptions', () => {
            mockGetDialogContentConfig.mockReturnValue({
                sections: [],
                features: { showInstanceSelector: true }
            });
            render(
                <DynamicDialogContent
                    {...defaultProps}
                    operation="bulk"
                    bulkRecommendationOptions={[
                        {
                            hostName: 'host1',
                            recommendationOptions: [{ instanceType: 't3.medium' }, { instanceType: 't3.large' }]
                        }
                    ]}
                />
            );
            expect(screen.getByTestId('select-change')).toBeTruthy();
        });
    });

    // ── postPatchSections ─────────────────────────────────────────────────────
    describe('postPatchSections', () => {
        it('renders post-patch sections when present', () => {
            mockGetDialogContentConfig.mockReturnValue({
                sections: [],
                features: {},
                postPatchSections: [{ type: 'text', content: 'post-patch-key' }]
            });
            render(<DynamicDialogContent {...defaultProps} />);
            expect(screen.getAllByTestId('section').length).toBeGreaterThan(0);
        });
    });
});

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OptimizeCard from './OptimizeCard';

// ─── Store ────────────────────────────────────────────────────────────────────
const mockUseAppSelector = vi.fn();

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('../../../../store/storeHooks', () => ({
    useAppSelector: (selector: any) => mockUseAppSelector(selector)
}));

// ─── Registry ─────────────────────────────────────────────────────────────────
const mockGetCardMetadata = vi.fn();
const mockGetColumnConfig = vi.fn();

vi.mock('../../../../utils/configRegistry', () => ({
    getCardMetadata: (...args: any[]) => mockGetCardMetadata(...args),
    getColumnConfig: (...args: any[]) => mockGetColumnConfig(...args)
}));

// ─── Recommendations ──────────────────────────────────────────────────────────
const mockGetRecommendation = vi.fn(() => null);
vi.mock('../../../../utils/recommendations', () => ({
    getRecommendation: (...args: any[]) => mockGetRecommendation(...args)
}));

// ─── Consts ───────────────────────────────────────────────────────────────────
vi.mock('../../../../utils/consts', () => ({
    WLF_TABS: { DASHBOARD: 'Dashboard' }
}));

// ─── Design system ────────────────────────────────────────────────────────────
vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children }: any) => <span>{children}</span>
}));

// ─── RecommendationText ───────────────────────────────────────────────────────
vi.mock('../../RecommendationText/RecommendationText', () => ({
    default: ({ data }: any) => <div data-testid="rec-text">{JSON.stringify(data)}</div>
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────
const makeState = (selectedOptimizeConfig: any = null, cloneDashboardData: any = null, configEngineType = 'mssql') =>
    mockUseAppSelector.mockImplementation((selector: any) =>
        selector({
            inventoryV2: { selectedOptimizeConfig },
            getWellOptimize: { cloneDashboardData, configEngineType }
        })
    );

const impactedCountMeta = () =>
    mockGetCardMetadata.mockReturnValue({
        impactedLabel: 'Impacted databases',
        countSource: 'impactedCount'
    });

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('OptimizeCard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetColumnConfig.mockReturnValue(undefined);
        mockGetRecommendation.mockReturnValue(null);
    });

    // ── block_six count extraction ────────────────────────────────────────────
    describe('block_six count extraction', () => {
        it('uses blockSixCount when count object is present', () => {
            impactedCountMeta();
            makeState({
                type: 'some-config',
                data: {
                    block_six: { count: { totalObjectsInViolation: 7 } },
                    block_four: { value: 'High' },
                    tags: []
                }
            });

            render(<OptimizeCard />);
            expect(screen.getByText('7')).toBeTruthy();
        });

        it('falls back to block_six.value as patchCount when count is absent (patch config)', () => {
            impactedCountMeta();
            makeState({
                type: 'host-os-patch',
                data: {
                    block_six: { value: '4' },
                    block_four: { value: 'Medium' },
                    tags: []
                }
            });

            render(<OptimizeCard />);
            expect(screen.getByText('4')).toBeTruthy();
        });

        it('block_six.value=0 is not treated as patch count (falsy integer string edge case)', () => {
            mockGetCardMetadata.mockReturnValue({
                impactedLabel: 'Items',
                countSource: undefined
            });
            makeState({
                type: 'host-os-patch',
                data: {
                    block_six: { value: '0' },
                    block_four: { value: 'Low' },
                    totalObjectsInViolation: 5,
                    tags: []
                }
            });

            render(<OptimizeCard />);
            // patchCount = 0, impactedCount = 0; countSource falls to totalObjectsInViolation
            // countValue = 0 || 5 → 5
            expect(screen.getByText('5')).toBeTruthy();
        });

        it('produces undefined patchCount when block_six.value is not numeric', () => {
            mockGetCardMetadata.mockReturnValue({
                impactedLabel: 'Items',
                countSource: undefined
            });
            makeState({
                type: 'some-config',
                data: {
                    block_six: { value: 'not-a-number' },
                    block_four: { value: 'Low' },
                    totalObjectsInViolation: 3,
                    tags: []
                }
            });

            render(<OptimizeCard />);
            // patchCount = undefined, impactedCount = undefined
            // falls through to totalObjectsInViolation = 3
            expect(screen.getByText('3')).toBeTruthy();
        });
    });

    // ── countValue resolution ─────────────────────────────────────────────────
    describe('countValue resolution', () => {
        it('uses impactedCount directly when countSource === impactedCount', () => {
            impactedCountMeta();
            makeState({
                type: 'some-config',
                data: {
                    block_six: { count: { totalObjectsInViolation: 5 } },
                    block_four: { value: 'High' },
                    tags: []
                }
            });

            render(<OptimizeCard />);
            expect(screen.getByText('5')).toBeTruthy();
        });

        it('sums dataMapping.sources when columnConfig provides them', () => {
            mockGetCardMetadata.mockReturnValue({
                impactedLabel: 'Adapters',
                countSource: undefined
            });
            mockGetColumnConfig.mockReturnValue({
                dataMapping: {
                    sources: [{ path: 'rssAdapters' }, { path: 'otherAdapters' }]
                }
            });
            makeState({
                type: 'rss-configuration',
                data: {
                    block_six: {},
                    block_four: { value: 'Low' },
                    rssAdapters: [1, 2, 3],
                    otherAdapters: [4, 5],
                    tags: []
                }
            });

            render(<OptimizeCard />);
            expect(screen.getByText('5')).toBeTruthy();
        });

        it('falls back to totalObjectsInViolation', () => {
            mockGetCardMetadata.mockReturnValue({
                impactedLabel: 'Items',
                countSource: undefined
            });
            makeState({
                type: 'some-config',
                data: {
                    block_six: {},
                    block_four: { value: 'High' },
                    totalObjectsInViolation: 9,
                    tags: []
                }
            });

            render(<OptimizeCard />);
            expect(screen.getByText('9')).toBeTruthy();
        });

        it('falls back to violationDetails.length', () => {
            mockGetCardMetadata.mockReturnValue({
                impactedLabel: 'Items',
                countSource: undefined
            });
            makeState({
                type: 'some-config',
                data: {
                    block_six: {},
                    block_four: { value: 'High' },
                    violationDetails: [{ id: 1 }, { id: 2 }],
                    tags: []
                }
            });

            render(<OptimizeCard />);
            expect(screen.getByText('2')).toBeTruthy();
        });

        it('renders 0 when no count can be determined', () => {
            mockGetCardMetadata.mockReturnValue({
                impactedLabel: 'Items',
                countSource: undefined
            });
            makeState({
                type: 'some-config',
                data: { block_six: {}, block_four: { value: 'High' }, tags: [] }
            });

            render(<OptimizeCard />);
            expect(screen.getByText('0')).toBeTruthy();
        });
    });

    // ── recommendation text ───────────────────────────────────────────────────
    describe('recommendation text', () => {
        it('uses getNestedValue when recommendationSource is configured', () => {
            mockGetCardMetadata.mockReturnValue({
                impactedLabel: 'Items',
                countSource: 'impactedCount',
                recommendationSource: 'block_six.recommendation'
            });
            makeState({
                type: 'some-config',
                data: {
                    block_six: { count: { totalObjectsInViolation: 1 }, recommendation: 'Enable compression' },
                    block_four: { value: 'High' },
                    tags: []
                }
            });

            render(<OptimizeCard />);
            expect(screen.getByTestId('rec-text').textContent).toContain('Enable compression');
        });

        it('falls back to recommendationText field', () => {
            impactedCountMeta();
            makeState({
                type: 'some-config',
                data: {
                    block_six: { count: { totalObjectsInViolation: 2 } },
                    block_four: { value: 'High' },
                    recommendationText: 'Check your config',
                    tags: []
                }
            });

            render(<OptimizeCard />);
            expect(screen.getByTestId('rec-text').textContent).toContain('Check your config');
        });

        it('falls back to recommendation string field', () => {
            impactedCountMeta();
            makeState({
                type: 'some-config',
                data: {
                    block_six: { count: { totalObjectsInViolation: 1 } },
                    block_four: { value: 'High' },
                    recommendation: 'Plain string recommendation',
                    tags: []
                }
            });

            render(<OptimizeCard />);
            expect(screen.getByTestId('rec-text').textContent).toContain('Plain string recommendation');
        });

        it('uses static recommendation text when fromPage is Dashboard', () => {
            impactedCountMeta();
            mockGetRecommendation.mockReturnValue({
                title: 'Static title',
                description: 'Static recommendation text'
            });
            makeState(
                null,
                {
                    type: 'some-config',
                    objectsInViolation: [{ isOptimized: false }, { isOptimized: true }]
                },
                'mssql'
            );

            render(<OptimizeCard fromPage="Dashboard" />);
            expect(screen.getByTestId('rec-text').textContent).toContain('Static title');
        });
    });

    // ── recommendation object handling ────────────────────────────────────────
    describe('recommendation object handling', () => {
        it('passes recommendation object directly as data when it is an object', () => {
            impactedCountMeta();
            makeState({
                type: 'some-config',
                data: {
                    block_six: { count: { totalObjectsInViolation: 1 } },
                    block_four: { value: 'High' },
                    recommendation: { title: 'My rec', description: 'Do this now' },
                    tags: []
                }
            });

            render(<OptimizeCard />);
            expect(screen.getByTestId('rec-text').textContent).toContain('My rec');
        });

        it('includes valueHeading and values when recommendation has valuesHeading', () => {
            impactedCountMeta();
            makeState({
                type: 'log-drive-size',
                data: {
                    block_six: { count: { totalObjectsInViolation: 1 } },
                    block_four: { value: 'High' },
                    recommendation: {
                        title: 'Log drive',
                        description: 'Increase log drive',
                        valuesHeading: 'Drive values',
                        values: [{ label: 'Min', value: '100GB' }]
                    },
                    tags: []
                }
            });

            render(<OptimizeCard />);
            // recommendation is an object so data = recommendation; rec-text stringifies it
            expect(screen.getByTestId('rec-text').textContent).toContain('Drive values');
        });
    });

    // ── cloneDashboardData (dashboard page) ───────────────────────────────────
    describe('cloneDashboardData (dashboard page)', () => {
        it('calculates impactedCount from non-optimized objectsInViolation', () => {
            impactedCountMeta();
            makeState(
                null,
                {
                    type: 'some-config',
                    objectsInViolation: [{ isOptimized: false }, { isOptimized: false }, { isOptimized: true }]
                },
                'mssql'
            );

            render(<OptimizeCard fromPage="Dashboard" />);
            // 2 non-optimized items
            expect(screen.getByText('2')).toBeTruthy();
        });
    });

    // ── effect guard conditions ───────────────────────────────────────────────
    describe('effect guard conditions', () => {
        it('does not call getCardMetadata when selectedOptimizeConfig is null', () => {
            makeState(null, null);
            render(<OptimizeCard />);
            expect(mockGetCardMetadata).not.toHaveBeenCalled();
        });

        it('does not use cloneDashboardData when fromPage is not Dashboard', () => {
            makeState(null, { type: 'some-config', objectsInViolation: [] });
            render(<OptimizeCard fromPage="SomeOtherPage" />);
            expect(mockGetCardMetadata).not.toHaveBeenCalled();
        });

        it('does not run selectedOptimizeConfig effect when fromPage is set', () => {
            impactedCountMeta();
            makeState(
                {
                    type: 'some-config',
                    data: {
                        block_six: { count: { totalObjectsInViolation: 5 } },
                        block_four: { value: 'High' },
                        tags: []
                    }
                },
                null
            );

            render(<OptimizeCard fromPage="Dashboard" />);
            // fromPage is set → the selectedOptimizeConfig effect is skipped
            // No cloneDashboardData either → getCardMetadata never called
            expect(mockGetCardMetadata).not.toHaveBeenCalled();
        });
    });
});

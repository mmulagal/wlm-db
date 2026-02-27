import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import AssessmentDialog from './AssessmentDialog';
import { DBType } from '../../../../utils/consts';

// Mock SVG component
vi.mock('../../../../assets/ic_bullet.svg', () => ({
    ReactComponent: () => <div data-testid="bullet-svg" />
}));

// Mock @netapp/design-system accordion components to always render children
vi.mock('@netapp/design-system', () => ({
    AccordionController: ({ children }: any) => <div data-testid="accordion-controller">{children}</div>,
    AccordionCard: ({ title, children }: any) => (
        <div data-testid="accordion-card">
            <div data-testid="accordion-title">{title}</div>
            {children}
        </div>
    ),
    AccordionCardContent: ({ children }: any) => <div data-testid="accordion-card-content">{children}</div>,
    Typography: ({ children }: any) => <div>{children}</div>
}));

// Helper function to create mock store
const createMockStore = (selectedTCOHostType: string = DBType.MSSQL) =>
    configureStore({
        reducer: {
            exploreSavings: () => ({ selectedTCOHostType })
        }
    });

// Helper function to render component
const renderComponent = (selectedTCOHostType: string = DBType.MSSQL) => {
    const store = createMockStore(selectedTCOHostType);
    return render(
        <Provider store={store}>
            <AssessmentDialog />
        </Provider>
    );
};

describe('AssessmentDialog', () => {
    describe('Common Rendering', () => {
        it('should render without crashing', () => {
            const { container } = renderComponent();
            expect(container.firstChild).toBeTruthy();
        });

        it('should render the accordion controller', () => {
            renderComponent();
            expect(screen.getByTestId('accordion-controller')).toBeTruthy();
        });

        it('should render three accordion cards', () => {
            renderComponent();
            const accordionCards = screen.getAllByTestId('accordion-card');
            expect(accordionCards).toHaveLength(3);
        });

        it('should render accordion titles for all three sections', () => {
            renderComponent();
            expect(screen.getByText('databases.explore-savings.what-data-does-the-script-collect')).toBeTruthy();
            expect(screen.getByText('databases.explore-savings.important-notes')).toBeTruthy();
            expect(screen.getByText('databases.explore-savings.prerequisites-and-compatibility')).toBeTruthy();
        });
    });

    describe('Oracle Host Type', () => {
        it('should render Oracle heading part one', () => {
            renderComponent(DBType.ORACLE);
            expect(
                screen.getByText('databases.explore-savings.assessment-dialog-oracle-heading-part-one')
            ).toBeTruthy();
        });

        it('should render Oracle heading part two', () => {
            renderComponent(DBType.ORACLE);
            expect(
                screen.getByText('databases.explore-savings.assessment-dialog-oracle-heading-part-two')
            ).toBeTruthy();
        });

        it('should not render MSSQL headings', () => {
            renderComponent(DBType.ORACLE);
            expect(screen.queryByText('databases.explore-savings.assessment-dialog-mssql-heading-part-one')).toBeNull();
            expect(screen.queryByText('databases.explore-savings.assessment-dialog-mssql-heading-part-two')).toBeNull();
        });

        describe('Accordion 1 - What data does the script collect', () => {
            it('should render Oracle accordion one points', () => {
                renderComponent(DBType.ORACLE);
                expect(screen.getByText('databases.explore-savings.accordion-one-point-one')).toBeTruthy();
                expect(screen.getByText('databases.explore-savings.accordion-one-point-two')).toBeTruthy();
                expect(screen.getByText('databases.explore-savings.accordion-one-point-three')).toBeTruthy();
                expect(screen.getByText('databases.explore-savings.accordion-one-point-four')).toBeTruthy();
            });

            it('should not render MSSQL accordion one points', () => {
                renderComponent(DBType.ORACLE);
                expect(screen.queryByText('databases.explore-savings.mssql-accordion-one-point-one')).toBeNull();
                expect(screen.queryByText('databases.explore-savings.mssql-accordion-one-point-two')).toBeNull();
                expect(screen.queryByText('databases.explore-savings.mssql-accordion-one-point-three')).toBeNull();
            });
        });

        describe('Accordion 2 - Important notes', () => {
            it('should render Oracle accordion two points', () => {
                renderComponent(DBType.ORACLE);
                expect(screen.getByText('databases.explore-savings.oracle-accordion-two-point-one')).toBeTruthy();
                expect(screen.getByText('databases.explore-savings.oracle-accordion-two-point-two')).toBeTruthy();
                expect(screen.getByText('databases.explore-savings.oracle-accordion-two-point-three')).toBeTruthy();
                expect(screen.getByText('databases.explore-savings.oracle-accordion-two-point-four')).toBeTruthy();
            });

            it('should not render MSSQL accordion two points', () => {
                renderComponent(DBType.ORACLE);
                expect(screen.queryByText('databases.explore-savings.mssql-accordion-two-point-one')).toBeNull();
            });
        });

        describe('Accordion 3 - Prerequisites and compatibility', () => {
            it('should render Oracle accordion three points', () => {
                renderComponent(DBType.ORACLE);
                expect(screen.getByText('databases.explore-savings.oracle-accordion-three-point-one')).toBeTruthy();
                expect(screen.getByText('databases.explore-savings.oracle-accordion-three-point-two')).toBeTruthy();
                expect(screen.getByText('databases.explore-savings.oracle-accordion-three-point-three')).toBeTruthy();
            });

            it('should not render MSSQL accordion three points', () => {
                renderComponent(DBType.ORACLE);
                expect(screen.queryByText('databases.explore-savings.mssql-accordion-three-point-one')).toBeNull();
            });
        });
    });

    describe('MSSQL Host Type', () => {
        it('should render MSSQL heading part one', () => {
            renderComponent(DBType.MSSQL);
            expect(screen.getByText('databases.explore-savings.assessment-dialog-mssql-heading-part-one')).toBeTruthy();
        });

        it('should render MSSQL heading part two', () => {
            renderComponent(DBType.MSSQL);
            expect(screen.getByText('databases.explore-savings.assessment-dialog-mssql-heading-part-two')).toBeTruthy();
        });

        it('should not render Oracle headings', () => {
            renderComponent(DBType.MSSQL);
            expect(
                screen.queryByText('databases.explore-savings.assessment-dialog-oracle-heading-part-one')
            ).toBeNull();
            expect(
                screen.queryByText('databases.explore-savings.assessment-dialog-oracle-heading-part-two')
            ).toBeNull();
        });

        describe('Accordion 1 - What data does the script collect', () => {
            it('should render MSSQL accordion one points', () => {
                renderComponent(DBType.MSSQL);
                expect(screen.getByText('databases.explore-savings.mssql-accordion-one-point-one')).toBeTruthy();
                expect(screen.getByText('databases.explore-savings.mssql-accordion-one-point-two')).toBeTruthy();
                expect(screen.getByText('databases.explore-savings.mssql-accordion-one-point-three')).toBeTruthy();
            });

            it('should not render Oracle accordion one points', () => {
                renderComponent(DBType.MSSQL);
                expect(screen.queryByText('databases.explore-savings.accordion-one-point-one')).toBeNull();
            });
        });

        describe('Accordion 2 - Important notes', () => {
            it('should render MSSQL accordion two points', () => {
                renderComponent(DBType.MSSQL);
                expect(screen.getByText('databases.explore-savings.mssql-accordion-two-point-one')).toBeTruthy();
                expect(screen.getByText('databases.explore-savings.mssql-accordion-two-point-two')).toBeTruthy();
                expect(screen.getByText('databases.explore-savings.mssql-accordion-two-point-three')).toBeTruthy();
                expect(screen.getByText('databases.explore-savings.mssql-accordion-two-point-four')).toBeTruthy();
                expect(screen.getByText('databases.explore-savings.mssql-accordion-two-point-five')).toBeTruthy();
            });

            it('should not render Oracle accordion two points', () => {
                renderComponent(DBType.MSSQL);
                expect(screen.queryByText('databases.explore-savings.oracle-accordion-two-point-one')).toBeNull();
            });
        });

        describe('Accordion 3 - Prerequisites and compatibility', () => {
            it('should render MSSQL accordion three points with nested sub-list', () => {
                renderComponent(DBType.MSSQL);
                expect(screen.getByText('databases.explore-savings.mssql-accordion-three-point-one')).toBeTruthy();
                expect(screen.getByText('databases.explore-savings.mssql-accordion-three-point-three')).toBeTruthy();
                expect(
                    screen.getByText('databases.explore-savings.mssql-accordion-three-point-three-point-one')
                ).toBeTruthy();
                expect(
                    screen.getByText('databases.explore-savings.mssql-accordion-three-point-three-point-two')
                ).toBeTruthy();
                expect(screen.getByText('databases.explore-savings.mssql-accordion-three-point-four')).toBeTruthy();
            });

            it('should not render Oracle accordion three points', () => {
                renderComponent(DBType.MSSQL);
                expect(screen.queryByText('databases.explore-savings.oracle-accordion-three-point-one')).toBeNull();
            });
        });
    });

    describe('Bullet Icons', () => {
        it('should render bullet icons for Oracle content', () => {
            renderComponent(DBType.ORACLE);
            const bullets = screen.getAllByTestId('bullet-svg');
            // Oracle: accordion 1 (4) + accordion 2 (5) + accordion 3 (4) = 13
            expect(bullets).toHaveLength(13);
        });

        it('should render bullet icons for MSSQL content', () => {
            renderComponent(DBType.MSSQL);
            const bullets = screen.getAllByTestId('bullet-svg');
            // MSSQL: accordion 1 (3) + accordion 2 (5) + accordion 3 (3) = 11
            expect(bullets).toHaveLength(11);
        });
    });
});

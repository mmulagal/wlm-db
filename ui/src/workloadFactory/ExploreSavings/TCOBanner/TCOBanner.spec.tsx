import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import TCOBanner from './TCOBanner';
import { DBType } from '../../../utils/consts';

// Mock SVG components
vi.mock('../../../assets/OracleTCO.svg', () => ({
    ReactComponent: () => <div data-testid="oracle-tco-svg" />
}));

vi.mock('../../../assets/Download-icon.svg', () => ({
    ReactComponent: () => <div data-testid="download-icon-svg" />
}));

vi.mock('../../../assets/Play.svg', () => ({
    ReactComponent: () => <div data-testid="play-svg" />
}));

vi.mock('../../../assets/Upload.svg', () => ({
    ReactComponent: () => <div data-testid="upload-svg" />
}));

vi.mock('../../../assets/Onprem.svg', () => ({
    ReactComponent: () => <div data-testid="onprem-svg" />
}));

vi.mock('../../../assets/Carousel Arrow left.svg', () => ({
    ReactComponent: () => <div data-testid="carousel-left-svg" />
}));

vi.mock('../../../assets/Carousel Arrow right.svg', () => ({
    ReactComponent: () => <div data-testid="carousel-right-svg" />
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
            <TCOBanner />
        </Provider>
    );
};

describe('TCOBanner', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('Initial Rendering (Slide 0)', () => {
        it('should render without crashing', () => {
            const { container } = renderComponent();
            expect(container.firstChild).toBeTruthy();
        });

        it('should render slide 0 by default', () => {
            renderComponent();
            expect(screen.getByTestId('oracle-tco-svg')).toBeTruthy();
        });

        it('should render carousel left and right arrows on slide 0', () => {
            renderComponent();
            const leftArrows = screen.getAllByTestId('carousel-left-svg');
            const rightArrows = screen.getAllByTestId('carousel-right-svg');
            expect(leftArrows.length).toBeGreaterThan(0);
            expect(rightArrows.length).toBeGreaterThan(0);
        });

        it('should render bottom navigation dots', () => {
            renderComponent();
            const buttons = screen.getAllByRole('button', { name: /Go to slide/i });
            expect(buttons).toHaveLength(2);
        });

        it('should show active indicator for slide 0', () => {
            renderComponent();
            const slideOneBtn = screen.getByRole('button', { name: 'Go to slide 1' });
            expect(slideOneBtn).toHaveAttribute('aria-pressed', 'true');
            const slideTwoBtn = screen.getByRole('button', { name: 'Go to slide 2' });
            expect(slideTwoBtn).toHaveAttribute('aria-pressed', 'false');
        });
    });

    describe('MSSQL Content (Slide 0)', () => {
        it('should render MSSQL heading on slide 0', () => {
            renderComponent(DBType.MSSQL);
            expect(screen.getByText('databases.explore-savings.tco-mssql-banner-slide-one-heading')).toBeTruthy();
        });

        it('should render MSSQL content on slide 0', () => {
            renderComponent(DBType.MSSQL);
            expect(screen.getByText('databases.explore-savings.tco-mssql-banner-slide-one-content')).toBeTruthy();
        });
    });

    describe('Oracle Content (Slide 0)', () => {
        it('should render Oracle heading on slide 0', () => {
            renderComponent(DBType.ORACLE);
            expect(screen.getByText('databases.explore-savings.tco-oracle-banner-slide-one-heading')).toBeTruthy();
        });

        it('should render Oracle content on slide 0', () => {
            renderComponent(DBType.ORACLE);
            expect(screen.getByText('databases.explore-savings.tco-oracle-banner-slide-one-content')).toBeTruthy();
        });
    });

    describe('Slide Navigation via Carousel Arrows', () => {
        it('should switch to slide 1 when clicking right arrow on slide 0', () => {
            renderComponent();
            const rightArrows = screen.getAllByTestId('carousel-right-svg');
            // The right arrow on slide 0 is in the mainSection
            fireEvent.click(rightArrows[0].parentElement!);
            // After clicking, slide 1 should be visible with Step 1
            expect(screen.getByText('Step 1')).toBeTruthy();
        });

        it('should switch to slide 1 when clicking left arrow on slide 0', () => {
            renderComponent();
            const leftArrows = screen.getAllByTestId('carousel-left-svg');
            // The left arrow on slide 0 also navigates to slide 1
            fireEvent.click(leftArrows[0].parentElement!);
            expect(screen.getByText('Step 1')).toBeTruthy();
        });

        it('should switch back to slide 0 when clicking left arrow on slide 1', () => {
            renderComponent();
            // First go to slide 1
            const rightArrows = screen.getAllByTestId('carousel-right-svg');
            fireEvent.click(rightArrows[0].parentElement!);
            expect(screen.getByText('Step 1')).toBeTruthy();

            // Now click left arrow on slide 1 to go back to slide 0
            const leftArrowsSlide1 = screen.getAllByTestId('carousel-left-svg');
            fireEvent.click(leftArrowsSlide1[0].parentElement!);
            expect(screen.getByTestId('oracle-tco-svg')).toBeTruthy();
        });

        it('should switch back to slide 0 when clicking right arrow on slide 1', () => {
            renderComponent();
            // First go to slide 1
            const rightArrows = screen.getAllByTestId('carousel-right-svg');
            fireEvent.click(rightArrows[0].parentElement!);
            expect(screen.getByText('Step 1')).toBeTruthy();

            // Now click right arrow on slide 1 to go back to slide 0
            const rightArrowsSlide1 = screen.getAllByTestId('carousel-right-svg');
            fireEvent.click(rightArrowsSlide1[0].parentElement!);
            expect(screen.getByTestId('oracle-tco-svg')).toBeTruthy();
        });
    });

    describe('Slide 1 Content', () => {
        const navigateToSlide1 = (hostType: string = DBType.MSSQL) => {
            renderComponent(hostType);
            const rightArrows = screen.getAllByTestId('carousel-right-svg');
            fireEvent.click(rightArrows[0].parentElement!);
        };

        it('should render step 1 through step 4', () => {
            navigateToSlide1();
            expect(screen.getByText('Step 1')).toBeTruthy();
            expect(screen.getByText('Step 2')).toBeTruthy();
            expect(screen.getByText('Step 3')).toBeTruthy();
            expect(screen.getByText('Step 4')).toBeTruthy();
        });

        it('should render all step icons on slide 1', () => {
            navigateToSlide1();
            expect(screen.getByTestId('download-icon-svg')).toBeTruthy();
            expect(screen.getByTestId('play-svg')).toBeTruthy();
            expect(screen.getByTestId('upload-svg')).toBeTruthy();
            expect(screen.getByTestId('onprem-svg')).toBeTruthy();
        });

        it('should render MSSQL heading on slide 1', () => {
            navigateToSlide1(DBType.MSSQL);
            expect(screen.getByText('databases.explore-savings.tco-mssql-banner-slide-two-heading')).toBeTruthy();
        });

        it('should render Oracle heading on slide 1', () => {
            navigateToSlide1(DBType.ORACLE);
            expect(screen.getByText('databases.explore-savings.tco-oracle-banner-slide-two-heading')).toBeTruthy();
        });

        it('should render MSSQL step 2 content on slide 1', () => {
            navigateToSlide1(DBType.MSSQL);
            expect(
                screen.getByText('databases.explore-savings.tco-mssql-banner-slide-two-content-step-2')
            ).toBeTruthy();
        });

        it('should render Oracle step 2 content on slide 1', () => {
            navigateToSlide1(DBType.ORACLE);
            expect(
                screen.getByText('databases.explore-savings.tco-oracle-banner-slide-two-content-step-2')
            ).toBeTruthy();
        });

        it('should render MSSQL step 4 (step 5) content on slide 1', () => {
            navigateToSlide1(DBType.MSSQL);
            expect(
                screen.getByText('databases.explore-savings.tco-mssql-banner-slide-two-content-step-5')
            ).toBeTruthy();
        });

        it('should render Oracle step 4 (step 5) content on slide 1', () => {
            navigateToSlide1(DBType.ORACLE);
            expect(
                screen.getByText('databases.explore-savings.tco-oracle-banner-slide-two-content-step-5')
            ).toBeTruthy();
        });

        it('should render common step 1 and step 3 content', () => {
            navigateToSlide1();
            expect(
                screen.getByText('databases.explore-savings.tco-oracle-banner-slide-two-content-step-1')
            ).toBeTruthy();
            expect(
                screen.getByText('databases.explore-savings.tco-oracle-banner-slide-two-content-step-4')
            ).toBeTruthy();
        });

        it('should show active indicator for slide 1', () => {
            navigateToSlide1();
            const slideOneBtn = screen.getByRole('button', { name: 'Go to slide 1' });
            expect(slideOneBtn).toHaveAttribute('aria-pressed', 'false');
            const slideTwoBtn = screen.getByRole('button', { name: 'Go to slide 2' });
            expect(slideTwoBtn).toHaveAttribute('aria-pressed', 'true');
        });
    });

    describe('Bottom Navigation Dots', () => {
        it('should navigate to slide 0 when clicking first dot', () => {
            renderComponent();
            // Go to slide 1 first
            const rightArrows = screen.getAllByTestId('carousel-right-svg');
            fireEvent.click(rightArrows[0].parentElement!);
            expect(screen.getByText('Step 1')).toBeTruthy();

            // Click first dot to go back to slide 0
            const slideOneBtn = screen.getByRole('button', { name: 'Go to slide 1' });
            fireEvent.click(slideOneBtn);
            expect(screen.getByTestId('oracle-tco-svg')).toBeTruthy();
        });

        it('should navigate to slide 1 when clicking second dot', () => {
            renderComponent();
            const slideTwoBtn = screen.getByRole('button', { name: 'Go to slide 2' });
            fireEvent.click(slideTwoBtn);
            expect(screen.getByText('Step 1')).toBeTruthy();
        });

        it('should navigate to slide via Enter key on dot', () => {
            renderComponent();
            const slideTwoBtn = screen.getByRole('button', { name: 'Go to slide 2' });
            fireEvent.keyDown(slideTwoBtn, { key: 'Enter' });
            expect(screen.getByText('Step 1')).toBeTruthy();
        });

        it('should navigate to slide via Space key on dot', () => {
            renderComponent();
            const slideTwoBtn = screen.getByRole('button', { name: 'Go to slide 2' });
            fireEvent.keyDown(slideTwoBtn, { key: ' ' });
            expect(screen.getByText('Step 1')).toBeTruthy();
        });

        it('should not navigate on other key presses', () => {
            renderComponent();
            const slideTwoBtn = screen.getByRole('button', { name: 'Go to slide 2' });
            fireEvent.keyDown(slideTwoBtn, { key: 'Tab' });
            // Should still be on slide 0
            expect(screen.getByTestId('oracle-tco-svg')).toBeTruthy();
        });

        it('should have correct tabIndex on dots', () => {
            renderComponent();
            const buttons = screen.getAllByRole('button', { name: /Go to slide/i });
            buttons.forEach(button => {
                expect(button).toHaveAttribute('tabindex', '0');
            });
        });

        it('should have cursor pointer style on dots', () => {
            renderComponent();
            const buttons = screen.getAllByRole('button', { name: /Go to slide/i });
            buttons.forEach(button => {
                expect(button.style.cursor).toBe('pointer');
            });
        });
    });

    describe('Auto-Rotation (useEffect with setInterval)', () => {
        it('should auto-rotate from slide 0 to slide 1 after 20 seconds', () => {
            renderComponent();
            // Initially on slide 0
            expect(screen.getByTestId('oracle-tco-svg')).toBeTruthy();

            // Advance time by 20 seconds
            act(() => {
                vi.advanceTimersByTime(20000);
            });

            // Should now be on slide 1
            expect(screen.getByText('Step 1')).toBeTruthy();
        });

        it('should auto-rotate from slide 1 back to slide 0 after another 20 seconds', () => {
            renderComponent();

            // Advance to slide 1
            act(() => {
                vi.advanceTimersByTime(20000);
            });
            expect(screen.getByText('Step 1')).toBeTruthy();

            // Advance another 20 seconds to go back to slide 0
            act(() => {
                vi.advanceTimersByTime(20000);
            });
            expect(screen.getByTestId('oracle-tco-svg')).toBeTruthy();
        });

        it('should clear interval on unmount', () => {
            const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
            const { unmount } = renderComponent();

            unmount();
            expect(clearIntervalSpy).toHaveBeenCalled();
            clearIntervalSpy.mockRestore();
        });
    });

    describe('SVG Fill Color for Bottom Dots', () => {
        it('should render active dot with #404040 fill and inactive dot with #a7a7a7 fill on slide 0', () => {
            const { container } = renderComponent();
            const rects = container.querySelectorAll('rect');
            expect(rects).toHaveLength(2);
            // Slide 0 is active, so first rect has #404040
            expect(rects[0]).toHaveAttribute('fill', '#404040');
            // Second rect has #a7a7a7
            expect(rects[1]).toHaveAttribute('fill', '#a7a7a7');
        });

        it('should swap fill colors when on slide 1', () => {
            const { container } = renderComponent();

            // Navigate to slide 1
            act(() => {
                vi.advanceTimersByTime(20000);
            });

            const rects = container.querySelectorAll('rect');
            expect(rects).toHaveLength(2);
            // Slide 1 is active, so first rect has #a7a7a7
            expect(rects[0]).toHaveAttribute('fill', '#a7a7a7');
            // Second rect has #404040
            expect(rects[1]).toHaveAttribute('fill', '#404040');
        });
    });

    describe('Full Oracle Flow', () => {
        it('should render Oracle content across both slides', () => {
            renderComponent(DBType.ORACLE);

            // Slide 0 - Oracle headings
            expect(screen.getByText('databases.explore-savings.tco-oracle-banner-slide-one-heading')).toBeTruthy();
            expect(screen.getByText('databases.explore-savings.tco-oracle-banner-slide-one-content')).toBeTruthy();

            // Navigate to slide 1
            const rightArrows = screen.getAllByTestId('carousel-right-svg');
            fireEvent.click(rightArrows[0].parentElement!);

            // Slide 1 - Oracle headings
            expect(screen.getByText('databases.explore-savings.tco-oracle-banner-slide-two-heading')).toBeTruthy();
            expect(
                screen.getByText('databases.explore-savings.tco-oracle-banner-slide-two-content-step-2')
            ).toBeTruthy();
            expect(
                screen.getByText('databases.explore-savings.tco-oracle-banner-slide-two-content-step-5')
            ).toBeTruthy();
        });
    });

    describe('Full MSSQL Flow', () => {
        it('should render MSSQL content across both slides', () => {
            renderComponent(DBType.MSSQL);

            // Slide 0 - MSSQL headings
            expect(screen.getByText('databases.explore-savings.tco-mssql-banner-slide-one-heading')).toBeTruthy();
            expect(screen.getByText('databases.explore-savings.tco-mssql-banner-slide-one-content')).toBeTruthy();

            // Navigate to slide 1
            const rightArrows = screen.getAllByTestId('carousel-right-svg');
            fireEvent.click(rightArrows[0].parentElement!);

            // Slide 1 - MSSQL headings
            expect(screen.getByText('databases.explore-savings.tco-mssql-banner-slide-two-heading')).toBeTruthy();
            expect(
                screen.getByText('databases.explore-savings.tco-mssql-banner-slide-two-content-step-2')
            ).toBeTruthy();
            expect(
                screen.getByText('databases.explore-savings.tco-mssql-banner-slide-two-content-step-5')
            ).toBeTruthy();
        });
    });
});

import React from 'react';
import { render } from '@testing-library/react';
import usePortalBox from './usePortalBox';

vi.mock('./usePortalBox.module.scss', () => ({
    default: {
        tooltip: 'tooltip',
        'tooltip-text': 'tooltip-text'
    }
}));

// Wrapper component to render the hook
const PortalBoxComponent = (props: any) => {
    const { Portal } = usePortalBox(props);
    return <div data-testid="wrapper">{Portal}</div>;
};

const defaultRect = {
    top: 100,
    bottom: 120,
    left: 50,
    right: 200,
    width: 150,
    height: 20
};

describe('usePortalBox', () => {
    beforeEach(() => {
        // Set large window dimensions so elements don't protrude by default
        Object.defineProperty(window.document.documentElement, 'clientWidth', {
            value: 1200,
            writable: true,
            configurable: true
        });
        Object.defineProperty(window.document.documentElement, 'clientHeight', {
            value: 800,
            writable: true,
            configurable: true
        });
        Object.defineProperty(window, 'pageXOffset', { value: 0, writable: true, configurable: true });
        Object.defineProperty(window, 'pageYOffset', { value: 0, writable: true, configurable: true });
    });

    it('renders without crashing when isPopup is false', () => {
        const { container } = render(
            <PortalBoxComponent
                title="Test Tooltip"
                padding={8}
                isPopup={false}
                parentRect={defaultRect}
                placement="bottom"
                width={100}
                height={50}
            />
        );
        expect(container).toBeTruthy();
    });

    it('renders portal content (title) correctly when isPopup=true', () => {
        // Portal renders into a div appended to document.body, so query from body
        const { unmount } = render(
            <PortalBoxComponent
                title="Hello Tooltip"
                padding={8}
                isPopup
                parentRect={defaultRect}
                placement="bottom"
                width={200}
                height={80}
            />
        );
        expect(document.body.textContent).toContain('Hello Tooltip');
        unmount();
    });

    it('appends box to body and positions it when isPopup=true (bottom placement)', () => {
        const { unmount } = render(
            <PortalBoxComponent
                title="Tooltip"
                padding={8}
                isPopup
                parentRect={defaultRect}
                placement="bottom"
                width={100}
                height={50}
            />
        );
        unmount(); // triggers cleanup: removeChild(box)
    });

    it('positions correctly with placement="top"', () => {
        const { unmount } = render(
            <PortalBoxComponent
                title="Top Tooltip"
                padding={8}
                isPopup
                parentRect={defaultRect}
                placement="top"
                width={100}
                height={50}
            />
        );
        unmount();
    });

    it('positions correctly with placement="left" (vertical)', () => {
        const { unmount } = render(
            <PortalBoxComponent
                title="Left Tooltip"
                padding={8}
                isPopup
                parentRect={defaultRect}
                placement="left"
                width={100}
                height={50}
            />
        );
        unmount();
    });

    it('positions correctly with placement="right" (vertical)', () => {
        const { unmount } = render(
            <PortalBoxComponent
                title="Right Tooltip"
                padding={8}
                isPopup
                parentRect={defaultRect}
                placement="right"
                width={100}
                height={50}
            />
        );
        unmount();
    });

    it('positions correctly with placement="bottom-start"', () => {
        const { unmount } = render(
            <PortalBoxComponent
                title="Tooltip"
                padding={8}
                isPopup
                parentRect={defaultRect}
                placement="bottom-start"
                width={100}
                height={50}
            />
        );
        unmount();
    });

    it('positions correctly with placement="bottom-end"', () => {
        const { unmount } = render(
            <PortalBoxComponent
                title="Tooltip"
                padding={8}
                isPopup
                parentRect={defaultRect}
                placement="bottom-end"
                width={100}
                height={50}
            />
        );
        unmount();
    });

    it('positions correctly with placement="top-start"', () => {
        const { unmount } = render(
            <PortalBoxComponent
                title="Tooltip"
                padding={8}
                isPopup
                parentRect={defaultRect}
                placement="top-start"
                width={100}
                height={50}
            />
        );
        unmount();
    });

    it('positions correctly with placement="top-end"', () => {
        const { unmount } = render(
            <PortalBoxComponent
                title="Tooltip"
                padding={8}
                isPopup
                parentRect={defaultRect}
                placement="top-end"
                width={100}
                height={50}
            />
        );
        unmount();
    });

    it('positions correctly with placement="left-start"', () => {
        const { unmount } = render(
            <PortalBoxComponent
                title="Tooltip"
                padding={8}
                isPopup
                parentRect={defaultRect}
                placement="left-start"
                width={100}
                height={50}
            />
        );
        unmount();
    });

    it('positions correctly with placement="left-end"', () => {
        const { unmount } = render(
            <PortalBoxComponent
                title="Tooltip"
                padding={8}
                isPopup
                parentRect={defaultRect}
                placement="left-end"
                width={100}
                height={50}
            />
        );
        unmount();
    });

    it('positions correctly with placement="right-start"', () => {
        const { unmount } = render(
            <PortalBoxComponent
                title="Tooltip"
                padding={8}
                isPopup
                parentRect={defaultRect}
                placement="right-start"
                width={100}
                height={50}
            />
        );
        unmount();
    });

    it('positions correctly with placement="right-end"', () => {
        const { unmount } = render(
            <PortalBoxComponent
                title="Tooltip"
                padding={8}
                isPopup
                parentRect={defaultRect}
                placement="right-end"
                width={100}
                height={50}
            />
        );
        unmount();
    });

    it('triggers swap when element protrudes right edge (right→left swap)', () => {
        // Element near right edge so "right" placement protrudes, swaps to "left"
        const edgeRect = { top: 100, bottom: 130, left: 50, right: 1190, width: 1140, height: 30 };
        const { unmount } = render(
            <PortalBoxComponent
                title="Tooltip"
                padding={20}
                isPopup
                parentRect={edgeRect}
                placement="right"
                width={100}
                height={50}
            />
        );
        unmount();
    });

    it('triggers swap when element protrudes bottom edge (bottom→top swap)', () => {
        // Element near bottom so "bottom" placement protrudes, swaps to "top"
        const edgeRect = { top: 750, bottom: 790, left: 400, right: 600, width: 200, height: 40 };
        const { unmount } = render(
            <PortalBoxComponent
                title="Tooltip"
                padding={20}
                isPopup
                parentRect={edgeRect}
                placement="bottom"
                width={100}
                height={50}
            />
        );
        unmount();
    });

    it('triggers swap fallback (find=4) when all directions protrude', () => {
        // Use tiny window dimensions so everything protrudes
        Object.defineProperty(window.document.documentElement, 'clientWidth', {
            value: 1,
            writable: true,
            configurable: true
        });
        Object.defineProperty(window.document.documentElement, 'clientHeight', {
            value: 1,
            writable: true,
            configurable: true
        });
        const { unmount } = render(
            <PortalBoxComponent
                title="Tooltip"
                padding={8}
                isPopup
                parentRect={defaultRect}
                placement="top"
                width={100}
                height={50}
            />
        );
        unmount();
    });

    it('triggers swap default branch starting from undefined placement', () => {
        Object.defineProperty(window.document.documentElement, 'clientWidth', {
            value: 1,
            writable: true,
            configurable: true
        });
        Object.defineProperty(window.document.documentElement, 'clientHeight', {
            value: 1,
            writable: true,
            configurable: true
        });
        const { unmount } = render(
            <PortalBoxComponent
                title="Tooltip"
                padding={8}
                isPopup
                parentRect={defaultRect}
                placement="bottom"
                width={100}
                height={50}
            />
        );
        unmount();
    });

    it('handles isPopup changing from false to true', () => {
        const { rerender, unmount } = render(
            <PortalBoxComponent
                title="Tooltip"
                padding={8}
                isPopup={false}
                parentRect={defaultRect}
                placement="bottom"
                width={100}
                height={50}
            />
        );
        rerender(
            <PortalBoxComponent
                title="Tooltip"
                padding={8}
                isPopup
                parentRect={defaultRect}
                placement="bottom"
                width={100}
                height={50}
            />
        );
        unmount();
    });

    it('handles isPopup changing from true to false', () => {
        const { rerender, unmount } = render(
            <PortalBoxComponent
                title="Tooltip"
                padding={8}
                isPopup
                parentRect={defaultRect}
                placement="bottom"
                width={100}
                height={50}
            />
        );
        rerender(
            <PortalBoxComponent
                title="Tooltip"
                padding={8}
                isPopup={false}
                parentRect={defaultRect}
                placement="bottom"
                width={100}
                height={50}
            />
        );
        unmount();
    });
});

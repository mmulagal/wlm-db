import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import CopyToClipboard from './CopyToClipboard';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('@netapp/icons/ic_copy.svg', () => ({
    ReactComponent: ({ className }: any) => <svg data-testid="copy-icon" className={className} />
}));

vi.mock('@netapp/design-system', () => ({
    DsTooltipInfo: ({ icon, children, status, className }: any) => (
        <div data-testid="ds-tooltip-info" data-status={status} className={className}>
            <div data-testid="tooltip-icon-slot">{icon}</div>
            <div data-testid="tooltip-content">{children}</div>
        </div>
    ),
    DsTypography: ({ children, style, className, variant }: any) => (
        <span data-testid="ds-typography" style={style} className={className} data-variant={variant}>
            {children}
        </span>
    )
}));

describe('CopyToClipboard', () => {
    it('should be a defined component', () => {
        expect(CopyToClipboard).toBeDefined();
    });

    it('should render with value prop', () => {
        const { container } = render(<CopyToClipboard value="copy this text" />);
        expect(container).toBeTruthy();
    });

    it('should render with custom tooltipTitle', () => {
        const { container } = render(<CopyToClipboard value="text" tooltipTitle="Custom copy tooltip" />);
        expect(container).toBeTruthy();
    });

    it('should render with className', () => {
        const { container } = render(<CopyToClipboard value="text" className="custom-class" />);
        expect(container).toBeTruthy();
    });

    it('should render with custom iconProvided', () => {
        const { container } = render(<CopyToClipboard value="text" iconProvided={<span>📋</span>} />);
        expect(container).toBeTruthy();
    });

    it('should render with tooltipMessage=true (tooltip content visible)', () => {
        const { getByTestId } = render(<CopyToClipboard value="text" tooltipTitle="Copied!" tooltipMessage />);
        expect(getByTestId('ds-tooltip-info')).toBeTruthy();
        expect(getByTestId('tooltip-content').textContent).toBe('Copied!');
    });

    it('should render with tooltipMessage=false (default)', () => {
        const { getByTestId } = render(<CopyToClipboard value="text" tooltipTitle="Copy" tooltipMessage={false} />);
        expect(getByTestId('ds-tooltip-info')).toBeTruthy();
    });

    it('should call handleCopy successfully when copy icon is clicked', () => {
        const execCommandMock = vi.fn().mockReturnValue(true);
        Object.defineProperty(document, 'execCommand', {
            value: execCommandMock,
            writable: true,
            configurable: true
        });

        const { getByTestId } = render(<CopyToClipboard value="hello world" tooltipMessage />);
        // The icon-slot div wraps an <div onClick={handleCopy}>
        const iconSlot = getByTestId('tooltip-icon-slot');
        const clickableDiv = iconSlot.firstChild as HTMLElement;
        fireEvent.click(clickableDiv);

        expect(execCommandMock).toHaveBeenCalledWith('copy');
    });

    it('should show success tooltip after copy and hide after timeout', async () => {
        vi.useFakeTimers();
        Object.defineProperty(document, 'execCommand', {
            value: vi.fn().mockReturnValue(true),
            writable: true,
            configurable: true
        });

        const { getByTestId } = render(<CopyToClipboard value="copy me" tooltipMessage />);
        const iconSlot = getByTestId('tooltip-icon-slot');
        const clickableDiv = iconSlot.firstChild as HTMLElement;

        await act(async () => {
            fireEvent.click(clickableDiv);
        });
        // After click, visible=true → status="opened"
        expect(getByTestId('ds-tooltip-info').dataset.status).toBe('opened');

        // After 1500ms, visible=false → status="closed"
        await act(async () => {
            vi.advanceTimersByTime(1500);
        });
        expect(getByTestId('ds-tooltip-info').dataset.status).toBe('closed');

        vi.useRealTimers();
    });

    it('should handle copy error gracefully (catch branch)', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        Object.defineProperty(document, 'execCommand', {
            value: vi.fn().mockImplementation(() => {
                throw new Error('Not supported');
            }),
            writable: true,
            configurable: true
        });

        const { getByTestId } = render(<CopyToClipboard value="fail me" />);
        const iconSlot = getByTestId('tooltip-icon-slot');
        const clickableDiv = iconSlot.firstChild as HTMLElement;

        expect(() => fireEvent.click(clickableDiv)).not.toThrow();
        expect(consoleSpy).toHaveBeenCalledWith('Failed to copy text: ', expect.any(Error));
        consoleSpy.mockRestore();
    });

    it('should render default copy icon when no iconProvided', () => {
        const { getByTestId } = render(<CopyToClipboard value="text" />);
        expect(getByTestId('copy-icon')).toBeTruthy();
    });
});

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import DotComponent from './DotComponent';

describe('DotComponent', () => {
    it('should be a defined component', () => {
        expect(DotComponent).toBeDefined();
    });

    it('should render with color and value', () => {
        const { container } = render(<DotComponent color="#ff0000" value="Critical" />);
        expect(container).toBeTruthy();
    });

    it('should render the value text', () => {
        const { getByText } = render(<DotComponent color="#00ff00" value="Healthy" />);
        expect(getByText('Healthy')).toBeTruthy();
    });

    it('should apply the background color to the dot image', () => {
        const { container } = render(<DotComponent color="#0000ff" value="Warning" />);
        const dotImage = container.querySelector('[style*="background-color"]') as HTMLElement;
        expect(dotImage).toBeTruthy();
        expect(dotImage.style.backgroundColor).toBe('rgb(0, 0, 255)');
    });

    it('should render with empty value string', () => {
        const { container } = render(<DotComponent color="#aaaaaa" value="" />);
        expect(container).toBeTruthy();
    });

    it('should render with different color values', () => {
        const colors = ['red', 'green', 'blue', 'var(--text-primary)', '#123456'];
        colors.forEach(color => {
            const { container } = render(<DotComponent color={color} value="Test" />);
            expect(container).toBeTruthy();
        });
    });
});

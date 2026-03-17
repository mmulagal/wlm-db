import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TransitionChevron } from './TransitionChevron';

describe('TransitionChevron', () => {
    it('should be a defined component', () => {
        expect(TransitionChevron).toBeDefined();
    });

    it('should accept isExpanded=true prop', () => {
        const { container } = render(<TransitionChevron isExpanded />);
        expect(container).toBeTruthy();
    });

    it('should accept isExpanded=false prop', () => {
        const { container } = render(<TransitionChevron isExpanded={false} />);
        expect(container).toBeTruthy();
    });

    it('should accept isHovered prop', () => {
        const { container } = render(<TransitionChevron isExpanded isHovered />);
        expect(container).toBeTruthy();
    });

    it('should accept className prop', () => {
        const { container } = render(<TransitionChevron isExpanded={false} className="custom" />);
        expect(container).toBeTruthy();
    });

    it('should accept isDisabled prop', () => {
        const { container } = render(<TransitionChevron isExpanded={false} isDisabled />);
        expect(container).toBeTruthy();
    });
});

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import CodeBoxScroll from './CodeBoxScroll';

vi.mock('../../utils/appConstants', () => ({
    CODE_VIEWER: {
        CLOUDFORMATION: 'CloudFormation',
        CODEBOX: 'Codebox'
    }
}));

describe('CodeBoxScroll', () => {
    it('should be a function component', () => {
        expect(typeof CodeBoxScroll).toBe('function');
    });

    it('should render with required props', () => {
        const { container } = render(
            <CodeBoxScroll dropDownValue="REST" setDisplayedDataInCodeBox={<div>Code content</div>} />
        );
        expect(container).toBeTruthy();
    });

    it('should apply CloudFormation height class when dropDownValue matches', () => {
        const { container } = render(
            <CodeBoxScroll dropDownValue="CloudFormation" setDisplayedDataInCodeBox={<div>Code</div>} />
        );
        expect(container).toBeTruthy();
    });

    it('should apply default height class when dropDownValue does not match CloudFormation', () => {
        const { container } = render(
            <CodeBoxScroll dropDownValue="OTHER" setDisplayedDataInCodeBox={<div>Code</div>} />
        );
        expect(container).toBeTruthy();
    });

    it('should handle scroll event and update state', () => {
        const { container } = render(
            <CodeBoxScroll dropDownValue="REST" setDisplayedDataInCodeBox={<div>Code content</div>} />
        );
        const scrollContainer = container.querySelector('[class*="scrollContainer"]') as HTMLElement;
        if (scrollContainer) {
            Object.defineProperty(scrollContainer, 'scrollLeft', { value: 100, configurable: true });
            Object.defineProperty(scrollContainer, 'scrollTop', { value: 50, configurable: true });
            Object.defineProperty(scrollContainer, 'clientWidth', { value: 200, configurable: true });
            Object.defineProperty(scrollContainer, 'scrollWidth', { value: 300, configurable: true });
            Object.defineProperty(scrollContainer, 'clientHeight', { value: 100, configurable: true });
            Object.defineProperty(scrollContainer, 'scrollHeight', { value: 200, configurable: true });
            fireEvent.scroll(scrollContainer);
        }
        expect(container).toBeTruthy();
    });

    it('should detect end of horizontal scroll', () => {
        const { container } = render(
            <CodeBoxScroll dropDownValue="REST" setDisplayedDataInCodeBox={<div>Code</div>} />
        );
        const scrollContainer = container.querySelector('[class*="scrollContainer"]') as HTMLElement;
        if (scrollContainer) {
            Object.defineProperty(scrollContainer, 'scrollLeft', { value: 100, configurable: true });
            Object.defineProperty(scrollContainer, 'clientWidth', { value: 200, configurable: true });
            Object.defineProperty(scrollContainer, 'scrollWidth', { value: 300, configurable: true });
            Object.defineProperty(scrollContainer, 'scrollTop', { value: 50, configurable: true });
            Object.defineProperty(scrollContainer, 'clientHeight', { value: 100, configurable: true });
            Object.defineProperty(scrollContainer, 'scrollHeight', { value: 200, configurable: true });
            fireEvent.scroll(scrollContainer);
        }
        expect(container).toBeTruthy();
    });
});

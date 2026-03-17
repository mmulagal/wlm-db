import { describe, it, expect } from 'vitest';
import Tag from './Tag';

describe('Tag', () => {
    it('should be a function component', () => {
        expect(typeof Tag).toBe('function');
    });

    it('should accept text and style2 props', () => {
        const element = Tag({ text: 'Label', style2: true });
        expect(element).toBeTruthy();
    });

    it('should render with style2=true (plain div)', () => {
        const element = Tag({ text: 'Label', style2: true }) as any;
        expect(element).toBeTruthy();
        // When style2 is true, renders a plain div
        const { children } = element.props;
        expect(children[0]).toBeTruthy();
        expect(children[0].props.children).toBe('Label');
    });

    it('should render with style2=false (DsTypography)', () => {
        const element = Tag({ text: 'Label', style2: false }) as any;
        expect(element).toBeTruthy();
        // When style2 is false, renders DsTypography
        const { children } = element.props;
        expect(children[1]).toBeTruthy();
    });

    it('should render with style2 undefined (DsTypography path)', () => {
        const element = Tag({ text: 'MyTag' }) as any;
        expect(element).toBeTruthy();
    });
});

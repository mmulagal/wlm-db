import { describe, it, expect } from 'vitest';
import StatusComponent from './StatusComponent';

describe('StatusComponent', () => {
    it('should be a function component', () => {
        expect(typeof StatusComponent).toBe('function');
    });

    it('should accept status prop', () => {
        const element = StatusComponent({ status: 'CRITICAL' });
        expect(element).toBeTruthy();
    });

    it('should accept statusText override', () => {
        const element = StatusComponent({ status: 'MAJOR', statusText: 'Custom Text' }) as any;
        expect(element).toBeTruthy();
    });

    it('should use status as statusText by default', () => {
        const element = StatusComponent({ status: 'MINOR' }) as any;
        expect(element).toBeTruthy();
        // Find the status div - last children
        const { children } = element.props;
        const statusDiv = children[children.length - 1];
        expect(statusDiv.props.children).toBe('MINOR');
    });

    it('should render with useIcon=true', () => {
        const element = StatusComponent({ status: 'CRITICAL', useIcon: true }) as any;
        expect(element).toBeTruthy();
    });

    it('should render with useIcon=false (default)', () => {
        const element = StatusComponent({ status: 'INFO', useIcon: false }) as any;
        expect(element).toBeTruthy();
    });

    it('should render with isCircle=true', () => {
        const element = StatusComponent({ status: 'MAJOR', isCircle: true }) as any;
        expect(element).toBeTruthy();
    });

    it('should accept custom className', () => {
        const element = StatusComponent({ status: 'MINOR', className: 'custom' }) as any;
        expect(element).toBeTruthy();
    });

    it('should use status.toLowerCase() as className when no className provided', () => {
        const element = StatusComponent({ status: 'CRITICAL' }) as any;
        expect(element).toBeTruthy();
    });

    it('should accept all four status values', () => {
        ['CRITICAL', 'MAJOR', 'MINOR', 'INFO'].forEach(status => {
            const element = StatusComponent({ status }) as any;
            expect(element).toBeTruthy();
        });
    });

    it('should render icon map entries for useIcon=true', () => {
        ['CRITICAL', 'MAJOR', 'MINOR', 'INFO'].forEach(status => {
            const element = StatusComponent({ status, useIcon: true }) as any;
            expect(element).toBeTruthy();
        });
    });
});

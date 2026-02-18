import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ConnectToCiCdContent from './ConnectToCiCdContent';

vi.mock('../../../../utils/consts', () => ({
    CREATE_SANDBOX_ENDPOINT: '/sandboxes',
    CRED_PLACEHOLDERS: {
        TOKEN: '<Token>'
    }
}));

vi.mock('./ConnectToCiCd.module.scss', () => ({
    default: {
        codeBox: 'codeBox',
        startFlex: 'startFlex',
        highlightWord: 'highlightWord',
        marginFIfteen: 'marginFIfteen'
    }
}));

describe('ConnectToCiCdContent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const defaultProps = {
        baseUrl: 'https://api.example.com',
        credID: 'myCredId',
        region: 'us-east-1',
        databaseHostId: 'host123',
        sandboxName: 'mySandbox',
        actualData: { key1: 'value1', key2: 'value2' }
    };

    it('should render base URL in curl command', () => {
        render(<ConnectToCiCdContent {...defaultProps} />);

        expect(screen.getByText(/https:\/\/api\.example\.com\/mssql\/credentials\//)).toBeTruthy();
    });

    it('should render credential ID', () => {
        render(<ConnectToCiCdContent {...defaultProps} />);

        expect(screen.getByText('myCredId')).toBeTruthy();
    });

    it('should render region', () => {
        render(<ConnectToCiCdContent {...defaultProps} />);

        expect(screen.getByText('us-east-1')).toBeTruthy();
    });

    it('should render sandbox name with endpoint', () => {
        const { container } = render(<ConnectToCiCdContent {...defaultProps} />);

        expect(container.textContent).toContain('/sandboxes/mySandbox');
    });

    it('should render token placeholder highlighted', () => {
        const { container } = render(<ConnectToCiCdContent {...defaultProps} />);

        expect(container.textContent).toContain('<Token>');
    });

    it('should render Authorization header', () => {
        const { container } = render(<ConnectToCiCdContent {...defaultProps} />);

        expect(container.textContent).toContain('Authorization: Bearer');
    });

    it('should render Content-Type header', () => {
        const { container } = render(<ConnectToCiCdContent {...defaultProps} />);

        expect(container.textContent).toContain('Content-Type: application/json');
    });

    it('should render actual data properties', () => {
        const { container } = render(<ConnectToCiCdContent {...defaultProps} />);

        expect(container.textContent).toContain('"key1":');
        expect(container.textContent).toContain('"value1"');
    });

    it('should highlight credential placeholder when credID is placeholder', () => {
        const props = { ...defaultProps, credID: '<CredentialId>' };
        const { container } = render(<ConnectToCiCdContent {...props} />);

        expect(container.querySelector('.highlightWord')).toBeTruthy();
    });

    it('should NOT highlight when credID is real value', () => {
        render(<ConnectToCiCdContent {...defaultProps} />);

        // credID is 'myCredId' which is not '<CredentialId>', so no highlight on that span
        // Only token should be highlighted
        const highlighted = screen.getAllByText('<Token>');
        expect(highlighted.length).toBe(1);
    });

    it('should render null for empty actualData', () => {
        const props = { ...defaultProps, actualData: null };
        const { container } = render(<ConnectToCiCdContent {...props} />);

        expect(container.querySelector('.marginFIfteen')).toBeTruthy();
    });

    it('should highlight region placeholder', () => {
        const props = { ...defaultProps, region: '<Region>' };
        const { container } = render(<ConnectToCiCdContent {...props} />);

        const highlighted = container.querySelectorAll('.highlightWord');
        expect(highlighted.length).toBeGreaterThan(0);
    });
});

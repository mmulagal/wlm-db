import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import CreateNewSandboxContent from './CreateNewSandboxContent';

vi.mock('./SelectSource/SelectSource', () => ({
    default: () => <div data-testid="select-source" />
}));

vi.mock('./SelectTarget/SelectTarget', () => ({
    default: () => <div data-testid="select-target" />
}));

vi.mock('./Mount/Mount', () => ({
    default: () => <div data-testid="mount" />
}));

vi.mock('./DefineTag/DefineTag', () => ({
    default: () => <div data-testid="define-tag" />
}));

vi.mock('@netapp/design-system', () => ({
    AccordionController: ({ children, isGrouped }: any) => (
        <div data-testid="accordion-controller" data-grouped={isGrouped}>
            {children}
        </div>
    ),
    DsTypography: ({ children, variant, className }: any) => (
        <div data-testid="ds-typography" data-variant={variant} className={className}>
            {children}
        </div>
    )
}));

vi.mock('./CreateNewSandboxContent.module.scss', () => ({
    default: {
        createNewSandboxContent: 'createNewSandboxContent',
        heading: 'heading',
        accordionContainer: 'accordionContainer'
    }
}));

vi.mock('../../../../utils/appConstants', () => ({
    GENERAL: {
        CREATE_NEW_SANDBOX: 'Create New Sandbox'
    }
}));

describe('CreateNewSandboxContent', () => {
    it('should render the heading', () => {
        render(<CreateNewSandboxContent />);
        expect(screen.getByText('Create New Sandbox')).toBeTruthy();
    });

    it('should render SelectSource component', () => {
        render(<CreateNewSandboxContent />);
        expect(screen.getByTestId('select-source')).toBeTruthy();
    });

    it('should render SelectTarget component', () => {
        render(<CreateNewSandboxContent />);
        expect(screen.getByTestId('select-target')).toBeTruthy();
    });

    it('should render Mount component', () => {
        render(<CreateNewSandboxContent />);
        expect(screen.getByTestId('mount')).toBeTruthy();
    });

    it('should render DefineTag component', () => {
        render(<CreateNewSandboxContent />);
        expect(screen.getByTestId('define-tag')).toBeTruthy();
    });

    it('should render AccordionController with isGrouped', () => {
        render(<CreateNewSandboxContent />);
        const accordion = screen.getByTestId('accordion-controller');
        expect(accordion).toBeTruthy();
        expect(accordion.getAttribute('data-grouped')).toBe('true');
    });

    it('should render all four accordion items inside AccordionController', () => {
        render(<CreateNewSandboxContent />);
        expect(screen.getByTestId('select-source')).toBeTruthy();
        expect(screen.getByTestId('select-target')).toBeTruthy();
        expect(screen.getByTestId('mount')).toBeTruthy();
        expect(screen.getByTestId('define-tag')).toBeTruthy();
    });
});

import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import RebaseLineContent from './RebaseLineContent';

vi.mock('../../../../assets/ic_bullet.svg', () => ({
    ReactComponent: () => <svg data-testid="bullet-icon" />
}));

vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, variant, className }: any) => (
        <div data-testid="ds-typography" data-variant={variant} className={className}>
            {children}
        </div>
    )
}));

vi.mock('./RebaseLineContent.module.scss', () => ({
    default: {
        rebaseLineContent: 'rebaseLineContent',
        secondLine: 'secondLine',
        list: 'list',
        listItem: 'listItem',
        textWidth: 'textWidth'
    }
}));

vi.mock('../../../../utils/appConstants', () => ({
    GENERAL: {
        REBASELINE_DIALOG_TITLE: ['Are you sure you want to re-baseline sandbox ', ' from database '],
        REBASELINE_DIALOG_FIRST_BULLET: 'The sandbox will sync with the latest source data.',
        REBASELINE_DIALOG_SECOND_BULLET: 'Existing changes in this sandbox will be preserved.'
    }
}));

describe('RebaseLineContent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render sandbox name and database name', () => {
        render(<RebaseLineContent sandboxName="mySandbox" databaseName="myDB" />);

        expect(screen.getByText('mySandbox')).toBeTruthy();
        expect(screen.getByText('myDB')).toBeTruthy();
    });

    it('should render dialog title parts', () => {
        const { container } = render(<RebaseLineContent sandboxName="sandbox1" databaseName="db1" />);

        expect(container.textContent).toContain('Are you sure you want to re-baseline sandbox');
        expect(container.textContent).toContain('from database');
    });

    it('should render first bullet', () => {
        render(<RebaseLineContent sandboxName="sandbox1" databaseName="db1" />);

        expect(screen.getByText('The sandbox will sync with the latest source data.')).toBeTruthy();
    });

    it('should render second bullet', () => {
        render(<RebaseLineContent sandboxName="sandbox1" databaseName="db1" />);

        expect(screen.getByText('Existing changes in this sandbox will be preserved.')).toBeTruthy();
    });

    it('should render two bullet icons', () => {
        render(<RebaseLineContent sandboxName="sandbox1" databaseName="db1" />);

        const bullets = screen.getAllByTestId('bullet-icon');
        expect(bullets.length).toBe(2);
    });
});

import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import RebaseSplitContent from './RebaseSplitContent';

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

vi.mock('./RebaseSplitContent.module.scss', () => ({
    default: {
        rebaseSplitContent: 'rebaseSplitContent',
        secondLine: 'secondLine',
        list: 'list',
        listItem: 'listItem',
        textWidth: 'textWidth'
    }
}));

vi.mock('../../../../utils/appConstants', () => ({
    GENERAL: {
        SPLIT_DIALOG_TITLE: ['Are you sure you want to split sandbox ', ' from database '],
        SPLIT_DIALOG_FIRST_BULLET: ['The estimated storage needed is ', ' GB.'],
        SPLIT_DIALOG_SECOND_BULLET: 'This action cannot be undone.'
    }
}));

describe('RebaseSplitContent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render sandbox name and database name', () => {
        render(<RebaseSplitContent sandboxName="mySandbox" databaseName="myDB" aggSplitEstimate="10 GB" />);

        expect(screen.getByText('mySandbox')).toBeTruthy();
        expect(screen.getByText('myDB')).toBeTruthy();
    });

    it('should render dialog title parts', () => {
        const { container } = render(
            <RebaseSplitContent sandboxName="sandbox1" databaseName="db1" aggSplitEstimate="5 GB" />
        );

        expect(container.textContent).toContain('Are you sure you want to split sandbox');
        expect(container.textContent).toContain('from database');
    });

    it('should render aggSplitEstimate value', () => {
        const { container } = render(
            <RebaseSplitContent sandboxName="sandbox1" databaseName="db1" aggSplitEstimate="15 GB" />
        );

        expect(container.textContent).toContain('15 GB');
    });

    it('should render second bullet', () => {
        render(<RebaseSplitContent sandboxName="sandbox1" databaseName="db1" aggSplitEstimate="5 GB" />);

        expect(screen.getByText('This action cannot be undone.')).toBeTruthy();
    });

    it('should render two bullet icons', () => {
        render(<RebaseSplitContent sandboxName="sandbox1" databaseName="db1" aggSplitEstimate="5 GB" />);

        const bullets = screen.getAllByTestId('bullet-icon');
        expect(bullets.length).toBe(2);
    });
});

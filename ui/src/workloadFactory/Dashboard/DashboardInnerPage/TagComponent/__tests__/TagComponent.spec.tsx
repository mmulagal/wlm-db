import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TagComponent from '../TagComponent';

vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, variant, style }: any) => (
        <span data-testid={`typography-${variant}`} style={style}>
            {children}
        </span>
    )
}));

const stableT = (key: string) => key;

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: stableT
    })
}));

vi.mock('../../../../../common/Tag/Tag', () => ({
    default: ({ text }: any) => <div data-testid="tag">{text}</div>
}));

vi.mock('../../../../../assets/tag.svg', () => ({
    ReactComponent: (props: any) => <svg data-testid="tag-image" {...props} />
}));

vi.mock('../../../../../assets/severity-icon.svg', () => ({
    ReactComponent: (props: any) => <svg data-testid="severity-icon" {...props} />
}));

vi.mock('../TagComponent.module.scss', () => ({
    default: {
        tagComponent: 'tagComponent',
        topSection: 'topSection',
        mainSection: 'mainSection',
        severitySection: 'severitySection',
        severity: 'severity',
        circle: 'circle',
        error: 'error',
        warning: 'warning'
    }
}));

describe('TagComponent', () => {
    describe('Basic rendering', () => {
        it('renders without crashing', () => {
            render(<TagComponent categories={['Cost optimization']} />);
            expect(screen.getAllByTestId('tag').length).toBeGreaterThan(0);
        });

        it('renders title typography', () => {
            render(<TagComponent categories={['Cost optimization']} />);
            expect(screen.getByText('databases.well-architect.tags.title')).toBeTruthy();
        });

        it('renders tag image svg', () => {
            render(<TagComponent categories={['Cost optimization']} />);
            expect(screen.getByTestId('tag-image')).toBeTruthy();
        });
    });

    describe('Categories from API', () => {
        it('renders single category from API', () => {
            render(<TagComponent categories={['Cost optimization']} />);
            expect(screen.getByText('Cost optimization')).toBeTruthy();
        });

        it('renders multiple categories from API', () => {
            render(
                <TagComponent categories={['Cost optimization', 'Operational excellence', 'Performance efficiency']} />
            );
            expect(screen.getByText('Cost optimization')).toBeTruthy();
            expect(screen.getByText('Operational excellence')).toBeTruthy();
            expect(screen.getByText('Performance efficiency')).toBeTruthy();
        });

        it('renders all five Well-Architected pillars', () => {
            render(
                <TagComponent
                    categories={[
                        'Cost optimization',
                        'Cost efficiency',
                        'Operational excellence',
                        'Performance efficiency',
                        'Reliability',
                        'Security'
                    ]}
                />
            );
            expect(screen.getByText('Cost optimization')).toBeTruthy();
            expect(screen.getByText('Cost efficiency')).toBeTruthy();
            expect(screen.getByText('Operational excellence')).toBeTruthy();
            expect(screen.getByText('Performance efficiency')).toBeTruthy();
            expect(screen.getByText('Reliability')).toBeTruthy();
            expect(screen.getByText('Security')).toBeTruthy();
        });

        it('renders no tags available when categories is empty array', () => {
            render(<TagComponent categories={[]} />);
            expect(screen.getByText('databases.well-architect.tags.noTagsAvailable')).toBeTruthy();
        });

        it('renders no tags available when categories is undefined', () => {
            render(<TagComponent />);
            expect(screen.getByText('databases.well-architect.tags.noTagsAvailable')).toBeTruthy();
        });
    });

    describe('Severity section', () => {
        it('renders severity section when severity is Critical', () => {
            render(<TagComponent categories={['Cost optimization']} severity="Critical" />);
            expect(screen.getByTestId('severity-icon')).toBeTruthy();
            expect(screen.getByText('Critical')).toBeTruthy();
        });

        it('renders severity section when severity is Warning', () => {
            render(<TagComponent categories={['Performance efficiency']} severity="Warning" />);
            expect(screen.getByText('Warning')).toBeTruthy();
        });

        it('does not render severity section when no severity', () => {
            render(<TagComponent categories={['Reliability']} />);
            expect(screen.queryByTestId('severity-icon')).toBeNull();
        });

        it('renders both categories and severity together', () => {
            render(<TagComponent categories={['Cost optimization', 'Operational excellence']} severity="Critical" />);
            expect(screen.getByText('Cost optimization')).toBeTruthy();
            expect(screen.getByText('Operational excellence')).toBeTruthy();
            expect(screen.getByText('Critical')).toBeTruthy();
        });
    });

    describe('Custom heights', () => {
        it('applies custom tagHeight', () => {
            const { container } = render(<TagComponent categories={['Security']} tagHeight="200px" />);
            const tagComponent = container.querySelector('.tagComponent') as HTMLElement;
            expect(tagComponent.style.height).toBe('200px');
        });

        it('defaults to auto height when not specified', () => {
            const { container } = render(<TagComponent categories={['Reliability']} />);
            const tagComponent = container.querySelector('.tagComponent') as HTMLElement;
            expect(tagComponent.style.height).toBe('auto');
        });
    });
});

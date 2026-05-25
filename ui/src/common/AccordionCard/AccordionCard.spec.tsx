import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { AccordionCard, AccordionController } from './AccordionCard';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('react-collapse', () => ({
    UnmountClosed: ({ children, isOpened }: any) => (isOpened ? <div>{children}</div> : null)
}));

vi.mock('@netapp/design-system', () => ({
    DsFlashingDotsLoader: () => <div>loading</div>,
    DsTypography: ({ children, ...props }: any) => <span>{children}</span>
}));

vi.mock('../TransitionChevron/TransitionChevron', () => ({
    TransitionChevron: (props: any) => <button data-testid="chevron" />
}));

describe('AccordionCard', () => {
    it('should be a defined component', () => {
        expect(AccordionCard).toBeDefined();
    });

    it('should render with required props', () => {
        const { container } = render(
            <AccordionController isGrouped={false}>
                <AccordionCard title="Section Heading">
                    <div>Accordion content</div>
                </AccordionCard>
            </AccordionController>
        );
        expect(container).toBeTruthy();
    });

    it('should render with disabled state', () => {
        const { container } = render(
            <AccordionController isGrouped={false}>
                <AccordionCard title="Heading" isDisabled>
                    <div>Content</div>
                </AccordionCard>
            </AccordionController>
        );
        expect(container).toBeTruthy();
    });

    it('renders static chevron instead of button when printState is true', () => {
        const { queryByTestId, container } = render(
            <AccordionController isGrouped={false}>
                <AccordionCard title="Heading" printState>
                    <div>Content</div>
                </AccordionCard>
            </AccordionController>
        );
        expect(queryByTestId('chevron')).toBeNull();
        expect(container.querySelector('svg')).toBeTruthy();
    });

    it('should render with value prop', () => {
        const { container } = render(
            <AccordionController isGrouped={false}>
                <AccordionCard title="Heading" value="Some value">
                    <div>Content</div>
                </AccordionCard>
            </AccordionController>
        );
        expect(container).toBeTruthy();
    });

    it('should render with isLoading', () => {
        const { container } = render(
            <AccordionController isGrouped={false}>
                <AccordionCard title="Heading" isLoading>
                    <div>Content</div>
                </AccordionCard>
            </AccordionController>
        );
        expect(container).toBeTruthy();
    });

    it('should render grouped', () => {
        const { container } = render(
            <AccordionController isGrouped>
                <AccordionCard title="Heading" className="custom-class">
                    <div>Content</div>
                </AccordionCard>
            </AccordionController>
        );
        expect(container).toBeTruthy();
    });

    it('should render without children', () => {
        const { container } = render(
            <AccordionController isGrouped={false}>
                <AccordionCard title="Heading" />
            </AccordionController>
        );
        expect(container).toBeTruthy();
    });
});

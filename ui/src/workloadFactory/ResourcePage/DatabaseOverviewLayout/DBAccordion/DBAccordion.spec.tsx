import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import DbAccordion from './DBAccordion';

vi.mock('@netapp/design-system', () => ({
    Typography: ({ children, variant, className }: any) => (
        <span data-testid="typography" data-variant={variant} className={className}>
            {children}
        </span>
    )
}));

vi.mock('../../../../assets/ic_add.svg', () => ({
    ReactComponent: () => <svg data-testid="add-icon" />
}));

vi.mock('../../../../assets/ic_remove.svg', () => ({
    ReactComponent: () => <svg data-testid="remove-icon" />
}));

vi.mock('./DBAccordion.module.scss', () => ({
    default: {
        dbAccordion: 'dbAccordion',
        disabledApplied: 'disabledApplied',
        accordionContainer: 'accordionContainer',
        addBorder: 'addBorder',
        accordionHeader: 'accordionHeader',
        firstLevel: 'firstLevel',
        accordionHeading: 'accordionHeading',
        rightMenu: 'rightMenu',
        contentBorder: 'contentBorder'
    }
}));

describe('DbAccordion', () => {
    const defaultProps = {
        heading: 'Test Heading',
        toggle: vi.fn(),
        open: false,
        content: <div data-testid="accordion-content">Content here</div>,
        resourceLoading: false
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the heading text', () => {
        render(<DbAccordion {...defaultProps} />);
        expect(screen.getByText('Test Heading')).toBeTruthy();
    });

    it('should show Add icon when accordion is closed', () => {
        render(<DbAccordion {...defaultProps} open={false} />);
        expect(screen.getByTestId('add-icon')).toBeTruthy();
        expect(screen.queryByTestId('remove-icon')).toBeNull();
    });

    it('should show Remove icon when accordion is open', () => {
        render(<DbAccordion {...defaultProps} open />);
        expect(screen.getByTestId('remove-icon')).toBeTruthy();
        expect(screen.queryByTestId('add-icon')).toBeNull();
    });

    it('should show content when accordion is open', () => {
        render(<DbAccordion {...defaultProps} open />);
        expect(screen.getByTestId('accordion-content')).toBeTruthy();
    });

    it('should NOT show content when accordion is closed', () => {
        render(<DbAccordion {...defaultProps} open={false} />);
        expect(screen.queryByTestId('accordion-content')).toBeNull();
    });

    it('should call toggle with heading when header is clicked', () => {
        const toggle = vi.fn();
        render(<DbAccordion {...defaultProps} toggle={toggle} heading="Clickable Heading" />);
        fireEvent.click(screen.getByText('Clickable Heading'));
        expect(toggle).toHaveBeenCalledWith('Clickable Heading');
    });

    it('should apply disabledApplied class when resourceLoading is true', () => {
        const { container } = render(<DbAccordion {...defaultProps} resourceLoading />);
        expect(container.querySelector('.disabledApplied')).toBeTruthy();
    });

    it('should NOT apply disabledApplied class when resourceLoading is false', () => {
        const { container } = render(<DbAccordion {...defaultProps} resourceLoading={false} />);
        expect(container.querySelector('.disabledApplied')).toBeNull();
    });

    it('should apply addBorder class when accordion is closed', () => {
        const { container } = render(<DbAccordion {...defaultProps} open={false} />);
        expect(container.querySelector('.addBorder')).toBeTruthy();
    });

    it('should NOT apply addBorder class when accordion is open', () => {
        const { container } = render(<DbAccordion {...defaultProps} open />);
        expect(container.querySelector('.addBorder')).toBeNull();
    });

    it('should render without resourceLoading prop (defaults)', () => {
        const { heading, toggle, open, content } = defaultProps;
        render(<DbAccordion heading={heading} toggle={toggle} open={open} content={content} />);
        expect(screen.getByText(heading)).toBeTruthy();
    });
});

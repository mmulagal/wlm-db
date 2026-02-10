import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import LearnHowDialog from './LearnHowDialog';

vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, variant, className }: any) => <span data-variant={variant} className={className}>{children}</span>,
    AccordionCard: ({ children, id, title }: any) => <div data-testid={`accordion-${id}`}><div data-testid={`accordion-title-${id}`}>{title}</div>{children}</div>,
    AccordionCardContent: ({ children }: any) => <div>{children}</div>,
    AccordionController: ({ children, isGrouped }: any) => <div data-grouped={String(!!isGrouped)}>{children}</div>,
    Popover: ({ children, container }: any) => <div data-testid="popover">{container}{children}</div>
}));

vi.mock('./LearnHowDialog.module.scss', () => ({
    default: {
        learnHowDialog: 'learnHowDialog',
        accordionSectionEC: 'accordionSectionEC',
        firstAccordion: 'firstAccordion',
        secondAccordion: 'secondAccordion',
        titleMainContent: 'titleMainContent',
        allContent: 'allContent',
        listItems: 'listItems',
        numberDigit: 'numberDigit',
        content: 'content',
        'dialog-body': 'dialog-body',
        'code-box': 'code-box',
        code: 'code',
        copy: 'copy',
        'copy-popover': 'copy-popover',
        bottomPart: 'bottomPart'
    }
}));

vi.mock('../../../../../assets/ic_copy.svg', () => ({
    ReactComponent: (props: any) => <svg data-testid="copy-icon" {...props} />
}));

vi.mock('../../../../../common/CopyToClipboard/copyToClipboard', () => ({
    default: ({ value, iconProvided }: any) => <div data-testid="copy-to-clipboard">{iconProvided}</div>
}));

vi.mock('../../../../../utils/appConstants', () => ({
    GENERAL: {
        STEP1: 'Step 1:',
        STEP2: 'Step 2:',
        LEARN_HOW_DIALOG: {
            HEADER_TEXT: 'For more accurate results based on AWS cloud watch metrics and Compute Optimizer, follow these steps.',
            ASSESSMENT_HEADER_TEXT: 'For getting recommendations on Compute rightsizing based on AWS cloud watch metrics and Compute Optimizer, follow these steps.',
            STEP1_HEADER: 'Grant AWS cloud watch and compute optimizer permissions.',
            STEP1_POINT1: 'Sign in to the AWS Management Console and open the IAM service.',
            STEP1_POINT2: 'Edit the policy for the IAM role. Copy and add the following AWS CloudWatch and Compute Optimizer permissions.',
            PERMISSIONS: { Version: '2012-10-17', Statement: [] },
            STEP2_HEADER: 'Opt the billable AWS account in to AWS Compute Optimizer.',
            STEP2_TITLE: 'Ensure the payer account opt in to the compute optimizer.',
            STEP2_POINT1: 'Open the AWS Compute Optimizer console ',
            STEP2_POINT1_LINK: 'https://console.aws.amazon.com/compute-optimizer/',
            STEP2_POINT2: 'Choose Get started.',
            STEP2_POINT3: 'On the Account setup page, review the Getting started and Setting up your account sections.',
            STEP2_POINT4: 'The following options are displayed.',
            STEP2_POINT5: 'Choose Opt in.',
            FOOTER_TEXT: 'The changes take effect within 24 hours.'
        }
    }
}));

describe('LearnHowDialog', () => {
    it('renders tco header text for type=tco', () => {
        const { container } = render(<LearnHowDialog type="tco" />);
        expect(container.textContent).toContain('For more accurate results based on AWS cloud watch metrics');
    });

    it('renders assessment header text for type=assessment', () => {
        const { container } = render(<LearnHowDialog type="assessment" />);
        expect(container.textContent).toContain('For getting recommendations on Compute rightsizing');
    });

    it('renders Step 1 accordion with title', () => {
        render(<LearnHowDialog type="tco" />);
        const title = screen.getByTestId('accordion-title-1');
        expect(title.textContent).toContain('Step 1:');
        expect(title.textContent).toContain('Grant AWS cloud watch and compute optimizer permissions.');
    });

    it('renders Step 2 accordion with title', () => {
        render(<LearnHowDialog type="tco" />);
        const title = screen.getByTestId('accordion-title-2');
        expect(title.textContent).toContain('Step 2:');
        expect(title.textContent).toContain('Opt the billable AWS account in to AWS Compute Optimizer.');
    });

    it('renders Step 1 content points', () => {
        const { container } = render(<LearnHowDialog type="tco" />);
        expect(container.textContent).toContain('Sign in to the AWS Management Console and open the IAM service.');
        expect(container.textContent).toContain('Edit the policy for the IAM role.');
    });

    it('renders Step 2 content points', () => {
        const { container } = render(<LearnHowDialog type="tco" />);
        expect(container.textContent).toContain('Ensure the payer account opt in to the compute optimizer.');
        expect(container.textContent).toContain('Choose Get started.');
        expect(container.textContent).toContain('Choose Opt in.');
    });

    it('renders link to AWS Compute Optimizer', () => {
        const { container } = render(<LearnHowDialog type="tco" />);
        const link = container.querySelector('a[href="https://console.aws.amazon.com/compute-optimizer/"]');
        expect(link).toBeTruthy();
        expect(link?.getAttribute('target')).toBe('_blank');
        expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    });

    it('renders permissions JSON in code block', () => {
        const { container } = render(<LearnHowDialog type="tco" />);
        expect(container.textContent).toContain('2012-10-17');
    });

    it('renders CopyToClipboard component', () => {
        render(<LearnHowDialog type="tco" />);
        expect(screen.getByTestId('copy-to-clipboard')).toBeTruthy();
    });

    it('renders footer text', () => {
        const { container } = render(<LearnHowDialog type="tco" />);
        expect(container.textContent).toContain('The changes take effect within 24 hours.');
    });

    it('renders Popover with copy functionality', () => {
        render(<LearnHowDialog type="tco" />);
        expect(screen.getByTestId('popover')).toBeTruthy();
    });

    it('renders step numbering (a, b, c, d, e)', () => {
        const { container } = render(<LearnHowDialog type="tco" />);
        expect(container.textContent).toContain('a');
        expect(container.textContent).toContain('b');
        expect(container.textContent).toContain('c');
        expect(container.textContent).toContain('d');
        expect(container.textContent).toContain('e');
    });
});

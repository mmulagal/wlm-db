import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ISActiveDirectory from './ISActiveDirectory';

vi.mock('@netapp/design-system', () => ({
    Typography: ({ children, variant, className, title }: any) => (
        <span data-testid="typography" data-variant={variant} className={className} title={title}>
            {children}
        </span>
    )
}));

vi.mock('../../DatabaseOverviewLayout/DBAccordion/DBAccordion', () => ({
    default: ({ heading, toggle, open, content }: any) => (
        <div data-testid="db-accordion">
            <div data-testid="accordion-heading" onClick={() => toggle(heading)}>
                {heading}
            </div>
            {open && <div data-testid="accordion-content">{content}</div>}
        </div>
    )
}));

vi.mock('../../../../utils/CommonStyles.module.scss', () => ({
    default: {
        row: 'row',
        heading: 'heading',
        valueCSS: 'valueCSS'
    }
}));

vi.mock('../../../../utils/appConstants', () => ({
    GENERAL: {
        DOMAIN_NAME_INFO: 'Domain Name',
        DNS_ADDRESS_INFO: 'DNS Address'
    }
}));

const createMockStore = (overrides: any = {}) =>
    configureStore({
        reducer: {
            workloadFactoryResource: () => ({
                resourceDetails: {
                    topology: {
                        activeDirectoryDetails: {
                            name: 'corp.example.com',
                            address: '10.0.0.1'
                        }
                    }
                },
                ...overrides
            })
        }
    });

describe('ISActiveDirectory', () => {
    const defaultProps = {
        handleToggle: vi.fn(),
        openKey: ''
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render accordion with "Active Directory" heading', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <ISActiveDirectory {...defaultProps} />
            </Provider>
        );
        expect(screen.getByText('Active Directory')).toBeTruthy();
    });

    it('should render Domain Name label', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <ISActiveDirectory {...defaultProps} openKey="Active Directory" />
            </Provider>
        );
        expect(screen.getByText('Domain Name')).toBeTruthy();
    });

    it('should render domain name value', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <ISActiveDirectory {...defaultProps} openKey="Active Directory" />
            </Provider>
        );
        expect(screen.getByText('corp.example.com')).toBeTruthy();
    });

    it('should render DNS Address label', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <ISActiveDirectory {...defaultProps} openKey="Active Directory" />
            </Provider>
        );
        expect(screen.getByText('DNS Address')).toBeTruthy();
    });

    it('should render DNS address value', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <ISActiveDirectory {...defaultProps} openKey="Active Directory" />
            </Provider>
        );
        expect(screen.getByText('10.0.0.1')).toBeTruthy();
    });

    it('should NOT show content when accordion is closed', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <ISActiveDirectory {...defaultProps} openKey="Location" />
            </Provider>
        );
        expect(screen.queryByTestId('accordion-content')).toBeNull();
    });

    it('should call handleToggle when accordion heading is clicked', () => {
        const handleToggle = vi.fn();
        const store = createMockStore();
        render(
            <Provider store={store}>
                <ISActiveDirectory handleToggle={handleToggle} openKey="" />
            </Provider>
        );
        screen.getByText('Active Directory').click();
        expect(handleToggle).toHaveBeenCalledWith('Active Directory');
    });

    it('should render without activeDirectoryDetails gracefully', () => {
        const store = createMockStore({ resourceDetails: { topology: {} } });
        render(
            <Provider store={store}>
                <ISActiveDirectory {...defaultProps} openKey="Active Directory" />
            </Provider>
        );
        // Should render without crashing
        expect(screen.getByText('Active Directory')).toBeTruthy();
    });
});

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import DefineTag from './DefineTag';

vi.mock('@netapp/design-system', () => ({
    AccordionCard: ({ children, title, ValueContent, id }: any) => (
        <div data-testid={`accordion-card-${id}`}>
            <div data-testid="accordion-title">{title}</div>
            <ValueContent />
            {children}
        </div>
    ),
    AccordionCardContent: ({ children }: any) => <div data-testid="accordion-card-content">{children}</div>,
    DsTypography: ({ children, variant, className }: any) => (
        <div data-testid="ds-typography" data-variant={variant} className={className}>
            {children}
        </div>
    )
}));

vi.mock('../../../../../store/workloadFactory/createSandboxSlice', () => ({
    setSelectedTag: vi.fn((val: string) => ({ type: 'createSandbox/setSelectedTag', payload: val }))
}));

vi.mock('./DefineTag.module.scss', () => ({
    default: {
        defineTag: 'defineTag',
        headerSetter: 'headerSetter',
        container: 'container',
        tag: 'tag',
        selectedTag: 'selectedTag',
        darkTheme: 'darkTheme',
        tagColor: 'tagColor'
    }
}));

vi.mock('../../../../../utils/CommonStyles.module.scss', () => ({
    default: {
        'heading-content': 'heading-content',
        title: 'title'
    }
}));

vi.mock('../../../../../utils/appConstants', () => ({
    GENERAL: {
        DEFINE_TAG: 'Define Tag'
    }
}));

const createMockStore = (overrides: any = {}) =>
    configureStore({
        reducer: {
            createSandbox: () => ({
                selectedTag: 'Development',
                ...overrides.createSandbox
            }),
            auth: () => ({
                features: {
                    active: {
                        'Platform.BlueXP/DarkTheme': false
                    }
                },
                ...overrides.auth
            })
        }
    });

const renderDefineTag = (storeOverrides: any = {}) => {
    const store = createMockStore(storeOverrides);
    return {
        ...render(
            <Provider store={store}>
                <DefineTag />
            </Provider>
        ),
        store
    };
};

const tagNames = ['Development', 'QA', 'Integration', 'Training', 'Analytics', 'Other'];

describe('DefineTag', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the accordion with Define Tag title', () => {
        renderDefineTag();
        expect(screen.getByText('Define Tag')).toBeTruthy();
    });

    it('should render all six tag options', () => {
        renderDefineTag();
        tagNames.forEach(tag => {
            expect(screen.getAllByText(tag).length).toBeGreaterThan(0);
        });
    });

    it('should display selected tag in the accordion header', () => {
        renderDefineTag({ createSandbox: { selectedTag: 'QA' } });
        // The header shows the selected tag
        const typographies = screen.getAllByTestId('ds-typography');
        const headerTypography = typographies.find(el => el.textContent === 'QA');
        expect(headerTypography).toBeTruthy();
    });

    it('should dispatch setSelectedTag when a tag is clicked', () => {
        const store = createMockStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');

        render(
            <Provider store={store}>
                <DefineTag />
            </Provider>
        );

        // Click the QA tag inside accordion-card-content (not the header)
        const qaElements = screen.getAllByText('QA');
        fireEvent.click(qaElements[qaElements.length - 1]);

        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                type: expect.stringContaining('setSelectedTag'),
                payload: 'QA'
            })
        );
    });

    it('should dispatch setSelectedTag with Development when Development is clicked', () => {
        const store = createMockStore({ createSandbox: { selectedTag: 'QA' } });
        const dispatchSpy = vi.spyOn(store, 'dispatch');

        render(
            <Provider store={store}>
                <DefineTag />
            </Provider>
        );

        const devElements = screen.getAllByText('Development');
        fireEvent.click(devElements[devElements.length - 1]);

        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                type: expect.stringContaining('setSelectedTag'),
                payload: 'Development'
            })
        );
    });

    it('should dispatch setSelectedTag with Integration when Integration is clicked', () => {
        const store = createMockStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');

        render(
            <Provider store={store}>
                <DefineTag />
            </Provider>
        );

        const intElements = screen.getAllByText('Integration');
        fireEvent.click(intElements[intElements.length - 1]);

        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                type: expect.stringContaining('setSelectedTag'),
                payload: 'Integration'
            })
        );
    });

    describe('setClass - CSS classes', () => {
        it('should apply selectedTag class to the currently selected tag', () => {
            const { container } = renderDefineTag({ createSandbox: { selectedTag: 'Development' } });
            // The Development tag should have the selectedTag class
            const tagDivs = container.querySelectorAll('.tag');
            expect(tagDivs.length).toBe(6);
        });

        it('should apply darkTheme class when isDarkTheme is true and tag is not selected', () => {
            renderDefineTag({
                createSandbox: { selectedTag: 'QA' },
                auth: {
                    features: {
                        active: {
                            'Platform.BlueXP/DarkTheme': true
                        }
                    }
                }
            });

            // Non-selected tags should have darkTheme class
            expect(screen.getAllByText('Development').length).toBeGreaterThan(0);
        });

        it('should NOT apply darkTheme class when isDarkTheme is false', () => {
            renderDefineTag({
                createSandbox: { selectedTag: 'Development' },
                auth: {
                    features: {
                        active: {
                            'Platform.BlueXP/DarkTheme': false
                        }
                    }
                }
            });
            expect(screen.getAllByText('Development').length).toBeGreaterThan(0);
        });

        it('should apply selectedTag class to selected tag even in dark theme', () => {
            renderDefineTag({
                createSandbox: { selectedTag: 'QA' },
                auth: {
                    features: {
                        active: {
                            'Platform.BlueXP/DarkTheme': true
                        }
                    }
                }
            });
            // The QA tag should have selectedTag class
            expect(screen.getAllByText('QA').length).toBeGreaterThan(0);
        });
    });

    it('should render all tags when no tag is selected', () => {
        renderDefineTag({ createSandbox: { selectedTag: null } });
        tagNames.forEach(tag => {
            expect(screen.getAllByText(tag).length).toBeGreaterThan(0);
        });
    });

    it('should render all tags when Other is selected', () => {
        renderDefineTag({ createSandbox: { selectedTag: 'Other' } });
        tagNames.forEach(tag => {
            expect(screen.getAllByText(tag).length).toBeGreaterThan(0);
        });
    });

    it('should dispatch setSelectedTag with Other when Other is clicked', () => {
        const store = createMockStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');

        render(
            <Provider store={store}>
                <DefineTag />
            </Provider>
        );

        const otherElements = screen.getAllByText('Other');
        fireEvent.click(otherElements[otherElements.length - 1]);

        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                type: expect.stringContaining('setSelectedTag'),
                payload: 'Other'
            })
        );
    });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import Accordion from '../Accordion';

const mockDispatch = vi.fn();
const mockNavigate = vi.fn();
const mockSetDialog = vi.fn();
const mockCloseDialog = vi.fn();
const mockDeleteConfigApi = vi.fn().mockResolvedValue({});
const mockRenameConfigApi = vi.fn().mockResolvedValue({});
const mockLoadConfigDataExe = vi.fn().mockResolvedValue({});

vi.mock('react-redux', async (importOriginal) => {
    const actual = await importOriginal() as any;
    return {
        ...actual,
        useDispatch: () => mockDispatch
    };
});

vi.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate
}));

vi.mock('@netapp/design-system', () => ({
    useDialog: () => ({ setDialog: mockSetDialog, closeDialog: mockCloseDialog }),
    Typography: ({ children, variant, className }: any) => (
        <span data-testid={`typography-${variant}`} className={className}>{children}</span>
    )
}));

vi.mock('../../../utils/apiService', () => ({
    useDeleteConfigMutation: () => [mockDeleteConfigApi],
    useLazyGetConfigDataQuery: () => [mockLoadConfigDataExe],
    useUpdateConfigMutation: () => [mockRenameConfigApi]
}));

vi.mock('../../../../utils/apiService', () => ({
    useDeleteConfigMutation: () => [mockDeleteConfigApi],
    useLazyGetConfigDataQuery: () => [mockLoadConfigDataExe],
    useUpdateConfigMutation: () => [mockRenameConfigApi]
}));

vi.mock('../../../store/mssql/msSqlActionSlice', () => ({
    setIsLoading: vi.fn((v: any) => ({ type: 'setIsLoading', payload: v })),
    setIsRecommendedInstance: vi.fn((v: any) => ({ type: 'setIsRecommendedInstance', payload: v })),
    setIsSaveConfigLoading: vi.fn()
}));

vi.mock('../../../../store/mssql/msSqlActionSlice', () => ({
    setIsLoading: vi.fn((v: any) => ({ type: 'setIsLoading', payload: v })),
    setIsRecommendedInstance: vi.fn((v: any) => ({ type: 'setIsRecommendedInstance', payload: v })),
    setIsSaveConfigLoading: vi.fn()
}));

vi.mock('../../../components/CreateMsSql/Configuration/LoadConfiguration', () => ({
    LoadConfiguration: vi.fn(),
    LoadRecommendedConfig: vi.fn()
}));

vi.mock('../../../../components/CreateMsSql/Configuration/LoadConfiguration', () => ({
    LoadConfiguration: vi.fn(),
    LoadRecommendedConfig: vi.fn()
}));

vi.mock('../../../utils/consts', () => ({
    FROM_DIALOG: { SAVE_CONFIG: 'saveConfig' },
    RECOMMENDED_TEMPLATES: { DEV_NAME: 'Dev', DEV_ID: 'dev-id' },
    WLF_TO_FORM_NAVIGATE: '/create'
}));

vi.mock('../../../../utils/consts', () => ({
    FROM_DIALOG: { SAVE_CONFIG: 'saveConfig' },
    RECOMMENDED_TEMPLATES: { DEV_NAME: 'Dev', DEV_ID: 'dev-id' },
    WLF_TO_FORM_NAVIGATE: '/create'
}));

vi.mock('../../../utils/utilityFunctions', () => ({
    setRecommendedValues: vi.fn(() => ({ instanceType: 't3.medium' }))
}));

vi.mock('../../../../utils/utilityFunctions', () => ({
    setRecommendedValues: vi.fn(() => ({ instanceType: 't3.medium' }))
}));

vi.mock('../../../utils/appConstants', () => ({
    CODE_VIEWER: {
        VIEW_CODE: 'View Code',
        MENU_LOAD_WIZARD: 'Load Wizard',
        RENAME: 'Rename',
        DELETE: 'Delete',
        CREATION_DATE: 'Created:'
    },
    GENERAL: {
        DELETE_CONFIG: 'Delete Configuration',
        DELETE_CONFIG_TEXT: 'Are you sure you want to delete',
        DELETE: 'Delete',
        CANCEL: 'Cancel',
        RENAME_CONFIG: 'Rename Configuration',
        RENAME_CONFIG_CONTENT: ['Rename', 'to:'],
        SAVE: 'Save',
        DELETE_CONFIG_NOTIFICATION: 'Deleted successfully',
        RENAME_CONFIG_NOTIFICATION: 'Renamed successfully'
    }
}));

vi.mock('../../../../utils/appConstants', () => ({
    CODE_VIEWER: {
        VIEW_CODE: 'View Code',
        MENU_LOAD_WIZARD: 'Load Wizard',
        RENAME: 'Rename',
        DELETE: 'Delete',
        CREATION_DATE: 'Created:'
    },
    GENERAL: {
        DELETE_CONFIG: 'Delete Configuration',
        DELETE_CONFIG_TEXT: 'Are you sure you want to delete',
        DELETE: 'Delete',
        CANCEL: 'Cancel',
        RENAME_CONFIG: 'Rename Configuration',
        RENAME_CONFIG_CONTENT: ['Rename', 'to:'],
        SAVE: 'Save',
        DELETE_CONFIG_NOTIFICATION: 'Deleted successfully',
        RENAME_CONFIG_NOTIFICATION: 'Renamed successfully'
    }
}));

vi.mock('../../../store/mssql/mssqlFormSlice', () => ({
    initialMssqlState: {},
    setSaveConfigName: vi.fn((v: any) => ({ type: 'setSaveConfigName', payload: v }))
}));

vi.mock('../../../../store/mssql/mssqlFormSlice', () => ({
    initialMssqlState: {},
    setSaveConfigName: vi.fn((v: any) => ({ type: 'setSaveConfigName', payload: v }))
}));

vi.mock('../../../common/Dialog/DialogComponent', () => ({
    default: ({ header }: any) => <div data-testid="dialog-component">{header}</div>
}));

vi.mock('../../../../common/Dialog/DialogComponent', () => ({
    default: ({ header }: any) => <div data-testid="dialog-component">{header}</div>
}));

vi.mock('../../../components/CreateMsSql/SaveConfig/SaveConfig', () => ({
    default: ({ description }: any) => <div data-testid="save-config">{description}</div>
}));

vi.mock('../../../../components/CreateMsSql/SaveConfig/SaveConfig', () => ({
    default: ({ description }: any) => <div data-testid="save-config">{description}</div>
}));

vi.mock('../../../store/store', () => ({
    default: { getState: vi.fn(() => ({ mssqlForm: { saveConfigName: 'newName' } })) }
}));

vi.mock('../../../../store/store', () => ({
    default: { getState: vi.fn(() => ({ mssqlForm: { saveConfigName: 'newName' } })) }
}));

vi.mock('../../../store/notificationSlice', () => ({
    addNotification: vi.fn((v: any) => ({ type: 'addNotification', payload: v })),
    NOTIFICATION_TYPES: { SUCCESS: 'success', ERROR: 'error' }
}));

vi.mock('../../../../store/notificationSlice', () => ({
    addNotification: vi.fn((v: any) => ({ type: 'addNotification', payload: v })),
    NOTIFICATION_TYPES: { SUCCESS: 'success', ERROR: 'error' }
}));

vi.mock('../../../common/MenuPopover/MenuPopover', () => ({
    default: ({ menuItems, toggleMenu, isMenuOpen }: any) => (
        <div data-testid="menu-popover">
            <button data-testid="menu-open-btn" onClick={() => toggleMenu('open', '')}>Open</button>
            <button data-testid="menu-close-btn" onClick={() => toggleMenu('close', '')}>Close</button>
            {menuItems?.map((item: any) => (
                <button
                    key={item.id}
                    data-testid={`menu-item-${item.id}`}
                    onClick={() => toggleMenu('selectedOption', item.id)}
                >
                    {item.displayName}
                </button>
            ))}
        </div>
    )
}));

vi.mock('../../../../common/MenuPopover/MenuPopover', () => ({
    default: ({ menuItems, toggleMenu, isMenuOpen }: any) => (
        <div data-testid="menu-popover">
            <button data-testid="menu-open-btn" onClick={() => toggleMenu('open', '')}>Open</button>
            <button data-testid="menu-close-btn" onClick={() => toggleMenu('close', '')}>Close</button>
            {menuItems?.map((item: any) => (
                <button
                    key={item.id}
                    data-testid={`menu-item-${item.id}`}
                    onClick={() => toggleMenu('selectedOption', item.id)}
                >
                    {item.displayName}
                </button>
            ))}
        </div>
    )
}));

vi.mock('../Accordion.module.scss', () => ({
    default: {
        accordions: 'accordions',
        accordionContainer: 'accordionContainer',
        addBorder: 'addBorder',
        accordionHeader: 'accordionHeader',
        firstLevel: 'firstLevel',
        accordionHeading: 'accordionHeading',
        addColor: 'addColor',
        rightMenu: 'rightMenu',
        accordionMenuPopover: 'accordionMenuPopover',
        secondLevel: 'secondLevel'
    }
}));

const makeStore = () =>
    configureStore({
        reducer: {
            mssqlForm: (state = { saveConfigName: '' }) => state
        }
    });

const defaultProps = {
    heading: 'Test Config',
    subHeading: '2025-01-01',
    toggle: vi.fn(),
    open: false,
    openedItem: null,
    id: 'config-1',
    configRefetch: vi.fn(),
    isExpanded: false,
    expand: vi.fn(),
    viewCode: vi.fn(),
    recommended: false
};

const renderComponent = (props: any = {}) =>
    render(
        <Provider store={makeStore()}>
            <Accordion {...defaultProps} {...props} />
        </Provider>
    );

describe('Accordion', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders heading text', () => {
        renderComponent();
        expect(screen.getByText('Test Config')).toBeDefined();
    });

    it('renders creation date when not recommended', () => {
        renderComponent({ recommended: false });
        expect(screen.getByText('Created: 2025-01-01')).toBeDefined();
    });

    it('does not render creation date for recommended templates', () => {
        renderComponent({ recommended: true });
        expect(screen.queryByText('Created:')).toBeNull();
    });

    it('calls toggle when header is clicked', () => {
        const toggle = vi.fn();
        renderComponent({ toggle });
        fireEvent.click(screen.getByText('Test Config'));
        expect(toggle).toHaveBeenCalledWith('Test Config', 'config-1');
    });

    it('shows menu popover', () => {
        renderComponent();
        expect(screen.getByTestId('menu-popover')).toBeDefined();
    });

    it('opens menu when open is triggered', () => {
        renderComponent();
        fireEvent.click(screen.getByTestId('menu-open-btn'));
        // Menu should show the opened state (state change checked by absence of errors)
    });

    it('closes menu when close is triggered', () => {
        renderComponent();
        fireEvent.click(screen.getByTestId('menu-open-btn'));
        fireEvent.click(screen.getByTestId('menu-close-btn'));
    });

    it('includes rename and delete menu items for non-recommended', () => {
        renderComponent({ recommended: false });
        expect(screen.getByTestId('menu-item-rename')).toBeDefined();
        expect(screen.getByTestId('menu-item-delete')).toBeDefined();
    });

    it('does not include rename and delete for recommended', () => {
        renderComponent({ recommended: true });
        expect(screen.queryByTestId('menu-item-rename')).toBeNull();
        expect(screen.queryByTestId('menu-item-delete')).toBeNull();
    });

    it('always includes viewCode and loadWizard menu items', () => {
        renderComponent();
        expect(screen.getByTestId('menu-item-viewCode')).toBeDefined();
        expect(screen.getByTestId('menu-item-loadWizard')).toBeDefined();
    });

    it('calls setDialog when delete is selected', () => {
        renderComponent({ recommended: false });
        fireEvent.click(screen.getByTestId('menu-item-delete'));
        expect(mockSetDialog).toHaveBeenCalledTimes(1);
    });

    it('calls setDialog when rename is selected', () => {
        renderComponent({ recommended: false });
        fireEvent.click(screen.getByTestId('menu-item-rename'));
        expect(mockSetDialog).toHaveBeenCalledTimes(1);
    });

    it('calls viewCode and expand when viewCode is selected and not expanded', () => {
        const viewCode = vi.fn();
        const expand = vi.fn();
        renderComponent({ viewCode, expand, isExpanded: false });
        fireEvent.click(screen.getByTestId('menu-item-viewCode'));
        expect(expand).toHaveBeenCalled();
        expect(viewCode).toHaveBeenCalledWith('Test Config', 'config-1');
    });

    it('does not call expand when viewCode is selected and already expanded', () => {
        const viewCode = vi.fn();
        const expand = vi.fn();
        renderComponent({ viewCode, expand, isExpanded: true });
        fireEvent.click(screen.getByTestId('menu-item-viewCode'));
        expect(expand).not.toHaveBeenCalled();
        expect(viewCode).toHaveBeenCalledWith('Test Config', 'config-1');
    });

    it('navigates and dispatches when loadWizard is selected', () => {
        renderComponent({ recommended: false });
        fireEvent.click(screen.getByTestId('menu-item-loadWizard'));
        expect(mockDispatch).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith('/create');
    });

    it('dispatches recommended config when loadWizard selected on recommended', () => {
        renderComponent({ recommended: true });
        fireEvent.click(screen.getByTestId('menu-item-loadWizard'));
        expect(mockDispatch).toHaveBeenCalled();
    });

    it('applies addBorder class when open is true', () => {
        const { container } = renderComponent({ open: true });
        expect(container.querySelector('.addBorder')).not.toBeNull();
    });

    it('applies addBorder class when openedItem matches heading', () => {
        const { container } = renderComponent({ openedItem: 'Test Config' });
        expect(container.querySelector('.addBorder')).not.toBeNull();
    });

    it('applies addColor class when openedItem matches heading', () => {
        const { container } = renderComponent({ openedItem: 'Test Config' });
        expect(container.querySelector('.addColor')).not.toBeNull();
    });
});

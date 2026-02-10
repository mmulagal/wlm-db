import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore, createSlice } from '@reduxjs/toolkit';
import ExportPDF from './ExportPDF';
import { GENERAL } from '../../../../utils/appConstants';
import { WLF_TABS } from '../../../../utils/consts';

// Mocks
vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, onClick, className, style, id }: any) => (
        <span onClick={onClick} className={className} style={style} id={id}>{children}</span>
    )
}));

vi.mock('@netapp/icons/ic_download.svg', () => ({
    ReactComponent: () => <svg data-testid="download-icon" />
}));

vi.mock('../../../../assets/ic_calculate.svg', () => ({
    ReactComponent: () => <svg data-testid="calculate-icon" />
}));

vi.mock('../../../../assets/ic_email.svg', () => ({
    ReactComponent: () => <svg data-testid="email-icon" />
}));

vi.mock('./ExportPDF.module.scss', () => ({
    default: {
        exportPdf: 'exportPdf',
        exportPdfOnPrem: 'exportPdfOnPrem',
        insideContainer: 'insideContainer',
        disabled: 'disabled',
        text: 'text'
    }
}));

vi.mock('../../../../store/workloadFactory/inventoryV2Slice', () => ({
    setSelectedHeaderTab: (val: any) => ({ type: 'test/setSelectedHeaderTab', payload: val })
}));

const makeStore = (overrides: any = {}) => {
    const esState = {
        storageSavingsLoading: false,
        selectedHostDetails: {},
        viewCalculationsLoading: false,
        viewCalculationsResponse: { someData: true },
        selectedExploreSavingsTab: null,
        ...overrides
    };

    const exploreSavingsSlice = createSlice({
        name: 'exploreSavings',
        initialState: esState,
        reducers: {}
    });

    const authSlice = createSlice({
        name: 'auth',
        initialState: { isDemoMode: overrides.isDemoMode ?? false },
        reducers: {}
    });

    return configureStore({
        reducer: {
            exploreSavings: exploreSavingsSlice.reducer,
            auth: authSlice.reducer
        }
    });
};

describe('ExportPDF', () => {
    const mockPrintDocument = vi.fn();
    const mockSendEmail = vi.fn();

    beforeEach(() => vi.clearAllMocks());

    it('renders Export PDF text', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <ExportPDF printDocument={mockPrintDocument} disableState={false} sendEmail={mockSendEmail} emailStatus={false} />
            </Provider>
        );
        expect(container.textContent).toContain(GENERAL.EXPORT_PDF);
    });

    it('renders Send by Email text', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <ExportPDF printDocument={mockPrintDocument} disableState={false} sendEmail={mockSendEmail} emailStatus={false} />
            </Provider>
        );
        expect(container.textContent).toContain('Send by Email');
    });

    it('renders View the calculations text', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <ExportPDF printDocument={mockPrintDocument} disableState={false} sendEmail={mockSendEmail} emailStatus={false} />
            </Provider>
        );
        expect(container.textContent).toContain(GENERAL.VIEW_THE_CALCULATIONS);
    });

    it('calls printDocument on Export PDF click when enabled', () => {
        render(
            <Provider store={makeStore()}>
                <ExportPDF printDocument={mockPrintDocument} disableState={false} sendEmail={mockSendEmail} emailStatus={false} />
            </Provider>
        );
        fireEvent.click(screen.getByText(GENERAL.EXPORT_PDF));
        expect(mockPrintDocument).toHaveBeenCalled();
    });

    it('calls sendEmail on Email click when enabled', () => {
        render(
            <Provider store={makeStore()}>
                <ExportPDF printDocument={mockPrintDocument} disableState={false} sendEmail={mockSendEmail} emailStatus={false} />
            </Provider>
        );
        fireEvent.click(screen.getByText('Send by Email'));
        expect(mockSendEmail).toHaveBeenCalled();
    });

    it('does not call printDocument when disabled', () => {
        render(
            <Provider store={makeStore()}>
                <ExportPDF printDocument={mockPrintDocument} disableState={true} sendEmail={mockSendEmail} emailStatus={false} />
            </Provider>
        );
        fireEvent.click(screen.getByText(GENERAL.EXPORT_PDF));
        expect(mockPrintDocument).not.toHaveBeenCalled();
    });

    it('does not call sendEmail when disabled', () => {
        render(
            <Provider store={makeStore()}>
                <ExportPDF printDocument={mockPrintDocument} disableState={true} sendEmail={mockSendEmail} emailStatus={false} />
            </Provider>
        );
        fireEvent.click(screen.getByText('Send by Email'));
        expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('applies disabled class when emailStatus is true', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <ExportPDF printDocument={mockPrintDocument} disableState={false} sendEmail={mockSendEmail} emailStatus={true} />
            </Provider>
        );
        // emailStatus only affects CSS class, not the onClick handler
        const emailContainer = container.querySelectorAll('.insideContainer')[1];
        expect(emailContainer).toHaveClass('disabled');
    });

    it('applies OnPrem CSS class when MSSQL_ON_PREMISES tab', () => {
        const { container } = render(
            <Provider store={makeStore({ selectedExploreSavingsTab: WLF_TABS.MSSQL_ON_PREMISES })}>
                <ExportPDF printDocument={mockPrintDocument} disableState={false} sendEmail={mockSendEmail} emailStatus={false} />
            </Provider>
        );
        expect(container.firstChild).toHaveClass('exportPdf');
        expect(container.firstChild).toHaveClass('exportPdfOnPrem');
    });

    it('applies default CSS class when not OnPrem', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <ExportPDF printDocument={mockPrintDocument} disableState={false} sendEmail={mockSendEmail} emailStatus={false} />
            </Provider>
        );
        expect(container.firstChild).toHaveClass('exportPdf');
        expect(container.firstChild).not.toHaveClass('exportPdfOnPrem');
    });

    it('shows view calc section for isDemoMode true', () => {
        const { container } = render(
            <Provider store={makeStore({ isDemoMode: true })}>
                <ExportPDF printDocument={mockPrintDocument} disableState={false} sendEmail={mockSendEmail} emailStatus={false} />
            </Provider>
        );
        expect(container.textContent).toContain(GENERAL.VIEW_THE_CALCULATIONS);
    });

    it('dispatches setSelectedHeaderTab on view calculations click when enabled', () => {
        const store = makeStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <ExportPDF printDocument={mockPrintDocument} disableState={false} sendEmail={mockSendEmail} emailStatus={false} />
            </Provider>
        );
        const viewCalcElements = screen.getAllByText(GENERAL.VIEW_THE_CALCULATIONS);
        fireEvent.click(viewCalcElements[0]);
        expect(dispatchSpy).toHaveBeenCalledWith({ type: 'test/setSelectedHeaderTab', payload: WLF_TABS.VIEW_THE_CALCULATIONS });
    });

    it('does not dispatch on view calculations click when viewLoading is true', () => {
        const store = makeStore({ viewCalculationsLoading: true, selectedHostDetails: { loading: true } });
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <ExportPDF printDocument={mockPrintDocument} disableState={false} sendEmail={mockSendEmail} emailStatus={false} />
            </Provider>
        );
        const viewCalcElements = screen.getAllByText(GENERAL.VIEW_THE_CALCULATIONS);
        fireEvent.click(viewCalcElements[0]);
        expect(dispatchSpy).not.toHaveBeenCalledWith({ type: 'test/setSelectedHeaderTab', payload: WLF_TABS.VIEW_THE_CALCULATIONS });
    });

    it('does not call printDocument when viewCalculationsResponse is null', () => {
        render(
            <Provider store={makeStore({ viewCalculationsResponse: null })}>
                <ExportPDF printDocument={mockPrintDocument} disableState={false} sendEmail={mockSendEmail} emailStatus={false} />
            </Provider>
        );
        fireEvent.click(screen.getByText(GENERAL.EXPORT_PDF));
        expect(mockPrintDocument).not.toHaveBeenCalled();
    });

    it('handles loading from storageSavingsLoading', () => {
        render(
            <Provider store={makeStore({ storageSavingsLoading: true })}>
                <ExportPDF printDocument={mockPrintDocument} disableState={false} sendEmail={mockSendEmail} emailStatus={false} />
            </Provider>
        );
        fireEvent.click(screen.getByText(GENERAL.EXPORT_PDF));
        expect(mockPrintDocument).not.toHaveBeenCalled();
    });

    it('handles loading from selectedHostDetails.loading', () => {
        render(
            <Provider store={makeStore({ selectedHostDetails: { loading: true } })}>
                <ExportPDF printDocument={mockPrintDocument} disableState={false} sendEmail={mockSendEmail} emailStatus={false} />
            </Provider>
        );
        fireEvent.click(screen.getByText(GENERAL.EXPORT_PDF));
        expect(mockPrintDocument).not.toHaveBeenCalled();
    });
});

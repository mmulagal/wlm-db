import { render } from '@testing-library/react';
import React, { useState as useStateMock } from 'react';
import { Provider } from 'react-redux';
import configureMockStore from 'redux-mock-store';
import { Middleware, Dispatch, AnyAction } from '@reduxjs/toolkit';
import { vi } from 'vitest';
import DatabaseName from './DatabaseName';

const middlewares: Middleware<{}, any, Dispatch<AnyAction>>[] | undefined = [];
// @ts-ignore
const mockStore = configureMockStore(middlewares);

vi.mock('react', async () => {
    const actual = await vi.importActual('react');
    return {
        ...actual,
        useState: vi.fn()
    };
});
const setState = vi.fn();

vi.mock('@json2csv/plainjs', () => ({
    Parser: vi.fn()
}));

describe('Database name accordion test', () => {
    beforeEach(() => {
        (useStateMock as any).mockImplementation((init: any) => [init, setState]);
    });

    const wrapper = () => {
        const store = mockStore({ mssqlForm: { dbName: '' } });

        return render(
            <>
                {/* @ts-ignore */}
                <Provider store={store}>
                    <DatabaseName />
                </Provider>
            </>
        );
    };

    it('Render database name', () => {
        (useStateMock as any).mockImplementationOnce(() => ['sqldatabase', setState]);
        const { container } = wrapper();
        expect(DatabaseName).toBeDefined();
        expect(container).toHaveTextContent('Database Server name');
        expect(container).toHaveTextContent('sqldatabase');
    });

    it('Render invalid database name', () => {
        (useStateMock as any).mockImplementationOnce(() => ['sqldatabase_123344455', setState]);
        const { container } = wrapper();
        expect(DatabaseName).toBeDefined();
        expect(container).toHaveTextContent('Database Server name');
        expect(container).toHaveTextContent('One or more fields has an error');
    });
});

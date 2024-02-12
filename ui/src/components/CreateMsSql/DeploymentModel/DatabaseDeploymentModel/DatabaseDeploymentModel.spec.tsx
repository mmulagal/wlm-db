import { render } from '@testing-library/react';
import DatabaseDeploymentModel from './DatabaseDeploymentModel';
import { Provider } from 'react-redux';
import configureMockStore from 'redux-mock-store';
import { Middleware, Dispatch, AnyAction } from '@reduxjs/toolkit';

const middlewares: Middleware<{}, any, Dispatch<AnyAction>>[] | undefined = [];
//@ts-ignore
const mockStore = configureMockStore(middlewares);

jest.mock('@json2csv/plainjs', () => {
    return {
        Parser: jest.fn()
    };
});

describe('Database Deployment Model accordion test', () => {
    const wrapper = () => {
        const store = mockStore({ mssqlForm: {dbDeploymentModel: {label: 'Failover cluster instance (FCI)'}} });

        return render(
            <>
                {/* @ts-ignore */}
                <Provider store={store}>
                    <DatabaseDeploymentModel />
                </Provider>
            </>
        );
    };

    it('Render Database Deployment Model', () => {
        const { container } = wrapper();
        expect(DatabaseDeploymentModel).toBeDefined();
        expect(container).toHaveTextContent('Database deployment model');
        expect(container).toHaveTextContent('Failover cluster instance (FCI)');
    });
});

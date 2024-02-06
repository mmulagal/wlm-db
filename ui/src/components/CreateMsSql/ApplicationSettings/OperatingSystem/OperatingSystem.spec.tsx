import { render } from '@testing-library/react';
import OperatingSystem from '../OperatingSystem/OperatingSystem';
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

describe('Operating System accordion test', () => {
    const wrapper = () => {
        const store = mockStore({ mssqlForm: { operatingSystem: { label: 'Windows server 2016', value: '2016' } } });

        return render(
            <>
                {/* @ts-ignore */}
                <Provider store={store}>
                    <OperatingSystem />
                </Provider>
            </>
        );
    };

    it('Render data', () => {
        const { container } = wrapper();
        expect(OperatingSystem).toBeDefined();
        expect(container).toHaveTextContent('Windows server 2016');
    });
});

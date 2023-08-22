import { prettyDOM, render } from '@testing-library/react';
import OperatingSystem from '../OperatingSystem/OperatingSystem';
import { Provider } from 'react-redux';
import configureMockStore from 'redux-mock-store';
import { Middleware, Dispatch, AnyAction } from '@reduxjs/toolkit';

const middlewares: Middleware<{}, any, Dispatch<AnyAction>>[] | undefined = [];
const mockStore = configureMockStore(middlewares);

jest.mock('@json2csv/plainjs', () => {
    return {
        Parser: jest.fn(),
    }
});


describe('Operating System test', () => {

    const wrapper = () =>{
        const store = mockStore({ mssqlForm: {operatingSystem: {label:"Windows server 2016", value:"2016"}} });
        
        return render(
            <>
            <Provider store={store}>
                <OperatingSystem />
            </Provider>  
            </>
        );
    }

    it('Render data', () => {
        const { container } = wrapper();
        console.log(prettyDOM(container));
        // expect(OperatingSystem).toBeDefined();
        // expect(container).toHaveTextContent('something');
        // expect(container).toHaveClass('first');
        // const radioButton = screen.getByRole('radio');
        // expect(radioButton).toBeInTheDocument();

        // eslint-disable-next-line testing-library/prefer-screen-queries
        // const radioButton1 = screen.getByTestId('2019');
        // fireEvent.click(radioButton1);
        // const radioButton1 = screen.getByText('Windows server 2016');

        // Select the first radio button
        // fireEvent.click(radioButton1);
    });
})
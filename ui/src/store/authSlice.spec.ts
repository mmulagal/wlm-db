import authSlice, { updateAuthSuccess } from './authSlice'; // Update the import path based on your project structure

describe('authSlice reducers', () => {
    let initialState: {
        accountId: string;
        accessToken: string;
        resourceId: '';
        resourceName: '';
        workspaceId: string;
        pathname: string;
        features: {};
        isWorkloadFactory: boolean;
        isInventoryV2: boolean;
    };

    beforeEach(() => {
        initialState = {
            accountId: '',
            accessToken: '',
            resourceId: '',
            resourceName: '',
            workspaceId: '',
            pathname: '',
            features: {},
            isWorkloadFactory: false,
            isInventoryV2: false
        };
    });

    it('should handle updateAuthSuccess', () => {
        const accessToken = 'sample-access-token';
        const action = updateAuthSuccess({ accessToken });

        const newState = authSlice.reducer(initialState, action);
        expect(newState.accessToken).toEqual(`Bearer ${accessToken}`);
    });

    it('should return initial state for unknown action', () => {
        const unknownAction = { type: 'auth/unknownAction' };

        const newState = authSlice.reducer(initialState, unknownAction);

        expect(newState).toEqual(initialState);
    });
});

import authSlice, { updateAuthSuccess, updateAuthFailed } from './authSlice'; // Update the import path based on your project structure
import { AUTH_STATUS } from '../utils/consts';

describe('authSlice reducers', () => {
    let initialState: { status: string; error: string; accessToken: string; resourceId: '', resourceName: '' };

    beforeEach(() => {
        initialState = {
            status: AUTH_STATUS.AUTH_STATUS_PROGRESS,
            error: '',
            accessToken: '',
            resourceId: '',
            resourceName: ''
        };
    });

    it('should handle updateAuthSuccess', () => {
        const accessToken = 'sample-access-token';
        const action = updateAuthSuccess({ accessToken });

        const newState = authSlice.reducer(initialState, action);

        expect(newState.status).toEqual(AUTH_STATUS.AUTH_STATUS_SUCCESS);
        expect(newState.accessToken).toEqual(`Bearer ${accessToken}`);
        expect(newState.error).toEqual('');
    });

    it('should handle updateAuthFailed', () => {
        const error = 'Sample error message';
        const action = updateAuthFailed(error);

        const newState = authSlice.reducer(initialState, action);

        expect(newState.status).toEqual(AUTH_STATUS.AUTH_STATUS_ERROR);
        expect(newState.error).toEqual(error);
        expect(newState.accessToken).toEqual('');
    });

    it('should return initial state for unknown action', () => {
        const unknownAction = { type: 'auth/unknownAction' };

        const newState = authSlice.reducer(initialState, unknownAction);

        expect(newState).toEqual(initialState);
    });
});

import { createStore } from '@reduxjs/toolkit';
import getWellOptimizeSlice, {
    addAssessmentInProgressKey,
    removeAssessmentInProgressKey,
    resetGwData,
    setGwPageLoadInstanceData
} from './getWellOptimizeSlice';

describe('getWellOptimizeSlice', () => {
    let store: any;

    beforeEach(() => {
        store = createStore(getWellOptimizeSlice.reducer);
    });

    test('adds and removes an instance key from assessmentInProgressKeys', () => {
        expect(store.getState().assessmentInProgressKeys).toEqual([]);

        store.dispatch(addAssessmentInProgressKey('instance-A'));
        expect(store.getState().assessmentInProgressKeys).toEqual(['instance-A']);

        // Adding the same key twice does not duplicate it.
        store.dispatch(addAssessmentInProgressKey('instance-A'));
        expect(store.getState().assessmentInProgressKeys).toEqual(['instance-A']);

        store.dispatch(removeAssessmentInProgressKey('instance-A'));
        expect(store.getState().assessmentInProgressKeys).toEqual([]);
    });

    test('tracks multiple in-progress instances independently', () => {
        store.dispatch(addAssessmentInProgressKey('instance-A'));
        store.dispatch(addAssessmentInProgressKey('instance-B'));
        expect(store.getState().assessmentInProgressKeys).toEqual(['instance-A', 'instance-B']);

        store.dispatch(removeAssessmentInProgressKey('instance-A'));
        expect(store.getState().assessmentInProgressKeys).toEqual(['instance-B']);
    });

    test('resetGwData and setGwPageLoadInstanceData do not wipe out in-progress keys of other instances', () => {
        // Navigating between instances (reset/page-load) must not forget an assessment that is
        // still running elsewhere - otherwise returning to that instance would incorrectly show
        // "not loading" for an assessment that hasn't finished yet.
        store.dispatch(addAssessmentInProgressKey('instance-A'));

        store.dispatch(resetGwData(undefined));
        expect(store.getState().assessmentInProgressKeys).toEqual(['instance-A']);

        store.dispatch(setGwPageLoadInstanceData({}));
        expect(store.getState().assessmentInProgressKeys).toEqual(['instance-A']);
    });
});

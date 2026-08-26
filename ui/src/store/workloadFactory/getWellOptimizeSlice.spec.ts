import { createStore } from '@reduxjs/toolkit';
import getWellOptimizeSlice, {
    resetGwData,
    setGwPageLoadInstanceData,
    setTriggerAssessmentInProgress
} from './getWellOptimizeSlice';

describe('getWellOptimizeSlice', () => {
    let store: any;

    beforeEach(() => {
        store = createStore(getWellOptimizeSlice.reducer);
    });

    test('should set triggerAssessmentInProgress correctly', () => {
        expect(store.getState().triggerAssessmentInProgress).toEqual(false);

        store.dispatch(setTriggerAssessmentInProgress(true));
        expect(store.getState().triggerAssessmentInProgress).toEqual(true);

        store.dispatch(setTriggerAssessmentInProgress(false));
        expect(store.getState().triggerAssessmentInProgress).toEqual(false);
    });

    test('should clear triggerAssessmentInProgress when resetting or switching instance', () => {
        store.dispatch(setTriggerAssessmentInProgress(true));

        store.dispatch(resetGwData(undefined));
        expect(store.getState().triggerAssessmentInProgress).toEqual(false);

        store.dispatch(setTriggerAssessmentInProgress(true));
        store.dispatch(setGwPageLoadInstanceData({}));
        expect(store.getState().triggerAssessmentInProgress).toEqual(false);
    });
});

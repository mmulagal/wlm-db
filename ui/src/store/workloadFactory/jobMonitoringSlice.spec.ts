import { createStore } from '@reduxjs/toolkit';
import jobMonitoringSlice, {
    setJobsList,
    setJobsListLoading,
    setTimeInterval,
    setFromTime,
    setToTime,
    setDownloadJobsLoading,
    setDownloadJobsList,
    setJmJobsSummaryLoading,
    setJmJobsSummary,
    setJobsSummaryTimelineLoading,
    setJobsSummaryTimeline,
    setSubJobsData,
    setSubJobsDataLoading,
    addInitialJMData
} from './jobMonitoringSlice'; // Update this with the correct file path

describe('msSqlActionSlice', () => {
    let store: any;

    beforeEach(() => {
        store = createStore(jobMonitoringSlice.reducer);
    });

    test('should set jobsListLoading correctly', () => {
        store.dispatch(setJobsListLoading(true));
        expect(store.getState().jobsListLoading).toEqual(true);

        store.dispatch(setJobsListLoading(false));
        expect(store.getState().jobsListLoading).toEqual(false);
    });

    test('should set jobsList correctly', () => {
        store.dispatch(setJobsList([1]));
        expect(store.getState().jobsList).toEqual([1]);
    });

    test('should set timeInterval correctly', () => {
        store.dispatch(setTimeInterval(1));
        expect(store.getState().timeInterval).toEqual(1);
    });

    test('should set setFromTime correctly', () => {
        store.dispatch(setFromTime(112233));
        expect(store.getState().fromTime).toEqual(112233);
    });

    test('should set toTime correctly', () => {
        store.dispatch(setToTime(112233));
        expect(store.getState().toTime).toEqual(112233);
    });

    test('should set downloadJobsLoading correctly', () => {
        store.dispatch(setDownloadJobsLoading(true));
        expect(store.getState().downloadJobsLoading).toEqual(true);
    });

    test('should set downloadJobsList correctly', () => {
        store.dispatch(setDownloadJobsList([123]));
        expect(store.getState().downloadJobsList).toEqual([123]);
    });

    test('should set setJmJobsSummaryLoading correctly', () => {
        store.dispatch(setJmJobsSummaryLoading(false));
        expect(store.getState().jmJobsSummaryLoading).toEqual(false);
    });

    test('should set setJmJobsSummary correctly', () => {
        store.dispatch(setJmJobsSummary({}));
        expect(store.getState().jmJobsSummary).toEqual({});
    });

    test('should set setJobsSummaryTimelineLoading correctly', () => {
        store.dispatch(setJobsSummaryTimelineLoading(true));
        expect(store.getState().jobsSummaryTimelineLoading).toEqual(true);
    });

    test('should set setJobsSummaryTimeline correctly', () => {
        store.dispatch(setJobsSummaryTimeline({ data: 'val' }));
        expect(store.getState().jobsSummaryTimeline).toEqual({ data: 'val' });
    });

    test('should set setSubJobsData correctly', () => {
        store.dispatch(setSubJobsData({ data: 'value' }));
        expect(store.getState().subJobsData).toEqual({ data: 'value' });
    });

    test('should set setSubJobsDataLoading correctly', () => {
        store.dispatch(setSubJobsDataLoading(true));
        expect(store.getState().subJobsDataLoading).toEqual(true);
    });
});

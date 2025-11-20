import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../../store/storeHooks';
import { DBType, WELL_ARCHITECTED_TABS, WLF_TABS } from '../../../../utils/consts';
import { useGetErrorInvestigationDataMutation, useGetInvestigationDatesMutation } from '../../../../utils/apiService';
import { setLandingFromInnerPage } from '../../../../store/workloadFactory/getWellOptimizeSlice';
import {
    setEiRefreshPage,
    setEiRefreshTimestamp,
    setErrorInvestigationData,
    setErrorInvestigationLoading,
    setInvestigationDateData,
    setInvestigationDatesLoading,
    setNoErrorsDetected,
    setNoLogAnalyzerData
} from '../../../../store/workloadFactory/agenticAISlice';
import { getCurrentDateTime, sortListOfDict } from '../../../../utils/utilityFunctions';

const ErrorInvestigationApi = ({ dbType }: { dbType: string }) => {
    const dispatch = useDispatch();
    const { credIdFromJM, regionFromJM, landingFrom, landingFromInnerPage } = useAppSelector(
        state => state.getWellOptimize
    );

    const { selectedInvestigationDate, eiRefreshPage } = useAppSelector(state => state.agenticAI);

    const {
        selectedResourceId,
        selectedDatabaseInstance,
        selectedGwInstanceCredId,
        selectedGwInstanceRegionId,
        visitedTabs
    } = useAppSelector(state => state.getWellOptimize);

    const { visitedTabs: oracleVisitedTabs } = useAppSelector(state => state.oracleSlice);

    const [errorInvestigationDatesApi] = useGetInvestigationDatesMutation();
    const [errorInvestigationGetApi] = useGetErrorInvestigationDataMutation();

    const runErrorInvestigationApi = async () => {
        try {
            dispatch(setErrorInvestigationLoading(true));
            type ErrorInvestigationPayload = {
                credentialId: string;
                regionId: string;
                databaseHostId: string;
                instanceId: string;
                id?: string;
                dbType?: string;
            };

            let payload: ErrorInvestigationPayload = {
                credentialId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM,
                regionId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM,
                databaseHostId: selectedResourceId,
                instanceId: selectedDatabaseInstance,
                dbType
            };
            if (selectedInvestigationDate) {
                payload = {
                    ...payload,
                    id: selectedInvestigationDate?.id
                };
            }
            const result: { data?: any; error?: any } = await errorInvestigationGetApi(payload);
            if (result && !result?.error && result?.data) {
                dispatch(setErrorInvestigationData(result.data?.remediationRecommendation));
                if (result.data?.remediationRecommendation && result.data?.remediationRecommendation?.length === 0) {
                    dispatch(setNoErrorsDetected(true));
                } else {
                    dispatch(setNoErrorsDetected(false));
                }
                dispatch(setNoLogAnalyzerData(false));
            } else {
                dispatch(setErrorInvestigationData([]));
                dispatch(setNoLogAnalyzerData(true));
                dispatch(setNoErrorsDetected(false));
            }
        } catch (error) {
            dispatch(setNoLogAnalyzerData(true));
            dispatch(setNoErrorsDetected(false));
        } finally {
            dispatch(setErrorInvestigationLoading(false));
        }
    };

    const runInvestigationDatesApi = async () => {
        dispatch(setEiRefreshTimestamp(getCurrentDateTime()));
        try {
            dispatch(setInvestigationDatesLoading(true));
            const result: { data?: any; error?: any } = await errorInvestigationDatesApi({
                credentialId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM,
                regionId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM,
                databaseHostId: selectedResourceId,
                instanceId: selectedDatabaseInstance,
                dbType
            });
            if (result && !result?.error && result?.data?.reports && result.data.reports.length > 0) {
                const reportsList = sortListOfDict(result.data.reports, 'creationTime', false); // false means it will sort in desc order
                dispatch(setInvestigationDateData(reportsList));
                dispatch(setNoLogAnalyzerData(false));
            } else {
                if (result?.data?.reports && result.data.reports.length === 0) {
                    runErrorInvestigationApi();
                } else {
                    dispatch(setNoLogAnalyzerData(true));
                }
                dispatch(setInvestigationDateData([]));
            }
        } catch (error) {
            dispatch(setNoLogAnalyzerData(true));
        } finally {
            dispatch(setInvestigationDatesLoading(false));
        }
    };

    const viewLogAction = async () => {
        dispatch(setNoErrorsDetected(false));
        dispatch(setNoLogAnalyzerData(false));
        // Set the loading state to true
        dispatch(setInvestigationDatesLoading(true));
        setTimeout(() => {
            // Call the API to get the investigation dates
            runInvestigationDatesApi();
        }, 10);
    };

    useEffect(() => {
        // On page refresh, call the API to get the investigation data details
        if (eiRefreshPage) {
            viewLogAction();
            dispatch(setEiRefreshPage(false));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [eiRefreshPage]);

    useEffect(() => {
        // On page load, call the API to get the error investigation details
        let visitedCheck = null;
        if (dbType === DBType.ORACLE) {
            visitedCheck = oracleVisitedTabs;
        } else {
            visitedCheck = visitedTabs;
        }
        if (!landingFromInnerPage && !visitedCheck[WELL_ARCHITECTED_TABS.ERROR_INVESTIGATION]) {
            viewLogAction();
        } else {
            dispatch(setLandingFromInnerPage(false));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        // Call the API to get the error investigation details
        if (selectedInvestigationDate && selectedResourceId && selectedDatabaseInstance) {
            runErrorInvestigationApi();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedInvestigationDate]);
};

export default ErrorInvestigationApi;

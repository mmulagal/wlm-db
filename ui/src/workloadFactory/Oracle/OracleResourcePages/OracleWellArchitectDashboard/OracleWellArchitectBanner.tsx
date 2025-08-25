import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Button } from '@netapp/design-system';

import { useAppSelector } from '../../../../store/storeHooks';

import { setGwAdhocError, setIsInnerPageOptimize } from '../../../../store/workloadFactory/getWellOptimizeSlice';
import { setRefreshOracleWellArchitect } from '../../../../store/workloadFactory/oracleSlice';
import { GENERAL } from '../../../../utils/appConstants';
import { useLazyGetSubTaskListQuery, useTriggerOracleInstanceAssessmentMutation } from '../../../../utils/apiService';
import AssessmentContainer from '../../../../common/AssessmentContainer/AssessmentContainer';
import { handleTriggerAssessment, useWellArchitectRefresh } from '../../../../utils/resourceUtils';
import { resetGwValuesOnRefresh } from '../../../GetWell/GetWellUtils';

const OracleWellArchitectBanner = () => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const { isWorkloadFactory } = useAppSelector(state => state?.auth);
    const { selectedResourceId, selectedDatabaseInstance, selectedResourceCredId, selectedResourceRegionId } =
        useAppSelector(state => state.workloadFactoryResource);
    const { isInnerPageOptimize, gwTimestamp, gwAdhocError, optimizePageLoading } = useAppSelector(
        state => state.getWellOptimize
    );
    const [triggerAssessmentInProgress, setTriggerAssessmentInProgress] = useState(false);

    const [triggerAssessmentApi] = useTriggerOracleInstanceAssessmentMutation();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();

    // Oracle-specific refresh function using common utility hook
    const refreshOracleWellArchitectPage = useWellArchitectRefresh({
        dispatch,
        resetGwValuesOnRefresh,
        setGwRefreshPage: setRefreshOracleWellArchitect
    });

    useEffect(() => {
        dispatch(setGwAdhocError(''));
    }, []);

    const createNotificationMessage = (handleJobMonitoringClick: () => void) => (
        <div>
            {t('databases.well-architect.assessment-track-in-progress')}{' '}
            <Button Component="button" variant="text" onClick={handleJobMonitoringClick}>
                {GENERAL.JOB_MONITORING}.
            </Button>
        </div>
    );

    const triggerAssessmentHandler = () => {
        handleTriggerAssessment({
            setTriggerAssessmentInProgress,
            triggerAssessmentApi,
            credentialId: selectedResourceCredId,
            regionId: selectedResourceRegionId,
            selectedResourceId,
            selectedDatabaseInstance,
            dispatch,
            isWorkloadFactory,
            getJobDetailApi,
            refreshGetWellPage: refreshOracleWellArchitectPage, // Use Oracle-specific refresh function
            setGwAdhocError,
            t,
            createNotificationMessage
        });
    };

    useEffect(() => {
        if (isInnerPageOptimize) {
            refreshOracleWellArchitectPage();
            dispatch(setIsInnerPageOptimize(false));
        }
    }, [isInnerPageOptimize, dispatch, refreshOracleWellArchitectPage]);

    return (
        <AssessmentContainer
            onClick={triggerAssessmentHandler}
            isLoading={triggerAssessmentInProgress}
            gwTimestamp={gwTimestamp || ''}
            gwAdhocError={gwAdhocError || ''}
            optimizePageLoading={optimizePageLoading || false}
        />
    );
};

export default OracleWellArchitectBanner;

import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Button } from '@netapp/design-system';

import { useAppSelector } from '../../../../store/storeHooks';

import {
    setGwAdhocError,
    setIsInnerPageOptimize,
    setTriggerAssessmentInProgress
} from '../../../../store/workloadFactory/getWellOptimizeSlice';
import { setRefreshOracleWellArchitect } from '../../../../store/workloadFactory/oracleSlice';
import { GENERAL } from '../../../../utils/appConstants';
import {
    useLazyGetSubTaskListQuery,
    useTriggerOracleInstanceAssessmentMutation,
    useTriggerUnregisteredOracleAssessmentMutation
} from '../../../../utils/apiService';
import AssessmentContainer from '../../../../common/AssessmentContainer/AssessmentContainer';
import { handleTriggerAssessment, useWellArchitectRefresh } from '../../../../utils/resourceUtils';
import { resetGwValuesOnRefresh } from '../../../GetWell/GetWellUtils';
import { DBType } from '../../../../utils/consts';

const OracleWellArchitectBanner = () => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const { isWorkloadFactory, accountId } = useAppSelector(state => state?.auth);
    const { selectedResourceId, selectedDatabaseInstance, selectedResourceCredId, selectedResourceRegionId } =
        useAppSelector(state => state.workloadFactoryResource);
    const {
        isInnerPageOptimize,
        gwTimestamp,
        gwAdhocError,
        optimizePageLoading,
        cardData,
        isWad: isWadFromStore,
        isUnregistered: isUnregisteredFromStore,
        selectedResourceId: getWellResourceId,
        selectedDatabaseInstanceName,
        triggerAssessmentInProgress
    } = useAppSelector(state => state.getWellOptimize);

    const isWad = isWadFromStore || !!cardData?.isWad;
    const isUnregistered = isUnregisteredFromStore || !!cardData?.isUnregistered;

    const [triggerAssessmentApi] = useTriggerOracleInstanceAssessmentMutation();
    const [triggerUnregisteredAssessmentApi] = useTriggerUnregisteredOracleAssessmentMutation();
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
            setTriggerAssessmentInProgress: (inProgress: boolean) =>
                dispatch(setTriggerAssessmentInProgress(inProgress)),
            triggerAssessmentApi,
            triggerUnregisteredAssessmentApi,
            credentialId: selectedResourceCredId,
            regionId: selectedResourceRegionId,
            selectedResourceId: isUnregistered ? getWellResourceId || selectedResourceId : selectedResourceId,
            selectedDatabaseInstance,
            instanceName: selectedDatabaseInstanceName,
            accountId,
            isUnregistered,
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
            isLoading={triggerAssessmentInProgress || false}
            gwTimestamp={gwTimestamp || ''}
            gwAdhocError={gwAdhocError || ''}
            optimizePageLoading={optimizePageLoading || false}
            isWad={isWad}
            isUnregistered={isUnregistered}
            dbType={DBType.ORACLE}
        />
    );
};

export default OracleWellArchitectBanner;

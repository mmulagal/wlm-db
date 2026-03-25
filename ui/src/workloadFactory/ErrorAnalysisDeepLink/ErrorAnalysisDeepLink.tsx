import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import HeaderComponent from '../DatabaseHomePage/HeaderComponent/HeaderComponent';
import { DBType, WELL_ARCHITECTED_TABS, WLF_TABS } from '../../utils/consts';
import { setBreadCrumbSelectedFrom, setSelectedHeaderTab } from '../../store/workloadFactory/inventoryV2Slice';
import {
    setFSXId,
    setGwPageLoadInstanceData,
    setLandingFrom,
    setSelectedWellArchitectTab
} from '../../store/workloadFactory/getWellOptimizeSlice';
import { selectedTabSelection } from '../../store/workloadFactory/databaseHomeSlice';
import {
    resetWorkloadFactoryResourceData,
    setSelectedResourcePageHostData
} from '../../store/workloadFactory/workloadFactoryResourceSlice';
import { resetEiData, setLogAnalyzerState } from '../../store/workloadFactory/agenticAISlice';
import { setSelectedOracleInnerPageTab } from '../../store/workloadFactory/oracleSlice';

// Handles direct URL navigation to the Error Analysis tab.
// All required fields (credId, regionId, hostId, instanceId) come directly
// from the URL params — no inventory data lookup needed.
const ErrorAnalysisDeepLink = () => {
    const { credId, regionId, hostId, instanceId, status, engineType, hostname, dbInstanceName } = useParams();
    const dispatch = useDispatch();

    const isOracle = engineType?.toLowerCase() === DBType.ORACLE.toLowerCase();

    useEffect(() => {
        if (!credId || !regionId || !hostId || !instanceId) return;
        if (status) {
            dispatch(setLogAnalyzerState(status.charAt(0).toUpperCase() + status.slice(1)));
        }

        const headerTab = isOracle ? WLF_TABS.ORACLE_WELL_ARCHITECTED : WLF_TABS.OPTIMIZE;
        dispatch(setSelectedHeaderTab(headerTab));
        dispatch(selectedTabSelection(headerTab));
        dispatch(setBreadCrumbSelectedFrom(WLF_TABS.INVENTORY));
        dispatch(setLandingFrom(WLF_TABS.INVENTORY));
        dispatch(setFSXId({ fsxId: '', ec2InstanceId: '' }));
        dispatch(
            setGwPageLoadInstanceData({
                hostname: hostname || '',
                resourceId: hostId,
                instanceId,
                instanceName: dbInstanceName || '',
                credId,
                regionId,
                storageType: ''
            })
        );
        dispatch(resetWorkloadFactoryResourceData());
        dispatch(
            setSelectedResourcePageHostData({
                resourceId: hostId,
                databaseInstanceId: instanceId,
                databaseInstanceName: dbInstanceName || '',
                credentialId: credId,
                regionId
            })
        );
        dispatch(resetEiData({}));
        if (isOracle) {
            dispatch(setSelectedOracleInnerPageTab(WELL_ARCHITECTED_TABS.ERROR_INVESTIGATION));
        } else {
            dispatch(setSelectedWellArchitectTab(WELL_ARCHITECTED_TABS.ERROR_INVESTIGATION));
        }
    }, [credId, regionId, hostId, instanceId, status, engineType, hostname, dbInstanceName, dispatch]);

    return <HeaderComponent tab={WLF_TABS.INVENTORY} />;
};

export default ErrorAnalysisDeepLink;

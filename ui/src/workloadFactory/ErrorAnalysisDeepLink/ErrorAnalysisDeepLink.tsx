import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import HeaderComponent from '../DatabaseHomePage/HeaderComponent/HeaderComponent';
import { WELL_ARCHITECTED_TABS, WLF_TABS } from '../../utils/consts';
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

// Handles direct URL navigation to the Error Analysis tab.
// All required fields (credId, regionId, hostId, instanceId) come directly
// from the URL params — no inventory data lookup needed.
const ErrorAnalysisDeepLink = () => {
    const { credId, regionId, hostId, instanceId, status } = useParams();
    const dispatch = useDispatch();

    useEffect(() => {
        if (!credId || !regionId || !hostId || !instanceId) return;
        if (status) {
            dispatch(setLogAnalyzerState(status.charAt(0).toUpperCase() + status.slice(1)));
        }

        dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE));
        dispatch(selectedTabSelection(WLF_TABS.OPTIMIZE));
        dispatch(setBreadCrumbSelectedFrom(WLF_TABS.INVENTORY));
        dispatch(setLandingFrom(WLF_TABS.INVENTORY));
        dispatch(setFSXId({ fsxId: '', ec2InstanceId: '' }));
        dispatch(
            setGwPageLoadInstanceData({
                hostname: '',
                resourceId: hostId,
                instanceId,
                instanceName: '',
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
                databaseInstanceName: '',
                credentialId: credId,
                regionId
            })
        );
        dispatch(resetEiData({}));
        dispatch(setSelectedWellArchitectTab(WELL_ARCHITECTED_TABS.ERROR_INVESTIGATION));
    }, [credId, regionId, hostId, instanceId, status, dispatch]);

    return <HeaderComponent tab={WLF_TABS.INVENTORY} />;
};

export default ErrorAnalysisDeepLink;

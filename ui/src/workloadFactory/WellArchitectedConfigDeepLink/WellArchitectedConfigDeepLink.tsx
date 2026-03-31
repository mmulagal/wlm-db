import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import HeaderComponent from '../DatabaseHomePage/HeaderComponent/HeaderComponent';
import { WLF_TABS } from '../../utils/consts';
import { setSelectedHeaderTab } from '../../store/workloadFactory/inventoryV2Slice';
import { setLandingFrom, setSelectedConfigEngineType } from '../../store/workloadFactory/getWellOptimizeSlice';
import { setSelectedConfig } from '../../store/workloadFactory/databaseHomeSlice';
import {
    setHeaderSelectedMultiCred,
    setHeaderSelectedMultiRegion
} from '../../store/workloadFactory/headersSlice';

// Handles direct URL navigation to a specific Well-Architected configuration inner page.
// credId and regionId are used to set the header filters so that the inner page
// loads data scoped to the correct credential and region.
const WellArchitectedConfigDeepLink = () => {
    const { credId, regionId, configName, engineType } = useParams();
    const dispatch = useDispatch();

    useEffect(() => {
        if (!credId || !regionId || !configName) return;

        dispatch(setHeaderSelectedMultiCred([{ data: { credentialsId: credId } }]));
        dispatch(setHeaderSelectedMultiRegion([{ data: { regionCode: regionId } }]));

        if (engineType) {
            dispatch(setSelectedConfigEngineType(engineType));
        }

        dispatch(setSelectedConfig(configName));
        dispatch(setLandingFrom(WLF_TABS.WELL_ARCHITECTED_TAB));
        dispatch(setSelectedHeaderTab(WLF_TABS.DASHBOARD_INNER_PAGE));
    }, [credId, regionId, configName, engineType, dispatch]);

    return <HeaderComponent tab={WLF_TABS.WELL_ARCHITECTED_TAB} />;
};

export default WellArchitectedConfigDeepLink;

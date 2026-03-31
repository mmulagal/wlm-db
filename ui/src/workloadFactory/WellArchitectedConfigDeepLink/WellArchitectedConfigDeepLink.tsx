import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import HeaderComponent from '../DatabaseHomePage/HeaderComponent/HeaderComponent';
import { DBType, WLF_TABS } from '../../utils/consts';
import { setSelectedHeaderTab } from '../../store/workloadFactory/inventoryV2Slice';
import { setLandingFrom, setSelectedConfigEngineType } from '../../store/workloadFactory/getWellOptimizeSlice';
import { setSelectedConfig } from '../../store/workloadFactory/databaseHomeSlice';
import {
    setHeaderSelectedMultiCred,
    setHeaderSelectedMultiRegion,
    setDeepLinkCredId,
    setDeepLinkRegionId
} from '../../store/workloadFactory/headersSlice';

// Maps a URL engineType param (e.g. "oracle", "ORACLE", "mssql") to the
// canonical DBType constant used throughout the app for comparisons.
const resolveEngineType = (engineType: string | undefined): string => {
    if (engineType?.toLowerCase() === 'oracle') return DBType.ORACLE;
    return DBType.MSSQL;
};

// Handles direct URL navigation to a specific Well-Architected configuration inner page.
// - credId / regionId are stored as "pending" deep-link IDs so HeaderComponent can match
//   them to the full option objects once credentials/regions are loaded from the API.
// - configName selects the specific WAD configuration card.
// - engineType is normalised to the DBType constant so the component's
//   configEngineType === DBType.MSSQL / ORACLE checks work correctly.
const WellArchitectedConfigDeepLink = () => {
    const { credId, regionId, configName, engineType } = useParams();
    const dispatch = useDispatch();

    useEffect(() => {
        if (!credId || !regionId || !configName) return;

        // Reset the header selections to null so HeaderComponent's guard
        // (!headerSelectedMultiCred) is satisfied and it can initialise from
        // the credentials API response — matching credId/regionId via the
        // deepLink fields stored below.
        dispatch(setHeaderSelectedMultiCred(null));
        dispatch(setHeaderSelectedMultiRegion(null));

        // Store the raw IDs; HeaderComponent picks these up after options load
        // and selects the matching full option objects.
        dispatch(setDeepLinkCredId(credId));
        dispatch(setDeepLinkRegionId(regionId));

        // Normalise the URL param to the proper DBType constant so that
        // configEngineType === DBType.MSSQL / ORACLE comparisons work.
        dispatch(setSelectedConfigEngineType(resolveEngineType(engineType)));

        dispatch(setSelectedConfig(configName));
        dispatch(setLandingFrom(WLF_TABS.WELL_ARCHITECTED_TAB));
        dispatch(setSelectedHeaderTab(WLF_TABS.DASHBOARD_INNER_PAGE));
    }, [credId, regionId, configName, engineType, dispatch]);

    return <HeaderComponent tab={WLF_TABS.WELL_ARCHITECTED_TAB} />;
};

export default WellArchitectedConfigDeepLink;

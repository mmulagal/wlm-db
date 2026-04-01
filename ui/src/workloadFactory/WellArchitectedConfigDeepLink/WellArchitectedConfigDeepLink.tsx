import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../store/storeHooks';
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
// - credIds / regionIds are read from localStorage so the HeaderComponent can match
//   them to the full option objects once credentials/regions are loaded from the API.
// - configName selects the specific WAD configuration card.
// - engineType is normalised to the DBType constant so the component's
//   configEngineType === DBType.MSSQL / ORACLE checks work correctly.
const WellArchitectedConfigDeepLink = () => {
    const { configName, engineType } = useParams();
    const dispatch = useDispatch();
    const { userMetadata, accountId } = useAppSelector(state => state.auth);

    useEffect(() => {
        if (!configName || !userMetadata?.sub || !accountId) return;

        // Read selected region IDs from localStorage (multiple regions supported)
        const regionKey = `occm.fsx.lastRegionCodeMultiple.${userMetadata.sub}.${accountId}`;
        const savedRegions = localStorage.getItem(regionKey);
        const regionIds: string[] = savedRegions
            ? JSON.parse(savedRegions)
                  .map((r: any) => r.value)
                  .filter(Boolean)
            : [];

        // Read selected cred IDs from localStorage (multiple credentials supported)
        const credKey = `occm.fsx.lastCredentialIdMultiple.${userMetadata.sub}.${accountId}`;
        const savedCreds = localStorage.getItem(credKey);
        const credIds: string[] = savedCreds
            ? JSON.parse(savedCreds)
                  .map((c: any) => c.value)
                  .filter(Boolean)
            : [];

        // Reset the header selections to null so HeaderComponent's guard
        // (!headerSelectedMultiCred) is satisfied and it can initialise from
        // the credentials API response — matching credIds/regionIds via the
        // deepLink fields stored below.
        dispatch(setHeaderSelectedMultiCred(null));
        dispatch(setHeaderSelectedMultiRegion(null));

        // Store the arrays of IDs; HeaderComponent picks these up after options load
        // and selects the matching full option objects.
        dispatch(setDeepLinkCredId(credIds.length > 0 ? credIds : null));
        dispatch(setDeepLinkRegionId(regionIds.length > 0 ? regionIds : null));

        // Normalise the URL param to the proper DBType constant so that
        // configEngineType === DBType.MSSQL / ORACLE comparisons work.
        dispatch(setSelectedConfigEngineType(resolveEngineType(engineType)));

        dispatch(setSelectedConfig(configName));
        dispatch(setLandingFrom(WLF_TABS.WELL_ARCHITECTED_TAB));
        dispatch(setSelectedHeaderTab(WLF_TABS.DASHBOARD_INNER_PAGE));
    }, [configName, engineType, dispatch, userMetadata, accountId]);

    return <HeaderComponent tab={WLF_TABS.WELL_ARCHITECTED_TAB} />;
};

export default WellArchitectedConfigDeepLink;

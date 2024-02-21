import { useNavigate } from 'react-router-dom';
import { Button } from '@netapp/design-system';
import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import { useAppSelector } from '../../../store/storeHooks';
import DatabaseListTable from '../DatabaseListTable/DatabaseListTable';
import DatabaseOverviewLayout from '../DatabaseOverviewLayout/DatabaseOverviewLayout';
import OverviewTabs from '../OverviewTabs/OverviewTabs';

import styles from './DatabaseHostOverview.module.scss';
import { useGetDatabaseListQuery, useGetResourceDetailsQuery } from '../../../utils/apiService';
import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import {
    setDatabaseList,
    setDatabaseListLoading,
    setResourceDetails,
    setResourceLoading
} from '../../../store/workloadFactory/workloadFactoryResourceSlice';
import { resetDBHomePageState } from '../../../utils/utilityFunctions';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventorySlice';
import DatabaseHostTile from '../DatabaseOverviewLayout/DatabaseHostTile/DatabaseHostTile';
import { WLF_TABS } from '../../../utils/consts';
import { setDBHostName } from '../../../store/workloadFactory/createNewDBSlice';
import { GENERAL } from '../../../utils/appConstants';

const DatabaseHostOverview = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    
    const selectedTab = useAppSelector(state => state.databaseHome.selectedTab);
    const resourceId = useAppSelector(state => state.auth.resourceId);
    const stateResourceDetails = useAppSelector(state => state.workloadFactoryResource.resourceDetails);
    const headerSelectedCred = useAppSelector(state => state.headers.headerSelectedCred);
    const headerSelectedRegion = useAppSelector(state => state.headers.headerSelectedRegion);

    const {
        data: resourceDetails,
        isLoading: resourceLoading,
        refetch: resourceRefetch,
        isFetching: resourceFetching
    } = useGetResourceDetailsQuery(
        {
            credentialId: headerSelectedCred?.data?.credentialsId,
            region: headerSelectedRegion?.label2,
            id: resourceId
        }
    );

    const {
        data: databaseList,
        isLoading: databaseListLoading,
        refetch: databaseListRefetch,
        isFetching: databaseListFetching
    } = useGetDatabaseListQuery(
        {
            credentialId: headerSelectedCred?.data?.credentialsId,
            region: headerSelectedRegion?.label2,
            id: resourceId
        }
    );

    useEffect(() => {
        dispatch(setResourceLoading(resourceLoading));
        if (resourceDetails) {
            dispatch(setResourceDetails(resourceDetails));
        }
    }, [resourceLoading, resourceDetails, dispatch]);

    useEffect(() => {
        dispatch(setDatabaseListLoading(databaseListLoading));
        if (databaseList?.items) {
            dispatch(setDatabaseList(databaseList.items));
        }
    }, [databaseListLoading, databaseList, dispatch]);

    useEffect(() => {
        if (!stateResourceDetails?.id) {
            resourceRefetch();
            databaseListRefetch();
        }
    }, [stateResourceDetails, resourceRefetch, databaseListRefetch]);

    useEffect(() => {
        dispatch(setResourceLoading(resourceFetching));
        dispatch(setDatabaseListLoading(databaseListFetching));
    }, [resourceFetching, databaseListFetching, dispatch]);

    return (
        <div className={styles.resourcePage}>
            <div className={styles.breadCrumb}>
                <BreadCrumbs
                    items={[
                        {
                            title: 'Inventory managed hosts',
                            onClick: () => {
                                resetDBHomePageState(dispatch);
                                dispatch(setSelectedHeaderTab(WLF_TABS.INVENTORY));
                            }
                        },
                        {
                            title: resourceDetails?.name
                        }
                    ]}
                />
                <Button
                    variant="primary"
                    onClick={() => {
                        dispatch(setDBHostName(resourceDetails?.name));
                        navigate('../create-new-user');
                    }}
                    id={'create-new-user-button'}
                >
                    {GENERAL.CREATE_USER_DB_TITLE}
                </Button>
            </div>

            <div className={styles.hostTitle}>
                <DatabaseHostTile />
            </div>

            <div className={styles.secondLevel}>
                <OverviewTabs />
                {selectedTab === WLF_TABS.OVERVIEW && <DatabaseOverviewLayout />}
                {selectedTab === WLF_TABS.DATABASE_LIST && <DatabaseListTable />}
            </div>
        </div>
    );
};

export default DatabaseHostOverview;

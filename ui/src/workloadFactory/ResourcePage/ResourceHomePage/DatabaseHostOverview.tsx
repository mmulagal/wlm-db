import { useNavigate } from 'react-router-dom';
import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import { useAppSelector } from '../../../store/storeHooks';
import DatabaseListTable from '../DatabaseListTable/DatabaseListTable';
import DatabaseOverviewLayout from '../DatabaseOverviewLayout/DatabaseOverviewLayout';
import OverviewTabs from '../OverviewTabs/OverviewTabs';

import styles from './DatabaseHostOverview.module.scss';
import { useGetDatabaseListQuery, useGetResourceDetailsQuery } from '../../../utils/apiService';
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import {
    setDatabaseList,
    setDatabaseListLoading,
    setResourceDetails,
    setResourceLoading
} from '../../../store/workloadFactory/workloadFactoryResourceSlice';
import { GENERAL } from '../../../utils/appConstants';

const DatabaseHostOverview = () => {
    const selectedTab = useAppSelector(state => state.databaseHome.selectedTab);
    const resourceId = useAppSelector(state => state.auth.resourceId);
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const {
        data: resourceDetails,
        isLoading: resourceLoading,
        refetch: resourceRefetch
    } = useGetResourceDetailsQuery(resourceId);

    const {
        data: databaseList,
        isLoading: databaseListLoading,
        refetch: databaseListRefetch
    } = useGetDatabaseListQuery(resourceId);

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

    return (
        <div className={styles.resourcePage}>
            <div className={styles.breadCrumb}>
                <BreadCrumbs
                    items={[
                        {
                            title: GENERAL.DATABASES,
                            onClick: () => {
                                navigate('../databases');
                            }
                        },
                        {
                            title: GENERAL.DATABASE_HOST_NAME
                        }
                    ]}
                />
            </div>

            <div className={styles.secondLevel}>
                <OverviewTabs />
                {selectedTab === 'Overview' && <DatabaseOverviewLayout />}
                {selectedTab === 'Database list' && <DatabaseListTable />}
            </div>
        </div>
    );
};

export default DatabaseHostOverview;

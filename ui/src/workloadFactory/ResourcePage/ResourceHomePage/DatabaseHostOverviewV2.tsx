import { useNavigate } from 'react-router-dom';
import { Button } from '@netapp/design-system';
import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import { useAppSelector } from '../../../store/storeHooks';
import DatabaseListTable from '../DatabaseListTable/DatabaseListTable';
import DatabaseOverviewLayout from '../DatabaseOverviewLayout/DatabaseOverviewLayout';
import OverviewTabs from '../OverviewTabs/OverviewTabs';
import styles from './DatabaseHostOverview.module.scss';
import { useDispatch } from 'react-redux';
import { isSmbProtocol } from '../../../utils/utilityFunctions';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventorySlice';
import DatabaseHostTile from '../DatabaseOverviewLayout/DatabaseHostTile/DatabaseHostTile';
import { WLF_TABS } from '../../../utils/consts';
import {
    addInitialDBCreateData,
    initialCreateNewUserState,
    setDBHostName,
    setInstanceId,
    setInstanceName
} from '../../../store/workloadFactory/createNewDBSlice';
import { GENERAL } from '../../../utils/appConstants';
import CustomContentInfo from '../../../common/CustomContentInfo/CustomContentInfo';
import DatabaseHostOverviewApiV2 from './DatabaseHostOverviewApiV2';
import { updateResourceId } from '../../../store/authSlice';

const DatabaseHostOverviewV2 = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const selectedTab = useAppSelector(state => state.databaseHome.selectedTab);
    const stateResourceDetails = useAppSelector(state => state.workloadFactoryResource.resourceDetails);
    const {
        resourceLoading: resourceLoadingState,
        selectedHostname,
        selectedDatabaseInstanceName,
        selectedDatabaseInstance,
        selectedResourceId
    } = useAppSelector(state => state.workloadFactoryResource);

    DatabaseHostOverviewApiV2();

    return (
        <div className={styles.resourcePage}>
            <div className={styles.breadCrumb}>
                <BreadCrumbs
                    items={[
                        {
                            title: 'Inventory',
                            onClick: () => {
                                dispatch(setSelectedHeaderTab(WLF_TABS.INVENTORY));
                            }
                        },
                        {
                            title: selectedHostname + ' / ' + selectedDatabaseInstanceName
                        }
                    ]}
                />
                {isSmbProtocol(stateResourceDetails?.storage?.fsxn?.protocol) ? (
                    <CustomContentInfo
                        tooltipText={GENERAL.SMB_PROTOCOL_DISABLED}
                        CustomContent={
                            <Button variant="primary" onClick={() => {}} id={'create-new-user-button'} disabled={true}>
                                {GENERAL.CREATE_USER_DB_TITLE}
                            </Button>
                        }
                    />
                ) : (
                    <Button
                        variant="primary"
                        onClick={() => {
                            if (!resourceLoadingState) {
                                dispatch(addInitialDBCreateData(initialCreateNewUserState));
                                dispatch(setDBHostName(selectedHostname));
                                dispatch(updateResourceId(selectedResourceId));
                                dispatch(setInstanceId(selectedDatabaseInstance));
                                dispatch(setInstanceName(selectedDatabaseInstanceName));
                                navigate('../create-new-user');
                            }
                        }}
                        id={'create-new-user-button'}
                        disabled={resourceLoadingState}
                    >
                        {GENERAL.CREATE_USER_DB_TITLE}
                    </Button>
                )}
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

export default DatabaseHostOverviewV2;

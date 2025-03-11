import { useNavigate } from 'react-router-dom';
import { Button, Popover } from '@netapp/design-system';
import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import { useAppSelector } from '../../../store/storeHooks';
import DatabaseListTable from '../DatabaseListTable/DatabaseListTable';
import DatabaseOverviewLayout from '../DatabaseOverviewLayout/DatabaseOverviewLayout';
import OverviewTabs from '../OverviewTabs/OverviewTabs';
import styles from './DatabaseHostOverview.module.scss';
import { useDispatch } from 'react-redux';
import { isSmbProtocol } from '../../../utils/utilityFunctions';
import DatabaseHostTile from '../DatabaseOverviewLayout/DatabaseHostTile/DatabaseHostTile';
import { WLF_TABS } from '../../../utils/consts';
import {
    addInitialDBCreateData,
    initialCreateNewUserState,
    setCdbPageData
} from '../../../store/workloadFactory/createNewDBSlice';
import { ReactComponent as RefreshIcon } from '@netapp/icons/ic_refresh.svg';
import { GENERAL } from '../../../utils/appConstants';
import CustomContentInfo from '../../../common/CustomContentInfo/CustomContentInfo';
import DatabaseHostOverviewApiV2 from './DatabaseHostOverviewApiV2';
import { updateResourceId } from '../../../store/authSlice';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';

const DatabaseHostOverviewV2 = ({ refreshTime, refreshPage }: any) => {
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const selectedTab = useAppSelector(state => state.databaseHome.selectedTab);
    const stateResourceDetails = useAppSelector(state => state.workloadFactoryResource.resourceDetails);
    const {
        resourceLoading: resourceLoadingState,
        selectedHostname,
        selectedDatabaseInstanceName,
        selectedDatabaseInstance,
        selectedResourceId,
        selectedResourceCredId,
        selectedResourceRegionId
    } = useAppSelector(state => state.workloadFactoryResource);

    DatabaseHostOverviewApiV2();

    return (
        <div className={styles.resourcePage}>
            <div className={styles.breadCrumb}>
                <>
                    <BreadCrumbs
                        items={[
                            {
                                title: 'Inventory',
                                onClick: () => {
                                    dispatch(setSelectedHeaderTab(WLF_TABS.INVENTORY));
                                }
                            },
                            {
                                title: selectedHostname + ' \\ ' + selectedDatabaseInstanceName
                            }
                        ]}
                    />
                </>

                <>
                    <div className={styles.rightSection}>
                        {isSmbProtocol(stateResourceDetails?.storage?.fsxn?.protocol) ? (
                            <CustomContentInfo
                                tooltipText={GENERAL.SMB_PROTOCOL_DISABLED}
                                CustomContent={
                                    <Button
                                        variant="primary"
                                        onClick={() => {}}
                                        id={'create-new-user-button'}
                                        disabled={true}
                                    >
                                        {GENERAL.CREATE_USER_DB_TITLE}
                                    </Button>
                                }
                            />
                        ) : (
                            <>
                                <Button
                                    variant="primary"
                                    onClick={() => {
                                        if (!resourceLoadingState) {
                                            dispatch(addInitialDBCreateData(initialCreateNewUserState));
                                            dispatch(
                                                setCdbPageData({
                                                    dbHostName: selectedHostname,
                                                    instanceId: selectedDatabaseInstance,
                                                    instanceName: selectedDatabaseInstanceName,
                                                    cdbCredId: selectedResourceCredId,
                                                    cdbRegionId: selectedResourceRegionId
                                                })
                                            );
                                            dispatch(updateResourceId(selectedResourceId));
                                            navigate('../create-new-user');
                                        }
                                    }}
                                    id={'create-new-user-button'}
                                    disabled={resourceLoadingState}
                                >
                                    {GENERAL.CREATE_USER_DB_TITLE}
                                </Button>
                            </>
                        )}
                        <div className={styles.refresh}>
                            <Popover
                                popoverClass={styles['copy-popover']}
                                children={`Last update: ${refreshTime}`}
                                trigger="hover"
                                container={
                                    <div className={styles.refreshIcon} onClick={refreshPage}>
                                        <RefreshIcon />
                                    </div>
                                }
                            />
                        </div>
                    </div>
                </>
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

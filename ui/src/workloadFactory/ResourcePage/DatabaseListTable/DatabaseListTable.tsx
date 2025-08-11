import { Table, useTable, TableTopBar, Typography, TooltipInfo, Button } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import commonStyles from '../../../utils/CommonStyles.module.scss';
import styles from './DatabaseListTable.module.scss';
import { WorkloadFactoryDatabaseItem } from '../../../utils/types/workloadFactoryResourceTypes';
import { useAppSelector } from '../../../store/storeHooks';
import { formatSize } from '../../../utils/utilityFunctions';
import { GENERAL } from '../../../utils/appConstants';
import { getProtectionText, isAwsBackupEnabledText } from '../../InventoryV2/InventoryUtilsV2';
import { PROTECTION_TEXT_STATUS } from '../../../utils/consts';
import DatabaseHostOverviewApiV2 from '../ResourceHomePage/DatabaseHostOverviewApiV2';
import {
    addInitialDBCreateData,
    initialCreateNewUserState,
    setCdbPageData
} from '../../../store/workloadFactory/createNewDBSlice';
import { updateResourceId } from '../../../store/authSlice';
import ProtectionIcons from '../../../common/ProtectionIcons/ProtectionIcons';

const DatabaseListTable = () => {
    const data: WorkloadFactoryDatabaseItem[] = useAppSelector(state => state.workloadFactoryResource.databaseList);
    const databaseListLoading = useAppSelector(state => state.workloadFactoryResource.databaseListLoading);
    const { selectedHostname, selectedDatabaseInstanceName } = useAppSelector(state => state.getWellOptimize);
    const {
        resourceLoading: resourceLoadingState,

        selectedDatabaseInstance,
        selectedResourceId,
        selectedResourceCredId,
        selectedResourceRegionId
    } = useAppSelector(state => state.workloadFactoryResource);
    const dispatch = useDispatch();
    DatabaseHostOverviewApiV2();
    const navigate = useNavigate();
    const formatData = (tableData: WorkloadFactoryDatabaseItem[]) =>
        tableData?.map(perRow => {
            const protectionText = getProtectionText(perRow);
            let protectionVal = '';
            if (protectionText === PROTECTION_TEXT_STATUS.YES) {
                protectionVal = GENERAL.PROTECTED;
            } else if (protectionText === PROTECTION_TEXT_STATUS.NO) {
                protectionVal = GENERAL.NOT_PROTECTED;
            } else {
                protectionVal = GENERAL.NOT_AVAILABLE;
            }
            return {
                ...perRow,
                isProtected: protectionVal
            };
        });

    const notAvailable = () => (
        <Typography variant="Regular_13" className={styles.colText}>
            {GENERAL.NOT_AVAILABLE}
        </Typography>
    );

    const EncryptionColDefs: ColumnProps[] = [
        {
            Header: GENERAL.DATABASE_NAME,
            accessor: 'name',
            isSortable: true,
            id: '1',
            width: '19.3%'
        },
        {
            Header: GENERAL.STATUS,
            accessor: 'status',
            filterOptions: 'auto',
            id: '2',
            width: '11.2%',
            renderCell: (cellData: any) => (
                <div className={styles.statusCell}>
                    <div
                        className={`${styles.statusIcon} ${
                            cellData === 'ONLINE' ? styles.onIcon : cellData === 'OFFLINE' ? styles.offIcon : ''
                        }`}
                    />
                    <Typography variant="Regular_14">{cellData}</Typography>
                </div>
            )
        },
        {
            Header: GENERAL.SIZE,
            accessor: 'size',
            isSortable: true,
            id: '3',
            width: '15%',
            renderCell: (cellData: any) => formatSize(cellData)
        },
        {
            Header: GENERAL.DB_HOST_PROTECTION_TYPE,
            accessor: 'isProtected',
            filterOptions: 'auto',
            id: '4',
            width: '18%',
            renderCell: (cellData: any, rowData: any) => {
                const protectionData = rowData?.protection;

                return (
                    <>
                        {protectionData && (
                            <div className={styles.colText}>
                                <div className={styles.protection}>
                                    <div className={commonStyles.protectionIcons}>
                                        <ProtectionIcons protectionData={protectionData} />
                                    </div>
                                </div>
                            </div>
                        )}
                        {!protectionData && notAvailable()}
                    </>
                );
            }
        },
        {
            Header: GENERAL.DB_HOST_TYPE,
            accessor: 'type',
            filterOptions: 'auto',
            id: '5',
            width: '15%'
        },
        {
            Header: GENERAL.DB_HOST_COLLATION,
            accessor: 'collation',
            isSortable: true,
            id: '6',
            width: '24.6%',
            renderCell: (cellData: any) => cellData || GENERAL.NOT_AVAILABLE
        }
    ];

    const tableProps = useTable({
        // @ts-ignore
        selectAllProps: false,
        // @ts-ignore
        manageColumnsProps: false,
        isSorting: false,
        columns: EncryptionColDefs,
        rows: formatData(data),
        pageSize: 50,
        isLazyLoading: databaseListLoading,
        isHorizontalScroll: true
    });

    return (
        <div className={styles.databaseListTable}>
            <TableTopBar
                // @ts-ignore
                tableProps={tableProps}
                pluralTitle="Databases"
                singularTitle="Database"
                actionsRight={
                    <div className={styles.databaseButton}>
                        <Button
                            variant="primary"
                            className="continue-button"
                            isThin
                            isDisabled={resourceLoadingState}
                            onClick={() => {
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
                            }}
                        >
                            {GENERAL.JM_TYPE_CREATE_RESOURCE}
                        </Button>
                    </div>
                }
            />
            <Table
                // @ts-ignore
                tableProps={tableProps}
            />
        </div>
    );
};

export default DatabaseListTable;

import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { DsTypography } from '@tlveng/wlm-ds';
import { Table, TableTopBar, useTable } from '@netapp/design-system';

import styles from './DgReplicaTable.module.scss';
import oracleStyles from '../../InventoryTable.module.scss';
import { INVENTORY_STATUS, DETECT_HOST_VAR, STORAGE_TYPES } from '../../../../../utils/consts';
import TooltipComponent from '../../../../../common/TooltipComponent/TooltipComponent';
import MenuPopover from '../../../../../common/MenuPopover/MenuPopover';
import { useAppSelector } from '../../../../../store/storeHooks';
import { getInstanceTableMenuOptions, handleInstanceMenuSelection } from '../InstanceTableHelper';
import { isSmbProtocol } from '../../../../../utils/utilityFunctions';

import { getOracleDatabaseColumnsList } from '../OracleDatabaseColumnsList';
import { instanceExtraDataUpdate } from '../../../InventoryUtilsV2';

type DgReplicaTableProps = {
    width?: number;
    rowData?: any;
    handleProtection: (rowData: any) => void;
    handleDialog: (rowData: any) => void;
    optimizeAction: (rowData: any) => void;
    handleEditProtection: (rowData: any) => void;
};

const DgReplicaTable = ({
    width,
    rowData,
    handleProtection,
    handleDialog,
    optimizeAction,
    handleEditProtection
}: DgReplicaTableProps) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [data, setData] = useState<any[]>([]);
    const [menuOpenedRow, setOpenedRow] = useState(null);
    const menuOpenedRowDetail: any = useRef(null);

    const { regionMapping } = useAppSelector(state => state.headers);
    const { instanceProtection } = useAppSelector(state => state.snapCenter);
    const isDemoMode = useAppSelector(state => state.auth?.isDemoMode);

    // Get all Oracle columns at component level (hooks must be called here, not in useEffect)
    const allOracleColumns = getOracleDatabaseColumnsList({ t, updatedTableData: data });
    // Extract columns 2-12 (indices 1-11) and column 16 (index 15)
    const baseColumns = [...allOracleColumns.slice(1, 13), allOracleColumns[16]];

    // Create manage column
    const manageColumn = {
        id: 'manage',
        Header: '',
        accessor: '',
        width: '58px',
        isSortable: false,
        isSticky: true,
        renderCell: (cellData: any, rowData: any) => {
            const menu = [];
            let isBedRockAvailable = true;

            if (
                regionMapping &&
                rowData?.regionId &&
                regionMapping.hasOwnProperty(rowData?.regionId) &&
                regionMapping[rowData?.regionId]?.hasOwnProperty('bedrockAvailable') &&
                !regionMapping[rowData?.regionId]?.bedrockAvailable
            ) {
                isBedRockAvailable = false;
            }

            let disableOption = false;
            let disableMessage = '';
            const disableCreateDb = isSmbProtocol(rowData?.storage?.fsxn?.protocol);
            const disableCreateDbMsg = disableCreateDb ? t('databases.register-flow.smb-protocol-disabled') : '';

            if (rowData?.status === INVENTORY_STATUS.OFFLINE) {
                disableMessage = t('databases.register-flow.host-down');
                disableOption = true;
            } else if (rowData?.ssmState === INVENTORY_STATUS.OFFLINE) {
                disableMessage = t('databases.register-flow.ssm-down');
                disableOption = true;
            } else if (rowData?.status?.toLowerCase() === INVENTORY_STATUS.DOWN) {
                disableMessage = t('databases.register-flow.oracle-server-instance-down');
                disableOption = true;
            }

            if (rowData.statusColText === INVENTORY_STATUS.MANAGED) {
                menu.push(
                    ...getInstanceTableMenuOptions(
                        rowData,
                        t,
                        disableOption,
                        disableMessage,
                        disableCreateDb,
                        disableCreateDbMsg,
                        isBedRockAvailable
                    )
                );
            }

            let disableMsg = '';
            let width = '';
            let height = '';

            const disableMenu = () => {
                if (
                    rowData.statusColText === INVENTORY_STATUS.UNMANAGED ||
                    rowData.statusColText === INVENTORY_STATUS.UNDETECTED ||
                    rowData.statusColText === INVENTORY_STATUS.IN_PROGRESS
                ) {
                    return true;
                }

                if (
                    rowData?.status === INVENTORY_STATUS.OFFLINE &&
                    rowData?.statusColText !== INVENTORY_STATUS.MANAGED
                ) {
                    disableMsg = t('databases.register-flow.host-down');
                    width = '120px';
                    height = '33px';
                    return true;
                }
                if (
                    rowData?.ssmState === INVENTORY_STATUS.OFFLINE &&
                    rowData?.statusColText !== INVENTORY_STATUS.MANAGED
                ) {
                    disableMsg = t('databases.register-flow.ssm-down');
                    width = '250px';
                    height = '50px';
                    return true;
                }
                if (
                    rowData?.status?.toLowerCase() === INVENTORY_STATUS.DOWN &&
                    rowData?.statusColText !== INVENTORY_STATUS.MANAGED
                ) {
                    disableMsg = t('databases.register-flow.oracle-server-instance-down');
                    width = '220px';
                    height = '33px';
                    return true;
                }
                if (
                    rowData?.detectOption === DETECT_HOST_VAR.DISABLE ||
                    rowData?.detectOption === DETECT_HOST_VAR.HIDE
                ) {
                    disableMsg = rowData?.detectOptionDisableMsg;
                    width = '250px';
                    height = '33px';
                    return true;
                }
                if (
                    rowData?.statusColText === INVENTORY_STATUS.UNMANAGED &&
                    rowData.fileSystemType !== STORAGE_TYPES.FSX_FOR_ONTAP &&
                    !rowData?.fsxId
                ) {
                    disableMsg = t('databases.register-flow.fsxn-manage-supported-oracle');
                    width = '340px';
                    height = '50px';
                    return true;
                }
                return false;
            };

            return (
                <div className={oracleStyles.lastContainer}>
                    <div className={oracleStyles.jobMenuPopover} style={{ marginLeft: '-24px' }}>
                        {disableMenu() ? (
                            <TooltipComponent placement="bottom" title={disableMsg} width={width} height={height}>
                                <div className={oracleStyles.menuPointerDisabled}>
                                    <span className={oracleStyles.menuPointer}>...</span>
                                </div>
                            </TooltipComponent>
                        ) : (
                            <MenuPopover
                                isMenuOpen={menuOpenedRowDetail.current === rowData.id || menuOpenedRow === rowData.id}
                                menuItems={[...menu]}
                                toggleMenu={(toggleType: string, menuId: string) => {
                                    if (toggleType === 'close') {
                                        menuOpenedRowDetail.current = null;
                                        setOpenedRow(null);
                                    } else if (toggleType === 'open') {
                                        menuOpenedRowDetail.current = null;
                                        setOpenedRow(rowData.id);
                                        menuOpenedRowDetail.current = rowData.id;
                                    } else if (toggleType === 'selectedOption') {
                                        menuOpenedRowDetail.current = null;
                                        setOpenedRow(null);
                                        handleInstanceMenuSelection({
                                            menuId,
                                            rowData,
                                            dispatch,
                                            navigate,
                                            handleProtection,
                                            handleDialog,
                                            optimizeAction,
                                            handleEditProtection
                                        });
                                    }
                                }}
                                CustomMenu={undefined}
                                disabledText={undefined}
                            />
                        )}
                    </div>
                </div>
            );
        }
    };

    // Combine base columns with manage column
    const selectedColumns = [...baseColumns, manageColumn];

    // Customize the serverInstallationMode column (id: '8') to show "Standby" text
    const replicaTableColDefs = selectedColumns.map(column => {
        if (column.id === '8') {
            return {
                ...column,
                renderCell: (cellData: string, rowData: any) => (
                    <DsTypography variant="Regular_13" className={oracleStyles.colText}>
                        {t('databases.general.standby')}
                    </DsTypography>
                )
            };
        }
        return column;
    });

    useEffect(() => {
        // Set data from replicasList
        const replicasList =
            rowData?.replicasList?.map((row: any) => instanceExtraDataUpdate(row, t, instanceProtection, isDemoMode)) ||
            [];
        setData(replicasList);
    }, [rowData, instanceProtection, isDemoMode]);

    const tableProps = useTable({
        isSorting: false,
        columns: replicaTableColDefs,
        rows: data,
        pageSize: 50,
        selectionType: 'none',
        isHorizontalScroll: true
    });
    return (
        <div className={styles.replica} style={width ? { width: `${width}px` } : undefined}>
            <TableTopBar
                // @ts-ignore
                tableProps={tableProps}
                pluralTitle={t('databases.general.replicas')}
                singularTitle={t('databases.general.replica')}
            />

            <Table
                // @ts-ignore
                tableProps={tableProps}
                variant="innerTable"
                isDoubleRow
            />
        </div>
    );
};

export default DgReplicaTable;

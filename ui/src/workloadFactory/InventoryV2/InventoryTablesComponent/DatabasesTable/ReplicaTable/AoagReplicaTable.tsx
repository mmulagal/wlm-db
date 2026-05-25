import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Table, TableTopBar, useDialog, useTable } from '@netapp/design-system';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { DsTypography } from '@tlveng/wlm-ds';
import { useAppSelector } from '../../../../../store/storeHooks';

import styles from './AoagReplicaTable.module.scss';
import mssqlStyles from '../../InventoryTable.module.scss';
import { MssqlPgsqlDatabaseTableColDefs } from '../MssqlPgsqlDatabaseTableColumns';
import MenuPopover from '../../../../../common/MenuPopover/MenuPopover';
import { DBType } from '../../../../../utils/consts';
import { createSandboxNavigation } from '../../../../../utils/utilityFunctions';
import {
    setSelectedCsData,
    setSelectedSandboxHeaderValue
} from '../../../../../store/workloadFactory/createSandboxSlice';
import { determineProtectionStatusMssql, mssqlDatabaseMenuOptions } from '../../../InventoryUtilsV2';
import { getUniqueLunNames } from '../../../../WellArchitectedTab/WellArchitectedTabUtils';

type AoagReplicaTableProps = {
    width?: number;
    rowData?: any;
    handleProtection: (rowData: any) => void;
    handleEditProtectionDb: (rowData: any) => void;
    handleViewProtectionDetailsDb: (rowData: any) => void;
};

const AoagReplicaTable = ({
    width,
    rowData,
    handleProtection,
    handleEditProtectionDb,
    handleViewProtectionDetailsDb
}: AoagReplicaTableProps) => {
    const { t } = useTranslation();
    const { setDialog } = useDialog();
    const [data, setData] = useState<any[]>([]);
    const [menuOpenedRow, setOpenedRow] = useState<any>(null);
    const isDemoMode = useAppSelector(state => state.auth?.isDemoMode);
    const isGovAccount = useAppSelector(state => state.auth.isGovAccount);
    const { databaseProtection } = useAppSelector(state => state.snapCenter);
    const navigate = useNavigate();
    const dispatch = useDispatch();

    // Get all Oracle columns at component level (hooks must be called here, not in useEffect)
    const allDatabaseCol = MssqlPgsqlDatabaseTableColDefs({
        t,
        databaseTableRows: data,
        databaseType: DBType.MSSQL,
        setDialog
    });
    // Extract columns
    const baseColumns = [...allDatabaseCol.slice(0, 10)];

    // Create manage column
    const manageColumn = {
        id: 'manage',
        Header: '',
        accessor: '',
        width: '58px',
        isSortable: false,
        isSticky: true,
        renderCell: (cellData: any, replicaRowData: any) => {
            const isProtected = determineProtectionStatusMssql(isDemoMode, rowData, databaseProtection);
            const menu = mssqlDatabaseMenuOptions(t, isProtected, rowData, isGovAccount);

            return (
                <div className={mssqlStyles.lastContainer}>
                    <div className={mssqlStyles.jobMenuPopover} style={{ marginLeft: '-24px' }}>
                        <MenuPopover
                            isMenuOpen={menuOpenedRow === replicaRowData.id}
                            menuItems={[...menu]}
                            toggleMenu={(toggleType: string, menuId: string) => {
                                if (toggleType === 'close') {
                                    setOpenedRow(null);
                                } else if (toggleType === 'open') {
                                    setOpenedRow(replicaRowData.id);
                                } else if (toggleType === 'selectedOption') {
                                    setOpenedRow(null);

                                    if (menuId === 'createSandbox') {
                                        dispatch(
                                            setSelectedSandboxHeaderValue({
                                                credId: replicaRowData?.credentialId,
                                                regionId: replicaRowData?.regionId
                                            })
                                        );
                                        dispatch(
                                            setSelectedCsData({
                                                host: replicaRowData?.hostName,
                                                instance: replicaRowData?.databaseInstanceName,
                                                database: replicaRowData?.name
                                            })
                                        );
                                        createSandboxNavigation(navigate);
                                    }

                                    if (menuId === 'protect') {
                                        handleProtection(replicaRowData);
                                    } else if (menuId === 'editProtection') {
                                        handleEditProtectionDb(replicaRowData);
                                    } else if (menuId === 'viewProtectionDetails') {
                                        handleViewProtectionDetailsDb(replicaRowData);
                                    }
                                }
                            }}
                            CustomMenu={undefined}
                            disabledText={undefined}
                        />
                    </div>
                </div>
            );
        }
    };

    // Combine base columns with manage column
    const selectedColumns = [...baseColumns, manageColumn];

    // Customize the role column (id: '12') to show "Secondary Replica" text
    const replicaTableColDefs = selectedColumns.map(column => {
        if (column?.id === '12') {
            return {
                ...column,
                Header: t('databases.databases-table.headers.role'),
                renderCell: (cellData: string) => (
                    <DsTypography variant="Regular_13" className={mssqlStyles.colText}>
                        {t('databases.general.secondary-replica')}
                    </DsTypography>
                )
            };
        }
        return column;
    });

    useEffect(() => {
        // Set data from replicasList (standby databases). Add lunPaths like ResourcePageReplicaTable so
        // Associated LUNs uses the same count as the parent table (DatabasesTable only maps lunPaths onto
        // non-replica rows, so replica objects never received it).
        const replicasList = (rowData?.replicasList || []).map((r: any) => ({
            ...r,
            lunPaths: getUniqueLunNames(r?.luns)
        }));
        setData(replicasList);
    }, [rowData]);

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

export default AoagReplicaTable;

import { Table, useTable, TableTopBar } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import { DsTypography } from '@tlveng/wlm-ds';
import commonStyles from '../../../../utils/CommonStyles.module.scss';
import styles from './OraclePDB.module.scss';
import inventoryStyles from '../../../InventoryV2/InventoryTablesComponent/InventoryTable.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { formatSize, categorizeStorageSize } from '../../../../utils/utilityFunctions';
import { getProtectionText } from '../../../InventoryV2/InventoryUtilsV2';
import { ORACLE_DATABASES_COMPONENTS, PROTECTION_TEXT_STATUS, STATUS_CONST } from '../../../../utils/consts';
import useOracleResourceOverview from '../OracleOverview/OracleResourceOverviewApi';
import ProtectionIcons from '../../../../common/ProtectionIcons/ProtectionIcons';

interface ProtectionData {
    isFsxOntapSnapshotsEnabled?: boolean;
    isCRREnabled?: boolean;
    isAwsBackupEnabled?: {
        fsxn?: boolean;
        fsxw?: boolean;
        ebs?: boolean;
    };
    isAppConsistentBackupEnabled?: boolean;
}

interface OracleDatabase {
    name: string;
    size?: number;
    status: string;
    type: string;
    service?: string;
    created?: string;
    protection?: ProtectionData;
}

interface PdbTableRow extends OracleDatabase {
    id: string;
    isProtected: string;
    protectionData?: ProtectionData;
    sizeRange: string;
    serviceKey: string;
    isWad: boolean;
}

const OraclePDB = () => {
    const { t } = useTranslation();
    const { resourceLoading: oracleResourceLoading, resourceDetails } = useAppSelector(state => state.oracleSlice);
    const { isWad } = useAppSelector(state => state.getWellOptimize);
    const { selectedResourceId, selectedDatabaseInstanceName } = useAppSelector(state => state.workloadFactoryResource);
    const { inventoryTableData } = useAppSelector(state => state.inventoryV2);

    useOracleResourceOverview();
    const EXCLUDE_ICONS = {
        SQL_NATIVE: t('databases.general.sql-native-backup')
    };
    const COMING_SOON_ICONS = {
        APP_CONSISTENT: t('databases.general.local-snapshots-application-consistent')
    };

    const wadPdbData = useMemo(() => {
        if (!isWad || !inventoryTableData) return undefined;
        const hostData = Object.values(inventoryTableData).find(host => host?.resourceId === selectedResourceId);
        const instanceData = hostData?.sqlServerInstances?.find(
            instance => instance?.databaseInstanceName?.toLowerCase() === selectedDatabaseInstanceName?.toLowerCase()
        );
        return instanceData?.databases?.filter(db => db?.type === ORACLE_DATABASES_COMPONENTS.PDB);
    }, [isWad, inventoryTableData, selectedResourceId, selectedDatabaseInstanceName]);

    const pdbData: OracleDatabase[] | undefined = isWad
        ? wadPdbData
        : resourceDetails?.databases?.filter(
              (database: OracleDatabase) => database.type === t('databases.oracle-inner-page.pdb')
          );

    const formattedData: PdbTableRow[] = useMemo(() => {
        if (!pdbData) return [];

        return pdbData.map((perRow, index) => {
            const protectionText = getProtectionText(perRow);
            let protectionVal = '';
            if (protectionText === PROTECTION_TEXT_STATUS.YES) {
                protectionVal = t('databases.general.protected');
            } else if (protectionText === PROTECTION_TEXT_STATUS.NO) {
                protectionVal = t('databases.general.not_protected');
            } else {
                protectionVal = t('databases.general.not-available-table-columns');
            }
            return {
                ...perRow,
                id: `${perRow.name}-${index}`,
                isProtected: protectionVal,
                protectionData: perRow.protection,
                sizeRange: perRow.size
                    ? categorizeStorageSize(formatSize(perRow.size))
                    : t('databases.general.not-available-table-columns'),
                serviceKey: perRow.service || t('databases.general.not-available-table-columns'),
                isWad: !!isWad
            };
        });
    }, [pdbData, t, isWad]);

    const PDBColDefs: ColumnProps[] = [
        {
            id: '1',
            Header: t('databases.pdb-table.headers.pdb-name'),
            accessor: 'name',
            isSortable: true,
            width: '20%',
            isSticky: true,
            renderCell: (cellData: any) => (
                <div>
                    <DsTypography variant="Semibold_14">
                        {cellData || t('databases.general.not-available-table-columns')}
                    </DsTypography>
                </div>
            )
        },
        {
            Header: t('databases.pdb-table.headers.status'),
            accessor: 'status',
            id: '2',
            width: '15%',
            isSortable: true,
            filterOptions: 'auto',
            renderCell: (cellData: any, rowData: any) => {
                if (rowData?.isWad) {
                    return t('databases.general.not-available-table-columns');
                }

                let statusIconClass = '';
                if (cellData?.toUpperCase() === STATUS_CONST.ONLINE.toUpperCase()) {
                    statusIconClass = styles.onIcon;
                } else if (cellData?.toUpperCase() === STATUS_CONST.OFFLINE.toUpperCase()) {
                    statusIconClass = styles.offIcon;
                }

                return (
                    <div className={styles.statusCell}>
                        <div className={`${styles.statusIcon} ${statusIconClass}`} />
                        <DsTypography variant="Regular_14">
                            {cellData ? cellData.toUpperCase() : t('databases.general.not-available-table-columns')}
                        </DsTypography>
                    </div>
                );
            }
        },
        {
            Header: t('databases.pdb-table.headers.database-size'),
            accessor: 'sizeRange',
            id: '3',
            width: '12%',
            isSortable: true,
            filterOptions: [
                { label: '0 - 100 MiB', value: '0 - 100 MiB' },
                { label: '100 MiB - 1 GiB', value: '100 MiB - 1 GiB' },
                { label: '1 GiB - 10 GiB', value: '1 GiB - 10 GiB' },
                { label: '10 GiB - 5 TiB', value: '10 GiB - 5 TiB' },
                { label: '5 TiB+', value: '5 TiB+' }
            ],
            renderCell: (cellData: any, rowData: any) =>
                rowData?.size ? formatSize(rowData.size) : t('databases.general.not-available-table-columns')
        },
        {
            Header: t('databases.pdb-table.headers.protection-status'),
            accessor: 'protectionData',
            id: '4',
            width: '20%',
            renderCell: (cellData: any) => (
                <>
                    {cellData && (
                        <div className={inventoryStyles.colTextProtection}>
                            <div className={inventoryStyles.protection}>
                                <div className={commonStyles.protectionIcons}>
                                    <ProtectionIcons
                                        protectionData={cellData}
                                        excludeIcons={[EXCLUDE_ICONS.SQL_NATIVE]}
                                        comingSoonIcons={[COMING_SOON_ICONS.APP_CONSISTENT]}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                    {!cellData && t('databases.general.not-available-table-columns')}
                </>
            )
        },
        {
            Header: t('databases.pdb-table.headers.service-name'),
            accessor: 'serviceKey',
            id: '5',
            width: '18%',
            isSortable: true
        },
        {
            Header: t('databases.pdb-table.headers.creation-date'),
            accessor: 'created',
            id: '6',
            width: '15%',
            isSortable: true,
            renderCell: (cellData: any) => {
                if (cellData) {
                    return new Date(cellData).toLocaleDateString();
                }
                return t('databases.general.not-available-table-columns');
            }
        }
    ];

    const tableProps = useTable({
        // @ts-ignore
        selectAllProps: false,
        // @ts-ignore
        manageColumnsProps: false,
        isSorting: false,
        columns: PDBColDefs,
        rows: formattedData,
        pageSize: 50,
        isLazyLoading: isWad ? false : oracleResourceLoading,
        isHorizontalScroll: false
    });

    return (
        <div className={styles.oraclePDB}>
            <TableTopBar
                // @ts-ignore
                tableProps={tableProps}
                pluralTitle={t('databases.oracle-inner-page.pdbs')}
                singularTitle={t('databases.oracle-inner-page.pdb')}
            />
            <Table
                // @ts-ignore
                tableProps={tableProps}
            />
        </div>
    );
};

export default OraclePDB;

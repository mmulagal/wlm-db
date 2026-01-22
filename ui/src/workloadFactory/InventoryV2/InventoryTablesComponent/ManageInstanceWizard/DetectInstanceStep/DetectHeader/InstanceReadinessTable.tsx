import { DsTypography, Table, useTable, TooltipInfo } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { TFunction } from 'i18next';
import styles from './DetectHeader.module.scss';
import { useAppSelector } from '../../../../../../store/storeHooks';
import DotComponent from '../../../../../../common/DotComponent/DotComponent';
import { DBType, MANAGE_STATES } from '../../../../../../utils/consts';
import { BulkDetectedInstance, ManageReadinessData } from '../../../../../../utils/types/registerTypes';
import { isInstanceAuthenticated } from '../../SelectInstancesStep/AuthenticateBulkUtils';
import { getPermissionState } from '../../ManageInstanceUtils';

// Render status cell with icon
const renderStatusCell = (status: string, t: TFunction) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {status === MANAGE_STATES.READY ? (
            <DotComponent color="var(--success)" value={t('databases.register-flow.readiness-status-complete')} />
        ) : (
            <DotComponent
                color="var(--toggle-off-bg)"
                value={t('databases.register-flow.readiness-status-incomplete')}
            />
        )}
    </div>
);

const InstanceReadinessTable = () => {
    const { t } = useTranslation();
    const { bulkDetectedInstanceList, registerHostType, selectedMultiDetectInstances, instanceAuthStatus } =
        useAppSelector(state => state.inventoryV2);

    // Use bulkDetectedInstanceList if available, otherwise fall back to selectedMultiDetectInstances
    const dataSource =
        bulkDetectedInstanceList && bulkDetectedInstanceList.length > 0
            ? bulkDetectedInstanceList
            : selectedMultiDetectInstances || [];

    // Prepare rows with proper data mapping
    const tableRows = dataSource.map((item: BulkDetectedInstance) => {
        const instanceId = item?.id ?? '';
        const isAuthenticated = isInstanceAuthenticated(instanceId, item, instanceAuthStatus, registerHostType);

        // Get manageReadiness data - check both item level and data level
        const manageReadinessData: ManageReadinessData = item?.manageReadiness || item?.data?.manageReadiness || {};

        // Use getPermissionState like ManageInstanceStepHelper
        const assessment = getPermissionState('assessment', manageReadinessData);
        const remediation = getPermissionState('remediation', manageReadinessData);
        const dbcreation = getPermissionState('dbcreation', manageReadinessData);
        const sandbox = getPermissionState('sandbox', manageReadinessData);
        const errorInvestigation = getPermissionState('errorInvestigation', manageReadinessData);

        return {
            id: item?.id,
            hostName: item?.hostName || item?.data?.name,
            instanceName: item?.instanceName || item?.data?.databaseInstanceName || item?.databaseInstanceName || '-',
            authenticationStatus: isAuthenticated
                ? t('databases.general.authenticated')
                : t('databases.general.unauthenticated'),
            isAuthenticated,
            reviewWellArchitected: assessment,
            fixWellArchitected: remediation,
            createDatabase: dbcreation,
            createSandbox: sandbox,
            errorAnalysis: errorInvestigation
        };
    });

    const baseColumns: ColumnProps[] = [
        {
            id: '1',
            Header:
                registerHostType === DBType.MSSQL
                    ? t('databases.register-flow.detect-instance-table-col.instance-name')
                    : t('databases.register-flow.detect-instance-table-col.database-name'),
            accessor: 'instanceName',
            isSortable: true,
            renderCell: (cellData: string, rowData: any) => (
                <div className={styles.instanceNameCell}>
                    <span>{cellData}</span>
                    <TooltipInfo trigger="hover" placement="bottom">
                        <div className={styles.hostNameTooltip}>
                            <DsTypography variant="Semibold_14">
                                {t('databases.register-flow.detect-instance-table-col.host-name')}
                            </DsTypography>
                            <br />
                            <DsTypography variant="Regular_14">{rowData?.hostName || '-'}</DsTypography>
                        </div>
                    </TooltipInfo>
                </div>
            )
        },
        {
            id: '2',
            Header: t('databases.register-flow.detect-instance-table-col.review-well-architected'),
            accessor: 'reviewWellArchitected',
            renderCell: (cellData: string) => renderStatusCell(cellData, t)
        },
        {
            id: '3',
            Header: t('databases.register-flow.detect-instance-table-col.fix-well-architected'),
            accessor: 'fixWellArchitected',
            renderCell: (cellData: string) => renderStatusCell(cellData, t)
        }
    ];

    // MSSQL-specific columns (Create Database, Create Sandbox)
    const mssqlColumns: ColumnProps[] = [
        {
            id: '4',
            Header: t('databases.register-flow.detect-instance-table-col.create-database'),
            accessor: 'createDatabase',
            renderCell: (cellData: string) => renderStatusCell(cellData, t)
        },
        {
            id: '5',
            Header: t('databases.register-flow.detect-instance-table-col.create-sandbox'),
            accessor: 'createSandbox',
            renderCell: (cellData: string) => renderStatusCell(cellData, t)
        }
    ];

    // Error Analysis column (common to all)
    const errorAnalysisColumn: ColumnProps = {
        id: registerHostType === DBType.MSSQL ? '6' : '4',
        Header: t('databases.register-flow.detect-instance-table-col.error-analysis'),
        accessor: 'errorAnalysis',
        renderCell: (cellData: string) => renderStatusCell(cellData, t)
    };

    // Build final column list based on database type
    const ColDefs: ColumnProps[] =
        registerHostType === DBType.MSSQL
            ? [...baseColumns, ...mssqlColumns, errorAnalysisColumn]
            : [...baseColumns, errorAnalysisColumn];

    const tableProps = useTable({
        // @ts-ignore
        selectAllProps: false,
        // @ts-ignore
        manageColumnsProps: false,
        isSorting: false,
        selectionType: 'none',
        columns: ColDefs,
        rows: tableRows,
        isHorizontalScroll: false,
        isVerticalScroll: true,
        isLazyLoading: false
    });

    return (
        <div className={styles.instanceReadinessTable}>
            <Table
                // @ts-ignore
                tableProps={tableProps}
                isDoubleRow
            />
        </div>
    );
};

export default InstanceReadinessTable;

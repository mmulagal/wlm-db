import { DsTypography, Table, useTable, Popover } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import styles from './DetectHeader.module.scss';
import { ReactComponent as Success } from '../../../../../../assets/success.svg';
import { ReactComponent as Cross } from '../../../../../../assets/black-cross.svg';
import { ReactComponent as TooltipIcon } from '../../../../../../assets/tooltipGrey.svg';
import { useAppSelector } from '../../../../../../store/storeHooks';
import DotComponent from '../../../../../../common/DotComponent/DotComponent';
import { DBType, MANAGE_STATES } from '../../../../../../utils/consts';
import TooltipCard from '../../../../../../common/TooltipCard/TooltipCard';
import { readinessString } from '../DetectInstanceHelper';

const DetectedInstanceTable = () => {
    const { t } = useTranslation();
    const { bulkDetectedInstanceList, registerHostType } = useAppSelector(state => state.inventoryV2);

    const ColDefs: ColumnProps[] = [
        {
            id: '1',
            Header:
                registerHostType === DBType.MSSQL
                    ? t('databases.register-flow.detect-instance-table-col.instance-name')
                    : t('databases.register-flow.detect-instance-table-col.database-name'),
            accessor: 'instanceName',
            width: '180px',
            isSortable: true
        },
        {
            id: '2',
            Header: t('databases.register-flow.detect-instance-table-col.host-name'),
            accessor: 'hostName',
            width: '180px',
            filterOptions: 'auto',
            isSortable: true
        },
        {
            id: '3',
            Header: t('databases.register-flow.detect-instance-table-col.authenticated-status'),
            accessor: 'authenticationStatus',
            width: '200px',
            filterOptions: 'auto',
            renderCell: (cellData: any) => {
                if (cellData === t('databases.general.authenticated')) {
                    return <DotComponent color="var(--success)" value={cellData} />;
                }
                if (cellData === t('databases.general.unauthenticated')) {
                    return <DotComponent color="var(--toggle-off-bg)" value={cellData} />;
                }
            }
        },
        {
            id: '4',
            Header: t('databases.register-flow.detect-instance-table-col.readiness-status'),
            accessor: 'readinessStatus',
            width: '200px',
            filterOptions: 'auto',
            renderCell: (cellData: any, rowData: any) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {cellData === MANAGE_STATES.READY ? <Success /> : <Cross />}
                    <DsTypography variant="Regular_14">{readinessString(cellData, t)}</DsTypography>
                </div>
            )
        },
        {
            id: '5',
            Header: t('databases.register-flow.detect-instance-table-col.prerequisite-check'),
            accessor: 'readyCount',
            width: '188px',
            filterOptions: 'auto',
            renderCell: (cellData: any, rowData: any) => (
                <div className={styles.tooltipContainer}>
                    <Popover
                        popoverClass=""
                        children={<TooltipCard listObj={rowData?.perRowState} registerFlow />}
                        trigger="hover"
                        isAppendedToBody={false}
                        container={<TooltipIcon />}
                    />
                    <DsTypography variant="Regular_14">{`${cellData}/${rowData?.totalCount}`}</DsTypography>
                </div>
            )
        }
    ];

    const tableProps = useTable({
        // @ts-ignore
        selectAllProps: false,
        // @ts-ignore
        manageColumnsProps: false,
        isSorting: false,
        selectionType: 'none',
        columns: ColDefs,
        rows: bulkDetectedInstanceList,
        isHorizontalScroll: false,
        isVerticalScroll: true,
        isLazyLoading: false
    });

    return (
        <div className={styles.detectInstancetable}>
            <div className={styles.extraDiv} />
            <Table
                // @ts-ignore
                tableProps={tableProps}
                isDoubleRow
                variant="innerTable"
            />
        </div>
    );
};

export default DetectedInstanceTable;

import { DsTypography, Popover } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { DsButton } from '@tlveng/wlm-ds';
import { useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { ColumnProps, Table } from '../../../common/Lib/Table/Table';
import { TableTopBar } from '../../../common/Lib/Table/TableTopBar';
import { useTable } from '../../../common/Lib/Table/useTable';
import styles from './RegisteredResourcesTable.module.scss';
import { useAppSelector } from '../../../store/storeHooks';
import { getAllAssessmentResources, redirectToGetWellPage } from '../WellArchitectedTabUtils';

const RegisteredResourcesTable = () => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const {
        allmssqlHostAssessmentLoading,
        allmssqlHostAssessmentData,
        allOracleHostAssessmentData,
        allOracleHostAssessmentLoading
    } = useAppSelector(state => state.inventoryV2);
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList, multiDataLoading, showNA } =
        useAppSelector(state => state.headers);

    const assessmentResourceData = useMemo(
        () => getAllAssessmentResources(allmssqlHostAssessmentData, allOracleHostAssessmentData),
        [
            allmssqlHostAssessmentData,
            allOracleHostAssessmentData,
            headerSelectedMultiCredIdsList,
            headerSelectedMultiRegionIdsList
        ]
    );

    const loading = useMemo(
        () => allmssqlHostAssessmentLoading || allOracleHostAssessmentLoading || multiDataLoading,
        [allmssqlHostAssessmentLoading, allOracleHostAssessmentLoading, multiDataLoading]
    );

    const handleProgressBar = (cellData: number | string) => {
        if (
            cellData !== 0 &&
            // @ts-ignore
            cellData <= 1
        ) {
            return (
                <div className={styles.progressBar}>
                    <div
                        className={`${styles.progress} ${styles.leftCurveBar} ${styles.rightCurveBar}`}
                        style={{
                            width: `${100}%`,
                            backgroundColor: 'var(--chart-disabled)'
                        }}
                    />
                </div>
            );
        }
        if (
            cellData !== 0 &&
            // @ts-ignore
            cellData >= 1
        ) {
            return (
                <div className={styles.progressBar}>
                    <div
                        className={`${styles.progress} ${styles.leftCurveBar}`}
                        style={{
                            width: `${cellData}%`,
                            backgroundColor: 'var(--chart-4)'
                        }}
                    />
                    <div className={styles.separator} />
                    <div
                        className={`${styles.progress} ${styles.rightCurveBar}`}
                        style={{
                            width: `${100 - (Number(cellData) || 0)}%`,
                            backgroundColor: 'var(--chart-disabled)'
                        }}
                    />
                </div>
            );
        }

        if (cellData === 0) {
            return (
                <div className={styles.progressBar}>
                    <div
                        className={`${styles.progress} ${styles.leftCurveBar} ${styles.rightCurveBar}`}
                        style={{
                            width: `${100}%`,
                            backgroundColor: 'var(--chart-disabled)'
                        }}
                    />
                </div>
            );
        }
    };

    const TableColDefs: ColumnProps[] = [
        {
            Header: t('databases.well-architected-tab.resource-name'),
            accessor: 'databaseInstanceName',
            id: '1',
            isSortable: true,
            width: '320px'
        },

        {
            Header: t('databases.well-architected-tab.engine-type'),
            accessor: 'type',
            id: '2',
            width: '267px',
            filterOptions: 'auto'
        },
        {
            Header: t('databases.well-architected-tab.hostname'),
            accessor: 'hostName',
            id: '3',
            width: '267px',
            filterOptions: 'auto',
            isSortable: true
        },
        {
            Header: t('databases.well-architected-tab.optimization-score'),
            accessor: 'score',
            id: '4',
            width: '347px',
            isSortable: true,
            renderCell: (cellData: string) => (
                <div className={styles.barContainer}>
                    {handleProgressBar(cellData)}
                    <div className={styles.scoreText}>
                        <DsTypography variant="Semibold_14">{cellData}</DsTypography>
                        <DsTypography variant="Semibold_14">%</DsTypography>
                    </div>
                </div>
            )
        },
        {
            Header: '',
            accessor: '',
            id: '5',
            width: '248px',
            isSortable: false,
            renderCell: (_: any, rowData: any) => (
                <div className={styles.buttonContainer}>
                    <div />
                    <Popover
                        isAppendedToBody
                        children={
                            <DsTypography variant="Regular_14">
                                {t('databases.well-architected-tab.resource-view-fix-hover-msg')}
                            </DsTypography>
                        }
                        trigger="hover"
                        container={
                            <DsButton
                                variant="secondary"
                                isThin
                                onClick={() => {
                                    redirectToGetWellPage(dispatch, rowData);
                                }}
                            >
                                {t('databases.general.view-and-fix')}
                            </DsButton>
                        }
                    />
                </div>
            )
        }
    ];

    const tableProps = useTable({
        // @ts-ignore
        manageColumnsProps: false,
        isHorizontalScroll: true,
        isSorting: false,
        columns: TableColDefs,
        rows: assessmentResourceData || [],
        pageSize: 50,
        selectionType: 'none',
        isLazyLoading: loading
    });
    return (
        <div className={styles['registered-resources']}>
            <TableTopBar
                // @ts-ignore
                tableProps={tableProps}
                pluralTitle={t('databases.well-architected-tab.registered-resources')}
                singularTitle={t('databases.well-architected-tab.registered-resource')}
            />

            <Table
                // @ts-ignore
                tableProps={tableProps}
                isDoubleRow
            />
        </div>
    );
};

export default RegisteredResourcesTable;

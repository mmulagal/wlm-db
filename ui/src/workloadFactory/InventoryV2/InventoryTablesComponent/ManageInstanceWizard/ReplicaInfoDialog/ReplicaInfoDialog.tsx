import React, { useEffect, useMemo } from 'react';
import { DsTypography } from '@tlveng/wlm-ds';
import { Popover, RadioButton, Table, TableTopBar, useTable } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import styles from './ReplicaInfoDialog.module.scss';
import { ReactComponent as Optimized } from '../../../../../assets/optimized.svg';
import { ReactComponent as ErrorIcon } from '../../../../../assets/error-icon.svg';
import {
    setRegisterReplicaSelection,
    setReplicaSelectedRowsForManage,
    setReplicaSelectionForAuth
} from '../../../../../store/workloadFactory/inventoryV2Slice';
import { useAppSelector } from '../../../../../store/storeHooks';
import { ReactComponent as TooltipIcon } from '../../../../../assets/tooltipGrey.svg';
import { getSelectedFromSelectionState } from '../../../../../utils/utilityFunctions';
import { InstanceAuthStatusMap } from '../../../../../utils/types/inventoryV2Types';
import { DBType, RESPONSE_STATUS } from '../../../../../utils/consts';

interface ReplicaInfoDialogProps {
    instance: any;
    replicaList: any[];
    authStatusMap?: InstanceAuthStatusMap;
    showFailedState?: boolean;
    databaseType?: string;
}

const ReplicaInfoDialog: React.FC<ReplicaInfoDialogProps> = ({
    instance,
    replicaList,
    authStatusMap,
    showFailedState = false,
    databaseType = DBType.MSSQL
}) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { registerReplicaSelection, replicaSelectionForAuth } = useAppSelector(state => state.inventoryV2);
    const detectReplicaHostLoading = useAppSelector(state => state.msSqlAction.isDetectReplicaHostLoading);

    // Determine if this is Oracle database type
    const isOracle = databaseType === DBType.ORACLE;

    // Calculate failed instances count
    const failedCount = authStatusMap
        ? Object.values(authStatusMap).filter(status => status?.toLowerCase() === RESPONSE_STATUS.FAILED.toLowerCase())
              .length
        : 0;
    const totalCount = replicaList?.length || 0;

    /**
     * Get deployment model display text for Oracle Data Guard
     * Shows Primary or Standby based on isPrimaryNode flag
     */
    const getOracleDeploymentModel = (rowData: any) => {
        const isPrimary = rowData?.dataguardDetails?.isPrimaryNode;
        if (isPrimary === true) {
            return `${t('databases.general.dataguard')} (${t('databases.general.primary')})`;
        }
        return `${t('databases.general.dataguard')} (${t('databases.general.standby')})`;
    };

    // Define MSSQL-specific columns
    const mssqlColumns: ColumnProps[] = [
        {
            id: '1',
            accessor: 'databaseInstanceName',
            Header: t('databases.register-flow.detect-instance-table-col.instance-name'),
            isSortable: true,
            width: 'auto',
            renderCell: (cellData: any) => (
                <DsTypography variant="Regular_13">
                    {cellData || t('databases.general.not-available-table-columns')}
                </DsTypography>
            )
        },
        {
            id: '2',
            accessor: 'name',
            Header: t('databases.register-flow.detect-instance-table-col.host-name'),
            isSortable: true,
            width: 'auto',
            renderCell: (cellData: any) => (
                <DsTypography variant="Regular_13">
                    {cellData || t('databases.general.not-available-table-columns')}
                </DsTypography>
            )
        },
        {
            id: '3',
            accessor: 'availabilityGroups',
            Header: t('databases.register-flow.replica-info-dialog.availability-group'),
            isSortable: true,
            width: 'auto',
            renderCell: (cellData: string, rowData: any) => {
                const availabilityGroupList = rowData?.availabilityGroupList || [];
                const hasMultipleGroups = availabilityGroupList.length > 1;
                const hasSingleGroup = availabilityGroupList.length === 1;

                return (
                    <>
                        {hasMultipleGroups && (
                            <div className={styles.agContainer}>
                                <div>
                                    <Popover
                                        popoverClass=""
                                        children={
                                            <div
                                                className={`${styles.tooltipContainer} ${styles.tooltipContainerMulti} ${styles.fsxNamePopOver}`}
                                            >
                                                <DsTypography variant="Semibold_13" className={styles.colText}>
                                                    {t('databases.general.availability-groups')}:
                                                </DsTypography>
                                                {availabilityGroupList.map((group: any, index: number) => (
                                                    <div key={index}>
                                                        <DsTypography variant="Regular_13">
                                                            {group ||
                                                                t('databases.general.not-available-table-columns')}
                                                        </DsTypography>
                                                    </div>
                                                ))}
                                            </div>
                                        }
                                        trigger="hover"
                                        delayHide={200}
                                        interactive
                                        isAppendedToBody={false}
                                        container={<TooltipIcon />}
                                    />
                                </div>
                                <div className={styles.agName}>
                                    <DsTypography
                                        className={styles.agNameText}
                                        variant="Regular_13"
                                        title={`${availabilityGroupList.length} ${t(
                                            'databases.general.availability-groups'
                                        )}`}
                                    >
                                        {`${availabilityGroupList.length} ${t(
                                            'databases.general.availability-groups'
                                        )}`}
                                    </DsTypography>
                                </div>
                            </div>
                        )}
                        {hasSingleGroup && <DsTypography variant="Regular_13">{availabilityGroupList[0]}</DsTypography>}
                        {availabilityGroupList.length === 0 && (
                            <DsTypography variant="Regular_13">
                                {t('databases.general.not-available-table-columns')}
                            </DsTypography>
                        )}
                    </>
                );
            }
        }
    ];

    // Define Oracle-specific columns (Database name, SID, Deployment model)
    const oracleColumns: ColumnProps[] = [
        {
            id: '1',
            accessor: 'databaseInstanceName',
            Header: t('databases.register-flow.replica-info-dialog.database-name'),
            isSortable: true,
            width: 'auto',
            renderCell: (cellData: any, rowData: any) => {
                // For Oracle, prefer dataguardDetails.dbName if available
                const dbName = rowData?.dataguardDetails?.dbName || cellData;
                return (
                    <DsTypography variant="Regular_13">
                        {dbName || t('databases.general.not-available-table-columns')}
                    </DsTypography>
                );
            }
        },
        {
            id: '2',
            accessor: 'dataguardDetails.dbUniqueName',
            Header: t('databases.register-flow.replica-info-dialog.sid'),
            isSortable: true,
            width: 'auto',
            renderCell: (cellData: any, rowData: any) => {
                const sid = rowData?.dataguardDetails?.dbUniqueName || rowData?.databaseInstanceName;
                return (
                    <DsTypography variant="Regular_13">
                        {sid || t('databases.general.not-available-table-columns')}
                    </DsTypography>
                );
            }
        },
        {
            id: '3',
            accessor: 'serverInstallationMode',
            Header: t('databases.register-flow.replica-info-dialog.deployment-model'),
            isSortable: true,
            width: 'auto',
            renderCell: (cellData: any, rowData: any) => (
                <DsTypography variant="Regular_13">{getOracleDeploymentModel(rowData)}</DsTypography>
            )
        }
    ];

    // Authentication status column (shared between Oracle and MSSQL)
    const authStatusColumn: ColumnProps = {
        id: '4',
        accessor: 'authenticationStatus',
        Header: t('databases.register-flow.authentication-status'),
        isSortable: true,
        width: 'auto',
        renderCell: (_cellData: any, rowData: any) => {
            const instanceId = rowData?.databaseInstanceName;
            const status = instanceId ? authStatusMap?.[instanceId] : undefined;
            const isSuccess = status?.toLowerCase() === RESPONSE_STATUS.SUCCESS.toLowerCase();
            const isFailed = status?.toLowerCase() === RESPONSE_STATUS.FAILED.toLowerCase();

            return (
                <div className={styles.authStatus}>
                    {isSuccess && (
                        <>
                            <Optimized />
                            <DsTypography variant="Regular_14">{t('databases.register-flow.success')}</DsTypography>
                        </>
                    )}
                    {isFailed && (
                        <>
                            <ErrorIcon />
                            <DsTypography variant="Regular_14">{t('databases.register-flow.failed')}</DsTypography>
                        </>
                    )}
                    {!isSuccess && !isFailed && (
                        <DsTypography variant="Regular_14">
                            {t('databases.general.not-available-table-columns')}
                        </DsTypography>
                    )}
                </div>
            );
        }
    };

    // Build columns based on database type
    const allColumns: ColumnProps[] = useMemo(() => {
        const baseColumns = isOracle ? oracleColumns : mssqlColumns;
        return authStatusMap ? [...baseColumns, authStatusColumn] : baseColumns;
    }, [isOracle, authStatusMap]);

    // Map rows to add cellProps for disabling selection when loading
    const updatedReplicaList = (replicaList || []).map((row: any) => ({
        ...row,
        cellProps: {
            ...row.cellProps,
            isDisabled: detectReplicaHostLoading || showFailedState,
            selectionProps: {
                title: ''
            }
        }
    }));

    const tableProps = useTable({
        isSorting: false,
        columns: allColumns,
        rows: updatedReplicaList,
        selectionType: 'multiple',
        defaultSelectedRows: [],
        selectAllProps: {
            isDisabled: detectReplicaHostLoading || showFailedState
        }
    });

    useEffect(() => {
        const rowsData = getSelectedFromSelectionState(tableProps.selectionState, replicaList || []);
        dispatch(setReplicaSelectedRowsForManage(rowsData));
    }, [tableProps.selectionState]);

    // Get type-specific labels
    const typeLabel = isOracle
        ? t('databases.register-flow.replica-info-dialog.database')
        : t('databases.register-flow.replica-info-dialog.instance');
    const typeLabelPlural = isOracle
        ? t('databases.register-flow.replica-info-dialog.databases')
        : t('databases.register-flow.replica-info-dialog.instances');
    const relatedTitle = isOracle
        ? t('databases.register-flow.replica-info-dialog.related-databases')
        : t('databases.register-flow.replica-info-dialog.related-instances');
    const deploymentModel = isOracle ? t('databases.general.dataguard') : t('databases.general.aoag');

    return (
        <div className={styles.replicaDialog}>
            <div className={styles.topSection}>
                {showFailedState && failedCount > 0 ? (
                    <>
                        <div className={styles.errorMessage}>
                            <ErrorIcon />
                            {failedCount === totalCount ? (
                                <DsTypography variant="Semibold_16">
                                    {t(
                                        'databases.register-flow.replica-info-dialog.all-authentication-failed-message-generic',
                                        {
                                            failedCount,
                                            type: typeLabelPlural
                                        }
                                    )}
                                </DsTypography>
                            ) : (
                                <DsTypography variant="Semibold_16">
                                    {t(
                                        'databases.register-flow.replica-info-dialog.authentication-failed-message-generic',
                                        {
                                            failedCount,
                                            totalCount,
                                            type: typeLabelPlural
                                        }
                                    )}
                                </DsTypography>
                            )}
                        </div>

                        <div className={styles.radioGroupFailed}>
                            <RadioButton
                                id="authenticate-with-different-credentials"
                                isChecked={replicaSelectionForAuth}
                                onChange={() => {
                                    dispatch(setReplicaSelectionForAuth(true));
                                }}
                                children={t(
                                    'databases.register-flow.replica-info-dialog.authenticate-different-credentials-generic',
                                    { type: typeLabelPlural }
                                )}
                                className=""
                                isDisabled={detectReplicaHostLoading}
                            />
                            <RadioButton
                                id="proceed-without-authenticating"
                                isChecked={!replicaSelectionForAuth}
                                onChange={() => {
                                    dispatch(setReplicaSelectionForAuth(false));
                                }}
                                children={t(
                                    'databases.register-flow.replica-info-dialog.proceed-without-authenticating-generic',
                                    { type: typeLabelPlural }
                                )}
                                className=""
                                isDisabled={detectReplicaHostLoading}
                            />
                        </div>
                    </>
                ) : (
                    <>
                        <div className={styles.successMessage}>
                            <Optimized />
                            <DsTypography variant="Semibold_16">
                                {t('databases.register-flow.replica-info-dialog.authenticated-successfully-generic', {
                                    type: typeLabel,
                                    name: instance?.databaseInstanceName
                                })}
                            </DsTypography>
                        </div>

                        <div className={styles.description}>
                            <DsTypography variant="Regular_14">
                                {databaseType === DBType.ORACLE
                                    ? t('databases.register-flow.replica-info-dialog.identified-message-generic', {
                                          count: replicaList?.length,
                                          type: typeLabelPlural,
                                          deploymentModel
                                      })
                                    : t('databases.register-flow.replica-info-dialog.identified-instances-message', {
                                          count: replicaList?.length
                                      })}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                {t('databases.register-flow.replica-info-dialog.proceed-authenticate-message-generic', {
                                    type: typeLabelPlural
                                })}
                            </DsTypography>
                        </div>

                        <div className={styles.radioGroup}>
                            <RadioButton
                                id="authenticate-related-instance"
                                isChecked={registerReplicaSelection}
                                onChange={() => {
                                    dispatch(setRegisterReplicaSelection(true));
                                }}
                                children={t(
                                    'databases.register-flow.replica-info-dialog.yes-authenticate-related-generic',
                                    {
                                        type: typeLabelPlural
                                    }
                                )}
                                className=""
                                isDisabled={detectReplicaHostLoading}
                            />
                            <RadioButton
                                id="no-authenticate-related-instance"
                                isChecked={!registerReplicaSelection}
                                onChange={() => {
                                    dispatch(setRegisterReplicaSelection(false));
                                }}
                                children={t('databases.register-flow.replica-info-dialog.no-continue-next-step')}
                                className=""
                                isDisabled={detectReplicaHostLoading}
                            />
                        </div>
                    </>
                )}
            </div>

            <div className={styles.tableSection}>
                <TableTopBar
                    // @ts-ignore
                    tableProps={tableProps}
                    pluralTitle={relatedTitle}
                    singularTitle={relatedTitle}
                />

                <Table
                    // @ts-ignore
                    tableProps={tableProps}
                    variant="innerTable"
                />
            </div>
        </div>
    );
};

export default ReplicaInfoDialog;

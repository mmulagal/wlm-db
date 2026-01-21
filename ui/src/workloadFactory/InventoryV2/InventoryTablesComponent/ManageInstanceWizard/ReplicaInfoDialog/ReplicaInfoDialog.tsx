import React, { useEffect } from 'react';
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
import { RESPONSE_STATUS } from '../../../../../utils/consts';

interface ReplicaInfoDialogProps {
    instance: any;
    replicaList: any[];
    authStatusMap?: InstanceAuthStatusMap;
    showFailedState?: boolean;
}

const ReplicaInfoDialog: React.FC<ReplicaInfoDialogProps> = ({
    instance,
    replicaList,
    authStatusMap,
    showFailedState = false
}) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { registerReplicaSelection, replicaSelectionForAuth } = useAppSelector(state => state.inventoryV2);
    const detectReplicaHostLoading = useAppSelector(state => state.msSqlAction.isDetectReplicaHostLoading);

    // Calculate failed instances count
    const failedCount = authStatusMap
        ? Object.values(authStatusMap).filter(status => status?.toLowerCase() === RESPONSE_STATUS.FAILED.toLowerCase())
              .length
        : 0;
    const totalCount = replicaList?.length || 0;

    const allColumns: ColumnProps[] = [
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
                                        )}s`}
                                    >
                                        {`${availabilityGroupList.length} ${t(
                                            'databases.general.availability-groups'
                                        )}s`}
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
        },
        // Add authentication status column when authStatusMap is provided
        ...(authStatusMap
            ? [
                  {
                      id: '4',
                      accessor: 'authenticationStatus',
                      Header: t('databases.register-flow.authentication-status'),
                      isSortable: true,
                      width: 'auto',
                      renderCell: (_cellData: any, rowData: any) => {
                          const instanceId = rowData?.databaseInstanceName;
                          const status = instanceId ? authStatusMap[instanceId] : undefined;
                          const isSuccess = status?.toLowerCase() === RESPONSE_STATUS.SUCCESS.toLowerCase();
                          const isFailed = status?.toLowerCase() === RESPONSE_STATUS.FAILED.toLowerCase();

                          return (
                              <div className={styles.authStatus}>
                                  {isSuccess && (
                                      <>
                                          <Optimized />
                                          <DsTypography variant="Regular_14">
                                              {t('databases.register-flow.success')}
                                          </DsTypography>
                                      </>
                                  )}
                                  {isFailed && (
                                      <>
                                          <ErrorIcon />
                                          <DsTypography variant="Regular_14">
                                              {t('databases.register-flow.failed')}
                                          </DsTypography>
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
                  } as ColumnProps
              ]
            : [])
    ];

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
                                        'databases.register-flow.replica-info-dialog.all-authentication-failed-message',
                                        {
                                            failedCount
                                        }
                                    )}
                                </DsTypography>
                            ) : (
                                <DsTypography variant="Semibold_16">
                                    {t('databases.register-flow.replica-info-dialog.authentication-failed-message', {
                                        failedCount,
                                        totalCount
                                    })}
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
                                    'databases.register-flow.replica-info-dialog.authenticate-different-credentials'
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
                                    'databases.register-flow.replica-info-dialog.proceed-without-authenticating'
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
                                {t('databases.register-flow.replica-info-dialog.instances-authenticated-successfully', {
                                    instanceName: instance?.databaseInstanceName
                                })}
                            </DsTypography>
                        </div>

                        <div className={styles.description}>
                            <DsTypography variant="Regular_14">
                                {t('databases.register-flow.replica-info-dialog.identified-instances-message', {
                                    count: replicaList?.length
                                })}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                {t('databases.register-flow.replica-info-dialog.proceed-authenticate-message')}
                            </DsTypography>
                        </div>

                        <div className={styles.radioGroup}>
                            <RadioButton
                                id="authenticate-related-instance"
                                isChecked={registerReplicaSelection}
                                onChange={() => {
                                    dispatch(setRegisterReplicaSelection(true));
                                }}
                                children={t('databases.register-flow.replica-info-dialog.yes-authenticate-related')}
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
                    pluralTitle={t('databases.register-flow.replica-info-dialog.related-instances')}
                    singularTitle={t('databases.register-flow.replica-info-dialog.related-instances')}
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

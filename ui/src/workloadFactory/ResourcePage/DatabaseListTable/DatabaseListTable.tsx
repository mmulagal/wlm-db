import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import classNames from 'classnames';
import { Button, TooltipInfo, useDialog } from '@netapp/design-system';
import { DsFlashingDotsLoader, DsTypography } from '@tlveng/wlm-ds';
import commonStyles from '../../../utils/CommonStyles.module.scss';
import styles from './DatabaseListTable.module.scss';
import { WorkloadFactoryDatabaseItem } from '../../../utils/types/workloadFactoryResourceTypes';
import { useAppDispatch, useAppSelector } from '../../../store/storeHooks';
import { formatSize, expandTableRow, isAoagDeploymentType, hasAoagReplicas } from '../../../utils/utilityFunctions';
import { getProtectionText } from '../../InventoryV2/InventoryUtilsV2';
import { getLunFilterOptions, getUniqueLunNames } from '../../WellArchitectedTab/WellArchitectedTabUtils';
import { PROTECTION_TEXT_STATUS, REPLICA_ROLES } from '../../../utils/consts';
import InventoryStatusIndicator from '../../../common/InventoryStatusIndicator/InventoryStatusIndicator';
import DatabaseHostOverviewApiV2 from '../ResourceHomePage/DatabaseHostOverviewApiV2';
import {
    addInitialDBCreateData,
    initialCreateNewUserState,
    setCdbPageData
} from '../../../store/workloadFactory/createNewDBSlice';
import { updateResourceId } from '../../../store/authSlice';
import ProtectionIcons from '../../../common/ProtectionIcons/ProtectionIcons';
import { useTable } from '../../../common/Lib/Table/useTable';
import { TableTopBar } from '../../../common/Lib/Table/TableTopBar';
import { Table, ColumnProps } from '../../../common/Lib/Table/Table';
import { ReactComponent as ArrowIcon } from '../../../assets/row_arrow.svg';
import ResourcePageReplicaTable from './ResourcePageReplicaTable';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import AssociatedLunsDialogContent from './AssociatedLunsDialogContent';

const DatabaseListTable = () => {
    const { t } = useTranslation();
    const { selectedHostname, selectedDatabaseInstanceName, selectedDatabaseStorageType } = useAppSelector(
        state => state.getWellOptimize
    );
    const {
        resourceLoading: resourceLoadingState,
        resourceDetails,
        databaseList: data,
        databaseListLoading,
        replicaDatabasesMap,
        replicaDatabasesLoading,
        selectedDatabaseInstance,
        selectedResourceId,
        selectedResourceCredId,
        selectedResourceRegionId
    } = useAppSelector(state => state.workloadFactoryResource);
    const dispatch = useAppDispatch();
    DatabaseHostOverviewApiV2();
    const navigate = useNavigate();
    const { setDialog } = useDialog();
    const databaseTableRef = useRef<HTMLDivElement>(null);
    const [tableWidth, setTableWidth] = useState(0);

    useEffect(() => {
        const element = databaseTableRef.current;
        if (!element) {
            return undefined;
        }
        setTableWidth(element.offsetWidth);
        const observer = new ResizeObserver(entries => {
            const newWidth = entries[0]?.contentRect.width ?? 0;
            setTableWidth(prev => (prev !== newWidth ? newWidth : prev));
        });
        observer.observe(element);
        return () => {
            observer.disconnect();
        };
    }, []);

    const enrichedData = useMemo(() => {
        if (!data?.length) return [];

        const allReplicaDbs: WorkloadFactoryDatabaseItem[] = [];
        Object.values(replicaDatabasesMap || {}).forEach(dbs => {
            allReplicaDbs.push(...(dbs || []));
        });

        return data.map(db => {
            if (!db.availabilityGroup) {
                return db;
            }

            const matchingReplicas = allReplicaDbs.filter(
                replicaDb => replicaDb.availabilityGroup === db.availabilityGroup && replicaDb.name === db.name
            );

            if (matchingReplicas.length === 0) return db;

            return { ...db, replicaDatabases: matchingReplicas };
        });
    }, [data, replicaDatabasesMap]);

    const formatData = (tableData: WorkloadFactoryDatabaseItem[]) =>
        tableData?.map(perRow => {
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
                isProtected: protectionVal,
                lunPaths: getUniqueLunNames(perRow?.luns)
            };
        });

    const formattedRows = useMemo(() => formatData(enrichedData) || [], [enrichedData, t]);

    const lunFilterOptions = useMemo(() => getLunFilterOptions(formattedRows), [formattedRows]);

    const notAvailable = () => (
        <DsTypography variant="Regular_13" className={styles.colText}>
            {t('databases.general.not-available')}
        </DsTypography>
    );

    const isAoag =
        isAoagDeploymentType(selectedDatabaseStorageType) ||
        isAoagDeploymentType(resourceDetails?.sqlServerDeploymentType);

    const EncryptionColDefs: ColumnProps[] = [
        {
            Header: t('databases.general.database-name'),
            accessor: 'name',
            isSortable: true,
            id: '1',
            width: '15%',
            renderCell: (_cellData: any, rowData: any) => {
                const name = rowData?.name;
                return (
                    <div>
                        <DsTypography variant="Semibold_14">
                            {name || t('databases.general.not-available-table-columns')}
                        </DsTypography>
                        <div className={styles.firstColText}>
                            <InventoryStatusIndicator status={rowData?.status} loading={rowData?.loading} />
                        </div>
                    </div>
                );
            }
        },
        {
            Header: t('databases.general.size'),
            accessor: 'size',
            isSortable: true,
            id: '3',
            width: 'auto',
            renderCell: (cellData: any) => (
                <DsTypography variant="Regular_13" className={styles.colText}>
                    {formatSize(cellData)}
                </DsTypography>
            )
        },
        {
            Header: t('databases.resource-overview.associated_luns'),
            accessor: 'luns',
            customAccessor: 'lunPaths',
            accessorForTextFilter: 'lunPaths',
            filterOptions: lunFilterOptions.length > 0 ? lunFilterOptions : undefined,
            id: '8',
            width: 'auto',
            renderCell: (_cellData: any, rowData: any) => {
                if (!rowData?.luns) {
                    return notAvailable();
                }
                const count = (rowData?.lunPaths || []).length;
                return (
                    <div className={styles.lunsCell}>
                        <DsTypography variant="Regular_14">{count}</DsTypography>
                        {count > 0 && (
                            <Button
                                variant="text"
                                onClick={e => {
                                    e.stopPropagation();
                                    setDialog(
                                        <DialogComponent
                                            header={t('databases.resource-overview.associated_luns')}
                                            content={<AssociatedLunsDialogContent luns={rowData?.luns} />}
                                            primaryButton={t('databases.general.close')}
                                            callback={() => {}}
                                        />
                                    );
                                }}
                            >
                                {t('databases.general.view')}
                            </Button>
                        )}
                    </div>
                );
            }
        },
        {
            Header: t('databases.general.protection-type'),
            accessor: 'isProtected',
            filterOptions: 'auto',
            id: '4',
            width: '20%',
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
        ...(isAoag
            ? [
                  {
                      Header: t('databases.general.availability-group'),
                      accessor: 'availabilityGroup',
                      filterOptions: 'auto' as const,
                      id: '7',
                      width: 'auto',
                      renderCell: (cellData: any, rowData: any) => {
                          if (!cellData)
                              return (
                                  <div className={styles.naWithTooltip}>
                                      <TooltipInfo trigger="hover">
                                          <div>
                                              <DsTypography variant="Regular_13">
                                                  {t('databases.general.availability-group-na-tooltip')}
                                              </DsTypography>
                                          </div>
                                      </TooltipInfo>
                                      <DsTypography variant="Regular_14">
                                          {t('databases.general.not-available')}
                                      </DsTypography>
                                  </div>
                              );
                          const role = rowData?.replicaRole?.toUpperCase();
                          let roleText = '';
                          if (role === REPLICA_ROLES.PRIMARY) {
                              roleText = t('databases.general.primary');
                          } else if (role === REPLICA_ROLES.SECONDARY) {
                              roleText = t('databases.general.secondary');
                          }
                          const replicaCount = rowData?.replicaDatabases?.length || 0;
                          const replicaWord =
                              replicaCount !== 1
                                  ? t('databases.general.replicas').toLowerCase()
                                  : t('databases.general.replica').toLowerCase();
                          const replicaLabel = `${replicaCount} ${replicaWord}`;
                          return (
                              <div>
                                  <DsTypography variant="Regular_14">{cellData}</DsTypography>
                                  {roleText && (
                                      <DsTypography variant="Regular_12" className={styles.colText}>
                                          {`${roleText} | `}
                                          {replicaDatabasesLoading ? <DsFlashingDotsLoader /> : replicaLabel}
                                      </DsTypography>
                                  )}
                              </div>
                          );
                      }
                  }
              ]
            : []),
        {
            Header: t('databases.general.type'),
            accessor: 'type',
            filterOptions: 'auto',
            id: '5',
            width: 'auto'
        },
        {
            Header: t('databases.general.collation'),
            accessor: 'collation',
            isSortable: true,
            id: '6',
            width: 'auto',
            renderCell: (cellData: any) => cellData || t('databases.general.not-available')
        }
    ];

    const ExpandedRow = useCallback(
        ({ rowData }: any) => (
            <ResourcePageReplicaTable
                width={tableWidth}
                replicaDatabases={rowData?.replicaDatabases || []}
                isLoading={replicaDatabasesLoading}
            />
        ),
        [tableWidth, replicaDatabasesLoading]
    );

    const tableComponentProps = {
        ExpandedRow,
        lazyLoadingText: 'Loading'
    };

    const tableProps = useTable({
        selectionType: 'none',
        isSorting: false,
        columns: EncryptionColDefs,
        rows: formattedRows,
        pageSize: 50,
        isLazyLoading: databaseListLoading,
        isHorizontalScroll: true,
        additionalSearchKeys: ['lunPaths'],
        isManagedColumns: isAoag,
        ...(isAoag && {
            manageColumnsProps: {
                Header: null,
                width: '56px',
                renderCell: (_cellData: any, rowData: any, { updateRowState, rowsState }: any) => {
                    const currentRowState = rowsState[rowData.id];
                    if (!hasAoagReplicas(rowData)) return null;
                    return (
                        <div className={styles.arrowContainer}>
                            <ArrowIcon
                                className={classNames({ [styles['arrow-down']]: currentRowState?.isExpanded })}
                                onClick={(e: any) => {
                                    e.stopPropagation();
                                    expandTableRow(updateRowState, rowData, currentRowState, rowsState);
                                }}
                            />
                        </div>
                    );
                }
            }
        })
    });

    return (
        <div className={styles.databaseListTable} ref={databaseTableRef}>
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
                            data-testid="wlm-db-create-new-database-button"
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
                            {t('databases.general.create-database')}
                        </Button>
                    </div>
                }
            />
            <Table
                {...tableComponentProps}
                // @ts-ignore
                tableProps={tableProps}
                isDoubleRow
            />
        </div>
    );
};

export default DatabaseListTable;

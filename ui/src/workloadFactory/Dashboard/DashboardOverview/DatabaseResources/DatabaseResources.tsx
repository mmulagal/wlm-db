import { DsButton, DsFlashingDotsLoader, DsTypography } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { BlueXPListeners, postBlueXPMessage } from '@tlveng/wlm-ds/src/hooks/useBlueXP';
import { TooltipInfo } from '@netapp/design-system';
import { useMemo } from 'react';
import styles from './DatabaseResources.module.scss';
import { ReactComponent as TooltipDisabled } from '../../../../assets/tooltipDisabled.svg';
import { setDatabaseHostEntryPoint } from '../../../../store/mssql/msSqlActionSlice';
import { setSelectedDatabaseType } from '../../../../store/postgre/postgreFormSlice';
import { DBType, WLF_TABS, WLF_TO_FORM_NAVIGATE, WLF_TO_PROTECT_NAVIGATE } from '../../../../utils/consts';
import { useAppSelector } from '../../../../store/storeHooks';
import DatabaseOverviewChart from '../DatabaseOverviewChart/DatabaseOverviewChart';
import Square from '../../../../common/Square/Square';
import SeparatorComponent from '../../../../common/SeparatorComponent/SeparatorComponent';
import ResourcesTooltipComponent from './ResourcesTooltipComponent/ResourcesTooltipComponent';
import {
    setSelectedHeaderTab,
    setSelectedHostType,
    setSelectedInventoryTab
} from '../../../../store/workloadFactory/inventoryV2Slice';
import {
    setNotRegisteredOracleDatabasesView,
    setNotRegisteredSQLView
} from '../../../../store/workloadFactory/inventorybannerSlice';

const DatabaseResources = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { isWorkloadFactory } = useAppSelector(state => state.auth);
    const mssqlHostData = useAppSelector(state => state.databaseHome.aggregatedHostsCount);
    const pgsqlHostData = useAppSelector(state => state.databaseHome.aggregatedPgSqlHostsCount);
    const oracleHostData = useAppSelector(state => state.databaseHome.aggregatedOracleHostsCount);
    const mssqlDatabaseHostsLoading = useAppSelector(state => state.inventoryV2.getDatabaseHosts.databaseHostsLoading);
    const pgsqlDatabaseHostsLoading = useAppSelector(
        state => state.inventoryV2.getPgSqlDatabaseHosts.databaseHostsLoading
    );
    const oracleDatabaseHostsLoading = useAppSelector(
        state => state.inventoryV2.getOracleDatabaseHosts.databaseHostsLoading
    );
    const { multiDataLoading, showNA: naCheck } = useAppSelector(state => state.headers);
    const loading =
        mssqlDatabaseHostsLoading || pgsqlDatabaseHostsLoading || oracleDatabaseHostsLoading || multiDataLoading;
    const showNA = naCheck;

    const ChartComponent = useMemo(
        () => () =>
            (
                <DatabaseOverviewChart
                    color1="#0BAFFC"
                    color2="#A815F3"
                    color3="#68C6B3"
                    data1={mssqlHostData?.totalInstances || 0}
                    data2={oracleHostData?.totalInstances || 0}
                    data3={pgsqlHostData?.totalInstances || 0}
                    centerText={t('databases.dashboard.resources')}
                    centerValue={`${
                        (mssqlHostData?.totalInstances || 0) +
                        (oracleHostData?.totalInstances || 0) +
                        (pgsqlHostData?.totalInstances || 0)
                    }`}
                    loading={loading}
                    isDisabled={naCheck}
                />
            ),
        [mssqlHostData, oracleHostData, pgsqlHostData, loading, showNA]
    );

    return (
        <div className={styles.databaseResources}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    {t('databases.dashboard.database-resources')}
                </DsTypography>

                <div className={styles.buttonContainer}>
                    <DsButton
                        children={t('databases.dashboard.deploy-database-host')}
                        variant="secondary"
                        isThin
                        dropDown={{
                            trigger: 'click',
                            autoPosition: true,
                            items: [
                                {
                                    id: 'wlm-db-deploy-mssql-host',
                                    label: t('databases.dashboard.ms-sql-server'),
                                    onClick: () => {
                                        dispatch(setDatabaseHostEntryPoint('database'));
                                        dispatch(setSelectedDatabaseType(DBType.MSSQL));
                                        // navigate(WLF_TO_FORM_NAVIGATE);
                                        if (isWorkloadFactory) {
                                            navigate(WLF_TO_FORM_NAVIGATE);
                                            postBlueXPMessage({
                                                type: BlueXPListeners.navigate,
                                                payload: {
                                                    pathname: './mssql-deploy-wizard',
                                                    replace: true
                                                }
                                            });
                                        } else {
                                            navigate('../../fsxdb/mssql-deploy-wizard');
                                            postBlueXPMessage({
                                                type: BlueXPListeners.navigate,
                                                payload: {
                                                    pathname: '../../fsxdb/mssql-deploy-wizard',
                                                    replace: true
                                                }
                                            });
                                        }
                                    },
                                    className: 'mssql-deployment-button'
                                },
                                {
                                    id: 'wlm-db-deploy-pgsql-host',
                                    label: t('databases.dashboard.pg-sql-server'),
                                    onClick: () => {
                                        dispatch(setDatabaseHostEntryPoint('database'));
                                        dispatch(setSelectedDatabaseType(DBType.POSTGRESQL));
                                        if (isWorkloadFactory) {
                                            navigate(WLF_TO_PROTECT_NAVIGATE);
                                            postBlueXPMessage({
                                                type: BlueXPListeners.navigate,
                                                payload: {
                                                    pathname: './postgreSQL-deploy-wizard',
                                                    replace: true
                                                }
                                            });
                                        } else {
                                            navigate('../../fsxdb/postgreSQL-deploy-wizard');
                                            postBlueXPMessage({
                                                type: BlueXPListeners.navigate,
                                                payload: {
                                                    pathname: '../../fsxdb/postgreSQL-deploy-wizard',
                                                    replace: true
                                                }
                                            });
                                        }
                                    },
                                    className: 'pgsql-deployment-button'
                                }
                            ]
                        }}
                    />
                </div>
            </div>

            <div className={styles.mainSection}>
                <div className={styles.chartContainer}>
                    <ChartComponent />
                </div>

                <div className={styles.infoContainer}>
                    <div className={styles.item}>
                        <div className={styles.row}>
                            <div className={styles.leftSide}>
                                <Square width="12px" height="12px" background="var(--chart-3)" />
                                <DsTypography className={showNA ? styles.disabled : ''} variant="Semibold_14">
                                    {t('databases.dashboard.microsoft-sql-server-instances')}
                                </DsTypography>
                            </div>

                            {!showNA && (
                                <div className={styles.textClass}>
                                    <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                                        {mssqlHostData?.totalInstances || 0}
                                    </DsTypography>

                                    {loading && <DsFlashingDotsLoader />}
                                </div>
                            )}

                            {showNA && (
                                <DsTypography variant="Regular_14" className={styles.disabled}>
                                    {t('databases.general.not-available-table-columns')}
                                </DsTypography>
                            )}
                        </div>

                        <SeparatorComponent variant="horizontal" />

                        <div className={styles.row}>
                            <DsTypography className={showNA ? styles.disabled : ''} variant="Regular_14">
                                {t('databases.dashboard.registered-instances')}
                            </DsTypography>

                            {!showNA && (
                                <div className={styles.textClass}>
                                    <DsTypography variant="Semibold_16" style={{ lineHeight: 'unset' }}>
                                        {mssqlHostData?.managedInstances || 0}
                                    </DsTypography>

                                    {loading && <DsFlashingDotsLoader />}
                                </div>
                            )}

                            {showNA && (
                                <DsTypography variant="Regular_14" className={styles.disabled}>
                                    {t('databases.general.not-available-table-columns')}
                                </DsTypography>
                            )}
                        </div>

                        <SeparatorComponent variant="horizontal" />

                        <div className={styles.row}>
                            <div className={styles.tooltipSide}>
                                {(loading || showNA) && (
                                    <div className={styles.tooltipDisabled}>
                                        <TooltipDisabled />
                                        <DsTypography variant="Regular_14" className={styles.disabled}>
                                            {t('databases.dashboard.overview')}
                                        </DsTypography>
                                    </div>
                                )}
                                {!loading && !showNA && (
                                    <>
                                        <TooltipInfo>
                                            <ResourcesTooltipComponent type={DBType.MSSQL} data={mssqlHostData} />
                                        </TooltipInfo>
                                        <DsTypography
                                            variant="Regular_14"
                                            className={loading || showNA ? styles.disabled : ''}
                                        >
                                            {t('databases.dashboard.overview')}
                                        </DsTypography>
                                    </>
                                )}
                            </div>

                            <DsButton
                                type="text"
                                onClick={() => {
                                    if (isWorkloadFactory) {
                                        postBlueXPMessage({
                                            type: BlueXPListeners.navigate,
                                            payload: {
                                                pathname: '../../databases/inventory',
                                                replace: true
                                            }
                                        });
                                    } else {
                                        postBlueXPMessage({
                                            type: BlueXPListeners.navigate,
                                            payload: {
                                                pathname: '../../fsxdb/inventory',
                                                replace: true
                                            }
                                        });
                                    }

                                    dispatch(setSelectedHostType(DBType.MSSQL));
                                    dispatch(setSelectedHeaderTab(WLF_TABS.INVENTORY));
                                    dispatch(setSelectedInventoryTab('Instances'));
                                    dispatch(setNotRegisteredSQLView(true));
                                }}
                                isDisabled={loading || showNA}
                            >
                                {t('databases.dashboard.view-non-registered-instances')}
                            </DsButton>
                        </div>
                    </div>

                    {/* second part */}
                    <div className={styles.item}>
                        <div className={styles.row}>
                            <div className={styles.leftSide}>
                                <Square width="12px" height="12px" background="var(--chart-9)" />
                                <DsTypography className={showNA ? styles.disabled : ''} variant="Semibold_14">
                                    {t('databases.dashboard.oracle-databases')}
                                </DsTypography>
                            </div>

                            {!showNA && (
                                <div className={styles.textClass}>
                                    <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                                        {oracleHostData?.totalInstances || 0}
                                    </DsTypography>

                                    {loading && <DsFlashingDotsLoader />}
                                </div>
                            )}

                            {showNA && (
                                <DsTypography variant="Regular_14" className={styles.disabled}>
                                    {t('databases.general.not-available-table-columns')}
                                </DsTypography>
                            )}
                        </div>

                        <SeparatorComponent variant="horizontal" />

                        <div className={styles.row}>
                            <DsTypography className={showNA ? styles.disabled : ''} variant="Regular_14">
                                {t('databases.dashboard.registered-databases')}
                            </DsTypography>

                            {!showNA && (
                                <div className={styles.textClass}>
                                    <DsTypography variant="Semibold_16" style={{ lineHeight: 'unset' }}>
                                        {oracleHostData?.managedInstances || 0}
                                    </DsTypography>

                                    {loading && <DsFlashingDotsLoader />}
                                </div>
                            )}

                            {showNA && (
                                <DsTypography variant="Regular_14" className={styles.disabled}>
                                    {t('databases.general.not-available-table-columns')}
                                </DsTypography>
                            )}
                        </div>

                        <SeparatorComponent variant="horizontal" />

                        <div className={styles.row}>
                            <div className={styles.tooltipSide}>
                                {(loading || showNA) && (
                                    <div className={styles.tooltipDisabled}>
                                        <TooltipDisabled />
                                        <DsTypography variant="Regular_14" className={styles.disabled}>
                                            {t('databases.dashboard.overview')}
                                        </DsTypography>
                                    </div>
                                )}

                                {!loading && !showNA && (
                                    <>
                                        <TooltipInfo>
                                            <ResourcesTooltipComponent type={DBType.ORACLE} data={oracleHostData} />
                                        </TooltipInfo>
                                        <DsTypography
                                            variant="Regular_14"
                                            className={loading || showNA ? styles.disabled : ''}
                                        >
                                            {t('databases.dashboard.overview')}
                                        </DsTypography>
                                    </>
                                )}
                            </div>

                            <DsButton
                                type="text"
                                onClick={() => {
                                    if (isWorkloadFactory) {
                                        postBlueXPMessage({
                                            type: BlueXPListeners.navigate,
                                            payload: {
                                                pathname: '../../databases/inventory',
                                                replace: true
                                            }
                                        });
                                    } else {
                                        postBlueXPMessage({
                                            type: BlueXPListeners.navigate,
                                            payload: {
                                                pathname: '../../fsxdb/inventory',
                                                replace: true
                                            }
                                        });
                                    }
                                    dispatch(setSelectedHostType(DBType.ORACLE));
                                    dispatch(setSelectedHeaderTab(WLF_TABS.INVENTORY));
                                    dispatch(setSelectedInventoryTab('Instances'));
                                    dispatch(setNotRegisteredOracleDatabasesView(true));
                                }}
                                isDisabled={loading || showNA}
                            >
                                {t('databases.dashboard.view-non-registered-databases')}
                            </DsButton>
                        </div>
                    </div>

                    {/* third part */}
                    <div className={styles.item}>
                        <div className={styles.row}>
                            <div className={styles.leftSide}>
                                <Square width="12px" height="12px" background="var(--chart-4)" />
                                <DsTypography className={showNA ? styles.disabled : ''} variant="Semibold_14">
                                    {t('databases.dashboard.postgre-instances')}
                                </DsTypography>
                            </div>

                            {!showNA && (
                                <div className={styles.textClass}>
                                    <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                                        {pgsqlHostData?.totalInstances || 0}
                                    </DsTypography>

                                    {loading && <DsFlashingDotsLoader />}
                                </div>
                            )}

                            {showNA && (
                                <DsTypography variant="Regular_14" className={styles.disabled}>
                                    {t('databases.general.not-available-table-columns')}
                                </DsTypography>
                            )}
                        </div>

                        <SeparatorComponent variant="horizontal" />

                        <div className={styles.row}>
                            <DsTypography className={showNA ? styles.disabled : ''} variant="Regular_14">
                                {t('databases.dashboard.deployed-instances')}
                            </DsTypography>

                            {!showNA && (
                                <div className={styles.textClass}>
                                    <DsTypography variant="Semibold_16" style={{ lineHeight: 'unset' }}>
                                        {pgsqlHostData?.managedInstances || 0}
                                    </DsTypography>

                                    {loading && <DsFlashingDotsLoader />}
                                </div>
                            )}

                            {showNA && (
                                <DsTypography variant="Regular_14" className={styles.disabled}>
                                    {t('databases.general.not-available-table-columns')}
                                </DsTypography>
                            )}
                        </div>

                        <SeparatorComponent variant="horizontal" />

                        <div className={styles.row}>
                            <div className={styles.tooltipSide}>
                                {(loading || showNA) && (
                                    <div className={styles.tooltipDisabled}>
                                        <TooltipDisabled />
                                        <DsTypography variant="Regular_14" className={styles.disabled}>
                                            {t('databases.dashboard.overview')}
                                        </DsTypography>
                                    </div>
                                )}
                                {!loading && !showNA && (
                                    <>
                                        <TooltipInfo>
                                            <ResourcesTooltipComponent type={DBType.POSTGRESQL} data={pgsqlHostData} />
                                        </TooltipInfo>
                                        <DsTypography
                                            variant="Regular_14"
                                            className={loading || showNA ? styles.disabled : ''}
                                        >
                                            {t('databases.dashboard.overview')}
                                        </DsTypography>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DatabaseResources;

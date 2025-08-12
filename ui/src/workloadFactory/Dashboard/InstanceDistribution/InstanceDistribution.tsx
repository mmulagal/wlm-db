import { DsButton, DsFlashingDotsLoader, DsTypography, FlashingDotsLoader } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import styles from './InstanceDistribution.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import BarComponent from '../BarComponent/BarComponent';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import { useAppSelector } from '../../../store/storeHooks';
import { formatFractionalNumber, handleURL } from '../../../utils/utilityFunctions';
import { WLF_TABS } from '../../../utils/consts';
import { ReactComponent as Instance } from '../../../assets/instance.svg';
import SeparatorComponent from '../../../common/SeparatorComponent/SeparatorComponent';
import { GENERAL } from '../../../utils/appConstants';

const InstanceDistribution = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { isWorkloadFactory } = useAppSelector(state => state?.auth);
    const mssqlDatabaseHostsLoading = useAppSelector(state => state.inventoryV2.getDatabaseHosts.databaseHostsLoading);
    const pgsqlDatabaseHostsLoading = useAppSelector(
        state => state.inventoryV2.getPgSqlDatabaseHosts.databaseHostsLoading
    );
    const mssqlHostData = useAppSelector(state => state.databaseHome.aggregatedHostsCount);
    const pgsqlHostData = useAppSelector(state => state.databaseHome.aggregatedPgSqlHostsCount);
    const { multiDataLoading, showNA } = useAppSelector(state => state.headers);

    const handleClick = (value: string) => {
        dispatch(setSelectedHeaderTab(value));
        handleURL(value, isWorkloadFactory);
    };
    return (
        <div className={`${styles.instanceDistribution} ${showNA ? CommonStyles.notAvailable : ''}`}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    {t('databases.dashboard.instances-distribution')}
                </DsTypography>

                <div className={styles.rightSection}>
                    {(mssqlDatabaseHostsLoading || pgsqlDatabaseHostsLoading || multiDataLoading) && (
                        <FlashingDotsLoader />
                    )}
                    <DsButton
                        variant="secondary"
                        data-testid="wlm-db-manage-instances"
                        isThin
                        onClick={() => handleClick(WLF_TABS.INVENTORY)}
                        isDisabled={showNA}
                    >
                        {t('databases.dashboard.register-instances')}
                    </DsButton>
                </div>
            </div>

            <div className={styles.mainSection}>
                {/* top section */}
                <div className={styles.tile}>
                    <div className={styles.leftSection}>
                        <div>
                            <Instance />
                        </div>
                        <div className={styles.valueSection}>
                            <DsTypography
                                variant={showNA ? 'Regular_14' : 'Regular_32'}
                                style={{ lineHeight: 'unset', display: 'flex', gap: '8px' }}
                                className={showNA ? `${CommonStyles.notAvailable} ${CommonStyles.fontSet}` : ''}
                            >
                                {showNA
                                    ? t('databases.general.not-available')
                                    : (mssqlHostData?.totalInstances || 0) + (pgsqlHostData?.totalInstances || 0)}
                                {(mssqlDatabaseHostsLoading || pgsqlDatabaseHostsLoading || multiDataLoading) && (
                                    <DsFlashingDotsLoader />
                                )}
                            </DsTypography>
                            <DsTypography variant="Regular_14" className={showNA ? CommonStyles.notAvailable : ''}>
                                {t('databases.dashboard.total-instances')}
                            </DsTypography>
                        </div>
                    </div>

                    <SeparatorComponent variant="vertical" height="56px" />

                    <div className={styles.valueSection}>
                        <DsTypography
                            variant={showNA ? 'Regular_14' : 'Regular_32'}
                            style={{ lineHeight: 'unset', display: 'flex', gap: '8px' }}
                            className={showNA ? `${CommonStyles.notAvailable} ${CommonStyles.fontSet}` : ''}
                        >
                            {showNA
                                ? t('databases.general.not-available')
                                : (mssqlHostData?.managedInstances || 0) + (pgsqlHostData?.managedInstances || 0)}
                            {(mssqlDatabaseHostsLoading || pgsqlDatabaseHostsLoading || multiDataLoading) && (
                                <DsFlashingDotsLoader />
                            )}
                        </DsTypography>

                        <DsTypography variant="Regular_14" className={showNA ? CommonStyles.notAvailable : ''}>
                            {t('databases.dashboard.registered-instances')}
                        </DsTypography>
                    </div>
                </div>

                <DsTypography variant="Semibold_14" className={showNA ? CommonStyles.notAvailable : ''}>
                    {t('databases.dashboard.registered-instances')}
                </DsTypography>
                <div className={`${styles.barContainer} ${showNA ? CommonStyles.notAvailable : ''}`}>
                    <BarComponent
                        color="var(--chart-3)"
                        headingText={t('databases.dashboard.microsoft-sql-server')}
                        percentage={
                            showNA
                                ? t('databases.general.not-available')
                                : formatFractionalNumber(
                                      ((mssqlHostData?.managedInstances || 0) / (mssqlHostData?.totalInstances || 1)) *
                                          100,
                                      2
                                  )
                        }
                        beforeOutOf={showNA ? undefined : mssqlHostData?.managedInstances || 0}
                        afterOutOf={showNA ? undefined : mssqlHostData?.totalInstances || 0}
                        bottomText={showNA ? undefined : `${t('databases.dashboard.registered-instances')}:`}
                        width="auto"
                        loading={mssqlDatabaseHostsLoading || multiDataLoading}
                        isDisabled={showNA}
                    />
                    <BarComponent
                        color="var(--chart-9)"
                        headingText={t('databases.dashboard.postgresql')}
                        percentage={
                            showNA
                                ? t('databases.general.not-available')
                                : formatFractionalNumber(
                                      ((pgsqlHostData?.managedInstances || 0) / (pgsqlHostData?.totalInstances || 1)) *
                                          100,
                                      2
                                  )
                        }
                        beforeOutOf={showNA ? undefined : pgsqlHostData?.managedInstances || 0}
                        afterOutOf={showNA ? undefined : pgsqlHostData?.totalInstances || 0}
                        bottomText={showNA ? undefined : `${t('databases.dashboard.registered-instances')}:`}
                        width="auto"
                        loading={pgsqlDatabaseHostsLoading || multiDataLoading}
                        isDisabled={showNA}
                    />
                </div>
            </div>
        </div>
    );
};

export default InstanceDistribution;

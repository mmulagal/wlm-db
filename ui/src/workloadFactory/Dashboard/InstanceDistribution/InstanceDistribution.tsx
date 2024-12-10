import { DsButton, DsFlashingDotsLoader, DsTypography, FlashingDotsLoader } from '@netapp/design-system';
import styles from './InstanceDistribution.module.scss';
import BarComponent from '../BarComponent/BarComponent';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import { useAppSelector } from '../../../store/storeHooks';
import { handleURL } from '../../../utils/utilityFunctions';
import { useDispatch } from 'react-redux';
import { WLF_TABS } from '../../../utils/consts';
import { ReactComponent as Instance } from '../../../assets/instance.svg';
import SeparatorComponent from '../../../common/SeparatorComponent/SeparatorComponent';

const InstanceDistribution = () => {
    const dispatch = useDispatch();
    const { isWorkloadFactory } = useAppSelector(state => state?.auth);
    const mssqlDatabaseHostsLoading = useAppSelector(state => state.inventoryV2.getDatabaseHosts.databaseHostsLoading);
    const pgsqlDatabaseHostsLoading = useAppSelector(
        state => state.inventoryV2.getPgSqlDatabaseHosts.databaseHostsLoading
    );
    const mssqlHostData = useAppSelector(state => state.databaseHome.aggregatedHostsCount);
    const pgsqlHostData = useAppSelector(state => state.databaseHome.aggregatedPgSqlHostsCount);

    const handleClick = (value: string) => {
        dispatch(setSelectedHeaderTab(value));
        handleURL(value, isWorkloadFactory);
    };
    return (
        <div className={styles.instanceDistribution}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    Instance distribution
                </DsTypography>

                <div className={styles.rightSection}>
                    {(mssqlDatabaseHostsLoading || pgsqlDatabaseHostsLoading) && <FlashingDotsLoader />}
                    <DsButton variant="secondary" isThin={true} onClick={() => handleClick(WLF_TABS.INVENTORY)}>
                        Manage instances
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
                                variant="Regular_32"
                                style={{ lineHeight: 'unset', display: 'flex', gap: '8px' }}
                            >
                                {mssqlDatabaseHostsLoading || pgsqlDatabaseHostsLoading ? (
                                    <DsFlashingDotsLoader />
                                ) : (
                                    (mssqlHostData?.totalInstances || 0) + (pgsqlHostData?.totalInstances || 0)
                                )}
                            </DsTypography>
                            <DsTypography variant="Regular_14">Total instances</DsTypography>
                        </div>
                    </div>

                    <SeparatorComponent variant="vertical" height="56px" />

                    <div className={styles.valueSection}>
                        <DsTypography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                            {mssqlDatabaseHostsLoading || pgsqlDatabaseHostsLoading ? (
                                <FlashingDotsLoader />
                            ) : (
                                (mssqlHostData?.managedInstances || 0) + (pgsqlHostData?.managedInstances || 0)
                            )}
                        </DsTypography>

                        <DsTypography variant="Regular_14">Managed instances</DsTypography>
                    </div>
                </div>

                <DsTypography variant="Semibold_14">Managed instances</DsTypography>
                <div className={styles.barContainer}>
                    <BarComponent
                        color="var(--chart-3)"
                        headingText="Microsoft SQL Server"
                        percentage={Math.round(
                            ((mssqlHostData?.managedInstances || 0) / (mssqlHostData?.totalInstances || 1)) * 100
                        )}
                        beforeOutOf={mssqlHostData?.managedInstances || 0}
                        afterOutOf={mssqlHostData?.totalInstances || 0}
                        bottomText="Managed instances:"
                        width="440px"
                    />
                    <BarComponent
                        color="var(--chart-9)"
                        headingText="PostgreSQL"
                        percentage={Math.round(
                            ((pgsqlHostData?.managedInstances || 0) / (pgsqlHostData?.totalInstances || 1)) * 100
                        )}
                        beforeOutOf={pgsqlHostData?.managedInstances || 0}
                        afterOutOf={pgsqlHostData?.totalInstances || 0}
                        bottomText="Managed instances:"
                        width="440px"
                    />
                </div>
            </div>
        </div>
    );
};

export default InstanceDistribution;

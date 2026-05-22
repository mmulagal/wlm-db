import { DsButton, DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './PotentialSavings.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import { dashboardRedirection, formatNumberWithCustomComma } from '../../../utils/utilityFunctions';
import { useAppSelector } from '../../../store/storeHooks';
import { DBType, WLF_TABS } from '../../../utils/consts';
import ComparisonChartStack from '../../../ui-components/Charts/ComparionChartStack';
import SeparatorComponent from '../../../common/SeparatorComponent/SeparatorComponent';
import { ReactComponent as PotentialSavingsImage } from '../../../assets/potential_savings.svg';
import { ReactComponent as PotentialSavingsDarkModeImage } from '../../../assets/potential_savings_darkMode.svg';
import { ReactComponent as PotentialSavingsSwitch } from '../../../assets/no-savings.svg';
import { GENERAL } from '../../../utils/appConstants';
import ComparisonChart from '../../../ui-components/Charts/ComparisionChart';

const NewPotentialSavings = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { isWorkloadFactory } = useAppSelector(state => state?.auth);
    const isDiscoverInProgress = useAppSelector(state => state.inventoryV2.discoveredHosts.discoverHostLoading);
    const isManagedHostListLoading = useAppSelector(state => state.inventoryV2.isManagedHostListLoading);
    const unManagedHostFormatedList = useAppSelector(state => state.exploreSavings.unmanagedExploreSavingsHost);
    const potentialSavingsValues = useAppSelector(state => state.databaseHome.potentialSavingsValues);
    const [esCount, setEsCount] = useState<{ fsxw: number; mssqlEbs: number; oracleEbs: number }>({
        fsxw: 0,
        mssqlEbs: 0,
        oracleEbs: 0
    });
    const [loading, setLoading] = useState(false);
    const isDarkTheme = useAppSelector(state => state?.auth?.features?.active['Platform.BlueXP/DarkTheme']);
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList, multiDataLoading, showNA } =
        useAppSelector(state => state.headers);
    const noData = false;
    const noDataWithCount = false;
    const [noSavings, setNoSavings] = useState(false);

    const handleClick = (value: string) => {
        dispatch(setSelectedHeaderTab(value));
        if (isWorkloadFactory) {
            dashboardRedirection('explore-savings/explore-savings-ebs');
            navigate('../../databases/explore-savings/explore-savings-ebs');
        } else {
            dashboardRedirection('exploreSaving');
        }
    };

    useEffect(() => {
        if (unManagedHostFormatedList) {
            let fsxwCount = 0;
            let mssqlEbsCount = 0;
            let oracleEbsCount = 0;
            const uniqueResourceList: Array<string> = [];
            unManagedHostFormatedList?.forEach((perRow: any) => {
                // Include both MSSQL and Oracle hosts for EBS count
                if (
                    (perRow?.hostType !== DBType.MSSQL && perRow?.hostType !== DBType.ORACLE) ||
                    !headerSelectedMultiCredIdsList?.includes(perRow?.credentialId) ||
                    !headerSelectedMultiRegionIdsList?.includes(perRow?.regionId) ||
                    uniqueResourceList?.includes(perRow?.ec2InstanceId)
                ) {
                    return;
                }
                uniqueResourceList.push(perRow?.ec2InstanceId);
                if (perRow?.storageType === GENERAL.EBS) {
                    if (perRow?.hostType === DBType.ORACLE) {
                        oracleEbsCount += 1;
                    } else {
                        mssqlEbsCount += 1;
                    }
                } else if (perRow?.storageType === GENERAL.FSX_FOR_WINDOWS) {
                    fsxwCount += 1;
                }
            });
            setEsCount({ fsxw: fsxwCount, mssqlEbs: mssqlEbsCount, oracleEbs: oracleEbsCount });
        }
    }, [unManagedHostFormatedList, headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList]);

    useEffect(() => {
        setLoading(
            isDiscoverInProgress || isManagedHostListLoading || potentialSavingsValues?.loading || multiDataLoading
        );
        setNoSavings(potentialSavingsValues?.noSavings);
    }, [isDiscoverInProgress, isManagedHostListLoading, potentialSavingsValues, multiDataLoading]);

    const hasPotentialValues = () =>
        potentialSavingsValues?.fsxnCost || potentialSavingsValues?.fsxwCost || potentialSavingsValues?.totalEbsCost;

    const checkForPotentialSavings = (val1: number | any, val2: number | any) => {
        if (val1 !== 0 && val2 !== 0) {
            return true;
        }
        return false;
    };

    const setMarginTop = () => {
        if (
            !hasPotentialValues() &&
            !checkForPotentialSavings(
                potentialSavingsValues?.totalFsxnCostForEbsHost,
                potentialSavingsValues?.totalEbsCost
            ) &&
            !checkForPotentialSavings(potentialSavingsValues?.fsxnCostForFsxwHost, potentialSavingsValues?.fsxwCost)
        ) {
            return '155px';
        }
        if (
            hasPotentialValues() &&
            checkForPotentialSavings(
                potentialSavingsValues?.totalFsxnCostForEbsHost,
                potentialSavingsValues?.totalEbsCost
            ) &&
            !checkForPotentialSavings(potentialSavingsValues?.fsxnCostForFsxwHost, potentialSavingsValues?.fsxwCost)
        ) {
            return '137px';
        }
        if (
            hasPotentialValues() &&
            !checkForPotentialSavings(
                potentialSavingsValues?.totalFsxnCostForEbsHost,
                potentialSavingsValues?.totalEbsCost
            ) &&
            checkForPotentialSavings(potentialSavingsValues?.fsxnCostForFsxwHost, potentialSavingsValues?.fsxwCost)
        ) {
            return '137px';
        }
    };

    return (
        <div className={styles.potentialSavings}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    {t('databases.dashboard.potential-savings')}
                </DsTypography>

                {/* {loading && <FlashingDotsLoader />} */}

                <div className={styles.rightSection}>
                    {loading && <DsFlashingDotsLoader />}
                    <DsButton
                        variant="secondary"
                        isThin
                        data-testid="wlm-db-potential-savings"
                        onClick={() => handleClick(WLF_TABS.EXPLORE_SAVINGS)}
                        isDisabled={loading || showNA}
                    >
                        {t('databases.dashboard.explore-savings')}
                    </DsButton>
                </div>
            </div>

            {/* noData case */}
            {(noData || noDataWithCount || noSavings) && (
                <div className={styles.mainSection}>
                    <div className={styles.noDataSection}>
                        <div className={styles.leftSide}>
                            {(noData || noSavings) && (
                                <div className={styles.topSection}>
                                    <div className={styles.subContent}>
                                        <div className={styles.loaderText}>
                                            <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                                                --
                                            </DsTypography>
                                            {loading && <DsFlashingDotsLoader />}
                                        </div>

                                        <DsTypography
                                            variant="Regular_14"
                                            className={showNA ? CommonStyles.notAvailable : ''}
                                        >
                                            {t('databases.dashboard.ebs-and-fsx-for-window-hosts')}
                                        </DsTypography>
                                    </div>

                                    <SeparatorComponent variant="vertical" height="56px" />

                                    <div className={styles.subContent}>
                                        <div className={styles.loaderText}>
                                            <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                                                --
                                            </DsTypography>
                                            {loading && <DsFlashingDotsLoader />}
                                        </div>
                                        <DsTypography
                                            variant="Regular_14"
                                            className={showNA ? CommonStyles.notAvailable : ''}
                                        >
                                            {t('databases.dashboard.savings-percentage')}
                                        </DsTypography>
                                    </div>

                                    <SeparatorComponent variant="vertical" height="56px" />

                                    <div className={styles.subContent}>
                                        <div className={styles.loaderText}>
                                            <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                                                --
                                            </DsTypography>
                                            {loading && <DsFlashingDotsLoader />}
                                        </div>

                                        <DsTypography
                                            variant="Regular_14"
                                            className={showNA ? CommonStyles.notAvailable : ''}
                                        >
                                            {t('databases.dashboard.potential-savings')}
                                        </DsTypography>
                                    </div>
                                </div>
                            )}
                            {noDataWithCount && (
                                <div className={styles.noDataBanner}>
                                    <div className={styles.section}>
                                        <DsTypography
                                            variant="Regular_24"
                                            style={{ lineHeight: 'unset' }}
                                            className={showNA ? CommonStyles.notAvailable : ''}
                                        >
                                            24
                                        </DsTypography>
                                        <DsTypography
                                            variant="Regular_14"
                                            className={showNA ? CommonStyles.notAvailable : ''}
                                        >
                                            {t('databases.dashboard.sql-server-hosts-ebs')}
                                        </DsTypography>
                                    </div>

                                    <SeparatorComponent variant="vertical" height="54px" />

                                    <div className={styles.section}>
                                        <DsTypography
                                            variant="Regular_24"
                                            style={{ lineHeight: 'unset' }}
                                            className={showNA ? CommonStyles.notAvailable : ''}
                                        >
                                            12
                                        </DsTypography>
                                        <DsTypography
                                            variant="Regular_14"
                                            className={showNA ? CommonStyles.notAvailable : ''}
                                        >
                                            {t('databases.dashboard.sql-server-hosts-fsxw')}
                                        </DsTypography>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className={styles.imageContainer}>
                            {isDarkTheme ? (
                                <PotentialSavingsDarkModeImage />
                            ) : noSavings ? (
                                <div className={styles.potentialSavingsSwitch}>
                                    <PotentialSavingsSwitch />
                                    <div className={styles.potentialSavingsSwitchText}>
                                        <DsTypography
                                            className={`${styles.firstTile} ${showNA ? CommonStyles.notAvailable : ''}`}
                                            variant="Regular_14"
                                        >
                                            {t('databases.dashboard.switching-to-fsx-for-ontap-wont-save-you-money')}
                                        </DsTypography>
                                        <DsTypography
                                            className={`${styles.secondTile} ${
                                                showNA ? CommonStyles.notAvailable : ''
                                            }`}
                                            variant="Regular_14"
                                        >
                                            {t(
                                                'databases.dashboard.select-explore-savings-to-review-the-cost-breakdown'
                                            )}
                                        </DsTypography>
                                    </div>
                                </div>
                            ) : (
                                <PotentialSavingsImage />
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Proper data case */}
            {!noData && !noDataWithCount && !noSavings && (
                <div className={styles.mainSection}>
                    <div className={styles.newValueSection}>
                        <div className={styles.leftSide}>
                            <div className={styles.topSection}>
                                <div className={styles.subContent}>
                                    <div className={styles.loaderText}>
                                        <DsTypography
                                            variant={showNA ? 'Regular_14' : 'Regular_24'}
                                            style={{ lineHeight: 'unset' }}
                                            className={showNA ? CommonStyles.notAvailable : ''}
                                        >
                                            {showNA
                                                ? t('databases.general.not-available')
                                                : esCount?.mssqlEbs + esCount?.oracleEbs + esCount?.fsxw}
                                        </DsTypography>
                                        {loading && <DsFlashingDotsLoader />}
                                    </div>

                                    <DsTypography
                                        variant="Regular_14"
                                        className={showNA ? CommonStyles.notAvailable : ''}
                                    >
                                        {t('databases.dashboard.ebs-and-fsx-for-window-hosts')}
                                    </DsTypography>
                                </div>

                                <SeparatorComponent variant="vertical" height="56px" />

                                <div className={styles.subContent}>
                                    <div className={styles.loaderText}>
                                        <DsTypography
                                            variant={showNA ? 'Regular_14' : 'Regular_24'}
                                            style={{ lineHeight: 'unset' }}
                                            className={showNA ? CommonStyles.notAvailable : ''}
                                        >
                                            {showNA
                                                ? t('databases.general.not-available')
                                                : `${formatNumberWithCustomComma(
                                                      potentialSavingsValues?.savingsPercent || 0
                                                  )}%`}
                                        </DsTypography>
                                        {loading && <DsFlashingDotsLoader />}
                                    </div>
                                    <DsTypography
                                        variant="Regular_14"
                                        className={showNA ? CommonStyles.notAvailable : ''}
                                    >
                                        {t('databases.dashboard.savings-percentage')}
                                    </DsTypography>
                                </div>

                                <SeparatorComponent variant="vertical" height="56px" />

                                <div className={styles.subContent}>
                                    <div className={styles.loaderText}>
                                        <DsTypography
                                            variant={showNA ? 'Regular_14' : 'Regular_24'}
                                            style={{ lineHeight: 'unset' }}
                                            className={showNA ? CommonStyles.notAvailable : ''}
                                        >
                                            {showNA
                                                ? t('databases.general.not-available')
                                                : `$${formatNumberWithCustomComma(
                                                      potentialSavingsValues?.savings || 0
                                                  )}`}
                                        </DsTypography>
                                        {loading && <DsFlashingDotsLoader />}
                                    </div>

                                    <DsTypography
                                        variant="Regular_14"
                                        className={showNA ? CommonStyles.notAvailable : ''}
                                    >
                                        {t('databases.dashboard.potential-savings')}
                                    </DsTypography>
                                </div>
                            </div>

                            {/* chart section */}
                        </div>

                        <div className={styles.chartContainer}>
                            <div className={styles.rightSide}>
                                {/* chart section */}
                                <div className={styles.newChartSection}>
                                    {hasPotentialValues() &&
                                    checkForPotentialSavings(
                                        potentialSavingsValues?.totalFsxnCostForEbsHost,
                                        potentialSavingsValues?.totalEbsCost
                                    ) ? (
                                        <ComparisonChartStack
                                            data={[
                                                [
                                                    potentialSavingsValues?.mssqlFsxnCostForEbsHost || 0,
                                                    potentialSavingsValues?.oracleFsxnCostForEbsHost || 0
                                                ],
                                                [
                                                    potentialSavingsValues?.mssqlEbsCost || 0,
                                                    potentialSavingsValues?.oracleEbsCost || 0
                                                ]
                                            ]}
                                            yTickFormatter={yValue =>
                                                `$${formatNumberWithCustomComma(Number(yValue), true)}`
                                            }
                                            height={259}
                                            colors={['chart-2', 'chart-9']}
                                            stackedBarColors={['chart-2', 'chart-9']}
                                            categories={['FSx for ONTAP', 'EBS']}
                                            tooltipTextFirst={[
                                                `${esCount?.mssqlEbs} MSSQL`,
                                                `${esCount?.oracleEbs} Oracle`
                                            ]}
                                            tooltipText={[`${esCount?.mssqlEbs} MSSQL`, `${esCount?.oracleEbs} Oracle`]}
                                            loading={loading}
                                        />
                                    ) : (
                                        <ComparisonChartStack
                                            // chart draws top to bottom, so the order of the data is reversed
                                            data={[[1], [1]]}
                                            yTickFormatter={yValue =>
                                                `$${formatNumberWithCustomComma(Number(yValue), true)}`
                                            }
                                            height={120}
                                            colors={['chart-2', 'chart-3', 'chart-2']}
                                            categories={['FSx for ONTAP', '', '']}
                                            loadingWithNoData
                                            loading={loading}
                                            marginTop={setMarginTop()}
                                            labelChange
                                            labelChangeText="EBS"
                                        />
                                    )}
                                </div>

                                <SeparatorComponent variant="horizontal" />

                                {/* Text section - Oracle hosts */}
                                <div className={styles.textSection}>
                                    <div className={styles.square} style={{ backgroundColor: 'var(--chart-9)' }} />
                                    {!showNA && <DsTypography variant="Semibold_20">{esCount?.oracleEbs}</DsTypography>}
                                    {showNA && (
                                        <DsTypography variant="Regular_14" className={CommonStyles.notAvailable}>
                                            {t('databases.general.not-available-table-columns')}
                                        </DsTypography>
                                    )}
                                    <DsTypography
                                        variant="Regular_14"
                                        className={showNA ? CommonStyles.notAvailable : ''}
                                    >
                                        {t('databases.dashboard.oracle-hosts')}
                                    </DsTypography>
                                </div>
                            </div>
                            <div className={styles.rightSide}>
                                <div className={styles.newChartSection}>
                                    {hasPotentialValues() &&
                                    checkForPotentialSavings(
                                        potentialSavingsValues?.fsxnCostForFsxwHost,
                                        potentialSavingsValues?.fsxwCost
                                    ) ? (
                                        <ComparisonChart
                                            data={[
                                                potentialSavingsValues?.fsxnCostForFsxwHost || 0,
                                                potentialSavingsValues?.fsxwCost || 0
                                            ]}
                                            yTickFormatter={yValue =>
                                                `$${formatNumberWithCustomComma(Number(yValue), true)}`
                                            }
                                            height={259}
                                            colors={['chart-2', 'chart-2']}
                                            categories={['FSx for ONTAP', 'FSx for Windows']}
                                            loading={loading}
                                            tooltipText={[`${esCount?.fsxw} MSSQL`, `${esCount?.fsxw} MSSQL`]}
                                        />
                                    ) : (
                                        <ComparisonChartStack
                                            // chart draws top to bottom, so the order of the data is reversed
                                            data={[[1], [1]]}
                                            yTickFormatter={yValue =>
                                                `$${formatNumberWithCustomComma(Number(yValue), true)}`
                                            }
                                            height={120}
                                            colors={['chart-2', 'chart-3', 'chart-2']}
                                            categories={['FSx for ONTAP', '', '']}
                                            loadingWithNoData
                                            loading={loading}
                                            marginTop={setMarginTop()}
                                            labelChange
                                            labelChangeText="FSx for Windows"
                                        />
                                    )}
                                </div>

                                <SeparatorComponent variant="horizontal" />

                                {/* Text section - SQL Server hosts (EBS + FSxW) */}
                                <div className={styles.textSection}>
                                    <div className={styles.square} style={{ backgroundColor: 'var(--chart-2)' }} />
                                    {!showNA && (
                                        <DsTypography variant="Semibold_20">
                                            {esCount?.mssqlEbs + esCount?.fsxw}
                                        </DsTypography>
                                    )}
                                    {showNA && (
                                        <DsTypography variant="Regular_14" className={CommonStyles.notAvailable}>
                                            {t('databases.general.not-available-table-columns')}
                                        </DsTypography>
                                    )}
                                    <DsTypography
                                        variant="Regular_14"
                                        className={showNA ? CommonStyles.notAvailable : ''}
                                    >
                                        {t('databases.dashboard.sql-server-hosts')}
                                    </DsTypography>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NewPotentialSavings;

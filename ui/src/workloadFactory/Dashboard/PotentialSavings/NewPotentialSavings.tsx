import { DsButton, DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
import styles from './PotentialSavings.module.scss';
import { useDispatch } from 'react-redux';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import { formatNumberWithCustomComma, handleURL } from '../../../utils/utilityFunctions';
import { useAppSelector } from '../../../store/storeHooks';
import { WLF_TABS } from '../../../utils/consts';
import ComparisonChartStack from '../../../ui-components/Charts/ComparionChartStack';
import SeparatorComponent from '../../../common/SeparatorComponent/SeparatorComponent';
import { ReactComponent as PotentialSavingsImage } from '../../../assets/potential_savings.svg';
import { ReactComponent as PotentialSavingsDarkModeImage } from '../../../assets/potential_savings_darkMode.svg';
import { ReactComponent as PotentialSavingsSwitch } from '../../../assets/potentialSavingsSwitch.svg';
import { useEffect, useState } from 'react';
import { GENERAL } from '../../../utils/appConstants';
import ComparisonChart from '../../../ui-components/Charts/ComparisionChart';

const NewPotentialSavings = () => {
    const dispatch = useDispatch();
    const { isWorkloadFactory } = useAppSelector(state => state?.auth);
    const isDiscoverInProgress = useAppSelector(state => state.inventoryV2.discoveredHosts.discoverHostLoading);
    const isManagedHostListLoading = useAppSelector(state => state.inventoryV2.isManagedHostListLoading);
    const unManagedHostFormatedList = useAppSelector(state => state.exploreSavings.unmanagedExploreSavingsHost);
    const potentialSavingsValues = useAppSelector(state => state.databaseHome.potentialSavingsValues);
    const [esCount, setEsCount] = useState<{ ebs: number; fsxw: number }>({ ebs: 0, fsxw: 0 });
    const [loading, setLoading] = useState(false);
    const isDarkTheme = useAppSelector(state => state?.auth?.features?.active['Platform.BlueXP/DarkTheme']);
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList, multiDataLoading } = useAppSelector(
        state => state.headers
    );
    const noData = false;
    const noDataWithCount = false;
    const [noSavings, setNoSavings] = useState(false);

    const handleClick = (value: string) => {
        dispatch(setSelectedHeaderTab(value));
        handleURL(value, isWorkloadFactory);
    };

    useEffect(() => {
        if (unManagedHostFormatedList) {
            let ebsCount = 0;
            let fsxwCount = 0;
            let uniqueResourceList: Array<String> = [];
            unManagedHostFormatedList?.map((perRow: any) => {
                if (
                    !headerSelectedMultiCredIdsList?.includes(perRow?.credentialId) ||
                    !headerSelectedMultiRegionIdsList?.includes(perRow?.regionId) ||
                    uniqueResourceList?.includes(perRow?.ec2InstanceId)
                ) {
                    return;
                }
                uniqueResourceList.push(perRow?.ec2InstanceId);
                if (perRow?.storageType === GENERAL.EBS) {
                    ebsCount += 1;
                } else if (perRow?.storageType === GENERAL.FSX_FOR_WINDOWS) {
                    fsxwCount += 1;
                }
            });
            setEsCount({ ebs: ebsCount, fsxw: fsxwCount });
        }
    }, [unManagedHostFormatedList, headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList]);

    useEffect(() => {
        setLoading(
            isDiscoverInProgress || isManagedHostListLoading || potentialSavingsValues?.loading || multiDataLoading
        );
        setNoSavings(potentialSavingsValues?.noSavings);
    }, [isDiscoverInProgress, isManagedHostListLoading, potentialSavingsValues, multiDataLoading]);

    const hasPotentialValues = () => {
        return potentialSavingsValues?.fsxnCost || potentialSavingsValues?.fsxwCost || potentialSavingsValues?.ebsCost;
    };

    const checkForPotentialSavings = (val1: number | any, val2: number | any) => {
        if (val1 !== 0 && val2 !== 0) {
            return true;
        }
        return false;
    };

    const setMarginTop = () => {
        if (
            !hasPotentialValues() &&
            !checkForPotentialSavings(potentialSavingsValues?.fsxnCostForEbsHost, potentialSavingsValues?.ebsCost) &&
            !checkForPotentialSavings(potentialSavingsValues?.fsxnCostForFsxwHost, potentialSavingsValues?.fsxwCost)
        ) {
            return '155px';
        } else if (
            hasPotentialValues() &&
            checkForPotentialSavings(potentialSavingsValues?.fsxnCostForEbsHost, potentialSavingsValues?.ebsCost) &&
            !checkForPotentialSavings(potentialSavingsValues?.fsxnCostForFsxwHost, potentialSavingsValues?.fsxwCost)
        ) {
            return '137px';
        } else if (
            hasPotentialValues() &&
            !checkForPotentialSavings(potentialSavingsValues?.fsxnCostForEbsHost, potentialSavingsValues?.ebsCost) &&
            checkForPotentialSavings(potentialSavingsValues?.fsxnCostForFsxwHost, potentialSavingsValues?.fsxwCost)
        ) {
            return '137px';
        }
    };

    return (
        <div className={styles.potentialSavings}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    Potential savings
                </DsTypography>

                {/* {loading && <FlashingDotsLoader />} */}

                <div className={styles.rightSection}>
                    {loading && <DsFlashingDotsLoader />}
                    <DsButton
                        variant="secondary"
                        isThin={true}
                        data-testid="wlm-db-potential-savings"
                        onClick={() => handleClick(WLF_TABS.EXPLORE_SAVINGS)}
                        isDisabled={loading}
                    >
                        Explore savings
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
                                                {'--'}
                                            </DsTypography>
                                            {loading && <DsFlashingDotsLoader />}
                                        </div>

                                        <DsTypography variant="Regular_14">EBS & FSx for Windows hosts</DsTypography>
                                    </div>

                                    <SeparatorComponent variant="vertical" height="56px" />

                                    <div className={styles.subContent}>
                                        <div className={styles.loaderText}>
                                            <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                                                {'--'}
                                            </DsTypography>
                                            {loading && <DsFlashingDotsLoader />}
                                        </div>
                                        <DsTypography variant="Regular_14">Savings percentage</DsTypography>
                                    </div>

                                    <SeparatorComponent variant="vertical" height="56px" />

                                    <div className={styles.subContent}>
                                        <div className={styles.loaderText}>
                                            <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                                                {'--'}
                                            </DsTypography>
                                            {loading && <DsFlashingDotsLoader />}
                                        </div>

                                        <DsTypography variant="Regular_14">Potential savings</DsTypography>
                                    </div>
                                </div>
                            )}
                            {noDataWithCount && (
                                <div className={styles.noDataBanner}>
                                    <div className={styles.section}>
                                        <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                                            24
                                        </DsTypography>
                                        <DsTypography variant="Regular_14">
                                            SQL server hosts on Elastic Block Store (EBS)
                                        </DsTypography>
                                    </div>

                                    <SeparatorComponent variant="vertical" height="54px" />

                                    <div className={styles.section}>
                                        <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                                            12
                                        </DsTypography>
                                        <DsTypography variant="Regular_14">
                                            SQL server hosts on FSx for Windows
                                        </DsTypography>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className={styles.imageContainer}>
                            {isDarkTheme ? (
                                <PotentialSavingsDarkModeImage />
                            ) : noSavings ? (
                                <PotentialSavingsSwitch />
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
                                        <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                                            {esCount?.ebs + esCount?.fsxw}
                                        </DsTypography>
                                        {loading && <DsFlashingDotsLoader />}
                                    </div>

                                    <DsTypography variant="Regular_14">EBS & FSx for Windows hosts</DsTypography>
                                </div>

                                <SeparatorComponent variant="vertical" height="56px" />

                                <div className={styles.subContent}>
                                    <div className={styles.loaderText}>
                                        <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                                            {formatNumberWithCustomComma(potentialSavingsValues?.savingsPercent || 0)}%
                                        </DsTypography>
                                        {loading && <DsFlashingDotsLoader />}
                                    </div>
                                    <DsTypography variant="Regular_14">Savings percentage</DsTypography>
                                </div>

                                <SeparatorComponent variant="vertical" height="56px" />

                                <div className={styles.subContent}>
                                    <div className={styles.loaderText}>
                                        <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                                            ${formatNumberWithCustomComma(potentialSavingsValues?.savings || 0)}
                                        </DsTypography>
                                        {loading && <DsFlashingDotsLoader />}
                                    </div>

                                    <DsTypography variant="Regular_14">Potential savings</DsTypography>
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
                                        potentialSavingsValues?.fsxnCostForEbsHost,
                                        potentialSavingsValues?.ebsCost
                                    ) ? (
                                        <ComparisonChart
                                            data={[
                                                potentialSavingsValues?.fsxnCostForEbsHost || 0,
                                                potentialSavingsValues?.ebsCost || 0
                                            ]}
                                            yTickFormatter={yValue =>
                                                '$' + formatNumberWithCustomComma(Number(yValue), true)
                                            }
                                            height={259}
                                            colors={['chart-9', 'chart-3']}
                                            categories={['FSx for ONTAP', 'EBS']}
                                            loading={loading}
                                        />
                                    ) : (
                                        <ComparisonChartStack
                                            // chart draws top to bottom, so the order of the data is reversed
                                            data={[[1], [1]]}
                                            yTickFormatter={yValue =>
                                                '$' + formatNumberWithCustomComma(Number(yValue), true)
                                            }
                                            height={120}
                                            colors={['chart-2', 'chart-3', 'chart-2']}
                                            categories={['FSx for ONTAP', '', '']}
                                            loadingWithNoData={true}
                                            loading={loading}
                                            marginTop={setMarginTop()}
                                            labelChange={true}
                                            labelChangeText="EBS"
                                        />
                                    )}
                                </div>

                                <SeparatorComponent variant="horizontal" />

                                {/* Text section */}
                                <div className={styles.textSection}>
                                    <div className={styles.square} style={{ backgroundColor: 'var(--chart-3)' }} />
                                    <DsTypography variant="Semibold_20">{esCount?.ebs}</DsTypography>
                                    <DsTypography variant="Regular_14">
                                        SQL Server hosts on Elastic Block Store (EBS)
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
                                                '$' + formatNumberWithCustomComma(Number(yValue), true)
                                            }
                                            height={259}
                                            colors={['chart-9', 'chart-2']}
                                            categories={['FSx for ONTAP', 'FSx for Windows']}
                                            loading={loading}
                                        />
                                    ) : (
                                        <ComparisonChartStack
                                            // chart draws top to bottom, so the order of the data is reversed
                                            data={[[1], [1]]}
                                            yTickFormatter={yValue =>
                                                '$' + formatNumberWithCustomComma(Number(yValue), true)
                                            }
                                            height={120}
                                            colors={['chart-2', 'chart-3', 'chart-2']}
                                            categories={['FSx for ONTAP', '', '']}
                                            loadingWithNoData={true}
                                            loading={loading}
                                            marginTop={setMarginTop()}
                                            labelChange={true}
                                            labelChangeText="FSx for Windows"
                                        />
                                    )}
                                </div>

                                <SeparatorComponent variant="horizontal" />

                                {/* Text section */}
                                <div className={styles.textSection}>
                                    <div className={styles.square} style={{ backgroundColor: 'var(--chart-2)' }} />
                                    <DsTypography variant="Semibold_20">{esCount?.fsxw}</DsTypography>
                                    <DsTypography variant="Regular_14">
                                        SQL Server hosts on FSx for Windows
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

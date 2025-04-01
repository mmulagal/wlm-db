import { DsButton, DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
import styles from './PotentialSavings.module.scss';
import { useDispatch } from 'react-redux';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import { formatNumberWithCustomComma, handleURL } from '../../../utils/utilityFunctions';
import { useAppSelector } from '../../../store/storeHooks';
import { WLF_TABS } from '../../../utils/consts';
import ComparisonChartStack from '../../../ui-components/Charts/ComparionChartStack';
import SeparatorComponent from '../../../common/SeparatorComponent/SeparatorComponent';
import useResize from '../../../common/hooks/useResize';
import { ReactComponent as PotentialSavingsImage } from '../../../assets/potential_savings.svg';
import { ReactComponent as PotentialSavingsDarkModeImage } from '../../../assets/potential_savings_darkMode.svg';
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

    const handleClick = (value: string) => {
        dispatch(setSelectedHeaderTab(value));
        handleURL(value, isWorkloadFactory);
    };

    const windowSize = useResize();

    useEffect(() => {
        if (unManagedHostFormatedList) {
            let ebsCount = 0;
            let fsxwCount = 0;
            unManagedHostFormatedList?.map((perRow: any) => {
                if (perRow?.storageType === GENERAL.EBS) {
                    ebsCount += perRow?.sqlServerInstances?.length;
                } else if (perRow?.storageType === GENERAL.FSX_FOR_WINDOWS) {
                    fsxwCount += perRow?.sqlServerInstances?.length;
                }
            });
            setEsCount({ ebs: ebsCount, fsxw: fsxwCount });
        }
    }, [unManagedHostFormatedList]);

    useEffect(() => {
        setLoading(isDiscoverInProgress || isManagedHostListLoading || potentialSavingsValues?.loading);
    }, [isDiscoverInProgress, isManagedHostListLoading, potentialSavingsValues]);

    const hasPotentialValues = () => {
        return potentialSavingsValues?.fsxnCost || potentialSavingsValues?.fsxwCost || potentialSavingsValues?.ebsCost;
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

            {/* New Design */}
            {/* <div className={styles.mainSection}>
                <div className={styles.topSection}>
                    <div className={styles.subContent1}>
                        <div className={styles.loaderText}>
                            <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                                {esCount?.ebs}
                            </DsTypography>
                            {loading && <DsFlashingDotsLoader />}
                        </div>

                        <DsTypography variant="Regular_14">Elastic Block Store (EBS) instances</DsTypography>
                    </div>

                    <SeparatorComponent variant="vertical" height="54px" />

                    <div className={styles.subContent2}>
                        <div className={styles.loaderText}>
                            <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                                {esCount?.fsxw}
                            </DsTypography>
                            {loading && <DsFlashingDotsLoader />}
                        </div>

                        <DsTypography variant="Regular_14">FSx for windows file server instances</DsTypography>
                    </div>
                </div>
                {noData && (isDarkTheme ? <PotentialSavingsDarkModeImage /> : <PotentialSavingsImage />)}
            </div> */}

            {/* Old section */}

            <div className={styles.mainSection}>
                <div className={styles.newValueSection}>
                    <div className={styles.leftSide}>
                        <div className={styles.topSection}>
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
                        <div className={styles.chartSection} style={{ width: '280px', marginLeft: '30px' }}>
                            {hasPotentialValues() ? (
                                <ComparisonChart
                                    data={[
                                        potentialSavingsValues?.fsxnCost || 0,
                                        potentialSavingsValues?.fsxwCost || 0
                                    ]}
                                    yTickFormatter={yValue => '$' + formatNumberWithCustomComma(Number(yValue), true)}
                                    height={200}
                                    colors={['chart-9', 'chart-2']}
                                    categories={['FSx for ONTAP', 'FSx for Windows']}
                                />
                            ) : (
                                <ComparisonChartStack
                                    // chart draws top to bottom, so the order of the data is reversed
                                    data={[[1], [1]]}
                                    yTickFormatter={yValue => '$' + formatNumberWithCustomComma(Number(yValue), true)}
                                    height={120}
                                    colors={['chart-2', 'chart-3', 'chart-2']}
                                    categories={['FSx for ONTAP', '', '']}
                                    loadingWithNoData={true}
                                    loading={loading}
                                    marginTop="80px"
                                    labelChange={true}
                                    labelChangeText="FSx for Windows"
                                />
                            )}
                        </div>

                        {/* Text section */}
                        <div className={styles.textSection}>
                            <div className={styles.square} style={{ backgroundColor: 'var(--chart-2)' }} />
                            <DsTypography variant="Semibold_20">21</DsTypography>
                            <DsTypography variant="Regular_14">SQL Server hosts on FSx for Windows</DsTypography>
                        </div>
                    </div>
                    <div className={styles.rightSide}>
                        {/* chart section */}
                        <div className={styles.chartSection} style={{ width: '280px' }}>
                            {hasPotentialValues() ? (
                                <ComparisonChart
                                    data={[potentialSavingsValues?.fsxnCost || 0, potentialSavingsValues?.ebsCost || 0]}
                                    yTickFormatter={yValue => '$' + formatNumberWithCustomComma(Number(yValue), true)}
                                    height={277}
                                    colors={['chart-9', 'chart-3']}
                                    categories={['FSx for ONTAP', 'EBS']}
                                />
                            ) : (
                                <ComparisonChartStack
                                    // chart draws top to bottom, so the order of the data is reversed
                                    data={[[1], [1]]}
                                    yTickFormatter={yValue => '$' + formatNumberWithCustomComma(Number(yValue), true)}
                                    height={120}
                                    colors={['chart-2', 'chart-3', 'chart-2']}
                                    categories={['FSx for ONTAP', '', '']}
                                    loadingWithNoData={true}
                                    loading={loading}
                                    marginTop="155px"
                                    labelChange={true}
                                    labelChangeText="EBS"
                                />
                            )}
                        </div>

                        {/* Text section */}
                        <div className={styles.textSection}>
                            <div className={styles.square} style={{ backgroundColor: 'var(--chart-3)' }} />
                            <DsTypography variant="Semibold_20">21</DsTypography>
                            <DsTypography variant="Regular_14">SQL Server hosts on FSx for Windows</DsTypography>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NewPotentialSavings;

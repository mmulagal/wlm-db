import { DsTypography, DsButton, DsFlashingDotsLoader } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './Sandboxes.module.scss';
import SandboxChart from '../../Sandbox/SandboxDistributionDate/SandboxChart/SandboxChart';
import { useAppSelector } from '../../../store/storeHooks';
import { GENERAL } from '../../../utils/appConstants';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { getSandboxDistributionByAgeValue } from '../../Sandbox/SandboxUtility';
import SeparatorComponent from '../../../common/SeparatorComponent/SeparatorComponent';
import { setSandboxAgeRange } from '../../../store/workloadFactory/databaseHomeSlice';
import { WLF_TABS } from '../../../utils/consts';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';

const Sandboxes = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { isNA } = useAppSelector(state => state.sandbox);
    const { loading: dataLoading, data: aggregatedSandboxList } = useAppSelector(
        state => state.inventoryV2.dashSandboxList
    );
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList, multiDataLoading, showNA } = useAppSelector(
        state => state.headers
    );

    const [data, setData] = useState<any>([]);

    const loading = useMemo(() => dataLoading || multiDataLoading, [dataLoading, multiDataLoading]);

    useEffect(() => {
        const filteredList: Array<any> = [];
        const uniqueResourceList: Array<string> = [];
        if (aggregatedSandboxList?.length > 0) {
            aggregatedSandboxList.forEach((item: any) => {
                const uniqueRow = `${item?.databaseHostId}_${item?.databaseInstanceId}_${item?.sandboxName}`;
                if (
                    !headerSelectedMultiCredIdsList?.includes(item?.credentialId) ||
                    !headerSelectedMultiRegionIdsList?.includes(item?.regionId) ||
                    uniqueResourceList.includes(uniqueRow) ||
                    item?.error // Skip items with an error field that has a value
                ) {
                    return;
                }
                uniqueResourceList.push(uniqueRow);
                filteredList.push(item);
            });
            setData(filteredList);
        }
    }, [aggregatedSandboxList, headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList]);

    const redirectToSandbox = (range: string) => {
        dispatch(
            setSandboxAgeRange({
                range,
                from: 'Dashboard'
            })
        );
        setTimeout(() => {
            dispatch(setSelectedHeaderTab(WLF_TABS.SANDBOXES));
        }, 1);
    };

    return (
        <div className={styles.sandboxes}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    Sandboxes
                </DsTypography>
            </div>

            <div className={styles.mainSection}>
                <SandboxChart aggregatedSandboxList={data} loading={loading} />
                <div className={styles.rightSide}>
                    <DsTypography 
                        variant="Semibold_14" 
                        style={{ marginBottom: '16px' }}
                        className={showNA ? CommonStyles.notAvailable : ''}
                    >
                        Sandboxes distribution by age
                    </DsTypography>
                    <div className={styles.individualRow}>
                        <div className={styles.squareSetup}>
                            <div
                                className={styles.square}
                                style={{ backgroundColor: showNA ? 'var(--chart-disabled)' : '#68C6B3' }}
                            />
                            <DsTypography
                                variant="Regular_14"
                                className={showNA ? `${styles.days} ${CommonStyles.notAvailable}` : styles.days}
                            >
                                {GENERAL.ONE_THIRTY_DAYS}
                            </DsTypography>
                            {!showNA && loading && <DsFlashingDotsLoader />}
                        </div>

                        <div className={styles.count}>
                            {!showNA && (
                                <DsTypography variant="Semibold_14">{`${
                                    getSandboxDistributionByAgeValue(data)['0-30']
                                }`}</DsTypography>
                            )}

                            {showNA && (
                                <DsTypography variant="Regular_14" className={`${CommonStyles.notAvailable} `}>
                                    {t('databases.general.not-available')}
                                </DsTypography>
                            )}
                            <SeparatorComponent variant="vertical" height="16px" />

                            <DsButton
                                data-testid="wlm-db-view-zero-thirty"
                                type="text"
                                onClick={() => redirectToSandbox(GENERAL.ONE_THIRTY_DAYS)}
                                isDisabled={showNA}
                            >
                                View
                            </DsButton>
                        </div>
                    </div>

                    <div className={styles.individualRow}>
                        <div className={styles.squareSetup}>
                            <div
                                className={styles.square}
                                style={{ backgroundColor: showNA ? 'var(--chart-disabled)' : '#A815F3' }}
                            />
                            <DsTypography
                                variant="Regular_14"
                                className={showNA ? `${styles.days} ${CommonStyles.notAvailable}` : styles.days}
                            >
                                {GENERAL.THIRTY_SIXTY_DAYS}
                            </DsTypography>
                            {!showNA && loading && <DsFlashingDotsLoader />}
                        </div>

                        <div className={styles.count}>
                            {!showNA && (
                                <DsTypography variant="Semibold_14">{`${
                                    getSandboxDistributionByAgeValue(data)['31-60']
                                }`}</DsTypography>
                            )}

                            {showNA && (
                                <DsTypography variant="Regular_14" className={`${CommonStyles.notAvailable} `}>
                                    {t('databases.general.not-available')}
                                </DsTypography>
                            )}
                            <SeparatorComponent variant="vertical" height="16px" />

                            <DsButton
                                data-testid="wlm-db-view-thirtyOne-sixty"
                                type="text"
                                onClick={() => redirectToSandbox(GENERAL.THIRTY_SIXTY_DAYS)}
                                isDisabled={showNA}
                            >
                                View
                            </DsButton>
                        </div>
                    </div>

                    <div className={styles.individualRow} style={{ borderBottom: '1px solid var(--border)' }}>
                        <div className={styles.squareSetup}>
                            <div
                                className={styles.square}
                                style={{ backgroundColor: showNA ? 'var(--chart-disabled)' : '#FDC300' }}
                            />
                            <DsTypography
                                variant="Regular_14"
                                className={showNA ? `${styles.days} ${CommonStyles.notAvailable}` : styles.days}
                            >
                                {GENERAL.SIXTY_PLUS_DAYS}
                            </DsTypography>
                            {!showNA && loading && <DsFlashingDotsLoader />}
                        </div>

                        <div className={styles.count}>
                            {!showNA && (
                                <DsTypography variant="Semibold_14">{`${
                                    getSandboxDistributionByAgeValue(data)['61+']
                                }`}</DsTypography>
                            )}

                            {showNA && (
                                <DsTypography variant="Regular_14" className={`${CommonStyles.notAvailable} `}>
                                    {t('databases.general.not-available')}
                                </DsTypography>
                            )}
                            <SeparatorComponent variant="vertical" height="16px" />

                            <DsButton
                                data-testid="wlm-db-view-sixtyOne-plus"
                                type="text"
                                onClick={() => redirectToSandbox(GENERAL.SIXTY_PLUS_DAYS)}
                                isDisabled={showNA}
                            >
                                View
                            </DsButton>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Sandboxes;

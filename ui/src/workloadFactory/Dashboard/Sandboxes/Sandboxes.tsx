import { DsTypography, DsButton, DsFlashingDotsLoader } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
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
    const dispatch = useDispatch();
    const { isNA } = useAppSelector(state => state.sandbox);
    const { loading, data: aggregatedSandboxList } = useAppSelector(state => state.inventoryV2.dashSandboxList);

    const redirectToSandbox = (range: string) => {
        dispatch(
            setSandboxAgeRange({
                range: range,
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
                <SandboxChart aggregatedSandboxList={aggregatedSandboxList} loading={loading} />
                <div className={styles.rightSide}>
                    <DsTypography variant="Semibold_14" style={{ marginBottom: '16px' }}>
                        Sandboxes distribution by age
                    </DsTypography>
                    <div className={styles.individualRow}>
                        <div className={styles.squareSetup}>
                            <div
                                className={styles.square}
                                style={{ backgroundColor: isNA ? 'var(--chart-disabled)' : '#68C6B3' }}
                            />
                            <DsTypography
                                variant="Regular_14"
                                className={isNA ? `${styles.days} ${CommonStyles.notAvailable}` : styles.days}
                            >
                                {GENERAL.ONE_THIRTY_DAYS}
                            </DsTypography>
                            {loading && <DsFlashingDotsLoader />}
                        </div>

                        <div className={styles.count}>
                            {!isNA && (
                                <>
                                    <DsTypography variant="Semibold_14">{`${
                                        getSandboxDistributionByAgeValue(aggregatedSandboxList)['0-30']
                                    }`}</DsTypography>
                                </>
                            )}

                            {isNA && (
                                <>
                                    <DsTypography variant="Regular_14" className={`${CommonStyles.notAvailable} `}>
                                        {GENERAL.NOT_AVAILABLE}
                                    </DsTypography>
                                </>
                            )}
                            <SeparatorComponent variant="vertical" height="16px" />

                            <DsButton
                                data-testid="wlm-db-view-zero-thirty"
                                type="text"
                                onClick={() => redirectToSandbox(GENERAL.ONE_THIRTY_DAYS)}
                            >
                                View
                            </DsButton>
                        </div>
                    </div>

                    <div className={styles.individualRow}>
                        <div className={styles.squareSetup}>
                            <div
                                className={styles.square}
                                style={{ backgroundColor: isNA ? 'var(--chart-disabled)' : '#A815F3' }}
                            />
                            <DsTypography
                                variant="Regular_14"
                                className={isNA ? `${styles.days} ${CommonStyles.notAvailable}` : styles.days}
                            >
                                {GENERAL.THIRTY_SIXTY_DAYS}
                            </DsTypography>
                            {loading && <DsFlashingDotsLoader />}
                        </div>

                        <div className={styles.count}>
                            {!isNA && (
                                <>
                                    <DsTypography variant="Semibold_14">{`${
                                        getSandboxDistributionByAgeValue(aggregatedSandboxList)['31-60']
                                    }`}</DsTypography>
                                </>
                            )}

                            {isNA && (
                                <>
                                    <DsTypography variant="Regular_14" className={`${CommonStyles.notAvailable} `}>
                                        {GENERAL.NOT_AVAILABLE}
                                    </DsTypography>
                                </>
                            )}
                            <SeparatorComponent variant="vertical" height="16px" />

                            <DsButton
                                data-testid="wlm-db-view-thirtyOne-sixty"
                                type="text"
                                onClick={() => redirectToSandbox(GENERAL.THIRTY_SIXTY_DAYS)}
                            >
                                View
                            </DsButton>
                        </div>
                    </div>

                    <div className={styles.individualRow} style={{ borderBottom: '1px solid var(--border)' }}>
                        <div className={styles.squareSetup}>
                            <div
                                className={styles.square}
                                style={{ backgroundColor: isNA ? 'var(--chart-disabled)' : '#FDC300' }}
                            />
                            <DsTypography
                                variant="Regular_14"
                                className={isNA ? `${styles.days} ${CommonStyles.notAvailable}` : styles.days}
                            >
                                {GENERAL.SIXTY_PLUS_DAYS}
                            </DsTypography>
                            {loading && <DsFlashingDotsLoader />}
                        </div>

                        <div className={styles.count}>
                            {!isNA && (
                                <>
                                    <DsTypography variant="Semibold_14">{`${
                                        getSandboxDistributionByAgeValue(aggregatedSandboxList)['61+']
                                    }`}</DsTypography>
                                </>
                            )}

                            {isNA && (
                                <>
                                    <DsTypography variant="Regular_14" className={`${CommonStyles.notAvailable} `}>
                                        {GENERAL.NOT_AVAILABLE}
                                    </DsTypography>
                                </>
                            )}
                            <SeparatorComponent variant="vertical" height="16px" />

                            <DsButton
                                data-testid="wlm-db-view-sixtyOne-plus"
                                type="text"
                                onClick={() => redirectToSandbox(GENERAL.SIXTY_PLUS_DAYS)}
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

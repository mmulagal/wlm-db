import { DsButton, DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
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
                    {/* {loading && <FlashingDotsLoader />} */}
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
                                200
                                {/* <DsFlashingDotsLoader /> */}
                            </DsTypography>
                            {/* <div className={styles.loadingSection}>
                            <DsFlashingDotsLoader />
                        </div> */}
                            <DsTypography variant="Regular_14">Total instances</DsTypography>
                        </div>
                    </div>

                    <SeparatorComponent variant="vertical" height="56px" />

                    <div className={styles.valueSection}>
                        <DsTypography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                            120
                        </DsTypography>
                        {/* <div className={styles.loadingSection}>
                            <DsFlashingDotsLoader />
                        </div> */}

                        <DsTypography variant="Regular_14">Managed instances</DsTypography>
                    </div>
                </div>

                <DsTypography variant="Semibold_14">Managed instances</DsTypography>
                <div className={styles.barContainer}>
                    <BarComponent
                        color="var(--chart-3)"
                        headingText="Microsoft SQL Server"
                        percentage={20}
                        beforeOutOf={100}
                        afterOutOf={120}
                        bottomText="Managed instances:"
                        width="440px"
                    />
                    <BarComponent
                        color="var(--chart-9)"
                        headingText="PostgreSQL"
                        percentage={20}
                        beforeOutOf={100}
                        afterOutOf={120}
                        bottomText="Managed instances:"
                        width="440px"
                    />
                </div>
            </div>
        </div>
    );
};

export default InstanceDistribution;

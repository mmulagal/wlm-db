import { DsButton, DsTypography } from '@netapp/design-system';
import styles from './PotentialSavings.module.scss';
import { useDispatch } from 'react-redux';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import { handleURL } from '../../../utils/utilityFunctions';
import { useAppSelector } from '../../../store/storeHooks';
import { WLF_TABS } from '../../../utils/consts';

const PotentialSavings = () => {
    const dispatch = useDispatch();
    const { isWorkloadFactory } = useAppSelector(state => state?.auth);
    const handleClick = (value: string) => {
        dispatch(setSelectedHeaderTab(value));
        handleURL(value, isWorkloadFactory);
    };
    return (
        <div className={styles.potentialSavings}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    Potential savings (Elastic Block Store (EBS) & FSx for Windows File Server)
                </DsTypography>

                {/* {loading && <FlashingDotsLoader />} */}

                <div className={styles.rightSection}>
                    {/* {loading && <FlashingDotsLoader />} */}
                    <DsButton variant="secondary" isThin={true} onClick={() => handleClick(WLF_TABS.EXPLORE_SAVINGS)}>
                        Explore savings
                    </DsButton>
                </div>
            </div>
        </div>
    );
};

export default PotentialSavings;

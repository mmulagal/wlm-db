import { DsButton, DsTypography } from '@netapp/design-system';
import { ReactComponent as StorageCredentials } from '../../../../assets/storage-credentials.svg';

import styles from './CalculateSavingCard.module.scss';

import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../../store/storeHooks';
import { setSelectedExploreSavingsTab } from '../../../../store/workloadFactory/exploreSavingsSlice';
import { setSelectedHeaderTab } from '../../../../store/workloadFactory/inventoryV2Slice';
import { SAVINGS_CALC_MODE, WLF_TABS } from '../../../../utils/consts';
import { handleExploreSavingsURL } from '../../../../utils/utilityFunctions';
const CalculateSavingCard = ({ buttonRef, setIsCardOpen, savingsCalculatorFrom }: any) => {
    const dispatch = useDispatch();
    const { selectedExploreSavingsTab } = useAppSelector(state => state?.exploreSavings);
    const { isWorkloadFactory } = useAppSelector(state => state?.auth);

    const handleTryIt = () => {
        dispatch(setSelectedHeaderTab(WLF_TABS.EXPLORE_SAVINGS));
        dispatch(setSelectedExploreSavingsTab(selectedExploreSavingsTab));
        handleExploreSavingsURL(selectedExploreSavingsTab, isWorkloadFactory);
    };
    return (
        <div
            className={styles['calculate-savings-card']}
            style={{
                top: buttonRef.current?.offsetHeight + 24, // 8px for spacing
                left: buttonRef.current
                    ? buttonRef.current.offsetLeft + buttonRef.current.offsetWidth - 500 /* Card width */
                    : 0
            }}
        >
            <StorageCredentials />
            <div className={styles.content}>
                <DsTypography className={styles.heading} variant="Semibold_14">
                    Calculate your savings on your existing volumes
                </DsTypography>
                <DsTypography variant="Regular_14" className={styles.text}>
                    {savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS
                        ? 'We can calculate how much you\'ll save by comparing the cost of your existing EBS resources with FSx for ONTAP. Click "Try it" to select specific EBS file systems to compare with FSx for ONTAP in the calculator.'
                        : 'We can calculate how much you\'ll save by comparing the cost of your existing FSx for Windows File Server resources with FSx for ONTAP. Click "Try it" to select specific FSx for Windows File Server file systems to compare with FSx for ONTAP in the calculator.'}
                </DsTypography>
            </div>
            <div className={styles.buttonContainer}>
                <DsButton type="text" className={styles.button} onClick={() => setIsCardOpen(false)}>
                    Maybe later
                </DsButton>
                <DsButton type="button" onClick={handleTryIt} isThin className={styles.button}>
                    Try it
                </DsButton>
            </div>
        </div>
    );
};

export default CalculateSavingCard;

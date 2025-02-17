import { BlueXPListeners, DsButton, DsTypography, postBlueXPMessage } from '@netapp/design-system';
import { ReactComponent as StorageCredentials } from '../../../../assets/storage-credentials.svg';

import styles from './CalculateSavingCard.module.scss';

import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../../store/storeHooks';
import { setSelectedExploreSavingsTab } from '../../../../store/workloadFactory/exploreSavingsSlice';
import { setSelectedHeaderTab } from '../../../../store/workloadFactory/inventoryV2Slice';
import { SAVINGS_CALC_MODE, WLF_TABS } from '../../../../utils/consts';
import { handleExploreSavingsURL } from '../../../../utils/utilityFunctions';
import { useEffect, useState } from 'react';
const CalculateSavingCard = ({ buttonRef, setIsCardOpen, savingsCalculatorFrom }: any) => {
    const dispatch = useDispatch();
    const { selectedExploreSavingsTab } = useAppSelector(state => state?.exploreSavings);
    const { isWorkloadFactory } = useAppSelector(state => state?.auth);
    const { statusData, statusLoading } = useAppSelector(state => state.headers.getStatus);
    // To check whether account present or not
    const [noAccount, setNoAccount] = useState(true);

    // To set noAccount flag is present or not
    useEffect(() => {
        if (statusData && statusData?.isActive === true) {
            setNoAccount(false);
        } else if (!statusData || statusData?.isActive === false) {
            setNoAccount(true);
        }
    }, [statusData]);

    const handleTryIt = () => {
        dispatch(setSelectedHeaderTab(WLF_TABS.EXPLORE_SAVINGS));
        dispatch(setSelectedExploreSavingsTab(selectedExploreSavingsTab));
        handleExploreSavingsURL(selectedExploreSavingsTab, isWorkloadFactory);
    };

    const navigateAddCredentials = () => {
        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS) {
            postBlueXPMessage({
                type: BlueXPListeners.navigate,
                payload: {
                    pathname: `../../credentials/create?from=/databases/storage-saving-calculator?type=ebs
                    &to=/databases/storage-saving-calculator/ebs`,
                    replace: true
                }
            });
        } else {
            postBlueXPMessage({
                type: BlueXPListeners.navigate,
                payload: {
                    pathname: `../../credentials/create?from=/databases/explore-savings-fsxw?type=fsxw
                    &to=/databases/explore-savings-fsxw/fsxw`,
                    replace: true
                }
            });
        }
    };
    return (
        <div
            className={styles['calculate-savings-card']}
            style={{
                top: buttonRef.current?.offsetHeight + 24, // 8px for spacing
                left: buttonRef.current
                    ? buttonRef.current.offsetLeft + buttonRef.current.offsetWidth - 500 /* Card width */
                    : 0,
                height: noAccount ? '460px' : '484px'
            }}
        >
            <StorageCredentials />
            <div className={styles.content}>
                <DsTypography className={styles.heading} variant="Semibold_14">
                    Calculate savings on your existing SQL Servers
                </DsTypography>
                {!noAccount && (
                    <DsTypography variant="Regular_14" className={styles.text}>
                        {savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS
                            ? 'We can calculate how much you\'ll save by comparing the cost of your existing SQL Servers using EBS resources with FSx for ONTAP. Click "Try it" to select specific EBS database hosts to compare with FSx for ONTAP in the calculator.'
                            : 'We can calculate how much you\'ll save by comparing the cost of your existing SQL Servers using FSx for Windows File Server resources with FSx for ONTAP. Click "Try it" to select specific FSx for Windows database hosts to compare with FSx for ONTAP in the calculator.'}
                    </DsTypography>
                )}
                {noAccount && (
                    <DsTypography variant="Regular_14" className={styles.text}>
                        {savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS
                            ? "We can calculate how much you'll save by comparing the cost of your existing SQL Servers using EBS resources with FSx for ONTAP. Add your credentials, go back to Explore savings, and select the Microsoft SQL Server host you'd like to compare."
                            : "We can calculate how much you'll save by comparing the cost of your existing SQL Servers using FSx for Windows resources with FSx for ONTAP. Add your credentials, go back to Explore savings, and select the Microsoft SQL Server host you'd like to compare."}
                    </DsTypography>
                )}
            </div>
            <div className={styles.buttonContainer}>
                <DsButton type="text" className={styles.button} onClick={() => setIsCardOpen(false)}>
                    Maybe later
                </DsButton>
                {!noAccount && (
                    <DsButton type="button" onClick={handleTryIt} isThin className={styles.button}>
                        Try it
                    </DsButton>
                )}
                {noAccount && (
                    <DsButton type="button" onClick={navigateAddCredentials} isThin className={styles.button}>
                        Add credentials
                    </DsButton>
                )}
            </div>
        </div>
    );
};

export default CalculateSavingCard;

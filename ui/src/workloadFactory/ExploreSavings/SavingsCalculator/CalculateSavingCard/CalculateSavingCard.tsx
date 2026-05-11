import { BlueXPListeners, DsButton, DsTypography, postBlueXPMessage } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as StorageCredentials } from '../../../../assets/storage-credentials.svg';

import styles from './CalculateSavingCard.module.scss';

import { useAppSelector } from '../../../../store/storeHooks';
import { setSelectedExploreSavingsTab } from '../../../../store/workloadFactory/exploreSavingsSlice';
import { setSelectedHeaderTab } from '../../../../store/workloadFactory/inventoryV2Slice';
import { SAVINGS_CALC_MODE, WLF_TABS } from '../../../../utils/consts';
import { handleExploreSavingsURL } from '../../../../utils/utilityFunctions';

const CalculateSavingCard = ({ buttonRef, setIsCardOpen, savingsCalculatorFrom }: any) => {
    const { t } = useTranslation();
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
        if (
            savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS ||
            savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_MANUAL_EBS
        ) {
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
                height: '500px'
            }}
        >
            <StorageCredentials />
            <div className={styles.content}>
                <DsTypography className={styles.heading} variant="Semibold_14">
                    {savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_MANUAL_EBS
                        ? t('databases.explore-savings.calculate-savings-card-oracle-heading')
                        : t('databases.explore-savings.calculate-savings-card-heading')}
                </DsTypography>
                {!noAccount && (
                    <DsTypography variant="Regular_14" className={styles.text}>
                        {savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_MANUAL_EBS
                            ? t('databases.explore-savings.calculate-savings-card-oracle-ebs-description')
                            : savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS
                            ? t('databases.explore-savings.calculate-savings-card-ebs-description')
                            : t('databases.explore-savings.calculate-savings-card-fsxw-description')}
                    </DsTypography>
                )}
                {noAccount && (
                    <DsTypography variant="Regular_14" className={styles.text}>
                        {savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_MANUAL_EBS
                            ? t('databases.explore-savings.calculate-savings-card-oracle-ebs-no-account-description')
                            : savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS
                            ? t('databases.explore-savings.calculate-savings-card-ebs-no-account-description')
                            : t('databases.explore-savings.calculate-savings-card-fsxw-no-account-description')}
                    </DsTypography>
                )}
            </div>
            <div className={styles.buttonContainer}>
                <DsButton type="text" className={styles.button} onClick={() => setIsCardOpen(false)}>
                    {t('databases.explore-savings.calculate-savings-card-maybe-later')}
                </DsButton>
                {!noAccount && (
                    <DsButton type="button" onClick={handleTryIt} isThin className={styles.button}>
                        {t('databases.explore-savings.calculate-savings-card-try-it')}
                    </DsButton>
                )}
                {noAccount && (
                    <DsButton type="button" onClick={navigateAddCredentials} isThin className={styles.button}>
                        {t('databases.explore-savings.calculate-savings-card-add-credentials')}
                    </DsButton>
                )}
            </div>
        </div>
    );
};

export default CalculateSavingCard;

import { DsTypography, FlashingDotsLoader } from '@netapp/design-system';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './SavingsSelectedHost.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { SAVINGS_CALC_MODE, WLF_TABS } from '../../../../utils/consts';

interface SavingsSelectedHostProps {
    host?: any;
}

const SavingsSelectedHost = ({ host }: SavingsSelectedHostProps) => {
    const { t } = useTranslation();
    const isDisabled = false;
    const {
        selectedHostDetails,
        selectedOnPremHostDetails,
        selectedPartnerHostDetails,
        getPartnerHostDetailsLoading,
        savingsCalculatorFrom,
        selectedExploreSavingsTab
    } = useAppSelector(state => state.exploreSavings);

    const [totalVolume, setTotalVolume] = useState(0);
    const [hostname, setHostname] = useState('');
    const [noOfInstances, setNoOfInstances] = useState('');

    // Check if Oracle on-prem mode
    const isOracleOnPrem = savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_ONPREM;

    useEffect(() => {
        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM || isOracleOnPrem) {
            const currentHost = host || selectedOnPremHostDetails;
            setTotalVolume(0);
            setHostname(currentHost?.resourceName);
            setNoOfInstances(
                isOracleOnPrem
                    ? currentHost?.oracleDatabases?.length || 0
                    : currentHost?.sqlServerInstances?.length || 0
            );
        } else {
            let volumeCount = 0;
            if (selectedHostDetails?.ebsResourceInfo?.length) {
                volumeCount += selectedHostDetails?.ebsResourceInfo?.length;
            }
            if (selectedPartnerHostDetails?.ebsResourceInfo?.length) {
                volumeCount += selectedPartnerHostDetails?.ebsResourceInfo?.length;
            }
            setTotalVolume(volumeCount);
            setHostname(selectedHostDetails?.name);
            setNoOfInstances(selectedHostDetails?.totalInstance);
        }
    }, [selectedHostDetails, selectedPartnerHostDetails, selectedOnPremHostDetails, host]);

    return (
        <div className={styles.selectedHosts}>
            <DsTypography variant="Regular_14" className={isDisabled ? styles.disabledHeading : ''}>
                {t('databases.explore-savings.selected-host')}:
            </DsTypography>
            <div className={styles.valueArea}>
                <div className={styles.container}>
                    {!selectedHostDetails?.loading && (
                        <DsTypography
                            variant="Semibold_14"
                            className={isDisabled ? `${styles.value} ${styles.disabledContent}` : styles.value}
                            title={hostname}
                        >
                            {hostname || t('databases.general.not-available')}
                        </DsTypography>
                    )}
                    {selectedHostDetails?.loading && (
                        <div className={styles.loader} style={{ marginRight: '104px' }}>
                            <FlashingDotsLoader />
                        </div>
                    )}
                    <DsTypography
                        variant="Regular_14"
                        className={isDisabled ? `${styles.heading} ${styles.disabledContent}` : styles.heading}
                    >
                        {t('databases.explore-savings.host-name')}
                    </DsTypography>
                </div>

                {/* <div className={styles.separator} /> */}

                <div className={`${styles.container} ${styles.numberContainer}`}>
                    {!selectedHostDetails?.loading && (
                        <DsTypography
                            variant="Semibold_14"
                            className={isDisabled ? `${styles.value} ${styles.disabledContent}` : styles.value}
                        >
                            {noOfInstances || t('databases.general.not-available')}
                        </DsTypography>
                    )}
                    {selectedHostDetails?.loading && (
                        <div className={styles.loader} style={{ marginRight: '104px' }}>
                            <FlashingDotsLoader />
                        </div>
                    )}
                    <DsTypography
                        variant="Regular_14"
                        className={isDisabled ? `${styles.heading2} ${styles.disabledContent}` : styles.heading2}
                    >
                        {isOracleOnPrem
                            ? t('databases.explore-savings.number-of-databases')
                            : t('databases.explore-savings.number-of-sql-instances')}{' '}
                    </DsTypography>
                </div>

                {/* <div className={styles.separator} /> */}
                {savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS && (
                    <div className={`${styles.container} ${styles.numberContainer}`}>
                        {!selectedHostDetails?.loading && !getPartnerHostDetailsLoading && (
                            <DsTypography
                                variant="Semibold_14"
                                className={isDisabled ? `${styles.value} ${styles.disabledContent}` : styles.value}
                            >
                                {totalVolume || t('databases.general.not-available')}
                            </DsTypography>
                        )}
                        {(selectedHostDetails?.loading || getPartnerHostDetailsLoading) && (
                            <div className={styles.loader}>
                                <FlashingDotsLoader />
                            </div>
                        )}
                        <DsTypography
                            variant="Regular_14"
                            className={isDisabled ? `${styles.heading} ${styles.disabledContent}` : styles.heading}
                        >
                            {t('databases.explore-savings.number-of-volumes')}
                        </DsTypography>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SavingsSelectedHost;

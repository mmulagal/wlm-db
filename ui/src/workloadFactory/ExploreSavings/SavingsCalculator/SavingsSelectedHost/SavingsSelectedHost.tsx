import { DsTypography, FlashingDotsLoader } from '@netapp/design-system';
import { useEffect, useState } from 'react';
import styles from './SavingsSelectedHost.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { GENERAL } from '../../../../utils/appConstants';
import { SAVINGS_CALC_MODE, WLF_TABS } from '../../../../utils/consts';

interface SavingsSelectedHostProps {
    host?: any;
}

const SavingsSelectedHost = ({ host }: SavingsSelectedHostProps) => {
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

    useEffect(() => {
        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM) {
            const currentHost = host || selectedOnPremHostDetails;
            setTotalVolume(0);
            setHostname(currentHost?.resourceName);
            setNoOfInstances(currentHost?.totalInstance || currentHost?.sqlServerInstances?.length || 0);
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
                Selected host:
            </DsTypography>
            <div
                className={styles.valueArea}
                style={{ width: selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES ? '848px' : '576px' }}
            >
                <div className={styles.container}>
                    {!selectedHostDetails?.loading && (
                        <DsTypography
                            variant="Semibold_14"
                            className={isDisabled ? `${styles.value} ${styles.disabledContent}` : styles.value}
                            title={hostname}
                        >
                            {hostname || GENERAL.NOT_AVAILABLE}
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
                        {GENERAL.ES_HOST_NAME}
                    </DsTypography>
                </div>

                {/* <div className={styles.separator} /> */}

                <div className={`${styles.container} ${styles.numberContainer}`}>
                    {!selectedHostDetails?.loading && (
                        <DsTypography
                            variant="Semibold_14"
                            className={isDisabled ? `${styles.value} ${styles.disabledContent}` : styles.value}
                        >
                            {noOfInstances || GENERAL.NOT_AVAILABLE}
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
                        {GENERAL.ES_NUMBER_OF_INSTANCE}{' '}
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
                                {totalVolume || GENERAL.NOT_AVAILABLE}
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
                            {GENERAL.ES_NUMBER_OF_VOLS}
                        </DsTypography>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SavingsSelectedHost;

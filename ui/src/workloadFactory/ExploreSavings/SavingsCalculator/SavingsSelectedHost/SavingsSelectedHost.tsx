import { DsTypography, FlashingDotsLoader } from '@netapp/design-system';
import styles from './SavingsSelectedHost.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { GENERAL } from '../../../../utils/appConstants';
import { useEffect, useState } from 'react';

const SavingsSelectedHost = () => {
    const isDisabled = false;
    const { selectedHostDetails, selectedPartnerHostDetails, getPartnerHostDetailsLoading } = useAppSelector(
        state => state.exploreSavings
    );
    const [totalVolume, setTotalVolume] = useState(0);

    useEffect(() => {
        let volumeCount = 0;
        if (selectedHostDetails?.ebsResourceInfo?.length) {
            volumeCount += selectedHostDetails?.ebsResourceInfo?.length;
        }
        if (selectedPartnerHostDetails?.ebsResourceInfo?.length) {
            volumeCount += selectedPartnerHostDetails?.ebsResourceInfo?.length;
        }
        setTotalVolume(volumeCount);
    }, [selectedHostDetails, selectedPartnerHostDetails]);

    return (
        <div className={styles.selectedHosts}>
            <DsTypography variant="Regular_14" className={isDisabled ? styles.disabledHeading : ''}>
                Selected host:
            </DsTypography>
            <div className={styles.valueArea}>
                <div className={styles.container}>
                    {!selectedHostDetails?.loading && (
                        <DsTypography
                            variant="Semibold_14"
                            className={isDisabled ? `${styles.value} ${styles.disabledContent}` : styles.value}
                            title={selectedHostDetails?.databaseServer?.activeNode}
                        >
                            {selectedHostDetails?.databaseServer?.activeNode || GENERAL.NOT_AVAILABLE}
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

                <div className={`${styles.container} ${styles.secondContainer}`}>
                    {!selectedHostDetails?.loading && (
                        <DsTypography
                            variant="Semibold_14"
                            style={{ display: 'flex', justifyContent: 'center' }}
                            className={isDisabled ? `${styles.value} ${styles.disabledContent}` : styles.value}
                        >
                            {selectedHostDetails?.databaseCount || GENERAL.NOT_AVAILABLE}
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
                        {GENERAL.ES_NUMBER_OF_DB}{' '}
                    </DsTypography>
                </div>

                {/* <div className={styles.separator} /> */}

                <div className={styles.container}>
                    {!selectedHostDetails?.loading && !getPartnerHostDetailsLoading && (
                        <DsTypography
                            variant="Semibold_14"
                            style={{ display: 'flex', justifyContent: 'center' }}
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
            </div>
        </div>
    );
};

export default SavingsSelectedHost;

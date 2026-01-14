import { DsFlashingDotsLoader, DsTypography } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import styles from './OracleCapacityUtilization.module.scss';
import MultiRingDoughnut from './MultiRingDoughnut/MultiRingDoughnut';
import Square from '../../../../../common/Square/Square';
import SeparatorComponent from '../../../../../common/SeparatorComponent/SeparatorComponent';
import { formatStorageSize } from '../../../../../utils/utilityFunctions';

type OCUProps = { resourceDetails: any; resourceLoading: boolean };

const OracleCapacityUtilization = ({ resourceDetails, resourceLoading }: OCUProps) => {
    const data = resourceDetails?.storage?.fsxn;
    const { t } = useTranslation();
    const usedStorageData = formatStorageSize(data?.used);
    const ssdStorageData = formatStorageSize(data?.ssdUsed);
    const capacityPoolData = formatStorageSize(data?.capacityPoolUsed);

    return (
        <div className={styles.oracleCapacityUtilization}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    {t('databases.oracle-inner-page.capacity-utilization')}
                </DsTypography>
                <div className={styles.rightTopValue}>
                    <DsTypography variant="Regular_20">{resourceLoading && <DsFlashingDotsLoader />}</DsTypography>
                </div>
            </div>
            <div className={styles.mainSection}>
                <MultiRingDoughnut
                    resourceDetails={resourceDetails}
                    resourceLoading={resourceLoading}
                    resourceType="oracle"
                />
                <div className={styles.detailsSection}>
                    <div className={styles.itemContainer}>
                        {resourceLoading && <DsFlashingDotsLoader />}
                        {!resourceLoading && (
                            <DsTypography variant="Semibold_14">
                                {usedStorageData?.value} {t(usedStorageData?.unit)}
                            </DsTypography>
                        )}
                        <div className={styles.itemBottom}>
                            <Square width="12px" height="12px" background="#5E8DCD" />
                            <DsTypography variant="Regular_14">
                                {t('databases.oracle-inner-page.written-data-size')}
                            </DsTypography>
                        </div>
                    </div>

                    <SeparatorComponent variant="vertical" height="49px" />

                    <div className={styles.itemContainer}>
                        {resourceLoading && <DsFlashingDotsLoader />}
                        {!resourceLoading && (
                            <DsTypography variant="Semibold_14">
                                {ssdStorageData?.value} {t(ssdStorageData?.unit)}
                            </DsTypography>
                        )}
                        <div className={styles.itemBottom}>
                            <Square width="12px" height="12px" background="#0BAFFC" />
                            <DsTypography variant="Regular_14">
                                {t('databases.oracle-inner-page.used-ssd')}
                            </DsTypography>
                        </div>
                    </div>

                    <SeparatorComponent variant="vertical" height="49px" />

                    <div className={styles.itemContainer}>
                        {resourceLoading && <DsFlashingDotsLoader />}
                        {!resourceLoading && (
                            <DsTypography variant="Semibold_14">
                                {capacityPoolData?.value} {t(capacityPoolData?.unit)}
                            </DsTypography>
                        )}
                        <div className={styles.itemBottom}>
                            <Square width="12px" height="12px" background="#A815F3" />
                            <DsTypography variant="Regular_14">
                                {t('databases.oracle-inner-page.used-capacity-pool')}
                            </DsTypography>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OracleCapacityUtilization;

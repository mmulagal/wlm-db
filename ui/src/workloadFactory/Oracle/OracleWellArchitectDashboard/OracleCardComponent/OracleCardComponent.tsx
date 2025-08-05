import { DsButton, DsTypography } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import styles from './OracleCardComponent.module.scss';

const OracleCardComponent = ({ cardData }: any) => {
    const { t } = useTranslation();
    return (
        <div className={styles['oracle-card']}>
            <div className={styles.cardContainer}>
                <div className={styles.itemContainer}>
                    <div className={styles.item}>
                        <div className={styles.summaryValue}>
                            <DsTypography variant="Semibold_14" className={styles.labelText}>
                                {cardData?.block_one?.value || '-'}
                            </DsTypography>
                        </div>
                        <DsTypography variant="Regular_14" className={styles.descriptionText}>
                            {cardData?.block_one?.type}
                        </DsTypography>
                    </div>
                </div>

                <div className={styles.itemContainer}>
                    <div className={styles.item}>
                        <div className={styles.summaryValue}>
                            <DsTypography variant="Semibold_14" className={styles.labelText}>
                                {cardData?.block_two?.value || '-'}
                            </DsTypography>
                        </div>
                        <DsTypography variant="Regular_14" className={styles.descriptionText}>
                            {cardData?.block_two?.type}
                        </DsTypography>
                    </div>
                </div>

                <div className={styles.itemContainer}>
                    <div className={styles.item}>
                        <div className={styles.summaryValue}>
                            <DsTypography variant="Semibold_14" className={styles.labelText}>
                                {cardData?.block_three?.value || '-'}
                            </DsTypography>
                        </div>
                        <DsTypography variant="Regular_14" className={styles.descriptionText}>
                            {cardData?.block_three?.type}
                        </DsTypography>
                    </div>
                </div>

                <div className={styles.itemContainer}>
                    <div className={styles.item}>
                        <div className={styles.summaryValue}>
                            <DsTypography variant="Semibold_14" className={styles.labelText}>
                                {cardData?.block_four?.value || '-'}
                            </DsTypography>
                        </div>
                        <DsTypography variant="Regular_14" className={styles.descriptionText}>
                            {cardData?.block_four?.type}
                        </DsTypography>
                    </div>
                </div>

                <div className={styles.itemContainer}>
                    <div className={styles.item}>
                        <div className={styles.summaryValue}>
                            <DsTypography variant="Semibold_14" className={styles.labelText}>
                                {cardData?.block_five?.value || '-'}
                            </DsTypography>
                        </div>
                        <DsTypography variant="Regular_14" className={styles.descriptionText}>
                            {cardData?.block_five?.type}
                        </DsTypography>
                    </div>
                </div>

                <div className={styles.lastButton}>
                    <DsButton variant="secondary" isThin>
                        {t('databases.oracle-inner-page.view-and-fix')}
                    </DsButton>
                </div>
            </div>
        </div>
    );
};

export default OracleCardComponent;

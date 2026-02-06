import { DsTypography } from '@tlveng/wlm-ds';
import { AccordionCard, AccordionCardContent, AccordionController, Typography } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { ReactComponent as Bullet } from '../../../../assets/ic_bullet.svg';
import styles from './AssessmentDialog.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { DBType } from '../../../../utils/consts';

const AssessmentDialog = () => {
    const { t } = useTranslation();
    const { selectedTCOHostType } = useAppSelector(state => state.exploreSavings);
    return (
        <div className={styles.assessmentDialog}>
            <div className={styles.partOne}>
                <DsTypography variant="Regular_14">
                    {selectedTCOHostType === DBType.ORACLE
                        ? t('databases.explore-savings.assessment-dialog-oracle-heading-part-one')
                        : t('databases.explore-savings.assessment-dialog-mssql-heading-part-one')}
                </DsTypography>

                <DsTypography variant="Regular_14">
                    {selectedTCOHostType === DBType.ORACLE
                        ? t('databases.explore-savings.assessment-dialog-oracle-heading-part-two')
                        : t('databases.explore-savings.assessment-dialog-mssql-heading-part-two')}
                </DsTypography>
            </div>

            <div className={styles.partOne}>
                <div className={styles.accordionSectionEC}>
                    <AccordionController isGrouped>
                        <div className={styles.firstAccordion}>
                            <AccordionCard
                                id="1"
                                title={
                                    <DsTypography variant="Semibold_14">
                                        {t('databases.explore-savings.what-data-does-the-script-collect')}
                                    </DsTypography>
                                }
                            >
                                <AccordionCardContent>
                                    <Typography variant="Regular_14">
                                        {selectedTCOHostType === DBType.ORACLE && (
                                            <div className={styles.partOne}>
                                                <div className={styles.list}>
                                                    <div className={styles.listItem} style={{ marginTop: '24px' }}>
                                                        <Bullet />
                                                        <DsTypography variant="Regular_14">
                                                            {t('databases.explore-savings.accordion-one-point-one')}
                                                        </DsTypography>
                                                    </div>
                                                    <div className={styles.listItem}>
                                                        <Bullet />
                                                        <DsTypography variant="Regular_14">
                                                            {t('databases.explore-savings.accordion-one-point-two')}
                                                        </DsTypography>
                                                    </div>

                                                    <div className={styles.listItem}>
                                                        <Bullet />
                                                        <DsTypography variant="Regular_14">
                                                            {t('databases.explore-savings.accordion-one-point-three')}
                                                        </DsTypography>
                                                    </div>

                                                    <div className={styles.listItem}>
                                                        <Bullet />
                                                        <DsTypography variant="Regular_14">
                                                            {t('databases.explore-savings.accordion-one-point-four')}
                                                        </DsTypography>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {selectedTCOHostType === DBType.MSSQL && (
                                            <div className={styles.partOne}>
                                                <div className={styles.list}>
                                                    <div className={styles.listItem} style={{ marginTop: '24px' }}>
                                                        <Bullet />
                                                        <DsTypography variant="Regular_14">
                                                            {t(
                                                                'databases.explore-savings.mssql-accordion-one-point-one'
                                                            )}
                                                        </DsTypography>
                                                    </div>
                                                    <div className={styles.listItem}>
                                                        <Bullet />
                                                        <DsTypography variant="Regular_14">
                                                            {t(
                                                                'databases.explore-savings.mssql-accordion-one-point-two'
                                                            )}
                                                        </DsTypography>
                                                    </div>

                                                    <div className={styles.listItem}>
                                                        <Bullet />
                                                        <DsTypography variant="Regular_14">
                                                            {t(
                                                                'databases.explore-savings.mssql-accordion-one-point-three'
                                                            )}
                                                        </DsTypography>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </Typography>
                                </AccordionCardContent>
                            </AccordionCard>
                        </div>

                        <div className={styles.secondAccordion}>
                            <AccordionCard
                                id="2"
                                title={
                                    <DsTypography variant="Semibold_14">
                                        {t('databases.explore-savings.important-notes')}
                                    </DsTypography>
                                }
                            >
                                <AccordionCardContent>
                                    <Typography variant="Regular_14">
                                        {selectedTCOHostType === DBType.ORACLE && (
                                            <div className={styles.partOne}>
                                                <div className={styles.list}>
                                                    <div className={styles.listItem} style={{ marginTop: '24px' }}>
                                                        <Bullet />
                                                        <DsTypography variant="Regular_14">
                                                            {t(
                                                                'databases.explore-savings.oracle-accordion-two-point-one'
                                                            )}
                                                        </DsTypography>
                                                    </div>
                                                    <div className={styles.listItem}>
                                                        <Bullet />
                                                        <DsTypography variant="Regular_14">
                                                            {t(
                                                                'databases.explore-savings.oracle-accordion-two-point-two'
                                                            )}
                                                        </DsTypography>
                                                    </div>

                                                    <div className={styles.listItem}>
                                                        <Bullet />
                                                        <DsTypography variant="Regular_14">
                                                            {t(
                                                                'databases.explore-savings.oracle-accordion-two-point-three'
                                                            )}
                                                        </DsTypography>
                                                    </div>

                                                    <div className={styles.listItem}>
                                                        <Bullet />
                                                        <DsTypography variant="Regular_14">
                                                            {t(
                                                                'databases.explore-savings.oracle-accordion-two-point-four'
                                                            )}
                                                        </DsTypography>
                                                    </div>

                                                    <div className={styles.listItem}>
                                                        <Bullet />
                                                        <DsTypography variant="Regular_14">
                                                            {t(
                                                                'databases.explore-savings.oracle-accordion-two-point-five'
                                                            )}
                                                        </DsTypography>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {selectedTCOHostType === DBType.MSSQL && (
                                            <div className={styles.partOne}>
                                                <div className={styles.list}>
                                                    <div className={styles.listItem} style={{ marginTop: '24px' }}>
                                                        <Bullet />
                                                        <DsTypography variant="Regular_14">
                                                            {t(
                                                                'databases.explore-savings.mssql-accordion-two-point-one'
                                                            )}
                                                        </DsTypography>
                                                    </div>
                                                    <div className={styles.listItem}>
                                                        <Bullet />
                                                        <DsTypography variant="Regular_14">
                                                            {t(
                                                                'databases.explore-savings.mssql-accordion-two-point-two'
                                                            )}
                                                        </DsTypography>
                                                    </div>

                                                    <div className={styles.listItem}>
                                                        <Bullet />
                                                        <DsTypography variant="Regular_14">
                                                            {t(
                                                                'databases.explore-savings.mssql-accordion-two-point-three'
                                                            )}
                                                        </DsTypography>
                                                    </div>

                                                    <div className={styles.listItem}>
                                                        <Bullet />
                                                        <DsTypography variant="Regular_14">
                                                            {t(
                                                                'databases.explore-savings.mssql-accordion-two-point-four'
                                                            )}
                                                        </DsTypography>
                                                    </div>

                                                    <div className={styles.listItem}>
                                                        <Bullet />
                                                        <DsTypography variant="Regular_14">
                                                            {t(
                                                                'databases.explore-savings.mssql-accordion-two-point-five'
                                                            )}
                                                        </DsTypography>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </Typography>
                                </AccordionCardContent>
                            </AccordionCard>
                        </div>

                        <div className={styles.firstAccordion}>
                            <AccordionCard
                                id="3"
                                title={
                                    <DsTypography variant="Semibold_14">
                                        {t('databases.explore-savings.prerequisites-and-compatibility')}
                                    </DsTypography>
                                }
                            >
                                <AccordionCardContent>
                                    <Typography variant="Regular_14">
                                        {selectedTCOHostType === DBType.ORACLE && (
                                            <div className={styles.partOne}>
                                                <div className={styles.list}>
                                                    <div className={styles.listItem} style={{ marginTop: '24px' }}>
                                                        <Bullet />
                                                        <DsTypography variant="Regular_14">
                                                            {t(
                                                                'databases.explore-savings.oracle-accordion-three-point-one'
                                                            )}
                                                        </DsTypography>
                                                    </div>
                                                    <div className={styles.listItem}>
                                                        <Bullet />
                                                        <DsTypography variant="Regular_14">
                                                            {t(
                                                                'databases.explore-savings.oracle-accordion-three-point-two'
                                                            )}
                                                        </DsTypography>
                                                    </div>
                                                    <div className={styles.listItem}>
                                                        <Bullet />
                                                        <DsTypography variant="Regular_14">
                                                            {t(
                                                                'databases.explore-savings.oracle-accordion-three-point-three'
                                                            )}
                                                        </DsTypography>
                                                    </div>
                                                    <div className={styles.listItem}>
                                                        <Bullet />
                                                        <DsTypography variant="Regular_14">
                                                            {t(
                                                                'databases.explore-savings.oracle-accordion-three-point-four'
                                                            )}
                                                        </DsTypography>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {selectedTCOHostType === DBType.MSSQL && (
                                            <div className={styles.partOne}>
                                                <div className={styles.list}>
                                                    <div className={styles.listItem} style={{ marginTop: '24px' }}>
                                                        <Bullet />
                                                        <DsTypography variant="Regular_14">
                                                            {t(
                                                                'databases.explore-savings.mssql-accordion-three-point-one'
                                                            )}
                                                        </DsTypography>
                                                    </div>

                                                    <div className={styles.listItem}>
                                                        <Bullet />
                                                        <DsTypography variant="Regular_14">
                                                            {t(
                                                                'databases.explore-savings.mssql-accordion-three-point-three'
                                                            )}
                                                            <div className={styles.secondLevelList}>
                                                                <div className={styles.item}>
                                                                    <DsTypography variant="Regular_14">
                                                                        {t(
                                                                            'databases.explore-savings.mssql-accordion-three-point-three-point-one'
                                                                        )}
                                                                    </DsTypography>
                                                                </div>

                                                                <div className={styles.item}>
                                                                    <DsTypography variant="Regular_14">
                                                                        {t(
                                                                            'databases.explore-savings.mssql-accordion-three-point-three-point-two'
                                                                        )}
                                                                    </DsTypography>
                                                                </div>
                                                            </div>
                                                        </DsTypography>
                                                    </div>
                                                    <div className={styles.listItem}>
                                                        <Bullet />
                                                        <DsTypography variant="Regular_14">
                                                            {t(
                                                                'databases.explore-savings.mssql-accordion-three-point-four'
                                                            )}
                                                        </DsTypography>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </Typography>
                                </AccordionCardContent>
                            </AccordionCard>
                        </div>
                    </AccordionController>
                </div>
            </div>
        </div>
    );
};

export default AssessmentDialog;

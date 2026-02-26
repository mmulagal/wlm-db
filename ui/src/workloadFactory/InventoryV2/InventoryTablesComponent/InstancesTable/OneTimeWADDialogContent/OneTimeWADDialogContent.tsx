import { DsTypography } from '@tlveng/wlm-ds';
import { AccordionCard, AccordionCardContent, AccordionController, Typography } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { ReactComponent as Bullet } from '../../../../../assets/ic_bullet.svg';
import styles from './OneTimeWADDialogContent.module.scss';

const OneTimeWADDialogContent = () => {
    const { t } = useTranslation();
    return (
        <div className={styles.wadDialogContent}>
            <div className={styles.partOne}>
                <DsTypography variant="Regular_14">{t('databases.inventory.one-time-wad-dialog-content')}</DsTypography>
            </div>

            <div className={styles.partOne}>
                <DsTypography variant="Semibold_14">{t('databases.inventory.key-benefits')}</DsTypography>

                <div className={styles.list}>
                    <div className={styles.listItem}>
                        <Bullet />
                        <DsTypography variant="Regular_14">
                            {t('databases.inventory.one-time-wad-bullet-1')}
                        </DsTypography>
                    </div>
                    <div className={styles.listItem}>
                        <Bullet />
                        <DsTypography variant="Regular_14">
                            {t('databases.inventory.one-time-wad-bullet-2')}
                        </DsTypography>
                    </div>

                    <div className={styles.listItem}>
                        <Bullet />
                        <DsTypography variant="Regular_14">
                            {t('databases.inventory.one-time-wad-bullet-3')}
                        </DsTypography>
                    </div>
                </div>
            </div>

            <div className={styles.partOne}>
                <div className={styles.accordionSectionEC}>
                    <AccordionController isGrouped>
                        <div className={styles.firstAccordion}>
                            <AccordionCard
                                id="1"
                                title={
                                    <DsTypography variant="Semibold_14">
                                        {t('databases.inventory.how-to-run-the-assessment')}
                                    </DsTypography>
                                }
                            >
                                <AccordionCardContent>
                                    <Typography variant="Regular_14">
                                        <div className={styles.allContent}>
                                            <div className={styles.listItems}>
                                                <div className={styles.numberDigit}>1 &nbsp;|</div>
                                                <DsTypography variant="Regular_14">
                                                    {t('databases.inventory.download-the-data-collection-script')}
                                                </DsTypography>
                                            </div>

                                            <div className={styles.listItems}>
                                                <div className={styles.numberDigit}>2 &nbsp;|</div>
                                                <DsTypography variant="Regular_14">
                                                    {t('databases.inventory.copy-the-script-to-your-sql-server-host')}
                                                </DsTypography>
                                            </div>

                                            <div className={styles.listItems}>
                                                <div className={styles.numberDigit}>3 &nbsp;|</div>
                                                <DsTypography variant="Regular_14">
                                                    {t('databases.inventory.run-the-script-in-powershell')}
                                                </DsTypography>
                                            </div>

                                            <div className={styles.listItems}>
                                                <div className={styles.numberDigit}>4 &nbsp;|</div>
                                                <DsTypography variant="Regular_14">
                                                    {t(
                                                        'databases.inventory.upload-the-output-file-back-to-this-console'
                                                    )}
                                                </DsTypography>
                                            </div>

                                            <div className={styles.listItems}>
                                                <div className={styles.numberDigit}>5 &nbsp;|</div>
                                                <DsTypography variant="Regular_14">
                                                    {t('databases.inventory.first-upload-creates-a-new-instance')}
                                                </DsTypography>
                                            </div>
                                        </div>
                                    </Typography>
                                </AccordionCardContent>
                            </AccordionCard>
                        </div>

                        <div className={styles.secondAccordion}>
                            <AccordionCard
                                id="2"
                                title={
                                    <DsTypography variant="Semibold_14">
                                        {t('databases.inventory.what-data-does-the-script-collect')}
                                    </DsTypography>
                                }
                            >
                                <AccordionCardContent>
                                    <Typography variant="Regular_14">
                                        <div className={styles.partOne}>
                                            <div className={styles.list}>
                                                <div className={styles.listItem} style={{ marginTop: '24px' }}>
                                                    <Bullet />
                                                    <DsTypography variant="Regular_14">
                                                        {t('databases.inventory.sql-server-instance-information')}
                                                    </DsTypography>
                                                </div>
                                                <div className={styles.listItem}>
                                                    <Bullet />
                                                    <DsTypography variant="Regular_14">
                                                        {t('databases.inventory.database-metadata')}
                                                    </DsTypography>
                                                </div>

                                                <div className={styles.listItem}>
                                                    <Bullet />
                                                    <DsTypography variant="Regular_14">
                                                        {t('databases.inventory.storage-configuration')}
                                                    </DsTypography>
                                                </div>

                                                <div className={styles.listItem}>
                                                    <Bullet />
                                                    <DsTypography variant="Regular_14">
                                                        {t('databases.inventory.high-availability-settings')}
                                                    </DsTypography>
                                                </div>
                                            </div>
                                        </div>
                                    </Typography>
                                </AccordionCardContent>
                            </AccordionCard>
                        </div>

                        <div className={styles.firstAccordion}>
                            <AccordionCard
                                id="3"
                                title={
                                    <DsTypography variant="Semibold_14">
                                        {t('databases.inventory.prerequisites')}
                                    </DsTypography>
                                }
                            >
                                <AccordionCardContent>
                                    <Typography variant="Regular_14">
                                        <div className={styles.partOne}>
                                            <div className={styles.list}>
                                                <div className={styles.listItem} style={{ marginTop: '24px' }}>
                                                    <Bullet />
                                                    <DsTypography variant="Semibold_14">
                                                        {t('databases.inventory.wad-accordion-three-point-one')}
                                                    </DsTypography>
                                                </div>
                                                <div className={styles.listItem}>
                                                    <Bullet />

                                                    <DsTypography variant="Regular_14">
                                                        <span className={styles.fontApplied}>
                                                            {t(
                                                                'databases.inventory.wad-accordion-three-point-two-bold'
                                                            )}
                                                        </span>
                                                        <span>
                                                            {t('databases.inventory.wad-accordion-three-point-two')}
                                                        </span>
                                                    </DsTypography>
                                                </div>

                                                <div className={styles.listItem}>
                                                    <Bullet />

                                                    <DsTypography variant="Regular_14">
                                                        <span className={styles.fontApplied}>
                                                            {t(
                                                                'databases.inventory.wad-accordion-three-point-three-bold'
                                                            )}
                                                        </span>
                                                        <span>
                                                            {t('databases.inventory.wad-accordion-three-point-three')}
                                                        </span>
                                                    </DsTypography>
                                                </div>

                                                <div className={styles.listItem}>
                                                    <div>
                                                        <Bullet />
                                                    </div>

                                                    <DsTypography variant="Regular_14">
                                                        <span className={styles.fontApplied}>
                                                            {t(
                                                                'databases.inventory.wad-accordion-three-point-four-bold'
                                                            )}
                                                        </span>
                                                        <span>
                                                            {t('databases.inventory.wad-accordion-three-point-four')}
                                                        </span>
                                                    </DsTypography>
                                                </div>

                                                <div className={styles.listItem}>
                                                    <Bullet />

                                                    <div>
                                                        <DsTypography variant="Regular_14">
                                                            <span className={styles.fontApplied}>
                                                                {t(
                                                                    'databases.inventory.wad-accordion-three-point-five-bold'
                                                                )}
                                                            </span>
                                                            <span>
                                                                {t(
                                                                    'databases.inventory.wad-accordion-three-point-five'
                                                                )}
                                                            </span>
                                                        </DsTypography>

                                                        <div className={styles.secondLevelList}>
                                                            <div className={styles.item}>
                                                                <DsTypography variant="Regular_14">
                                                                    {t(
                                                                        'databases.inventory.wad-accordion-three-point-five-option-one'
                                                                    )}
                                                                </DsTypography>
                                                            </div>

                                                            <div className={styles.item}>
                                                                <DsTypography variant="Regular_14">
                                                                    {t(
                                                                        'databases.inventory.wad-accordion-three-point-five-option-two'
                                                                    )}
                                                                </DsTypography>
                                                            </div>

                                                            <div className={styles.item}>
                                                                <DsTypography variant="Regular_14">
                                                                    {t(
                                                                        'databases.inventory.wad-accordion-three-point-five-option-three'
                                                                    )}
                                                                </DsTypography>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
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

export default OneTimeWADDialogContent;

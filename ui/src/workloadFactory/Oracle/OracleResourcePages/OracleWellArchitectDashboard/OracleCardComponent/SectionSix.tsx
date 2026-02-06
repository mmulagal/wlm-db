import { DsFlashingDotsLoader, DsTypography } from '@tlveng/wlm-ds';
import { Popover } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import styles from './OracleCardComponent.module.scss';
import { GENERAL } from '../../../../../utils/appConstants';
import { ASSESSMENT_CONFIG_NAMES, CONFIG_STATES } from '../../../../../utils/consts';
import { ReactComponent as TooltipIcon } from '../../../../../assets/tooltipGrey.svg';

const SectionSix = ({ cardData, loading, disableText }: any) => {
    const { t } = useTranslation();

    const tooltipListSection = (listObj: { key: string; value: string | number }[], valWidth: string) => (
        <div className={styles.tooltipLevel}>
            {listObj?.map((item, index: number) => (
                <div key={index}>
                    <div className={styles.row}>
                        <div className={styles.firstPart}>
                            <DsTypography variant="Semibold_13">{item.key}</DsTypography>
                        </div>

                        <div className={styles.secondPart} style={{ width: valWidth }}>
                            <DsTypography variant="Regular_13">{item.value}</DsTypography>
                        </div>
                    </div>
                    {index !== listObj.length - 1 && <div className={styles.tooltipSeparator} />}
                </div>
            ))}
        </div>
    );

    if (loading) {
        return (
            <div className={styles.loadingSection}>
                <DsFlashingDotsLoader />
            </div>
        );
    }

    if (cardData?.dismissedObj?.configState && cardData?.dismissedObj?.configState !== CONFIG_STATES.ACTIVE) {
        // Condition to show n/a if state is not active
        return (
            <DsTypography variant="Semibold_14" isDisabled={disableText}>
                {GENERAL.NOT_AVAILABLE}
            </DsTypography>
        );
    }

    if (
        cardData?.osPatchMissingPatches &&
        cardData?.block_one?.value === ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH
    ) {
        const listObj = [
            { key: 'Critical ', value: cardData?.osPatchMissingPatches?.critical },
            { key: 'Security ', value: cardData?.osPatchMissingPatches?.security },
            { key: 'Other ', value: cardData?.osPatchMissingPatches?.other }
        ];
        return (
            <div className={styles.tooltipContainer}>
                {cardData?.block_six?.value > 0 && (
                    <div className={styles.tooltip}>
                        <Popover
                            popoverClass=""
                            trigger="hover"
                            isAppendedToBody={false}
                            container={<TooltipIcon />}
                            placement="bottom"
                        >
                            {tooltipListSection(listObj, '30px')}
                        </Popover>
                    </div>
                )}
                <DsTypography variant="Semibold_14" isDisabled={disableText}>
                    {cardData?.block_six?.value || t('databases.general.not-available-table-columns')}
                </DsTypography>
            </div>
        );
    }

    if (cardData?.block_six?.count) {
        return (
            <div className={styles.warningMsg}>
                <DsTypography style={{ lineHeight: 'unset' }} variant="Regular_24">
                    {cardData?.block_six?.count?.totalObjectsInViolation || 0}
                </DsTypography>
                <DsTypography className={styles.centerText} variant="Semibold_14" isDisabled={disableText}>
                    {' out of '}
                </DsTypography>
                <DsTypography style={{ lineHeight: 'unset' }} variant="Regular_24">
                    {cardData?.block_six?.count?.totalObjectsAssessed || 0}
                </DsTypography>
            </div>
        );
    }

    if (cardData?.block_six?.smallFont || !cardData?.block_six?.value) {
        return (
            <DsTypography variant="Semibold_14" isDisabled={disableText}>
                {cardData?.block_six?.value || GENERAL.NOT_AVAILABLE}
            </DsTypography>
        );
    }

    return (
        <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }} isDisabled={disableText}>
            {cardData?.block_six?.value || GENERAL.NOT_AVAILABLE}
        </DsTypography>
    );
};

export default SectionSix;

import { useTranslation } from 'react-i18next';
import { DsButton } from '@tlveng/wlm-ds';
import styles from './OracleCardComponent.module.scss';
import { GETWELL_STATUS } from '../../../../../utils/consts';

interface ViewAndFixButtonProps {
    cardData?: {
        block_one?: {
            value?: string;
        };
        block_two?: {
            value?: string;
        };
    };
    loading?: boolean;
}

const ViewAndFixButton = ({ cardData, loading }: ViewAndFixButtonProps) => {
    const { t } = useTranslation();

    return (
        <>
            {cardData?.block_one?.value !== 'ONTAP' && (
                <div className={styles.lastButton}>
                    <DsButton
                        variant="secondary"
                        isThin
                        isDisabled={loading || cardData?.block_two?.value !== GETWELL_STATUS.NOT_OPTIMIZED}
                    >
                        {t('databases.oracle-inner-page.view')}
                    </DsButton>
                </div>
            )}
        </>
    );
};

export default ViewAndFixButton;

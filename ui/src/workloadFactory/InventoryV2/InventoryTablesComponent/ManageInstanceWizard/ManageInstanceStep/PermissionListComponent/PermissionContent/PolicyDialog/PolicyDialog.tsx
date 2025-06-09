import { DsTypography, Popover } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CopyIcon } from '../../../../../../../../assets/ic_copy.svg';
import styles from './PolicyDialog.module.scss';
import CopyToClipboardCommon from '../../../../../../../../common/CopyToClipboard/copyToClipboard';

interface PolicyDialogProps {
    data: string;
    label: string;
}

const PolicyDialog = ({ data, label }: PolicyDialogProps) => {
    const { t } = useTranslation();
    return (
        <div className={styles.policyDialog}>
            <DsTypography variant="Semibold_16">{label}</DsTypography>
            <div className={styles['dialog-content']}>
                <div className={styles['dialog-body']}>
                    <div className={styles['code-box']}>
                        <div className={styles.copy}>
                            <Popover
                                popoverClass={styles['copy-popover']}
                                children={t('databases.general.copied-to-clipboard')}
                                container={
                                    <CopyToClipboardCommon value={data} iconProvided={<CopyIcon fill="#A7A7A7" />} />
                                }
                            />
                        </div>
                        <div className={styles.code}>
                            <pre>
                                <DsTypography variant="Regular_14">{data}</DsTypography>
                            </pre>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PolicyDialog;

import { Typography } from '@netapp/design-system';
import { GENERAL } from '../../../utils/appConstants';
import styles from './RemoveDialog.module.scss';

type RemoveDialogProps = {
    weType: string;
    name: string | (string | null)[];
};

const RemoveDialog = ({ weType, name }: RemoveDialogProps) => (
    <div className={styles.removeDialogContainer}>
        <div className={styles.removeDialogContent}>
            <Typography variant="Regular_14">
                {GENERAL.REMOVE_DIALOG_CONTENT_FIRST_PART(weType)}
                <span className={styles.resourceName}>{`'${name}'`}</span>
                {GENERAL.REMOVE_DIALOG_CONTENT_SECOND_PART}
            </Typography>
        </div>
        <div className={styles.removeDialogNotice}>
            <Typography className={styles.noticeTag} variant="Semibold_14">
                {GENERAL.NOTICE}
            </Typography>
            <Typography variant="Semibold_14">{GENERAL.REMOVE_DIALOG_NOTICE(weType)}</Typography>
        </div>
    </div>
);

export default RemoveDialog;

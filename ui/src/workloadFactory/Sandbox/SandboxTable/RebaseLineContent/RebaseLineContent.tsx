import { DsTypography } from '@netapp/design-system';
import styles from './RebaseLineContent.module.scss';
import RebaseRollbackContent from '../RebaseRollbackContent/RebaseRollbackContent';

const RebaseLineContent = ({ dialogType }: any) => {
    return (
        <div className={styles.rebaseLineContent}>
            <DsTypography variant="Regular_14">
                {dialogType === 'rebase'
                    ? 'Are you sure you want to Re-baseline this sandbox for database'
                    : 'Are you sure you want to refresh this sandbox for database'}
            </DsTypography>
            <DsTypography variant="Regular_14" className={styles.secondLine}>
                {dialogType === 'rebase'
                    ? 'This action will return the sandbox to the original version of the selected sandbox as it was at its creation, regardless of the changes made.'
                    : 'This action will update the selected sandbox so that it is equivalent to the source database at the current moment.'}
            </DsTypography>

            <DsTypography variant="Regular_14" className={styles.secondLine}>
                Any changes you made to the sandbox will be deleted.
            </DsTypography>
            {dialogType === 'refresh' && (
                <div className={styles.rollbackContainer}>
                    <RebaseRollbackContent />
                </div>
            )}
        </div>
    );
};

export default RebaseLineContent;

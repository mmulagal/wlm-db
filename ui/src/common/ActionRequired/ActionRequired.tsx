import { Popover, Typography } from '@netapp/design-system';
import { ReactComponent as ActionRequiredIcon } from '../../assets/action-required.svg';
import { ReactComponent as ActionRequiredErrorIcon } from '../../assets/Action_required_error.svg';
import { GENERAL } from '../../utils/appConstants';
import styles from './ActionRequired.module.scss';

type AR = {
    error?: boolean;
    disabled?: boolean;
};

const ActionRequired = ({ error = false, disabled = false }: AR) => {
    return disabled ? (
        <Popover
            popoverClass={styles['copy-popover']}
            children={GENERAL.SELECT_ANY_VPC}
            trigger="hover"
            container={
                <div className={styles['action-required']}>
                    <div className={styles.disabledIcon}>
                        <ActionRequiredIcon />
                    </div>
                    <div className={styles.textDisabled}>{GENERAL.ACTION_REQUIRED}</div>
                </div>
            }
        />
    ) : (
        <div className={styles['action-required']}>
            {error && <ActionRequiredErrorIcon />}
            {!error && <ActionRequiredIcon />}
            <Typography variant="Regular_14" className={styles.text}>
                {GENERAL.ACTION_REQUIRED}
            </Typography>
        </div>
    );
};

export default ActionRequired;

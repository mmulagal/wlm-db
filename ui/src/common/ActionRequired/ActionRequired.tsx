import { ReactComponent as ActionRequiredIcon } from '../../assets/action-required.svg';
import { ReactComponent as ActionRequiredErrorIcon } from '../../assets/Action_required_error.svg';
import styles from './ActionRequired.module.scss';

type AR = {
    error?: boolean;
};

const ActionRequired = ({ error = false }: AR) => {
    return (
        <div className={styles['action-required']}>
            {error && <ActionRequiredErrorIcon />}
            {!error && <ActionRequiredIcon />}
            <div className={styles.text}>Action required</div>
        </div>
    );
};

export default ActionRequired;

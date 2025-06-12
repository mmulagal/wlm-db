import { ReactComponent as ErrorIcon } from '../../assets/error-icon.svg';
import { GENERAL } from '../../utils/appConstants';
import styles from './AccordionError.module.scss';

const AccordionError = () => (
    <div className={styles['action-required']}>
        <ErrorIcon />
        <div className={styles.text}>{GENERAL.ONE_OR_MORE_ERROR}</div>
    </div>
);

export default AccordionError;

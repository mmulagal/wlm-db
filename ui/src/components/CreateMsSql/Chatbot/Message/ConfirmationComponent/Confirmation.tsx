import styles from './Confirmation.module.scss';

type confirmationType = {
    confirmText: string;
    confirmButtonText: string;
    cancelButtonText: string;
    onConfirm: () => void;
    onCancel: () => void;
};

const Confirmation = ({ confirmText, confirmButtonText, cancelButtonText, onConfirm, onCancel }: confirmationType) => {
    return (
        <div className={styles['confirmation-container']}>
            <div className={styles['confirmation-text']}>{confirmText}</div>
            <div className={styles['buttons-container']}>
                <button className={styles['discard-button']} onClick={onCancel}>
                    {cancelButtonText}
                </button>
                <button className={styles['select-chosen-button']} onClick={onConfirm}>
                    {confirmButtonText}
                </button>
            </div>
        </div>
    );
};

export default Confirmation;

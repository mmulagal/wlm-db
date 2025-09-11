import { Typography } from '@netapp/design-system';
import styles from './CardComponentConfig.module.scss';
import { ReactComponent as ComingSoon } from '../../assets/comingSoon2.svg';

type CC = {
    idToAdd: string;
    selectedConfigCondition: boolean;
    icon: any;
    handleClick: any;
    heading: string;
    content: string;
    tickIcon: any;
    isDisabled?: boolean;
};

const CardComponentConfig = ({
    idToAdd,
    selectedConfigCondition,
    icon,
    handleClick,
    heading,
    content,
    tickIcon,
    isDisabled = false
}: CC) => (
    <div className={styles.cardComponent}>
        <div
            id={idToAdd}
            className={
                selectedConfigCondition ? `${styles['easy-create']} ${styles['add-border']}` : styles['easy-create']
            }
            onClick={isDisabled ? () => {} : handleClick}
        >
            <div className={styles.level}>
                <div>{icon}</div>

                <div className={styles['easy-create-content']}>
                    <div className={styles.headingContent}>
                        <div
                            className={styles['easy-create-heading']}
                            style={{ color: isDisabled ? 'var(--text-disabled)' : 'var(--text-primary)' }}
                        >
                            {heading}
                        </div>
                        {isDisabled && (
                            <div className={styles.tagClass}>
                                <ComingSoon />
                            </div>
                        )}
                    </div>

                    <Typography
                        variant="Regular_13"
                        style={{ color: isDisabled ? 'var(--text-disabled)' : 'var(--text-primary)' }}
                        className={styles['easy-create-content-text']}
                    >
                        {content}
                    </Typography>
                </div>
            </div>

            {selectedConfigCondition && <div className={styles['tick-placement']}>{tickIcon}</div>}
        </div>
    </div>
);

export default CardComponentConfig;

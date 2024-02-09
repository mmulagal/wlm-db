import { Typography } from '@netapp/design-system';
import styles from './CardComponentConfig.module.scss';

type CC = {
    idToAdd: string;
    selectedConfigCondition: boolean;
    icon: any;
    handleClick: any;
    heading: string;
    content: string;
    tickIcon: any;
};

const CardComponentConfig = ({
    idToAdd,
    selectedConfigCondition,
    icon,
    handleClick,
    heading,
    content,
    tickIcon
}: CC) => {
    return (
        <div className={styles.cardComponent}>
            <div
                id={idToAdd}
                className={
                    selectedConfigCondition ? `${styles['easy-create']} ${styles['add-border']}` : styles['easy-create']
                }
                onClick={handleClick}
            >
                <div className={styles.level}>
                    {icon}
                    <div className={styles['easy-create-content']}>
                        <div className={styles['easy-create-heading']}>{heading}</div>
                        <Typography variant="Regular_13" className={styles['easy-create-content-text']}>
                            {content}
                        </Typography>
                    </div>
                </div>

                {selectedConfigCondition && <div className={styles['tick-placement']}>{tickIcon}</div>}
            </div>
        </div>
    );
};

export default CardComponentConfig;

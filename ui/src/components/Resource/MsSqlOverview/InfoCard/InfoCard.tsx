import { Button, FlashingDotsLoader, Typography } from '@netapp/design-system';
import styles from './InfoCard.module.scss';

type InfoCardProps = {
    renderIcon: () => React.ReactNode;
    value: string;
    isValueLoading?: boolean;
    label: string;
    buttonText: string;
    buttonClick: () => void;
};

const InfoCard = ({ renderIcon, value, isValueLoading=false, label, buttonText, buttonClick }: InfoCardProps) => {
    return (
        <div className={styles.infoCardContainer}>
            <div className={styles.infoContainer}>
                <div className={styles.iconContainer}>{renderIcon()}</div>
                <div className={styles.textContainer}>
                    {isValueLoading ? 
                        <div className={styles.loaderContainer}>
                            <FlashingDotsLoader/>
                        </div> : 
                        <Typography className={styles.infoTextValue} variant="Regular_32">
                            {value}
                        </Typography>
                    } 
                    <Typography variant="Regular_14">{label}</Typography>
                </div>
            </div>
            <div className={styles.buttonContainer}>
                <Button variant="secondary" onClick={buttonClick} isThin>
                    {buttonText}
                </Button>
            </div>
        </div>
    );
};

export default InfoCard;

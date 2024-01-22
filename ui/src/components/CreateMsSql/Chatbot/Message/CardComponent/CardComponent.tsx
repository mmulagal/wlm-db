import { Typography } from '@netapp/design-system';
import styles from './CardComponent.module.scss';
import { ReactComponent as CustomPackageIcon } from '../../../../../assets/cutom-package-icon.svg';

type CardComponentProps = {
    cardList: Array<any>;
    handleSelectButtonClicked: (paramObj: any) => void;
    selectKey: string;
};

const CardComponent = ({ cardList, handleSelectButtonClicked, selectKey }: CardComponentProps) => {
    return (
        <div className={styles['cards-container']}>
            {cardList.map((item: any) => {
                return (
                    <div
                        className={styles['card-item']}
                        onClick={() =>
                            handleSelectButtonClicked({ [selectKey]: { label: item.label, value: item.value } })
                        }
                    >
                        <div className={styles['card-heading']}>
                            <Typography variant="Semibold_16">{item.label}</Typography>
                        </div>
                        {item.data?.length ? (
                            <div className={styles['card-content']}>
                                {item.data.map((obj: any) => {
                                    return (
                                        <div className={styles['data-item']}>
                                            <div className={styles['data-item-value']}>
                                                <Typography variant="Semibold_13">{obj.value}</Typography>
                                            </div>
                                            <div className={styles['data-item-label']}>
                                                <Typography variant="Regular_14">{obj.label}</Typography>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className={styles['image-container']}>
                                <CustomPackageIcon />
                                <Typography variant="Regular_14" className={styles['custom-txt']}>
                                    Configure all the parameters on your own
                                </Typography>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default CardComponent;

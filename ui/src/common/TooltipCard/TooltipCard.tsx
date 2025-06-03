import { DsTypography } from '@netapp/design-system';
import styles from './TooltipCard.module.scss';
import { MANAGE_STATES } from '../../utils/consts';
import { ReactComponent as Success } from '../../assets/success.svg';
import { ReactComponent as Cross } from '../../assets/black-cross.svg';

const TooltipCard = ({
    listObj,
    registerFlow
}: {
    listObj: { key: string; value: string }[];
    registerFlow?: boolean;
}) => {
    return (
        <div className={styles.tooltipLevel}>
            {listObj?.map((item: any, index: number) => {
                return (
                    <div key={index}>
                        <div className={styles.row}>
                            <div className={styles.col}>
                                <DsTypography variant="Regular_13">{item.key}</DsTypography>
                            </div>

                            <div className={styles.col}>
                                {registerFlow && (item?.value === MANAGE_STATES.READY ? <Success /> : <Cross />)}
                                <DsTypography variant="Regular_13">{item?.value}</DsTypography>
                            </div>
                        </div>
                        {index !== listObj.length - 1 && <div className={styles.tooltipSeparator} />}
                    </div>
                );
            })}
        </div>
    );
};

export default TooltipCard;

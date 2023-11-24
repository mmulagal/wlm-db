import { Typography } from '@netapp/design-system';
import { GENERAL } from '../../../utils/appConstants';
import styles from './RedirectToCF.module.scss';

const RedirectToCF = () => {
    return (
        <div className={styles.redirect}>
            <Typography variant="Regular_14" className={styles.content}>{GENERAL.RCF_DESC1}</Typography>
            <div className={`${styles.points} ${styles.content}`}>
                <Typography variant="Semibold_14">{GENERAL.RCF_POINT1[0]}</Typography>&nbsp;
                <Typography variant="Regular_14">{GENERAL.RCF_POINT1[1]}</Typography>&nbsp;
                <Typography variant="Semibold_14">{GENERAL.RCF_POINT1[2]}</Typography>&nbsp;
                <Typography variant="Regular_14">{GENERAL.RCF_POINT1[3]}</Typography>
            </div>

            <div className={`${styles.points} ${styles.content}`}>
                <Typography variant="Semibold_14">{GENERAL.RCF_POINT2[0]}</Typography>&nbsp;
                <Typography variant="Regular_14">{GENERAL.RCF_POINT2[1]}</Typography>
            </div>

            <div className={styles.points}>
                <Typography variant="Semibold_14">{GENERAL.RCF_POINT3[0]}</Typography>&nbsp;
                <Typography variant="Regular_14">{GENERAL.RCF_POINT3[1]}</Typography>&nbsp;
                <Typography variant="Semibold_14">{GENERAL.RCF_POINT3[2]}</Typography>&nbsp;
                <Typography variant="Regular_14">{GENERAL.RCF_POINT3[3]}</Typography>&nbsp;
                <Typography variant="Semibold_14">{GENERAL.RCF_POINT3[4]}</Typography>&nbsp;
                <Typography variant="Regular_14">{GENERAL.RCF_POINT3[5]}</Typography>&nbsp;
                <Typography variant="Semibold_14">{GENERAL.RCF_POINT3[6]}</Typography>
            </div>

            <div className={`${styles.points} ${styles.content}`}>
                <Typography variant="Semibold_14">{GENERAL.RCF_POINT3[7]}</Typography>
            </div>

            <div className={`${styles.points}`}>
                <Typography variant="Semibold_14">{GENERAL.RCF_POINT4[0]}</Typography>&nbsp;
                <Typography variant="Regular_14">{GENERAL.RCF_POINT4[1]}</Typography>&nbsp;
                <Typography variant="Semibold_14">{GENERAL.RCF_POINT4[2]}</Typography>
            </div>
        </div>
    );
};

export default RedirectToCF;

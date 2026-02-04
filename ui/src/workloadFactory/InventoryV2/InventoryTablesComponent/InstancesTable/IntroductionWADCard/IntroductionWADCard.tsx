import { DsButton, DsTypography } from '@netapp/design-system';

import { ReactComponent as StorageCredentials } from '../../../../../assets/WAD.svg';

import styles from './IntroductionWADCard.module.scss';

const IntroductionWADCard = ({ buttonRef, setIsCardOpen }: any) => (
    <div
        className={styles['intro-card']}
        style={{
            top: buttonRef.current?.offsetHeight + 24, // 8px for spacing
            left: buttonRef.current
                ? buttonRef.current.offsetLeft + buttonRef.current.offsetWidth - 528 /* Card width */
                : 0,
            height: '540px'
        }}
    >
        <StorageCredentials />
        <div className={styles.content}>
            <DsTypography className={styles.heading} variant="Semibold_14">
                One-time Well-architected assessment
            </DsTypography>

            <DsTypography variant="Regular_14" className={styles.text}>
                Perform a one-time assessment to determine the well-architected status of your Microsoft SQL Server
                instances without credentials or instance registration.
            </DsTypography>

            <DsTypography variant="Regular_14" className={styles.text}>
                Simply download our secure script, run it locally, upload the results, and find out the well-architected
                score of your instance. Optimization insights are included with the results.
            </DsTypography>
        </div>
        <div className={styles.buttonContainer}>
            <DsButton isThin variant="secondary" className={styles.button} onClick={() => setIsCardOpen(false)}>
                Close
            </DsButton>
        </div>
    </div>
);

export default IntroductionWADCard;

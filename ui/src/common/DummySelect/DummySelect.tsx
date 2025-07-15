import { DsTypography } from '@tlveng/wlm-ds';
import styles from './DummySelect.module.scss';
import { Popover } from '@netapp/design-system';

type DummySelectProps = {
    fromJM?: boolean;
};

const DummySelect = ({ fromJM = false }: DummySelectProps) => {
    return (
        <div className={styles.dummySelect}>
            <Popover
                popoverClass={styles['copy-popover']}
                children={fromJM ? 'All credentials' : 'No Credentials selected'}
                trigger="hover"
                container={
                    <div className={styles.commonSelect}>
                        <DsTypography style={{ color: 'var(--text-disabled)' }} variant="Regular_14">
                            {fromJM ? 'All credentials' : 'No Credentials selected'}
                        </DsTypography>
                        <svg
                            width="9"
                            height="5"
                            viewBox="0 0 9 5"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className="chevronIcon"
                        >
                            <path d="M4.5 5L0.602887 0.499999L8.39711 0.5L4.5 5Z" fill="var(--text-disabled)"></path>
                        </svg>
                    </div>
                }
            />

            <Popover
                popoverClass={styles['copy-popover']}
                children={fromJM ? 'All regions' : 'No regions selected'}
                trigger="hover"
                container={
                    <div className={styles.commonSelect}>
                        <DsTypography style={{ color: 'var(--text-disabled)' }} variant="Regular_14">
                            {fromJM ? 'All regions' : 'No regions selected'}
                        </DsTypography>
                        <svg
                            width="9"
                            height="5"
                            viewBox="0 0 9 5"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className="chevronIcon"
                        >
                            <path d="M4.5 5L0.602887 0.499999L8.39711 0.5L4.5 5Z" fill="var(--text-disabled)"></path>
                        </svg>
                    </div>
                }
            />
        </div>
    );
};

export default DummySelect;

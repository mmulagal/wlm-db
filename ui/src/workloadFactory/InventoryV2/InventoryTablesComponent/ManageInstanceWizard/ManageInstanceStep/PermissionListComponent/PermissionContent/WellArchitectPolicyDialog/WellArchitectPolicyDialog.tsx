import { DsTypography, Popover } from '@netapp/design-system';
import { ReactComponent as CopyIcon } from '../../../../../../../../assets/ic_copy.svg';
import styles from './WellArchitectPolicyDialog.module.scss';
import { useState } from 'react';
import CopyToClipboardCommon from '../../../../../../../../common/CopyToClipboard/copyToClipboard';

const WellArchitectPolicyDialog = ({ data, label }: any) => {
    const [selectedTab, setSelectedTab] = useState('AWS IAM policy permissions');

    const handleClick = (value: string) => {
        setSelectedTab(value);
    };
    return (
        <div className={styles.wellArchitectPolicyDialog}>
            <DsTypography variant="Semibold_16">{label}</DsTypography>
            <DsTypography variant="Regular_14">
                These permissions include AWS IAM policy permissions, FSx for ONTAP permissions, and AWS Compute
                Optimizer permissions. Switch between the tabs to review each set of permissions.
            </DsTypography>

            <div className={styles.policyTab}>
                <div
                    className={
                        selectedTab === 'AWS IAM policy permissions'
                            ? `${styles.headers} ${styles.headerWidthFirst} ${styles.active}`
                            : `${styles.headers} ${styles.headerWidthFirst}`
                    }
                >
                    <DsTypography
                        variant="Semibold_14"
                        className={
                            selectedTab === 'AWS IAM policy permissions'
                                ? `${styles.headerPart1} ${styles.activeText}`
                                : `${styles.headerPart1}`
                        }
                        onClick={() => handleClick('AWS IAM policy permissions')}
                    >
                        AWS IAM policy permissions
                    </DsTypography>
                </div>
                <div
                    className={
                        selectedTab === 'FSx for ONTAP permissions'
                            ? `${styles.headers} ${styles.headerWidthSecond} ${styles.active}`
                            : `${styles.headers} ${styles.headerWidthSecond}`
                    }
                >
                    <DsTypography
                        variant="Semibold_14"
                        className={
                            selectedTab === 'FSx for ONTAP permissions'
                                ? `${styles.headerPart1} ${styles.activeText}`
                                : `${styles.headerPart1}`
                        }
                        onClick={() => handleClick('FSx for ONTAP permissions')}
                    >
                        FSx for ONTAP permissions
                    </DsTypography>
                </div>

                <div
                    className={
                        selectedTab === 'Compute Optimizer permissions'
                            ? `${styles.headers} ${styles.headerWidthThird} ${styles.active}`
                            : `${styles.headers} ${styles.headerWidthThird}`
                    }
                >
                    <DsTypography
                        variant="Semibold_14"
                        className={
                            selectedTab === 'Compute Optimizer permissions'
                                ? `${styles.headerPart1} ${styles.activeText}`
                                : `${styles.headerPart1}`
                        }
                        onClick={() => handleClick('Compute Optimizer permissions')}
                    >
                        Compute Optimizer permissions
                    </DsTypography>
                </div>
            </div>

            <div className={styles['dialog-content']}>
                <div className={styles['dialog-body']}>
                    <div className={styles['code-box']}>
                        <div className={styles['code']}>
                            <pre>
                                <DsTypography variant="Regular_14">{data}</DsTypography>
                            </pre>
                        </div>
                        <div className={styles['copy']}>
                            <Popover
                                popoverClass={styles['copy-popover']}
                                children={'Copied to clipboard'}
                                container={
                                    <CopyToClipboardCommon
                                        value={data}
                                        iconProvided={<CopyIcon fill={'#A7A7A7'}></CopyIcon>}
                                    />
                                }
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WellArchitectPolicyDialog;

import { DsTypography, Popover } from '@netapp/design-system';
import CodeBoxHeading from '../../../common/CodeBoxHeading/CodeBoxHeading';
import styles from './PostgreCodebox.module.scss';
import { ReactComponent as Copy } from '../../../assets/copyBlackBackground.svg';
import CodeBoxScroll from '../../../common/CodeBoxScroll/CodeBoxScroll';
//@ts-ignore
import CopyToClipboard from 'react-copy-to-clipboard';
import { useState } from 'react';
import { CODE_VIEWER } from '../../../utils/appConstants';

const PostgreCodebox = () => {
    const [dropDownValue, setDropdownValue] = useState(CODE_VIEWER.REST_API);
    return (
        <div className={styles.postgreCodebox}>
            <div className={styles.createNewUserCodeBox}>
                <CodeBoxHeading />

                <div className={styles.createDbHeader}>
                    <DsTypography variant="Regular_16" className={styles.createDBText}>
                        PostgreSQL
                    </DsTypography>
                </div>

                <div className={styles.payloadContainer}>
                    <div className={styles.payloadHeader}>
                        <div className={styles.inputPart}>
                            <DsTypography variant="Regular_14" style={{ color: 'var(--white)' }}>
                                {dropDownValue}
                            </DsTypography>
                        </div>
                        <div className={styles.actionPopOver}>
                            <div className={styles.actions}>
                                <Popover
                                    popoverClass={styles['copy-popover']}
                                    children={CODE_VIEWER.COPIED_TO_CLIPBOARD}
                                    container={
                                        <CopyToClipboard text={''}>
                                            <div className={styles.menuItem} id={''}>
                                                <Copy />
                                            </div>
                                        </CopyToClipboard>
                                    }
                                />
                            </div>
                        </div>
                    </div>

                    <CodeBoxScroll dropDownValue={dropDownValue} setDisplayedDataInCodeBox={''} />
                </div>
            </div>
        </div>
    );
};

export default PostgreCodebox;

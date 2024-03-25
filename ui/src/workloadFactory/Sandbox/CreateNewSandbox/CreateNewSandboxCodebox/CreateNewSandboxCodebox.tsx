import { DsTypography, Popover } from '@netapp/design-system';
//@ts-ignore
import CopyToClipboard from 'react-copy-to-clipboard';
import { useEffect, useMemo, useState } from 'react';
import CodeBoxHeading from '../../../../common/CodeBoxHeading/CodeBoxHeading';
import { ReactComponent as Copy } from '../../../../assets/copyBlackBackground.svg';
import styles from './CreateNewSandboxCodebox.module.scss';
import { CODE_VIEWER } from '../../../../utils/appConstants';
import CodeBoxScroll from '../../../../common/CodeBoxScroll/CodeBoxScroll';

const CreateNewSandboxCodebox = () => {
    const [dropDownValue, setDropdownValue] = useState(CODE_VIEWER.REST_API);

    // To copy response based on dropdown selection
    const copyResponseData = () => {};

    return (
        <div className={styles.createNewSandboxCodebox}>
            <CodeBoxHeading />

            <div className={styles.createDbHeader}>
                <DsTypography variant="Regular_16" className={styles.createDBText}>
                    {'Create new sandbox'}
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
                                    <CopyToClipboard text={copyResponseData()}>
                                        <div className={styles.menuItem}>
                                            <Copy />
                                        </div>
                                    </CopyToClipboard>
                                }
                            />
                        </div>
                    </div>
                </div>

                <CodeBoxScroll dropDownValue={dropDownValue} setDisplayedDataInCodeBox={() => {}} />
            </div>
        </div>
    );
};

export default CreateNewSandboxCodebox;

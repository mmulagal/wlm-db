import { DsTypography, Popover } from '@netapp/design-system';
//@ts-ignore
import CopyToClipboard from 'react-copy-to-clipboard';
import { useEffect, useMemo, useState } from 'react';
import CodeBoxHeading from '../../../../common/CodeBoxHeading/CodeBoxHeading';
import { ReactComponent as Copy } from '../../../../assets/copyBlackBackground.svg';
import styles from './CreateNewSandboxCodebox.module.scss';
import { CODE_VIEWER, GENERAL } from '../../../../utils/appConstants';
import CodeBoxScroll from '../../../../common/CodeBoxScroll/CodeBoxScroll';
import CodeBoxColor from '../../../../common/CodeBoxColor/CodeBoxColor';
import { useAppSelector } from '../../../../store/storeHooks';
import { CREATE_SANDBOX_CURL_REQ_TEMPLATE, CREATE_SANDBOX_ENDPOINT, CRED_PLACEHOLDERS } from '../../../../utils/consts';
import { generateCreateSandboxPayload } from '../../SandboxUtility';
import { getBaseUrl } from '../../../../utils/apiService';

const CreateNewSandboxCodebox = () => {
    const [dropDownValue, setDropdownValue] = useState(CODE_VIEWER.REST_API);

    const selectedCredId = useAppSelector(state => state.headers.headerSelectedCred);
    const selectedRegionCode = useAppSelector(state => state.headers.headerSelectedRegion);
    const createSandboxState = useAppSelector(state => state.createSandbox);

    // To copy response based on dropdown selection
    const copyResponseData = () => {
        const payload = generateCreateSandboxPayload(createSandboxState);
        const baseUrl = getBaseUrl();
        const restApiPayload = CREATE_SANDBOX_CURL_REQ_TEMPLATE(
            baseUrl,
            selectedCredId?.data?.credentialsId || CRED_PLACEHOLDERS.CRED_ID,
            selectedRegionCode?.data?.regionCode || CRED_PLACEHOLDERS.REGION,
            CRED_PLACEHOLDERS.TOKEN,
            JSON.stringify(payload, null, 2)
        );
        return restApiPayload;
    };

    const setDisplayedDataInCodeBox = () => {
        const payload = generateCreateSandboxPayload(createSandboxState);
        return (
            <>
                <CodeBoxColor
                    credID={selectedCredId?.data?.credentialsId || CRED_PLACEHOLDERS.CRED_ID}
                    region={selectedRegionCode?.data?.regionCode || CRED_PLACEHOLDERS.REGION}
                    actualData={payload}
                    endpoint={CREATE_SANDBOX_ENDPOINT}
                />
            </>
        );
    };

    return (
        <div className={styles.createNewSandboxCodebox}>
            <CodeBoxHeading />

            <div className={styles.createDbHeader}>
                <DsTypography variant="Regular_16" className={styles.createDBText}>
                    {GENERAL.CREATE_NEW_SANDBOX}
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

                <CodeBoxScroll dropDownValue={dropDownValue} setDisplayedDataInCodeBox={setDisplayedDataInCodeBox()} />
            </div>
        </div>
    );
};

export default CreateNewSandboxCodebox;

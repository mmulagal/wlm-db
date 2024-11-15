import { DsTypography, Popover } from '@netapp/design-system';
import CodeBoxHeading from '../../../common/CodeBoxHeading/CodeBoxHeading';
import styles from './PostgreCodebox.module.scss';
import { ReactComponent as Copy } from '../../../assets/copyBlackBackground.svg';
import CodeBoxScroll from '../../../common/CodeBoxScroll/CodeBoxScroll';
//@ts-ignore
import CopyToClipboard from 'react-copy-to-clipboard';
//@ts-ignore
import Highlighter from 'react-highlight-words';
import { useEffect, useMemo, useState } from 'react';
import { CODE_VIEWER } from '../../../utils/appConstants';
import { SelectField, optionType } from '@netapp/design-system/dist/components/Select';
import { generateOptionType, getCredDetails } from '../../../utils/utilityFunctions';
import {  CREATE_PGSQL_CURL_REQ_TEMPLATE, CRED_PLACEHOLDERS, CURL_REQ_TEMPLATE, DEPLOY_ENDPOINT, PGSQL_CURL_REQ_TEMPLATE, UI_IDS } from '../../../utils/consts';
import { useAppSelector } from '../../../store/storeHooks';
import LoadingCodeBox from '../../../common/LoadingCodebox/LoadingCodebox';
import CodeBoxColor from '../../../common/CodeBoxColor/CodeBoxColor';
import { addEscapeInCli, setMaskedPassword } from '../../../workloadFactory/DatabaseHomePage/Sidebar/CodeboxUtility';
import { createPgsqlPayload } from '../PostgreUtils';
import { getBaseUrl, useGetTemplatesMutation } from '../../../utils/apiService';
import { TemplateRes } from '../../../utils/types/databaseHomeTypes';

const _ = require('lodash');

const PostgreCodebox = () => {
    const [dropDownValue, setDropdownValue] = useState(CODE_VIEWER.REST_API);
    const [rightPanelMaskedResponse, setRightPanelMaskedResponse] = useState<any>('');
    const [formData, setFormData] = useState<any>(null); // Saving form data on template API call
    const [isRightPanelTemplateLoading, setIsRightPanelTemplateLoading] = useState(false);
    const [rightPanelTemplateResponse, setRightPanelTemplateResponse] = useState<TemplateRes | null>(null);

    const selectedCredId = useAppSelector(state => state.headers.headerSelectedCred);
    const selectedRegionCode = useAppSelector(state => state.headers.headerSelectedRegion);
  

    const mssqlFormData = useAppSelector(state => state.mssqlForm);
    const pgsqlFormData = useAppSelector(state => state.postgreForm);
    const { isWorkloadFactory, isDemoMode } = useAppSelector(state => state?.auth);

    const [loadTemplateData] = useGetTemplatesMutation();

    //Function to generate the options for Select Field for License
    const generateCLIOptions = useMemo<optionType[]>((): optionType[] => {
        const arr = [CODE_VIEWER.CLOUDFORMATION, CODE_VIEWER.REST_API];
        const options: optionType[] = [];
        arr?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '');
            options.push(option);
        });
        return options;
    }, []);

    const setCssId = () => {
        if (dropDownValue === CODE_VIEWER.CLOUDFORMATION) {
            return UI_IDS.WIZARD_CODEBOX_CF;
        }  else if (dropDownValue === CODE_VIEWER.REST_API) {
            return UI_IDS.WIZARD_CODEBOX_REST_API;
        } 
    };

    useEffect(() => {
        getMaskedRestResponse(mssqlFormData, pgsqlFormData);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mssqlFormData, pgsqlFormData]);

     // This will set masked data
    const getMaskedRestResponse = (actualData: any,pgsqlFormData:any) => {
        const changeObjectForm = {
            mssqlForm: setMaskedPassword(actualData),
            postgreForm: setMaskedPassword(pgsqlFormData)
        };
        const resBody = createPgsqlPayload(changeObjectForm);
        //@ts-ignore
        setRightPanelMaskedResponse(resBody);
    };

      // To copy response based on dropdown selection
      const copyResponseData = () => {
        const actualData = mssqlFormData;
        const baseUrl = getBaseUrl();
        const restApiPayload = CREATE_PGSQL_CURL_REQ_TEMPLATE(
            baseUrl,
            selectedCredId?.data?.credentialsId || CRED_PLACEHOLDERS.CRED_ID,
            selectedRegionCode?.data?.regionCode || CRED_PLACEHOLDERS.REGION,           
            CRED_PLACEHOLDERS.TOKEN,
            JSON.stringify(rightPanelMaskedResponse, null, 2),
            isWorkloadFactory
        );
        return restApiPayload;
       
    };

    const setDisplayedDataInCodeBox = () => {
        if (dropDownValue === CODE_VIEWER.REST_API) {
            const actualData = mssqlFormData;
            // To get accountid, credid and region from saved config
            const credDetails = getCredDetails(actualData);
            return false ? (
                <LoadingCodeBox text={CODE_VIEWER.LOADING_REST_API} />
            ) : (
                <>
                    <CodeBoxColor
                        credID={credDetails.credId}
                        region={credDetails.region}
                        actualData={rightPanelMaskedResponse}
                        endpoint={DEPLOY_ENDPOINT}
                        dbType='pgsql'
                    />
                </>
            );
        }
    };

    return (
        <div className={styles.postgreCodebox}>
            <div className={styles.createNewUserCodeBox}>
                <CodeBoxHeading />
                <div className={styles.createDbHeader}>
                    <DsTypography variant="Regular_16" className={styles.createDBText}>
                        PostgreSQL
                    </DsTypography>

                    <div className={styles.inputBox} style={{ color: 'var(--white)' }}>
                    <SelectField
                        id={setCssId()}
                        isClearable={false}
                        value={generateOptionType(dropDownValue, dropDownValue, '', false, '')}
                        onChange={(selectedOptions: any): void => {
                            setDropdownValue(selectedOptions?.value);
                        }}
                        isSearchable={false}
                        variant="underline"
                        options={generateCLIOptions}
                        defaultValue={[generateCLIOptions[1]]}
                    />
                </div>
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
                                            <div className={styles.menuItem} id={''}>
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
        </div>
    );
};

export default PostgreCodebox;

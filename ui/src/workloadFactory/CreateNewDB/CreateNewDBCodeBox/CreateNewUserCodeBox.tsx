import { DsTypography } from '@netapp/design-system';
import { useMemo, useState } from 'react';
import { optionType, SelectField } from '@netapp/design-system/dist/components/Select';
import { generateOptionType } from '../../../utils/utilityFunctions';
import CodeBoxHeading from '../../../common/CodeBoxHeading/CodeBoxHeading';
import styles from './CreateNewUserCodeBox.module.scss';
import { CODE_VIEWER, GENERAL } from '../../../utils/appConstants';
import CodeBoxScroll from '../../../common/CodeBoxScroll/CodeBoxScroll';
import { useAppSelector } from '../../../store/storeHooks';
import { createUserDbPayload } from '../CreateNewDBFooter/createUserDBPayload';
import CodeBoxColor from '../../../common/CodeBoxColor/CodeBoxColor';
import { CREATE_DB_ENDPOINT } from '../../../utils/consts';

const CreateNewUserCodeBox = () => {
    const [dropDownValue, setDropdownValue] = useState(CODE_VIEWER.REST_API);
    const resourceId = useAppSelector(state => state.auth.resourceId);
    const selectedCredId = useAppSelector(state => state.headers.headerSelectedCred);
    const selectedRegionCode = useAppSelector(state => state.headers.headerSelectedRegion);

    const createNewUser = useAppSelector(state => state.createNewUser);

    const generateCLIOptions = useMemo<optionType[]>((): optionType[] => {
        const arr = [CODE_VIEWER.REST_API];
        const options: optionType[] = [];
        arr?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '');
            options.push(option);
        });
        return options;
    }, []);

    const setDisplayedDataInCodeBox = () => {
        const payload = createUserDbPayload(createNewUser);
        return (
            <>
                <CodeBoxColor
                    credID={selectedCredId?.data?.credentialsId}
                    region={selectedRegionCode?.data?.regionCode}
                    actualData={payload}
                    endpoint={CREATE_DB_ENDPOINT(resourceId)}
                />
            </>
        );
    };

    return (
        <div className={styles.createNewUserCodeBox}>
            <CodeBoxHeading />

            <div className={styles.createDbHeader}>
                <DsTypography variant="Regular_16" className={styles.createDBText}>
                    {GENERAL.CREATE_USER_DB_TITLE}
                </DsTypography>
            </div>

            <div className={styles.payloadContainer}>
                <div className={styles.payloadHeader}>
                    <div className={styles.inputPart}>
                        <DsTypography variant="Regular_14" style={{ color: 'var(--white)' }}>
                            {dropDownValue}
                        </DsTypography>
                    </div>
                </div>

                <CodeBoxScroll dropDownValue={dropDownValue} setDisplayedDataInCodeBox={setDisplayedDataInCodeBox()} />
            </div>
        </div>
    );
};

export default CreateNewUserCodeBox;

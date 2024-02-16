import { DsTypography } from '@netapp/design-system';
import { useMemo, useState } from 'react';
import { optionType, SelectField } from '@netapp/design-system/dist/components/Select';
import { generateOptionType } from '../../../utils/utilityFunctions';
import CodeBoxHeading from '../../../common/CodeBoxHeading/CodeBoxHeading';
import styles from './CreateNewUserCodeBox.module.scss';
import { CODE_VIEWER } from '../../../utils/appConstants';
import CodeBoxScroll from '../../../common/CodeBoxScroll/CodeBoxScroll';
import { useAppSelector } from '../../../store/storeHooks';
import { createUserDbPayload } from '../CreateNewDBFooter/createUserDBPayload';

const CreateNewUserCodeBox = () => {
    const [dropDownValue, setDropdownValue] = useState(CODE_VIEWER.REST_API);

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
            <pre>
                {JSON.stringify(payload)}
            </pre>
        )
    };

    return (
        <div className={styles.createNewUserCodeBox}>
            <CodeBoxHeading />

            <div className={styles.createDbHeader}>
                <DsTypography variant="Regular_16" className={styles.createDBText}>
                    {'Create new user database'}
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

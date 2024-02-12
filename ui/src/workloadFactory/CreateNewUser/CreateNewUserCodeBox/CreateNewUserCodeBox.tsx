import { DsTypography } from '@netapp/design-system';
import { useMemo, useState } from 'react';
import { optionType, SelectField } from '@netapp/design-system/dist/components/Select';
import { generateOptionType } from '../../../utils/utilityFunctions';
import CodeBoxHeading from '../../../common/CodeBoxHeading/CodeBoxHeading';
import styles from './CreateNewUserCodeBox.module.scss';
import { CODE_VIEWER } from '../../../utils/appConstants';
import CodeBoxScroll from '../../../common/CodeBoxScroll/CodeBoxScroll';

const CreateNewUserCodeBox = () => {
    const [dropDownValue, setDropdownValue] = useState(CODE_VIEWER.REST_API);
    const generateCLIOptions = useMemo<optionType[]>((): optionType[] => {
        const arr = [CODE_VIEWER.REST_API];
        const options: optionType[] = [];
        arr?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '');
            options.push(option);
        });
        return options;
    }, []);
    return (
        <div className={styles.createNewUserCodeBox}>
            <CodeBoxHeading />

            <div className={styles.createDbHeader}>
                <DsTypography variant="Regular_16" className={styles.createDBText}>
                    {'Create new user database'}
                </DsTypography>

                <div className={styles.inputBox} style={{ color: 'var(--white)' }}>
                    <SelectField
                        isClearable={false}
                        value={generateOptionType(dropDownValue, dropDownValue, '', false, '')}
                        onChange={(selectedOptions: any): void => {
                            setDropdownValue(selectedOptions?.value);
                        }}
                        isSearchable={false}
                        variant="underline"
                        options={generateCLIOptions}
                        defaultValue={[generateCLIOptions[0]]}
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
                </div>

                <CodeBoxScroll dropDownValue={dropDownValue} setDisplayedDataInCodeBox={''} />
            </div>
        </div>
    );
};

export default CreateNewUserCodeBox;

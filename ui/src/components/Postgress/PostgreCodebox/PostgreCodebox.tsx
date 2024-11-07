import { DsTypography, Popover } from '@netapp/design-system';
import CodeBoxHeading from '../../../common/CodeBoxHeading/CodeBoxHeading';
import styles from './PostgreCodebox.module.scss';
import { ReactComponent as Copy } from '../../../assets/copyBlackBackground.svg';
import CodeBoxScroll from '../../../common/CodeBoxScroll/CodeBoxScroll';
//@ts-ignore
import CopyToClipboard from 'react-copy-to-clipboard';
import { useMemo, useState } from 'react';
import { CODE_VIEWER } from '../../../utils/appConstants';
import { SelectField, optionType } from '@netapp/design-system/dist/components/Select';
import { generateOptionType } from '../../../utils/utilityFunctions';
import { UI_IDS } from '../../../utils/consts';

const PostgreCodebox = () => {
    const [dropDownValue, setDropdownValue] = useState(CODE_VIEWER.REST_API);

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

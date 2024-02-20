import { AccordionCard, AccordionCardContent, DsTypography, TextField } from '@netapp/design-system';
import ActionRequired from '../../../../../common/ActionRequired/ActionRequired';

import { useAppSelector } from '../../../../../store/storeHooks';
import { useDispatch } from 'react-redux';
import {
    setNewUserDataSize,
    setNewUserDataSizeUnit,
    setNewUserLogFileSize,
    setNewUserLogFileSizeUnit
} from '../../../../../store/workloadFactory/createNewDBSlice';
import { useEffect, useMemo, useState } from 'react';
import { SelectField, optionType } from '@netapp/design-system/dist/components/Select';
import { generateOptionType } from '../../../../../utils/utilityFunctions';

import styles from './FilesSize.module.scss';
import CommonStyles from '../../../../../utils/CommonStyles.module.scss';
import { GENERAL } from '../../../../../utils/appConstants';

const FilesSize = () => {
    const dispatch = useDispatch();

    const { newUserDataSize, newUserDataSizeUnit, newUserLogFileSize, newUserLogFileSizeUnit } = useAppSelector(
        state => state.createNewUser
    );

    const units = ['GiB', 'TiB'];
    const [maxSize, setMaxSize] = useState(130);

    //Function to generate the options for Select Field
    const generateUnitsForStorage = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        units?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '');
            options.push(option);
        });
        return options;
    }, []);

    useEffect(() => {
        dispatch(setNewUserDataSize(1));
        dispatch(setNewUserLogFileSize(1));
        dispatch(setNewUserDataSizeUnit(generateUnitsForStorage[0]));
        dispatch(setNewUserLogFileSizeUnit(generateUnitsForStorage[0]));
    }, [generateUnitsForStorage]);

    useEffect(() => {
        if (newUserDataSize) {
            if (newUserDataSizeUnit?.label === 'GiB' && newUserDataSize > 0) {
                const logFileSize = newUserDataSize / 4;
                dispatch(setNewUserLogFileSize(logFileSize > 1 ? logFileSize : 1));
                dispatch(setNewUserLogFileSizeUnit(generateOptionType('GiB', 'GiB', '', false, '')));
            }

            if (newUserDataSizeUnit?.label === 'TiB' && newUserDataSize < maxSize) {
                const logFileSize = newUserDataSize / 4;
                dispatch(setNewUserLogFileSize(logFileSize));
                dispatch(setNewUserLogFileSizeUnit(generateOptionType('TiB', 'TiB', '', false, '')));
            }
        }
    }, [newUserDataSize]);
    //Set the Header text here
    const setHeader = () => {
        if (newUserDataSize && newUserDataSizeUnit?.label && newUserLogFileSize && newUserLogFileSizeUnit?.label) {
            return (
                <DsTypography variant="Regular_14" className={CommonStyles.setHeaderStyle}>
                    <DsTypography variant="Regular_14">
                        {`${GENERAL.DATA_FILE_SIZE} ${newUserDataSize} ${newUserDataSizeUnit?.label}`}{' '}
                    </DsTypography>
                    <div className={CommonStyles.separator} />
                    <DsTypography variant="Regular_14">
                        {`${GENERAL.LOG_FILE_SIZE} ${newUserLogFileSize} ${newUserLogFileSizeUnit?.label}`}{' '}
                    </DsTypography>
                </DsTypography>
            );
        }
        return <ActionRequired error={false} />;
    };

    const errorCheckForDataSize = () => {
        if (newUserDataSizeUnit?.label === 'GiB') {
            if (newUserDataSize && (newUserDataSize < 0 || newUserDataSize > maxSize * 1024)) {
                return `The valid range is 1 GiB - ${maxSize} TiB`;
            }
        } else if (newUserDataSizeUnit?.label === 'TiB') {
            if (newUserDataSize && newUserDataSize > maxSize) {
                return `The valid range is 1 GiB - ${maxSize} TiB`;
            }
        }
    };

    return (
        <div className={styles.filesSize}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="4"
                title={<div className={CommonStyles.title}>{GENERAL.DB_CREATE_FILES_SIZE}</div>}
            >
                <AccordionCardContent>
                    <DsTypography>
                        <div className={styles.textSection}>
                            <div className={styles.firstSection}>
                                <DsTypography variant="Regular_14">{GENERAL.FILE_SIZE_TEXT}</DsTypography>
                            </div>
                        </div>

                        <div className={styles.dataSizeRow}>
                            <div className={styles.dataSizeField}>
                                <TextField
                                    label="Data size"
                                    placeholder={`1 GiB - ${maxSize} TiB`}
                                    value={newUserDataSize}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        const numSize = e.target.value.replace(/\D/g, '');
                                        dispatch(setNewUserDataSize(numSize));
                                    }}
                                    error={errorCheckForDataSize()}
                                    className={styles.textFieldNewUSer}
                                />

                                <SelectField
                                    label={'select'}
                                    isClearable={false}
                                    info={
                                        <div className={styles.dataSizeTooltip}>
                                            <DsTypography variant="Regular_13">{`Host hostname data size name is 1 GiB - ${maxSize} TiB.`}</DsTypography>
                                        </div>
                                    }
                                    defaultValue={
                                        newUserDataSizeUnit ? [newUserDataSizeUnit] : [generateUnitsForStorage[0]]
                                    }
                                    onChange={(selectedOptions: any): void => {
                                        dispatch(setNewUserDataSizeUnit(selectedOptions));
                                    }}
                                    isSearchable={generateUnitsForStorage.length > 5}
                                    error={errorCheckForDataSize()}
                                    options={generateUnitsForStorage}
                                    className={styles.selectField}
                                />
                            </div>

                            <div className={styles.dataSizeField}>
                                <TextField
                                    label="Log size"
                                    placeholder="25% of the data size"
                                    value={newUserLogFileSize}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        dispatch(setNewUserLogFileSize(e.target.value));
                                    }}
                                    className={styles.textFieldNewUSer}
                                />

                                <SelectField
                                    label={'select'}
                                    isClearable={false}
                                    defaultValue={
                                        newUserLogFileSizeUnit ? [newUserLogFileSizeUnit] : [generateUnitsForStorage[0]]
                                    }
                                    onChange={(selectedOptions: any): void => {
                                        dispatch(setNewUserLogFileSizeUnit(selectedOptions));
                                    }}
                                    isSearchable={generateUnitsForStorage.length > 5}
                                    options={generateUnitsForStorage}
                                    className={styles.selectField}
                                />
                            </div>
                        </div>
                    </DsTypography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default FilesSize;

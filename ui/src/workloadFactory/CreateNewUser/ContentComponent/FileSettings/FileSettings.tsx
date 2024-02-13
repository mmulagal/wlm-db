import { AccordionCard, AccordionCardContent, DsTypography, TextField } from '@netapp/design-system';

import ActionRequired from '../../../../common/ActionRequired/ActionRequired';

import { useAppSelector } from '../../../../store/storeHooks';
import { useDispatch } from 'react-redux';
import {
    setNewUserDataSize,
    setNewUserDataSizeUnit,
    setNewDBFileName,
    setNewUserLogFileName,
    setNewUserLogFileSize,
    setNewUserLogFileSizeUnit
} from '../../../../store/workloadFactory/createNewUserSlice';
import { useEffect, useMemo, useState } from 'react';
import { SelectField, optionType } from '@netapp/design-system/dist/components/Select';
import { generateOptionType } from '../../../../utils/utilityFunctions';

import styles from './FileSettings.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';

const FileSettings = () => {
    const dispatch = useDispatch();

    const {
        newUserDataSize,
        newUserDataSizeUnit,
        newUserDBFileName,
        newUserLogFileName,
        newUserLogFileSize,
        newUserLogFileSizeUnit
    } = useAppSelector(state => state.createNewUser);

    const units = ['GiB', 'TiB'];

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
        dispatch(setNewUserDataSizeUnit(generateUnitsForStorage[0]));
        dispatch(setNewUserLogFileSizeUnit(generateUnitsForStorage[0]));
    }, [generateUnitsForStorage]);
    //Set the Header text here
    const setHeader = () => {
        if (
            newUserDataSize &&
            newUserDataSizeUnit?.label &&
            newUserDBFileName &&
            newUserLogFileName &&
            newUserLogFileSize &&
            newUserLogFileSizeUnit?.label
        ) {
            return (
                <DsTypography variant="Regular_14" className={CommonStyles.setHeaderStyle}>
                    <DsTypography variant="Regular_14">
                        {`Data file name: ${newUserDBFileName} (${newUserDataSize} ${newUserDataSizeUnit?.label})`}{' '}
                    </DsTypography>
                    <div className={CommonStyles.separator} />
                    <DsTypography variant="Regular_14">
                        {`Log file name: ${newUserLogFileName} (${newUserLogFileSize} ${newUserLogFileSizeUnit?.label})`}{' '}
                    </DsTypography>
                </DsTypography>
            );
        }
        return <ActionRequired error={false} />;
    };

    const errorCheckForDataSize = () => {
        if (newUserDataSizeUnit?.label === 'GiB') {
            if (newUserDataSize && newUserDataSize < 120) {
                return 'The valid range is 120 GiB - 130 TiB';
            }
        } else if (newUserLogFileSizeUnit?.label === 'TiB') {
            if (newUserLogFileSize && newUserLogFileSize > 130) {
                return 'The valid range is 120 GiB - 130 TiB';
            }
        }
    };
    return (
        <div className={styles.fileSettings}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="2"
                title={<div className={CommonStyles.title}>{'File  settings'}</div>}
            >
                <AccordionCardContent>
                    <DsTypography>
                        <div className={styles.firstRow}>
                            <TextField
                                label="Data file name"
                                placeholder="Database file name"
                                value={newUserDBFileName}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    dispatch(setNewDBFileName(e.target.value));
                                }}
                                className={styles.fileNameText}
                                type="number"
                            />
                            <div className={styles.dataSizeField}>
                                <TextField
                                    label="Data size"
                                    placeholder="120 GiB - 130 TiB"
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
                        </div>

                        <div className={styles.firstRow}>
                            <TextField
                                label="Log file name"
                                placeholder="Log file name"
                                value={newUserLogFileName}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    dispatch(setNewUserLogFileName(e.target.value));
                                }}
                                className={styles.fileNameText}
                            />
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
                                    info="Log size is automatically set to be 25% of the data size. "
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

export default FileSettings;

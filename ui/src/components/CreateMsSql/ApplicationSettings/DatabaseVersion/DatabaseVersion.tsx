import { useEffect, useMemo } from 'react';
import { AccordionCard, AccordionCardContent, SelectField, Typography } from '@netapp/design-system';
import { optionType } from '@netapp/design-system/dist/components/Select';
import { GENERAL } from '../../../../utils/appConstants';
import styles from './DatabaseVersion.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { generateOptionType } from '../../../../utils/utilityFunctions';
import { useDispatch } from 'react-redux';
import { setDBVersion } from '../../../../store/mssql/mssqlFormSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import { setIsWizardTouched } from '../../../../store/chatbot/chatbotSlice';
import { DB_VERSIONS } from '../../../../utils/consts';

const DatabaseVersion = () => {
    const dispatch = useDispatch();

    // Getting selected DB version
    const getDBVersion = useAppSelector(state => state.mssqlForm.dbVersion);
    const customAMISelected = useAppSelector(state => state.mssqlForm.license.selectedLicenseType);
    const isLoadConfig = useAppSelector(state => state.msSqlAction.isLoadConfig);
    const { movingFromChatbot } = useAppSelector(state => state.chatbot);
    const osVersion = useAppSelector(state => state.mssqlForm.operatingSystem);

    const versions = DB_VERSIONS;

    //Function to generate the options for Select Field
    //@ts-ignore
    const generateDbVersions = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        versions?.map((val, idx: number) => {
            // If win 2016 is selected than dont show 2022 SQL server in dropdown list
            if (
                !(osVersion?.value === GENERAL.WIN_SERVER_2016_VERSION && val.value === GENERAL.SQL_SERVER_2022_VERSION)
            ) {
                const option = generateOptionType(val.value, val.label, '', false, '');
                options.push(option);
            }
        });

        return options;
    }, [osVersion]);

    useEffect(() => {
        if (!isLoadConfig && !movingFromChatbot) {
            dispatch(setDBVersion(generateDbVersions[0]));
        }
    }, [dispatch, generateDbVersions]);

    //Set the Header text here
    const setHeader = () => {
        if (customAMISelected === GENERAL.USE_CUSTOM_AMI) {
            return '';
        }
        return <Typography variant="Regular_14">{getDBVersion?.label}</Typography>;
    };
    return (
        <div className={''}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="8"
                title={<div className={CommonStyles.title}>{GENERAL.DATABASE_VERSION}</div>}
                isDisabled={customAMISelected === GENERAL.USE_CUSTOM_AMI}
            >
                <AccordionCardContent>
                    <Typography>
                        <div className={styles['db-version']}>
                            <SelectField
                                label={GENERAL.VERSION}
                                isClearable={false}
                                defaultValue={getDBVersion ? [getDBVersion] : [generateDbVersions[0]]}
                                onChange={(selectedOptions: any): void => {
                                    dispatch(setDBVersion(selectedOptions));
                                    dispatch(setIsWizardTouched(true));
                                }}
                                isSearchable={generateDbVersions.length > 5}
                                options={generateDbVersions}
                            />
                        </div>
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default DatabaseVersion;

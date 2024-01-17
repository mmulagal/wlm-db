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

const DatabaseVersion = () => {
    const dispatch = useDispatch();

    // Getting selected DB version
    const getDBVersion = useAppSelector(state => state.mssqlForm.dbVersion);
    const isLoadConfig = useAppSelector(state => state.msSqlAction.isLoadConfig);

    const versions = [
        { label: GENERAL.SQL_SERVER_2016, value: GENERAL.SQL_SERVER_2016_VERSION },
        { label: GENERAL.SQL_SERVER_2019, value: GENERAL.SQL_SERVER_2019_VERSION },
        { label: GENERAL.SQL_SERVER_2022, value: GENERAL.SQL_SERVER_2022_VERSION }
    ];

    //Function to generate the options for Select Field
    //@ts-ignore
    const generateDbVersions = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        versions?.map((val, idx: number) => {
            const option = generateOptionType(val.value, val.label, '', false, '');
            options.push(option);
        });

        return options;
    }, []);

    useEffect(() => {
        if (!isLoadConfig) {
            dispatch(setDBVersion(generateDbVersions[0]));
        }
    }, [dispatch, generateDbVersions]);

    //Set the Header text here
    const setHeader = () => {
        return <Typography variant="Regular_14">{getDBVersion?.label}</Typography>;
    };
    return (
        <div className={''}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="8"
                title={<div className={CommonStyles.title}>{GENERAL.DATABASE_VERSION}</div>}
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

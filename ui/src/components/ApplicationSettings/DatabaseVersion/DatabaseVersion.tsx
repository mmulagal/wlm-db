import { useEffect, useMemo } from 'react';
import { AccordionCard, AccordionCardContent, SelectField, Typography } from '@netapp/design-system';
import { optionType } from '@netapp/design-system/dist/components/Select';
import { GENERAL } from '../../../utils/appConstants';
import styles from './DatabaseVersion.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { generateOptionType } from '../../../utils/utilityFunctions';
import { useDispatch, useSelector } from 'react-redux';
import { setDBVersion } from '../../../store/mssql/mssqlFormSlice';

const DatabaseVersion = () => {
    const dispatch = useDispatch();
    const getDBVersion = useSelector((state: any) => state.mssqlForm.dbVersion);
    const versions = [GENERAL.SQL_SERVER_2016, GENERAL.SQL_SERVER_2019, GENERAL.SQL_SERVER_2022];

    //Function to generate the options for Select Field
    const generateDbVersions = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        versions?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '');
            options.push(option);
        });

        return options;
    }, []);

    useEffect(() => {
        dispatch(setDBVersion(generateDbVersions[0].label));
    }, []);
    //Set the Header text here
    const setHeader = () => {
        return <Typography variant="Regular_14">{getDBVersion}</Typography>;
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
                                defaultValue={
                                    getDBVersion
                                        ? [generateOptionType(getDBVersion, getDBVersion, '', false, '')]
                                        : [generateDbVersions[0]]
                                }
                                onChange={(selectedOptions: any): void => {
                                    dispatch(setDBVersion(selectedOptions.label));
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

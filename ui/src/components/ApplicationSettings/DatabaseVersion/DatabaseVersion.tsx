import { useMemo, useState } from 'react';
import { AccordionCard, AccordionCardContent, SelectField, Typography } from '@netapp/design-system';
import { optionType } from '@netapp/design-system/dist/components/Select';
import { GENERAL } from '../../../utils/appConstants';
import styles from './DatabaseVersion.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { generateOptionType } from '../../../utils/utilityFunctions';

const DatabaseVersion = () => {
    const versions = [GENERAL.SQL_SERVER_2016, GENERAL.SQL_SERVER_2019, GENERAL.SQL_SERVER_2022];
    const [version, setVersion] = useState(GENERAL.SQL_SERVER_2016);

    //Function to generate the options for Select Field
    const generateDbVersions = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        versions?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '');
            options.push(option);
        });
        return options;
    }, []);
    //Set the Header text here
    const setHeader = () => {
        return <Typography variant="Regular_14">{version}</Typography>;
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
                                defaultValue={[generateDbVersions[0]]}
                                onChange={(selectedOptions: any): void => {
                                    setVersion(selectedOptions.label);
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

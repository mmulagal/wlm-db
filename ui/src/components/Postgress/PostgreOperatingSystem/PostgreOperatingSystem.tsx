import { useEffect, useMemo } from 'react';
import { AccordionCard, AccordionCardContent, DsTypography } from '@netapp/design-system';
import { SelectField, optionType } from '@netapp/design-system/dist/components/Select';
import { useDispatch } from 'react-redux';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import styles from './PostgreOperatingSystem.module.scss';

import ActionRequired from '../../../common/ActionRequired/ActionRequired';
import { useAppSelector } from '../../../store/storeHooks';
import { GENERAL } from '../../../utils/appConstants';
import { generateOptionType } from '../../../utils/utilityFunctions';
import { setPostgreOperatingSystem } from '../../../store/postgre/postgreFormSlice';

const PostgreOperatingSystem = () => {
    const dispatch = useDispatch();

    const postGreOS = useAppSelector(state => state.postgreForm.postgreOS);

    const generateOSValues = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        const osValues = ['Amazon Linux 2023 AMI'];
        osValues.map((val: any, idx: number) => {
            const option = generateOptionType(val, val, val, false, '');
            options.push(option);
        });
        return options;
    }, []);

    useEffect(() => {
        // @ts-ignore
        dispatch(setPostgreOperatingSystem(generateOSValues[0]));
    }, [generateOSValues]);

    const setHeader = () => {
        if (!postGreOS?.label) {
            return <ActionRequired />;
        }
        return <DsTypography variant="Regular_14">{postGreOS?.label}</DsTypography>;
    };

    return (
        <div className={styles.postgreOS}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="25"
                title={<div className={CommonStyles.title}>Operating system</div>}
            >
                <AccordionCardContent>
                    <DsTypography>
                        <div className={styles.collationField}>
                            <SelectField
                                label="Operating system: Amazon Linux"
                                isClearable={false}
                                placeholder={GENERAL.SELECT_COLLATION}
                                defaultValue={postGreOS ? [postGreOS] : [generateOSValues[0]]}
                                onChange={(selectedOptions: any): void => {
                                    dispatch(setPostgreOperatingSystem(selectedOptions));
                                }}
                                isSearchable={generateOSValues.length > 5}
                                options={generateOSValues}
                                isDisabled
                            />
                        </div>
                    </DsTypography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default PostgreOperatingSystem;

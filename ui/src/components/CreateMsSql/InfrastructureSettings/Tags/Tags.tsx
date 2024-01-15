import { AccordionCard, AccordionCardContent, TextField, Typography, Button } from '@netapp/design-system';
import { useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { setTags } from '../../../../store/mssql/mssqlFormSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import { GENERAL } from '../../../../utils/appConstants';
import { ReactComponent as CloseIcon } from '../../../../assets/close-icon.svg';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import styles from './Tags.module.scss';
import { setIsWizardTouched } from '../../../../store/chatbot/chatbotSlice';

type Tag = {
    key: string;
    value: string;
};

const Tags = () => {
    const dispatch = useDispatch();
    const tags = useAppSelector((state: any) => state.mssqlForm.tags);

    //@ts-ignore
    const emptyTagItems = useMemo(() => {
        return tags.filter((tag: Tag) => !tag.key);
    }, [tags]);

    //Set the Header text here
    const setHeader = () => {
        const nonEmptyTagCount = tags.length - emptyTagItems.length;
        return (
            <Typography variant="Regular_14">
                {`${nonEmptyTagCount} ${GENERAL.TAG}${nonEmptyTagCount === 1 ? '' : 's'}`}
            </Typography>
        );
    };

    //@ts-ignore
    const isAddDisabled = useMemo(() => {
        if (emptyTagItems.length || tags.length >= 40) {
            return true;
        } else {
            return false;
        }
    }, [tags]);

    const handleAddNewTag = () => {
        dispatch(setTags([{ key: '', value: '' }, ...tags]));
        dispatch(setIsWizardTouched(true));
    };

    const handleChange = (idx: number, prop: string, value: string) => {
        const re = /^([a-zA-Z0-9_.:/=+-@]*)$/;
        if (!value || re.test(value)) {
            const updatedTags = [
                ...tags.map((tag: Tag) => {
                    return { key: tag.key, value: tag.value };
                })
            ];
            updatedTags[idx][prop] = value;
            dispatch(setTags(updatedTags));
            dispatch(setIsWizardTouched(true));
        }
    };

    const handleDeleteTag = (idx: number) => {
        const updatedTags = [...tags];
        updatedTags.splice(idx, 1);
        dispatch(setTags(updatedTags));
        dispatch(setIsWizardTouched(true));
    };

    return (
        <div className={''}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="20"
                title={<div className={CommonStyles.title}>{GENERAL.TAGS}</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        <div className={styles.contentHeadingContainer}>
                            <Typography variant="Regular_14" className={styles.contentHeading}>
                                {GENERAL.TAGS_HEADING_MSG}
                            </Typography>
                            <Button
                                variant={'text'}
                                className={styles.addNewButton}
                                isDisabled={isAddDisabled}
                                onClick={handleAddNewTag}
                                isThin={true}
                            >
                                {GENERAL.ADD_NEW_TAG}
                            </Button>
                        </div>
                        <div className={styles.keyValueHeading}>
                            <Typography variant="Semibold_14" className={styles.keyText}>
                                {GENERAL.TAG_KEY}
                            </Typography>
                            <Typography variant="Semibold_14" className={styles.keyText}>
                                {GENERAL.TAG_VALUE}
                            </Typography>
                        </div>
                        {tags.map((tagData: Tag, index: number) => {
                            return (
                                <div className={styles.tagItemContainer}>
                                    <div className={styles.itemKey}>
                                        <TextField
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                handleChange(index, 'key', e.target.value);
                                            }}
                                            placeholder={GENERAL.TAG_KEY_PLACEHOLDER}
                                            value={tagData.key}
                                            className={styles.keyField}
                                            // @ts-ignore
                                            maxlength={127}
                                        />
                                    </div>
                                    <div className={styles.seperator}> : </div>
                                    <div className={styles.itemValue}>
                                        <TextField
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                handleChange(index, 'value', e.target.value);
                                            }}
                                            placeholder={GENERAL.TAG_VALUE_PLACEHOLDER}
                                            value={tagData.value}
                                            className={styles.keyField}
                                            // @ts-ignore
                                            maxlength={255}
                                        />
                                    </div>
                                    {tags.length > 1 && (
                                        <Button
                                            variant="text"
                                            onClick={() => handleDeleteTag(index)}
                                            className={styles.closeButton}
                                        >
                                            <CloseIcon />
                                        </Button>
                                    )}
                                </div>
                            );
                        })}
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default Tags;

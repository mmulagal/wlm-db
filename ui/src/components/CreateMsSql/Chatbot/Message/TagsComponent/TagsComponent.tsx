import { TextField, Typography, Button } from '@netapp/design-system';
import { useMemo, useState } from 'react';
import { GENERAL } from '../../../../../utils/appConstants';
import { ReactComponent as CloseIcon } from '../../../../../assets/close-icon.svg';
import styles from './TagsComponent.module.scss';
import { TagObj } from '../../../../../utils/types/mssqlTypes';

type inputComponentPropType = {
    onChange: (key: string, val: string) => void;
};

const TagsComponent = ({onChange} : inputComponentPropType) => {
    const [tags, setTags] = useState<any>([{key: '', value: ''}]);

    //@ts-ignore
    const emptyTagItems = useMemo(() => {
        return tags.filter((tag: TagObj) => !tag.key);
    }, [tags]);

    //@ts-ignore
    const isAddDisabled = useMemo(() => {
        if (emptyTagItems.length || tags.length >= 40) {
            return true;
        } else {
            return false;
        }
    }, [tags]);

    const handleAddNewTag = () => {
        setTags([{ key: '', value: '' }, ...tags]);
    };

    const handleChange = (idx: number, prop: string, value: string) => {
        const re = /^([a-zA-Z0-9_.:/=+-@]*)$/;
        if (!value || re.test(value)) {
            const updatedTags = [
                ...tags.map((tag: TagObj) => {
                    return { key: tag.key, value: tag.value };
                })
            ];
            updatedTags[idx][prop] = value;
            setTags(updatedTags);
            onChange('tags', JSON.stringify(updatedTags.filter((tag: TagObj) => tag.key)));
        }
    };

    const handleDeleteTag = (idx: number) => {
        const updatedTags = [...tags];
        updatedTags.splice(idx, 1);
        setTags(updatedTags);
    };

    return (
        <>
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
        {tags.map((tagData: TagObj, index: number) => {
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
        </>
    );
};

export default TagsComponent;

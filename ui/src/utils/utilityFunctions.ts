import { optionType } from '@netapp/design-system/dist/components/Select';

export const generateOptionType = (
    value: string,
    label: string,
    label2: string,
    isDisabled: boolean,
    disabledTitle: string
) => {
    const option: optionType = {
        value: value,
        label: label,
        label2: label2,
        isDisabled: isDisabled,
        disabledTitle: disabledTitle
    };
    return option;
};

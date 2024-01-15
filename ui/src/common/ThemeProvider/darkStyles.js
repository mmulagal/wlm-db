export default (css, palette) => {
    const bg = css`
        --main-background: ${palette.Grey70};
        --main-background-rgb: ${palette.Grey70_RGB};
        --content-background: ${palette.Grey65};
        --hover-background: ${palette.Grey60};
        --table-header-background: ${palette.Grey55};
    `;

    const text = css`
        --text-primary: ${palette.White};
        --text-secondary: ${palette.Grey20};
        --text-disabled: ${palette.Grey40};
        --text-on-color: ${palette.White};
        --text-button-disabled: ${palette.Grey40};
        --text-button-primary: ${palette.Blue40};
        --text-button-primary-hover: ${palette.Blue30};
        --text-button-secondary: ${palette.Grey20};
        --text-button-secondary-hover: ${palette.Grey15};
        --text-button-light: ${palette.Blue30};
        --text-title: ${palette.White};
    `;

    const buttons = css`
        --button-primary-bg: ${palette.Blue50};
        --button-primary-bg-hover: ${palette.Blue60};
        --button-primary-bg-disabled: ${palette.Grey40};
        --button-primary-disabled: ${palette.Grey50};
        --button-secondary: ${palette.Blue40};
        --button-secondary-hover: ${palette.Blue30};
        --button-secondary-disabled: ${palette.Grey40};
        --button-card-footer: ${palette.Grey60};
        --button-card-footer-hover: ${palette.Grey55};
        --button-destructive-bg: ${palette.Red30};
        --button-destructive-bg-hover: ${palette.Red40};
    `;

    const icons = css`
        --icon-primary: ${palette.White};
        --icon-primary-hover: ${palette.Blue30};
        --icon-primary-disabled: ${palette.Grey40};

        --icon-secondary: ${palette.White};
        --icon-secondary-hover: ${palette.Grey20};
        --icon-secondary-disabled: ${palette.Grey40};

        --icon-tertiary: ${palette.Grey20};
        --icon-tertiary-hover: ${palette.Grey30};
        --icon-tertiary-disabled: ${palette.Grey40};

        --icon-on-color: ${palette.Grey70};
        --icon-on-color-white: ${palette.White};

        --icon-round-border: ${palette.Grey40};

        --tooltip-icon-default: ${palette.Grey20};
        --tooltip-icon-hover: ${palette.Blue40};
        --tooltip-info-bg: ${palette.Grey70};
    `;

    const notifications = css`
        --error: ${palette.Red20};
        --error-bg: ${palette.Grey60};
        --warning: ${palette.Orange15};
        --warning-bg: ${palette.Grey60};
        --information: ${palette.Blue40};
        --information-bg: ${palette.Grey60};
        --info: ${palette.Blue30};
        --info-bg: ${palette.Grey60};
        --success: ${palette.Green20};
        --success-bg: ${palette.Grey60};
        --group-item-bg: ${palette.Grey60};
    `;

    const other = css`
        --border: ${palette.Grey55};
        --drop-shadow: ${palette.Grey70};
        --drop-shadow-dialogs: ${palette.Grey70};
        --scroller: ${palette.Grey40};
        --scroller-track: #eee;
        --mask-bg: ${palette.Grey40};
        --date-picker-bg: ${palette.Grey65};
        --item-selection-bg: ${palette.Grey60};
        --item-selection-border: ${palette.Grey40};
        --underline-default: ${palette.Grey40};
        --underline-selected: ${palette.Blue40};
    `;

    const shell = css`
        --main-nav-bg: ${palette.Grey65};
        --main-nav-bg-hover: ${palette.Grey60};
        --main-nav-bg-selected: ${palette.Grey55};
        --main-nav-icon-text: ${palette.Grey20};
        --main-nav-icon-text-selected: ${palette.Cyan40};
        --header-netapp-bg: ${palette.Grey65};
        --header-service-bg: ${palette.Grey65};
        --header-netapp-primary-text: ${palette.White};
        --header-netapp-text-hover: ${palette.Blue40};
        --header-netapp-secondary-text: ${palette.Grey15};
        --header-netapp-icons: ${palette.Grey15};
        --header-notification-text: ${palette.Grey70};
        --header-notification-text-2: ${palette.Grey70};
        --header-separator-1: ${palette.Grey40};
        --header-separator-2: ${palette.Grey55};
    `;

    const chart = css`
        --chart-1: ${palette.Cyan60};
        --chart-2: ${palette.Cyan20};
        --chart-3: ${palette.Cyan40};
        --chart-4: ${palette.Green50};
        --chart-5: ${palette.Green40};
        --chart-6: ${palette.Orange30};
        --chart-7: ${palette.Orange20};
        --chart-8: ${palette.Orange80};
        --chart-9: ${palette.Purple10};
        --chart-10: ${palette.Grey20};
        --chart-11: ${palette.Purple15};
        --chart-disabled: ${palette.Grey60};
        --chart-background: ${palette.Purple03};
    `;

    const selectors = css`
        --selector-off-border: ${palette.White};
        --selector-off-border-hover: ${palette.Grey20};
        --selector-off-border-disabled: ${palette.Grey40};
        --selector-off-bg-disabled: ${palette.Grey65};
        --selector-on-bg: ${palette.Blue40};
        --selector-on-bg-disabled: ${palette.Grey40};
        --selector-on-bg-hover: ${palette.Blue30};
        --toggle-off: ${palette.White};
        --toggle-off-bg: ${palette.Grey25};
        --toggle-off-disabled: ${palette.Grey40};
        --toggle-off-bg-hover: ${palette.Grey30};
    `;

    const loaders = css`
        --loader-wheel-line: ${palette.Blue40};
        --loader-dot: ${palette.Blue40};
        --loader-line-bg: ${palette.Grey40};
    `;

    const fields = css`
        --field-border: ${palette.Grey20};
        --field-border-disabled: ${palette.Grey40};
        --field-bg-disabled: ${palette.Grey60};
        --field-border-selected: ${palette.Blue40};
        --field-icon: ${palette.Grey20};
        --field-icon-disabled: ${palette.Grey40};
    `;

    const thirdPartyTokens = css`
        --third-party-aws-smile: #ffffff;
        --third-party-aws-text: #ffffff;
    `;

    const canvas = css`
        --canvas-cloud-shadow: ${palette.Grey70};
    `;

    const components = css`
        --ux-icon-2-color-fg-1: var(--chart-1);
        --ux-icon-2-color-fg-2: var(--chart-11);
        --ux-icon-2-color-bg: var(--chart-background);
    `;

    return [
        bg,
        text,
        buttons,
        icons,
        notifications,
        other,
        shell,
        chart,
        selectors,
        loaders,
        fields,
        thirdPartyTokens,
        canvas,
        components
    ].join('\n');
};

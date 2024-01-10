export default (css, palette) => {
    const bg = css`
        --main-background: ${palette.Grey10};
        --main-background-rgb: ${palette.Grey10_RGB};
        --content-background: ${palette.White};
        --hover-background: ${palette.Blue10};
        --table-header-background: ${palette.Blue20};
    `;

    const text = css`
        --text-primary: ${palette.Grey50};
        --text-secondary: ${palette.Grey45};
        --text-disabled: ${palette.Grey30};
        --text-on-color: ${palette.White};
        --text-button-disabled: ${palette.Grey30};
        --text-button-primary: ${palette.Blue70};
        --text-button-primary-hover: ${palette.Blue80};
        --text-button-secondary: ${palette.Grey45};
        --text-button-secondary-hover: ${palette.Grey50};
        --text-button-light: ${palette.Blue70};
        --text-title: ${palette.Blue70};
    `;

    const buttons = css`
        --button-primary-bg: ${palette.Blue70};
        --button-primary-bg-hover: ${palette.Blue80};
        --button-primary-bg-disabled: ${palette.Grey15};
        --button-primary-disabled: ${palette.Grey30};
        --button-secondary: ${palette.Blue70};
        --button-secondary-hover: ${palette.Blue80};
        --button-secondary-disabled: ${palette.Grey30};
        --button-card-footer: ${palette.Blue10};
        --button-card-footer-hover: ${palette.Blue20};
        --button-destructive-bg: ${palette.Red30};
        --button-destructive-bg-hover: ${palette.Red40};
    `;

    const icons = css`
        --icon-primary: ${palette.Blue70};
        --icon-primary-hover: ${palette.Blue80};
        --icon-primary-disabled: ${palette.Grey30};

        --icon-secondary: ${palette.Grey50};
        --icon-secondary-hover: ${palette.Grey45};
        --icon-secondary-disabled: ${palette.Grey30};

        --icon-tertiary: ${palette.Grey45};
        --icon-tertiary-hover: ${palette.Grey40};
        --icon-tertiary-disabled: ${palette.Grey30};

        --icon-on-color: ${palette.White};
        --icon-on-color-white: ${palette.White};

        --icon-round-border: ${palette.Grey15};

        --tooltip-icon-default: ${palette.Grey30};
        --tooltip-icon-hover: ${palette.Blue70};
        --tooltip-info-bg: ${palette.White};
    `;

    const notifications = css`
        --error: ${palette.Red30};
        --error-bg: ${palette.Red10};
        --warning: ${palette.Orange60};
        --warning-bg: ${palette.Orange10};
        --information: ${palette.Cyan30};
        --information-bg: ${palette.Cyan10};
        --info: ${palette.Cyan30};
        --info-bg: ${palette.Cyan10};
        --success: ${palette.Green60};
        --success-bg: ${palette.Green10};
        --group-item-bg: ${palette.White};
    `;

    const other = css`
        --border: ${palette.Grey15};
        --drop-shadow: ${palette.Grey15};
        --drop-shadow-dialogs: ${palette.Grey45};
        --scroller: ${palette.Grey25};
        --scroller-track: #eee;
        --mask-bg: ${palette.Grey50};
        --date-picker-bg: ${palette.Grey10};
        --item-selection-bg: ${palette.Grey10};
        --item-selection-border: ${palette.White};
        --underline-default: ${palette.Grey30};
        --underline-selected: ${palette.Blue70};
    `;

    const shell = css`
        --main-nav-bg: ${palette.White};
        --main-nav-bg-hover: ${palette.Grey10};
        --main-nav-bg-selected: ${palette.Blue10};
        --main-nav-icon-text: ${palette.Grey45};
        --main-nav-icon-text-selected: ${palette.Blue70};
        --header-netapp-bg: ${palette.Blue70};
        --header-service-bg: ${palette.White};
        --header-netapp-primary-text: ${palette.White};
        --header-netapp-text-hover: ${palette.Blue30};
        --header-netapp-secondary-text: ${palette.Blue10};
        --header-netapp-icons: ${palette.White};
        --header-notification-text: ${palette.Blue80};
        --header-notification-text-2: ${palette.White};
        --header-separator-1: ${palette.White};
        --header-separator-2: ${palette.White};
    `;

    const chart = css`
        --chart-1: ${palette.Cyan70};
        --chart-2: ${palette.Cyan20};
        --chart-3: ${palette.Cyan50};
        --chart-4: ${palette.Green50};
        --chart-5: ${palette.Green30};
        --chart-6: ${palette.Orange40};
        --chart-7: ${palette.Orange50};
        --chart-8: ${palette.Orange70};
        --chart-9: ${palette.Purple20};
        --chart-10: ${palette.Purple30};
        --chart-11: ${palette.Purple15};
        --chart-disabled: ${palette.Grey15};
        --chart-background: ${palette.Purple03};
    `;

    const selectors = css`
        --selector-off-border: ${palette.Grey50};
        --selector-off-border-hover: ${palette.Grey45};
        --selector-off-border-disabled: ${palette.Grey30};
        --selector-off-bg-disabled: ${palette.Grey10};
        --selector-on-bg: ${palette.Blue70};
        --selector-on-bg-disabled: ${palette.Grey30};
        --selector-on-bg-hover: ${palette.Blue80};
        --toggle-off: ${palette.White};
        --toggle-off-bg: ${palette.Grey25};
        --toggle-off-disabled: ${palette.Grey25};
        --toggle-off-bg-hover: ${palette.Grey30};
    `;

    const loaders = css`
        --loader-wheel-line: ${palette.Blue70};
        --loader-dot: ${palette.Cyan30};
        --loader-line-bg: ${palette.Grey15};
    `;

    const fields = css`
        --field-border: ${palette.Grey30};
        --field-border-disabled: ${palette.Grey25};
        --field-bg-disabled: ${palette.Grey10};
        --field-border-selected: ${palette.Blue70};
        --field-icon: ${palette.Grey30};
        --field-icon-disabled: ${palette.Grey25};
    `;

    const thirdPartyTokens = css`
        --third-party-aws-smile: #ff9900;
        --third-party-aws-text: #252f3e;
    `;

    const canvas = css`
        --canvas-cloud-shadow: ${palette.Grey25};
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

import React, { useContext, useMemo, useRef, useEffect } from 'react';
import palette from './palette.js';
import lightStyles from './lightStyles';
import darkStyles from './darkStyles';

const styles: any = {
    light: lightStyles,
    dark: darkStyles
};

/**
 * Template function does nothing, but webstorm uses it to properly syntax highlight css
 */
// @ts-ignore
const css = (strings, ...values) => {
    // @ts-ignore
    return (
        strings
            // @ts-ignore
            .map(function (e, i) {
                return [e, values[i]];
            })
            .flat()
            .join(' ')
    );
};

type Tokens = { [key: string]: string };

interface ThemeContextType {
    theme: string;
    styleString: string;
    tokens: Tokens;
}

const emptyTheme = { theme: '', styleString: '', tokens: {} };
const ThemeContext = React.createContext<ThemeContextType>(emptyTheme);

export const useCurrentTheme = () => {
    return useContext<ThemeContextType>(ThemeContext);
};

const ThemeProvider = React.memo(
    ({
        children,
        theme,
        isRoot,
        className,
        container
    }: {
        className?: string;
        children: any;
        theme: string;
        isRoot: boolean;
        container?: HTMLElement;
    }) => {
        const wrapperRef = useRef<HTMLDivElement>(null);
        const themeState = useMemo(() => {
            const style = styles[theme];

            if (!style) {
                return emptyTheme;
            }

            const styleString: string = style(css, palette);

            const tokens: Tokens = {};

            styleString
                .trim()
                .replace(/\n/g, '')
                .split(';')
                .forEach(style => {
                    style = style.trim();
                    let [token, hex] = style.split(':');
                    if (token && hex) {
                        hex = hex.trim();
                        tokens[token] = hex;
                    }
                });

            return { theme, styleString, tokens };
        }, [theme]);

        useEffect(() => {
            if (isRoot) {
                const styleTag = window.document.createElement('style');

                // Use textContent to set the CSS rules safely
                const styleContent = `
                    :root, ::before, ::after {
                        ${themeState.styleString};
                    }
                `;
                styleTag.textContent = styleContent;

                // @ts-ignore
                ThemeProvider.activeStyles = themeState.styleString;

                document.head.appendChild(styleTag);

                return () => {
                    document.head.removeChild(styleTag);
                };
            } else {
                if (container) {
                    const styleTag = window.document.createElement('style');
                    const className = `theme-provider-${crypto.randomUUID()}`;

                    // Use textContent to set the CSS rules safely
                    const styleContent = `
                        .${className}, .${className}::before, .${className}::after {
                            ${themeState.styleString}
                        }
                    `;
                    styleTag.textContent = styleContent;

                    styleTag.setAttribute('data-component', 'ThemeProviderStyle');
                    container.appendChild(styleTag);
                    container.classList.add(className);

                    return () => {
                        container.removeChild(styleTag);
                        container.classList.remove(className);
                    };
                } else if (wrapperRef.current) {
                    wrapperRef.current.style.cssText = themeState.styleString;
                }
            }
        }, [themeState, isRoot]);

        return (
            <ThemeContext.Provider value={themeState}>
                {container ? (
                    children
                ) : (
                    <div ref={wrapperRef} className={className}>
                        {children}
                    </div>
                )}
            </ThemeContext.Provider>
        );
    }
);

export default ThemeProvider;

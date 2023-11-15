import React from 'react';
import './Highlighter.scss';

const HighlighterWord = ({ children, highlight, isAWSCli, count, apiResForSearch }: any) => {
    if (!highlight || highlight.length < 2) return children;
    const checkForSpecialChars = /^[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]*$/;
    if (highlight.match(checkForSpecialChars)) {
        return children;
    }
    const regexp = new RegExp(highlight, 'g');
    let content = '';

    if (apiResForSearch) {
        content = apiResForSearch?.props?.textToHighlight;
    } else {
        if (children?.props?.children || children?.props?.children?.props?.textToHighlight) {
            content = children?.props?.children?.props?.textToHighlight
                ? children?.props?.children?.props?.textToHighlight
                : children?.props?.children;
        } else {
            content = children;
        }
    }

    const matches = content.match(regexp)!;
    var parts = content.split(new RegExp(`${highlight.replace()}`, 'g'));

    //@ts-ignore
    count(parts.length);

    for (var i = 0; i < parts.length; i++) {
        if (i !== parts.length - 1) {
            let match = matches[i];
            // While the next part is an empty string, merge the corresponding match with the current
            // match into a single <span/> to avoid consequent spans with nothing between them.

            while (parts[i + 1] === '') {
                if (matches[++i] !== undefined) {
                    match += matches[++i];
                }
            }

            //@ts-ignore
            parts[i] = (
                <React.Fragment key={i}>
                    {parts[i]}
                    <span className={'highlighted'}>{match}</span>
                </React.Fragment>
            );
        }
    }
    return (
        <div className={'highlighter'}>
            {isAWSCli && <div className="aws-cli">{parts}</div>}
            {!isAWSCli && <pre className="fontFamily">{parts}</pre>}
        </div>
    );
};

export default HighlighterWord;

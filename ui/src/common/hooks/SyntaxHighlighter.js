import React, { useEffect, useState } from 'react';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import json from 'react-syntax-highlighter/dist/esm//languages/prism/json';
import js from 'react-syntax-highlighter/dist/esm//languages/prism/javascript';
import jsx from 'react-syntax-highlighter/dist/esm//languages/prism/jsx';
import yaml from 'react-syntax-highlighter/dist/esm//languages/prism/yaml';
import bash from 'react-syntax-highlighter/dist/esm//languages/prism/bash';
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('javascript', js);
SyntaxHighlighter.registerLanguage('jsx', jsx);
SyntaxHighlighter.registerLanguage('yaml', yaml);
SyntaxHighlighter.registerLanguage('bash', bash);
const _ = require('lodash');

const style = {
    'code[class*="language-"]': {
        color: 'var(--text-primary)',
        background: 'none',
        fontFamily: "Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace",
        fontSize: '0.875em',
        textAlign: 'left',
        whiteSpace: 'pre',
        wordSpacing: 'normal',
        wordBreak: 'break-word',
        wordWrap: 'normal',
        lineHeight: '1.5',
        MozTabSize: '4',
        OTabSize: '4',
        tabSize: '4',
        WebkitHyphens: 'none',
        MozHyphens: 'none',
        msHyphens: 'none',
        hyphens: 'none'
    },
    'pre[class*="language-"]': {
        color: 'var(--text-primary)',
        fontFamily: "Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace",
        fontSize: '0.875em',
        textAlign: 'left',
        whiteSpace: 'pre',
        wordSpacing: 'normal',
        wordBreak: 'normal',
        wordWrap: 'normal',
        lineHeight: '1.5',
        MozTabSize: '4',
        OTabSize: '4',
        tabSize: '4',
        WebkitHyphens: 'none',
        MozHyphens: 'none',
        msHyphens: 'none',
        hyphens: 'none'
    },
    'pre[class*="language-"]::-moz-selection': {
        textShadow: 'none',
        background: 'var(--hover-background)'
    },
    'pre[class*="language-"] ::-moz-selection': {
        textShadow: 'none',
        background: 'var(--hover-background)'
    },
    'code[class*="language-"]::-moz-selection': {
        textShadow: 'none',
        background: 'var(--hover-background)'
    },
    'code[class*="language-"] ::-moz-selection': {
        textShadow: 'none',
        background: 'var(--hover-background)'
    },
    'pre[class*="language-"]::selection': {
        textShadow: 'none',
        background: 'var(--hover-background)'
    },
    'pre[class*="language-"] ::selection': {
        textShadow: 'none',
        background: 'var(--hover-background)'
    },
    'code[class*="language-"]::selection': {
        textShadow: 'none',
        background: 'var(--hover-background)'
    },
    'code[class*="language-"] ::selection': {
        textShadow: 'none',
        background: 'var(--hover-background)'
    },
    ':not(pre) > code[class*="language-"]': {
        background: 'transparent',
        padding: '.1em',
        borderRadius: '.3em',
        whiteSpace: 'normal'
    },
    comment: {
        color: 'var(--text-secondary)'
    },
    prolog: {
        color: 'var(--text-secondary)'
    },
    doctype: {
        color: 'var(--text-secondary)'
    },
    cdata: {
        color: 'var(--text-secondary)'
    },
    punctuation: {
        color: 'var(--text-disabled)'
    },
    namespace: {
        Opacity: '.7'
    },
    property: {
        color: 'var(--chart-10)'
    },
    tag: {
        color: 'var(--chart-10)'
    },
    boolean: {
        color: 'var(--warning)'
    },
    number: {
        color: 'var(--info)'
    },
    constant: {
        color: 'var(--chart-10)'
    },
    symbol: {
        color: 'var(--chart-10)'
    },
    deleted: {
        color: 'var(--chart-10)'
    },
    selector: {
        color: 'var(--success)'
    },
    'attr-name': {
        color: 'var(--success)'
    },
    string: {
        color: 'var(--text-primary)'
    },
    char: {
        color: 'var(--success)'
    },
    builtin: {
        color: 'var(--success)'
    },
    inserted: {
        color: 'var(--success)'
    },
    operator: {
        color: 'var(--chart-6)'
    },
    entity: {
        color: 'var(--chart-6)',
        cursor: 'help'
    },
    url: {
        color: 'var(--chart-6)'
    },
    '.language-css .token.string': {
        color: 'var(--chart-6)'
    },
    '.style .token.string': {
        color: 'var(--chart-6)'
    },
    atrule: {
        color: 'var(--chart-3)'
    },
    'attr-value': {
        color: 'var(--chart-3)'
    },
    'keyword :not(null)': {
        color: 'var(--chart-3)'
    },
    function: {
        color: 'var(--chart-7)'
    },
    'class-name': {
        color: 'var(--error)'
    },
    regex: {
        color: 'var(--warning)'
    },
    important: {
        color: 'var(--text-primary)',
        // fontWeight: 'bold'
    },
    variable: {
        color: 'var(--warning)'
    },
    bold: {
        fontWeight: 'bold'
    },
    italic: {
        fontStyle: 'italic'
    },
    null: {
        color: 'var(--error)'
    }
};

export default React.memo(({ children: _children, ...props }) => {
    const [children, setChildren] = useState(null);

    useEffect(() => {
        const children = _.isObject(_children) ? JSON.stringify(_children, null, 4) : _children;
        setChildren(children);
    }, [_children]);

    return (
        children && (
            <SyntaxHighlighter style={style} {...props}>
                {children}
            </SyntaxHighlighter>
        )
    );
});

import domToImage from 'dom-to-image';
// @ts-ignore
import { jsPDF } from 'jspdf';

const _cloneNode = (node, javascriptEnabled) => {
    let child;
    let clone;
    clone = node.nodeType === 3 ? document.createTextNode(node.nodeValue) : node.cloneNode(false);
    child = node.firstChild;
    while (child) {
        if (javascriptEnabled === true || child.nodeType !== 1 || child.nodeName !== 'SCRIPT') {
            clone.appendChild(_cloneNode(child, javascriptEnabled));
        }
        child = child.nextSibling;
    }
    if (node.nodeType === 1) {
        if (node.nodeName === 'CANVAS') {
            clone.width = node.width;
            clone.height = node.height;
            clone.getContext('2d').drawImage(node, 0, 0);
        } else if (node.nodeName === 'TEXTAREA' || node.nodeName === 'SELECT') {
            clone.value = node.value;
        }
        clone.addEventListener(
            'load',
            () => {
                clone.scrollTop = node.scrollTop;
                clone.scrollLeft = node.scrollLeft;
            },
            true
        );
    }
    return clone;
};

const _createElement = (tagName, { className, html, style }) => {
    const el = document.createElement(tagName);

    if (className) {
        el.className = className;
    }

    if (html) {
        const tempDiv = document.createElement('div');
        tempDiv.textContent = html; // Use textContent to avoid XSS

        // Convert plain text into structured elements
        while (tempDiv.firstChild) {
            el.appendChild(tempDiv.firstChild);
        }
    }

    if (style) {
        Object.keys(style).forEach(key => {
            el.style[key] = style[key];
        });
    }

    return el;
};

const _isCanvasBlank = canvas => {
    let blank;
    let ctx;
    blank = document.createElement('canvas');
    blank.width = canvas.width;
    blank.height = canvas.height;
    ctx = blank.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, blank.width, blank.height);
    return canvas.toDataURL() === blank.toDataURL();
};

const downloadPdf = (dom, options, cb) => {
    const a4Height = 841.89;
    const a4Width = 595.28;
    let overrideWidth;
    let container;
    let containerCSS;
    let containerWidth;
    let elements;
    let excludeClassNames;
    let excludeTagNames;
    let filename;
    let filterFn;
    let innerRatio;
    let overlay;
    let overlayCSS;
    let pageHeightPx;
    let proxyUrl;
    let compression = 'NONE';
    let scale;
    let opts;
    let offsetHeight;
    let offsetWidth;
    let scaleObj;
    let style;
    const transformOrigin = 'top left';
    const pdfOptions = {
        orientation: 'p',
        unit: 'pt',
        format: 'a4'
    };

    ({
        filename,
        excludeClassNames = [],
        excludeTagNames = ['button', 'input', 'select'],
        overrideWidth,
        proxyUrl,
        compression,
        scale
    } = options);

    overlayCSS = {
        position: 'fixed',
        zIndex: 1000,
        opacity: 0,
        left: 0,
        right: 0,
        bottom: 0,
        top: 0,
        backgroundColor: 'rgba(0,0,0,0.8)'
    };
    if (overrideWidth) {
        overlayCSS.width = `${overrideWidth}px`;
    }
    containerCSS = {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        height: 'auto',
        margin: 'auto',
        overflow: 'auto',
        backgroundColor: 'white'
    };
    overlay = _createElement('div', {
        style: overlayCSS
    });
    container = _createElement('div', {
        style: containerCSS
    });
    container.appendChild(_cloneNode(dom));
    overlay.appendChild(container);
    document.body.appendChild(overlay);
    innerRatio = a4Height / a4Width;
    containerWidth = overrideWidth || container.getBoundingClientRect().width;
    pageHeightPx = Math.floor(containerWidth * innerRatio);
    elements = container.querySelectorAll('*');

    for (let i = 0, len = excludeClassNames.length; i < len; i++) {
        const clName = excludeClassNames[i];
        container.querySelectorAll(`.${clName}`).forEach(a => a.remove());
    }

    for (let j = 0, len1 = excludeTagNames.length; j < len1; j++) {
        const tName = excludeTagNames[j];
        const els = container.getElementsByTagName(tName);

        for (let k = els.length - 1; k >= 0; k--) {
            if (!els[k]) {
                continue;
            }
            els[k].parentNode.removeChild(els[k]);
        }
    }

    Array.prototype.forEach.call(container.querySelectorAll('[data-pdf-new-page]'), el => {
        let clientRect;
        let offsetInPage;
        let pad;
        clientRect = el.getBoundingClientRect();
        offsetInPage = clientRect.top % pageHeightPx;
        if (offsetInPage !== 0) {
            pad = _createElement('div', {
                style: {
                    display: 'block',
                    height: `${pageHeightPx - offsetInPage}px`
                }
            });
            el.parentNode.insertBefore(pad, el);
        }
    });

    Array.prototype.forEach.call(elements, el => {
        let clientRect;
        let endPage;
        let nPages;
        let pad;
        let rules;
        let startPage;
        rules = {
            before: false,
            after: false,
            avoid: true
        };
        clientRect = el.getBoundingClientRect();
        if (rules.avoid && !rules.before) {
            startPage = Math.floor(clientRect.top / pageHeightPx);
            endPage = Math.floor(clientRect.bottom / pageHeightPx);
            nPages = Math.abs(clientRect.bottom - clientRect.top) / pageHeightPx;
            if (endPage !== startPage && nPages <= 1) {
                rules.before = true;
            }
            if (rules.before) {
                pad = _createElement('div', {
                    style: {
                        display: 'block',
                        height: `${pageHeightPx - (clientRect.top % pageHeightPx)}px`
                    }
                });
                return el.parentNode.insertBefore(pad, el);
            }
        }
    });

    filterFn = ({ classList, tagName }) => {
        let cName;
        let j;
        let len;
        let ref;
        if (classList) {
            for (j = 0, len = excludeClassNames.length; j < len; j++) {
                cName = excludeClassNames[j];
                if (Array.prototype.indexOf.call(classList, cName) >= 0) {
                    return false;
                }
            }
        }
        ref = tagName != null ? tagName.toLowerCase() : undefined;
        return excludeTagNames.indexOf(ref) < 0;
    };

    opts = {
        filter: filterFn,
        proxy: proxyUrl
    };

    if (scale) {
        offsetWidth = container.offsetWidth;
        offsetHeight = container.offsetHeight;
        style = {
            transform: `scale(${scale})`,
            transformOrigin,
            width: `${offsetWidth}px`,
            height: `${offsetHeight}px`
        };
        scaleObj = {
            width: offsetWidth * scale,
            height: offsetHeight * scale,
            quality: 1,
            style
        };
        opts = Object.assign(opts, scaleObj);
    }

    return domToImage
        .toPng(container, opts)
        .then(dataUrl => {
            const img = new Image();
            img.src = dataUrl;

            return new Promise((resolve, reject) => {
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    resolve(canvas);
                };

                img.onerror = error => reject(error);
            });
        })
        .then(canvas => {
            let h;
            let imgData;
            let nPages;
            let page;
            let pageCanvas;
            let pageCtx;
            let pageHeight;
            let pdf;
            let pxFullHeight;
            let w;
            document.body.removeChild(overlay);
            pdf = new jsPDF(pdfOptions);
            pxFullHeight = canvas.height;
            nPages = Math.ceil(pxFullHeight / pageHeightPx);
            pageHeight = a4Height;
            pageCanvas = document.createElement('canvas');
            pageCtx = pageCanvas.getContext('2d');
            pageCanvas.width = canvas.width;
            pageCanvas.height = pageHeightPx;
            page = 0;
            while (page < nPages) {
                if (page === nPages - 1 && pxFullHeight % pageHeightPx !== 0) {
                    pageCanvas.height = pxFullHeight % pageHeightPx;
                    pageHeight = (pageCanvas.height * a4Width) / pageCanvas.width;
                }
                w = pageCanvas.width;
                h = pageCanvas.height;
                pageCtx.fillStyle = 'white';
                pageCtx.fillRect(0, 0, w, h);
                pageCtx.drawImage(canvas, 0, page * pageHeightPx, w, h, 0, 0, w, h);
                if (_isCanvasBlank(pageCanvas)) {
                    ++page;
                    continue;
                }
                if (page) {
                    pdf.addPage();
                }
                imgData = pageCanvas.toDataURL('image/PNG');
                pdf.addImage(imgData, 'PNG', 0, 0, a4Width, pageHeight, undefined, compression);
                ++page;
            }
            if (typeof cb === 'function') {
                cb(pdf);
            }
            return pdf.save(filename);
        })
        .catch(error => {
            document.body.removeChild(overlay);
            if (typeof cb === 'function') {
                cb(null);
            }
            return console.error(error);
        });
};

export default downloadPdf;

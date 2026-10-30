
// DOM elements
const fileInput = document.getElementById('fileInput');
const dropzone = document.getElementById('dropzone');
const fileList = document.getElementById('fileList');
const themeToggle = document.getElementById('themeToggle');

const quality = document.getElementById('quality');
const qualityValue = document.getElementById('qualityValue');
const format = document.getElementById('format');
const maxWidth = document.getElementById('maxWidth');
const preserveNames = document.getElementById('preserveNames');

const compressBtn = document.getElementById('compressBtn');
const clearAll = document.getElementById('clearAll');
const downloadAll = document.getElementById('downloadAll');

const results = document.getElementById('results');
const processStatus = document.getElementById('processStatus');
const progressWrap = document.getElementById('progressWrap');
const progressBar = document.getElementById('progressBar');
const toastElement = document.getElementById('toast');

const queueCount = document.getElementById('queueCount');
const resultSub = document.getElementById('resultSub');
const savedPercent = document.getElementById('savedPercent');
const originalTotal = document.getElementById('originalTotal');
const optimizedTotal = document.getElementById('optimizedTotal');
const savedTotal = document.getElementById('savedTotal');
const formatHint = document.getElementById('formatHint');

// Configuration and state
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_FILES = 30;

const settingControls = [format, quality, maxWidth, preserveNames];

let items = [];
let nextId = 1;
let busy = false;
let toastTimer;

// Formatting and cleanup helpers
function formatBytes(bytes) {
    if (!Number.isFinite(bytes)) {
        return '—';
    }

    if (bytes < 1024) {
        return `${bytes} B`;
    }

    const units = ['KB', 'MB', 'GB'];
    let value = bytes / 1024;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
        value = value / 1024;
        unitIndex++;
    }

    let digits = 2;

    if (value >= 100) {
        digits = 0;
    } else if (value >= 10) {
        digits = 1;
    }

    return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

function escapeHTML(value) {
    const entities = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };

    return String(value).replace(/[&<>"']/g, function (character) {
        return entities[character];
    });
}

function showToast(message) {
    toastElement.textContent = message;
    toastElement.classList.add('show');

    clearTimeout(toastTimer);

    toastTimer = setTimeout(function () {
        toastElement.classList.remove('show');
    }, 2800);
}

function revokeObjectURL(url) {
    if (url) {
        URL.revokeObjectURL(url);
    }
}

function clearOutput(item) {
    revokeObjectURL(item.outputUrl);

    item.outputUrl = null;
    item.outputBlob = null;
}

function cleanItem(item) {
    revokeObjectURL(item.previewUrl);
    clearOutput(item);
}

function resetResults() {
    results.classList.remove('show');
    downloadAll.hidden = true;

    processStatus.textContent = '';
    progressWrap.classList.remove('show');
    progressBar.style.width = '0%';
}

// File handling
function isDuplicate(file) {
    return items.some(function (item) {
        return (
            item.file.name === file.name &&
            item.file.size === file.size &&
            item.file.lastModified === file.lastModified
        );
    });
}

function readImageDimensions(item) {
    const image = new Image();

    image.onload = function () {
        item.width = image.naturalWidth;
        item.height = image.naturalHeight;

        render();
    };

    image.onerror = function () {
        item.status = 'Could not read image';
        item.error = 'This file could not be decoded by your browser.';

        render();
    };

    image.src = item.previewUrl;
}

function addFiles(fileCollection) {
    if (busy) {
        fileInput.value = '';
        showToast('Wait for compression to finish before adding images.');
        return;
    }

    const files = Array.from(fileCollection || []);

    if (files.length === 0) {
        return;
    }

    let addedCount = 0;

    for (const file of files) {
        if (items.length >= MAX_FILES) {
            showToast('Maximum ' + MAX_FILES + ' images per batch.');
            break;
        }

        if (!file.type.startsWith('image/')) {
            showToast('Skipped ' + file.name + ': not an image.');
            continue;
        }

        if (file.type === 'image/svg+xml') {
            showToast('SVG files are not supported in this version.');
            continue;
        }

        if (file.size > MAX_BYTES) {
            showToast('Skipped ' + file.name + ': maximum size is 20 MB.');
            continue;
        }

        if (isDuplicate(file)) {
            continue;
        }

        const item = {
            id: nextId,
            file,
            previewUrl: URL.createObjectURL(file),
            outputUrl: null,
            outputBlob: null,
            status: 'Ready',
            error: '',
            width: 0,
            height: 0
        };

        nextId++;

        items.push(item);
        addedCount++;

        readImageDimensions(item);
    }

    if (addedCount > 0) {
        resetResults();
        render();

        showToast(
            `${addedCount} image${addedCount === 1 ? '' : 's'} added to queue.`
        );
    }

    fileInput.value = '';
}

function getOutputName(item) {
    const fileName = item.file.name;
    const dotIndex = fileName.lastIndexOf('.');

    const nameWithoutExtension =
        dotIndex > 0 ? fileName.substring(0, dotIndex) : fileName;
    let extension = 'webp';

    if (format.value === 'image/jpeg') {
        extension = 'jpg';
    } else if (format.value === 'image/png') {
        extension = 'png';
    }

    const suffix = preserveNames.checked ? '' : '-optimized';

    return `${nameWithoutExtension}${suffix}.${extension}`;
}

// UI rendering
function renderItem(item) {
    const sizeReduction = item.outputBlob && item.file.size > 0
        ? Math.round((1 - item.outputBlob.size / item.file.size) * 100)
        : null;
    const fileName = escapeHTML(item.file.name);
    let reductionText = '';

    if (sizeReduction !== null) {
        reductionText = sizeReduction >= 0
            ? ` · ${sizeReduction}% smaller`
            : ` · ${Math.abs(sizeReduction)}% larger`;
    }

    const statusHTML = item.error
        ? `<div class="file-status error">${escapeHTML(item.error)}</div>`
        : `<div class="file-status">${escapeHTML(item.status)}${reductionText}</div>`;
    const actionHTML = item.outputUrl
        ? `<a
            class="mini-download"
            href="${item.outputUrl}"
            download="${escapeHTML(getOutputName(item))}"
            aria-label="Download ${fileName}"
        >Download ↓</a>`
        : `<button
            class="icon-btn remove"
            data-id="${item.id}"
            aria-label="Remove ${fileName}"
            title="Remove image"
            ${busy ? 'disabled' : ''}
        >
            <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
            >
                <path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14M10 10v6m4-6v6"/>
            </svg>
        </button>`;
    const dimensions = item.width && item.height
        ? `${item.width} × ${item.height}`
        : 'Reading dimensions…';
    const outputSizeHTML = item.outputBlob
        ? `<div class="file-meta">
            <span>${formatBytes(item.outputBlob.size)} output</span>
        </div>`
        : '';

    return `
        <div class="file-row">
            <img class="thumb" src="${item.previewUrl}" alt="Preview of ${fileName}">
            <div class="file-details">
                <div class="file-name" title="${fileName}">${fileName}</div>
                <div class="file-meta">
                    <span>${formatBytes(item.file.size)}</span>
                    <span>·</span>
                    <span>${dimensions}</span>
                </div>
                ${statusHTML}
                ${outputSizeHTML}
            </div>
            <div class="file-actions">${actionHTML}</div>
        </div>
    `;
}

function render() {
    queueCount.textContent = `(${items.length})`;

    clearAll.disabled = busy || items.length === 0;

    compressBtn.disabled =
        busy ||
        items.length === 0 ||
        !items.some(function (item) {
            return !item.error;
        });

    settingControls.forEach(function (control) {
        control.disabled = busy;
    });

    if (items.length === 0) {
        fileList.innerHTML = `
            <div class="empty-state">
                Your workspace is empty.<br>
                Choose one or more images to get started.
            </div>
        `;
        return;
    }

    fileList.innerHTML = items.map(renderItem).join('');
}

function removeItem(id) {
    if (busy) {
        return;
    }

    const item = items.find(function (entry) {
        return entry.id === id;
    });

    if (!item) {
        return;
    }

    cleanItem(item);

    items = items.filter(function (entry) {
        return entry.id !== id;
    });

    resetResults();
    render();
}

// Image compression
function canvasToBlob(canvas, type, qualityNumber) {
    return new Promise(function (resolve, reject) {
        try {
            canvas.toBlob(function (blob) {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(
                        new Error(
                            'This format could not be created by your browser.'
                        )
                    );
                }
            }, type, qualityNumber);
        } catch (error) {
            reject(
                new Error(
                    'This format could not be created by your browser.'
                )
            );
        }
    });
}

async function compressOne(item) {
    const image = new Image();

    await new Promise(function (resolve, reject) {
        image.onload = resolve;

        image.onerror = function () {
            reject(new Error('Image could not be decoded.'));
        };

        image.src = item.previewUrl;
    });

    const maxDimension = Number(maxWidth.value);

    const longestSide = Math.max(
        image.naturalWidth,
        image.naturalHeight
    );

    let scale = 1;

    if (maxDimension > 0 && longestSide > maxDimension) {
        scale = maxDimension / longestSide;
    }

    const canvas = document.createElement('canvas');

    canvas.width = Math.max(
        1,
        Math.round(image.naturalWidth * scale)
    );

    canvas.height = Math.max(
        1,
        Math.round(image.naturalHeight * scale)
    );

    const requestedType = format.value;

    const context = canvas.getContext('2d', {
        alpha: requestedType !== 'image/jpeg'
    });

    if (!context) {
        throw new Error('Canvas is not available in this browser.');
    }

    if (requestedType === 'image/jpeg') {
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
    }

    context.drawImage(
        image,
        0,
        0,
        canvas.width,
        canvas.height
    );

    const qualityNumber = Number(quality.value) / 100;

    let blob;

    if (requestedType === 'image/png') {
        blob = await canvasToBlob(canvas, requestedType);
    } else {
        blob = await canvasToBlob(
            canvas,
            requestedType,
            qualityNumber
        );
    }

    if (blob.type !== requestedType) {
        const formatName = requestedType.split('/')[1].toUpperCase();

        throw new Error(
            'Your browser does not support ' +
            formatName +
            ' export. Try WebP or JPEG.'
        );
    }

    item.outputBlob = blob;
    item.outputUrl = URL.createObjectURL(blob);

    item.status =
        'Optimized · ' + canvas.width + ' × ' + canvas.height;

    item.error = '';
}

async function compressAll() {
    if (busy || items.length === 0) {
        return;
    }

    busy = true;

    resetResults();
    render();

    progressWrap.classList.add('show');

    let completedCount = 0;
    let failedCount = 0;

    const queue = [...items];

    for (let i = 0; i < queue.length; i++) {
        const item = queue[i];

        clearOutput(item);

        item.error = '';
        item.status = 'Compressing…';

        render();

        try {
            await compressOne(item);
        } catch (error) {
            if (error instanceof Error) {
                item.error = error.message;
            } else {
                item.error = 'Compression failed.';
            }

            item.status = 'Failed';
            failedCount++;
        }

        completedCount++;

        progressBar.style.width =
            Math.round((completedCount / queue.length) * 100) + '%';

        processStatus.textContent =
            `Processed ${completedCount} of ${queue.length} images`;

        render();

        await new Promise(function (resolve) {
            setTimeout(resolve, 0);
        });
    }

    busy = false;
    render();

    const successfulItems = items.filter(function (item) {
        return item.outputBlob;
    });

    if (successfulItems.length > 0) {
        let originalBytes = 0;
        let outputBytes = 0;

        for (let i = 0; i < successfulItems.length; i++) {
            originalBytes += successfulItems[i].file.size;
            outputBytes += successfulItems[i].outputBlob.size;
        }

        const savedBytes = originalBytes - outputBytes;

        let savedPercentage = 0;

        if (originalBytes > 0) {
            savedPercentage = Math.round(
                (savedBytes / originalBytes) * 100
            );
        }

        results.classList.add('show');

        resultSub.textContent =
            `${successfulItems.length} image${successfulItems.length === 1 ? '' : 's'} optimized` +
            (failedCount ? ` · ${failedCount} failed` : '');

        if (savedBytes >= 0) {
            savedPercent.textContent = `${savedPercentage}%`;
            savedTotal.textContent = `${formatBytes(savedBytes)} saved`;
        } else {
            savedPercent.textContent = `+${Math.abs(savedPercentage)}%`;
            savedTotal.textContent = `${formatBytes(-savedBytes)} larger`;
        }

        originalTotal.textContent = formatBytes(originalBytes);
        optimizedTotal.textContent = formatBytes(outputBytes);

        downloadAll.hidden = false;
    }

    if (failedCount > 0) {
        processStatus.textContent =
            failedCount +
            ' image(s) could not be processed. Check their error messages.';
    } else {
        processStatus.textContent = 'All images processed.';
    }

    if (failedCount > 0) {
        showToast(
            successfulItems.length +
            ' complete · ' +
            failedCount +
            ' failed'
        );
    } else {
        showToast('Compression complete. Your files are ready.');
    }
}

// Downloads
function downloadAllFiles() {
    const successfulItems = items.filter(function (item) {
        return item.outputUrl;
    });

    if (successfulItems.length === 0) {
        return;
    }

    successfulItems.forEach(function (item, index) {
        setTimeout(function () {
            const link = document.createElement('a');

            link.href = item.outputUrl;
            link.download = getOutputName(item);

            document.body.appendChild(link);

            link.click();
            link.remove();
        }, index * 180);
    });

    showToast(
        `Download started for ${successfulItems.length} image(s). ` +
        'Your browser may ask to allow multiple downloads.'
    );
}

// Settings
function invalidateOutputs() {
    resetResults();

    items.forEach(function (item) {
        clearOutput(item);

        item.status = 'Ready';
        item.error = '';
    });

    render();
}

quality.addEventListener('input', function () {
    qualityValue.textContent = quality.value + '%';
});

format.addEventListener('change', function () {
    const formatHints = {
        'image/webp':
            'Great balance of quality and file size for most images.',

        'image/jpeg':
            'Best for photos. Transparent areas become white.',

        'image/png':
            'Lossless output. File size may be larger; quality slider does not apply.'
    };

    formatHint.textContent = formatHints[format.value];

    invalidateOutputs();
});

[quality, maxWidth, preserveNames].forEach(function (control) {
    control.addEventListener('change', invalidateOutputs);
});

// Event listeners
themeToggle.addEventListener('click', function () {
    const isLight = document.documentElement.dataset.theme !== 'light';

    if (isLight) {
        document.documentElement.dataset.theme = 'light';
    } else {
        delete document.documentElement.dataset.theme;
    }

    themeToggle.setAttribute('aria-pressed', String(isLight));
    themeToggle.setAttribute(
        'aria-label',
        isLight ? 'Switch to dark mode' : 'Switch to light mode'
    );
});

fileInput.addEventListener('change', function (event) {
    addFiles(event.target.files);
});

dropzone.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        fileInput.click();
    }
});

['dragenter', 'dragover'].forEach(function (eventName) {
    dropzone.addEventListener(eventName, function (event) {
        event.preventDefault();
        dropzone.classList.add('dragging');
    });
});

['dragleave', 'drop'].forEach(function (eventName) {
    dropzone.addEventListener(eventName, function (event) {
        event.preventDefault();
        dropzone.classList.remove('dragging');
    });
});

dropzone.addEventListener('drop', function (event) {
    addFiles(event.dataTransfer.files);
});

fileList.addEventListener('click', function (event) {
    if (!(event.target instanceof Element)) {
        return;
    }

    const button = event.target.closest('.remove');

    if (button) {
        removeItem(Number(button.dataset.id));
    }
});

clearAll.addEventListener('click', function () {
    if (busy) {
        return;
    }

    items.forEach(cleanItem);

    items = [];

    resetResults();
    render();
});

compressBtn.addEventListener('click', compressAll);

downloadAll.addEventListener('click', downloadAllFiles);

// Release preview URLs when the page is closed.
window.addEventListener('beforeunload', function () {
    items.forEach(cleanItem);
    clearTimeout(toastTimer);
});

render();

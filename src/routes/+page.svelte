<script lang="ts">
    import { isConstantNode } from 'mathjs';
    import {
        MathParser,
        removeReplacements,
        applyReplacements,
        applyFunctionToNonSymbolNodes,
        searchEquationForSymbols,
    } from '$lib/MathParser.js';
    import { onMount, onDestroy, tick } from 'svelte';
    import History from './History.svelte';
    import sanitizeHtml from 'sanitize-html';
    import { SvelteToast, toast } from '@zerodevx/svelte-toast';
    import * as math from 'mathjs';
    import { parser, latexizeEquation } from '$lib';
    import { beforeUpdate, afterUpdate } from 'svelte';
    import chroma from 'chroma-js';
    import { appWindow } from '@tauri-apps/api/window';
    import { Store } from 'tauri-plugin-store-api';
    import {
        trace,
        debug,
        info,
        warn,
        error,
        attachConsole,
    } from 'tauri-plugin-log-api';
    import { history } from '$lib/History';
    import DOMPurify from 'isomorphic-dompurify';
    import { SettingsManager } from 'tauri-settings';

    type Schema = {
        desmosAPIKey: string;
    };

    let settingKeys = ['desmosAPIKey'];

    const settingsManager = new SettingsManager<Schema>(
        {
            // defaults
            desmosAPIKey: '',
        },
        {
            // options
            fileName: 'simplecalc-settings',
        },
    );

    let text = '';

    $: text = text.replaceAll('\n', '');

    let editMode = false;

    let historySelected = 0;

    let caretPosition = 0;

    let afterText = '';

    let selectionStart = 0;
    let selectionEnd = 0;

    let addOneToSelection = false;

    let undoHistory: string[] = [];

    let overlay: HTMLDivElement;

    beforeUpdate(() => {
        let activeElement = document.activeElement as HTMLTextAreaElement;
        if (
            activeElement &&
            activeElement.classList.contains('cell-textarea')
        ) {
            return;
        }
        selectionStart = activeElement?.selectionStart || 0;
        selectionEnd = activeElement?.selectionEnd || 0;
    });

    afterUpdate(() => {
        let activeElement = document.getElementById('math-input')!;
        if (
            activeElement &&
            activeElement.classList.contains('cell-textarea')
        ) {
            return;
        }
        if (addOneToSelection) {
            if (selectionStart === selectionEnd) {
                selectionStart++;
                selectionEnd++;
            } else {
                selectionEnd++;
            }
            addOneToSelection = false;
        }
        if (editMode) {
            if (selectionEnd === text.length) {
                selectionEnd += 1;
            }
            activeElement.setSelectionRange(selectionStart, selectionEnd);
            activeElement.focus();
        }
    });

    let calculationDialogVisible: boolean = false;
    let textBoxValue: string = '';
    let calculationInput: string = '';
    let dialogStyle: string = '';

    const openCalculationDialog = async (textBox: HTMLTextAreaElement) => {
        calculationDialogVisible = true;
        await tick(); // Ensure the DOM is updated before calculating positions

        // Use getCaretPosition here to determine the start position
        const caretPosition = getCaretPosition(textBox);
        if (!caretPosition) {
            console.error('Caret position is out of bounds or undefined');
            return;
        }

        const [start] = caretPosition; // Assuming we position the dialog based on the start for simplicity

        const { top, left } = textBox.getBoundingClientRect();
        // Placeholder logic to position based on the start position
        // This should be adapted based on actual requirements and element types
        const lineHeight = parseInt(getComputedStyle(textBox).lineHeight);
        const scrollTop = textBox.scrollTop;
        const scrollLeft = textBox.scrollLeft;
        const dialogTop = top - scrollTop + lineHeight; // Simplified positioning logic
        const dialogLeft = left - scrollLeft;

        dialogStyle = `top: ${dialogTop}px; left: ${dialogLeft}px;`;
    };

    function processAndReplaceSelection(
        processFunction: (text: string) => string,
    ) {
        const selection = window.getSelection()!;
        if (!selection.rangeCount) return false; // No selection was made

        // Check if the selection is inside a contentEditable element or textarea
        const activeElement = document.activeElement! as HTMLTextAreaElement;
        const isContentEditable = activeElement.contentEditable === 'true';
        const isTextarea =
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.tagName === 'INPUT';

        if (isContentEditable || isTextarea) {
            // For contentEditable elements and textareas
            if (isTextarea) {
                // Apply the provided function to the selected text
                const selectedText = activeElement.value.slice(
                    activeElement.selectionStart,
                    activeElement.selectionEnd,
                );
                const processedText = processFunction(selectedText);
                if (processedText === 'undefined') {
                    // toast.push('Invalid calculation', {
                    //     theme: {
                    //         '--toastBackground': '#DD0000D0',
                    //         '--toastColor': 'white',
                    //     },
                    // });
                    return false;
                }
                const startPos = activeElement.selectionStart;
                const endPos = activeElement.selectionEnd;
                activeElement.value =
                    activeElement.value.substring(0, startPos) +
                    processedText +
                    activeElement.value.substring(
                        endPos,
                        activeElement.value.length,
                    );
                text = activeElement.value;
                activeElement.setSelectionRange(
                    startPos,
                    startPos + processedText.length,
                );
            } else {
                const range = selection.getRangeAt(0);
                const selectedText = range.toString();
                const processedText = processFunction(selectedText);
                // Fallback for contentEditable elements
                range.deleteContents();
                range.insertNode(document.createTextNode(processedText));
            }
        } else {
            // Fallback for non-editable elements, if necessary
            console.error(
                'Selected text must be within a contentEditable element or textarea',
            );
        }

        return true;
    }

    let highlightedText = '';

    // https://stackoverflow.com/questions/6234773/can-i-escape-html-special-chars-in-javascript
    function escapeHtml(unsafe: string) {
        return unsafe
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function highlightBrackets(input: string) {
        const inputText = escapeHtml(input);

        const stack: { char: string; index: number; level: number }[] = [];
        const pairs: { [key: number]: number } = {};
        const levels: { [key: number]: number } = {}; // Track levels for both opening and closing brackets
        const unmatchedClosing: { [key: number]: boolean } = {}; // Track unmatched closing brackets
        const unmatchedOpening: { [key: number]: boolean } = {}; // NEW: Track unmatched opening brackets
        const openers = ['(', '[', '{', '«', '‹'];
        const closers = [')', ']', '}', '»', '›'];
        let currentLevel = 0; // Track the current nesting level

        // Identify matching brackets, their positions, nesting levels, unmatched closing, and opening brackets
        [...inputText].forEach((char, index) => {
            if (openers.includes(char)) {
                stack.push({ char, index, level: currentLevel });
                levels[index] = currentLevel++; // Assign the current level to the opening bracket
            } else if (closers.includes(char)) {
                if (
                    stack.length > 0 &&
                    openers.indexOf(stack[stack.length - 1].char) ===
                        closers.indexOf(char)
                ) {
                    const opener = stack.pop()!;
                    pairs[opener.index] = index;
                    levels[opener.index] = opener.level; // Record level for opening bracket
                    levels[index] = opener.level; // Assign the same level to the closing bracket
                    currentLevel--; // Decrement level after fibnding a match
                } else {
                    unmatchedClosing[index] = true; // Mark as unmatched closing bracket
                }
            }
        });

        // After processing all characters, mark any remaining opening brackets in the stack as unmatched
        while (stack.length > 0) {
            const opener = stack.pop()!;
            unmatchedOpening[opener.index] = true; // Mark as unmatched opening bracket
        }

        // Generate highlighted text with appropriate class assignments
        let out = [...inputText]
            .map((char, index) => {
                if (levels.hasOwnProperty(index)) {
                    // Check if the character is a bracket that needs highlighting
                    const baseClass = `highlight-${levels[index]}`;
                    let color = chroma('black').brighten(levels[index] + 3);
                    let colors = chroma
                        .scale(['#2A4858', '#fafa6e'])
                        .mode('lch')
                        .colors(6);
                    colors = chroma.scale('Spectral').padding(0.15).colors(6);
                    color = colors[levels[index]];
                    // Additional check for unmatched opening brackets to add extra class
                    if (unmatchedOpening.hasOwnProperty(index)) {
                        return `<span class="${baseClass} highlight-unmatched-open highlight">${char}</span>`;
                    }
                    return `<span class="${baseClass} highlight">${char}</span>`;
                } else if (unmatchedClosing.hasOwnProperty(index)) {
                    // Check if the character is an unmatched closing bracket
                    return `<span class="highlight-unmatched highlight">${char}</span>`; // Distinct class for unmatched closing brackets
                }
                return char;
            })
            .join('');

        return DOMPurify.sanitize(out);
    }

    $: highlightedText = highlightBrackets(text);

    function syncScroll(textarea, overlay) {
        overlay.scrollTop = textarea.scrollTop;
        overlay.scrollLeft = textarea.scrollLeft;
    }

    // function handleScroll(event: Event) {
    // let activeElement = document.activeElement;

    // if (activeElement && activeElement.classList.contains('cell-textarea')) {
    //     return;
    // }
    //     const target = event.target as HTMLElement;
    //     // Check if we're close to the top of the container
    //     if (target.scrollTop < 100) {
    //         loadMessages();
    //     }
    // }
    function handleKeyup(event: KeyboardEvent) {
        if (event.key === 'Alt') {
        }
    }

    function handleKeydown(event: KeyboardEvent) {
        let activeElement = document.activeElement;

        if (
            activeElement &&
            activeElement.classList.contains('cell-textarea')
        ) {
            return;
        }

        const pairs = {
            '(': ')',
            '[': ']',
            '{': '}',
            '"': '"',
            '`': '`',
            '«': '»',
            '‹': '›',
            '„': '“',
            '‘': '’',
        };

        // Ctrl+Z or Cmd+Z for undo
        if (
            (event.ctrlKey || event.metaKey) &&
            event.key.toLowerCase() === 'z'
        ) {
            console.log('undo', undoHistory);
            if (undoHistory.length > 0) {
                text = undoHistory.pop() || '';
                event.preventDefault();
            }
        }

        if (event.altKey && event.key === 'e') {
            toggleEditMode();
            return;
        }

        if (event.altKey && event.key === 'c') {
            event.preventDefault();
            if (editMode) {
                let selectionProcessed = processAndReplaceSelection((text) =>
                    parser
                        .simplifyNonSymbol(text)
                        // parser
                        //     .simplify(text)
                        .toString({ implicit: 'hide' })
                        .replaceAll(/\s/g, ''),
                );
                if (!selectionProcessed) {
                    return;
                    openCalculationDialog(
                        document.getElementById(
                            'math-input',
                        )! as HTMLTextAreaElement,
                    );
                }
            }
            return;
        }

        if (event.altKey && event.key === 'f') {
            text = parser.format(text);
        }

        if (event.altKey && event.key === 'u') {
            history.undo();
            history.switch = !history.switch;
            return;
        }

        if (event.altKey && event.key === 'd') {
            event.preventDefault();
            if (editMode) {
                let selectionProcessed = processAndReplaceSelection((text) =>
                    parser
                        .distribute(text)
                        .toString({ implicit: 'hide' })
                        .replaceAll(/\s/g, ''),
                );
                if (!selectionProcessed) {
                    text = parser
                        .distribute(text)
                        .toString({ implicit: 'hide' })
                        .replaceAll(/\s/g, '');
                }
            }
        }

        if (event.key === 'Enter') {
            text = text + afterText;
            afterText = '';

            text = applyReplacements(text);

            text = text.replaceAll(
                /(acos|acosh|acot|acoth|acsc|acsch|asec|asech|asin|asinh|atan|atan2|atanh|cos|cosh|cot|coth|csc|csch|sec|sech|sin|sinh|tan|tanh)([a-zA-Z])(?=[^a-zA-Z]|$)/g,
                '$1($2)',
            );

            historySelected = 0;
            let ditto = false;
            let trimmedText = text.trim();
            if (text.replaceAll(/\s+/g, '').toLowerCase() === 'clearall') {
                history.clearall();
                history.switch = !history.switch;
                text = '';
                return;
            } else if (trimmedText.toLowerCase() === 'undo') {
                history.undo();
                history.switch = !history.switch;
                text = '';
                return;
            } else if (trimmedText.toLowerCase() === 'redo') {
                history.redo();
                history.switch = !history.switch;
                text = '';
                return;
            } else if (trimmedText.toLowerCase().startsWith('set:')) {
                let assignment = trimmedText.split(':', 2)[1];
                let [setting, value] = assignment.split('=', 2);
                if (settingKeys.includes(setting.trim())) {
                    try {
                        settingsManager.initialize().then(async () => {
                            settingsManager.setCache(
                                setting.trim() as keyof Schema,
                                value.trim(),
                            );
                            await settingsManager.syncCache();
                        });

                        toast.push(`Setting ${setting} set to ${value}`, {
                            theme: {},
                        });

                        text = '';
                    } catch (e) {
                        toast.push((e as any).message, {
                            theme: {
                                '--toastBackground': '#DD0000D0',
                                '--toastColor': 'white',
                            },
                        });
                    }
                } else {
                    toast.push(`Setting ${setting} not found`, {
                        theme: {
                            '--toastBackground': '#DD0000D0',
                            '--toastColor': 'white',
                        },
                    });
                }
                return;
            } else if (trimmedText.toLowerCase().startsWith('del ')) {
                // Get the variable name to delete
                let variable = trimmedText.split(' ', 2)[1];

                // Remove the variable from the parser
                try {
                    delete parser.scope[variable];
                } catch (e) {
                    // toast.push(`${variable} doesn't exist`, {
                    //     theme: {
                    //         '--toastBackground': '#DD0000D0',
                    //         '--toastColor': 'white',
                    //     },
                    // });
                }

                history.add(trimmedText);
                history.switch = !history.switch;

                text = '';
                return;
            } else if (trimmedText.toLowerCase() === '"') {
                text = history.lastCalculationText[0];
                ditto = true;
            } else if (trimmedText[0] === '#') {
                history.add(trimmedText, '#table');
                history.switch = !history.switch;
                text = '';
                event.preventDefault();
                return;
            } else if (
                trimmedText.toLowerCase() === 'quot' ||
                trimmedText.toLowerCase() === 'prod'
            ) {
                history.add(trimmedText, '#formula');
                history.switch = !history.switch;
                text = '';
                event.preventDefault();
                return;
            } else if (trimmedText.startsWith('!')) {
                const newText = trimmedText.slice(1);
                // TODO: Should only simplify nodes containing no symbols
                // if (
                //     searchEquationForSymbols(parser.parse(newText))
                //         .length > 0
                // ) {
                //     toast.push(
                //         'Cannot simplify an expression containing variables.',
                //         {
                //             theme: {
                //                 '--toastBackground': '#DD0000D0',
                //                 '--toastColor': 'white',
                //             },
                //         },
                //     );
                //     event.preventDefault();
                //     return;
                // }
                console.log(parser.parse(newText));
                const result = applyFunctionToNonSymbolNodes(
                    parser.parse(newText),
                    (x) => parser.simplify(x),
                );
                history.add(
                    '!' + parser.convertString(newText),
                    result.toString().replaceAll(/\s/g, ''),
                );
                history.switch = !history.switch;
                text = '';
                event.preventDefault();
                return;
            }
            // Evaluate the text and add it to the history
            try {
                console.log('text', text);
                console.log(parser.evaluate(text));
                const result = resultToString(parser.evaluate(text));
                if (result === 'undefined' || result.trim() === '') {
                    return;
                }
                console.log('result', result);
                history.add(parser.convertString(text), result);
                history.switch = !history.switch;
                text = ditto ? '"' : '';
            } catch (e) {
                try {
                    const parsed = parser.parse(text);
                    const symbols = searchEquationForSymbols(parsed);
                    if (symbols.length === 0) {
                        throw e;
                    }

                    if (!/\bfunc\b/.test(text)) {
                        const result = parser.evaluate(
                            'func(' + symbols.join() + ')=' + text,
                        );
                    } else {
                        const result = parser.evaluate(
                            'func2Default(' + symbols.join() + ')=' + text,
                        );
                    }

                    parser.funcText = text;

                    // trace('result simplify 1', result.toString());
                    // const result2 = parser.simplify(text);
                    // trace('result simplify 2', result2);
                    // history = [[text, result2.toString()], ...history];
                    history.add(parser.convertString(text), '');
                    history.switch = !history.switch;
                    text = ditto ? '"' : '';
                } catch (e) {
                    try {
                        const parsed = text.split('=').map((t) => {
                            return parser.parse(t);
                        });

                        const symbols = parsed.map((p) => {
                            return searchEquationForSymbols(p);
                        });

                        console.log(parsed, symbols, text);

                        if (symbols.every((s) => s.length === 0)) {
                            throw e;
                        }

                        history.add(text, '');
                        history.switch = !history.switch;
                        text = ditto ? '"' : '';
                    } catch (e) {
                        text = removeReplacements(text);
                        console.log(e);
                        toast.push((e as any).message, {
                            theme: {
                                '--toastBackground': '#DD0000D0',
                                '--toastColor': 'white',
                            },
                        });
                    }
                }
            }
            event.preventDefault();
            return;
        }

        if (event.ctrlKey || event.metaKey) {
            return; // This exits the function early if a paste operation is detected
        }
        // Check for special cases like up arrow, 'Backspace' and 'Delete'
        if (event.key === 'ArrowUp') {
            console.log(
                'ArrowUp',
                historySelected,
                history.length - 1,
                historySelected === history.length - 1,
            );
            // Select the previous history item
            if (historySelected < history.length) {
                historySelected++;
                text = history.lastTextByIndex(historySelected)[0];
                text = removeReplacements(text);
            } else if (historySelected === history.length - 1) {
                text = history.lastTextByIndex(historySelected)[0];
                text = removeReplacements(text);
            }
            event.preventDefault();
        } else if (event.key === 'ArrowDown') {
            console.log(
                'ArrowDown',
                historySelected,
                history.length - 1,
                historySelected === history.length - 1,
            );
            // Select the next history item
            if (historySelected > 1) {
                historySelected--;
                text = history.lastTextByIndex(historySelected)[0];
                text = removeReplacements(text);
            } else if (historySelected === 1) {
                historySelected = 1;
                text = '';
            }
            event.preventDefault();
        } else {
            historySelected = 0;
        }

        if (editMode) {
            const key = event.key;
            const target = event.target as HTMLTextAreaElement;

            undoHistory.push(text);

            if (
                Object.keys(pairs).includes(key) ||
                Object.values(pairs).includes(key)
            ) {
                selectionStart = target.selectionStart;
                selectionEnd = target.selectionEnd;

                if (selectionEnd === text.length) {
                    addOneToSelection = true;
                    console.log('addOneToSelection');
                }

                const selectedText = text.substring(
                    selectionStart,
                    selectionEnd,
                );

                console.log(
                    'key',
                    key,
                    selectionStart,
                    selectionEnd,
                    selectedText,
                );

                if (
                    Object.keys(pairs).includes(key) &&
                    selectionStart !== selectionEnd
                ) {
                    // If text is selected and a starting character is pressed
                    event.preventDefault();
                    const beforeText = text.substring(0, selectionStart);
                    const afterText = text.substring(selectionEnd);
                    text =
                        beforeText +
                        key +
                        selectedText +
                        pairs[key] +
                        afterText;
                    selectionStart = selectionStart + 1; // Move start right after the opening character
                    selectionEnd = selectionEnd + 1; // Adjust end to account for the opening character
                    target.selectionStart = selectionStart;
                    target.selectionEnd = selectionEnd;
                } else if (
                    Object.values(pairs).includes(key) &&
                    selectionStart === selectionEnd &&
                    text.charAt(selectionStart) === key
                ) {
                    // If a closing character is pressed and it's immediately to the right, just move the cursor
                    event.preventDefault();
                    target.selectionStart = target.selectionEnd =
                        selectionStart + 1;
                    selectionStart = target.selectionStart;
                    selectionEnd = target.selectionEnd;
                } else if (
                    Object.values(pairs).includes(key) &&
                    selectionStart !== selectionEnd
                ) {
                    // If text is selected and a closing character is pressed
                    event.preventDefault();
                    target.selectionStart = target.selectionEnd =
                        selectionEnd + 1; // Move cursor after the inserted pair
                    selectionStart = target.selectionStart;
                    selectionEnd = target.selectionEnd;
                } else if (Object.keys(pairs).includes(key)) {
                    // If a starting character is pressed without selection
                    event.preventDefault();
                    const beforeText = text.substring(0, selectionStart);
                    const afterText = text.substring(selectionEnd);
                    selectionStart = target.selectionStart;
                    selectionEnd = target.selectionEnd;
                    text = beforeText + key + pairs[key] + afterText;

                    target.selectionStart = target.selectionEnd =
                        selectionStart + 1; // Move cursor after the inserted pair
                    selectionStart = target.selectionStart;
                    selectionEnd = target.selectionEnd;
                    target.setSelectionRange(selectionStart, selectionEnd);
                }
            } else if (key === 'Backspace' && selectionStart === selectionEnd) {
                let prevChar = text.charAt(selectionStart - 1);
                let nextChar = text.charAt(selectionStart);

                // If the text is a pair character, remove the pair character
                if (
                    Object.keys(pairs).includes(prevChar) &&
                    Object.values(pairs).includes(nextChar)
                ) {
                    // Remove the pair character
                    text =
                        text.slice(0, selectionStart - 1) +
                        text.slice(selectionStart + 1);
                    target.selectionStart = target.selectionEnd =
                        selectionStart - 1;
                    selectionStart = target.selectionStart;
                    selectionEnd = target.selectionEnd;

                    // Prevent the default back navigation in some browsers
                    event.preventDefault();
                }
            }
            return;
        }

        // Check for special cases like up arrow, 'Backspace' and 'Delete'
        if (event.key === 'Backspace') {
            // If the text is a pair character, remove the pair character
            if (Object.values(pairs).includes(text.slice(-1))) {
                afterText = text.slice(-1) + afterText;
                text = text.slice(0, -1);
                caretPosition--;
            } else if (Object.keys(pairs).includes(text.slice(-1))) {
                afterText = afterText.slice(1);
                text = text.slice(0, -1);
                caretPosition--;
            } else {
                // Remove the last character
                text = text.slice(0, -1);
                caretPosition--;
            }

            // Prevent the default back navigation in some browsers
            event.preventDefault();
        } else if (event.key === 'Delete') {
            // For 'Delete', you might want to handle it differently
            // Here's a simple way to demonstrate handling, but it might not make sense in this context
            // as the Delete key doesn't have a position to delete from in a text area value based on keydown events
            console.log('Delete key pressed');
        } else if (event.key === 'ArrowLeft') {
            return;
            // Move the caret position to the left
            caretPosition = Math.max(0, caretPosition - 1);
            // Prevent the default action
            event.preventDefault();
        } else if (event.key === 'ArrowRight') {
            return;
            // Move the caret position to the right
            caretPosition = Math.min(text.length, caretPosition + 1);
            // Prevent the default action
            event.preventDefault();
        } else if (event.key.length === 1) {
            if (
                Object.values(pairs).includes(event.key) &&
                afterText[0] === event.key
            ) {
                afterText = afterText.slice(1);
                text += event.key;
                caretPosition++;
            } else if (Object.keys(pairs).includes(event.key)) {
                text += event.key;
                afterText = pairs[event.key] + afterText;
                caretPosition++;
            } else {
                text += event.key;
                // text =
                //     text.slice(0, caretPosition) +
                //     event.key +
                //     text.slice(caretPosition);
                caretPosition++;
            }
            // Append the typed character to the existing text
            // Prevent the default action
            event.preventDefault();
        }
    }

    function handlePaste(event: ClipboardEvent) {
        let activeElement = document.activeElement;

        if (
            activeElement &&
            activeElement.classList.contains('cell-textarea')
        ) {
            return;
        } else if (editMode) {
            return;
        }

        // Prevent the default paste action
        event.preventDefault();

        // Extract text from the clipboard data
        const pasteText = event.clipboardData!.getData('text').trim();

        // Append the pasted text to the existing text
        text += pasteText;

        caretPosition += pasteText.length;

        console.log('after paste', text);
    }

    function handleCopy(event: ClipboardEvent) {
        let activeElement = document.activeElement;

        if (
            activeElement &&
            activeElement.classList.contains('cell-textarea')
        ) {
            return;
        } else if (editMode) {
            return;
        }
        // Prevent the default copy action
        event.preventDefault();

        // Copy the text to the clipboard
        event.clipboardData!.setData('text/plain', text);
    }

    onMount(async () => {
        await appWindow.setDecorations(true);

        await history.init();
        history.switch = !history.switch;

        const detach = await attachConsole();

        window.addEventListener('paste', handlePaste);
        window.addEventListener('copy', handleCopy);
        window.addEventListener('keydown', handleKeydown);
        window.addEventListener('keyup', handleKeyup);

        const stylesheet = document.getElementById(
            'katexCSS',
        ) as HTMLLinkElement | null;

        if (stylesheet) {
            // Attempt to load stylesheet from CDN
            stylesheet.onerror = () => {
                // On error, switch to the local copy of the CSS
                stylesheet.href = '/katex.min.css';
                stylesheet.integrity = '';
                console.log('Switched to local copy of KaTeX CSS');
            };
        }

        const textarea = document.getElementById('math-input');

        if (textarea) {
            textarea.addEventListener('scroll', () => {
                syncScroll(textarea, overlay);
            });
        }

        parser.addFuncsToScope();
    });

    onDestroy(() => {
        window.removeEventListener('keydown', handleKeydown);
        window.removeEventListener('paste', handlePaste);
        window.removeEventListener('copy', handleCopy);
    });

    function toggleEditMode() {
        editMode = !editMode;
        selectionStart = text.length;
        selectionEnd = text.length;
        text = text + afterText;
        afterText = '';
    }

    function parseToHtml(text: string) {
        let parsed = parser.parse(text + afterText);
        let options = { parenthesis: 'keep', implicit: 'hide' };
        let html = sanitizeHtml(parsed.toHTML(options), {
            allowedTags: ['span', 'sub', 'sup', 'div', 'br'],
            allowedAttributes: {
                span: ['class'],
            },
        });
        console.log(html);
        return html;
    }

    function htmlize(input: string, first: boolean = true): string {
        if (input.trim() === '') {
            return first ? '&nbsp;' : '';
        } else if (input.trim()[0] === '#') {
            return input;
        }

        // Place U+E000 at cursor position
        // let text =
        //     input.slice(0, caretPosition) +
        //     '\uE000' +
        //     input.slice(caretPosition);
        let text = input.trim();

        let out = '';

        try {
            let html = parseToHtml(text);
            try {
                let prevHtml = htmlize(text.slice(0, -1), false);

                if (html === prevHtml) {
                    out = prevHtml + text.slice(-1);
                } else {
                    out = html;
                }
            } catch {
                out = html;
            }
        } catch (e) {
            try {
                let html = parseToHtml(text + 'placeholderCharacter');
                out = html.replaceAll('placeholderCharacter', '');
                out = out.replaceAll('<span class="math-symbol"></span>', '');
            } catch {
                out =
                    htmlize(text.slice(0, -1), false) +
                    // `<span class="math-error">${text.slice(-1)}</span>`
                    `${text.slice(-1)}`;
            }
        }

        // Remove U+E000 from the output and add a cursor
        out = out.replaceAll('\uE000', '');
        return out;
    }

    function resultToString(result: any) {
        try {
            if ('set_value' in result) {
                return `{"set_value":${result.set_value}}`;
            } else {
                return result.toString();
            }
        } catch (e) {
            return result.toString();
        }
    }

    let options = {
        duration: 1000,
        position: 'bottom-right' as const,
    };
</script>

<div class="background"></div>
<div class="container">
    <History history={history.latexHistory} />

    {#if editMode}
        <div class="textarea-container">
            <textarea id="math-input" bind:value={text}></textarea>
            <div
                class="overlay"
                contenteditable
                bind:innerHTML={highlightedText}
                bind:this={overlay}
            ></div>
        </div>
    {:else}
        <span class="math-input"
            >{@html text
                .split('=')
                .map((x) => {
                    let html = htmlize(x);
                    // console.log(html);
                    return html;
                })
                .join(' = ')}</span
        >
    {/if}
    <button on:click={toggleEditMode}>{editMode ? 'type' : 'edit'}</button>
</div>

<svelte:head>
    <style>
        @import url('https://fonts.googleapis.com/css?family=Inter');
    </style>
    <link
        rel="stylesheet"
        id="katexCSS"
        href="https://cdn.jsdeli2vr.net/npm/katex@0.12.0/dist/katex.min.css"
        integrity="sha384-AfEj0r4/OFrOo5t7NnNe46zW/tFgW6x/bCJG8FqQCEo3+Aro6EYUG4+cU+KJWu/X"
        crossorigin="anonymous"
    />
</svelte:head>

<div class="toast">
    <SvelteToast {options} />
</div>

<style>
    :global(html) {
        background: transparent;
    }

    .background {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(255, 255, 255, 0);
        filter: brightness(1000%);
    }

    :global(body) {
        font-family: 'Inter', sans-serif;
        margin: 0;
        overflow: hidden;
        background: transparent;
    }

    .textarea-container {
        position: relative;
        height: 3.5em;
        bottom: 0;
        background-color: rgba(255, 255, 255, 0);
    }

    .textarea-container:before {
        pointer-events: none;
        background-image: url('floral-pattern.svg');
        transform: scale(0.7) rotate(45deg);
        z-index: 9;
        content: ' ';
        display: block;
        position: absolute;
        top: -360px;
        left: -30px;
        width: 800px;
        height: 800px;
        opacity: 0.04;
    }

    textarea,
    .overlay {
        position: relative;
        font-family: 'Inter', sans-serif;
        font-size: 1.5em;
        font-weight: 100;
        padding: 0.66666666em;
        width: calc(100vw);
        height: auto;
        min-height: 1em;
        /* color: white; */
        /* background-color: #2e2e2e; */
        /* background-color: #eaeaea; */
        overflow: hidden;
        background-color: rgba(255, 255, 255, 0);
        --stroke-color: rgb(155, 155, 155);
        text-shadow: 1px 1px 3px #0004;
        font-feature-settings: 'calt' 1;
        font-variant-alternates: normal;
        /* text-shadow:
            -1px -1px 0 var(--stroke-color),
            0 -1px 0 var(--stroke-color),
            1px -1px 0 var(--stroke-color),
            1px 0 0 var(--stroke-color),
            1px 1px 0 var(--stroke-color),
            0 1px 0 var(--stroke-color),
            -1px 1px 0 var(--stroke-color),
            -1px 0 0 var(--stroke-color); */
    }

    textarea {
        /* opacity: 0.7; */
        border: 0 none;
        outline: none;
        resize: none;
        color: rgba(255, 255, 255);
    }

    .overlay {
        position: absolute;
        pointer-events: none;
        left: 0;
        top: 0;
        z-index: 11;
        background-color: transparent;
        mix-blend-mode: multiply;
        font-feature-settings: 'calt' 1;
        color: rgba(255, 255, 255, 0);
    }

    .container {
        display: flex;
        flex-direction: column;
        height: 100vh;
        justify-content: flex-end;
    }

    .toast {
        font-family: 'Inter', sans-serif;
    }

    .math-input {
        font-family: 'Inter', sans-serif;
        font-size: 1.5rem;
        font-weight: 600;
        padding: 1rem;
        /* color: white; */
        /* background-color: #2e2e2e; */
        background-color: rgba(235, 235, 235, 0);
        color: white;
        height: 1em;
    }

    :global(.highlight-0) {
        --highlight-color: rgb(186, 186, 186);
        color: var(--highlight-color); /* Highlight color */
        -webkit-text-stroke: var(--highlight-color) var(--highlight-outline-px);
    }

    :global(.highlight-1) {
        --highlight-color: rgb(147, 147, 243);
        color: var(--highlight-color); /* Highlight color */
        -webkit-text-stroke: var(--highlight-color) var(--highlight-outline-px);
    }

    :global(.highlight-2) {
        --highlight-color: rgb(93, 183, 207);
        color: var(--highlight-color); /* Highlight color */
        -webkit-text-stroke: var(--highlight-color) var(--highlight-outline-px);
    }

    :global(.highlight-3) {
        --highlight-color: rgb(84, 233, 114);
        color: var(--highlight-color); /* Highlight color */
        -webkit-text-stroke: var(--highlight-color) var(--highlight-outline-px);
    }

    :global(.highlight-4) {
        --highlight-color: rgb(179, 244, 80);
        color: var(--highlight-color); /* Highlight color */
        -webkit-text-stroke: var(--highlight-color) var(--highlight-outline-px);
    }

    :global(.highlight-5) {
        --highlight-color: rgb(229, 232, 65);
        color: var(--highlight-color); /* Highlight color */
        -webkit-text-stroke: var(--highlight-color) var(--highlight-outline-px);
    }

    :global(.highlight-unmatched) {
        --highlight-color: red;
        color: var(--highlight-color); /* Highlight color */
        -webkit-text-stroke: var(--highlight-color) var(--highlight-outline-px);
        background-color: rgba(255, 0, 0, 0.2);
    }

    :global(.highlight-unmatched-open) {
        background-color: rgba(255, 0, 0, 0.2);
    }

    :global(.highlight) {
        --highlight-outline-px: 1.3px;
    }

    button {
        font-family: 'Inter', sans-serif;
        color: white;
        background-color: rgba(12, 12, 12, 0.314);
        border: none;
        cursor: pointer;
        position: relative;
    }

    /* style the HTML output */
    :global(.math-function) {
        color: rgb(181, 106, 224);
    }

    :global(.math-number) {
    }

    :global(.math-symbol) {
        /* color: rgb(77, 77, 77); */
        /* font-family: 'Times New Roman', Times, serif; */
        font-style: italic;
        padding-left: 0em;
        padding-right: 0.11em;
    }

    :global(.math-parameter) {
        font-style: normal;
        padding-left: 0;
        padding-right: 0;
    }

    :global(.math-boolean) {
        /* color: rgb(0, 0, 187); */
        color: rgb(132, 132, 174);
        font-style: italic;
    }

    :global(.math-string) {
        /* color: rgb(152, 89, 33); */
        color: rgb(198, 145, 98);
    }

    :global(.math-error) {
        color: rgb(185, 16, 16);
    }

    /* :global(.math-string::before),
    :global(.math-string::after) {
        content: '"';
    } */

    :global(.math-null-symbol),
    :global(.math-nan-symbol),
    :global(.math-infinity-symbol),
    :global(.math-imaginary-symbol) {
        color: rgb(134, 134, 134);
        font-style: normal;
    }

    :global(.math-property) {
        font-style: italic;
    }

    :global(.math-range-operator) {
        padding-left: 0.2em;
        padding-right: 0.2em;
    }

    :global(.math-conditional-operator) {
        color: rgb(140, 140, 140);
    }

    :global(.math-conditional-operator::before),
    :global(.math-conditional-operator::after) {
        content: ' ';
    }

    :global(.math-assignment-operator::before),
    :global(.math-assignment-operator::after) {
        content: ' ';
    }

    :global(.math-explicit-binary-operator::before),
    :global(.math-explicit-binary-operator::after) {
        content: ' ';
    }

    :global(.math-separator::after) {
        content: ' ';
    }
</style>

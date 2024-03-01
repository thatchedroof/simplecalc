<script lang="ts">
    import { MathParser, latexizeEquation } from '$lib/MathParser.js';
    import { onMount, onDestroy } from 'svelte';
    import History from './History.svelte';
    import sanitizeHtml from 'sanitize-html';
    import { SvelteToast, toast } from '@zerodevx/svelte-toast';
    import * as math from 'mathjs';
    import { parser } from '$lib';
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

    let text = '';

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
        if (activeElement && activeElement.id.includes('cell-textarea')) {
            return;
        }
        selectionStart = activeElement?.selectionStart || 0;
        selectionEnd = activeElement?.selectionEnd || 0;
    });

    afterUpdate(() => {
        let activeElement = document.getElementById('math-input')!;
        if (activeElement && activeElement.id.includes('cell-textarea')) {
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

    let highlightedText = '';

    function highlightBrackets(inputText: string) {
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
                        return `<span class="${baseClass} highlight-unmatched-open">${char}</span>`;
                    }
                    return `<span class="${baseClass}">${char}</span>`;
                } else if (unmatchedClosing.hasOwnProperty(index)) {
                    // Check if the character is an unmatched closing bracket
                    return `<span class="highlight-unmatched">${char}</span>`; // Distinct class for unmatched closing brackets
                }
                return char;
            })
            .join('');

        return out;
    }

    $: highlightedText = highlightBrackets(text);

    function syncScroll(textarea, overlay) {
        overlay.scrollTop = textarea.scrollTop;
        overlay.scrollLeft = textarea.scrollLeft;
    }

    // function handleScroll(event: Event) {
    //     const target = event.target as HTMLElement;
    //     // Check if we're close to the top of the container
    //     if (target.scrollTop < 100) {
    //         loadMessages();
    //     }
    // }

    function handleKeydown(event: KeyboardEvent) {
        let activeElement = document.activeElement;

        if (activeElement && activeElement.id.includes('cell-textarea')) {
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

        if (event.key === 'Enter') {
            text = text + afterText;
            afterText = '';

            text = text.replace(
                /([\u00C0-\u02AF\u0370-\u03FF\u2100-\u214F\u{1D400}-\u{1D7FF}a-zA-Z_$])'+/gu,
                function (match, p1) {
                    return p1 + '_prime'.repeat(match.length - 1);
                },
            );

            historySelected = 0;
            let ditto = false;
            if (text.replaceAll(/\s+/g, '').toLowerCase() === 'clearall') {
                history.clearall();
                history.switch = !history.switch;
                text = '';
                return;
            } else if (text.trim().toLowerCase() === 'undo') {
                history.undo();
                history.switch = !history.switch;
                text = '';
                return;
            } else if (text.trim().toLowerCase() === 'redo') {
                history.redo();
                history.switch = !history.switch;
                text = '';
                return;
            } else if (text.trim().toLowerCase().startsWith('del ')) {
                // Get the variable name to delete
                let variable = text.trim().split(' ', 2)[1];

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

                history.add(text.trim());
                history.switch = !history.switch;

                text = '';
                return;
            } else if (text.trim().toLowerCase() === '"') {
                text = history.lastCalculationText[0];
                ditto = true;
            } else if (text.trim()[0] === '#') {
                history.add(text.trim(), '#table');
                history.switch = !history.switch;
                text = '';
                event.preventDefault();
                return;
            }
            // Evaluate the text and add it to the history
            try {
                const result = parser.evaluate(text).toString();
                if (result === 'undefined' || result.trim() === '') {
                    return;
                }
                history.add(text, result);
                history.switch = !history.switch;
                text = ditto ? '"' : '';
            } catch (e) {
                try {
                    const parsed = parser.math.parse(text);
                    const symbols = searchEquationForSymbols(parsed);
                    if (symbols.length === 0) {
                        throw e;
                    }
                    const result = parser.evaluate(
                        'func(' + symbols.join() + ')=' + text,
                    );

                    // trace('result simplify 1', result.toString());
                    // const result2 = parser.simplify(text);
                    // trace('result simplify 2', result2);
                    // history = [[text, result2.toString()], ...history];
                    history.add(text, '');
                    history.switch = !history.switch;
                    text = ditto ? '"' : '';
                } catch (e) {
                    try {
                        const parsed = text.split('=').map((t) => {
                            return parser.math.parse(t);
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
                text = text.replace(/_prime/g, "'");
            } else if (historySelected === history.length - 1) {
                text = history.lastTextByIndex(historySelected)[0];
                text = text.replace(/_prime/g, "'");
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
                text = text.replace(/_prime/g, "'");
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
        if (editMode) {
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
        if (editMode) {
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

        const detach = await attachConsole();

        window.addEventListener('paste', handlePaste);
        window.addEventListener('copy', handleCopy);
        window.addEventListener('keydown', handleKeydown);

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

    function searchEquationForSymbols(
        equation: math.MathNode | math.MathNode[],
    ) {
        let symbols: string[] = [];
        if (Array.isArray(equation)) {
            equation.forEach((node) => {
                symbols = symbols.concat(searchEquationForSymbols(node));
            });
        } else {
            if (equation.isSymbolNode) {
                symbols.push(equation.name);
            }
            equation.forEach((node, path, parent) => {
                if (!path.includes('fn')) {
                    symbols = symbols.concat(searchEquationForSymbols(node));
                }
            });
        }
        return [...new Set(symbols)];
    }

    function parseToHtml(text: string) {
        let parsed = parser.math.parse(text + afterText);
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

    let options = {
        duration: 1000,
        position: 'bottom-right' as const,
    };
</script>

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

    :global(body) {
        font-family: 'Inter', sans-serif;
        margin: 0;
        overflow: hidden;
        background: transparent;
    }

    .textarea-container {
        position: relative;
        background-color: transparent;
    }

    textarea,
    .overlay {
        font-family: 'Inter', sans-serif;
        font-size: 1.5rem;
        padding: 1rem;
        width: calc(100vw);
        height: 1em;
        /* color: white; */
        /* background-color: #2e2e2e; */
        /* background-color: #eaeaea; */
        overflow: hidden;
        background-color: rgba(235, 235, 235, 0.071);
        color: black;
    }

    textarea {
        /* opacity: 0.7; */
        z-index: 2;
        border: none;
        resize: none;
    }

    .overlay {
        pointer-events: none;
        position: absolute;
        top: 0;
        left: 0;
        z-index: 1;
        color: transparent;
        mix-blend-mode: hard-light;
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
    }

    :global(.highlight-0) {
        color: white; /* Highlight color */
    }

    :global(.highlight-1) {
        color: blue; /* Highlight color */
    }

    :global(.highlight-2) {
        color: green; /* Highlight color */
    }

    :global(.highlight-3) {
        color: orange; /* Highlight color */
    }

    :global(.highlight-4) {
        color: rgb(218, 0, 218); /* Highlight color */
    }

    :global(.highlight-5) {
        color: brown; /* Highlight color */
    }

    :global(.highlight-unmatched) {
        color: red; /* Highlight color */
        background-color: rgba(255, 0, 0, 0.2);
    }

    :global(.highlight-unmatched-open) {
        background-color: rgba(255, 0, 0, 0.2);
    }

    button {
        font-family: 'Inter', sans-serif;
        color: white;
        background-color: #232323;
        border: none;
        cursor: pointer;
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

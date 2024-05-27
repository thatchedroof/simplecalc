<script lang="ts">
    import { parser } from '$lib';
    import { latexizeEquation } from '$lib';
    import { text } from '@sveltejs/kit';
    import { math, display } from 'mathlifier';
    import { history } from '$lib/History.js';

    export let i = 0;
    export let j = 0;
    export let table: string[][] = [];
    export let rowHeaders: string[] = [];
    export let colHeaders: string[] = [];
    export let header: null | 'row' | 'col' = null;
    export let selected: [number, number] = [-1, -1];

    let selectedValue = '';
    $: (selectedValue =
        header === 'row'
            ? rowHeaders[i]
            : header === 'col'
              ? colHeaders[j]
              : table[i][j]),
        console.log('selectedValue', selectedValue);

    let waitingForSelection = false;

    const onCellClick = (cell: HTMLElement) => {
        console.log('click', cell, i, j, selected, waitingForSelection);
        if (waitingForSelection) {
            cell.focus();
            console.log(table);
            if (header === 'row') {
                cell.textContent = rowHeaders[i];
            } else if (header === 'col') {
                cell.textContent = colHeaders[j];
            } else {
                cell.textContent = table[i][j];
            }
            if (cell.textContent.trim() === '') {
                // Don't add a range, just focus the cell
                cell.textContent = ' ';
                selectedValue = ' ';
                cell.focus();
                console.log('empty');
            }
            const range = document.createRange();
            const selection = window.getSelection();
            range.selectNodeContents(cell);
            selection.removeAllRanges();
            selection.addRange(range);

            waitingForSelection = false;
            return;
        }
    };
</script>

{#if selectedValue == null || (selected[0] === i && selected[1] === j)}
    <div
        id="cell-{i}-{j}"
        class="cell {header ? header + '-header' : 'table-cell'} selected"
        style="grid-column: {j + 2}; grid-row: {i + 2}"
    >
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div
            use:onCellClick
            contenteditable
            id="cell-textarea-{i}-{j}"
            class="cell-textarea"
            on:focus={(e) => {
                selected = [i, j];
                console.log('selected', selected);
                if (selectedValue.trim() === '') {
                    selectedValue = ' ';
                    e.target.textContent = ' ';
                    waitingForSelection = true;
                }
            }}
            on:input={(e) => {
                console.log('select', i, j);
                if (header === 'row') {
                    rowHeaders[i] = e.target.textContent;
                } else if (header === 'col') {
                    colHeaders[j] = e.target.textContent;
                } else {
                    table[i][j] = e.target.textContent;
                }
            }}
            on:blur={() => {
                selected = [-1, -1];
                history.update();
            }}
            on:keypress={(e) => {
                console.log(e.key);
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.target.blur();
                }
            }}
            on:keydown={(e) => {
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    console.log(
                        'left',
                        document.getElementById(`cell-textarea-${i}-${j - 1}`),
                    );
                    if (j >= 0 && (i !== -1 || j !== 0)) {
                        // e.target.blur();
                        selected = [i, j - 1];
                        waitingForSelection = true;
                        e.target.blur();
                        document
                            .getElementById(`cell-textarea-${i}-${j - 1}`)
                            .click();
                    }
                } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    console.log(
                        'right',
                        document.getElementById(`cell-textarea-${i}-${j + 1}`),
                    );
                    if (j < colHeaders.length - 1) {
                        // e.target.blur();
                        selected = [i, j + 1];
                        waitingForSelection = true;
                        e.target.blur();
                        document
                            .getElementById(`cell-textarea-${i}-${j + 1}`)
                            .click();
                    }
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    console.log(
                        'up',
                        document.getElementById(`cell-textarea-${i - 1}-${j}`),
                    );
                    if (i >= 0 && (i !== 0 || j !== -1)) {
                        // e.target.blur();
                        selected = [i - 1, j];
                        waitingForSelection = true;
                        e.target.blur();
                        document
                            .getElementById(`cell-textarea-${i - 1}-${j}`)
                            .click();
                    }
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    console.log(
                        'down',
                        document.getElementById(`cell-textarea-${i + 1}-${j}`),
                    );
                    if (i < rowHeaders.length - 1) {
                        // e.target.blur();
                        selected = [i + 1, j];
                        waitingForSelection = true;
                        e.target.blur();
                        document
                            .getElementById(`cell-textarea-${i + 1}-${j}`)
                            .click();
                    }
                }
            }}
        />
    </div>
{:else if selectedValue != null}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
        id="cell-textarea-{i}-{j}"
        class="cell {header ? header + '-header' : 'table-cell'}"
        style="grid-column: {j + 2}; grid-row: {i + 2};"
        on:click={() => {
            selected = [i, j];
            waitingForSelection = true;
            console.log('selected', selected);
        }}
    >
        {@html display(
            latexizeEquation(
                header === 'row'
                    ? rowHeaders[i]
                    : header === 'col'
                      ? colHeaders[j]
                      : table[i][j],
                parser,
                true,
            ),
            {
                overflowAuto: false,
                output: 'html',
            },
        )}
    </div>
{/if}

<style>
    :global(.cell > .katex-display) {
        margin: 0 !important;
    }

    .cell {
        display: flex;
        align-items: center;
        justify-content: center;
        border-right: 1px solid rgb(179, 179, 179);
        border-bottom: 1px solid rgb(179, 179, 179);
        min-width: 2em;
        min-height: 32px;
        padding: 0.5em;
        resize: both;
        transition:
            border-color 0.1s,
            background-color 0.1s;

        &:hover {
            cursor: pointer;
            /* border-color: rgb(77, 77, 77); /* Only change the color on hover */
            background-color: rgba(210, 210, 210, 0.769);
        }
    }

    .selected {
        background-color: rgba(210, 210, 210, 0.769);
    }

    div[contenteditable] {
        border: none;
        resize: none;
        font-family: 'Inter', sans-serif;
        font-size: 15px;
        font-weight: 400;
        overflow: hidden;

        &:focus {
            outline: none;
        }
    }
</style>

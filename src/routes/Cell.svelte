<script lang="ts">
    import { parser } from '$lib';
    import { latexizeEquation } from '$lib/MathParser.js';
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
    $: selectedValue =
        header === 'row'
            ? rowHeaders[i]
            : header === 'col'
              ? colHeaders[j]
              : table[i][j];

    let waitingForSelection = false;

    const onCellClick = (cell: HTMLElement) => {
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

{#if selectedValue == null || selectedValue.trim() === '' || (selected[0] === i && selected[1] === j)}
    <div
        id="cell-{i}-{j}"
        class="cell {header ? header + '-header' : 'table-cell'}"
        style="grid-column: {j + 2}; grid-row: {i + 2}"
    >
        <div
            use:onCellClick
            contenteditable
            id="cell-textarea-{i}-{j}"
            on:focus={() => {
                selected = [i, j];
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
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.target.blur();
                }
            }}
        />
    </div>
{:else if selectedValue != null && selectedValue.trim() !== ''}
    <div
        id="cell-textarea-{i}-{j}"
        class="cell {header ? header + '-header' : 'table-cell'}"
        style="grid-column: {j + 2}; grid-row: {i + 2};"
        on:click={() => {
            selected = [i, j];
            waitingForSelection = true;
            console.log(selected);
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

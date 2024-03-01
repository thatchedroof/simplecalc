<script lang="ts">
    import Cell from './Cell.svelte';
    export let rows: number;
    export let cols: number;

    export let table = Array.from({ length: rows }, () => Array(cols).fill(''));
    export let rowHeaders: string[] = Array(rows).fill('');
    export let colHeaders: string[] = Array(cols).fill('');

    let selected: [number, number] = [-1, -1];

    $: console.log('table', table);

    // () =>
    //     (table = [
    //         table.slice(0, i),
    //         [
    //             ...table[i].slice(0, j),
    //             table[i][j],
    //             ...table[i].slice(j + 1),
    //         ],
    //         ...table.slice(i + 1),
    //     ])
</script>

<div class="container">
    <div
        class="table-class"
        style="grid-template-columns: auto repeat({cols}, 1fr); grid-template-rows: auto repeat({rows}, 1fr)"
    >
        <div class="top-cell" style="grid-column: 1; grid-row: 1" />
        {#each colHeaders as header, i}
            <Cell
                i={-1}
                j={i}
                {table}
                {rowHeaders}
                {colHeaders}
                {selected}
                header="col"
            />
        {/each}

        {#each table as row, i}
            <Cell
                {i}
                j={-1}
                {table}
                {rowHeaders}
                {colHeaders}
                {selected}
                header="row"
            />
            {#each row as cell, j}
                <Cell {i} {j} {table} {rowHeaders} {colHeaders} {selected} />
            {/each}
        {/each}
    </div>
</div>
<div class="border"></div>

<style>
    .container {
        display: flex;
        justify-content: center;
        align-items: center;
        width: calc(600px - 2em);
        max-width: calc(100vw - 2em);
        margin: 2.5em;
    }

    .border {
        display: block;
        width: calc(min(600px - 2em, 100vw - 2em));
        border-bottom: 1px solid rgb(179, 179, 179);
    }

    .table-class {
        display: grid;
        grid-auto-flow: dense;
    }

    .top-cell {
        border-right: 1px solid rgb(179, 179, 179);
        border-bottom: 1px solid rgb(179, 179, 179);
    }
</style>

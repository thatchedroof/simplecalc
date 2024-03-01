<script lang="ts">
    import { equation } from 'mathlifier';
    import Calculation from './Calculation.svelte';
    import Table from './Table.svelte';

    export let history: (
        | [
              {
                  latex: string;
                  plain: string;
              },
              {
                  latex: string;
                  plain: string;
              },
          ]
        | {
              dims: [number, number];
              rowHeaders: string[];
              colHeaders: string[];
              table: string[][];
          }
    )[];
</script>

<div class="history">
    {#each history.toReversed() as line}
        {#if 'length' in line}
            <Calculation equation={line[0]} result={line[1]} />
        {:else if 'table' in line}
            <Table
                rows={line.dims[0]}
                cols={line.dims[1]}
                table={line.table}
                rowHeaders={line.rowHeaders}
                colHeaders={line.colHeaders}
            />
        {/if}
    {/each}
    <!-- <div class="top"></div> -->
</div>

<style>
    .history {
        display: flex;
        flex-direction: column-reverse;
        align-items: center;
        height: 100%;
        width: 100%;
        overflow-y: auto;
        overflow-x: hidden;
        background-color: rgba(255, 255, 255, 0.7);
        scrollbar-width: none; /* For Firefox */
        -ms-overflow-style: none; /* For Internet Explorer and Edge */
    }

    .history::-webkit-scrollbar {
        display: none; /* For Chrome, Safari, and Opera */
    }

    .top {
        margin-left: 1em;
        margin-right: 1em;
        width: calc(600px - 2em);
        border-bottom: 1px solid rgb(179, 179, 179);
        padding-bottom: 0.5em;
    }
</style>

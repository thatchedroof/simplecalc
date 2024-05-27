<script lang="ts">
    import { math, display } from 'mathlifier';
    import CopyableEquation from './CopyableEquation.svelte';

    export let equation: {
        latex: string;
        plain: string;
    };
    export let result: {
        latex: string;
        plain: string;
    };
</script>

<div class="container">
    <div class="calculation">
        <div class="equation">
            {#if equation.latex !== ''}
                <CopyableEquation {equation} />
            {/if}
        </div>
        <div class="separator"></div>
        <div class="result">
            {#if result.latex !== ''}
                <CopyableEquation equation={result} />
            {/if}
        </div>
    </div>
</div>
<div class="border"></div>

<style>
    .container {
        display: flex;
        justify-content: center;
        align-items: center;
        /* width: 100%; */
        width: calc(600px - 2em);
        max-width: calc(100vw - 2em);
    }

    .calculation {
        display: flex;
        justify-content: space-between;
        box-sizing: border-box;
        width: 100%;
        /* min-width: calc(600px - 2em); */
        /* border-bottom: 1px solid rgb(179, 179, 179); */
        overflow: visible;
        height: fit-content;
        margin-left: 1em;
        margin-right: 1em;
        margin-top: 1em;
        margin-bottom: 1em;
        border-radius: 10px;
    }

    .border {
        display: block;
        width: calc(min(600px - 2em, 100vw - 2em));
        border-bottom: 1px solid rgb(179, 179, 179);
    }

    .separator {
        width: 100%;
        flex-basis: calc(450px - 2em);
        flex-shrink: 100;
    }

    .equation {
        display: flex;
        justify-content: flex-start;
        flex-direction: column;
        height: 100%;
        width: fit-content;
    }

    .result {
        display: flex;
        justify-content: flex-end;
        flex-direction: column;
        width: fit-content;
        margin-top: 2em;
    }
</style>

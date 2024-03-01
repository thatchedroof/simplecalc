<script lang="ts">
    import { toast } from '@zerodevx/svelte-toast';
    import { math, display } from 'mathlifier';

    export let equation: {
        latex: string;
        plain: string;
    };
    export let result: {
        latex: string;
        plain: string;
    };

    console.log(equation, result);

    let options = {
        output: 'html' as const,
        // output: 'mathml' as const,
        fleqn: false,
        throwOnError: false,
        displayMode: true,
    };

    $: console.log(equation.latex);

    function setClipboard(input: string) {
        let text = input.replace(/_prime/g, "'");

        toast.push(`Copied ${text}!`, {
            theme: {},
        });

        var type = 'text/plain';
        var blob = new Blob([text], { type });
        var data = [new ClipboardItem({ [type]: blob })];

        navigator.clipboard.write(data).then(
            function () {
                /* success */
                console.log('copied svg to clipboard');
            },
            function () {
                /* failure */
            },
        );
    }
</script>

<div class="container">
    <div class="calculation">
        {#if equation.latex !== ''}
            <div
                class="equation math"
                on:click={() => setClipboard(equation.plain)}
            >
                {@html display(equation.latex, options)}
            </div>
        {/if}
        <div class="separator"></div>
        {#if result.latex !== ''}
            <div
                class="result math"
                on:click={() => setClipboard(result.plain)}
            >
                {@html display(result.latex, options)}
            </div>
        {/if}
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

    .math {
        display: flex;
        align-items: center;
        text-shadow: 1px 1px 0.5px rgb(0, 0, 0, 0.15);
    }

    .math :global(.mathlifier-display) {
        overflow-x: visible;
        padding-left: 1em;
        padding-right: 1em;
        /* margin-top: 1em;
        margin-bottom: 1em; */
        border: 1px solid transparent; /* Transparent border by default */
        border-radius: 5px;
        background-color: transparent;
        transition:
            border-color 0.1s,
            background-color 0.1s; /* Smooth transition on hover */
    }

    .math :global(.mathlifier-display:hover) {
        cursor: pointer;
        /* border-color: rgb(77, 77, 77); /* Only change the color on hover */
        background-color: rgba(210, 210, 210, 0.769);
    }

    .math :global(.katex) {
        font-size: 1.3rem;
    }
</style>

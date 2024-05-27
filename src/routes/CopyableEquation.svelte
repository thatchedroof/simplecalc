<script lang="ts">
    import { parser, setClipboard } from '$lib';
    import { display } from 'mathlifier';

    export let equation: {
        latex: string;
        plain: string;
    };

    export let asLatex = false;
    export let format = false;
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<!-- svelte-ignore a11y-click-events-have-key-events -->
<div
    class="math"
    on:click={(e) => {
        // If alt held
        if (e.altKey) {
            setClipboard(equation.latex);
        } else {
            if (format) {
                setClipboard(parser.format(equation.plain));
            } else {
                setClipboard(equation.plain);
            }
        }
    }}
>
    {@html asLatex
        ? equation.latex
        : display(equation.latex, {
              output: 'html',
              // output: 'mathml' as const,
              fleqn: false,
              throwOnError: false,
              displayMode: true,
          })}
</div>

<style>
    .math {
        display: flex;
        align-items: center;
        text-shadow: 1px 1px 0.5px rgb(0, 0, 0, 0.15);
    }

    .math :global(.mathlifier-display) {
        z-index: 1;
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
        /* mix-blend-mode: lighten; */
    }

    .math :global(.katex-display) {
        z-index: 2;
    }

    .math :global(.katex) {
        font-size: 1.3rem;
    }
</style>

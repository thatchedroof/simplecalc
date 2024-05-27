<script lang="ts">
    import CopyableEquation from './CopyableEquation.svelte';
    export let formula: any;
    import { parser } from '$lib';
    import { applyReplacements, removeReplacements } from '$lib/MathParser';
    import { latexizeEquation } from '$lib';
    import { display } from 'mathlifier';

    function processTex(tex: string) {
        return display(
            removeReplacements(
                latexizeEquation(applyReplacements(tex), parser, true),
            ).replace(/y\\\\?_result/g, ''),
            {
                overflowAuto: false,
                output: 'html',
            },
        );
    }

    const ptAsLatexEq = (tex: string) => {
        return {
            latex: processTex(tex),
            plain: tex,
        };
    };

    let f = '';
    let g = '';
    let df = '';
    let dg = '';

    let lastF = '';
    let lastG = '';
    let lastDf = '';
    let lastDg = '';

    const convertFormula = (key: string, replacement: string) => {
        if (key in formula) {
            return formula[key]?.trim() === '' ? replacement : formula[key];
        } else {
            return replacement;
        }
    };

    $: if (formula?.code === 'quot' || formula?.code === 'prod') {
        lastF = f;
        lastG = g;
        lastDf = df;
        lastDg = dg;

        f = convertFormula('f', 'f(x)');
        g = convertFormula('g', 'g(x)');
        df = convertFormula('df', 'f_prime(x)');
        dg = convertFormula('dg', 'g_prime(x)');

        // Try converting to LaTeX, if it fails, return the original string
        let latexF = processTex(f);
        let latexG = processTex(g);
        let latexDf = processTex(df);
        let latexDg = processTex(dg);

        let defaultString =
            '<span class="katex-display"><span class="katex"><span class="katex-html" aria-hidden="true"></span></span></span>';

        f = latexF === defaultString ? lastF : f;
        g = latexG === defaultString ? lastG : g;
        df = latexDf === defaultString ? lastDf : df;
        dg = latexDg === defaultString ? lastDg : dg;
    }
</script>

<div class="container">
    {#if formula?.code === 'quot' || formula?.code === 'prod'}
        <div class="formula-container">
            <div id="f">
                {@html processTex('f(x)=y_result')}
            </div>
            <textarea class="f-textarea cell-textarea" bind:value={formula.f} />
        </div>
        <div class="formula-container">
            <div id="g">
                {@html processTex('g(x)=y_result')}
            </div>
            <textarea class="g-textarea cell-textarea" bind:value={formula.g} />
        </div>
        <div class="formula-container">
            <div id="df">
                {@html processTex('f_prime(x)=y_result')}
            </div>
            <textarea
                class="df-textarea cell-textarea"
                bind:value={formula.df}
            />
        </div>
        <div class="formula-container">
            <div id="dg">
                {@html processTex('g_prime(x)=y_result')}
            </div>
            <textarea
                class="dg-textarea cell-textarea"
                bind:value={formula.dg}
            />
        </div>
        {#if formula?.code === 'quot'}
            <div class="result-container">
                <div id="result">
                    <CopyableEquation
                        equation={ptAsLatexEq(
                            `(｢${df}｣*｢${g}｣-｢${f}｣*｢${dg}｣)/(${g})^2`
                                .replaceAll(
                                    /-?｢[^｣]*｣\*｢0｣|-?｢0｣\*｢[^｣]*｣/g,
                                    '',
                                )
                                .replaceAll(/｢1｣\*|\*｢1｣/g, '')
                                .replaceAll(/\(\)(?=\/)/g, '0')
                                .replaceAll(/｢/g, '(')
                                .replaceAll(/｣/g, ')'),
                        )}
                        asLatex
                        format
                    />
                </div>
            </div>
        {:else if formula?.code === 'prod'}
            <div class="result-container">
                <div id="result">
                    <CopyableEquation
                        equation={ptAsLatexEq(
                            `｢${df}｣*｢${g}｣+｢${f}｣*｢${dg}｣`
                                .replaceAll(
                                    /\+?｢[^｣]*｣\*｢0｣\+?|\+?｢0｣\*｢[^｣]*｣\+?/g,
                                    '',
                                )
                                .replaceAll(/｢1｣\*|\*｢1｣/g, '')
                                .replaceAll(/｢/g, '(')
                                .replaceAll(/｣/g, ')'),
                        )}
                        asLatex
                        format
                    />
                </div>
            </div>
        {/if}
    {/if}
</div>
<div class="border"></div>

<style>
    .container {
        display: flex;
        flex-direction: column;
        justify-content: left;
        align-items: left;
        width: calc(600px - 2em);
        max-width: calc(100vw - 2em);
        margin: 2.5em;
        padding-left: 3em;
    }

    .formula-container {
        display: flex;
        align-items: center;
        justify-content: center;
        width: fit-content;
    }

    .result-container {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
    }

    .border {
        display: block;
        width: calc(min(600px - 2em, 100vw - 2em));
        border-bottom: 1px solid rgb(179, 179, 179);
    }
</style>

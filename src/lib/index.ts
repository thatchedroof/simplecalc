// place files you want to import through the `$lib` alias in this folder.

import { isSet, MathParser } from './MathParser.js';
import { toast } from '@zerodevx/svelte-toast';
import * as m from 'mathjs';
import { removeReplacements } from './MathParser.js';

export const parser = new MathParser();

console.log(parser.parse('[{3,4}+2,5^{2,4}]-{6,sin(7)}').toString());
// console.log(parser.parse('5^{1,2,3}+1').toString());

export function setClipboard(input: string) {
    let text = removeReplacements(input);

    toast.push(`Copied ${text}!`, {
        theme: {},
    });

    let type = 'text/plain';
    let blob = new Blob([text], { type });
    let data = [new ClipboardItem({ [type]: blob })];

    navigator.clipboard.write(data).then(
        function () {
            /* success */
            console.log('copied to clipboard');
        },
        function () {
            /* failure */
        },
    );
}

let specialNames = [
    'nabla',
    'aleph',
    'alef',
    'beth',
    'gimel',
    'daleth',
    'eth',
    'ell',
    'square',
    'triangle',
    'diamond',
    'lozenge',
    'star',
    'bigstar',
    'clubs',
    'clubsuit',
    'diamondsuit',
    'diamonds',
    'spadesuit',
    'spades',
    'heartsuit',
    'hearts',
    'maltese',
    'mho',
    'checkmark',
    'TeX',
    'LaTeX',
];

export const trigNames = [
    'acos',
    'acosh',
    'acot',
    'acoth',
    'acsc',
    'acsch',
    'asec',
    'asech',
    'asin',
    'asinh',
    'atan',
    'atan2',
    'atanh',
    'cos',
    'cosh',
    'cot',
    'coth',
    'csc',
    'csch',
    'sec',
    'sech',
    'sin',
    'sinh',
    'tan',
    'tanh',
];

function callback(node: m.MathNode, options: any) {
    try {
        if ('op' in node && node.op === '^') {
            if (
                'fn' in node.args[0] &&
                trigNames.includes(node.args[0].fn.name)
            ) {
                let fn = node.args[0].fn.name;
                let fnArg = node.args[0].args[0];
                let power = node.args[1];
                if (power.type !== 'ConstantNode' || power.value == -1) {
                    return;
                }
                return `\\${fn}^{${power}}\\left(${fnArg.toTex(
                    options,
                )}\\right)`;
            }
        } /* else if ('fn' in node && node.fn.name === 'func') {
            let { vars, expr } = parser.functionTexts.func;
            let resolved = m.resolve(
                expr,
                Object.fromEntries(
                    node.args.map((t, i) => {
                        return [vars[i], t];
                    }),
                ),
            );
            return resolved.toTex(options);
        } */ else if ('name' in node && specialNames.includes(node.name)) {
            return `\\${node.name}`;
        } else if (isSet(node)) {
            return `\\left\\{${node.properties.set_value.items
                .map((t) => t.toTex(options))
                .join(',')}\\right\\}`;
        }
    } catch (e) {
        console.log('error', e);
    }
}

export function latexizeEquation(
    eq: string,
    parser: MathParser,
    removeTilde: boolean = false,
) {
    if (eq === '') {
        return '';
    }
    let parsedEquation = '';
    let options = { parenthesis: 'auto', implicit: 'hide', handler: callback };
    try {
        parsedEquation = parser.math
            .parse(eq)
            .toTex(options)
            .replaceAll(/\\mathrm{(.|.\\*_prime)}/g, '$1');
    } catch (e) {
        try {
            let parsedEquations = eq.split('=').map((t) => {
                return parser.math
                    .parse(t)
                    .toTex(options)
                    .replaceAll(/\\mathrm{(.|.\\*_prime)}/g, '$1');
            });
            parsedEquation = parsedEquations.join('=');
        } catch (e) {
            return '';
        }
    }
    if (removeTilde) {
        parsedEquation = parsedEquation.replaceAll('~', '');
    }
    return parsedEquation.replaceAll(/\\cdot/g, '\\cdot ');
}

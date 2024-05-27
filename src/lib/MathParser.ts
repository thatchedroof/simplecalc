import * as m from 'mathjs';
import { create, all } from 'mathjs';
import { createSimplifyExact } from './simplifyExact.js';
import { createTrigExact } from './trigExact.js';
import { parseTex, evaluateTex } from 'tex-math-parser';
// import type { Node } from 'mathjs';
function insertListAt<T>(targetList: T[], insertList: T[], index: number): T[] {
    // Check if the index is within the bounds of the targetList
    if (index < 0 || index > targetList.length) {
        throw new Error('Index out of bounds');
    }

    // Use the spread operator to insert the elements of insertList into targetList at the specified index
    targetList.splice(index, 0, ...insertList);

    return targetList;
}

export class MathParser {
    math: m.MathJsInstance;
    limitedEval: {
        (expr: m.MathExpression, scope?: object | undefined): any;
        (expr: m.MathExpression[], scope?: object | undefined): any[];
    };
    scope: any = {};
    history: [string, string][] = [];
    functionTexts: {
        [key: string]: {
            vars: string[];
            expr: string;
        };
    } = {};

    constructor() {
        this.math = create(all);
        this.limitedEval = this.math.evaluate;

        const customFunctions = {
            // 'import': function () { throw new Error('Function import is disabled'); },
            // 'createUnit': function () { throw new Error('Function createUnit is disabled'); },
            // 'evaluate': function () { throw new Error('Function evaluate is disabled'); },
            // 'parse': function () { throw new Error('Function parse is disabled'); },
            // 'simplify': function () { throw new Error('Function simplify is disabled'); },
            derivative: function () {
                throw new Error('Function derivative is disabled');
            },
            ln: Math.log,
        };

        // @ts-ignore
        customFunctions.ln.toTex = '\\ln\\left(${args}\\right)';

        this.math.import(customFunctions, { override: true });
        this.math.import(createSimplifyExact);
        // console.log(this.math.simplifyExact);
        // console.log(this.math.simplifyExact(this));
        // this.evaluate('f(x) = sin(x)');
        // console.log('fres', this.math.simplifyExact(this)(this.parse('f(5)')));
        this.math.import(createTrigExact);
    }

    evaluate(expr: string, scope?: object): any {
        console.log('expr', expr);
        let parsed = bubbleSetValues(this.parse(expr));
        console.log('parsed', parsed.toString(), scope ?? this.scope);
        let result = parsed.compile().evaluate(scope ?? this.scope);
        console.log('result', result);
        this.addHistory(parsed.toString().replaceAll(/\s/g, ''), result);

        // If the result is a function, add it to the functionTexts
        if (result instanceof Function) {
            let [func, dec] = expr.split('=', 2);
            let funcName = func.split('(')[0].trim();
            let funcVars = func
                .split('(')[1]
                .split(')')[0]
                .split(',')
                .map((t) => t.trim());
            this.functionTexts[funcName] = {
                vars: funcVars,
                expr: dec,
            };
            console.log('functionTexts', this.functionTexts);
        }

        return result ?? '';
    }

    evaluateWithoutSaving(expr: string | m.MathNode, scope?: object): any {
        let parsed;
        if (typeof expr === 'string') {
            parsed = bubbleSetValues(this.parse(expr));
        } else {
            parsed = expr;
        }
        let newScope = structuredClone(scope ?? this.scope);
        let result = parsed.compile().evaluate(newScope);
        return result ?? '';
    }

    convertString(expr: string, scope?: object): any {
        return this.parse(expr).toString().replaceAll(/\s/g, '') ?? '';
    }

    simplify(expr: string | m.MathNode, scope?: object): any {
        let exp = bubbleSetValues(this.parse(expr));

        if (isSet(exp)) {
            return asSet(
                exp.properties.set_value.items.map((t) => {
                    return this.simplify(t, scope);
                }),
            );
        }

        let result = this.math.simplify(
            exp,
            [
                // Convert arithmetic functions
                { s: 'add(n1,n2) -> n1+n2' },
                { s: 'subtract(n1,n2) -> n1-n2' },
                { s: 'multiply(n1,n2) -> n1*n2' },
                { s: 'divide(n1,n2) -> n1/n2' },
                { s: 'pow(n1,n2) -> n1^n2' },
                { s: 'square(n1) -> n1^2' },
                { s: 'cube(n1) -> n1^3' },
                { s: 'exp(n1) -> e^n1' },
                { s: 'unaryMinus(n1) -> -n1' },
            ],
            scope ?? this.scope,
            { exactFractions: true, consoleDebug: true },
        );

        let rules = this.math.simplify.rules;

        // console.log(rules.splice(22, 1));
        // console.log(rules.splice(37, 1));
        rules[22] = this.math.simplifyExact(this);
        rules[38] = this.math.simplifyExact(this);

        insertListAt(
            rules,
            [
                // Trigonometric identities
                { s: 'tan(n1) -> sin(n1)/cos(n1)' },
                { s: 'sec(n1) -> 1/cos(n1)' },
                { s: 'csc(n1) -> 1/sin(n1)' },
                { s: 'cot(n1) -> 1/tan(n1)' },

                // Pythagorean identities
                { s: 'sin(n1)^2 + cos(n1)^2 -> 1' },

                // Reflection and shift identities
                { s: 'sin(2*pi+n1) -> sin(n1)' },
                { s: 'cos(2*pi+n1) -> cos(n1)' },
                { s: 'sin(pi+n1) -> -sin(n1)' },
                { s: 'cos(pi+n1) -> -cos(n1)' },

                // Double angle identities
                { s: 'sin(2*n1) -> 2*sin(n1)*cos(n1)' },
                { s: 'cos(2*n1) -> cos(n1)^2 - sin(n1)^2' },

                // Even and odd identities
                { s: 'sin(-n1) -> -sin(n1)' },
                { s: 'cos(-n1) -> cos(n1)' },

                // Angle addition identities
                { s: 'sin(n1+n2) -> sin(n1)*cos(n2) + cos(n1)*sin(n2)' },
                { s: 'cos(n1+n2) -> cos(n1)*cos(n2) - sin(n1)*sin(n2)' },
                { s: 'sin(n1-n2) -> sin(n1)*cos(n2) - cos(n1)*sin(n2)' },
                { s: 'cos(n1-n2) -> cos(n1)*cos(n2) + sin(n1)*sin(n2)' },

                // Convert cos to sin
                // { s: 'cos(n1) -> sin(n1+pi/2)' },

                // Expand ln, log, log10, and log2
                { s: 'ln(n1*n2) -> ln(n1) + ln(n2)' },
                { s: 'ln(n1/n2) -> ln(n1) - ln(n2)' },
                { s: 'log(n1*n2) -> log(n1) + log(n2)' },
                { s: 'log(n1/n2) -> log(n1) - log(n2)' },
                { s: 'log10(n1*n2) -> log10(n1) + log10(n2)' },
                { s: 'log10(n1/n2) -> log10(n1) - log10(n2)' },
                { s: 'log2(n1*n2) -> log2(n1) + log2(n2)' },
                { s: 'log2(n1/n2) -> log2(n1) - log2(n2)' },
                { s: 'ln(n1^n2) -> n2*ln(n1)' },
                { s: 'log(n1^n2) -> n2*log(n1)' },
                { s: 'log10(n1^n2) -> n2*log10(n1)' },
                { s: 'log2(n1^n2) -> n2*log2(n1)' },

                // Reverse root simplification
                { s: 'n1^(1/2) -> sqrt(n1)' },
                { s: 'n1^(1/3) -> cbrt(n1)' },
                { s: 'n1^(1/c) -> nthRoot(n1,c)' },
                { s: 'n1^(-1/2) -> 1/sqrt(n1)' },
                { s: 'n1^(-1/3) -> 1/cbrt(n1)' },
                { s: 'n1^(-1/c) -> 1/nthRoot(n1,c)' },
            ],
            37,
        );

        insertListAt(
            rules,
            [
                { s: 'ln(e) -> 1' },

                this.math.trigExact,

                { s: 'sqrt(n1) -> n1^(1/2)' },
                { s: 'cbrt(n1) -> n1^(1/3)' },
                { s: 'nthRoot(n,c) -> n^(1/c)' },

                // Roots
                // { s: 'n1/(n2^(1/2)) -> n1*(n2^(1/2))/n2' },
                { s: 'n1/(n2+(n3^(1/2))) -> n1*(n2-(n3^(1/2)))/(n2^2-n3)' },
                { s: 'n1/(n2-(n3^(1/2))) -> n1*(n2+(n3^(1/2)))/(n2^2-n3)' },
            ],
            0,
        );

        rules = rules.concat([
            { s: 'sin(n1)^2 + cos(n1)^2 -> 1' },
            { s: 'sin(n1)/cos(n1) -> tan(n1)' },
            { s: '1/cos(n1) -> sec(n1)' },
            { s: '1/sin(n1) -> csc(n1)' },
            { s: '1/tan(n1) -> cot(n1)' },
            { s: 'cos(n1)/sin(n1) -> cot(n1)' },
            { s: 'sin(n1)*cos(n2) + cos(n1)*sin(n2) -> sin(n1+n2)' },
            { s: 'cos(n1)*cos(n2) - sin(n1)*sin(n2) -> cos(n1+n2)' },
            { s: 'sin(n1)*cos(n2) - cos(n1)*sin(n2) -> sin(n1-n2)' },
            { s: 'cos(n1)*cos(n2) + sin(n1)*sin(n2) -> cos(n1-n2)' },
            { s: '2*sin(n1)*cos(n1) -> sin(2*n1)' },
            { s: 'cos(n1)^2 - sin(n1)^2 -> cos(2*n1)' },
            { s: '(cos(n1-n2) - cos(n1+n2))/2 -> sin(n1)*sin(n2)' },
            { s: '(cos(n1-n2) + cos(n1+n2))/2 -> cos(n1)*cos(n2)' },
            { s: '(sin(n1+n2) + sin(n1-n2))/2 -> sin(n1)*cos(n2)' },
            { s: 'sin(2*pi+n1) -> sin(n1)' },
            { s: 'cos(2*pi+n1) -> cos(n1)' },
            { s: 'sin(pi+n1) -> -sin(n1)' },
            { s: 'cos(pi+n1) -> -cos(n1)' },
            { s: 'sin(-n1) -> -sin(n1)' },
            { s: 'cos(-n1) -> cos(n1)' },
        ]);

        result = this.math.simplify(result, rules, scope ?? this.scope, {
            exactFractions: true,
            // consoleDebug: true,
        });

        console.log('result final', result.toString());
        return result ?? '';
    }

    format(expr: string) {
        try {
            let result = setImplicitMultiplications(
                this.math.parse(applyReplacements(expr)),
            ).toString({
                parenthesis: 'auto',
                implicit: 'hide',
            });
            console.log('result', result);
            return removeReplacements(result.replaceAll(' ', ''));
        } catch (e) {
            let result = expr
                .split('=')
                .map((t) => {
                    return setImplicitMultiplications(
                        this.math.parse(applyReplacements(t)),
                    ).toString({
                        parenthesis: 'auto',
                        implicit: 'hide',
                    });
                })
                .join('=');
            console.log('result', result);
            return removeReplacements(result.replaceAll(' ', ''));
        }
    }

    addHistory(expr: string, result: any) {
        this.scope['ans'] = result;
        // this.history.push([expr, result]);
    }

    replaceHistory(history: [string, string][]) {
        this.history = history;
        this.scope['ans'] = this.history[this.history.length - 1][1];
    }

    addFuncsToScope() {
        for (let funcName in this.functionTexts) {
            let func = this.functionTexts[funcName];
            this.limitedEval(
                `${funcName}(${func.vars.join(',')}) = ${func.expr}`,
                this.scope,
            );
        }
    }

    parse(expr: string | m.MathNode) {
        if (typeof expr === 'string') {
            return this.math
                .parse(addSets(expr))
                .transform(exclamationFuncsCallback(this));
        }
        return expr.transform(exclamationFuncsCallback(this));
    }

    resolveAtFunction(func: string, args: m.MathNode[]) {
        let { vars, expr } = this.functionTexts[func];
        return m.resolve(
            expr,
            Object.fromEntries(
                args.map((t, i) => {
                    return [vars[i], t];
                }),
            ),
        );
    }

    distribute(expr: string | m.MathNode) {
        let rules = [
            // Might want to remove much of this
            { l: 'n+0', r: 'n' },
            { l: 'n^0', r: '1' },
            { l: '0*n', r: '0' },
            { l: 'n/n', r: '1' },
            { l: 'n^1', r: 'n' },
            { l: '+n1', r: 'n1' },
            { l: 'n--n1', r: 'n+n1' },
            { l: 'n-0', r: 'n' },
            { l: 'n*1', r: 'n' },
            { l: '-(-n)', r: 'n' },

            { l: '-(n1/n2)', r: '-n1/n2' },
            { l: 'n*n1^-n2', r: 'n/n1^n2' },
            { s: '(n1*n2)^n3 -> n1^n3 * n2^n3' },
            { s: '(n1/n2)^n3 -> n1^n3 / n2^n3' },
            // { s: 'n^2 -> n*n' },
            // { s: 'n^3 -> n*n*n' },
            // { s: 'n^4 -> n*n*n*n' },
            // { s: 'n^5 -> n*n*n*n*n' },
            // { s: 'n^6 -> n*n*n*n*n*n' },
            // { s: 'n^7 -> n*n*n*n*n*n*n' },
            // { s: 'n^8 -> n*n*n*n*n*n*n*n' },
            // { s: 'n^9 -> n*n*n*n*n*n*n*n*n' },
            // { s: 'n^10 -> n*n*n*n*n*n*n*n*n*n' },

            { s: 'n/(n1/n2) -> n*(n2/n1)' },
            { s: '(n1/n2)*n -> n1*n/n2' },
            { s: 'n1/n2/n3 -> n1/(n2*n3)' },
            { s: '(n1*n2)^n3 -> n1^n3 * n2^n3' },
            // { s: '(n1/n2)+(n3/n4) -> (n1*n4+n2*n3)/(n2*n4)', repeat: false }, // (x^2+x*5)/(-4) repeats forever
            // { s: '(n1/n2)-(n3/n4) -> (n1*n4-n2*n3)/(n2*n4)', repeat: false },
            { s: '(n1/n2)*(n3/n4) -> (n1*n3)/(n2*n4)' },
            { s: 'n1*(n2+n3) -> n1*n2+n1*n3' },
            { s: '(n1+n2)*n3 -> n1*n3+n2*n3' },
            { s: 'n1*(n2-n3) -> n1*n2-n1*n3' },
            { s: '(n1-n2)*n3 -> n1*n3-n2*n3' },
            { s: '(n2+n3)/n1 -> n2/n1+n3/n1' },
            { s: '(n2-n3)/n1 -> n2/n1-n3/n1' },
            { s: '-(n1+n2) -> -n1-n2' },
            { s: '-(n1-n2) -> -n1+n2' },
            { s: 'n-(n1+n2) -> n-n1-n2' },
            { s: 'n-(n1-n2) -> n-n1+n2' },

            { l: 'n+-n', r: '0' },
            { l: '(-1) * n', r: '-n' },
            { l: 'n+-n1', r: 'n-n1' },
            { l: 'n+-(n1)', r: 'n-(n1)' },
            { s: 'n*(n1^-1) -> n/n1' },
            { l: 'n^1', r: 'n' },
            { l: 'n1/(-n2)', r: '-n1/n2' },
            { s: 'n^n1 * n -> n^(n1+1)' },
            { s: '(n ^ n1) ^ n2 -> n ^ (n1 * n2)' },

            { s: 'n+n -> 2*n' },
            // { s: 'n*n -> n^2', repeat: true },
            // { s: 'n*n*n -> n^3', repeat: true },
            // { s: 'n*n*n*n -> n^4', repeat: true },
            // { s: 'n*n*n*n*n -> n^5', repeat: true },
            // { s: 'n*n*n*n*n*n -> n^6', repeat: true },
            // { s: 'n*n*n*n*n*n*n -> n^7', repeat: true },
            // { s: 'n*n*n*n*n*n*n*n -> n^8', repeat: true },
            // { s: 'n*n*n*n*n*n*n*n*n -> n^9', repeat: true },
            // { s: 'n*n*n*n*n*n*n*n*n*n -> n^10', repeat: true },

            {
                s: 'ce+ve -> ve+ce',
                assuming: { add: { commutative: true } },
                imposeContext: { add: { commutative: false } },
                repeat: true,
            },
            {
                s: 'vd*cd -> cd*vd',
                assuming: { multiply: { commutative: true } },
                imposeContext: { multiply: { commutative: false } },
                repeat: true,
            },
            //-(a-b-c+d+e-f-g-h+i-j+k+l-m-n-o+p-q+r-s)
        ];

        let result = this.math.simplify(expr, rules, this.scope, {
            exactFractions: true,
            // consoleDebug: true,
        });

        result = this.simplifyNonSymbol(result, this.scope);

        return setImplicitMultiplications(
            this.math.simplify(result, rules, this.scope, {
                exactFractions: true,
                // consoleDebug: true,
            }),
        );
    }

    simplifyNonSymbol(text: string | m.MathNode, scope?: object): any {
        console.log('this', this, this.parse);
        return applyFunctionToNonSymbolNodes(this.parse(text), (x) =>
            this.simplify(x, scope),
        );
    }
}

function addSets(expr: string): string {
    function go(expr: string) {
        let newExpr = expr.replaceAll(
            /\{([^:\{\}]*)\}/g,
            '\x1E"set_value":[$1]\x1F',
        );

        if (newExpr === expr) {
            return expr;
        } else {
            return addSets(newExpr);
        }
    }

    return go(expr).replaceAll('\x1E', '{').replaceAll('\x1F', '}');
}

function removeSets(expr: string): string {
    return expr.replace(/\{\s*"set_value"\s*:\s*\[(.*?)\]\}/g, '{$1}');
}

export function searchEquationForSymbols(
    equation: math.MathNode | math.MathNode[],
) {
    let symbols: string[] = [];
    if (Array.isArray(equation)) {
        equation.forEach((node) => {
            symbols = symbols.concat(searchEquationForSymbols(node));
        });
    } else {
        let constants = [
            'e',
            'E',
            'i',
            'Infinity',
            'LN2',
            'LN10',
            'LOG2E',
            'LOG10E',
            'NaN',
            'null',
            'phi',
            'pi',
            'PI',
            'SQRT1_2',
            'SQRT2',
            'tau',
            'undefined',
            'version',
        ];

        if (equation?.isSymbolNode && !constants.includes(equation.name)) {
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

export function applyFunctionToNonSymbolNodes(
    equation: math.MathNode,
    func: (node: math.MathNode) => math.MathNode,
): math.MathNode | math.MathNode[] {
    console.log('eq', equation);
    if (searchEquationForSymbols(equation).length === 0) {
        return func(equation);
    } else {
        if (equation?.isConstantNode || equation?.isSymbolNode) {
            return equation;
        }
        // Apply the function to each node in the equation
        return equation.map((node) => {
            return applyFunctionToNonSymbolNodes(node, func);
        });
    }
}

export function exclamationFuncsCallback(parser: MathParser) {
    return (node: m.MathNode) => {
        switch (node.type) {
            case 'FunctionNode':
                if (
                    node.name.endsWith('_resolve_value') &&
                    parser.functionTexts[node.name.slice(0, -14)]
                ) {
                    let resolved = parser.resolveAtFunction(
                        node.name.slice(0, -14),
                        node.args,
                    );
                    console.log('resolved', resolved.toString());
                    return resolved;
                }
                break;
            default:
                return node;
        }
        return node;
    };
}

export function setImplicitMultiplications(expr: m.MathNode) {
    return expr.transform((node) => {
        if (node.type === 'OperatorNode' && node.fn === 'multiply') {
            try {
                if (m.isNumeric(node.args[0].compile().evaluate())) {
                    node.implicit = true;
                    return node;
                }
            } catch (e) {}
        }
        return node;
    });
}

let ps = new MathParser();
// ps.simplify('sin(1)');

// ps.simplify('tan(3pi/8)/sin((2pi)/6)');

ps.simplify('tan(3pi/10)/csc(pi/5)');

// ps.simplify('sin((.814171)/6)');

// ps.simplify('(.814171)/6');

// ps.simplify('2/sqrt(2)');
// // ps.simplify('(6*x^2)/(3+sqrt(x))');
// ps.simplify('5/((3+sqrt(x))/(6*x^2))');
// ps.simplify('cube(.25)');

export function applyReplacements(expr: string) {
    return expr
        .replace(
            /([\u00C0-\u02AF\u0370-\u03FF\u2100-\u214F\u{1D400}-\u{1D7FF}a-zA-Z_$])'+/gu,
            function (match, p1) {
                return p1 + '_prime'.repeat(match.length - 1);
            },
        )
        .replace(/(?<=\S)!(?=\()/g, '_resolve_value');
}

export function removeReplacements(expr: string) {
    return removeSets(
        expr.replace(/\\*_prime/g, "'").replace(/\\*_resolve_value/g, '!'),
    );
}

function mapToString(expr: any | any[]) {
    if (Array.isArray(expr)) {
        return expr.map((t) => mapToString(t)).toString();
    }
    return expr.toString();
}

export function countChildren(expr: m.MathNode): number {
    let count = 0;
    expr.map((node) => {
        count += 1;
        return node;
    });
    return count;
}

export function isSet(expr: m.MathNode): boolean {
    return 'properties' in expr && 'set_value' in expr.properties;
}

export function asSet(expr: m.MathNode[]): m.MathNode {
    return new m.ObjectNode({
        set_value: new m.ArrayNode(expr),
    });
}

export function bubbleSetValues(expr: m.MathNode): m.MathNode {
    if (countChildren(expr) < 1) {
        return expr;
    }
    let node = expr.map(bubbleSetValues);
    let mapValues: m.MathNode[][] = [];
    node.map((t) => {
        if (isSet(t)) {
            mapValues.push(t.properties.set_value.items);
        } else {
            mapValues.push([t]);
        }
        return t;
    });
    mapValues = getAllCombinations(mapValues);
    if (mapValues.length <= 1) {
        return node;
    }
    let newNodes = mapValues.map((values) => {
        let i = 0;
        return node.map((t) => {
            return values[i++];
        });
    });
    return asSet(newNodes);
}

// ChatGPT
function getAllCombinations<T>(lists: T[][]): T[][] {
    // Base case: if there are no more lists to process, return an array containing an empty array
    if (lists.length === 0) {
        return [[]];
    }

    // Recursive case: process the first list and recursively call on the rest
    const firstList = lists[0];
    const restLists = lists.slice(1);

    const restCombinations = getAllCombinations(restLists);
    let allCombinations: T[][] = [];

    // Change starts here: Iterate through each combination from the rest of the lists first
    restCombinations.forEach((combination) => {
        // Then, for each combination, iterate through each element in the first list
        firstList.forEach((element) => {
            // This will append the combinations in a different order
            allCombinations.push([element, ...combination]);
        });
    });

    return allCombinations;
}

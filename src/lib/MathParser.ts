import * as m from 'mathjs';
import { create, all } from 'mathjs';

export class MathParser {
    math: m.MathJsInstance;
    limitedEval: { (expr: m.MathExpression, scope?: object | undefined): any; (expr: m.MathExpression[], scope?: object | undefined): any[]; };
    scope: any = {};
    history: [string, string][] = [];

    constructor() {
        this.math = create(all);
        this.limitedEval = this.math.evaluate;

        this.math.import({
            // 'import': function () { throw new Error('Function import is disabled'); },
            // 'createUnit': function () { throw new Error('Function createUnit is disabled'); },
            // 'evaluate': function () { throw new Error('Function evaluate is disabled'); },
            // 'parse': function () { throw new Error('Function parse is disabled'); },
            // 'simplify': function () { throw new Error('Function simplify is disabled'); },
            'derivative': function () { throw new Error('Function derivative is disabled'); },
        }, { override: true });
    }

    evaluate(expr: string, scope?: object): any {
        let result = this.limitedEval(expr, scope ?? this.scope);
        this.addHistory(expr, result);
        return result ?? '';
    }

    simplify(expr: string, scope?: object): any {
        let rules = this.math.simplify.rules;
        rules = rules.concat([

            // Trigonometric identities
            { s: 'tan(n1) -> sin(n1)/cos(n1)', repeat: false },
            { s: 'sec(n1) -> 1/cos(n1)', repeat: false },
            { s: 'csc(n1) -> 1/sin(n1)', repeat: false },
            { s: 'cot(n1) -> 1/tan(n1)', repeat: false },

            // Pythagorean identities
            { s: 'sin(n1)^2 + cos(n1)^2 -> 1', repeat: false },

            // Reflection and shift identities
            { s: 'sin(2*pi+n1) -> sin(n1)', repeat: false },
            { s: 'cos(2*pi+n1) -> cos(n1)', repeat: false },
            { s: 'sin(pi+n1) -> -sin(n1)', repeat: false },
            { s: 'cos(pi+n1) -> -cos(n1)', repeat: false },

            // Double angle identities
            { s: 'sin(2*n1) -> 2*sin(n1)*cos(n1)', repeat: false },
            { s: 'cos(2*n1) -> cos(n1)^2 - sin(n1)^2', repeat: false },

            // Even and odd identities
            { s: 'sin(-n1) -> -sin(n1)', repeat: false },
            { s: 'cos(-n1) -> cos(n1)', repeat: false },

            // Angle addition identities
            { s: 'sin(n1+n2) -> sin(n1)*cos(n2) + cos(n1)*sin(n2)', repeat: false },
            { s: 'cos(n1+n2) -> cos(n1)*cos(n2) - sin(n1)*sin(n2)', repeat: false },
            { s: 'sin(n1-n2) -> sin(n1)*cos(n2) - cos(n1)*sin(n2)', repeat: false },
            { s: 'cos(n1-n2) -> cos(n1)*cos(n2) + sin(n1)*sin(n2)', repeat: false },
        ]);
        let result = this.math.simplify(expr, rules, scope ?? this.scope, { exactFractions: true, consoleDebug: true });

        console.log('result one', result.toString());

        // Simplify the result again

        rules = this.math.simplify.rules;
        rules = rules.concat([
            { s: 'sin(n1)^2 + cos(n1)^2 -> 1', repeat: false },
            { s: 'sin(n1)/cos(n1) -> tan(n1)', repeat: false },
            { s: '1/cos(n1) -> sec(n1)', repeat: false },
            { s: '1/sin(n1) -> csc(n1)', repeat: false },
            { s: '1/tan(n1) -> cot(n1)', repeat: false },
            { s: 'cos(n1)/sin(n1) -> cot(n1)', repeat: false },
            { s: 'sin(n1)*cos(n2) + cos(n1)*sin(n2) -> sin(n1+n2)', repeat: false },
            { s: 'cos(n1)*cos(n2) - sin(n1)*sin(n2) -> cos(n1+n2)', repeat: false },
            { s: 'sin(n1)*cos(n2) - cos(n1)*sin(n2) -> sin(n1-n2)', repeat: false },
            { s: 'cos(n1)*cos(n2) + sin(n1)*sin(n2) -> cos(n1-n2)', repeat: false },
            { s: '2*sin(n1)*cos(n1) -> sin(2*n1)', repeat: false },
            { s: 'cos(n1)^2 - sin(n1)^2 -> cos(2*n1)', repeat: false },
            { s: '(cos(n1-n2) - cos(n1+n2))/2 -> sin(n1)*sin(n2)', repeat: false },
            { s: '(cos(n1-n2) + cos(n1+n2))/2 -> cos(n1)*cos(n2)', repeat: false },
            { s: '(sin(n1+n2) + sin(n1-n2))/2 -> sin(n1)*cos(n2)', repeat: false },
            { s: 'sin(2*pi+n1) -> sin(n1)', repeat: false },
            { s: 'cos(2*pi+n1) -> cos(n1)', repeat: false },
            { s: 'sin(pi+n1) -> -sin(n1)', repeat: false },
            { s: 'cos(pi+n1) -> -cos(n1)', repeat: false },
            { s: 'sin(-n1) -> -sin(n1)', repeat: false },
            { s: 'cos(-n1) -> cos(n1)', repeat: false },
        ]);

        result = this.math.simplify(result, rules, scope ?? this.scope, { exactFractions: true, consoleDebug: true });

        console.log('result two', result.toString());
        return result ?? '';
    }

    addHistory(expr: string, result: any) {
        this.scope['ans'] = result;
        // this.history.push([expr, result]);
    }

    replaceHistory(history: [string, string][]) {
        this.history = history;
        this.scope['ans'] = this.history[this.history.length - 1][1];
    }

    addFunc(expr: string) {
        // Get
    }
}



export function latexizeEquation(eq: string, parser: MathParser, removeTilde: boolean = false) {
    console.log(eq);
    let parsedEquation = '';
    let options = { parenthesis: 'auto', implicit: 'hide' };
    try {
        parsedEquation = parser.math
            .parse(eq)
            .toTex(options)
            .replaceAll(/\\mathrm{(.)}/g, '$1');
    } catch (e) {
        try {
            let parsedEquations = eq.split('=').map((t) => {
                return parser.math
                    .parse(t)
                    .toTex(options)
                    .replaceAll(/\\mathrm{(.)}/g, '$1');
            });
            parsedEquation = parsedEquations.join('=');
        } catch (e) {
            return '';
        }
    }
    if (removeTilde) {
        parsedEquation = parsedEquation.replaceAll('~', '');
    }
    return parsedEquation;
}


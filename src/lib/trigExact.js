import { factory, isSymbolNode } from 'mathjs';
const name = 'trigExact';
const dependencies = [
    'typed',
    'config',
    'mathWithTransform',
    'matrix',
    '?fraction',
    '?bignumber',
    'AccessorNode',
    'ArrayNode',
    'ConstantNode',
    'FunctionNode',
    'IndexNode',
    'ObjectNode',
    'OperatorNode',
    'SymbolNode',
    'parse',
    'evaluate',
    'sin',
    'cos',
    'tan',
    'sec',
    'csc',
    'cot',
    'asin',
    'acos',
    'atan',
    'asec',
    'acsc',
    'acot',
    'equal',
    'unaryMinus',
];

function mod(n, m) {
    return ((n % m) + m) % m;
}

export const createTrigExact = /* #__PURE__ */ factory(
    name,
    dependencies,
    ({
        typed,
        config,
        mathWithTransform,
        matrix,
        fraction,
        bignumber,
        AccessorNode,
        ArrayNode,
        ConstantNode,
        FunctionNode,
        IndexNode,
        ObjectNode,
        OperatorNode,
        SymbolNode,
        parse,
        evaluate,
        sin,
        cos,
        tan,
        sec,
        csc,
        cot,
        asin,
        acos,
        atan,
        asec,
        acsc,
        acot,
        equal,
        unaryMinus,
    }) => {
        // |Radians|Degrees|sin|cos|tan|cot|sec|csc|
        // |---|---|---|---|---|---|---|---|
        // |$0$|$0^{\circ }$|$0$|$1$|$0$|Undefined|$1$|Undefined|
        // |${\frac {\pi }{12}}$|$15^{\circ }$|${\frac {{\sqrt {6}}-{\sqrt {2}}}{4}}$|${\frac {{\sqrt {6}}+{\sqrt {2}}}{4}}$|$2-{\sqrt {3}}$|$2+{\sqrt {3}}$|${\sqrt {6}}-{\sqrt {2}}$|${\sqrt {6}}+{\sqrt {2}}$|
        // |${\frac {\pi }{10}}$|$18^{\circ }$|${\frac {{\sqrt {5}}-1}{4}}$|${\frac {\sqrt {10+2{\sqrt {5}}}}{4}}$|${\frac {\sqrt {25-10{\sqrt {5}}}}{5}}$|${\sqrt {5+2{\sqrt {5}}}}$|${\frac {\sqrt {50-10{\sqrt {5}}}}{5}}$|${\sqrt {5}}+1$|
        // |${\frac {\pi }{8}}$|$22.5^{\circ }$|${\frac {\sqrt {2-{\sqrt {2}}}}{2}}$|${\frac {\sqrt {2+{\sqrt {2}}}}{2}}$|${\sqrt {2}}-1$|${\sqrt {2}}+1$|${\sqrt {4-2{\sqrt {2}}}}$|${\sqrt {4+2{\sqrt {2}}}}$|
        // |${\frac {\pi }{6}}$|$30^{\circ }$|${\frac {1}{2}}$|${\frac {\sqrt {3}}{2}}$|${\frac {\sqrt {3}}{3}}$|${\sqrt {3}}$|${\frac {2{\sqrt {3}}}{3}}$|$2$|
        // |${\frac {\pi }{5}}$|$36^{\circ }$|${\frac {\sqrt {10-2{\sqrt {5}}}}{4}}$|${\frac {{\sqrt {5}}+1}{4}}$|${\sqrt {5-2{\sqrt {5}}}}$|${\frac {\sqrt {25+10{\sqrt {5}}}}{5}}$|${\sqrt {5}}-1$|${\frac {\sqrt {50+10{\sqrt {5}}}}{5}}$|
        // |${\frac {\pi }{4}}$|$45^{\circ }$|${\frac {\sqrt {2}}{2}}$|${\frac {\sqrt {2}}{2}}$|$1$|$1$|${\sqrt {2}}$|${\sqrt {2}}$|
        // |${\frac {3\pi }{10}}$|$54^{\circ }$|${\frac {{\sqrt {5}}+1}{4}}$|${\frac {\sqrt {10-2{\sqrt {5}}}}{4}}$|${\frac {\sqrt {25+10{\sqrt {5}}}}{5}}$|${\sqrt {5-2{\sqrt {5}}}}$|${\frac {\sqrt {50+10{\sqrt {5}}}}{5}}$|${\sqrt {5}}-1$|
        // |${\frac {\pi }{3}}$|$60^{\circ }$|${\frac {\sqrt {3}}{2}}$|${\frac {1}{2}}$|${\sqrt {3}}$|${\frac {\sqrt {3}}{3}}$|$2$|${\frac {2{\sqrt {3}}}{3}}$|
        // |${\frac {3\pi }{8}}$|$67.5^{\circ }$|${\frac {\sqrt {2+{\sqrt {2}}}}{2}}$|${\frac {\sqrt {2-{\sqrt {2}}}}{2}}$|${\sqrt {2}}+1$|${\sqrt {2}}-1$|${\sqrt {4+2{\sqrt {2}}}}$|${\sqrt {4-2{\sqrt {2}}}}$|
        // |${\frac {2\pi }{5}}$|$72^{\circ }$|${\frac {\sqrt {10+2{\sqrt {5}}}}{4}}$|${\frac {{\sqrt {5}}-1}{4}}$|${\sqrt {5+2{\sqrt {5}}}}$|${\frac {\sqrt {25-10{\sqrt {5}}}}{5}}$|${\sqrt {5}}+1$|${\frac {\sqrt {50-10{\sqrt {5}}}}{5}}$|
        // |${\frac {5\pi }{12}}$|$75^{\circ }$|${\frac {{\sqrt {6}}+{\sqrt {2}}}{4}}$|${\frac {{\sqrt {6}}-{\sqrt {2}}}{4}}$|$2+{\sqrt {3}}$|$2-{\sqrt {3}}$|${\sqrt {6}}+{\sqrt {2}}$|${\sqrt {6}}-{\sqrt {2}}$|
        // |${\frac {\pi }{2}}$|$90^{\circ }$|$1$|$0$|Undefined|$0$|Undefined|$1$|

        let exactValueStrings = [
            ['0', '0', '0', '1', '0', 'Infinity', '1', 'Infinity'],
            [
                'pi / 12',
                '15',
                '(sqrt(6) - sqrt(2)) / 4',
                '(sqrt(6) + sqrt(2)) / 4',
                '2 - sqrt(3)',
                '2 + sqrt(3)',
                'sqrt(6) - sqrt(2)',
                'sqrt(6) + sqrt(2)',
            ],
            [
                'pi / 10',
                '18',
                '(sqrt(5) - 1) / 4',
                'sqrt(10 + 2 sqrt(5)) / 4',
                'sqrt(25 - 10 sqrt(5)) / 5',
                'sqrt(5 + 2 sqrt(5))',
                'sqrt(50 - 10 sqrt(5)) / 5',
                'sqrt(5) + 1',
            ],
            [
                'pi / 8',
                '22.5',
                'sqrt(2 - sqrt(2)) / 2',
                'sqrt(2 + sqrt(2)) / 2',
                'sqrt(2) - 1',
                'sqrt(2) + 1',
                'sqrt(4 - 2 sqrt(2))',
                'sqrt(4 + 2 sqrt(2))',
            ],
            [
                'pi / 6',
                '30',
                '1 / 2',
                'sqrt(3) / 2',
                'sqrt(3) / 3',
                'sqrt(3)',
                '2 sqrt(3) / 3',
                '2',
            ],
            [
                'pi / 5',
                '36',
                'sqrt(10 - 2 sqrt(5)) / 4',
                '(sqrt(5) + 1) / 4',
                'sqrt(5 - 2 sqrt(5))',
                'sqrt(25 + 10 sqrt(5)) / 5',
                'sqrt(5) - 1',
                'sqrt(50 + 10 sqrt(5)) / 5',
            ],
            [
                'pi / 4',
                '45',
                'sqrt(2) / 2',
                'sqrt(2) / 2',
                '1',
                '1',
                'sqrt(2)',
                'sqrt(2)',
            ],
            [
                '3 pi / 10',
                '54',
                '(sqrt(5) + 1) / 4',
                'sqrt(10 - 2 sqrt(5)) / 4',
                'sqrt(25 + 10 sqrt(5)) / 5',
                'sqrt(5 - 2 sqrt(5))',
                'sqrt(50 + 10 sqrt(5)) / 5',
                'sqrt(5) - 1',
            ],
            [
                'pi / 3',
                '60',
                'sqrt(3) / 2',
                '1 / 2',
                'sqrt(3)',
                'sqrt(3) / 3',
                '2',
                '2 sqrt(3) / 3',
            ],
            [
                '3 pi / 8',
                '67.5',
                'sqrt(2 + sqrt(2)) / 2',
                'sqrt(2 - sqrt(2)) / 2',
                'sqrt(2) + 1',
                'sqrt(2) - 1',
                'sqrt(4 + 2 sqrt(2))',
                'sqrt(4 - 2 sqrt(2))',
            ],
            [
                '2 pi / 5',
                '72',
                'sqrt(10 + 2 sqrt(5)) / 4',
                '(sqrt(5) - 1) / 4',
                'sqrt(5 + 2 sqrt(5))',
                'sqrt(25 - 10 sqrt(5)) / 5',
                'sqrt(5) + 1',
                'sqrt(50 - 10 sqrt(5)) / 5',
            ],
            [
                '5 pi / 12',
                '75',
                '(sqrt(6) + sqrt(2)) / 4',
                '(sqrt(6) - sqrt(2)) / 4',
                '2 + sqrt(3)',
                '2 - sqrt(3)',
                'sqrt(6) + sqrt(2)',
                'sqrt(6) - sqrt(2)',
            ],
            ['pi / 2', '90', '1', '0', 'Infinity', '0', 'Infinity', '1'],
        ];

        let exactValues = exactValueStrings.map((row) => {
            return {
                radians: evaluate(row[0]),
                degrees: parseFloat(row[1]),
                sin: parse(row[2]),
                cos: parse(row[3]),
                tan: parse(row[4]),
                cot: parse(row[5]),
                sec: parse(row[6]),
                csc: parse(row[7]),
            };
        });

        let trigFunctionNames = new Set([
            'sin',
            'cos',
            'tan',
            'sec',
            'csc',
            'cot',
        ]);

        let inverseTrigFunctionNames = new Set([
            'asin',
            'acos',
            'atan',
            'asec',
            'acsc',
            'acot',
        ]);

        let trigFunctions = {
            sin,
            cos,
            tan,
            sec,
            csc,
            cot,
            asin,
            acos,
            atan,
            asec,
            acsc,
            acot,
        };

        const trigExact = typed('trigExact', {
            'string, ...any': function (str, options = {}) {
                return trigExact(parse(str));
            },
            'Node, ...any': function (node, options = {}) {
                if (trigFunctionNames.has(node.name) && !isSymbolNode(node)) {
                    let argValue = node.args[0].compile().evaluate();
                    if (node.name === 'tan' || node.name === 'cot') {
                        argValue = mod(argValue, Math.PI);

                        let exactValue = exactValues.find((value) =>
                            equal(value.radians, argValue),
                        );
                    } else {
                        console.log('argValue', argValue);
                        argValue = mod(argValue, 2 * Math.PI);
                        console.log('argValue', argValue);

                        let exactValue = exactValues.find((value) =>
                            equal(value.radians, argValue),
                        );

                        if (exactValue) {
                            return exactValue[node.name];
                        }

                        if (node.name === 'sin' || node.name === 'csc') {
                            console.log('argValue', Math.PI - argValue);
                            exactValue = exactValues.find((value) =>
                                equal(
                                    value.radians,
                                    mod(Math.PI - argValue, Math.PI * 2),
                                ),
                            );

                            if (exactValue) {
                                return exactValue[node.name];
                            }

                            console.log('argValue', -argValue);
                            exactValue = exactValues.find((value) =>
                                equal(
                                    value.radians,
                                    mod(-argValue, Math.PI * 2),
                                ),
                            );

                            if (exactValue) {
                                return new OperatorNode(
                                    '-',
                                    'unaryMinus',
                                    [exactValue[node.name]],
                                    false,
                                );
                            }
                        } else if (node.name === 'cos' || node.name === 'sec') {
                            console.log('argValue', -argValue);
                            exactValue = exactValues.find((value) =>
                                equal(
                                    value.radians,
                                    mod(-argValue, Math.PI * 2),
                                ),
                            );

                            if (exactValue) {
                                return exactValue[node.name];
                            }

                            console.log('argValue', Math.PI - argValue);
                            exactValue = exactValues.find((value) =>
                                equal(
                                    value.radians,
                                    mod(Math.PI - argValue, Math.PI * 2),
                                ),
                            );

                            if (exactValue) {
                                return new OperatorNode(
                                    '-',
                                    'unaryMinus',
                                    [exactValue[node.name]],
                                    false,
                                );
                            }
                        }
                    }
                } else if (
                    inverseTrigFunctionNames.has(node.name) &&
                    !isSymbolNode(node)
                ) {
                    let exactValue = exactValues.find((value) =>
                        equal(
                            value[node.name],
                            node.args[0].compile().evaluate(),
                        ),
                    );
                    if (exactValue) {
                        return exactValue.radians;
                    }
                }
                // console.log(node);
                // node.map((child) => {
                //     console.log('chi', child);
                //     return child;
                // });
                return node.map((child) => trigExact(child, options));
            },
        });

        return trigExact;
    },
);

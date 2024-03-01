import { latexizeEquation } from '$lib/MathParser.js';
import { Store } from 'tauri-plugin-store-api';
import { parser } from '$lib';

type HistoryRow =
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
    };

class CalculationHistory {
    private history: HistoryRow[] = [];
    private scopeHistory: any[] = [];
    private redoHistory: HistoryRow[] = [];
    private scopeRedoHistory: any[] = [];
    public store: Store;
    public switch: boolean = false;

    constructor() {
        this.store = new Store('.history.dat');
    }

    async init() {
        this.history = await this.store.get('history') ?? [];
        this.scopeHistory = await this.store.get('scopeHistory') ?? [];
        this.redoHistory = await this.store.get('redoHistory') ?? [];
        this.scopeRedoHistory = await this.store.get('scopeRedoHistory') ?? [];
    }

    async update() {
        this.store.set('history', this.history);
        this.store.set('scopeHistory', this.scopeHistory);
        this.store.set('redoHistory', this.redoHistory);
        this.store.set('scopeRedoHistory', this.scopeRedoHistory);

        console.log('update', this.history, this.scopeHistory, this.redoHistory, this.scopeRedoHistory);
    }

    async add(expr: string, result: string = '') {
        this.history.push(latexizeHistoryRow([expr, result]));
        this.scopeHistory.push(parser.scope);

        this.store.set('history', this.history);
        this.store.set('scopeHistory', this.scopeHistory);

        this.scopeHistory = await this.store.get('scopeHistory') ?? [];

        console.log('add', expr, result, this.history, this.scopeHistory, parser.scope);

        // Clear redo history
        this.store.set('redoHistory', []);
        this.store.set('scopeRedoHistory', []);
        this.redoHistory = [];
        this.scopeRedoHistory = [];

        this.store.save();
    }

    async undo() {
        if (this.history.length > 0) {
            this.redoHistory.push(this.history.pop()!);
            this.store.set('history', this.history);
            this.store.set('redoHistory', this.redoHistory);

            this.scopeRedoHistory.push(this.scopeHistory.pop()!);
            this.store.set('scopeHistory', this.scopeHistory);
            this.store.set('scopeRedoHistory', this.scopeRedoHistory);

            parser.scope = this.scopeHistory[this.scopeHistory.length - 1];

            console.log('undo', this.history, this.scopeHistory, this.redoHistory, this.scopeRedoHistory, parser.scope);

            this.store.save();
        }
    }

    async redo() {
        if (this.redoHistory.length > 0) {
            this.history.push(this.redoHistory.pop()!);
            this.store.set('history', this.history);
            this.store.set('redoHistory', this.redoHistory);

            this.scopeHistory.push(this.scopeRedoHistory.pop()!);
            this.store.set('scopeHistory', this.scopeHistory);
            this.store.set('scopeRedoHistory', this.scopeRedoHistory);

            parser.scope = this.scopeHistory[this.scopeHistory.length - 1];

            console.log('redo', this.history, this.scopeHistory, this.redoHistory, this.scopeRedoHistory, parser.scope);

            this.store.save();
        }
    }

    async clearall() {
        this.history = [];
        this.scopeHistory = [];
        this.redoHistory = [];
        this.scopeRedoHistory = [];

        this.store.set('history', this.history);
        this.store.set('scopeHistory', this.scopeHistory);
        this.store.set('redoHistory', this.redoHistory);
        this.store.set('scopeRedoHistory', this.scopeRedoHistory);

        parser.scope = {};

        this.store.save();
    }

    get lastCalculationText() {
        let i = this.history.length - 1;
        while (i >= 0) {
            let row = this.history[i];
            if (row instanceof Array) {
                return [row[0].plain, row[1].plain];
            }
            i--;
        }
        return ['', ''];
    }

    get latexHistory() {
        return this.history;
    }

    at(index: number) {
        return this.history[index];
    }

    get length() {
        return this.history.length;
    }

    lastTextByIndex(index: number) {
        let lastRow = this.history[this.history.length - index];

        console.log('lastRow', lastRow);

        if (lastRow instanceof Array) {
            return [lastRow[0].plain, lastRow[1].plain];
        } else {
            return [`#${lastRow.dims[0]}x${lastRow.dims[1]}`, '#table'];
        }
    }
}

export const history = new CalculationHistory();

function latexizeHistoryRow(row: [string, string]): HistoryRow {

    let [equation, result] = row;

    if (equation[0] === '#') {
        let [r, c] = equation
            .slice(1)
            .split(/x|X|\*|,/)
            .map((x) => parseInt(x));
        return {
            dims: [r, c],
            rowHeaders: Array(r).fill(''),
            colHeaders: Array(c).fill(''),
            table: Array.from({ length: r }, () => Array(c).fill('')),
        };
    }

    if (equation.trim().startsWith('del ')) {
        equation = equation.slice(4);
        return [
            {
                latex: `\\text{ᴅᴇʟ }${equation}`,
                plain: `del ${equation}`,
            },
            {
                latex: '',
                plain: '',
            },
        ];
    }

    let parsedEquation = latexizeEquation(equation, parser, true);

    let parsedResult = latexizeEquation(result, parser, true);

    parsedEquation = parsedEquation.replace(/\\*_prime/g, "'");
    parsedResult = parsedResult.replace(/\\*_prime/g, "'");

    return [
        {
            latex: equation !== '' ? parsedEquation : '',
            plain: equation,
        },
        {
            latex: result !== '' ? parsedResult : '',
            plain: result,
        },
    ];
}

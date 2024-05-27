// https://stackoverflow.com/questions/3972014/get-contenteditable-caret-position

/**
 * Walks through the DOM tree starting from a given node, applying a function to each node.
 * Stops the walk if the function returns false.
 *
 * @param node - The starting DOM Node for the walk.
 * @param func - A callback function that is applied to each node. Should return false to stop the walk.
 * @returns The result of the last function call or undefined.
 */
function nodeWalk(node: Node, func: (n: Node) => boolean | void): boolean | void {
    let result = func(node);
    for (let current = node.firstChild; result !== false && current; current = current.nextSibling) {
        result = nodeWalk(current, func);
    }
    return result;
}

/**
 * Retrieves the caret position within an element's textContent as a start and end offset.
 * If start and end are equal, the caret is at a given position without any text selection.
 *
 * @param elem - The element within which to find the caret position.
 * @returns A tuple [start, end] representing the offsets within elem.textContent, or undefined if out of bounds.
 */
export function getCaretPosition(elem: HTMLElement): [number, number] | undefined {
    const sel = window.getSelection();
    let cumLength = [0, 0];

    if (sel && elem.contains(sel.anchorNode) && elem.contains(sel.focusNode)) {
        const nodesToFind = [sel.anchorNode, sel.focusNode];
        let found = [false, false];

        nodeWalk(elem, (node) => {
            nodesToFind.forEach((findNode, index) => {
                if (node === findNode) {
                    found[index] = true;
                    if (found[index ? 0 : 1]) {
                        return false; // All nodes found, stop walking
                    }
                }
            });

            if (node.textContent && !node.firstChild) {
                nodesToFind.forEach((_, index) => {
                    if (!found[index]) cumLength[index] += node.textContent!.length;
                });
            }
        });

        cumLength[0] += sel.anchorOffset;
        cumLength[1] += sel.focusOffset;

        if (cumLength[0] > cumLength[1]) {
            [cumLength[0], cumLength[1]] = [cumLength[1], cumLength[0]]; // Swap if out of order
        }
        return cumLength as [number, number];
    }

    return undefined; // Selection out of element bounds
}

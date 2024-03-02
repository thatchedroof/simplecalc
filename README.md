# [Simplecalc](https://github.com/thatchedroof/simplecalc/releases/latest)

Simplecalc is a desktop calculator for students working on algebra.

## Calculations

Simplecalc uses [mathjs](https://mathjs.org/) to parse your equations; see the [functions](https://mathjs.org/docs/reference/functions.html) and [syntax](https://mathjs.org/docs/expressions/syntax.html) documentation to get started. In addition to simple calculations (like $4^2 + 2$), the mathjs backend allows for variables ($x=3$) and function declaration ($f(x)=x^2+3x-1$). Because simplecalc is meant to be used for learning, algebraic simplification and derivative functions have been disabled.

## Features

Simplecalc has many additional features on top of mathjs:

### History

The calculation history is preserved on closing and reopening. Previous calculations can be accessed with the up and down arrows or by clicking on equations to copy.

### Ans

The previous calculation is stored in the variable $ans$.

``` math
\displaylines{3+9-4~~~~~(8) \\
ans+7~~~~~~(15)}
```

### Algebra

Simplecalc allows the user to keep a history of equations to aid in the process of solving, although it doesn't do any solving itself.

``` math
\displaylines{(x+2)^2-3~~~~~~ \\
x^2+4x+4-3 \\
x^2+4x+1~~~~~~~ \\}
```

### 'Func' call

Any algebraic equations will be implicitly parsed as a function (stored as 'func') that can be called in future calculations.

``` math
\displaylines{3x^2-5y+\sin(z) \\
\text{func}(3, 4, \frac{\pi}{2})~~~~(8)}
```

> $\text{func}(3, 4, \frac{\pi}{2})$ is evaluated as $3(3)^2-5(4)+\sin(\frac{\pi}{2})$.

### Tables

Inputting $\text{\\#row,column}$ (like $\\# 3,2$) will show a table, which can then be used for things like polynomial multiplication. The table can be traversed using the arrow keys.

$\\# 2,2$
| $\times$ | $2x^2$ |  $2$  |
| :------: | :----: | :---: |
|   $x$    | $2x^3$ | $2x$  |
|   $3$    | $6x^2$ |  $6$  |

### Del

The $\text{del}$ keyword allows the user to delete a variable from scope.

``` math
\displaylines{x=3~~~~~~~~~~~~~~ \\
x+4~~~(7)~~~~~~~ \\
\text{del}~x~~~~~~~~~~~~~~~~ \\
x-5~~~(\text{error})}
```

### Undo/Redo

Inputting $\text{undo}$ or $\text{redo}$ undoes/redoes the last command.

### Clearall

Inputting $\text{clearall}$ erases the entire calculation history.

## Known issues

-   [ ] Parentheses work weirdly sometimes in edit mode
-   [ ] Functions don't save to history
-   [ ] Copy/paste doesn't work for tables in edit mode

## Upcoming features

-   [ ] Displaying derivatives
-   [ ] Exact answers for fractions and trig functions
-   [ ] deg/rad mode
-   [ ] Better undo/redo
-   [ ] Visually replacing $\text{func}$ calls
-   [ ] Charts and graphs

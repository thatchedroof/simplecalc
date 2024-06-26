-   [x] Up and down arrows to access history
-   [x] Allow removing variable from scope (del x?)
-   [x] Preserved history across instances
-   [x] Undo/redo function in edit mode
-   [ ] Dates in history?
-   [ ] Multiple responses with `;` on new lines
-   [ ] Equation mode shouldn't work with undefined functions (like foo(x))
-   [ ] LatexOCR + [tex-math-parser](https://github.com/davidtranhq/tex-math-parser)
-   [x] Colored brackets
-   [x] `f' -> f_prime`
-   [ ] Infinite scroll with scroll to bottom icon
-   [x] Persistent storage using tauri-plugin-store-api
-   [ ] Use the mobile alpha version to make an app
-   [x] Use window vibrancy (mica or acrylic) and [more plugins](https://github.com/tauri-apps/awesome-tauri?tab=readme-ov-file)
-   [ ] `deg sin(x)` or `rad sin(x)`
-   [x] Visually replace `func()` calls with math.resolve()
-   [ ] Multiple undo and redo with ctrl+z, both undoing text input and undoing calculations
-   [x] SimplifyConstants function that doesn't collapse functions or constants (like `sqrt(2)` or `3pi`)
-   [x] Allow copying and pasting in table mode when editMode isn't on
-   [ ] Allow adding function to scope history
-   [ ] Parentheses should be implicitly added to beginning and end of equation
-   [ ] Fix multiline textbox weirdness
-   [x] Fix overlay weirdness
-   [ ] Fix broken doubletap
-   [ ] Shortcut for quick arithmetic calculations
-   [ ] Use [this](https://docs.sympy.org/latest/modules/simplify/fu.html#sympy.simplify.fu.TR0) algorithm for trig
-   [ ] Fix trig to accept a range outside of $[0,\frac{\pi}{2}]$
-   [ ] Use the desmos api for plotting (user will need to provide own api key)
-   [ ] Could use [tauri-settings](https://github.com/harshkhandeparkar/tauri-settings), especially for desmos api key
-   [ ] Handle infinite arithmetic ($\frac{x}{0}$ should be undef, not $\infty$; $\frac{0}{0}$ should be $\bot$ (maybe $\frac{0}{0}$ in simplify mode?))
-   [ ] Handle infinite inputs to functions (like $\ln\left(\infty\right)=\infty$) and indeterminate forms (like $0-\infty$)
-   [ ] Shortcut to reorder additive or multiplicative equations (lik8\cdot f(x)\cdot -x^2$ to $-8x^2\cdot f(x)$) (and cross-multiply?)
-   [ ] $-\frac{n}{m}$ should be displayed better in latex
-   [ ] Pressing unmatched `)` should put `(` at beginning
-   [x] Better math for alt+d (`x/1` or `x*1 -> x`, handle `(x/y)/(z/w)` and `x/y/z`)
-   [ ] alt+c should be able to do functions with non-whole results (other shortcut for simplification?)
-   [ ] Fix broken display for $\mathrm{acos}(y)=x$
-   [ ] Delete `\mathrm` when copying as latex
-   [ ] Something like `x_2` should be displayed as $x_2$
-   [ ] `!` functions should work with variables & expressions
-   [x] Set notation, like $\{3,1\}^2+\{2,5\}-1$ is checked for all possibilities
-   [ ] Syntax highlighting in type mode
-   [ ] Set notation should be arraylike with functions like $\mathrm{max}$, unless is a set of arrays

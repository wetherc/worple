#!/bin/bash

# Ensure terser is installed globally: pnpm add -g terser

# Minify script.js
terser script.js -o script.min.js -c -m

echo "script.js minified to script.min.js"

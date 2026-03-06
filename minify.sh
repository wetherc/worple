#!/usr/bin/env bash

# Ensure terser is installed globally: pnpm install -g terser
terser script.js -o script.min.js -c drop_console=true -m toplevel=true --source-map

echo "script.js minified to script.min.js"

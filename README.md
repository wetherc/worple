# Worple: A Wordle Clone

This is a simple, lightweight clone of the popular word game Wordle, built with vanilla JavaScript. It offers the core Wordle experience along with several additional features for tracking your performance.

## Features

*   **Classic Wordle Gameplay:** You have 6 tries to guess the 5-letter word.
*   **Game History:** Your past games are saved locally in your browser.
*   **Detailed Statistics:** Track your wins, losses, and current win streak.
*   **Guess Distribution:** See a chart of how many guesses it takes you to solve the puzzle.
*   **No Fluff:**
    *   Pure vanilla JavaScript with no external dependencies.
    *   No tracking, analytics, or ads.
    *   No sign-ups or login required. Your game data is stored in your browser's local storage.

## How to Play

The easiest way to play is to visit the hosted version of the game. If you want to run it locally, follow these instructions:

1.  Clone this repository:
    ```bash
    git clone https://github.com/your-username/worple.git
    cd worple
    ```
2.  Start a local web server. This project includes a simple script to do this using Python:
    ```bash
    ./start-server.sh
    ```
    This will start a server on `http://localhost:8000`.
3.  Open `http://localhost:8000` in your web browser.

## Development

The application uses a minified JavaScript file (`script.min.js`) for performance. If you make changes to `script.js`, you'll need to minify it.

### Setup

1.  Install `terser` globally using `pnpm`:
    ```bash
    pnpm install -g terser
    ```

2.  Run the minify script:
    ```bash
    ./minify.sh
    ```

### Auto-Minify with a Pre-commit Hook

To automatically minify the JavaScript file every time you make a commit, you can set up a pre-commit hook.

1.  Create a new file named `pre-commit` inside the `.git/hooks` directory:
    ```bash
    touch .git/hooks/pre-commit
    ```

2.  Make the script executable:
    ```bash
    chmod +x .git/hooks/pre-commit
    ```

3.  Add the following content to the `.git/hooks/pre-commit` file:
    ```bash
    #!/bin/sh
    ./minify.sh
    git add script.min.js script.min.js.map
    ```

Now, the `minify.sh` script will run automatically before each commit.

## Source Dictionary

The `words.json.gz` array comes from Donald Knuth's GraphBase list of five-letter words[1].

[1] — Knuth, Donald. The Stanford GraphBase: A Platform for Combinatorial Computing. New York: ACM Press, 1994. <http://www-cs-faculty.stanford.edu/~knuth/sgb.html>

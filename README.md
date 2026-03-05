# Worple, a dumb Wordle clone

This is a simple clone of the popular word game Wordle.

## How to Play

1.  Open the `index.html` file in your web browser.
2.  You have 6 tries to guess the 5-letter word.
3.  Type your guess and press Enter.
4.  The color of the tiles will change to show how close your guess was to the word.
    -   **Green:** The letter is in the word and in the correct spot.
    -   **Yellow:** The letter is in the word but in the wrong spot.
    -   **Gray:** The letter is not in the word in any spot.

## Source dictionary

The `words.json.gz` array comes from Donald Knuth's GraphBase list of five-letter words[1]


[1] — Knuth, Donald. The Stanford GraphBase: A Platform for Combinatorial Computing. New York: ACM Press, 1994. <http://www-cs-faculty.stanford.edu/~knuth/sgb.html>

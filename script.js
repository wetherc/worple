class TrieNode {
    constructor() {
        this.children = {};
        this.difficulty = null; // Stores difficulty (0, 1, or 2) if it's an end of word
    }
}

class Trie {
    constructor() {
        this.root = new TrieNode();
    }

    insert(word, difficulty) {
        let currentNode = this.root;
        for (let i = 0; i < word.length; i++) {
            const char = word[i];
            if (!currentNode.children[char]) {
                currentNode.children[char] = new TrieNode();
            }
            currentNode = currentNode.children[char];
        }
        currentNode.difficulty = difficulty;
    }

    search(word) {
        let currentNode = this.root;
        for (let i = 0; i < word.length; i++) {
            const char = word[i];
            if (!currentNode.children[char]) {
                return null; // Word not found
            }
            currentNode = currentNode.children[char];
        }
        return currentNode.difficulty; // Return the difficulty if it's a word, otherwise null
    }
}

let allWordsWithDifficulty = [];
let filteredWordList = [];
let dictionary = new Trie();
let letterStates = {};
let sidebarState = {
    currentPage: 1,
    pageSize: 2
};

let state = {
    secret: "",
    grid: Array(6)
        .fill()
        .map(() => Array(5).fill("")),
    results: Array(6)
        .fill()
        .map(() => Array(5).fill("")),
    currentRow: 0,
    currentCol: 0,
    selectedDifficulty: 1, // Default difficulty to "Most Words"
    canDismissModal: false, // New flag to control modal dismissal
};

async function startup() {
    const res = await fetch("words.json.gz");
    const decompressedResponse = new Response(res.body.pipeThrough(new DecompressionStream('gzip')));
    allWordsWithDifficulty = await decompressedResponse.json();

    applyDifficultyFilter();

    const game = document.getElementById("game-board");
    const keyboard = document.getElementById("keyboard");
    drawGrid(game);
    drawKeyboard(keyboard);
    registerKeyboardEvents();
    displayStats();
    registerDifficultyChangeListener(); // New function to handle difficulty changes
    registerModalDismissalEvents();
}

function applyDifficultyFilter() {
    // Filter words based on selected difficulty
    filteredWordList = allWordsWithDifficulty
        .filter(item => item.difficulty <= state.selectedDifficulty)
        .map(item => item.word);

    // Clear and rebuild the dictionary with filtered words
    dictionary = new Trie(); // Reset the trie
    filteredWordList.forEach(word => dictionary.insert(word, state.selectedDifficulty)); // Use a placeholder difficulty for simplicity here, actual difficulty is in allWordsWithDifficulty

    // Select a new secret word from the filtered list
    state.secret = filteredWordList[Math.floor(Math.random() * filteredWordList.length)];
}

function updateKeyboard() {
    for (const key in letterStates) {
        const keyElement = document.querySelector(`[data-key="${key}"]`);
        if (keyElement) {
            keyElement.classList.remove('correct', 'present', 'absent');
            keyElement.classList.add(letterStates[key]);
        }
    }
}

function drawGrid(container) {
    for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 5; j++) {
            drawTile(container, i, j);
        }
    }
}

function updateGrid() {
    for (let i = 0; i < state.grid.length; i++) {
        for (let j = 0; j < state.grid[i].length; j++) {
            const tile = document.getElementById(`tile${i}${j}`);
            tile.textContent = state.grid[i][j];
        }
    }
}

function drawTile(container, row, col, letter = "") {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.id = `tile${row}${col}`;
    tile.textContent = letter;
    container.appendChild(tile);
    return tile;
}

function registerKeyboardEvents() {
    document.body.onkeydown = (e) => {
        const key = e.key;
        handleKey(key.toLowerCase());
    };
}

function getCurrentWord() {
    return state.grid[state.currentRow].reduce((prev, curr) => prev + curr);
}

function isWordValid(word) {
    return dictionary.search(word) !== null;
}

function revealWord(guess) {
    const row = state.currentRow;
    const animation_duration = 500;

    const guessResult = checkGuess(guess, state.secret);
    state.results[row] = guessResult;

    for (let i = 0; i < 5; i++) {
        const tile = document.getElementById(`tile${row}${i}`);
        const letter = guess[i];
        const newState = guessResult[i];

        tile.classList.add(newState);

        const currentState = letterStates[letter];
        if (currentState === 'correct') {
            // do nothing
        } else if (currentState === 'present' && newState !== 'correct') {
            // do nothing
        } else {
            letterStates[letter] = newState;
        }

        tile.classList.add("animated");
        tile.style.animationDelay = `${(i * animation_duration) / 2}ms`;
    }
    updateKeyboard();


    const isWinner = state.secret === guess;
    const isGameOver = state.currentRow === 5;

    setTimeout(() => {
        const stats = getStats();
        let guesses = row + 1;

        if (isWinner) {
            stats.wins++;
            stats.currentStreak++;
            if (stats.currentStreak > stats.maxStreak) {
                stats.maxStreak = stats.currentStreak;
            }
            stats.guesses[guesses]++;
            showModal("Congratulations!", true, false);
        } else if (isGameOver) {
            stats.currentStreak = 0;
            stats.guesses.fail++;
            showModal(`You lost! The word was ${state.secret}.`, true, false);
        }

        if (isWinner || isGameOver) {
            stats.gamesPlayed++;
            const game = {
                secretWord: state.secret,
                guesses: state.grid.slice(0, guesses).map(row => [...row]),
                results: state.results.slice(0, guesses).map(row => [...row]),
                win: isWinner,
                difficulty: dictionary.search(state.secret) // Store the difficulty
            };
            stats.history.push(game);
            if (stats.history.length > 10) {
                stats.history.shift();
            }
        }

        saveStats(stats);
        displayStats();
    }, 3 * animation_duration);
}

function checkGuess(guess, secret) {
    const result = [];
    const secretLetterCount = {};

    for (const letter of secret) {
        secretLetterCount[letter] = (secretLetterCount[letter] || 0) + 1;
    }

    for (let i = 0; i < 5; i++) {
        if (guess[i] === secret[i]) {
            result[i] = 'correct';
            secretLetterCount[guess[i]]--;
        }
    }

    for (let i = 0; i < 5; i++) {
        if (result[i]) continue;

        if (secret.includes(guess[i]) && secretLetterCount[guess[i]] > 0) {
            result[i] = 'present';
            secretLetterCount[guess[i]]--;
        } else {
            result[i] = 'absent';
        }
    }

    return result;
}

function isLetter(key) {
    return key.length === 1 && key.match(/[a-z]/i);
}

function addLetter(letter) {
    if (state.currentCol === 5) return;
    state.grid[state.currentRow][state.currentCol] = letter;
    state.currentCol++;
}

function removeLetter() {
    if (state.currentCol === 0) return;
    state.grid[state.currentRow][state.currentCol - 1] = "";
    state.currentCol--;
}

function drawKeyboard(container) {
    const keyboardRows = [
        ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
        ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
        ["enter", "z", "x", "c", "v", "b", "n", "m", "backspace"]
    ];

    keyboardRows.forEach(row => {
        const rowElement = document.createElement("div");
        rowElement.className = "keyboard-row";
        row.forEach(key => {
            const keyElement = document.createElement("button");
            keyElement.className = "key";
            keyElement.textContent = key;
            keyElement.setAttribute("data-key", key);
            if (key.length > 1) {
                keyElement.style.width = "100px";
            }
            keyElement.addEventListener("click", () => {
                handleKey(key);
            });
            rowElement.appendChild(keyElement);
        });
        container.appendChild(rowElement);
    });
}

function handleKey(key) {
    if (key === "enter") {
        if (state.currentCol === 5) {
            const word = getCurrentWord();
            if (isWordValid(word)) {
                revealWord(word);
                state.currentRow++;
                state.currentCol = 0;
            } else {
                showTemporaryMessage("Not a valid word.");
            }
        }
    }
    if (key === "backspace") {
        removeLetter();
    }
    if (isLetter(key)) {
        addLetter(key);
    }
    updateGrid();
}

function showTemporaryMessage(message) {
    showModal(message, false, true); // Display message with "Okay" button, without "Play Again" button
    setTimeout(() => {
        hideModal();
    }, 2000); // Hide after 2 seconds
}

function registerDifficultyChangeListener() {
    const difficultySelect = document.getElementById("difficulty");
    difficultySelect.addEventListener("change", (event) => {
        state.selectedDifficulty = parseInt(event.target.value);
        applyDifficultyFilter();
        resetGame(); // Reset the game when difficulty changes
    });
}

function showModal(message, showPlayAgainButton = true, showOkayButton = false) {
    const modalContainer = document.getElementById("modal-container");
    const modalMessage = document.getElementById("modal-message");
    const playAgainButton = document.getElementById("play-again-button");
    const modalOkayButton = document.getElementById("modal-okay-button");

    modalMessage.textContent = message;
    playAgainButton.style.display = showPlayAgainButton ? "block" : "none";
    modalOkayButton.style.display = showOkayButton ? "block" : "none";
    modalContainer.style.display = "flex";
    // Add a small delay before adding the class to ensure the display change is registered
    setTimeout(() => {
        modalContainer.classList.add("modal-show");
        // Allow dismissal after a minimum display time
        setTimeout(() => {
            state.canDismissModal = true;
        }, 1000); // 1 second delay
    }, 10);
}

function hideModal() {
    state.canDismissModal = false; // Prevent dismissal while hiding
    const modalContainer = document.getElementById("modal-container");
    modalContainer.classList.remove("modal-show");
    // Wait for the transition to finish before setting display to none
    modalContainer.addEventListener('transitionend', function handler() {
        modalContainer.style.display = "none";
        modalContainer.removeEventListener('transitionend', handler);
    });
}

function registerModalDismissalEvents() {
    const modalContainer = document.getElementById("modal-container");
    const modal = document.getElementById("modal");

    // Dismissal by Escape/Enter key
    document.addEventListener("keydown", (e) => {
        const playAgainButton = document.getElementById("play-again-button");
        if ((e.key === "Escape" || e.key === "Enter") && modalContainer.style.display === "flex" && playAgainButton.style.display !== "none" && state.canDismissModal) {
            hideModal();
        }
    });

    // Dismissal by clicking outside the modal content
    modalContainer.addEventListener("click", (e) => {
        if (e.target === modalContainer && state.canDismissModal) {
            hideModal();
        }
    });
}

function resetGame() {
    state.grid = Array(6)
        .fill()
        .map(() => Array(5).fill(""));
    state.results = Array(6)
        .fill()
        .map(() => Array(5).fill(""));
    state.currentRow = 0;
    state.currentCol = 0;
    state.secret = filteredWordList[Math.floor(Math.random() * filteredWordList.length)];

    const gameBoard = document.getElementById("game-board");
    gameBoard.innerHTML = '';
    drawGrid(gameBoard);

    const keys = document.querySelectorAll(".key");
    keys.forEach(key => {
        key.classList.remove("correct", "present", "absent");
    });

    letterStates = {};
    hideModal();
}

document.getElementById("play-again-button").addEventListener("click", resetGame);
document.getElementById("modal-okay-button").addEventListener("click", hideModal);

document.getElementById("prev-page-button").addEventListener("click", previousPage);
document.getElementById("next-page-button").addEventListener("click", nextPage);

function previousPage() {
    if (sidebarState.currentPage > 1) {
        sidebarState.currentPage--;
        displayStats();
    }
}

function nextPage() {
    const stats = getStats();
    const totalPages = Math.ceil(stats.history.length / sidebarState.pageSize);
    if (sidebarState.currentPage < totalPages) {
        sidebarState.currentPage++;
        displayStats();
    }
}


function displayStats() {
    const stats = getStats();
    const statsContent = document.getElementById("stats-content");
    statsContent.innerHTML = `
        <div class="stats-grid">
            <div class="stat-item">
                <div class="stat-value">${stats.gamesPlayed}</div>
                <div class="stat-label">Played</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${stats.wins}</div>
                <div class="stat-label">Wins</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${stats.currentStreak}</div>
                <div class="stat-label">Streak</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${stats.maxStreak}</div>
                <div class="stat-label">Max Streak</div>
            </div>
        </div>
        <h3>Guess Distribution</h3>
        <div class="histogram-container">
            ${[1, 2, 3, 4, 5, 6, "Fail"].map(num => {
                const count = num === "Fail" ? stats.guesses.fail : stats.guesses[num];
                const percentage = stats.gamesPlayed > 0 ? (count / stats.gamesPlayed) * 100 : 0;
                return `
                    <div class="histogram-row">
                        <div class="histogram-label">${num}</div>
                        <div class="histogram-bar-container">
                            <div class="histogram-bar" style="width: ${percentage}%;">${count}</div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;

    const recentGamesContent = document.getElementById("recent-games-content");
    recentGamesContent.innerHTML = "";
    const reversedHistory = [...stats.history].reverse();

    const startIndex = (sidebarState.currentPage - 1) * sidebarState.pageSize;
    const endIndex = startIndex + sidebarState.pageSize;
    const paginatedHistory = reversedHistory.slice(startIndex, endIndex);

    paginatedHistory.forEach(game => {
        const gameElement = document.createElement("div");
        gameElement.classList.add("game");

        let gameGrid = '<div class="game-grid">';
        if (game.guesses) {
            for(let i = 0; i < game.guesses.length; i++) {
                gameGrid += '<div class="guess-row">';
                if (game.guesses[i]) {
                    for(let j = 0; j < game.guesses[i].length; j++) {
                        const result = (game.results && game.results[i] && game.results[i][j]) ? game.results[i][j] : '';
                        const letter = game.guesses[i][j] ? game.guesses[i][j] : '';
                        gameGrid += `<div class="tile ${result}">${letter}</div>`;
                    }
                }
                gameGrid += '</div>';
            }
        }
        gameGrid += '</div>';

        gameElement.innerHTML = `
            <p>Word: ${game.secretWord} (Difficulty: ${game.difficulty}) (${game.win ? 'Win' : 'Loss'})</p>
            ${gameGrid}
        `;
        recentGamesContent.appendChild(gameElement);
    });

    const pageInfo = document.getElementById("page-info");
    const totalPages = Math.ceil(stats.history.length / sidebarState.pageSize);
    pageInfo.textContent = `Page ${sidebarState.currentPage} of ${totalPages}`;

    const prevButton = document.getElementById("prev-page-button");
    const nextButton = document.getElementById("next-page-button");
    prevButton.disabled = sidebarState.currentPage === 1;
    nextButton.disabled = sidebarState.currentPage === totalPages;
}


function getStats() {
    const stats = localStorage.getItem("wordle-stats");
    return stats ? JSON.parse(stats) : {
        gamesPlayed: 0,
        wins: 0,
        currentStreak: 0,
        maxStreak: 0,
        guesses: {
            1: 0,
            2: 0,
            3: 0,
            4: 0,
            5: 0,
            6: 0,
            fail: 0
        },
        history: []
    };
}

function saveStats(stats) {
    localStorage.setItem("wordle-stats", JSON.stringify(stats));
}


startup();

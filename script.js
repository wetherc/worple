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

// --- Constants ---
const NUM_ROWS = 6;
const NUM_COLS = 5;
const ANIMATION_DURATION_MS = 500;
const HISTORY_MAX_LENGTH = 10;
const WIDE_KEY_WIDTH_PX = 100;
// --- End Constants ---

let allWordsWithDifficulty = [];
let filteredWordList = []; // Used for secret word selection based on difficulty
let dictionaryForSecretSelection = new Trie(); // Used for secret word selection
let dictionaryFull = new Trie(); // Used for word validation (contains all words)



let state = {
    secret: "",
    secretDifficulty: null, // Stores the difficulty of the current secret word
    grid: Array(NUM_ROWS)
        .fill()
        .map(() => Array(NUM_COLS).fill("")),
    results: Array(NUM_ROWS)
        .fill()
        .map(() => Array(NUM_COLS).fill("")),
    currentRow: 0,
    currentCol: 0,
    selectedDifficulty: 1, // Default difficulty to "Most Words"
    sidebar: {
        currentPage: 1,
        pageSize: 2
    },
    letterStates: {}, // Encapsulated letter states
    canDismissModal: false, // New flag to control modal dismissal
    isProcessingGuess: false, // New flag to prevent rapid input during guess animation
};

// --- NEW FUNCTIONS FOR GAME STATE PERSISTENCE ---

// Function to save current game state to localStorage
function saveGameState() {
    const gameState = {
        secret: state.secret,
        grid: state.grid,
        results: state.results,
        currentRow: state.currentRow,
        currentCol: state.currentCol,
        letterStates: state.letterStates,
        selectedDifficulty: state.selectedDifficulty
    };
    localStorage.setItem("wordle-current-game", JSON.stringify(gameState));
}

// Function to load current game state from localStorage
function loadGameState() {
    const storedGameState = localStorage.getItem("wordle-current-game");
    if (storedGameState) {
        const gameState = JSON.parse(storedGameState);
        state.secret = gameState.secret;
        state.grid = gameState.grid;
        state.results = gameState.results;
        state.currentRow = gameState.currentRow;
        state.currentCol = gameState.currentCol;
        state.letterStates = gameState.letterStates || {}; // Ensure letterStates is loaded, default to empty if not found
        state.selectedDifficulty = gameState.selectedDifficulty;
        return true; // State loaded successfully
    }
    return false; // No stored state found
}

// Function to clear current game state from localStorage
function clearGameState() {
    localStorage.removeItem("wordle-current-game");
}

// Helper to filter words based on selected difficulty and rebuild Trie
function filterWordsAndUpdateDictionary(difficulty) {
    filteredWordList = allWordsWithDifficulty
        .filter(item => item.difficulty <= difficulty)
        .map(item => item.word);
    dictionaryForSecretSelection = new Trie(); // Rebuild for secret word selection
    filteredWordList.forEach(word => dictionaryForSecretSelection.insert(word, difficulty));
}

// Function to initialize a brand new game state and UI
function initializeNewGame(difficulty = state.selectedDifficulty) {
    // Check if a game was in progress before resetting
    if (state.currentRow > 0 || state.currentCol > 0) {
        const stats = getStats();
        stats.gamesPlayed++;
        stats.guesses.fail++;
        stats.currentStreak = 0;

        const abandonedGame = {
            secretWord: state.secret,
            guesses: state.grid.slice(0, state.currentRow).map(row => [...row]),
            results: state.results.slice(0, state.currentRow).map(row => [...row]),
            win: false, // Mark as loss
            difficulty: state.secretDifficulty || 0 // Use stored difficulty, default to 0 if not found
        };
        stats.history.push(abandonedGame);
        if (stats.history.length > HISTORY_MAX_LENGTH) {
            stats.history.shift();
        }
        saveStats(stats);
        displayStats(); // Update stats display immediately
    }

    state.selectedDifficulty = difficulty; // Ensure difficulty is set
    state.grid = Array(NUM_ROWS).fill().map(() => Array(NUM_COLS).fill(""));
    state.results = Array(NUM_ROWS).fill().map(() => Array(NUM_COLS).fill(""));
    state.currentRow = 0;
    state.currentCol = 0;
    state.letterStates = {}; // Clear keyboard states

    filterWordsAndUpdateDictionary(state.selectedDifficulty); // Filter and rebuild dictionary
    state.secret = filteredWordList[Math.floor(Math.random() * filteredWordList.length)]; // Pick a new secret word
    const selectedWordItem = allWordsWithDifficulty.find(item => item.word === state.secret);
    state.secretDifficulty = selectedWordItem ? selectedWordItem.difficulty : null; // Store the difficulty

    // Update UI
    const gameBoard = document.getElementById("game-board");
    gameBoard.innerHTML = ''; // Clear existing grid
    drawGrid(gameBoard); // Redraw empty grid
    updateKeyboard(); // Reset keyboard colors

    clearGameState(); // Clear any previously saved game state
}

// --- END NEW FUNCTIONS ---

async function startup() {
    try {
        const res = await fetch("words.json.gz");
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        const decompressedResponse = new Response(res.body.pipeThrough(new DecompressionStream('gzip')));
        allWordsWithDifficulty = await decompressedResponse.json();

        // Populate the full dictionary (used for validation)
        allWordsWithDifficulty.forEach(item => dictionaryFull.insert(item.word, item.difficulty));
    } catch (error) {
        console.error("Failed to load word data or initialize game:", error);
        showModal({
            message: `Failed to load game data: ${error.message}. Please check your internet connection or try again later.`,
            showOkay: true,
            canDismiss: false // Prevent dismissal so user acknowledges the error
        });
        return; // Stop further execution if critical data cannot be loaded
    }

    registerDifficultyChangeListener(); // Register early

    const difficultySelect = document.getElementById("difficulty"); // Get select element here

    if (loadGameState()) {
        filterWordsAndUpdateDictionary(state.selectedDifficulty); // Ensure dictionary is built for the loaded difficulty
        difficultySelect.value = state.selectedDifficulty; // Update dropdown to reflect loaded state

        const gameBoard = document.getElementById("game-board");
        gameBoard.innerHTML = '';
        drawGrid(gameBoard);
        updateGrid();


        // Re-apply results for all previously completed and evaluated guesses
        for (let r = 0; r < NUM_ROWS; r++) { // Iterate through all possible rows
            if (state.grid[r][0] !== "" && state.results[r][0] !== "") { // If row has a guess AND has results
                for (let c = 0; c < NUM_COLS; c++) {
                    const tile = document.getElementById(`tile${r}${c}`);
                    const result = state.results[r][c];
                    if (result) {
                        tile.classList.add(result);
                    }
                }
            }
        }

        // After loading, if the current column is 5 and the row was evaluated,
        // it means the game was waiting for the next guess. Advance to the next row.
        if (state.currentCol === NUM_COLS && state.currentRow < NUM_ROWS && state.results[state.currentRow] && state.results[state.currentRow][0] !== "") {
            state.currentRow++;
            state.currentCol = 0;
        }

    } else {
        initializeNewGame(); // No stored game, start a fresh one
        difficultySelect.value = state.selectedDifficulty; // Set dropdown to default (1)
    }

    drawKeyboard(document.getElementById("keyboard"));
    registerKeyboardEvents();
    displayStats();
    registerModalDismissalEvents();
    updateKeyboard(); // Ensure keyboard is updated after it's drawn
}



function updateKeyboard() {
    // First, clear all existing color classes from all keyboard keys
    const allKeys = document.querySelectorAll('.key');
    allKeys.forEach(keyElement => {
        keyElement.classList.remove('correct', 'present', 'absent');
    });

    // Then, apply the specific classes based on the current state.letterStates
    for (const key in state.letterStates) {
        const keyElement = document.querySelector(`[data-key="${key}"]`);
        if (keyElement) {
            keyElement.classList.add(state.letterStates[key]);
        }
    }
}

function drawGrid(container) {
    for (let i = 0; i < NUM_ROWS; i++) {
        for (let j = 0; j < NUM_COLS; j++) {
            drawTile(container, i, j);
        }
    }
}

function updateGrid() {
    for (let i = 0; i < NUM_ROWS; i++) {
        for (let j = 0; j < NUM_COLS; j++) {
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
    return dictionaryFull.search(word) !== null; // Validate against the full dictionary
}

function revealWord(guess) {
    const row = state.currentRow;
    const animation_duration = ANIMATION_DURATION_MS;

    const guessResult = checkGuess(guess, state.secret);
    state.results[row] = guessResult;

    for (let i = 0; i < NUM_COLS; i++) {
        const tile = document.getElementById(`tile${row}${i}`);
        const letter = guess[i];
        const newState = guessResult[i];

        tile.classList.add(newState);

        const currentState = state.letterStates[letter];
        if (currentState === 'correct') {
            // do nothing
        } else if (currentState === 'present' && newState !== 'correct') {
            // do nothing
        } else {
            state.letterStates[letter] = newState;
        }

        tile.classList.add("animated");
        tile.style.animationDelay = `${(i * ANIMATION_DURATION_MS) / 2}ms`;
    }
    updateKeyboard();
    saveGameState(); // Save game state after each guess


    const isWinner = state.secret === guess;
    const isGameOver = state.currentRow === (NUM_ROWS - 1);

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
            showModal({ message: "Congratulations!", showPlayAgain: true });
        } else if (isGameOver) {
            stats.currentStreak = 0;
            stats.guesses.fail++;
            showModal({ message: `You lost! The word was ${state.secret}.`, showPlayAgain: true });
        }

        if (isWinner || isGameOver) {
            stats.gamesPlayed++;
            const game = {
                secretWord: state.secret,
                guesses: state.grid.slice(0, guesses).map(row => [...row]),
                results: state.results.slice(0, guesses).map(row => [...row]),
                win: isWinner,
                difficulty: state.secretDifficulty // Use the pre-stored difficulty
            };
            stats.history.push(game);
            if (stats.history.length > HISTORY_MAX_LENGTH) {
                stats.history.shift();
            }
        }

        // Advance row and reset column after every guess, regardless of game outcome
        state.currentRow++;
        state.currentCol = 0;

        state.isProcessingGuess = false; // Reset flag to allow new input

        saveStats(stats);
        displayStats();
    }, 3 * ANIMATION_DURATION_MS);
}

function checkGuess(guess, secret) {
    const result = [];
    const secretLetterCount = {};

    for (const letter of secret) {
        secretLetterCount[letter] = (secretLetterCount[letter] || 0) + 1;
    }

    for (let i = 0; i < NUM_COLS; i++) {
        if (guess[i] === secret[i]) {
            result[i] = 'correct';
            secretLetterCount[guess[i]]--;
        }
    }

    for (let i = 0; i < NUM_COLS; i++) {
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
                keyElement.style.width = `${WIDE_KEY_WIDTH_PX}px`;
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
    if (state.isProcessingGuess) return; // Prevent input while a guess is being processed

    if (key === "enter") {
        if (state.currentCol === NUM_COLS) {
            const word = getCurrentWord();
            if (isWordValid(word)) {
                state.isProcessingGuess = true; // Set flag to true
                revealWord(word);
                // state.currentRow++; // Moved to revealWord's setTimeout
                // state.currentCol = 0; // Moved to revealWord's setTimeout
            } else {
                showTemporaryMessage("Not a valid word.");
            }
        }
    } else if (key === "backspace") {
        removeLetter();
    } else if (isLetter(key)) {
        addLetter(key);
    }
    updateGrid();
}

function showTemporaryMessage(message) {
    const tempMessageContainer = document.getElementById("temporary-message-container");
    tempMessageContainer.textContent = message;
    tempMessageContainer.classList.add("show");

    setTimeout(() => {
        tempMessageContainer.classList.remove("show");
        tempMessageContainer.textContent = ""; // Clear text after fading out
    }, 2000); // Display for 2 seconds
}

function registerDifficultyChangeListener() {
    const difficultySelect = document.getElementById("difficulty");
    difficultySelect.addEventListener("change", (event) => {
        const newDifficulty = parseInt(event.target.value);

        if (state.currentRow > 0) { // Game in progress
            showConfirmationModal(
                "Changing difficulty will reset the current game. Are you sure?",
                () => {
                    initializeNewGame(newDifficulty); // Reset game, pick new word for new difficulty
                    saveGameState(); // Save the new game state
                }
            );
        } else { // No game in progress
            initializeNewGame(newDifficulty); // Reset game, pick new word for new difficulty
            saveGameState(); // Save the new game state
        }
    });
}

function showModal(options) {
    const defaults = {
        message: "",
        showPlayAgain: false,
        showOkay: false,
        showConfirm: false,
        onConfirm: null,
        onCancel: null,
        canDismiss: true // New: control overall dismissal
    };
    const settings = { ...defaults, ...options };

    const modalContainer = document.getElementById("modal-container");
    const modalMessage = document.getElementById("modal-message");
    const playAgainButton = document.getElementById("play-again-button");
    const modalOkayButton = document.getElementById("modal-okay-button");
    const modalConfirmButton = document.getElementById("modal-confirm-button");
    const modalCancelButton = document.getElementById("modal-cancel-button");

    modalMessage.textContent = settings.message;
    playAgainButton.style.display = settings.showPlayAgain ? "block" : "none";
    modalOkayButton.style.display = settings.showOkay ? "block" : "none";
    modalConfirmButton.style.display = settings.showConfirm ? "block" : "none";
    modalCancelButton.style.display = settings.showConfirm ? "block" : "none";
    
    // Assign callbacks to buttons, removing previous listeners to prevent duplicates
    const confirmHandler = () => {
        if (settings.onConfirm) settings.onConfirm();
        hideModal();
    };
    const cancelHandler = () => {
        if (settings.onCancel) settings.onCancel();
        hideModal();
    };

    modalConfirmButton.removeEventListener('click', modalConfirmButton._geminiConfirmHandler);
    modalCancelButton.removeEventListener('click', modalCancelButton._geminiCancelHandler);

    modalConfirmButton.addEventListener('click', confirmHandler);
    modalCancelButton.addEventListener('click', cancelHandler);
    
    // Store handlers for later removal
    modalConfirmButton._geminiConfirmHandler = confirmHandler;
    modalCancelButton._geminiCancelHandler = cancelHandler;

    modalContainer.style.display = "flex";
    // Add a small delay before adding the class to ensure the display change is registered
    setTimeout(() => {
        modalContainer.classList.add("modal-show");
        // Allow dismissal after a minimum display time
        setTimeout(() => {
            state.canDismissModal = settings.canDismiss;
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
    // const modal = document.getElementById("modal"); // Not used

    // Dismissal by Escape/Enter key
    document.addEventListener("keydown", (e) => {
        const playAgainButton = document.getElementById("play-again-button");
        const modalConfirmButton = document.getElementById("modal-confirm-button");
        const modalOkayButton = document.getElementById("modal-okay-button"); // Added for temporary messages

        if (modalContainer.style.display === "flex") { // Only act if modal is visible
            if (e.key === "Escape" && state.canDismissModal) {
                // Only hide if it's not a confirmation modal
                if (modalConfirmButton.style.display === "none") {
                    hideModal();
                }
            } else if (e.key === "Enter") {
                if (playAgainButton.style.display !== "none") {
                    resetGame();
                } else if (modalConfirmButton.style.display !== "none") {
                    // Simulate click on confirm button for confirmation modals
                    modalConfirmButton.click();
                } else if (modalOkayButton.style.display !== "none") {
                    // Simulate click on okay button for temporary messages
                    modalOkayButton.click();
                } else if (state.canDismissModal) { // General dismissal if no specific buttons
                    hideModal();
                }
            }
        }
    });

    // Dismissal by clicking outside the modal content
    modalContainer.addEventListener("click", (e) => {
        const modalConfirmButton = document.getElementById("modal-confirm-button");
        if (e.target === modalContainer && state.canDismissModal && modalConfirmButton.style.display === "none") {
            hideModal();
        }
    });
}

function processNewGame() {
    initializeNewGame(state.selectedDifficulty);
    hideModal(); // Hide any active modals
}

function handleNewGameRequest() {
    if (state.currentRow > 0) { // Game in progress, ask for confirmation
        showConfirmationModal(
            "Starting a new game will abandon the current game. Abandoned games are counted as losses. Are you sure?",
            () => {
                // User confirmed, process the abandonment and start a new game
                // This logic will be added later for the "abandoned game as loss" feature
                processNewGame();
            }
        );
    } else { // No game in progress, start new game directly
        processNewGame();
    }
}

function resetGame() { // SIMPLIFIED resetGame
    initializeNewGame(state.selectedDifficulty);
    hideModal(); // Hide any active modals
}

document.getElementById("play-again-button").addEventListener("click", resetGame);
document.getElementById("modal-okay-button").addEventListener("click", hideModal);




document.getElementById("clear-history-button").addEventListener("click", () => {
    showConfirmationModal("Are you sure you want to clear your game history? This action cannot be undone.", clearGameHistory);
});

document.getElementById("prev-page-button").addEventListener("click", previousPage);
document.getElementById("next-page-button").addEventListener("click", nextPage);
document.getElementById("new-game-button").addEventListener("click", handleNewGameRequest);

function previousPage() {
    if (state.sidebar.currentPage > 1) {
        state.sidebar.currentPage--;
        displayStats();
    }
}

function nextPage() {
    const stats = getStats();
    const totalPages = Math.max(1, Math.ceil(stats.history.length / state.sidebar.pageSize));
    if (state.sidebar.currentPage < totalPages) {
        state.sidebar.currentPage++;
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

    const startIndex = (state.sidebar.currentPage - 1) * state.sidebar.pageSize;
    const endIndex = startIndex + state.sidebar.pageSize;
    const paginatedHistory = reversedHistory.slice(startIndex, endIndex);

    paginatedHistory.forEach(game => {
        const gameElement = document.createElement("div");
        gameElement.classList.add("game");

        let gameGrid = '<div class="game-grid">';
        for (let i = 0; i < NUM_ROWS; i++) { // Always render NUM_ROWS rows
            gameGrid += '<div class="guess-row">';
            for (let j = 0; j < NUM_COLS; j++) { // Always render NUM_COLS columns
                const result = (game.results && game.results[i] && game.results[i][j]) ? game.results[i][j] : '';
                const letter = (game.guesses && game.guesses[i] && game.guesses[i][j]) ? game.guesses[i][j] : '';
                gameGrid += `<div class="tile ${result}">${letter}</div>`;
            }
            gameGrid += '</div>';
        }
        gameGrid += '</div>';

        gameElement.innerHTML = `
            <p>Word: ${game.secretWord} (Difficulty: ${game.difficulty}) (${game.win ? 'Win' : 'Loss'})</p>
            ${gameGrid}
        `;
        recentGamesContent.appendChild(gameElement);
    });

    const pageInfo = document.getElementById("page-info");
    const totalPages = Math.max(1, Math.ceil(stats.history.length / state.sidebar.pageSize));
    pageInfo.textContent = `Page ${state.sidebar.currentPage} of ${totalPages}`;

    const prevButton = document.getElementById("prev-page-button");
    const nextButton = document.getElementById("next-page-button");
    prevButton.disabled = state.sidebar.currentPage === 1;
    nextButton.disabled = state.sidebar.currentPage === totalPages;
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
    // Ensure history only contains the last 10 games before saving
    if (stats.history.length > HISTORY_MAX_LENGTH) {
        stats.history = stats.history.slice(-HISTORY_MAX_LENGTH);
    }
    localStorage.setItem("wordle-stats", JSON.stringify(stats));
}

function clearGameHistory() {
    localStorage.removeItem("wordle-stats");
    displayStats(); // Refresh the stats display
    hideModal(); // Hide the confirmation modal
}



function showConfirmationModal(message, onConfirmCallback) {
    showModal({
        message: message,
        showConfirm: true,
        onConfirm: onConfirmCallback,
        onCancel: () => {
            // Revert the difficulty dropdown to the current game's difficulty
            const difficultySelect = document.getElementById("difficulty");
            if (difficultySelect) {
                difficultySelect.value = state.selectedDifficulty;
            }
        }
    });
}

startup();

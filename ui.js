// ==========================================
// Sound Effects Engine
// ==========================================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(isCapture = false) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (isCapture) {
        // High, sharp sound for a capture
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(300, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    } else {
        // Low, dull thud for a standard move
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.8, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    }
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.1);
}

// ==========================================
// Modal Management System
// ==========================================

let pendingAction = null;

function showConfirm(message, actionCallback) {
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('cancelConfirmBtn').classList.remove('hidden');
    
    const modal = document.getElementById('confirmModal');
    modal.classList.remove('hidden'); // Fix: Remove hidden
    modal.classList.add('active');
    
    pendingAction = actionCallback;
}

function executeConfirm() {
    if (pendingAction) pendingAction();
    closeConfirm();
}

function closeConfirm() {
    const modal = document.getElementById('confirmModal');
    modal.classList.remove('active');
    modal.classList.add('hidden'); // Fix: Add hidden back
    pendingAction = null;
}

// Re-using confirm modal for standard alerts (hides cancel button)
function showCustomAlert(message) {
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('cancelConfirmBtn').classList.add('hidden');
    
    const modal = document.getElementById('confirmModal');
    modal.classList.remove('hidden'); // Fix: Remove hidden
    modal.classList.add('active');
    
    pendingAction = null;
}

function showGameOver(message) {
    document.getElementById('gameOverMessage').textContent = message;
    
    const modal = document.getElementById('gameOverModal');
    modal.classList.remove('hidden'); // Fix: Remove hidden
    modal.classList.add('active');
}

function closeGameOverAndRestart() {
    const modal = document.getElementById('gameOverModal');
    modal.classList.remove('active');
    modal.classList.add('hidden'); // Fix: Add hidden back
    restartGame();
}

function closeGameOverAndExit() {
    const modal = document.getElementById('gameOverModal');
    modal.classList.remove('active');
    modal.classList.add('hidden'); // Fix: Add hidden back
    showHomeScreen();
}

// ==========================================
// Main UI Controller
// ==========================================
class ChessUI {
    constructor() {
        this.game = new ChessGame();
        this.ai = null;
        this.onlineGame = null;
        this.isAIThinking = false;
        this.isWaitingForOpponent = false;
        this.initializeEventListeners();
        this.renderBoard();
    }

    initializeEventListeners() {
        document.querySelectorAll('.promotion-piece').forEach(btn => {
            btn.addEventListener('click', (e) => this.completePromotion(e.target.dataset.piece));
        });
    }

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
            screen.classList.add('hidden');
        });
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.remove('hidden');
            targetScreen.classList.add('active');
        }
    }

    startAIGame(difficulty) {
        this.game.gameMode = 'ai';
        this.game.aiDifficulty = difficulty;
        this.ai = new ChessAI(difficulty);
        this.isWaitingForOpponent = false;
        
        document.getElementById('undoBtn').classList.remove('hidden');
        document.getElementById('redoBtn').classList.remove('hidden');
        document.getElementById('aiControls').classList.remove('hidden');
        
        this.showScreen('gameScreen');
        this.game.restart();
        this.renderBoard();
        this.updateGameInfo();
    }

    startLocalGame() {
        this.game.gameMode = 'local';
        this.isWaitingForOpponent = false;
        this.hideAIControls();
        this.showScreen('gameScreen');
        this.game.restart();
        this.renderBoard();
        this.updateGameInfo();
    }

    createRoom() {
        this.onlineGame = new OnlineGame(this);
        this.onlineGame.createRoom();
    }

    joinRoom() {
        const code = document.getElementById('roomCode').value.toUpperCase();
        if(code.length !== 6) return showCustomAlert("Invalid code. Please enter 6 characters.");
        
        this.onlineGame = new OnlineGame(this);
        this.onlineGame.joinRoom(code);
    }

    handleRoomCreated(code) {
        this.game.gameMode = 'online';
        this.game.playerColor = 'white';
        this.isWaitingForOpponent = true;
        this.hideAIControls();
        
        showCustomAlert(`Room created! Send this code to your friend: ${code}`);
        
        this.showScreen('gameScreen');
        this.game.restart();
        this.renderBoard();
        document.getElementById('gameStatus').textContent = `Waiting... Code: ${code}`;
    }

    handleRoomJoined(code) {
        this.game.gameMode = 'online';
        this.game.playerColor = 'black';
        this.isWaitingForOpponent = true;
        this.hideAIControls();
        
        this.showScreen('gameScreen');
        this.game.restart();
        this.renderBoard();
        document.getElementById('gameStatus').textContent = "Connected! Starting game...";
    }

    handleGameStart() {
        this.isWaitingForOpponent = false;
        showCustomAlert("Opponent joined! The game begins now.");
        this.updateGameInfo();
    }

    // NEW FULL FUNCTION: Handles the automatic win when the opponent leaves
    handleOpponentDisconnect() {
        // Stop the remaining player from making any more moves
        this.isWaitingForOpponent = true; 
        
        // Show the Game Over modal with the automatic win message
        showGameOver("Opponent Disconnected! You Win!");
    }
    // Add this inside the ChessUI class
    handleOpponentRestart() {
        // Show an alert so they aren't confused why the board suddenly cleared
        showCustomAlert("Your opponent restarted the match!");
        
        // Reset the local board to match
        this.game.restart();
        this.renderBoard();
        this.updateGameInfo();
    }
    // Add this inside your ChessUI class
    exitGame() {
        if (this.game.gameMode === 'online' && this.onlineGame) {
            // Notify the server so the opponent gets the win
            this.onlineGame.leaveRoom();
            this.onlineGame = null;
        }
        // Reset the local game board
        this.game.restart();
    }

    handleReceiveMove(move) {
        this.game.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol, move.promotion);
        this.renderBoard();
        this.updateGameInfo();
        this.checkGameEndings();
    }

    hideAIControls() {
        document.getElementById('undoBtn').classList.add('hidden');
        document.getElementById('redoBtn').classList.add('hidden');
        document.getElementById('aiControls').classList.add('hidden');
    }

    renderBoard() {
        const boardElement = document.getElementById('chessboard');
        boardElement.innerHTML = '';
        
        const isBlackPerspective = (this.game.gameMode === 'online' && this.game.playerColor === 'black');
        
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const row = isBlackPerspective ? 7 - r : r;
                const col = isBlackPerspective ? 7 - c : c;

                const square = document.createElement('div');
                square.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
                
                const piece = this.game.getPiece(row, col);
                if (piece) {
                    const pieceEl = document.createElement('div');
                    pieceEl.className = `piece ${piece.color}`;
                    pieceEl.textContent = this.game.getPieceSymbol(piece);
                    square.appendChild(pieceEl);
                }
                
                if (this.game.selectedSquare && this.game.selectedSquare.row === row && this.game.selectedSquare.col === col) {
                    square.classList.add('selected');
                }
                
                const validMove = this.game.validMoves.find(m => m.row === row && m.col === col);
                if (validMove) square.classList.add(validMove.type === 'capture' ? 'capture-move' : 'valid-move');
                
                const king = this.game.getPiece(row, col);
                if (king && king.type === 'king' && this.game.gameStatus === 'check' && king.color === this.game.currentPlayer) {
                    square.classList.add('check');
                }
                
                square.addEventListener('click', () => this.handleSquareClick(row, col));
                boardElement.appendChild(square);
            }
        }
        this.updateMoveHistory();
    }

handleSquareClick(row, col) {
        if (this.isAIThinking) return;
        if (this.isWaitingForOpponent) return showCustomAlert('Waiting for opponent to connect...');
        if (this.game.gameMode === 'online' && this.game.currentPlayer !== this.game.playerColor) return;
        
        if (this.game.selectedSquare) {
            const move = this.game.validMoves.find(m => m.row === row && m.col === col);
            if (move) {
                const result = this.game.makeMove(this.game.selectedSquare.row, this.game.selectedSquare.col, row, col);
                
                // --- FIX: Handle the .hidden class so the modal actually shows ---
                if (result === 'promotion') {
                    const promoModal = document.getElementById('promotionModal');
                    promoModal.classList.remove('hidden');
                    promoModal.classList.add('active');
                    this.pendingPromotion = { row, col };
                    return;
                }
                
                if (result) {
                    if (this.game.gameMode === 'online') {
                        this.onlineGame.sendMove({
                            fromRow: this.game.selectedSquare.row,
                            fromCol: this.game.selectedSquare.col,
                            toRow: row, toCol: col, promotion: null
                        });
                    }
                    this.handleMoveComplete();
                }
            }
            this.game.selectedSquare = null;
            this.game.validMoves = [];
        } else {
            const piece = this.game.getPiece(row, col);
            if (piece && this.game.isPieceOwnedByCurrentPlayer(piece)) {
                this.game.selectedSquare = { row, col };
                this.game.validMoves = this.game.getValidMoves(row, col);
            }
        }
        this.renderBoard();
    }

    completePromotion(pieceType) {
        // --- FIX: Add the .hidden class back so the modal disappears ---
        const promoModal = document.getElementById('promotionModal');
        promoModal.classList.remove('active');
        promoModal.classList.add('hidden');
        
        if (this.pendingPromotion) {
            this.game.makeMove(this.game.selectedSquare.row, this.game.selectedSquare.col, this.pendingPromotion.row, this.pendingPromotion.col, pieceType);
            
            if (this.game.gameMode === 'online') {
                this.onlineGame.sendMove({
                    fromRow: this.game.selectedSquare.row, fromCol: this.game.selectedSquare.col,
                    toRow: this.pendingPromotion.row, toCol: this.pendingPromotion.col,
                    promotion: pieceType
                });
            }

            this.pendingPromotion = null;
            this.game.selectedSquare = null;
            this.game.validMoves = [];
            this.handleMoveComplete();
        }
    }

handleMoveComplete() {
        // 1. Play sound for the human's move
        const lastMove = this.game.moveHistory[this.game.moveHistory.length - 1];
        const isCapture = lastMove && lastMove.capturedPiece !== null;
        if (typeof playSound === 'function') playSound(isCapture);

        // 2. Update the UI
        this.renderBoard();
        this.updateGameInfo();
        this.checkGameEndings();

        // 3. Trigger AI response if playing vs AI
        if (this.game.gameMode === 'ai' && this.game.currentPlayer === 'black') {
            this.isAIThinking = true;
            document.getElementById('aiThinkingText').textContent = "AI is thinking...";
            
            setTimeout(() => {
                const move = this.ai.getBestMove(this.game);
                if (move) {
                    this.game.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol, 'queen');
                    
                    // Play sound for the AI's move
                    const aiLastMove = this.game.moveHistory[this.game.moveHistory.length - 1];
                    const aiIsCapture = aiLastMove && aiLastMove.capturedPiece !== null;
                    if (typeof playSound === 'function') playSound(aiIsCapture);

                    this.renderBoard();
                    this.updateGameInfo();
                    this.checkGameEndings();
                }
                this.isAIThinking = false;
                document.getElementById('aiThinkingText').textContent = "";
            }, 500);
        }
    }
    checkGameEndings() {
        if (this.game.gameStatus === 'checkmate') {
            const winner = this.game.currentPlayer === 'white' ? 'Black' : 'White';
            setTimeout(() => showGameOver(`Checkmate! ${winner} Wins!`), 600);
        } else if (this.game.gameStatus === 'stalemate' || this.game.gameStatus === 'draw') {
            setTimeout(() => showGameOver(`Stalemate! It's a Draw.`), 600);
        }
    }

    updateGameInfo() {
        if (this.isWaitingForOpponent) return;

        let playerText = `${this.game.currentPlayer.charAt(0).toUpperCase() + this.game.currentPlayer.slice(1)}'s Turn`;
        if (this.game.gameMode === 'online') {
            playerText += this.game.currentPlayer === this.game.playerColor ? " (You)" : " (Opponent)";
        }
        
        document.getElementById('currentPlayerText').textContent = playerText;
        document.getElementById('gameStatus').textContent = this.game.gameStatus === 'playing' ? '' : this.game.gameStatus.toUpperCase();
    }

    updateMoveHistory() {
        const history = document.getElementById('moveHistory');
        history.innerHTML = '';
        this.game.moveHistory.forEach((move, i) => {
            const div = document.createElement('div');
            div.className = 'move-item';
            div.innerHTML = i % 2 === 0 ? `<span class="move-number">${Math.floor(i/2)+1}.</span> ${move.notation}` : move.notation;
            history.appendChild(div);
        });
        history.scrollTop = history.scrollHeight;
    }

    undoMove() {
        if (this.game.gameMode === 'ai' && this.game.currentPlayer === 'black') return;
        if (this.game.undoMove()) {
            if (this.game.gameMode === 'ai') this.game.undoMove();
            this.renderBoard();
            this.updateGameInfo();
        }
    }

    redoMove() {
        if (this.game.redoMove()) {
            if(this.game.gameMode === 'ai') this.game.redoMove();
            this.renderBoard();
            this.updateGameInfo();
        }
    }
}

// ==========================================
// Global Hooks for HTML Buttons
// ==========================================
let chessUI;
document.addEventListener('DOMContentLoaded', () => chessUI = new ChessUI());

function showHomeScreen() { chessUI.showScreen('home'); }
function showAIScreen() { chessUI.showScreen('ai'); }
function showLocalScreen() { chessUI.showScreen('local'); }
function showOnlineScreen() { chessUI.showScreen('online'); }
function startAIGame(diff) { chessUI.startAIGame(diff); }
function startLocalGame() { chessUI.startLocalGame(); }
function createRoom() { chessUI.createRoom(); }
function showJoinRoom() { document.getElementById('joinRoomSection').classList.remove('hidden'); }
function joinRoom() { chessUI.joinRoom(); }
function undoMove() { chessUI.undoMove(); }
function redoMove() { chessUI.redoMove(); }

// Replace your existing restartGame() function at the bottom of ui.js with this:
function restartGame() { 
    chessUI.game.restart(); 
    chessUI.renderBoard(); 
    chessUI.updateGameInfo(); 
    
    // Notify the opponent if playing online
    if (chessUI.game.gameMode === 'online' && chessUI.onlineGame) {
        chessUI.onlineGame.sendRestart();
    }
}

function confirmRestart() {
    showConfirm("Are you sure you want to restart the match? Progress will be lost.", () => {
        restartGame();
    });
}

function confirmExit() {
    showConfirm("Are you sure you want to exit? If playing online, you will forfeit the game.", () => {
        // Trigger the disconnect signal to the other player
        chessUI.exitGame(); 
        showHomeScreen();
    });
}
function closeGameOverAndExit() {
    const modal = document.getElementById('gameOverModal');
    modal.classList.remove('active');
    modal.classList.add('hidden'); 
    
    // Clean up the room if they click Main Menu after a game ends
    chessUI.exitGame();
    showHomeScreen();
}

function showRules() { 
    const modal = document.getElementById('rulesModal');
    modal.classList.remove('hidden');
    modal.classList.add('active'); 
}

function hideRules() { 
    const modal = document.getElementById('rulesModal');
    modal.classList.remove('active');
    modal.classList.add('hidden'); 
}
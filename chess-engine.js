// js/chess-engine.js
class ChessGame {
    constructor() {
        this.board = this.initializeBoard();
        this.currentPlayer = 'white';
        this.selectedSquare = null;
        this.validMoves = [];
        this.moveHistory = [];
        this.capturedPieces = { white: [], black: [] };
        this.gameStatus = 'playing'; 
        this.enPassantTarget = null;
        this.castlingRights = {
            white: { kingside: true, queenside: true },
            black: { kingside: true, queenside: true }
        };
        this.halfMoveClock = 0;
        this.fullMoveNumber = 1;
        
        this.moveUndoStack = [];
        this.redoStack = []; // Added redo stack

        this.gameMode = null;
        this.aiDifficulty = null;
        this.roomCode = null;
        this.isOnlineGame = false;
        this.playerColor = 'white';
    }

    initializeBoard() {
        const board = Array(8).fill(null).map(() => Array(8).fill(null));
        const pieceOrder = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
        
        for (let i = 0; i < 8; i++) {
            board[0][i] = { type: pieceOrder[i], color: 'black' };
            board[1][i] = { type: 'pawn', color: 'black' };
            board[6][i] = { type: 'pawn', color: 'white' };
            board[7][i] = { type: pieceOrder[i], color: 'white' };
        }
        return board;
    }

    getPieceSymbol(piece) {
        const symbols = {
            white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
            black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' }
        };
        return piece ? symbols[piece.color][piece.type] : '';
    }

    isValidPosition(row, col) { return row >= 0 && row < 8 && col >= 0 && col < 8; }

    getPiece(row, col) {
        if (this.isValidPosition(row, col)) return this.board[row][col];
        return null;
    }

    isPieceOwnedByCurrentPlayer(piece) { return piece && piece.color === this.currentPlayer; }

    getValidMoves(row, col) {
        const piece = this.getPiece(row, col);
        if (!piece || !this.isPieceOwnedByCurrentPlayer(piece)) return [];
        let moves = [];
        switch (piece.type) {
            case 'pawn': moves = this.getPawnMoves(row, col); break;
            case 'rook': moves = this.getRookMoves(row, col); break;
            case 'knight': moves = this.getKnightMoves(row, col); break;
            case 'bishop': moves = this.getBishopMoves(row, col); break;
            case 'queen': moves = this.getQueenMoves(row, col); break;
            case 'king': moves = this.getKingMoves(row, col); break;
        }
        return moves.filter(move => !this.wouldLeaveKingInCheck(row, col, move.row, move.col));
    }

    getPawnMoves(row, col) {
        const moves = [];
        const piece = this.getPiece(row, col);
        const direction = piece.color === 'white' ? -1 : 1;
        const startRow = piece.color === 'white' ? 6 : 1;
        
        if (this.isValidPosition(row + direction, col) && !this.getPiece(row + direction, col)) {
            moves.push({ row: row + direction, col, type: 'move' });
            if (row === startRow && !this.getPiece(row + 2 * direction, col)) {
                moves.push({ row: row + 2 * direction, col, type: 'move' });
            }
        }
        for (let dcol of [-1, 1]) {
            const newRow = row + direction;
            const newCol = col + dcol;
            if (this.isValidPosition(newRow, newCol)) {
                const targetPiece = this.getPiece(newRow, newCol);
                if (targetPiece && targetPiece.color !== piece.color) {
                    moves.push({ row: newRow, col: newCol, type: 'capture' });
                }
            }
        }
        if (this.enPassantTarget) {
            const enPassantRow = piece.color === 'white' ? 3 : 4;
            if (row === enPassantRow && Math.abs(col - this.enPassantTarget.col) === 1) {
                moves.push({ 
                    row: row + direction, col: this.enPassantTarget.col, type: 'enpassant',
                    capturedRow: row, capturedCol: this.enPassantTarget.col
                });
            }
        }
        return moves;
    }

    getRookMoves(row, col) {
        const moves = [];
        const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        for (let [dr, dc] of directions) {
            for (let i = 1; i < 8; i++) {
                const newRow = row + dr * i, newCol = col + dc * i;
                if (!this.isValidPosition(newRow, newCol)) break;
                const targetPiece = this.getPiece(newRow, newCol);
                if (targetPiece) {
                    if (targetPiece.color !== this.getPiece(row, col).color) moves.push({ row: newRow, col: newCol, type: 'capture' });
                    break;
                }
                moves.push({ row: newRow, col: newCol, type: 'move' });
            }
        }
        return moves;
    }

    getKnightMoves(row, col) {
        const moves = [];
        const jumps = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
        for (let [dr, dc] of jumps) {
            const newRow = row + dr, newCol = col + dc;
            if (this.isValidPosition(newRow, newCol)) {
                const targetPiece = this.getPiece(newRow, newCol);
                if (!targetPiece || targetPiece.color !== this.getPiece(row, col).color) {
                    moves.push({ row: newRow, col: newCol, type: targetPiece ? 'capture' : 'move' });
                }
            }
        }
        return moves;
    }

    getBishopMoves(row, col) {
        const moves = [];
        const directions = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
        for (let [dr, dc] of directions) {
            for (let i = 1; i < 8; i++) {
                const newRow = row + dr * i, newCol = col + dc * i;
                if (!this.isValidPosition(newRow, newCol)) break;
                const targetPiece = this.getPiece(newRow, newCol);
                if (targetPiece) {
                    if (targetPiece.color !== this.getPiece(row, col).color) moves.push({ row: newRow, col: newCol, type: 'capture' });
                    break;
                }
                moves.push({ row: newRow, col: newCol, type: 'move' });
            }
        }
        return moves;
    }

    getQueenMoves(row, col) { return [...this.getRookMoves(row, col), ...this.getBishopMoves(row, col)]; }

    getKingMoves(row, col) {
        const moves = [];
        const piece = this.getPiece(row, col);
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const newRow = row + dr, newCol = col + dc;
                if (this.isValidPosition(newRow, newCol)) {
                    const targetPiece = this.getPiece(newRow, newCol);
                    if (!targetPiece || targetPiece.color !== piece.color) {
                        moves.push({ row: newRow, col: newCol, type: targetPiece ? 'capture' : 'move' });
                    }
                }
            }
        }
        
        // Castling
        if (this.castlingRights[piece.color].kingside && !this.isKingInCheck(piece.color)) {
            const rook = this.getPiece(row, 7);
            if (rook && rook.type === 'rook' && rook.color === piece.color) {
                let canCastle = true;
                for (let c = 5; c <= 6; c++) {
                    if (this.getPiece(row, c) || this.isSquareUnderAttack(row, c, piece.color)) { canCastle = false; break; }
                }
                if (canCastle) moves.push({ row, col: 6, type: 'castle', castleSide: 'kingside' });
            }
        }
        if (this.castlingRights[piece.color].queenside && !this.isKingInCheck(piece.color)) {
            const rook = this.getPiece(row, 0);
            if (rook && rook.type === 'rook' && rook.color === piece.color) {
                let canCastle = true;
                for (let c = 1; c <= 3; c++) {
                    if (this.getPiece(row, c) || (c <= 2 && this.isSquareUnderAttack(row, c, piece.color))) { canCastle = false; break; }
                }
                if (canCastle) moves.push({ row, col: 2, type: 'castle', castleSide: 'queenside' });
            }
        }
        return moves;
    }

    isSquareUnderAttack(row, col, byColor) {
        const opponentColor = byColor === 'white' ? 'black' : 'white';
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.getPiece(r, c);
                if (piece && piece.color === opponentColor) {
                    const moves = this.getBasicMoves(r, c);
                    if (moves.some(move => move.row === row && move.col === col)) return true;
                }
            }
        }
        return false;
    }

    getBasicMoves(row, col) {
        const piece = this.getPiece(row, col);
        if (!piece) return [];
        switch (piece.type) {
            case 'pawn': return this.getPawnBasicMoves(row, col);
            case 'rook': return this.getRookMoves(row, col);
            case 'knight': return this.getKnightMoves(row, col);
            case 'bishop': return this.getBishopMoves(row, col);
            case 'queen': return this.getQueenMoves(row, col);
            case 'king': return this.getKingBasicMoves(row, col);
            default: return [];
        }
    }

    getPawnBasicMoves(row, col) {
        const moves = [];
        const piece = this.getPiece(row, col);
        const direction = piece.color === 'white' ? -1 : 1;
        for (let dcol of [-1, 1]) {
            const newRow = row + direction, newCol = col + dcol;
            if (this.isValidPosition(newRow, newCol)) moves.push({ row: newRow, col: newCol, type: 'capture' });
        }
        return moves;
    }

    getKingBasicMoves(row, col) {
        const moves = [];
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const newRow = row + dr, newCol = col + dc;
                if (this.isValidPosition(newRow, newCol)) moves.push({ row: newRow, col: newCol, type: 'move' });
            }
        }
        return moves;
    }

    findKing(color) {
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.getPiece(row, col);
                if (piece && piece.type === 'king' && piece.color === color) return { row, col };
            }
        }
        return null;
    }

    isKingInCheck(color) {
        const kingPos = this.findKing(color);
        if (!kingPos) return false;
        return this.isSquareUnderAttack(kingPos.row, kingPos.col, color);
    }

    wouldLeaveKingInCheck(fromRow, fromCol, toRow, toCol) {
        const piece = this.getPiece(fromRow, fromCol);
        const capturedPiece = this.getPiece(toRow, toCol);
        
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;
        const inCheck = this.isKingInCheck(piece.color);
        
        this.board[fromRow][fromCol] = piece;
        this.board[toRow][toCol] = capturedPiece;
        return inCheck;
    }

    makeMove(fromRow, fromCol, toRow, toCol, promotionPiece = null) {
        const piece = this.getPiece(fromRow, fromCol);
        const capturedPiece = this.getPiece(toRow, toCol);
        
        if (!piece || !this.isPieceOwnedByCurrentPlayer(piece)) return false;
        
        const validMoves = this.getValidMoves(fromRow, fromCol);
        const move = validMoves.find(m => m.row === toRow && m.col === toCol);
        if (!move) return false;

        // --- THE FIX: Check for promotion BEFORE moving the piece ---
        const isPromotion = piece.type === 'pawn' && ((piece.color === 'white' && toRow === 0) || (piece.color === 'black' && toRow === 7));
        
        if (isPromotion && !promotionPiece) {
            // Stop immediately and tell the UI to show the selection menu
            return 'promotion'; 
        }
        
        // Save current state for Undo
        this.moveUndoStack.push(this.getCurrentState());
        this.redoStack = []; 
        
        let moveNotation = this.getMoveNotation(fromRow, fromCol, toRow, toCol, move, piece, capturedPiece);
        
        if (move.type === 'castle') {
            this.handleCastling(move);
        } else if (move.type === 'enpassant') {
            this.handleEnPassant(move);
        } else {
            // Execute standard move
            this.board[toRow][toCol] = piece;
            this.board[fromRow][fromCol] = null;
            if (capturedPiece) this.capturedPieces[capturedPiece.color].push(capturedPiece);
            
            // Apply the chosen promotion upgrade
            if (isPromotion && promotionPiece) {
                piece.type = promotionPiece;
                // Fix the move notation (e.g., change e8=Q to e8=N if they picked Knight)
                moveNotation = moveNotation.replace('=Q', '=' + promotionPiece[0].toUpperCase());
            }
        }
        
        this.updateEnPassantTarget(piece, fromRow, fromCol, toRow, toCol);
        this.updateCastlingRights(piece, fromRow, fromCol);
        
        this.moveHistory.push({
            from: { row: fromRow, col: fromCol },
            to: { row: toRow, col: toCol },
            piece: { ...piece },
            capturedPiece: capturedPiece ? { ...capturedPiece } : null,
            notation: moveNotation,
            moveNumber: this.fullMoveNumber,
            player: this.currentPlayer
        });
        
        this.switchPlayer();
        this.updateGameStatus();
        
        if (piece.type === 'pawn' || capturedPiece) this.halfMoveClock = 0;
        else this.halfMoveClock++;
        
        if (this.currentPlayer === 'white') this.fullMoveNumber++;
        
        return true;
    }

    handleCastling(move) {
        const row = move.castleSide === 'kingside' ? 7 : 0;
        const kingCol = 4, newKingCol = move.castleSide === 'kingside' ? 6 : 2;
        const rookCol = move.castleSide === 'kingside' ? 7 : 0, newRookCol = move.castleSide === 'kingside' ? 5 : 3;
        
        this.board[row][newKingCol] = this.getPiece(row, kingCol);
        this.board[row][kingCol] = null;
        this.board[row][newRookCol] = this.getPiece(row, rookCol);
        this.board[row][rookCol] = null;
    }

    handleEnPassant(move) {
        const piece = this.getPiece(move.row - (this.currentPlayer === 'white' ? 1 : -1), move.col);
        this.board[move.row][move.col] = piece;
        this.board[move.row - (this.currentPlayer === 'white' ? 1 : -1)][move.col] = null;
        this.board[move.row + (this.currentPlayer === 'white' ? -1 : 1)][move.col] = null;
        this.capturedPieces[this.currentPlayer === 'white' ? 'black' : 'white'].push({ type: 'pawn', color: this.currentPlayer === 'white' ? 'black' : 'white' });
    }

    updateEnPassantTarget(piece, fromRow, fromCol, toRow, toCol) {
        if (piece.type === 'pawn' && Math.abs(toRow - fromRow) === 2) {
            this.enPassantTarget = { row: (fromRow + toRow) / 2, col: fromCol };
        } else {
            this.enPassantTarget = null;
        }
    }

    updateCastlingRights(piece, fromRow, fromCol) {
        if (piece.type === 'king') {
            this.castlingRights[piece.color].kingside = false;
            this.castlingRights[piece.color].queenside = false;
        } else if (piece.type === 'rook') {
            if (fromCol === 0) this.castlingRights[piece.color].queenside = false;
            else if (fromCol === 7) this.castlingRights[piece.color].kingside = false;
        }
    }

    getMoveNotation(fromRow, fromCol, toRow, toCol, move, piece, capturedPiece) {
        const files = 'abcdefgh', ranks = '87654321';
        let notation = '';
        if (move.type === 'castle') return move.castleSide === 'kingside' ? 'O-O' : 'O-O-O';
        
        const pieceSymbols = { king: 'K', queen: 'Q', rook: 'R', bishop: 'B', knight: 'N', pawn: '' };
        notation += pieceSymbols[piece.type];
        
        if (capturedPiece || move.type === 'enpassant') {
            if (piece.type === 'pawn') notation += files[fromCol];
            notation += 'x';
        }
        notation += files[toCol] + ranks[toRow];
        if (piece.type === 'pawn' && ((piece.color === 'white' && toRow === 0) || (piece.color === 'black' && toRow === 7))) notation += '=Q';
        
        return notation;
    }

    switchPlayer() { this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white'; }

    updateGameStatus() {
        if (this.isKingInCheck(this.currentPlayer)) {
            this.gameStatus = this.isCheckmate(this.currentPlayer) ? 'checkmate' : 'check';
        } else if (this.isStalemate(this.currentPlayer)) {
            this.gameStatus = 'stalemate';
        } else {
            this.gameStatus = 'playing';
        }
    }

    isCheckmate(color) { return this.isKingInCheck(color) && !this.hasLegalMoves(color); }
    isStalemate(color) { return !this.isKingInCheck(color) && !this.hasLegalMoves(color); }
    
    hasLegalMoves(color) {
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.getPiece(row, col);
                if (piece && piece.color === color && this.getValidMoves(row, col).length > 0) return true;
            }
        }
        return false;
    }

    // Advanced State Management for Undo/Redo
    getCurrentState() {
        return {
            board: this.board.map(row => row.map(piece => piece ? { ...piece } : null)),
            currentPlayer: this.currentPlayer,
            gameStatus: this.gameStatus,
            enPassantTarget: this.enPassantTarget ? { ...this.enPassantTarget } : null,
            castlingRights: { white: { ...this.castlingRights.white }, black: { ...this.castlingRights.black } },
            halfMoveClock: this.halfMoveClock,
            fullMoveNumber: this.fullMoveNumber,
            capturedPieces: { white: [...this.capturedPieces.white], black: [...this.capturedPieces.black] },
            moveHistory: [...this.moveHistory]
        };
    }

    restoreState(state) {
        this.board = state.board;
        this.currentPlayer = state.currentPlayer;
        this.gameStatus = state.gameStatus;
        this.enPassantTarget = state.enPassantTarget;
        this.castlingRights = state.castlingRights;
        this.halfMoveClock = state.halfMoveClock;
        this.fullMoveNumber = state.fullMoveNumber;
        this.capturedPieces = state.capturedPieces;
        this.moveHistory = state.moveHistory;
    }

    undoMove() {
        if (this.moveUndoStack.length === 0) return false;
        // Save current to redo stack
        this.redoStack.push(this.getCurrentState());
        // Pop from undo stack and apply
        const previousState = this.moveUndoStack.pop();
        this.restoreState(previousState);
        return true;
    }

    redoMove() {
        if (this.redoStack.length === 0) return false;
        // Save current to undo stack
        this.moveUndoStack.push(this.getCurrentState());
        // Pop from redo stack and apply
        const nextState = this.redoStack.pop();
        this.restoreState(nextState);
        return true;
    }

    restart() {
        this.board = this.initializeBoard();
        this.currentPlayer = 'white';
        this.selectedSquare = null;
        this.validMoves = [];
        this.moveHistory = [];
        this.capturedPieces = { white: [], black: [] };
        this.gameStatus = 'playing';
        this.enPassantTarget = null;
        this.castlingRights = { white: { kingside: true, queenside: true }, black: { kingside: true, queenside: true } };
        this.halfMoveClock = 0;
        this.fullMoveNumber = 1;
        this.moveUndoStack = [];
        this.redoStack = [];
    }
    // Paste your entire ChessGame class code here
    // (constructor, initializeBoard, getValidMoves, makeMove, etc.)
}

class ChessAI {
    constructor(difficulty = 'medium') {
        this.difficulty = difficulty;
        // Search depth: 0 for easy, 1 for medium, 2 for hard
        this.maxDepth = difficulty === 'easy' ? 0 : difficulty === 'medium' ? 1 : 2;
    }

    evaluatePosition(game) {
        const pieceValues = { pawn: 10, knight: 30, bishop: 30, rook: 50, queen: 90, king: 900 };
        let score = 0;
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = game.getPiece(row, col);
                if (piece) {
                    let value = pieceValues[piece.type];
                    // Bonus for controlling the center of the board
                    if (row >= 3 && row <= 4 && col >= 3 && col <= 4) value += 2;
                    
                    if (piece.color === 'black') score += value; // AI is black, so higher is better for black
                    else score -= value;
                }
            }
        }
        return score;
    }

    getBestMove(game) {
        let allMoves = [];
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = game.getPiece(row, col);
                if (piece && piece.color === game.currentPlayer) {
                    game.getValidMoves(row, col).forEach(move => {
                        allMoves.push({ fromRow: row, fromCol: col, toRow: move.row, toCol: move.col, type: move.type });
                    });
                }
            }
        }

        if (allMoves.length === 0) return null;

        // Easy Mode: Random Move
        if (this.difficulty === 'easy') {
            return allMoves[Math.floor(Math.random() * allMoves.length)];
        }

        // Medium/Hard Mode: Basic Look-ahead
        let bestScore = -Infinity;
        let bestMove = null;

        // Shuffle moves to add variety if scores are tied
        allMoves = allMoves.sort(() => Math.random() - 0.5); 

        for (let move of allMoves) {
            // Prioritize captures to speed up calculation
            let moveScore = move.type === 'capture' ? 5 : 0; 
            
            // Simulate move (Note: a true engine clones the board, we are doing a fast shallow eval)
            game.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol, 'queen');
            
            if (this.maxDepth > 1) {
                // If Hard, evaluate the resulting board state strictly
                moveScore += this.evaluatePosition(game);
            } else {
                // If Medium, just grab immediate value
                moveScore += this.evaluatePosition(game);
            }
            
            game.undoMove();

            if (moveScore > bestScore) {
                bestScore = moveScore;
                bestMove = move;
            }
        }

        return bestMove || allMoves[0];
    }
}
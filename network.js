class OnlineGame {
    constructor(uiController) {
        this.ui = uiController;
        this.socket = io('http://localhost:3000'); 
        this.roomCode = null;
        this.setupListeners();
    }
    // Add this at the bottom of the OnlineGame class
    leaveRoom() {
        if (this.roomCode) {
            this.socket.emit('leaveRoom', this.roomCode);
            // Reset the room code so they can join a new one later
            this.roomCode = null; 
        }
    }
    // 2. Add this at the bottom of the OnlineGame class (right below leaveRoom)
    sendRestart() {
        if (this.roomCode) {
            this.socket.emit('restartGame', this.roomCode);
        }
    }

    setupListeners() {
        this.socket.on('roomCreated', (code) => {
            this.roomCode = code;
            this.ui.handleRoomCreated(code);
        });
        // 1. Add this inside setupListeners()
        this.socket.on('gameRestarted', () => {
            this.ui.handleOpponentRestart();
        });

        this.socket.on('roomJoined', (code) => {
            this.roomCode = code;
            this.ui.handleRoomJoined(code);
        });

        this.socket.on('roomError', (msg) => {
            showCustomAlert(msg);
        });

        this.socket.on('gameStart', () => {
            this.ui.handleGameStart();
        });

        this.socket.on('receiveMove', (move) => {
            this.ui.handleReceiveMove(move);
        });

        // UPDATED: Now triggers the UI to handle the automatic win
        this.socket.on('opponentDisconnected', () => {
            this.ui.handleOpponentDisconnect();
        });
    }

    createRoom() { this.socket.emit('createRoom'); }
    
    joinRoom(code) { this.socket.emit('joinRoom', code); }
    
    sendMove(moveData) {
        if (this.roomCode) {
            this.socket.emit('makeMove', { roomCode: this.roomCode, move: moveData });
        }
    }
}
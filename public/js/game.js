const socket = io("http://localhost:3000");

class Game {
  constructor() {
    this.loginScreen = document.getElementById("login-screen");
    this.gameScreen = document.getElementById("game-screen");
    this.nameInput = document.getElementById("nameInput");
    this.joinBtn = document.getElementById("join-btn");
    this.playersList = document.getElementById("players");
    this.gameStatus = document.getElementById("game-status");
    this.mazeElement = document.getElementById("maze");
    this.winnerBanner = document.getElementById("winner-banner");
    this.winnerText = document.getElementById("winner-text");
    this.countdownElement = document.getElementById("countdown");

    this.upBtn = document.getElementById("up");
    this.downBtn = document.getElementById("down");
    this.leftBtn = document.getElementById("left");
    this.rightBtn = document.getElementById("right");

    this.playerId = null;
    this.playerName = "";
    this.gameState = null;
    this.isGameActive = false;

    this.setupEventListeners();
    this.setupSocketListeners();
  }

  setupEventListeners() {
    this.joinBtn.addEventListener("click", () => {
      const playerName = this.nameInput.value.trim();
      if (playerName) {
        this.joinGame(playerName);
      }
    });

    this.nameInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        const playerName = this.nameInput.value.trim();
        if (playerName) {
          this.joinGame(playerName);
        }
      }
    });

    this.upBtn.addEventListener("click", () => this.move("up"));
    this.downBtn.addEventListener("click", () => this.move("down"));
    this.leftBtn.addEventListener("click", () => this.move("left"));
    this.rightBtn.addEventListener("click", () => this.move("right"));

    document.addEventListener("keydown", (e) => {
      if (!this.isGameActive) return;

      switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
          this.move("up");
          break;
        case "ArrowDown":
        case "s":
        case "S":
          this.move("down");
          break;
        case "ArrowLeft":
        case "a":
        case "A":
          this.move("left");
          break;
        case "ArrowRight":
        case "d":
        case "D":
          this.move("right");
          break;
      }
    });
  }

  setupSocketListeners() {
    socket.on("connect", () => {
      this.playerId = socket.id;
      console.log("Connected to server with ID:", this.playerId);
    });

    socket.on("joinedGame", (playerData) => {
      console.log("Joined game as player:", playerData);
    });

    socket.on("gameState", (state) => {
      this.gameState = state;
      this.updatePlayersUI();
      this.renderMaze();

      if (state.gameActive) {
        this.gameStatus.textContent = "Game in progress. Find the exit!";
        this.isGameActive = true;
      } else {
        this.gameStatus.textContent = "Waiting for players...";
        this.isGameActive = false;
      }
    });

    socket.on("gameWon", (winner) => {
      this.isGameActive = false;
      this.winnerText.textContent = `${winner.name} found the exit first!`;
      this.winnerBanner.style.display = "block";

      let countdown = 10;
      this.countdownElement.textContent = countdown;

      const timer = setInterval(() => {
        countdown--;
        this.countdownElement.textContent = countdown;

        if (countdown <= 0) {
          clearInterval(timer);
          this.winnerBanner.style.display = "none";
        }
      }, 1000);
    });
  }

  joinGame(playerName) {
    socket.emit("joinGame", playerName);
    this.loginScreen.style.display = "none";
    this.gameScreen.style.display = "flex";
  }

  move(direction) {
    if (this.isGameActive) {
      socket.emit("move", direction);
    }
  }

  updatePlayersUI() {
    this.playersList.innerHTML = "";
    Object.values(this.gameState.players).forEach((player) => {
      const listItem = document.createElement("li");
      listItem.textContent = `${player.name} ${
        player.id === this.playerId ? "(You)" : ""
      }`;
      this.playersList.appendChild(listItem);
    });
  }

  renderMaze() {
    if (!this.gameState || !this.gameState.maze) return;

    const maze = this.gameState.maze;
    this.mazeElement.style.gridTemplateColumns = `repeat(${maze[0].length}, 30px)`;
    this.mazeElement.innerHTML = "";

    for (let y = 0; y < maze.length; y++) {
      for (let x = 0; x < maze[y].length; x++) {
        const cell = document.createElement("div");
        cell.classList.add("cell");

        if (maze[y][x] === 1) {
          cell.classList.add("wall");
        } else {
          cell.classList.add("path");
        }

        if (x === this.gameState.start.x && y === this.gameState.start.y) {
          cell.classList.add("start");
          cell.textContent = "S";
        } else if (x === this.gameState.exit.x && y === this.gameState.exit.y) {
          cell.classList.add("exit");
          cell.textContent = "E";
        }

        cell.dataset.x = x;
        cell.dataset.y = y;
        this.mazeElement.appendChild(cell);
      }
    }

    Object.values(this.gameState.players).forEach((player) => {
      const x = player.position.x;
      const y = player.position.y;
      const cellIndex = y * maze[0].length + x;
      const cell = this.mazeElement.children[cellIndex];

      if (cell) {
        const playerMarker = document.createElement("div");
        playerMarker.classList.add("player");
        playerMarker.style.backgroundColor = player.color;
        playerMarker.style.width = "20px";
        playerMarker.style.height = "20px";
        playerMarker.title = player.name;

        if (player.id === this.playerId) {
          playerMarker.style.border = "2px solid black";
        }

        Array.from(cell.children).forEach((child) => {
          if (child.classList.contains("player")) {
            cell.removeChild(child);
          }
        });

        cell.appendChild(playerMarker);
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new Game();
});

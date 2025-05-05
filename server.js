import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:8080",
    methods: ["GET", "POST"],
  },
});

// Serve static files
app.use(express.static("public"));

// Game state
const gameState = {
  players: {},
  maze: [],
  start: { x: 1, y: 1 },
  exit: { x: 0, y: 0 },
  gameActive: false,
};

// Generate a random color
function getRandomColor() {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

// Add this function after the getRandomColor function
function getPlayerStartPosition(playerCount) {
  // Define corner positions for up to 4 players
  const startPositions = [
    { x: 1, y: 1 }, // Top-left
    { x: 19, y: 19 }, // Bottom-right
    { x: 1, y: 19 }, // Bottom-left
    { x: 19, y: 1 }, // Top-right
  ];

  return startPositions[playerCount % startPositions.length];
}

// Generate a maze using DFS
function generateMaze(width, height) {
  // Initialize maze with walls
  const maze = Array(height)
    .fill()
    .map(() => Array(width).fill(1));

  // Start at a random position
  const startX = 1;
  const startY = 1;
  maze[startY][startX] = 0;

  // DFS to create paths
  const stack = [{ x: startX, y: startY }];
  const directions = [
    { dx: 0, dy: -2 }, // Up
    { dx: 2, dy: 0 }, // Right
    { dx: 0, dy: 2 }, // Down
    { dx: -2, dy: 0 }, // Left
  ];

  while (stack.length > 0) {
    const current = stack[stack.length - 1];

    // Get possible directions
    const validDirections = directions.filter((dir) => {
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;
      return (
        nx > 0 &&
        nx < width - 1 &&
        ny > 0 &&
        ny < height - 1 &&
        maze[ny][nx] === 1
      );
    });

    if (validDirections.length === 0) {
      stack.pop();
      continue;
    }

    // Choose random direction
    const dir =
      validDirections[Math.floor(Math.random() * validDirections.length)];

    // Carve path
    const nx = current.x + dir.dx;
    const ny = current.y + dir.dy;
    maze[ny][nx] = 0;

    // Carve path between cells
    maze[current.y + dir.dy / 2][current.x + dir.dx / 2] = 0;

    // Push new position to stack
    stack.push({ x: nx, y: ny });
  }

  // Set exit point
  let exitX, exitY;
  do {
    exitX = width - 2;
    exitY = Math.floor(Math.random() * (height - 2)) + 1;
  } while (maze[exitY][exitX] === 1);

  return {
    maze,
    start: { x: startX, y: startY },
    exit: { x: exitX, y: exitY },
  };
}

// Start a new game
function startNewGame() {
  const { maze, exit } = generateMaze(21, 21);

  gameState.maze = maze;
  gameState.exit = exit;
  gameState.gameActive = true;

  // Keep players in their initial positions instead of resetting
  io.emit("gameState", gameState);
}

// Socket connection handling
io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  socket.on("joinGame", (playerName) => {
    const playerCount = Object.keys(gameState.players).length;
    const startPosition = getPlayerStartPosition(playerCount);

    const player = {
      id: socket.id,
      name: playerName,
      position: startPosition,
      color: getRandomColor(),
    };

    gameState.players[socket.id] = player;
    console.log(
      `Player ${playerName} joined the game at position:`,
      startPosition
    );

    // Send player data to the client
    socket.emit("joinedGame", player);

    // Start game if we have at least 2 players
    if (Object.keys(gameState.players).length >= 2 && !gameState.gameActive) {
      setTimeout(startNewGame, 3000);
    } else {
      // Send current game state
      io.emit("gameState", gameState);
    }
  });

  socket.on("disconnect", () => {
    // Remove player from game state
    delete gameState.players[socket.id];
    io.emit("playerJoined", gameState.players);
  });

  // Handle player movement
  socket.on("move", (direction) => {
    if (!gameState.gameActive || !gameState.players[socket.id]) return;

    const player = gameState.players[socket.id];
    const { x, y } = player.position;
    let newX = x;
    let newY = y;

    // Calculate new position
    switch (direction) {
      case "up":
        newY--;
        break;
      case "down":
        newY++;
        break;
      case "left":
        newX--;
        break;
      case "right":
        newX++;
        break;
    }

    // Check if valid move
    if (
      newX >= 0 &&
      newX < gameState.maze[0].length &&
      newY >= 0 &&
      newY < gameState.maze.length &&
      gameState.maze[newY][newX] !== 1
    ) {
      // Update player position
      player.position = { x: newX, y: newY };

      // Check if player found exit
      if (newX === gameState.exit.x && newY === gameState.exit.y) {
        console.log(`Player ${player.name} found the exit!`);
        gameState.gameActive = false;

        // Notify all clients about the winner
        io.emit("gameWon", player);

        // Start a new game after delay
        setTimeout(() => {
          startNewGame();
        }, 10000);
      }

      // Send updated game state to all clients
      io.emit("gameState", gameState);
    }
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);

    // Remove player from game
    if (gameState.players[socket.id]) {
      delete gameState.players[socket.id];
      io.emit("gameState", gameState);

      // Check if game should continue
      if (Object.keys(gameState.players).length < 2 && gameState.gameActive) {
        gameState.gameActive = false;
        io.emit("gameState", gameState);
      }
    }
  });
});

// Generate initial maze
const { maze, start, exit } = generateMaze(21, 21);
gameState.maze = maze;
gameState.start = start;
gameState.exit = exit;

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

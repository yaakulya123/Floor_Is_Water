let tileset;      // image containing all 360 tiles
let woodImg, stoneImg; // PNG images for barriers

// Sound variables
let mainThemeMusic;
let hoverSound;
let placeWoodSound;
let placeSteelSound;
let tileSize = 8; // width/height of a single tile
let tilesPerRow = 24; // how many tiles per row in the tileset (360 / 20 = 18 rows)
let mapData;       // array loaded from CSV
let mapRows, mapCols;
let scaleFactor = 3; // tile scaling multiplier

// Water effect game variables
let gameGrid = [];
let woodHealthGrid = []; // tracks wood barrier health
let waterTimer = 0;
let woodTimer = 0;
let stoneTimer = 0;
let woodAvailable = 0;
let stoneAvailable = 0;
let currentFlag = 0; // current water level flag
let waterLevel = 0; // global water level (row from bottom)
let columnBlocked = []; // tracks which columns have stone barriers
let hoveredRow = -1; // hovered cell row
let hoveredCol = -1; // hovered cell column
let gameStartTime = 0; // when the game started
let gameOver = false; // game over state
let gameOverReason = ""; // reason for game over
let lastHoveredCell = ""; // track last hovered cell for sound

// Game states
let gameState = "mainMenu"; // mainMenu, story, playing, gameOver, credits, win
let menuButtons = [];
let gameWon = false;

// Water tile index for overlay
const WATER_TILE = 340;
const WOOD_RESISTANCE_TIME = 5000; // 5 seconds for wood degradation

function preload() {
  // Load your tileset image (spritesheet)
  tileset = loadImage("tilemap_packed.png",
    () => console.log("Tileset loaded"),
    () => console.log("Failed to load tileset")
  );

  // Load barrier images
  woodImg = loadImage("tileWood.png",
    () => console.log("Wood image loaded"),
    () => console.log("Failed to load wood image")
  );
  stoneImg = loadImage("tileSteel.png",
    () => console.log("Steel image loaded"),
    () => console.log("Failed to load steel image")
  );

  // Load sound files (local)
  mainThemeMusic = loadSound("mainThemeMusic.mp3",
    () => console.log("Main theme loaded"),
    () => console.log("Failed to load main theme")
  );

  hoverSound = loadSound("tileHoverSound.ogg",
    () => console.log("Hover sound loaded"),
    () => console.log("Failed to load hover sound")
  );

  placeWoodSound = loadSound("placeWoodSound.ogg",
    () => console.log("Wood placement sound loaded"),
    () => console.log("Failed to load wood placement sound")
  );

  placeSteelSound = loadSound("placeSteelSound.ogg",
    () => console.log("Steel placement sound loaded"),
    () => console.log("Failed to load steel placement sound")
  );

  // Load the CSV file (each row has numbers separated by commas)
  mapData = loadTable("pixelcity_base_35.csv", "csv");
}

function setup() {
  createCanvas(840, 840); // adjust depending on map size

  // Check if data loaded properly - wait for it to load
  if (!mapData || mapData.getRowCount() === 0) {
    console.log("Map data not loaded properly, retrying...");
    setTimeout(setup, 100); // retry in 100ms
    return;
  }

  mapRows = mapData.getRowCount();
  mapCols = mapData.getColumnCount();

  console.log("Map loaded:", mapRows, "x", mapCols);

  // Start game timer
  gameStartTime = millis();

  // Don't start music here - wait for game to start

  // Initialize game grid and water level system
  waterLevel = Math.floor(mapRows / 6); // start with bottom sixth flooded (less water)

  for (let col = 0; col < mapCols; col++) {
    columnBlocked[col] = false; // no columns blocked initially
  }

  for (let row = 0; row < mapRows; row++) {
    gameGrid[row] = [];
    woodHealthGrid[row] = [];
    for (let col = 0; col < mapCols; col++) {
      // Create uniform water level
      if (row >= mapRows - waterLevel) {
        gameGrid[row][col] = 'water';
      } else {
        gameGrid[row][col] = 'land';
      }
      woodHealthGrid[row][col] = 0; // no wood health initially
    }
  }
}

function draw() {
  // Handle different game states
  if (gameState === "mainMenu") {
    drawMainMenu();
  } else if (gameState === "story") {
    drawStoryScreen();
  } else if (gameState === "credits") {
    drawCreditsScreen();
  } else if (gameState === "playing") {
    drawGame();
  } else if (gameState === "gameOver") {
    drawGameOverScreen();
  } else if (gameState === "win") {
    drawWinScreen();
  }
}

function drawGame() {
  background(220);

  // Update hovered cell based on mouse position
  updateHoveredCell();

  // Check game over conditions
  if (!gameOver) {
    checkGameOverConditions();
  }

  // Update game timers - Water level rising every 5 seconds
  if (!gameOver && millis() - waterTimer > 5000) {
    checkWaterLevelRising();
    waterTimer = millis();
  }

  if (!gameOver && millis() - woodTimer > 3000) {
    woodAvailable++;
    woodTimer = millis();
  }

  if (!gameOver && millis() - stoneTimer > 3500) {
    stoneAvailable++;
    stoneTimer = millis();
  }

  let drawSize = tileSize * scaleFactor;

  for (let row = 0; row < mapRows; row++) {
    for (let col = 0; col < mapCols; col++) {
      let dx = col * drawSize;
      let dy = row * drawSize;

      // Draw base city tile for land
      if (gameGrid[row][col] === 'land') {
        let tileIndex = int(mapData.getString(row, col));
        let sx = (tileIndex % tilesPerRow) * tileSize;
        let sy = floor(tileIndex / tilesPerRow) * tileSize;
        image(tileset, dx, dy, drawSize, drawSize, sx, sy, tileSize, tileSize);
      } else {
        // Draw game elements
        if (gameGrid[row][col] === 'water') {
          fill(30, 144, 255); // bright blue water
          noStroke();
          rect(dx, dy, drawSize, drawSize);
        } else if (gameGrid[row][col] === 'wood') {
          // Draw wood PNG with health-based tinting
          let healthPercent = woodHealthGrid[row][col] / WOOD_RESISTANCE_TIME;
          if (healthPercent <= 0) healthPercent = 0.3; // minimum visibility for degraded wood

          tint(255, 255 * healthPercent); // fade as it degrades
          image(woodImg, dx, dy, drawSize, drawSize);
          noTint(); // reset tint
        } else if (gameGrid[row][col] === 'stone') {
          // Draw stone PNG
          image(stoneImg, dx, dy, drawSize, drawSize);
        }
      }

      // Draw hover highlight
      if (row === hoveredRow && col === hoveredCol) {
        stroke(255, 255, 0); // yellow hover border
        strokeWeight(3);
        noFill();
        rect(dx, dy, drawSize, drawSize);
      }
    }
  }

  // Draw HUD
  drawHUD();
}

function drawHUD() {
  // Calculate remaining dry land
  let dryTiles = 0;
  for (let row = 0; row < mapRows; row++) {
    for (let col = 0; col < mapCols; col++) {
      if (gameGrid[row][col] !== 'water') {
        dryTiles++;
      }
    }
  }

  // HUD background
  fill(0, 0, 0, 150);
  rect(0, height - 80, width, 80);

  // Resource text
  fill(255);
  textSize(16);
  text("Wood: " + woodAvailable, 10, height - 60);
  text("Stone: " + stoneAvailable, 10, height - 40);
  text("Dry tiles left: " + dryTiles, 10, height - 20);

  // Display timer
  let timeElapsed = millis() - gameStartTime;
  let timeLeft = Math.max(0, 90 - Math.floor(timeElapsed / 1000));
  fill(timeLeft <= 10 ? color(255, 100, 100) : color(255));
  text("Time left: " + timeLeft + "s", 150, height - 60);

  // Display current flag
  fill(currentFlag === 1 ? color(255, 100, 100) : color(100, 255, 100));
  text("Water Flag: " + currentFlag + (currentFlag === 1 ? " (RISING!)" : " (stable)"), 200, height - 20);

  // Instructions
  textAlign(RIGHT);
  text("Hover + W=Wood, S=Stone", width - 10, height - 60);
  text("Water level rises every 5s", width - 10, height - 40);
  text("Keep the city dry!", width - 10, height - 20);
  textAlign(LEFT);
}

function updateHoveredCell() {
  let drawSize = tileSize * scaleFactor;

  // Don't hover in HUD area
  if (mouseY > height - 80) {
    hoveredRow = -1;
    hoveredCol = -1;
    return;
  }

  // Update hovered cell based on mouse position
  let col = floor(mouseX / drawSize);
  let row = floor(mouseY / drawSize);

  if (col >= 0 && col < mapCols && row >= 0 && row < mapRows) {
    // Check if we moved to a new cell
    let currentCell = row + "," + col;
    if (currentCell !== lastHoveredCell) {
      // Play hover sound when moving to a new cell
      if (hoverSound && hoverSound.isLoaded()) {
        hoverSound.setVolume(0.2); // Quiet hover sound
        hoverSound.play();
      }
      lastHoveredCell = currentCell;
    }

    hoveredRow = row;
    hoveredCol = col;
  } else {
    hoveredRow = -1;
    hoveredCol = -1;
    lastHoveredCell = "";
  }
}

function mousePressed() {
  if (gameState === "mainMenu") {
    // Main menu clicks
    if (mouseY >= height/2 - 40 && mouseY <= height/2) {
      // Play button
      gameState = "story";
    } else if (mouseY >= height/2 && mouseY <= height/2 + 40) {
      // Credits button
      gameState = "credits";
    } else if (mouseY >= height/2 + 40 && mouseY <= height/2 + 80) {
      // Quit button
      window.close();
    }
  } else if (gameState === "story") {
    // Let's go button
    if (mouseX >= width/2 - 50 && mouseX <= width/2 + 50 &&
        mouseY >= height/2 + 80 && mouseY <= height/2 + 120) {
      startGame();
    }
  } else if (gameState === "credits") {
    // Click anywhere to return
    gameState = "mainMenu";
  } else if (gameState === "gameOver" || gameState === "win") {
    // Replay button
    if (mouseX >= width/2 - 50 && mouseX <= width/2 + 50 &&
        mouseY >= height/2 + 80 && mouseY <= height/2 + 120) {
      resetGame();
    }
  }
}

function startGame() {
  gameState = "playing";
  gameStartTime = millis();
  gameOver = false;

  // Start background music
  if (mainThemeMusic && mainThemeMusic.isLoaded()) {
    mainThemeMusic.setVolume(0.3);
    mainThemeMusic.loop();
  }
}

function resetGame() {
  gameState = "mainMenu";
  gameOver = false;
  gameOverReason = "";
  hoveredRow = -1;
  hoveredCol = -1;
  woodAvailable = 0;
  stoneAvailable = 0;
  currentFlag = 0;
  waterLevel = Math.floor(mapRows / 6);

  // Reset timers
  waterTimer = 0;
  woodTimer = 0;
  stoneTimer = 0;

  // Reset grid
  for (let row = 0; row < mapRows; row++) {
    for (let col = 0; col < mapCols; col++) {
      if (row >= mapRows - waterLevel) {
        gameGrid[row][col] = 'water';
      } else {
        gameGrid[row][col] = 'land';
      }
      woodHealthGrid[row][col] = 0;
    }
  }

  // Reset column blocking
  for (let col = 0; col < mapCols; col++) {
    columnBlocked[col] = false;
  }
}

function keyPressed() {
  // Only place if hovering over a valid cell AND in playing state
  if (gameState === "playing" && hoveredRow >= 0 && hoveredCol >= 0) {
    if (key === 'w' || key === 'W') {
      // Place wood
      if (gameGrid[hoveredRow][hoveredCol] === 'land' && woodAvailable > 0) {
        gameGrid[hoveredRow][hoveredCol] = 'wood';
        woodHealthGrid[hoveredRow][hoveredCol] = WOOD_RESISTANCE_TIME;
        woodAvailable--;

        // Play wood placement sound
        if (placeWoodSound && placeWoodSound.isLoaded()) {
          placeWoodSound.setVolume(0.4);
          placeWoodSound.play();
        }

        console.log("Placed wood at", hoveredRow, hoveredCol);
      }
    } else if (key === 's' || key === 'S') {
      // Place stone
      if (gameGrid[hoveredRow][hoveredCol] === 'land' && stoneAvailable > 0) {
        gameGrid[hoveredRow][hoveredCol] = 'stone';
        stoneAvailable--;

        // Play steel placement sound
        if (placeSteelSound && placeSteelSound.isLoaded()) {
          placeSteelSound.setVolume(0.5);
          placeSteelSound.play();
        }

        console.log("Placed stone at", hoveredRow, hoveredCol);
      }
    }
  }
}

function checkWaterLevelRising() {
  // Random flag: 0 = no rising, 1 = water level rises
  currentFlag = Math.floor(Math.random() * 2);

  console.log("Water level check - Flag:", currentFlag);

  // Always check wood degradation
  degradeWoodAtWaterLevel();

  // Only rise water level if flag = 1
  if (currentFlag === 1) {
    riseWaterLevel();
  }
}

function degradeWoodAtWaterLevel() {
  // Degrade wood that's at the water level
  let waterRow = mapRows - waterLevel;

  for (let col = 0; col < mapCols; col++) {
    if (!columnBlocked[col] && gameGrid[waterRow][col] === 'wood') {
      woodHealthGrid[waterRow][col] -= 5000; // degrade by 5 seconds

      if (woodHealthGrid[waterRow][col] <= 0) {
        // Wood is fully degraded
        if (currentFlag === 1) {
          // Flag = 1: Replace degraded wood with water
          gameGrid[waterRow][col] = 'water';
        }
        // Flag = 0: Wood stays degraded (brown) but doesn't become water
        woodHealthGrid[waterRow][col] = 0;
      }
    }
  }
}

function riseWaterLevel() {
  // Increase global water level
  waterLevel++;

  if (waterLevel > mapRows) {
    waterLevel = mapRows; // cap at map height
    return;
  }

  // Update column blocking based on stone barriers
  updateColumnBlocking();

  // Apply uniform water level across all non-blocked columns
  for (let row = 0; row < mapRows; row++) {
    for (let col = 0; col < mapCols; col++) {
      if (!columnBlocked[col]) {
        // In non-blocked columns, apply uniform water level
        if (row >= mapRows - waterLevel) {
          if (gameGrid[row][col] !== 'stone') {
            gameGrid[row][col] = 'water';
          }
        }
      }
    }
  }

  console.log("Water level rose to:", waterLevel);
}

function updateColumnBlocking() {
  // Check each column for stone barriers that block water rising
  for (let col = 0; col < mapCols; col++) {
    columnBlocked[col] = false;

    // Check from water level upward for stone barriers
    for (let row = mapRows - waterLevel; row < mapRows; row++) {
      if (gameGrid[row][col] === 'stone') {
        columnBlocked[col] = true;
        break;
      }
    }
  }
}

function checkGameOverConditions() {
  // Check time limit - WIN condition
  let timeElapsed = millis() - gameStartTime;
  if (timeElapsed >= 90000) { // 90 seconds - PLAYER WINS!
    gameState = "win";
    return;
  }

  // Check if water reached top row - LOSE condition
  for (let col = 0; col < mapCols; col++) {
    if (gameGrid[0][col] === 'water') {
      gameState = "gameOver";
      gameOverReason = "Water reached the top! The city is drowned!";
      return;
    }
  }
}

// Menu and screen drawing functions
function drawMainMenu() {
  background(75, 75, 150); // Purple background

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(48);
  text("THE FLOOR IS WATER", width/2, height/2 - 100);

  textSize(24);
  text("Play", width/2, height/2 - 20);
  text("Credits", width/2, height/2 + 20);
  text("Quit", width/2, height/2 + 60);

  textAlign(LEFT);
}

function drawStoryScreen() {
  background(75, 75, 150); // Purple background

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(18);
  text("Mayor! The sea water is rising.", width/2, height/2 - 60);
  text("Help us by building and placing barriers", width/2, height/2 - 20);
  text("so that it halts the waves!", width/2, height/2 + 20);

  // Let's go button
  fill(255, 255, 100);
  stroke(255);
  strokeWeight(2);
  rect(width/2 - 50, height/2 + 80, 100, 40);

  fill(0);
  textSize(16);
  text("Let's go", width/2, height/2 + 100);

  textAlign(LEFT);
}

function drawCreditsScreen() {
  background(75, 75, 150); // Purple background

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(32);
  text("CREDITS", width/2, height/2 - 100);

  textSize(18);
  text("Yaakulya - Mechanics and designed gameplay", width/2, height/2 - 20);
  text("Ahmad - Story, Sound, Visualisations, Asset management", width/2, height/2 + 20);

  textSize(16);
  text("Click anywhere to return", width/2, height/2 + 80);

  textAlign(LEFT);
}

function drawGameOverScreen() {
  background(120, 50, 50); // Red background

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(48);
  text("YOU FAIL", width/2, height/2 - 60);

  textSize(18);
  text("The city sunk along with its people.", width/2, height/2 - 10);
  text("Perhaps your decisions could be better in the next life.", width/2, height/2 + 20);

  // Replay button
  fill(255);
  stroke(0);
  strokeWeight(2);
  rect(width/2 - 50, height/2 + 80, 100, 40);

  fill(0);
  textSize(16);
  text("REPLAY", width/2, height/2 + 100);

  textAlign(LEFT);
}

function drawWinScreen() {
  background(50, 120, 100); // Green background

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(48);
  text("SUCCESS!", width/2, height/2 - 60);

  textSize(18);
  text("Your quick-witted actions saved the town & people.", width/2, height/2 - 10);
  text("The tide is over for now, but who knows what future holds?", width/2, height/2 + 20);

  // Replay button
  fill(255);
  stroke(0);
  strokeWeight(2);
  rect(width/2 - 50, height/2 + 80, 100, 40);

  fill(0);
  textSize(16);
  text("REPLAY", width/2, height/2 + 100);

  textAlign(LEFT);
}

let tileset;      // image containing all 360 tiles
let woodImg, stoneImg; // PNG images for barriers
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
let selectedRow = -1; // selected cell row
let selectedCol = -1; // selected cell column
let gameStartTime = 0; // when the game started
let gameOver = false; // game over state
let gameOverReason = ""; // reason for game over

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

  // Load the CSV file (each row has numbers separated by commas)
  mapData = loadTable("pixelcity_base_City.csv", "csv");
}

function setup() {
  createCanvas(700, 700); // adjust depending on map size

  // Check if data loaded properly
  if (!mapData || mapData.getRowCount() === 0) {
    console.log("Map data not loaded properly");
    return;
  }

  mapRows = mapData.getRowCount();
  mapCols = mapData.getColumnCount();

  console.log("Map loaded:", mapRows, "x", mapCols);

  // Start game timer
  gameStartTime = millis();

  // Initialize game grid and water level system
  waterLevel = Math.floor(mapRows / 3); // start with bottom third flooded

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
  background(220);

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

      // Draw selection highlight
      if (row === selectedRow && col === selectedCol) {
        stroke(255, 255, 0); // yellow selection border
        strokeWeight(3);
        noFill();
        rect(dx, dy, drawSize, drawSize);
      }
    }
  }

  // Draw HUD
  drawHUD();

  // Draw game over popup
  if (gameOver) {
    drawGameOverPopup();
  }
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
  text("Click to select, W=Wood, S=Stone", width - 10, height - 60);
  text("Water level rises every 5s", width - 10, height - 40);
  text("Keep the city dry!", width - 10, height - 20);
  textAlign(LEFT);
}

function mousePressed() {
  let drawSize = tileSize * scaleFactor;
  let col = floor(mouseX / drawSize);
  let row = floor(mouseY / drawSize);

  // Don't select in HUD area
  if (mouseY > height - 80) return;

  // Select cell
  if (col >= 0 && col < mapCols && row >= 0 && row < mapRows) {
    selectedRow = row;
    selectedCol = col;
    console.log("Selected cell:", row, col);
  }
}

function keyPressed() {
  // Only place if a cell is selected
  if (selectedRow >= 0 && selectedCol >= 0) {
    if (key === 'w' || key === 'W') {
      // Place wood
      if (gameGrid[selectedRow][selectedCol] === 'land' && woodAvailable > 0) {
        gameGrid[selectedRow][selectedCol] = 'wood';
        woodHealthGrid[selectedRow][selectedCol] = WOOD_RESISTANCE_TIME;
        woodAvailable--;
        console.log("Placed wood at", selectedRow, selectedCol);
      }
    } else if (key === 's' || key === 'S') {
      // Place stone
      if (gameGrid[selectedRow][selectedCol] === 'land' && stoneAvailable > 0) {
        gameGrid[selectedRow][selectedCol] = 'stone';
        stoneAvailable--;
        console.log("Placed stone at", selectedRow, selectedCol);
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
  // Check time limit
  let timeElapsed = millis() - gameStartTime;
  if (timeElapsed >= 90000) { // 90 seconds
    gameOver = true;
    gameOverReason = "Time's up! The city is completely drowned!";
    return;
  }

  // Check if water reached top row
  for (let col = 0; col < mapCols; col++) {
    if (gameGrid[0][col] === 'water') {
      gameOver = true;
      gameOverReason = "Water reached the top! The city is drowned!";
      return;
    }
  }
}

function drawGameOverPopup() {
  // Semi-transparent overlay
  fill(0, 0, 0, 200);
  rect(0, 0, width, height);

  // Game over box
  fill(200, 50, 50);
  stroke(255);
  strokeWeight(3);
  rect(width/4, height/3, width/2, height/3);

  // Game over text
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(24);
  text("GAME OVER!", width/2, height/2 - 40);

  textSize(16);
  text(gameOverReason, width/2, height/2);

  textSize(14);
  text("Refresh to play again", width/2, height/2 + 40);

  textAlign(LEFT); // reset text alignment
}

let tileset;      // image containing all 360 tiles
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

// Water tile index for overlay
const WATER_TILE = 340;
const WOOD_RESISTANCE_TIME = 4000; // 4 seconds (2 water spread cycles)

function preload() {
  // Load your tileset image (spritesheet)
  tileset = loadImage("tilemap_packed.png");
  
  // Load the CSV file (each row has numbers separated by commas)
  mapData = loadTable("pixelcity_base_City.csv", "csv");
}

function setup() {
  createCanvas(700, 700); // adjust depending on map size
  mapRows = mapData.getRowCount();
  mapCols = mapData.getColumnCount();

  // Initialize game grid to match map size
  for (let row = 0; row < mapRows; row++) {
    gameGrid[row] = [];
    woodHealthGrid[row] = [];
    for (let col = 0; col < mapCols; col++) {
      if (row >= mapRows * 2 / 3) {
        gameGrid[row][col] = 'water'; // bottom third water
      } else {
        gameGrid[row][col] = 'land';
      }
      woodHealthGrid[row][col] = 0; // no wood health initially
    }
  }
}

function draw() {
  background(220);

  // Update game timers
  if (millis() - waterTimer > 2000) {
    spreadWater();
    waterTimer = millis();
  }

  if (millis() - woodTimer > 3000) {
    woodAvailable++;
    woodTimer = millis();
  }

  if (millis() - stoneTimer > 3500) {
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
        // Draw colored overlays for game elements
        if (gameGrid[row][col] === 'water') {
          fill(30, 144, 255); // bright blue water
        } else if (gameGrid[row][col] === 'wood') {
          // Wood color changes as it degrades
          let healthPercent = woodHealthGrid[row][col] / WOOD_RESISTANCE_TIME;
          let brownness = 139 * healthPercent;
          fill(brownness, 69 * healthPercent, 19 * healthPercent); // darker as it degrades
        } else if (gameGrid[row][col] === 'stone') {
          fill(0, 0, 0); // black stone
        }
        noStroke();
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

  // Instructions
  textAlign(RIGHT);
  text("Click to place barriers", width - 10, height - 60);
  text("Water spreads every 2s", width - 10, height - 40);
  text("Keep the city dry!", width - 10, height - 20);
  textAlign(LEFT);
}

function mousePressed() {
  let drawSize = tileSize * scaleFactor;
  let col = floor(mouseX / drawSize);
  let row = floor(mouseY / drawSize);

  // Don't place on HUD area
  if (mouseY > height - 80) return;

  if (col >= 0 && col < mapCols && row >= 0 && row < mapRows) {
    if (gameGrid[row][col] === 'land') {
      if (woodAvailable > 0) {
        gameGrid[row][col] = 'wood';
        woodHealthGrid[row][col] = WOOD_RESISTANCE_TIME; // full health
        woodAvailable--;
      } else if (stoneAvailable > 0) {
        gameGrid[row][col] = 'stone';
        stoneAvailable--;
      }
    }
  }
}

function spreadWater() {
  let newGrid = JSON.parse(JSON.stringify(gameGrid));
  let currentTime = millis();

  // First, degrade wood that's touching water
  for (let row = 0; row < mapRows; row++) {
    for (let col = 0; col < mapCols; col++) {
      if (gameGrid[row][col] === 'wood') {
        // Check if wood is adjacent to water
        let neighbors = [
          [col + 1, row], [col - 1, row], [col, row + 1], [col, row - 1]
        ];

        let touchingWater = false;
        for (let n of neighbors) {
          let nx = n[0];
          let ny = n[1];
          if (nx >= 0 && nx < mapCols && ny >= 0 && ny < mapRows) {
            if (gameGrid[ny][nx] === 'water') {
              touchingWater = true;
              break;
            }
          }
        }

        if (touchingWater) {
          woodHealthGrid[row][col] -= 2000; // reduce health by 2 seconds each spread
          if (woodHealthGrid[row][col] <= 0) {
            newGrid[row][col] = 'water'; // wood dissolves into water
            woodHealthGrid[row][col] = 0;
          }
        }
      }
    }
  }

  // Then spread water to land and dissolved wood
  for (let row = 0; row < mapRows; row++) {
    for (let col = 0; col < mapCols; col++) {
      if (gameGrid[row][col] === 'water') {
        let neighbors = [
          [col + 1, row], [col - 1, row], [col, row + 1], [col, row - 1]
        ];

        for (let n of neighbors) {
          let nx = n[0];
          let ny = n[1];
          if (nx >= 0 && nx < mapCols && ny >= 0 && ny < mapRows) {
            if (gameGrid[ny][nx] === 'land') {
              newGrid[ny][nx] = 'water';
            }
            // Wood and stone block immediate water spread (wood degrades over time)
          }
        }
      }
    }
  }

  gameGrid = newGrid;
}

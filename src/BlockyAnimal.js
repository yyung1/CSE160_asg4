// ColoredPoint.js (c) 2012 matsuda
// Vertex shader program
var VSHADER_SOURCE = `
  precision mediump float;
  attribute vec4 a_Position;
  attribute vec2 a_UV;
  attribute vec3 a_Normal;
  varying vec2 v_UV;
  varying vec3 v_Normal;
  varying vec4 v_VertPos;
  uniform mat4 u_ModelMatrix;
  uniform mat4 u_GlobalRotateMatrix;
  uniform mat4 u_ViewMatrix;
  uniform mat4 u_NormalMatrix;
  uniform mat4 u_ProjectionMatrix;
  void main() {
    gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_GlobalRotateMatrix * u_ModelMatrix * a_Position;
    v_UV = a_UV;
    // v_Normal = a_Normal;
    v_Normal = normalize(vec3(u_NormalMatrix * vec4(a_Normal, 1)));
    v_VertPos = u_ModelMatrix * a_Position;
  }`

// Fragment shader program
var FSHADER_SOURCE = `
  precision mediump float;
  
  varying vec2 v_UV;
  varying vec3 v_Normal;
  varying vec4 v_VertPos;
  uniform sampler2D u_GrassTexture;
  uniform sampler2D u_DirtTexture;
  uniform sampler2D u_FurTexture;
  uniform sampler2D u_LogTexture;
  uniform sampler2D u_LeavesTexture;
  uniform int u_whichTexture;
  uniform vec2 u_resolution;
  uniform vec3 u_lightPos;
  uniform vec3 u_cameraPos;
  uniform vec4 u_FragColor;
  uniform int u_lightOn;
  uniform float u_dayFactor;
  uniform int u_flashlightOn;
  uniform vec3 u_flashlightPos;
  uniform vec3 u_flashlightDir;
  uniform float u_flashlightCutoff;
  
  void main() {
    vec4 baseColor;
    if (u_whichTexture == -3) {
      baseColor = vec4((v_Normal + 1.0) / 2.0, 1.0);
    } else if (u_whichTexture == -2) {
      baseColor = u_FragColor;
    } else if (u_whichTexture == -1) {
      baseColor = vec4(v_UV, 1.0, 1.0);
    } else if (u_whichTexture == 0) {
      baseColor = texture2D(u_FurTexture, v_UV);
    } else if (u_whichTexture == 1) {
      baseColor = texture2D(u_GrassTexture, v_UV);
    } else if (u_whichTexture == 2) {
      baseColor = texture2D(u_DirtTexture, v_UV);
    } else if (u_whichTexture == 3) {
      baseColor = texture2D(u_LogTexture, v_UV);
    } else if (u_whichTexture == 4) {
      baseColor = texture2D(u_LeavesTexture, v_UV);
    } else if (u_whichTexture == 99) {
      baseColor = u_FragColor;
    } else {
      baseColor = vec4(1.0, 0.2, 0.2, 1.0);
    }

    vec3 left = texture2D(u_GrassTexture, v_UV - vec2(1.0/u_resolution.x, 0)).rgb;
    vec3 right = texture2D(u_GrassTexture, v_UV + vec2(1.0/u_resolution.x, 0)).rgb;
    vec3 top = texture2D(u_GrassTexture, v_UV - vec2(0, 1.0/u_resolution.y)).rgb;
    vec3 bottom = texture2D(u_GrassTexture, v_UV + vec2(0, 1.0/u_resolution.y)).rgb;
    float edgeFactor = length(left - right) + length(top - bottom);
    edgeFactor = smoothstep(0.1, 0.5, edgeFactor);
    baseColor.rgb = mix(baseColor.rgb, vec3(0.5), edgeFactor);
    
    // Main Light
    vec3 lightVector = u_lightPos - vec3(v_VertPos);
    vec3 L = normalize(lightVector);
    vec3 N = normalize(v_Normal);
    float nDotL = max(dot(N, L), 0.0);
    vec3 R = reflect(-L, N);
    vec3 E = normalize(u_cameraPos - vec3(v_VertPos));
    
    // Main specular contribution (applied only for a specific texture state)
    float mainSpecular = 0.0;
    if(u_lightOn == 1 && u_whichTexture == -2) {
      mainSpecular = pow(max(dot(E, R), 0.0), 10.0);
    }
    
    vec3 mainDiffuse = vec3(baseColor) * nDotL * 0.7;
    vec3 ambient;
    if(u_whichTexture == 99) {
      ambient = vec3(baseColor) * float(u_dayFactor);
    } else {
      ambient = vec3(baseColor) * min(float(u_dayFactor), 0.3);
    }
    
    vec3 totalDiffuse = mainDiffuse;
    vec3 totalSpecular = vec3(mainSpecular);
    
    // Flashlight
    if(u_flashlightOn == 1) {
      vec3 flashlightVector = u_flashlightPos - vec3(v_VertPos);
      vec3 Lf = normalize(flashlightVector);
      // Compute the alignment between flashlight direction and the fragment-to-light vector
      float theta = dot(normalize(u_flashlightDir), -Lf);
      if(theta > u_flashlightCutoff) {
        float epsilon = 0.1;  // soft edge factor
        float intensity = clamp((theta - u_flashlightCutoff)/epsilon, 0.0, 1.0);
        // Flashlight diffuse contribution
        totalDiffuse += vec3(1.0) * intensity * nDotL;
        // Flashlight specular contribution
        vec3 Rf = reflect(-Lf, N);
        float flashlightSpecular = pow(max(dot(E, Rf), 0.0), 10.0);
        totalSpecular += flashlightSpecular * intensity;
      }
    }
    
    gl_FragColor = vec4(totalDiffuse + totalSpecular + ambient, 1.0);
  }
`

// Global Variables
let canvas;
let crosshairCanvas;
let camera;
let world;
let gl;
let a_Position;
let a_UV;
let u_FragColor;
let u_Size;
let u_whichTexture;
let u_lightPos;
let u_cameraPos;
let u_ModelMatrix;
let u_NormalMatrix;
let u_ViewMatrix;
let u_ProjectionMatrix;
let u_GlobalRotateMatrix;
let u_GrassTexture, u_DirtTexture, u_FurTexture, u_LogTexture, u_LeavesTexture;
let u_dayFactor;

function setupWebGL() {
  // Retrieve <canvas> element
  canvas = document.getElementById('webgl');

  // Get the rendering context for WebGL
  //gl = getWebGLContext(canvas);
  gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });

  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return;
  }
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  camera = new Camera(canvas);
}

function connectVariablesToGLSL() {
  // Initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to intialize shaders.');
    return;
  }

  u_dayFactor = gl.getUniformLocation(gl.program, "u_dayFactor");
  u_flashlightOn = gl.getUniformLocation(gl.program, "u_flashlightOn");
  u_flashlightPos = gl.getUniformLocation(gl.program, "u_flashlightPos");
  u_flashlightDir = gl.getUniformLocation(gl.program, "u_flashlightDir");
  u_flashlightCutoff = gl.getUniformLocation(gl.program, "u_flashlightCutoff");
  u_GrassTexture = gl.getUniformLocation(gl.program, "u_GrassTexture");
  u_DirtTexture = gl.getUniformLocation(gl.program, "u_DirtTexture");
  u_FurTexture = gl.getUniformLocation(gl.program, "u_FurTexture");
  u_LogTexture = gl.getUniformLocation(gl.program, "u_LogTexture");
  u_LeavesTexture = gl.getUniformLocation(gl.program, "u_LeavesTexture");

  // // Get the storage location of a_Position
  a_Position = gl.getAttribLocation(gl.program, 'a_Position');
  if (a_Position < 0) {
    console.log('Failed to get the storage location of a_Position');
    return;
  }

  a_UV = gl.getAttribLocation(gl.program, 'a_UV');
  if (a_UV < 0) {
    console.log('Failed to get the storage location of a_UV');
    return;
  }

  a_Normal = gl.getAttribLocation(gl.program, 'a_Normal');
  if (a_Normal < 0) {
    console.log('Failed to get the storage location of a_Normal');
    return;
  }

  // Get the storage location of u_FragColor
  u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
  if (!u_FragColor) {
    console.log('Failed to get the storage location of u_FragColor');
    return;
  }

  u_whichTexture = gl.getUniformLocation(gl.program, "u_whichTexture");
  if (!u_whichTexture) {
    console.log("Failed to get the storage location of u_whichTexture");
    return;
  }

  u_lightPos = gl.getUniformLocation(gl.program, "u_lightPos");
  if (!u_lightPos) {
    console.log("Failed to get the storage location of u_lightPos");
    return;
  }

  u_lightOn = gl.getUniformLocation(gl.program, "u_lightOn");
  if (!u_lightOn) {
    console.log("Failed to get the storage location of u_lightOn");
    return;
  }

  u_cameraPos = gl.getUniformLocation(gl.program, "u_cameraPos");
  if (!u_cameraPos) {
    console.log("Failed to get the storage location of u_cameraPos");
    return;
  }

  u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  if (!u_ModelMatrix) {
    console.log('Failed to get the storage location of u_ModelMatrix');
    return;
  }

  u_NormalMatrix = gl.getUniformLocation(gl.program, 'u_NormalMatrix');
  if (!u_NormalMatrix) {
    console.log('Failed to get the storage location of u_NormalMatrix');
    return;
  }

  u_GlobalRotateMatrix = gl.getUniformLocation(gl.program, 'u_GlobalRotateMatrix');
  if (!u_GlobalRotateMatrix) {
    console.log('Failed to get the storage location of u_GlobalRotateMatrix');
    return;
  }

  u_ViewMatrix = gl.getUniformLocation(gl.program, 'u_ViewMatrix');
  if (!u_ViewMatrix) {
    console.log('Failed to get the storage location of u_ViewMatrix');
    return;
  }

  u_ProjectionMatrix = gl.getUniformLocation(gl.program, 'u_ProjectionMatrix');
  if (!u_ProjectionMatrix) {
    console.log('Failed to get the storage location of u_ProjectionMatrix');
    return;
  }

  var identifyM = new Matrix4();
  gl.uniformMatrix4fv(u_ModelMatrix, false, identifyM.elements);
}

const POINT = 0;
const TRIANGLE = 1;
const CIRCLE = 2;
const overlay = document.getElementById("overlay");

let g_selectedColor = [1.0, 1.0, 1.0, 1.0];
let g_selectedSize = 5;
let g_lightPos = [0, 7, 0];
let g_selectedType = POINT;
let g_globalAngleX = 0;
let g_globalAngleY = 0;
let g_limbAngle = 0;
let g_lowerArmAngle = 0;
let g_footAngle = 0;
let g_limbMaxAngle = 40;
let g_headMaxAngle = 5;
let g_limbAnimation = true;
let g_disassembleRP = false;
let g_Normal = false;
let g_lightOn = true;
let g_flashlightOn = false;
let g_fallHeight = 0;
let g_tailAngle = 0;
let g_headAngle = 0;
let grassTexture, dirtTexture, furTexture, logTexture, leavesTexture;
let moveSpeed = 0.1;
let animalSpeed = 0.4;
let panSpeed = 5;
let mouseControl = false;
let lastMouseX = null;
let lastMouseY = null;
var g_shapesList = [];
let g_animals = [];
let g_treePos = [];
var legWidth = 0.1;
var legHeight = 0.15;
var legDepth = 0.1;
var footWidth = legWidth;
var footHeight = 0.05;
var footDepth = -0.12;
let leavesImg;
let selectedWorldSize = null;

// World Construct
let worldX = 1000;
let worldY = 1;
let worldZ = 1000;


function addActionsfromHtmlUI() {
  canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock || canvas.webkitRequestPointerLock;
  document.exitPointerLock = document.exitPointerLock || document.mozExitPointerLock || document.webkitExitPointerLock;
  document.addEventListener("contextmenu", function (e) {
    e.preventDefault();
    // toggleMouseControl();
    document.getElementById("overlay").style.display = "none";
    document.getElementById("settings").style.display = "none";

    // Lock the mouse to the canvas
    canvas.requestPointerLock();
    return false;
  });

  document.getElementById('animationButton').onclick = function (e) {
    if (e.shiftKey) {
      /* g_disassembleRP = true;
      this.textContent = "Disassembled";
      disassembleRedPanda(); */
    } else {
      g_limbAnimation = !g_limbAnimation;
      this.textContent = g_limbAnimation ? "Enable" : "Disable";
    }
  };
  // document.getElementById('angleXSlide').addEventListener('mousemove', function () { g_globalAngleX = this.value; /* renderAllShapes(); */renderScene(); });
  // document.getElementById('angleYSlide').addEventListener('mousemove', function () { g_globalAngleY = this.value; /* renderAllShapes(); */renderScene(); });
  document.getElementById('limbSlide').addEventListener('mousemove', function () {
    g_limbAngle = this.value; /* renderAllShapes(); */
    document.getElementById("lowerArmSlider").value = Math.abs(g_limbAngle / 2);
    g_lowerArmAngle = Math.abs(g_limbAngle / 2);
    document.getElementById("footSlider").value = Math.abs(g_limbAngle / 2);
    g_footAngle = Math.abs(g_limbAngle / 2);
    renderScene();
  });
  document.getElementById("lowerArmSlider").addEventListener("mousemove", function () { g_lowerArmAngle = this.value; renderScene(); });
  document.getElementById("footSlider").addEventListener("mousemove", function () { g_footAngle = this.value; renderScene(); });
  document.getElementById('tailSlide').addEventListener('mousemove', function () { g_tailAngle = this.value; /* renderAllShapes(); */renderScene(); });
  document.getElementById('headSlide').addEventListener('mousemove', function () { g_headAngle = this.value; /* renderAllShapes(); */renderScene(); });
  document.getElementById('lightX').addEventListener('mousemove', function () { g_lightPos[0] = this.value / 100; renderScene(); });
  document.getElementById('lightY').addEventListener('mousemove', function () { g_lightPos[1] = this.value / 100; renderScene(); });
  document.getElementById('lightZ').addEventListener('mousemove', function () { g_lightPos[2] = this.value / 100; renderScene(); });
  document.addEventListener("keydown", (event) => {
    if (event.shiftKey) moveSpeed = 0.2;
    if (event.key === "w" || event.key === "W") camera.moveForward(moveSpeed);
    if (event.key === "s" || event.key === "S") camera.moveBackward(moveSpeed);
    if (event.key === "a" || event.key === "A") camera.moveLeft(moveSpeed);
    if (event.key === "d" || event.key === "D") camera.moveRight(moveSpeed);
    if (event.key === "q" || event.key === "Q") camera.panLeft(panSpeed);
    if (event.key === "e" || event.key === "E ") camera.panRight(panSpeed);
    if (event.key === " ") { camera.moveUp(moveSpeed); event.preventDefault(); }
    if (event.key === "Control") { camera.moveDown(moveSpeed); event.preventDefault(); }
    if (event.key === "f" || event.key === "F") { toggleFlashlight(); renderScene(); }
    renderScene();
  });
  document.addEventListener("mousemove", function (e) {
    if (mouseControl) {
      onMove(e);
    }
  });
  document.addEventListener("mousedown", (event) => {
    let selectedBlock = world.getBlockAtCursor(camera); // Find the targeted block

    if (!selectedBlock) return;

    if (event.button === 0) { // Left click (Remove Block)
      world.removeBlock(selectedBlock.position);
    }
    else if (event.button === 2) { // Right click (Place Block)
      world.addBlock("GRASS", world.getPlacementPosition(selectedBlock.position, camera));
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      mouseControl = false;
      overlay.style.display = "flex";
    } else if (e.key === "Tab") {
      e.preventDefault();
      toggleRenderSettings();
    }
  });
  document.getElementById("toggle-transparency").addEventListener("click", () => {
    let gl = world.gl;
    if (!gl) return;

    world.transparencyEnabled = !world.transparencyEnabled;

    if (world.transparencyEnabled) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    } else {
      gl.disable(gl.BLEND);
    }
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, leavesTexture);
    var format = world.transparencyEnabled ? gl.RGBA : gl.RGB;
    gl.texImage2D(gl.TEXTURE_2D, 0, format, format, gl.UNSIGNED_BYTE, leavesImg);

  });
  document.getElementById("normalToggleButton").onclick = function () {
    g_Normal = !g_Normal;
    // this.textContent = g_Normal ? "ON" : "OFF";
    renderScene();
  };
  document.getElementById("lightToggleButton").onclick = function () {
    g_lightOn = !g_lightOn;
    // this.textContent = g_lightOn ? "ON" : "OFF";
    renderScene();
  };
  document.getElementById("timeSlider").addEventListener("input", function () {
    document.getElementById("timeDisplay").textContent = this.value;
    updateGameTime(this.value);
  });

  document.getElementById("dayButton").addEventListener("click", function () {
    document.getElementById("timeSlider").value = 720;
    document.getElementById("timeDisplay").textContent = 720;
    updateGameTime(1200);
  });

  document.getElementById("nightButton").addEventListener("click", function () {
    document.getElementById("timeSlider").value = 0;
    document.getElementById("timeDisplay").textContent = 0;
    updateGameTime(0);
  });

  document.getElementById("pauseTimeButton").addEventListener("click", function () {
    isTimePaused = !isTimePaused;
    this.textContent = isTimePaused ? "RESUME" : "PAUSE";
  });
  document.addEventListener('pointerlockchange', lockChangeAlert, false);
  document.addEventListener('mozpointerlockchange', lockChangeAlert, false);
  document.addEventListener('webkitpointerlockchange', lockChangeAlert, false);
}

function toggleMouseControl() {
  mouseControl = !mouseControl;
  if (mouseControl) {
    overlay.style.display = "none";
  } else {
    overlay.style.display = "flex";
  }
}

function toggleRenderSettings() {
  let menu = document.getElementById("settings");
  if (menu.style.display === "none" || menu.style.display === "") {
    menu.style.display = "flex";
    document.exitPointerLock();
  } else {
    menu.style.display = "none";
    canvas.requestPointerLock();
  }
}

function toggleFlashlight() {
  g_flashlightOn = !g_flashlightOn;
  console.log("Flashlight " + (g_flashlightOn ? "ON" : "OFF"));
}

function lockChangeAlert() {
  if (document.pointerLockElement === canvas ||
    document.mozPointerLockElement === canvas ||
    document.webkitPointerLockElement === canvas) {
    // Pointer lock enabled, hide overlay
    mouseControl = true;
    overlay.style.display = "none";
  } else {
    // Pointer lock disabled, show overlay
    mouseControl = false;
    overlay.style.display = "flex";
  }
}

function onMove(e) {
  if (!mouseControl) return;

  // Raw mouse movement values
  let dx = e.movementX;
  let dy = e.movementY;

  // Adjust sensitivity
  let mouseSensitivity = 0.1;
  let horizontalAngle = dx * mouseSensitivity;
  let verticalAngle = dy * mouseSensitivity;

  camera.panLeft(-horizontalAngle);  // Moving mouse right pan right

  camera.tilt(-verticalAngle);

  renderScene();
}

function initTextures() {
  // Grass texture
  grassTexture = gl.createTexture();
  let grassImg = new Image();
  grassImg.onload = function () {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, grassTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, grassImg);
    gl.uniform1i(u_GrassTexture, 1);
  };
  grassImg.src = 'grass.png';

  // Dirt texture
  dirtTexture = gl.createTexture();
  let dirtImg = new Image();
  dirtImg.onload = function () {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, dirtTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, dirtImg);
    gl.uniform1i(u_DirtTexture, 2);
  };
  dirtImg.src = 'dirt.png';

  // Fur texture for red panda
  furTexture = gl.createTexture();
  let furImg = new Image();
  furImg.onload = function () {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, furTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, furImg);
    gl.uniform1i(u_FurTexture, 0);
  };
  furImg.src = 'fur.png';

  logTexture = gl.createTexture();
  let logImg = new Image();
  logImg.onload = function () {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, logTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, logImg);
    gl.uniform1i(u_LogTexture, 3);
  };
  logImg.src = 'log.jpg';

  leavesTexture = gl.createTexture();
  leavesImg = new Image();
  leavesImg.onload = function () {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, leavesTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, leavesImg);
    gl.uniform1i(u_LeavesTexture, 4);
  };
  leavesImg.src = 'leaves.png';
}

function setWorldSize(x, y, z) {
  document.getElementById("worldX").value = x;
  document.getElementById("worldY").value = y;
  document.getElementById("worldZ").value = z;
  startGame();
}

function startGame() {
  worldX = parseInt(document.getElementById("worldX").value);
  worldY = parseInt(document.getElementById("worldY").value);
  worldZ = parseInt(document.getElementById("worldZ").value);

  if (worldX <= 0 || worldY <= 0 || worldZ <= 0) {
    alert("World size must be greater than zero!");
    return;
  }

  selectedWorldSize = [worldX, worldY, worldZ];

  // Hide the selection menu
  document.getElementById("world-selection").style.display = "none";

  // Start the game
  main();
}

function main() {
  if (!selectedWorldSize) return; // Prevents rendering before selection

  worldX = selectedWorldSize[0];
  worldY = selectedWorldSize[1];
  worldZ = selectedWorldSize[2];
  setupWebGL();

  connectVariablesToGLSL();

  addActionsfromHtmlUI();

  // Register function (event handler) to be called on a mouse press
  canvas.onmousedown = click;
  canvas.onmousemove = function (ev) { if (ev.buttons == 1) { click(ev) } };

  initTextures(gl, 0);

  world = new World(worldX, worldY, worldZ, 4, gl);
  world.generateTerrain();

  let distance, angle, posX, posZ, distanceFromCamera;
  for (let i = 0; i < 4; i++) {
    do {
      distance = 5 + Math.random() * 15; // Ensure distance is between 5 and 20
      angle = Math.random() * Math.PI * 2;
      posX = 1 + Math.cos(angle) * distance;
      posZ = 1 + Math.sin(angle) * distance;
      distanceFromCamera = Math.sqrt(
        Math.pow(posX, 2) + Math.pow(posZ, 2)
      );
    } while (distanceFromCamera < 5 || distanceFromCamera > 10);
    let animal = new Animal([posX, 0.15, posZ], [0, 0, 0]/* [Math.random() - 0.5, 0, Math.random() - 0.5] */, "default");
    g_animals.push(animal);

  }
  let animal = new Animal([0, 0.15, 0], [0, 0, 0]/* [Math.random() - 0.5, 0, Math.random() - 0.5] */, "default");
  g_animals.push(animal);

  // Specify the color for clearing <canvas>
  gl.clearColor(0.2, 0.2, 0.2, 1.0);
  setupCrosshair();

  requestAnimationFrame(tick);
}

var g_startTime = performance.now() / 1000.0;
var g_seconds = performance.now() / 1000.0 - g_startTime;
var g_prevSeconds = g_seconds;
var fpsCounter = document.getElementById("fps");
let dayInSeconds = 300000;
let gameTime = 720;
let isTimePaused = false;

function tick() {
  g_seconds = performance.now() / 1000.0 - g_startTime;
  // console.log(g_seconds);
  var dT = g_seconds - g_prevSeconds;
  g_prevSeconds = g_seconds;

  var fps = dT > 0 ? (1.0 / dT) : 0;

  // Update the FPS display:
  if (fpsCounter) {
    fpsCounter.textContent = "FPS: " + fps.toFixed(2);
  }

  if (!isTimePaused) {
    gameTime = (gameTime + 10) % 1440;
    document.getElementById("timeSlider").value = gameTime;
    document.getElementById("timeDisplay").textContent = gameTime;
    updateGameTime(gameTime);
  }

  updateAnimationAngle();
  updateFlashlight();

  renderAllShapes();
  renderScene();

  world.render();
  world.renderSkybox(camera);

  for (let animal of g_animals) {
    animal.update(dT, world);
    animal.drawAnimal();
  }

  var body = new Cube();
  gl.uniformMatrix4fv(u_NormalMatrix, false, body.normalMatrix.elements);

  if (g_Normal) {
    body.textureNum = -3;
  } else {
    body.textureNum = -2;
  }
  body.color = [1.0, 0.0, 0.0, 1.0];
  body.matrix.setTranslate(-.25, 0, 0.0);
  body.matrix.scale(1, 1, 1);
  body.normalMatrix.setInverseOf(body.matrix).transpose();
  body.render();

  var blackHole = new Sphere();
  if (g_Normal) {
    blackHole.textureNum = -3;
  } else {
    blackHole.textureNum = -2;
  }
  blackHole.color = [1.0, 0.0, 0.0, 1.0];
  blackHole.matrix.setTranslate(-.25, 3, 0.0);
  blackHole.matrix.scale(0.7, 0.7, 0.7);
  blackHole.render();

  var lightLamp = new Cube();
  lightLamp.color = [1.0, 1.0, 0.0, 1.0];
  lightLamp.matrix.setTranslate(g_lightPos[0], g_lightPos[1], g_lightPos[2]);
  lightLamp.matrix.scale(-0.1, -0.1, -0.1);
  lightLamp.render();

  requestAnimationFrame(tick);
}

function updateGameTime(newTime) {
  gameTime = newTime % 1440;
  let timeOfDay = gameTime / 1440;
  let dayFactor = Math.sin(2.0 * Math.PI * (timeOfDay - 0.25)) * 0.5 + 0.5;
  gl.uniform1f(u_dayFactor, dayFactor);

  let hours = Math.floor(gameTime / 60);
  let minutes = gameTime % 60;
  let hoursStr = hours < 10 ? "0" + hours : "" + hours;
  let minutesStr = minutes < 10 ? "0" + minutes : "" + minutes;
  document.getElementById("timeDisplay").textContent = hoursStr + ":" + minutesStr;
}

function updateFlashlight() {
  if (g_flashlightOn) {
    // Use the camera's position as the flashlight's position.
    let camPos = camera.getPosition();
    // Use the camera's look direction as the flashlight direction.
    let forward = camera.getLookDirection();

    // Set the flashlight uniforms:
    gl.uniform3f(u_flashlightPos, camPos[0], camPos[1], camPos[2]);
    gl.uniform3f(u_flashlightDir, forward[0], forward[1], forward[2]);
    // For a 15° cutoff cone, we set cutoff = cos(15°)
    gl.uniform1f(u_flashlightCutoff, Math.cos(15 * Math.PI / 180));
    gl.uniform1i(u_flashlightOn, 1);
  } else {
    gl.uniform1i(u_flashlightOn, 0);
  }
}

function updateAnimationAngle() {
  if (g_limbAnimation) {
    g_limbAngle = (g_limbMaxAngle * Math.sin(g_seconds * 3.6));
  }
}

function click(ev) {
  let [x, y] = convertCoordinatesEventToGL(ev);

  // Store the coordinates to g_points array
  let point;
  if (g_selectedType == POINT) {
    point = new Point();
  } else if (g_selectedType == TRIANGLE) {
    point = new Triangle();
  } else {
    point = new Circle();
  }
  point.position = [x, y];
  point.color = g_selectedColor.slice();
  point.size = g_selectedSize;
  g_shapesList.push(point);

  renderScene();
}

function convertCoordinatesEventToGL(ev) {
  var x = ev.clientX; // x coordinate of a mouse pointer
  var y = ev.clientY; // y coordinate of a mouse pointer
  var rect = ev.target.getBoundingClientRect();

  x = ((x - rect.left) - canvas.width / 2) / (canvas.width / 2);
  y = (canvas.height / 2 - (y - rect.top)) / (canvas.height / 2);

  return ([x, y]);
}

function renderAllShapes() {
  // Clear <canvas>
  gl.uniformMatrix4fv(u_ProjectionMatrix, false, camera.projectionMatrix.elements);
  gl.uniformMatrix4fv(u_ViewMatrix, false, camera.viewMatrix.elements);

  var globalRotMat = new Matrix4().rotate(g_globalAngleX, 0, 1, 0);
  gl.uniformMatrix4fv(u_GlobalRotateMatrix, false, globalRotMat.elements);

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.clear(gl.COLOR_BUFFER_BIT);

  if (world) {
    world.render();
  }
}

function renderScene() {
  var globalRotMat = new Matrix4().rotate(g_globalAngleX, 0, 1, 0);
  globalRotMat.rotate(g_globalAngleY, 1, 0, 0);
  gl.uniformMatrix4fv(u_GlobalRotateMatrix, false, globalRotMat.elements);

  /* gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.clear(gl.COLOR_BUFFER_BIT); */

  //drawAnimal();
  gl.uniform3f(u_lightPos, g_lightPos[0], g_lightPos[1], g_lightPos[2]);

  gl.uniform3f(u_cameraPos, camera.cam.elements[0], camera.cam.elements[1], camera.cam.elements[2]);

  gl.uniform1i(u_lightOn, g_lightOn ? 1 : 0);
}

function disassembleRedPanda() {
  g_fallHeight = g_fallHeight + 0.1;
}

function setupCrosshair() {
  crosshairCanvas = document.getElementById("crosshairCanvas");
  crosshairCanvas.width = canvas.width;
  crosshairCanvas.height = canvas.height;
  crosshairCanvas.style.position = "absolute";
  crosshairCanvas.style.left = canvas.offsetLeft + "px";
  crosshairCanvas.style.top = canvas.offsetTop + "px";
  crosshairCanvas.style.pointerEvents = "none"; // Allows clicks to pass through

  let ctx = crosshairCanvas.getContext("2d");
  ctx.clearRect(0, 0, crosshairCanvas.width, crosshairCanvas.height);

  let centerX = crosshairCanvas.width / 2;
  let centerY = crosshairCanvas.height / 2;

  // Draw a small dot at the center
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(centerX, centerY, 2, 0, Math.PI * 2);
  ctx.fill();
}






function drawSun() {
  // Center coordinates
  const sunShapes = [];
  const centerX = 0.0;
  const centerY = 0.0;

  const innerRadius = 0.2; // Radius of the polygon
  const rayRadius = 0.25; // Start of the rays
  const rayLength = 0.2; // Length of the rays
  const innerRayLength = 0.14;
  const baseMult = 0.7; // Factor to reduce the base width of the rays

  // Number of sides for the polygon
  const sides = 20;

  gl.uniform4f(u_FragColor, 1.0, 0.45, 0.0, 1.0);
  // Draw the center polygon
  const polyVertices = [];
  for (let i = 0; i < sides; i++) {
    const angle1 = (i * 2 * Math.PI) / sides;
    const angle2 = ((i + 1) * 2 * Math.PI) / sides;
    polyVertices.push(centerX, centerY);
    polyVertices.push(centerX + innerRadius * Math.cos(angle1), centerY + innerRadius * Math.sin(angle1));
    polyVertices.push(centerX + innerRadius * Math.cos(angle2), centerY + innerRadius * Math.sin(angle2));
  }
  drawTriangles(polyVertices);

  // Draw the rays
  gl.uniform4f(u_FragColor, 1.0, 1.0, 0.0, 1.0);
  const rayVertices = [];
  const innerRayVertices = [];
  for (let i = 0; i < sides; i += 2) { // Skip every other side
    const angle1 = (i * 2 * Math.PI) / sides;
    const angle2 = ((i + 1) * 2 * Math.PI) / sides;
    const baseAngle1 = angle1 + (1 - baseMult) * (angle2 - angle1) / 2;
    const baseAngle2 = angle2 - (1 - baseMult) * (angle2 - angle1) / 2;

    const base1X = centerX + rayRadius * Math.cos(baseAngle1);
    const base1Y = centerY + rayRadius * Math.sin(baseAngle1);

    const base2X = centerX + rayRadius * Math.cos(baseAngle2);
    const base2Y = centerY + rayRadius * Math.sin(baseAngle2);

    const tipX = centerX + (rayRadius + rayLength) * Math.cos((angle1 + angle2) / 2);
    const tipY = centerY + (rayRadius + rayLength) * Math.sin((angle1 + angle2) / 2);

    const innerBase1X = centerX + (rayRadius * 1) * Math.cos(baseAngle1); // Adjusted inner base
    const innerBase1Y = centerY + (rayRadius * 1) * Math.sin(baseAngle1);

    const innerBase2X = centerX + (rayRadius * 1) * Math.cos(baseAngle2); // Adjusted inner base
    const innerBase2Y = centerY + (rayRadius * 1) * Math.sin(baseAngle2);

    const innerTipX = centerX + (rayRadius + innerRayLength) * Math.cos((angle1 + angle2) / 2); // Adjusted inner tip
    const innerTipY = centerY + (rayRadius + innerRayLength) * Math.sin((angle1 + angle2) / 2);


    rayVertices.push(base1X, base1Y, base2X, base2Y, tipX, tipY);
    innerRayVertices.push(innerBase1X, innerBase1Y, innerBase2X,
      innerBase2Y, innerTipX, innerTipY);
  }
  drawTriangles(rayVertices);
  gl.uniform4f(u_FragColor, 1.0, 0.4, 0.0, 1.0);
  drawTriangles(innerRayVertices);
}

function drawTriangles(vertices) {
  const n = vertices.length / 2;

  const vertexBuffer = gl.createBuffer();
  if (!vertexBuffer) {
    console.log('Failed to create the buffer object');
    return;
  }

  // Bind the buffer object to target
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);

  // Write data into the buffer object
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);

  // Assign the buffer object to a_Position variable
  gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0);

  // Enable the assignment to a_Position variable
  gl.enableVertexAttribArray(a_Position);

  // Draw the triangles
  gl.drawArrays(gl.TRIANGLES, 0, n);
}
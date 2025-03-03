// ColoredPoint.js (c) 2012 matsuda
// Vertex shader program
var VSHADER_SOURCE = `
  precision mediump float;
  attribute vec4 a_Position;
  attribute vec2 a_UV;
  varying vec2 v_UV;
  uniform mat4 u_ModelMatrix;
  uniform mat4 u_GlobalRotateMatrix;
  uniform mat4 u_ViewMatrix;
  uniform mat4 u_ProjectionMatrix;
  void main() {
    gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_GlobalRotateMatrix * u_ModelMatrix * a_Position;
    v_UV = a_UV;
  }`

// Fragment shader program
var FSHADER_SOURCE = `
  precision mediump float;
  varying vec2 v_UV;
  uniform vec4 u_FragColor;
  uniform sampler2D u_GrassTexture;
  uniform sampler2D u_DirtTexture;
  uniform sampler2D u_FurTexture;
  uniform int u_whichTexture;
  void main() {
    if (u_whichTexture == -2) {
      gl_FragColor = u_FragColor;
    } else if (u_whichTexture == -1) {
      gl_FragColor = vec4(v_UV, 1.0, 1.0);
    } else if (u_whichTexture == 0) {
      gl_FragColor = texture2D(u_FurTexture, v_UV);
    } else if (u_whichTexture == 1) {
      gl_FragColor = texture2D(u_GrassTexture, v_UV);
    } else if (u_whichTexture == 2) {
      gl_FragColor = texture2D(u_DirtTexture, v_UV);
    } else {
      gl_FragColor = vec4(1, .2, .2, 1);
    }
  }`

// Global Variables
let canvas;
let camera;
let world;
let gl;
let a_Position;
let a_UV;
let u_FragColor;
let u_Size;
let u_whichTexture;
let u_ModelMatrix;
let u_ViewMatrix;
let u_ProjectionMatrix;
let u_GlobalRotateMatrix;
let u_GrassTexture, u_DirtTexture, u_FurTexture;

function setupWebGL() {
  // Retrieve <canvas> element
  canvas = document.getElementById('webgl');
  
  // Get the rendering context for WebGL
  //gl = getWebGLContext(canvas);
  gl = canvas.getContext('webgl', {preserveDrawingBuffer: true});

  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return;
  }
  gl.enable(gl.DEPTH_TEST);

  camera = new Camera(canvas);
}

function connectVariablesToGLSL() {
  // Initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to intialize shaders.');
    return;
  }

  u_GrassTexture = gl.getUniformLocation(gl.program, "u_GrassTexture");
  u_DirtTexture  = gl.getUniformLocation(gl.program, "u_DirtTexture");
  u_FurTexture   = gl.getUniformLocation(gl.program, "u_FurTexture");

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
  
  // Get the storage location of u_FragColor
  u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
  if (!u_FragColor) {
    console.log('Failed to get the storage location of u_FragColor');
    return;
  }

  u_whichTexture = gl.getUniformLocation(gl.program, "u_whichTexture");
  if (!u_whichTexture) {
      console.log("Failed to get the storage location of u_whichTexture");
  }
  
  u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  if (!u_ModelMatrix) {
    console.log('Failed to get the storage location of u_ModelMatrix');
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

let g_selectedColor=[1.0,1.0,1.0,1.0];
let g_selectedSize=5;
let g_selectedType=POINT;
let g_globalAngleX = 0;
let g_globalAngleY = 0;
let g_limbAngle = 0;
let g_lowerArmAngle = 0;
let g_footAngle = 0;
let g_limbMaxAngle = 40;
let g_headMaxAngle = 5;
let g_limbAnimation = false;
let g_disassembleRP = false;
let g_fallHeight = 0;
let g_tailAngle = 0;
let g_headAngle = 0;
let grassTexture, dirtTexture, furTexture;
let moveSpeed = 0.1;
let panSpeed = 5;
let mouseControl = false;
let lastMouseX = null;
let lastMouseY = null;
var g_shapesList = [];
var legWidth = 0.1;
var legHeight = 0.15;
var legDepth = 0.1;
var footWidth = legWidth;
var footHeight = 0.05;
var footDepth = -0.12;

// World Construct
let worldX = 1;
let worldY = 1;
let worldZ = 1;



function addActionsfromHtmlUI() {
  document.addEventListener("contextmenu", function(e) {
    e.preventDefault();
    toggleMouseControl();
    return false;
  });
  /* document.getElementById('green').onclick = function() { g_selectedColor = [0.0,1.0,0.0,1.0]; };
  document.getElementById('red').onclick = function() { g_selectedColor = [1.0,0.0,0.0,1.0]; };
  document.getElementById('clearButton').onclick = function() { gl.clear(gl.COLOR_BUFFER_BIT); g_shapesList = []; renderAllShapes();};
  
  document.getElementById('pointButton').onclick = function() { g_selectedType=POINT};
  document.getElementById('triButton').onclick = function() { g_selectedType=TRIANGLE};
  document.getElementById('cirButton').onclick = function() { g_selectedType=CIRCLE};

  document.getElementById('sunButton').onclick = function() { drawSun(); }; */
  document.getElementById('animationButton').onclick = function(e) { 
    if (e.shiftKey) {
      /* g_disassembleRP = true;
      this.textContent = "Disassembled";
      disassembleRedPanda(); */
    } else {
      g_limbAnimation = !g_limbAnimation;
      this.textContent = g_limbAnimation ? "Disable" : "Enable";
    }
   };
  
  /* document.getElementById('redSlide').addEventListener('mouseup', function() { g_selectedColor[0] = this.value/100;});
  document.getElementById('greenSlide').addEventListener('mouseup', function() { g_selectedColor[1] = this.value/100;});
  document.getElementById('blueSlide').addEventListener('mouseup', function() { g_selectedColor[2] = this.value/100;});
 */
  // document.getElementById('sizeSlide').addEventListener('mouseup', function() { g_selectedSize = this.value;});

  document.getElementById('angleXSlide').addEventListener('mousemove', function() { g_globalAngleX = this.value; /* renderAllShapes(); */renderScene(); });
  document.getElementById('angleYSlide').addEventListener('mousemove', function() { g_globalAngleY = this.value; /* renderAllShapes(); */renderScene(); });
  document.getElementById('limbSlide').addEventListener('mousemove', function() { 
    g_limbAngle = this.value; /* renderAllShapes(); */
    document.getElementById("lowerArmSlider").value = Math.abs(g_limbAngle/2);
    g_lowerArmAngle = Math.abs(g_limbAngle/2);
    document.getElementById("footSlider").value = Math.abs(g_limbAngle/2);
    g_footAngle = Math.abs(g_limbAngle/2);
    renderScene(); 
  });
  document.getElementById("lowerArmSlider").addEventListener("mousemove", function() { g_lowerArmAngle = this.value; renderScene(); });
  document.getElementById("footSlider").addEventListener("mousemove", function() { g_footAngle = this.value; renderScene(); });
  document.getElementById('tailSlide').addEventListener('mousemove', function() { g_tailAngle = this.value; /* renderAllShapes(); */renderScene(); });
  document.getElementById('headSlide').addEventListener('mousemove', function() { g_headAngle = this.value; /* renderAllShapes(); */renderScene(); });
  document.addEventListener("keydown", (event) => {
    if (event.shiftKey) moveSpeed = 0.2;
    if (event.key === "w") camera.moveForward(moveSpeed);
    if (event.key === "s") camera.moveBackward(moveSpeed);
    if (event.key === "a") camera.moveLeft(moveSpeed);
    if (event.key === "d") camera.moveRight(moveSpeed);
    if (event.key === "q") camera.panLeft(panSpeed);
    if (event.key === "e") camera.panRight(panSpeed);
    renderScene();
  });
  document.addEventListener("mousemove", function(e) {
    if (mouseControl) {
      onMove(e);
    }
  });
  
  // Listen for ESC key to disable mouse control.
  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") {
      mouseControl = false;
      overlay.style.display = "flex";
    }
  });
  
  // Reset mouse coordinates when the user clicks outside (or disables control)
  document.addEventListener("mousedown", function(e) {
    if (mouseControl) {
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    }
  });
}

function toggleMouseControl() {
  mouseControl = !mouseControl;
  if (mouseControl) {
    overlay.style.display = "none";
  } else {
    overlay.style.display = "flex";
  }
}

function onMove(e) {
  if (!mouseControl) return;

  if (lastMouseX === null || lastMouseY === null) {
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    return;
  }

  // Calculate delta movement.
  let dx = e.clientX - lastMouseX;
  let dy = e.clientY - lastMouseY;
  
  // Update last positions
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;

  // Adjust sensitivity
  let sensitivity = 0.1;
  let horizontalAngle = dx * sensitivity;
  let verticalAngle = dy * sensitivity;
  
  // For horizontal panning: a rightward movement should rotate view right.
  // Our camera.panLeft rotates to the left with a positive angle, so use negative.
  if (horizontalAngle !== 0) {
    camera.panLeft(-horizontalAngle);
  }
  
  // For vertical tilting: downward mouse movement should tilt view downward.
  if (verticalAngle !== 0) {
    camera.tilt(verticalAngle);
  }
  
  renderScene();
}



function initTextures() {
  // Grass texture
  grassTexture = gl.createTexture();
  let grassImg = new Image();
  grassImg.onload = function() {
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
  dirtImg.onload = function() {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, dirtTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, dirtImg);
    gl.uniform1i(u_DirtTexture, 2);
  };
  dirtImg.src = 'dirt.png';

  // Fur texture for animal (if not already loaded)
  furTexture = gl.createTexture();
  let furImg = new Image();
  furImg.onload = function() {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, furTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, furImg);
      gl.uniform1i(u_FurTexture, 0);
  };
  furImg.src = 'fur.png';
}

function sendTexture0(image) {
  var texture = gl.createTexture();  // Create a texture object
  if (!texture) {
      console.log('Failed to create the texture object');
      return false;
  }

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1); // Flip the image's y axis

  // Enable texture unit0
  gl.activeTexture(gl.TEXTURE0);

  // Bind the texture object to the target
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Set the texture parameters
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

  // Set the texture image
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);

  // Set the texture unit 0 to the sampler
  gl.uniform1i(u_Sampler0, 0);

  // gl.clear(gl.COLOR_BUFFER_BIT); // Clear <canvas>

  // gl.drawArrays(gl.TRIANGLE_STRIP, 0, n); // Draw the rectangle

  console.log('finished loadTexture');
}

function main() {
  setupWebGL();

  connectVariablesToGLSL();

  addActionsfromHtmlUI();

  // Register function (event handler) to be called on a mouse press
  canvas.onmousedown = click;
  canvas.onmousemove = function(ev) { if(ev.buttons == 1) { click(ev) } };

  document,onkeydown = keydown;
  
  initTextures(gl, 0);

  world = new World(worldX, worldY, worldZ);
  world.generateTerrain();

  // Specify the color for clearing <canvas>
  gl.clearColor(0.2, 0.2, 0.2, 1.0);

  // Clear <canvas>
  // gl.clear(gl.COLOR_BUFFER_BIT);
  // renderScene();
  // renderAllShapes();
  requestAnimationFrame(tick);
}

var g_startTime = performance.now()/1000.0;
var g_seconds = performance.now()/1000.0-g_startTime;
var g_prevSeconds = g_seconds;
var fpsCounter = document.getElementById("fps");

function tick() {
  g_seconds = performance.now()/1000.0-g_startTime;
  // console.log(g_seconds);
  var dT = g_seconds - g_prevSeconds;
  g_prevSeconds = g_seconds;

  var fps = dT > 0 ? (1.0 / dT) : 0;
  
  // Update the FPS display:
  if (fpsCounter) {
    fpsCounter.textContent = "FPS: " + fps.toFixed(2);
  }

  updateAnimationAngle();

  if (g_disassembleRP) {
    disassembleRedPanda();
  }

  renderAllShapes();
  renderScene();

  requestAnimationFrame(tick);
}

function updateAnimationAngle() {
  if (g_limbAnimation) {
    g_limbAngle = (g_limbMaxAngle * Math.sin(g_seconds*3.6));
  }
}

function keydown(ev) {
  if (ev.keyCode == 39) {  // Right arrow
    camera.moveForward();
  } else if (ev.keyCode == 37) {  //Left arrow
    camera.moveBackward();
  }
}
//var // g_redPandaParts = [];
/*
var g_points = [];  // The array for the position of a mouse press
var g_colors = [];  // The array to store the color of a point
var g_sizes = [];
*/

function click(ev) {
  let [x,y] = convertCoordinatesEventToGL(ev);

  // Store the coordinates to g_points array
  let point;
  if (g_selectedType==POINT) {
    point = new Point();
  } else if (g_selectedType==TRIANGLE){
    point = new Triangle();
  } else {
    point = new Circle();
  }
  point.position = [x, y];
  point.color = g_selectedColor.slice();
  point.size = g_selectedSize;
  g_shapesList.push(point);
  // Store the coordinates to g_colors array
  /*
  g_colors.push(g_selectedColor.slice());
  g_sizes.push(g_selectedSize);

  
  if (x >= 0.0 && y >= 0.0) {      // First quadrant
    g_colors.push([1.0, 0.0, 0.0, 1.0]);  // Red
  } else if (x < 0.0 && y < 0.0) { // Third quadrant
    g_colors.push([0.0, 1.0, 0.0, 1.0]);  // Green
  } else {                         // Others
    g_colors.push([1.0, 1.0, 1.0, 1.0]);  // White
  }
  */

  renderScene();
}

function convertCoordinatesEventToGL(ev) {
    var x = ev.clientX; // x coordinate of a mouse pointer
    var y = ev.clientY; // y coordinate of a mouse pointer
    var rect = ev.target.getBoundingClientRect();
  
    x = ((x - rect.left) - canvas.width/2)/(canvas.width/2);
    y = (canvas.height/2 - (y - rect.top))/(canvas.height/2);

    return([x,y]);
}

function renderAllShapes() {
  // Clear <canvas>
  gl.uniformMatrix4fv(u_ProjectionMatrix, false, camera.projectionMatrix.elements);
  gl.uniformMatrix4fv(u_ViewMatrix, false, camera.viewMatrix.elements);

  var globalRotMat = new Matrix4().rotate(g_globalAngleX,0,1,0);
  gl.uniformMatrix4fv(u_GlobalRotateMatrix, false, globalRotMat.elements);

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.clear(gl.COLOR_BUFFER_BIT);

  if (world) {
    world.render(); 
  }
}

function renderScene() {
  var globalRotMat = new Matrix4().rotate(g_globalAngleX,0,1,0);
  globalRotMat.rotate(g_globalAngleY,1,0,0);
  gl.uniformMatrix4fv(u_GlobalRotateMatrix, false, globalRotMat.elements);

  /* gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.clear(gl.COLOR_BUFFER_BIT); */

  drawAnimal();
}

function disassembleRedPanda() {
  g_fallHeight = g_fallHeight + 0.1;
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
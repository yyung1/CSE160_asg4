class Cylinder {
  constructor() {
    this.type = 'Cylinder';
    this.color = [1.0, 1.0, 1.0, 1.0];
    this.matrix = new Matrix4();
    this.segments = 24;
    this.textureNum = -2;

    // Buffers
    this.vertexBuffer = null;
    this.uvBuffer = null;
    this.normalBuffer = null;

    // This tracks how many total vertices we have (for drawArrays)
    this.indexCount = 0;

    this.initVertices();
  }

  initVertices() {
    const posArray = []; // x,y,z
    const uvArray = [];  // u,v
    const normArray = []; // nx,ny,nz (new!)

    const seg = this.segments;

    // ------------- Top Circle (fan) -------------
    // Each segment i forms a triangle: center->edge(i)->edge(i+1).
    for (let i = 0; i < seg; i++) {
      let theta = (2 * Math.PI * i) / seg;
      let nextTheta = (2 * Math.PI * (i + 1)) / seg;

      // Positions
      // center => (0,1,0)
      // edge1 => (cosθ,1,sinθ)
      // edge2 => (cos(nextθ),1,sin(nextθ))
      let cx = 0.0, cy = 1.0, cz = 0.0;
      let x1 = Math.cos(theta), y1 = 1.0, z1 = Math.sin(theta);
      let x2 = Math.cos(nextTheta), y2 = 1.0, z2 = Math.sin(nextTheta);

      posArray.push(
        cx, cy, cz,
        x1, y1, z1,
        x2, y2, z2
      );

      // Normals (top circle => +Y)
      for (let v = 0; v < 3; v++) {
        normArray.push(0.0, 1.0, 0.0);
      }

      // Simple UV mapping for top
      uvArray.push(
        // center => (0.5, 0.5)
        0.5, 0.5,
        // edge1 => (0.5 + 0.5*cosθ, 0.5 + 0.5*sinθ)
        0.5 + 0.5 * Math.cos(theta), 0.5 + 0.5 * Math.sin(theta),
        // edge2
        0.5 + 0.5 * Math.cos(nextTheta), 0.5 + 0.5 * Math.sin(nextTheta)
      );
    }

    // ------------- Bottom Circle (fan) -------------
    // Each segment i forms a triangle: center->edge(i+1)->edge(i).
    for (let i = 0; i < seg; i++) {
      let theta = (2 * Math.PI * i) / seg;
      let nextTheta = (2 * Math.PI * (i + 1)) / seg;

      // Positions
      // center => (0,0,0)
      // edge1 => (cosθ,0,sinθ)
      // edge2 => (cos(nextθ),0,sin(nextθ))
      // but reversed so outward face is consistent
      let bx = 0.0, by = 0.0, bz = 0.0;
      let x1 = Math.cos(theta), y1 = 0.0, z1 = Math.sin(theta);
      let x2 = Math.cos(nextTheta), y2 = 0.0, z2 = Math.sin(nextTheta);

      posArray.push(
        bx, by, bz,
        x2, y2, z2,
        x1, y1, z1
      );

      // Normals (bottom circle => -Y)
      for (let v = 0; v < 3; v++) {
        normArray.push(0.0, -1.0, 0.0);
      }

      // UV
      uvArray.push(
        0.5, 0.5,
        0.5 + 0.5 * Math.cos(nextTheta), 0.5 + 0.5 * Math.sin(nextTheta),
        0.5 + 0.5 * Math.cos(theta), 0.5 + 0.5 * Math.sin(theta)
      );
    }

    // ------------- Sides -------------
    // Each segment i has 2 triangles forming a “quad”.
    //   top1 => (cosθ,1,sinθ), bot1 => (cosθ,0,sinθ),
    //   top2 => (cos(nextθ),1,sin(nextθ)), bot2 => (cos(nextθ),0,sin(nextθ))
    for (let i = 0; i < seg; i++) {
      let theta = (2 * Math.PI * i) / seg;
      let nextTheta = (2 * Math.PI * (i + 1)) / seg;

      let xT1 = Math.cos(theta), yT1 = 1.0, zT1 = Math.sin(theta);
      let xB1 = Math.cos(theta), yB1 = 0.0, zB1 = Math.sin(theta);
      let xT2 = Math.cos(nextTheta), yT2 = 1.0, zT2 = Math.sin(nextTheta);
      let xB2 = Math.cos(nextTheta), yB2 = 0.0, zB2 = Math.sin(nextTheta);

      // Triangle 1: top1 -> bottom1 -> bottom2
      posArray.push(xT1, yT1, zT1, xB1, yB1, zB1, xB2, yB2, zB2);
      // Triangle 2: top1 -> bottom2 -> top2
      posArray.push(xT1, yT1, zT1, xB2, yB2, zB2, xT2, yT2, zT2);

      // For normals, the direction is outward (cosθ, 0, sinθ)
      // Each vertex on side ring i has normal (cosθ,0,sinθ),
      // ring i+1 has (cos nextθ,0, sin nextθ).
      // We replicate them for each triangle in correct order:
      let nx1 = Math.cos(theta), nz1 = Math.sin(theta);
      let nx2 = Math.cos(nextTheta), nz2 = Math.sin(nextTheta);

      // Tri1: top1, bottom1, bottom2 => (nx1,0,nz1), (nx1,0,nz1), (nx2,0,nz2)
      normArray.push(
        nx1, 0.0, nz1,
        nx1, 0.0, nz1,
        nx2, 0.0, nz2
      );
      // Tri2: top1, bottom2, top2 => (nx1,0,nz1), (nx2,0,nz2), (nx2,0,nz2)
      normArray.push(
        nx1, 0.0, nz1,
        nx2, 0.0, nz2,
        nx2, 0.0, nz2
      );

      // UV: a typical wrap is u from 0..1 around the cylinder, v from 0..1 top->bottom
      let u = i / seg, u2 = (i + 1) / seg;
      // For first triangle (top1->bot1->bot2):
      uvArray.push(
        u, 1, u, 0, u2, 0
      );
      // For second triangle (top1->bot2->top2):
      uvArray.push(
        u, 1, u2, 0, u2, 1
      );
    }

    const posTyped = new Float32Array(posArray);
    const uvTyped = new Float32Array(uvArray);
    const normTyped = new Float32Array(normArray);

    this.indexCount = posTyped.length / 3;

    this.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, posTyped, gl.STATIC_DRAW);

    this.uvBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, uvTyped, gl.STATIC_DRAW);

    this.normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, normTyped, gl.STATIC_DRAW);
  }

  render() {
    gl.uniform1i(u_whichTexture, this.textureNum);

    const [r, g, b, a] = this.color;
    gl.uniform4f(u_FragColor, r, g, b, a);

    gl.uniformMatrix4fv(u_ModelMatrix, false, this.matrix.elements);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
    gl.vertexAttribPointer(a_UV, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_UV);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
    gl.vertexAttribPointer(a_Normal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Normal);

    gl.drawArrays(gl.TRIANGLES, 0, this.indexCount);
  }
}
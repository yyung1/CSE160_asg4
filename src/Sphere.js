class Sphere {
    constructor(radius = 1.0, latBands = 16, lonBands = 16) {
        this.type = 'Sphere';
        this.color = [1.0, 1.0, 1.0, 1.0]; // RGBA
        this.matrix = new Matrix4();      // Model transform
        this.textureNum = -2;             // Which texture to use, similar to your cube

        // Make sure our static buffers are built once:
        Sphere.initBuffers(gl, radius, latBands, lonBands);
    }

    /**
     * Build the sphere’s geometry data only once, then store in static buffers.
     */
    static initBuffers(gl, radius, latBands, lonBands) {
        if (Sphere.vertexBuffer) {
            // Already initialized
            return;
        }

        // --- 1) Generate data arrays (positions, normals, UVs, indices) ---
        const {
            positions, normals, uvs, indices
        } = Sphere.buildSphereData(radius, latBands, lonBands);

        // --- 2) Create and fill VBOs ---
        // Vertex positions
        Sphere.vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, Sphere.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        // Normals
        Sphere.normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, Sphere.normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

        // UVs
        Sphere.uvBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, Sphere.uvBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.STATIC_DRAW);

        // Index buffer
        Sphere.indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, Sphere.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

        // Store how many indices we have to draw
        Sphere.numIndices = indices.length;
    }

    /**
     * Helper to build the geometry for a lat/lon sphere.
     * Returns an object with {positions, normals, uvs, indices}.
     */
    static buildSphereData(radius, latBands, lonBands) {
        const positions = [];
        const normals = [];
        const uvs = [];
        const indices = [];

        // Generate vertex positions, normals, UVs
        for (let lat = 0; lat <= latBands; lat++) {
            const theta = (lat * Math.PI) / latBands; // range [0..pi]
            const sinTheta = Math.sin(theta);
            const cosTheta = Math.cos(theta);

            for (let lon = 0; lon <= lonBands; lon++) {
                const phi = (lon * 2.0 * Math.PI) / lonBands; // range [0..2pi]
                const sinPhi = Math.sin(phi);
                const cosPhi = Math.cos(phi);

                // Sphere coordinates
                const x = cosPhi * sinTheta;
                const y = cosTheta;
                const z = sinPhi * sinTheta;

                // Position
                positions.push(radius * x, radius * y, radius * z);
                // Normal (same as position direction for a perfect sphere)
                normals.push(x, y, z);
                // UV (longitude = u, latitude = v)
                const u = 1 - lon / lonBands; // might flip or shift if you prefer
                const v = 1 - lat / latBands;
                uvs.push(u, v);
            }
        }

        // Generate indices (two triangles per "quad" in the lat/lon grid)
        for (let lat = 0; lat < latBands; lat++) {
            for (let lon = 0; lon < lonBands; lon++) {
                // Index of each vertex in this quad
                const first = lat * (lonBands + 1) + lon;
                const second = first + lonBands + 1;

                indices.push(first, second, first + 1);
                indices.push(second, second + 1, first + 1);
            }
        }

        return { positions, normals, uvs, indices };
    }

    render() {
        gl.uniform1i(u_whichTexture, this.textureNum);

        const [r, g, b, a] = this.color;
        gl.uniform4f(u_FragColor, r, g, b, a);

        gl.uniformMatrix4fv(u_ModelMatrix, false, this.matrix.elements);


        gl.bindBuffer(gl.ARRAY_BUFFER, Sphere.vertexBuffer);
        gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(a_Position);

        gl.bindBuffer(gl.ARRAY_BUFFER, Sphere.uvBuffer);
        gl.vertexAttribPointer(a_UV, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(a_UV);

        gl.bindBuffer(gl.ARRAY_BUFFER, Sphere.normalBuffer);
        gl.vertexAttribPointer(a_Normal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(a_Normal);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, Sphere.indexBuffer);

        gl.drawElements(gl.TRIANGLES, Sphere.numIndices, gl.UNSIGNED_SHORT, 0);
    }

}
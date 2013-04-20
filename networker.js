// Network Visualization helper
// Edward Lee

(function() {

  // default settings
  var Settings = function() {

    this.charge = -700;
    this.gravity = 0.07;
    this.friction = 0.3;
    this.linkDistance = 20;
    this.linkStrength = 1.5;
    this.theta = 0.8;

    this.zooming = true;
    this.explode = false;
    this.advanced = false;
    this.spread = 0; // -1 to 1

  };

  // networker controller object
  Networker = function() {
    var self = this,
      nw = {        
        nodes: [],
        edges: [],
        stats: {},
        els: {},
        canvas: {
          translate: [0,0],
          scale: 1
        },
        draw: {},
        style: {},
        key: "id",
        ids: { nodes: {}, edges: {} },
        settings: new Settings(),
        listeners: {
          nodes: {},
          edges: {}
        }
      };

    // default filtering (none)
    nw.filterNodes = function(nodes) {
      return nodes;
    }
    nw.filterEdges = function(edges) {
      return edges;
    }

    // default styles
    nw.draw.node = function(d) {
        d3.select(this).append("svg:circle");
    };
    nw.draw.edge = d3.svg.line()
      .x(function(d) { return !isNaN(d.x) ? d.x : 0; })
      .y(function(d) { return !isNaN(d.y) ? d.y : 0; })
      .interpolate("basis");

      nw.style.node = function(d) {
      d3.select(this).select("circle")
        .attr("r", function() { return 4; });
    };
    nw.style.edge = function(d) {
      d3.select(this)
        .style("stroke-width", function() { return 1; });
    };

    // initialize networker vis
    nw.setup = function(element, size) {
      nw.size = (size) ? size : [500, 400];
      // container
      nw.els.vis = (element) ? element : d3.select("body")
        .append("svg")
          .attr("class", "network")
          .attr("width", nw.size[0])
          .attr("height", nw.size[1])
          .attr("pointer-events", "all")
          .call(d3.behavior.zoom().on("zoom", nw.moveCanvas))
          .append("svg:g")
            .attr("class", "canvas");

      // layers
      nw.els.edgeLayer = nw.els.vis.append("g")
          .attr("class", "edgeLayer");
      nw.els.nodeLayer = nw.els.vis.append("g")
          .attr("class", "nodeLayer");
      nw.force = d3.layout.force()
        .nodes(nw.nodes)
        .links(nw.edges)
        .size(nw.size)
        .on("tick", nw.tick);

    }

    // add multiple
    nw.addMany = function(d, update) {
      if (d.nodes) {
        d.nodes.forEach(function(n) {
          nw.addNode(n, false);
        });
      }
      if (d.edges) {
        d.edges.forEach(function(e) {
          nw.addEdge(e, false);
        });
      }
      if (update)
        nw.update();
    }

    // add node
    nw.addNode = function(n, update) {

      // add index id if doesn't exist
      if (!n[nw.key]) n[nw.key] = nw.nodes.length;
      // else check for existing id
      else if (nw.ids.nodes[n[nw.key]]) return false;

      // add to array
      nw.nodes.push(n);
      // add to ids map
      nw.ids.nodes[n[nw.key]] = n;

      // perform update
      if (update)
        nw.update();

      return true;
    }

    // add edge
    nw.addEdge = function(e, update) {

      // add index id if doesn't exist
      if (!e[nw.key]) e[nw.key] = nw.edges.length;
      // else check for existing id
      else if (nw.ids.edges[e[nw.key]]) return false;

      // replace source and target with objects
      if (nw.ids.nodes[e.source]) e.source = nw.ids.nodes[e.source];
      if (nw.ids.nodes[e.target]) e.target = nw.ids.nodes[e.target];

      // add to array
      nw.edges.push(e);
      // add to ids map
      nw.ids.edges[e[nw.key]] = e;

      // perform update
      if (update)
        nw.update();

      return true;
    }

    // clear nodes and edges
    nw.empty = function() {
      nw.ids = { nodes: {}, edges: {} };
      nw.nodes = [];
      nw.edges = [];
    }

    // select nodes and edges for update
    nw.assembleData = function() {
      
      nw.nodes.forEach(function(d) { d.include = false; });
      nw.edges.forEach(function(d) { d.include = false; });

      // user filtering
      var nodes = nw.filterNodes(nw.nodes.slice(0)),
          edges = nw.filterEdges(nw.edges.slice(0));

      // include filtered nodes
      nodes.forEach(function(d) { d.include = true; });

      // include filtered edges, if both nodes are also included
      for (var i=edges.length-1; i>=0; i--) {
        var d = edges[i];
        if (d.source.include && d.target.include) {
          // include
          d.include = true;
        }
        else {
          // remove
          edges.splice(i, 1);
        }
      }

      return { "nodes": nodes, "edges": edges };

    };

    // update vis
    nw.update = function() {

      console.log("Updating...");

      // var track = []
      // nw.nodes.forEach(function(n) { 
      //   if (n.x && n.x == nw.size[0]/2) { track.push(n); }
      // });
      var data = nw.assembleData();

      // start
      nw.force
        .nodes(data.nodes)
        .links(data.edges)
        .start();
      nw.forceSettings();

      // append/remove edges
      nw.els.edges = nw.els.edgeLayer.selectAll(".edge").data(data.edges, function(d) { return d[nw.key]; });
      nw.els.edges.enter()
        .append("svg:path")
          .attr("class", "edge");
      nw.els.edges.exit().remove();

      // append/remove nodes
      nw.els.nodes = nw.els.nodeLayer.selectAll(".node").data(data.nodes, function(d) { return d[nw.key]; });
      nw.els.nodes.enter()
        .append("svg:g")
          .attr("class", "node")
          .each(nw.draw.node)
          .call(nw.force.drag);
      nw.els.nodes.exit().remove();

      // style nodes and edges
      if (nw.style.node) nw.els.nodes.each(nw.style.node);
      if (nw.style.edge) nw.els.edges.each(nw.style.edge);

      if (nw.settings.explode) {
        nw.force.gravity(7);
        setTimeout(nw.forceSettings, 75);
      }

    }

    // move canvas (zoom, pan)
    nw.moveCanvas = function() {
      if (nw.settings.zooming) {
        nw.canvas.translate = d3.event.translate;
        nw.canvas.scale = d3.event.scale;
        nw.els.vis.attr("transform", "translate(" + nw.canvas.translate + ")" + " scale(" + nw.canvas.scale + ")" );
      }
    }

    // set force settings programmatically
    nw.setForceSettings = function(settings) {
      for (var k in settings) {
        if (k in nw.settings) {
          nw.settings[k] = settings[k];
        }
      }
    }

    // force settings
    nw.forceSettings = function() {

      // charge
      var c = (nw.settings.advanced) ? nw.settings.charge - Math.min(nw.nodes.length * 5, 700) + nw.settings.spread * 50 : nw.settings.charge;

      // gravity
      var g = (nw.settings.advanced) ? nw.settings.gravity + Math.min(nw.nodes.length * 0.002, 0.7) : nw.settings.gravity;

      // friction
      var f = nw.settings.friction;

      // link distance
      var ld = (nw.settings.advanced) ? function(d) {
        var ret = nw.settings.linkDistance;
        if (d.source.weight) ret += d.source.weight * 4;
        if (d.target.weight) ret += d.target.weight * 4;
        ret = Math.min(ret, 80);
        return ret; 
      } : nw.settings.linkDistance;

      // link strength
      var ls = (nw.settings.advanced) ? function(d) {
        var ret = nw.settings.linkStrength;
        if (d.value) ret += Math.min(d.value * 0.5, 2);
        return ret;
      } : nw.settings.linkStrength;

      // theta
      var t = nw.settings.theta;

      nw.force.charge(c)
        .gravity(g)
        .friction(f)
        .linkDistance(ld)
        .linkStrength(ls)
        .theta(t);

      nw.force.start();

    }

    // tick
    nw.tick = function(e) {

      if (nw.customTick) nw.customTick(nw.nodes, nw.edges);

      nw.els.edges
          .attr("d", function(d) { return nw.draw.edge([{ x: d.source.x, y: d.source.y }, { x: d.target.x, y: d.target.y }])});

      nw.els.nodes
          .attr("transform", function(d) { return formatTranslate(d.x, d.y); });

    }

    // register event listener
    nw.registerListener = function(type, event, listener) { // "nodes", "click", function(d) {}
      if (!nw.listeners[type]) nw.listeners[type] = {};
      if (!nw.listeners[type][event]) nw.listeners[type][event] = [];
      nw.listeners[type][event].push(listener);
      if (nw.els[type]) nw.els[type].on(event, listener);
    };

    // stats
    nw.computeStats = function() {
      // create index map
      nw.stats.indexMap = {};
      for(var i=0; i<nw.nodes.length; i++) {
        nw.stats.indexMap[nw.nodes[i][nw.key]] = i;
      }

      // calculate mass vector, adjacency & degree matrices
      var adj = new Array(nw.nodes.length),
        deg = new Array(nw.nodes.length),
        mas = new Array(nw.nodes.length);
      for(var i=0; i<nw.nodes.length; i++) {
        adj[i] = new Array(nw.nodes.length);
        deg[i] = new Array(nw.nodes.length);
        mas[i] = 1;
        for(var ii=0; ii<nw.nodes.length; ii++) {
          adj[i][ii] = 0;
          deg[i][ii] = 0;
        }
      }
      nw.edges.forEach(function(e) {
        var srcIndex = (typeof(e.source)=="object") ? nw.stats.indexMap[e.source[nw.key]] : e.source;
        var tarIndex = (typeof(e.target)=="object") ? nw.stats.indexMap[e.target[nw.key]] : e.target;
        if (srcIndex && tarIndex) {
          adj[srcIndex][tarIndex] = 1;
          adj[tarIndex][srcIndex] = 1;
          deg[srcIndex][srcIndex] += 1;
          deg[tarIndex][tarIndex] += 1;
        }
      });
      nw.stats.adjacencyMatrix = $M(adj);
      nw.stats.degreeMatrix = $M(deg);

      // create node mass vector
      nw.stats.massVector = $V(mas);

      // calculate the Laplacian matrix
      nw.stats.laplacianMatrix = nw.stats.degreeMatrix.subtract(nw.stats.adjacencyMatrix);

      // find the dominant eigenvalue and eigenvector using power iteration
      nw.stats.centrality = powerIterate(nw.stats.adjacencyMatrix, 10);
      nw.stats.centralityMin = null;
      nw.stats.centralityMax = null;
      nw.stats.centrality.eigenvector.each(function(v, i) {
        if (nw.nodes[i-1]) nw.nodes[i-1].centrality = v;
        if (!nw.stats.centralityMin || v < nw.stats.centralityMin) nw.stats.centralityMin = v;
        if (!nw.stats.centralityMax || v > nw.stats.centralityMax) nw.stats.centralityMax = v;
      });

    }

    // dat gui settings controller
    nw.enableSettings = function() {
      nw.settingsGui = new dat.GUI();

      nw.settingsGui.add(nw.settings, "charge", -15000, 0).onChange(nw.forceSettings);
      nw.settingsGui.add(nw.settings, "gravity", -1, 2).onChange(nw.forceSettings);
      nw.settingsGui.add(nw.settings, "friction", 0, 1).onChange(nw.forceSettings);
      nw.settingsGui.add(nw.settings, "linkDistance", 0, 600).onChange(nw.forceSettings);
      nw.settingsGui.add(nw.settings, "linkStrength", 0, 5).onChange(nw.forceSettings);
      nw.settingsGui.add(nw.settings, "theta", 0, 1).onChange(nw.forceSettings);

      nw.settingsGui.add(nw.settings, "zooming");
      nw.settingsGui.add(nw.settings, "explode");
      nw.settingsGui.add(nw.settings, "advanced").onChange(nw.forceSettings);
      nw.settingsGui.add(nw.settings, "spread", -1, 1).onChange(nw.forceSettings);

    }

    return nw;
  }

  function powerIterate(matrix, iterations) {

    var ret = {
      eigenvalue: null,
      eigenvector: Vector.Random(matrix.rows())
    };

    for (var i=0; i<iterations; i++) {
      var tmp = matrix.multiply(ret.eigenvector);
      ret.eigenvalue = Math.sqrt(tmp.dot(tmp));
      ret.eigenvector = tmp.multiply(1/ret.eigenvalue);
    }   

    return ret;
  }

  function formatTranslate(x, y) {
    return "translate("+x+","+y+")";
  }

})();
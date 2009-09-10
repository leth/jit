ForceGraph = new Class({
	'initialize': function(canvas, controller)
	{
		var config = {
			labelContainer: canvas.id + '-label',
			interpolation: 'linear',
			modes: ['linear'],
			levelDistance: 100,
			withLabels: true,

			Node: {
				overridable: false,
				type: 'circle',
				dim: 10,
				color: '#ccb',
				width: 10,
				height: 10,
				lineWidth: 1
			},
			
			Edge: {
				overridable: false,
				type: 'line',
				color: '#f00',
				lineWidth: 2,
				
				naturalLength: 75,
				restoringForce: 2
			},
			
			fps:40,
			duration: 2500,
			transition: Trans.Quart.easeInOut,
			clearCanvas: true
		};

		var innerController = {
			onBeforeCompute: $empty,
			onAfterCompute: $empty,
			onCreateLabel: $empty,
			onPlaceLabel: $empty,
			onComplete: $empty,
			onBeforePlotLine:$empty,
			onAfterPlotLine: $empty,
			onBeforePlotNode:$empty,
			onAfterPlotNode: $empty
		};

		this.controller = this.config = $merge(config, innerController, controller);
		this.fx = new ForceGraph.Plot(this);
		this.op = new ForceGraph.Op(this);
		this.json = null;
		this.canvas = canvas;
		this.root = null;
		this.busy = false;
		this.graph = this;
		
		$extend(this, new Graph({
			'complex': true,
			'Node': {
				'selected': false,
				'exist': true,
				'drawn': true
			}
		}));
	},
	
	refresh: function() {
		this.compute();
		this.plot();
	},
	
	reposition: function() {
		this.compute('endPos');
	},
	
	plot: function() {
		this.fx.plot();
	},

	compute: function(property) {
		var prop = property || ['pos', 'startPos', 'endPos'];

		this.computePositions(prop);
	},

	computePositions: function(property) {
		var propArray = $splat(property);
		var positions = {};
		var forces = {};

		Graph.Util.eachNode(this, function(node){
			positions[node.id] = {x: node.pos.x, y: node.pos.y};
			forces[node.id] = {x: 0, y: 0};
		});
		
		// TODO make configurable
		var quietCount = 0;
		var quietLimit = 10;
		var prevForce = 0;
		var forceThreshold = 10;
		
		// TODO make configurable
		var i;
		for (i=0; i < 1000; i++) {
			var parts, forceTotal = 0;
		
			parts = this.computeEdgeForceStep(positions);
			// console.log('edge', parts[1], parts[0]);
			
			for (var id in parts[0])
			{
				forces[id].x += parts[0][id].x;
				forces[id].y += parts[0][id].y;
			}
			forceTotal = parts[1];
			
			parts = this.computeNodeForceStep(positions);
			// console.log('node', parts[1], parts[0]);
		
			for (var id in parts[0])
			{
				forces[id].x += parts[0][id].x;
				forces[id].y += parts[0][id].y;
			}
			forceTotal += parts[1];
			
			parts = this.computeFrictionStep(positions, forces);
			// console.log('friction', parts[1], parts[0]);
		
			for (var id in parts[0])
			{
				forces[id].x += parts[0][id].x;
				forces[id].y += parts[0][id].y;
			}
			forceTotal += parts[1];
			
			// TODO make configurable
			var max_force = 50;
			for (var id in positions)
			{
				positions[id].x += Math.max(-max_force, Math.min(max_force, forces[id].x)) * .4;
				positions[id].y += Math.max(-max_force, Math.min(max_force, forces[id].y)) * .4;
				forces[id].x = 0;
				forces[id].y = 0;
			}
			// console.log(i, Math.abs(forceTotal - prevForce), forceTotal, prevForce);
			
			// TODO implement force keeping things away from the edge of the canvas
			
			if (Math.abs(forceTotal - prevForce) < forceThreshold) {
				quietCount++;
			} else {
				quietCount = 0;
			}
			
			// We're done!
			if (quietCount >= quietLimit)
				break;
				
			prevForce = forceTotal;
		}

		Graph.Util.eachNode(this, function(node){
			for(var i=0; i<propArray.length; i++)
				node[propArray[i]] = $C(positions[node.id].x, positions[node.id].y);
		});
	},
	computeEdgeForceStep: function(positions) {
		var visited = {};
		var forces = {};
		var forceSum = 0;
		
		var self = this;
		
		Graph.Util.eachNode(this, function(node){
			visited[node.id] = {};
			forces[node.id] = {x: 0, y: 0};
		});
		
		Graph.Util.eachNode(this, function(node){
			Graph.Util.eachAdjacency(node, function(adj) {
				if (visited[adj.nodeFrom.id][adj.nodeTo.id] == true ||
					visited[adj.nodeTo.id][adj.nodeFrom.id] == true)
					return;
				
				visited[adj.nodeFrom.id][adj.nodeTo.id] = true;
				visited[adj.nodeTo.id][adj.nodeFrom.id] = true;
				
				var start = positions[adj.nodeFrom.id];
				var end   = positions[adj.nodeTo.id];

				var Ax = end.x - start.x;
				var Ay = end.y - start.y;
				
				var k = self.controller.Edge.restoringForce;
				var l = self.controller.Edge.naturalLength;

				var d = Math.sqrt((Ax * Ax) + (Ay * Ay));

				var Sx = Ax;
				var Sy = Ay;

				if (d != 0) {
					var Axy = Math.abs(Ax) + Math.abs(Ay);
					Sx /= Axy; Sy /= Axy;
				} else {
					// For safety, assume they can't really be on exactly the same point
					d = 1;
					// pick a random angle
					var angle = Math.random() * 2 * Math.PI; // TODO mootools
					Sx = Math.cos(angle);
					Sy = Math.sin(angle);
				}
				
				var force = k * (d - l);
				var Dx = Sx * force;
				var Dy = Sy * force;

				forces[adj.nodeFrom.id].x += Dx;
				forces[adj.nodeFrom.id].y += Dy;
				forces[adj.nodeTo.id].x -= Dx;
				forces[adj.nodeTo.id].y -= Dy;

				forceSum += Math.abs(force) *2;
			});
		});
		
		return [forces, forceSum];
	},
	computeNodeForceStep: function(positions) {
		var visited = {};
		var forces = {};
		var forceSum = 0;
		
		var self = this;
		
		Graph.Util.eachNode(this, function(node){
			forces[node.id] = {x: 0, y: 0};
			visited[node.id] = {};
		});

		Graph.Util.eachNode(this, function(nodeA){
			Graph.Util.eachNode(self, function(nodeB){
				if (nodeA == nodeB || nodeA.id == nodeB)
					return;
					
				if (visited[nodeA.id][nodeB.id] == true ||
					visited[nodeB.id][nodeA.id] == true)
					return;
				
				visited[nodeA.id][nodeB.id] = true;
				visited[nodeB.id][nodeA.id] = true;
				
				var start = positions[nodeA.id];
				var end   = positions[nodeB.id];

				var Ax = end.x - start.x;
				var Ay = end.y - start.y;
				
				var d_sq = (Ax * Ax) + (Ay * Ay);
				// TODO make configurable.
				var max_dist = self.controller.Edge.naturalLength;
				var max_dist_sq = (max_dist * max_dist) * 3;
				
				var d, angle;
				// TODO make configurable.
				if (d_sq > 1)
				{	
					if (d_sq > max_dist_sq)
						return;
				
					d = Math.sqrt(d_sq);
					
					angle = Math.atan2(Ay, Ax);
				}
				else
				{	// TODO make configurable.
					d = Math.random();
					angle = Math.random() * 2 * Math.PI;
				}
				
				// TODO make configurable.
				var k = 500;
				var force = (k * 1 * 1) / d;

				var Dx = Math.cos(angle) * force;
				var Dy = Math.sin(angle) * force;
				
				forces[nodeA.id].x -= Dx;
				forces[nodeA.id].y -= Dy;
				forces[nodeB.id].x += Dx;
				forces[nodeB.id].y += Dy;
				
				forceSum += force *2;
			});
		});
		
		return [forces, forceSum];
	},
	computeFrictionStep: function(positions, force) {
		var forces = {};
		var forceSum = 0;
		
		var m = 1;  // mass
		var f = 10; // friction
		
		Graph.Util.eachNode(this, function(node){
			// Is this sensible?
			var fX = force[node.id].x * m / f * (0.4 * Math.random() + 0.8);
			var fY = force[node.id].y * m / f * (0.4 * Math.random() + 0.8);
		
			forces[node.id] = {x: -fX, y: -fY};
			forceSum -= fX + fY;
		});
		
		return [forces, forceSum];
	},
	
	computeCenterByMass: function(startProperty, endProperties)
	{
		var propArray = $splat(endProperties);
		var x =0, y=0;
		var count = 0;
		
		Graph.Util.eachNode(this, function(node){
			x += node[startProperty].x
			y += node[startProperty].y
			count++;
		});
		
		// average
		x /= count; y /= count;
		
		Graph.Util.eachNode(this, function(node){
			for(var i=0; i<propArray.length; i++)
				node[propArray[i]] = $C(node[startProperty].x -= x, node[startProperty].y -= y);
		});
	}
});

ForceGraph.Op = new Class({
 
	Implements: Graph.Op,
 
		initialize: function(viz) {
			this.viz = viz;
		}
});

ForceGraph.Plot = new Class({
	
	Implements: Graph.Plot,
	
		initialize: function(viz) {
			this.viz = viz;
			this.config = viz.config;
			this.node = viz.config.Node;
			this.edge = viz.config.Edge;
			this.animation = new Animation;
			this.nodeTypes = new ForceGraph.Plot.NodeTypes;
			this.edgeTypes = new ForceGraph.Plot.EdgeTypes;
		},
	
		placeLabel: function(tag, node, controller) {
			var pos = node.pos.getc(true), canvas = this.viz.canvas; 
			var size = canvas.getSize();
			var labelPos= {
				x: Math.round(pos.x + size.width/2),
				y: Math.round(pos.y + size.height/2)
			};
			var style = tag.style;
			style.left = labelPos.x + 'px';
			style.top  = labelPos.y + 'px';
			style.display = this.fitsInCanvas(labelPos, canvas)? '' : 'none';
			controller.onPlaceLabel(tag, node);
		}
});
 
// this has reworked visiting logic because the graphs might be cyclic.
// outside the declaration in order to override 'Implements'
ForceGraph.Plot.implement({
	plot: function(opt, animating) {
	
		var viz = this.viz;
		this.graph = viz;
		var aGraph = viz;
		var canvas = viz.canvas;
		var id = viz.root;
		var that = this;
		var ctx = canvas.getCtx();
		var GUtil = Graph.Util;
		opt = opt || this.viz.controller;
		opt.clearCanvas && canvas.clear();

		var visited = {};
		GUtil.eachNode(aGraph, function(node) {
			GUtil.eachAdjacency(node, function(adj) {
				var nodeTo = adj.nodeTo;
				if(visited[nodeTo.id] !== true && node.drawn && nodeTo.drawn) {
					!animating && opt.onBeforePlotLine(adj);
					ctx.save();
					ctx.globalAlpha = Math.min(Math.min(node.alpha, nodeTo.alpha), adj.alpha);
					that.plotLine(adj, canvas, animating);
					ctx.restore();
					!animating && opt.onAfterPlotLine(adj);
				}
			});
			ctx.save();
			if(node.drawn) {
				ctx.globalAlpha = node.alpha;
				!animating && opt.onBeforePlotNode(node);
				that.plotNode(node, canvas, animating);
				!animating && opt.onAfterPlotNode(node);
			}
			if(!that.labelsHidden && opt.withLabels) {
				if(node.drawn && ctx.globalAlpha >= 0.95) {
					that.plotLabel(canvas, node, opt);
				} else {
					that.hideLabel(node, false);
				}
			}
			ctx.restore();
			visited[node.id] = true;
		});
	}
});

ForceGraph.Plot.NodeTypes = new Class({
	'none': function() {},

	'circle': function(node, canvas) {
		var pos = node.pos.getc(true), nconfig = this.node, data = node.data;
		var nodeDim = nconfig.overridable && data && data.$dim || nconfig.dim;
		
		canvas.path('fill', function(context) {
			context.arc(pos.x, pos.y, nodeDim, 0, Math.PI*2, true);
		});
	}
});

ForceGraph.Plot.EdgeTypes = new Class({
	'none': function() {},

	'line': function(adj, canvas) {
		var pos = adj.nodeFrom.pos.getc(true);
		var posChild = adj.nodeTo.pos.getc(true);
		
		canvas.path('stroke', function(context) {
			context.moveTo(pos.x, pos.y);
			context.lineTo(posChild.x, posChild.y);
		});
	}
});
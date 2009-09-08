ForceGraph = new Class({
	'initialize': function(canvas, controller)
	{
		var config= {
			labelContainer: canvas.id + '-label',
			interpolation: 'linear',
			levelDistance: 100,
			withLabels: true,

			Node: {
				overridable: false,
				type: 'circle',
				dim: 3,
				color: '#ccb',
				width: 5,
				height: 5,
				lineWidth: 1
			},
            
			Edge: {
				overridable: false,
				type: 'line',
				color: '#ccb',
				lineWidth: 1
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
		this.graphOptions = {
			'complex': true,
			'Node': {
				'selected': false,
				'exist': true,
				'drawn': true
			}
		};
		this.graph = new Graph(this.graphOptions);
		this.fx = new ForceGraph.Plot(this);
		this.op = new ForceGraph.Op(this);
		this.json = null;
		this.canvas = canvas;
		this.root = null;
		this.busy = false;
		this.parent = false;
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
			this.config = viz.config;
			this.node = viz.config.Node;
			this.edge = viz.config.Edge;
			this.animation = new Animation;
			this.nodeTypes = new ForceGraph.Plot.NodeTypes;
			this.edgeTypes = new ForceGraph.Plot.EdgeTypes;
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
	},
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
/*
 * File: Graph.Plot.js
 *
 * Defines an abstract class for performing <Graph> rendering and animation.
 *
 */


/*
   Object: Graph.Plot

   Generic <Graph> rendering and animation methods.
   
   Description:

   An abstract class for plotting a generic graph structure.

   Implemented by:

   <Hypertree.Plot>, <RGraph.Plot>, <ST.Plot>.

   Access:

   The subclasses for this abstract class can be accessed by using the _fx_ property of the <Hypertree>, <RGraph>, or <ST> instances created.

   See also:

   <Hypertree.Plot>, <RGraph.Plot>, <ST.Plot>, <Hypertree>, <RGraph>, <ST>, <Graph>.

*/
Graph.Plot = {
    
    Interpolator: {
        'moebius': function(elem, delta, vector) {
            if(delta <= 1 || vector.norm() <= 1) {
        var x = vector.x, y = vector.y;
              var ans = elem.startPos.getc().moebiusTransformation(vector);
              elem.pos.setc(ans.x, ans.y);
              vector.x = x; vector.y = y;
            }           
    },

        'linear': function(elem, delta) {
            var from = elem.startPos.getc(true);
            var to = elem.endPos.getc(true);
            elem.pos.setc((to.x - from.x) * delta + from.x, (to.y - from.y) * delta + from.y);
        },

        'fade:nodes': function(elem, delta) {
            if(delta <= 1 && (elem.endAlpha != elem.alpha)) {
                var from = elem.startAlpha;
                var to   = elem.endAlpha;
                elem.alpha = from + (to - from) * delta;
            }
        },
        
        'fade:vertex': function(elem, delta) {
            var adjs = elem.adjacencies;
            for(var id in adjs) this['fade:nodes'](adjs[id], delta);
        },
        
        'polar': function(elem, delta) {
            var from = elem.startPos.getp(true);
            var to = elem.endPos.getp();
      var ans = to.interpolate(from, delta);
            elem.pos.setp(ans.theta, ans.rho);
        }
    },
    
    //A flag value indicating if node labels are being displayed or not.
    labelsHidden: false,
    //Label DOM element
    labelContainer: false,
    //Label DOM elements hash.
    labels: {},

    /*
       Method: getLabelContainer
    
       Lazy fetcher for the label container.

       Returns:

       The label container DOM element.

       Example:

      (start code js)
        var rg = new RGraph(canvas, config); //can be also Hypertree or ST
        var labelContainer = rg.fx.getLabelContainer();
        alert(labelContainer.innerHTML);
      (end code)
    */
    getLabelContainer: function() {
        return this.labelContainer? this.labelContainer : this.labelContainer = document.getElementById(this.viz.config.labelContainer);
    },
    
    /*
       Method: getLabel
    
       Lazy fetcher for the label DOM element.

       Parameters:

       id - The label id (which is also a <Graph.Node> id).

       Returns:

       The label DOM element.

       Example:

      (start code js)
        var rg = new RGraph(canvas, config); //can be also Hypertree or ST
        var label = rg.fx.getLabel('someid');
        alert(label.innerHTML);
      (end code)
      
    */
    getLabel: function(id) {
        return (id in this.labels && this.labels[id] != null)? this.labels[id] : this.labels[id] = document.getElementById(id);
    },
    
    /*
       Method: hideLabels
    
       Hides all labels (by hiding the label container).

       Parameters:

       hide - A boolean value indicating if the label container must be hidden or not.

       Example:
       (start code js)
        var rg = new RGraph(canvas, config); //can be also Hypertree or ST
        rg.fx.hideLabels(true);
       (end code)
       
    */
    hideLabels: function (hide) {
        var container = this.getLabelContainer();
        if(hide) container.style.display = 'none';
        else container.style.display = '';
        this.labelsHidden = hide;
    },
    
    /*
       Method: clearLabels
    
       Clears the label container.

       Useful when using a new visualization with the same canvas element/widget.

       Parameters:

       force - Forces deletion of all labels.

       Example:
       (start code js)
        var rg = new RGraph(canvas, config); //can be also Hypertree or ST
        rg.fx.clearLabels();
        (end code)
    */
    clearLabels: function(force) {
        for(var id in this.labels) {
            if (force || !this.viz.graph.hasNode(id)) {
                this.disposeLabel(id);
                delete this.labels[id];
            }
        }
    },
    
    /*
       Method: disposeLabel
    
       Removes a label.

       Parameters:

       id - A label id (which generally is also a <Graph.Node> id).

       Example:
       (start code js)
        var rg = new RGraph(canvas, config); //can be also Hypertree or ST
        rg.fx.disposeLabel('labelid');
       (end code)
    */
    disposeLabel: function(id) {
        var elem = this.getLabel(id);
        if(elem && elem.parentNode) {
      elem.parentNode.removeChild(elem);
    }  
    },

    /*
       Method: hideLabel
    
       Hides the corresponding <Graph.Node> label.
        
       Parameters:

       node - A <Graph.Node>. Can also be an array of <Graph.Nodes>.
       flag - If *true*, nodes will be shown. Otherwise nodes will be hidden.

       Example:
       (start code js)
        var rg = new RGraph(canvas, config); //can be also Hypertree or ST
        rg.fx.hideLabel(rg.graph.getNode('someid'), false);
       (end code)
    */
    hideLabel: function(node, flag) {
    node = $splat(node);
    var st = flag? "" : "none", lab, that = this;
    $each(node, function(n) {
      var lab = that.getLabel(n.id);
      if (lab) {
           lab.style.display = st;
      } 
    });
    },

    /*
       Method: sequence
    
       Iteratively performs an action while refreshing the state of the visualization.

       Parameters:

       options - Some sequence options like
      
       - _condition_ A function returning a boolean instance in order to stop iterations.
       - _step_ A function to execute on each step of the iteration.
       - _onComplete_ A function to execute when the sequence finishes.
       - _duration_ Duration (in milliseconds) of each step.

      Example:
       (start code js)
        var rg = new RGraph(canvas, config); //can be also Hypertree or ST
        var i = 0;
        rg.fx.sequence({
          condition: function() {
           return i == 10;
          },
          step: function() {
            alert(i++);
          },
          onComplete: function() {
           alert('done!');
          }
        });
       (end code)

    */
    sequence: function(options) {
        var that = this;
    options = $merge({
            condition: $lambda(false),
            step: $empty,
            onComplete: $empty,
            duration: 200
        }, options || {});

        var interval = setInterval(function() {
            if(options.condition()) {
                options.step();
            } else {
                clearInterval(interval);
                options.onComplete();
            }
            that.viz.refresh(true);
        }, options.duration);
    },
    
    /*
       Method: animate
    
       Animates a <Graph> by interpolating some <Graph.Nodes> properties.

       Parameters:

       opt - Animation options. This object contains as properties

       - _modes_ (required) An Array of animation types. Possible values are "linear", "polar", "moebius", "fade:nodes" and "fade:vertex".

       "linear", "polar" and "moebius" animation options will interpolate <Graph.Nodes> "startPos" and "endPos" properties, storing the result in "pos".
       
       "fade:nodes" and "fade:vertex" animation options will interpolate <Graph.Nodes> and/or <Graph.Adjacence> "startAlpha" and "endAlpha" properties, storing the result in "alpha".

       - _duration_ Duration (in milliseconds) of the Animation.
       - _fps_ Frames per second.
       - _hideLabels_ hide labels or not during the animation.

       ...and other <Hypertree>, <RGraph> or <ST> controller methods.

       Example:
       (start code js)
        var rg = new RGraph(canvas, config); //can be also Hypertree or ST
        rg.fx.animate({
          modes: ['linear'],
          hideLabels: false
        }); 
       (end code)
       
       
    */
    animate: function(opt, versor) {
        var that = this,
    viz = this.viz,
    graph  = viz.graph,
    GUtil = Graph.Util;
    opt = $merge(viz.controller, opt || {}); 
    
        if(opt.hideLabels) this.hideLabels(true);
        this.animation.setOptions($merge(opt, {
            $animating: false,
            compute: function(delta) {
        var vector = versor? versor.scale(-delta) : null;
        GUtil.eachNode(graph, function(node) { 
                    for(var i=0; i<opt.modes.length; i++) {
            that.Interpolator[opt.modes[i]](node, delta, vector);
          } 
                });
                that.plot(opt, this.$animating);
                this.$animating = true;
            },
            complete: function() {
                GUtil.eachNode(graph, function(node) { 
                    node.startPos.set(node.pos);
                    node.startAlpha = node.alpha;
                });
                if(opt.hideLabels) that.hideLabels(false);
                that.plot(opt);
                opt.onComplete();
                opt.onAfterCompute();
            }       
    })).start();
    },
    
    /*
       Method: plot
    
       Plots a <Graph>.

       Parameters:

       opt - _optional_ Plotting options.

       Example:

       (start code js)
       var rg = new RGraph(canvas, config); //can be also Hypertree or ST
       rg.fx.plot(); 
       (end code)

    */
    plot: function(opt, animating) {
        var viz = this.viz, 
    aGraph = viz.graph, 
    canvas = viz.canvas, 
    id = viz.root, 
    that = this, 
    ctx = canvas.getCtx(), 
    GUtil = Graph.Util;
        opt = opt || this.viz.controller;
    opt.clearCanvas && canvas.clear();
        
        var T = !!aGraph.getNode(id).visited;
        GUtil.eachNode(aGraph, function(node) {
            GUtil.eachAdjacency(node, function(adj) {
        var nodeTo = adj.nodeTo;
                if(!!nodeTo.visited === T && node.drawn && nodeTo.drawn) {
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
            node.visited = !T;
        });
    },

    /*
       Method: plotLabel
    
       Plots a label for a given node.

       Parameters:

       canvas - A <Canvas> instance.
       node - A <Graph.Node>.
       controller - A configuration object. See also <Hypertree>, <RGraph>, <ST>.

    */
    plotLabel: function(canvas, node, controller) {
    var id = node.id, tag = this.getLabel(id);
        if(!tag && !(tag = document.getElementById(id))) {
            tag = document.createElement('div');
            var container = this.getLabelContainer();
            container.appendChild(tag);
            tag.id = id;
            tag.className = 'node';
            tag.style.position = 'absolute';
            controller.onCreateLabel(tag, node);
            this.labels[node.id] = tag;
        }
    this.placeLabel(tag, node, controller);
    },
  
  /*
       Method: plotNode
    
       Plots a <Graph.Node>.

       Parameters:
       
       node - A <Graph.Node>.
       canvas - A <Canvas> element.

    */
    plotNode: function(node, canvas, animating) {
        var nconfig = this.node, data = node.data;
        var cond = nconfig.overridable && data;
        var width = cond && data.$lineWidth || nconfig.lineWidth;
        var color = cond && data.$color || nconfig.color;
        var ctx = canvas.getCtx();
        
        ctx.lineWidth = width;
    ctx.fillStyle = color;
    ctx.strokeStyle = color; 

        var f = node.data && node.data.$type || nconfig.type;
        this.nodeTypes[f].call(this, node, canvas, animating);
    },
    
    /*
       Method: plotLine
    
       Plots a line.

       Parameters:

       adj - A <Graph.Adjacence>.
       canvas - A <Canvas> instance.

    */
    plotLine: function(adj, canvas, animating) {
        var econfig = this.edge, data = adj.data;
        var cond = econfig.overridable && data;
        var width = cond && data.$lineWidth || econfig.lineWidth;
        var color = cond && data.$color || econfig.color;
        var ctx = canvas.getCtx();
        
        ctx.lineWidth = width;
        ctx.fillStyle = color;
        ctx.strokeStyle = color; 

        var f = adj.data && adj.data.$type || econfig.type;
        this.edgeTypes[f].call(this, adj, canvas, animating);
    },    
  
  /*
       Method: fitsInCanvas
    
       Returns _true_ or _false_ if the label for the node is contained in the canvas dom element or not.

       Parameters:

       pos - A <Complex> instance (I'm doing duck typing here so any object with _x_ and _y_ parameters will do).
       canvas - A <Canvas> instance.
       
       Returns:

       A boolean value specifying if the label is contained in the <Canvas> DOM element or not.

    */
    fitsInCanvas: function(pos, canvas) {
        var size = canvas.getSize();
        if(pos.x >= size.width || pos.x < 0 
            || pos.y >= size.height || pos.y < 0) return false;
        return true;                    
    }
};

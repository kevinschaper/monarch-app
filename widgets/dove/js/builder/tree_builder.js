/* 
 * Package: tree_builder.js
 * 
 * Namespace: monarch.builder
 * 
 */

// Module and namespace checking.
if (typeof monarch == 'undefined') { var monarch = {};}
if (typeof monarch.builder == 'undefined') { monarch.builder = {};}

/*
 * Constructor: tree_builder
 * 
 * Parameters:
 *    solr_url - Base URL for Solr service
 *    scigraph_url - Base URL of SciGraph REST API
 *    golr_conf - Congifuration for golr_manager
 *    tree - monarch.model.tree object
 *  
 */
monarch.builder.tree_builder = function(solr_url, scigraph_url, golr_conf,  tree){
    var self = this;
    self.solr_url = solr_url;
    // Turn into official golr conf object
    self.golr_conf = new bbop.golr.conf(golr_conf);
    self.scigraph_url = scigraph_url;
    if (typeof tree === 'undefined') {
        self.tree = new monarch.model.tree();
    } else {
        self.tree = tree;
    }
};

/*
 * Function: getOntology
 * 
 * Parameters:
 *    id - string, root id as curie or url
 *    depth - string or int, how many levels to traverse
 *    
 * Returns:
 *    object, maybe should be monarch.model.tree?
 */
monarch.builder.tree_builder.prototype.getOntology = function(id, depth){
    var self = this;
    var tree = new monarch.model.tree();
    
    // var graph = new bbop.model.graph();
    
    // Some Hardcoded options for scigraph
    var direction = 'INCOMING';
    var relationship = 'subClassOf';
    
    var query = self.setGraphNeighborsUrl(id, depth, relationship, direction);
    
    jQuery.ajax({
        url: query,
        jsonp: "callback",
        dataType: "jsonp",
        error: function(){
          console.log('ERROR: looking at: ' + query);
        },
        success: function(data) {
           console.log(data);
        }
    });
    
    return;
};

/*
 * Function: getCountsForClass
 * 
 * Parameters:
 *    id -
 *    id_field -
 *    species -
 *    filters -
 *    
 * Returns:
 *    node object
 */
monarch.builder.tree_builder.prototype.setGolrManager = function(golr_manager, id, id_field, filter, personality){
    var self = this;
    
    golr_manager.reset_query_filters();
    golr_manager.add_query_filter(id_field, id, ['*']);
    golr_manager.set_results_count(0);
    golr_manager.lite(true);
    
    if (filter != null && filter.field && filter.value){
        golr_manager.add_query_filter(filter.field, filter.value, ['*']);
    }
    
    if (personality != null){
        golr_manager.set_personality(personality);
    }
    return golr_manager;
};

/*
 * Function: getCountsForClass
 * 
 * Parameters:
 *    id -
 *    id_field -
 *    species -
 *    filters -
 *    
 * Returns:
 *    JQuery Ajax Function
 */
monarch.builder.tree_builder.prototype.getCountsForSiblings = function(id_field, species, filter, personality){
    var self = this;
    var promises = [];
    
    var test_obj = [{'id':'HP:0000707'},{'id':'HP:0000924'}];
    
    var id_list = test_obj.map(function(i){return i.id;});
    
    id_list.forEach( function(i) {
        promises.push(self._getCountsForClass(i, id_field, species, filter, personality));
    });
    
    jQuery.when.apply(jQuery,promises).then(function(d,a) {
        console.log(d);
        console.log(a);
    });
    
};


/*
 * Function: getCountsForClass
 * 
 * Parameters:
 *    id -
 *    id_field -
 *    species -
 *    filters -
 *    
 * Returns:
 *    JQuery Ajax Function
 */
monarch.builder.tree_builder.prototype._getCountsForClass = function(id, id_field, species, filter, personality){
    var self = this;
    var node = {"id":id, "counts": []};
    
    var golr_manager = new bbop.golr.manager.jquery(self.solr_url, self.golr_conf);
    
    //First lets override the update function
    golr_manager.update = function(callback_type, rows, start){
        
        // Get "parents" url first.
        var parent_update = bbop.golr.manager.prototype.update;
        var qurl = parent_update.call(this, callback_type, rows, start);

        if( ! this.safety() ){
        
        // Setup JSONP for Solr and jQuery ajax-specific parameters.
        this.jq_vars['success'] = this._callback_type_decider; // decide & run
        this.jq_vars['error'] = this._run_error_callbacks; // run error cbs

        return this.JQ.ajax(qurl, this.jq_vars);
        }
    };
    
    golr_manager = self.setGolrManager(golr_manager, id, id_field, filter, personality);
    
    var makeDataNode = function(res){
        //console.log(res);
    }
    var register_id = 'data_counts_'+id;
    
    golr_manager.register('search', register_id, makeDataNode);
    return golr_manager.update('search');
    
};

/*
 * Function: addOntologyToTree
 * 
 * Parameters:
 *    ontology - object, ontology structured as monarch.model.tree
 *    tree - monarch.model.tree object, empty or containing data
 *    parents - parents of "root" if adding a branch to an existing ontology
 *    
 * Returns:
 *    monarch.model.tree
 */
monarch.builder.tree_builder.prototype.addOntologyToTree = function(ontology, tree, parents){
    var self = this;
    // Throw error is parents are defined and there is no root
    // Add root to tree if it doesn't exist 
};

/*
 * Function: setGraphNeighborsUrl
 * 
 * Construct SciGraph URL for Rest Server
 * 
 * Parameters:
 *    id - string, root id as curie or url
 *    depth - string or int, how many levels to traverse 
 *    relationship - string, relationship between terns, defaults as subClassOf
 *    direction - string, direction of relationship, INCOMING,
 *                        OUTGOING, or BOTH will work
 *                        
 * Returns: 
 *    string
 */
monarch.builder.tree_builder.prototype.setGraphNeighborsUrl = function(id, depth, relationship, direction){
    var self = this;
    if (typeof relationship === 'undefined') {
        relationship = "subClassOf";
    }
    if (typeof direction === 'undefined') {
        direction = 'INCOMING';
    }
    var url = self.scigraph_url + 'graph/neighbors/' + id + '.json?depth='
              + depth + '&blankNodes=false&relationshipType='
              + relationship + '&direction=' + direction + '&project=*';
    
    return url;
};

/*
 * Function: convertGraphToTree
 * 
 * Edit label to make more readable
 * 
 * Parameters:
 *    graph - bbop.model.graph
 *    root - root object
 *    
 * Returns:
 *    monarch.model.tree
 */
monarch.builder.tree_builder.prototype.convertGraphToTree = function(graph, root){
    var self = this;
    if (!graph._is_a === 'bbop.model.graph'){
        throw new Error ("Input is not a bbop.model.graph");
    }
    
    var tree = new monarch.model.tree();
    
};

/*
 * Function: processLabel
 * 
 * Edit label to make more readable
 * 
 * Parameters:
 *    label - string, label to be processed
 *    
 * Returns:
 *    string
 */
monarch.builder.tree_builder.prototype.processLabel = function(label){   
    label = label.replace(/Abnormality of (the )?/, '');
    label = label.replace(/abnormal(\(ly\))? /, '');
    label = label.replace(/ phenotype$/, '');
    
    label = label.replace(/\b[a-z]/g, function() {
        return arguments[0].toUpperCase()});
    
    return label;
};

// Hardcoded taxon map
monarch.builder.tree_builder.prototype.getTaxonMap = function(){
    return {
        "NCBITaxon:10090" : "Mouse",
        "NCBITaxon:9606" : "Human",
        "NCBITaxon:7955" : "Zebrafish"
    };
};



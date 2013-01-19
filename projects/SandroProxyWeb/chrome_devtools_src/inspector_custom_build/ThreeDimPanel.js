/*
 * Copyright (C) 2007, 2008 Apple Inc.  All rights reserved.
 * Copyright (C) 2008, 2009 Anthony Ricaud <rik@webkit.org>
 * Copyright (C) 2011 Google Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 * 1.  Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 * 2.  Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in the
 *     documentation and/or other materials provided with the distribution.
 * 3.  Neither the name of Apple Computer, Inc. ("Apple") nor the names of
 *     its contributors may be used to endorse or promote products derived
 *     from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY APPLE AND ITS CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL APPLE OR ITS CONTRIBUTORS BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
 
importScript("RequestView.js");
importScript("NetworkItemView.js");
importScript("RequestCookiesView.js");
importScript("RequestHeadersView.js");
importScript("RequestHTMLView.js");
importScript("RequestJSONView.js");
importScript("RequestPreviewView.js");
importScript("RequestResponseView.js");
importScript("RequestTimingView.js");
importScript("ResourceWebSocketFrameView.js");

importScript("three/three.js");
importScript("three/libs/tween.js");
importScript("three/controls/TrackballControls.js");
importScript("three/renderers/CSS3DRenderer.js");

// three data interaction
var _threeCamera, _threeeScene, _threeRenderer;
var _threeControls;
var _threeSelectedType = "Table";
var _threeAnimationTime = 2500;

var _threeObjects = [];
var _threeTargets = { table: [], sphere: [], helix: [], grid: [] };

var _threeCanUpdateSphere = true;
var _threeHaveUnplacedItems = false;

function _threeOnWindowResize(){
    _threeCamera.aspect = window.innerWidth / window.innerHeight;
    _threeCamera.updateProjectionMatrix();
    _threeRenderer.setSize( window.innerWidth, window.innerHeight );
}

function _threeAnimate(){
    requestAnimationFrame( _threeAnimate );
    TWEEN.update();
    _threeControls.update();
}

function _threeUpdateSphereComplete(){
    if (_threeHaveUnplacedItems){
        // TODO here we can start new transformation if type is still the same        
    }
    _threeCanUpdateSphere = true;
}

    
function _threeRender(){
    _threeRenderer.render(_threeScene, _threeCamera );
}

WebInspector.ThreeDimView = function(){

    WebInspector.View.call(this);
    this.registerRequiredCSS("three/threeDimView.css");
    this.registerRequiredCSS("networkLogView.css");
    
    // chrome data interaction
    this._allowRequestSelection = false;
    this._viewInitialised = false;
    this._requests = [];
    this._requestsById = {};
    this._requestsByURL = {};
    this._staleRequests = {};
    this._requestGridNodes = {};
    this._lastRequestGridNodeId = 0;
    this._mainRequestLoadTime = -1;
    this._mainRequestDOMContentTime = -1;
    this._hiddenCategories = {};
    this._matchedRequests = [];
    this._highlightedSubstringChanges = [];
    this._filteredOutRequests = new Map();
    
    this._matchedRequestsMap = {};
    this._currentMatchedRequestIndex = -1;



    WebInspector.networkManager.addEventListener(WebInspector.NetworkManager.EventTypes.RequestFinished, this._onRequestUpdated, this);

    WebInspector.networkLog.requests.forEach(this._addRequest.bind(this));
    this._initializeView();
    this._viewInitialised = true;

}

WebInspector.ThreeDimView.prototype = {
    
    _createNetworkItemView: function(){
        this._networkItemElement = document.createElement("div");
        this.element.appendChild(this._networkItemElement);
    },
    
    _createThreeView: function(){
        this._threeViewElement = document.createElement("div");
        this.element.appendChild(this._threeViewElement);
    }, 
    
    _initializeView: function()
    {
        this.element.id = "threeDim-container";
        this._createThreeTypeBarItems();
        this._createThreeView();
        this._createNetworkItemView();
        // this._popoverHelper = new WebInspector.PopoverHelper(this.element, this._getPopoverAnchor.bind(this), this._showPopover.bind(this));
        // Enable faster hint.
        // this._popoverHelper.setTimeout(1000);

        this._threeInit();
        _threeAnimate();
    },
    
    _getPopoverAnchor: function(element)
    {
        var anchor = element.enclosingNodeOrSelfWithClass("request");
        if (anchor)
            return anchor;
        anchor = element.enclosingNodeOrSelfWithClass("network-script-initiated");
        if (anchor && anchor.request && anchor.request.initiator)
            return anchor;

        return null;
    },
    
        /**
     * @param {Element} anchor
     * @param {WebInspector.Popover} popover
     */
    _showPopover: function(anchor, popover)
    {
        var content;
        if (anchor.hasStyleClass("request")){
                // TODO content = this._generateScriptInitiatedPopoverContent(anchor.request);
        }else{
                // TODO content = WebInspector.RequestTimingView.createTimingTable(anchor.parentElement.request);
        }
        
        var view = new WebInspector.NetworkItemView(this._requests[0]);
        content = view;
        popover.show(content, anchor.element, 400, 400);
    },
    
    _threeCreateHtmlElement: function(request, pos){
        
        var host = request._parsedURL.host;
        var mimeType = request._mimeType;
        var requestId = request.requestId;
    
        var element = document.createElement( 'div' );
        element.id = pos;
        element.className = 'request';
        element.style.backgroundColor = 'rgba(0,127,127,' + ( Math.random() * 0.5 + 0.25 ) + ')';

        var number = document.createElement( 'div' );
        number.className = 'data';
        number.textContent = pos + 1;
        element.appendChild( number );

        var symbol = document.createElement( 'div' );
        symbol.className = 'content';
        
        if (request._type._title == "Image"){
            var previewImage = document.createElement("img");
            previewImage.className = "image-network-icon-preview";
            request.populateImageSource(previewImage);
            symbol.appendChild(previewImage);
        }else{
            symbol.textContent = host;    
        }
        element.appendChild( symbol );

        var details = document.createElement( 'div' );
        details.className = 'details';
        details.innerHTML = mimeType + '<br>' + requestId;
        element.appendChild( details );
        element.addEventListener("click", this._threeClickOnElement.bind(this), false);
        return element;
    },
    
    _threeAddNewObject: function(request, pos){
            
            var element = this._threeCreateHtmlElement(request, pos);
            
            var object = new THREE.CSS3DObject( element );
            object.position.x = Math.random() * 4000 - 2000;
            object.position.y = Math.random() * 4000 - 2000;
            object.position.z = Math.random() * 4000 - 2000;
            _threeScene.add( object );
            _threeObjects.push( object );
            
            // table
            var posX = Math.floor(pos/20);
            var posY = pos%20;

            var objectTable = new THREE.Object3D();
            objectTable.position.x = ( posX * 160 ) - 1540;
            objectTable.position.y = - ( posY * 200 ) + 1100;
            _threeTargets.table.push( objectTable );   
            
            
            // sphere
            var vector = new THREE.Vector3();
            _threeTargets.sphere = [];
            
            for ( var i = 0, l = _threeObjects.length; i < l; i ++ ) {
                var object = _threeObjects[ i ];
                var phi = Math.acos( -1 + ( 2 * i ) / l );
                var theta = Math.sqrt( l * Math.PI ) * phi;
                var object = new THREE.Object3D();
                object.position.x = 1000 * Math.cos( theta ) * Math.sin( phi );
                object.position.y = 1000 * Math.sin( theta ) * Math.sin( phi );
                object.position.z = 1000 * Math.cos( phi );
                vector.copy( object.position ).multiplyScalar( 2 );
                object.lookAt( vector );
                _threeTargets.sphere.push( object );
    
            }
            
            var vectorSphere = new THREE.Vector3();
            var l = pos + 1;
            var phi = Math.acos( -1 + ( 2 * pos ) / l );
            var theta = Math.sqrt( l * Math.PI ) * phi;
            var objectSphere = new THREE.Object3D();
            objectSphere.position.x = 1000 * Math.cos( theta ) * Math.sin( phi );
            objectSphere.position.y = 1000 * Math.sin( theta ) * Math.sin( phi );
            objectSphere.position.z = 1000 * Math.cos( phi );
            vectorSphere.copy( objectSphere.position ).multiplyScalar( 2 );
            object.lookAt( vectorSphere );
            _threeTargets.sphere.push( objectSphere );
            
            // helix
            var vectorHelix = new THREE.Vector3();
            var phi = pos * 0.175 + Math.PI;
            var objectHelix = new THREE.Object3D();
            objectHelix.position.x = 1100 * Math.sin( phi );
            objectHelix.position.y = - ( pos * 8 ) + 450;
            objectHelix.position.z = 1100 * Math.cos( phi );
            vectorHelix.copy( object.position );
            vectorHelix.x *= 2;
            vectorHelix.z *= 2;
            object.lookAt( vectorHelix );
            _threeTargets.helix.push( objectHelix );
            
            // grid 
            var objectGrid = new THREE.Object3D();
            objectGrid.position.x = ( ( pos % 5 ) * 400 ) - 800;
            objectGrid.position.y = ( - ( Math.floor( pos / 5 ) % 5 ) * 400 ) + 800;
            objectGrid.position.z = ( Math.floor( pos / 25 ) ) * 1000 - 2000;
            _threeTargets.grid.push( objectGrid );
            
    },
    
    _threeCreateObjects: function (){
        var j = 1;
        var k = 1;
        _threeTargets = { table: [], sphere: [], helix: [], grid: [] };

        for ( var i = 0; i < this._requests.length; i ++ ) {
            var request = this._requests[i];
            var element = this._threeCreateHtmlElement(request, i);
            
            var object = new THREE.CSS3DObject( element );
            object.position.x = Math.random() * 4000 - 2000;
            object.position.y = Math.random() * 4000 - 2000;
            object.position.z = Math.random() * 4000 - 2000;
            _threeScene.add( object );
            _threeObjects.push( object );
            
            // table setting
            k++;
            if (k >= 20){
                j++;
                k = 1;
            }
            var object = new THREE.Object3D();
            object.position.x = ( k * 160 ) - 1540;
            object.position.y = - ( j * 200 ) + 1100;
            _threeTargets.table.push( object );
        
        }        

        // sphere
        var vector = new THREE.Vector3();
        for ( var i = 0, l = _threeObjects.length; i < l; i ++ ) {
            var object = _threeObjects[ i ];
            var phi = Math.acos( -1 + ( 2 * i ) / l );
            var theta = Math.sqrt( l * Math.PI ) * phi;
            var object = new THREE.Object3D();
            object.position.x = 1000 * Math.cos( theta ) * Math.sin( phi );
            object.position.y = 1000 * Math.sin( theta ) * Math.sin( phi );
            object.position.z = 1000 * Math.cos( phi );
            vector.copy( object.position ).multiplyScalar( 2 );
            object.lookAt( vector );
            _threeTargets.sphere.push( object );

        }

        // helix
        var vector = new THREE.Vector3();
        for ( var i = 0, l = _threeObjects.length; i < l; i ++ ) {
            var object = _threeObjects[ i ];
            var phi = i * 0.175 + Math.PI;
            var object = new THREE.Object3D();
            object.position.x = 1100 * Math.sin( phi );
            object.position.y = - ( i * 8 ) + 450;
            object.position.z = 1100 * Math.cos( phi );
            vector.copy( object.position );
            vector.x *= 2;
            vector.z *= 2;
            object.lookAt( vector );
            _threeTargets.helix.push( object );
        }

        // grid
        for ( var i = 0; i < _threeObjects.length; i ++ ) {
            var object = _threeObjects[ i ];
            var object = new THREE.Object3D();
            object.position.x = ( ( i % 5 ) * 400 ) - 800;
            object.position.y = ( - ( Math.floor( i / 5 ) % 5 ) * 400 ) + 800;
            object.position.z = ( Math.floor( i / 25 ) ) * 1000 - 2000;
            _threeTargets.grid.push( object );
        }
    },
    
    _threeInit: function(){
        _threeCamera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 5000 );
        _threeCamera.position.z = 1800;

        _threeScene = new THREE.Scene();

        this._threeCreateObjects();
        
        _threeRenderer = new THREE.CSS3DRenderer();
        _threeRenderer.setSize( window.innerWidth, window.innerHeight );
        _threeRenderer.domElement.style.position = 'absolute';
        this._threeViewElement.appendChild( _threeRenderer.domElement );
        _threeControls = new THREE.TrackballControls( _threeCamera, _threeRenderer.domElement );
        _threeControls.rotateSpeed = 0.5;
        _threeControls.addEventListener( 'change', _threeRender );
        this._activateThreeTransformAll();
        window.addEventListener( 'resize', _threeOnWindowResize, false );
    },

    _createThreeTypeBarItems: function(){
        var threeTypeBarElement = document.createElement("div");
        threeTypeBarElement.className = "scope-bar status-bar-item";

        /**
         * @param {string} typeName
         * @param {string} label
         */
        function createThreeTypeElement(typeName, label)
        {
            var threeTypeElement = document.createElement("li");
            threeTypeElement.typeName = typeName;
            threeTypeElement.className = typeName;
            threeTypeElement.appendChild(document.createTextNode(label));
            threeTypeElement.addEventListener("click", this._updateThreeVievTypeByClick.bind(this), false);
            threeTypeBarElement.appendChild(threeTypeElement);

            return threeTypeElement;
        }
        
        var threeTypes = ["Table", "Sphere", "Helix", "Grid"];
        for (var typeId in threeTypes) {
            var typeName = threeTypes[typeId];
            createThreeTypeElement.call(this, typeName, typeName);
        }
        
        var dividerElement = document.createElement("div");
        dividerElement.addStyleClass("scope-bar-divider");
        threeTypeBarElement.appendChild(dividerElement);
        
        this._threeTypeBarElement = threeTypeBarElement;
    },
    
    _updateThreeVievTypeByClick: function(e)
    {
        _threeSelectedType = e.target.typeName;
        function unselectAll()
        {
            for (var i = 0; i < this._threeTypeBarElement.childNodes.length; ++i) {
                var child = this._threeTypeBarElement.childNodes[i];
                if (!child.typeName)
                    continue;
                child.removeStyleClass("selected");
            }
        }
        unselectAll.call(this);
        e.target.addStyleClass("selected");
        this._activateThreeTransformAll();
    },
    
    _threeClickOnElement : function(e){
        element = e.currentTarget;
        this._showRequest(this._requests[element.id]);
    },
    
    _threeTransformAll: function(targets, duration, callbackOnEnd){
        for ( var i = 0; i < _threeObjects.length; i ++ ) {
            var object = _threeObjects[ i ];
            var target = targets[ i ];
            new TWEEN.Tween( object.position )
                .to( { x: target.position.x, y: target.position.y, z: target.position.z }, Math.random() * duration + duration )
                .easing( TWEEN.Easing.Exponential.InOut )
                .start();
            new TWEEN.Tween( object.rotation )
                .to( { x: target.rotation.x, y: target.rotation.y, z: target.rotation.z }, Math.random() * duration + duration )
                .easing( TWEEN.Easing.Exponential.InOut )
                .start();
        }
        var tween = new TWEEN.Tween( this )
                    .to( {}, duration * 2 )
                .onUpdate( _threeRender );
        if (callbackOnEnd){
            tween.onComplete( callbackOnEnd );            
        }
        tween.start();
    },
    
    _activateThreeTransformAll : function(){
        var selectedType = _threeSelectedType;
        var animationTime = _threeAnimationTime;
        if (selectedType == "Sphere"){
            TWEEN.removeAll();
            this._threeTransformAll( _threeTargets.sphere, animationTime );    
        }else if (selectedType == "Table"){
            TWEEN.removeAll();
            this._threeTransformAll( _threeTargets.table, animationTime );    
        }else if (selectedType == "Helix"){
            TWEEN.removeAll();
            this._threeTransformAll( _threeTargets.helix, animationTime );    
        }else if (selectedType == "Grid"){
            TWEEN.removeAll();    
            this._threeTransformAll( _threeTargets.grid, animationTime );    
        }
    },
    
    _threeTransformOne: function(targets, pos, duration, callbackOnEnd){
        var object = _threeObjects[ pos ];
        var target = targets[ pos ];
        new TWEEN.Tween( object.position )
            .to( { x: target.position.x, y: target.position.y, z: target.position.z }, Math.random() * duration + duration )
            .easing( TWEEN.Easing.Exponential.InOut )
            .start();
        new TWEEN.Tween( object.rotation )
            .to( { x: target.rotation.x, y: target.rotation.y, z: target.rotation.z }, Math.random() * duration + duration )
            .easing( TWEEN.Easing.Exponential.InOut )
            .start();
        var tween = new TWEEN.Tween( this )
                    .to( {}, duration * 2 )
                .onUpdate( _threeRender );
        if (callbackOnEnd){
            tween.onComplete( callbackOnEnd );            
        }
        tween.start();
    },
    
    _activateThreeTransformOne : function(pos){
        var selectedType = _threeSelectedType;
        var animationTime = _threeAnimationTime;
        if (selectedType == "Sphere"){
            // we activate all transform because on sphere all positions are changed
            // we also do this more quickly because every new item resets movements for previous elements
            if (_threeCanUpdateSphere){
                _threeCanUpdateSphere = false;
                _threeHaveUnplacedItems = false;
                this._threeTransformAll( _threeTargets.sphere, animationTime, _threeUpdateSphereComplete);        
            }else{
                // TODO how to handle last fetch to animate
                _threeHaveUnplacedItems = true;
            }
            
        }else if (selectedType == "Table"){
            this._threeTransformOne( _threeTargets.table, pos, animationTime );    
        }else if (selectedType == "Helix"){
            this._threeTransformOne( _threeTargets.helix, pos, animationTime );    
        }else if (selectedType == "Grid"){    
            this._threeTransformOne( _threeTargets.grid, pos, animationTime );    
        }
    },
    
    get statusBarItems()
    {
        return [ this._threeTypeBarElement];
    },

    _addRequest: function(event){
       var request = /** @type {WebInspector.NetworkRequest} */ (event); 
       this._requests.push(request);
    },
    
    /**
     * @param {WebInspector.Event} event
     */
    _onRequestUpdated: function(event)
    {
        var request = /** @type {WebInspector.NetworkRequest} */ (event.data);
        // this._refreshRequest(request);
        this._requests.push(request);
        if (this._viewInitialised && event.type == "RequestFinished"){
            this._threeAddNewObject(request, this._requests.length - 1 );
            this._activateThreeTransformOne( this._requests.length - 1 );
        }
    },
    
    _showRequest: function(request)
    {
        if (!request)
            return;

        var view = new WebInspector.NetworkItemView(request);
        
        // remove generated tabbed style and add custom one 
        view.element.removeStyleClass("tabbed-pane");
        view.element.addStyleClass("three-view-tabbed-pane");
        
        view.element.removeStyleClass("network-item-view");
        view.element.addStyleClass("three-network-item-view");

        if (this.visibleView) {
            this.visibleView.detach();
            delete this.visibleView;
        }
        view.show(this._networkItemElement);
        this.visibleView = view;
    },
    
    
    __proto__: WebInspector.View.prototype
}

/**
 * @constructor
 * @extends {WebInspector.Panel}
 * @implements {WebInspector.ContextMenu.Provider}
 */
WebInspector.ThreeDimPanel = function(){
    WebInspector.Panel.call(this, "threeDimPanel");
    this.registerRequiredCSS("networkPanel.css");
    this.registerRequiredCSS("three/threeDimPanel.css");
    this._threeDimView = new WebInspector.ThreeDimView();
    this.element.id = "threeDimPanel";
    this._threeDimView.show(this.element);
}

WebInspector.ThreeDimPanel.prototype = {
    get statusBarItems()
    {
        return this._threeDimView.statusBarItems;
    },
    __proto__: WebInspector.Panel.prototype
}

//@ sourceURL=http://192.168.1.135/devtools/ThreeDimPanel.js
//@ sourceURL=http://192.168.1.135/devtools/ThreeDimPanel.js
/** Provides the classes for implementing networking applications.
  *
  *
  *
  */
psns.net  = psns.net || (function() {

  return {
  
    /** Call any object in the namespace psns.
      * 
      * @request  a JSSP request object.
      * @response a JSSP response object.
      * @document a JSSP document object. */
    remoteCall: function (request, response, document) {
    
      try {
        var library   = request.getParameter("library");
        var object    = request.getParameter("object");
        var method    = request.getParameter("method");
        var callback  = request.getParameter("callback");
        
        if ( library == "" ) {
          logError("Missing parameter: library");
        }
        else if ( object == "" ) {
          logError("Missing parameter: object");
        }
              
        // load the library if necessary
        psns.require(library);
  
        var parent  = psns;
        var parts   = object.split(".");
        for (var i=1; i < parts.length; i++) {
        
          if ( typeof parent[parts[i]] === "undefined" ) {
            logError("Unable to find the object or namespace '" + parts[i] + "' in " + object);
          }
          
          parent = parent[parts[i]];
        }
  
        if ( parent.access != "public" ) {
          // this object is not public, it cannot 
          logError("Access denied to a non public object: " + object);
        }
        
        var res = parent[method].call(null, request.parameters);
        if ( typeof res === "object" ) {
          // convert the object to a string
          if ( !JSON ) {
            logLibrary("xtk:shared/json2.js");
          }
          
          res = JSON.stringify(res);
        }
        if ( callback ) {
          document.write(callback + "(" + ((res == undefined) ? "" : res)  + ")");
        }
        else if ( res != undefined ) {
          document.write(res);
        }
        else {
          document.write("{}");
        }
      }
      catch ( e ) {
        document.write(e);
        response.sendError(500);
      }
    }
  }

})();
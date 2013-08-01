"use strict";

var psns = psns || (function() {

  var _loadedModules = [];
  
  return {
  
    /** Load a module if required
      * 
      * @module name of the module to load.
      * @return the psns object. */
    require: function(module) {
    
      if ( !_loadedModules[module] ) {
        loadLibrary(module);
        this.registerModule(module);
      }
      
      return this;
    },
    
    /** Flag a module as loaded */
    registerModule: function(module) {
      _loadedModules[module] = true;
      psns.log("Module %1 loaded", module);
    },
    
    /** Debug logging information */
    debug: function(f, s) {
      logVerbose(psns.substituteString(f, s));
    },
    
    /** Informative logging information */
    log: function(f, s) {
      logInfo(psns.substituteString(f, s));
    },
    
    /** Output a warning information */
    warn: function(f, s) {
      logWarning(psns.substituteString(f, s));
    },
    
    /** Output a warning information */
    error: function(f, s) {
      logError(psns.substituteString(f, s));
    },
    
    /** Subtitute parameters in a string.
      * 
      * @see psns.string.substitute(). */
    substituteString: function(format, params) {
    
      if ( params === undefined ) {
        // nothing to substitute
        return format;
      } 
      else if ( typeof params !== "Array" ) {
        params = new Array(params.toString());
      }
  
      var arg, res = "";      
      var p, parts = format.split(/(%[%0-9]+)/g);
      
      for (var i=0; i < parts.length; i++) {
        p = parts[i];
        
        if ( p.charAt(0) === "%" ) {
        
          arg = parseFloat(p.substring(1));
          if ( arg > params.length ) {
            psns.log("out of range during substitution of the string '" + format + "' using '" + params + "'");
          }
          else {
            res += params[arg-1];
          }
        }
        else {
          res += p;
        }
      }
      
      return res;
    },
      
  }
  
})();

psns.Exception = function(message) {
  this.message = "";
}

psns.Exception.prototype.toString = function() {
  return this.message.toString();
}

psns.string = psns.string || (function() {

  return {
  
    /** Subtitute parameters in a string.
      * 
      * @format  the string to process including the place holders. Place holders 
      *          are %1, %2, ..., %n.
      * @params  an array containing the value to substitute to the place holders.
      *          if the format is referencing only one place holder, the params 
      *          parameter can be any object with a toString() method.
      * @example substitute("Hello %1", "World")=> "Hello World" */
    substitute: function(format, params) {
      return psns.substituteString(format, params);
    },

    /** Returns an integer converted from a string.
      * 
      * @numString a string to convert into a number.
      * @return    if numString cannot be successfully parsed into an integer, 
      *            NaN (not a number) is returned. */
    parseInt: function(numString) {
      return parseInt(numString, 10);
    },
    
    
    /** Right-aligns the characters in 'string' by padding on the left with a 
      * specified padding character for a specified total length.
      *
      * @string       string to pad.
      * @totalWidth   the number of characters in the resulting string.
      * @paddingChar  a padding character (optional, if empty this method will 
      *               use a space).
      * @return a new string that is equivalent to 'string', but right-aligned 
      *         and padded on the left with as many paddingChar characters as
      *         needed to create a length of totalWidth. */
    padLeft: function(string, totalWidth, paddingChar) {
      var padding = "";
      if ( paddingChar === undefined ) {
        paddingChar = " ";
      }
      for (var i=totalWidth-string.toString().length; i > 0; i--) {
        padding += paddingChar;
      }
      
      return padding + string;
    },
    
    /** Returns a boolean value indicating whether a string is empty.
      * 
      * @string the string to test.
      * @return true if the string is undefined, null or empty. */
    isEmpty: function(string) {
      return string === undefined || string === null || string === "";
    },
        
  }
})();

psns.date = psns.date || (function() {

  return {

    /** Parse a date in the format used by Neolane in XML documents
      *
      * @string a string in the following format 1971-12-30 22:46:04.000Z
      * @return a JAVASCRIPT date object */
    fromXtk: function(string) {
    
      var m = date.toString().split(/(\d{4})-(\d{2})-(\d{2})(\s?(\d{0,2}):(\d{0,2}):(\d{0,2}))?\.?(\d{3})?/);
      var date = new Date(m[1], this.parseInt(m[2])-1, m[3], this.nvl(m[5], 0), this.nvl(m[6], 0), this.nvl(m[7], 0), this.nvl(m[8], 0));
      if ( m[9] === "Z" ) {
        date.setTime(date.getTime() - date.getTimezoneOffset() * 60000);
      }
      
      return date;
    },
    
    /** Parse a date in the format used by Neolane in XML documents
      *
      * @date   a JAVASCRIPT date object.
      * @return a string in the Neolane XML format: 1971-12-30 22:46:04.000Z */
    toXtk: function(date) {
    
      return psns.string.padLeft(date.getUTCFullYear(), 4, "0") 
        + "-" + psns.string.padLeft(date.getUTCMonth() + 1, 2, "0")
        + "-" + psns.string.padLeft(date.getUTCDate(), 2, "0")
        + " " + psns.string.padLeft(date.getUTCHours(), 2, "0")
        + ":" + psns.string.padLeft(date.getUTCMinutes(), 2, "0")
        + ":" + psns.string.padLeft(date.getUTCSeconds(), 2, "0")
        + "." + psns.string.padLeft(date.getUTCMilliseconds(), 3, "0")
        + "Z";
        
    },
    
  }

})();

psns.number = psns.number || (function() {

  var supportedLocales = {
    "en-us": { decimal: ".", thousand: "," },
    "fr-fr": { decimal: ",", thousand: " " }
  };
  var locale      = supportedLocales["en-us"];
  var regInteger  = /(\d)(?=(\d\d\d)+(?!\d))/g;
  
  return {

    /** Format a number as a string
      *
      * @n       the number to format.
      * @options formating options. can be undefined or an object with the 
      *          values for the supported options:
      *          - decimals: number of decimals to display.
      *          - prefix:   a string to use to prefix the result.
      *          - suffix:   a string to append a the end of the result.
      * @example format(1236.3, {decimals: 2})) => 1,236.30 (with en-us locale) */
    format: function(n, options) {
    
      var s = String(n).split(".");
      var i = s[0].replace(regInteger, "$1" + locale.thousand);
      if ( options !== undefined ) {
        if ( options.decimals !== undefined ) {
          s[1] = s[1] || "";
          var d = s[1].substring(0, options.decimals);
          if ( d.length < options.decimals ) {
            d += "0000000000".substring(0, options.decimals-d.length);
          }
          
          var r = i+locale.decimal+d;
          if ( options.prefix != undefined ) {
            r = options.prefix + r;
          }
          if ( options.suffix != undefined ) {
            r = r + options.suffix;
          }

          return r;
        }
      }
      
      return i + locale.decimal + s[1];
    }
  }

})();

function namespace(vendor, ns) {

  var parent  = vendor;
  var parts   = ns.split(".");
  for (var i=1; i < parts.length; i++) {
    
    if ( typeof parent[parts[i]] === "undefined" ) {
      parent[parts[i]] = {};
    }
    
    parent = parent[parts[i]];
  }

}

/** Simulate Neolane functions for non-neolane environment */
if ( typeof logInfo === "undefined" ) {

  var logVerbose = function (text) {
    console.log(text);
  }
  var logInfo = function (text) {
    console.info(text);
  }
  var logWarning = function (text) {
    console.warn(text);
  }
  var logError = function (text) {
    throw (text);
  }
}
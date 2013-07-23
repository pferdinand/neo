/** Miscellaneous Functions
  *
  *
  *
  */
psns.misc  = psns.misc || (function() {

  return {
  
    /** Returns a non-null value from two expressions.
      * 
      * @value1   the value to test.
      * @value2   the value to substitute if the first parameter is null.
      * @return   the first non null value.
      * @remarks  If value1 is an array, value 2 is ignored and nvl() returns
      *           the first non null value in the array. 
      *           This function assume a value as null if null, undefined or
      *           is an empty string */
    nvl: function (value1, value2) {
    
      if ( value1 instanceof Array === true ) {
        for (var i=0; i < value1.length; i++) {
          if ( value1[i] !== null 
            && value1[i] !== undefined 
            && value1[i] !== "" ) {
              return value1[i];
            }
        }
      }
      else if ( value1 === null || value1 === undefined 
        || (typeof value1 === "string" && value1 === "") )
        return value2;
        
      return value1;
    },
    
    /** Converting an arbitrary string into a readable representation using 
      * the ASCII subset of letters, numbers and the underscore character.
      * 
      * foo bar   => fooBar     using camel notation
      * 2foobar   => _2fooBar   an identifier cannot start by a number
      * foo!$bar  => foo__Bar   
      * _foobar   => _fooBar
      * 
      * @string    the string to convert. 
      * @camelCase if true use the space as a word separator and use the 
      *            camelCase. false or undefined replace the space by _ */
    toIdentifier: function(string, camelCase) {
      var regWord    = /[a-z0-9_]/i;
      var identifier = "";
      var parts = string.split(/([a-z0-9_]*)/);
      for (var i=0; i < parts.length; i++) {
      
        if ( parts[i] !== "" ) {
          if ( !regWord.test(parts[i]) ) {
            // not a valid part for an identifier
            if ( !(camelCase && parts[i] === " ") ) {
              // single space are ignored in camelCase, other sequences are replaced by _
              identifier += parts[i].replace(/[^a-z0-9_]/g, "_");
            }
          }
          else if ( i === 1 && /\d/.test(parts[i].charAt(0)) ) {
            // the first character of the identifier cannot be a number
            // adding a understore prefix to the identifier
            identifier += "_" + parts[i];
          }
          else if ( camelCase && i > 1 ) {
            // using camel case syntax
            identifier += parts[i].charAt(0).toUpperCase() + parts[i].substring(1);
          }
          else {
            identifier += parts[i];
          }
        }
      }
      
      return identifier;
    },

    /** Escape a string for a safe usage in a XtkQueryDef.
      * 
      * @string the string to escape. 
      * @return the string escaped and enclosed by single quotes. */
    escapeXtk: function(string) {
      if ( psns.string.isEmpty(string) ) {
        return "''";
      }
    
      return "'" + string.toString().replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
    },
    
    /** Escape a string for a safe usage in an SQL statement 
      * 
      * @string the string to escape. 
      * @return the string escaped and enclosed by single quotes. */
    escapeSql: function(string) {
      if ( psns.string.isEmpty(string) ) {
        return "''";
      }
      // escape '\' first, then double quotes
      return "'" + string.toString().replace(/\\/g, "\\\\").replace(/'/g, "''") + "'";
    },
    
    /** Convert XML reserved characters (& < > ") to their associated entities.
      *
      * @string the string to escape. 
      * @return the string escaped. */
    escapeXml: function(string) { 
      if ( psns.string.isEmpty(string) ) {
        return "";
      }

      return string.toString().replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/'/g, "&#39;");
    },
  
  }

})();
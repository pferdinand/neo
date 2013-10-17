/***************************************************************************
 * Delivery helper functions
 * 
 * 
 * 
 * Support only deivery objects and not the XML delivery
 **************************************************************************/
psns.delivery  = psns.delivery || (function() {

  var mapDataType = { 
    string:     { value: 6, name: 'stringValue' },
    long:       { value: 3, name: 'longValue' },
    double:     { value: 5, name: 'doubleValue' },
    timestamp:  { value: 7, name: 'timeStampValue' },
    memo:       { value: 12, name: 'memoValue' }
  };

  return {
  
    /** Add or set a SMTP header.
      * 
      * @delivery a delivery object (not XML).
      * @header   the header name
      * @value    the header value.
      * @return   the previous value of the header. */
    addSmtpHeader: function(delivery, header, value)  {
      var previousValue;
      var headers = delivery.mailParameters.headers;
      var regExp = new RegExp(header + ":(.*)$", "i");
      var match = headers.match(regExp);
      if ( match != null ) {
        // replace the existing header value
        headers = headers.replace(match[1], " " + value);
        previousValue = match[1];
      } 
      else {
        // add a new header
        if ( header.length > 0 && header[header.length-1] != '\n') {
          headers += '\n';
        }
        headers += header + ": " + value;
      }
    
      delivery.mailParameters.headers = headers;
      return previousValue;
    },
    
    /** Add or set a variable.
      * 
      * @delivery a delivery object (not XML).
      * @name     variable name.
      * @type     variable data type (see mapDataType above).
      * @value    variable value.
      * @return   the previous value of the variable. */
    addVariable: function(delivery, name, type, value) {
    
      // check the datatype
      var typeInfo = mapDataType[type];
      if ( !typeInfo ) {
        psns.error("Invalid datatype '%1'", type);
      }

      // seach the variable
      for (var i=0; i < delivery.variables._var.length; i++) {
        var v = delivery.variables._var[i];
        if ( v.name === name ) {
          // existing variable
          var previousValue = v[typeInfo.name];
          v.dataType        = typeInfo.value;
          v[typeInfo.name]  = value;
          return previousValue;
        }
      }
      
      // variable not found, we are creating a new one
      var v = delivery.variables._var.add(<var name={name} dataType={typeInfo.value}/>);
      v[typeInfo.name]  = value;
      return undefined;
    }
  
  }

})();
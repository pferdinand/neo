/***************************************************************************
 * Delivery helper functions
 * 
 * 
 * 
 * Support only deivery objects and not the XML delivery
 **************************************************************************/
psns.delivery  = psns.delivery || (function() {

  return {
  
    /** Add or replace a SMTP header.
      * 
      * @delivery a delivery object.
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
    }
  
  }

})();
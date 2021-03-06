(function( apex, util, server, $ ){
  window.com_oracle_apex_timeline_status_list = function( regionId, details ) {

    var _region$ = $( "#" + regionId );

    function _clear() {
      _inner$.empty();
    }
    function _render( markup ) {
      _inner$.html( markup );
      _region$.trigger("apexafterrefresh");
    }
    function _debug( error ) {
            if ( error.status >= 200 && error.status < 300 ) {
                _render( error.responseText );
            } else {
                debugger;
            }
    }
    function _refresh() {
      server.plugin( details.ajaxIdentifier, { pageItems : details.pageItems }, {
        refreshObject : _region$,
        clear : _clear,
        success : _render,
        error : _debug,
        loadingIndicator : _inner$,
        loadingIndicatorPosition : "append"
      });
    }

    var _inner$ = $( "#" + details.innerRegionId );
    _region$.on( "apexrefresh", _refresh );
  }
})( apex, apex.util, apex.server, apex.jQuery );
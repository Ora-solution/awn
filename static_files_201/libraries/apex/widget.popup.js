/*!
 Popup - a jQuery UI based widget based on dialog
 Copyright (c) 2018, 2019, Oracle and/or its affiliates. All rights reserved.
 */
/*global apex*/
(function ( $ ) {
    "use strict";

    /*
     * A popup is a modal dialog without a title bar that closes when click/touch outside of it. It is also not
     * resizable or draggable
     */
    var C_TOP = "u-callout--top",
        C_BOTTOM = "u-callout--bottom",
        C_LEFT = "u-callout--left",
        C_RIGHT = "u-callout--right";

    $.widget( "apex.popup", $.ui.dialog, {
        version: "19.1",
        widgetEventPrefix: "popup",
        options: {
            parentElement: null,
            relativePosition: "below",
            callout: false,
            noOverlay: false
        },

        _create: function() {
            var o = this.options,
                self = this,
                dialog$ = this.element;

            // force some options
            o.resizable = false;
            o.draggable = false;
            o.modal = !o.noOverlay; // if noOverlay still behave modal but don't use an overlay

            this._super();

            this.calloutBefore = C_RIGHT;
            this.calloutAfter = C_LEFT;
            if ( dialog$.css( "direction" ) === "rtl" ) {
                this.calloutBefore = C_LEFT;
                this.calloutAfter = C_RIGHT;
            }

            // let the popup fit the content
            if ( o.width === "auto" ) {
                this.uiDialog.css( "display", "inline-block" ).hide();
            }

            this.uiDialog.addClass( "ui-dialog--popup" );
            this.uiDialog.children(".ui-dialog-titlebar" ).hide();

            this._setPosition();

            dialog$.on( "popupopen", function() {
                var bodies$;

                if ( o.noOverlay ) {
                    // Look for a mouse down to bubble up to the document body as reason to close popup.
                    // If there are iframes on the page such as a rich text editor or an APEX modal page
                    // the iframe traps the mouse down (and all events) so need a handler on all the iframe bodies.
                    // The alternative is to use _blockFrames but then we don't get the click through to whatever
                    // the mouse down was on.
                    bodies$ = $( document.body ).add( $("iframe").map(function() {
                        return this.contentDocument.documentElement;
                    } ) );
                    // popup likely opened from a click and don't want to act on that click so do after
                    setTimeout( function() {
                        bodies$.on( "mousedown.popupClose", function( event ) {
                            var target$ = $( event.target );
                            if ( target$.closest( dialog$ )[0] ) {
                                return; // ignore click inside popup
                            }
                            // if close by clicking outside don't steal focus away from what was clicked on
                            // would rather not set focus at all because this results in double focus events but dialog assumes there is always an opener
                            dialog$.data( "apex-popup" ).opener = target$; // use an internal property set the opener to what was clicked on
                            dialog$.popup( "close" );
                        } );
                    }, 1 );
                    // cleanup click to close handler
                    dialog$.one( "popupclose", function() {
                        bodies$.off( "mousedown.popupClose" );
                    } );
                } else {
                    // click outside dialog to close it
                    $( ".ui-widget-overlay" ).click( function () {
                        dialog$.popup( "close" );
                    } );
                }

                self._updateCallout();
            });
        },

        _destroy: function() {
            if ( this.callout$ ) {
                this.callout$.remove();
            }
        },

        _setPosition: function() {
            var calloutPos, of$, position,
                space = 0,
                o = this.options,
                dialog$ = this.element,
                relPos = o.relativePosition;

            if ( o.callout && o.parentElement ) {
                if ( !this.callout$ ) {
                    this.callout$ = $( "<div class='u-callout'></div>" );
                    dialog$.after( this.callout$ );
                }
                space = parseInt( dialog$.parent().css( "margin-top" ), 10 );
            } else {
                if ( this.callout$ ) {
                    this.callout$.remove();
                    this.callout$ = null;
                }
            }

            if ( o.parentElement ) {
                of$ = $( o.parentElement );

                // position the popup
                if ( relPos === "above" ) {
                    calloutPos = C_BOTTOM;
                    position = {
                        my: "left bottom",
                        at: "left top-" + space,
                        of: of$,
                        collision: "fit flipfit"
                    };
                } else if ( relPos === "below" ) {
                    calloutPos = C_TOP;
                    position = {
                        my: "left top",
                        at: "left bottom+" + space,
                        of: of$,
                        collision: "fit flipfit"
                    };
                } else if ( relPos === "before" ) { // left
                    calloutPos = C_RIGHT;
                    position = {
                        my: "right top",
                        at: "left-" + space + " top",
                        of: of$,
                        collision: "flipfit fit"
                    };
                } else if ( relPos === "after" ) { // right
                    calloutPos = C_LEFT;
                    position = {
                        my: "left top",
                        at: "right+" + space + " top",
                        of: of$,
                        collision: "flipfit fit"
                    };
                } else if ( relPos === "inside" ) {
                    calloutPos = C_TOP;
                    position = {
                        my: "left top",
                        at: "left+" + space + " top+" + space,
                        of: of$
                    };
                }
                if ( this.callout$ ) {
                    this.callout$.removeClass( C_TOP + " " + C_BOTTOM + " " + C_RIGHT + " " + C_LEFT )
                        .addClass( calloutPos );
                }
            } else {
                position = { my: "center", at: "center", of: window };
            }
            this.options.position = position;
        },

        _updateCallout: function() {
            var el$, h, calloutLeft, calloutTop, delta, popupOffset, elOffset, callout$;

            if ( !this.callout$ ) {
                return;
            } // else

            callout$ = this.callout$;
            popupOffset = this.element.offset();
            elOffset = $( this.options.parentElement ).offset();
            if (callout$.hasClass( C_TOP )) {
                if (popupOffset.top < elOffset.top) {
                    callout$.removeClass( C_TOP ).addClass( C_BOTTOM );
                }
            } else if (callout$.hasClass( C_BOTTOM )) {
                if (popupOffset.top > elOffset.top) {
                    callout$.removeClass( C_BOTTOM ).addClass( C_TOP );
                }
            } else if (callout$.hasClass( this.calloutAfter )) {
                if (popupOffset.left < elOffset.left) {
                    callout$.removeClass( this.calloutAfter ).addClass( this.calloutBefore );
                }
            } else if (callout$.hasClass( this.calloutBefore )) {
                if (popupOffset.left > elOffset.left) {
                    callout$.removeClass( this.calloutBefore ).addClass( this.calloutAfter );
                }
            }

            callout$.css("left", "");
            callout$.css("top", "");
            if (callout$.hasClass( C_TOP ) || callout$.hasClass( C_BOTTOM )) {
                calloutLeft = parseInt(callout$.css("left"), 10);
                // the popup and element should be left aligned but the fit logic can shift them so make sure the callout
                // points to the right place
                delta = elOffset.left - popupOffset.left;
                if ( delta > 0 ) {
                    callout$.css("left", delta + calloutLeft );
                }
            } else if (callout$.hasClass( C_LEFT ) || callout$.hasClass( C_RIGHT )) {
                calloutTop = parseInt(callout$.css("top"), 10);
                // the popup and element should be top aligned but the fit logic can shift them so make sure the callout
                // points to the right place
                delta = elOffset.top - popupOffset.top;
                if ( delta > 0 ) {
                    callout$.css("top", delta + calloutTop );
                }
            }
        },

        _setOption: function( key, value ) {
            var o = this.options;
            if ( key === "draggable" || key === "resizable" || key === "modal" ) {
                throw new Error( "Popup " + key + " cannot be set." );
            }
            this._super( key, value );
            if ( key === "parentElement" || key === "callout" || key === "relativePosition" ) {
                this._setPosition();
            }
        }
    } );

})( apex.jQuery );

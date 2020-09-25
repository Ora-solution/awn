/*!
 Copyright (c) 2019, 2020, Oracle and/or its affiliates. All rights reserved.
 */
/*global apex, $v*/
(function ( util, debug, lang, locale, $ ) {
    "use strict";

    var C_FS = "a-FS",
        C_FS_CURRENT = "a-FS-currentList",
        C_FS_CURRENT_NAME = C_FS_CURRENT + "--includeName",
        C_FC = "a-FS-control",
        C_FC_COLLAPSIBLE = "a-FS-control--collapsible",
        C_ITEM_GROUP = "apex-item-group",
        SEL_ITEM_GROUP = "." + C_ITEM_GROUP,
        C_ITEM_OPTION = "apex-item-option",
        SEL_ITEM_OPTION = "." + C_ITEM_OPTION,
        C_BADGE = "apex-item-option-badge",
        SEL_BADGE = "." + C_BADGE,
        C_FS_TOTAL_AREA = "a-FS-totalArea",
        C_FS_TOTAL = "a-FS-totalCount",
        C_DISABLED = "is-disabled",
        C_CHECKED = "is-checked",
        D_ORDER = "data-order",
        D_COUNT = "data-count",
        D_VALUE = "data-value",
        CUR_ITEMS_UL = "<ul class='a-FS-currentItems'></ul>",
        DIV_C = "</div>",
        SPAN_C = "</span>";

    var EVENT_FACETS_CHANGE = "change",
        STATE_KEY = "facetCollapsedState",
        VAL_SEP = ":",
        RANGE_SEP = "|";

    var KEYS = $.ui.keyCode,
        NUMBER_FORMAT = "FM999G999G999G999G999G999G999G999",
        facetsRegionCount = 0,
        gIgnoreCollapsible = false;

    /*
     * A key is a string, to reference a Facets Region-specific translatable system message
     */
    function getFRMessage( key ) {
        return lang.getMessage( "APEX.FS." + key );
    }

    /*
     todo
     issues:
      - if list facet has no available options should it be hidden completely; how can this happen? in this case don't tell server it is hidden
      - test use case where page is submitted rather than ajax to refresh report
     Future possibilities:
      - date type for ranges, input
      - selectRange filer control type: this is two select lists that define a range
      - nested lists
     */

    /*
     * A value is either a scalar string, a range object with properties b and e (for begin and end),
     * or an array of strings or range objects
     */
    function valueToString( value ) {
        if ( typeof value === "string" ) {
            return value;
        } // else
        return value.map( function( i ) {
            if ( i !== null && typeof i === "object" ) {
                return i.b + RANGE_SEP + i.e;
            } // else
            return i;
        } ).join( VAL_SEP );
    }

    function stringToValue( string ) {
        return string.split( VAL_SEP ).map( function( i ) {
            var r;
            r = ( i + "" ).split( RANGE_SEP );
            if ( r.length === 2 ) {
                return { b: r[0], e: r[1] };
            } // else
            return i;
        } );
    }

    function getFacetItemValue( control ) {
        return $( "#" + util.escapeCSS( control.name ) ).val();
    }

    function setItem( name, value ) {
        $( "#" + util.escapeCSS( name ) ).val( value ).trigger( "change", [{internal: true}] );
    }

    function setFacetItemValue( control, valueString ) {
        setItem( control.name, valueString );
    }

    function getControlIndex( controls, name ) {
        var i;

        for ( i = 0; i < controls.length; i++ ) {
            if ( controls[i].name === name ) {
                return i;
            }
        }
        return -1;
    }

    // the server gives the values in exactly the order it intends but there are some options that affect
    // the order shown in the UI. Record the initial order
    function setValuesOrder( control ) {
        var i, items, item;

        // todo think this is facet control specific
        if ( control.values && ( control.checkedFirst || control.disabledLast || control.orderByCount ) )  {
            items = control.values;
            for ( i = 0; i < items.length; i++ ) {
                item = items[i];
                item.order = i + 1;
            }
        }
    }

    function JSONArrayOrEmptyString( a ) {
        return a.length > 0 ? JSON.stringify( a ) : "";
    }

    function notVisible( el$, curFacets ) {
        return !el$.is( ":visible" ) && !( typeof curFacets === "string" && $( curFacets ).is( ":visible" ) );
    }

    function renderTotalCountArea( label ) {
        return "<div class='" + C_FS_TOTAL_AREA + "'><span class='a-FS-totalLabel'>" +
            util.escapeHTML( label ) + "</span> <span class='" + C_FS_TOTAL + "'></span></div>";
    }

    $.widget( "apex.facets",{
        version: "19.2",
        widgetEventPrefix: "facets",
        options: {
            //regionStaticId: "",  // required
            //ajaxIdentifier: "",  // required
            /**
             * string one of "clear" or "reset"
             */
            initState: null,
            /**
             * Batch facet control changes or not.
             * When true, the facetsschange event is delayed until an "apply" button is pressed.
             * When false, the facetschange event is fired as soon as any facet control value changes.
             */
            batch: true,
            /**
             * Only applies if batch is true. If true no apply button is shown. Used when facets are in a dialog
             * or popup or otherwise have some other external way to apply the changes. See the region apply method.
             */
            externalApply: false,
            /**
             * If true the facet control values give feedback (counts) about how many resources match the facet value.
             * The feedback could be the actual, estimated count or simply none/some indication.
             * If false there is no feedback.
             * When feedback is true the facets widget can be said to be in faceted search mode and when false it is
             * in simple independent filter mode.
             */
            feedback: true,
            /**
             * true|false|string
             * If true a search field is included in the facets area.
             * If false there is no search field.
             * If a string it is the ID of a page item input field to use as the search field
             */
            searchField: false,
            /**
             * string
             * The id of a button that initiates the search. Only applies if searchField is a string page item id.
             */
            searchButton: null,
            /**
             * string
             * Name of the search item. Required if searchField is not false.
             */
            searchItem: null,
            /**
             * string | boolean
             * If a string: The selector of an element to render the list of current facet values in.
             * If true the list of current facets is added at the top of the facets region.
             * If false or not present there is no list of current facets.
             */
            currentFacets: true,
            /**
             * boolean
             * Include the facet label in current facets area
             */
            currentIncludeName: true,
            /**
             * string | boolean
             * If a string: It is a selector of an element to display the current total resources count in.
             * If true show the total count in the current facets area or if there is no current facets area show it
             *   where the current facets area would be if it were true.
             * If false don't show the total count.
             * This is forced to false if feedback is false.
             */
            showTotalCount: true,

            /**
             * string | boolean
             * Controls if and how numbers for facet value counts and total count are formatted.
             * If false the numbers are not formatted.
             * If true the numbers are formatted using compact format (with no fractional digits) for numbers greater
             * than or equal to the numberFormatThreshold and a default format model with group separators otherwise.
             * The numberFormatOptions are not used.
             * If a string: it is a database number format model or the keyword "compact".
             */
            numberFormat: true,
            /**
             * number
             * See numberFormat. Only applies if numberFormat is true. If null and numberFormat is true then
             * the default format model with group separators is used.
             */
            numberFormatThreshold: null,
            /**
             * object
             * Options to pass to the number formatting function. The available option properties depend on
             * the value of numberFormat.
             */
            numberFormatOptions: null,

            // todo consider collapse toggle position start/end?
            /**
             * boolean
             * Persist facet control collapsed state in browser session storage or not.
             */
            persistCollapsedState: true,

            // todo consider an autoCollapse option that allows at most one facet control to be expanded.
            /**
             * An array of facet controls objects:
             * name {string} The item/session state name
             * type {string} one of "list", "range", "rangeList", "starRating", "selectList",
             *               "checkbox", "input"
             * label {string} The label to show for the facet control
             * cssClasses {string} Additional classes to set on the facet control
             * collapsible {boolean}
             * initialCollapsed {boolean}
             * maxHeight {integer}
             * clearBtn {boolean} If true the control will have a clear button shown when it has a value.
             * hasFeedback {boolean} If true then this control expects to get feedback about how many matching resources are available
             *                       The default comes from widget option feedback.
             * batch {boolean} Do not set this control option. It is set to the value of the batch option.
             * visibleCondition {Object} A condition object as described by apex.util.checkCondition. This controls the visibility
             *     of the facet. When the condition is true the facet if visible. When not visible the facet will have no value.
             * List specific options (list, rangeList)
             *   escape {boolean} If false allows markup in the values display values. Otherwise markup is escaped.
             *   multiple {boolean} If true the user can select multiple values from the list. (checkboxes)
             *   showCounts {boolean} Default true. Only applicable if hasFeedback is true.
             *   hideEmpty {boolean} if true values with 0 count are hidden if false values with 0 count are visually "disabled"
             *   lovDependsOn {string} Parent cascading LOV parent facet name. When the parent changes, new values are requested from the server.
             *   lovDependsOnRequired {boolean} If true the lovDependsOn parent must have a value for this facet to have any values.
             *       This only applies when lovDependsOn is specified.
             *   values {array} LOV array of objects with these properties
             *       r {string} return value
             *       d {string} display value
             *       l {string} optional display value without markup. Only needed when display value includes markup
             *                  if no l property and escape is false fall back to stripHTML on display value (d).
             *       i {string} icon
             *       g {string} group
             *   filterValues {boolean}
             *   listClasses {string} extra classes to add to the list grouping element
             *   showAllCount {integer} if the list contains more than this number of items a "show more/all" control is shown
             *   showAllGrace {integer} Default 1. If the number of items is withing this amount of the showAllCount
             *      don't bother with showAll behavior. Only applies if showAllCount is given.
             *      This solves the problem of clicking show more/all only to find for example 1 more item.
             *   orderByCount {boolean} if true the items are ordered by the count descending (after checked items if checkedFirst is true).
             *   checkedFirst {boolean} if true any selected items are shown first. Not supported if values are grouped.
             *   disabledLast {boolean} if true any disabled items are shown last. Only applies if hasFeedback is true.
             *                   Not applicable if hideEmpty is true. Not supported if values are grouped.
             *   hideRadioButton {boolean} Only applies when multiple is false. Uses bold label rather than radio button to indicate selected item
             *   noManualEntry (boolean) Only applies to rangeList. If true the manual range entry controls are not added.
             * Range specific options (range, rangeList unless noManualEntry is true)
             *   dataType {string} todo not yet implemented number assumed
             *   allowOpen {boolean} If true manual entry open ended ranges are allowed. Default false.
             *   prefixText {string}
             *   suffixText {string}
             *   rangeText {string}
             *   xxx start, end label?
             *   currentLabel {string} Label used for the current facets area. Example: "$%0 to $%1"
             *   currentLabelOpenHi {string} Label used for the current facets area. Example: "Over $%0"
             *   currentLabelOpenLow {string} Label used for the current facets area. Example: "Under $%0"
             *   When dataType is number:
             *   min {number} Minimum value user is allowed to enter
             *   max {number} Maximum value user is allowed to enter
             *   step {number} Number input step increment
             * Star Rating specific options
             *   values {array} same as for list. Icon and group should not be used. Label (l) is not needed.
             *   showCounts {boolean} Default true. Only applicable if hasFeedback is true.
             *   hideEmpty {boolean} if true values with 0 count are hidden if false values with 0 count are visually "disabled"
             *   hideRadioButton {boolean} Uses bold label rather than radio button to indicate selected item
             *   listClasses {string} extra classes to add to the list grouping element
             *   icon {string} CSS class to use for the "star" icon.
             *   inactiveIcon {string} CSS class to use for the placeholder icons. If not given icon is used. Only applies
             *       if inactiveColor is not null.
             *   color {string} "star" icon color. Defaults to "red".
             *   inactiveColor {string} Color of placeholder icon if any after the number of stars. If null there are no placeholders. Default null.
             *   suffixText {string} Text to show after the icons. Example " and up"
             *   maxSuffixText {string} Text to show after the icons for the largest value. Example "".
             *       If not specified the suffixText is used.
             *   itemLabel {string} Label used for accessibility and in the current facets area. Example: "%0 stars and up"
             *   maxItemLabel {string} Label used for largest value for accessibility and in the current facets area.
             *       Example: "%0 stars". If not specified the itemLabel is used.
             * Select List specific options
             *   lovDependsOn {string} Parent cascading LOV parent facet name. When the parent changes, new values are requested from the server.
             *   lovDependsOnRequired {boolean} If true the lovDependsOn parent must have a value for this facet to have any values.
             *       This only applies when lovDependsOn is specified.
             *   values {array} same as for list. Icon not currently supported.
             *   nullLabel {string} required.
             *   showCounts {boolean} Default true. Only applicable if hasFeedback is true.
             *   hideEmpty {boolean} if true values with 0 count are hidden if false values with 0 count are visually "disabled"
             * Checkbox specific options
             *   groupLabel {string} All adjacent checkbox controls are grouped under this label. Required.
             *   value {string} Control return value when checked
             *   icon {string} Icon CSS class
             *   escape {boolean} If false allows markup in the label. Otherwise markup is escaped.
             *   showCounts {boolean} Default true. Only applicable if hasFeedback is true.
             * Input specific options
             *   dataType {string} todo not yet implemented number assumed
             *   inputLabel {string} Label to show before the input.
             *   suffixText {string} Text to show after the input.
             *   currentLabel {string} Label used for the current facets area. Example: "Within %0 miles"
             *   When dataType is number:
             *   min {number} Minimum value user is allowed to enter
             *   max {number} Maximum value user is allowed to enter
             *   step {number} Number input step increment
             */
            controls: [],

            /**
             * Translatable strings
             * All required
             */
            text: {
                // searchLabel: "Search", // Only applies if searchField is true.
                // searchPlaceholder: "Search", // Only applies if searchField is true.
                // totalCountLabel: "Total Results", // Only applies if showTotalCount is true
            },
            //
            // events:
            //
            /**
             * Triggered when one or more facet control values have changed. It has no additional data.
             */
            change: null
        },
        _create: function () {
            var i, control, state,
                self = this,
                o = this.options,
                ctrl$ = this.element;

            debug.info( "Facets '" + ctrl$[0].id + "' created. Options: ", o );

            ctrl$.addClass( C_FS );

            this._super();

            if ( !o.feedback ) {
                // if there is no feedback then will never call the server to get counts so will never get the total count
                o.showTotalCount = false;
            }

            this.lockCount = 0;
            this.totalResourceCount = null;
            this.facetValueCounts = null;
            this.hiddenControls = [];

            this._on( this._eventHandlers );

            this.idPrefix = ctrl$[0].id || "afc_" + ( facetsRegionCount++ );
            this.searchId = null;
            this.searchButtonId = null;
            this.pendingChange = false;
            // used in batch mode so the apply button is only shown when the value has changed
            this.currentValues = {}; // map control.name => control value
            this.facetValuesNeeded = [];
            this.facetCountsNeeded = [];
            this.resourceRetryCount = 0;

            // Detect changes to facet items and reflect in facet control UI
            // There really should be at least one control and all controls have a hidden item input
            // all the facet items are together under one element
            if ( o.controls.length > 0 ) {
                this.itemsContainer$ = $( "#" + o.controls[0].name ).parent();
                this.itemsContainer$.on( "change.facets", function( event, data ) {
                    var target$;

                    if ( !data || !data.internal ) {
                        target$ = $( event.target );
                        if ( target$.prop( "id" ) === o.searchItem ) {
                            self._initSearch();
                            self._doSearch();
                        } else {
                            self._setFCValue( target$ );
                        }
                    }
                } );
            }
            this.currentFacetsArea$ = this.currentFacets$ = this.totalCount$ = null;

            for ( i = 0; i < o.controls.length; i++ ) {
                control = o.controls[i];
                if ( control.collapsible && control.initialCollapsed !== undefined ) {
                    control._origCollapsed = control.initialCollapsed;
                }
            }

            if ( o.persistCollapsedState ) {
                // fetch initial collapsible facet collapsed state from session storage
                this.sessionStore = apex.storage.getScopedSessionStorage( {
                    prefix: "facets",
                    usePageId: true,
                    regionId: o.regionStaticId
                } );
                this.facetCollapsedState = null;
                if ( o.initState !== "reset" ) {
                    try {
                        this.facetCollapsedState = JSON.parse( this.sessionStore.getItem( STATE_KEY ) );
                    } catch ( err ) {
                        debug.warn( "Failed to get facet collapsed state" );
                    }
                } else {
                    this.sessionStore.removeItem( STATE_KEY );
                }
                if ( !$.isPlainObject( this.facetCollapsedState ) ) {
                    this.facetCollapsedState = {};
                }
                for ( i = 0; i < o.controls.length; i++ ) {
                    control = o.controls[i];
                    state = this.facetCollapsedState[control.name];
                    if ( control.collapsible && ( state === 1 || state === 0 ) ) {
                        // override the initialCollapsed setting
                        control.initialCollapsed = state === 1 ? false : true;
                    }
                }
            }

            // Setup the handler for when visibility changes, in the case of a show we refresh or fetchCounts as needed.
            apex.widget.util.onVisibilityChange( ctrl$[0], function( pShow ) {
                if ( pShow ) {
                    if ( self.pendingRefresh ) {
                        self.refresh();
                        self.fetchCounts();
                    } else if ( self.pendingFetch ) {
                        self.fetchCounts();
                    }
                }
            });

            apex.region.create( o.regionStaticId, {
                type: "Facets",
                widgetName: "facets",
                // render the whole widget. Does not fetch new counts; see fetchCounts
                refresh: function() {
                    self.refresh();
                },
                focus: function() {
                    self.focus();
                },
                widget: function() {
                    return ctrl$;
                },
                reset: function() {
                    self.clearAll( true );
                    self._reset();
                },
                clear: function() {
                    self.clearAll( true );
                },
                /* region specific methods */
                // just fetch counts
                // this is useful if the report is filtered by something else and that external filter has changed
                // so need to get fresh counts
                fetchCounts: function() {
                    self.fetchCounts();
                },
                clearFacets: function() {
                    self.clearAll();
                },
                apply: function() {
                    self._apply();
                },
                lock: function() {
                    self._lock();
                },
                unlock: function() {
                    self._unlock();
                },
                getTotalResourceCount: function() {
                    return self.totalResourceCount;
                },
                getFacetCount: function() {
                    return self.facetCount();
                },
                getFacetValueCounts: function() {
                    return self.facetValueCounts;
                },
                showFacet: function( facetName ) {
                    self._toggleVisibility( facetName, true );
                },
                hideFacet: function( facetName ) {
                    self._toggleVisibility( facetName, false );
                }
            } );

            this.refresh();

            if ( o.disabled ) {
                this._setOption( "disabled", o.disabled );
            }
            this.fetchCounts();
        },

        _eventHandlers: {
            // todo think this is facet control specific
            "click .js-toggleOverflow": function( event ) {
                var button$ = $( event.target );

                this._updateShowAll( button$, true ); // toggle
            },
            // todo think this is facet control specific
            "filterablefilter": function( event ) {
                var button$ = $( event.target ).parent().find( ".js-toggleOverflow" );
                if ( button$.length ) {
                    this._updateShowAll( button$ );
                }
            },
            "click .js-clear": function( event ) {
                this._clear( this._getControl( $( event.target ) ) );
                this._changed();
            },
            "click .js-apply": function() {
                this._apply();
            },
            "keydown": function( event ) {
                var type, target$, next$,
                    o = this.options,
                    kc = event.which;

                // In batch mode want enter key to apply changes when focus in the body of the facet control
                if ( o.batch && !o.externalApply && kc === KEYS.ENTER ) {
                    type = event.target.type;
                    // todo think this is facet control specific
                    if ( type === "radio" || type === "checkbox" ) {
                        event.preventDefault();
                        this._apply();
                    }
                } else {
                    // when focus is in the facet control header up and down move to the prev/next facet control header
                    target$ = $( event.target ).closest( ".a-FS-header" );
                    if ( target$[0] ) {
                        if ( kc === KEYS.UP || kc === KEYS.DOWN ) {
                            next$ = target$.parent()[kc === KEYS.UP ? "prev" : "next"]()
                                .find( ".a-FS-header :tabbable" );
                            if ( next$[0] ) {
                                next$.focus();
                                event.preventDefault();
                            }
                        }
                    }
                }
            },
            "collapsibleexpand": function(event) {
                if ( !gIgnoreCollapsible && this.options.persistCollapsedState ) {
                    this._updateCollapsedState( this._getControl( $( event.target ) ), true );
                }
            },
            "collapsiblecollapse": function(event) {
                if ( !gIgnoreCollapsible && this.options.persistCollapsedState ) {
                    this._updateCollapsedState( this._getControl( $( event.target ) ), false );
                }
            }
        },

        _destroy: function() {
            var ctrl$ = this.element,
                o = this.options;

            this._cleanupHandlers();
            if ( this.itemsContainer$ ) {
                this.itemsContainer$.off( "change.facets" );
            }
            ctrl$.removeClass( C_FS + " " + C_DISABLED )
                .empty();
            if ( typeof o.currentFacets === "string" && this.currentFacetsArea$ ) {
                this.currentFacetsArea$.removeClass( C_FS_CURRENT + " " + C_FS_CURRENT_NAME + " " + C_DISABLED ).empty();
            }
            if ( typeof o.showTotalCount === "string" && this.totalCount$ ) {
                this.totalCount$.empty();
            }
        },

        _setOption: function ( key, value ) {
            var i, control,
                ctrl$ = this.element,
                o = this.options;

            if ( key === "feedback" || key === "currentFacets" || key === "showTotalCount" ) {
                throw new Error( "Facets " + key + " cannot be set" );
            }

            this._super( key, value );

            if ( key === "disabled" ) {
                ctrl$.toggleClass( C_DISABLED, value );
                if ( typeof o.currentFacets === "string" && this.currentFacetsArea$ ) {
                    this.currentFacetsArea$.toggleClass( C_DISABLED, value );
                }
            } else if ( key === "batch" ) {
                for ( i = 0; i < o.controls.length; i++ ) {
                    control = o.controls[i];
                    control.batch = o.batch;
                }
                this.refresh();
            }
        },

        _initFacetControls: function() {
            var i, control,
                o = this.options;

            // init facet control defaults
            this.facetControlItems = [];
            for ( i = 0; i < o.controls.length; i++ ) {
                control = o.controls[i];
                // check for unknown control type and remove so don't have to check again
                if ( !gControlTypes[control.type] ) {
                    debug.warn("Unknown control type removed:", control.type );
                    o.controls.splice( i,1 );
                    i -= 1;
                    continue;
                }

                setValuesOrder( control );

                if ( control.showAllCount !== undefined && control.showAllGrace === undefined ) {
                    control.showAllGrace = 1; // the default
                }
                if ( control.hasFeedback === undefined ) {
                    // Expect this to be all or nothing for region either all controls get feedback or none do
                    // but are there some non-list based controls for which no feedback is possible? Any other
                    // reason why this could vary per control?
                    // Need to push this down to the control level to make it easier access by the controls
                    control.hasFeedback = o.feedback;
                }
                if ( control.showCounts === undefined && control.hasFeedback ) {
                    control.showCounts = true;
                }
                // Push this down to the control level to make it possible to access by the controls
                control.batch = o.batch;
                this.facetControlItems.push( control.name );

                // cleanup watch handlers if any
                if ( control._watchId && control.visibleCondition ) {
                    util.unwatchCondition( control.visibleCondition, control._watchId );
                }
                // cleanup dependends on handlers if any
                if ( control.lovDependsOn ) {
                    $( "#" + util.escapeCSS( control.lovDependsOn ) ).off( "change.fsDependsOn" + i );
                }
            }
            if ( o.searchField !== false && o.searchItem ) {
                this.facetControlItems.push( o.searchItem );
            }

        },

        _makeSetValueFn: function() {
            var o = this.options,
                self = this;

            function setValue( control, value ) {
                var i, len, cIndex, controlImpl,
                    curValue =  self.currentValues[control.name];

                // convert to string
                value = valueToString( value );
                setFacetItemValue( control, value );
                // trigger change
                if ( o.batch ) {
                    if ( !o.externalApply ) {
                        // if don't have an external apply button show the one at the end of the facet control
                        controlImpl = gControlTypes[control.type];
                        cIndex = o.controls.indexOf( control );
                        if ( cIndex >= 0 ) {
                            self.element.find( "#" + self.idPrefix + "_" + cIndex )
                            // xxx curValue === value has an issue for checkbox controls
                                .closest( ".a-FS-control" )
                                .find( ".a-FS-apply" )[curValue === value ? "hide" : "show"]()
                                [0].scrollIntoView( false ); // xxx only want this if needed
                        }
                    }
                    // in batch mode still want to get any dependent (cascade) LOVs
                    len = self.facetValuesNeeded.length;
                    if ( len > 0 ) {
                        for ( i = 0; i < len; i++ ) {
                            self.facetCountsNeeded.push( self.facetValuesNeeded[i] );
                        }
                        self._delayFetchCountsFor();
                    }
                } else {
                    self.currentValues[control.name] = value;
                    self._changed();
                }
            }

            return setValue;
        },

        _initFilterable: function( controlEl$, control, fcIdPrefix ) {
            var input$ = $( "#" + fcIdPrefix + "_f" ),
                filterArea$ = controlEl$.closest( "." + C_FC ).find( ".a-FS-filter" );

            input$.val( "" ); // clear filter

            if ( control.showAllCount > 0 && controlEl$.find( SEL_ITEM_OPTION ).length < control.showAllCount ) {
                // for a small number of items hide the filters area.
                filterArea$.hide();
            } else {
                filterArea$.show();
                // todo think this is facet control specific
                controlEl$.find( SEL_ITEM_GROUP ).filterable( {
                    enhanced: true,
                    input: input$,
                    children: SEL_ITEM_OPTION
                } );
            }
        },

        refresh: function() {
            var i, control, controlImpl, controlEl$, curValue,
                self = this,
                setValue = this._makeSetValueFn(),
                ctrl$ = this.element,
                o = this.options;


            function watchVisible( control ) {
                var depControl,
                    cond = control.visibleCondition,
                    cIndex = getControlIndex( o.controls, cond.item ); // the control being watched

                if ( cIndex >= 0 ) {
                    depControl = o.controls[cIndex];
                }
                control._watchId = util.watchCondition( cond, {
                    doSubstitution: true,
                    multiValued: depControl && depControl.multiple
                }, function( visible ) {
                    self._toggleVisibility( control.name, visible, true );
                } );
            }

            function watchDepends( control, index, controlImpl, controlEl$ ) {
                var fcIdPrefix = self.idPrefix + "_" + index,
                    el$ = $( "#" + util.escapeCSS( control.lovDependsOn ) );

                el$.on( "change.fsDependsOn" + index, function() {
                    var value = el$.val();
                    if ( value === "" && control.lovDependsOnRequired ) {
                        // when the value is empty and the depends on is required we can assume there are no values and avoid asking the server
                        control.values = [];
                        // need to update because the values have changed
                        self._updateControlValues( control, controlImpl, controlEl$, fcIdPrefix, fcIdPrefix + "_lbl" );
                    } else {
                        // need to ask the server for the values in the next request.
                        self.facetValuesNeeded.push( control.name );
                    }
                }  );
            }

            if ( notVisible( this.element, o.currentFacets ) ) {
                this.pendingRefresh = true;
                return;
            } // else

            this.pendingRefresh = false;
            this._initFacetControls();
            this._cleanupHandlers();
            this._render();

            this.currentFacetsArea$ = null;
            if ( o.currentFacets ) {
                if ( o.currentFacets === true ) {
                    this.currentFacetsArea$ = ctrl$.find( "." + C_FS_CURRENT );
                } else {
                    this.currentFacetsArea$ = $( o.currentFacets ).first();
                    this.currentFacetsArea$.addClass( C_FS_CURRENT )
                        .toggleClass( C_FS_CURRENT_NAME, o.currentIncludeName ).html( CUR_ITEMS_UL );
                }
                this.currentFacets$ = this.currentFacetsArea$.children( "ul" ).first();
                if ( o.showTotalCount === true ) {
                    this.currentFacetsArea$.prepend( renderTotalCountArea( o.text.totalCountLabel ) );
                    this.totalCount$ = this.currentFacetsArea$.find( "." + C_FS_TOTAL );
                }

                // handle clearing
                this.currentFacetsArea$.on( "click.facets", "button", function( event ) {
                    var i, control, curValues, curValue,
                        target$ = $(event.target).closest( "button" ),
                        cIndex = target$.data( "fc" ),
                        value = target$.attr( D_VALUE ), // use attr because want value as a string always
                        begin = target$.attr( "data-begin" ),
                        end = target$.attr( "data-end" );

                    if ( cIndex >= 0 && value !== "" ) {
                        control = o.controls[cIndex];
                        curValues = stringToValue( getFacetItemValue( control ) );

                        // search for and remove the value to be cleared
                        for ( i = 0 ; i < curValues.length; i++ ) {
                            curValue = curValues[i];
                            if ( value === curValue || ( typeof curValue === "object" && begin === curValue.b && end === curValue.e ) ) {
                                curValues.splice( i, 1 );
                                break;
                            }
                        }
                        setFacetItemValue( control, valueToString( curValues ) );
                        self._setFCValueByIndex( cIndex, curValues );
                        self._changed();
                    } else {
                        self.clearAll();
                    }
                }  );
            }
            if ( typeof o.showTotalCount === "string" ) {
                this.totalCount$ = $( o.showTotalCount ).first();
            } else if ( o.currentFacets === false && o.showTotalCount === true ) { // explicit tests for false, true are necessary
                this.totalCount$ = ctrl$.find( "." + C_FS_TOTAL );
            }

            // initialize facet controls, collapsible behavior, and filterables.
            // todo want the header clickable. consider if should use toggle core
            gIgnoreCollapsible = true;
            ctrl$.find( "." + C_FC_COLLAPSIBLE ).each(function() {
                var c$ = $(this),
                    control = o.controls[c$.data( "fc" )];

                c$.collapsible( {
                    content: c$.find( ".a-FS-body" ),
                    controllingElement: c$.find( ".a-FS-toggle" ),
                    heading: ".a-FS-header",
                    collapsed: !!control.initialCollapsed
                } );
            } );
            gIgnoreCollapsible = false;
            for ( i = 0; i < o.controls.length; i++ ) {
                control = o.controls[i];
                curValue = getFacetItemValue( control );
                this.currentValues[control.name] = curValue;
                controlImpl = gControlTypes[control.type];
                controlEl$ = this._getControlElementByIndex( i );
                controlImpl.init( controlEl$, control, setValue );
                controlImpl.setValue( controlEl$, control, stringToValue( curValue ) );
                if ( control.filterValues ) {
                    this._initFilterable( controlEl$, control, this.idPrefix + "_" + i );
                }
                if ( control.visibleCondition ) {
                    watchVisible( control );
                }
                if ( control.values && control.lovDependsOn ) {
                    watchDepends( control, i, controlImpl, controlEl$ );
                    if ( control.values.length === 0 ) {
                        // a facet with no values should be hidden
                        this._toggleVisibility( control.name, false );
                    }
                }
            }

            if ( typeof o.searchField === "string" ) {
                this.searchId = "#" + util.escapeCSS( o.searchField );
                if ( o.searchButton ) {
                    this.searchButtonId = "#" + util.escapeCSS( o.searchButton );
                }
            }

            if ( this.searchId ) {
                $( this.searchId ).on( "keydown.facets", function( event ) {
                    if ( event.which === KEYS.ENTER ) {
                        event.preventDefault();
                        self._doSearch();
                    } else if ( event.which === KEYS.ESCAPE && $( self.searchId ).val().trim() !== "" ) {
                        event.preventDefault();
                        $( self.searchId ).val( "" ); // clear
                    }
                } );
            }
            if ( this.searchButtonId ) {
                $( this.searchButtonId ).on( "click.facets", function() {
                    self._doSearch();
                } );
            }

            this._initSearch();

            if ( this.facetValueCounts ) {
                // update with last available counts
                this._updateControls( {counts: this.facetValueCounts}, true );
            }
        },

        fetchCounts: function() {
            var o = this.options;

            if ( !o.disabled ) {
                if ( notVisible( this.element, o.currentFacets ) ) {
                    this.pendingFetch = true;
                } else {
                    this.pendingFetch = false;
                    this._fetchCounts();
                }
            }
        },

        facetCount: function() {
            var i, control,
                controls = this.options.controls,
                count = 0;

            for ( i = 0; i < controls.length; i++ ) {
                control = controls[i];
                if ( getFacetItemValue( control ) !== "" ) {
                    count += 1;
                }
            }
            return count;
        },

        focus: function() {
            // focus first tabbable in the search area or the first facet control body
            this.element.find( ".a-FS-search,.a-FS-body" )
                .filter( ":visible" ).first().find( ":tabbable" ).first().focus();
        },

        clearAll: function( includeSearch ) {
            var i, control,
                o = this.options;

            if ( includeSearch && this.searchId ) {
                $( this.searchId ).val( "" );
                setItem( o.searchItem, "" );
            }
            for ( i = 0; i < o.controls.length; i++ ) {
                control = o.controls[i];
                this._clear( control );
            }
            this._changed();
        },

        _getControlElementByIndex: function( index ) {
            var el$ = this.element.find( "#" + this.idPrefix + "_" + index );

            if ( el$.hasClass( "a-FS-header" ) ) {
                el$ = el$.next().find( ".a-FS-bodyInner" );
            }
            return el$;
        },

        _getControl: function( el$ ) {
            var index = el$.closest( ".a-FS-control" ).attr("data-fc");
            return this.options.controls[index];
        },

        _apply: function() {
            var i, control, value,
                changed = false,
                controls = this.options.controls;

            // after batch apply all the current values are updated
            for ( i = 0; i < controls.length; i++ ) {
                control = controls[i];
                value = getFacetItemValue( control );
                if ( this.currentValues[control.name] !== value ) {
                    changed = true;
                }
                this.currentValues[control.name] = value;
            }
            if ( changed ) {
                this._changed();
            }
        },

        _lock: function() {
            if ( this.lockCount === 0 ) {
                this._setOption( "disabled", true );
            }
            this.lockCount += 1;
        },

        _unlock: function() {
            if ( this.lockCount <= 0 ) {
                return; // don't unlock if not locked
            }
            this.lockCount -= 1;
            if ( this.lockCount <= 0) {
                this.lockCount = 0;
                this._setOption( "disabled", false );
                if ( this.pendingChange ) {
                    this.pendingChange = false;
                    this._changed();
                }
            }
        },

        // reset any saved state other than facet values
        _reset: function() {
            var controls = this.options.controls;

            this.element.find( "." + C_FC_COLLAPSIBLE ).each( function() {
                var c$ = $( this ),
                    control = controls[c$.data( "fc" )];

                c$.collapsible( !control._origCollapsed ? "expand" : "collapse" );
            } );
            this.sessionStore.removeItem( STATE_KEY );
        },

        _changed: function() {
            var self = this,
                o = this.options;

            if ( o.disabled || this.pendingRefresh || this.pendingFetch ) {
                this.pendingChange = true;
            } else {
                this._trigger( EVENT_FACETS_CHANGE, {} );
                // give reports a chance to be processed first
                setTimeout( function() {
                    self._fetchCounts();
                }, 200 );
            }
        },

        _fetchCounts: function() {
            if ( this.options.feedback ) {
                this._sendFetchCounts();
            } else {
                this._updateControls( {counts: {}}, true );
            }
        },

        /*
         * Clear the value of the given control.
         * Caller should call _changed.
         */
        _clear: function( control ) {
            var cIndex;

            setFacetItemValue( control, "" );
            cIndex = this.options.controls.indexOf( control );
            if ( cIndex >= 0 ) {
                this._setFCValueByIndex( cIndex, [] );
            }
        },

        /*
         * Set the value of the facet control from the given facet item input.
         */
        _setFCValue: function( input$ ) {
            var i, control,
                name = input$[0].id,
                value = stringToValue( input$.val() );

            i = getControlIndex( this.options.controls, name );
            if ( i >= 0 ) {
                this._setFCValueByIndex( i, value );
                this._changed();
            }
        },

        _setFCValueByIndex: function( index, value ) {
            var controlImpl, controlEl$,
                control = this.options.controls[index];

            this.currentValues[control.name] = valueToString( value );
            controlImpl = gControlTypes[control.type];
            controlEl$ = this._getControlElementByIndex( index );
            if ( controlEl$.length ) {
                controlImpl.setValue( controlEl$, control, value );
            }
        },

        _initSearch: function() {
            var el$ = $(),
                o = this.options;

            if ( o.searchField === true && o.searchItem ) {
                // initialize the internal search field
                el$ = $( "#" + this.idPrefix + "_search" );
            } else if ( o.searchField ) {
                el$ = $( this.searchId );
            }
            el$.val( $v( o.searchItem ) );
        },

        _cleanupHandlers: function() {
            if ( this.searchId ) {
                $( this.searchId ).off( ".facets" );
            }
            this.searchId = null;
            if ( this.searchButtonId ) {
                $( this.searchButtonId ).off( ".facets" );
            }
            this.searchButtonId = null;
            if ( this.currentFacetsArea$ ) {
                this.currentFacetsArea$.off( ".facets" );
            }
        },

        _updateShowAll: function( button$, toggle ) {
            var items$, showAllCount, count,
                listFooter$ = button$.parent(),
                el$ = listFooter$.parent(),
                expanded = listFooter$.attr( "data-expanded" ) === "true",
                control = this._getControl( button$ ),
                filter$ = listFooter$.closest( "." + C_FC ).find( ".a-FS-filter" ),
                isFiltered = ( filter$.find( "input" ).val() || "" ).length > 0;

            if ( isFiltered ) {
                // filtering has a negative impact on show more/show less so disable that when filtered
                listFooter$.hide();
            } else {
                listFooter$.show();
                if ( toggle ) {
                    expanded = !expanded;
                }

                // find the "visible" items in the list
                items$ = el$.find( SEL_ITEM_OPTION );
                if ( control.hideEmpty ) {
                    items$ = items$.not( "." + C_DISABLED );
                }
                showAllCount = items$.length + 1; // assume not doing showAll
                if ( control.showAllCount > 0 && items$.length > control.showAllCount + control.showAllGrace ) {
                    showAllCount = control.showAllCount;
                }

                count = 0;
                items$.each( function( i ) {
                    var item$ = $(this),
                        hide = !expanded && i >= showAllCount && !$( this ).hasClass( C_CHECKED ); // don't hide something that is checked
                    if ( !hide ) {
                        count += 1;
                    }
                    item$.toggleClass( "u-hidden", hide );
                });

                listFooter$.attr( "data-expanded", expanded ? "true" : "false" );
                button$.text( expanded ? getFRMessage( "SHOW_LESS" ) : getFRMessage( "SHOW_MORE" ) )
                    .prop( "disabled", !expanded && count >= items$.length );
                // Hide the button when there are too few items
                listFooter$.add( filter$ ).toggle( items$.length  > showAllCount );
            }
            if ( control.hasGroups ) {
                el$.find( ".apex-item-subgroup" ).each( function () {
                    var item$ = $( this );
                    item$.toggleClass( "u-hidden", item$.children( SEL_ITEM_OPTION ).not( ".u-hidden" ).length === 0 );
                } );
            }
        },

        _render: function() {
            var i, control, fcIdPrefix, labelId, controlImpl, cls, id, btn_id, filterLabel, lastGroup, group, label, hidden,
                ctrl$ = this.element,
                o = this.options,
                text = o.text,
                out = util.htmlBuilder();

            function closeFacetControl() {
                out.markup( DIV_C + DIV_C ); // close bodyInner and wrap
                if ( o.batch ) {
                    out.markup( "<div class='a-FS-apply' style='display:none;'><button class='a-Button a-Button--hot js-apply' type='button'>" )
                        .content( getFRMessage( "BATCH_APPLY" ) )
                        .markup( "</button></div>" );
                }

                out.markup( DIV_C + DIV_C ); // close body and facet control
            }

            if ( o.searchField === true ) {
                id = this.idPrefix + "_search";
                btn_id = id + "_btn";
                this.searchId = "#" + id;
                this.searchButtonId = "#" + btn_id;
                out.markup( "<div class='a-FS-search'><label" )
                    .attr( "for", id )
                    .markup( "class='u-vh'>" )
                    .content( text.searchLabel )
                    .markup( "</label><input class='text_field apex-item-text apex-item-has-icon' type='text' maxlength=500" )
                    .attr( "id", id )
                    .optionalAttr( "placeholder", text.searchPlaceholder )
                    .markup( "><span class='apex-item-icon fa fa-search' aria-hidden='true'></span>" +
                        "<button class='a-Button a-Button--noLabel a-Button--icon js-search' type='button'" )
                    .attr( "id", btn_id )
                    .markup( ">" )
                    .content( getFRMessage( "GO" ) )
                    .markup( "</button></div>" );
            }

            if ( o.currentFacets === true ) {
                out.markup( "<div class='" + C_FS_CURRENT + "'>" + CUR_ITEMS_UL + DIV_C );
            } else if ( o.currentFacets === false && o.showTotalCount === true ) { // explicit tests for false, true are necessary
                // include the current facets wrapping div for proper styling even though it is not a current facets area
                out.markup( "<div class='" + C_FS_CURRENT + "'>" + renderTotalCountArea( o.text.totalCountLabel ) + DIV_C );
            }

            lastGroup = null;
            for (i = 0; i < o.controls.length; i++ ) {
                control = o.controls[i];
                fcIdPrefix = this.idPrefix + "_" + i;
                labelId = fcIdPrefix + "_lbl";
                hidden = this.hiddenControls.indexOf( control.name ) >= 0;

                label = control.label;
                group = control.groupLabel || null;
                if ( group ) {
                    label = group;
                }

                if ( group === null || group !== lastGroup ) {
                    if ( lastGroup ) {
                        renderCloseListGroup( out );
                        // close previous group first
                        closeFacetControl();
                    }
                    cls = C_FC;
                    if ( control.cssClasses ) {
                        cls += " " + control.cssClasses;
                    }
                    if ( control.collapsible ) {
                        cls += " " + C_FC_COLLAPSIBLE;
                    }
                    out.markup( "<div" )
                        .attr( "class", cls )
                        .attr( "data-fc", i )
                        .optionalAttr( "style", hidden ? "display:none;" : "" )
                        .markup( "><h3 class='a-FS-header'" ) // todo dynamic heading level
                        .attr( "id", fcIdPrefix + ( group ? "_g" : "" ) )
                        .markup( ">" );
                    if ( control.collapsible ) {
                        out.markup( "<button class='a-FS-toggle' type='button'" )
                            .attr( "aria-labelledby", labelId )
                            .markup( "></button>" /* collapsible adds the icon */ );
                    }
                    out.markup( "<span class='a-FS-label'" )
                        .attr( "id", labelId )
                        .optionalAttr( "tabindex", control.collapsible ? null : "0" )
                        .markup( ">" )
                        .content( label )
                        .markup( SPAN_C );
                    if ( control.clearBtn ) {
                        out.markup( "<button class='a-FS-clearButton js-clear' type='button'>" )
                            .content( getFRMessage( "CLEAR" ) )
                            .markup( "</button>" );
                    }
                    out.markup( "</h3><div class='a-FS-body'" )
                        .attr( "id", fcIdPrefix + "_b" )
                        .markup( ">" );

                    if ( control.filterValues && control.values ) {
                        filterLabel = lang.formatMessage( "APEX.FS.FILTER", control.label );
                        id = fcIdPrefix + "_f";
                        out.markup( "<div class='a-FS-filter'><label" )
                            .attr( "for", id )
                            .markup( "class='u-vh'>" )
                            .content( filterLabel )
                            .markup( "</label><input class='text_field apex-item-text apex-item-has-icon' type='text' maxlength=500" )
                            .attr( "id", id )
                            .attr( "placeholder", filterLabel )
                            .markup( "><span class='apex-item-icon fa fa-search' aria-hidden='true'></span></div>" );
                    }

                    out.markup( "<div class='a-FS-wrap'" )
                        .optionalAttr( "style", control.maxHeight ? ("max-height:" + control.maxHeight + "px;") : null )
                        .markup( "><div class='a-FS-bodyInner'>" );

                    if ( group ) {
                        renderOpenListGroup( out, labelId, true, control );
                    }
                    // remember the group if any
                    lastGroup = group;
                }

                // type specific rendering
                controlImpl = gControlTypes[control.type];
                controlImpl.render( out, fcIdPrefix, labelId, control );

                if ( group === null || group !== lastGroup ) {
                    if ( lastGroup ) {
                        renderCloseListGroup( out );
                    }
                    closeFacetControl();
                }
            }
            if ( lastGroup ) {
                renderCloseListGroup( out );
                // close any pending group
                closeFacetControl();
            }
            ctrl$.html( out.toString() );
        },

        _sendFetchCounts: function() {
            var i, nIndex, name,
                hiddenList = [];

            // remove facets we are getting values for from hidden list. They may be hidden now but we expect they won't be and want counts
            for ( i = 0; i < this.hiddenControls.length; i++ ) {
                name = this.hiddenControls[i];
                nIndex = this.facetValuesNeeded.indexOf( name );
                if ( nIndex < 0 ) {
                    hiddenList.push( name );
                }
            }

            this._send( "FETCH_COUNTS", JSONArrayOrEmptyString( hiddenList ), true );
         },

        _sendFetchCountsFor: function() {
            this._send( "FETCH_COUNTS_FOR", JSONArrayOrEmptyString( this.facetCountsNeeded ), false );
        },

        _send: function(x1, x2, all) {
            var p,
                o = this.options,
                self = this;

            this._lock();
            p = apex.server.plugin( o.ajaxIdentifier, {
                pageItems: self.facetControlItems,
                x01: x1,
                x02: x2,
                x03: JSONArrayOrEmptyString( this.facetValuesNeeded )
            }, {
                dataType: "json",
                loadingIndicator: this.element,
                loadingIndicatorPosition: "centered",
                refreshObject: "#" + o.regionStaticId
            });
            this.facetValuesNeeded  = [];
            // in the all case when getting counts it will get counts for all facets so can remove the specific list that just need counts
            this.facetCountsNeeded = [];
            p.done( function( data ) {
                self._updateControls( data, all );
            } );
            p.always( function() {
                self._unlock();
            } );
        },

        _delayFetchCountsFor: function() {
            var self = this;

            if ( this.delayFetchTimer ) {
                clearTimeout( this.delayFetchTimer );
            }
            this.delayFetchTimer = setTimeout( function() {
                self.delayFetchTimer = null;
                if ( self.facetCountsNeeded.length > 0 ) {
                    self._sendFetchCountsFor();
                }
            }, 100 );
        },

        /*
         * Expects
         * {
         *     values: {} optional map control name => values array
         *     counts: {} optional map control name => map value ==> count
         *     totalCount: <number>
         * }
         */
        _updateControls: function( data, full ) {
            var i, j, control, controlImpl, controlEl$, fcCounts, fcIdPrefix, value, el$, values, label, accLabel, fcValues,
                self = this,
                counts = data.counts,
                lovValues = data.values,
                button$, lastGroup, group,
                fmt = this.options.numberFormat,
                fmtOpt = this.options.numberFormatOptions,
                threshold = this.options.numberFormatThreshold,
                ctrl$ = this.element,
                o = this.options,
                out = util.htmlBuilder(),
                count = 0;

            function format( number ) {
                var result;

                if ( fmt === true ) {
                    if ( threshold !== null && number >= threshold ) {
                        result = locale.formatCompactNumber( number, {maximumFractionDigits: 0} );
                    } else {
                        result = locale.formatNumber( number, NUMBER_FORMAT );
                    }
                } else if ( fmt === "compact" ) {
                    result = locale.formatCompactNumber( number, fmtOpt );
                } else if ( typeof fmt === "string" ) {
                    result = locale.formatNumber( number, fmt, fmtOpt );
                } else {
                    result = "" + number;
                }
                return result;
            }

            if ( full && ( fmt === "compact" || fmt === true ) &&
                        apex.locale.resourcesLoaded().state() !== "resolved" && this.resourceRetryCount < 10 ) {

                // polling because don't want to take a chance on waiting forever if something goes wrong
                this.resourceRetryCount += 1;
                setTimeout( function() {
                    self._updateControls( data, full );
                }, 500 );
                return;
            }

            if ( full ) {
                this.facetValueCounts = counts || null; // only do this if updating all facets
            } else if ( counts && this.facetValueCounts ) {
                // else merge in new counts
                $.extend( this.facetValueCounts, counts );
            }

            if ( o.batch && full ) {
                ctrl$.find( ".a-FS-apply" ).hide();
            }

            if ( data.totalCount !== undefined ) {
                this.totalResourceCount = data.totalCount;
            }

            lastGroup = null;
            for ( i = 0; i < o.controls.length; i++ ) {
                control = o.controls[i];
                fcIdPrefix = this.idPrefix + "_" + i;
                fcCounts = counts && counts[control.name];
                fcValues = lovValues && lovValues[control.name];
                controlImpl = gControlTypes[control.type];
                el$ = ctrl$.find( "#" + fcIdPrefix );
                controlEl$ = this._getControlElementByIndex( i );

                if ( fcValues ) {
                    control.values = fcValues;
                    this._updateControlValues( control, controlImpl, controlEl$, fcIdPrefix, fcIdPrefix + "_lbl" );
                }
                if ( controlImpl.update && fcCounts ) {
                    controlImpl.update( controlEl$, fcIdPrefix, control, fcCounts, format );
                }
                value = getFacetItemValue( control );
                el$.parent().toggleClass( 'has-value', value !== "" );

                // update current facets
                if ( full && o.currentFacets && value !== "" ) {
                    label = control.label;
                    group = control.groupLabel || null;
                    if ( group ) {
                        label = group;
                    }

                    values = stringToValue( value );
                    if ( group === null || group !== lastGroup ) {
                        if ( lastGroup ) {
                            // close previous group
                            out.markup( "</li>" );
                        }
                        out.markup( "<li class='a-FS-currentItem'>" );
                        if ( o.currentIncludeName ) {
                            out.markup( "<span class='a-FS-currentLabel'>" )
                                .content( label )
                                .markup( SPAN_C );
                        }
                        lastGroup = group;
                    }

                    for ( j = 0; j < values.length; j++ ) {
                        value = values[j];
                        label = value; // just in case
                        if ( controlImpl.getLabelForValue ) {
                            label = controlImpl.getLabelForValue( control, value );
                        }
                        accLabel = lang.formatMessage( "APEX.FS.CLEAR_VALUE", label );

                        // todo consider if the count is 0 for a value show the button in a gray state but not disabled
                        out.markup( "<button class='a-FS-clear' type='button'" )
                            .attr( "aria-label", accLabel )
                            .attr( "data-fc", i );
                        if ( typeof value === "object" ) {
                            out.attr( "data-begin", value.b );
                            out.attr( "data-end", value.e );
                        } else {
                            out.attr( D_VALUE, value );
                        }
                        out.markup( ">" )
                            .content( label )
                            .markup( "<span class='a-Icon icon-multi-remove'></span></button>" );
                        count += 1;
                    }
                    if ( group === null || group !== lastGroup ) {
                        out.markup( "</li>" );
                    }
                }
                // After update some options may be hidden so need to recalculate show-more
                button$ = el$.next().find( ".js-toggleOverflow" );
                if ( button$.length ) {
                    this._updateShowAll( button$ );
                }
            }
            if ( full ) {
                if ( lastGroup ) {
                    out.markup( "</li>" );
                }

                if ( o.currentFacets ) {
                    if ( count > 1 ) {
                        out.markup( "<li class='a-FS-currentItem a-FS-currentItem--all'><button class='a-FS-clearAll' type='button'>" )
                            .content( getFRMessage( "CLEAR_ALL" ) )
                            .markup( "</button></li>" );
                    }
                    if ( o.currentFacets === true ) {
                        this.currentFacetsArea$.toggle( count > 0 || o.showTotalCount === true );
                    }
                    // xxx ACC may need an accessible label for the whole list
                    this.currentFacets$.html( out.toString() );
                }
                if ( this.totalCount$ ) {
                    this.totalCount$.text( format( this.totalResourceCount ) );
                    ctrl$.add( this.currentFacetsArea$ || $() ).find( "." + C_FS_TOTAL_AREA ).toggle( this.totalResourceCount !== 0 );
                }
            }
        },

        _updateControlValues: function( control, controlImpl, controlEl$, fcIdPrefix, labelId ) {
            var i, j, found, changed, input$,
                out = util.htmlBuilder(),
                values = control.values,
                curValues = stringToValue( getFacetItemValue( control ) ),
                setValue = this._makeSetValueFn();

            setValuesOrder( control );

            // render with new values
            controlImpl.render( out, fcIdPrefix, labelId, control );
            controlEl$.html( out.toString() ); // this destroys all the handlers and filterable
            // remove values from curValue that no longer exist
            changed = false;
            for ( i = 0; i < curValues.length; i++ ) {
                found = false;
                for ( j = 0; j < values.length; j++ ) {
                    if ( curValues[i] === values[j].r ) {
                        found = true;
                        break;
                    }
                }
                if ( !found ) {
                    curValues.splice(i, 1);
                    i -= 1;
                    changed = true;
                }
            }
            if ( changed ) {
                setFacetItemValue( control, valueToString( curValues ) );
            }
            // init again
            controlImpl.init( controlEl$, control, setValue );
            controlImpl.setValue( controlEl$, control, curValues );
            if ( control.filterValues ) {
                this._initFilterable( controlEl$, control, fcIdPrefix );
            }
            // if was hidden !== is hidden i.e. a change in visibility
            if ( ( this.hiddenControls.indexOf( control.name ) >= 0 ) !== ( values.length === 0 ) ) {
                this._toggleVisibility( control.name, values.length > 0, false, true );
            }
        },

        _doSearch: function() {
            var searchTerm;
            if ( this.searchId ) {
                searchTerm = $( this.searchId ).val();
                setItem( this.options.searchItem, searchTerm );
                // trigger change
                this._changed();
            }
        },

        _toggleVisibility: function( facetName, visible, clear, noFetch ) {
            var i, hIndex, control, el$,
                controls = this.options.controls;

            i = getControlIndex( controls, facetName );
            if ( i >= 0 ) {
                control = controls[i];
                hIndex = this.hiddenControls.indexOf( facetName );
                if ( visible ) {
                    if ( hIndex >= 0 ) {
                        this.hiddenControls.splice( hIndex, 1 );
                        // if a facet becomes visible and it hasFeedback and xxx there were no facet value changes then need to just get counts
                        if ( control.hasFeedback && !noFetch ) {
                            this.facetCountsNeeded.push( facetName );
                            this._delayFetchCountsFor(); // batch it
                        }
                    }
                } else {
                    if ( hIndex < 0 ) {
                        this.hiddenControls.push( facetName );
                    }
                }
                el$ = this.element.find( "#" + this.idPrefix + "_" + i );
                if ( !control.groupLabel ) {
                    el$ = el$.closest( ".a-FS-control" );
                }
                el$.toggle(visible);
                if ( clear && !visible ) {
                    this._clear( control ); // xxx beware double filters change requests. debounce?
                }
            }

        },

        // must only be called if persistCollapsedState is true
        _updateCollapsedState: function( control, expanded ) {
            this.facetCollapsedState[control.name] = expanded ? 1 : 0;
            this.sessionStore.setItem( STATE_KEY, JSON.stringify( this.facetCollapsedState ) );
        }

    } );

    var gControlTypes = [];

    function addControlType( typeName, impl ) {
        gControlTypes[typeName] = impl;
    }

    /**
     * @ignore
     * @type {Function}
     */
    $.apex.facets.addControlType = addControlType;

    function renderOpenListGroup( out, labelId, multiple, control ) {
        var cls = C_ITEM_GROUP + " apex-item-group--rc ";

        if ( multiple ) {
            cls += " checkbox_group apex-item-checkbox";
        } else {
            cls += " radio_group apex-item-radio";
        }
        if ( control.listClasses ) {
            cls += " " + control.listClasses;
        }
        if ( control.hideRadioButton && !multiple ) {
            cls += " a-FS--hideRadio";
        }
        if ( control.hideEmpty ) {
            cls += " a-FS--hideEmpty";
        }
        out.markup( "<div tabindex='-1' role='group' aria-labelledby='" + labelId + "' )" )
            .attr( "class", cls )
            .markup( ">" );
    }

    function renderCloseListGroup( out ) {
        out.markup( DIV_C );
    }

    function renderCheckboxRadio( out, baseId, suffix, cls, item, escape, showCounts, multiple, facetId ) {
        var id = baseId + "_" + suffix;

        out.markup( "<div" )
            .optionalAttr( "id" , facetId ) // only when standalone like checkbox facet type
            .attr( "class", cls )
            .optionalAttr( D_ORDER, item.order )
            .markup( "><input" )
            .attr( "type", multiple ? "checkbox" : "radio" )
            .attr( "id", id )
            .optionalAttr( "name", !multiple ? ( baseId + "_r" ) : null )
            .attr( "value", item.r )
            .markup( "><label" )
            .attr( "for", id )
            .markup( ">" );
        // todo may want the icon at the start or end.
        if ( item.i ) {
            out.markup( "<span class='a-Icon ")
                .attr( item.i )
                .markup( "'></span>" );
        }
        out.markup( "<span class='label'>")
            [ escape ? "content" : "markup" ]( item.d )
            .markup( SPAN_C );
        if ( showCounts ) {
            out.markup( "<span class='" + C_BADGE + "'></span>" );
        }
        out.markup( "</label></div>" );
    }

    function renderList( out, baseId, labelId, control ) {
        var i, item, cls, groupCls, showAllCount,
            hasGroups = false,
            curGroup = null,
            multiple = control.multiple,
            values = control.values,
            escape = control.escape !== false;

        renderOpenListGroup(out, labelId, multiple, control);
        showAllCount = values.length + 1; // assume not doing showAll
        if ( control.showAllCount > 0 && values.length > control.showAllCount + control.showAllGrace ) {
            showAllCount = control.showAllCount;
        }
        for ( i = 0; i < values.length; i++ ) {
            item = values[i];

            cls = C_ITEM_OPTION;
            groupCls = "apex-item-subgroup";
            if ( i >= showAllCount ) {
                cls += " u-hidden";
                groupCls += " u-hidden";
            }
            if ( item.g && item.g !== curGroup ) {
                if ( curGroup ) {
                    out.markup( DIV_C );
                }
                curGroup = item.g;
                hasGroups = true;
                out.markup( "<div" )
                    .attr( "class", groupCls )
                    .markup( "><div class='apex-group-label'>" )
                    .content( item.g )
                    .markup( DIV_C );
            }

            renderCheckboxRadio( out, baseId, i, cls, item, escape, control.showCounts, multiple );
        }
        if ( curGroup ) {
            out.markup( DIV_C );
        }
        renderCloseListGroup( out );
        control.hasGroups = hasGroups;
        if ( hasGroups ) {
            if ( control.checkedFirst || control.disabledLast || control.orderByCount ) {
                debug.warn( "Facets list options orderByCount, checkedFirst and disabledLast ignored when list has groups" );
            }
            control.orderByCount = control.checkedFirst = control.disabledLast = false;
        }
        if ( i > showAllCount ) {
            // xxx acc should this use aria-expanded?
            out.markup( "<div class='a-FS-listFooter' data-expanded='false'><button class='a-FS-toggleOverflow js-toggleOverflow' type='button'>")
                .content( getFRMessage( "SHOW_MORE" ) )
                .markup( "</button></div>" );
        }
    }

    function addListValues( list$, isRange, values ) {
        var v, parts;

        list$.find( SEL_ITEM_OPTION ).removeClass( C_CHECKED );
        list$.find( ":checked" ).each( function () {
            v = this.value;
            $(this).parent().addClass( C_CHECKED );
            if ( isRange ) {
                parts = this.value.split( RANGE_SEP );
                if ( parts.length === 2 ) {
                    v = { b: parts[0], e: parts[1] };
                }
            }
            values.push( v );
        } );
    }

    function listChangeHandler( el$, control, setValue ) {
        var list$ = el$.find( SEL_ITEM_GROUP ),
            isRange = control.type === "rangeList";

        list$.on( "change", function() {
            var begin, end,
                values = [];

            addListValues( list$, isRange, values );
            delaySortList( el$, control );
            // if list is single selection and also has a range clear out the range when a list selection is made.
            if ( values.length > 0 && !control.multiple && isRange && !control.noManualEntry ) {
                setRangeValue( el$, control, [] );
            }
            if ( isRange && control.multiple && !control.noManualEntry ) {
                begin = el$.find( ".js-begin" ).val();
                end = el$.find( ".js-end" ).val();
                if ( rangeIsComplete( control, begin, end ) ) {
                    values.push( {b: begin, e: end} );
                }
            }
            setValue( control, values );
        } );
    }

    function updateList( el$, baseId, control, counts, format ) {
        var i, id, item, count, input$, item$, count$, disabled,
            values = control.values;

        for ( i = 0; i < values.length; i++ ) {
            item = values[i];
            id = baseId + "_" + i;
            count = counts[item.r] || 0;
            input$ = el$.find( "#" + id );
            item$ = input$.parent();
            count$ = item$.find( SEL_BADGE );
            disabled = control.hasFeedback && count === 0;

            // Make the option look disabled but don't actually disable the radio input so user can make another choice
            item$.toggleClass( C_DISABLED, disabled );
            if ( input$[0].type === "checkbox" ) {
                input$.attr( "disabled", disabled );
            }
            count$.attr( D_COUNT, count ).text( count === 0 ? "" : format( count ) );
        }
        sortList( el$, control );
    }

    function delaySortList( el$, control ) {
        if ( !control.hasFeedback ) {
            setTimeout( function() {
                sortList( el$, control );
            }, 350 );
        } // otherwise this will happen when update is called
    }

    function sortList( el$, control ) {
        var item, group$, sorted$,
            orderByCount = control.orderByCount,
            checkedFirst = control.checkedFirst,
            disabledLast = control.disabledLast;

        // The client handles sorting the list item UI for these two cases:
        // checkedFirst: move selected to top option. This happens when the list value changes
        // disabledLast: move disabled to end option. This happens when counts are updated
        // In both cases prefer to do just once after the counts are updated (see updateList)
        // but if not getting any feedback then disabled isn't possible so just update after the value changes
        // see delaySortList.
        if ( checkedFirst || disabledLast || orderByCount )  {
            // update sort order
            group$ = el$.find( SEL_ITEM_GROUP );
            sorted$ = group$.children().toArray().sort( function(a, b) {
                var ret = 0;

                //  C & !D = 1
                // !C & !D = 2
                //  C &  D = 3
                // !C &  D = 4
                function sortVal1( el ) {
                    return 2 + ( ( checkedFirst && $( el ).hasClass( C_CHECKED ) ) ? -1 : 0 ) +
                        ( ( disabledLast && $( el ).hasClass( C_DISABLED ) ) ? 2 : 0 );
                }

                function sortVal2( el ) {
                    return parseInt( $( el ).find( SEL_BADGE ).attr( D_COUNT ), 10 ) || 0;
                }

                function sortVal3( el ) {
                    return parseInt( $( el ).attr( D_ORDER ), 10 );
                }

                if ( checkedFirst || disabledLast ) {
                    ret = sortVal1( a ) - sortVal1( b );
                }
                if ( orderByCount && ret === 0 ) {
                    ret = sortVal2( b ) - sortVal2( a ); // desc
                }
                if ( ret === 0 ) {
                    ret = sortVal3( a ) - sortVal3( b );
                }
                return ret;
            } );
            group$.empty().append( sorted$ );
        }
    }

    function getLabelForListValue( control, value ) {
        var i, item,
            values = control.values;

        if ( typeof value === "object" ) {
            value = (value.b || "" ) + RANGE_SEP + (value.e || "");
        }
        for ( i = 0; i < values.length; i++ ) {
            item = values[i];
            if ( value === item.r ) {
                if ( !control.escape ) {
                    // display value can have markup
                    return item.l || util.stripHTML( item.d );
                } // else
                return item.l || item.d;
            }
        }
        return null;
    }

    function setListValue( el$, control, value ) {
        var i, v,
            notFound = [];

        el$.find( "input" ).prop( "checked", false ).parent().removeClass( C_CHECKED ); // clear all
        for ( i = 0; i < value.length; i++ ) {
            v = value[i];
            if ( typeof v === "object" ) {
                v = (v.b || "" ) + RANGE_SEP + (v.e || "");
            }
            // note this condition has a side effect of checking the input (if found)
            if ( !el$.find( "input[value='" + util.escapeCSS(v) + "']" )
                    .prop( "checked", true ).parent().addClass( C_CHECKED ).length ) {
                notFound.push(value[i]);
            }
        }
        delaySortList( el$, control );
        return notFound;
    }

    function renderGoButton( out, control ) {
        if ( !control.batch ) {
            out.markup( "<button class='a-Button js-ctrlApply' type='button' disabled>" )
                .content( getFRMessage( "GO" ) )
                .markup( "</button>" );
        }
    }

    function renderNumberInput( out, id, cls, control, label ) {
        out.markup( "<input class='apex-item-text u-textEnd " + cls + "' type='number' value=''" )
            .attr( "id", id )
            .optionalAttr( "min", control.min )
            .optionalAttr( "max", control.max )
            .optionalAttr( "step", control.step )
            .optionalAttr( "aria-label", label )
            .markup( ">" );
    }

    function renderRangeInput( out, id, start, control ) {
        if ( control.prefixText ) {
            out.markup( "<span class='a-FS-rangePrefix'>" )
                .content( control.prefixText )
                .markup( SPAN_C );
        }
        // xxx translation for 'from' and 'to' labels
        renderNumberInput( out, id, "js-" + (start ? "begin" : "end"), control, ( start ? "From" : "To" ) );
        if ( control.suffixText ) {
            out.markup( "<span class='a-FS-rangeSuffix'>" )
                .content( control.suffixText )
                .markup( SPAN_C );
        }
    }

    function renderRange( out, baseId, labelId, control ) {
        out.markup("<div class='a-FS-range'>");
        renderRangeInput( out, baseId + "_ib", true, control );
        out.markup("<span class='a-FS-rangeTo'>")
            .content( control.rangeText )
            .markup( SPAN_C );
        renderRangeInput( out, baseId + "_ie", false, control );
        renderGoButton( out, control );
        out.markup( DIV_C );
    }

    function rangeIsComplete( control, begin, end ) {
        return ( !control.allowOpen && begin !== "" && end !== "" ) || ( control.allowOpen && (  begin !== "" || end !== "" ) );
    }

    function rangeChangeHandler( el$, control, setValue ) {
        var begin$ = el$.find( ".js-begin" ),
            end$ = el$.find( ".js-end" );

        function set( complete, begin, end ) {
            var values = [];

            if ( control.multiple && control.values.length > 0 ) {
                addListValues( el$.find( SEL_ITEM_GROUP ), true, values );
                delaySortList( el$, control );
            }
            if ( complete ) {
                // xxx ignore validation errors? some ignores min > max but some switched them. Validate on client or server?
                // distinct value and display value for min, max?
                // xxx needs validation data type string, number, integer, date, absolute min and max,  and min < max
                values.push( {b: begin, e: end} );
            }
            setValue( control, values );
        }

        el$.find( ".a-FS-range" ).on( "keyup change", function ( event ) {
            var begin = begin$.val(),
                end = end$.val(),
                complete = rangeIsComplete( control, begin, end );

            // maybe something has changed check for both begin and end inputs having a value
            // if starting to enter a manual range and also have a radio group list of values
            if ( control.values && control.values.length > 0 && !control.multiple && ( begin !== "" || end !== "" ) ) {
                setListValue( el$, control, [] ); // clear any radio selection
            }

            if ( control.batch ) {
                set( complete, begin, end );
            } else {
                el$.find( ".js-ctrlApply" ).attr( "disabled", !complete );
            }
        } ).on( "keydown", "input", function( event ) {
            var begin = begin$.val(),
                end = end$.val(),
                complete = rangeIsComplete( control, begin, end );

            if ( event.which === KEYS.ENTER && complete ) {
                event.preventDefault();
                set( complete, begin, end );
            }
        } );
        el$.find( ".js-ctrlApply" ).on( "click", function () {
            var begin = begin$.val(),
                end = end$.val(),
                complete = rangeIsComplete( control, begin, end );

            set( complete, begin, end );
        } );
    }

    function getLabelForRangeValue( control, value ) {

        if ( value.b === "" ) {
            return lang.formatMessage( control.currentLabelOpenLow , value.e );
        } else if ( value.e === "" ) {
            return lang.formatMessage( control.currentLabelOpenHi , value.b );
        } // else
        return lang.formatMessage( control.currentLabel, value.b, value.e );
    }

    function setRangeValue( el$, control, value ) {
        var begin$ = el$.find( ".js-begin" ),
            end$ = el$.find( ".js-end" );

        if ( typeof value === "object" ) {
            begin$.val( value.b );
            end$.val( value.e );
        } else {
            begin$.val( "" );
            end$.val( "" );
        }
        el$.find( ".js-ctrlApply" ).attr( "disabled", !rangeIsComplete( control, begin$.val(), end$.val() ) );
    }

    //
    // List
    //
    addControlType( "list", {
        render: function( out, baseId, labelId, control ) {
            renderList( out, baseId, labelId, control );
        },
        init: function( el$, control, setValue ) {
            listChangeHandler( el$, control, setValue );
        },
        update: function( el$, baseId, control, counts, format ) {
            updateList( el$, baseId, control, counts, format );
        },
        getLabelForValue: function( control, value ) {
            return getLabelForListValue( control, value );
        },
        setValue: function( el$, control, value ) {
            setListValue( el$, control, value );
        }
    } );

    //
    // checkbox
    //
    addControlType( "checkbox", {
        render: function( out, baseId, labelId, control ) {
            renderCheckboxRadio( out, baseId, "cb", C_ITEM_OPTION, {
                    d: control.label,
                    r: control.value,
                    i: control.icon
                }, control.escape, control.showCounts, true, baseId );
        },
        init: function( el$, control, setValue ) {
            el$.on( "change", function() {
                var input$ = el$.find( "input" ),
                    value = "";

                if ( input$.prop( "checked" ) ) {
                    value = input$.val();
                }
                setValue( control, value );
            } );
        },
        update: function( el$, baseId, control, counts, format ) {
            var count = counts[control.value] || 0,
                input$ = el$.find( "input" ),
                count$ = el$.find( SEL_BADGE ),
                disabled = control.hasFeedback && count === 0;

            el$.toggleClass( C_DISABLED, disabled );
            input$.attr( "disabled", disabled );
            count$.text( count === 0 ? "" : format( count ) );
        },
        getLabelForValue: function( control, value ) {
            return control.label;
        },
        setValue: function( el$, control, value ) {
            var input$ = el$.find( "input" ),
                checked = input$.val() === value[0]; // value is an array even though this type only deals with single values

            el$.toggleClass( C_CHECKED, checked );
            input$.prop( "checked", checked );
        }
    } );

    //
    // Range List
    //
    addControlType( "rangeList", {
        render: function( out, baseId, labelId, control ) {
            renderList( out, baseId, labelId, control );
            if ( !control.noManualEntry ) {
                renderRange( out, baseId, labelId, control );
            }
        },
        init: function( el$, control, setValue ) {
            listChangeHandler( el$, control, setValue );
            if ( !control.noManualEntry ) {
                rangeChangeHandler( el$, control, setValue );
            }
        },
        update: function( el$, baseId, control, counts, format ) {
            updateList( el$, baseId, control, counts, format );
        },
        getLabelForValue: function( control, value ) {
            var label = getLabelForListValue( control, value );

            if ( label === null && !control.noManualEntry ) {
                label = getLabelForRangeValue( control, value );
            }
            return label;
        },
        setValue: function( el$, control, value ) {
            var extra = setListValue( el$, control, value );
            if ( !control.noManualEntry ) {
                if ( extra.length > 0 ) {
                    extra = extra[0];
                } else {
                    extra = "";
                }
                setRangeValue( el$, control, extra );
            }
        }
    } );

    //
    // Range
    //
    // todo future options based on data type; number, date, etc. and related options min, max, calendar display options etc.
    //    dates should use date picker
    addControlType( "range", {
        render: function( out, baseId, labelId, control ) {
            renderRange( out, baseId, labelId, control );
        },
        init: function( el$, control, setValue ) {
            rangeChangeHandler( el$, control, setValue );
        },
        // There are never any counts to show for a manual entry range
        // update: function( el$, baseId, control, counts, format )
        getLabelForValue: function( control, value ) {
            return getLabelForRangeValue( control, value );
        },
        setValue: function( el$, control, value ) {
            setRangeValue( el$, control, value );
        }
    } );

    //
    // Input
    //
    // todo future options based on data type; number, date, etc. and related options min, max, calendar display options etc.
    //    dates should use date picker
    //
    addControlType( "input", {
        render: function( out, baseId, labelId, control ) {
            var id = baseId + "_i";

            out.markup("<div class='a-FS-input'><div class='t-Form-labelContainer'><label class='t-Form-label'")
                .attr( "for", id )
                .markup( ">" )
                .content( control.inputLabel )
                .markup( "</label></div><div class='t-Form-inputContainer'><div class='t-Form-itemWrapper'>");
            renderNumberInput( out, id, "", control );
            if ( control.suffixText ) {
                out.markup( "<span class='a-FS-inputSuffix'>" )
                    .content( control.suffixText )
                    .markup( SPAN_C );
            }
            renderGoButton( out, control );
            out.markup( DIV_C + DIV_C + DIV_C );
        },
        init: function( el$, control, setValue ) {
            var input$ = el$.find( "input" );

            function set( value ) {
                // xxx validation?
                setValue( control, value );
            }

            el$.find( ".a-FS-input" ).on( "keyup change", function ( event ) {
                var value = input$.val(),
                    hasValue = value !== "";

                if ( control.batch ) {
                    set( value );
                } else {
                    el$.find( ".js-ctrlApply" ).attr( "disabled", !hasValue );
                }
            } ).on( "keydown", "input", function( event ) {
                var value = input$.val();
                if ( event.which === KEYS.ENTER && value !== "" ) {
                    event.preventDefault();
                    set( value );
                }
            } );
            el$.find( ".js-ctrlApply" ).on( "click", function () {
                set( input$.val() );
            } );
        },
        // There are never any counts to show for an input control
        // update: function( el$, baseId, control, counts, format )
        getLabelForValue: function( control, value ) {
            return lang.formatMessage( control.currentLabel , value );
        },
        setValue: function( el$, control, value ) {
            var input$ = el$.find( "input" );

            if ( $.isArray( value ) ) { // value could be an array but this control only deals with single values.
                value = value[0] || "";
            }
            input$.val( value );
            el$.find( ".js-ctrlApply" ).attr( "disabled", value === "" );
        }
    } );

    //
    // Star Rating
    //
    // This is similar to a list with multiple false but the matching is done with a relational operator such as >=.
    // The number of stars is determined by the number of values. The values must be sorted in the desired order.
    addControlType( "starRating", {
        render: function( out, baseId, labelId, control ) {
            var i, j, item, label, color, icon,
                numStars = control.values.length;

            control.multiple = false;
            control.escape = false;
            control.checkedFirst = control.disabledLast = false; // these make no sense for this control type
            if ( control.maxSuffixText === "" ) {
                control.maxSuffixText = " "; // so below defaulting works
            }
            if ( control.icon ) {
                // enhance the display labels
                for ( i = 0; i < numStars ; i++ ) {
                    item = control.values[i];
                    label = "<span class='star-rating-stars' aria-hidden='true'>";
                    color = control.color || "red";
                    icon = control.icon;
                    for ( j = 0; j < numStars; j++ ) {
                        if ( j >= item.r ) {
                            icon = control.inactiveIcon || icon;
                            if ( control.inactiveColor ) {
                                color = control.inactiveColor;
                            } else {
                                break;
                            }
                        }
                        label += "<span class='" +
                            util.escapeHTMLAttr( icon ) + "' style='color:" + util.escapeHTMLAttr( color ) + ";'></span>";
                    }
                    label += item.r < numStars ? ( control.suffixText || "" ) : ( control.maxSuffixText || control.suffixText || "" );
                    label += "</span><span class='u-vh'>" +
                        lang.formatMessage( item.r < numStars ? control.itemLabel : ( control.maxItemLabel || control.itemLabel ) , item.r ) +
                        SPAN_C;
                    item.d = label;
                }
            }
            renderList( out, baseId, labelId, control );
        },
        init: function( el$, control, setValue ) {
            listChangeHandler( el$, control, setValue );
        },
        update: function( el$, baseId, control, counts, format ) {
            updateList( el$, baseId, control, counts, format );
        },
        getLabelForValue: function( control, value ) {
            return lang.formatMessage( value < control.values.length ? control.itemLabel : ( control.maxItemLabel || control.itemLabel ), value );
        },
        setValue: function( el$, control, value ) {
            setListValue( el$, control, value );
        }
    } );

    //
    // Select List
    //
    // todo consider in the future replace with a JET selectOne element. Benefit is style and ability to have icons on the options.
    addControlType( "selectList", {
        render: function( out, baseId, labelId, control ) {
            var i, item, cls,
                curGroup = null,
                values = control.values;

            function option( d, v ) {
                out.markup( "<option" )
                    .attr( "value", v )
                    .markup( ">" )
                    .content( d )
                    .markup( "</option>" );
            }

            cls = "selectlist apex-item-select";
            if ( control.hideEmpty ) {
                cls += " a-FS--hideEmpty";
            }
            out.markup( "<div class='a-FS-selectListFilter'><select aria-labelledby='" + labelId + "'" )
                .attr( "class", cls ).markup( ">" );
            option( control.nullLabel, "" );
            for ( i = 0; i < values.length; i++ ) {
                item = values[i];
                if ( item.g && item.g !== curGroup ) {
                    if ( curGroup ) {
                        out.markup( "</optgroup>" );
                    }
                    curGroup = item.g;
                    out.markup( "<optgroup" )
                        .attr( "label", item.g )
                        .markup( ">" );
                }
                option( item.d, item.r );
            }
            if ( curGroup ) {
                out.markup( "</optgroup>" );
            }
            out.markup("</select></div>");
        },
        init: function( el$, control, setValue ) {
            var debouncedHandler = util.debounce( function() {
                setValue( control, [$(this).val()] );
            }, 400 );
            el$.find( ".apex-item-select" ).on( "change", debouncedHandler );
        },
        update: function( el$, baseId, control, counts, format ) {
            var i, item, count, option$, disabled,
                values = control.values;

            for ( i = 0; i < values.length; i++ ) {
                item = values[i];
                count = counts[item.r] || 0;
                option$ = el$.find( "option[value='" + util.escapeCSS( item.r )+ "']" );
                disabled = control.hasFeedback && count === 0;

                if ( control.showCounts ) {
                    option$.text( item.d + ( count > 0 ? " (" + count + ")" : "" ) );
                }
                // make the option look disabled but don't actually disable so the user can easily switch option
                option$.toggleClass( C_DISABLED, disabled );
            }
        },
        getLabelForValue: function( control, value ) {
            return getLabelForListValue( control, value );
        },
        setValue: function( el$, control, value ) {
            value = value.length > 0 ? value[0] : "";
            el$.find( ".apex-item-select" ).val( value );
        }
    } );

})( apex.util, apex.debug, apex.lang, apex.locale, apex.jQuery );

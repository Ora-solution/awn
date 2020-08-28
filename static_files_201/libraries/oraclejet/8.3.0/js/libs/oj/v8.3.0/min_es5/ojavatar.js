/**
 * @license
 * Copyright (c) 2014, 2020, Oracle and/or its affiliates.
 * The Universal Permissive License (UPL), Version 1.0
 * @ignore
 */
define(["ojs/ojcore","ojs/ojvcomponent","ojs/ojcomponentcore"],function(t,e){"use strict";function r(t){"@babel/helpers - typeof";return(r="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t})(t)}function n(t,e){for(var r=0;r<e.length;r++){var n=e[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(t,n.key,n)}}function o(t,e){return(o=Object.setPrototypeOf||function(t,e){return t.__proto__=e,t})(t,e)}function a(t){var e=function(){if("undefined"==typeof Reflect||!Reflect.construct)return!1;if(Reflect.construct.sham)return!1;if("function"==typeof Proxy)return!0;try{return Date.prototype.toString.call(Reflect.construct(Date,[],function(){})),!0}catch(t){return!1}}();return function(){var n,o=i(t);if(e){var a=i(this).constructor;n=Reflect.construct(o,arguments,a)}else n=o.apply(this,arguments);return function(t,e){if(e&&("object"===r(e)||"function"==typeof e))return e;return function(t){if(void 0===t)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return t}(t)}(this,n)}}function i(t){return(i=Object.setPrototypeOf?Object.getPrototypeOf:function(t){return t.__proto__||Object.getPrototypeOf(t)})(t)}var u=function(t){!function(t,e){if("function"!=typeof e&&null!==e)throw new TypeError("Super expression must either be null or a function");t.prototype=Object.create(e&&e.prototype,{constructor:{value:t,writable:!0,configurable:!0}}),e&&o(t,e)}(s,e);var r,i,u,c=a(s);function s(t){var e;return function(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}(this,s),(e=c.call(this,t)).props=t,e}return r=s,(i=[{key:"render",value:function(){var t,r=this.props,n=r.size,o=r.background;return t=r.src?e.h("div",{className:"oj-avatar-background-image",style:{backgroundImage:'url("'.concat(r.src,'")')}}):r.initials?e.h("div",{className:"oj-avatar-initials oj-avatar-background-image"},r.initials):e.h("div",{className:"oj-avatar-background-image"},e.h("div",{className:"oj-avatar-placeholder"})),e.h(s.tagName,null,e.h("div",{className:"oj-avatar oj-avatar-bg-"+o+" oj-avatar-"+n+(r.initials&&!r.src?" oj-avatar-has-initials":r.src?" oj-avatar-image":""),"aria-hidden":"true"},t))}}])&&n(r.prototype,i),u&&n(r,u),s}();return u.tagName="oj-avatar",u.metadata={properties:{background:{type:"string",enumValues:["neutral","red","orange","forest","green","teal","mauve","purple"],value:"neutral"},initials:{type:"string"},size:{type:"string",enumValues:["xxs","xs","sm","md","lg","xl","xxl"],value:"md"},src:{type:"string"}},methods:{setProperty:{},getProperty:{},setProperties:{},getNodeBySubId:{},getSubIdByNode:{}},extension:{}},e.register(u),u});
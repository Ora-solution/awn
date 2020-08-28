/**
 * @license
 * Copyright (c) 2014, 2020, Oracle and/or its affiliates.
 * The Universal Permissive License (UPL), Version 1.0
 * @ignore
 */
define(["ojs/ojcore","jquery","ojs/ojlabel"],function(e,t){"use strict";var i={CUSTOM_LABEL_ELEMENT_ID:"|label",_updateLabelledBy:function(e,t,r,s){var a,d,l,n,b=i.CUSTOM_LABEL_ELEMENT_ID;if(this._IsCustomElement())if(!t&&r)for(d=r.split(/\s+/),n=0;n<d.length;n++)a=d[n],i._addAriaLabelledBy(s,a+b),i._addSetIdOnLabel(a,e.id);else if(t&&!r)for(d=t.split(/\s+/),n=0;n<d.length;n++)a=d[n],i._removeAriaLabelledBy(s,a+b),i._removeDescribedByWithPrefix(e,a+"|");else if(t&&r){for(d=r.split(/\s+/),l=t.split(/\s+/),n=0;n<l.length;n++)a=l[n],-1===r.indexOf(a)&&(i._removeAriaLabelledBy(s,a+b),i._removeDescribedByWithPrefix(e,a+"|"));for(n=0;n<d.length;n++)a=d[n],-1===t.indexOf(a)&&(i._addAriaLabelledBy(s,a+b),i._addSetIdOnLabel(a,e.id))}},_addAriaLabelledBy:function(e,t){e.each(function(){var e,i=this.getAttribute("aria-labelledby");e=i?i.split(/\s+/):[],-1===e.indexOf(t)&&e.push(t),null==(i=e.join(" ").trim())?this.removeAttribute("aria-labelledBy"):this.setAttribute("aria-labelledBy",i)})},_addSetIdOnLabel:function(e,t){var i=document.getElementById(e);i&&!i.getAttribute("data-oj-set-id")&&i.setAttribute("data-oj-set-id",t)},_removeAriaLabelledBy:function(e,t){var i;e.each(function(){var e,r;-1!==(e=(r=(i=this.getAttribute("aria-labelledby"))?i.split(/\s+/):[]).indexOf(t))&&r.splice(e,1),(i=r.join(" ").trim())?this.setAttribute("aria-labelledby",i):this.removeAttribute("aria-labelledby")})},_removeDescribedByWithPrefix:function(e,t){var i;(i=((i=e.getAttribute("described-by"))?i.split(/\s+/):[]).filter(function(e){return-1===e.indexOf(t)}).join(" ").trim())?e.setAttribute("described-by",i):e.removeAttribute("described-by")},_updateDescribedBy:function(e,t){var i,r,s,a;if(this._IsCustomElement())if(!e&&t)for(r=t.split(/\s+/),a=0;a<r.length;a++)i=r[a],this._addAriaDescribedBy(i);else if(e&&!t)for(r=e.split(/\s+/),a=0;a<r.length;a++)i=r[a],this._removeAriaDescribedBy(i);else if(e&&t){for(r=t.split(/\s+/),s=e.split(/\s+/),a=0;a<s.length;a++)i=s[a],-1===t.indexOf(i)&&this._removeAriaDescribedBy(i);for(a=0;a<r.length;a++)i=r[a],-1===e.indexOf(i)&&this._addAriaDescribedBy(i)}},_addAriaDescribedBy:function(e){this._GetContentElement().each(function(){var t,i=this.getAttribute("aria-describedby");t=i?i.split(/\s+/):[],-1===t.indexOf(e)&&t.push(e),null==(i=t.join(" ").trim())?this.removeAttribute("aria-describedby"):this.setAttribute("aria-describedby",i)})},_removeAriaDescribedBy:function(e){this._GetContentElement().each(function(){var t,i,r;-1!==(i=(r=(t=this.getAttribute("aria-describedby"))?t.split(/\s+/):[]).indexOf(e))&&r.splice(i,1),(t=r.join(" ").trim())?this.setAttribute("aria-describedby",t):this.removeAttribute("aria-describedby")})}};return i});
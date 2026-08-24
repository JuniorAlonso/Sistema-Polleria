import{a as _e,b as fe}from"./chunk-3UE3XZN6.js";import{a as ye}from"./chunk-WKOQ3AXR.js";import{a as Zt}from"./chunk-ULLBEKEC.js";import{a as Ce,b as xe,c as ke}from"./chunk-O6BIVEEE.js";import{b as me,c as be,h as pe,j as he,k as xt,y as ue}from"./chunk-52I5MSGL.js";import{a as ge,b as ve}from"./chunk-YFKZAVSK.js";import{q as Ut,s as Yt,u as Xt,w as Jt,y as te,z as se}from"./chunk-KOM7FCB4.js";import"./chunk-3IMKWMXT.js";import{c as qt}from"./chunk-WT7LAJTD.js";import{C as ee,D as ne,I as ae,O as ie,Q as oe,R as re,ca as rt,fa as Ct,ha as de,k as ot,ka as ce,la as le,na as st,oa as dt,pa as ct,u as vt,v as Kt,y as yt}from"./chunk-ON2FWBKE.js";import{$a as K,A as $,Aa as L,Ab as ft,Ac as at,B as St,Ba as zt,Bb as S,Cb as A,Db as u,Dc as g,Eb as s,Ec as it,F as At,Fb as c,Gb as M,Nb as P,O as Ft,P as q,Q as Ot,R as F,Rb as f,Tb as m,Ua as Qt,Ub as Y,Vb as X,Wa as l,Wb as J,Xb as z,Y as Nt,Yb as p,Zb as h,_ as E,a as bt,aa as r,ab as U,b as pt,bc as gt,cb as ut,cc as $t,d as B,dc as k,ec as tt,f as Bt,fb as Vt,fc as b,ga as v,gc as Q,h as G,ha as y,hc as V,jb as T,ka as ht,kb as jt,lb as R,lc as j,m as Rt,nb as H,nc as et,o as Et,oa as _,ob as _t,oc as nt,pa as O,pb as Wt,ta as N,tc as W,wb as Gt,xa as Ht,xb as w,ya as Z,yb as C,z as Lt,zb as x}from"./chunk-3ERAQQI7.js";var Mt=["*"];function Fe(a,o){a&1&&X(0)}var Oe=["tabListContainer"],Ne=["tabList"],He=["tabListInner"],ze=["nextPaginator"],Qe=["previousPaginator"],Ve=["content"];function je(a,o){}var We=["tabBodyWrapper"],Ge=["tabHeader"];function $e(a,o){}function qe(a,o){if(a&1&&_t(0,$e,0,0,"ng-template",12),a&2){let t=m().$implicit;u("cdkPortalOutlet",t.templateLabel)}}function Ze(a,o){if(a&1&&b(0),a&2){let t=m().$implicit;Q(t.textLabel)}}function Ke(a,o){if(a&1){let t=P();s(0,"div",7,2),f("click",function(){let n=v(t),i=n.$implicit,d=n.$index,I=m(),D=gt(1);return y(I._handleClick(i,D,d))})("cdkFocusChange",function(n){let i=v(t).$index,d=m();return y(d._tabFocusChanged(n,i))}),M(2,"span",8)(3,"div",9),s(4,"span",10)(5,"span",11),C(6,qe,1,1,null,12)(7,Ze,1,1),c()()()}if(a&2){let t=o.$implicit,e=o.$index,n=gt(1),i=m();tt(t.labelClass),k("mdc-tab--active",i.selectedIndex===e),u("id",i._getTabLabelId(t,e))("disabled",t.disabled)("fitInkBarToContent",i.fitInkBarToContent),w("tabIndex",i._getTabIndex(e))("aria-posinset",e+1)("aria-setsize",i._tabs.length)("aria-controls",i._getTabContentId(e))("aria-selected",i.selectedIndex===e)("aria-label",t.ariaLabel||null)("aria-labelledby",!t.ariaLabel&&t.ariaLabelledby?t.ariaLabelledby:null),l(3),u("matRippleTrigger",n)("matRippleDisabled",t.disabled||i.disableRipple),l(3),x(t.templateLabel?6:7)}}function Ue(a,o){a&1&&X(0)}function Ye(a,o){if(a&1){let t=P();s(0,"mat-tab-body",13),f("_onCentered",function(){v(t);let n=m();return y(n._removeTabBodyWrapperHeight())})("_onCentering",function(n){v(t);let i=m();return y(i._setTabBodyWrapperHeight(n))})("_beforeCentering",function(n){v(t);let i=m();return y(i._bodyCentered(n))}),c()}if(a&2){let t=o.$implicit,e=o.$index,n=m();tt(t.bodyClass),u("id",n._getTabContentId(e))("content",t.content)("position",t.position)("animationDuration",n.animationDuration)("preserveContent",n.preserveContent),w("tabindex",n.contentTabIndex!=null&&n.selectedIndex===e?n.contentTabIndex:null)("aria-labelledby",n._getTabLabelId(t,e))("aria-hidden",n.selectedIndex!==e)}}var Xe=new E("MatTabContent"),Je=(()=>{class a{template=r(U);constructor(){}static \u0275fac=function(e){return new(e||a)};static \u0275dir=R({type:a,selectors:[["","matTabContent",""]],features:[j([{provide:Xe,useExisting:a}])]})}return a})(),tn=new E("MatTabLabel"),Pe=new E("MAT_TAB"),en=(()=>{class a extends he{_closestTab=r(Pe,{optional:!0});static \u0275fac=(()=>{let t;return function(n){return(t||(t=Z(a)))(n||a)}})();static \u0275dir=R({type:a,selectors:[["","mat-tab-label",""],["","matTabLabel",""]],features:[j([{provide:tn,useExisting:a}]),H]})}return a})(),De=new E("MAT_TAB_GROUP"),Pt=(()=>{class a{_viewContainerRef=r(Vt);_closestTabGroup=r(De,{optional:!0});disabled=!1;get templateLabel(){return this._templateLabel}set templateLabel(t){this._setTemplateLabelInput(t)}_templateLabel;_explicitContent=void 0;_implicitContent;textLabel="";ariaLabel;ariaLabelledby;labelClass;bodyClass;id=null;_contentPortal=null;get content(){return this._contentPortal}_stateChanges=new G;position=null;origin=null;isActive=!1;constructor(){r(ne).load(de)}ngOnChanges(t){(t.hasOwnProperty("textLabel")||t.hasOwnProperty("disabled"))&&this._stateChanges.next()}ngOnDestroy(){this._stateChanges.complete()}ngOnInit(){this._contentPortal=new pe(this._explicitContent||this._implicitContent,this._viewContainerRef)}_setTemplateLabelInput(t){t&&t._closestTab===this&&(this._templateLabel=t)}static \u0275fac=function(e){return new(e||a)};static \u0275cmp=T({type:a,selectors:[["mat-tab"]],contentQueries:function(e,n,i){if(e&1&&J(i,en,5)(i,Je,7,U),e&2){let d;p(d=h())&&(n.templateLabel=d.first),p(d=h())&&(n._explicitContent=d.first)}},viewQuery:function(e,n){if(e&1&&z(U,7),e&2){let i;p(i=h())&&(n._implicitContent=i.first)}},hostAttrs:["hidden",""],hostVars:1,hostBindings:function(e,n){e&2&&w("id",null)},inputs:{disabled:[2,"disabled","disabled",g],textLabel:[0,"label","textLabel"],ariaLabel:[0,"aria-label","ariaLabel"],ariaLabelledby:[0,"aria-labelledby","ariaLabelledby"],labelClass:"labelClass",bodyClass:"bodyClass",id:"id"},exportAs:["matTab"],features:[j([{provide:Pe,useExisting:a}]),Ht],ngContentSelectors:Mt,decls:1,vars:0,template:function(e,n){e&1&&(Y(),Wt(0,Fe,1,0,"ng-template"))},encapsulation:2})}return a})(),kt="mdc-tab-indicator--active",Te="mdc-tab-indicator--no-transition",Tt=class{_items;_currentItem;constructor(o){this._items=o}hide(){this._items.forEach(o=>o.deactivateInkBar()),this._currentItem=void 0}alignToElement(o){let t=this._items.find(n=>n.elementRef.nativeElement===o),e=this._currentItem;if(t!==e&&(e?.deactivateInkBar(),t)){let n=e?.elementRef.nativeElement.getBoundingClientRect?.();t.activateInkBar(n),this._currentItem=t}}},nn=(()=>{class a{_elementRef=r(L);_inkBarElement=null;_inkBarContentElement=null;_fitToContent=!1;get fitInkBarToContent(){return this._fitToContent}set fitInkBarToContent(t){this._fitToContent!==t&&(this._fitToContent=t,this._inkBarElement&&this._appendInkBarElement())}activateInkBar(t){let e=this._elementRef.nativeElement;if(!t||!e.getBoundingClientRect||!this._inkBarContentElement){e.classList.add(kt);return}let n=e.getBoundingClientRect(),i=t.width/n.width,d=t.left-n.left;e.classList.add(Te),this._inkBarContentElement.style.setProperty("transform",`translateX(${d}px) scaleX(${i})`),e.getBoundingClientRect(),e.classList.remove(Te),e.classList.add(kt),this._inkBarContentElement.style.setProperty("transform","")}deactivateInkBar(){this._elementRef.nativeElement.classList.remove(kt)}ngOnInit(){this._createInkBarElement()}ngOnDestroy(){this._inkBarElement?.remove(),this._inkBarElement=this._inkBarContentElement=null}_createInkBarElement(){let t=this._elementRef.nativeElement.ownerDocument||document,e=this._inkBarElement=t.createElement("span"),n=this._inkBarContentElement=t.createElement("span");e.className="mdc-tab-indicator",n.className="mdc-tab-indicator__content mdc-tab-indicator__content--underline",e.appendChild(this._inkBarContentElement),this._appendInkBarElement()}_appendInkBarElement(){this._inkBarElement;let t=this._fitToContent?this._elementRef.nativeElement.querySelector(".mdc-tab__content"):this._elementRef.nativeElement;t.appendChild(this._inkBarElement)}static \u0275fac=function(e){return new(e||a)};static \u0275dir=R({type:a,inputs:{fitInkBarToContent:[2,"fitInkBarToContent","fitInkBarToContent",g]}})}return a})();var Be=(()=>{class a extends nn{elementRef=r(L);disabled=!1;focus(){this.elementRef.nativeElement.focus()}getOffsetLeft(){return this.elementRef.nativeElement.offsetLeft}getOffsetWidth(){return this.elementRef.nativeElement.offsetWidth}static \u0275fac=(()=>{let t;return function(n){return(t||(t=Z(a)))(n||a)}})();static \u0275dir=R({type:a,selectors:[["","matTabLabelWrapper",""]],hostVars:3,hostBindings:function(e,n){e&2&&(w("aria-disabled",!!n.disabled),k("mat-mdc-tab-disabled",n.disabled))},inputs:{disabled:[2,"disabled","disabled",g]},features:[H]})}return a})(),Ie={passive:!0},an=650,on=100,rn=(()=>{class a{_elementRef=r(L);_changeDetectorRef=r(at);_viewportRuler=r(be);_dir=r(vt,{optional:!0});_ngZone=r(O);_platform=r(yt);_sharedResizeObserver=r(se);_injector=r(ht);_renderer=r(ut);_animationsDisabled=rt();_eventCleanups;_scrollDistance=0;_selectedIndexChanged=!1;_destroyed=new G;_showPaginationControls=!1;_disableScrollAfter=!0;_disableScrollBefore=!0;_tabLabelCount;_scrollDistanceChanged=!1;_keyManager;_currentTextContent;_stopScrolling=new G;disablePagination=!1;get selectedIndex(){return this._selectedIndex}set selectedIndex(t){let e=isNaN(t)?0:t;this._selectedIndex!=e&&(this._selectedIndexChanged=!0,this._selectedIndex=e,this._keyManager&&this._keyManager.updateActiveItem(e))}_selectedIndex=0;selectFocusedIndex=new _;indexFocused=new _;constructor(){this._eventCleanups=this._ngZone.runOutsideAngular(()=>[this._renderer.listen(this._elementRef.nativeElement,"mouseleave",()=>this._stopInterval())])}ngAfterViewInit(){this._eventCleanups.push(this._renderer.listen(this._previousPaginator.nativeElement,"touchstart",()=>this._handlePaginatorPress("before"),Ie),this._renderer.listen(this._nextPaginator.nativeElement,"touchstart",()=>this._handlePaginatorPress("after"),Ie))}ngAfterContentInit(){let t=this._dir?this._dir.change:Et("ltr"),e=this._sharedResizeObserver.observe(this._elementRef.nativeElement).pipe(At(32),F(this._destroyed)),n=this._viewportRuler.change(150).pipe(F(this._destroyed)),i=()=>{this.updatePagination(),this._alignInkBarToSelectedTab()};this._keyManager=new oe(this._items).withHorizontalOrientation(this._getLayoutDirection()).withHomeAndEnd().withWrap().skipPredicate(()=>!1),this._keyManager.updateActiveItem(Math.max(this._selectedIndex,0)),K(i,{injector:this._injector}),$(t,n,e,this._items.changes,this._itemsResized()).pipe(F(this._destroyed)).subscribe(()=>{this._ngZone.run(()=>{Promise.resolve().then(()=>{this._scrollDistance=Math.max(0,Math.min(this._getMaxScrollDistance(),this._scrollDistance)),i()})}),this._keyManager?.withHorizontalOrientation(this._getLayoutDirection())}),this._keyManager.change.subscribe(d=>{this.indexFocused.emit(d),this._setTabFocus(d)})}_itemsResized(){return typeof ResizeObserver!="function"?Rt:this._items.changes.pipe(q(this._items),Ot(t=>new Bt(e=>this._ngZone.runOutsideAngular(()=>{let n=new ResizeObserver(i=>e.next(i));return t.forEach(i=>n.observe(i.elementRef.nativeElement)),()=>{n.disconnect()}}))),Ft(1),St(t=>t.some(e=>e.contentRect.width>0&&e.contentRect.height>0)))}ngAfterContentChecked(){this._tabLabelCount!=this._items.length&&(this.updatePagination(),this._tabLabelCount=this._items.length,this._changeDetectorRef.markForCheck()),this._selectedIndexChanged&&(this._scrollToLabel(this._selectedIndex),this._checkScrollingControls(),this._alignInkBarToSelectedTab(),this._selectedIndexChanged=!1,this._changeDetectorRef.markForCheck()),this._scrollDistanceChanged&&(this._updateTabScrollPosition(),this._scrollDistanceChanged=!1,this._changeDetectorRef.markForCheck())}ngOnDestroy(){this._eventCleanups.forEach(t=>t()),this._keyManager?.destroy(),this._destroyed.next(),this._destroyed.complete(),this._stopScrolling.complete()}_handleKeydown(t){if(!ie(t))switch(t.keyCode){case 13:case 32:if(this.focusIndex!==this.selectedIndex){let e=this._items.get(this.focusIndex);e&&!e.disabled&&(this.selectFocusedIndex.emit(this.focusIndex),this._itemSelected(t))}break;default:this._keyManager?.onKeydown(t)}}_onContentChanges(){let t=this._elementRef.nativeElement.textContent;t!==this._currentTextContent&&(this._currentTextContent=t||"",this._ngZone.run(()=>{this.updatePagination(),this._alignInkBarToSelectedTab(),this._changeDetectorRef.markForCheck()}))}updatePagination(){this._checkPaginationEnabled(),this._checkScrollingControls(),this._updateTabScrollPosition()}get focusIndex(){return this._keyManager?this._keyManager.activeItemIndex:0}set focusIndex(t){!this._isValidIndex(t)||this.focusIndex===t||!this._keyManager||this._keyManager.setActiveItem(t)}_isValidIndex(t){return this._items?!!this._items.toArray()[t]:!0}_setTabFocus(t){if(this._showPaginationControls&&this._scrollToLabel(t),this._items&&this._items.length){this._items.toArray()[t].focus();let e=this._tabListContainer.nativeElement;this._getLayoutDirection()=="ltr"?e.scrollLeft=0:e.scrollLeft=e.scrollWidth-e.offsetWidth}}_getLayoutDirection(){return this._dir&&this._dir.value==="rtl"?"rtl":"ltr"}_updateTabScrollPosition(){if(this.disablePagination)return;let t=this.scrollDistance,e=this._getLayoutDirection()==="ltr"?-t:t;this._tabList.nativeElement.style.transform=`translateX(${Math.round(e)}px)`,(this._platform.TRIDENT||this._platform.EDGE)&&(this._tabListContainer.nativeElement.scrollLeft=0)}get scrollDistance(){return this._scrollDistance}set scrollDistance(t){this._scrollTo(t)}_scrollHeader(t){let e=this._tabListContainer.nativeElement.offsetWidth,n=(t=="before"?-1:1)*e/3;return this._scrollTo(this._scrollDistance+n)}_handlePaginatorClick(t){this._stopInterval(),this._scrollHeader(t)}_scrollToLabel(t){if(this.disablePagination)return;let e=this._items?this._items.toArray()[t]:null;if(!e)return;let n=this._tabListContainer.nativeElement.offsetWidth,{offsetLeft:i,offsetWidth:d}=e.elementRef.nativeElement,I,D;this._getLayoutDirection()=="ltr"?(I=i,D=I+d):(D=this._tabListInner.nativeElement.offsetWidth-i,I=D-d);let mt=this.scrollDistance,Dt=this.scrollDistance+n;I<mt?this.scrollDistance-=mt-I:D>Dt&&(this.scrollDistance+=Math.min(D-Dt,I-mt))}_checkPaginationEnabled(){if(this.disablePagination)this._showPaginationControls=!1;else{let t=this._tabListInner.nativeElement.scrollWidth,e=this._elementRef.nativeElement.offsetWidth,n=t-e>=5;n||(this.scrollDistance=0),n!==this._showPaginationControls&&(this._showPaginationControls=n,this._changeDetectorRef.markForCheck())}}_checkScrollingControls(){this.disablePagination?this._disableScrollAfter=this._disableScrollBefore=!0:(this._disableScrollBefore=this.scrollDistance==0,this._disableScrollAfter=this.scrollDistance==this._getMaxScrollDistance(),this._changeDetectorRef.markForCheck())}_getMaxScrollDistance(){let t=this._tabListInner.nativeElement.scrollWidth,e=this._tabListContainer.nativeElement.offsetWidth;return t-e||0}_alignInkBarToSelectedTab(){let t=this._items&&this._items.length?this._items.toArray()[this.selectedIndex]:null,e=t?t.elementRef.nativeElement:null;e?this._inkBar.alignToElement(e):this._inkBar.hide()}_stopInterval(){this._stopScrolling.next()}_handlePaginatorPress(t,e){e&&e.button!=null&&e.button!==0||(this._stopInterval(),Lt(an,on).pipe(F($(this._stopScrolling,this._destroyed))).subscribe(()=>{let{maxScrollDistance:n,distance:i}=this._scrollHeader(t);(i===0||i>=n)&&this._stopInterval()}))}_scrollTo(t){if(this.disablePagination)return{maxScrollDistance:0,distance:0};let e=this._getMaxScrollDistance();return this._scrollDistance=Math.max(0,Math.min(e,t)),this._scrollDistanceChanged=!0,this._checkScrollingControls(),{maxScrollDistance:e,distance:this._scrollDistance}}static \u0275fac=function(e){return new(e||a)};static \u0275dir=R({type:a,inputs:{disablePagination:[2,"disablePagination","disablePagination",g],selectedIndex:[2,"selectedIndex","selectedIndex",it]},outputs:{selectFocusedIndex:"selectFocusedIndex",indexFocused:"indexFocused"}})}return a})(),sn=(()=>{class a extends rn{_items;_tabListContainer;_tabList;_tabListInner;_nextPaginator;_previousPaginator;_inkBar;ariaLabel;ariaLabelledby;disableRipple=!1;ngAfterContentInit(){this._inkBar=new Tt(this._items),super.ngAfterContentInit()}_itemSelected(t){t.preventDefault()}static \u0275fac=(()=>{let t;return function(n){return(t||(t=Z(a)))(n||a)}})();static \u0275cmp=T({type:a,selectors:[["mat-tab-header"]],contentQueries:function(e,n,i){if(e&1&&J(i,Be,4),e&2){let d;p(d=h())&&(n._items=d)}},viewQuery:function(e,n){if(e&1&&z(Oe,7)(Ne,7)(He,7)(ze,5)(Qe,5),e&2){let i;p(i=h())&&(n._tabListContainer=i.first),p(i=h())&&(n._tabList=i.first),p(i=h())&&(n._tabListInner=i.first),p(i=h())&&(n._nextPaginator=i.first),p(i=h())&&(n._previousPaginator=i.first)}},hostAttrs:[1,"mat-mdc-tab-header"],hostVars:4,hostBindings:function(e,n){e&2&&k("mat-mdc-tab-header-pagination-controls-enabled",n._showPaginationControls)("mat-mdc-tab-header-rtl",n._getLayoutDirection()=="rtl")},inputs:{ariaLabel:[0,"aria-label","ariaLabel"],ariaLabelledby:[0,"aria-labelledby","ariaLabelledby"],disableRipple:[2,"disableRipple","disableRipple",g]},features:[H],ngContentSelectors:Mt,decls:13,vars:10,consts:[["previousPaginator",""],["tabListContainer",""],["tabList",""],["tabListInner",""],["nextPaginator",""],["mat-ripple","",1,"mat-mdc-tab-header-pagination","mat-mdc-tab-header-pagination-before",3,"click","mousedown","touchend","matRippleDisabled"],[1,"mat-mdc-tab-header-pagination-chevron"],[1,"mat-mdc-tab-label-container",3,"keydown"],["role","tablist",1,"mat-mdc-tab-list",3,"cdkObserveContent"],[1,"mat-mdc-tab-labels"],["mat-ripple","",1,"mat-mdc-tab-header-pagination","mat-mdc-tab-header-pagination-after",3,"mousedown","click","touchend","matRippleDisabled"]],template:function(e,n){e&1&&(Y(),s(0,"div",5,0),f("click",function(){return n._handlePaginatorClick("before")})("mousedown",function(d){return n._handlePaginatorPress("before",d)})("touchend",function(){return n._stopInterval()}),M(2,"div",6),c(),s(3,"div",7,1),f("keydown",function(d){return n._handleKeydown(d)}),s(5,"div",8,2),f("cdkObserveContent",function(){return n._onContentChanges()}),s(7,"div",9,3),X(9),c()()(),s(10,"div",10,4),f("mousedown",function(d){return n._handlePaginatorPress("after",d)})("click",function(){return n._handlePaginatorClick("after")})("touchend",function(){return n._stopInterval()}),M(12,"div",6),c()),e&2&&(k("mat-mdc-tab-header-pagination-disabled",n._disableScrollBefore),u("matRippleDisabled",n._disableScrollBefore||n.disableRipple),l(3),k("_mat-animation-noopable",n._animationsDisabled),l(2),w("aria-label",n.ariaLabel||null)("aria-labelledby",n.ariaLabelledby||null),l(5),k("mat-mdc-tab-header-pagination-disabled",n._disableScrollAfter),u("matRippleDisabled",n._disableScrollAfter||n.disableRipple))},dependencies:[Ct,ae],styles:[`.mat-mdc-tab-header {
  display: flex;
  overflow: hidden;
  position: relative;
  flex-shrink: 0;
}

.mdc-tab-indicator .mdc-tab-indicator__content {
  transition-duration: var(--mat-tab-animation-duration, 250ms);
}

.mat-mdc-tab-header-pagination {
  -webkit-user-select: none;
  user-select: none;
  position: relative;
  display: none;
  justify-content: center;
  align-items: center;
  min-width: 32px;
  cursor: pointer;
  z-index: 2;
  -webkit-tap-highlight-color: transparent;
  touch-action: none;
  box-sizing: content-box;
  outline: 0;
}
.mat-mdc-tab-header-pagination::-moz-focus-inner {
  border: 0;
}
.mat-mdc-tab-header-pagination .mat-ripple-element {
  opacity: 0.12;
  background-color: var(--mat-tab-inactive-ripple-color, var(--mat-sys-on-surface));
}
.mat-mdc-tab-header-pagination-controls-enabled .mat-mdc-tab-header-pagination {
  display: flex;
}

.mat-mdc-tab-header-pagination-before,
.mat-mdc-tab-header-rtl .mat-mdc-tab-header-pagination-after {
  padding-left: 4px;
}
.mat-mdc-tab-header-pagination-before .mat-mdc-tab-header-pagination-chevron,
.mat-mdc-tab-header-rtl .mat-mdc-tab-header-pagination-after .mat-mdc-tab-header-pagination-chevron {
  transform: rotate(-135deg);
}

.mat-mdc-tab-header-rtl .mat-mdc-tab-header-pagination-before,
.mat-mdc-tab-header-pagination-after {
  padding-right: 4px;
}
.mat-mdc-tab-header-rtl .mat-mdc-tab-header-pagination-before .mat-mdc-tab-header-pagination-chevron,
.mat-mdc-tab-header-pagination-after .mat-mdc-tab-header-pagination-chevron {
  transform: rotate(45deg);
}

.mat-mdc-tab-header-pagination-chevron {
  border-style: solid;
  border-width: 2px 2px 0 0;
  height: 8px;
  width: 8px;
  border-color: var(--mat-tab-pagination-icon-color, var(--mat-sys-on-surface));
}

.mat-mdc-tab-header-pagination-disabled {
  box-shadow: none;
  cursor: default;
  pointer-events: none;
}
.mat-mdc-tab-header-pagination-disabled .mat-mdc-tab-header-pagination-chevron {
  opacity: 0.4;
}

.mat-mdc-tab-list {
  flex-grow: 1;
  position: relative;
  transition: transform 500ms cubic-bezier(0.35, 0, 0.25, 1);
}
._mat-animation-noopable .mat-mdc-tab-list {
  transition: none;
}

.mat-mdc-tab-label-container {
  display: flex;
  flex-grow: 1;
  overflow: hidden;
  z-index: 1;
  border-bottom-style: solid;
  border-bottom-width: var(--mat-tab-divider-height, 1px);
  border-bottom-color: var(--mat-tab-divider-color, var(--mat-sys-surface-variant));
}
.mat-mdc-tab-group-inverted-header .mat-mdc-tab-label-container {
  border-bottom: none;
  border-top-style: solid;
  border-top-width: var(--mat-tab-divider-height, 1px);
  border-top-color: var(--mat-tab-divider-color, var(--mat-sys-surface-variant));
}

.mat-mdc-tab-labels {
  display: flex;
  flex: 1 0 auto;
}
[mat-align-tabs=center] > .mat-mdc-tab-header .mat-mdc-tab-labels {
  justify-content: center;
}
[mat-align-tabs=end] > .mat-mdc-tab-header .mat-mdc-tab-labels {
  justify-content: flex-end;
}
.cdk-drop-list .mat-mdc-tab-labels, .mat-mdc-tab-labels.cdk-drop-list {
  min-height: var(--mat-tab-container-height, 48px);
}

.mat-mdc-tab::before {
  margin: 5px;
}
@media (forced-colors: active) {
  .mat-mdc-tab[aria-disabled=true] {
    color: GrayText;
  }
}
`],encapsulation:2})}return a})(),dn=new E("MAT_TABS_CONFIG"),we=(()=>{class a extends xt{_host=r(It);_ngZone=r(O);_centeringSub=B.EMPTY;_leavingSub=B.EMPTY;constructor(){super()}ngOnInit(){super.ngOnInit(),this._centeringSub=this._host._beforeCentering.pipe(q(this._host._isCenterPosition())).subscribe(t=>{this._host._content&&t&&!this.hasAttached()&&this._ngZone.run(()=>{Promise.resolve().then(),this.attach(this._host._content)})}),this._leavingSub=this._host._afterLeavingCenter.subscribe(()=>{this._host.preserveContent||this._ngZone.run(()=>this.detach())})}ngOnDestroy(){super.ngOnDestroy(),this._centeringSub.unsubscribe(),this._leavingSub.unsubscribe()}static \u0275fac=function(e){return new(e||a)};static \u0275dir=R({type:a,selectors:[["","matTabBodyHost",""]],features:[H]})}return a})(),It=(()=>{class a{_elementRef=r(L);_dir=r(vt,{optional:!0});_ngZone=r(O);_injector=r(ht);_renderer=r(ut);_diAnimationsDisabled=rt();_eventCleanups;_initialized=!1;_fallbackTimer;_positionIndex;_dirChangeSubscription=B.EMPTY;_position;_previousPosition;_onCentering=new _;_beforeCentering=new _;_afterLeavingCenter=new _;_onCentered=new _(!0);_portalHost;_contentElement;_content;animationDuration="500ms";preserveContent=!1;set position(t){this._positionIndex=t,this._computePositionAnimationState()}constructor(){if(this._dir){let t=r(at);this._dirChangeSubscription=this._dir.change.subscribe(e=>{this._computePositionAnimationState(e),t.markForCheck()})}}ngOnInit(){this._bindTransitionEvents(),this._position==="center"&&(this._setActiveClass(!0),K(()=>this._onCentering.emit(this._elementRef.nativeElement.clientHeight),{injector:this._injector})),this._initialized=!0}ngOnDestroy(){clearTimeout(this._fallbackTimer),this._eventCleanups?.forEach(t=>t()),this._dirChangeSubscription.unsubscribe()}_bindTransitionEvents(){this._ngZone.runOutsideAngular(()=>{let t=this._elementRef.nativeElement,e=n=>{n.target===this._contentElement?.nativeElement&&(this._elementRef.nativeElement.classList.remove("mat-tab-body-animating"),n.type==="transitionend"&&this._transitionDone())};this._eventCleanups=[this._renderer.listen(t,"transitionstart",n=>{n.target===this._contentElement?.nativeElement&&(this._elementRef.nativeElement.classList.add("mat-tab-body-animating"),this._transitionStarted())}),this._renderer.listen(t,"transitionend",e),this._renderer.listen(t,"transitioncancel",e)]})}_transitionStarted(){clearTimeout(this._fallbackTimer);let t=this._position==="center";this._beforeCentering.emit(t),t&&this._onCentering.emit(this._elementRef.nativeElement.clientHeight)}_transitionDone(){this._position==="center"?this._onCentered.emit():this._previousPosition==="center"&&this._afterLeavingCenter.emit()}_setActiveClass(t){this._elementRef.nativeElement.classList.toggle("mat-mdc-tab-body-active",t)}_getLayoutDirection(){return this._dir&&this._dir.value==="rtl"?"rtl":"ltr"}_isCenterPosition(){return this._positionIndex===0}_computePositionAnimationState(t=this._getLayoutDirection()){this._previousPosition=this._position,this._positionIndex<0?this._position=t=="ltr"?"left":"right":this._positionIndex>0?this._position=t=="ltr"?"right":"left":this._position="center",this._animationsDisabled()?this._simulateTransitionEvents():this._initialized&&(this._position==="center"||this._previousPosition==="center")&&(clearTimeout(this._fallbackTimer),this._fallbackTimer=this._ngZone.runOutsideAngular(()=>setTimeout(()=>this._simulateTransitionEvents(),100)))}_simulateTransitionEvents(){this._transitionStarted(),K(()=>this._transitionDone(),{injector:this._injector})}_animationsDisabled(){return this._diAnimationsDisabled||this.animationDuration==="0ms"||this.animationDuration==="0s"}static \u0275fac=function(e){return new(e||a)};static \u0275cmp=T({type:a,selectors:[["mat-tab-body"]],viewQuery:function(e,n){if(e&1&&z(we,5)(Ve,5),e&2){let i;p(i=h())&&(n._portalHost=i.first),p(i=h())&&(n._contentElement=i.first)}},hostAttrs:[1,"mat-mdc-tab-body"],hostVars:1,hostBindings:function(e,n){e&2&&w("inert",n._position==="center"?null:"")},inputs:{_content:[0,"content","_content"],animationDuration:"animationDuration",preserveContent:"preserveContent",position:"position"},outputs:{_onCentering:"_onCentering",_beforeCentering:"_beforeCentering",_onCentered:"_onCentered"},decls:3,vars:6,consts:[["content",""],["cdkScrollable","",1,"mat-mdc-tab-body-content"],["matTabBodyHost",""]],template:function(e,n){e&1&&(s(0,"div",1,0),_t(2,je,0,0,"ng-template",2),c()),e&2&&k("mat-tab-body-content-left",n._position==="left")("mat-tab-body-content-right",n._position==="right")("mat-tab-body-content-can-animate",n._position==="center"||n._previousPosition==="center")},dependencies:[we,me],styles:[`.mat-mdc-tab-body {
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  position: absolute;
  display: block;
  overflow: hidden;
  outline: 0;
  flex-basis: 100%;
}
.mat-mdc-tab-body.mat-mdc-tab-body-active {
  position: relative;
  overflow-x: hidden;
  overflow-y: auto;
  z-index: 1;
  flex-grow: 1;
}
.mat-mdc-tab-group.mat-mdc-tab-group-dynamic-height .mat-mdc-tab-body.mat-mdc-tab-body-active {
  overflow-y: hidden;
}

.mat-mdc-tab-body-content {
  height: 100%;
  overflow: auto;
  transform: none;
  visibility: hidden;
}
.mat-tab-body-animating > .mat-mdc-tab-body-content, .mat-mdc-tab-body-active > .mat-mdc-tab-body-content {
  visibility: visible;
}
.mat-tab-body-animating > .mat-mdc-tab-body-content {
  min-height: 1px;
}
.mat-mdc-tab-group-dynamic-height .mat-mdc-tab-body-content {
  overflow: hidden;
}

.mat-tab-body-content-can-animate {
  transition: transform var(--mat-tab-animation-duration) 1ms cubic-bezier(0.35, 0, 0.25, 1);
}
.mat-mdc-tab-body-wrapper._mat-animation-noopable .mat-tab-body-content-can-animate {
  transition: none;
}

.mat-tab-body-content-left {
  transform: translate3d(-100%, 0, 0);
}

.mat-tab-body-content-right {
  transform: translate3d(100%, 0, 0);
}
`],encapsulation:2})}return a})(),Re=(()=>{class a{_elementRef=r(L);_changeDetectorRef=r(at);_ngZone=r(O);_tabsSubscription=B.EMPTY;_tabLabelSubscription=B.EMPTY;_tabBodySubscription=B.EMPTY;_diAnimationsDisabled=rt();_allTabs;_tabBodies;_tabBodyWrapper;_tabHeader;_tabs=new zt;_indexToSelect=0;_lastFocusedTabIndex=null;_tabBodyWrapperHeight=0;color;get fitInkBarToContent(){return this._fitInkBarToContent}set fitInkBarToContent(t){this._fitInkBarToContent=t,this._changeDetectorRef.markForCheck()}_fitInkBarToContent=!1;stretchTabs=!0;alignTabs=null;dynamicHeight=!1;get selectedIndex(){return this._selectedIndex}set selectedIndex(t){this._indexToSelect=isNaN(t)?null:t}_selectedIndex=null;headerPosition="above";get animationDuration(){return this._animationDuration}set animationDuration(t){let e=t+"";this._animationDuration=/^\d+$/.test(e)?t+"ms":e}_animationDuration;get contentTabIndex(){return this._contentTabIndex}set contentTabIndex(t){this._contentTabIndex=isNaN(t)?null:t}_contentTabIndex=null;disablePagination=!1;disableRipple=!1;preserveContent=!1;get backgroundColor(){return this._backgroundColor}set backgroundColor(t){let e=this._elementRef.nativeElement.classList;e.remove("mat-tabs-with-background",`mat-background-${this.backgroundColor}`),t&&e.add("mat-tabs-with-background",`mat-background-${t}`),this._backgroundColor=t}_backgroundColor;ariaLabel;ariaLabelledby;selectedIndexChange=new _;focusChange=new _;animationDone=new _;selectedTabChange=new _(!0);_groupId;_isServer=!r(yt).isBrowser;constructor(){let t=r(dn,{optional:!0});this._groupId=r(re).getId("mat-tab-group-"),this.animationDuration=t&&t.animationDuration?t.animationDuration:"500ms",this.disablePagination=t&&t.disablePagination!=null?t.disablePagination:!1,this.dynamicHeight=t&&t.dynamicHeight!=null?t.dynamicHeight:!1,t?.contentTabIndex!=null&&(this.contentTabIndex=t.contentTabIndex),this.preserveContent=!!t?.preserveContent,this.fitInkBarToContent=t&&t.fitInkBarToContent!=null?t.fitInkBarToContent:!1,this.stretchTabs=t&&t.stretchTabs!=null?t.stretchTabs:!0,this.alignTabs=t&&t.alignTabs!=null?t.alignTabs:null}ngAfterContentChecked(){let t=this._indexToSelect=this._clampTabIndex(this._indexToSelect);if(this._selectedIndex!=t){let e=this._selectedIndex==null;if(!e){this.selectedTabChange.emit(this._createChangeEvent(t));let n=this._tabBodyWrapper.nativeElement;n.style.minHeight=n.clientHeight+"px"}Promise.resolve().then(()=>{this._tabs.forEach((n,i)=>n.isActive=i===t),e||(this.selectedIndexChange.emit(t),this._tabBodyWrapper.nativeElement.style.minHeight="")})}this._tabs.forEach((e,n)=>{e.position=n-t,this._selectedIndex!=null&&e.position==0&&!e.origin&&(e.origin=t-this._selectedIndex)}),this._selectedIndex!==t&&(this._selectedIndex=t,this._lastFocusedTabIndex=null,this._changeDetectorRef.markForCheck())}ngAfterContentInit(){this._subscribeToAllTabChanges(),this._subscribeToTabLabels(),this._tabsSubscription=this._tabs.changes.subscribe(()=>{let t=this._clampTabIndex(this._indexToSelect);if(t===this._selectedIndex){let e=this._tabs.toArray(),n;for(let i=0;i<e.length;i++)if(e[i].isActive){this._indexToSelect=this._selectedIndex=i,this._lastFocusedTabIndex=null,n=e[i];break}!n&&e[t]&&Promise.resolve().then(()=>{e[t].isActive=!0,this.selectedTabChange.emit(this._createChangeEvent(t))})}this._changeDetectorRef.markForCheck()})}ngAfterViewInit(){this._tabBodySubscription=this._tabBodies.changes.subscribe(()=>this._bodyCentered(!0))}_subscribeToAllTabChanges(){this._allTabs.changes.pipe(q(this._allTabs)).subscribe(t=>{this._tabs.reset(t.filter(e=>e._closestTabGroup===this||!e._closestTabGroup)),this._tabs.notifyOnChanges()})}ngOnDestroy(){this._tabs.destroy(),this._tabsSubscription.unsubscribe(),this._tabLabelSubscription.unsubscribe(),this._tabBodySubscription.unsubscribe()}realignInkBar(){this._tabHeader&&this._tabHeader._alignInkBarToSelectedTab()}updatePagination(){this._tabHeader&&this._tabHeader.updatePagination()}focusTab(t){let e=this._tabHeader;e&&(e.focusIndex=t)}_focusChanged(t){this._lastFocusedTabIndex=t,this.focusChange.emit(this._createChangeEvent(t))}_createChangeEvent(t){let e=new wt;return e.index=t,this._tabs&&this._tabs.length&&(e.tab=this._tabs.toArray()[t]),e}_subscribeToTabLabels(){this._tabLabelSubscription&&this._tabLabelSubscription.unsubscribe(),this._tabLabelSubscription=$(...this._tabs.map(t=>t._stateChanges)).subscribe(()=>this._changeDetectorRef.markForCheck())}_clampTabIndex(t){return Math.min(this._tabs.length-1,Math.max(t||0,0))}_getTabLabelId(t,e){return t.id||`${this._groupId}-label-${e}`}_getTabContentId(t){return`${this._groupId}-content-${t}`}_setTabBodyWrapperHeight(t){if(!this.dynamicHeight||!this._tabBodyWrapperHeight){this._tabBodyWrapperHeight=t;return}let e=this._tabBodyWrapper.nativeElement;e.style.height=this._tabBodyWrapperHeight+"px",this._tabBodyWrapper.nativeElement.offsetHeight&&(e.style.height=t+"px")}_removeTabBodyWrapperHeight(){let t=this._tabBodyWrapper.nativeElement;this._tabBodyWrapperHeight=t.clientHeight,t.style.height="",this._ngZone.run(()=>this.animationDone.emit())}_handleClick(t,e,n){e.focusIndex=n,t.disabled||(this.selectedIndex=n)}_getTabIndex(t){let e=this._lastFocusedTabIndex??this.selectedIndex;return t===e?0:-1}_tabFocusChanged(t,e){t&&t!=="mouse"&&t!=="touch"&&(this._tabHeader.focusIndex=e)}_bodyCentered(t){t&&this._tabBodies?.forEach((e,n)=>e._setActiveClass(n===this._selectedIndex))}_animationsDisabled(){return this._diAnimationsDisabled||this.animationDuration==="0"||this.animationDuration==="0ms"}static \u0275fac=function(e){return new(e||a)};static \u0275cmp=T({type:a,selectors:[["mat-tab-group"]],contentQueries:function(e,n,i){if(e&1&&J(i,Pt,5),e&2){let d;p(d=h())&&(n._allTabs=d)}},viewQuery:function(e,n){if(e&1&&z(We,5)(Ge,5)(It,5),e&2){let i;p(i=h())&&(n._tabBodyWrapper=i.first),p(i=h())&&(n._tabHeader=i.first),p(i=h())&&(n._tabBodies=i)}},hostAttrs:[1,"mat-mdc-tab-group"],hostVars:11,hostBindings:function(e,n){e&2&&(w("mat-align-tabs",n.alignTabs),tt("mat-"+(n.color||"primary")),$t("--mat-tab-animation-duration",n.animationDuration),k("mat-mdc-tab-group-dynamic-height",n.dynamicHeight)("mat-mdc-tab-group-inverted-header",n.headerPosition==="below")("mat-mdc-tab-group-stretch-tabs",n.stretchTabs))},inputs:{color:"color",fitInkBarToContent:[2,"fitInkBarToContent","fitInkBarToContent",g],stretchTabs:[2,"mat-stretch-tabs","stretchTabs",g],alignTabs:[0,"mat-align-tabs","alignTabs"],dynamicHeight:[2,"dynamicHeight","dynamicHeight",g],selectedIndex:[2,"selectedIndex","selectedIndex",it],headerPosition:"headerPosition",animationDuration:"animationDuration",contentTabIndex:[2,"contentTabIndex","contentTabIndex",it],disablePagination:[2,"disablePagination","disablePagination",g],disableRipple:[2,"disableRipple","disableRipple",g],preserveContent:[2,"preserveContent","preserveContent",g],backgroundColor:"backgroundColor",ariaLabel:[0,"aria-label","ariaLabel"],ariaLabelledby:[0,"aria-labelledby","ariaLabelledby"]},outputs:{selectedIndexChange:"selectedIndexChange",focusChange:"focusChange",animationDone:"animationDone",selectedTabChange:"selectedTabChange"},exportAs:["matTabGroup"],features:[j([{provide:De,useExisting:a}])],ngContentSelectors:Mt,decls:9,vars:8,consts:[["tabHeader",""],["tabBodyWrapper",""],["tabNode",""],[3,"indexFocused","selectFocusedIndex","selectedIndex","disableRipple","disablePagination","aria-label","aria-labelledby"],["role","tab","matTabLabelWrapper","","cdkMonitorElementFocus","",1,"mdc-tab","mat-mdc-tab","mat-focus-indicator",3,"id","mdc-tab--active","class","disabled","fitInkBarToContent"],[1,"mat-mdc-tab-body-wrapper"],["role","tabpanel",3,"id","class","content","position","animationDuration","preserveContent"],["role","tab","matTabLabelWrapper","","cdkMonitorElementFocus","",1,"mdc-tab","mat-mdc-tab","mat-focus-indicator",3,"click","cdkFocusChange","id","disabled","fitInkBarToContent"],[1,"mdc-tab__ripple"],["mat-ripple","",1,"mat-mdc-tab-ripple",3,"matRippleTrigger","matRippleDisabled"],[1,"mdc-tab__content"],[1,"mdc-tab__text-label"],[3,"cdkPortalOutlet"],["role","tabpanel",3,"_onCentered","_onCentering","_beforeCentering","id","content","position","animationDuration","preserveContent"]],template:function(e,n){e&1&&(Y(),s(0,"mat-tab-header",3,0),f("indexFocused",function(d){return n._focusChanged(d)})("selectFocusedIndex",function(d){return n.selectedIndex=d}),S(2,Ke,8,17,"div",4,ft),c(),C(4,Ue,1,0),s(5,"div",5,1),S(7,Ye,1,10,"mat-tab-body",6,ft),c()),e&2&&(u("selectedIndex",n.selectedIndex||0)("disableRipple",n.disableRipple)("disablePagination",n.disablePagination),Gt("aria-label",n.ariaLabel)("aria-labelledby",n.ariaLabelledby),l(2),A(n._tabs),l(2),x(n._isServer?4:-1),l(),k("_mat-animation-noopable",n._animationsDisabled()),l(2),A(n._tabs))},dependencies:[sn,Be,ee,Ct,xt,It],styles:[`.mdc-tab {
  min-width: 90px;
  padding: 0 24px;
  display: flex;
  flex: 1 0 auto;
  justify-content: center;
  box-sizing: border-box;
  border: none;
  outline: none;
  text-align: center;
  white-space: nowrap;
  cursor: pointer;
  z-index: 1;
  touch-action: manipulation;
}

.mdc-tab__content {
  display: flex;
  align-items: center;
  justify-content: center;
  height: inherit;
  pointer-events: none;
}

.mdc-tab__text-label {
  transition: 150ms color linear;
  display: inline-block;
  line-height: 1;
  z-index: 2;
}

.mdc-tab--active .mdc-tab__text-label {
  transition-delay: 100ms;
}

._mat-animation-noopable .mdc-tab__text-label {
  transition: none;
}

.mdc-tab-indicator {
  display: flex;
  position: absolute;
  top: 0;
  left: 0;
  justify-content: center;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

.mdc-tab-indicator__content {
  transition: var(--mat-tab-animation-duration, 250ms) transform cubic-bezier(0.4, 0, 0.2, 1);
  transform-origin: left;
  opacity: 0;
}

.mdc-tab-indicator__content--underline {
  align-self: flex-end;
  box-sizing: border-box;
  width: 100%;
  border-top-style: solid;
}

.mdc-tab-indicator--active .mdc-tab-indicator__content {
  opacity: 1;
}

._mat-animation-noopable .mdc-tab-indicator__content, .mdc-tab-indicator--no-transition .mdc-tab-indicator__content {
  transition: none;
}

.mat-mdc-tab-ripple.mat-mdc-tab-ripple {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  pointer-events: none;
}

.mat-mdc-tab {
  -webkit-tap-highlight-color: transparent;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-decoration: none;
  background: none;
  height: var(--mat-tab-container-height, 48px);
  font-family: var(--mat-tab-label-text-font, var(--mat-sys-title-small-font));
  font-size: var(--mat-tab-label-text-size, var(--mat-sys-title-small-size));
  letter-spacing: var(--mat-tab-label-text-tracking, var(--mat-sys-title-small-tracking));
  line-height: var(--mat-tab-label-text-line-height, var(--mat-sys-title-small-line-height));
  font-weight: var(--mat-tab-label-text-weight, var(--mat-sys-title-small-weight));
}
.mat-mdc-tab.mdc-tab {
  flex-grow: 0;
}
.mat-mdc-tab .mdc-tab-indicator__content--underline {
  border-color: var(--mat-tab-active-indicator-color, var(--mat-sys-primary));
  border-top-width: var(--mat-tab-active-indicator-height, 2px);
  border-radius: var(--mat-tab-active-indicator-shape, 0);
}
.mat-mdc-tab:hover .mdc-tab__text-label {
  color: var(--mat-tab-inactive-hover-label-text-color, var(--mat-sys-on-surface));
}
.mat-mdc-tab:focus .mdc-tab__text-label {
  color: var(--mat-tab-inactive-focus-label-text-color, var(--mat-sys-on-surface));
}
.mat-mdc-tab.mdc-tab--active .mdc-tab__text-label {
  color: var(--mat-tab-active-label-text-color, var(--mat-sys-on-surface));
}
.mat-mdc-tab.mdc-tab--active .mdc-tab__ripple::before,
.mat-mdc-tab.mdc-tab--active .mat-ripple-element {
  background-color: var(--mat-tab-active-ripple-color, var(--mat-sys-on-surface));
}
.mat-mdc-tab.mdc-tab--active:hover .mdc-tab__text-label {
  color: var(--mat-tab-active-hover-label-text-color, var(--mat-sys-on-surface));
}
.mat-mdc-tab.mdc-tab--active:hover .mdc-tab-indicator__content--underline {
  border-color: var(--mat-tab-active-hover-indicator-color, var(--mat-sys-primary));
}
.mat-mdc-tab.mdc-tab--active:focus .mdc-tab__text-label {
  color: var(--mat-tab-active-focus-label-text-color, var(--mat-sys-on-surface));
}
.mat-mdc-tab.mdc-tab--active:focus .mdc-tab-indicator__content--underline {
  border-color: var(--mat-tab-active-focus-indicator-color, var(--mat-sys-primary));
}
.mat-mdc-tab.mat-mdc-tab-disabled {
  opacity: 0.4;
  pointer-events: none;
}
.mat-mdc-tab.mat-mdc-tab-disabled .mdc-tab__content {
  pointer-events: none;
}
.mat-mdc-tab.mat-mdc-tab-disabled .mdc-tab__ripple::before,
.mat-mdc-tab.mat-mdc-tab-disabled .mat-ripple-element {
  background-color: var(--mat-tab-disabled-ripple-color, var(--mat-sys-on-surface-variant));
}
.mat-mdc-tab .mdc-tab__ripple::before {
  content: "";
  display: block;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  opacity: 0;
  pointer-events: none;
  background-color: var(--mat-tab-inactive-ripple-color, var(--mat-sys-on-surface));
}
.mat-mdc-tab .mdc-tab__text-label {
  color: var(--mat-tab-inactive-label-text-color, var(--mat-sys-on-surface));
  display: inline-flex;
  align-items: center;
}
.mat-mdc-tab .mdc-tab__content {
  position: relative;
  pointer-events: auto;
}
.mat-mdc-tab:hover .mdc-tab__ripple::before {
  opacity: 0.04;
}
.mat-mdc-tab.cdk-program-focused .mdc-tab__ripple::before, .mat-mdc-tab.cdk-keyboard-focused .mdc-tab__ripple::before {
  opacity: 0.12;
}
.mat-mdc-tab .mat-ripple-element {
  opacity: 0.12;
  background-color: var(--mat-tab-inactive-ripple-color, var(--mat-sys-on-surface));
}
.mat-mdc-tab-group.mat-mdc-tab-group-stretch-tabs > .mat-mdc-tab-header .mat-mdc-tab {
  flex-grow: 1;
}

.mat-mdc-tab-group {
  display: flex;
  flex-direction: column;
  max-width: 100%;
}
.mat-mdc-tab-group.mat-tabs-with-background > .mat-mdc-tab-header, .mat-mdc-tab-group.mat-tabs-with-background > .mat-mdc-tab-header-pagination {
  background-color: var(--mat-tab-background-color);
}
.mat-mdc-tab-group.mat-tabs-with-background.mat-primary > .mat-mdc-tab-header .mat-mdc-tab .mdc-tab__text-label {
  color: var(--mat-tab-foreground-color);
}
.mat-mdc-tab-group.mat-tabs-with-background.mat-primary > .mat-mdc-tab-header .mdc-tab-indicator__content--underline {
  border-color: var(--mat-tab-foreground-color);
}
.mat-mdc-tab-group.mat-tabs-with-background:not(.mat-primary) > .mat-mdc-tab-header .mat-mdc-tab:not(.mdc-tab--active) .mdc-tab__text-label {
  color: var(--mat-tab-foreground-color);
}
.mat-mdc-tab-group.mat-tabs-with-background:not(.mat-primary) > .mat-mdc-tab-header .mat-mdc-tab:not(.mdc-tab--active) .mdc-tab-indicator__content--underline {
  border-color: var(--mat-tab-foreground-color);
}
.mat-mdc-tab-group.mat-tabs-with-background > .mat-mdc-tab-header .mat-mdc-tab-header-pagination-chevron,
.mat-mdc-tab-group.mat-tabs-with-background > .mat-mdc-tab-header .mat-focus-indicator::before, .mat-mdc-tab-group.mat-tabs-with-background > .mat-mdc-tab-header-pagination .mat-mdc-tab-header-pagination-chevron,
.mat-mdc-tab-group.mat-tabs-with-background > .mat-mdc-tab-header-pagination .mat-focus-indicator::before {
  border-color: var(--mat-tab-foreground-color);
}
.mat-mdc-tab-group.mat-tabs-with-background > .mat-mdc-tab-header .mat-ripple-element, .mat-mdc-tab-group.mat-tabs-with-background > .mat-mdc-tab-header .mdc-tab__ripple::before, .mat-mdc-tab-group.mat-tabs-with-background > .mat-mdc-tab-header-pagination .mat-ripple-element, .mat-mdc-tab-group.mat-tabs-with-background > .mat-mdc-tab-header-pagination .mdc-tab__ripple::before {
  background-color: var(--mat-tab-foreground-color);
}
.mat-mdc-tab-group.mat-tabs-with-background > .mat-mdc-tab-header .mat-mdc-tab-header-pagination-chevron, .mat-mdc-tab-group.mat-tabs-with-background > .mat-mdc-tab-header-pagination .mat-mdc-tab-header-pagination-chevron {
  color: var(--mat-tab-foreground-color);
}
.mat-mdc-tab-group.mat-mdc-tab-group-inverted-header {
  flex-direction: column-reverse;
}
.mat-mdc-tab-group.mat-mdc-tab-group-inverted-header .mdc-tab-indicator__content--underline {
  align-self: flex-start;
}

.mat-mdc-tab-body-wrapper {
  position: relative;
  overflow: hidden;
  display: flex;
  transition: height 500ms cubic-bezier(0.35, 0, 0.25, 1);
}
.mat-mdc-tab-body-wrapper._mat-animation-noopable {
  transition: none !important;
  animation: none !important;
}
`],encapsulation:2})}return a})(),wt=class{index;tab};var Ee=(()=>{class a{static \u0275fac=function(e){return new(e||a)};static \u0275mod=jt({type:a});static \u0275inj=Nt({imports:[Kt]})}return a})();function pn(a,o){if(a&1&&M(0,"img",0),a&2){let t=m();u("src",t.producto.imagenUrl,Qt)("alt",t.producto.nombre)}}function hn(a,o){a&1&&(s(0,"div",1),b(1,"\u{1F357}"),c())}function un(a,o){if(a&1&&(s(0,"p",3),b(1),c()),a&2){let t=m();l(),Q(t.producto.descripcion)}}function _n(a,o){if(a&1){let t=P();s(0,"button",10),f("click",function(){v(t);let n=m();return y(n.onAgregar())}),s(1,"mat-icon"),b(2,"add_shopping_cart"),c(),b(3," Agregar "),c()}}function fn(a,o){a&1&&(s(0,"span",9),b(1,"No disponible"),c())}var lt=class a{producto;agregar=new _;onAgregar(){this.producto.disponible&&this.agregar.emit(this.producto)}static \u0275fac=function(t){return new(t||a)};static \u0275cmp=T({type:a,selectors:[["app-producto-card"]],inputs:{producto:"producto"},outputs:{agregar:"agregar"},decls:17,vars:9,consts:[["mat-card-image","",1,"product-image",3,"src","alt"],[1,"product-image-placeholder"],[1,"product-name"],[1,"product-description"],[1,"product-footer"],[1,"product-price"],["color","primary","highlighted","",1,"categoria-chip"],["align","end"],["mat-raised-button","","color","primary"],[1,"not-available"],["mat-raised-button","","color","primary",3,"click"]],template:function(t,e){t&1&&(s(0,"mat-card"),C(1,pn,1,2,"img",0)(2,hn,2,0,"div",1),s(3,"mat-card-content")(4,"p",2),b(5),c(),C(6,un,2,1,"p",3),s(7,"div",4)(8,"span",5),b(9),et(10,"number"),c(),s(11,"mat-chip-set")(12,"mat-chip",6),b(13),c()()()(),s(14,"mat-card-actions",7),C(15,_n,4,0,"button",8)(16,fn,2,0,"span",9),c()()),t&2&&(l(),x(e.producto.imagenUrl?1:2),l(4),Q(e.producto.nombre),l(),x(e.producto.descripcion?6:-1),l(3),V("S/ ",nt(10,6,e.producto.precio,"1.2-2")),l(4),V(" ",e.producto.categoria," "),l(2),x(e.producto.disponible?15:16))},dependencies:[te,Ut,Xt,Yt,Jt,st,ce,ct,dt,ke,Ce,xe,ot],styles:["mat-card[_ngcontent-%COMP%]{height:100%;display:flex;flex-direction:column;transition:box-shadow .2s ease}mat-card[_ngcontent-%COMP%]:hover{box-shadow:0 4px 16px #00000026}.product-image[_ngcontent-%COMP%]{width:100%;height:160px;object-fit:cover}.product-image-placeholder[_ngcontent-%COMP%]{width:100%;height:160px;background:linear-gradient(135deg,#ff6d00,#ffca28);display:flex;align-items:center;justify-content:center;font-size:4rem}.product-name[_ngcontent-%COMP%]{font-size:1rem;font-weight:600;margin-bottom:4px}.product-description[_ngcontent-%COMP%]{font-size:.8rem;color:#757575;margin-bottom:8px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.product-price[_ngcontent-%COMP%]{font-size:1.2rem;font-weight:700;color:#e65100}.product-footer[_ngcontent-%COMP%]{margin-top:auto;display:flex;align-items:center;justify-content:space-between;padding-top:8px}.categoria-chip[_ngcontent-%COMP%]{font-size:.7rem}.not-available[_ngcontent-%COMP%]{color:#9e9e9e;font-size:.8rem;font-style:italic}"]})};var gn=(a,o)=>o.nombre,vn=(a,o)=>o.id;function yn(a,o){a&1&&(s(0,"div",2),M(1,"mat-spinner",5),c())}function Cn(a,o){a&1&&(s(0,"p",7),b(1,"No hay productos disponibles en esta categor\xEDa."),c())}function xn(a,o){if(a&1){let t=P();s(0,"app-producto-card",10),f("agregar",function(n){v(t);let i=m(4);return y(i.agregarAlCarrito(n))}),c()}if(a&2){let t=o.$implicit;u("producto",t)}}function kn(a,o){if(a&1&&(s(0,"div",8),S(1,xn,1,1,"app-producto-card",9,vn),c()),a&2){let t=m().$implicit;l(),A(t.productos)}}function Tn(a,o){if(a&1&&(s(0,"mat-tab",6),C(1,Cn,2,0,"p",7)(2,kn,3,0,"div",8),c()),a&2){let t=o.$implicit;u("label",t.label),l(),x(t.productos.length===0?1:2)}}function In(a,o){if(a&1&&(s(0,"mat-tab-group",3),S(1,Tn,3,2,"mat-tab",6,gn),c()),a&2){let t=m();l(),A(t.categorias())}}function wn(a,o){if(a&1){let t=P();s(0,"div",4)(1,"button",11),f("click",function(){v(t);let n=m();return y(n.verCarrito())}),s(2,"mat-icon"),b(3,"shopping_cart"),c(),b(4," Ver Pedido "),s(5,"span",12),b(6),et(7,"number"),c()()()}if(a&2){let t=m();l(),u("matBadge",t.totalItems()),l(5),V("S/ ",nt(7,2,t.totalPrice(),"1.2-2"))}}var Le=class a{productoService=r(ye);auth=r(Zt);router=r(qt);snackBar=r(ue);loading=N(!0);categorias=N([]);carrito=N([]);totalItems=W(()=>this.carrito().reduce((o,t)=>o+t.cantidad,0));totalPrice=W(()=>this.carrito().reduce((o,t)=>o+t.producto.precio*t.cantidad,0));isAuthenticated=W(()=>this.auth.isAuthenticated());ngOnInit(){this.cargarProductos()}cargarProductos(){this.loading.set(!0),this.productoService.getCartaDisponible().subscribe({next:o=>{let t=new Map;for(let n of o)t.has(n.categoria)||t.set(n.categoria,[]),t.get(n.categoria).push(n);let e=Array.from(t.entries()).map(([n,i])=>({nombre:n,label:this.labelCategoria(n),productos:i}));this.categorias.set(e),this.loading.set(!1)},error:()=>{this.loading.set(!1),this.snackBar.open("Error al cargar la carta. Intenta de nuevo.","OK",{duration:3e3})}})}agregarAlCarrito(o){this.carrito.update(t=>{let e=t.findIndex(n=>n.producto.id===o.id);if(e>=0){let n=[...t];return n[e]=pt(bt({},n[e]),{cantidad:n[e].cantidad+1}),n}return[...t,{producto:o,cantidad:1}]}),this.snackBar.open(`${o.nombre} agregado al carrito`,"OK",{duration:1500})}quitarDelCarrito(o){this.carrito.update(t=>{let e=t.findIndex(i=>i.producto.id===o);if(e<0)return t;let n=[...t];return n[e].cantidad>1?n[e]=pt(bt({},n[e]),{cantidad:n[e].cantidad-1}):n.splice(e,1),n})}verCarrito(){if(!this.isAuthenticated()){this.snackBar.open("Debes iniciar sesi\xF3n para hacer un pedido","Ingresar",{duration:4e3}).onAction().subscribe(()=>this.router.navigate(["/login"]));return}if(this.carrito().length===0){this.snackBar.open("El carrito est\xE1 vac\xEDo","OK",{duration:2e3});return}this.router.navigate(["/pedido"],{state:{carrito:this.carrito()}})}labelCategoria(o){return{POLLO_ENTERO:"Pollo Entero",MEDIO_POLLO:"1/2 Pollo",CUARTO_POLLO:"1/4 Pollo",COMBO:"Combos",PARRILLA:"Parrilla",GUARNICION:"Guarniciones",BEBIDA:"Bebidas",POSTRE:"Postres",PROMOCION:"Promociones"}[o]??o}static \u0275fac=function(t){return new(t||a)};static \u0275cmp=T({type:a,selectors:[["app-carta"]],decls:6,vars:2,consts:[[1,"carta-container"],[1,"page-title"],[1,"loading-container"],["animationDuration","200ms","dynamicHeight",""],[1,"cart-fab"],["diameter","48"],[3,"label"],[1,"empty-category"],[1,"productos-grid"],[3,"producto"],[3,"agregar","producto"],["mat-fab","","extended","","color","accent","matBadgeColor","warn",3,"click","matBadge"],[1,"cart-total"]],template:function(t,e){t&1&&(s(0,"div",0)(1,"h1",1),b(2,"\u{1F357} Nuestra Carta"),c(),C(3,yn,2,0,"div",2)(4,In,3,0,"mat-tab-group",3),c(),C(5,wn,8,5,"div",4)),t&2&&(l(3),x(e.loading()?3:4),l(2),x(e.totalItems()>0?5:-1))},dependencies:[Ee,Pt,Re,st,le,ct,dt,fe,_e,ve,ge,lt,ot],styles:[".carta-container[_ngcontent-%COMP%]{padding:16px;max-width:1200px;margin:0 auto}.page-title[_ngcontent-%COMP%]{font-size:2rem;font-weight:700;margin-bottom:16px;color:#e65100}.loading-container[_ngcontent-%COMP%]{display:flex;justify-content:center;align-items:center;height:200px}.productos-grid[_ngcontent-%COMP%]{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px;padding:16px 0}.empty-category[_ngcontent-%COMP%]{text-align:center;padding:48px;color:#9e9e9e;font-size:1rem}.cart-fab[_ngcontent-%COMP%]{position:fixed;bottom:24px;right:24px;z-index:100}.cart-total[_ngcontent-%COMP%]{font-size:.75rem;margin-left:4px}"]})};export{Le as CartaComponent};

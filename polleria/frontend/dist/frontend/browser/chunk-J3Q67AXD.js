import{g as W,h as be,i as ve,k as _,l as y,m as L,o as De,p as Ce,q as Ae,s as R,u as Te,x as P}from"./chunk-52I5MSGL.js";import{B as pe,K as fe,L as _e,N as ye,O as S,R as F,ca as G,u as z,v as ue,w as E,y as ge,z as H}from"./chunk-ON2FWBKE.js";import{$a as ie,A as K,Aa as V,Ac as me,B as f,Eb as oe,Fb as se,G as p,Ob as re,P as D,X as C,Xb as le,Y as A,Yb as de,Zb as ce,_ as u,a as c,aa as r,ab as ne,b as $,cb as ae,dc as he,h as m,j as N,jb as O,ka as h,kb as x,la as X,nb as w,oa as T,ob as k,pa as J,ta as ee,x as v,xb as I,ya as te}from"./chunk-3ERAQQI7.js";function Fe(n,a){}var g=class{viewContainerRef;injector;id;role="dialog";panelClass="";hasBackdrop=!0;backdropClass="";disableClose=!1;closePredicate;width="";height="";minWidth;minHeight;maxWidth;maxHeight;positionStrategy;data=null;direction;ariaDescribedBy=null;ariaLabelledBy=null;ariaLabel=null;ariaModal=!1;autoFocus="first-tabbable";restoreFocus=!0;scrollStrategy;closeOnNavigation=!0;closeOnDestroy=!0;closeOnOverlayDetachments=!0;disableAnimations=!1;providers;container;templateContext};var q=(()=>{class n extends ve{_elementRef=r(V);_focusTrapFactory=r(_e);_config;_interactivityChecker=r(fe);_ngZone=r(J);_focusMonitor=r(pe);_renderer=r(ae);_changeDetectorRef=r(me);_injector=r(h);_platform=r(ge);_document=r(X);_portalOutlet;_focusTrapped=new m;_focusTrap=null;_elementFocusedBeforeDialogWasOpened=null;_closeInteractionType=null;_ariaLabelledByQueue=[];_isDestroyed=!1;constructor(){super(),this._config=r(g,{optional:!0})||new g,this._config.ariaLabelledBy&&this._ariaLabelledByQueue.push(this._config.ariaLabelledBy)}_addAriaLabelledBy(e){this._ariaLabelledByQueue.push(e),this._changeDetectorRef.markForCheck()}_removeAriaLabelledBy(e){let t=this._ariaLabelledByQueue.indexOf(e);t>-1&&(this._ariaLabelledByQueue.splice(t,1),this._changeDetectorRef.markForCheck())}_contentAttached(){this._initializeFocusTrap(),this._captureInitialFocus()}_captureInitialFocus(){this._trapFocus()}ngOnDestroy(){this._focusTrapped.complete(),this._isDestroyed=!0,this._restoreFocus()}attachComponentPortal(e){this._portalOutlet.hasAttached();let t=this._portalOutlet.attachComponentPortal(e);return this._contentAttached(),t}attachTemplatePortal(e){this._portalOutlet.hasAttached();let t=this._portalOutlet.attachTemplatePortal(e);return this._contentAttached(),t}attachDomPortal=e=>{this._portalOutlet.hasAttached();let t=this._portalOutlet.attachDomPortal(e);return this._contentAttached(),t};_recaptureFocus(){this._containsFocus()||this._trapFocus()}_forceFocus(e,t){this._interactivityChecker.isFocusable(e)||(e.tabIndex=-1,this._ngZone.runOutsideAngular(()=>{let i=()=>{o(),l(),e.removeAttribute("tabindex")},o=this._renderer.listen(e,"blur",i),l=this._renderer.listen(e,"mousedown",i)})),e.focus(t)}_focusByCssSelector(e,t){let i=this._elementRef.nativeElement.querySelector(e);i&&this._forceFocus(i,t)}_trapFocus(e){this._isDestroyed||ie(()=>{let t=this._elementRef.nativeElement;switch(this._config.autoFocus){case!1:case"dialog":this._containsFocus()||t.focus(e);break;case!0:case"first-tabbable":this._focusTrap?.focusInitialElement(e)||this._focusDialogContainer(e);break;case"first-heading":this._focusByCssSelector('h1, h2, h3, h4, h5, h6, [role="heading"]',e);break;default:this._focusByCssSelector(this._config.autoFocus,e);break}this._focusTrapped.next()},{injector:this._injector})}_restoreFocus(){let e=this._config.restoreFocus,t=null;if(typeof e=="string"?t=this._document.querySelector(e):typeof e=="boolean"?t=e?this._elementFocusedBeforeDialogWasOpened:null:e&&(t=e),this._config.restoreFocus&&t&&typeof t.focus=="function"){let i=E(),o=this._elementRef.nativeElement;(!i||i===this._document.body||i===o||o.contains(i))&&(this._focusMonitor?(this._focusMonitor.focusVia(t,this._closeInteractionType),this._closeInteractionType=null):t.focus())}this._focusTrap&&this._focusTrap.destroy()}_focusDialogContainer(e){this._elementRef.nativeElement.focus?.(e)}_containsFocus(){let e=this._elementRef.nativeElement,t=E();return e===t||e.contains(t)}_initializeFocusTrap(){this._platform.isBrowser&&(this._focusTrap=this._focusTrapFactory.create(this._elementRef.nativeElement),this._document&&(this._elementFocusedBeforeDialogWasOpened=E()))}static \u0275fac=function(t){return new(t||n)};static \u0275cmp=O({type:n,selectors:[["cdk-dialog-container"]],viewQuery:function(t,i){if(t&1&&le(_,7),t&2){let o;de(o=ce())&&(i._portalOutlet=o.first)}},hostAttrs:["tabindex","-1",1,"cdk-dialog-container"],hostVars:6,hostBindings:function(t,i){t&2&&I("id",i._config.id||null)("role",i._config.role)("aria-modal",i._config.ariaModal)("aria-labelledby",i._config.ariaLabel?null:i._ariaLabelledByQueue[0])("aria-label",i._config.ariaLabel)("aria-describedby",i._config.ariaDescribedBy||null)},features:[w],decls:1,vars:0,consts:[["cdkPortalOutlet",""]],template:function(t,i){t&1&&k(0,Fe,0,0,"ng-template",0)},dependencies:[_],styles:[`.cdk-dialog-container {
  display: block;
  width: 100%;
  height: 100%;
  min-height: inherit;
  max-height: inherit;
}
`],encapsulation:2})}return n})(),b=class{overlayRef;config;componentInstance=null;componentRef=null;containerInstance;disableClose;closed=new m;backdropClick;keydownEvents;outsidePointerEvents;id;_detachSubscription;constructor(a,e){this.overlayRef=a,this.config=e,this.disableClose=e.disableClose,this.backdropClick=a.backdropClick(),this.keydownEvents=a.keydownEvents(),this.outsidePointerEvents=a.outsidePointerEvents(),this.id=e.id,this.keydownEvents.subscribe(t=>{t.keyCode===27&&!this.disableClose&&!S(t)&&(t.preventDefault(),this.close(void 0,{focusOrigin:"keyboard"}))}),this.backdropClick.subscribe(()=>{!this.disableClose&&this._canClose()?this.close(void 0,{focusOrigin:"mouse"}):this.containerInstance._recaptureFocus?.()}),this._detachSubscription=a.detachments().subscribe(()=>{e.closeOnOverlayDetachments!==!1&&this.close()})}close(a,e){if(this._canClose(a)){let t=this.closed;this.containerInstance._closeInteractionType=e?.focusOrigin||"program",this._detachSubscription.unsubscribe(),this.overlayRef.dispose(),t.next(a),t.complete(),this.componentInstance=this.containerInstance=null}}updatePosition(){return this.overlayRef.updatePosition(),this}updateSize(a="",e=""){return this.overlayRef.updateSize({width:a,height:e}),this}addPanelClass(a){return this.overlayRef.addPanelClass(a),this}removePanelClass(a){return this.overlayRef.removePanelClass(a),this}_canClose(a){let e=this.config;return!!this.containerInstance&&(!e.closePredicate||e.closePredicate(a,e,this.componentInstance))}},Le=new u("DialogScrollStrategy",{providedIn:"root",factory:()=>{let n=r(h);return()=>L(n)}}),Re=new u("DialogData"),Pe=new u("DefaultDialogConfig");function Me(n){let a=ee(n),e=new T;return{valueSignal:a,get value(){return a()},change:e,ngOnDestroy(){e.complete()}}}var U=(()=>{class n{_injector=r(h);_defaultOptions=r(Pe,{optional:!0});_parentDialog=r(n,{optional:!0,skipSelf:!0});_overlayContainer=r(Ce);_idGenerator=r(F);_openDialogsAtThisLevel=[];_afterAllClosedAtThisLevel=new m;_afterOpenedAtThisLevel=new m;_ariaHiddenElements=new Map;_scrollStrategy=r(Le);get openDialogs(){return this._parentDialog?this._parentDialog.openDialogs:this._openDialogsAtThisLevel}get afterOpened(){return this._parentDialog?this._parentDialog.afterOpened:this._afterOpenedAtThisLevel}afterAllClosed=v(()=>this.openDialogs.length?this._getAfterAllClosed():this._getAfterAllClosed().pipe(D(void 0)));constructor(){}open(e,t){let i=this._defaultOptions||new g;t=c(c({},i),t),t.id=t.id||this._idGenerator.getId("cdk-dialog-"),t.id&&this.getDialogById(t.id);let o=this._getOverlayConfig(t),l=Te(this._injector,o),s=new b(l,t),d=this._attachContainer(l,s,t);if(s.containerInstance=d,!this.openDialogs.length){let j=this._overlayContainer.getContainerElement();d._focusTrapped?d._focusTrapped.pipe(p(1)).subscribe(()=>{this._hideNonDialogContentFromAssistiveTechnology(j)}):this._hideNonDialogContentFromAssistiveTechnology(j)}return this._attachDialogContent(e,s,d,t),this.openDialogs.push(s),s.closed.subscribe(()=>this._removeOpenDialog(s,!0)),this.afterOpened.next(s),s}closeAll(){Q(this.openDialogs,e=>e.close())}getDialogById(e){return this.openDialogs.find(t=>t.id===e)}ngOnDestroy(){Q(this._openDialogsAtThisLevel,e=>{e.config.closeOnDestroy===!1&&this._removeOpenDialog(e,!1)}),Q(this._openDialogsAtThisLevel,e=>e.close()),this._afterAllClosedAtThisLevel.complete(),this._afterOpenedAtThisLevel.complete(),this._openDialogsAtThisLevel=[]}_getOverlayConfig(e){let t=new De({positionStrategy:e.positionStrategy||R().centerHorizontally().centerVertically(),scrollStrategy:e.scrollStrategy||this._scrollStrategy(),panelClass:e.panelClass,hasBackdrop:e.hasBackdrop,direction:e.direction,minWidth:e.minWidth,minHeight:e.minHeight,maxWidth:e.maxWidth,maxHeight:e.maxHeight,width:e.width,height:e.height,disposeOnNavigation:e.closeOnNavigation,disableAnimations:e.disableAnimations});return e.backdropClass&&(t.backdropClass=e.backdropClass),t}_attachContainer(e,t,i){let o=i.injector||i.viewContainerRef?.injector,l=[{provide:g,useValue:i},{provide:b,useValue:t},{provide:Ae,useValue:e}],s;i.container?typeof i.container=="function"?s=i.container:(s=i.container.type,l.push(...i.container.providers(i))):s=q;let d=new W(s,i.viewContainerRef,h.create({parent:o||this._injector,providers:l}));return e.attach(d).instance}_attachDialogContent(e,t,i,o){if(e instanceof ne){let l=this._createInjector(o,t,i,void 0),s={$implicit:o.data,dialogRef:t};o.templateContext&&(s=c(c({},s),typeof o.templateContext=="function"?o.templateContext():o.templateContext)),i.attachTemplatePortal(new be(e,null,s,l))}else{let l=this._createInjector(o,t,i,this._injector),s=i.attachComponentPortal(new W(e,o.viewContainerRef,l));t.componentRef=s,t.componentInstance=s.instance}}_createInjector(e,t,i,o){let l=e.injector||e.viewContainerRef?.injector,s=[{provide:Re,useValue:e.data},{provide:b,useValue:t}];return e.providers&&(typeof e.providers=="function"?s.push(...e.providers(t,e,i)):s.push(...e.providers)),e.direction&&(!l||!l.get(z,null,{optional:!0}))&&s.push({provide:z,useValue:Me(e.direction)}),h.create({parent:l||o,providers:s})}_removeOpenDialog(e,t){let i=this.openDialogs.indexOf(e);i>-1&&(this.openDialogs.splice(i,1),this.openDialogs.length||(this._ariaHiddenElements.forEach((o,l)=>{o?l.setAttribute("aria-hidden",o):l.removeAttribute("aria-hidden")}),this._ariaHiddenElements.clear(),t&&this._getAfterAllClosed().next()))}_hideNonDialogContentFromAssistiveTechnology(e){if(e.parentElement){let t=e.parentElement.children;for(let i=t.length-1;i>-1;i--){let o=t[i];o!==e&&o.nodeName!=="SCRIPT"&&o.nodeName!=="STYLE"&&!o.hasAttribute("aria-live")&&!o.hasAttribute("popover")&&(this._ariaHiddenElements.set(o,o.getAttribute("aria-hidden")),o.setAttribute("aria-hidden","true"))}}}_getAfterAllClosed(){let e=this._parentDialog;return e?e._getAfterAllClosed():this._afterAllClosedAtThisLevel}static \u0275fac=function(t){return new(t||n)};static \u0275prov=C({token:n,factory:n.\u0275fac,providedIn:"root"})}return n})();function Q(n,a){let e=n.length;for(;e--;)a(n[e])}var xe=(()=>{class n{static \u0275fac=function(t){return new(t||n)};static \u0275mod=x({type:n});static \u0275inj=A({providers:[U],imports:[P,y,ye,y]})}return n})();function Be(n,a){}var B=class{viewContainerRef;injector;id;role="dialog";panelClass="";hasBackdrop=!0;backdropClass="";disableClose=!1;closePredicate;width="";height="";minWidth;minHeight;maxWidth;maxHeight;position;data=null;direction;ariaDescribedBy=null;ariaLabelledBy=null;ariaLabel=null;ariaModal=!1;autoFocus="first-tabbable";restoreFocus=!0;delayFocusTrap=!0;scrollStrategy;closeOnNavigation=!0;enterAnimationDuration;exitAnimationDuration},Y="mdc-dialog--open",we="mdc-dialog--opening",ke="mdc-dialog--closing",je=150,Ne=75,Ve=(()=>{class n extends q{_animationStateChanged=new T;_animationsEnabled=!G();_actionSectionCount=0;_hostElement=this._elementRef.nativeElement;_enterAnimationDuration=this._animationsEnabled?Ee(this._config.enterAnimationDuration)??je:0;_exitAnimationDuration=this._animationsEnabled?Ee(this._config.exitAnimationDuration)??Ne:0;_animationTimer=null;_contentAttached(){super._contentAttached(),this._startOpenAnimation()}_startOpenAnimation(){this._animationStateChanged.emit({state:"opening",totalTime:this._enterAnimationDuration}),this._animationsEnabled?(this._hostElement.style.setProperty(Ie,`${this._enterAnimationDuration}ms`),this._requestAnimationFrame(()=>this._hostElement.classList.add(we,Y)),this._waitForAnimationToComplete(this._enterAnimationDuration,this._finishDialogOpen)):(this._hostElement.classList.add(Y),Promise.resolve().then(()=>this._finishDialogOpen()))}_startExitAnimation(){this._animationStateChanged.emit({state:"closing",totalTime:this._exitAnimationDuration}),this._hostElement.classList.remove(Y),this._animationsEnabled?(this._hostElement.style.setProperty(Ie,`${this._exitAnimationDuration}ms`),this._requestAnimationFrame(()=>this._hostElement.classList.add(ke)),this._waitForAnimationToComplete(this._exitAnimationDuration,this._finishDialogClose)):Promise.resolve().then(()=>this._finishDialogClose())}_updateActionSectionCount(e){this._actionSectionCount+=e,this._changeDetectorRef.markForCheck()}_finishDialogOpen=()=>{this._clearAnimationClasses(),this._openAnimationDone(this._enterAnimationDuration)};_finishDialogClose=()=>{this._clearAnimationClasses(),this._animationStateChanged.emit({state:"closed",totalTime:this._exitAnimationDuration})};_clearAnimationClasses(){this._hostElement.classList.remove(we,ke)}_waitForAnimationToComplete(e,t){this._animationTimer!==null&&clearTimeout(this._animationTimer),this._animationTimer=setTimeout(t,e)}_requestAnimationFrame(e){this._ngZone.runOutsideAngular(()=>{typeof requestAnimationFrame=="function"?requestAnimationFrame(e):e()})}_captureInitialFocus(){this._config.delayFocusTrap||this._trapFocus()}_openAnimationDone(e){this._config.delayFocusTrap&&this._trapFocus(),this._animationStateChanged.next({state:"opened",totalTime:e})}ngOnDestroy(){super.ngOnDestroy(),this._animationTimer!==null&&clearTimeout(this._animationTimer)}attachComponentPortal(e){let t=super.attachComponentPortal(e);return t.location.nativeElement.classList.add("mat-mdc-dialog-component-host"),t}static \u0275fac=(()=>{let e;return function(i){return(e||(e=te(n)))(i||n)}})();static \u0275cmp=O({type:n,selectors:[["mat-dialog-container"]],hostAttrs:["tabindex","-1",1,"mat-mdc-dialog-container","mdc-dialog"],hostVars:10,hostBindings:function(t,i){t&2&&(re("id",i._config.id),I("aria-modal",i._config.ariaModal)("role",i._config.role)("aria-labelledby",i._config.ariaLabel?null:i._ariaLabelledByQueue[0])("aria-label",i._config.ariaLabel)("aria-describedby",i._config.ariaDescribedBy||null),he("_mat-animation-noopable",!i._animationsEnabled)("mat-mdc-dialog-container-with-actions",i._actionSectionCount>0))},features:[w],decls:3,vars:0,consts:[[1,"mat-mdc-dialog-inner-container","mdc-dialog__container"],[1,"mat-mdc-dialog-surface","mdc-dialog__surface"],["cdkPortalOutlet",""]],template:function(t,i){t&1&&(oe(0,"div",0)(1,"div",1),k(2,Be,0,0,"ng-template",2),se()())},dependencies:[_],styles:[`.mat-mdc-dialog-container {
  width: 100%;
  height: 100%;
  display: block;
  box-sizing: border-box;
  max-height: inherit;
  min-height: inherit;
  min-width: inherit;
  max-width: inherit;
  outline: 0;
}

.cdk-overlay-pane.mat-mdc-dialog-panel {
  max-width: var(--mat-dialog-container-max-width, 560px);
  min-width: var(--mat-dialog-container-min-width, 280px);
}
@media (max-width: 599px) {
  .cdk-overlay-pane.mat-mdc-dialog-panel {
    max-width: var(--mat-dialog-container-small-max-width, calc(100vw - 32px));
  }
}

.mat-mdc-dialog-inner-container {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-around;
  box-sizing: border-box;
  height: 100%;
  opacity: 0;
  transition: opacity linear var(--mat-dialog-transition-duration, 0ms);
  max-height: inherit;
  min-height: inherit;
  min-width: inherit;
  max-width: inherit;
}
.mdc-dialog--closing .mat-mdc-dialog-inner-container {
  transition: opacity 75ms linear;
  transform: none;
}
.mdc-dialog--open .mat-mdc-dialog-inner-container {
  opacity: 1;
}
._mat-animation-noopable .mat-mdc-dialog-inner-container {
  transition: none;
}

.mat-mdc-dialog-surface {
  display: flex;
  flex-direction: column;
  flex-grow: 0;
  flex-shrink: 0;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  position: relative;
  overflow-y: auto;
  outline: 0;
  transform: scale(0.8);
  transition: transform var(--mat-dialog-transition-duration, 0ms) cubic-bezier(0, 0, 0.2, 1);
  max-height: inherit;
  min-height: inherit;
  min-width: inherit;
  max-width: inherit;
  box-shadow: var(--mat-dialog-container-elevation-shadow, none);
  border-radius: var(--mat-dialog-container-shape, var(--mat-sys-corner-extra-large, 4px));
  background-color: var(--mat-dialog-container-color, var(--mat-sys-surface, white));
}
[dir=rtl] .mat-mdc-dialog-surface {
  text-align: right;
}
.mdc-dialog--open .mat-mdc-dialog-surface, .mdc-dialog--closing .mat-mdc-dialog-surface {
  transform: none;
}
._mat-animation-noopable .mat-mdc-dialog-surface {
  transition: none;
}
.mat-mdc-dialog-surface::before {
  position: absolute;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  border: 2px solid transparent;
  border-radius: inherit;
  content: "";
  pointer-events: none;
}

.mat-mdc-dialog-title {
  display: block;
  position: relative;
  flex-shrink: 0;
  box-sizing: border-box;
  margin: 0 0 1px;
  padding: var(--mat-dialog-headline-padding, 6px 24px 13px);
}
.mat-mdc-dialog-title::before {
  display: inline-block;
  width: 0;
  height: 40px;
  content: "";
  vertical-align: 0;
}
[dir=rtl] .mat-mdc-dialog-title {
  text-align: right;
}
.mat-mdc-dialog-container .mat-mdc-dialog-title {
  color: var(--mat-dialog-subhead-color, var(--mat-sys-on-surface, rgba(0, 0, 0, 0.87)));
  font-family: var(--mat-dialog-subhead-font, var(--mat-sys-headline-small-font, inherit));
  line-height: var(--mat-dialog-subhead-line-height, var(--mat-sys-headline-small-line-height, 1.5rem));
  font-size: var(--mat-dialog-subhead-size, var(--mat-sys-headline-small-size, 1rem));
  font-weight: var(--mat-dialog-subhead-weight, var(--mat-sys-headline-small-weight, 400));
  letter-spacing: var(--mat-dialog-subhead-tracking, var(--mat-sys-headline-small-tracking, 0.03125em));
}

.mat-mdc-dialog-content {
  display: block;
  flex-grow: 1;
  box-sizing: border-box;
  margin: 0;
  overflow: auto;
  max-height: 65vh;
}
.mat-mdc-dialog-content > :first-child {
  margin-top: 0;
}
.mat-mdc-dialog-content > :last-child {
  margin-bottom: 0;
}
.mat-mdc-dialog-container .mat-mdc-dialog-content {
  color: var(--mat-dialog-supporting-text-color, var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6)));
  font-family: var(--mat-dialog-supporting-text-font, var(--mat-sys-body-medium-font, inherit));
  line-height: var(--mat-dialog-supporting-text-line-height, var(--mat-sys-body-medium-line-height, 1.5rem));
  font-size: var(--mat-dialog-supporting-text-size, var(--mat-sys-body-medium-size, 1rem));
  font-weight: var(--mat-dialog-supporting-text-weight, var(--mat-sys-body-medium-weight, 400));
  letter-spacing: var(--mat-dialog-supporting-text-tracking, var(--mat-sys-body-medium-tracking, 0.03125em));
}
.mat-mdc-dialog-container .mat-mdc-dialog-content {
  padding: var(--mat-dialog-content-padding, 20px 24px);
}
.mat-mdc-dialog-container-with-actions .mat-mdc-dialog-content {
  padding: var(--mat-dialog-with-actions-content-padding, 20px 24px 0);
}
.mat-mdc-dialog-container .mat-mdc-dialog-title + .mat-mdc-dialog-content {
  padding-top: 0;
}

.mat-mdc-dialog-actions {
  display: flex;
  position: relative;
  flex-shrink: 0;
  flex-wrap: wrap;
  align-items: center;
  box-sizing: border-box;
  min-height: 52px;
  margin: 0;
  border-top: 1px solid transparent;
  padding: var(--mat-dialog-actions-padding, 16px 24px);
  justify-content: var(--mat-dialog-actions-alignment, flex-end);
}
@media (forced-colors: active) {
  .mat-mdc-dialog-actions {
    border-top-color: CanvasText;
  }
}
.mat-mdc-dialog-actions.mat-mdc-dialog-actions-align-start, .mat-mdc-dialog-actions[align=start] {
  justify-content: start;
}
.mat-mdc-dialog-actions.mat-mdc-dialog-actions-align-center, .mat-mdc-dialog-actions[align=center] {
  justify-content: center;
}
.mat-mdc-dialog-actions.mat-mdc-dialog-actions-align-end, .mat-mdc-dialog-actions[align=end] {
  justify-content: flex-end;
}
.mat-mdc-dialog-actions .mat-button-base + .mat-button-base,
.mat-mdc-dialog-actions .mat-mdc-button-base + .mat-mdc-button-base {
  margin-left: 8px;
}
[dir=rtl] .mat-mdc-dialog-actions .mat-button-base + .mat-button-base,
[dir=rtl] .mat-mdc-dialog-actions .mat-mdc-button-base + .mat-mdc-button-base {
  margin-left: 0;
  margin-right: 8px;
}

.mat-mdc-dialog-component-host {
  display: contents;
}
`],encapsulation:2})}return n})(),Ie="--mat-dialog-transition-duration";function Ee(n){return n==null?null:typeof n=="number"?n:n.endsWith("ms")?H(n.substring(0,n.length-2)):n.endsWith("s")?H(n.substring(0,n.length-1))*1e3:n==="0"?0:null}var M=(function(n){return n[n.OPEN=0]="OPEN",n[n.CLOSING=1]="CLOSING",n[n.CLOSED=2]="CLOSED",n})(M||{}),Z=class{_ref;_config;_containerInstance;componentInstance;componentRef=null;disableClose;id;_afterOpened=new N(1);_beforeClosed=new N(1);_result;_closeFallbackTimeout;_state=M.OPEN;_closeInteractionType;constructor(a,e,t){this._ref=a,this._config=e,this._containerInstance=t,this.disableClose=e.disableClose,this.id=a.id,a.addPanelClass("mat-mdc-dialog-panel"),t._animationStateChanged.pipe(f(i=>i.state==="opened"),p(1)).subscribe(()=>{this._afterOpened.next(),this._afterOpened.complete()}),t._animationStateChanged.pipe(f(i=>i.state==="closed"),p(1)).subscribe(()=>{clearTimeout(this._closeFallbackTimeout),this._finishDialogClose()}),a.overlayRef.detachments().subscribe(()=>{this._beforeClosed.next(this._result),this._beforeClosed.complete(),this._finishDialogClose()}),K(this.backdropClick(),this.keydownEvents().pipe(f(i=>i.keyCode===27&&!this.disableClose&&!S(i)))).subscribe(i=>{this.disableClose||(i.preventDefault(),ze(this,i.type==="keydown"?"keyboard":"mouse"))})}close(a){let e=this._config.closePredicate;e&&!e(a,this._config,this.componentInstance)||(this._result=a,this._containerInstance._animationStateChanged.pipe(f(t=>t.state==="closing"),p(1)).subscribe(t=>{this._beforeClosed.next(a),this._beforeClosed.complete(),this._ref.overlayRef.detachBackdrop(),this._closeFallbackTimeout=setTimeout(()=>this._finishDialogClose(),t.totalTime+100)}),this._state=M.CLOSING,this._containerInstance._startExitAnimation())}afterOpened(){return this._afterOpened}afterClosed(){return this._ref.closed}beforeClosed(){return this._beforeClosed}backdropClick(){return this._ref.backdropClick}keydownEvents(){return this._ref.keydownEvents}updatePosition(a){let e=this._ref.config.positionStrategy;return a&&(a.left||a.right)?a.left?e.left(a.left):e.right(a.right):e.centerHorizontally(),a&&(a.top||a.bottom)?a.top?e.top(a.top):e.bottom(a.bottom):e.centerVertically(),this._ref.updatePosition(),this}updateSize(a="",e=""){return this._ref.updateSize(a,e),this}addPanelClass(a){return this._ref.addPanelClass(a),this}removePanelClass(a){return this._ref.removePanelClass(a),this}getState(){return this._state}_finishDialogClose(){this._state=M.CLOSED,this._ref.close(this._result,{focusOrigin:this._closeInteractionType}),this.componentInstance=null}};function ze(n,a,e){return n._closeInteractionType=a,n.close(e)}var He=new u("MatMdcDialogData"),Ge=new u("mat-mdc-dialog-default-options"),We=new u("mat-mdc-dialog-scroll-strategy",{providedIn:"root",factory:()=>{let n=r(h);return()=>L(n)}}),Qe=(()=>{class n{_defaultOptions=r(Ge,{optional:!0});_scrollStrategy=r(We);_parentDialog=r(n,{optional:!0,skipSelf:!0});_idGenerator=r(F);_injector=r(h);_dialog=r(U);_animationsDisabled=G();_openDialogsAtThisLevel=[];_afterAllClosedAtThisLevel=new m;_afterOpenedAtThisLevel=new m;dialogConfigClass=B;_dialogRefConstructor;_dialogContainerType;_dialogDataToken;get openDialogs(){return this._parentDialog?this._parentDialog.openDialogs:this._openDialogsAtThisLevel}get afterOpened(){return this._parentDialog?this._parentDialog.afterOpened:this._afterOpenedAtThisLevel}_getAfterAllClosed(){let e=this._parentDialog;return e?e._getAfterAllClosed():this._afterAllClosedAtThisLevel}afterAllClosed=v(()=>this.openDialogs.length?this._getAfterAllClosed():this._getAfterAllClosed().pipe(D(void 0)));constructor(){this._dialogRefConstructor=Z,this._dialogContainerType=Ve,this._dialogDataToken=He}open(e,t){let i;t=c(c({},this._defaultOptions||new B),t),t.id=t.id||this._idGenerator.getId("mat-mdc-dialog-"),t.scrollStrategy=t.scrollStrategy||this._scrollStrategy();let o=this._dialog.open(e,$(c({},t),{positionStrategy:R(this._injector).centerHorizontally().centerVertically(),disableClose:!0,closePredicate:void 0,closeOnDestroy:!1,closeOnOverlayDetachments:!1,disableAnimations:this._animationsDisabled||t.enterAnimationDuration?.toLocaleString()==="0"||t.exitAnimationDuration?.toString()==="0",container:{type:this._dialogContainerType,providers:()=>[{provide:this.dialogConfigClass,useValue:t},{provide:g,useValue:t}]},templateContext:()=>({dialogRef:i}),providers:(l,s,d)=>(i=new this._dialogRefConstructor(l,t,d),i.updatePosition(t?.position),[{provide:this._dialogContainerType,useValue:d},{provide:this._dialogDataToken,useValue:s.data},{provide:this._dialogRefConstructor,useValue:i}])}));return i.componentRef=o.componentRef,i.componentInstance=o.componentInstance,this.openDialogs.push(i),this.afterOpened.next(i),i.afterClosed().subscribe(()=>{let l=this.openDialogs.indexOf(i);l>-1&&(this.openDialogs.splice(l,1),this.openDialogs.length||this._getAfterAllClosed().next())}),i}closeAll(){this._closeDialogs(this.openDialogs)}getDialogById(e){return this.openDialogs.find(t=>t.id===e)}ngOnDestroy(){this._closeDialogs(this._openDialogsAtThisLevel),this._afterAllClosedAtThisLevel.complete(),this._afterOpenedAtThisLevel.complete()}_closeDialogs(e){let t=e.length;for(;t--;)e[t].close()}static \u0275fac=function(t){return new(t||n)};static \u0275prov=C({token:n,factory:n.\u0275fac,providedIn:"root"})}return n})();var Rt=(()=>{class n{static \u0275fac=function(t){return new(t||n)};static \u0275mod=x({type:n});static \u0275inj=A({providers:[Qe],imports:[xe,P,y,ue]})}return n})();export{Rt as a};

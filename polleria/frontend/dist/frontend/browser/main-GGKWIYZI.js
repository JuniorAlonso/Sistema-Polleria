import{a as h}from"./chunk-ULLBEKEC.js";import"./chunk-3IMKWMXT.js";import{b as it,c as A,d as lt,e as st,f as mt,g as dt}from"./chunk-WT7LAJTD.js";import{ka as ut,n as ot,na as ht,o as nt,oa as ft,pa as gt,r as rt,s as at,v as ct,y as pt}from"./chunk-ON2FWBKE.js";import{Aa as z,Db as Z,Eb as l,Fb as i,Ga as B,Gb as C,Nb as Y,Rb as q,Tb as M,U as D,Ub as W,Vb as w,Wa as p,Wb as X,X as R,Y as T,Yb as $,Zb as J,_ as I,_a as V,aa as a,ba as P,bb as G,dc as K,eb as U,ec as tt,fc as s,ga as E,gc as et,ha as S,jb as f,ka as F,kb as H,la as y,lb as Q,pa as O,sa as L,tc as u,ua as j,yb as g,zb as b}from"./chunk-3ERAQQI7.js";var _t="@",wt=(()=>{class t{doc;delegate;zone;animationType;moduleImpl;_rendererFactoryPromise=null;scheduler=null;injector=a(F);loadingSchedulerFn=a(Nt,{optional:!0});_engine;constructor(e,n,r,m,d){this.doc=e,this.delegate=n,this.zone=r,this.animationType=m,this.moduleImpl=d}ngOnDestroy(){this._engine?.flush()}loadImpl(){let e=()=>this.moduleImpl??import("./chunk-UDBJQZUX.js").then(r=>r),n;return this.loadingSchedulerFn?n=this.loadingSchedulerFn(e):n=e(),n.catch(r=>{throw new D(5300,!1)}).then(({\u0275createEngine:r,\u0275AnimationRendererFactory:m})=>{this._engine=r(this.animationType,this.doc);let d=new m(this.delegate,this._engine,this.zone);return this.delegate=d,d})}createRenderer(e,n){let r=this.delegate.createRenderer(e,n);if(r.\u0275type===0)return r;typeof r.throwOnSyntheticProps=="boolean"&&(r.throwOnSyntheticProps=!1);let m=new N(r);return n?.data?.animation&&!this._rendererFactoryPromise&&(this._rendererFactoryPromise=this.loadImpl()),this._rendererFactoryPromise?.then(d=>{let xt=d.createRenderer(e,n);m.use(xt),this.scheduler??=this.injector.get(j,null,{optional:!0}),this.scheduler?.notify(10)}).catch(d=>{m.use(r)}),m}begin(){this.delegate.begin?.()}end(){this.delegate.end?.()}whenRenderingDone(){return this.delegate.whenRenderingDone?.()??Promise.resolve()}componentReplaced(e){this._engine?.flush(),this.delegate.componentReplaced?.(e)}static \u0275fac=function(n){U()};static \u0275prov=R({token:t,factory:t.\u0275fac})}return t})(),N=class{delegate;replay=[];\u0275type=1;constructor(o){this.delegate=o}use(o){if(this.delegate=o,this.replay!==null){for(let e of this.replay)e(o);this.replay=null}}get data(){return this.delegate.data}destroy(){this.replay=null,this.delegate.destroy()}createElement(o,e){return this.delegate.createElement(o,e)}createComment(o){return this.delegate.createComment(o)}createText(o){return this.delegate.createText(o)}get destroyNode(){return this.delegate.destroyNode}appendChild(o,e){this.delegate.appendChild(o,e)}insertBefore(o,e,n,r){this.delegate.insertBefore(o,e,n,r)}removeChild(o,e,n,r){this.delegate.removeChild(o,e,n,r)}selectRootElement(o,e){return this.delegate.selectRootElement(o,e)}parentNode(o){return this.delegate.parentNode(o)}nextSibling(o){return this.delegate.nextSibling(o)}setAttribute(o,e,n,r){this.delegate.setAttribute(o,e,n,r)}removeAttribute(o,e,n){this.delegate.removeAttribute(o,e,n)}addClass(o,e){this.delegate.addClass(o,e)}removeClass(o,e){this.delegate.removeClass(o,e)}setStyle(o,e,n,r){this.delegate.setStyle(o,e,n,r)}removeStyle(o,e,n){this.delegate.removeStyle(o,e,n)}setProperty(o,e,n){this.shouldReplay(e)&&this.replay.push(r=>r.setProperty(o,e,n)),this.delegate.setProperty(o,e,n)}setValue(o,e){this.delegate.setValue(o,e)}listen(o,e,n,r){return this.shouldReplay(e)&&this.replay.push(m=>m.listen(o,e,n,r)),this.delegate.listen(o,e,n,r)}shouldReplay(o){return this.replay!==null&&o.startsWith(_t)}},Nt=new I("");function bt(t="animations"){return V("NgAsyncAnimations"),P([{provide:G,useFactory:()=>new wt(a(y),a(ot),a(O),t)},{provide:B,useValue:t==="noop"?"NoopAnimations":"BrowserAnimations"}])}var c=()=>{let t=a(h),o=a(A);return t.isAuthenticated()?!0:o.createUrlTree(["/login"])};var v=t=>{let o=a(h),e=a(A),n=t.data?.roles??[];return o.hasRole(...n)?!0:e.createUrlTree(["/no-autorizado"])};var vt=[{path:"",redirectTo:"/carta",pathMatch:"full"},{path:"login",loadComponent:()=>import("./chunk-ZGIIVRLR.js").then(t=>t.LoginComponent)},{path:"register",loadComponent:()=>import("./chunk-ZQAK7DQ6.js").then(t=>t.RegisterComponent)},{path:"verify-2fa",loadComponent:()=>import("./chunk-LEGXJY5O.js").then(t=>t.Verify2faComponent)},{path:"carta",loadComponent:()=>import("./chunk-ME5VCM76.js").then(t=>t.CartaComponent)},{path:"pedido",loadComponent:()=>import("./chunk-POGAJEB6.js").then(t=>t.CrearPedidoComponent),canActivate:[c]},{path:"mis-pedidos",loadComponent:()=>import("./chunk-C4MQTSLA.js").then(t=>t.MisPedidosComponent),canActivate:[c]},{path:"pedido/:id",loadComponent:()=>import("./chunk-ZVLUGE4I.js").then(t=>t.DetallePedidoComponent),canActivate:[c]},{path:"pago/:id",loadComponent:()=>import("./chunk-42QC6ZHT.js").then(t=>t.PagoPedidoComponent),canActivate:[c]},{path:"cocina",loadComponent:()=>import("./chunk-ATYZWY4N.js").then(t=>t.PanelCocinaComponent),canActivate:[c,v],data:{roles:["COCINA","ADMIN"]}},{path:"mozo",loadComponent:()=>import("./chunk-B44Z6BL5.js").then(t=>t.PanelMozoComponent),canActivate:[c,v],data:{roles:["MOZO","ADMIN"]}},{path:"mesas",loadComponent:()=>import("./chunk-ZDC7XA6Y.js").then(t=>t.GestionMesasComponent),canActivate:[c,v],data:{roles:["MOZO","ADMIN"]}},{path:"admin",loadComponent:()=>import("./chunk-CDM2TPPW.js").then(t=>t.PanelAdminComponent),canActivate:[c,v],data:{roles:["ADMIN"]}},{path:"admin/productos",loadComponent:()=>import("./chunk-FQOSL5FL.js").then(t=>t.GestionProductosComponent),canActivate:[c,v],data:{roles:["ADMIN"]}},{path:"**",loadComponent:()=>import("./chunk-VPSPYFSZ.js").then(t=>t.NotFoundComponent)}];var yt=(t,o)=>{let n=a(h).getToken();if(n){let r=t.clone({setHeaders:{Authorization:`Bearer ${n}`}});return o(r)}return o(t)};var Ct={providers:[L(),mt(vt,dt()),rt(at([yt])),bt()]};var kt=["*",[["mat-toolbar-row"]]],Dt=["*","mat-toolbar-row"],Rt=(()=>{class t{static \u0275fac=function(n){return new(n||t)};static \u0275dir=Q({type:t,selectors:[["mat-toolbar-row"]],hostAttrs:[1,"mat-toolbar-row"],exportAs:["matToolbarRow"]})}return t})(),Mt=(()=>{class t{_elementRef=a(z);_platform=a(pt);_document=a(y);color;_toolbarRows;constructor(){}ngAfterViewInit(){this._platform.isBrowser&&(this._checkToolbarMixedModes(),this._toolbarRows.changes.subscribe(()=>this._checkToolbarMixedModes()))}_checkToolbarMixedModes(){this._toolbarRows.length}static \u0275fac=function(n){return new(n||t)};static \u0275cmp=f({type:t,selectors:[["mat-toolbar"]],contentQueries:function(n,r,m){if(n&1&&X(m,Rt,5),n&2){let d;$(d=J())&&(r._toolbarRows=d)}},hostAttrs:[1,"mat-toolbar"],hostVars:6,hostBindings:function(n,r){n&2&&(tt(r.color?"mat-"+r.color:""),K("mat-toolbar-multiple-rows",r._toolbarRows.length>0)("mat-toolbar-single-row",r._toolbarRows.length===0))},inputs:{color:"color"},exportAs:["matToolbar"],ngContentSelectors:Dt,decls:2,vars:0,template:function(n,r){n&1&&(W(kt),w(0),w(1,1))},styles:[`.mat-toolbar {
  background: var(--mat-toolbar-container-background-color, var(--mat-sys-surface));
  color: var(--mat-toolbar-container-text-color, var(--mat-sys-on-surface));
}
.mat-toolbar, .mat-toolbar h1, .mat-toolbar h2, .mat-toolbar h3, .mat-toolbar h4, .mat-toolbar h5, .mat-toolbar h6 {
  font-family: var(--mat-toolbar-title-text-font, var(--mat-sys-title-large-font));
  font-size: var(--mat-toolbar-title-text-size, var(--mat-sys-title-large-size));
  line-height: var(--mat-toolbar-title-text-line-height, var(--mat-sys-title-large-line-height));
  font-weight: var(--mat-toolbar-title-text-weight, var(--mat-sys-title-large-weight));
  letter-spacing: var(--mat-toolbar-title-text-tracking, var(--mat-sys-title-large-tracking));
  margin: 0;
}
@media (forced-colors: active) {
  .mat-toolbar {
    outline: solid 1px;
  }
}
.mat-toolbar .mat-form-field-underline,
.mat-toolbar .mat-form-field-ripple,
.mat-toolbar .mat-focused .mat-form-field-ripple {
  background-color: currentColor;
}
.mat-toolbar .mat-form-field-label,
.mat-toolbar .mat-focused .mat-form-field-label,
.mat-toolbar .mat-select-value,
.mat-toolbar .mat-select-arrow,
.mat-toolbar .mat-form-field.mat-focused .mat-select-arrow {
  color: inherit;
}
.mat-toolbar .mat-input-element {
  caret-color: currentColor;
}
.mat-toolbar .mat-mdc-button-base.mat-mdc-button-base.mat-unthemed {
  --mat-button-text-label-text-color: var(--mat-toolbar-container-text-color, var(--mat-sys-on-surface));
  --mat-button-outlined-label-text-color: var(--mat-toolbar-container-text-color, var(--mat-sys-on-surface));
}

.mat-toolbar-row, .mat-toolbar-single-row {
  display: flex;
  box-sizing: border-box;
  padding: 0 16px;
  width: 100%;
  flex-direction: row;
  align-items: center;
  white-space: nowrap;
  height: var(--mat-toolbar-standard-height, 64px);
}
@media (max-width: 599px) {
  .mat-toolbar-row, .mat-toolbar-single-row {
    height: var(--mat-toolbar-mobile-height, 56px);
  }
}

.mat-toolbar-multiple-rows {
  display: flex;
  box-sizing: border-box;
  flex-direction: column;
  width: 100%;
  min-height: var(--mat-toolbar-standard-height, 64px);
}
@media (max-width: 599px) {
  .mat-toolbar-multiple-rows {
    min-height: var(--mat-toolbar-mobile-height, 56px);
  }
}
`],encapsulation:2,changeDetection:0})}return t})();var At=(()=>{class t{static \u0275fac=function(n){return new(n||t)};static \u0275mod=H({type:t});static \u0275inj=T({imports:[ct]})}return t})();function Pt(t,o){t&1&&(l(0,"a",6),s(1,"Mis Pedidos"),i(),l(2,"a",7),s(3,"Nuevo Pedido"),i())}function Et(t,o){if(t&1&&(l(0,"a",8),s(1,"Mesas"),i(),l(2,"a",9),s(3,"Panel"),i()),t&2){let e=M();p(2),Z("routerLink",e.role()==="ADMIN"?"/admin":"/mozo")}}function St(t,o){t&1&&(l(0,"a",3),s(1,"Cocina"),i())}function Ft(t,o){t&1&&(l(0,"a",4),s(1,"Productos"),i())}function Ot(t,o){if(t&1){let e=Y();l(0,"span",10),s(1),i(),l(2,"button",11),q("click",function(){E(e);let r=M();return S(r.logout())}),l(3,"mat-icon"),s(4,"logout"),i(),s(5," Salir "),i()}if(t&2){let e=M();p(),et(e.userName())}}function Lt(t,o){t&1&&(l(0,"a",12),s(1,"Login"),i(),l(2,"a",13),s(3,"Registro"),i())}var x=class t{auth=a(h);isAuthenticated=u(()=>this.auth.isAuthenticated());role=u(()=>this.auth.role());userName=u(()=>this.auth.userName());showCliente=u(()=>this.role()==="CLIENTE");showMozoAdmin=u(()=>{let o=this.role();return o==="MOZO"||o==="ADMIN"});showCocinaAdmin=u(()=>{let o=this.role();return o==="COCINA"||o==="ADMIN"});showAdmin=u(()=>this.role()==="ADMIN");logout(){this.auth.logout()}static \u0275fac=function(e){return new(e||t)};static \u0275cmp=f({type:t,selectors:[["app-navbar"]],decls:12,vars:5,consts:[["color","primary"],["routerLink","/carta",1,"logo"],["mat-button","","routerLink","/carta","routerLinkActive","active-link",1,"nav-link"],["mat-button","","routerLink","/cocina","routerLinkActive","active-link",1,"nav-link"],["mat-button","","routerLink","/admin/productos","routerLinkActive","active-link",1,"nav-link"],[1,"spacer"],["mat-button","","routerLink","/mis-pedidos","routerLinkActive","active-link",1,"nav-link"],["mat-button","","routerLink","/pedido","routerLinkActive","active-link",1,"nav-link"],["mat-button","","routerLink","/mesas","routerLinkActive","active-link",1,"nav-link"],["mat-button","","routerLinkActive","active-link",1,"nav-link",3,"routerLink"],[1,"user-name"],["mat-button","",3,"click"],["mat-button","","routerLink","/login",1,"nav-link"],["mat-button","","routerLink","/register",1,"nav-link"]],template:function(e,n){e&1&&(l(0,"mat-toolbar",0)(1,"a",1),s(2,"\u{1F357} Poller\xEDa"),i(),l(3,"a",2),s(4,"Carta"),i(),g(5,Pt,4,0),g(6,Et,4,1),g(7,St,2,0,"a",3),g(8,Ft,2,0,"a",4),C(9,"span",5),g(10,Ot,6,1)(11,Lt,4,0),i()),e&2&&(p(5),b(n.showCliente()?5:-1),p(),b(n.showMozoAdmin()?6:-1),p(),b(n.showCocinaAdmin()?7:-1),p(),b(n.showAdmin()?8:-1),p(2),b(n.isAuthenticated()?10:11))},dependencies:[lt,st,At,Mt,ht,ut,gt,ft],styles:["mat-toolbar[_ngcontent-%COMP%]{background-color:#bf360c!important;color:#fff!important}.logo[_ngcontent-%COMP%]{font-size:1.3rem;font-weight:700;text-decoration:none;color:#fff;margin-right:1rem}.spacer[_ngcontent-%COMP%]{flex:1 1 auto}.nav-link[_ngcontent-%COMP%]{margin:0 4px;color:#fff!important;--mdc-text-button-label-text-color: white}.nav-link.active-link[_ngcontent-%COMP%]{background:#fff3!important;border-radius:4px}.user-name[_ngcontent-%COMP%]{margin-right:8px;font-size:.9rem;color:#fff}button.mat-mdc-button[_ngcontent-%COMP%]{--mdc-text-button-label-text-color: white;color:#fff!important}button.mat-mdc-button[_ngcontent-%COMP%]   .mat-icon[_ngcontent-%COMP%]{color:#fff!important}"]})};var _=class t{static \u0275fac=function(e){return new(e||t)};static \u0275cmp=f({type:t,selectors:[["app-root"]],decls:2,vars:0,template:function(e,n){e&1&&C(0,"app-navbar")(1,"router-outlet")},dependencies:[it,x],encapsulation:2})};nt(_,Ct).catch(t=>console.error(t));

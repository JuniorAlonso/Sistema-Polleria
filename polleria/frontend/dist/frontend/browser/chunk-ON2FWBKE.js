import{$ as h,$a as kr,Aa as U,B as Se,Ba as bn,Bc as Ur,Ca as Ir,Cc as jr,D as gr,Da as _e,Dc as Z,E as br,Ea as Tr,Ec as En,F as Me,Fa as Re,G as _t,Ga as Sr,Gc as zr,H as vr,Ha as Oe,Hb as Mt,I as Dt,Ib as Ft,Jb as ie,Ka as At,La as De,M as yr,Ma as Ne,Na as Mr,O as Et,Oa as Fr,P as _r,Pa as xr,Pb as K,Q as Dr,Qa as Rr,Qb as F,R as wt,Ra as Or,Sa as Nr,T as Fe,Ta as Lr,U as v,Ub as he,V as Ke,Vb as V,X as m,Xa as Le,Y as N,Ya as Pr,Za as Ct,_ as p,a as I,aa as c,ab as vn,b as vt,ba as pn,bb as Pe,ca as Er,cb as It,d as yt,da as Ze,db as Q,dc as ee,ea as wr,ec as xt,f as Te,fa as B,fb as Tt,h as k,i as lr,jb as $,ka as z,kb as L,la as b,lb as H,mb as yn,nb as ke,o as q,oa as xe,p as mr,pa as M,qa as ye,rb as St,rc as Dn,s as O,t as fr,ta as Ye,va as Ar,vb as _n,vc as Br,w as hr,wa as Cr,xa as gn,xb as Xe,y as pr}from"./chunk-3ERAQQI7.js";var $r=null;function ce(){return $r}function wn(t){$r??=t}var Je=class{},pe=(()=>{class t{historyGo(e){throw new Error("")}static \u0275fac=function(n){return new(n||t)};static \u0275prov=m({token:t,factory:()=>c(Hr),providedIn:"platform"})}return t})(),Mo=new p(""),Hr=(()=>{class t extends pe{_location;_history;_doc=c(b);constructor(){super(),this._location=window.location,this._history=window.history}getBaseHrefFromDOM(){return ce().getBaseHref(this._doc)}onPopState(e){let n=ce().getGlobalEventTarget(this._doc,"window");return n.addEventListener("popstate",e,!1),()=>n.removeEventListener("popstate",e)}onHashChange(e){let n=ce().getGlobalEventTarget(this._doc,"window");return n.addEventListener("hashchange",e,!1),()=>n.removeEventListener("hashchange",e)}get href(){return this._location.href}get protocol(){return this._location.protocol}get hostname(){return this._location.hostname}get port(){return this._location.port}get pathname(){return this._location.pathname}get search(){return this._location.search}get hash(){return this._location.hash}set pathname(e){this._location.pathname=e}pushState(e,n,i){this._history.pushState(e,n,i)}replaceState(e,n,i){this._history.replaceState(e,n,i)}forward(){this._history.forward()}back(){this._history.back()}historyGo(e=0){this._history.go(e)}getState(){return this._history.state}static \u0275fac=function(n){return new(n||t)};static \u0275prov=m({token:t,factory:()=>new t,providedIn:"platform"})}return t})();function Rt(t,r){return t?r?t.endsWith("/")?r.startsWith("/")?t+r.slice(1):t+r:r.startsWith("/")?t+r:`${t}/${r}`:t:r}function Vr(t){let r=t.search(/#|\?|$/);return t[r-1]==="/"?t.slice(0,r-1)+t.slice(r):t}function te(t){return t&&t[0]!=="?"?`?${t}`:t}var Be=(()=>{class t{historyGo(e){throw new Error("")}static \u0275fac=function(n){return new(n||t)};static \u0275prov=m({token:t,factory:()=>c(Wr),providedIn:"root"})}return t})(),Ot=new p(""),Wr=(()=>{class t extends Be{_platformLocation;_baseHref;_removeListenerFns=[];constructor(e,n){super(),this._platformLocation=e,this._baseHref=n??this._platformLocation.getBaseHrefFromDOM()??c(b).location?.origin??""}ngOnDestroy(){for(;this._removeListenerFns.length;)this._removeListenerFns.pop()()}onPopState(e){this._removeListenerFns.push(this._platformLocation.onPopState(e),this._platformLocation.onHashChange(e))}getBaseHref(){return this._baseHref}prepareExternalUrl(e){return Rt(this._baseHref,e)}path(e=!1){let n=this._platformLocation.pathname+te(this._platformLocation.search),i=this._platformLocation.hash;return i&&e?`${n}${i}`:n}pushState(e,n,i,o){let a=this.prepareExternalUrl(i+te(o));this._platformLocation.pushState(e,n,a)}replaceState(e,n,i,o){let a=this.prepareExternalUrl(i+te(o));this._platformLocation.replaceState(e,n,a)}forward(){this._platformLocation.forward()}back(){this._platformLocation.back()}getState(){return this._platformLocation.getState()}historyGo(e=0){this._platformLocation.historyGo?.(e)}static \u0275fac=function(n){return new(n||t)(h(pe),h(Ot,8))};static \u0275prov=m({token:t,factory:t.\u0275fac,providedIn:"root"})}return t})();var Kr=(()=>{class t{_subject=new k;_basePath;_locationStrategy;_urlChangeListeners=[];_urlChangeSubscription=null;constructor(e){this._locationStrategy=e;let n=this._locationStrategy.getBaseHref();this._basePath=Ro(Vr(Gr(n))),this._locationStrategy.onPopState(i=>{this._subject.next({url:this.path(!0),pop:!0,state:i.state,type:i.type})})}ngOnDestroy(){this._urlChangeSubscription?.unsubscribe(),this._urlChangeListeners=[]}path(e=!1){return this.normalize(this._locationStrategy.path(e))}getState(){return this._locationStrategy.getState()}isCurrentPathEqualTo(e,n=""){return this.path()==this.normalize(e+te(n))}normalize(e){return t.stripTrailingSlash(xo(this._basePath,Gr(e)))}prepareExternalUrl(e){return e&&e[0]!=="/"&&(e="/"+e),this._locationStrategy.prepareExternalUrl(e)}go(e,n="",i=null){this._locationStrategy.pushState(i,"",e,n),this._notifyUrlChangeListeners(this.prepareExternalUrl(e+te(n)),i)}replaceState(e,n="",i=null){this._locationStrategy.replaceState(i,"",e,n),this._notifyUrlChangeListeners(this.prepareExternalUrl(e+te(n)),i)}forward(){this._locationStrategy.forward()}back(){this._locationStrategy.back()}historyGo(e=0){this._locationStrategy.historyGo?.(e)}onUrlChange(e){return this._urlChangeListeners.push(e),this._urlChangeSubscription??=this.subscribe(n=>{this._notifyUrlChangeListeners(n.url,n.state)}),()=>{let n=this._urlChangeListeners.indexOf(e);this._urlChangeListeners.splice(n,1),this._urlChangeListeners.length===0&&(this._urlChangeSubscription?.unsubscribe(),this._urlChangeSubscription=null)}}_notifyUrlChangeListeners(e="",n){this._urlChangeListeners.forEach(i=>i(e,n))}subscribe(e,n,i){return this._subject.subscribe({next:e,error:n??void 0,complete:i??void 0})}static normalizeQueryParams=te;static joinWithSlash=Rt;static stripTrailingSlash=Vr;static \u0275fac=function(n){return new(n||t)(h(Be))};static \u0275prov=m({token:t,factory:()=>Fo(),providedIn:"root"})}return t})();function Fo(){return new Kr(h(Be))}function xo(t,r){if(!t||!r.startsWith(t))return r;let e=r.substring(t.length);return e===""||["/",";","?","#"].includes(e[0])?e:r}function Gr(t){return t.replace(/\/index\.html$/,"")}function Ro(t){if(new RegExp("^(https?:)?//").test(t)){let[,e]=t.split(/\/\/[^\/]+/);return e}return t}var No=(()=>{class t extends Be{_platformLocation;_baseHref="";_removeListenerFns=[];constructor(e,n){super(),this._platformLocation=e,n!=null&&(this._baseHref=n)}ngOnDestroy(){for(;this._removeListenerFns.length;)this._removeListenerFns.pop()()}onPopState(e){this._removeListenerFns.push(this._platformLocation.onPopState(e),this._platformLocation.onHashChange(e))}getBaseHref(){return this._baseHref}path(e=!1){let n=this._platformLocation.hash??"#";return n.length>0?n.substring(1):n}prepareExternalUrl(e){let n=Rt(this._baseHref,e);return n.length>0?"#"+n:n}pushState(e,n,i,o){let a=this.prepareExternalUrl(i+te(o))||this._platformLocation.pathname;this._platformLocation.pushState(e,n,a)}replaceState(e,n,i,o){let a=this.prepareExternalUrl(i+te(o))||this._platformLocation.pathname;this._platformLocation.replaceState(e,n,a)}forward(){this._platformLocation.forward()}back(){this._platformLocation.back()}getState(){return this._platformLocation.getState()}historyGo(e=0){this._platformLocation.historyGo?.(e)}static \u0275fac=function(n){return new(n||t)(h(pe),h(Ot,8))};static \u0275prov=m({token:t,factory:t.\u0275fac})}return t})();var Mn=(function(t){return t[t.Decimal=0]="Decimal",t[t.Percent=1]="Percent",t[t.Currency=2]="Currency",t[t.Scientific=3]="Scientific",t})(Mn||{});var P=(function(t){return t[t.Format=0]="Format",t[t.Standalone=1]="Standalone",t})(P||{}),E=(function(t){return t[t.Narrow=0]="Narrow",t[t.Abbreviated=1]="Abbreviated",t[t.Wide=2]="Wide",t[t.Short=3]="Short",t})(E||{}),G=(function(t){return t[t.Short=0]="Short",t[t.Medium=1]="Medium",t[t.Long=2]="Long",t[t.Full=3]="Full",t})(G||{}),W={Decimal:0,Group:1,List:2,PercentSign:3,PlusSign:4,MinusSign:5,Exponential:6,SuperscriptingExponent:7,PerMille:8,Infinity:9,NaN:10,TimeSeparator:11,CurrencyDecimal:12,CurrencyGroup:13};function qr(t){return K(t)[F.LocaleId]}function Qr(t,r,e){let n=K(t),i=[n[F.DayPeriodsFormat],n[F.DayPeriodsStandalone]],o=X(i,r);return X(o,e)}function ei(t,r,e){let n=K(t),i=[n[F.DaysFormat],n[F.DaysStandalone]],o=X(i,r);return X(o,e)}function ti(t,r,e){let n=K(t),i=[n[F.MonthsFormat],n[F.MonthsStandalone]],o=X(i,r);return X(o,e)}function ni(t,r){let n=K(t)[F.Eras];return X(n,r)}function qe(t,r){let e=K(t);return X(e[F.DateFormat],r)}function Qe(t,r){let e=K(t);return X(e[F.TimeFormat],r)}function et(t,r){let n=K(t)[F.DateTimeFormat];return X(n,r)}function oe(t,r){let e=K(t),n=e[F.NumberSymbols][r];if(typeof n>"u"){if(r===W.CurrencyDecimal)return e[F.NumberSymbols][W.Decimal];if(r===W.CurrencyGroup)return e[F.NumberSymbols][W.Group]}return n}function ri(t,r){return K(t)[F.NumberFormats][r]}function ii(t){if(!t[F.ExtraData])throw new v(2303,!1)}function oi(t){let r=K(t);return ii(r),(r[F.ExtraData][2]||[]).map(n=>typeof n=="string"?An(n):[An(n[0]),An(n[1])])}function ai(t,r,e){let n=K(t);ii(n);let i=[n[F.ExtraData][0],n[F.ExtraData][1]],o=X(i,r)||[];return X(o,e)||[]}function X(t,r){for(let e=r;e>-1;e--)if(typeof t[e]<"u")return t[e];throw new v(2304,!1)}function An(t){let[r,e]=t.split(":");return{hours:+r,minutes:+e}}var Lo=/^(\d{4,})-?(\d\d)-?(\d\d)(?:T(\d\d)(?::?(\d\d)(?::?(\d\d)(?:\.(\d+))?)?)?(Z|([+-])(\d\d):?(\d\d))?)?$/,Nt={},Po=/((?:[^BEGHLMOSWYZabcdhmswyz']+)|(?:'(?:[^']|'')*')|(?:G{1,5}|y{1,4}|Y{1,4}|M{1,5}|L{1,5}|w{1,2}|W{1}|d{1,2}|E{1,6}|c{1,6}|a{1,5}|b{1,5}|B{1,5}|h{1,2}|H{1,2}|m{1,2}|s{1,2}|S{1,3}|z{1,4}|Z{1,5}|O{1,4}))([\s\S]*)/,ko=256;function si(t,r,e,n){let i=Ko(t);Bo(r),r=ue(e,r)||r;let a=[],s;for(;r;)if(s=Po.exec(r),s){a=a.concat(s.slice(1));let l=a.pop();if(!l)break;r=l}else{a.push(r);break}let u=i.getTimezoneOffset();n&&(u=ui(n,u),i=Wo(i,n));let d="";return a.forEach(l=>{let f=Vo(l);d+=f?f(i,e,u):l==="''"?"'":l.replace(/(^'|'$)/g,"").replace(/''/g,"'")}),d}function Bo(t){if(t.length>ko)throw new v(2300,!1)}function Ut(t,r,e){let n=new Date(0);return n.setFullYear(t,r,e),n.setHours(0,0,0),n}function ue(t,r){let e=qr(t);if(Nt[e]??={},Nt[e][r])return Nt[e][r];let n="";switch(r){case"shortDate":n=qe(t,G.Short);break;case"mediumDate":n=qe(t,G.Medium);break;case"longDate":n=qe(t,G.Long);break;case"fullDate":n=qe(t,G.Full);break;case"shortTime":n=Qe(t,G.Short);break;case"mediumTime":n=Qe(t,G.Medium);break;case"longTime":n=Qe(t,G.Long);break;case"fullTime":n=Qe(t,G.Full);break;case"short":let i=ue(t,"shortTime"),o=ue(t,"shortDate");n=Lt(et(t,G.Short),[i,o]);break;case"medium":let a=ue(t,"mediumTime"),s=ue(t,"mediumDate");n=Lt(et(t,G.Medium),[a,s]);break;case"long":let u=ue(t,"longTime"),d=ue(t,"longDate");n=Lt(et(t,G.Long),[u,d]);break;case"full":let l=ue(t,"fullTime"),f=ue(t,"fullDate");n=Lt(et(t,G.Full),[l,f]);break}return n&&(Nt[e][r]=n),n}function Lt(t,r){return r&&(t=t.replace(/\{([^}]+)}/g,function(e,n){return r!=null&&n in r?r[n]:e})),t}function ne(t,r,e="-",n,i){let o="";(t<0||i&&t<=0)&&(i?t=-t+1:(t=-t,o=e));let a=String(t);for(;a.length<r;)a="0"+a;return n&&(a=a.slice(a.length-r)),o+a}function Uo(t,r){return ne(t,3).substring(0,r)}function x(t,r,e=0,n=!1,i=!1){return function(o,a){let s=jo(t,o);if((e>0||s>-e)&&(s+=e),t===3)s===0&&e===-12&&(s=12);else if(t===6)return Uo(s,r);let u=oe(a,W.MinusSign);return ne(s,r,u,n,i)}}function jo(t,r){switch(t){case 0:return r.getFullYear();case 1:return r.getMonth();case 2:return r.getDate();case 3:return r.getHours();case 4:return r.getMinutes();case 5:return r.getSeconds();case 6:return r.getMilliseconds();case 7:return r.getDay();default:throw new v(2301,!1)}}function w(t,r,e=P.Format,n=!1){return function(i,o){return zo(i,o,t,r,e,n)}}function zo(t,r,e,n,i,o){switch(e){case 2:return ti(r,i,n)[t.getMonth()];case 1:return ei(r,i,n)[t.getDay()];case 0:let a=t.getHours(),s=t.getMinutes();if(o){let d=oi(r),l=ai(r,i,n),f=d.findIndex(y=>{if(Array.isArray(y)){let[D,C]=y,R=a>=D.hours&&s>=D.minutes,g=a<C.hours||a===C.hours&&s<C.minutes;if(D.hours<C.hours){if(R&&g)return!0}else if(R||g)return!0}else if(y.hours===a&&y.minutes===s)return!0;return!1});if(f!==-1)return l[f]}return Qr(r,i,n)[a<12?0:1];case 3:return ni(r,n)[t.getFullYear()<=0?0:1];default:let u=e;throw new v(2302,!1)}}function Pt(t){return function(r,e,n){let i=-1*n,o=oe(e,W.MinusSign),a=i>0?Math.floor(i/60):Math.ceil(i/60);switch(t){case 0:return(i>=0?"+":"")+ne(a,2,o)+ne(Math.abs(i%60),2,o);case 1:return"GMT"+(i>=0?"+":"")+ne(a,1,o);case 2:return"GMT"+(i>=0?"+":"")+ne(a,2,o)+":"+ne(Math.abs(i%60),2,o);case 3:return n===0?"Z":(i>=0?"+":"")+ne(a,2,o)+":"+ne(Math.abs(i%60),2,o);default:throw new v(2310,!1)}}}var $o=0,Bt=4;function Ho(t){let r=Ut(t,$o,1).getDay();return Ut(t,0,1+(r<=Bt?Bt:Bt+7)-r)}function ci(t){let r=t.getDay(),e=r===0?-3:Bt-r;return Ut(t.getFullYear(),t.getMonth(),t.getDate()+e)}function Cn(t,r=!1){return function(e,n){let i;if(r){let o=new Date(e.getFullYear(),e.getMonth(),1).getDay()-1,a=e.getDate();i=1+Math.floor((a+o)/7)}else{let o=ci(e),a=Ho(o.getFullYear()),s=o.getTime()-a.getTime();i=1+Math.round(s/6048e5)}return ne(i,t,oe(n,W.MinusSign))}}function kt(t,r=!1){return function(e,n){let o=ci(e).getFullYear();return ne(o,t,oe(n,W.MinusSign),r)}}var In={};function Vo(t){if(In[t])return In[t];let r;switch(t){case"G":case"GG":case"GGG":r=w(3,E.Abbreviated);break;case"GGGG":r=w(3,E.Wide);break;case"GGGGG":r=w(3,E.Narrow);break;case"y":r=x(0,1,0,!1,!0);break;case"yy":r=x(0,2,0,!0,!0);break;case"yyy":r=x(0,3,0,!1,!0);break;case"yyyy":r=x(0,4,0,!1,!0);break;case"Y":r=kt(1);break;case"YY":r=kt(2,!0);break;case"YYY":r=kt(3);break;case"YYYY":r=kt(4);break;case"M":case"L":r=x(1,1,1);break;case"MM":case"LL":r=x(1,2,1);break;case"MMM":r=w(2,E.Abbreviated);break;case"MMMM":r=w(2,E.Wide);break;case"MMMMM":r=w(2,E.Narrow);break;case"LLL":r=w(2,E.Abbreviated,P.Standalone);break;case"LLLL":r=w(2,E.Wide,P.Standalone);break;case"LLLLL":r=w(2,E.Narrow,P.Standalone);break;case"w":r=Cn(1);break;case"ww":r=Cn(2);break;case"W":r=Cn(1,!0);break;case"d":r=x(2,1);break;case"dd":r=x(2,2);break;case"c":case"cc":r=x(7,1);break;case"ccc":r=w(1,E.Abbreviated,P.Standalone);break;case"cccc":r=w(1,E.Wide,P.Standalone);break;case"ccccc":r=w(1,E.Narrow,P.Standalone);break;case"cccccc":r=w(1,E.Short,P.Standalone);break;case"E":case"EE":case"EEE":r=w(1,E.Abbreviated);break;case"EEEE":r=w(1,E.Wide);break;case"EEEEE":r=w(1,E.Narrow);break;case"EEEEEE":r=w(1,E.Short);break;case"a":case"aa":case"aaa":r=w(0,E.Abbreviated);break;case"aaaa":r=w(0,E.Wide);break;case"aaaaa":r=w(0,E.Narrow);break;case"b":case"bb":case"bbb":r=w(0,E.Abbreviated,P.Standalone,!0);break;case"bbbb":r=w(0,E.Wide,P.Standalone,!0);break;case"bbbbb":r=w(0,E.Narrow,P.Standalone,!0);break;case"B":case"BB":case"BBB":r=w(0,E.Abbreviated,P.Format,!0);break;case"BBBB":r=w(0,E.Wide,P.Format,!0);break;case"BBBBB":r=w(0,E.Narrow,P.Format,!0);break;case"h":r=x(3,1,-12);break;case"hh":r=x(3,2,-12);break;case"H":r=x(3,1);break;case"HH":r=x(3,2);break;case"m":r=x(4,1);break;case"mm":r=x(4,2);break;case"s":r=x(5,1);break;case"ss":r=x(5,2);break;case"S":r=x(6,1);break;case"SS":r=x(6,2);break;case"SSS":r=x(6,3);break;case"Z":case"ZZ":case"ZZZ":r=Pt(0);break;case"ZZZZZ":r=Pt(3);break;case"O":case"OO":case"OOO":case"z":case"zz":case"zzz":r=Pt(1);break;case"OOOO":case"ZZZZ":case"zzzz":r=Pt(2);break;default:return null}return In[t]=r,r}function ui(t,r){t=t.replace(/:/g,"");let e=Date.parse("Jan 01, 1970 00:00:00 "+t)/6e4;return isNaN(e)?r:e}function Go(t,r){return t=new Date(t.getTime()),t.setMinutes(t.getMinutes()+r),t}function Wo(t,r,e){let i=t.getTimezoneOffset(),o=ui(r,i);return Go(t,-1*(o-i))}function Ko(t){if(Zr(t))return t;if(typeof t=="number"&&!isNaN(t))return new Date(t);if(typeof t=="string"){if(t=t.trim(),/^(\d{4}(-\d{1,2}(-\d{1,2})?)?)$/.test(t)){let[i,o=1,a=1]=t.split("-").map(s=>+s);return Ut(i,o-1,a)}let e=parseFloat(t);if(!isNaN(t-e))return new Date(e);let n;if(n=t.match(Lo))return Zo(n)}let r=new Date(t);if(!Zr(r))throw new v(2311,!1);return r}function Zo(t){let r=new Date(0),e=0,n=0,i=t[8]?r.setUTCFullYear:r.setFullYear,o=t[8]?r.setUTCHours:r.setHours;t[9]&&(e=Number(t[9]+t[10]),n=Number(t[9]+t[11])),i.call(r,Number(t[1]),Number(t[2])-1,Number(t[3]));let a=Number(t[4]||0)-e,s=Number(t[5]||0)-n,u=Number(t[6]||0),d=Math.floor(parseFloat("0."+(t[7]||0))*1e3);return o.call(r,a,s,u,d),r}function Zr(t){return t instanceof Date&&!isNaN(t.valueOf())}var Yo=/^(\d+)?\.((\d+)(-(\d+))?)?$/,Yr=22,jt=".",tt="0",Xo=";",Jo=",",Tn="#";function qo(t,r,e,n,i,o,a=!1){let s="",u=!1;if(!isFinite(t))s=oe(e,W.Infinity);else{let d=ta(t);a&&(d=ea(d));let l=r.minInt,f=r.minFrac,y=r.maxFrac;if(o){let S=o.match(Yo);if(S===null)throw new v(2306,!1);let Y=S[1],T=S[3],fe=S[5];Y!=null&&(l=Sn(Y)),T!=null&&(f=Sn(T)),fe!=null?y=Sn(fe):T!=null&&f>y&&(y=f);let se=100;if(l>se||f>se||y>se)throw new v(2306,!1)}na(d,f,y);let D=d.digits,C=d.integerLen,R=d.exponent,g=[];for(u=D.every(S=>!S);C<l;C++)D.unshift(0);for(;C<0;C++)D.unshift(0);C>0?g=D.splice(C,D.length):(g=D,D=[0]);let _=[];for(D.length>=r.lgSize&&_.unshift(D.splice(-r.lgSize,D.length).join(""));D.length>r.gSize;)_.unshift(D.splice(-r.gSize,D.length).join(""));D.length&&_.unshift(D.join("")),s=_.join(oe(e,n)),g.length&&(s+=oe(e,i)+g.join("")),R&&(s+=oe(e,W.Exponential)+"+"+R)}return t<0&&!u?s=r.negPre+s+r.negSuf:s=r.posPre+s+r.posSuf,s}function di(t,r,e){let n=ri(r,Mn.Decimal),i=Qo(n,oe(r,W.MinusSign));return qo(t,i,r,W.Group,W.Decimal,e)}function Qo(t,r="-"){let e={minInt:1,minFrac:0,maxFrac:0,posPre:"",posSuf:"",negPre:"",negSuf:"",gSize:0,lgSize:0},n=t.split(Xo),i=n[0],o=n[1],a=i.indexOf(jt)!==-1?i.split(jt):[i.substring(0,i.lastIndexOf(tt)+1),i.substring(i.lastIndexOf(tt)+1)],s=a[0],u=a[1]||"";e.posPre=s.substring(0,s.indexOf(Tn));for(let l=0;l<u.length;l++){let f=u.charAt(l);f===tt?e.minFrac=e.maxFrac=l+1:f===Tn?e.maxFrac=l+1:e.posSuf+=f}let d=s.split(Jo);if(e.gSize=d[1]?d[1].length:0,e.lgSize=d[2]||d[1]?(d[2]||d[1]).length:0,o){let l=i.length-e.posPre.length-e.posSuf.length,f=o.indexOf(Tn);e.negPre=o.substring(0,f).replace(/'/g,""),e.negSuf=o.slice(f+l).replace(/'/g,"")}else e.negPre=r+e.posPre,e.negSuf=e.posSuf;return e}function ea(t){if(t.digits[0]===0)return t;let r=t.digits.length-t.integerLen;return t.exponent?t.exponent+=2:(r===0?t.digits.push(0,0):r===1&&t.digits.push(0),t.integerLen+=2),t}function ta(t){let r=Math.abs(t)+"",e=0,n,i,o,a,s;for((i=r.indexOf(jt))>-1&&(r=r.replace(jt,"")),(o=r.search(/e/i))>0?(i<0&&(i=o),i+=+r.slice(o+1),r=r.substring(0,o)):i<0&&(i=r.length),o=0;r.charAt(o)===tt;o++);if(o===(s=r.length))n=[0],i=1;else{for(s--;r.charAt(s)===tt;)s--;for(i-=o,n=[],a=0;o<=s;o++,a++)n[a]=Number(r.charAt(o))}return i>Yr&&(n=n.splice(0,Yr-1),e=i-1,i=1),{digits:n,exponent:e,integerLen:i}}function na(t,r,e){if(r>e)throw new v(2307,!1);let n=t.digits,i=n.length-t.integerLen,o=Math.min(Math.max(r,i),e),a=o+t.integerLen,s=n[a];if(a>0){n.splice(Math.max(t.integerLen,a));for(let f=a;f<n.length;f++)n[f]=0}else{i=Math.max(0,i),t.integerLen=1,n.length=Math.max(1,a=o+1),n[0]=0;for(let f=1;f<a;f++)n[f]=0}if(s>=5)if(a-1<0){for(let f=0;f>a;f--)n.unshift(0),t.integerLen++;n.unshift(1),t.integerLen++}else n[a-1]++;for(;i<Math.max(0,o);i++)n.push(0);let u=o!==0,d=r+t.integerLen,l=n.reduceRight(function(f,y,D,C){return y=y+f,C[D]=y<10?y:y-10,u&&(C[D]===0&&D>=d?C.pop():u=!1),y>=10?1:0},0);l&&(n.unshift(l),t.integerLen++)}function Sn(t){let r=parseInt(t);if(isNaN(r))throw new v(2305,!1);return r}var zt=class{$implicit;ngForOf;index;count;constructor(r,e,n,i){this.$implicit=r,this.ngForOf=e,this.index=n,this.count=i}get first(){return this.index===0}get last(){return this.index===this.count-1}get even(){return this.index%2===0}get odd(){return!this.even}},li=(()=>{class t{_viewContainer;_template;_differs;set ngForOf(e){this._ngForOf=e,this._ngForOfDirty=!0}set ngForTrackBy(e){this._trackByFn=e}get ngForTrackBy(){return this._trackByFn}_ngForOf=null;_ngForOfDirty=!0;_differ=null;_trackByFn;constructor(e,n,i){this._viewContainer=e,this._template=n,this._differs=i}set ngForTemplate(e){e&&(this._template=e)}ngDoCheck(){if(this._ngForOfDirty){this._ngForOfDirty=!1;let e=this._ngForOf;!this._differ&&e&&(this._differ=this._differs.find(e).create(this.ngForTrackBy))}if(this._differ){let e=this._differ.diff(this._ngForOf);e&&this._applyChanges(e)}}_applyChanges(e){let n=this._viewContainer;e.forEachOperation((i,o,a)=>{if(i.previousIndex==null)n.createEmbeddedView(this._template,new zt(i.item,this._ngForOf,-1,-1),a===null?void 0:a);else if(a==null)n.remove(o===null?void 0:o);else if(o!==null){let s=n.get(o);n.move(s,a),Xr(s,i)}});for(let i=0,o=n.length;i<o;i++){let s=n.get(i).context;s.index=i,s.count=o,s.ngForOf=this._ngForOf}e.forEachIdentityChange(i=>{let o=n.get(i.currentIndex);Xr(o,i)})}static ngTemplateContextGuard(e,n){return!0}static \u0275fac=function(n){return new(n||t)(Q(Tt),Q(vn),Q(Ur))};static \u0275dir=H({type:t,selectors:[["","ngFor","","ngForOf",""]],inputs:{ngForOf:"ngForOf",ngForTrackBy:"ngForTrackBy",ngForTemplate:"ngForTemplate"}})}return t})();function Xr(t,r){t.context.$implicit=r.item}var ra=(()=>{class t{_viewContainer;_context=new $t;_thenTemplateRef=null;_elseTemplateRef=null;_thenViewRef=null;_elseViewRef=null;constructor(e,n){this._viewContainer=e,this._thenTemplateRef=n}set ngIf(e){this._context.$implicit=this._context.ngIf=e,this._updateView()}set ngIfThen(e){Jr(e,!1),this._thenTemplateRef=e,this._thenViewRef=null,this._updateView()}set ngIfElse(e){Jr(e,!1),this._elseTemplateRef=e,this._elseViewRef=null,this._updateView()}_updateView(){this._context.$implicit?this._thenViewRef||(this._viewContainer.clear(),this._elseViewRef=null,this._thenTemplateRef&&(this._thenViewRef=this._viewContainer.createEmbeddedView(this._thenTemplateRef,this._context))):this._elseViewRef||(this._viewContainer.clear(),this._thenViewRef=null,this._elseTemplateRef&&(this._elseViewRef=this._viewContainer.createEmbeddedView(this._elseTemplateRef,this._context)))}static ngIfUseIfTypeGuard;static ngTemplateGuard_ngIf;static ngTemplateContextGuard(e,n){return!0}static \u0275fac=function(n){return new(n||t)(Q(Tt),Q(vn))};static \u0275dir=H({type:t,selectors:[["","ngIf",""]],inputs:{ngIf:"ngIf",ngIfThen:"ngIfThen",ngIfElse:"ngIfElse"}})}return t})(),$t=class{$implicit=null;ngIf=null};function Jr(t,r){if(t&&!t.createEmbeddedView)throw new v(2020,!1)}var ia=(()=>{class t{_viewContainerRef;_viewRef=null;ngTemplateOutletContext=null;ngTemplateOutlet=null;ngTemplateOutletInjector=null;injector=c(z);constructor(e){this._viewContainerRef=e}ngOnChanges(e){if(this._shouldRecreateView(e)){let n=this._viewContainerRef;if(this._viewRef&&n.remove(n.indexOf(this._viewRef)),!this.ngTemplateOutlet){this._viewRef=null;return}let i=this._createContextForwardProxy();this._viewRef=n.createEmbeddedView(this.ngTemplateOutlet,i,{injector:this._getInjector()})}}_getInjector(){return this.ngTemplateOutletInjector==="outlet"?this.injector:this.ngTemplateOutletInjector??void 0}_shouldRecreateView(e){return!!e.ngTemplateOutlet||!!e.ngTemplateOutletInjector}_createContextForwardProxy(){return new Proxy({},{set:(e,n,i)=>this.ngTemplateOutletContext?Reflect.set(this.ngTemplateOutletContext,n,i):!1,get:(e,n,i)=>{if(this.ngTemplateOutletContext)return Reflect.get(this.ngTemplateOutletContext,n,i)}})}static \u0275fac=function(n){return new(n||t)(Q(Tt))};static \u0275dir=H({type:t,selectors:[["","ngTemplateOutlet",""]],inputs:{ngTemplateOutletContext:"ngTemplateOutletContext",ngTemplateOutlet:"ngTemplateOutlet",ngTemplateOutletInjector:"ngTemplateOutletInjector"},features:[gn]})}return t})();function mi(t,r){return new v(2100,!1)}var oa="mediumDate",fi=new p(""),hi=new p(""),aa=(()=>{class t{locale;defaultTimezone;defaultOptions;constructor(e,n,i){this.locale=e,this.defaultTimezone=n,this.defaultOptions=i}transform(e,n,i,o){if(e==null||e===""||e!==e)return null;try{let a=n??this.defaultOptions?.dateFormat??oa,s=i??this.defaultOptions?.timezone??this.defaultTimezone??void 0;return si(e,a,o||this.locale,s)}catch(a){throw mi(t,a.message)}}static \u0275fac=function(n){return new(n||t)(Q(Dn,16),Q(fi,24),Q(hi,24))};static \u0275pipe=yn({name:"date",type:t,pure:!0})}return t})();var sa=(()=>{class t{_locale;constructor(e){this._locale=e}transform(e,n,i){if(!ca(e))return null;i||=this._locale;try{let o=ua(e);return di(o,i,n)}catch(o){throw mi(t,o.message)}}static \u0275fac=function(n){return new(n||t)(Q(Dn,16))};static \u0275pipe=yn({name:"number",type:t,pure:!0})}return t})();function ca(t){return!(t==null||t===""||t!==t)}function ua(t){if(typeof t=="string"&&!isNaN(Number(t)-parseFloat(t)))return Number(t);if(typeof t!="number")throw new v(2309,!1);return t}var pi=(()=>{class t{static \u0275fac=function(n){return new(n||t)};static \u0275mod=L({type:t});static \u0275inj=N({})}return t})();function nt(t,r){r=encodeURIComponent(r);for(let e of t.split(";")){let n=e.indexOf("="),[i,o]=n==-1?[e,""]:[e.slice(0,n),e.slice(n+1)];if(i.trim()===r)return decodeURIComponent(o)}return null}var Ee=class{};var xn="browser";function gi(t){return t===xn}var Su=(()=>{class t{static \u0275prov=m({token:t,providedIn:"root",factory:()=>new Fn(c(b),window)})}return t})(),Fn=class{document;window;offset=()=>[0,0];constructor(r,e){this.document=r,this.window=e}setOffset(r){Array.isArray(r)?this.offset=()=>r:this.offset=r}getScrollPosition(){return[this.window.scrollX,this.window.scrollY]}scrollToPosition(r,e){this.window.scrollTo(vt(I({},e),{left:r[0],top:r[1]}))}scrollToAnchor(r,e){let n=fa(this.document,r);n&&(this.scrollToElement(n,e),n.focus({preventScroll:!0}))}setHistoryScrollRestoration(r){try{this.window.history.scrollRestoration=r}catch{console.warn(Ke(2400,!1))}}scrollToElement(r,e){let n=r.getBoundingClientRect(),i=n.left+this.window.pageXOffset,o=n.top+this.window.pageYOffset,a=this.offset();this.window.scrollTo(vt(I({},e),{left:i-a[0],top:o-a[1]}))}};function fa(t,r){let e=t.getElementById(r)||t.getElementsByName(r)[0];if(e)return e;if(typeof t.createTreeWalker=="function"&&t.body&&typeof t.body.attachShadow=="function"){let n=t.createTreeWalker(t.body,NodeFilter.SHOW_ELEMENT),i=n.currentNode;for(;i;){let o=i.shadowRoot;if(o){let a=o.getElementById(r)||o.querySelector(`[name="${r}"]`);if(a)return a}i=n.nextNode()}}return null}var rt=class{_doc;constructor(r){this._doc=r}manager},Ht=(()=>{class t extends rt{constructor(e){super(e)}supports(e){return!0}addEventListener(e,n,i,o){return e.addEventListener(n,i,o),()=>this.removeEventListener(e,n,i,o)}removeEventListener(e,n,i,o){return e.removeEventListener(n,i,o)}static \u0275fac=function(n){return new(n||t)(h(b))};static \u0275prov=m({token:t,factory:t.\u0275fac})}return t})(),Wt=new p(""),Ln=(()=>{class t{_zone;_plugins;_eventNameToPlugin=new Map;constructor(e,n){this._zone=n,e.forEach(a=>{a.manager=this});let i=e.filter(a=>!(a instanceof Ht));this._plugins=i.slice().reverse();let o=e.find(a=>a instanceof Ht);o&&this._plugins.push(o)}addEventListener(e,n,i,o){return this._findPluginFor(n).addEventListener(e,n,i,o)}getZone(){return this._zone}_findPluginFor(e){let n=this._eventNameToPlugin.get(e);if(n)return n;if(n=this._plugins.find(o=>o.supports(e)),!n)throw new v(5101,!1);return this._eventNameToPlugin.set(e,n),n}static \u0275fac=function(n){return new(n||t)(h(Wt),h(M))};static \u0275prov=m({token:t,factory:t.\u0275fac})}return t})(),Rn="ng-app-id";function bi(t){for(let r of t)r.remove()}function vi(t,r){let e=r.createElement("style");return e.textContent=t,e}function ha(t,r,e,n){let i=t.head?.querySelectorAll(`style[${Rn}="${r}"],link[${Rn}="${r}"]`);if(i)for(let o of i)o.removeAttribute(Rn),o instanceof HTMLLinkElement?n.set(o.href.slice(o.href.lastIndexOf("/")+1),{usage:0,elements:[o]}):o.textContent&&e.set(o.textContent,{usage:0,elements:[o]})}function Nn(t,r){let e=r.createElement("link");return e.setAttribute("rel","stylesheet"),e.setAttribute("href",t),e}var Pn=(()=>{class t{doc;appId;nonce;inline=new Map;external=new Map;hosts=new Set;constructor(e,n,i,o={}){this.doc=e,this.appId=n,this.nonce=i,ha(e,n,this.inline,this.external),this.hosts.add(e.head)}addStyles(e,n){for(let i of e)this.addUsage(i,this.inline,vi);n?.forEach(i=>this.addUsage(i,this.external,Nn))}removeStyles(e,n){for(let i of e)this.removeUsage(i,this.inline);n?.forEach(i=>this.removeUsage(i,this.external))}addUsage(e,n,i){let o=n.get(e);o?o.usage++:n.set(e,{usage:1,elements:[...this.hosts].map(a=>this.addElement(a,i(e,this.doc)))})}removeUsage(e,n){let i=n.get(e);i&&(i.usage--,i.usage<=0&&(bi(i.elements),n.delete(e)))}ngOnDestroy(){for(let[,{elements:e}]of[...this.inline,...this.external])bi(e);this.hosts.clear()}addHost(e){this.hosts.add(e);for(let[n,{elements:i}]of this.inline)i.push(this.addElement(e,vi(n,this.doc)));for(let[n,{elements:i}]of this.external)i.push(this.addElement(e,Nn(n,this.doc)))}removeHost(e){this.hosts.delete(e)}addElement(e,n){return this.nonce&&n.setAttribute("nonce",this.nonce),e.appendChild(n)}static \u0275fac=function(n){return new(n||t)(h(b),h(_e),h(Oe,8),h(Re))};static \u0275prov=m({token:t,factory:t.\u0275fac})}return t})(),On={svg:"http://www.w3.org/2000/svg",xhtml:"http://www.w3.org/1999/xhtml",xlink:"http://www.w3.org/1999/xlink",xml:"http://www.w3.org/XML/1998/namespace",xmlns:"http://www.w3.org/2000/xmlns/",math:"http://www.w3.org/1998/Math/MathML"},kn=/%COMP%/g;var _i="%COMP%",pa=`_nghost-${_i}`,ga=`_ngcontent-${_i}`,ba=!0,va=new p("",{factory:()=>ba});function ya(t){return ga.replace(kn,t)}function _a(t){return pa.replace(kn,t)}function Di(t,r){return r.map(e=>e.replace(kn,t))}var Bn=(()=>{class t{eventManager;sharedStylesHost;appId;removeStylesOnCompDestroy;doc;ngZone;nonce;tracingService;rendererByCompId=new Map;defaultRenderer;constructor(e,n,i,o,a,s,u=null,d=null){this.eventManager=e,this.sharedStylesHost=n,this.appId=i,this.removeStylesOnCompDestroy=o,this.doc=a,this.ngZone=s,this.nonce=u,this.tracingService=d,this.defaultRenderer=new it(e,a,s,this.tracingService)}createRenderer(e,n){if(!e||!n)return this.defaultRenderer;let i=this.getOrCreateRenderer(e,n);return i instanceof Gt?i.applyToHost(e):i instanceof ot&&i.applyStyles(),i}getOrCreateRenderer(e,n){let i=this.rendererByCompId,o=i.get(n.id);if(!o){let a=this.doc,s=this.ngZone,u=this.eventManager,d=this.sharedStylesHost,l=this.removeStylesOnCompDestroy,f=this.tracingService;switch(n.encapsulation){case At.Emulated:o=new Gt(u,d,n,this.appId,l,a,s,f);break;case At.ShadowDom:return new Vt(u,e,n,a,s,this.nonce,f,d);case At.ExperimentalIsolatedShadowDom:return new Vt(u,e,n,a,s,this.nonce,f);default:o=new ot(u,d,n,l,a,s,f);break}i.set(n.id,o)}return o}ngOnDestroy(){this.rendererByCompId.clear()}componentReplaced(e){this.rendererByCompId.delete(e)}static \u0275fac=function(n){return new(n||t)(h(Ln),h(Pn),h(_e),h(va),h(b),h(M),h(Oe),h(Ct,8))};static \u0275prov=m({token:t,factory:t.\u0275fac})}return t})(),it=class{eventManager;doc;ngZone;tracingService;data=Object.create(null);throwOnSyntheticProps=!0;constructor(r,e,n,i){this.eventManager=r,this.doc=e,this.ngZone=n,this.tracingService=i}destroy(){}destroyNode=null;createElement(r,e){return e?this.doc.createElementNS(On[e]||e,r):this.doc.createElement(r)}createComment(r){return this.doc.createComment(r)}createText(r){return this.doc.createTextNode(r)}appendChild(r,e){(yi(r)?r.content:r).appendChild(e)}insertBefore(r,e,n){r&&(yi(r)?r.content:r).insertBefore(e,n)}removeChild(r,e){e.remove()}selectRootElement(r,e){let n=typeof r=="string"?this.doc.querySelector(r):r;if(!n)throw new v(-5104,!1);return e||(n.textContent=""),n}parentNode(r){return r.parentNode}nextSibling(r){return r.nextSibling}setAttribute(r,e,n,i){if(i){e=i+":"+e;let o=On[i];o?r.setAttributeNS(o,e,n):r.setAttribute(e,n)}else r.setAttribute(e,n)}removeAttribute(r,e,n){if(n){let i=On[n];i?r.removeAttributeNS(i,e):r.removeAttribute(`${n}:${e}`)}else r.removeAttribute(e)}addClass(r,e){r.classList.add(e)}removeClass(r,e){r.classList.remove(e)}setStyle(r,e,n,i){i&(Le.DashCase|Le.Important)?r.style.setProperty(e,n,i&Le.Important?"important":""):r.style[e]=n}removeStyle(r,e,n){n&Le.DashCase?r.style.removeProperty(e):r.style[e]=""}setProperty(r,e,n){r!=null&&(r[e]=n)}setValue(r,e){r.nodeValue=e}listen(r,e,n,i){if(typeof r=="string"&&(r=ce().getGlobalEventTarget(this.doc,r),!r))throw new v(5102,!1);let o=this.decoratePreventDefault(n);return this.tracingService?.wrapEventListener&&(o=this.tracingService.wrapEventListener(r,e,o)),this.eventManager.addEventListener(r,e,o,i)}decoratePreventDefault(r){return e=>{if(e==="__ngUnwrap__")return r;r(e)===!1&&e.preventDefault()}}};function yi(t){return t.tagName==="TEMPLATE"&&t.content!==void 0}var Vt=class extends it{hostEl;sharedStylesHost;shadowRoot;constructor(r,e,n,i,o,a,s,u){super(r,i,o,s),this.hostEl=e,this.sharedStylesHost=u,this.shadowRoot=e.attachShadow({mode:"open"}),this.sharedStylesHost&&this.sharedStylesHost.addHost(this.shadowRoot);let d=n.styles;d=Di(n.id,d);for(let f of d){let y=document.createElement("style");a&&y.setAttribute("nonce",a),y.textContent=f,this.shadowRoot.appendChild(y)}let l=n.getExternalStyles?.();if(l)for(let f of l){let y=Nn(f,i);a&&y.setAttribute("nonce",a),this.shadowRoot.appendChild(y)}}nodeOrShadowRoot(r){return r===this.hostEl?this.shadowRoot:r}appendChild(r,e){return super.appendChild(this.nodeOrShadowRoot(r),e)}insertBefore(r,e,n){return super.insertBefore(this.nodeOrShadowRoot(r),e,n)}removeChild(r,e){return super.removeChild(null,e)}parentNode(r){return this.nodeOrShadowRoot(super.parentNode(this.nodeOrShadowRoot(r)))}destroy(){this.sharedStylesHost&&this.sharedStylesHost.removeHost(this.shadowRoot)}},ot=class extends it{sharedStylesHost;removeStylesOnCompDestroy;styles;styleUrls;constructor(r,e,n,i,o,a,s,u){super(r,o,a,s),this.sharedStylesHost=e,this.removeStylesOnCompDestroy=i;let d=n.styles;this.styles=u?Di(u,d):d,this.styleUrls=n.getExternalStyles?.(u)}applyStyles(){this.sharedStylesHost.addStyles(this.styles,this.styleUrls)}destroy(){this.removeStylesOnCompDestroy&&Pr.size===0&&this.sharedStylesHost.removeStyles(this.styles,this.styleUrls)}},Gt=class extends ot{contentAttr;hostAttr;constructor(r,e,n,i,o,a,s,u){let d=i+"-"+n.id;super(r,e,n,o,a,s,u,d),this.contentAttr=ya(d),this.hostAttr=_a(d)}applyToHost(r){this.applyStyles(),this.setAttribute(r,this.hostAttr,"")}createElement(r,e){let n=super.createElement(r,e);return super.setAttribute(n,this.contentAttr,""),n}};var Kt=class t extends Je{supportsDOMEvents=!0;static makeCurrent(){wn(new t)}onAndCancel(r,e,n,i){return r.addEventListener(e,n,i),()=>{r.removeEventListener(e,n,i)}}dispatchEvent(r,e){r.dispatchEvent(e)}remove(r){r.remove()}createElement(r,e){return e=e||this.getDefaultDocument(),e.createElement(r)}createHtmlDocument(){return document.implementation.createHTMLDocument("fakeTitle")}getDefaultDocument(){return document}isElementNode(r){return r.nodeType===Node.ELEMENT_NODE}isShadowRoot(r){return r instanceof DocumentFragment}getGlobalEventTarget(r,e){return e==="window"?window:e==="document"?r:e==="body"?r.body:null}getBaseHref(r){let e=Ea();return e==null?null:wa(e)}resetBaseElement(){at=null}getUserAgent(){return window.navigator.userAgent}getCookie(r){return nt(document.cookie,r)}},at=null;function Ea(){return at=at||document.head.querySelector("base"),at?at.getAttribute("href"):null}function wa(t){return new URL(t,document.baseURI).pathname}var Aa=(()=>{class t{build(){return new XMLHttpRequest}static \u0275fac=function(n){return new(n||t)};static \u0275prov=m({token:t,factory:t.\u0275fac})}return t})(),Ei=["alt","control","meta","shift"],Ca={"\b":"Backspace","	":"Tab","\x7F":"Delete","\x1B":"Escape",Del:"Delete",Esc:"Escape",Left:"ArrowLeft",Right:"ArrowRight",Up:"ArrowUp",Down:"ArrowDown",Menu:"ContextMenu",Scroll:"ScrollLock",Win:"OS"},Ia={alt:t=>t.altKey,control:t=>t.ctrlKey,meta:t=>t.metaKey,shift:t=>t.shiftKey},wi=(()=>{class t extends rt{constructor(e){super(e)}supports(e){return t.parseEventName(e)!=null}addEventListener(e,n,i,o){let a=t.parseEventName(n),s=t.eventCallback(a.fullKey,i,this.manager.getZone());return this.manager.getZone().runOutsideAngular(()=>ce().onAndCancel(e,a.domEventName,s,o))}static parseEventName(e){let n=e.toLowerCase().split("."),i=n.shift();if(n.length===0||!(i==="keydown"||i==="keyup"))return null;let o=t._normalizeKey(n.pop()),a="",s=n.indexOf("code");if(s>-1&&(n.splice(s,1),a="code."),Ei.forEach(d=>{let l=n.indexOf(d);l>-1&&(n.splice(l,1),a+=d+".")}),a+=o,n.length!=0||o.length===0)return null;let u={};return u.domEventName=i,u.fullKey=a,u}static matchEventFullKeyCode(e,n){let i=Ca[e.key]||e.key,o="";return n.indexOf("code.")>-1&&(i=e.code,o="code."),i==null||!i?!1:(i=i.toLowerCase(),i===" "?i="space":i==="."&&(i="dot"),Ei.forEach(a=>{if(a!==i){let s=Ia[a];s(e)&&(o+=a+".")}}),o+=i,o===n)}static eventCallback(e,n,i){return o=>{t.matchEventFullKeyCode(o,e)&&i.runGuarded(()=>n(o))}}static _normalizeKey(e){return e==="esc"?"escape":e}static \u0275fac=function(n){return new(n||t)(h(b))};static \u0275prov=m({token:t,factory:t.\u0275fac})}return t})();async function Ta(t,r,e){let n=I({rootComponent:t},Sa(r,e));return jr(n)}function Sa(t,r){return{platformRef:r?.platformRef,appProviders:[...Oa,...t?.providers??[]],platformProviders:Ra}}function Ma(){Kt.makeCurrent()}function Fa(){return new ye}function xa(){return Ir(document),document}var Ra=[{provide:Re,useValue:xn},{provide:Tr,useValue:Ma,multi:!0},{provide:b,useFactory:xa}];var Oa=[{provide:Er,useValue:"root"},{provide:ye,useFactory:Fa},{provide:Wt,useClass:Ht,multi:!0},{provide:Wt,useClass:wi,multi:!0},Bn,Pn,Ln,{provide:Pe,useExisting:Bn},{provide:Ee,useClass:Aa},[]];var ge=class t{headers;normalizedNames=new Map;lazyInit;lazyUpdate=null;constructor(r){r?typeof r=="string"?this.lazyInit=()=>{this.headers=new Map,r.split(`
`).forEach(e=>{let n=e.indexOf(":");if(n>0){let i=e.slice(0,n),o=e.slice(n+1).trim();this.addHeaderEntry(i,o)}})}:typeof Headers<"u"&&r instanceof Headers?(this.headers=new Map,r.forEach((e,n)=>{this.addHeaderEntry(n,e)})):this.lazyInit=()=>{this.headers=new Map,Object.entries(r).forEach(([e,n])=>{this.setHeaderEntries(e,n)})}:this.headers=new Map}has(r){return this.init(),this.headers.has(r.toLowerCase())}get(r){this.init();let e=this.headers.get(r.toLowerCase());return e&&e.length>0?e[0]:null}keys(){return this.init(),Array.from(this.normalizedNames.values())}getAll(r){return this.init(),this.headers.get(r.toLowerCase())||null}append(r,e){return this.clone({name:r,value:e,op:"a"})}set(r,e){return this.clone({name:r,value:e,op:"s"})}delete(r,e){return this.clone({name:r,value:e,op:"d"})}maybeSetNormalizedName(r,e){this.normalizedNames.has(e)||this.normalizedNames.set(e,r)}init(){this.lazyInit&&(this.lazyInit instanceof t?this.copyFrom(this.lazyInit):this.lazyInit(),this.lazyInit=null,this.lazyUpdate&&(this.lazyUpdate.forEach(r=>this.applyUpdate(r)),this.lazyUpdate=null))}copyFrom(r){r.init();for(let[e,n]of r.headers.entries())this.headers.set(e,n),this.normalizedNames.set(e,r.normalizedNames.get(e))}clone(r){let e=new t;return e.lazyInit=this.lazyInit&&this.lazyInit instanceof t?this.lazyInit:this,e.lazyUpdate=(this.lazyUpdate||[]).concat([r]),e}applyUpdate(r){let e=r.name.toLowerCase();switch(r.op){case"a":case"s":let n=r.value;if(typeof n=="string"&&(n=[n]),n.length===0)return;this.maybeSetNormalizedName(r.name,e);let i=r.op==="a"?(this.headers.get(e)||[]).slice():[];i.push(...n),this.headers.set(e,i);break;case"d":let o=r.value;if(o===void 0)this.headers.delete(e),this.normalizedNames.delete(e);else{let a=Array.isArray(o)?o:[o],s=this.headers.get(e);if(!s)return;s=s.filter(u=>a.indexOf(u)===-1),s.length===0?(this.headers.delete(e),this.normalizedNames.delete(e)):this.headers.set(e,s)}break}}addHeaderEntry(r,e){let n=r.toLowerCase();this.maybeSetNormalizedName(r,n),this.headers.has(n)?this.headers.get(n).push(e):this.headers.set(n,[e])}setHeaderEntries(r,e){let n=(Array.isArray(e)?e:[e]).map(o=>o.toString()),i=r.toLowerCase();this.headers.set(i,n),this.maybeSetNormalizedName(r,i)}forEach(r){this.init(),Array.from(this.normalizedNames.keys()).forEach(e=>r(this.normalizedNames.get(e),this.headers.get(e)))}};var Yt=class{map=new Map;set(r,e){return this.map.set(r,e),this}get(r){return this.map.has(r)||this.map.set(r,r.defaultValue()),this.map.get(r)}delete(r){return this.map.delete(r),this}has(r){return this.map.has(r)}keys(){return this.map.keys()}},Xt=class{encodeKey(r){return Ai(r)}encodeValue(r){return Ai(r)}decodeKey(r){return decodeURIComponent(r)}decodeValue(r){return decodeURIComponent(r)}};function Na(t,r){let e=new Map;return t.length>0&&t.replace(/^\?/,"").split("&").forEach(i=>{let o=i.indexOf("="),[a,s]=o==-1?[r.decodeKey(i),""]:[r.decodeKey(i.slice(0,o)),r.decodeValue(i.slice(o+1))],u=e.get(a)||[];u.push(s),e.set(a,u)}),e}var La=/%(\d[a-f0-9])/gi,Pa={40:"@","3A":":",24:"$","2C":",","3B":";","3D":"=","3F":"?","2F":"/"};function Ai(t){return encodeURIComponent(t).replace(La,(r,e)=>Pa[e]??r)}function Zt(t){return`${t}`}var de=class t{map;encoder;updates=null;cloneFrom=null;constructor(r={}){if(this.encoder=r.encoder||new Xt,r.fromString){if(r.fromObject)throw new v(2805,!1);this.map=Na(r.fromString,this.encoder)}else r.fromObject?(this.map=new Map,Object.keys(r.fromObject).forEach(e=>{let n=r.fromObject[e],i=Array.isArray(n)?n.map(Zt):[Zt(n)];this.map.set(e,i)})):this.map=null}has(r){return this.init(),this.map.has(r)}get(r){this.init();let e=this.map.get(r);return e?e[0]:null}getAll(r){return this.init(),this.map.get(r)||null}keys(){return this.init(),Array.from(this.map.keys())}append(r,e){return this.clone({param:r,value:e,op:"a"})}appendAll(r){let e=[];return Object.keys(r).forEach(n=>{let i=r[n];Array.isArray(i)?i.forEach(o=>{e.push({param:n,value:o,op:"a"})}):e.push({param:n,value:i,op:"a"})}),this.clone(e)}set(r,e){return this.clone({param:r,value:e,op:"s"})}delete(r,e){return this.clone({param:r,value:e,op:"d"})}toString(){return this.init(),this.keys().map(r=>{let e=this.encoder.encodeKey(r);return this.map.get(r).map(n=>e+"="+this.encoder.encodeValue(n)).join("&")}).filter(r=>r!=="").join("&")}clone(r){let e=new t({encoder:this.encoder});return e.cloneFrom=this.cloneFrom||this,e.updates=(this.updates||[]).concat(r),e}init(){if(this.map===null&&(this.map=new Map),this.cloneFrom!==null){this.cloneFrom.init();for(let[r,e]of this.cloneFrom.map.entries())this.map.set(r,e);this.updates.forEach(r=>{switch(r.op){case"a":case"s":let e=r.op==="a"?(this.map.get(r.param)||[]).slice():[];e.push(Zt(r.value)),this.map.set(r.param,e);break;case"d":if(r.value!==void 0){let n=(this.map.get(r.param)||[]).slice(),i=n.indexOf(Zt(r.value));i!==-1&&n.splice(i,1),n.length>0?this.map.set(r.param,n):this.map.delete(r.param)}else{this.map.delete(r.param);break}}}),this.cloneFrom=this.updates=null}}};function ka(t){switch(t){case"DELETE":case"GET":case"HEAD":case"OPTIONS":case"JSONP":return!1;default:return!0}}function Ci(t){return typeof ArrayBuffer<"u"&&t instanceof ArrayBuffer}function Ii(t){return typeof Blob<"u"&&t instanceof Blob}function Ti(t){return typeof FormData<"u"&&t instanceof FormData}function Ba(t){return typeof URLSearchParams<"u"&&t instanceof URLSearchParams}var Si="Content-Type",Mi="Accept",Fi="text/plain",xi="application/json",Ua=`${xi}, ${Fi}, */*`,Ue=class t{url;body=null;headers;context;reportProgress=!1;withCredentials=!1;credentials;keepalive=!1;cache;priority;mode;redirect;referrer;integrity;referrerPolicy;responseType="json";method;params;urlWithParams;transferCache;timeout;constructor(r,e,n,i){this.url=e,this.method=r.toUpperCase();let o;if(ka(this.method)||i?(this.body=n!==void 0?n:null,o=i):o=n,o){if(this.reportProgress=!!o.reportProgress,this.withCredentials=!!o.withCredentials,this.keepalive=!!o.keepalive,o.responseType&&(this.responseType=o.responseType),o.headers&&(this.headers=o.headers),o.context&&(this.context=o.context),o.params&&(this.params=o.params),o.priority&&(this.priority=o.priority),o.cache&&(this.cache=o.cache),o.credentials&&(this.credentials=o.credentials),typeof o.timeout=="number"){if(o.timeout<1||!Number.isInteger(o.timeout))throw new v(2822,"");this.timeout=o.timeout}o.mode&&(this.mode=o.mode),o.redirect&&(this.redirect=o.redirect),o.integrity&&(this.integrity=o.integrity),o.referrer!==void 0&&(this.referrer=o.referrer),o.referrerPolicy&&(this.referrerPolicy=o.referrerPolicy),this.transferCache=o.transferCache}if(this.headers??=new ge,this.context??=new Yt,!this.params)this.params=new de,this.urlWithParams=e;else{let a=this.params.toString();if(a.length===0)this.urlWithParams=e;else{let s=e.indexOf("?"),u=s===-1?"?":s<e.length-1?"&":"";this.urlWithParams=e+u+a}}}serializeBody(){return this.body===null?null:typeof this.body=="string"||Ci(this.body)||Ii(this.body)||Ti(this.body)||Ba(this.body)?this.body:this.body instanceof de?this.body.toString():typeof this.body=="object"||typeof this.body=="boolean"||Array.isArray(this.body)?JSON.stringify(this.body):this.body.toString()}detectContentTypeHeader(){return this.body===null||Ti(this.body)?null:Ii(this.body)?this.body.type||null:Ci(this.body)?null:typeof this.body=="string"?Fi:this.body instanceof de?"application/x-www-form-urlencoded;charset=UTF-8":typeof this.body=="object"||typeof this.body=="number"||typeof this.body=="boolean"?xi:null}clone(r={}){let e=r.method||this.method,n=r.url||this.url,i=r.responseType||this.responseType,o=r.keepalive??this.keepalive,a=r.priority||this.priority,s=r.cache||this.cache,u=r.mode||this.mode,d=r.redirect||this.redirect,l=r.credentials||this.credentials,f=r.referrer??this.referrer,y=r.integrity||this.integrity,D=r.referrerPolicy||this.referrerPolicy,C=r.transferCache??this.transferCache,R=r.timeout??this.timeout,g=r.body!==void 0?r.body:this.body,_=r.withCredentials??this.withCredentials,S=r.reportProgress??this.reportProgress,Y=r.headers||this.headers,T=r.params||this.params,fe=r.context??this.context;return r.setHeaders!==void 0&&(Y=Object.keys(r.setHeaders).reduce((se,ve)=>se.set(ve,r.setHeaders[ve]),Y)),r.setParams&&(T=Object.keys(r.setParams).reduce((se,ve)=>se.set(ve,r.setParams[ve]),T)),new t(e,n,g,{params:T,headers:Y,context:fe,reportProgress:S,responseType:i,withCredentials:_,transferCache:C,keepalive:o,cache:s,priority:a,timeout:R,mode:u,redirect:d,credentials:l,referrer:f,integrity:y,referrerPolicy:D})}},we=(function(t){return t[t.Sent=0]="Sent",t[t.UploadProgress=1]="UploadProgress",t[t.ResponseHeader=2]="ResponseHeader",t[t.DownloadProgress=3]="DownloadProgress",t[t.Response=4]="Response",t[t.User=5]="User",t})(we||{}),ze=class{headers;status;statusText;url;ok;type;redirected;responseType;constructor(r,e=200,n="OK"){this.headers=r.headers||new ge,this.status=r.status!==void 0?r.status:e,this.statusText=r.statusText||n,this.url=r.url||null,this.redirected=r.redirected,this.responseType=r.responseType,this.ok=this.status>=200&&this.status<300}},Jt=class t extends ze{constructor(r={}){super(r)}type=we.ResponseHeader;clone(r={}){return new t({headers:r.headers||this.headers,status:r.status!==void 0?r.status:this.status,statusText:r.statusText||this.statusText,url:r.url||this.url||void 0})}},st=class t extends ze{body;constructor(r={}){super(r),this.body=r.body!==void 0?r.body:null}type=we.Response;clone(r={}){return new t({body:r.body!==void 0?r.body:this.body,headers:r.headers||this.headers,status:r.status!==void 0?r.status:this.status,statusText:r.statusText||this.statusText,url:r.url||this.url||void 0,redirected:r.redirected??this.redirected,responseType:r.responseType??this.responseType})}},je=class extends ze{name="HttpErrorResponse";message;error;ok=!1;constructor(r){super(r,0,"Unknown Error"),this.status>=200&&this.status<300?this.message=`Http failure during parsing for ${r.url||"(unknown url)"}`:this.message=`Http failure response for ${r.url||"(unknown url)"}: ${r.status} ${r.statusText}`,this.error=r.error||null}},ja=200,za=204;var $a=new p("");var Ha=/^\)\]\}',?\n/;var jn=(()=>{class t{xhrFactory;tracingService=c(Ct,{optional:!0});constructor(e){this.xhrFactory=e}maybePropagateTrace(e){return this.tracingService?.propagate?this.tracingService.propagate(e):e}handle(e){if(e.method==="JSONP")throw new v(-2800,!1);let n=this.xhrFactory;return q(null).pipe(Dr(()=>new Te(o=>{let a=n.build();if(a.open(e.method,e.urlWithParams),e.withCredentials&&(a.withCredentials=!0),e.headers.forEach((g,_)=>a.setRequestHeader(g,_.join(","))),e.headers.has(Mi)||a.setRequestHeader(Mi,Ua),!e.headers.has(Si)){let g=e.detectContentTypeHeader();g!==null&&a.setRequestHeader(Si,g)}if(e.timeout&&(a.timeout=e.timeout),e.responseType){let g=e.responseType.toLowerCase();a.responseType=g!=="json"?g:"text"}let s=e.serializeBody(),u=null,d=()=>{if(u!==null)return u;let g=a.statusText||"OK",_=new ge(a.getAllResponseHeaders()),S=a.responseURL||e.url;return u=new Jt({headers:_,status:a.status,statusText:g,url:S}),u},l=this.maybePropagateTrace(()=>{let{headers:g,status:_,statusText:S,url:Y}=d(),T=null;_!==za&&(T=typeof a.response>"u"?a.responseText:a.response),_===0&&(_=T?ja:0);let fe=_>=200&&_<300;if(e.responseType==="json"&&typeof T=="string"){let se=T;T=T.replace(Ha,"");try{T=T!==""?JSON.parse(T):null}catch(ve){T=se,fe&&(fe=!1,T={error:ve,text:T})}}fe?(o.next(new st({body:T,headers:g,status:_,statusText:S,url:Y||void 0})),o.complete()):o.error(new je({error:T,headers:g,status:_,statusText:S,url:Y||void 0}))}),f=this.maybePropagateTrace(g=>{let{url:_}=d(),S=new je({error:g,status:a.status||0,statusText:a.statusText||"Unknown Error",url:_||void 0});o.error(S)}),y=f;e.timeout&&(y=this.maybePropagateTrace(g=>{let{url:_}=d(),S=new je({error:new DOMException("Request timed out","TimeoutError"),status:a.status||0,statusText:a.statusText||"Request timeout",url:_||void 0});o.error(S)}));let D=!1,C=this.maybePropagateTrace(g=>{D||(o.next(d()),D=!0);let _={type:we.DownloadProgress,loaded:g.loaded};g.lengthComputable&&(_.total=g.total),e.responseType==="text"&&a.responseText&&(_.partialText=a.responseText),o.next(_)}),R=this.maybePropagateTrace(g=>{let _={type:we.UploadProgress,loaded:g.loaded};g.lengthComputable&&(_.total=g.total),o.next(_)});return a.addEventListener("load",l),a.addEventListener("error",f),a.addEventListener("timeout",y),a.addEventListener("abort",f),e.reportProgress&&(a.addEventListener("progress",C),s!==null&&a.upload&&a.upload.addEventListener("progress",R)),a.send(s),o.next({type:we.Sent}),()=>{a.removeEventListener("error",f),a.removeEventListener("abort",f),a.removeEventListener("load",l),a.removeEventListener("timeout",y),e.reportProgress&&(a.removeEventListener("progress",C),s!==null&&a.upload&&a.upload.removeEventListener("progress",R)),a.readyState!==a.DONE&&a.abort()}})))}static \u0275fac=function(n){return new(n||t)(h(Ee))};static \u0275prov=m({token:t,factory:t.\u0275fac,providedIn:"root"})}return t})(),Va=new p("",{factory:()=>!0}),Ga="XSRF-TOKEN",Wa=new p("",{factory:()=>Ga}),Ka="X-XSRF-TOKEN",Za=new p("",{factory:()=>Ka}),Ya=(()=>{class t{cookieName=c(Wa);doc=c(b);lastCookieString="";lastToken=null;parseCount=0;getToken(){let e=this.doc.cookie||"";return e!==this.lastCookieString&&(this.parseCount++,this.lastToken=nt(e,this.cookieName),this.lastCookieString=e),this.lastToken}static \u0275fac=function(n){return new(n||t)};static \u0275prov=m({token:t,factory:t.\u0275fac,providedIn:"root"})}return t})(),Ri=(()=>{class t{static \u0275fac=function(n){return new(n||t)};static \u0275prov=m({token:t,factory:function(n){let i=null;return n?i=new(n||t):i=h(Ya),i},providedIn:"root"})}return t})();function Oi(t,r){if(!c(Va)||t.method==="GET"||t.method==="HEAD")return r(t);try{let i=c(pe).href,{origin:o}=new URL(i),{origin:a}=new URL(t.url,o);if(o!==a)return r(t)}catch{return r(t)}let e=c(Ri).getToken(),n=c(Za);return e!=null&&!t.headers.has(n)&&(t=t.clone({headers:t.headers.set(n,e)})),r(t)}function Xa(t,r){return r(t)}function Ja(t,r,e){return(n,i)=>wr(e,()=>r(n,o=>t(o,i)))}var zn=new p("",{factory:()=>[Oi]}),Ni=new p(""),Li=new p("",{factory:()=>!0});var $n=(()=>{class t{static \u0275fac=function(n){return new(n||t)};static \u0275prov=m({token:t,factory:function(n){let i=null;return n?i=new(n||t):i=h(jn),i},providedIn:"root"})}return t})();var qt=(()=>{class t{backend;injector;chain=null;pendingTasks=c(Ar);contributeToStability=c(Li);constructor(e,n){this.backend=e,this.injector=n}handle(e){if(this.chain===null){let n=this.injector.get(Qt,null,{skipSelf:!0}),i=n!==null&&this.backend===n,o=this.injector.get(Ni,[],i?{self:!0}:void 0),a=Array.from(new Set([...this.injector.get(zn),...o]));this.chain=a.reduceRight((s,u)=>Ja(s,u,this.injector),Xa)}if(this.contributeToStability){let n=this.pendingTasks.add();return this.chain(e,i=>this.backend.handle(i)).pipe(Dt(n))}else return this.chain(e,n=>this.backend.handle(n))}static \u0275fac=function(n){return new(n||t)(h($n),h(Ze))};static \u0275prov=m({token:t,factory:t.\u0275fac,providedIn:"root"})}return t})(),Qt=(()=>{class t{static \u0275fac=function(n){return new(n||t)};static \u0275prov=m({token:t,factory:function(n){let i=null;return n?i=new(n||t):i=h(qt),i},providedIn:"root"})}return t})();function Un(t,r){return{body:r,headers:t.headers,context:t.context,observe:t.observe,params:t.params,reportProgress:t.reportProgress,responseType:t.responseType,withCredentials:t.withCredentials,credentials:t.credentials,transferCache:t.transferCache,timeout:t.timeout,keepalive:t.keepalive,priority:t.priority,cache:t.cache,mode:t.mode,redirect:t.redirect,integrity:t.integrity,referrer:t.referrer,referrerPolicy:t.referrerPolicy}}var en=(()=>{class t{handler;constructor(e){this.handler=e}request(e,n,i={}){let o;if(e instanceof Ue)o=e;else{let u;i.headers instanceof ge?u=i.headers:u=new ge(i.headers);let d;i.params&&(i.params instanceof de?d=i.params:d=new de({fromObject:i.params})),o=new Ue(e,n,i.body!==void 0?i.body:null,{headers:u,context:i.context,params:d,reportProgress:i.reportProgress,responseType:i.responseType||"json",withCredentials:i.withCredentials,transferCache:i.transferCache,keepalive:i.keepalive,priority:i.priority,cache:i.cache,mode:i.mode,redirect:i.redirect,credentials:i.credentials,referrer:i.referrer,referrerPolicy:i.referrerPolicy,integrity:i.integrity,timeout:i.timeout})}let a=q(o).pipe(br(u=>this.handler.handle(u)));if(e instanceof Ue||i.observe==="events")return a;let s=a.pipe(Se(u=>u instanceof st));switch(i.observe||"body"){case"body":switch(o.responseType){case"arraybuffer":return s.pipe(O(u=>{if(u.body!==null&&!(u.body instanceof ArrayBuffer))throw new v(2806,!1);return u.body}));case"blob":return s.pipe(O(u=>{if(u.body!==null&&!(u.body instanceof Blob))throw new v(2807,!1);return u.body}));case"text":return s.pipe(O(u=>{if(u.body!==null&&typeof u.body!="string")throw new v(2808,!1);return u.body}));default:return s.pipe(O(u=>u.body))}case"response":return s;default:throw new v(2809,!1)}}delete(e,n={}){return this.request("DELETE",e,n)}get(e,n={}){return this.request("GET",e,n)}head(e,n={}){return this.request("HEAD",e,n)}jsonp(e,n){return this.request("JSONP",e,{params:new de().append(n,"JSONP_CALLBACK"),observe:"body",responseType:"json"})}options(e,n={}){return this.request("OPTIONS",e,n)}patch(e,n,i={}){return this.request("PATCH",e,Un(i,n))}post(e,n,i={}){return this.request("POST",e,Un(i,n))}put(e,n,i={}){return this.request("PUT",e,Un(i,n))}static \u0275fac=function(n){return new(n||t)(h(Qt))};static \u0275prov=m({token:t,factory:t.\u0275fac,providedIn:"root"})}return t})();var Hn=(function(t){return t[t.Interceptors=0]="Interceptors",t[t.LegacyInterceptors=1]="LegacyInterceptors",t[t.CustomXsrfConfiguration=2]="CustomXsrfConfiguration",t[t.NoXsrfProtection=3]="NoXsrfProtection",t[t.JsonpSupport=4]="JsonpSupport",t[t.RequestsMadeViaParent=5]="RequestsMadeViaParent",t[t.Fetch=6]="Fetch",t})(Hn||{});function qa(t,r){return{\u0275kind:t,\u0275providers:r}}function Qa(...t){let r=[en,qt,{provide:Qt,useExisting:qt},{provide:$n,useFactory:()=>c($a,{optional:!0})??c(jn)},{provide:zn,useValue:Oi,multi:!0}];for(let e of t)r.push(...e.\u0275providers);return pn(r)}function es(t){return qa(Hn.Interceptors,t.map(r=>({provide:zn,useValue:r,multi:!0})))}var rl=(()=>{class t{_doc;constructor(e){this._doc=e}getTitle(){return this._doc.title}setTitle(e){this._doc.title=e||""}static \u0275fac=function(n){return new(n||t)(h(b))};static \u0275prov=m({token:t,factory:t.\u0275fac,providedIn:"root"})}return t})();var ct=(()=>{class t{static \u0275fac=function(n){return new(n||t)};static \u0275prov=m({token:t,factory:function(n){let i=null;return n?i=new(n||t):i=h(ns),i},providedIn:"root"})}return t})(),ns=(()=>{class t extends ct{_doc;constructor(e){super(),this._doc=e}sanitize(e,n){if(n==null)return null;switch(e){case B.NONE:return n;case B.HTML:return Ne(n,"HTML")?De(n):Lr(this._doc,String(n)).toString();case B.STYLE:return Ne(n,"Style")?De(n):n;case B.SCRIPT:if(Ne(n,"Script"))return De(n);throw new v(5200,!1);case B.URL:return Ne(n,"URL")?De(n):Nr(String(n));case B.RESOURCE_URL:if(Ne(n,"ResourceURL"))return De(n);throw new v(5201,!1);default:throw new v(5202,!1)}}bypassSecurityTrustHtml(e){return Mr(e)}bypassSecurityTrustStyle(e){return Fr(e)}bypassSecurityTrustScript(e){return xr(e)}bypassSecurityTrustUrl(e){return Rr(e)}bypassSecurityTrustResourceUrl(e){return Or(e)}static \u0275fac=function(n){return new(n||t)(h(b))};static \u0275prov=m({token:t,factory:t.\u0275fac,providedIn:"root"})}return t})();function ut(t){return t.buttons===0||t.detail===0}function dt(t){let r=t.touches&&t.touches[0]||t.changedTouches&&t.changedTouches[0];return!!r&&r.identifier===-1&&(r.radiusX==null||r.radiusX===1)&&(r.radiusY==null||r.radiusY===1)}var Vn;function Pi(){if(Vn==null){let t=typeof document<"u"?document.head:null;Vn=!!(t&&(t.createShadowRoot||t.attachShadow))}return Vn}function Gn(t){if(Pi()){let r=t.getRootNode?t.getRootNode():null;if(typeof ShadowRoot<"u"&&ShadowRoot&&r instanceof ShadowRoot)return r}return null}function is(){let t=typeof document<"u"&&document?document.activeElement:null;for(;t&&t.shadowRoot;){let r=t.shadowRoot.activeElement;if(r===t)break;t=r}return t}function re(t){return t.composedPath?t.composedPath()[0]:t.target}var Wn;try{Wn=typeof Intl<"u"&&Intl.v8BreakIterator}catch{Wn=!1}var j=(()=>{class t{_platformId=c(Re);isBrowser=this._platformId?gi(this._platformId):typeof document=="object"&&!!document;EDGE=this.isBrowser&&/(edge)/i.test(navigator.userAgent);TRIDENT=this.isBrowser&&/(msie|trident)/i.test(navigator.userAgent);BLINK=this.isBrowser&&!!(window.chrome||Wn)&&typeof CSS<"u"&&!this.EDGE&&!this.TRIDENT;WEBKIT=this.isBrowser&&/AppleWebKit/i.test(navigator.userAgent)&&!this.BLINK&&!this.EDGE&&!this.TRIDENT;IOS=this.isBrowser&&/iPad|iPhone|iPod/.test(navigator.userAgent)&&!("MSStream"in window);FIREFOX=this.isBrowser&&/(firefox|minefield)/i.test(navigator.userAgent);ANDROID=this.isBrowser&&/android/i.test(navigator.userAgent)&&!this.TRIDENT;SAFARI=this.isBrowser&&/safari/i.test(navigator.userAgent)&&this.WEBKIT;constructor(){}static \u0275fac=function(n){return new(n||t)};static \u0275prov=m({token:t,factory:t.\u0275fac,providedIn:"root"})}return t})();var lt;function ki(){if(lt==null&&typeof window<"u")try{window.addEventListener("test",null,Object.defineProperty({},"passive",{get:()=>lt=!0}))}finally{lt=lt||!1}return lt}function $e(t){return ki()?t:!!t.capture}function Kn(t,r=0){return Bi(t)?Number(t):arguments.length===2?r:0}function Bi(t){return!isNaN(parseFloat(t))&&!isNaN(Number(t))}function ae(t){return t instanceof U?t.nativeElement:t}var Ui=new p("cdk-input-modality-detector-options"),ji={ignoreKeys:[18,17,224,91,16]},zi=650,Zn={passive:!0,capture:!0},$i=(()=>{class t{_platform=c(j);_listenerCleanups;modalityDetected;modalityChanged;get mostRecentModality(){return this._modality.value}_mostRecentTarget=null;_modality=new lr(null);_options;_lastTouchMs=0;_onKeydown=e=>{this._options?.ignoreKeys?.some(n=>n===e.keyCode)||(this._modality.next("keyboard"),this._mostRecentTarget=re(e))};_onMousedown=e=>{Date.now()-this._lastTouchMs<zi||(this._modality.next(ut(e)?"keyboard":"mouse"),this._mostRecentTarget=re(e))};_onTouchstart=e=>{if(dt(e)){this._modality.next("keyboard");return}this._lastTouchMs=Date.now(),this._modality.next("touch"),this._mostRecentTarget=re(e)};constructor(){let e=c(M),n=c(b),i=c(Ui,{optional:!0});if(this._options=I(I({},ji),i),this.modalityDetected=this._modality.pipe(Et(1)),this.modalityChanged=this.modalityDetected.pipe(vr()),this._platform.isBrowser){let o=c(Pe).createRenderer(null,null);this._listenerCleanups=e.runOutsideAngular(()=>[o.listen(n,"keydown",this._onKeydown,Zn),o.listen(n,"mousedown",this._onMousedown,Zn),o.listen(n,"touchstart",this._onTouchstart,Zn)])}}ngOnDestroy(){this._modality.complete(),this._listenerCleanups?.forEach(e=>e())}static \u0275fac=function(n){return new(n||t)};static \u0275prov=m({token:t,factory:t.\u0275fac,providedIn:"root"})}return t})(),mt=(function(t){return t[t.IMMEDIATE=0]="IMMEDIATE",t[t.EVENTUAL=1]="EVENTUAL",t})(mt||{}),Hi=new p("cdk-focus-monitor-default-options"),tn=$e({passive:!0,capture:!0}),nn=(()=>{class t{_ngZone=c(M);_platform=c(j);_inputModalityDetector=c($i);_origin=null;_lastFocusOrigin=null;_windowFocused=!1;_windowFocusTimeoutId;_originTimeoutId;_originFromTouchInteraction=!1;_elementInfo=new Map;_monitoredElementCount=0;_rootNodeFocusListenerCount=new Map;_detectionMode;_windowFocusListener=()=>{this._windowFocused=!0,this._windowFocusTimeoutId=setTimeout(()=>this._windowFocused=!1)};_document=c(b);_stopInputModalityDetector=new k;constructor(){let e=c(Hi,{optional:!0});this._detectionMode=e?.detectionMode||mt.IMMEDIATE}_rootNodeFocusAndBlurListener=e=>{let n=re(e);for(let i=n;i;i=i.parentElement)e.type==="focus"?this._onFocus(e,i):this._onBlur(e,i)};monitor(e,n=!1){let i=ae(e);if(!this._platform.isBrowser||i.nodeType!==1)return q();let o=Gn(i)||this._document,a=this._elementInfo.get(i);if(a)return n&&(a.checkChildren=!0),a.subject;let s={checkChildren:n,subject:new k,rootNode:o};return this._elementInfo.set(i,s),this._registerGlobalListeners(s),s.subject}stopMonitoring(e){let n=ae(e),i=this._elementInfo.get(n);i&&(i.subject.complete(),this._setClasses(n),this._elementInfo.delete(n),this._removeGlobalListeners(i))}focusVia(e,n,i){let o=ae(e),a=this._document.activeElement;o===a?this._getClosestElementsInfo(o).forEach(([s,u])=>this._originChanged(s,n,u)):(this._setOrigin(n),typeof o.focus=="function"&&o.focus(i))}ngOnDestroy(){this._elementInfo.forEach((e,n)=>this.stopMonitoring(n))}_getWindow(){return this._document.defaultView||window}_getFocusOrigin(e){return this._origin?this._originFromTouchInteraction?this._shouldBeAttributedToTouch(e)?"touch":"program":this._origin:this._windowFocused&&this._lastFocusOrigin?this._lastFocusOrigin:e&&this._isLastInteractionFromInputLabel(e)?"mouse":"program"}_shouldBeAttributedToTouch(e){return this._detectionMode===mt.EVENTUAL||!!e?.contains(this._inputModalityDetector._mostRecentTarget)}_setClasses(e,n){e.classList.toggle("cdk-focused",!!n),e.classList.toggle("cdk-touch-focused",n==="touch"),e.classList.toggle("cdk-keyboard-focused",n==="keyboard"),e.classList.toggle("cdk-mouse-focused",n==="mouse"),e.classList.toggle("cdk-program-focused",n==="program")}_setOrigin(e,n=!1){this._ngZone.runOutsideAngular(()=>{if(this._origin=e,this._originFromTouchInteraction=e==="touch"&&n,this._detectionMode===mt.IMMEDIATE){clearTimeout(this._originTimeoutId);let i=this._originFromTouchInteraction?zi:1;this._originTimeoutId=setTimeout(()=>this._origin=null,i)}})}_onFocus(e,n){let i=this._elementInfo.get(n),o=re(e);!i||!i.checkChildren&&n!==o||this._originChanged(n,this._getFocusOrigin(o),i)}_onBlur(e,n){let i=this._elementInfo.get(n);!i||i.checkChildren&&e.relatedTarget instanceof Node&&n.contains(e.relatedTarget)||(this._setClasses(n),this._emitOrigin(i,null))}_emitOrigin(e,n){e.subject.observers.length&&this._ngZone.run(()=>e.subject.next(n))}_registerGlobalListeners(e){if(!this._platform.isBrowser)return;let n=e.rootNode,i=this._rootNodeFocusListenerCount.get(n)||0;i||this._ngZone.runOutsideAngular(()=>{n.addEventListener("focus",this._rootNodeFocusAndBlurListener,tn),n.addEventListener("blur",this._rootNodeFocusAndBlurListener,tn)}),this._rootNodeFocusListenerCount.set(n,i+1),++this._monitoredElementCount===1&&(this._ngZone.runOutsideAngular(()=>{this._getWindow().addEventListener("focus",this._windowFocusListener)}),this._inputModalityDetector.modalityDetected.pipe(wt(this._stopInputModalityDetector)).subscribe(o=>{this._setOrigin(o,!0)}))}_removeGlobalListeners(e){let n=e.rootNode;if(this._rootNodeFocusListenerCount.has(n)){let i=this._rootNodeFocusListenerCount.get(n);i>1?this._rootNodeFocusListenerCount.set(n,i-1):(n.removeEventListener("focus",this._rootNodeFocusAndBlurListener,tn),n.removeEventListener("blur",this._rootNodeFocusAndBlurListener,tn),this._rootNodeFocusListenerCount.delete(n))}--this._monitoredElementCount||(this._getWindow().removeEventListener("focus",this._windowFocusListener),this._stopInputModalityDetector.next(),clearTimeout(this._windowFocusTimeoutId),clearTimeout(this._originTimeoutId))}_originChanged(e,n,i){this._setClasses(e,n),this._emitOrigin(i,n),this._lastFocusOrigin=n}_getClosestElementsInfo(e){let n=[];return this._elementInfo.forEach((i,o)=>{(o===e||i.checkChildren&&o.contains(e))&&n.push([o,i])}),n}_isLastInteractionFromInputLabel(e){let{_mostRecentTarget:n,mostRecentModality:i}=this._inputModalityDetector;if(i!=="mouse"||!n||n===e||e.nodeName!=="INPUT"&&e.nodeName!=="TEXTAREA"||e.disabled)return!1;let o=e.labels;if(o){for(let a=0;a<o.length;a++)if(o[a].contains(n))return!0}return!1}static \u0275fac=function(n){return new(n||t)};static \u0275prov=m({token:t,factory:t.\u0275fac,providedIn:"root"})}return t})(),os=(()=>{class t{_elementRef=c(U);_focusMonitor=c(nn);_monitorSubscription;_focusOrigin=null;cdkFocusChange=new xe;constructor(){}get focusOrigin(){return this._focusOrigin}ngAfterViewInit(){let e=this._elementRef.nativeElement;this._monitorSubscription=this._focusMonitor.monitor(e,e.nodeType===1&&e.hasAttribute("cdkMonitorSubtreeFocus")).subscribe(n=>{this._focusOrigin=n,this.cdkFocusChange.emit(n)})}ngOnDestroy(){this._focusMonitor.stopMonitoring(this._elementRef),this._monitorSubscription?.unsubscribe()}static \u0275fac=function(n){return new(n||t)};static \u0275dir=H({type:t,selectors:[["","cdkMonitorElementFocus",""],["","cdkMonitorSubtreeFocus",""]],outputs:{cdkFocusChange:"cdkFocusChange"},exportAs:["cdkMonitorFocus"]})}return t})();var rn=new WeakMap,le=(()=>{class t{_appRef;_injector=c(z);_environmentInjector=c(Ze);load(e){let n=this._appRef=this._appRef||this._injector.get(_n),i=rn.get(n);i||(i={loaders:new Set,refs:[]},rn.set(n,i),n.onDestroy(()=>{rn.get(n)?.refs.forEach(o=>o.destroy()),rn.delete(n)})),i.loaders.has(e)||(i.loaders.add(e),i.refs.push(zr(e,{environmentInjector:this._environmentInjector})))}static \u0275fac=function(n){return new(n||t)};static \u0275prov=m({token:t,factory:t.\u0275fac,providedIn:"root"})}return t})();var an=(()=>{class t{static \u0275fac=function(n){return new(n||t)};static \u0275cmp=$({type:t,selectors:[["ng-component"]],exportAs:["cdkVisuallyHidden"],decls:0,vars:0,template:function(n,i){},styles:[`.cdk-visually-hidden {
  border: 0;
  clip: rect(0 0 0 0);
  height: 1px;
  margin: -1px;
  overflow: hidden;
  padding: 0;
  position: absolute;
  width: 1px;
  white-space: nowrap;
  outline: 0;
  -webkit-appearance: none;
  -moz-appearance: none;
  left: 0;
}
[dir=rtl] .cdk-visually-hidden {
  left: auto;
  right: 0;
}
`],encapsulation:2,changeDetection:0})}return t})(),on;function as(){if(on===void 0&&(on=null,typeof window<"u")){let t=window;t.trustedTypes!==void 0&&(on=t.trustedTypes.createPolicy("angular#components",{createHTML:r=>r}))}return on}function Ae(t){return as()?.createHTML(t)||t}function Vi(t,r,e){let n=e.sanitize(B.HTML,r);t.innerHTML=Ae(n||"")}function Yn(t){return Array.isArray(t)?t:[t]}var Gi=new Set,Ce,sn=(()=>{class t{_platform=c(j);_nonce=c(Oe,{optional:!0});_matchMedia;constructor(){this._matchMedia=this._platform.isBrowser&&window.matchMedia?window.matchMedia.bind(window):cs}matchMedia(e){return(this._platform.WEBKIT||this._platform.BLINK)&&ss(e,this._nonce),this._matchMedia(e)}static \u0275fac=function(n){return new(n||t)};static \u0275prov=m({token:t,factory:t.\u0275fac,providedIn:"root"})}return t})();function ss(t,r){if(!Gi.has(t))try{Ce||(Ce=document.createElement("style"),r&&Ce.setAttribute("nonce",r),Ce.setAttribute("type","text/css"),document.head.appendChild(Ce)),Ce.sheet&&(Ce.sheet.insertRule(`@media ${t} {body{ }}`,0),Gi.add(t))}catch(e){console.error(e)}}function cs(t){return{matches:t==="all"||t==="",media:t,addListener:()=>{},removeListener:()=>{}}}var Xn=(()=>{class t{_mediaMatcher=c(sn);_zone=c(M);_queries=new Map;_destroySubject=new k;constructor(){}ngOnDestroy(){this._destroySubject.next(),this._destroySubject.complete()}isMatched(e){return Wi(Yn(e)).some(i=>this._registerQuery(i).mql.matches)}observe(e){let i=Wi(Yn(e)).map(a=>this._registerQuery(a).observable),o=fr(i);return o=hr(o.pipe(_t(1)),o.pipe(Et(1),Me(0))),o.pipe(O(a=>{let s={matches:!1,breakpoints:{}};return a.forEach(({matches:u,query:d})=>{s.matches=s.matches||u,s.breakpoints[d]=u}),s}))}_registerQuery(e){if(this._queries.has(e))return this._queries.get(e);let n=this._mediaMatcher.matchMedia(e),o={observable:new Te(a=>{let s=u=>this._zone.run(()=>a.next(u));return n.addListener(s),()=>{n.removeListener(s)}}).pipe(_r(n),O(({matches:a})=>({query:e,matches:a})),wt(this._destroySubject)),mql:n};return this._queries.set(e,o),o}static \u0275fac=function(n){return new(n||t)};static \u0275prov=m({token:t,factory:t.\u0275fac,providedIn:"root"})}return t})();function Wi(t){return t.map(r=>r.split(",")).reduce((r,e)=>r.concat(e)).map(r=>r.trim())}function us(t){if(t.type==="characterData"&&t.target instanceof Comment)return!0;if(t.type==="childList"){for(let r=0;r<t.addedNodes.length;r++)if(!(t.addedNodes[r]instanceof Comment))return!1;for(let r=0;r<t.removedNodes.length;r++)if(!(t.removedNodes[r]instanceof Comment))return!1;return!0}return!1}var Ki=(()=>{class t{create(e){return typeof MutationObserver>"u"?null:new MutationObserver(e)}static \u0275fac=function(n){return new(n||t)};static \u0275prov=m({token:t,factory:t.\u0275fac,providedIn:"root"})}return t})(),Zi=(()=>{class t{_mutationObserverFactory=c(Ki);_observedElements=new Map;_ngZone=c(M);constructor(){}ngOnDestroy(){this._observedElements.forEach((e,n)=>this._cleanupObserver(n))}observe(e){let n=ae(e);return new Te(i=>{let a=this._observeElement(n).pipe(O(s=>s.filter(u=>!us(u))),Se(s=>!!s.length)).subscribe(s=>{this._ngZone.run(()=>{i.next(s)})});return()=>{a.unsubscribe(),this._unobserveElement(n)}})}_observeElement(e){return this._ngZone.runOutsideAngular(()=>{if(this._observedElements.has(e))this._observedElements.get(e).count++;else{let n=new k,i=this._mutationObserverFactory.create(o=>n.next(o));i&&i.observe(e,{characterData:!0,childList:!0,subtree:!0}),this._observedElements.set(e,{observer:i,stream:n,count:1})}return this._observedElements.get(e).stream})}_unobserveElement(e){this._observedElements.has(e)&&(this._observedElements.get(e).count--,this._observedElements.get(e).count||this._cleanupObserver(e))}_cleanupObserver(e){if(this._observedElements.has(e)){let{observer:n,stream:i}=this._observedElements.get(e);n&&n.disconnect(),i.complete(),this._observedElements.delete(e)}}static \u0275fac=function(n){return new(n||t)};static \u0275prov=m({token:t,factory:t.\u0275fac,providedIn:"root"})}return t})(),im=(()=>{class t{_contentObserver=c(Zi);_elementRef=c(U);event=new xe;get disabled(){return this._disabled}set disabled(e){this._disabled=e,this._disabled?this._unsubscribe():this._subscribe()}_disabled=!1;get debounce(){return this._debounce}set debounce(e){this._debounce=Kn(e),this._subscribe()}_debounce;_currentSubscription=null;constructor(){}ngAfterContentInit(){!this._currentSubscription&&!this.disabled&&this._subscribe()}ngOnDestroy(){this._unsubscribe()}_subscribe(){this._unsubscribe();let e=this._contentObserver.observe(this._elementRef);this._currentSubscription=(this.debounce?e.pipe(Me(this.debounce)):e).subscribe(this.event)}_unsubscribe(){this._currentSubscription?.unsubscribe()}static \u0275fac=function(n){return new(n||t)};static \u0275dir=H({type:t,selectors:[["","cdkObserveContent",""]],inputs:{disabled:[2,"cdkObserveContentDisabled","disabled",Z],debounce:"debounce"},outputs:{event:"cdkObserveContent"},exportAs:["cdkObserveContent"]})}return t})(),Yi=(()=>{class t{static \u0275fac=function(n){return new(n||t)};static \u0275mod=L({type:t});static \u0275inj=N({providers:[Ki]})}return t})();var Qi=(()=>{class t{_platform=c(j);constructor(){}isDisabled(e){return e.hasAttribute("disabled")}isVisible(e){return ls(e)&&getComputedStyle(e).visibility==="visible"}isTabbable(e){if(!this._platform.isBrowser)return!1;let n=ds(ys(e));if(n&&(Xi(n)===-1||!this.isVisible(n)))return!1;let i=e.nodeName.toLowerCase(),o=Xi(e);return e.hasAttribute("contenteditable")?o!==-1:i==="iframe"||i==="object"||this._platform.WEBKIT&&this._platform.IOS&&!bs(e)?!1:i==="audio"?e.hasAttribute("controls")?o!==-1:!1:i==="video"?o===-1?!1:o!==null?!0:this._platform.FIREFOX||e.hasAttribute("controls"):e.tabIndex>=0}isFocusable(e,n){return vs(e)&&!this.isDisabled(e)&&(n?.ignoreVisibility||this.isVisible(e))}static \u0275fac=function(n){return new(n||t)};static \u0275prov=m({token:t,factory:t.\u0275fac,providedIn:"root"})}return t})();function ds(t){try{return t.frameElement}catch{return null}}function ls(t){return!!(t.offsetWidth||t.offsetHeight||typeof t.getClientRects=="function"&&t.getClientRects().length)}function ms(t){let r=t.nodeName.toLowerCase();return r==="input"||r==="select"||r==="button"||r==="textarea"}function fs(t){return ps(t)&&t.type=="hidden"}function hs(t){return gs(t)&&t.hasAttribute("href")}function ps(t){return t.nodeName.toLowerCase()=="input"}function gs(t){return t.nodeName.toLowerCase()=="a"}function eo(t){if(!t.hasAttribute("tabindex")||t.tabIndex===void 0)return!1;let r=t.getAttribute("tabindex");return!!(r&&!isNaN(parseInt(r,10)))}function Xi(t){if(!eo(t))return null;let r=parseInt(t.getAttribute("tabindex")||"",10);return isNaN(r)?-1:r}function bs(t){let r=t.nodeName.toLowerCase(),e=r==="input"&&t.type;return e==="text"||e==="password"||r==="select"||r==="textarea"}function vs(t){return fs(t)?!1:ms(t)||hs(t)||t.hasAttribute("contenteditable")||eo(t)}function ys(t){return t.ownerDocument&&t.ownerDocument.defaultView||window}var cn=class{_element;_checker;_ngZone;_document;_injector;_startAnchor=null;_endAnchor=null;_hasAttached=!1;startAnchorListener=()=>this.focusLastTabbableElement();endAnchorListener=()=>this.focusFirstTabbableElement();get enabled(){return this._enabled}set enabled(r){this._enabled=r,this._startAnchor&&this._endAnchor&&(this._toggleAnchorTabIndex(r,this._startAnchor),this._toggleAnchorTabIndex(r,this._endAnchor))}_enabled=!0;constructor(r,e,n,i,o=!1,a){this._element=r,this._checker=e,this._ngZone=n,this._document=i,this._injector=a,o||this.attachAnchors()}destroy(){let r=this._startAnchor,e=this._endAnchor;r&&(r.removeEventListener("focus",this.startAnchorListener),r.remove()),e&&(e.removeEventListener("focus",this.endAnchorListener),e.remove()),this._startAnchor=this._endAnchor=null,this._hasAttached=!1}attachAnchors(){return this._hasAttached?!0:(this._ngZone.runOutsideAngular(()=>{this._startAnchor||(this._startAnchor=this._createAnchor(),this._startAnchor.addEventListener("focus",this.startAnchorListener)),this._endAnchor||(this._endAnchor=this._createAnchor(),this._endAnchor.addEventListener("focus",this.endAnchorListener))}),this._element.parentNode&&(this._element.parentNode.insertBefore(this._startAnchor,this._element),this._element.parentNode.insertBefore(this._endAnchor,this._element.nextSibling),this._hasAttached=!0),this._hasAttached)}focusInitialElementWhenReady(r){return new Promise(e=>{this._executeOnStable(()=>e(this.focusInitialElement(r)))})}focusFirstTabbableElementWhenReady(r){return new Promise(e=>{this._executeOnStable(()=>e(this.focusFirstTabbableElement(r)))})}focusLastTabbableElementWhenReady(r){return new Promise(e=>{this._executeOnStable(()=>e(this.focusLastTabbableElement(r)))})}_getRegionBoundary(r){let e=this._element.querySelectorAll(`[cdk-focus-region-${r}], [cdkFocusRegion${r}], [cdk-focus-${r}]`);return r=="start"?e.length?e[0]:this._getFirstTabbableElement(this._element):e.length?e[e.length-1]:this._getLastTabbableElement(this._element)}focusInitialElement(r){let e=this._element.querySelector("[cdk-focus-initial], [cdkFocusInitial]");if(e){if(!this._checker.isFocusable(e)){let n=this._getFirstTabbableElement(e);return n?.focus(r),!!n}return e.focus(r),!0}return this.focusFirstTabbableElement(r)}focusFirstTabbableElement(r){let e=this._getRegionBoundary("start");return e&&e.focus(r),!!e}focusLastTabbableElement(r){let e=this._getRegionBoundary("end");return e&&e.focus(r),!!e}hasAttached(){return this._hasAttached}_getFirstTabbableElement(r){if(this._checker.isFocusable(r)&&this._checker.isTabbable(r))return r;let e=r.children;for(let n=0;n<e.length;n++){let i=e[n].nodeType===this._document.ELEMENT_NODE?this._getFirstTabbableElement(e[n]):null;if(i)return i}return null}_getLastTabbableElement(r){if(this._checker.isFocusable(r)&&this._checker.isTabbable(r))return r;let e=r.children;for(let n=e.length-1;n>=0;n--){let i=e[n].nodeType===this._document.ELEMENT_NODE?this._getLastTabbableElement(e[n]):null;if(i)return i}return null}_createAnchor(){let r=this._document.createElement("div");return this._toggleAnchorTabIndex(this._enabled,r),r.classList.add("cdk-visually-hidden"),r.classList.add("cdk-focus-trap-anchor"),r.setAttribute("aria-hidden","true"),r}_toggleAnchorTabIndex(r,e){r?e.setAttribute("tabindex","0"):e.removeAttribute("tabindex")}toggleAnchors(r){this._startAnchor&&this._endAnchor&&(this._toggleAnchorTabIndex(r,this._startAnchor),this._toggleAnchorTabIndex(r,this._endAnchor))}_executeOnStable(r){this._injector?kr(r,{injector:this._injector}):setTimeout(r)}},_s=(()=>{class t{_checker=c(Qi);_ngZone=c(M);_document=c(b);_injector=c(z);constructor(){c(le).load(an)}create(e,n=!1){return new cn(e,this._checker,this._ngZone,this._document,n,this._injector)}static \u0275fac=function(n){return new(n||t)};static \u0275prov=m({token:t,factory:t.\u0275fac,providedIn:"root"})}return t})();var to=new p("liveAnnouncerElement",{providedIn:"root",factory:()=>null}),no=new p("LIVE_ANNOUNCER_DEFAULT_OPTIONS"),Ds=0,Es=(()=>{class t{_ngZone=c(M);_defaultOptions=c(no,{optional:!0});_liveElement;_document=c(b);_sanitizer=c(ct);_previousTimeout;_currentPromise;_currentResolve;constructor(){let e=c(to,{optional:!0});this._liveElement=e||this._createLiveElement()}announce(e,...n){let i=this._defaultOptions,o,a;return n.length===1&&typeof n[0]=="number"?a=n[0]:[o,a]=n,this.clear(),clearTimeout(this._previousTimeout),o||(o=i&&i.politeness?i.politeness:"polite"),a==null&&i&&(a=i.duration),this._liveElement.setAttribute("aria-live",o),this._liveElement.id&&this._exposeAnnouncerToModals(this._liveElement.id),this._ngZone.runOutsideAngular(()=>(this._currentPromise||(this._currentPromise=new Promise(s=>this._currentResolve=s)),clearTimeout(this._previousTimeout),this._previousTimeout=setTimeout(()=>{!e||typeof e=="string"?this._liveElement.textContent=e:Vi(this._liveElement,e,this._sanitizer),typeof a=="number"&&(this._previousTimeout=setTimeout(()=>this.clear(),a)),this._currentResolve?.(),this._currentPromise=this._currentResolve=void 0},100),this._currentPromise))}clear(){this._liveElement&&(this._liveElement.textContent="")}ngOnDestroy(){clearTimeout(this._previousTimeout),this._liveElement?.remove(),this._liveElement=null,this._currentResolve?.(),this._currentPromise=this._currentResolve=void 0}_createLiveElement(){let e="cdk-live-announcer-element",n=this._document.getElementsByClassName(e),i=this._document.createElement("div");for(let o=0;o<n.length;o++)n[o].remove();return i.classList.add(e),i.classList.add("cdk-visually-hidden"),i.setAttribute("aria-atomic","true"),i.setAttribute("aria-live","polite"),i.id=`cdk-live-announcer-${Ds++}`,this._document.body.appendChild(i),i}_exposeAnnouncerToModals(e){let n=this._document.querySelectorAll('body > .cdk-overlay-container [aria-modal="true"]');for(let i=0;i<n.length;i++){let o=n[i],a=o.getAttribute("aria-owns");a?a.indexOf(e)===-1&&o.setAttribute("aria-owns",a+" "+e):o.setAttribute("aria-owns",e)}}static \u0275fac=function(n){return new(n||t)};static \u0275prov=m({token:t,factory:t.\u0275fac,providedIn:"root"})}return t})();var be=(function(t){return t[t.NONE=0]="NONE",t[t.BLACK_ON_WHITE=1]="BLACK_ON_WHITE",t[t.WHITE_ON_BLACK=2]="WHITE_ON_BLACK",t})(be||{}),Ji="cdk-high-contrast-black-on-white",qi="cdk-high-contrast-white-on-black",Jn="cdk-high-contrast-active",ro=(()=>{class t{_platform=c(j);_hasCheckedHighContrastMode=!1;_document=c(b);_breakpointSubscription;constructor(){this._breakpointSubscription=c(Xn).observe("(forced-colors: active)").subscribe(()=>{this._hasCheckedHighContrastMode&&(this._hasCheckedHighContrastMode=!1,this._applyBodyHighContrastModeCssClasses())})}getHighContrastMode(){if(!this._platform.isBrowser)return be.NONE;let e=this._document.createElement("div");e.style.backgroundColor="rgb(1,2,3)",e.style.position="absolute",this._document.body.appendChild(e);let n=this._document.defaultView||window,i=n&&n.getComputedStyle?n.getComputedStyle(e):null,o=(i&&i.backgroundColor||"").replace(/ /g,"");switch(e.remove(),o){case"rgb(0,0,0)":case"rgb(45,50,54)":case"rgb(32,32,32)":return be.WHITE_ON_BLACK;case"rgb(255,255,255)":case"rgb(255,250,239)":return be.BLACK_ON_WHITE}return be.NONE}ngOnDestroy(){this._breakpointSubscription.unsubscribe()}_applyBodyHighContrastModeCssClasses(){if(!this._hasCheckedHighContrastMode&&this._platform.isBrowser&&this._document.body){let e=this._document.body.classList;e.remove(Jn,Ji,qi),this._hasCheckedHighContrastMode=!0;let n=this.getHighContrastMode();n===be.BLACK_ON_WHITE?e.add(Jn,Ji):n===be.WHITE_ON_BLACK&&e.add(Jn,qi)}}static \u0275fac=function(n){return new(n||t)};static \u0275prov=m({token:t,factory:t.\u0275fac,providedIn:"root"})}return t})(),ws=(()=>{class t{constructor(){c(ro)._applyBodyHighContrastModeCssClasses()}static \u0275fac=function(n){return new(n||t)};static \u0275mod=L({type:t});static \u0275inj=N({imports:[Yi]})}return t})();var As=200,un=class{_letterKeyStream=new k;_items=[];_selectedItemIndex=-1;_pressedLetters=[];_skipPredicateFn;_selectedItem=new k;selectedItem=this._selectedItem;constructor(r,e){let n=typeof e?.debounceInterval=="number"?e.debounceInterval:As;e?.skipPredicate&&(this._skipPredicateFn=e.skipPredicate),this.setItems(r),this._setupKeyHandler(n)}destroy(){this._pressedLetters=[],this._letterKeyStream.complete(),this._selectedItem.complete()}setCurrentSelectedItemIndex(r){this._selectedItemIndex=r}setItems(r){this._items=r}handleKey(r){let e=r.keyCode;r.key&&r.key.length===1?this._letterKeyStream.next(r.key.toLocaleUpperCase()):(e>=65&&e<=90||e>=48&&e<=57)&&this._letterKeyStream.next(String.fromCharCode(e))}isTyping(){return this._pressedLetters.length>0}reset(){this._pressedLetters=[]}_setupKeyHandler(r){this._letterKeyStream.pipe(Fe(e=>this._pressedLetters.push(e)),Me(r),Se(()=>this._pressedLetters.length>0),O(()=>this._pressedLetters.join("").toLocaleUpperCase())).subscribe(e=>{for(let n=1;n<this._items.length+1;n++){let i=(this._selectedItemIndex+n)%this._items.length,o=this._items[i];if(!this._skipPredicateFn?.(o)&&o.getLabel?.().toLocaleUpperCase().trim().indexOf(e)===0){this._selectedItem.next(o);break}}this._pressedLetters=[]})}};function io(t,...r){return r.length?r.some(e=>t[e]):t.altKey||t.shiftKey||t.ctrlKey||t.metaKey}var He=class{_items;_activeItemIndex=Ye(-1);_activeItem=Ye(null);_wrap=!1;_typeaheadSubscription=yt.EMPTY;_itemChangesSubscription;_vertical=!0;_horizontal=null;_allowedModifierKeys=[];_homeAndEnd=!1;_pageUpAndDown={enabled:!1,delta:10};_effectRef;_typeahead;_skipPredicateFn=r=>r.disabled;constructor(r,e){this._items=r,r instanceof bn?this._itemChangesSubscription=r.changes.subscribe(n=>this._itemsChanged(n.toArray())):St(r)&&(this._effectRef=Cr(()=>this._itemsChanged(r()),{injector:e}))}tabOut=new k;change=new k;skipPredicate(r){return this._skipPredicateFn=r,this}withWrap(r=!0){return this._wrap=r,this}withVerticalOrientation(r=!0){return this._vertical=r,this}withHorizontalOrientation(r){return this._horizontal=r,this}withAllowedModifierKeys(r){return this._allowedModifierKeys=r,this}withTypeAhead(r=200){this._typeaheadSubscription.unsubscribe();let e=this._getItemsArray();return this._typeahead=new un(e,{debounceInterval:typeof r=="number"?r:void 0,skipPredicate:n=>this._skipPredicateFn(n)}),this._typeaheadSubscription=this._typeahead.selectedItem.subscribe(n=>{this.setActiveItem(n)}),this}cancelTypeahead(){return this._typeahead?.reset(),this}withHomeAndEnd(r=!0){return this._homeAndEnd=r,this}withPageUpDown(r=!0,e=10){return this._pageUpAndDown={enabled:r,delta:e},this}setActiveItem(r){let e=this._activeItem();this.updateActiveItem(r),this._activeItem()!==e&&this.change.next(this._activeItemIndex())}onKeydown(r){let e=r.keyCode,i=["altKey","ctrlKey","metaKey","shiftKey"].every(o=>!r[o]||this._allowedModifierKeys.indexOf(o)>-1);switch(e){case 9:this.tabOut.next();return;case 40:if(this._vertical&&i){this.setNextItemActive();break}else return;case 38:if(this._vertical&&i){this.setPreviousItemActive();break}else return;case 39:if(this._horizontal&&i){this._horizontal==="rtl"?this.setPreviousItemActive():this.setNextItemActive();break}else return;case 37:if(this._horizontal&&i){this._horizontal==="rtl"?this.setNextItemActive():this.setPreviousItemActive();break}else return;case 36:if(this._homeAndEnd&&i){this.setFirstItemActive();break}else return;case 35:if(this._homeAndEnd&&i){this.setLastItemActive();break}else return;case 33:if(this._pageUpAndDown.enabled&&i){let o=this._activeItemIndex()-this._pageUpAndDown.delta;this._setActiveItemByIndex(o>0?o:0,1);break}else return;case 34:if(this._pageUpAndDown.enabled&&i){let o=this._activeItemIndex()+this._pageUpAndDown.delta,a=this._getItemsArray().length;this._setActiveItemByIndex(o<a?o:a-1,-1);break}else return;default:(i||io(r,"shiftKey"))&&this._typeahead?.handleKey(r);return}this._typeahead?.reset(),r.preventDefault()}get activeItemIndex(){return this._activeItemIndex()}get activeItem(){return this._activeItem()}isTyping(){return!!this._typeahead&&this._typeahead.isTyping()}setFirstItemActive(){this._setActiveItemByIndex(0,1)}setLastItemActive(){this._setActiveItemByIndex(this._getItemsArray().length-1,-1)}setNextItemActive(){this._activeItemIndex()<0?this.setFirstItemActive():this._setActiveItemByDelta(1)}setPreviousItemActive(){this._activeItemIndex()<0&&this._wrap?this.setLastItemActive():this._setActiveItemByDelta(-1)}updateActiveItem(r){let e=this._getItemsArray(),n=typeof r=="number"?r:e.indexOf(r),i=e[n];this._activeItem.set(i??null),this._activeItemIndex.set(n),this._typeahead?.setCurrentSelectedItemIndex(n)}destroy(){this._typeaheadSubscription.unsubscribe(),this._itemChangesSubscription?.unsubscribe(),this._effectRef?.destroy(),this._typeahead?.destroy(),this.tabOut.complete(),this.change.complete()}_setActiveItemByDelta(r){this._wrap?this._setActiveInWrapMode(r):this._setActiveInDefaultMode(r)}_setActiveInWrapMode(r){let e=this._getItemsArray();for(let n=1;n<=e.length;n++){let i=(this._activeItemIndex()+r*n+e.length)%e.length,o=e[i];if(!this._skipPredicateFn(o)){this.setActiveItem(i);return}}}_setActiveInDefaultMode(r){this._setActiveItemByIndex(this._activeItemIndex()+r,r)}_setActiveItemByIndex(r,e){let n=this._getItemsArray();if(n[r]){for(;this._skipPredicateFn(n[r]);)if(r+=e,!n[r])return;this.setActiveItem(r)}}_getItemsArray(){return St(this._items)?this._items():this._items instanceof bn?this._items.toArray():this._items}_itemsChanged(r){this._typeahead?.setItems(r);let e=this._activeItem();if(e){let n=r.indexOf(e);n>-1&&n!==this._activeItemIndex()&&(this._activeItemIndex.set(n),this._typeahead?.setCurrentSelectedItemIndex(n))}}};var qn=class extends He{setActiveItem(r){this.activeItem&&this.activeItem.setInactiveStyles(),super.setActiveItem(r),this.activeItem&&this.activeItem.setActiveStyles()}};var Qn=class extends He{_origin="program";setFocusOrigin(r){return this._origin=r,this}setActiveItem(r){super.setActiveItem(r),this.activeItem&&this.activeItem.focus(this._origin)}};var er={},tr=class t{_appId=c(_e);static _infix=`a${Math.floor(Math.random()*1e5).toString()}`;getId(r,e=!1){return this._appId!=="ng"&&(r+=this._appId),er.hasOwnProperty(r)||(er[r]=0),`${r}${e?t._infix+"-":""}${er[r]++}`}static \u0275fac=function(e){return new(e||t)};static \u0275prov=m({token:t,factory:t.\u0275fac,providedIn:"root"})};var ao=" ";function Cs(t,r,e){let n=ln(t,r);e=e.trim(),!n.some(i=>i.trim()===e)&&(n.push(e),t.setAttribute(r,n.join(ao)))}function Is(t,r,e){let n=ln(t,r);e=e.trim();let i=n.filter(o=>o!==e);i.length?t.setAttribute(r,i.join(ao)):t.removeAttribute(r)}function ln(t,r){return t.getAttribute(r)?.match(/\S+/g)??[]}var so="cdk-describedby-message",dn="cdk-describedby-host",rr=0,nf=(()=>{class t{_platform=c(j);_document=c(b);_messageRegistry=new Map;_messagesContainer=null;_id=`${rr++}`;constructor(){c(le).load(an),this._id=c(_e)+"-"+rr++}describe(e,n,i){if(!this._canBeDescribed(e,n))return;let o=nr(n,i);typeof n!="string"?(oo(n,this._id),this._messageRegistry.set(o,{messageElement:n,referenceCount:0})):this._messageRegistry.has(o)||this._createMessageElement(n,i),this._isElementDescribedByMessage(e,o)||this._addMessageReference(e,o)}removeDescription(e,n,i){if(!n||!this._isElementNode(e))return;let o=nr(n,i);if(this._isElementDescribedByMessage(e,o)&&this._removeMessageReference(e,o),typeof n=="string"){let a=this._messageRegistry.get(o);a&&a.referenceCount===0&&this._deleteMessageElement(o)}this._messagesContainer?.childNodes.length===0&&(this._messagesContainer.remove(),this._messagesContainer=null)}ngOnDestroy(){let e=this._document.querySelectorAll(`[${dn}="${this._id}"]`);for(let n=0;n<e.length;n++)this._removeCdkDescribedByReferenceIds(e[n]),e[n].removeAttribute(dn);this._messagesContainer?.remove(),this._messagesContainer=null,this._messageRegistry.clear()}_createMessageElement(e,n){let i=this._document.createElement("div");oo(i,this._id),i.textContent=e,n&&i.setAttribute("role",n),this._createMessagesContainer(),this._messagesContainer.appendChild(i),this._messageRegistry.set(nr(e,n),{messageElement:i,referenceCount:0})}_deleteMessageElement(e){this._messageRegistry.get(e)?.messageElement?.remove(),this._messageRegistry.delete(e)}_createMessagesContainer(){if(this._messagesContainer)return;let e="cdk-describedby-message-container",n=this._document.querySelectorAll(`.${e}[platform="server"]`);for(let o=0;o<n.length;o++)n[o].remove();let i=this._document.createElement("div");i.style.visibility="hidden",i.classList.add(e),i.classList.add("cdk-visually-hidden"),this._platform.isBrowser||i.setAttribute("platform","server"),this._document.body.appendChild(i),this._messagesContainer=i}_removeCdkDescribedByReferenceIds(e){let n=ln(e,"aria-describedby").filter(i=>i.indexOf(so)!=0);e.setAttribute("aria-describedby",n.join(" "))}_addMessageReference(e,n){let i=this._messageRegistry.get(n);Cs(e,"aria-describedby",i.messageElement.id),e.setAttribute(dn,this._id),i.referenceCount++}_removeMessageReference(e,n){let i=this._messageRegistry.get(n);i.referenceCount--,Is(e,"aria-describedby",i.messageElement.id),e.removeAttribute(dn)}_isElementDescribedByMessage(e,n){let i=ln(e,"aria-describedby"),o=this._messageRegistry.get(n),a=o&&o.messageElement.id;return!!a&&i.indexOf(a)!=-1}_canBeDescribed(e,n){if(!this._isElementNode(e))return!1;if(n&&typeof n=="object")return!0;let i=n==null?"":`${n}`.trim(),o=e.getAttribute("aria-label");return i?!o||o.trim()!==i:!1}_isElementNode(e){return e.nodeType===this._document.ELEMENT_NODE}static \u0275fac=function(n){return new(n||t)};static \u0275prov=m({token:t,factory:t.\u0275fac,providedIn:"root"})}return t})();function nr(t,r){return typeof t=="string"?`${r||""}/${t}`:t}function oo(t,r){t.id||(t.id=`${so}-${r}-${rr++}`)}var ft=(function(t){return t[t.NORMAL=0]="NORMAL",t[t.NEGATED=1]="NEGATED",t[t.INVERTED=2]="INVERTED",t})(ft||{}),mn,Ie;function lf(){if(Ie==null){if(typeof document!="object"||!document||typeof Element!="function"||!Element)return Ie=!1,Ie;if(document.documentElement?.style&&"scrollBehavior"in document.documentElement.style)Ie=!0;else{let t=Element.prototype.scrollTo;t?Ie=!/\{\s*\[native code\]\s*\}/.test(t.toString()):Ie=!1}}return Ie}function mf(){if(typeof document!="object"||!document)return ft.NORMAL;if(mn==null){let t=document.createElement("div"),r=t.style;t.dir="rtl",r.width="1px",r.overflow="auto",r.visibility="hidden",r.pointerEvents="none",r.position="absolute";let e=document.createElement("div"),n=e.style;n.width="2px",n.height="1px",t.appendChild(e),document.body.appendChild(t),mn=ft.NORMAL,t.scrollLeft===0&&(t.scrollLeft=1,mn=t.scrollLeft===0?ft.NEGATED:ft.INVERTED),t.remove()}return mn}function hf(){return typeof __karma__<"u"&&!!__karma__||typeof jasmine<"u"&&!!jasmine||typeof jest<"u"&&!!jest||typeof Mocha<"u"&&!!Mocha}var Ve,co=["color","button","checkbox","date","datetime-local","email","file","hidden","image","month","number","password","radio","range","reset","search","submit","tel","text","time","url","week"];function gf(){if(Ve)return Ve;if(typeof document!="object"||!document)return Ve=new Set(co),Ve;let t=document.createElement("input");return Ve=new Set(co.filter(r=>(t.setAttribute("type",r),t.type===r))),Ve}var Df={XSmall:"(max-width: 599.98px)",Small:"(min-width: 600px) and (max-width: 959.98px)",Medium:"(min-width: 960px) and (max-width: 1279.98px)",Large:"(min-width: 1280px) and (max-width: 1919.98px)",XLarge:"(min-width: 1920px)",Handset:"(max-width: 599.98px) and (orientation: portrait), (max-width: 959.98px) and (orientation: landscape)",Tablet:"(min-width: 600px) and (max-width: 839.98px) and (orientation: portrait), (min-width: 960px) and (max-width: 1279.98px) and (orientation: landscape)",Web:"(min-width: 840px) and (orientation: portrait), (min-width: 1280px) and (orientation: landscape)",HandsetPortrait:"(max-width: 599.98px) and (orientation: portrait)",TabletPortrait:"(min-width: 600px) and (max-width: 839.98px) and (orientation: portrait)",WebPortrait:"(min-width: 840px) and (orientation: portrait)",HandsetLandscape:"(max-width: 959.98px) and (orientation: landscape)",TabletLandscape:"(min-width: 960px) and (max-width: 1279.98px) and (orientation: landscape)",WebLandscape:"(min-width: 1280px) and (orientation: landscape)"};var Ts=new p("MATERIAL_ANIMATIONS"),uo=null;function Ss(){return c(Ts,{optional:!0})?.animationsDisabled||c(Sr,{optional:!0})==="NoopAnimations"?"di-disabled":(uo??=c(sn).matchMedia("(prefers-reduced-motion)").matches,uo?"reduced-motion":"enabled")}function Ge(){return Ss()!=="enabled"}function Tf(t){return t==null?"":typeof t=="string"?t:`${t}px`}function Mf(t){return t!=null&&`${t}`!="false"}var J=(function(t){return t[t.FADING_IN=0]="FADING_IN",t[t.VISIBLE=1]="VISIBLE",t[t.FADING_OUT=2]="FADING_OUT",t[t.HIDDEN=3]="HIDDEN",t})(J||{}),ir=class{_renderer;element;config;_animationForciblyDisabledThroughCss;state=J.HIDDEN;constructor(r,e,n,i=!1){this._renderer=r,this.element=e,this.config=n,this._animationForciblyDisabledThroughCss=i}fadeOut(){this._renderer.fadeOutRipple(this)}},lo=$e({passive:!0,capture:!0}),or=class{_events=new Map;addHandler(r,e,n,i){let o=this._events.get(e);if(o){let a=o.get(n);a?a.add(i):o.set(n,new Set([i]))}else this._events.set(e,new Map([[n,new Set([i])]])),r.runOutsideAngular(()=>{document.addEventListener(e,this._delegateEventHandler,lo)})}removeHandler(r,e,n){let i=this._events.get(r);if(!i)return;let o=i.get(e);o&&(o.delete(n),o.size===0&&i.delete(e),i.size===0&&(this._events.delete(r),document.removeEventListener(r,this._delegateEventHandler,lo)))}_delegateEventHandler=r=>{let e=re(r);e&&this._events.get(r.type)?.forEach((n,i)=>{(i===e||i.contains(e))&&n.forEach(o=>o.handleEvent(r))})}},ht={enterDuration:225,exitDuration:150},Ms=800,mo=$e({passive:!0,capture:!0}),fo=["mousedown","touchstart"],ho=["mouseup","mouseleave","touchend","touchcancel"],Fs=(()=>{class t{static \u0275fac=function(n){return new(n||t)};static \u0275cmp=$({type:t,selectors:[["ng-component"]],hostAttrs:["mat-ripple-style-loader",""],decls:0,vars:0,template:function(n,i){},styles:[`.mat-ripple {
  overflow: hidden;
  position: relative;
}
.mat-ripple:not(:empty) {
  transform: translateZ(0);
}

.mat-ripple.mat-ripple-unbounded {
  overflow: visible;
}

.mat-ripple-element {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  transition: opacity, transform 0ms cubic-bezier(0, 0, 0.2, 1);
  transform: scale3d(0, 0, 0);
  background-color: var(--mat-ripple-color, color-mix(in srgb, var(--mat-sys-on-surface) 10%, transparent));
}
@media (forced-colors: active) {
  .mat-ripple-element {
    display: none;
  }
}
.cdk-drag-preview .mat-ripple-element, .cdk-drag-placeholder .mat-ripple-element {
  display: none;
}
`],encapsulation:2,changeDetection:0})}return t})(),pt=class t{_target;_ngZone;_platform;_containerElement;_triggerElement=null;_isPointerDown=!1;_activeRipples=new Map;_mostRecentTransientRipple=null;_lastTouchStartEvent;_pointerUpEventsRegistered=!1;_containerRect=null;static _eventManager=new or;constructor(r,e,n,i,o){this._target=r,this._ngZone=e,this._platform=i,i.isBrowser&&(this._containerElement=ae(n)),o&&o.get(le).load(Fs)}fadeInRipple(r,e,n={}){let i=this._containerRect=this._containerRect||this._containerElement.getBoundingClientRect(),o=I(I({},ht),n.animation);n.centered&&(r=i.left+i.width/2,e=i.top+i.height/2);let a=n.radius||xs(r,e,i),s=r-i.left,u=e-i.top,d=o.enterDuration,l=document.createElement("div");l.classList.add("mat-ripple-element"),l.style.left=`${s-a}px`,l.style.top=`${u-a}px`,l.style.height=`${a*2}px`,l.style.width=`${a*2}px`,n.color!=null&&(l.style.backgroundColor=n.color),l.style.transitionDuration=`${d}ms`,this._containerElement.appendChild(l);let f=window.getComputedStyle(l),y=f.transitionProperty,D=f.transitionDuration,C=y==="none"||D==="0s"||D==="0s, 0s"||i.width===0&&i.height===0,R=new ir(this,l,n,C);l.style.transform="scale3d(1, 1, 1)",R.state=J.FADING_IN,n.persistent||(this._mostRecentTransientRipple=R);let g=null;return!C&&(d||o.exitDuration)&&this._ngZone.runOutsideAngular(()=>{let _=()=>{g&&(g.fallbackTimer=null),clearTimeout(Y),this._finishRippleTransition(R)},S=()=>this._destroyRipple(R),Y=setTimeout(S,d+100);l.addEventListener("transitionend",_),l.addEventListener("transitioncancel",S),g={onTransitionEnd:_,onTransitionCancel:S,fallbackTimer:Y}}),this._activeRipples.set(R,g),(C||!d)&&this._finishRippleTransition(R),R}fadeOutRipple(r){if(r.state===J.FADING_OUT||r.state===J.HIDDEN)return;let e=r.element,n=I(I({},ht),r.config.animation);e.style.transitionDuration=`${n.exitDuration}ms`,e.style.opacity="0",r.state=J.FADING_OUT,(r._animationForciblyDisabledThroughCss||!n.exitDuration)&&this._finishRippleTransition(r)}fadeOutAll(){this._getActiveRipples().forEach(r=>r.fadeOut())}fadeOutAllNonPersistent(){this._getActiveRipples().forEach(r=>{r.config.persistent||r.fadeOut()})}setupTriggerEvents(r){let e=ae(r);!this._platform.isBrowser||!e||e===this._triggerElement||(this._removeTriggerEvents(),this._triggerElement=e,fo.forEach(n=>{t._eventManager.addHandler(this._ngZone,n,e,this)}))}handleEvent(r){r.type==="mousedown"?this._onMousedown(r):r.type==="touchstart"?this._onTouchStart(r):this._onPointerUp(),this._pointerUpEventsRegistered||(this._ngZone.runOutsideAngular(()=>{ho.forEach(e=>{this._triggerElement.addEventListener(e,this,mo)})}),this._pointerUpEventsRegistered=!0)}_finishRippleTransition(r){r.state===J.FADING_IN?this._startFadeOutTransition(r):r.state===J.FADING_OUT&&this._destroyRipple(r)}_startFadeOutTransition(r){let e=r===this._mostRecentTransientRipple,{persistent:n}=r.config;r.state=J.VISIBLE,!n&&(!e||!this._isPointerDown)&&r.fadeOut()}_destroyRipple(r){let e=this._activeRipples.get(r)??null;this._activeRipples.delete(r),this._activeRipples.size||(this._containerRect=null),r===this._mostRecentTransientRipple&&(this._mostRecentTransientRipple=null),r.state=J.HIDDEN,e!==null&&(r.element.removeEventListener("transitionend",e.onTransitionEnd),r.element.removeEventListener("transitioncancel",e.onTransitionCancel),e.fallbackTimer!==null&&clearTimeout(e.fallbackTimer)),r.element.remove()}_onMousedown(r){let e=ut(r),n=this._lastTouchStartEvent&&Date.now()<this._lastTouchStartEvent+Ms;!this._target.rippleDisabled&&!e&&!n&&(this._isPointerDown=!0,this.fadeInRipple(r.clientX,r.clientY,this._target.rippleConfig))}_onTouchStart(r){if(!this._target.rippleDisabled&&!dt(r)){this._lastTouchStartEvent=Date.now(),this._isPointerDown=!0;let e=r.changedTouches;if(e)for(let n=0;n<e.length;n++)this.fadeInRipple(e[n].clientX,e[n].clientY,this._target.rippleConfig)}}_onPointerUp(){this._isPointerDown&&(this._isPointerDown=!1,this._getActiveRipples().forEach(r=>{let e=r.state===J.VISIBLE||r.config.terminateOnPointerUp&&r.state===J.FADING_IN;!r.config.persistent&&e&&r.fadeOut()}))}_getActiveRipples(){return Array.from(this._activeRipples.keys())}_removeTriggerEvents(){let r=this._triggerElement;r&&(fo.forEach(e=>t._eventManager.removeHandler(e,r,this)),this._pointerUpEventsRegistered&&(ho.forEach(e=>r.removeEventListener(e,this,mo)),this._pointerUpEventsRegistered=!1))}};function xs(t,r,e){let n=Math.max(Math.abs(t-e.left),Math.abs(t-e.right)),i=Math.max(Math.abs(r-e.top),Math.abs(r-e.bottom));return Math.sqrt(n*n+i*i)}var ar=new p("mat-ripple-global-options"),Hf=(()=>{class t{_elementRef=c(U);_animationsDisabled=Ge();color;unbounded=!1;centered=!1;radius=0;animation;get disabled(){return this._disabled}set disabled(e){e&&this.fadeOutAllNonPersistent(),this._disabled=e,this._setupTriggerEventsIfEnabled()}_disabled=!1;get trigger(){return this._trigger||this._elementRef.nativeElement}set trigger(e){this._trigger=e,this._setupTriggerEventsIfEnabled()}_trigger;_rippleRenderer;_globalOptions;_isInitialized=!1;constructor(){let e=c(M),n=c(j),i=c(ar,{optional:!0}),o=c(z);this._globalOptions=i||{},this._rippleRenderer=new pt(this,e,this._elementRef,n,o)}ngOnInit(){this._isInitialized=!0,this._setupTriggerEventsIfEnabled()}ngOnDestroy(){this._rippleRenderer._removeTriggerEvents()}fadeOutAll(){this._rippleRenderer.fadeOutAll()}fadeOutAllNonPersistent(){this._rippleRenderer.fadeOutAllNonPersistent()}get rippleConfig(){return{centered:this.centered,radius:this.radius,color:this.color,animation:I(I(I({},this._globalOptions.animation),this._animationsDisabled?{enterDuration:0,exitDuration:0}:{}),this.animation),terminateOnPointerUp:this._globalOptions.terminateOnPointerUp}}get rippleDisabled(){return this.disabled||!!this._globalOptions.disabled}_setupTriggerEventsIfEnabled(){!this.disabled&&this._isInitialized&&this._rippleRenderer.setupTriggerEvents(this.trigger)}launch(e,n=0,i){return typeof e=="number"?this._rippleRenderer.fadeInRipple(e,n,I(I({},this.rippleConfig),i)):this._rippleRenderer.fadeInRipple(0,0,I(I({},this.rippleConfig),e))}static \u0275fac=function(n){return new(n||t)};static \u0275dir=H({type:t,selectors:[["","mat-ripple",""],["","matRipple",""]],hostAttrs:[1,"mat-ripple"],hostVars:2,hostBindings:function(n,i){n&2&&ee("mat-ripple-unbounded",i.unbounded)},inputs:{color:[0,"matRippleColor","color"],unbounded:[0,"matRippleUnbounded","unbounded"],centered:[0,"matRippleCentered","centered"],radius:[0,"matRippleRadius","radius"],animation:[0,"matRippleAnimation","animation"],disabled:[0,"matRippleDisabled","disabled"],trigger:[0,"matRippleTrigger","trigger"]},exportAs:["matRipple"]})}return t})();var Rs={capture:!0},Os=["focus","mousedown","mouseenter","touchstart"],sr="mat-ripple-loader-uninitialized",cr="mat-ripple-loader-class-name",po="mat-ripple-loader-centered",fn="mat-ripple-loader-disabled",go=(()=>{class t{_document=c(b);_animationsDisabled=Ge();_globalRippleOptions=c(ar,{optional:!0});_platform=c(j);_ngZone=c(M);_injector=c(z);_eventCleanups;_hosts=new Map;constructor(){let e=c(Pe).createRenderer(null,null);this._eventCleanups=this._ngZone.runOutsideAngular(()=>Os.map(n=>e.listen(this._document,n,this._onInteraction,Rs)))}ngOnDestroy(){let e=this._hosts.keys();for(let n of e)this.destroyRipple(n);this._eventCleanups.forEach(n=>n())}configureRipple(e,n){e.setAttribute(sr,this._globalRippleOptions?.namespace??""),(n.className||!e.hasAttribute(cr))&&e.setAttribute(cr,n.className||""),n.centered&&e.setAttribute(po,""),n.disabled&&e.setAttribute(fn,"")}setDisabled(e,n){let i=this._hosts.get(e);i?(i.target.rippleDisabled=n,!n&&!i.hasSetUpEvents&&(i.hasSetUpEvents=!0,i.renderer.setupTriggerEvents(e))):n?e.setAttribute(fn,""):e.removeAttribute(fn)}_onInteraction=e=>{let n=re(e);if(n instanceof HTMLElement){let i=n.closest(`[${sr}="${this._globalRippleOptions?.namespace??""}"]`);i&&this._createRipple(i)}};_createRipple(e){if(!this._document||this._hosts.has(e))return;e.querySelector(".mat-ripple")?.remove();let n=this._document.createElement("span");n.classList.add("mat-ripple",e.getAttribute(cr)),e.append(n);let i=this._globalRippleOptions,o=this._animationsDisabled?0:i?.animation?.enterDuration??ht.enterDuration,a=this._animationsDisabled?0:i?.animation?.exitDuration??ht.exitDuration,s={rippleDisabled:this._animationsDisabled||i?.disabled||e.hasAttribute(fn),rippleConfig:{centered:e.hasAttribute(po),terminateOnPointerUp:i?.terminateOnPointerUp,animation:{enterDuration:o,exitDuration:a}}},u=new pt(s,this._ngZone,n,this._platform,this._injector),d=!s.rippleDisabled;d&&u.setupTriggerEvents(e),this._hosts.set(e,{target:s,renderer:u,hasSetUpEvents:d}),e.removeAttribute(sr)}destroyRipple(e){let n=this._hosts.get(e);n&&(n.renderer._removeTriggerEvents(),this._hosts.delete(e))}static \u0275fac=function(n){return new(n||t)};static \u0275prov=m({token:t,factory:t.\u0275fac,providedIn:"root"})}return t})();var bo=(()=>{class t{static \u0275fac=function(n){return new(n||t)};static \u0275cmp=$({type:t,selectors:[["structural-styles"]],decls:0,vars:0,template:function(n,i){},styles:[`.mat-focus-indicator {
  position: relative;
}
.mat-focus-indicator::before {
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  position: absolute;
  box-sizing: border-box;
  pointer-events: none;
  display: var(--mat-focus-indicator-display, none);
  border-width: var(--mat-focus-indicator-border-width, 3px);
  border-style: var(--mat-focus-indicator-border-style, solid);
  border-color: var(--mat-focus-indicator-border-color, transparent);
  border-radius: var(--mat-focus-indicator-border-radius, 4px);
}
.mat-focus-indicator:focus-visible::before {
  content: "";
}

@media (forced-colors: active) {
  html {
    --mat-focus-indicator-display: block;
  }
}
`],encapsulation:2,changeDetection:0})}return t})();var Ns=["mat-icon-button",""],Ls=["*"],Ps=new p("MAT_BUTTON_CONFIG");function vo(t){return t==null?void 0:En(t)}var gt=(()=>{class t{_elementRef=c(U);_ngZone=c(M);_animationsDisabled=Ge();_config=c(Ps,{optional:!0});_focusMonitor=c(nn);_cleanupClick;_renderer=c(It);_rippleLoader=c(go);_isAnchor;_isFab=!1;color;get disableRipple(){return this._disableRipple}set disableRipple(e){this._disableRipple=e,this._updateRippleDisabled()}_disableRipple=!1;get disabled(){return this._disabled}set disabled(e){this._disabled=e,this._updateRippleDisabled()}_disabled=!1;ariaDisabled;disabledInteractive;tabIndex;set _tabindex(e){this.tabIndex=e}constructor(){c(le).load(bo);let e=this._elementRef.nativeElement;this._isAnchor=e.tagName==="A",this.disabledInteractive=this._config?.disabledInteractive??!1,this.color=this._config?.color??null,this._rippleLoader?.configureRipple(e,{className:"mat-mdc-button-ripple"})}ngAfterViewInit(){this._focusMonitor.monitor(this._elementRef,!0),this._isAnchor&&this._setupAsAnchor()}ngOnDestroy(){this._cleanupClick?.(),this._focusMonitor.stopMonitoring(this._elementRef),this._rippleLoader?.destroyRipple(this._elementRef.nativeElement)}focus(e="program",n){e?this._focusMonitor.focusVia(this._elementRef.nativeElement,e,n):this._elementRef.nativeElement.focus(n)}_getAriaDisabled(){return this.ariaDisabled!=null?this.ariaDisabled:this._isAnchor?this.disabled||null:this.disabled&&this.disabledInteractive?!0:null}_getDisabledAttribute(){return this.disabledInteractive||!this.disabled?null:!0}_updateRippleDisabled(){this._rippleLoader?.setDisabled(this._elementRef.nativeElement,this.disableRipple||this.disabled)}_getTabIndex(){return this._isAnchor?this.disabled&&!this.disabledInteractive?-1:this.tabIndex:this.tabIndex}_setupAsAnchor(){this._cleanupClick=this._ngZone.runOutsideAngular(()=>this._renderer.listen(this._elementRef.nativeElement,"click",e=>{this.disabled&&(e.preventDefault(),e.stopImmediatePropagation())}))}static \u0275fac=function(n){return new(n||t)};static \u0275dir=H({type:t,hostAttrs:[1,"mat-mdc-button-base"],hostVars:13,hostBindings:function(n,i){n&2&&(Xe("disabled",i._getDisabledAttribute())("aria-disabled",i._getAriaDisabled())("tabindex",i._getTabIndex()),xt(i.color?"mat-"+i.color:""),ee("mat-mdc-button-disabled",i.disabled)("mat-mdc-button-disabled-interactive",i.disabledInteractive)("mat-unthemed",!i.color)("_mat-animation-noopable",i._animationsDisabled))},inputs:{color:"color",disableRipple:[2,"disableRipple","disableRipple",Z],disabled:[2,"disabled","disabled",Z],ariaDisabled:[2,"aria-disabled","ariaDisabled",Z],disabledInteractive:[2,"disabledInteractive","disabledInteractive",Z],tabIndex:[2,"tabIndex","tabIndex",vo],_tabindex:[2,"tabindex","_tabindex",vo]}})}return t})(),ks=(()=>{class t extends gt{constructor(){super(),this._rippleLoader.configureRipple(this._elementRef.nativeElement,{centered:!0})}static \u0275fac=function(n){return new(n||t)};static \u0275cmp=$({type:t,selectors:[["button","mat-icon-button",""],["a","mat-icon-button",""],["button","matIconButton",""],["a","matIconButton",""]],hostAttrs:[1,"mdc-icon-button","mat-mdc-icon-button"],exportAs:["matButton","matAnchor"],features:[ke],attrs:Ns,ngContentSelectors:Ls,decls:4,vars:0,consts:[[1,"mat-mdc-button-persistent-ripple","mdc-icon-button__ripple"],[1,"mat-focus-indicator"],[1,"mat-mdc-button-touch-target"]],template:function(n,i){n&1&&(he(),ie(0,"span",0),V(1),ie(2,"span",1)(3,"span",2))},styles:[`.mat-mdc-icon-button {
  -webkit-user-select: none;
  user-select: none;
  display: inline-block;
  position: relative;
  box-sizing: border-box;
  border: none;
  outline: none;
  background-color: transparent;
  fill: currentColor;
  text-decoration: none;
  cursor: pointer;
  z-index: 0;
  overflow: visible;
  border-radius: var(--mat-icon-button-container-shape, var(--mat-sys-corner-full, 50%));
  flex-shrink: 0;
  text-align: center;
  width: var(--mat-icon-button-state-layer-size, 40px);
  height: var(--mat-icon-button-state-layer-size, 40px);
  padding: calc(calc(var(--mat-icon-button-state-layer-size, 40px) - var(--mat-icon-button-icon-size, 24px)) / 2);
  font-size: var(--mat-icon-button-icon-size, 24px);
  color: var(--mat-icon-button-icon-color, var(--mat-sys-on-surface-variant));
  -webkit-tap-highlight-color: transparent;
}
.mat-mdc-icon-button .mat-mdc-button-ripple,
.mat-mdc-icon-button .mat-mdc-button-persistent-ripple,
.mat-mdc-icon-button .mat-mdc-button-persistent-ripple::before {
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  position: absolute;
  pointer-events: none;
  border-radius: inherit;
}
.mat-mdc-icon-button .mat-mdc-button-ripple {
  overflow: hidden;
}
.mat-mdc-icon-button .mat-mdc-button-persistent-ripple::before {
  content: "";
  opacity: 0;
}
.mat-mdc-icon-button .mdc-button__label,
.mat-mdc-icon-button .mat-icon {
  z-index: 1;
  position: relative;
}
.mat-mdc-icon-button .mat-focus-indicator {
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  position: absolute;
  border-radius: inherit;
}
.mat-mdc-icon-button:focus-visible > .mat-focus-indicator::before {
  content: "";
  border-radius: inherit;
}
.mat-mdc-icon-button .mat-ripple-element {
  background-color: var(--mat-icon-button-ripple-color, color-mix(in srgb, var(--mat-sys-on-surface-variant) calc(var(--mat-sys-pressed-state-layer-opacity) * 100%), transparent));
}
.mat-mdc-icon-button .mat-mdc-button-persistent-ripple::before {
  background-color: var(--mat-icon-button-state-layer-color, var(--mat-sys-on-surface-variant));
}
.mat-mdc-icon-button.mat-mdc-button-disabled .mat-mdc-button-persistent-ripple::before {
  background-color: var(--mat-icon-button-disabled-state-layer-color, var(--mat-sys-on-surface-variant));
}
.mat-mdc-icon-button:hover > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-icon-button-hover-state-layer-opacity, var(--mat-sys-hover-state-layer-opacity));
}
.mat-mdc-icon-button.cdk-program-focused > .mat-mdc-button-persistent-ripple::before, .mat-mdc-icon-button.cdk-keyboard-focused > .mat-mdc-button-persistent-ripple::before, .mat-mdc-icon-button.mat-mdc-button-disabled-interactive:focus > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-icon-button-focus-state-layer-opacity, var(--mat-sys-focus-state-layer-opacity));
}
.mat-mdc-icon-button:active > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-icon-button-pressed-state-layer-opacity, var(--mat-sys-pressed-state-layer-opacity));
}
.mat-mdc-icon-button .mat-mdc-button-touch-target {
  position: absolute;
  top: 50%;
  height: var(--mat-icon-button-touch-target-size, 48px);
  display: var(--mat-icon-button-touch-target-display, block);
  left: 50%;
  width: var(--mat-icon-button-touch-target-size, 48px);
  transform: translate(-50%, -50%);
}
.mat-mdc-icon-button._mat-animation-noopable {
  transition: none !important;
  animation: none !important;
}
.mat-mdc-icon-button[disabled], .mat-mdc-icon-button.mat-mdc-button-disabled {
  cursor: default;
  pointer-events: none;
  color: var(--mat-icon-button-disabled-icon-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));
}
.mat-mdc-icon-button.mat-mdc-button-disabled-interactive {
  pointer-events: auto;
}
.mat-mdc-icon-button img,
.mat-mdc-icon-button svg {
  width: var(--mat-icon-button-icon-size, 24px);
  height: var(--mat-icon-button-icon-size, 24px);
  vertical-align: baseline;
}
.mat-mdc-icon-button .mat-mdc-button-persistent-ripple {
  border-radius: var(--mat-icon-button-container-shape, var(--mat-sys-corner-full, 50%));
}
.mat-mdc-icon-button[hidden] {
  display: none;
}
.mat-mdc-icon-button.mat-unthemed:not(.mdc-ripple-upgraded):focus::before, .mat-mdc-icon-button.mat-primary:not(.mdc-ripple-upgraded):focus::before, .mat-mdc-icon-button.mat-accent:not(.mdc-ripple-upgraded):focus::before, .mat-mdc-icon-button.mat-warn:not(.mdc-ripple-upgraded):focus::before {
  background: transparent;
  opacity: 1;
}
`,`@media (forced-colors: active) {
  .mat-mdc-button:not(.mdc-button--outlined),
  .mat-mdc-unelevated-button:not(.mdc-button--outlined),
  .mat-mdc-raised-button:not(.mdc-button--outlined),
  .mat-mdc-outlined-button:not(.mdc-button--outlined),
  .mat-mdc-button-base.mat-tonal-button,
  .mat-mdc-icon-button.mat-mdc-icon-button,
  .mat-mdc-outlined-button .mdc-button__ripple {
    outline: solid 1px;
  }
}
`],encapsulation:2,changeDetection:0})}return t})();var Bs=new p("cdk-dir-doc",{providedIn:"root",factory:()=>c(b)}),Us=/^(ar|ckb|dv|he|iw|fa|nqo|ps|sd|ug|ur|yi|.*[-_](Adlm|Arab|Hebr|Nkoo|Rohg|Thaa))(?!.*[-_](Latn|Cyrl)($|-|_))($|-|_)/i;function yo(t){let r=t?.toLowerCase()||"";return r==="auto"&&typeof navigator<"u"&&navigator?.language?Us.test(navigator.language)?"rtl":"ltr":r==="rtl"?"rtl":"ltr"}var js=(()=>{class t{get value(){return this.valueSignal()}valueSignal=Ye("ltr");change=new xe;constructor(){let e=c(Bs,{optional:!0});if(e){let n=e.body?e.body.dir:null,i=e.documentElement?e.documentElement.dir:null;this.valueSignal.set(yo(n||i||"ltr"))}}ngOnDestroy(){this.change.complete()}static \u0275fac=function(n){return new(n||t)};static \u0275prov=m({token:t,factory:t.\u0275fac,providedIn:"root"})}return t})();var We=(()=>{class t{static \u0275fac=function(n){return new(n||t)};static \u0275mod=L({type:t});static \u0275inj=N({})}return t})();var _o=(()=>{class t{static \u0275fac=function(n){return new(n||t)};static \u0275mod=L({type:t});static \u0275inj=N({imports:[We]})}return t})();var zs=["matButton",""],ur=[[["",8,"material-icons",3,"iconPositionEnd",""],["mat-icon",3,"iconPositionEnd",""],["","matButtonIcon","",3,"iconPositionEnd",""]],"*",[["","iconPositionEnd","",8,"material-icons"],["mat-icon","iconPositionEnd",""],["","matButtonIcon","","iconPositionEnd",""]]],dr=[".material-icons:not([iconPositionEnd]), mat-icon:not([iconPositionEnd]), [matButtonIcon]:not([iconPositionEnd])","*",".material-icons[iconPositionEnd], mat-icon[iconPositionEnd], [matButtonIcon][iconPositionEnd]"],$s=["mat-fab",""],Hs=["mat-mini-fab",""],Vs=`.mat-mdc-fab-base {
  -webkit-user-select: none;
  user-select: none;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 56px;
  height: 56px;
  padding: 0;
  border: none;
  fill: currentColor;
  text-decoration: none;
  cursor: pointer;
  -moz-appearance: none;
  -webkit-appearance: none;
  overflow: visible;
  transition: box-shadow 280ms cubic-bezier(0.4, 0, 0.2, 1), opacity 15ms linear 30ms, transform 270ms 0ms cubic-bezier(0, 0, 0.2, 1);
  flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;
}
.mat-mdc-fab-base .mat-mdc-button-ripple,
.mat-mdc-fab-base .mat-mdc-button-persistent-ripple,
.mat-mdc-fab-base .mat-mdc-button-persistent-ripple::before {
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  position: absolute;
  pointer-events: none;
  border-radius: inherit;
}
.mat-mdc-fab-base .mat-mdc-button-ripple {
  overflow: hidden;
}
.mat-mdc-fab-base .mat-mdc-button-persistent-ripple::before {
  content: "";
  opacity: 0;
}
.mat-mdc-fab-base .mdc-button__label,
.mat-mdc-fab-base .mat-icon {
  z-index: 1;
  position: relative;
}
.mat-mdc-fab-base .mat-focus-indicator {
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  position: absolute;
}
.mat-mdc-fab-base:focus-visible > .mat-focus-indicator::before {
  content: "";
}
.mat-mdc-fab-base._mat-animation-noopable {
  transition: none !important;
  animation: none !important;
}
.mat-mdc-fab-base::before {
  position: absolute;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  border: 1px solid transparent;
  border-radius: inherit;
  content: "";
  pointer-events: none;
}
.mat-mdc-fab-base[hidden] {
  display: none;
}
.mat-mdc-fab-base::-moz-focus-inner {
  padding: 0;
  border: 0;
}
.mat-mdc-fab-base:active, .mat-mdc-fab-base:focus {
  outline: none;
}
.mat-mdc-fab-base:hover {
  cursor: pointer;
}
.mat-mdc-fab-base > svg {
  width: 100%;
}
.mat-mdc-fab-base .mat-icon, .mat-mdc-fab-base .material-icons {
  transition: transform 180ms 90ms cubic-bezier(0, 0, 0.2, 1);
  fill: currentColor;
  will-change: transform;
}
.mat-mdc-fab-base .mat-focus-indicator::before {
  margin: calc(calc(var(--mat-focus-indicator-border-width, 3px) + 2px) * -1);
}
.mat-mdc-fab-base[disabled], .mat-mdc-fab-base.mat-mdc-button-disabled {
  cursor: default;
  pointer-events: none;
}
.mat-mdc-fab-base[disabled], .mat-mdc-fab-base[disabled]:focus, .mat-mdc-fab-base.mat-mdc-button-disabled, .mat-mdc-fab-base.mat-mdc-button-disabled:focus {
  box-shadow: none;
}
.mat-mdc-fab-base.mat-mdc-button-disabled-interactive {
  pointer-events: auto;
}

.mat-mdc-fab {
  background-color: var(--mat-fab-container-color, var(--mat-sys-primary-container));
  border-radius: var(--mat-fab-container-shape, var(--mat-sys-corner-large));
  color: var(--mat-fab-foreground-color, var(--mat-sys-on-primary-container, inherit));
  box-shadow: var(--mat-fab-container-elevation-shadow, var(--mat-sys-level3));
}
@media (hover: hover) {
  .mat-mdc-fab:hover {
    box-shadow: var(--mat-fab-hover-container-elevation-shadow, var(--mat-sys-level4));
  }
}
.mat-mdc-fab:focus {
  box-shadow: var(--mat-fab-focus-container-elevation-shadow, var(--mat-sys-level3));
}
.mat-mdc-fab:active, .mat-mdc-fab:focus:active {
  box-shadow: var(--mat-fab-pressed-container-elevation-shadow, var(--mat-sys-level3));
}
.mat-mdc-fab[disabled], .mat-mdc-fab.mat-mdc-button-disabled {
  cursor: default;
  pointer-events: none;
  color: var(--mat-fab-disabled-state-foreground-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));
  background-color: var(--mat-fab-disabled-state-container-color, color-mix(in srgb, var(--mat-sys-on-surface) 12%, transparent));
}
.mat-mdc-fab.mat-mdc-button-disabled-interactive {
  pointer-events: auto;
}
.mat-mdc-fab .mat-mdc-button-touch-target {
  position: absolute;
  top: 50%;
  height: var(--mat-fab-touch-target-size, 48px);
  display: var(--mat-fab-touch-target-display, block);
  left: 50%;
  width: var(--mat-fab-touch-target-size, 48px);
  transform: translate(-50%, -50%);
}
.mat-mdc-fab .mat-ripple-element {
  background-color: var(--mat-fab-ripple-color, color-mix(in srgb, var(--mat-sys-on-primary-container) calc(var(--mat-sys-pressed-state-layer-opacity) * 100%), transparent));
}
.mat-mdc-fab .mat-mdc-button-persistent-ripple::before {
  background-color: var(--mat-fab-state-layer-color, var(--mat-sys-on-primary-container));
}
.mat-mdc-fab.mat-mdc-button-disabled .mat-mdc-button-persistent-ripple::before {
  background-color: var(--mat-fab-disabled-state-layer-color);
}
.mat-mdc-fab:hover > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-fab-hover-state-layer-opacity, var(--mat-sys-hover-state-layer-opacity));
}
.mat-mdc-fab.cdk-program-focused > .mat-mdc-button-persistent-ripple::before, .mat-mdc-fab.cdk-keyboard-focused > .mat-mdc-button-persistent-ripple::before, .mat-mdc-fab.mat-mdc-button-disabled-interactive:focus > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-fab-focus-state-layer-opacity, var(--mat-sys-focus-state-layer-opacity));
}
.mat-mdc-fab:active > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-fab-pressed-state-layer-opacity, var(--mat-sys-pressed-state-layer-opacity));
}

.mat-mdc-mini-fab {
  width: 40px;
  height: 40px;
  background-color: var(--mat-fab-small-container-color, var(--mat-sys-primary-container));
  border-radius: var(--mat-fab-small-container-shape, var(--mat-sys-corner-medium));
  color: var(--mat-fab-small-foreground-color, var(--mat-sys-on-primary-container, inherit));
  box-shadow: var(--mat-fab-small-container-elevation-shadow, var(--mat-sys-level3));
}
@media (hover: hover) {
  .mat-mdc-mini-fab:hover {
    box-shadow: var(--mat-fab-small-hover-container-elevation-shadow, var(--mat-sys-level4));
  }
}
.mat-mdc-mini-fab:focus {
  box-shadow: var(--mat-fab-small-focus-container-elevation-shadow, var(--mat-sys-level3));
}
.mat-mdc-mini-fab:active, .mat-mdc-mini-fab:focus:active {
  box-shadow: var(--mat-fab-small-pressed-container-elevation-shadow, var(--mat-sys-level3));
}
.mat-mdc-mini-fab[disabled], .mat-mdc-mini-fab.mat-mdc-button-disabled {
  cursor: default;
  pointer-events: none;
  color: var(--mat-fab-small-disabled-state-foreground-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));
  background-color: var(--mat-fab-small-disabled-state-container-color, color-mix(in srgb, var(--mat-sys-on-surface) 12%, transparent));
}
.mat-mdc-mini-fab.mat-mdc-button-disabled-interactive {
  pointer-events: auto;
}
.mat-mdc-mini-fab .mat-mdc-button-touch-target {
  position: absolute;
  top: 50%;
  height: var(--mat-fab-small-touch-target-size, 48px);
  display: var(--mat-fab-small-touch-target-display);
  left: 50%;
  width: var(--mat-fab-small-touch-target-size, 48px);
  transform: translate(-50%, -50%);
}
.mat-mdc-mini-fab .mat-ripple-element {
  background-color: var(--mat-fab-small-ripple-color, color-mix(in srgb, var(--mat-sys-on-primary-container) calc(var(--mat-sys-pressed-state-layer-opacity) * 100%), transparent));
}
.mat-mdc-mini-fab .mat-mdc-button-persistent-ripple::before {
  background-color: var(--mat-fab-small-state-layer-color, var(--mat-sys-on-primary-container));
}
.mat-mdc-mini-fab.mat-mdc-button-disabled .mat-mdc-button-persistent-ripple::before {
  background-color: var(--mat-fab-small-disabled-state-layer-color);
}
.mat-mdc-mini-fab:hover > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-fab-small-hover-state-layer-opacity, var(--mat-sys-hover-state-layer-opacity));
}
.mat-mdc-mini-fab.cdk-program-focused > .mat-mdc-button-persistent-ripple::before, .mat-mdc-mini-fab.cdk-keyboard-focused > .mat-mdc-button-persistent-ripple::before, .mat-mdc-mini-fab.mat-mdc-button-disabled-interactive:focus > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-fab-small-focus-state-layer-opacity, var(--mat-sys-focus-state-layer-opacity));
}
.mat-mdc-mini-fab:active > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-fab-small-pressed-state-layer-opacity, var(--mat-sys-pressed-state-layer-opacity));
}

.mat-mdc-extended-fab {
  -moz-osx-font-smoothing: grayscale;
  -webkit-font-smoothing: antialiased;
  padding-left: 20px;
  padding-right: 20px;
  width: auto;
  max-width: 100%;
  line-height: normal;
  box-shadow: var(--mat-fab-extended-container-elevation-shadow, var(--mat-sys-level3));
  height: var(--mat-fab-extended-container-height, 56px);
  border-radius: var(--mat-fab-extended-container-shape, var(--mat-sys-corner-large));
  font-family: var(--mat-fab-extended-label-text-font, var(--mat-sys-label-large-font));
  font-size: var(--mat-fab-extended-label-text-size, var(--mat-sys-label-large-size));
  font-weight: var(--mat-fab-extended-label-text-weight, var(--mat-sys-label-large-weight));
  letter-spacing: var(--mat-fab-extended-label-text-tracking, var(--mat-sys-label-large-tracking));
}
@media (hover: hover) {
  .mat-mdc-extended-fab:hover {
    box-shadow: var(--mat-fab-extended-hover-container-elevation-shadow, var(--mat-sys-level4));
  }
}
.mat-mdc-extended-fab:focus {
  box-shadow: var(--mat-fab-extended-focus-container-elevation-shadow, var(--mat-sys-level3));
}
.mat-mdc-extended-fab:active, .mat-mdc-extended-fab:focus:active {
  box-shadow: var(--mat-fab-extended-pressed-container-elevation-shadow, var(--mat-sys-level3));
}
.mat-mdc-extended-fab[disabled], .mat-mdc-extended-fab.mat-mdc-button-disabled {
  cursor: default;
  pointer-events: none;
}
.mat-mdc-extended-fab[disabled], .mat-mdc-extended-fab[disabled]:focus, .mat-mdc-extended-fab.mat-mdc-button-disabled, .mat-mdc-extended-fab.mat-mdc-button-disabled:focus {
  box-shadow: none;
}
.mat-mdc-extended-fab.mat-mdc-button-disabled-interactive {
  pointer-events: auto;
}
[dir=rtl] .mat-mdc-extended-fab .mdc-button__label + .mat-icon, [dir=rtl] .mat-mdc-extended-fab .mdc-button__label + .material-icons,
.mat-mdc-extended-fab > .mat-icon,
.mat-mdc-extended-fab > .material-icons {
  margin-left: -8px;
  margin-right: 12px;
}
.mat-mdc-extended-fab .mdc-button__label + .mat-icon,
.mat-mdc-extended-fab .mdc-button__label + .material-icons, [dir=rtl] .mat-mdc-extended-fab > .mat-icon, [dir=rtl] .mat-mdc-extended-fab > .material-icons {
  margin-left: 12px;
  margin-right: -8px;
}
.mat-mdc-extended-fab .mat-mdc-button-touch-target {
  width: 100%;
}
`,Do=new Map([["text",["mat-mdc-button"]],["filled",["mdc-button--unelevated","mat-mdc-unelevated-button"]],["elevated",["mdc-button--raised","mat-mdc-raised-button"]],["outlined",["mdc-button--outlined","mat-mdc-outlined-button"]],["tonal",["mat-tonal-button"]]]),Sh=(()=>{class t extends gt{get appearance(){return this._appearance}set appearance(e){this.setAppearance(e||this._config?.defaultAppearance||"text")}_appearance=null;constructor(){super();let e=Gs(this._elementRef.nativeElement);e&&this.setAppearance(e)}setAppearance(e){if(e===this._appearance)return;let n=this._elementRef.nativeElement.classList,i=this._appearance?Do.get(this._appearance):null,o=Do.get(e);i&&n.remove(...i),n.add(...o),this._appearance=e}static \u0275fac=function(n){return new(n||t)};static \u0275cmp=$({type:t,selectors:[["button","matButton",""],["a","matButton",""],["button","mat-button",""],["button","mat-raised-button",""],["button","mat-flat-button",""],["button","mat-stroked-button",""],["a","mat-button",""],["a","mat-raised-button",""],["a","mat-flat-button",""],["a","mat-stroked-button",""]],hostAttrs:[1,"mdc-button"],inputs:{appearance:[0,"matButton","appearance"]},exportAs:["matButton","matAnchor"],features:[ke],attrs:zs,ngContentSelectors:dr,decls:7,vars:4,consts:[[1,"mat-mdc-button-persistent-ripple"],[1,"mdc-button__label"],[1,"mat-focus-indicator"],[1,"mat-mdc-button-touch-target"]],template:function(n,i){n&1&&(he(ur),ie(0,"span",0),V(1),Mt(2,"span",1),V(3,1),Ft(),V(4,2),ie(5,"span",2)(6,"span",3)),n&2&&ee("mdc-button__ripple",!i._isFab)("mdc-fab__ripple",i._isFab)},styles:[`.mat-mdc-button-base {
  text-decoration: none;
}
.mat-mdc-button-base .mat-icon {
  min-height: fit-content;
  flex-shrink: 0;
}
@media (hover: none) {
  .mat-mdc-button-base:hover > span.mat-mdc-button-persistent-ripple::before {
    opacity: 0;
  }
}

.mdc-button {
  -webkit-user-select: none;
  user-select: none;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-width: 64px;
  border: none;
  outline: none;
  line-height: inherit;
  -webkit-appearance: none;
  overflow: visible;
  vertical-align: middle;
  background: transparent;
  padding: 0 8px;
}
.mdc-button::-moz-focus-inner {
  padding: 0;
  border: 0;
}
.mdc-button:active {
  outline: none;
}
.mdc-button:hover {
  cursor: pointer;
}
.mdc-button:disabled {
  cursor: default;
  pointer-events: none;
}
.mdc-button[hidden] {
  display: none;
}
.mdc-button .mdc-button__label {
  position: relative;
}

.mat-mdc-button {
  padding: 0 var(--mat-button-text-horizontal-padding, 12px);
  height: var(--mat-button-text-container-height, 40px);
  font-family: var(--mat-button-text-label-text-font, var(--mat-sys-label-large-font));
  font-size: var(--mat-button-text-label-text-size, var(--mat-sys-label-large-size));
  letter-spacing: var(--mat-button-text-label-text-tracking, var(--mat-sys-label-large-tracking));
  text-transform: var(--mat-button-text-label-text-transform);
  font-weight: var(--mat-button-text-label-text-weight, var(--mat-sys-label-large-weight));
}
.mat-mdc-button, .mat-mdc-button .mdc-button__ripple {
  border-radius: var(--mat-button-text-container-shape, var(--mat-sys-corner-full));
}
.mat-mdc-button:not(:disabled) {
  color: var(--mat-button-text-label-text-color, var(--mat-sys-primary));
}
.mat-mdc-button[disabled], .mat-mdc-button.mat-mdc-button-disabled {
  cursor: default;
  pointer-events: none;
  color: var(--mat-button-text-disabled-label-text-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));
}
.mat-mdc-button.mat-mdc-button-disabled-interactive {
  pointer-events: auto;
}
.mat-mdc-button:has(.material-icons, mat-icon, [matButtonIcon]) {
  padding: 0 var(--mat-button-text-with-icon-horizontal-padding, 16px);
}
.mat-mdc-button > .mat-icon {
  margin-right: var(--mat-button-text-icon-spacing, 8px);
  margin-left: var(--mat-button-text-icon-offset, -4px);
}
[dir=rtl] .mat-mdc-button > .mat-icon {
  margin-right: var(--mat-button-text-icon-offset, -4px);
  margin-left: var(--mat-button-text-icon-spacing, 8px);
}
.mat-mdc-button .mdc-button__label + .mat-icon {
  margin-right: var(--mat-button-text-icon-offset, -4px);
  margin-left: var(--mat-button-text-icon-spacing, 8px);
}
[dir=rtl] .mat-mdc-button .mdc-button__label + .mat-icon {
  margin-right: var(--mat-button-text-icon-spacing, 8px);
  margin-left: var(--mat-button-text-icon-offset, -4px);
}
.mat-mdc-button .mat-ripple-element {
  background-color: var(--mat-button-text-ripple-color, color-mix(in srgb, var(--mat-sys-primary) calc(var(--mat-sys-pressed-state-layer-opacity) * 100%), transparent));
}
.mat-mdc-button .mat-mdc-button-persistent-ripple::before {
  background-color: var(--mat-button-text-state-layer-color, var(--mat-sys-primary));
}
.mat-mdc-button.mat-mdc-button-disabled .mat-mdc-button-persistent-ripple::before {
  background-color: var(--mat-button-text-disabled-state-layer-color, var(--mat-sys-on-surface-variant));
}
.mat-mdc-button:hover > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-button-text-hover-state-layer-opacity, var(--mat-sys-hover-state-layer-opacity));
}
.mat-mdc-button.cdk-program-focused > .mat-mdc-button-persistent-ripple::before, .mat-mdc-button.cdk-keyboard-focused > .mat-mdc-button-persistent-ripple::before, .mat-mdc-button.mat-mdc-button-disabled-interactive:focus > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-button-text-focus-state-layer-opacity, var(--mat-sys-focus-state-layer-opacity));
}
.mat-mdc-button:active > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-button-text-pressed-state-layer-opacity, var(--mat-sys-pressed-state-layer-opacity));
}
.mat-mdc-button .mat-mdc-button-touch-target {
  position: absolute;
  top: 50%;
  height: var(--mat-button-text-touch-target-size, 48px);
  display: var(--mat-button-text-touch-target-display, block);
  left: 0;
  right: 0;
  transform: translateY(-50%);
}

.mat-mdc-unelevated-button {
  transition: box-shadow 280ms cubic-bezier(0.4, 0, 0.2, 1);
  height: var(--mat-button-filled-container-height, 40px);
  font-family: var(--mat-button-filled-label-text-font, var(--mat-sys-label-large-font));
  font-size: var(--mat-button-filled-label-text-size, var(--mat-sys-label-large-size));
  letter-spacing: var(--mat-button-filled-label-text-tracking, var(--mat-sys-label-large-tracking));
  text-transform: var(--mat-button-filled-label-text-transform);
  font-weight: var(--mat-button-filled-label-text-weight, var(--mat-sys-label-large-weight));
  padding: 0 var(--mat-button-filled-horizontal-padding, 24px);
}
.mat-mdc-unelevated-button > .mat-icon {
  margin-right: var(--mat-button-filled-icon-spacing, 8px);
  margin-left: var(--mat-button-filled-icon-offset, -8px);
}
[dir=rtl] .mat-mdc-unelevated-button > .mat-icon {
  margin-right: var(--mat-button-filled-icon-offset, -8px);
  margin-left: var(--mat-button-filled-icon-spacing, 8px);
}
.mat-mdc-unelevated-button .mdc-button__label + .mat-icon {
  margin-right: var(--mat-button-filled-icon-offset, -8px);
  margin-left: var(--mat-button-filled-icon-spacing, 8px);
}
[dir=rtl] .mat-mdc-unelevated-button .mdc-button__label + .mat-icon {
  margin-right: var(--mat-button-filled-icon-spacing, 8px);
  margin-left: var(--mat-button-filled-icon-offset, -8px);
}
.mat-mdc-unelevated-button .mat-ripple-element {
  background-color: var(--mat-button-filled-ripple-color, color-mix(in srgb, var(--mat-sys-on-primary) calc(var(--mat-sys-pressed-state-layer-opacity) * 100%), transparent));
}
.mat-mdc-unelevated-button .mat-mdc-button-persistent-ripple::before {
  background-color: var(--mat-button-filled-state-layer-color, var(--mat-sys-on-primary));
}
.mat-mdc-unelevated-button.mat-mdc-button-disabled .mat-mdc-button-persistent-ripple::before {
  background-color: var(--mat-button-filled-disabled-state-layer-color, var(--mat-sys-on-surface-variant));
}
.mat-mdc-unelevated-button:hover > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-button-filled-hover-state-layer-opacity, var(--mat-sys-hover-state-layer-opacity));
}
.mat-mdc-unelevated-button.cdk-program-focused > .mat-mdc-button-persistent-ripple::before, .mat-mdc-unelevated-button.cdk-keyboard-focused > .mat-mdc-button-persistent-ripple::before, .mat-mdc-unelevated-button.mat-mdc-button-disabled-interactive:focus > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-button-filled-focus-state-layer-opacity, var(--mat-sys-focus-state-layer-opacity));
}
.mat-mdc-unelevated-button:active > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-button-filled-pressed-state-layer-opacity, var(--mat-sys-pressed-state-layer-opacity));
}
.mat-mdc-unelevated-button .mat-mdc-button-touch-target {
  position: absolute;
  top: 50%;
  height: var(--mat-button-filled-touch-target-size, 48px);
  display: var(--mat-button-filled-touch-target-display, block);
  left: 0;
  right: 0;
  transform: translateY(-50%);
}
.mat-mdc-unelevated-button:not(:disabled) {
  color: var(--mat-button-filled-label-text-color, var(--mat-sys-on-primary));
  background-color: var(--mat-button-filled-container-color, var(--mat-sys-primary));
}
.mat-mdc-unelevated-button, .mat-mdc-unelevated-button .mdc-button__ripple {
  border-radius: var(--mat-button-filled-container-shape, var(--mat-sys-corner-full));
}
.mat-mdc-unelevated-button[disabled], .mat-mdc-unelevated-button.mat-mdc-button-disabled {
  cursor: default;
  pointer-events: none;
  color: var(--mat-button-filled-disabled-label-text-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));
  background-color: var(--mat-button-filled-disabled-container-color, color-mix(in srgb, var(--mat-sys-on-surface) 12%, transparent));
}
.mat-mdc-unelevated-button.mat-mdc-button-disabled-interactive {
  pointer-events: auto;
}

.mat-mdc-raised-button {
  transition: box-shadow 280ms cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: var(--mat-button-protected-container-elevation-shadow, var(--mat-sys-level1));
  height: var(--mat-button-protected-container-height, 40px);
  font-family: var(--mat-button-protected-label-text-font, var(--mat-sys-label-large-font));
  font-size: var(--mat-button-protected-label-text-size, var(--mat-sys-label-large-size));
  letter-spacing: var(--mat-button-protected-label-text-tracking, var(--mat-sys-label-large-tracking));
  text-transform: var(--mat-button-protected-label-text-transform);
  font-weight: var(--mat-button-protected-label-text-weight, var(--mat-sys-label-large-weight));
  padding: 0 var(--mat-button-protected-horizontal-padding, 24px);
}
.mat-mdc-raised-button > .mat-icon {
  margin-right: var(--mat-button-protected-icon-spacing, 8px);
  margin-left: var(--mat-button-protected-icon-offset, -8px);
}
[dir=rtl] .mat-mdc-raised-button > .mat-icon {
  margin-right: var(--mat-button-protected-icon-offset, -8px);
  margin-left: var(--mat-button-protected-icon-spacing, 8px);
}
.mat-mdc-raised-button .mdc-button__label + .mat-icon {
  margin-right: var(--mat-button-protected-icon-offset, -8px);
  margin-left: var(--mat-button-protected-icon-spacing, 8px);
}
[dir=rtl] .mat-mdc-raised-button .mdc-button__label + .mat-icon {
  margin-right: var(--mat-button-protected-icon-spacing, 8px);
  margin-left: var(--mat-button-protected-icon-offset, -8px);
}
.mat-mdc-raised-button .mat-ripple-element {
  background-color: var(--mat-button-protected-ripple-color, color-mix(in srgb, var(--mat-sys-primary) calc(var(--mat-sys-pressed-state-layer-opacity) * 100%), transparent));
}
.mat-mdc-raised-button .mat-mdc-button-persistent-ripple::before {
  background-color: var(--mat-button-protected-state-layer-color, var(--mat-sys-primary));
}
.mat-mdc-raised-button.mat-mdc-button-disabled .mat-mdc-button-persistent-ripple::before {
  background-color: var(--mat-button-protected-disabled-state-layer-color, var(--mat-sys-on-surface-variant));
}
.mat-mdc-raised-button:hover > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-button-protected-hover-state-layer-opacity, var(--mat-sys-hover-state-layer-opacity));
}
.mat-mdc-raised-button.cdk-program-focused > .mat-mdc-button-persistent-ripple::before, .mat-mdc-raised-button.cdk-keyboard-focused > .mat-mdc-button-persistent-ripple::before, .mat-mdc-raised-button.mat-mdc-button-disabled-interactive:focus > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-button-protected-focus-state-layer-opacity, var(--mat-sys-focus-state-layer-opacity));
}
.mat-mdc-raised-button:active > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-button-protected-pressed-state-layer-opacity, var(--mat-sys-pressed-state-layer-opacity));
}
.mat-mdc-raised-button .mat-mdc-button-touch-target {
  position: absolute;
  top: 50%;
  height: var(--mat-button-protected-touch-target-size, 48px);
  display: var(--mat-button-protected-touch-target-display, block);
  left: 0;
  right: 0;
  transform: translateY(-50%);
}
.mat-mdc-raised-button:not(:disabled) {
  color: var(--mat-button-protected-label-text-color, var(--mat-sys-primary));
  background-color: var(--mat-button-protected-container-color, var(--mat-sys-surface));
}
.mat-mdc-raised-button, .mat-mdc-raised-button .mdc-button__ripple {
  border-radius: var(--mat-button-protected-container-shape, var(--mat-sys-corner-full));
}
@media (hover: hover) {
  .mat-mdc-raised-button:hover {
    box-shadow: var(--mat-button-protected-hover-container-elevation-shadow, var(--mat-sys-level2));
  }
}
.mat-mdc-raised-button:focus {
  box-shadow: var(--mat-button-protected-focus-container-elevation-shadow, var(--mat-sys-level1));
}
.mat-mdc-raised-button:active, .mat-mdc-raised-button:focus:active {
  box-shadow: var(--mat-button-protected-pressed-container-elevation-shadow, var(--mat-sys-level1));
}
.mat-mdc-raised-button[disabled], .mat-mdc-raised-button.mat-mdc-button-disabled {
  cursor: default;
  pointer-events: none;
  color: var(--mat-button-protected-disabled-label-text-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));
  background-color: var(--mat-button-protected-disabled-container-color, color-mix(in srgb, var(--mat-sys-on-surface) 12%, transparent));
}
.mat-mdc-raised-button[disabled].mat-mdc-button-disabled, .mat-mdc-raised-button.mat-mdc-button-disabled.mat-mdc-button-disabled {
  box-shadow: var(--mat-button-protected-disabled-container-elevation-shadow, var(--mat-sys-level0));
}
.mat-mdc-raised-button.mat-mdc-button-disabled-interactive {
  pointer-events: auto;
}

.mat-mdc-outlined-button {
  border-style: solid;
  transition: border 280ms cubic-bezier(0.4, 0, 0.2, 1);
  height: var(--mat-button-outlined-container-height, 40px);
  font-family: var(--mat-button-outlined-label-text-font, var(--mat-sys-label-large-font));
  font-size: var(--mat-button-outlined-label-text-size, var(--mat-sys-label-large-size));
  letter-spacing: var(--mat-button-outlined-label-text-tracking, var(--mat-sys-label-large-tracking));
  text-transform: var(--mat-button-outlined-label-text-transform);
  font-weight: var(--mat-button-outlined-label-text-weight, var(--mat-sys-label-large-weight));
  border-radius: var(--mat-button-outlined-container-shape, var(--mat-sys-corner-full));
  border-width: var(--mat-button-outlined-outline-width, 1px);
  padding: 0 var(--mat-button-outlined-horizontal-padding, 24px);
}
.mat-mdc-outlined-button > .mat-icon {
  margin-right: var(--mat-button-outlined-icon-spacing, 8px);
  margin-left: var(--mat-button-outlined-icon-offset, -8px);
}
[dir=rtl] .mat-mdc-outlined-button > .mat-icon {
  margin-right: var(--mat-button-outlined-icon-offset, -8px);
  margin-left: var(--mat-button-outlined-icon-spacing, 8px);
}
.mat-mdc-outlined-button .mdc-button__label + .mat-icon {
  margin-right: var(--mat-button-outlined-icon-offset, -8px);
  margin-left: var(--mat-button-outlined-icon-spacing, 8px);
}
[dir=rtl] .mat-mdc-outlined-button .mdc-button__label + .mat-icon {
  margin-right: var(--mat-button-outlined-icon-spacing, 8px);
  margin-left: var(--mat-button-outlined-icon-offset, -8px);
}
.mat-mdc-outlined-button .mat-ripple-element {
  background-color: var(--mat-button-outlined-ripple-color, color-mix(in srgb, var(--mat-sys-primary) calc(var(--mat-sys-pressed-state-layer-opacity) * 100%), transparent));
}
.mat-mdc-outlined-button .mat-mdc-button-persistent-ripple::before {
  background-color: var(--mat-button-outlined-state-layer-color, var(--mat-sys-primary));
}
.mat-mdc-outlined-button.mat-mdc-button-disabled .mat-mdc-button-persistent-ripple::before {
  background-color: var(--mat-button-outlined-disabled-state-layer-color, var(--mat-sys-on-surface-variant));
}
.mat-mdc-outlined-button:hover > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-button-outlined-hover-state-layer-opacity, var(--mat-sys-hover-state-layer-opacity));
}
.mat-mdc-outlined-button.cdk-program-focused > .mat-mdc-button-persistent-ripple::before, .mat-mdc-outlined-button.cdk-keyboard-focused > .mat-mdc-button-persistent-ripple::before, .mat-mdc-outlined-button.mat-mdc-button-disabled-interactive:focus > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-button-outlined-focus-state-layer-opacity, var(--mat-sys-focus-state-layer-opacity));
}
.mat-mdc-outlined-button:active > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-button-outlined-pressed-state-layer-opacity, var(--mat-sys-pressed-state-layer-opacity));
}
.mat-mdc-outlined-button .mat-mdc-button-touch-target {
  position: absolute;
  top: 50%;
  height: var(--mat-button-outlined-touch-target-size, 48px);
  display: var(--mat-button-outlined-touch-target-display, block);
  left: 0;
  right: 0;
  transform: translateY(-50%);
}
.mat-mdc-outlined-button:not(:disabled) {
  color: var(--mat-button-outlined-label-text-color, var(--mat-sys-primary));
  border-color: var(--mat-button-outlined-outline-color, var(--mat-sys-outline));
}
.mat-mdc-outlined-button[disabled], .mat-mdc-outlined-button.mat-mdc-button-disabled {
  cursor: default;
  pointer-events: none;
  color: var(--mat-button-outlined-disabled-label-text-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));
  border-color: var(--mat-button-outlined-disabled-outline-color, color-mix(in srgb, var(--mat-sys-on-surface) 12%, transparent));
}
.mat-mdc-outlined-button.mat-mdc-button-disabled-interactive {
  pointer-events: auto;
}

.mat-tonal-button {
  transition: box-shadow 280ms cubic-bezier(0.4, 0, 0.2, 1);
  height: var(--mat-button-tonal-container-height, 40px);
  font-family: var(--mat-button-tonal-label-text-font, var(--mat-sys-label-large-font));
  font-size: var(--mat-button-tonal-label-text-size, var(--mat-sys-label-large-size));
  letter-spacing: var(--mat-button-tonal-label-text-tracking, var(--mat-sys-label-large-tracking));
  text-transform: var(--mat-button-tonal-label-text-transform);
  font-weight: var(--mat-button-tonal-label-text-weight, var(--mat-sys-label-large-weight));
  padding: 0 var(--mat-button-tonal-horizontal-padding, 24px);
}
.mat-tonal-button:not(:disabled) {
  color: var(--mat-button-tonal-label-text-color, var(--mat-sys-on-secondary-container));
  background-color: var(--mat-button-tonal-container-color, var(--mat-sys-secondary-container));
}
.mat-tonal-button, .mat-tonal-button .mdc-button__ripple {
  border-radius: var(--mat-button-tonal-container-shape, var(--mat-sys-corner-full));
}
.mat-tonal-button[disabled], .mat-tonal-button.mat-mdc-button-disabled {
  cursor: default;
  pointer-events: none;
  color: var(--mat-button-tonal-disabled-label-text-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));
  background-color: var(--mat-button-tonal-disabled-container-color, color-mix(in srgb, var(--mat-sys-on-surface) 12%, transparent));
}
.mat-tonal-button.mat-mdc-button-disabled-interactive {
  pointer-events: auto;
}
.mat-tonal-button > .mat-icon {
  margin-right: var(--mat-button-tonal-icon-spacing, 8px);
  margin-left: var(--mat-button-tonal-icon-offset, -8px);
}
[dir=rtl] .mat-tonal-button > .mat-icon {
  margin-right: var(--mat-button-tonal-icon-offset, -8px);
  margin-left: var(--mat-button-tonal-icon-spacing, 8px);
}
.mat-tonal-button .mdc-button__label + .mat-icon {
  margin-right: var(--mat-button-tonal-icon-offset, -8px);
  margin-left: var(--mat-button-tonal-icon-spacing, 8px);
}
[dir=rtl] .mat-tonal-button .mdc-button__label + .mat-icon {
  margin-right: var(--mat-button-tonal-icon-spacing, 8px);
  margin-left: var(--mat-button-tonal-icon-offset, -8px);
}
.mat-tonal-button .mat-ripple-element {
  background-color: var(--mat-button-tonal-ripple-color, color-mix(in srgb, var(--mat-sys-on-secondary-container) calc(var(--mat-sys-pressed-state-layer-opacity) * 100%), transparent));
}
.mat-tonal-button .mat-mdc-button-persistent-ripple::before {
  background-color: var(--mat-button-tonal-state-layer-color, var(--mat-sys-on-secondary-container));
}
.mat-tonal-button.mat-mdc-button-disabled .mat-mdc-button-persistent-ripple::before {
  background-color: var(--mat-button-tonal-disabled-state-layer-color, var(--mat-sys-on-surface-variant));
}
.mat-tonal-button:hover > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-button-tonal-hover-state-layer-opacity, var(--mat-sys-hover-state-layer-opacity));
}
.mat-tonal-button.cdk-program-focused > .mat-mdc-button-persistent-ripple::before, .mat-tonal-button.cdk-keyboard-focused > .mat-mdc-button-persistent-ripple::before, .mat-tonal-button.mat-mdc-button-disabled-interactive:focus > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-button-tonal-focus-state-layer-opacity, var(--mat-sys-focus-state-layer-opacity));
}
.mat-tonal-button:active > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-button-tonal-pressed-state-layer-opacity, var(--mat-sys-pressed-state-layer-opacity));
}
.mat-tonal-button .mat-mdc-button-touch-target {
  position: absolute;
  top: 50%;
  height: var(--mat-button-tonal-touch-target-size, 48px);
  display: var(--mat-button-tonal-touch-target-display, block);
  left: 0;
  right: 0;
  transform: translateY(-50%);
}

.mat-mdc-button,
.mat-mdc-unelevated-button,
.mat-mdc-raised-button,
.mat-mdc-outlined-button,
.mat-tonal-button {
  -webkit-tap-highlight-color: transparent;
}
.mat-mdc-button .mat-mdc-button-ripple,
.mat-mdc-button .mat-mdc-button-persistent-ripple,
.mat-mdc-button .mat-mdc-button-persistent-ripple::before,
.mat-mdc-unelevated-button .mat-mdc-button-ripple,
.mat-mdc-unelevated-button .mat-mdc-button-persistent-ripple,
.mat-mdc-unelevated-button .mat-mdc-button-persistent-ripple::before,
.mat-mdc-raised-button .mat-mdc-button-ripple,
.mat-mdc-raised-button .mat-mdc-button-persistent-ripple,
.mat-mdc-raised-button .mat-mdc-button-persistent-ripple::before,
.mat-mdc-outlined-button .mat-mdc-button-ripple,
.mat-mdc-outlined-button .mat-mdc-button-persistent-ripple,
.mat-mdc-outlined-button .mat-mdc-button-persistent-ripple::before,
.mat-tonal-button .mat-mdc-button-ripple,
.mat-tonal-button .mat-mdc-button-persistent-ripple,
.mat-tonal-button .mat-mdc-button-persistent-ripple::before {
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  position: absolute;
  pointer-events: none;
  border-radius: inherit;
}
.mat-mdc-button .mat-mdc-button-ripple,
.mat-mdc-unelevated-button .mat-mdc-button-ripple,
.mat-mdc-raised-button .mat-mdc-button-ripple,
.mat-mdc-outlined-button .mat-mdc-button-ripple,
.mat-tonal-button .mat-mdc-button-ripple {
  overflow: hidden;
}
.mat-mdc-button .mat-mdc-button-persistent-ripple::before,
.mat-mdc-unelevated-button .mat-mdc-button-persistent-ripple::before,
.mat-mdc-raised-button .mat-mdc-button-persistent-ripple::before,
.mat-mdc-outlined-button .mat-mdc-button-persistent-ripple::before,
.mat-tonal-button .mat-mdc-button-persistent-ripple::before {
  content: "";
  opacity: 0;
}
.mat-mdc-button .mdc-button__label,
.mat-mdc-button .mat-icon,
.mat-mdc-unelevated-button .mdc-button__label,
.mat-mdc-unelevated-button .mat-icon,
.mat-mdc-raised-button .mdc-button__label,
.mat-mdc-raised-button .mat-icon,
.mat-mdc-outlined-button .mdc-button__label,
.mat-mdc-outlined-button .mat-icon,
.mat-tonal-button .mdc-button__label,
.mat-tonal-button .mat-icon {
  z-index: 1;
  position: relative;
}
.mat-mdc-button .mat-focus-indicator,
.mat-mdc-unelevated-button .mat-focus-indicator,
.mat-mdc-raised-button .mat-focus-indicator,
.mat-mdc-outlined-button .mat-focus-indicator,
.mat-tonal-button .mat-focus-indicator {
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  position: absolute;
  border-radius: inherit;
}
.mat-mdc-button:focus-visible > .mat-focus-indicator::before,
.mat-mdc-unelevated-button:focus-visible > .mat-focus-indicator::before,
.mat-mdc-raised-button:focus-visible > .mat-focus-indicator::before,
.mat-mdc-outlined-button:focus-visible > .mat-focus-indicator::before,
.mat-tonal-button:focus-visible > .mat-focus-indicator::before {
  content: "";
  border-radius: inherit;
}
.mat-mdc-button._mat-animation-noopable,
.mat-mdc-unelevated-button._mat-animation-noopable,
.mat-mdc-raised-button._mat-animation-noopable,
.mat-mdc-outlined-button._mat-animation-noopable,
.mat-tonal-button._mat-animation-noopable {
  transition: none !important;
  animation: none !important;
}
.mat-mdc-button > .mat-icon,
.mat-mdc-unelevated-button > .mat-icon,
.mat-mdc-raised-button > .mat-icon,
.mat-mdc-outlined-button > .mat-icon,
.mat-tonal-button > .mat-icon {
  display: inline-block;
  position: relative;
  vertical-align: top;
  font-size: 1.125rem;
  height: 1.125rem;
  width: 1.125rem;
}

.mat-mdc-outlined-button .mat-mdc-button-ripple,
.mat-mdc-outlined-button .mdc-button__ripple {
  top: -1px;
  left: -1px;
  bottom: -1px;
  right: -1px;
}

.mat-mdc-unelevated-button .mat-focus-indicator::before,
.mat-tonal-button .mat-focus-indicator::before,
.mat-mdc-raised-button .mat-focus-indicator::before {
  margin: calc(calc(var(--mat-focus-indicator-border-width, 3px) + 2px) * -1);
}

.mat-mdc-outlined-button .mat-focus-indicator::before {
  margin: calc(calc(var(--mat-focus-indicator-border-width, 3px) + 3px) * -1);
}
`,`@media (forced-colors: active) {
  .mat-mdc-button:not(.mdc-button--outlined),
  .mat-mdc-unelevated-button:not(.mdc-button--outlined),
  .mat-mdc-raised-button:not(.mdc-button--outlined),
  .mat-mdc-outlined-button:not(.mdc-button--outlined),
  .mat-mdc-button-base.mat-tonal-button,
  .mat-mdc-icon-button.mat-mdc-icon-button,
  .mat-mdc-outlined-button .mdc-button__ripple {
    outline: solid 1px;
  }
}
`],encapsulation:2,changeDetection:0})}return t})();function Gs(t){return t.hasAttribute("mat-raised-button")?"elevated":t.hasAttribute("mat-stroked-button")?"outlined":t.hasAttribute("mat-flat-button")?"filled":t.hasAttribute("mat-button")?"text":null}var Eo=new p("mat-mdc-fab-default-options",{providedIn:"root",factory:()=>bt}),bt={color:"accent"},Mh=(()=>{class t extends gt{_options=c(Eo,{optional:!0});_isFab=!0;extended=!1;constructor(){super(),this._options=this._options||bt,this.color=this._options.color||bt.color}static \u0275fac=function(n){return new(n||t)};static \u0275cmp=$({type:t,selectors:[["button","mat-fab",""],["a","mat-fab",""],["button","matFab",""],["a","matFab",""]],hostAttrs:[1,"mdc-fab","mat-mdc-fab-base","mat-mdc-fab"],hostVars:4,hostBindings:function(n,i){n&2&&ee("mdc-fab--extended",i.extended)("mat-mdc-extended-fab",i.extended)},inputs:{extended:[2,"extended","extended",Z]},exportAs:["matButton","matAnchor"],features:[ke],attrs:$s,ngContentSelectors:dr,decls:7,vars:4,consts:[[1,"mat-mdc-button-persistent-ripple"],[1,"mdc-button__label"],[1,"mat-focus-indicator"],[1,"mat-mdc-button-touch-target"]],template:function(n,i){n&1&&(he(ur),ie(0,"span",0),V(1),Mt(2,"span",1),V(3,1),Ft(),V(4,2),ie(5,"span",2)(6,"span",3)),n&2&&ee("mdc-button__ripple",!i._isFab)("mdc-fab__ripple",i._isFab)},styles:[`.mat-mdc-fab-base {
  -webkit-user-select: none;
  user-select: none;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 56px;
  height: 56px;
  padding: 0;
  border: none;
  fill: currentColor;
  text-decoration: none;
  cursor: pointer;
  -moz-appearance: none;
  -webkit-appearance: none;
  overflow: visible;
  transition: box-shadow 280ms cubic-bezier(0.4, 0, 0.2, 1), opacity 15ms linear 30ms, transform 270ms 0ms cubic-bezier(0, 0, 0.2, 1);
  flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;
}
.mat-mdc-fab-base .mat-mdc-button-ripple,
.mat-mdc-fab-base .mat-mdc-button-persistent-ripple,
.mat-mdc-fab-base .mat-mdc-button-persistent-ripple::before {
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  position: absolute;
  pointer-events: none;
  border-radius: inherit;
}
.mat-mdc-fab-base .mat-mdc-button-ripple {
  overflow: hidden;
}
.mat-mdc-fab-base .mat-mdc-button-persistent-ripple::before {
  content: "";
  opacity: 0;
}
.mat-mdc-fab-base .mdc-button__label,
.mat-mdc-fab-base .mat-icon {
  z-index: 1;
  position: relative;
}
.mat-mdc-fab-base .mat-focus-indicator {
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  position: absolute;
}
.mat-mdc-fab-base:focus-visible > .mat-focus-indicator::before {
  content: "";
}
.mat-mdc-fab-base._mat-animation-noopable {
  transition: none !important;
  animation: none !important;
}
.mat-mdc-fab-base::before {
  position: absolute;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  border: 1px solid transparent;
  border-radius: inherit;
  content: "";
  pointer-events: none;
}
.mat-mdc-fab-base[hidden] {
  display: none;
}
.mat-mdc-fab-base::-moz-focus-inner {
  padding: 0;
  border: 0;
}
.mat-mdc-fab-base:active, .mat-mdc-fab-base:focus {
  outline: none;
}
.mat-mdc-fab-base:hover {
  cursor: pointer;
}
.mat-mdc-fab-base > svg {
  width: 100%;
}
.mat-mdc-fab-base .mat-icon, .mat-mdc-fab-base .material-icons {
  transition: transform 180ms 90ms cubic-bezier(0, 0, 0.2, 1);
  fill: currentColor;
  will-change: transform;
}
.mat-mdc-fab-base .mat-focus-indicator::before {
  margin: calc(calc(var(--mat-focus-indicator-border-width, 3px) + 2px) * -1);
}
.mat-mdc-fab-base[disabled], .mat-mdc-fab-base.mat-mdc-button-disabled {
  cursor: default;
  pointer-events: none;
}
.mat-mdc-fab-base[disabled], .mat-mdc-fab-base[disabled]:focus, .mat-mdc-fab-base.mat-mdc-button-disabled, .mat-mdc-fab-base.mat-mdc-button-disabled:focus {
  box-shadow: none;
}
.mat-mdc-fab-base.mat-mdc-button-disabled-interactive {
  pointer-events: auto;
}

.mat-mdc-fab {
  background-color: var(--mat-fab-container-color, var(--mat-sys-primary-container));
  border-radius: var(--mat-fab-container-shape, var(--mat-sys-corner-large));
  color: var(--mat-fab-foreground-color, var(--mat-sys-on-primary-container, inherit));
  box-shadow: var(--mat-fab-container-elevation-shadow, var(--mat-sys-level3));
}
@media (hover: hover) {
  .mat-mdc-fab:hover {
    box-shadow: var(--mat-fab-hover-container-elevation-shadow, var(--mat-sys-level4));
  }
}
.mat-mdc-fab:focus {
  box-shadow: var(--mat-fab-focus-container-elevation-shadow, var(--mat-sys-level3));
}
.mat-mdc-fab:active, .mat-mdc-fab:focus:active {
  box-shadow: var(--mat-fab-pressed-container-elevation-shadow, var(--mat-sys-level3));
}
.mat-mdc-fab[disabled], .mat-mdc-fab.mat-mdc-button-disabled {
  cursor: default;
  pointer-events: none;
  color: var(--mat-fab-disabled-state-foreground-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));
  background-color: var(--mat-fab-disabled-state-container-color, color-mix(in srgb, var(--mat-sys-on-surface) 12%, transparent));
}
.mat-mdc-fab.mat-mdc-button-disabled-interactive {
  pointer-events: auto;
}
.mat-mdc-fab .mat-mdc-button-touch-target {
  position: absolute;
  top: 50%;
  height: var(--mat-fab-touch-target-size, 48px);
  display: var(--mat-fab-touch-target-display, block);
  left: 50%;
  width: var(--mat-fab-touch-target-size, 48px);
  transform: translate(-50%, -50%);
}
.mat-mdc-fab .mat-ripple-element {
  background-color: var(--mat-fab-ripple-color, color-mix(in srgb, var(--mat-sys-on-primary-container) calc(var(--mat-sys-pressed-state-layer-opacity) * 100%), transparent));
}
.mat-mdc-fab .mat-mdc-button-persistent-ripple::before {
  background-color: var(--mat-fab-state-layer-color, var(--mat-sys-on-primary-container));
}
.mat-mdc-fab.mat-mdc-button-disabled .mat-mdc-button-persistent-ripple::before {
  background-color: var(--mat-fab-disabled-state-layer-color);
}
.mat-mdc-fab:hover > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-fab-hover-state-layer-opacity, var(--mat-sys-hover-state-layer-opacity));
}
.mat-mdc-fab.cdk-program-focused > .mat-mdc-button-persistent-ripple::before, .mat-mdc-fab.cdk-keyboard-focused > .mat-mdc-button-persistent-ripple::before, .mat-mdc-fab.mat-mdc-button-disabled-interactive:focus > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-fab-focus-state-layer-opacity, var(--mat-sys-focus-state-layer-opacity));
}
.mat-mdc-fab:active > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-fab-pressed-state-layer-opacity, var(--mat-sys-pressed-state-layer-opacity));
}

.mat-mdc-mini-fab {
  width: 40px;
  height: 40px;
  background-color: var(--mat-fab-small-container-color, var(--mat-sys-primary-container));
  border-radius: var(--mat-fab-small-container-shape, var(--mat-sys-corner-medium));
  color: var(--mat-fab-small-foreground-color, var(--mat-sys-on-primary-container, inherit));
  box-shadow: var(--mat-fab-small-container-elevation-shadow, var(--mat-sys-level3));
}
@media (hover: hover) {
  .mat-mdc-mini-fab:hover {
    box-shadow: var(--mat-fab-small-hover-container-elevation-shadow, var(--mat-sys-level4));
  }
}
.mat-mdc-mini-fab:focus {
  box-shadow: var(--mat-fab-small-focus-container-elevation-shadow, var(--mat-sys-level3));
}
.mat-mdc-mini-fab:active, .mat-mdc-mini-fab:focus:active {
  box-shadow: var(--mat-fab-small-pressed-container-elevation-shadow, var(--mat-sys-level3));
}
.mat-mdc-mini-fab[disabled], .mat-mdc-mini-fab.mat-mdc-button-disabled {
  cursor: default;
  pointer-events: none;
  color: var(--mat-fab-small-disabled-state-foreground-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));
  background-color: var(--mat-fab-small-disabled-state-container-color, color-mix(in srgb, var(--mat-sys-on-surface) 12%, transparent));
}
.mat-mdc-mini-fab.mat-mdc-button-disabled-interactive {
  pointer-events: auto;
}
.mat-mdc-mini-fab .mat-mdc-button-touch-target {
  position: absolute;
  top: 50%;
  height: var(--mat-fab-small-touch-target-size, 48px);
  display: var(--mat-fab-small-touch-target-display);
  left: 50%;
  width: var(--mat-fab-small-touch-target-size, 48px);
  transform: translate(-50%, -50%);
}
.mat-mdc-mini-fab .mat-ripple-element {
  background-color: var(--mat-fab-small-ripple-color, color-mix(in srgb, var(--mat-sys-on-primary-container) calc(var(--mat-sys-pressed-state-layer-opacity) * 100%), transparent));
}
.mat-mdc-mini-fab .mat-mdc-button-persistent-ripple::before {
  background-color: var(--mat-fab-small-state-layer-color, var(--mat-sys-on-primary-container));
}
.mat-mdc-mini-fab.mat-mdc-button-disabled .mat-mdc-button-persistent-ripple::before {
  background-color: var(--mat-fab-small-disabled-state-layer-color);
}
.mat-mdc-mini-fab:hover > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-fab-small-hover-state-layer-opacity, var(--mat-sys-hover-state-layer-opacity));
}
.mat-mdc-mini-fab.cdk-program-focused > .mat-mdc-button-persistent-ripple::before, .mat-mdc-mini-fab.cdk-keyboard-focused > .mat-mdc-button-persistent-ripple::before, .mat-mdc-mini-fab.mat-mdc-button-disabled-interactive:focus > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-fab-small-focus-state-layer-opacity, var(--mat-sys-focus-state-layer-opacity));
}
.mat-mdc-mini-fab:active > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-fab-small-pressed-state-layer-opacity, var(--mat-sys-pressed-state-layer-opacity));
}

.mat-mdc-extended-fab {
  -moz-osx-font-smoothing: grayscale;
  -webkit-font-smoothing: antialiased;
  padding-left: 20px;
  padding-right: 20px;
  width: auto;
  max-width: 100%;
  line-height: normal;
  box-shadow: var(--mat-fab-extended-container-elevation-shadow, var(--mat-sys-level3));
  height: var(--mat-fab-extended-container-height, 56px);
  border-radius: var(--mat-fab-extended-container-shape, var(--mat-sys-corner-large));
  font-family: var(--mat-fab-extended-label-text-font, var(--mat-sys-label-large-font));
  font-size: var(--mat-fab-extended-label-text-size, var(--mat-sys-label-large-size));
  font-weight: var(--mat-fab-extended-label-text-weight, var(--mat-sys-label-large-weight));
  letter-spacing: var(--mat-fab-extended-label-text-tracking, var(--mat-sys-label-large-tracking));
}
@media (hover: hover) {
  .mat-mdc-extended-fab:hover {
    box-shadow: var(--mat-fab-extended-hover-container-elevation-shadow, var(--mat-sys-level4));
  }
}
.mat-mdc-extended-fab:focus {
  box-shadow: var(--mat-fab-extended-focus-container-elevation-shadow, var(--mat-sys-level3));
}
.mat-mdc-extended-fab:active, .mat-mdc-extended-fab:focus:active {
  box-shadow: var(--mat-fab-extended-pressed-container-elevation-shadow, var(--mat-sys-level3));
}
.mat-mdc-extended-fab[disabled], .mat-mdc-extended-fab.mat-mdc-button-disabled {
  cursor: default;
  pointer-events: none;
}
.mat-mdc-extended-fab[disabled], .mat-mdc-extended-fab[disabled]:focus, .mat-mdc-extended-fab.mat-mdc-button-disabled, .mat-mdc-extended-fab.mat-mdc-button-disabled:focus {
  box-shadow: none;
}
.mat-mdc-extended-fab.mat-mdc-button-disabled-interactive {
  pointer-events: auto;
}
[dir=rtl] .mat-mdc-extended-fab .mdc-button__label + .mat-icon, [dir=rtl] .mat-mdc-extended-fab .mdc-button__label + .material-icons,
.mat-mdc-extended-fab > .mat-icon,
.mat-mdc-extended-fab > .material-icons {
  margin-left: -8px;
  margin-right: 12px;
}
.mat-mdc-extended-fab .mdc-button__label + .mat-icon,
.mat-mdc-extended-fab .mdc-button__label + .material-icons, [dir=rtl] .mat-mdc-extended-fab > .mat-icon, [dir=rtl] .mat-mdc-extended-fab > .material-icons {
  margin-left: 12px;
  margin-right: -8px;
}
.mat-mdc-extended-fab .mat-mdc-button-touch-target {
  width: 100%;
}
`],encapsulation:2,changeDetection:0})}return t})(),Fh=(()=>{class t extends gt{_options=c(Eo,{optional:!0});_isFab=!0;constructor(){super(),this._options=this._options||bt,this.color=this._options.color||bt.color}static \u0275fac=function(n){return new(n||t)};static \u0275cmp=$({type:t,selectors:[["button","mat-mini-fab",""],["a","mat-mini-fab",""],["button","matMiniFab",""],["a","matMiniFab",""]],hostAttrs:[1,"mdc-fab","mat-mdc-fab-base","mdc-fab--mini","mat-mdc-mini-fab"],exportAs:["matButton","matAnchor"],features:[ke],attrs:Hs,ngContentSelectors:dr,decls:7,vars:4,consts:[[1,"mat-mdc-button-persistent-ripple"],[1,"mdc-button__label"],[1,"mat-focus-indicator"],[1,"mat-mdc-button-touch-target"]],template:function(n,i){n&1&&(he(ur),ie(0,"span",0),V(1),Mt(2,"span",1),V(3,1),Ft(),V(4,2),ie(5,"span",2)(6,"span",3)),n&2&&ee("mdc-button__ripple",!i._isFab)("mdc-fab__ripple",i._isFab)},styles:[Vs],encapsulation:2,changeDetection:0})}return t})();var xh=(()=>{class t{static \u0275fac=function(n){return new(n||t)};static \u0275mod=L({type:t});static \u0275inj=N({imports:[_o,We]})}return t})();function wo(t){return Error(`Unable to find icon with the name "${t}"`)}function Ws(){return Error("Could not find HttpClient for use with Angular Material icons. Please add provideHttpClient() to your providers.")}function Ao(t){return Error(`The URL provided to MatIconRegistry was not trusted as a resource URL via Angular's DomSanitizer. Attempted URL was "${t}".`)}function Co(t){return Error(`The literal provided to MatIconRegistry was not trusted as safe HTML by Angular's DomSanitizer. Attempted literal was "${t}".`)}var me=class{url;svgText;options;svgElement=null;constructor(r,e,n){this.url=r,this.svgText=e,this.options=n}},To=(()=>{class t{_httpClient;_sanitizer;_errorHandler;_document;_svgIconConfigs=new Map;_iconSetConfigs=new Map;_cachedIconsByUrl=new Map;_inProgressUrlFetches=new Map;_fontCssClassesByAlias=new Map;_resolvers=[];_defaultFontSetClass=["material-icons","mat-ligature-font"];constructor(e,n,i,o){this._httpClient=e,this._sanitizer=n,this._errorHandler=o,this._document=i}addSvgIcon(e,n,i){return this.addSvgIconInNamespace("",e,n,i)}addSvgIconLiteral(e,n,i){return this.addSvgIconLiteralInNamespace("",e,n,i)}addSvgIconInNamespace(e,n,i,o){return this._addSvgIconConfig(e,n,new me(i,null,o))}addSvgIconResolver(e){return this._resolvers.push(e),this}addSvgIconLiteralInNamespace(e,n,i,o){let a=this._sanitizer.sanitize(B.HTML,i);if(!a)throw Co(i);let s=Ae(a);return this._addSvgIconConfig(e,n,new me("",s,o))}addSvgIconSet(e,n){return this.addSvgIconSetInNamespace("",e,n)}addSvgIconSetLiteral(e,n){return this.addSvgIconSetLiteralInNamespace("",e,n)}addSvgIconSetInNamespace(e,n,i){return this._addSvgIconSetConfig(e,new me(n,null,i))}addSvgIconSetLiteralInNamespace(e,n,i){let o=this._sanitizer.sanitize(B.HTML,n);if(!o)throw Co(n);let a=Ae(o);return this._addSvgIconSetConfig(e,new me("",a,i))}registerFontClassAlias(e,n=e){return this._fontCssClassesByAlias.set(e,n),this}classNameForFontAlias(e){return this._fontCssClassesByAlias.get(e)||e}setDefaultFontSetClass(...e){return this._defaultFontSetClass=e,this}getDefaultFontSetClass(){return this._defaultFontSetClass}getSvgIconFromUrl(e){let n=this._sanitizer.sanitize(B.RESOURCE_URL,e);if(!n)throw Ao(e);let i=this._cachedIconsByUrl.get(n);return i?q(hn(i)):this._loadSvgIconFromConfig(new me(e,null)).pipe(Fe(o=>this._cachedIconsByUrl.set(n,o)),O(o=>hn(o)))}getNamedSvgIcon(e,n=""){let i=Io(n,e),o=this._svgIconConfigs.get(i);if(o)return this._getSvgFromConfig(o);if(o=this._getIconConfigFromResolvers(n,e),o)return this._svgIconConfigs.set(i,o),this._getSvgFromConfig(o);let a=this._iconSetConfigs.get(n);return a?this._getSvgFromIconSetConfigs(e,a):mr(wo(i))}ngOnDestroy(){this._resolvers=[],this._svgIconConfigs.clear(),this._iconSetConfigs.clear(),this._cachedIconsByUrl.clear()}_getSvgFromConfig(e){return e.svgText?q(hn(this._svgElementFromConfig(e))):this._loadSvgIconFromConfig(e).pipe(O(n=>hn(n)))}_getSvgFromIconSetConfigs(e,n){let i=this._extractIconWithNameFromAnySet(e,n);if(i)return q(i);let o=n.filter(a=>!a.svgText).map(a=>this._loadSvgIconSetFromConfig(a).pipe(gr(s=>{let d=`Loading icon set URL: ${this._sanitizer.sanitize(B.RESOURCE_URL,a.url)} failed: ${s.message}`;return this._errorHandler.handleError(new Error(d)),q(null)})));return pr(o).pipe(O(()=>{let a=this._extractIconWithNameFromAnySet(e,n);if(!a)throw wo(e);return a}))}_extractIconWithNameFromAnySet(e,n){for(let i=n.length-1;i>=0;i--){let o=n[i];if(o.svgText&&o.svgText.toString().indexOf(e)>-1){let a=this._svgElementFromConfig(o),s=this._extractSvgIconFromSet(a,e,o.options);if(s)return s}}return null}_loadSvgIconFromConfig(e){return this._fetchIcon(e).pipe(Fe(n=>e.svgText=n),O(()=>this._svgElementFromConfig(e)))}_loadSvgIconSetFromConfig(e){return e.svgText?q(null):this._fetchIcon(e).pipe(Fe(n=>e.svgText=n))}_extractSvgIconFromSet(e,n,i){let o=e.querySelector(`[id="${n}"]`);if(!o)return null;let a=o.cloneNode(!0);if(a.removeAttribute("id"),a.nodeName.toLowerCase()==="svg")return this._setSvgAttributes(a,i);if(a.nodeName.toLowerCase()==="symbol")return this._setSvgAttributes(this._toSvgElement(a),i);let s=this._svgElementFromString(Ae("<svg></svg>"));return s.appendChild(a),this._setSvgAttributes(s,i)}_svgElementFromString(e){let n=this._document.createElement("DIV");n.innerHTML=e;let i=n.querySelector("svg");if(!i)throw Error("<svg> tag not found");return i}_toSvgElement(e){let n=this._svgElementFromString(Ae("<svg></svg>")),i=e.attributes;for(let o=0;o<i.length;o++){let{name:a,value:s}=i[o];a!=="id"&&n.setAttribute(a,s)}for(let o=0;o<e.childNodes.length;o++)e.childNodes[o].nodeType===this._document.ELEMENT_NODE&&n.appendChild(e.childNodes[o].cloneNode(!0));return n}_setSvgAttributes(e,n){return e.setAttribute("fit",""),e.setAttribute("height","100%"),e.setAttribute("width","100%"),e.setAttribute("preserveAspectRatio","xMidYMid meet"),e.setAttribute("focusable","false"),n&&n.viewBox&&e.setAttribute("viewBox",n.viewBox),e}_fetchIcon(e){let{url:n,options:i}=e,o=i?.withCredentials??!1;if(!this._httpClient)throw Ws();if(n==null)throw Error(`Cannot fetch icon from URL "${n}".`);let a=this._sanitizer.sanitize(B.RESOURCE_URL,n);if(!a)throw Ao(n);let s=this._inProgressUrlFetches.get(a);if(s)return s;let u=this._httpClient.get(a,{responseType:"text",withCredentials:o}).pipe(O(d=>Ae(d)),Dt(()=>this._inProgressUrlFetches.delete(a)),yr());return this._inProgressUrlFetches.set(a,u),u}_addSvgIconConfig(e,n,i){return this._svgIconConfigs.set(Io(e,n),i),this}_addSvgIconSetConfig(e,n){let i=this._iconSetConfigs.get(e);return i?i.push(n):this._iconSetConfigs.set(e,[n]),this}_svgElementFromConfig(e){if(!e.svgElement){let n=this._svgElementFromString(e.svgText);this._setSvgAttributes(n,e.options),e.svgElement=n}return e.svgElement}_getIconConfigFromResolvers(e,n){for(let i=0;i<this._resolvers.length;i++){let o=this._resolvers[i](n,e);if(o)return Ks(o)?new me(o.url,null,o.options):new me(o,null)}}static \u0275fac=function(n){return new(n||t)(h(en,8),h(ct),h(b,8),h(ye))};static \u0275prov=m({token:t,factory:t.\u0275fac,providedIn:"root"})}return t})();function hn(t){return t.cloneNode(!0)}function Io(t,r){return t+":"+r}function Ks(t){return!!(t.url&&t.options)}var Zs=["*"],Ys=new p("MAT_ICON_DEFAULT_OPTIONS"),Xs=new p("mat-icon-location",{providedIn:"root",factory:()=>{let t=c(b),r=t?t.location:null;return{getPathname:()=>r?r.pathname+r.search:""}}}),So=["clip-path","color-profile","src","cursor","fill","filter","marker","marker-start","marker-mid","marker-end","mask","stroke"],Js=So.map(t=>`[${t}]`).join(", "),qs=/^url\(['"]?#(.*?)['"]?\)$/,Jh=(()=>{class t{_elementRef=c(U);_iconRegistry=c(To);_location=c(Xs);_errorHandler=c(ye);_defaultColor;get color(){return this._color||this._defaultColor}set color(e){this._color=e}_color;inline=!1;get svgIcon(){return this._svgIcon}set svgIcon(e){e!==this._svgIcon&&(e?this._updateSvgIcon(e):this._svgIcon&&this._clearSvgElement(),this._svgIcon=e)}_svgIcon;get fontSet(){return this._fontSet}set fontSet(e){let n=this._cleanupFontValue(e);n!==this._fontSet&&(this._fontSet=n,this._updateFontIconClasses())}_fontSet;get fontIcon(){return this._fontIcon}set fontIcon(e){let n=this._cleanupFontValue(e);n!==this._fontIcon&&(this._fontIcon=n,this._updateFontIconClasses())}_fontIcon;_previousFontSetClass=[];_previousFontIconClass;_svgName=null;_svgNamespace=null;_previousPath;_elementsWithExternalReferences;_currentIconFetch=yt.EMPTY;constructor(){let e=c(new Br("aria-hidden"),{optional:!0}),n=c(Ys,{optional:!0});n&&(n.color&&(this.color=this._defaultColor=n.color),n.fontSet&&(this.fontSet=n.fontSet)),e||this._elementRef.nativeElement.setAttribute("aria-hidden","true")}_splitIconName(e){if(!e)return["",""];let n=e.split(":");switch(n.length){case 1:return["",n[0]];case 2:return n;default:throw Error(`Invalid icon name: "${e}"`)}}ngOnInit(){this._updateFontIconClasses()}ngAfterViewChecked(){let e=this._elementsWithExternalReferences;if(e&&e.size){let n=this._location.getPathname();n!==this._previousPath&&(this._previousPath=n,this._prependPathToReferences(n))}}ngOnDestroy(){this._currentIconFetch.unsubscribe(),this._elementsWithExternalReferences&&this._elementsWithExternalReferences.clear()}_usingFontIcon(){return!this.svgIcon}_setSvgElement(e){this._clearSvgElement();let n=this._location.getPathname();this._previousPath=n,this._cacheChildrenWithExternalReferences(e),this._prependPathToReferences(n),this._elementRef.nativeElement.appendChild(e)}_clearSvgElement(){let e=this._elementRef.nativeElement,n=e.childNodes.length;for(this._elementsWithExternalReferences&&this._elementsWithExternalReferences.clear();n--;){let i=e.childNodes[n];(i.nodeType!==1||i.nodeName.toLowerCase()==="svg")&&i.remove()}}_updateFontIconClasses(){if(!this._usingFontIcon())return;let e=this._elementRef.nativeElement,n=(this.fontSet?this._iconRegistry.classNameForFontAlias(this.fontSet).split(/ +/):this._iconRegistry.getDefaultFontSetClass()).filter(i=>i.length>0);this._previousFontSetClass.forEach(i=>e.classList.remove(i)),n.forEach(i=>e.classList.add(i)),this._previousFontSetClass=n,this.fontIcon!==this._previousFontIconClass&&!n.includes("mat-ligature-font")&&(this._previousFontIconClass&&e.classList.remove(this._previousFontIconClass),this.fontIcon&&e.classList.add(this.fontIcon),this._previousFontIconClass=this.fontIcon)}_cleanupFontValue(e){return typeof e=="string"?e.trim().split(" ")[0]:e}_prependPathToReferences(e){let n=this._elementsWithExternalReferences;n&&n.forEach((i,o)=>{i.forEach(a=>{o.setAttribute(a.name,`url('${e}#${a.value}')`)})})}_cacheChildrenWithExternalReferences(e){let n=e.querySelectorAll(Js),i=this._elementsWithExternalReferences=this._elementsWithExternalReferences||new Map;for(let o=0;o<n.length;o++)So.forEach(a=>{let s=n[o],u=s.getAttribute(a),d=u?u.match(qs):null;if(d){let l=i.get(s);l||(l=[],i.set(s,l)),l.push({name:a,value:d[1]})}})}_updateSvgIcon(e){if(this._svgNamespace=null,this._svgName=null,this._currentIconFetch.unsubscribe(),e){let[n,i]=this._splitIconName(e);n&&(this._svgNamespace=n),i&&(this._svgName=i),this._currentIconFetch=this._iconRegistry.getNamedSvgIcon(i,n).pipe(_t(1)).subscribe(o=>this._setSvgElement(o),o=>{let a=`Error retrieving icon ${n}:${i}! ${o.message}`;this._errorHandler.handleError(new Error(a))})}}static \u0275fac=function(n){return new(n||t)};static \u0275cmp=$({type:t,selectors:[["mat-icon"]],hostAttrs:["role","img",1,"mat-icon","notranslate"],hostVars:10,hostBindings:function(n,i){n&2&&(Xe("data-mat-icon-type",i._usingFontIcon()?"font":"svg")("data-mat-icon-name",i._svgName||i.fontIcon)("data-mat-icon-namespace",i._svgNamespace||i.fontSet)("fontIcon",i._usingFontIcon()?i.fontIcon:null),xt(i.color?"mat-"+i.color:""),ee("mat-icon-inline",i.inline)("mat-icon-no-color",i.color!=="primary"&&i.color!=="accent"&&i.color!=="warn"))},inputs:{color:"color",inline:[2,"inline","inline",Z],svgIcon:"svgIcon",fontSet:"fontSet",fontIcon:"fontIcon"},exportAs:["matIcon"],ngContentSelectors:Zs,decls:1,vars:0,template:function(n,i){n&1&&(he(),V(0))},styles:[`mat-icon, mat-icon.mat-primary, mat-icon.mat-accent, mat-icon.mat-warn {
  color: var(--mat-icon-color, inherit);
}

.mat-icon {
  -webkit-user-select: none;
  user-select: none;
  background-repeat: no-repeat;
  display: inline-block;
  fill: currentColor;
  height: 24px;
  width: 24px;
  overflow: hidden;
}
.mat-icon.mat-icon-inline {
  font-size: inherit;
  height: inherit;
  line-height: inherit;
  width: inherit;
}
.mat-icon.mat-ligature-font[fontIcon]::before {
  content: attr(fontIcon);
}

[dir=rtl] .mat-icon-rtl-mirror {
  transform: scale(-1, 1);
}

.mat-form-field:not(.mat-form-field-appearance-legacy) .mat-form-field-prefix .mat-icon,
.mat-form-field:not(.mat-form-field-appearance-legacy) .mat-form-field-suffix .mat-icon {
  display: block;
}
.mat-form-field:not(.mat-form-field-appearance-legacy) .mat-form-field-prefix .mat-icon-button .mat-icon,
.mat-form-field:not(.mat-form-field-appearance-legacy) .mat-form-field-suffix .mat-icon-button .mat-icon {
  margin: auto;
}
`],encapsulation:2,changeDetection:0})}return t})(),qh=(()=>{class t{static \u0275fac=function(n){return new(n||t)};static \u0275mod=L({type:t});static \u0275inj=N({imports:[We]})}return t})();export{ce as a,Mo as b,Be as c,Wr as d,Kr as e,No as f,li as g,ra as h,ia as i,aa as j,sa as k,pi as l,Su as m,Bn as n,Ta as o,de as p,en as q,Qa as r,es as s,rl as t,js as u,We as v,is as w,re as x,j as y,Kn as z,ae as A,nn as B,os as C,le as D,an as E,Yn as F,sn as G,Xn as H,im as I,Yi as J,Qi as K,_s as L,Es as M,ws as N,io as O,qn as P,Qn as Q,tr as R,Cs as S,Is as T,nf as U,Tf as V,Mf as W,ft as X,lf as Y,mf as Z,hf as _,gf as $,Df as aa,Ss as ba,Ge as ca,pt as da,ar as ea,Hf as fa,go as ga,bo as ha,ks as ia,_o as ja,Sh as ka,Mh as la,Fh as ma,xh as na,Jh as oa,qh as pa};

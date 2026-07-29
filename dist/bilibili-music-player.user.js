// ==UserScript==
// @name         Bilibili 音乐播放器
// @namespace    bilibili-music-player
// @version      0.1.0
// @author       Korltex
// @description  在 Bilibili 视频页面中控制原生播放器、管理音乐歌单并可选纯音频模式
// @license      MIT
// @match        https://www.bilibili.com/video/*
// @grant        GM_addValueChangeListener
// @grant        GM_getValue
// @grant        GM_removeValueChangeListener
// @grant        GM_setValue
// @grant        unsafeWindow
// @run-at       document-start
// @noframes
// ==/UserScript==

/*
* Bundled third-party libraries:
* - Preact 10.29.7: https://github.com/preactjs/preact
* - @preact/signals 2.10.0: https://github.com/preactjs/signals
* - lucide-preact 1.27.0: https://github.com/lucide-icons/lucide
*/
(function() {
	"use strict";
	var n$1;
	var l$3;
	var u$3;
	var t$2;
	var i$3;
	var r$2;
	var o$2;
	var e$2;
	var f$3;
	var c$2;
	var a$2;
	var s$2;
	var h$3;
	var p$3;
	var v$2;
	var y$3;
	var d$3 = {};
	var w$3 = [];
	var _$2 = /acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i;
	var g$2 = Array.isArray;
	function m$2(n, l) {
		for (var u in l) n[u] = l[u];
		return n;
	}
	function b$2(n) {
		n && n.parentNode && n.parentNode.removeChild(n);
	}
	function k$1(l, u, t) {
		var i, r, o, e = {};
		for (o in u) "key" == o ? i = u[o] : "ref" == o ? r = u[o] : e[o] = u[o];
		if (arguments.length > 2 && (e.children = arguments.length > 3 ? n$1.call(arguments, 2) : t), "function" == typeof l && null != l.defaultProps) for (o in l.defaultProps) void 0 === e[o] && (e[o] = l.defaultProps[o]);
		return x$3(l, e, i, r, null);
	}
	function x$3(n, t, i, r, o) {
		var e = {
			type: n,
			props: t,
			key: i,
			ref: r,
			__k: null,
			__: null,
			__b: 0,
			__e: null,
			__c: null,
			constructor: void 0,
			__v: null == o ? ++u$3 : o,
			__i: -1,
			__u: 0
		};
		return null == o && null != l$3.vnode && l$3.vnode(e), e;
	}
	function S$1(n) {
		return n.children;
	}
	function C$1(n, l) {
		this.props = n, this.context = l;
	}
	function $(n, l) {
		if (null == l) return n.__ ? $(n.__, n.__i + 1) : null;
		for (var u; l < n.__k.length; l++) if (null != (u = n.__k[l]) && null != u.__e) return u.__e;
		return "function" == typeof n.type ? $(n) : null;
	}
	function I(n) {
		if (n.__P && n.__d) {
			var u = n.__v, t = u.__e, i = [], r = [], o = m$2({}, u);
			o.__v = u.__v + 1, l$3.vnode && l$3.vnode(o), q$1(n.__P, o, u, n.__n, n.__P.namespaceURI, 32 & u.__u ? [t] : null, i, null == t ? $(u) : t, !!(32 & u.__u), r), o.__v = u.__v, o.__.__k[o.__i] = o, D$1(i, o, r), u.__e = u.__ = null, o.__e != t && P(o);
		}
	}
	function P(n) {
		if (null != (n = n.__) && null != n.__c) return n.__e = n.__c.base = null, n.__k.some(function(l) {
			if (null != l && null != l.__e) return n.__e = n.__c.base = l.__e;
		}), P(n);
	}
	function A(n) {
		(!n.__d && (n.__d = !0) && i$3.push(n) && !H.__r++ || r$2 != l$3.debounceRendering) && ((r$2 = l$3.debounceRendering) || o$2)(H);
	}
	function H() {
		try {
			for (var n, l = 1; i$3.length;) i$3.length > l && i$3.sort(e$2), n = i$3.shift(), l = i$3.length, I(n);
		} finally {
			i$3.length = H.__r = 0;
		}
	}
	function L(n, l, u, t, i, r, o, e, f, c, a) {
		var s, h, p, v, y, _, g, m = t && t.__k || w$3, b = l.length;
		for (f = T$1(u, l, m, f, b), s = 0; s < b; s++) null != (p = u.__k[s]) && (h = -1 != p.__i && m[p.__i] || d$3, p.__i = s, _ = q$1(n, p, h, i, r, o, e, f, c, a), v = p.__e, p.ref && h.ref != p.ref && (h.ref && J(h.ref, null, p), a.push(p.ref, p.__c || v, p)), null == y && null != v && (y = v), (g = !!(4 & p.__u)) || h.__k === p.__k ? (f = j$2(p, f, n, g), g && h.__e && (h.__e = null)) : "function" == typeof p.type && void 0 !== _ ? f = _ : v && (f = v.nextSibling), p.__u &= -7);
		return u.__e = y, f;
	}
	function T$1(n, l, u, t, i) {
		var r, o, e, f, c, a = u.length, s = a, h = 0;
		for (n.__k = new Array(i), r = 0; r < i; r++) null != (o = l[r]) && "boolean" != typeof o && "function" != typeof o ? ("string" == typeof o || "number" == typeof o || "bigint" == typeof o || o.constructor == String ? o = n.__k[r] = x$3(null, o, null, null, null) : g$2(o) ? o = n.__k[r] = x$3(S$1, { children: o }, null, null, null) : void 0 === o.constructor && o.__b > 0 ? o = n.__k[r] = x$3(o.type, o.props, o.key, o.ref ? o.ref : null, o.__v) : n.__k[r] = o, f = r + h, o.__ = n, o.__b = n.__b + 1, e = null, -1 != (c = o.__i = O(o, u, f, s)) && (s--, (e = u[c]) && (e.__u |= 2)), null == e || null == e.__v ? (-1 == c && (i > a ? h-- : i < a && h++), "function" != typeof o.type && (o.__u |= 4)) : c != f && (c == f - 1 ? h-- : c == f + 1 ? h++ : (c > f ? h-- : h++, o.__u |= 4))) : n.__k[r] = null;
		if (s) for (r = 0; r < a; r++) null != (e = u[r]) && 0 == (2 & e.__u) && (e.__e == t && (t = $(e)), K(e, e));
		return t;
	}
	function j$2(n, l, u, t) {
		var i, r;
		if ("function" == typeof n.type) {
			for (i = n.__k, r = 0; i && r < i.length; r++) i[r] && (i[r].__ = n, l = j$2(i[r], l, u, t));
			return l;
		}
		n.__e != l && (t && (l && n.type && !l.parentNode && (l = $(n)), u.insertBefore(n.__e, l || null)), l = n.__e);
		do
			l = l && l.nextSibling;
		while (null != l && 8 == l.nodeType);
		return l;
	}
	function F$1(n, l) {
		return l = l || [], null == n || "boolean" == typeof n || (g$2(n) ? n.some(function(n) {
			F$1(n, l);
		}) : l.push(n)), l;
	}
	function O(n, l, u, t) {
		var i, r, o, e = n.key, f = n.type, c = l[u], a = null != c && 0 == (2 & c.__u);
		if (null === c && null == e || a && e == c.key && f == c.type) return u;
		if (t > (a ? 1 : 0)) {
			for (i = u - 1, r = u + 1; i >= 0 || r < l.length;) if (null != (c = l[o = i >= 0 ? i-- : r++]) && 0 == (2 & c.__u) && e == c.key && f == c.type) return o;
		}
		return -1;
	}
	function z$1(n, l, u) {
		"-" == l[0] ? n.setProperty(l, null == u ? "" : u) : n[l] = null == u ? "" : "number" != typeof u || _$2.test(l) ? u : u + "px";
	}
	function N(n, l, u, t, i) {
		var r, o;
		n: if ("style" == l) if ("string" == typeof u) n.style.cssText = u;
		else {
			if ("string" == typeof t && (n.style.cssText = t = ""), t) for (l in t) u && l in u || z$1(n.style, l, "");
			if (u) for (l in u) t && u[l] == t[l] || z$1(n.style, l, u[l]);
		}
		else if ("o" == l[0] && "n" == l[1]) r = l != (l = l.replace(s$2, "$1")), o = l.toLowerCase(), l = o in n || "onFocusOut" == l || "onFocusIn" == l ? o.slice(2) : l.slice(2), n.l || (n.l = {}), n.l[l + r] = u, u ? t ? u[a$2] = t[a$2] : (u[a$2] = h$3, n.addEventListener(l, r ? v$2 : p$3, r)) : n.removeEventListener(l, r ? v$2 : p$3, r);
		else {
			if ("http://www.w3.org/2000/svg" == i) l = l.replace(/xlink(H|:h)/, "h").replace(/sName$/, "s");
			else if ("width" != l && "height" != l && "href" != l && "list" != l && "form" != l && "tabIndex" != l && "download" != l && "rowSpan" != l && "colSpan" != l && "role" != l && "popover" != l && l in n) try {
				n[l] = null == u ? "" : u;
				break n;
			} catch (n) {}
			"function" == typeof u || (null == u || !1 === u && "-" != l[4] ? n.removeAttribute(l) : n.setAttribute(l, "popover" == l && 1 == u ? "" : u));
		}
	}
	function V(n) {
		return function(u) {
			if (this.l) {
				var t = this.l[u.type + n];
				if (null == u[c$2]) u[c$2] = h$3++;
				else if (u[c$2] < t[a$2]) return;
				return t(l$3.event ? l$3.event(u) : u);
			}
		};
	}
	function q$1(n, u, t, i, r, o, e, f, c, a) {
		var s, h, p, v, y, d, _, k, x, M, $, I, P, A, H, T, j = u.type;
		if (void 0 !== u.constructor) return null;
		128 & t.__u && (c = !!(32 & t.__u), o = [f = u.__e = t.__e]), (s = l$3.__b) && s(u);
		n: if ("function" == typeof j) {
			h = e.length;
			try {
				if (x = u.props, M = j.prototype && j.prototype.render, $ = (s = j.contextType) && i[s.__c], I = s ? $ ? $.props.value : s.__ : i, t.__c ? k = (p = u.__c = t.__c).__ = p.__E : (M ? u.__c = p = new j(x, I) : (u.__c = p = new C$1(x, I), p.constructor = j, p.render = Q), $ && $.sub(p), p.state || (p.state = {}), p.__n = i, v = p.__d = !0, p.__h = [], p._sb = []), M && null == p.__s && (p.__s = p.state), M && null != j.getDerivedStateFromProps && (p.__s == p.state && (p.__s = m$2({}, p.__s)), m$2(p.__s, j.getDerivedStateFromProps(x, p.__s))), y = p.props, d = p.state, p.__v = u, v) M && null == j.getDerivedStateFromProps && null != p.componentWillMount && p.componentWillMount(), M && null != p.componentDidMount && p.__h.push(p.componentDidMount);
				else {
					if (M && null == j.getDerivedStateFromProps && x !== y && null != p.componentWillReceiveProps && p.componentWillReceiveProps(x, I), u.__v == t.__v || !p.__e && null != p.shouldComponentUpdate && !1 === p.shouldComponentUpdate(x, p.__s, I)) {
						u.__v != t.__v && (p.props = x, p.state = p.__s, p.__d = !1), u.__e = t.__e, u.__k = t.__k, u.__k.some(function(n) {
							n && (n.__ = u);
						}), w$3.push.apply(p.__h, p._sb), p._sb = [], p.__h.length && e.push(p);
						break n;
					}
					null != p.componentWillUpdate && p.componentWillUpdate(x, p.__s, I), M && null != p.componentDidUpdate && p.__h.push(function() {
						p.componentDidUpdate(y, d, _);
					});
				}
				if (p.context = I, p.props = x, p.__P = n, p.__e = !1, P = l$3.__r, A = 0, M) p.state = p.__s, p.__d = !1, P && P(u), s = p.render(p.props, p.state, p.context), w$3.push.apply(p.__h, p._sb), p._sb = [];
				else do
					p.__d = !1, P && P(u), s = p.render(p.props, p.state, p.context), p.state = p.__s;
				while (p.__d && ++A < 25);
				p.state = p.__s, null != p.getChildContext && (i = m$2(m$2({}, i), p.getChildContext())), M && !v && null != p.getSnapshotBeforeUpdate && (_ = p.getSnapshotBeforeUpdate(y, d)), H = null != s && s.type === S$1 && null == s.key ? E$1(s.props.children) : s, f = L(n, g$2(H) ? H : [H], u, t, i, r, o, e, f, c, a), p.base = u.__e, u.__u &= -161, p.__h.length && e.push(p), k && (p.__E = p.__ = null);
			} catch (n) {
				if (e.length = h, u.__v = null, c || null != o) {
					if (n.then) {
						for (u.__u |= c ? 160 : 128; f && 8 == f.nodeType && f.nextSibling;) f = f.nextSibling;
						null != o && (o[o.indexOf(f)] = null), u.__e = f;
					} else if (null != o) for (T = o.length; T--;) b$2(o[T]);
				} else u.__e = t.__e;
				u.__k ??= t.__k || [], n.then || B$1(u), l$3.__e(n, u, t);
			}
		} else null == o && u.__v == t.__v ? (u.__k = t.__k, u.__e = t.__e) : f = u.__e = G(t.__e, u, t, i, r, o, e, c, a);
		return (s = l$3.diffed) && s(u), 128 & u.__u ? void 0 : f;
	}
	function B$1(n) {
		n && (n.__c && (n.__c.__e = !0), n.__k && n.__k.some(B$1));
	}
	function D$1(n, u, t) {
		for (var i = 0; i < t.length; i++) J(t[i], t[++i], t[++i]);
		l$3.__c && l$3.__c(u, n), n.some(function(u) {
			try {
				n = u.__h, u.__h = [], n.some(function(n) {
					n.call(u);
				});
			} catch (n) {
				l$3.__e(n, u.__v);
			}
		});
	}
	function E$1(n) {
		return "object" != typeof n || null == n || n.__b > 0 ? n : g$2(n) ? n.map(E$1) : void 0 !== n.constructor ? null : m$2({}, n);
	}
	function G(u, t, i, r, o, e, f, c, a) {
		var s, h, p, v, y, w, _, m = i.props || d$3, k = t.props, x = t.type;
		if ("svg" == x ? o = "http://www.w3.org/2000/svg" : "math" == x ? o = "http://www.w3.org/1998/Math/MathML" : o || (o = "http://www.w3.org/1999/xhtml"), null != e) {
			for (s = 0; s < e.length; s++) if ((y = e[s]) && "setAttribute" in y == !!x && (x ? y.localName == x : 3 == y.nodeType)) {
				u = y, e[s] = null;
				break;
			}
		}
		if (null == u) {
			if (null == x) return document.createTextNode(k);
			u = document.createElementNS(o, x, k.is && k), c && (l$3.__m && l$3.__m(t, e), c = !1), e = null;
		}
		if (null == x) m === k || c && u.data == k || (u.data = k);
		else {
			if (e = "textarea" == x && null != k.defaultValue ? null : e && n$1.call(u.childNodes), !c && null != e) for (m = {}, s = 0; s < u.attributes.length; s++) m[(y = u.attributes[s]).name] = y.value;
			for (s in m) y = m[s], "dangerouslySetInnerHTML" == s ? p = y : "children" == s || s in k || "value" == s && "defaultValue" in k || "checked" == s && "defaultChecked" in k || N(u, s, null, y, o);
			for (s in k) y = k[s], "children" == s ? v = y : "dangerouslySetInnerHTML" == s ? h = y : "value" == s ? w = y : "checked" == s ? _ = y : c && "function" != typeof y || m[s] === y || N(u, s, y, m[s], o);
			if (h) c || p && (h.__html == p.__html || h.__html == u.innerHTML) || (u.innerHTML = h.__html), t.__k = [];
			else if (p && (u.innerHTML = ""), L("template" == t.type ? u.content : u, g$2(v) ? v : [v], t, i, r, "foreignObject" == x ? "http://www.w3.org/1999/xhtml" : o, e, f, e ? e[0] : i.__k && $(i, 0), c, a), null != e) for (s = e.length; s--;) b$2(e[s]);
			c && "textarea" != x || (s = "value", "progress" == x && null == w ? u.removeAttribute("value") : null != w && (w !== u[s] || "progress" == x && !w || "option" == x && w != m[s]) && N(u, s, w, m[s], o), s = "checked", null != _ && _ != u[s] && N(u, s, _, m[s], o));
		}
		return u;
	}
	function J(n, u, t) {
		try {
			if ("function" == typeof n) {
				var i = "function" == typeof n.__u;
				i && n.__u(), i && null == u || (n.__u = n(u));
			} else n.current = u;
		} catch (n) {
			l$3.__e(n, t);
		}
	}
	function K(n, u, t) {
		var i, r;
		if (l$3.unmount && l$3.unmount(n), (i = n.ref) && (i.current && i.current != n.__e || J(i, null, u)), null != (i = n.__c)) {
			if (i.componentWillUnmount) try {
				i.componentWillUnmount();
			} catch (n) {
				l$3.__e(n, u);
			}
			i.base = i.__P = i.__n = null;
		}
		if (i = n.__k) for (r = 0; r < i.length; r++) i[r] && K(i[r], u, t || "function" != typeof n.type);
		t || b$2(n.__e), n.__c = n.__ = n.__e = void 0;
	}
	function Q(n, l, u) {
		return this.constructor(n, u);
	}
	function R(u, t, i) {
		var r, o, e, f;
		t == document && (t = document.documentElement), l$3.__ && l$3.__(u, t), o = (r = "function" == typeof i) ? null : i && i.__k || t.__k, e = [], f = [], q$1(t, u = (!r && i || t).__k = k$1(S$1, null, [u]), o || d$3, d$3, t.namespaceURI, !r && i ? [i] : o ? null : t.firstChild ? n$1.call(t.childNodes) : null, e, !r && i ? i : o ? o.__e : t.firstChild, r, f), D$1(e, u, f), u.props.children = null;
	}
	function X$1(n) {
		function l(n) {
			var u, t;
			return this.getChildContext || (u = new Set(), (t = {})[l.__c] = this, this.getChildContext = function() {
				return t;
			}, this.componentWillUnmount = function() {
				u = null;
			}, this.shouldComponentUpdate = function(n) {
				this.props.value != n.value && u.forEach(function(n) {
					n.__e = !0, A(n);
				});
			}, this.sub = function(n) {
				u.add(n);
				var l = n.componentWillUnmount;
				n.componentWillUnmount = function() {
					u && u.delete(n), l && l.call(n);
				};
			}), n.children;
		}
		return l.__c = "__cC" + y$3++, l.__ = n, l.Provider = l.__l = (l.Consumer = function(n, l) {
			return n.children(l);
		}).contextType = l, l;
	}
	n$1 = w$3.slice, l$3 = { __e: function(n, l, u, t) {
		for (var i, r, o; l = l.__;) if ((i = l.__c) && !i.__) try {
			if ((r = i.constructor) && null != r.getDerivedStateFromError && (i.setState(r.getDerivedStateFromError(n)), o = i.__d), null != i.componentDidCatch && (i.componentDidCatch(n, t || {}), o = i.__d), o) return i.__E = i;
		} catch (l) {
			n = l;
		}
		throw n;
	} }, u$3 = 0, t$2 = function(n) {
		return null != n && void 0 === n.constructor;
	}, C$1.prototype.setState = function(n, l) {
		var u = null != this.__s && this.__s != this.state ? this.__s : this.__s = m$2({}, this.state);
		"function" == typeof n && (n = n(m$2({}, u), this.props)), n && m$2(u, n), null != n && this.__v && (l && this._sb.push(l), A(this));
	}, C$1.prototype.forceUpdate = function(n) {
		this.__v && (this.__e = !0, n && this.__h.push(n), A(this));
	}, C$1.prototype.render = S$1, i$3 = [], o$2 = "function" == typeof Promise ? Promise.prototype.then.bind(Promise.resolve()) : setTimeout, e$2 = function(n, l) {
		return n.__v.__b - l.__v.__b;
	}, H.__r = 0, f$3 = Math.random().toString(8), c$2 = "__d" + f$3, a$2 = "__a" + f$3, s$2 = /(PointerCapture)$|Capture$/i, h$3 = 0, p$3 = V(!1), v$2 = V(!0), y$3 = 0;
	var styles_default = ":host{all:initial;--lightningcss-light: ;--lightningcss-dark:initial;color-scheme:dark}:host([data-web-fullscreen]){display:none!important}*,:before,:after{box-sizing:border-box}button,input,select{font:inherit;letter-spacing:0}button{color:inherit}#bilibili-music-player-root{--bg:#17181c;--surface:#22242a;--surface-hover:#2a2d34;--border:#383b44;--text:#f4f4f5;--muted:#a8abb4;--accent:#fb7299;--accent-hover:#ff8bad;--cyan:#36c5b7;--danger:#ff6b6b;z-index:2147483647;pointer-events:none;color:var(--text);font-family:Inter,Segoe UI,Microsoft YaHei,system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.4;position:fixed;inset:0}.floating-button,.player-panel{pointer-events:auto}.floating-button{color:#fff;background:var(--accent);cursor:pointer;border:1px solid #ff9bb8;border-radius:50%;place-items:center;width:48px;height:48px;display:grid;position:fixed;bottom:76px;right:24px;box-shadow:0 10px 28px #0000004d}.player-panel{border:1px solid var(--border);background:var(--bg);border-radius:8px;flex-direction:column;width:min(400px,100vw - 24px);max-height:min(720px,100vh - 24px);display:flex;position:fixed;bottom:20px;right:20px;overflow:hidden;box-shadow:0 18px 60px #0000006b}.panel-header,.playlist-toolbar,.transport,.editor-heading,.inline-form{align-items:center;display:flex}.panel-header{border-bottom:1px solid var(--border);justify-content:space-between;min-height:48px;padding:0 12px 0 14px}.brand{align-items:center;gap:8px;min-width:0;display:flex}.brand-icon{color:#fff;background:var(--accent);border-radius:6px;place-items:center;width:26px;height:26px;display:grid}.brand strong{font-size:14px}.version{color:var(--muted);font-size:11px}.icon-button,.row-action{cursor:pointer;background:0 0;border:0;flex:none;place-items:center;display:inline-grid}.icon-button{width:34px;height:34px;color:var(--muted);border-radius:6px}.icon-button:hover:not(:disabled),.row-action:hover:not(:disabled){color:var(--text);background:var(--surface-hover)}.icon-button:disabled,.add-current-button:disabled,.current-time-button:disabled{cursor:not-allowed;opacity:.4}.icon-button.accent,.audio-mode-button.detecting{color:var(--accent)}.audio-mode-button.active{color:var(--cyan);background:#36c5b71f}.audio-mode-button.fallback{color:var(--danger);background:#ff6b6b1a}.danger:hover:not(:disabled){color:var(--danger)}.now-playing{align-items:center;gap:12px;min-height:82px;padding:12px 14px 8px;display:flex}.cover{border:1px solid var(--border);width:58px;height:58px;color:var(--cyan);background:var(--surface);border-radius:6px;flex:none;place-items:center;display:grid;overflow:hidden}.cover img{object-fit:cover;width:100%;height:100%}.now-playing-copy{flex-direction:column;gap:4px;min-width:0;display:flex}.now-playing-copy strong,.track-copy strong{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.now-playing-copy strong{font-size:15px}.now-playing-copy span,.track-copy span,.time-row,.track-duration{color:var(--muted);font-size:12px}.progress-area{padding:2px 14px 0}.range{width:100%;height:18px;accent-color:var(--accent);cursor:pointer;margin:0}.time-row{font-variant-numeric:tabular-nums;justify-content:space-between;margin-top:-2px;display:flex}.transport{justify-content:center;gap:7px;min-height:54px;padding:4px 12px 8px}.play-button{color:#fff;background:var(--accent);cursor:pointer;border:0;border-radius:50%;place-items:center;width:42px;height:42px;display:grid}.play-button:hover{background:var(--accent-hover)}.volume-control{align-items:center;width:92px;display:flex}.volume-range{width:56px}.status-message{border:1px solid var(--border);min-height:30px;color:var(--muted);background:var(--surface);text-align:left;border-radius:6px;margin:0 14px 8px;padding:5px 8px}.status-message.actionable{border-color:var(--accent);color:var(--text);cursor:pointer}.audio-only-status{cursor:default;align-items:center;display:flex}.audio-only-status.detecting{border-color:var(--accent)}.audio-only-status.active{border-color:var(--cyan);color:var(--text)}.audio-only-status.fallback{border-color:var(--danger);color:var(--text)}.playlist-toolbar{border-top:1px solid var(--border);border-bottom:1px solid var(--border);gap:5px;min-height:44px;padding:6px 10px 6px 14px}.playlist-toolbar select{border:1px solid var(--border);min-width:0;height:32px;color:var(--text);background:var(--surface);border-radius:6px;flex:1;padding:0 30px 0 9px}.inline-form{gap:6px;padding:8px 14px 0}.inline-form input,.track-editor input{border:1px solid var(--border);min-width:0;height:34px;color:var(--text);background:var(--surface);border-radius:6px;outline:none;padding:0 9px}.inline-form input{flex:1}.inline-form input:focus,.track-editor input:focus,.playlist-toolbar select:focus{border-color:var(--accent)}.add-current-button,.save-track-button,.current-time-button{cursor:pointer;border:0;border-radius:6px;justify-content:center;align-items:center;display:flex}.add-current-button{color:#fff;background:var(--accent);gap:7px;min-height:36px;margin:10px 14px}.add-current-button:hover:not(:disabled),.save-track-button:hover{background:var(--accent-hover)}.track-editor{border-top:1px solid var(--border);border-bottom:1px solid var(--border);background:#1c1e23;flex-direction:column;gap:8px;padding:10px 14px 12px;display:flex}.editor-heading{justify-content:space-between;min-height:28px}.track-editor label{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}.track-editor label>span{color:var(--muted);font-size:12px}.time-fields{align-items:flex-end;gap:6px;display:flex}.current-time-button{width:66px;height:34px;color:var(--text);background:var(--surface);flex:none;gap:4px}.editor-error{color:var(--danger);font-size:12px}.save-track-button{color:#fff;background:var(--accent);gap:6px;height:34px}.track-list{overscroll-behavior:contain;min-height:110px;overflow:hidden auto}.track-row{border-bottom:1px solid #383b44a6;grid-template-columns:minmax(0,1fr) 32px 32px;align-items:stretch;min-height:54px;display:grid}.track-row:hover{background:var(--surface)}.track-row.active{box-shadow:inset 3px 0 var(--accent);background:#25242a}.track-main{min-width:0;color:var(--text);text-align:left;cursor:pointer;background:0 0;border:0;grid-template-columns:32px minmax(0,1fr) auto;align-items:center;gap:7px;padding:7px 5px 7px 11px;display:grid}.track-index{width:28px;color:var(--muted);font-variant-numeric:tabular-nums;place-items:center;font-size:11px;display:grid}.track-row.active .track-index{color:var(--accent)}.track-copy{flex-direction:column;gap:2px;min-width:0;display:flex}.track-copy strong{font-size:13px}.track-duration{font-variant-numeric:tabular-nums;padding-left:6px}.row-action{width:32px;min-height:32px;color:var(--muted);border-radius:5px;align-self:center}.empty-state{min-height:118px;color:var(--muted);flex-direction:column;justify-content:center;align-items:center;gap:7px;display:flex}@media (width<=520px){.player-panel{max-height:calc(100vh - 24px);bottom:12px;right:12px}.floating-button{bottom:64px;right:16px}.volume-control{width:76px}.volume-range{width:42px}}";
	var _style = (b, a = document.createElement("style")) => (a.append(b), a);
	var styles_css_default = _style(styles_default);
	var t$1;
	var r$1;
	var u$2;
	var i$2;
	var o$1 = 0;
	var f$2 = [];
	var c$1 = l$3;
	var e$1 = c$1.__b;
	var a$1 = c$1.__r;
	var v$1 = c$1.diffed;
	var l$2 = c$1.__c;
	var m$1 = c$1.unmount;
	var p$2 = c$1.__;
	function s$1(n, t) {
		c$1.__h && c$1.__h(r$1, n, o$1 || t), o$1 = 0;
		var u = r$1.__H || (r$1.__H = {
			__: [],
			__h: []
		});
		return n >= u.__.length && u.__.push({}), u.__[n];
	}
	function d$2(n) {
		return o$1 = 1, y$2(D, n);
	}
	function y$2(n, u, i) {
		var o = s$1(t$1++, 2);
		if (o.t = n, !o.__c && (o.__ = [i ? i(u) : D(void 0, u), function(n) {
			var t = o.__N ? o.__N[0] : o.__[0], r = o.t(t, n);
			t !== r && (o.__N = [r, o.__[1]], o.__c.setState({}));
		}], o.__c = r$1, !r$1.__f)) {
			var f = function(n, t, r) {
				if (!o.__c.__H) return !0;
				var u = !1, i = o.__c.props !== n;
				if (o.__c.__H.__.some(function(n) {
					if (n.__N) {
						u = !0;
						var t = n.__[0];
						n.__ = n.__N, n.__N = void 0, t !== n.__[0] && (i = !0);
					}
				}), c) {
					var f = c.call(this, n, t, r);
					return u ? f || i : f;
				}
				return !u || i;
			};
			r$1.__f = !0;
			var c = r$1.shouldComponentUpdate, e = r$1.componentWillUpdate;
			r$1.componentWillUpdate = function(n, t, r) {
				if (this.__e) {
					var u = c;
					c = void 0, f(n, t, r), c = u;
				}
				e && e.call(this, n, t, r);
			}, r$1.shouldComponentUpdate = f;
		}
		return o.__N || o.__;
	}
	function h$2(n, u) {
		var i = s$1(t$1++, 3);
		!c$1.__s && C(i.__H, u) && (i.__ = n, i.u = u, r$1.__H.__h.push(i));
	}
	function T(n, r) {
		var u = s$1(t$1++, 7);
		return C(u.__H, r) && (u.__ = n(), u.__H = r, u.__h = n), u.__;
	}
	function x$2(n) {
		var u = r$1.context[n.__c], i = s$1(t$1++, 9);
		return i.c = n, u ? (i.__ ?? (i.__ = !0, u.sub(r$1)), u.props.value) : n.__;
	}
	function j$1() {
		for (var n; n = f$2.shift();) {
			var t = n.__H;
			if (n.__P && t) try {
				t.__h.some(z), t.__h.some(B), t.__h = [];
			} catch (r) {
				t.__h = [], c$1.__e(r, n.__v);
			}
		}
	}
	c$1.__b = function(n) {
		r$1 = null, e$1 && e$1(n);
	}, c$1.__ = function(n, t) {
		n && t.__k && t.__k.__m && (n.__m = t.__k.__m), p$2 && p$2(n, t);
	}, c$1.__r = function(n) {
		a$1 && a$1(n), t$1 = 0;
		var i = (r$1 = n.__c).__H;
		i && (u$2 === r$1 ? (i.__h = [], r$1.__h = [], i.__.some(function(n) {
			n.__N && (n.__ = n.__N), n.u = n.__N = void 0;
		})) : (i.__h.some(z), i.__h.some(B), i.__h = [], t$1 = 0)), u$2 = r$1;
	}, c$1.diffed = function(n) {
		v$1 && v$1(n);
		var t = n.__c;
		t && t.__H && (t.__H.__h.length && (1 !== f$2.push(t) && i$2 === c$1.requestAnimationFrame || ((i$2 = c$1.requestAnimationFrame) || w$2)(j$1)), t.__H.__.some(function(n) {
			n.u && (n.__H = n.u, n.u = void 0);
		})), u$2 = r$1 = null;
	}, c$1.__c = function(n, t) {
		t.some(function(n) {
			try {
				n.__h.some(z), n.__h = n.__h.filter(function(n) {
					return !n.__ || B(n);
				});
			} catch (r) {
				t.some(function(n) {
					n.__h && (n.__h = []);
				}), t = [], c$1.__e(r, n.__v);
			}
		}), l$2 && l$2(n, t);
	}, c$1.unmount = function(n) {
		m$1 && m$1(n);
		var t, r = n.__c;
		r && r.__H && (r.__H.__.some(function(n) {
			try {
				z(n);
			} catch (n) {
				t = n;
			}
		}), r.__H = void 0, t && c$1.__e(t, r.__v));
	};
	var k = "function" == typeof requestAnimationFrame;
	function w$2(n) {
		var t, r = function() {
			clearTimeout(u), k && cancelAnimationFrame(t), setTimeout(n);
		}, u = setTimeout(r, 35);
		k && (t = requestAnimationFrame(r));
	}
	function z(n) {
		var t = r$1, u = n.__c;
		"function" == typeof u && (n.__c = void 0, u()), r$1 = t;
	}
	function B(n) {
		var t = r$1;
		n.__c = n.__(), r$1 = t;
	}
	function C(n, t) {
		return !n || n.length !== t.length || t.some(function(t, r) {
			return t !== n[r];
		});
	}
	function D(n, t) {
		return "function" == typeof t ? t(n) : t;
	}
	var mergeClasses = (...classes) => classes.filter((className, index, array) => {
		return Boolean(className) && className.trim() !== "" && array.indexOf(className) === index;
	}).join(" ").trim();
	var toKebabCase = (string) => string.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
	var toCamelCase = (string) => string.replace(/^([A-Z])|[\s-_]+(\w)/g, (match, p1, p2) => p2 ? p2.toUpperCase() : p1.toLowerCase());
	var toPascalCase = (string) => {
		const camelCase = toCamelCase(string);
		return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
	};
	var defaultAttributes = {
		xmlns: "http://www.w3.org/2000/svg",
		width: 24,
		height: 24,
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		"stroke-width": "2",
		"stroke-linecap": "round",
		"stroke-linejoin": "round"
	};
	var LucideContext = X$1({
		size: 24,
		color: "currentColor",
		strokeWidth: 2,
		absoluteStrokeWidth: false,
		class: ""
	});
	var useLucideContext = () => x$2(LucideContext);
	var hasA11yProp = (props) => {
		for (const prop in props) if (prop.startsWith("aria-") || prop === "role" || prop === "title") return true;
		return false;
	};
	var Icon = ({ color, size, strokeWidth, absoluteStrokeWidth, children, iconNode, class: classes = "", ...rest }) => {
		const { size: contextSize = 24, strokeWidth: contextStrokeWidth = 2, absoluteStrokeWidth: contextAbsoluteStrokeWidth = false, color: contextColor = "currentColor", class: contextClass = "" } = useLucideContext() ?? {};
		const calculatedStrokeWidth = absoluteStrokeWidth ?? contextAbsoluteStrokeWidth ? Number(strokeWidth ?? contextStrokeWidth) * 24 / Number(size ?? contextSize) : strokeWidth ?? contextStrokeWidth;
		return k$1("svg", {
			...defaultAttributes,
			width: size ?? contextSize ?? 24,
			height: size ?? contextSize ?? 24,
			stroke: color ?? contextColor,
			["stroke-width"]: calculatedStrokeWidth,
			class: mergeClasses("lucide", contextClass, classes),
			...!children && !hasA11yProp(rest) && { "aria-hidden": "true" },
			...rest
		}, [...iconNode.map(([tag, attrs]) => k$1(tag, attrs)), ...F$1(children)]);
	};
	var createLucideIcon = (iconName, iconNode) => {
		const Component = ({ class: classes = "", className = "", children, ...props }) => k$1(Icon, {
			...props,
			iconNode,
			class: mergeClasses(`lucide-${toKebabCase(toPascalCase(iconName))}`, `lucide-${toKebabCase(iconName)}`, classes, className)
		}, children);
		Component.displayName = toPascalCase(iconName);
		return Component;
	};
	var Clock3 = createLucideIcon("clock-3", [["circle", {
		cx: "12",
		cy: "12",
		r: "10",
		key: "1mglay"
	}], ["path", {
		d: "M12 6v6h4",
		key: "135r8i"
	}]]);
	var Headphones = createLucideIcon("headphones", [["path", {
		d: "M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3",
		key: "1xhozi"
	}]]);
	var ListMusic = createLucideIcon("list-music", [
		["path", {
			d: "M16 5H3",
			key: "m91uny"
		}],
		["path", {
			d: "M11 12H3",
			key: "51ecnj"
		}],
		["path", {
			d: "M11 19H3",
			key: "zflm78"
		}],
		["path", {
			d: "M21 16V5",
			key: "yxg4q8"
		}],
		["circle", {
			cx: "18",
			cy: "16",
			r: "3",
			key: "1hluhg"
		}]
	]);
	var Music2 = createLucideIcon("music-2", [["circle", {
		cx: "8",
		cy: "18",
		r: "4",
		key: "1fc0mg"
	}], ["path", {
		d: "M12 18V2l7 4",
		key: "g04rme"
	}]]);
	var Pause = createLucideIcon("pause", [["rect", {
		x: "14",
		y: "3",
		width: "5",
		height: "18",
		rx: "1",
		key: "kaeet6"
	}], ["rect", {
		x: "5",
		y: "3",
		width: "5",
		height: "18",
		rx: "1",
		key: "1wsw3u"
	}]]);
	var Pencil = createLucideIcon("pencil", [["path", {
		d: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",
		key: "1a8usu"
	}], ["path", {
		d: "m15 5 4 4",
		key: "1mk7zo"
	}]]);
	var Play = createLucideIcon("play", [["path", {
		d: "M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z",
		key: "10ikf1"
	}]]);
	var Plus = createLucideIcon("plus", [["path", {
		d: "M5 12h14",
		key: "1ays0h"
	}], ["path", {
		d: "M12 5v14",
		key: "s699le"
	}]]);
	var Repeat1 = createLucideIcon("repeat-1", [
		["path", {
			d: "m17 2 4 4-4 4",
			key: "nntrym"
		}],
		["path", {
			d: "M3 11v-1a4 4 0 0 1 4-4h14",
			key: "84bu3i"
		}],
		["path", {
			d: "m7 22-4-4 4-4",
			key: "1wqhfi"
		}],
		["path", {
			d: "M21 13v1a4 4 0 0 1-4 4H3",
			key: "1rx37r"
		}],
		["path", {
			d: "M11 10h1v4",
			key: "70cz1p"
		}]
	]);
	var Repeat = createLucideIcon("repeat", [
		["path", {
			d: "m17 2 4 4-4 4",
			key: "nntrym"
		}],
		["path", {
			d: "M3 11v-1a4 4 0 0 1 4-4h14",
			key: "84bu3i"
		}],
		["path", {
			d: "m7 22-4-4 4-4",
			key: "1wqhfi"
		}],
		["path", {
			d: "M21 13v1a4 4 0 0 1-4 4H3",
			key: "1rx37r"
		}]
	]);
	var Save = createLucideIcon("save", [
		["path", {
			d: "M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",
			key: "1c8476"
		}],
		["path", {
			d: "M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7",
			key: "1ydtos"
		}],
		["path", {
			d: "M7 3v4a1 1 0 0 0 1 1h7",
			key: "t51u73"
		}]
	]);
	var Shuffle = createLucideIcon("shuffle", [
		["path", {
			d: "m18 14 4 4-4 4",
			key: "10pe0f"
		}],
		["path", {
			d: "m18 2 4 4-4 4",
			key: "pucp1d"
		}],
		["path", {
			d: "M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22",
			key: "1ailkh"
		}],
		["path", {
			d: "M2 6h1.972a4 4 0 0 1 3.6 2.2",
			key: "km57vx"
		}],
		["path", {
			d: "M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45",
			key: "os18l9"
		}]
	]);
	var SkipBack = createLucideIcon("skip-back", [["path", {
		d: "M17.971 4.285A2 2 0 0 1 21 6v12a2 2 0 0 1-3.029 1.715l-9.997-5.998a2 2 0 0 1-.003-3.432z",
		key: "15892j"
	}], ["path", {
		d: "M3 20V4",
		key: "1ptbpl"
	}]]);
	var SkipForward = createLucideIcon("skip-forward", [["path", {
		d: "M21 4v16",
		key: "7j8fe9"
	}], ["path", {
		d: "M6.029 4.285A2 2 0 0 0 3 6v12a2 2 0 0 0 3.029 1.715l9.997-5.998a2 2 0 0 0 .003-3.432z",
		key: "zs4d6"
	}]]);
	var Trash2 = createLucideIcon("trash-2", [
		["path", {
			d: "M10 11v6",
			key: "nco0om"
		}],
		["path", {
			d: "M14 11v6",
			key: "outv1u"
		}],
		["path", {
			d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",
			key: "miytrc"
		}],
		["path", {
			d: "M3 6h18",
			key: "d0wm0j"
		}],
		["path", {
			d: "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
			key: "e791ji"
		}]
	]);
	var Volume2 = createLucideIcon("volume-2", [
		["path", {
			d: "M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z",
			key: "uqj9uw"
		}],
		["path", {
			d: "M16 9a5 5 0 0 1 0 6",
			key: "1q6k2b"
		}],
		["path", {
			d: "M19.364 18.364a9 9 0 0 0 0-12.728",
			key: "ijwkga"
		}]
	]);
	var VolumeX = createLucideIcon("volume-x", [
		["path", {
			d: "M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z",
			key: "uqj9uw"
		}],
		["line", {
			x1: "22",
			x2: "16",
			y1: "9",
			y2: "15",
			key: "1ewh16"
		}],
		["line", {
			x1: "16",
			x2: "22",
			y1: "9",
			y2: "15",
			key: "5ykzw1"
		}]
	]);
	var X = createLucideIcon("x", [["path", {
		d: "M18 6 6 18",
		key: "1bl5f8"
	}], ["path", {
		d: "m6 6 12 12",
		key: "d8bk6v"
	}]]);
	function createId(prefix) {
		return `${prefix}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
	}
	function getBvid(url = location.href) {
		return new URL(url).pathname.match(/\/video\/(BV[\w]+)/i)?.[1];
	}
	function getPageNumber(url = location.href) {
		const page = Number(new URL(url).searchParams.get("p"));
		return Number.isInteger(page) && page > 1 ? page : void 0;
	}
	function readCurrentVideoMetadata() {
		const bvid = getBvid();
		if (!bvid) return;
		const titleElement = document.querySelector("h1.video-title, h1[title], .video-title");
		const rawTitle = titleElement?.getAttribute("title") ?? titleElement?.textContent ?? document.querySelector("meta[property=\"og:title\"]")?.getAttribute("content") ?? document.title;
		const uploader = document.querySelector(".up-name, .up-info-container .username, a.up-name, .members-info .staff-name")?.textContent?.trim() || void 0;
		const cover = document.querySelector("meta[property=\"og:image\"]")?.getAttribute("content") || void 0;
		return {
			bvid,
			page: getPageNumber(),
			title: cleanPageTitle(rawTitle),
			uploader,
			cover
		};
	}
	function createTrackFromCurrentPage(media, title, startTime, endTime) {
		const metadata = readCurrentVideoMetadata();
		if (!metadata) return;
		return {
			id: createId("track"),
			...metadata,
			title: title.trim() || metadata.title,
			startTime,
			endTime,
			duration: Number.isFinite(media.duration) ? media.duration : 0,
			addedAt: Date.now(),
			source: "manual"
		};
	}
	function cleanPageTitle(title) {
		return title.replace(/_哔哩哔哩_bilibili$/i, "").replace(/\s*-\s*哔哩哔哩.*$/i, "").trim();
	}
	function clamp(value, minimum, maximum) {
		return Math.min(maximum, Math.max(minimum, value));
	}
	function formatTime(value) {
		if (!Number.isFinite(value) || value < 0) return "00:00";
		const totalSeconds = Math.floor(value);
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor(totalSeconds % 3600 / 60);
		const seconds = totalSeconds % 60;
		if (hours > 0) return [
			hours,
			minutes,
			seconds
		].map((part) => String(part).padStart(2, "0")).join(":");
		return [minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
	}
	var f$1 = 0;
	Array.isArray;
	function u$1(e, t, n, o, i, u) {
		t || (t = {});
		var a, c, p = t;
		if ("ref" in p) for (c in p = {}, t) "ref" == c ? a = t[c] : p[c] = t[c];
		var l = {
			type: e,
			props: p,
			key: n,
			ref: a,
			__k: null,
			__: null,
			__b: 0,
			__e: null,
			__c: null,
			constructor: void 0,
			__v: --f$1,
			__i: -1,
			__u: 0,
			__source: i,
			__self: u
		};
		if ("function" == typeof e && (a = e.defaultProps)) for (c in a) void 0 === p[c] && (p[c] = a[c]);
		return l$3.vnode && l$3.vnode(l), l;
	}
	var PLAY_MODES = [
		"sequence",
		"list-loop",
		"single-loop",
		"shuffle"
	];
	var PLAY_MODE_LABELS = {
		sequence: "顺序播放",
		"list-loop": "列表循环",
		"single-loop": "单曲循环",
		shuffle: "随机播放"
	};
	function App({ store, engine, audioOnly }) {
		const [panelOpen, setPanelOpen] = d$2(false);
		const [creatingPlaylist, setCreatingPlaylist] = d$2(false);
		const [newPlaylistName, setNewPlaylistName] = d$2("");
		const [editorTrack, setEditorTrack] = d$2();
		const data = store.data.value;
		const runtime = engine.state.value;
		const audioOnlyState = audioOnly.state.value;
		const activePlaylist = data.playlists.find((playlist) => playlist.id === data.activePlaylistId) ?? data.playlists[0];
		const nowPlaying = runtime.nowPlaying;
		const progressMinimum = nowPlaying.startTime;
		const progressMaximum = nowPlaying.endTime ?? (runtime.duration > 0 ? runtime.duration : nowPlaying.storedDuration);
		const createPlaylist = (event) => {
			event.preventDefault();
			store.createPlaylist(newPlaylistName);
			setNewPlaylistName("");
			setCreatingPlaylist(false);
		};
		const cyclePlayMode = () => {
			const currentIndex = PLAY_MODES.indexOf(data.playMode);
			engine.setPlayMode(PLAY_MODES[(currentIndex + 1) % PLAY_MODES.length]);
		};
		if (!panelOpen) return u$1("button", {
			class: "floating-button",
			type: "button",
			title: "打开 Bilibili 音乐播放器",
			"aria-label": "打开 Bilibili 音乐播放器",
			onClick: () => setPanelOpen(true),
			children: u$1(Music2, {
				size: 22,
				"aria-hidden": "true"
			})
		});
		return u$1("section", {
			class: "player-panel",
			"aria-label": "Bilibili 音乐播放器",
			children: [
				u$1("header", {
					class: "panel-header",
					children: [u$1("div", {
						class: "brand",
						children: [
							u$1("span", {
								class: "brand-icon",
								children: u$1(Music2, {
									size: 18,
									"aria-hidden": "true"
								})
							}),
							u$1("strong", { children: "Bilibili 音乐播放器" }),
							u$1("span", {
								class: "version",
								children: "0.1.0"
							})
						]
					}), u$1("button", {
						class: "icon-button",
						type: "button",
						title: "收起播放器",
						"aria-label": "收起播放器",
						onClick: () => setPanelOpen(false),
						children: u$1(X, {
							size: 18,
							"aria-hidden": "true"
						})
					})]
				}),
				u$1("div", {
					class: "now-playing",
					children: [u$1("div", {
						class: "cover",
						children: nowPlaying.cover ? u$1("img", {
							src: nowPlaying.cover,
							alt: ""
						}) : u$1(Music2, {
							size: 28,
							"aria-hidden": "true"
						})
					}), u$1("div", {
						class: "now-playing-copy",
						children: [u$1("strong", {
							title: nowPlaying.title,
							children: nowPlaying.title
						}), u$1("span", { children: nowPlaying.uploader ?? (runtime.mediaReady ? "当前 Bilibili 视频" : "等待播放器") })]
					})]
				}),
				u$1("div", {
					class: "progress-area",
					children: [u$1("input", {
						class: "range progress-range",
						type: "range",
						min: progressMinimum,
						max: Math.max(progressMaximum, progressMinimum + 1),
						step: "0.1",
						value: Math.min(Math.max(runtime.currentTime, progressMinimum), Math.max(progressMaximum, progressMinimum + 1)),
						"aria-label": "播放进度",
						disabled: !runtime.mediaReady,
						onInput: (event) => engine.seek(Number(event.currentTarget.value))
					}), u$1("div", {
						class: "time-row",
						children: [u$1("span", { children: formatTime(runtime.currentTime) }), u$1("span", { children: formatTime(progressMaximum) })]
					})]
				}),
				u$1("div", {
					class: "transport",
					children: [
						u$1("button", {
							class: `icon-button audio-mode-button ${audioOnlyState.status}`,
							type: "button",
							title: audioOnlyButtonLabel(audioOnlyState),
							"aria-label": audioOnlyButtonLabel(audioOnlyState),
							"aria-pressed": audioOnlyState.requested,
							onClick: () => audioOnly.toggle(engine.currentMedia?.currentTime ?? runtime.currentTime),
							children: u$1(Headphones, {
								size: 19,
								"aria-hidden": "true"
							})
						}),
						u$1("button", {
							class: "icon-button",
							type: "button",
							title: PLAY_MODE_LABELS[data.playMode],
							"aria-label": PLAY_MODE_LABELS[data.playMode],
							onClick: cyclePlayMode,
							children: u$1(PlayModeIcon, { mode: data.playMode })
						}),
						u$1("button", {
							class: "icon-button",
							type: "button",
							title: "上一首",
							"aria-label": "上一首",
							onClick: () => engine.previous(),
							children: u$1(SkipBack, {
								size: 20,
								"aria-hidden": "true"
							})
						}),
						u$1("button", {
							class: "play-button",
							type: "button",
							title: runtime.playing ? "暂停" : "播放",
							"aria-label": runtime.playing ? "暂停" : "播放",
							onClick: () => void engine.togglePlayback(),
							children: runtime.playing ? u$1(Pause, {
								size: 22,
								fill: "currentColor",
								"aria-hidden": "true"
							}) : u$1(Play, {
								size: 22,
								fill: "currentColor",
								"aria-hidden": "true"
							})
						}),
						u$1("button", {
							class: "icon-button",
							type: "button",
							title: "下一首",
							"aria-label": "下一首",
							onClick: () => engine.next(),
							children: u$1(SkipForward, {
								size: 20,
								"aria-hidden": "true"
							})
						}),
						u$1("div", {
							class: "volume-control",
							children: [u$1("button", {
								class: "icon-button",
								type: "button",
								title: runtime.muted ? "取消静音" : "静音",
								"aria-label": runtime.muted ? "取消静音" : "静音",
								onClick: () => engine.toggleMute(),
								children: runtime.muted || runtime.volume === 0 ? u$1(VolumeX, {
									size: 19,
									"aria-hidden": "true"
								}) : u$1(Volume2, {
									size: 19,
									"aria-hidden": "true"
								})
							}), u$1("input", {
								class: "range volume-range",
								type: "range",
								min: "0",
								max: "1",
								step: "0.01",
								value: runtime.muted ? 0 : runtime.volume,
								"aria-label": "音量",
								onInput: (event) => engine.setVolume(Number(event.currentTarget.value))
							})]
						})
					]
				}),
				runtime.message && u$1("button", {
					class: `status-message ${runtime.requiresInteraction ? "actionable" : ""}`,
					type: "button",
					onClick: () => runtime.requiresInteraction && void engine.togglePlayback(),
					children: runtime.message
				}),
				audioOnlyState.requested && u$1("div", {
					class: `status-message audio-only-status ${audioOnlyState.status}`,
					role: "status",
					children: audioOnlyStatusMessage(audioOnlyState)
				}),
				runtime.playbackContext === "playlist" && u$1("button", {
					class: "status-message actionable playlist-context-message",
					type: "button",
					onClick: () => engine.exitPlaylistPlayback(),
					children: "正在按歌单片段播放，点击退出并继续播放完整视频"
				}),
				u$1("div", {
					class: "playlist-toolbar",
					children: [
						u$1("select", {
							value: activePlaylist.id,
							"aria-label": "当前歌单",
							onChange: (event) => store.selectPlaylist(event.currentTarget.value),
							children: data.playlists.map((playlist) => u$1("option", {
								value: playlist.id,
								children: playlist.name
							}, playlist.id))
						}),
						u$1("button", {
							class: "icon-button",
							type: "button",
							title: "新建歌单",
							"aria-label": "新建歌单",
							onClick: () => setCreatingPlaylist((value) => !value),
							children: u$1(Plus, {
								size: 18,
								"aria-hidden": "true"
							})
						}),
						u$1("button", {
							class: "icon-button danger",
							type: "button",
							title: "删除当前歌单",
							"aria-label": "删除当前歌单",
							disabled: data.playlists.length <= 1,
							onClick: () => store.removePlaylist(activePlaylist.id),
							children: u$1(Trash2, {
								size: 17,
								"aria-hidden": "true"
							})
						})
					]
				}),
				creatingPlaylist && u$1("form", {
					class: "inline-form",
					onSubmit: createPlaylist,
					children: [u$1("input", {
						value: newPlaylistName,
						placeholder: "歌单名称",
						"aria-label": "歌单名称",
						autoFocus: true,
						onInput: (event) => setNewPlaylistName(event.currentTarget.value)
					}), u$1("button", {
						class: "icon-button accent",
						type: "submit",
						title: "保存歌单",
						children: u$1(Save, {
							size: 17,
							"aria-hidden": "true"
						})
					})]
				}),
				u$1("button", {
					class: "add-current-button",
					type: "button",
					disabled: !engine.currentMedia,
					onClick: () => setEditorTrack("new"),
					children: [u$1(Plus, {
						size: 17,
						"aria-hidden": "true"
					}), "将当前视频添加到歌单"]
				}),
				editorTrack && u$1(TrackEditor, {
					media: engine.currentMedia,
					track: editorTrack === "new" ? void 0 : editorTrack,
					onCancel: () => setEditorTrack(void 0),
					onSave: (track) => {
						if (editorTrack === "new") store.addTrack(track);
						else store.updateTrack(track);
						setEditorTrack(void 0);
					}
				}),
				u$1("div", {
					class: "track-list",
					role: "list",
					"aria-label": "歌曲列表",
					children: activePlaylist.tracks.length === 0 ? u$1("div", {
						class: "empty-state",
						children: [u$1(ListMusic, {
							size: 26,
							"aria-hidden": "true"
						}), u$1("span", { children: "歌单还是空的" })]
					}) : activePlaylist.tracks.map((track, index) => u$1("div", {
						class: `track-row ${track.id === nowPlaying.trackId ? "active" : ""}`,
						role: "listitem",
						children: [
							u$1("button", {
								class: "track-main",
								type: "button",
								title: `播放 ${track.title}`,
								onClick: () => engine.playTrack(track),
								children: [
									u$1("span", {
										class: "track-index",
										children: track.id === nowPlaying.trackId && runtime.playing ? u$1(Volume2, {
											size: 15,
											"aria-hidden": "true"
										}) : String(index + 1).padStart(2, "0")
									}),
									u$1("span", {
										class: "track-copy",
										children: [u$1("strong", { children: track.title }), u$1("span", { children: [track.uploader ?? track.bvid, track.startTime > 0 || track.endTime !== void 0 ? ` · ${formatTime(track.startTime)}–${formatTime(track.endTime ?? track.duration)}` : ""] })]
									}),
									u$1("span", {
										class: "track-duration",
										children: formatTime((track.endTime ?? track.duration) - track.startTime)
									})
								]
							}),
							u$1("button", {
								class: "row-action",
								type: "button",
								title: "编辑歌曲",
								"aria-label": `编辑 ${track.title}`,
								onClick: () => setEditorTrack(track),
								children: u$1(Pencil, {
									size: 15,
									"aria-hidden": "true"
								})
							}),
							u$1("button", {
								class: "row-action danger",
								type: "button",
								title: "删除歌曲",
								"aria-label": `删除 ${track.title}`,
								onClick: () => store.removeTrack(track.id),
								children: u$1(Trash2, {
									size: 15,
									"aria-hidden": "true"
								})
							})
						]
					}, track.id))
				})
			]
		});
	}
	function TrackEditor({ media, track, onCancel, onSave }) {
		const metadata = readCurrentVideoMetadata();
		const [title, setTitle] = d$2(track?.title ?? metadata?.title ?? "");
		const [startTime, setStartTime] = d$2(String(track?.startTime ?? 0));
		const [endTime, setEndTime] = d$2(track?.endTime === void 0 ? "" : String(track.endTime));
		const [error, setError] = d$2("");
		h$2(() => {
			setError("");
		}, [startTime, endTime]);
		const save = (event) => {
			event.preventDefault();
			const start = Number(startTime);
			const end = endTime.trim() ? Number(endTime) : void 0;
			if (!Number.isFinite(start) || start < 0) {
				setError("开始时间无效");
				return;
			}
			if (end !== void 0 && (!Number.isFinite(end) || end <= start)) {
				setError("结束时间必须晚于开始时间");
				return;
			}
			if (track) {
				onSave({
					...track,
					title: title.trim() || track.title,
					startTime: start,
					endTime: end
				});
				return;
			}
			if (!media) {
				setError("尚未找到 Bilibili 播放器");
				return;
			}
			const nextTrack = createTrackFromCurrentPage(media, title, start, end);
			if (!nextTrack) {
				setError("无法读取当前视频信息");
				return;
			}
			onSave(nextTrack);
		};
		return u$1("form", {
			class: "track-editor",
			onSubmit: save,
			children: [
				u$1("div", {
					class: "editor-heading",
					children: [u$1("strong", { children: track ? "编辑歌曲" : "添加歌曲" }), u$1("button", {
						class: "icon-button",
						type: "button",
						title: "关闭编辑器",
						"aria-label": "关闭编辑器",
						onClick: onCancel,
						children: u$1(X, {
							size: 16,
							"aria-hidden": "true"
						})
					})]
				}),
				u$1("label", { children: [u$1("span", { children: "标题" }), u$1("input", {
					value: title,
					required: true,
					onInput: (event) => setTitle(event.currentTarget.value)
				})] }),
				u$1("div", {
					class: "time-fields",
					children: [u$1("label", { children: [u$1("span", { children: "开始时间（秒）" }), u$1("input", {
						type: "number",
						min: "0",
						step: "0.1",
						value: startTime,
						onInput: (event) => setStartTime(event.currentTarget.value)
					})] }), u$1("button", {
						class: "current-time-button",
						type: "button",
						disabled: !media,
						onClick: () => setStartTime(String(media?.currentTime ?? 0)),
						children: [u$1(Clock3, {
							size: 15,
							"aria-hidden": "true"
						}), "当前"]
					})]
				}),
				u$1("div", {
					class: "time-fields",
					children: [u$1("label", { children: [u$1("span", { children: "结束时间（秒）" }), u$1("input", {
						type: "number",
						min: "0",
						step: "0.1",
						value: endTime,
						onInput: (event) => setEndTime(event.currentTarget.value)
					})] }), u$1("button", {
						class: "current-time-button",
						type: "button",
						disabled: !media,
						onClick: () => setEndTime(String(media?.currentTime ?? "")),
						children: [u$1(Clock3, {
							size: 15,
							"aria-hidden": "true"
						}), "当前"]
					})]
				}),
				error && u$1("div", {
					class: "editor-error",
					children: error
				}),
				u$1("button", {
					class: "save-track-button",
					type: "submit",
					children: [u$1(Save, {
						size: 16,
						"aria-hidden": "true"
					}), "保存"]
				})
			]
		});
	}
	function PlayModeIcon({ mode }) {
		switch (mode) {
			case "list-loop": return u$1(Repeat, {
				size: 19,
				"aria-hidden": "true"
			});
			case "single-loop": return u$1(Repeat1, {
				size: 19,
				"aria-hidden": "true"
			});
			case "shuffle": return u$1(Shuffle, {
				size: 19,
				"aria-hidden": "true"
			});
			default: return u$1(ListMusic, {
				size: 19,
				"aria-hidden": "true"
			});
		}
	}
	function audioOnlyButtonLabel(state) {
		switch (state.status) {
			case "detecting": return "纯音频模式正在检测播放流；点击关闭并重载";
			case "active": return "纯音频模式已生效；点击关闭并重载";
			case "fallback": return "纯音频模式未生效；点击关闭并重载";
			default: return "开启纯音频模式并重载页面";
		}
	}
	function audioOnlyStatusMessage(state) {
		switch (state.status) {
			case "detecting": return "纯音频模式：正在检测 DASH 播放流…";
			case "active": return "纯音频模式已生效：视频流已被移除";
			case "fallback": return `纯音频模式未生效，已回退正常视频：${audioOnlyReasonLabel(state.reason)}`;
			default: return "";
		}
	}
	function audioOnlyReasonLabel(reason) {
		switch (reason) {
			case "durl-only": return "当前视频只提供音视频混流";
			case "missing-audio": return "DASH 清单没有可用音频";
			case "missing-dash":
			case "invalid-payload": return "未找到可改写的 DASH 清单";
			case "invalid-json": return "播放清单不是有效 JSON";
			case "unsupported-response-type": return "播放器使用了暂不支持的响应格式";
			case "playinfo-nonconfigurable": return "首屏播放信息无法拦截";
			case "playinfo-rewrite-failed":
			case "fetch-rewrite-failed":
			case "xhr-rewrite-failed": return "播放清单拦截失败";
			default: return "当前播放格式不受支持";
		}
	}
	var i = Symbol.for("preact-signals");
	function t() {
		if (!(v > 1)) {
			var i, t = !1;
			(function() {
				var i = c;
				c = void 0;
				while (void 0 !== i) {
					var t = i.S;
					if (t.v === i.v) {
						for (var n = t.t; void 0 !== n; n = n.x) if (n.i === i.i) n.i = t.i;
					}
					i = i.o;
				}
			})();
			while (void 0 !== h$1) {
				var n = h$1;
				h$1 = void 0;
				s++;
				while (void 0 !== n) {
					var r = n.u;
					n.u = void 0;
					n.f &= -3;
					if (!(8 & n.f) && w$1(n)) try {
						n.c();
					} catch (n) {
						if (!t) {
							i = n;
							t = !0;
						}
					}
					n = r;
				}
			}
			s = 0;
			v--;
			if (t) throw i;
		} else v--;
	}
	function n(i) {
		if (v > 0) return i();
		e = ++u;
		v++;
		try {
			return i();
		} finally {
			t();
		}
	}
	var r;
	var o = void 0;
	function f(i) {
		var t = o, n = r;
		o = void 0;
		r = void 0;
		try {
			return i();
		} finally {
			o = t;
			r = n;
		}
	}
	var h$1 = void 0;
	var v = 0;
	var s = 0;
	var u = 0;
	var e = 0;
	var c = void 0;
	var d$1 = 0;
	function a(i) {
		if (void 0 !== o) {
			var t = i.n;
			if (void 0 === t || t.t !== o) {
				t = {
					i: 0,
					S: i,
					p: o.s,
					n: void 0,
					t: o,
					e: void 0,
					x: void 0,
					r: t
				};
				if (void 0 !== o.s) o.s.n = t;
				o.s = t;
				i.n = t;
				if (32 & o.f) i.S(t);
				return t;
			} else if (-1 === t.i) {
				t.i = 0;
				if (void 0 !== t.n) {
					t.n.p = t.p;
					if (void 0 !== t.p) t.p.n = t.n;
					t.p = o.s;
					t.n = void 0;
					o.s.n = t;
					o.s = t;
				}
				return t;
			}
		}
	}
	function l$1(i, t) {
		this.v = i;
		this.i = 0;
		this.n = void 0;
		this.t = void 0;
		this.l = 0;
		this.W = null == t ? void 0 : t.watched;
		this.Z = null == t ? void 0 : t.unwatched;
		this.name = null == t ? void 0 : t.name;
	}
	l$1.prototype.brand = i;
	l$1.prototype.h = function() {
		return !0;
	};
	l$1.prototype.S = function(i) {
		var t = this, n = this.t;
		if (n !== i && void 0 === i.e) {
			i.x = n;
			this.t = i;
			if (void 0 !== n) n.e = i;
			else f(function() {
				var i;
				null == (i = t.W) || i.call(t);
			});
		}
	};
	l$1.prototype.U = function(i) {
		var t = this;
		if (void 0 !== this.t) {
			var n = i.e, r = i.x;
			if (void 0 !== n) {
				n.x = r;
				i.e = void 0;
			}
			if (void 0 !== r) {
				r.e = n;
				i.x = void 0;
			}
			if (i === this.t) {
				this.t = r;
				if (void 0 === r) f(function() {
					var i;
					null == (i = t.Z) || i.call(t);
				});
			}
		}
	};
	l$1.prototype.subscribe = function(i) {
		var t = this;
		return j(function() {
			var n = t.value;
			f(function() {
				return i(n);
			});
		}, { name: "sub" });
	};
	l$1.prototype.valueOf = function() {
		return this.value;
	};
	l$1.prototype.toString = function() {
		return this.value + "";
	};
	l$1.prototype.toJSON = function() {
		return this.value;
	};
	l$1.prototype.peek = function() {
		var i = this;
		return f(function() {
			return i.value;
		});
	};
	Object.defineProperty(l$1.prototype, "value", {
		get: function() {
			var i = a(this);
			if (void 0 !== i) i.i = this.i;
			return this.v;
		},
		set: function(i) {
			if (i !== this.v) {
				if (s > 100) throw new Error("Cycle detected");
				(function(i) {
					if (0 !== v && 0 === s) {
						if (i.l !== e) {
							i.l = e;
							c = {
								S: i,
								v: i.v,
								i: i.i,
								o: c
							};
						}
					}
				})(this);
				this.v = i;
				this.i++;
				d$1++;
				v++;
				try {
					for (var n = this.t; void 0 !== n; n = n.x) n.t.N();
				} finally {
					t();
				}
			}
		}
	});
	function y$1(i, t) {
		return new l$1(i, t);
	}
	function w$1(i) {
		for (var t = i.s; void 0 !== t; t = t.n) if (t.S.i !== t.i || !t.S.h() || t.S.i !== t.i) return !0;
		return !1;
	}
	function _$1(i) {
		for (var t = i.s; void 0 !== t; t = t.n) {
			var n = t.S.n;
			if (void 0 !== n) t.r = n;
			t.S.n = t;
			t.i = -1;
			if (void 0 === t.n) {
				i.s = t;
				break;
			}
		}
	}
	function b$1(i) {
		var t = i.s, n = void 0;
		while (void 0 !== t) {
			var r = t.p;
			if (-1 === t.i) {
				t.S.U(t);
				if (void 0 !== r) r.n = t.n;
				if (void 0 !== t.n) t.n.p = r;
			} else n = t;
			t.S.n = t.r;
			if (void 0 !== t.r) t.r = void 0;
			t = r;
		}
		i.s = n;
	}
	function p$1(i, t) {
		l$1.call(this, void 0, t);
		this.x = i;
		this.s = void 0;
		this.g = d$1 - 1;
		this.f = 4;
	}
	p$1.prototype = new l$1();
	p$1.prototype.h = function() {
		this.f &= -3;
		if (1 & this.f) return !1;
		if (32 == (36 & this.f)) return !0;
		this.f &= -5;
		if (this.g === d$1) return !0;
		this.g = d$1;
		this.f |= 1;
		if (this.i > 0 && !w$1(this)) {
			this.f &= -2;
			return !0;
		}
		var i = o;
		try {
			_$1(this);
			o = this;
			var t = this.x();
			if (16 & this.f || this.v !== t || 0 === this.i) {
				this.v = t;
				this.f &= -17;
				this.i++;
			}
		} catch (i) {
			this.v = i;
			this.f |= 16;
			this.i++;
		}
		o = i;
		b$1(this);
		this.f &= -2;
		return !0;
	};
	p$1.prototype.S = function(i) {
		if (void 0 === this.t) {
			this.f |= 36;
			for (var t = this.s; void 0 !== t; t = t.n) t.S.S(t);
		}
		l$1.prototype.S.call(this, i);
	};
	p$1.prototype.U = function(i) {
		if (void 0 !== this.t) {
			l$1.prototype.U.call(this, i);
			if (void 0 === this.t) {
				this.f &= -33;
				for (var t = this.s; void 0 !== t; t = t.n) t.S.U(t);
			}
		}
	};
	p$1.prototype.N = function() {
		if (!(2 & this.f)) {
			this.f |= 6;
			for (var i = this.t; void 0 !== i; i = i.x) i.t.N();
		}
	};
	Object.defineProperty(p$1.prototype, "value", { get: function() {
		if (1 & this.f) throw new Error("Cycle detected");
		var i = a(this);
		this.h();
		if (void 0 !== i) i.i = this.i;
		if (16 & this.f) throw this.v;
		return this.v;
	} });
	function g$1(i, t) {
		return new p$1(i, t);
	}
	function S(i) {
		var n = i.m;
		i.m = void 0;
		if ("function" == typeof n) {
			v++;
			var r = o;
			o = void 0;
			try {
				n();
			} catch (t) {
				i.f &= -2;
				i.f |= 8;
				m(i);
				throw t;
			} finally {
				o = r;
				t();
			}
		}
	}
	function m(i) {
		for (var t = i.s; void 0 !== t; t = t.n) t.S.U(t);
		i.x = void 0;
		i.s = void 0;
		S(i);
	}
	function x$1(i) {
		if (o !== this) throw new Error("Out-of-order effect");
		b$1(this);
		o = i;
		this.f &= -2;
		if (8 & this.f) m(this);
		t();
	}
	function E(i, t) {
		this.x = i;
		this.m = void 0;
		this.s = void 0;
		this.u = void 0;
		this.f = 32;
		this.name = null == t ? void 0 : t.name;
		if (r) r.push(this);
	}
	E.prototype.c = function() {
		var i = this.S();
		try {
			if (8 & this.f) return;
			if (void 0 === this.x) return;
			var t = this.x();
			if ("function" == typeof t) this.m = t;
		} finally {
			i();
		}
	};
	E.prototype.S = function() {
		if (1 & this.f) throw new Error("Cycle detected");
		this.f |= 1;
		this.f &= -9;
		S(this);
		_$1(this);
		v++;
		var i = o;
		o = this;
		return x$1.bind(this, i);
	};
	E.prototype.N = function() {
		if (!(2 & this.f)) {
			this.f |= 2;
			this.u = h$1;
			h$1 = this;
		}
	};
	E.prototype.d = function() {
		this.f |= 8;
		if (!(1 & this.f)) m(this);
	};
	E.prototype.dispose = function() {
		this.d();
	};
	function j(i, t) {
		var n = new E(i, t);
		try {
			n.c();
		} catch (i) {
			n.d();
			throw i;
		}
		var r = n.d.bind(n);
		r[Symbol.dispose] = r;
		return r;
	}
	var l;
	var h;
	var p = "undefined" != typeof window && !!window.__PREACT_SIGNALS_DEVTOOLS__;
	var _ = [];
	j(function() {
		l = this.N;
	})();
	function g(i, r) {
		l$3[i] = r.bind(null, l$3[i] || function() {});
	}
	function b(i) {
		if (h) {
			var n = h;
			h = void 0;
			n();
		}
		h = i && i.S();
	}
	function y(i) {
		var n = this, t = i.data, f = useSignal(t);
		f.name = "ReactiveDom";
		f.value = t;
		var e = T(function() {
			var i = n, t = n.__v;
			while (t = t.__) if (t.__c) {
				t.__c.__$f |= 4;
				break;
			}
			var o = g$1(function() {
				var i = f.value.value;
				return 0 === i ? 0 : !0 === i ? "" : i || "";
			}), e = g$1(function() {
				return !Array.isArray(o.value) && !t$2(o.value);
			}), a = j(function() {
				this.N = F;
				if (e.value) {
					var n = o.value;
					if (i.__v && i.__v.__e && 3 === i.__v.__e.nodeType) i.__v.__e.data = n;
				}
			}), v = n.__$u.d;
			n.__$u.d = function() {
				a();
				v.call(this);
			};
			return [e, o];
		}, []), a = e[0], v = e[1];
		return a.value ? v.peek() : v.value;
	}
	y.displayName = "ReactiveTextNode";
	Object.defineProperties(l$1.prototype, {
		constructor: {
			configurable: !0,
			value: void 0
		},
		type: {
			configurable: !0,
			value: y
		},
		props: {
			configurable: !0,
			get: function() {
				var i = this;
				return { data: { get value() {
					return i.value;
				} } };
			}
		},
		__b: {
			configurable: !0,
			value: 1
		}
	});
	g("__b", function(i, n) {
		if ("string" == typeof n.type) {
			var r, t = n.props;
			for (var o in t) if ("children" !== o) {
				var f = t[o];
				if (f instanceof l$1) {
					if (!r) n.__np = r = {};
					r[o] = f;
					t[o] = f.peek();
				}
			}
		}
		i(n);
	});
	g("__r", function(i, n) {
		i(n);
		if (n.type !== S$1) {
			b();
			var r, o = n.__c;
			if (o) {
				o.__$f &= -2;
				if (void 0 === (r = o.__$u)) o.__$u = r = function(i, n) {
					var r;
					j(function() {
						r = this;
					}, { name: n });
					r.c = i;
					return r;
				}(function() {
					var i;
					if (p) null == (i = r.y) || i.call(r);
					o.__$f |= 1;
					o.setState({});
				}, "function" == typeof n.type ? n.type.displayName || n.type.name : "");
			}
			b(r);
		}
	});
	g("__e", function(i, n, r, t) {
		b();
		i(n, r, t);
	});
	g("diffed", function(i, n) {
		b();
		var r;
		if ("string" == typeof n.type && (r = n.__e)) {
			var t = n.__np, o = n.props, f = r.U;
			if (f) for (var e in f) {
				var u = f[e];
				if (!(void 0 === u || t && e in t)) {
					u.d();
					f[e] = void 0;
				}
			}
			if (t) {
				if (!f) {
					f = {};
					r.U = f;
				}
				for (var a in t) {
					var c = f[a], v = t[a];
					if (void 0 === c) {
						c = w(r, a, v, o);
						f[a] = c;
					} else c.o(v, o);
				}
			}
		}
		i(n);
	});
	function w(i, n, r, t) {
		var o = n in i && void 0 === i.ownerSVGElement, f = y$1(r);
		return {
			o: function(i, n) {
				f.value = i;
				t = n;
			},
			d: j(function() {
				this.N = F;
				var r = f.value.value;
				if (t[n] !== r) {
					t[n] = r;
					if (o) i[n] = r;
					else if (null != r && (!1 !== r || "-" === n[4])) i.setAttribute(n, r);
					else i.removeAttribute(n);
				}
			})
		};
	}
	g("unmount", function(i, n) {
		if ("string" == typeof n.type) {
			var r = n.__e;
			if (r) {
				var t = r.U;
				if (t) {
					r.U = void 0;
					for (var o in t) {
						var f = t[o];
						if (f) f.d();
					}
				}
			}
			var e = n.__np;
			if (e) {
				var u = n.props;
				for (var a in e) u[a] = e[a];
			}
			n.__np = void 0;
		} else {
			var c = n.__c;
			if (c) {
				var v = c.__$u;
				if (v) {
					c.__$u = void 0;
					v.d();
				}
			}
		}
		i(n);
	});
	g("__h", function(i, n, r, t) {
		if (t < 3) n.__$f |= 2;
		i(n, r, t);
	});
	C$1.prototype.shouldComponentUpdate = function(i, n) {
		if (this.__R) return !0;
		var r = this.__$u, t = r && void 0 !== r.s;
		for (var o in n) return !0;
		if (this.__f || "boolean" == typeof this.u && !0 === this.u) {
			var f = 2 & this.__$f;
			if (!(t || f || 4 & this.__$f)) return !0;
			if (1 & this.__$f) return !0;
		} else {
			if (!(t || 4 & this.__$f)) return !0;
			if (3 & this.__$f) return !0;
		}
		for (var e in i) if ("__source" !== e && i[e] !== this.props[e]) return !0;
		for (var u in this.props) if (!(u in i)) return !0;
		return !1;
	};
	function useSignal(i, n) {
		return T(function() {
			return y$1(i, n);
		}, []);
	}
	var q = function(i) {
		queueMicrotask(function() {
			queueMicrotask(i);
		});
	};
	function x() {
		n(function() {
			var i;
			while (i = _.shift()) l.call(i);
		});
	}
	function F() {
		if (1 === _.push(this)) (l$3.requestAnimationFrame || q)(x);
	}
	var _GM_addValueChangeListener = (() => typeof GM_addValueChangeListener != "undefined" ? GM_addValueChangeListener : void 0)();
	var _GM_getValue = (() => typeof GM_getValue != "undefined" ? GM_getValue : void 0)();
	var _GM_removeValueChangeListener = (() => typeof GM_removeValueChangeListener != "undefined" ? GM_removeValueChangeListener : void 0)();
	var _GM_setValue = (() => typeof GM_setValue != "undefined" ? GM_setValue : void 0)();
	var _unsafeWindow = (() => typeof unsafeWindow != "undefined" ? unsafeWindow : void 0)();
	var STORAGE_KEY$1 = "bilibili-music-player:data";
	function createDefaultData(now = Date.now()) {
		const playlist = {
			id: createId("playlist"),
			name: "默认歌单",
			tracks: [],
			createdAt: now,
			updatedAt: now
		};
		return {
			version: 1,
			playlists: [playlist],
			activePlaylistId: playlist.id,
			playMode: "list-loop",
			volume: 1,
			playback: {
				playlistId: playlist.id,
				currentTime: 0,
				resumeRequested: false,
				updatedAt: now
			}
		};
	}
	function migrateAppData(raw) {
		if (!raw || typeof raw !== "object") return createDefaultData();
		const candidate = raw;
		if (candidate.version !== 1 || !Array.isArray(candidate.playlists)) return createDefaultData();
		const fallback = createDefaultData();
		const playlists = candidate.playlists.filter((playlist) => Boolean(playlist && typeof playlist.id === "string" && typeof playlist.name === "string" && Array.isArray(playlist.tracks)));
		if (playlists.length === 0) return fallback;
		const activePlaylistId = playlists.some((playlist) => playlist.id === candidate.activePlaylistId) ? candidate.activePlaylistId : playlists[0].id;
		return {
			version: 1,
			playlists,
			activePlaylistId,
			playMode: candidate.playMode === "sequence" || candidate.playMode === "list-loop" || candidate.playMode === "single-loop" || candidate.playMode === "shuffle" ? candidate.playMode : "list-loop",
			volume: typeof candidate.volume === "number" ? Math.min(1, Math.max(0, candidate.volume)) : 1,
			playback: {
				playlistId: candidate.playback?.playlistId ?? activePlaylistId,
				trackId: candidate.playback?.trackId,
				currentTime: candidate.playback?.currentTime ?? 0,
				resumeRequested: candidate.playback?.resumeRequested ?? false,
				updatedAt: candidate.playback?.updatedAt ?? Date.now()
			}
		};
	}
	var AppRepository = class {
		load() {
			return migrateAppData(_GM_getValue(STORAGE_KEY$1));
		}
		save(data) {
			_GM_setValue(STORAGE_KEY$1, data);
		}
		subscribe(listener) {
			const listenerId = _GM_addValueChangeListener(STORAGE_KEY$1, (_key, _oldValue, newValue, remote) => {
				if (remote) listener(migrateAppData(newValue));
			});
			return () => _GM_removeValueChangeListener(listenerId);
		}
	};
	var AppStore = class {
		data = y$1(createDefaultData());
		repository = new AppRepository();
		unsubscribe;
		start() {
			this.data.value = this.repository.load();
			this.unsubscribe = this.repository.subscribe((data) => {
				this.data.value = data;
			});
		}
		stop() {
			this.unsubscribe?.();
		}
		get activePlaylist() {
			const data = this.data.peek();
			return data.playlists.find((playlist) => playlist.id === data.activePlaylistId) ?? data.playlists[0];
		}
		findTrack(trackId) {
			if (!trackId) return;
			return this.data.peek().playlists.flatMap((playlist) => playlist.tracks).find((track) => track.id === trackId);
		}
		createPlaylist(name) {
			const normalizedName = name.trim();
			if (!normalizedName) return;
			const now = Date.now();
			const playlist = {
				id: createId("playlist"),
				name: normalizedName,
				tracks: [],
				createdAt: now,
				updatedAt: now
			};
			this.commit((data) => ({
				...data,
				playlists: [...data.playlists, playlist],
				activePlaylistId: playlist.id,
				playback: {
					...data.playback,
					playlistId: playlist.id,
					trackId: void 0,
					currentTime: 0,
					resumeRequested: false,
					updatedAt: now
				}
			}));
		}
		removePlaylist(playlistId) {
			if (this.data.peek().playlists.length <= 1) return;
			this.commit((data) => {
				const playlists = data.playlists.filter((playlist) => playlist.id !== playlistId);
				const activePlaylistId = data.activePlaylistId === playlistId ? playlists[0].id : data.activePlaylistId;
				return {
					...data,
					playlists,
					activePlaylistId,
					playback: data.playback.playlistId === playlistId ? {
						playlistId: activePlaylistId,
						currentTime: 0,
						resumeRequested: false,
						updatedAt: Date.now()
					} : data.playback
				};
			});
		}
		selectPlaylist(playlistId) {
			if (!this.data.peek().playlists.some((item) => item.id === playlistId)) return;
			this.commit((data) => ({
				...data,
				activePlaylistId: playlistId,
				playback: {
					playlistId,
					currentTime: 0,
					resumeRequested: false,
					updatedAt: Date.now()
				}
			}));
		}
		addTrack(track) {
			this.commit((data) => ({
				...data,
				playlists: data.playlists.map((playlist) => playlist.id === data.activePlaylistId ? {
					...playlist,
					tracks: [...playlist.tracks, track],
					updatedAt: Date.now()
				} : playlist)
			}));
		}
		updateTrack(track) {
			this.commit((data) => ({
				...data,
				playlists: data.playlists.map((playlist) => playlist.id === data.activePlaylistId ? {
					...playlist,
					tracks: playlist.tracks.map((item) => item.id === track.id ? track : item),
					updatedAt: Date.now()
				} : playlist)
			}));
		}
		removeTrack(trackId) {
			this.commit((data) => ({
				...data,
				playlists: data.playlists.map((playlist) => playlist.id === data.activePlaylistId ? {
					...playlist,
					tracks: playlist.tracks.filter((track) => track.id !== trackId),
					updatedAt: Date.now()
				} : playlist),
				playback: data.playback.trackId === trackId ? {
					...data.playback,
					trackId: void 0,
					currentTime: 0,
					resumeRequested: false,
					updatedAt: Date.now()
				} : data.playback
			}));
		}
		setPlayMode(playMode) {
			this.commit((data) => ({
				...data,
				playMode
			}));
		}
		setVolume(volume) {
			this.commit((data) => ({
				...data,
				volume: Math.min(1, Math.max(0, volume))
			}));
		}
		requestTrack(track, currentTime = track.startTime) {
			this.commit((data) => ({
				...data,
				playback: {
					playlistId: data.activePlaylistId,
					trackId: track.id,
					currentTime,
					resumeRequested: true,
					updatedAt: Date.now()
				}
			}));
		}
		consumeResumeRequest() {
			this.commit((data) => ({
				...data,
				playback: {
					...data.playback,
					resumeRequested: false,
					updatedAt: Date.now()
				}
			}));
		}
		savePosition(currentTime) {
			if (!this.data.peek().playback.trackId) return;
			this.commit((data) => ({
				...data,
				playback: {
					...data.playback,
					currentTime,
					updatedAt: Date.now()
				}
			}));
		}
		commit(updater) {
			const next = updater(this.data.peek());
			this.data.value = next;
			this.repository.save(next);
		}
	};
	var appStore = new AppStore();
	var PLAYURL_PATH = /^\/x\/player\/(?:wbi\/)?playurl\/?$/;
	function isPlayurlUrl(url) {
		if (typeof url !== "string" || !url) return false;
		try {
			return PLAYURL_PATH.test(new URL(url, "https://www.bilibili.com").pathname);
		} catch {
			return false;
		}
	}
	function rewritePlayurlText(url, text) {
		if (!isPlayurlUrl(url)) return {
			value: text,
			changed: false,
			supported: false,
			reason: "not-playurl"
		};
		try {
			const result = rewritePlayurlPayload(JSON.parse(text));
			return {
				...result,
				value: result.changed ? JSON.stringify(result.value) : text
			};
		} catch {
			return {
				value: text,
				changed: false,
				supported: false,
				reason: "invalid-json"
			};
		}
	}
	function rewritePlayurlPayload(payload) {
		if (!isRecord(payload)) return unchanged(payload, "invalid-payload");
		const dashPaths = [
			["data", "dash"],
			["result", "dash"],
			[
				"data",
				"video_info",
				"dash"
			]
		];
		if (dashPaths.map((path) => getPath(payload, path)).filter(isRecord).length === 0) return unchanged(payload, containsDurl(payload) ? "durl-only" : "missing-dash");
		let hasAudio = false;
		let alreadyAudioOnly = false;
		const clone = cloneValue(payload);
		let changed = false;
		for (const path of dashPaths) {
			const sourceDash = getPath(payload, path);
			const targetDash = getPath(clone, path);
			if (!isRecord(sourceDash) || !isRecord(targetDash)) continue;
			if (!Array.isArray(sourceDash.audio) || sourceDash.audio.length === 0) continue;
			hasAudio = true;
			if (!Array.isArray(sourceDash.video)) continue;
			if (sourceDash.video.length === 0) {
				alreadyAudioOnly = true;
				continue;
			}
			targetDash.video = [];
			changed = true;
		}
		if (changed) return {
			value: clone,
			changed: true,
			supported: true,
			reason: "rewritten"
		};
		if (alreadyAudioOnly) return {
			value: payload,
			changed: false,
			supported: true,
			reason: "already-audio-only"
		};
		return unchanged(payload, hasAudio ? "missing-dash" : "missing-audio");
	}
	function unchanged(value, reason) {
		return {
			value,
			changed: false,
			supported: false,
			reason
		};
	}
	function containsDurl(payload) {
		return [
			["data", "durl"],
			["result", "durl"],
			[
				"data",
				"video_info",
				"durl"
			]
		].some((path) => Array.isArray(getPath(payload, path)));
	}
	function getPath(value, path) {
		let current = value;
		for (const key of path) {
			if (!isRecord(current)) return;
			current = current[key];
		}
		return current;
	}
	function isRecord(value) {
		return Boolean(value) && typeof value === "object" && !Array.isArray(value);
	}
	function cloneValue(value, seen = new WeakMap()) {
		if (!value || typeof value !== "object") return value;
		const cached = seen.get(value);
		if (cached) return cached;
		if (Array.isArray(value)) {
			const clone = [];
			seen.set(value, clone);
			for (const item of value) clone.push(cloneValue(item, seen));
			return clone;
		}
		const clone = {};
		seen.set(value, clone);
		for (const [key, item] of Object.entries(value)) clone[key] = cloneValue(item, seen);
		return clone;
	}
	var INSTALL_KEY = Symbol.for("bilibili-music-player:audio-only-interceptors");
	function installAudioOnlyInterceptors(pageWindow, onOutcome) {
		const installTarget = pageWindow;
		if (installTarget[INSTALL_KEY]) return;
		Object.defineProperty(installTarget, INSTALL_KEY, {
			configurable: false,
			value: true
		});
		installPlayinfoInterceptor(pageWindow, onOutcome);
		installFetchInterceptor(pageWindow, onOutcome);
		installXhrInterceptor(pageWindow, onOutcome);
	}
	function installPlayinfoInterceptor(pageWindow, onOutcome) {
		try {
			const descriptor = Object.getOwnPropertyDescriptor(pageWindow, "__playinfo__");
			if (descriptor && !descriptor.configurable) {
				onOutcome({
					supported: false,
					reason: "playinfo-nonconfigurable"
				});
				return;
			}
			let playinfo = descriptor?.get ? descriptor.get.call(pageWindow) : descriptor?.value;
			if (playinfo !== void 0) {
				const result = rewritePlayurlPayload(playinfo);
				playinfo = result.value;
				reportRewriteResult(result, onOutcome);
			}
			Object.defineProperty(pageWindow, "__playinfo__", {
				configurable: true,
				enumerable: descriptor?.enumerable ?? true,
				get: () => playinfo,
				set: (value) => {
					try {
						const result = rewritePlayurlPayload(value);
						playinfo = result.value;
						reportRewriteResult(result, onOutcome);
					} catch {
						playinfo = value;
						onOutcome({
							supported: false,
							reason: "playinfo-rewrite-failed"
						});
					}
				}
			});
		} catch {
			onOutcome({
				supported: false,
				reason: "playinfo-rewrite-failed"
			});
		}
	}
	function installFetchInterceptor(pageWindow, onOutcome) {
		const rawFetch = pageWindow.fetch;
		if (typeof rawFetch !== "function") return;
		pageWindow.fetch = async function(input, init) {
			const url = requestUrl(pageWindow, input);
			const response = await Reflect.apply(rawFetch, this, [input, init]);
			if (!isPlayurlUrl(url)) return response;
			try {
				const result = rewritePlayurlText(url, await response.clone().text());
				reportRewriteResult(result, onOutcome);
				if (!result.changed) return response;
				return createRewrittenResponse(pageWindow, response, result.value);
			} catch {
				onOutcome({
					supported: false,
					reason: "fetch-rewrite-failed"
				});
				return response;
			}
		};
	}
	function installXhrInterceptor(pageWindow, onOutcome) {
		const XHR = pageWindow.XMLHttpRequest;
		if (!XHR) return;
		const prototype = XHR.prototype;
		const responseDescriptor = Object.getOwnPropertyDescriptor(prototype, "response");
		const responseTextDescriptor = Object.getOwnPropertyDescriptor(prototype, "responseText");
		if (!responseDescriptor?.configurable || !responseDescriptor.get || !responseTextDescriptor?.configurable || !responseTextDescriptor.get) {
			onOutcome({
				supported: false,
				reason: "xhr-rewrite-failed"
			});
			return;
		}
		const states = new WeakMap();
		const rawOpen = prototype.open;
		const rawResponseGet = responseDescriptor.get;
		const rawResponseTextGet = responseTextDescriptor.get;
		try {
			Object.defineProperty(prototype, "response", {
				...responseDescriptor,
				get() {
					const original = rawResponseGet.call(this);
					return rewriteXhrValue(pageWindow, this, original, states, onOutcome, "response");
				}
			});
			Object.defineProperty(prototype, "responseText", {
				...responseTextDescriptor,
				get() {
					const original = rawResponseTextGet.call(this);
					return rewriteXhrValue(pageWindow, this, original, states, onOutcome, "text");
				}
			});
			prototype.open = function(method, url, ...rest) {
				states.set(this, {
					url: String(url),
					processed: false
				});
				return Reflect.apply(rawOpen, this, [
					method,
					url,
					...rest
				]);
			};
		} catch {
			onOutcome({
				supported: false,
				reason: "xhr-rewrite-failed"
			});
		}
	}
	function rewriteXhrValue(pageWindow, xhr, original, states, onOutcome, requestedValue) {
		const state = states.get(xhr);
		if (!state || xhr.readyState !== pageWindow.XMLHttpRequest.DONE || !isPlayurlUrl(state.url)) return original;
		if (!state.processed) {
			state.processed = true;
			try {
				switch (xhr.responseType) {
					case "":
					case "text": {
						const text = String(original ?? "");
						const result = rewritePlayurlText(state.url, text);
						reportRewriteResult(result, onOutcome);
						state.text = result.value;
						state.response = result.value;
						break;
					}
					case "json": {
						const result = rewritePlayurlPayload(original);
						reportRewriteResult(result, onOutcome);
						state.response = result.value;
						break;
					}
					case "arraybuffer": {
						if (!(original instanceof pageWindow.ArrayBuffer)) {
							state.response = original;
							onOutcome({
								supported: false,
								reason: "xhr-rewrite-failed"
							});
							break;
						}
						const text = new pageWindow.TextDecoder("utf-8").decode(original);
						const result = rewritePlayurlText(state.url, text);
						reportRewriteResult(result, onOutcome);
						state.response = result.changed ? new pageWindow.TextEncoder().encode(result.value).buffer : original;
						break;
					}
					default:
						state.response = original;
						onOutcome({
							supported: false,
							reason: "unsupported-response-type"
						});
				}
			} catch {
				state.response = original;
				onOutcome({
					supported: false,
					reason: "xhr-rewrite-failed"
				});
			}
		}
		return requestedValue === "text" ? state.text : state.response;
	}
	function requestUrl(pageWindow, input) {
		if (typeof input === "string") return input;
		if (input instanceof pageWindow.URL) return input.href;
		return input.url;
	}
	function createRewrittenResponse(pageWindow, original, text) {
		const headers = new pageWindow.Headers(original.headers);
		headers.delete("content-encoding");
		headers.delete("content-length");
		const rewritten = new pageWindow.Response(text, {
			status: original.status,
			statusText: original.statusText,
			headers
		});
		for (const property of [
			"url",
			"redirected",
			"type"
		]) try {
			Object.defineProperty(rewritten, property, {
				configurable: true,
				value: original[property]
			});
		} catch {}
		return rewritten;
	}
	function reportRewriteResult(result, onOutcome) {
		onOutcome({
			supported: result.supported,
			reason: result.reason
		});
	}
	var STORAGE_KEY = "bilibili-music-player:audio-only";
	var STYLE_ID = "bilibili-music-player-audio-only-style";
	var ROOT_ATTRIBUTE = "data-bmp-audio-only";
	var PAGE_STYLE = `
html[${ROOT_ATTRIBUTE}="active"] .bpx-player-video-wrap video,
html[${ROOT_ATTRIBUTE}="active"] #bilibili-player video,
html[${ROOT_ATTRIBUTE}="active"] .bilibili-player-video video,
html[${ROOT_ATTRIBUTE}="active"] video.bpx-player-video {
  visibility: hidden !important;
}
`;
	var AudioOnlyController = class {
		state = y$1(createInitialState());
		started = false;
		diagnosticLogged = false;
		start() {
			if (this.started) return;
			this.started = true;
			if (!this.state.peek().requested) return;
			installAudioOnlyInterceptors(_unsafeWindow, (outcome) => this.handleOutcome(outcome));
		}
		toggle(currentTime = 0) {
			this.setEnabled(!this.state.peek().requested, currentTime);
		}
		setEnabled(enabled, currentTime = 0) {
			_GM_setValue(STORAGE_KEY, enabled);
			this.state.value = {
				requested: enabled,
				status: enabled ? "detecting" : "off"
			};
			this.applyPagePresentation(false);
			const url = new URL(location.href);
			const resumeTime = Number.isFinite(currentTime) ? Math.max(0, Math.floor(currentTime)) : 0;
			if (resumeTime > 0) url.searchParams.set("t", String(resumeTime));
			else url.searchParams.delete("t");
			location.replace(url.href);
		}
		handleOutcome(outcome) {
			if (outcome.reason === "not-playurl") return;
			const active = outcome.supported;
			this.state.value = {
				requested: true,
				status: active ? "active" : "fallback",
				reason: outcome.reason
			};
			this.applyPagePresentation(active);
			if (!this.diagnosticLogged) {
				this.diagnosticLogged = true;
				console.info("[Bilibili Music Player] audio-only", {
					status: active ? "active" : "fallback",
					reason: outcome.reason
				});
			}
		}
		applyPagePresentation(active) {
			const root = document.documentElement;
			if (!root) {
				document.addEventListener("readystatechange", () => this.applyPagePresentation(this.state.peek().status === "active"), { once: true });
				return;
			}
			if (active) {
				ensurePageStyle(root);
				root.setAttribute(ROOT_ATTRIBUTE, "active");
			} else root.removeAttribute(ROOT_ATTRIBUTE);
		}
	};
	function createInitialState() {
		const stored = _GM_getValue(STORAGE_KEY, false);
		const requested = stored === true || stored === 1 || stored === "1";
		return {
			requested,
			status: requested ? "detecting" : "off"
		};
	}
	function ensurePageStyle(root) {
		if (document.getElementById(STYLE_ID)) return;
		const style = document.createElement("style");
		style.id = STYLE_ID;
		style.textContent = PAGE_STYLE;
		(document.head ?? root).append(style);
	}
	var audioOnlyController = new AudioOnlyController();
	var MediaLocator = class {
		listener;
		current = null;
		currentUrl = location.href;
		mutationObserver;
		scanTimer;
		routeTimer;
		scanQueued = false;
		constructor(listener) {
			this.listener = listener;
		}
		start() {
			this.scan();
			this.mutationObserver = new MutationObserver(() => this.queueScan());
			this.mutationObserver.observe(document.documentElement, {
				childList: true,
				subtree: true
			});
			this.scanTimer = window.setInterval(() => this.scan(), 1e3);
			this.routeTimer = window.setInterval(() => {
				if (location.href === this.currentUrl) return;
				this.currentUrl = location.href;
				this.listener(this.current, "route");
				this.queueScan();
			}, 300);
		}
		stop() {
			this.mutationObserver?.disconnect();
			window.clearInterval(this.scanTimer);
			window.clearInterval(this.routeTimer);
		}
		queueScan() {
			if (this.scanQueued) return;
			this.scanQueued = true;
			window.setTimeout(() => {
				this.scanQueued = false;
				this.scan();
			}, 100);
		}
		scan() {
			const candidate = findActiveMedia();
			if (candidate === this.current) return;
			this.current = candidate;
			this.listener(candidate, "media");
		}
	};
	function findActiveMedia() {
		return [...document.querySelectorAll("video, audio")].filter((media) => media.isConnected && !media.closest("#bilibili-music-player-host") && media.getAttribute("aria-hidden") !== "true").sort((left, right) => mediaScore(right) - mediaScore(left))[0] ?? null;
	}
	function mediaScore(media) {
		const area = media.clientWidth * media.clientHeight;
		const ready = media.readyState > 0 ? 1e6 : 0;
		const hasDuration = Number.isFinite(media.duration) ? 1e5 : 0;
		return (media.paused ? 0 : 1e7) + ready + hasDuration + area;
	}
	function selectAdjacentTrack(playlist, currentTrackId, mode, options) {
		const tracks = playlist?.tracks ?? [];
		if (tracks.length === 0) return;
		const currentIndex = Math.max(0, tracks.findIndex((track) => track.id === currentTrackId));
		if (mode === "single-loop" && options.automatic) return tracks[currentIndex];
		if (mode === "shuffle" && tracks.length > 1) {
			const random = options.random ?? Math.random;
			return tracks[(currentIndex + (1 + Math.floor(random() * (tracks.length - 1)))) % tracks.length];
		}
		const nextIndex = currentIndex + options.direction;
		if (nextIndex >= 0 && nextIndex < tracks.length) return tracks[nextIndex];
		if (mode === "list-loop" || mode === "single-loop") return tracks[(nextIndex + tracks.length) % tracks.length];
	}
	var CHANNEL_NAME = "bilibili-music-player";
	var TabCoordinator = class {
		id = crypto.randomUUID();
		channel = typeof BroadcastChannel === "undefined" ? void 0 : new BroadcastChannel(CHANNEL_NAME);
		constructor(onOtherTabClaimed) {
			if (this.channel) this.channel.onmessage = (event) => {
				const message = event.data;
				if (message.type === "claim" && message.tabId !== this.id) onOtherTabClaimed();
			};
		}
		claim() {
			this.channel?.postMessage({
				type: "claim",
				tabId: this.id
			});
		}
		close() {
			this.channel?.close();
		}
	};
	var INITIAL_RUNTIME_STATE = {
		mediaReady: false,
		playing: false,
		currentTime: 0,
		duration: 0,
		volume: 1,
		muted: false,
		playbackContext: "page",
		nowPlaying: {
			title: "未连接到 Bilibili 播放器",
			startTime: 0,
			storedDuration: 0
		},
		requiresInteraction: false
	};
	var PlayerEngine = class {
		store;
		state = y$1(INITIAL_RUNTIME_STATE);
		media = null;
		mediaEvents;
		positionSavedAt = 0;
		segmentAdvancing = false;
		locator;
		tabs;
		constructor(store) {
			this.store = store;
			this.locator = new MediaLocator((media, reason) => this.handleMediaChange(media, reason));
			this.tabs = new TabCoordinator(() => {
				if (this.media && !this.media.paused) {
					this.media.pause();
					this.setMessage("已由另一个 Bilibili 标签页接管播放");
				}
			});
		}
		start() {
			this.store.start();
			this.setPlaybackContext(this.shouldUsePlaylistContext() ? "playlist" : "page");
			this.locator.start();
			this.installMediaSessionHandlers();
			window.addEventListener("pagehide", this.savePosition);
		}
		stop() {
			this.savePosition();
			this.mediaEvents?.abort();
			this.locator.stop();
			this.tabs.close();
			this.store.stop();
			window.removeEventListener("pagehide", this.savePosition);
		}
		get currentMedia() {
			return this.media;
		}
		async togglePlayback() {
			if (!this.media) {
				this.setMessage("尚未找到 Bilibili 播放器");
				return;
			}
			if (!this.media.paused) {
				this.media.pause();
				return;
			}
			const data = this.store.data.peek();
			const track = this.store.findTrack(data.playback.trackId);
			if (this.isPlaylistContext() && data.playback.resumeRequested && track && !this.isCurrentPage(track)) {
				this.playTrack(track);
				return;
			}
			await this.tryPlay();
		}
		seek(time) {
			if (!this.media || !Number.isFinite(this.media.duration)) return;
			this.media.currentTime = clamp(time, 0, this.media.duration);
			this.syncRuntime();
		}
		setVolume(volume) {
			const normalized = clamp(volume, 0, 1);
			this.store.setVolume(normalized);
			if (this.media) {
				this.media.volume = normalized;
				this.media.muted = false;
			}
		}
		toggleMute() {
			if (this.media) this.media.muted = !this.media.muted;
		}
		setPlayMode(mode) {
			this.store.setPlayMode(mode);
		}
		exitPlaylistPlayback() {
			if (this.store.data.peek().playback.resumeRequested) this.store.consumeResumeRequest();
			this.exitPlaylistContext();
		}
		playTrack(track) {
			this.store.requestTrack(track);
			this.setPlaybackContext("playlist");
			if (!this.isCurrentPage(track)) {
				location.assign(buildTrackUrl(track));
				return;
			}
			this.setPlaylistRouteMarker(true);
			this.refreshPageMetadata();
			this.resumeRequestedTrack();
		}
		next(automatic = false) {
			const data = this.store.data.peek();
			const track = selectAdjacentTrack(data.playlists.find((item) => item.id === data.playback.playlistId), data.playback.trackId, data.playMode, {
				direction: 1,
				automatic
			});
			if (!track) {
				this.media?.pause();
				this.exitPlaylistContext();
				this.setMessage("播放列表已结束");
				return;
			}
			this.playTrack(track);
		}
		previous() {
			const data = this.store.data.peek();
			const track = selectAdjacentTrack(data.playlists.find((item) => item.id === data.playback.playlistId), data.playback.trackId, data.playMode, { direction: -1 });
			if (track) this.playTrack(track);
		}
		handleMediaChange(media, reason) {
			if (media !== this.media) this.bindMedia(media);
			if (reason === "route") {
				this.setPlaybackContext(this.shouldUsePlaylistContext() ? "playlist" : "page");
				this.refreshPageMetadata();
				window.setTimeout(() => this.refreshPageMetadata(), 1e3);
			}
			if (media && this.isPlaylistContext() && this.store.data.peek().playback.resumeRequested) this.resumeRequestedTrack();
		}
		bindMedia(media) {
			this.mediaEvents?.abort();
			this.mediaEvents = void 0;
			this.media = media;
			if (!media) {
				const playbackContext = this.state.peek().playbackContext;
				this.state.value = {
					...INITIAL_RUNTIME_STATE,
					volume: this.store.data.peek().volume,
					playbackContext
				};
				return;
			}
			media.volume = this.store.data.peek().volume;
			const controller = new AbortController();
			const options = { signal: controller.signal };
			this.mediaEvents = controller;
			media.addEventListener("play", this.handlePlay, options);
			media.addEventListener("pause", this.syncRuntime, options);
			media.addEventListener("timeupdate", this.handleTimeUpdate, options);
			media.addEventListener("durationchange", this.syncRuntime, options);
			media.addEventListener("loadedmetadata", this.handleLoadedMetadata, options);
			media.addEventListener("volumechange", this.syncRuntime, options);
			media.addEventListener("ended", this.handleEnded, options);
			this.refreshPageMetadata();
			this.syncRuntime();
		}
		handlePlay = () => {
			this.tabs.claim();
			this.state.value = {
				...this.state.peek(),
				playing: true,
				requiresInteraction: false,
				message: void 0
			};
			this.updateMediaSession();
		};
		handleTimeUpdate = () => {
			this.syncRuntime();
			const track = this.getActiveTrack();
			if (track?.endTime !== void 0 && this.media && this.media.currentTime >= track.endTime - .15 && !this.segmentAdvancing) {
				this.segmentAdvancing = true;
				this.next(true);
				window.setTimeout(() => {
					this.segmentAdvancing = false;
				}, 500);
				return;
			}
			if (this.media && Date.now() - this.positionSavedAt >= 1e4 && track) {
				this.positionSavedAt = Date.now();
				this.store.savePosition(this.media.currentTime);
			}
		};
		handleLoadedMetadata = () => {
			this.syncRuntime();
			if (this.isPlaylistContext() && this.store.data.peek().playback.resumeRequested) this.resumeRequestedTrack();
		};
		handleEnded = () => {
			if (this.getActiveTrack()) this.next(true);
		};
		syncRuntime = () => {
			if (!this.media) return;
			this.state.value = {
				...this.state.peek(),
				mediaReady: this.media.readyState > 0,
				playing: !this.media.paused,
				currentTime: this.media.currentTime || 0,
				duration: Number.isFinite(this.media.duration) ? this.media.duration : 0,
				volume: this.media.volume,
				muted: this.media.muted
			};
			this.updateMediaPosition();
		};
		async resumeRequestedTrack() {
			const media = this.media;
			const data = this.store.data.peek();
			const track = this.store.findTrack(data.playback.trackId);
			if (!this.isPlaylistContext() || !media || !track || !this.isCurrentPage(track)) return;
			if (media.readyState === 0) return;
			const resumeTime = data.playback.currentTime >= track.startTime && (track.endTime === void 0 || data.playback.currentTime < track.endTime) ? data.playback.currentTime : track.startTime;
			media.currentTime = clamp(resumeTime, 0, Number.isFinite(media.duration) ? media.duration : resumeTime);
			this.refreshPageMetadata();
			this.store.consumeResumeRequest();
			await this.tryPlay();
		}
		async tryPlay() {
			if (!this.media) return;
			try {
				this.tabs.claim();
				await this.media.play();
				this.state.value = {
					...this.state.peek(),
					requiresInteraction: false,
					message: void 0
				};
			} catch {
				this.state.value = {
					...this.state.peek(),
					requiresInteraction: true,
					message: "浏览器阻止了自动播放，请点击播放按钮继续"
				};
			}
		}
		refreshPageMetadata() {
			const track = this.getActiveTrack();
			const metadata = readCurrentVideoMetadata();
			this.state.value = {
				...this.state.peek(),
				nowPlaying: {
					trackId: track?.id,
					title: track?.title ?? metadata?.title ?? "Bilibili 音乐播放器",
					uploader: metadata?.uploader ?? track?.uploader,
					cover: metadata?.cover ?? track?.cover,
					startTime: track?.startTime ?? 0,
					endTime: track?.endTime,
					storedDuration: track?.duration ?? 0
				}
			};
			this.updateMediaSession();
		}
		getActiveTrack() {
			if (!this.isPlaylistContext()) return;
			const track = this.store.findTrack(this.store.data.peek().playback.trackId);
			return track && this.isCurrentPage(track) ? track : void 0;
		}
		isPlaylistContext() {
			return this.state.peek().playbackContext === "playlist";
		}
		shouldUsePlaylistContext() {
			if (!hasPlaylistRouteMarker()) return false;
			const track = this.store.findTrack(this.store.data.peek().playback.trackId);
			return Boolean(track && this.isCurrentPage(track));
		}
		setPlaybackContext(playbackContext) {
			if (this.state.peek().playbackContext === playbackContext) return;
			this.state.value = {
				...this.state.peek(),
				playbackContext
			};
		}
		exitPlaylistContext() {
			this.setPlaybackContext("page");
			this.setPlaylistRouteMarker(false);
			this.refreshPageMetadata();
		}
		setPlaylistRouteMarker(enabled) {
			const url = new URL(location.href);
			if (enabled) url.searchParams.set("bili_music", "1");
			else url.searchParams.delete("bili_music");
			if (url.href !== location.href) history.replaceState(history.state, "", url);
		}
		isCurrentPage(track) {
			return getBvid()?.toLowerCase() === track.bvid.toLowerCase() && (track.page ?? 1) === (getPageNumber() ?? 1);
		}
		setMessage(message) {
			this.state.value = {
				...this.state.peek(),
				message
			};
		}
		savePosition = () => {
			if (this.media && this.getActiveTrack()) this.store.savePosition(this.media.currentTime);
		};
		installMediaSessionHandlers() {
			if (!("mediaSession" in navigator)) return;
			const handlers = {
				play: () => void this.togglePlayback(),
				pause: () => this.media?.pause(),
				previoustrack: () => this.previous(),
				nexttrack: () => this.next(),
				seekto: (details) => {
					if (details.seekTime !== void 0) this.seek(details.seekTime);
				},
				seekbackward: (details) => this.seek((this.media?.currentTime ?? 0) - (details.seekOffset ?? 10)),
				seekforward: (details) => this.seek((this.media?.currentTime ?? 0) + (details.seekOffset ?? 10))
			};
			for (const [action, handler] of Object.entries(handlers)) try {
				navigator.mediaSession.setActionHandler(action, handler ?? null);
			} catch {}
		}
		updateMediaSession() {
			if (!("mediaSession" in navigator)) return;
			const { nowPlaying } = this.state.peek();
			navigator.mediaSession.metadata = new MediaMetadata({
				title: nowPlaying.title,
				artist: nowPlaying.uploader ?? "Bilibili",
				album: "Bilibili Music Player",
				artwork: nowPlaying.cover ? [{
					src: nowPlaying.cover,
					sizes: "512x512",
					type: "image/jpeg"
				}] : []
			});
		}
		updateMediaPosition() {
			if (!("mediaSession" in navigator) || !this.media || !Number.isFinite(this.media.duration) || this.media.duration <= 0) return;
			try {
				navigator.mediaSession.setPositionState({
					duration: this.media.duration,
					playbackRate: this.media.playbackRate,
					position: clamp(this.media.currentTime, 0, this.media.duration)
				});
			} catch {}
		}
	};
	function buildTrackUrl(track) {
		const url = new URL(`/video/${track.bvid}/`, location.origin);
		if (track.page && track.page > 1) url.searchParams.set("p", String(track.page));
		url.searchParams.set("bili_music", "1");
		return url.href;
	}
	function hasPlaylistRouteMarker(url = location.href) {
		return new URL(url).searchParams.get("bili_music") === "1";
	}
	var HOST_ID = "bilibili-music-player-host";
	var BILIBILI_PLAYER_SELECTOR = ".bpx-player-container";
	var BILIBILI_WEB_FULLSCREEN_SELECTOR = `${BILIBILI_PLAYER_SELECTOR}[data-screen="web"]`;
	audioOnlyController.start();
	function containsBilibiliPlayer(node) {
		return node instanceof Element && (node.matches(BILIBILI_PLAYER_SELECTOR) || node.querySelector(BILIBILI_PLAYER_SELECTOR) !== null);
	}
	function observeWebFullscreen(host) {
		const syncVisibility = () => {
			host.toggleAttribute("data-web-fullscreen", document.querySelector(BILIBILI_WEB_FULLSCREEN_SELECTOR) !== null);
		};
		const observer = new MutationObserver((mutations) => {
			if (mutations.some((mutation) => mutation.type === "attributes" || [...mutation.addedNodes, ...mutation.removedNodes].some(containsBilibiliPlayer))) syncVisibility();
		});
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["data-screen"],
			childList: true,
			subtree: true
		});
		syncVisibility();
		return () => observer.disconnect();
	}
	function mount() {
		if (document.getElementById(HOST_ID)) return;
		const host = document.createElement("div");
		host.id = HOST_ID;
		const shadowRoot = host.attachShadow({ mode: "open" });
		const mountPoint = document.createElement("div");
		mountPoint.id = "bilibili-music-player-root";
		shadowRoot.append(styles_css_default, mountPoint);
		document.documentElement.append(host);
		const stopObservingWebFullscreen = observeWebFullscreen(host);
		const engine = new PlayerEngine(appStore);
		engine.start();
		R(u$1(App, {
			store: appStore,
			engine,
			audioOnly: audioOnlyController
		}), mountPoint);
		window.addEventListener("pagehide", () => {
			stopObservingWebFullscreen();
			engine.stop();
			R(null, mountPoint);
		}, { once: true });
	}
	if (document.documentElement) mount();
	else document.addEventListener("readystatechange", mount, { once: true });
})();

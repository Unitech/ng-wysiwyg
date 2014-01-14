/**
 * Copyright (c) 2012, Leon Sorokin
 * All rights reserved. (MIT Licensed)
 *
 * reMarked.js - DOM > markdown
 */

reMarked = function(opts) {

  var links = [];
  var cfg = {
    link_list:	false,			// render links as references, create link list as appendix
    //  link_near:					// cite links immediately after blocks
    h1_setext:	true,			// underline h1 headers
    h2_setext:	true,			// underline h2 headers
    h_atx_suf:	false,			// header suffix (###)
    //	h_compact:	true,			// compact headers (except h1)
    gfm_code:	false,			// render code blocks as via ``` delims
    li_bullet:	"*-+"[0],		// list item bullet style
    //	list_indnt:					// indent top-level lists
    hr_char:	"-_*"[0],		// hr style
    indnt_str:	["    ","\t","  "][0],	// indentation string
    bold_char:	"*_"[0],		// char used for strong
    emph_char:	"*_"[1],		// char used for em
    gfm_del:	true,			// ~~strikeout~~ for <del>strikeout</del>
    gfm_tbls:	true,			// markdown-extra tables
    tbl_edges:	false,			// show side edges on tables
    hash_lnks:	false,			// anchors w/hash hrefs as links
    br_only:	false,			// avoid using "  " as line break indicator
  };

  extend(cfg, opts);

  function extend(a, b) {
    if (!b) return a;
    for (var i in a) {
      if (typeof b[i] !== "undefined")
	a[i] = b[i];
    }
  }

  function rep(str, num) {
    var s = "";
    while (num-- > 0)
      s += str;
    return s;
  }

  function trim12(str) {
    var	str = str.replace(/^\s\s*/, ''),
	ws = /\s/,
	i = str.length;
    while (ws.test(str.charAt(--i)));
    return str.slice(0, i + 1);
  }

  function lpad(targ, padStr, len) {
    return rep(padStr, len - targ.length) + targ;
  }

  function rpad(targ, padStr, len) {
    return targ + rep(padStr, len - targ.length);
  }

  function otag(tag) {
    if (!tag) return "";
    return "<" + tag + ">";
  }

  function ctag(tag) {
    if (!tag) return "";
    return "</" + tag + ">";
  }

  function pfxLines(txt, pfx)	{
    return txt.replace(/^/gm, pfx);
  }

  function nodeName(e) {
    return (e.nodeName == "#text" ? "txt" : e.nodeName).toLowerCase();
  }

  function wrap(str, opts) {
    var pre, suf;

    if (opts instanceof Array) {
      pre = opts[0];
      suf = opts[1];
    }
    else
      pre = suf = opts;

    pre = pre instanceof Function ? pre.call(this, str) : pre;
    suf = suf instanceof Function ? suf.call(this, str) : suf;

    return pre + str + suf;
  }

  this.render = function(ctr) {
    if (typeof ctr == "string") {
      var htmlstr = ctr;
      ctr = document.createElement("div");
      ctr.innerHTML = htmlstr;
    }
    var s = new lib.tag(ctr, null, 0);
    var re = s.rend().replace(/^[\t ]+\n/gm, "\n");
    if (cfg.link_list) {
      // hack
      re += "\n\n";
      var maxlen = 0;
      // get longest link href with title, TODO: use getAttribute?
      for (var y in links) {
	if (!links[y].e.title) continue;
	var len = links[y].e.href.length;
	if (len && len > maxlen)
	  maxlen = len;
      }

      for (var k in links) {
	var title = links[k].e.title ? rep(" ", (maxlen + 2) - links[k].e.href.length) + '"' + links[k].e.title + '"' : "";
	re += "  [" + (+k+1) + "]: " + links[k].e.href + title + "\n";
      }
    }

    return re.replace(/^[\t ]+\n/gm, "\n");
  };

  var lib = {};

  lib.tag = klass({
    wrap: "",
    lnPfx: "",		// only block
    lnInd: 0,		// only block
    init: function(e, p, i)
    {
      this.e = e;
      this.p = p;
      this.i = i;
      this.c = [];
      this.tag = nodeName(e);

      this.initK();
    },

    initK: function()
    {
      var i;
      if (this.e.hasChildNodes()) {
	// inline elems allowing adjacent whitespace text nodes to be rendered
	var inlRe = /^(?:a|strong|code|em|sub|sup|del|i|u|b|big|center)$/, n, name;
	for (i in this.e.childNodes) {
	  if (!/\d+/.test(i)) continue;

	  n = this.e.childNodes[i];
	  name = nodeName(n);

	  // ignored tags
	  if (/style|script|canvas|video|audio/.test(name))
	    continue;

	  // empty whitespace handling
	  if (name == "txt" && /^\s+$/.test(n.textContent)) {
	    // ignore if first or last child (trim)
	    if (i == 0 || i == this.e.childNodes.length - 1)
	      continue;

	    // only ouput when has an adjacent inline elem
	    var prev = this.e.childNodes[i-1],
		next = this.e.childNodes[i+1];
	    if (prev && !nodeName(prev).match(inlRe) || next && !nodeName(next).match(inlRe))
	      continue;
	  }
	  if (!lib[name])
	    name = "tag";

	  var node = new lib[name](n, this, this.c.length);

	  if (node instanceof lib.a && n.href || node instanceof lib.img) {
	    node.lnkid = links.length;
	    links.push(node);
	  }

	  this.c.push(node);
	}
      }
    },

    rend: function()
    {
      return this.rendK().replace(/\n{3,}/gm, "\n\n");		// can screw up pre and code :(
    },

    rendK: function()
    {
      var n, buf = "";
      for (var i in this.c) {
	n = this.c[i];
	buf += (n.bef || "") + n.rend() + (n.aft || "");
      }
      return buf.replace(/^\n+|\n+$/, "");
    }
  });

  lib.blk = lib.tag.extend({
    wrap: ["\n\n", ""],
    wrapK: null,
    tagr: false,
    lnInd: null,
    init: function(e, p ,i) {
      this.supr(e,p,i);

      // kids indented
      if (this.lnInd === null) {
	if (this.p && this.tagr && this.c[0] instanceof lib.blk)
	  this.lnInd = 4;
	else
	  this.lnInd = 0;
      }

      // kids wrapped?
      if (this.wrapK === null) {
	if (this.tagr && this.c[0] instanceof lib.blk)
	  this.wrapK = "\n";
	else
	  this.wrapK = "";
      }
    },

    rend: function()
    {
      return wrap.call(this, (this.tagr ? otag(this.tag) : "") + wrap.call(this, pfxLines(pfxLines(this.rendK(), this.lnPfx), rep(" ", this.lnInd)), this.wrapK) + (this.tagr ? ctag(this.tag) : ""), this.wrap);
    },

    rendK: function()
    {
      var kids = this.supr();
      // remove min uniform leading spaces from block children. marked.js's list outdent algo sometimes leaves these
      if (this.p instanceof lib.li) {
	var repl = null, spcs = kids.match(/^[\t ]+/gm);
	if (!spcs) return kids;
	for (var i in spcs) {
	  if (repl === null || spcs[i][0].length < repl.length)
	    repl = spcs[i][0];
	}
	return kids.replace(new RegExp("^" + repl), "");
      }
      return kids;
    }
  });

  lib.tblk = lib.blk.extend({tagr: true});

  lib.cblk = lib.blk.extend({wrap: ["\n", ""]});
  lib.ctblk = lib.cblk.extend({tagr: true});

  lib.inl = lib.tag.extend({
    rend: function()
    {
      return wrap.call(this, this.rendK(), this.wrap);
    }
  });

  lib.tinl = lib.inl.extend({
    tagr: true,
    rend: function()
    {
      return otag(this.tag) + wrap.call(this, this.rendK(), this.wrap) + ctag(this.tag);
    }
  });

  lib.p = lib.blk.extend({
    rendK: function() {
      return this.supr().replace(/^\s+/gm, "");
    }
  });

  lib.div = lib.p.extend();

  lib.span = lib.inl.extend();

  lib.list = lib.blk.extend({
    expn: false,
    wrap: [function(){return this.p instanceof lib.li ? "\n" : "\n\n";}, ""]
  });

  lib.ul = lib.list.extend({});

  lib.ol = lib.list.extend({});

  lib.li = lib.cblk.extend({
    wrap: ["\n", function(kids) {
      return this.p.expn || kids.match(/\n{2}/gm) ? "\n" : "";			// || this.kids.match(\n)
    }],
    wrapK: [function() {
      return this.p.tag == "ul" ? cfg.li_bullet + " " : (this.i + 1) + ".  ";
    }, ""],
    rendK: function() {
      return this.supr().replace(/\n([^\n])/gm, "\n" + cfg.indnt_str + "$1");
    }
  });

  lib.hr = lib.blk.extend({
    wrap: ["\n\n", rep(cfg.hr_char, 3)]
  });

  lib.h = lib.blk.extend({});

  lib.h_setext = lib.h.extend({});

  cfg.h1_setext && (lib.h1 = lib.h_setext.extend({
    wrapK: ["", function(kids) {
      return "\n" + rep("=", kids.length);
    }]
  }));

  cfg.h2_setext && (lib.h2 = lib.h_setext.extend({
    wrapK: ["", function(kids) {
      return "\n" + rep("-", kids.length);
    }]
  }));

  lib.h_atx = lib.h.extend({
    wrapK: [
      function(kids) {
	return rep("#", this.tag[1]) + " ";
      },
      function(kids) {
	return cfg.h_atx_suf ? " " + rep("#", this.tag[1]) : "";
      }
    ]
  });
  !cfg.h1_setext && (lib.h1 = lib.h_atx.extend({}));

  !cfg.h2_setext && (lib.h2 = lib.h_atx.extend({}));

  lib.h3 = lib.h_atx.extend({});

  lib.h4 = lib.h_atx.extend({});

  lib.h5 = lib.h_atx.extend({});

  lib.h6 = lib.h_atx.extend({});

  lib.a = lib.inl.extend({
    lnkid: null,
    rend: function() {
      var kids = this.rendK(),
	  href = this.e.getAttribute("href"),
	  title = this.e.title ? ' "' + this.e.title + '"' : "";

      if (!href || href == kids || href[0] == "#" && !cfg.hash_lnks)
	return kids;

      if (cfg.link_list)
	return "[" + kids + "] [" + (this.lnkid + 1) + "]";

      return "[" + kids + "](" + href + title + ")";
    }
  });

  // almost identical to links, maybe merge
  lib.img = lib.inl.extend({
    lnkid: null,
    rend: function() {
      var kids = this.e.alt,
	  src = this.e.getAttribute("src");

      if (cfg.link_list)
	return "[" + kids + "] [" + (this.lnkid + 1) + "]";

      var title = this.e.title ? ' "'+ this.e.title + '"' : "";

      return "![" + kids + "](" + src + title + ")";
    }
  });


  lib.em = lib.inl.extend({wrap: cfg.emph_char});

  lib.i = lib.em.extend();

  lib.del = cfg.gfm_del ? lib.inl.extend({wrap: "~~"}) : lib.tinl.extend();

  lib.br = lib.inl.extend({
    wrap: ["", function() {
      var end = cfg.br_only ? "<br>" : "  ";
      // br in headers output as html
      return this.p instanceof lib.h ? "<br>" : end + "\n";
    }]
  });

  lib.strong = lib.inl.extend({wrap: rep(cfg.bold_char, 2)});

  lib.b = lib.strong.extend();

  lib.dl = lib.tblk.extend({lnInd: 2});

  lib.dt = lib.ctblk.extend();

  lib.dd = lib.ctblk.extend();

  lib.sub = lib.tinl.extend();

  lib.sup = lib.tinl.extend();

  lib.blockquote = lib.blk.extend({
    lnPfx: "> ",
    rend: function() {
      return this.supr().replace(/>[ \t]$/gm, ">");
    }
  });

  // can render with or without tags
  lib.pre = lib.blk.extend({
    tagr: true,
    wrapK: "\n",
    lnInd: 0
  });

  // can morph into inline based on context
  lib.code = lib.blk.extend({
    tagr: false,
    wrap: "",
    wrapK: function(kids) {
      return kids.indexOf("`") !== -1 ? "``" : "`";	// esc double backticks
    },
    lnInd: 0,
    init: function(e, p, i) {
      this.supr(e, p, i);

      if (this.p instanceof lib.pre) {
	this.p.tagr = false;

	if (cfg.gfm_code) {
	  var cls = this.e.getAttribute("class");
	  cls = (cls || "").split(" ")[0];

	  if (cls.indexOf("lang-") === 0)			// marked uses "lang-" prefix now
	    cls = cls.substr(5);

	  this.wrapK = ["```" + cls + "\n", "\n```"];
	}
	else {
	  this.wrapK = "";
	  this.p.lnInd = 4;
	}
      }
    }
  });

  lib.table = cfg.gfm_tbls ? lib.blk.extend({
    cols: [],
    init: function(e, p, i) {
      this.supr(e, p, i);
      this.cols = [];
    },
    rend: function() {
      // run prep on all cells to get max col widths
      for (var tsec in this.c)
	for (var row in this.c[tsec].c)
	  for (var cell in this.c[tsec].c[row].c)
	    this.c[tsec].c[row].c[cell].prep();

      return this.supr();
    }
  }) : lib.tblk.extend();

  lib.thead = cfg.gfm_tbls ? lib.cblk.extend({
    wrap: ["\n", function(kids) {
      var buf = "";
      for (var i in this.p.cols) {
	var col = this.p.cols[i],
	    al = col.a[0] == "c" ? ":" : " ",
	    ar = col.a[0] == "r" || col.a[0] == "c" ? ":" : " ";

	buf += (i == 0 && cfg.tbl_edges ? "|" : "") + al + rep("-", col.w) + ar + (i < this.p.cols.length-1 || cfg.tbl_edges ? "|" : "");
      }
      return "\n" + trim12(buf);
    }]
  }) : lib.ctblk.extend();

  lib.tbody = cfg.gfm_tbls ? lib.cblk.extend() : lib.ctblk.extend();

  lib.tfoot = cfg.gfm_tbls ? lib.cblk.extend() : lib.ctblk.extend();

  lib.tr = cfg.gfm_tbls ? lib.cblk.extend({
    wrapK: [cfg.tbl_edges ? "| " : "", cfg.tbl_edges ? " |" : ""],
  }) : lib.ctblk.extend();

  lib.th = cfg.gfm_tbls ? lib.inl.extend({
    guts: null,
    // TODO: DRY?
    wrap: [function() {
      var col = this.p.p.p.cols[this.i],
	  spc = this.i == 0 ? "" : " ",
	  pad, fill = col.w - this.guts.length;

      switch (col.a[0]) {
      case "r": pad = rep(" ", fill); break;
      case "c": pad = rep(" ", Math.floor(fill/2)); break;
      default:  pad = "";
      }

      return spc + pad;
    }, function() {
      var col = this.p.p.p.cols[this.i],
	  edg = this.i == this.p.c.length - 1 ? "" : " |",
	  pad, fill = col.w - this.guts.length;

      switch (col.a[0]) {
      case "r": pad = ""; break;
      case "c": pad = rep(" ", Math.ceil(fill/2)); break;
      default:  pad = rep(" ", fill);
      }

      return pad + edg;
    }],
    prep: function() {
      this.guts = this.rendK();					// pre-render
      this.rendK = function() {return this.guts};

      var cols = this.p.p.p.cols;
      if (!cols[this.i])
	cols[this.i] = {w: null, a: ""};		// width and alignment
      var col = cols[this.i];
      col.w = Math.max(col.w || 0, this.guts.length);
      if (this.e.align)
	col.a = this.e.align;
    },
  }) : lib.ctblk.extend();

  lib.td = lib.th.extend();

  lib.txt = lib.inl.extend({
    initK: function()
    {
      this.c = this.e.textContent.split(/^/gm);
    },
    rendK: function()
    {
      var kids = this.c.join("").replace(/\r/gm, "");

      // this is strange, cause inside of code, inline should not be processed, but is?
      if (!(this.p instanceof lib.code || this.p instanceof lib.pre)) {
	kids = kids
	  .replace(/^\s*#/gm,"\\#")
	  .replace(/\*/gm,"\\*");
      }

      if (this.i == 0)
	kids = kids.replace(/^\n+/, "");
      if (this.i == this.p.c.length - 1)
	kids = kids.replace(/\n+$/, "");
      return kids;
    }
  });
};

/*!
 * klass: a classical JS OOP façade
 * https://github.com/ded/klass
 * License MIT (c) Dustin Diaz & Jacob Thornton 2012
 */
!function(a,b){typeof define=="function"?define(b):typeof module!="undefined"?module.exports=b():this[a]=b()}("klass",function(){function f(a){return j.call(g(a)?a:function(){},a,1)}function g(a){return typeof a===c}function h(a,b,c){return function(){var d=this.supr;this.supr=c[e][a];var f=b.apply(this,arguments);return this.supr=d,f}}function i(a,b,c){for(var f in b)b.hasOwnProperty(f)&&(a[f]=g(b[f])&&g(c[e][f])&&d.test(b[f])?h(f,b[f],c):b[f])}function j(a,b){function c(){}function l(){this.init?this.init.apply(this,arguments):(b||h&&d.apply(this,arguments),j.apply(this,arguments))}c[e]=this[e];var d=this,f=new c,h=g(a),j=h?a:this,k=h?{}:a;return l.methods=function(a){return i(f,a,d),l[e]=f,this},l.methods.call(l,k).prototype.constructor=l,l.extend=arguments.callee,l[e].implement=l.statics=function(a,b){return a=typeof a=="string"?function(){var c={};return c[a]=b,c}():a,i(this,a,d),this},l}var a=this,b=a.klass,c="function",d=/xyz/.test(function(){xyz})?/\bsupr\b/:/.*/,e="prototype";return f.noConflict=function(){return a.klass=b,this},a.klass=f,f});
;//
// showdown.js -- A javascript port of Markdown.
//
// Copyright (c) 2007 John Fraser.
//
// Original Markdown Copyright (c) 2004-2005 John Gruber
//   <http://daringfireball.net/projects/markdown/>
//
// Redistributable under a BSD-style open source license.
// See license.txt for more information.
//
// The full source distribution is at:
//
//				A A L
//				T C A
//				T K B
//
//   <http://www.attacklab.net/>
//
//
// Wherever possible, Showdown is a straight, line-by-line port
// of the Perl version of Markdown.
//
// This is not a normal parser design; it's basically just a
// series of string substitutions.  It's hard to read and
// maintain this way,  but keeping Showdown close to the original
// design makes it easier to port new features.
//
// More importantly, Showdown behaves like markdown.pl in most
// edge cases.  So web applications can do client-side preview
// in Javascript, and then build identical HTML on the server.
//
// This port needs the new RegExp functionality of ECMA 262,
// 3rd Edition (i.e. Javascript 1.5).  Most modern web browsers
// should do fine.  Even with the new regular expression features,
// We do a lot of work to emulate Perl's regex functionality.
// The tricky changes in this file mostly have the "attacklab:"
// label.  Major or self-explanatory changes don't.
//
// Smart diff tools like Araxis Merge will be able to match up
// this file with markdown.pl in a useful way.  A little tweaking
// helps: in a copy of markdown.pl, replace "#" with "//" and
// replace "$text" with "text".  Be sure to ignore whitespace
// and line endings.
//
//
// Showdown usage:
//
//   var text = "Markdown *rocks*.";
//
//   var converter = new Showdown.converter();
//   var html = converter.makeHtml(text);
//
//   alert(html);
//
// Note: move the sample code to the bottom of this
// file before uncommenting it.
//
//
// Showdown namespace
//
var Showdown={extensions:{}},forEach=Showdown.forEach=function(a,b){if(typeof a.forEach=="function")a.forEach(b);else{var c,d=a.length;for(c=0;c<d;c++)b(a[c],c,a)}},stdExtName=function(a){return a.replace(/[_-]||\s/g,"").toLowerCase()};Showdown.converter=function(a){var b,c,d,e=0,f=[],g=[];if(typeof module!="undefind"&&typeof exports!="undefined"&&typeof require!="undefind"){var h=require("fs");if(h){var i=h.readdirSync((__dirname||".")+"/extensions").filter(function(a){return~a.indexOf(".js")}).map(function(a){return a.replace(/\.js$/,"")});Showdown.forEach(i,function(a){var b=stdExtName(a);Showdown.extensions[b]=require("./extensions/"+a)})}}this.makeHtml=function(a){return b={},c={},d=[],a=a.replace(/~/g,"~T"),a=a.replace(/\$/g,"~D"),a=a.replace(/\r\n/g,"\n"),a=a.replace(/\r/g,"\n"),a="\n\n"+a+"\n\n",a=M(a),a=a.replace(/^[ \t]+$/mg,""),Showdown.forEach(f,function(b){a=k(b,a)}),a=z(a),a=m(a),a=l(a),a=o(a),a=K(a),a=a.replace(/~D/g,"$$"),a=a.replace(/~T/g,"~"),Showdown.forEach(g,function(b){a=k(b,a)}),a};if(a&&a.extensions){var j=this;Showdown.forEach(a.extensions,function(a){typeof a=="string"&&(a=Showdown.extensions[stdExtName(a)]);if(typeof a!="function")throw"Extension '"+a+"' could not be loaded.  It was either not found or is not a valid extension.";Showdown.forEach(a(j),function(a){a.type?a.type==="language"||a.type==="lang"?f.push(a):(a.type==="output"||a.type==="html")&&g.push(a):g.push(a)})})}var k=function(a,b){if(a.regex){var c=new RegExp(a.regex,"g");return b.replace(c,a.replace)}if(a.filter)return a.filter(b)},l=function(a){return a+="~0",a=a.replace(/^[ ]{0,3}\[(.+)\]:[ \t]*\n?[ \t]*<?(\S+?)>?[ \t]*\n?[ \t]*(?:(\n*)["(](.+?)[")][ \t]*)?(?:\n+|(?=~0))/gm,function(a,d,e,f,g){return d=d.toLowerCase(),b[d]=G(e),f?f+g:(g&&(c[d]=g.replace(/"/g,"&quot;")),"")}),a=a.replace(/~0/,""),a},m=function(a){a=a.replace(/\n/g,"\n\n");var b="p|div|h[1-6]|blockquote|pre|table|dl|ol|ul|script|noscript|form|fieldset|iframe|math|ins|del|style|section|header|footer|nav|article|aside",c="p|div|h[1-6]|blockquote|pre|table|dl|ol|ul|script|noscript|form|fieldset|iframe|math|style|section|header|footer|nav|article|aside";return a=a.replace(/^(<(p|div|h[1-6]|blockquote|pre|table|dl|ol|ul|script|noscript|form|fieldset|iframe|math|ins|del)\b[^\r]*?\n<\/\2>[ \t]*(?=\n+))/gm,n),a=a.replace(/^(<(p|div|h[1-6]|blockquote|pre|table|dl|ol|ul|script|noscript|form|fieldset|iframe|math|style|section|header|footer|nav|article|aside)\b[^\r]*?<\/\2>[ \t]*(?=\n+)\n)/gm,n),a=a.replace(/(\n[ ]{0,3}(<(hr)\b([^<>])*?\/?>)[ \t]*(?=\n{2,}))/g,n),a=a.replace(/(\n\n[ ]{0,3}<!(--[^\r]*?--\s*)+>[ \t]*(?=\n{2,}))/g,n),a=a.replace(/(?:\n\n)([ ]{0,3}(?:<([?%])[^\r]*?\2>)[ \t]*(?=\n{2,}))/g,n),a=a.replace(/\n\n/g,"\n"),a},n=function(a,b){var c=b;return c=c.replace(/\n\n/g,"\n"),c=c.replace(/^\n/,""),c=c.replace(/\n+$/g,""),c="\n\n~K"+(d.push(c)-1)+"K\n\n",c},o=function(a){a=v(a);var b=A("<hr />");return a=a.replace(/^[ ]{0,2}([ ]?\*[ ]?){3,}[ \t]*$/gm,b),a=a.replace(/^[ ]{0,2}([ ]?\-[ ]?){3,}[ \t]*$/gm,b),a=a.replace(/^[ ]{0,2}([ ]?\_[ ]?){3,}[ \t]*$/gm,b),a=x(a),a=y(a),a=E(a),a=m(a),a=F(a),a},p=function(a){return a=B(a),a=q(a),a=H(a),a=t(a),a=r(a),a=I(a),a=G(a),a=D(a),a=a.replace(/  +\n/g," <br />\n"),a},q=function(a){var b=/(<[a-z\/!$]("[^"]*"|'[^']*'|[^'">])*>|<!(--.*?--\s*)+>)/gi;return a=a.replace(b,function(a){var b=a.replace(/(.)<\/?code>(?=.)/g,"$1`");return b=N(b,"\\`*_"),b}),a},r=function(a){return a=a.replace(/(\[((?:\[[^\]]*\]|[^\[\]])*)\][ ]?(?:\n[ ]*)?\[(.*?)\])()()()()/g,s),a=a.replace(/(\[((?:\[[^\]]*\]|[^\[\]])*)\]\([ \t]*()<?(.*?(?:\(.*?\).*?)?)>?[ \t]*((['"])(.*?)\6[ \t]*)?\))/g,s),a=a.replace(/(\[([^\[\]]+)\])()()()()()/g,s),a},s=function(a,d,e,f,g,h,i,j){j==undefined&&(j="");var k=d,l=e,m=f.toLowerCase(),n=g,o=j;if(n==""){m==""&&(m=l.toLowerCase().replace(/ ?\n/g," ")),n="#"+m;if(b[m]!=undefined)n=b[m],c[m]!=undefined&&(o=c[m]);else{if(!(k.search(/\(\s*\)$/m)>-1))return k;n=""}}n=N(n,"*_");var p='<a href="'+n+'"';return o!=""&&(o=o.replace(/"/g,"&quot;"),o=N(o,"*_"),p+=' title="'+o+'"'),p+=">"+l+"</a>",p},t=function(a){return a=a.replace(/(!\[(.*?)\][ ]?(?:\n[ ]*)?\[(.*?)\])()()()()/g,u),a=a.replace(/(!\[(.*?)\]\s?\([ \t]*()<?(\S+?)>?[ \t]*((['"])(.*?)\6[ \t]*)?\))/g,u),a},u=function(a,d,e,f,g,h,i,j){var k=d,l=e,m=f.toLowerCase(),n=g,o=j;o||(o="");if(n==""){m==""&&(m=l.toLowerCase().replace(/ ?\n/g," ")),n="#"+m;if(b[m]==undefined)return k;n=b[m],c[m]!=undefined&&(o=c[m])}l=l.replace(/"/g,"&quot;"),n=N(n,"*_");var p='<img src="'+n+'" alt="'+l+'"';return o=o.replace(/"/g,"&quot;"),o=N(o,"*_"),p+=' title="'+o+'"',p+=" />",p},v=function(a){function b(a){return a.replace(/[^\w]/g,"").toLowerCase()}return a=a.replace(/^(.+)[ \t]*\n=+[ \t]*\n+/gm,function(a,c){return A('<h1 id="'+b(c)+'">'+p(c)+"</h1>")}),a=a.replace(/^(.+)[ \t]*\n-+[ \t]*\n+/gm,function(a,c){return A('<h2 id="'+b(c)+'">'+p(c)+"</h2>")}),a=a.replace(/^(\#{1,6})[ \t]*(.+?)[ \t]*\#*\n+/gm,function(a,c,d){var e=c.length;return A("<h"+e+' id="'+b(d)+'">'+p(d)+"</h"+e+">")}),a},w,x=function(a){a+="~0";var b=/^(([ ]{0,3}([*+-]|\d+[.])[ \t]+)[^\r]+?(~0|\n{2,}(?=\S)(?![ \t]*(?:[*+-]|\d+[.])[ \t]+)))/gm;return e?a=a.replace(b,function(a,b,c){var d=b,e=c.search(/[*+-]/g)>-1?"ul":"ol";d=d.replace(/\n{2,}/g,"\n\n\n");var f=w(d);return f=f.replace(/\s+$/,""),f="<"+e+">"+f+"</"+e+">\n",f}):(b=/(\n\n|^\n?)(([ ]{0,3}([*+-]|\d+[.])[ \t]+)[^\r]+?(~0|\n{2,}(?=\S)(?![ \t]*(?:[*+-]|\d+[.])[ \t]+)))/g,a=a.replace(b,function(a,b,c,d){var e=b,f=c,g=d.search(/[*+-]/g)>-1?"ul":"ol",f=f.replace(/\n{2,}/g,"\n\n\n"),h=w(f);return h=e+"<"+g+">\n"+h+"</"+g+">\n",h})),a=a.replace(/~0/,""),a};w=function(a){return e++,a=a.replace(/\n{2,}$/,"\n"),a+="~0",a=a.replace(/(\n)?(^[ \t]*)([*+-]|\d+[.])[ \t]+([^\r]+?(\n{1,2}))(?=\n*(~0|\2([*+-]|\d+[.])[ \t]+))/gm,function(a,b,c,d,e){var f=e,g=b,h=c;return g||f.search(/\n{2,}/)>-1?f=o(L(f)):(f=x(L(f)),f=f.replace(/\n$/,""),f=p(f)),"<li>"+f+"</li>\n"}),a=a.replace(/~0/g,""),e--,a};var y=function(a){return a+="~0",a=a.replace(/(?:\n\n|^)((?:(?:[ ]{4}|\t).*\n+)+)(\n*[ ]{0,3}[^ \t\n]|(?=~0))/g,function(a,b,c){var d=b,e=c;return d=C(L(d)),d=M(d),d=d.replace(/^\n+/g,""),d=d.replace(/\n+$/g,""),d="<pre><code>"+d+"\n</code></pre>",A(d)+e}),a=a.replace(/~0/,""),a},z=function(a){return a+="~0",a=a.replace(/(?:^|\n)```(.*)\n([\s\S]*?)\n```/g,function(a,b,c){var d=b,e=c;return e=C(e),e=M(e),e=e.replace(/^\n+/g,""),e=e.replace(/\n+$/g,""),e="<pre><code"+(d?' class="'+d+'"':"")+">"+e+"\n</code></pre>",A(e)}),a=a.replace(/~0/,""),a},A=function(a){return a=a.replace(/(^\n+|\n+$)/g,""),"\n\n~K"+(d.push(a)-1)+"K\n\n"},B=function(a){return a=a.replace(/(^|[^\\])(`+)([^\r]*?[^`])\2(?!`)/gm,function(a,b,c,d,e){var f=d;return f=f.replace(/^([ \t]*)/g,""),f=f.replace(/[ \t]*$/g,""),f=C(f),b+"<code>"+f+"</code>"}),a},C=function(a){return a=a.replace(/&/g,"&amp;"),a=a.replace(/</g,"&lt;"),a=a.replace(/>/g,"&gt;"),a=N(a,"*_{}[]\\",!1),a},D=function(a){return a=a.replace(/(\*\*|__)(?=\S)([^\r]*?\S[*_]*)\1/g,"<strong>$2</strong>"),a=a.replace(/(\*|_)(?=\S)([^\r]*?\S)\1/g,"<em>$2</em>"),a},E=function(a){return a=a.replace(/((^[ \t]*>[ \t]?.+\n(.+\n)*\n*)+)/gm,function(a,b){var c=b;return c=c.replace(/^[ \t]*>[ \t]?/gm,"~0"),c=c.replace(/~0/g,""),c=c.replace(/^[ \t]+$/gm,""),c=o(c),c=c.replace(/(^|\n)/g,"$1  "),c=c.replace(/(\s*<pre>[^\r]+?<\/pre>)/gm,function(a,b){var c=b;return c=c.replace(/^  /mg,"~0"),c=c.replace(/~0/g,""),c}),A("<blockquote>\n"+c+"\n</blockquote>")}),a},F=function(a){a=a.replace(/^\n+/g,""),a=a.replace(/\n+$/g,"");var b=a.split(/\n{2,}/g),c=[],e=b.length;for(var f=0;f<e;f++){var g=b[f];g.search(/~K(\d+)K/g)>=0?c.push(g):g.search(/\S/)>=0&&(g=p(g),g=g.replace(/^([ \t]*)/g,"<p>"),g+="</p>",c.push(g))}e=c.length;for(var f=0;f<e;f++)while(c[f].search(/~K(\d+)K/)>=0){var h=d[RegExp.$1];h=h.replace(/\$/g,"$$$$"),c[f]=c[f].replace(/~K\d+K/,h)}return c.join("\n\n")},G=function(a){return a=a.replace(/&(?!#?[xX]?(?:[0-9a-fA-F]+|\w+);)/g,"&amp;"),a=a.replace(/<(?![a-z\/?\$!])/gi,"&lt;"),a},H=function(a){return a=a.replace(/\\(\\)/g,O),a=a.replace(/\\([`*_{}\[\]()>#+-.!])/g,O),a},I=function(a){return a=a.replace(/<((https?|ftp|dict):[^'">\s]+)>/gi,'<a href="$1">$1</a>'),a=a.replace(/<(?:mailto:)?([-.\w]+\@[-a-z0-9]+(\.[-a-z0-9]+)*\.[a-z]+)>/gi,function(a,b){return J(K(b))}),a},J=function(a){var b=[function(a){return"&#"+a.charCodeAt(0)+";"},function(a){return"&#x"+a.charCodeAt(0).toString(16)+";"},function(a){return a}];return a="mailto:"+a,a=a.replace(/./g,function(a){if(a=="@")a=b[Math.floor(Math.random()*2)](a);else if(a!=":"){var c=Math.random();a=c>.9?b[2](a):c>.45?b[1](a):b[0](a)}return a}),a='<a href="'+a+'">'+a+"</a>",a=a.replace(/">.+:/g,'">'),a},K=function(a){return a=a.replace(/~E(\d+)E/g,function(a,b){var c=parseInt(b);return String.fromCharCode(c)}),a},L=function(a){return a=a.replace(/^(\t|[ ]{1,4})/gm,"~0"),a=a.replace(/~0/g,""),a},M=function(a){return a=a.replace(/\t(?=\t)/g,"    "),a=a.replace(/\t/g,"~A~B"),a=a.replace(/~B(.+?)~A/g,function(a,b,c){var d=b,e=4-d.length%4;for(var f=0;f<e;f++)d+=" ";return d}),a=a.replace(/~A/g,"    "),a=a.replace(/~B/g,""),a},N=function(a,b,c){var d="(["+b.replace(/([\[\]\\])/g,"\\$1")+"])";c&&(d="\\\\"+d);var e=new RegExp(d,"g");return a=a.replace(e,O),a},O=function(a,b){var c=b.charCodeAt(0);return"~E"+c+"E"}},typeof module!="undefined"&&(module.exports=Showdown),typeof define=="function"&&define.amd&&define("showdown",function(){return Showdown});;/*
 * jquery.autogrow.js
 *
 * A plugin written for UserVoice that makes it easy to create textareas
 * that automatically resize to fit their contents.
 *
 * Based on Scott Moonen's original code for Prototype.js:
 *
 * <http://scottmoonen.com/2008/07/08/unobtrusive-javascript-expandable-textareas/>
 *
 * Author: John W. Long <john@uservoice.com>
 *
 */
;(function($) {
  var properties = ['-webkit-appearance', '-moz-appearance', '-o-appearance', 'appearance', 'font-family', 'font-size', 'font-weight', 'font-style', 'border', 'border-top', 'border-right', 'border-bottom', 'border-left', 'box-sizing', 'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'min-height', 'max-height', 'line-height']
  ,   escaper    = $('<span />')
  ;

  function escape(string) {
    return escaper.text(string).text().replace(/\n/g, '<br>');
  }

  $.fn.autogrow = function() {
    return this.filter('textarea').each(function() {
      if (!$(this).data('autogrow-applied')) {
        var textarea      = $(this)
        ,   initialHeight = textarea.innerHeight()
        ,   expander      = $('<div />')
        ,   timer         = null
        ;

        // Setup expander
        expander.css({'position': 'absolute', 'visibility': 'hidden', 'top': '-99999px'})
        $.each(properties, function(i, p) { expander.css(p, textarea.css(p)); });
        textarea.after(expander);

        // Setup textarea
        textarea.css({'overflow-y': 'hidden', 'resize': 'none', 'box-sizing': 'border-box'});

        // Sizer function
        function sizeTextarea() {
          clearTimeout(timer);
          timer = setTimeout(function() {
            var value = escape(textarea.val()) + '<br>z';
            expander.html(value);
            expander.css('width', textarea.innerWidth() + 2 + 'px');
            textarea.css('height', Math.max(expander.innerHeight(), initialHeight) + 2 + 'px');
          }, 100); // throttle by 100ms
        }

        // Bind sizer to IE 9+'s input event and Safari's propertychange event
        textarea.on('input.autogrow propertychange.autogrow', sizeTextarea);

        // Set the initial size
        sizeTextarea();

        // Record autogrow applied
        textarea.data('autogrow-applied', true);
      }
    });
  };
}(jQuery));
;
/*
 * Lightweight RTE - jQuery Plugin, version 1.2
 * Copyright (c) 2009 Andrey Gayvoronsky - http://www.gayvoronsky.com
 *
 * 2013 - Overidded by Alexandre Strzelewicz <as@unitech.io>
 */

Moleskin = {};

;(function($, global, undefined) {
  
  $.fn.moleskine = function(options) {
    return new lwRTE (this, options || {});;
  };

  var lwRTE = function (textarea, options) {
    this.width		= options.width  || $(textarea).width() || '100%';
    this.height		= options.height || 550;
    this.change         = this.onChange = options.change || function() {};
    this.output         = options.output || null;
    this.input          = options.input  || null;
    this.defaultMode    = options.defaultMode || 'html';
    this.autoGrow       = options.autoGrow || true;
    this.mode           = 'html';
    this.baseContent    = options.baseContent || '';
    this.main_el        = textarea;
    this.iframe		= null;
    this.iframe_doc	= null;
    this.textarea	= null;
    this.event		= null;
    this.range		= null;
    
    this.toolbars	= {
      rte: '', html : '', md : ''
    };

    if (typeof Showdown === 'undefined')
      throw new Error('Showdown.js must be included');

    if (typeof reMarked === 'undefined')
      throw new Error('Remarked.js must be included');

    this.showdown = new Showdown.converter();

    /**
     * @description HTML to Markdown config
     *
     * @api private
     */
    this.reMarked = new reMarked({
      link_list : false,  // render links as references
      h1_setext : false,  // underline h1 headers
      h2_setext : false,  // underline h2 headers
      h_atx_suf : false,  // header suffixes (###)
      gfm_code  : false,  // gfm code blocks (```)
      li_bullet : "-",    // list item bullet style
      hr_char   : "-",    // hr style
      indnt_str : "    ", // indentation string
      bold_char : "*",    // char used for strong
      emph_char : "_",    // char used for em
      gfm_del   : true,   // ~~strikeout~~ for <del>strikeout</del>
      gfm_tbls  : true,   // markdown-extra tables
      tbl_edges : false,  // show side edges on tables
      hash_lnks : false,  // anchors w/hash hrefs as links
      br_only   : false   // avoid using "  " as line break indicator
    });

    this.controls	= {
      rte: {
        "md-enable" : {hint : 'Markdown'},
        disable: {hint: 'Source editor'}
      },
      html: {
        enable: {hint: 'Visual editor'}
      },
      md : {
        "md-disable" : { hint: 'Switch to html' }
      }
    };
    
    $.extend(this.controls.rte  , MoleskinConf.rte_toolbar || {});
    $.extend(this.controls.html , MoleskinConf.html_toolbar || {});
    $.extend(this.controls.md   , MoleskinConf.md_toolbar || {});

    this.init(textarea);
  };

  lwRTE.prototype.init = function(textarea) {
    var self = this;
    
    if (document.designMode || document.contentEditable) {
      $(textarea).wrap($('<div></div>').addClass('rte-zone').width(this.width));
      //$('<div class="rte-resizer rte-resize-icon"><a href="#"></a></div>').insertAfter(textarea);      
      $(textarea).parents('.rte-zone').append(this.info_el);
      
      this.info_el = $(textarea).parent().find('rte-infos').html();
      this.textarea	= textarea;
      
      this.enable_design_mode();
      if (this.defaultMode == 'markdown')
        this.html_to_markdown();

      if (this.baseContent) {
        self.set_content(self.baseContent);
      }      
    }
  };

  lwRTE.prototype.get_markdown = function() {
    var self = this;
    
    if (this.mode == 'markdown')
      return $(self.textarea).val();
    else if (this.mode == 'rawhtml')
      return self.reMarked.render($(self.textarea).val());
    else
      return self.reMarked.render($('body', self.iframe_doc).html());
  };

  lwRTE.prototype.get_html = function() {
    var self = this;
    
    if (this.mode == 'markdown')
      return this.showdown.makeHtml($(self.textarea).val());
    else if (this.mode == 'rawhtml')
      return $(self.textarea).val();
    else
      return $('body', self.iframe_doc).html();
  };


  /*
   * HTML Raw -> HTML Preview
   */
  lwRTE.prototype.enable_design_mode = function() {
    var content = $(this.textarea).val();

    this.mode = 'html';    
    this.put_in_iframe(content);
  };

  /*
   * Markdown -> HTML
   */
  lwRTE.prototype.markdown_to_html = function(submit) {
    var content     = $(this.textarea).val();
    var htmlContent = this.showdown.makeHtml(content);

    this.mode = 'html';    
    this.put_in_iframe(htmlContent);
  };
  
  /*
   * HTML -> Markdown
   */
  lwRTE.prototype.html_to_markdown = function(submit) {
    var markdown;

    if (this.iframe_doc)
      markdown = this.reMarked.render($('body', this.iframe_doc).html());
    else
      markdown = $(this.textarea).val();
    
    this.mode = 'markdown';
    this.create_textarea(markdown, this.toolbars.md, this.controls.md);
  };

  /*
   * HTML Preview -> HTML Raw
   */
  lwRTE.prototype.disable_design_mode = function(submit) {
    var content = $('body', this.iframe_doc).html();

    this.mode = 'rawhtml';
    this.create_textarea(content, this.toolbars.md, this.controls.md);  
  };


  /*
   *
   * INTERNAL METHODS TO MANIPULATE THE IFRAME & STUFF
   *
   */


  /*
   * Send command to iframe
   */
  lwRTE.prototype.editor_cmd = function(command, args) {
    var self = this;
    this.iframe.contentWindow.focus();
    try {
      this.iframe_doc.execCommand(command, false, args);
    } catch(e) {
      console.log(e);
    }
    this.iframe.contentWindow.focus();
    self.change(null, self.get_content());
  };


  lwRTE.prototype.create_textarea = function(content, toolbar, controls, submit) {
    var self = this;

    this.textarea = (submit) ?
      $('<input type="hidden" />').get(0) : $('<textarea></textarea>');

    this.textarea.width(self.width).height(this.height).get(0);
    
    $(this.textarea).val(content);
    $(this.iframe).before(this.textarea);

    if (self.autoGrow == true)
      $(this.textarea).autogrow();
    
    $(this.textarea).keyup(function(event) {
      self.change(null, self.get_content());
    });
    
    if (!toolbar)
      toolbar	= this.create_toolbar(controls);

    if (submit != true) {
      $(this.iframe_doc).remove(); //fix 'permission denied' bug in IE7 (jquery cache)
      $(this.iframe).remove();
      this.iframe = this.iframe_doc = null;
      this.activate_toolbar(this.textarea, toolbar);
    }
    $(this.textarea).focus();
  };

  lwRTE.prototype.get_toolbar = function() {
    var editor = (this.iframe) ? $(this.iframe) : $(this.textarea);
    return (editor.prev().hasClass('rte-toolbar')) ? editor.prev() : null;
  };

  lwRTE.prototype.activate_toolbar = function(editor, tb) {
    var old_tb = this.get_toolbar();    
    if (old_tb) old_tb.remove();
    $(editor).before($(tb).clone(true));
  };

  lwRTE.prototype.update_iframe = function(content) {  
    var doc = "<html><head></head>" +
          '<body style="font-family: \'Helvetica Neue\', Helvetica, Arial, sans-serif; padding : 0; margin : 0; overflow:hidden;">' +
          content +
          "</body></html>";

    this.iframe_doc.open();
    this.iframe_doc.write(doc);
    this.iframe_doc.close();
  };

  lwRTE.prototype.put_in_iframe = function(content) {
    var self = this;

    self.iframe = null;

    // need to be created this way
    self.iframe	= document.createElement("iframe");
    self.iframe.frameBorder  = 0;
    self.iframe.frameMargin  = 0;
    self.iframe.framePadding = 0;
    self.iframe.width        = '100%';
    self.iframe.height       = self.height || '100%';
    self.iframe.src	= "javascript:void(0);";

    $(self.textarea).hide().after(self.iframe).remove();
    self.textarea	= null;

    if (!self.iframe.contentWindow)
      return;
    self.iframe_doc	= self.iframe.contentWindow.document;
    try {
      self.iframe_doc.designMode = 'on';
    } catch ( e ) {
      // Will fail on Gecko if the editor is placed in an hidden container element
      // The design mode will be set ones the editor is focused
      $(self.iframe_doc).focus(function() { self.iframe_doc.designMode(); } );
    }

    self.update_iframe(content);
    
    if(!self.toolbars.rte)
      self.toolbars.rte	= self.create_toolbar(self.controls.rte);
    self.activate_toolbar(self.iframe, self.toolbars.rte);

    // $(self.iframe).parents('form').submit( 
    //   function() { self.disable_design_mode(true); }
    // );

    $(self.iframe_doc).mouseup(function(event) { 
      if(self.iframe_doc.selection)
        self.range = self.iframe_doc.selection.createRange();  //store to restore later(IE fix)
      self.set_selected_controls( (event.target) ? event.target : event.srcElement, self.controls.rte); 
    });

    $(self.iframe_doc).blur(function(event){ 
      if(self.iframe_doc.selection) 
        self.range = self.iframe_doc.selection.createRange(); // same fix for IE as above
    });

    $(self.iframe_doc).keyup(function(event) {
      var iframe_height = $(self.iframe_doc).contents().find('body').height();
      var current_iframe_height = $(self.iframe).height();
      if (self.autoGrow == true && iframe_height > current_iframe_height) {
        $(self.iframe).height(iframe_height);
      }
      self.change(null, self.get_content());
      self.set_selected_controls( self.get_selected_element(), self.controls.rte);
    });

    // Mozilla CSS styling off
    if(!navigator.userAgent.match(/msie/i))
      self.editor_cmd('styleWithCSS', false);
  };

  lwRTE.prototype.toolbar_click = function(obj, control) {
    var fn        = control.exec;
    var args      = control.args || [];
    var self      = this;
    var is_select = (obj.tagName.toUpperCase() == 'SELECT');
    
    $('.rte-panel', this.get_toolbar()).remove();
    
    if(fn) {
      if(is_select)
        args.push(obj);

      try {
        fn.apply(this, args);
      } catch(e) {

      }
    } else if(this.iframe && control.command) {
      if(is_select) {
        args = obj.options[obj.selectedIndex].value;

        if(args.length <= 0)
	  return;
      }

      this.editor_cmd(control.command, args);
    }
  };

  lwRTE.prototype.create_toolbar = function(controls) {
    var self = this;
    var tb = $("<div></div>").addClass('rte-toolbar').width('100%').append($("<ul></ul>")).append($("<div></div>").addClass('clear'));
    self.tb = tb.get(0);
    var obj, li;

    for (var key in controls){
      if(controls[key].separator) {
        li = $("<li></li>").addClass('separator');
      } else {
        if(controls[key].init) {
	  try {
	    controls[key].init.apply(controls[key], [this]);
	  } catch(e) {
	  }
        }
        
        if(controls[key].select) {
	  obj = $(controls[key].select)
	    .change( function(e) {
	      self.event = e;
	      self.toolbar_click(this, controls[this.className]); 
	      return false;
	    });
        } else {
	  obj = $("<a href='#'></a>")
	    .attr('title', (controls[key].hint) ? controls[key].hint : key)
	    .attr('rel', key)
	    .click( function(e) {
	      self.event = e;
	      self.toolbar_click(this, controls[this.rel]); 
	      return false;
	    });
        }

        li = $("<li></li>").append(obj.addClass(key));
      }

      $("ul",tb).append(li);
    }


    $('.md-enable', tb).click(function() {
      self.html_to_markdown();
      return false;
    });

    $('.md-disable', tb).click(function() {
      self.markdown_to_html();
      return false;
    });

    $('.enable', tb).click(function() {
      self.enable_design_mode();
      return false; 
    });

    $('.disable', tb).click(function() {
      self.disable_design_mode();
      return false; 
    });

    return tb.get(0);
  };

  lwRTE.prototype.create_panel = function(title, width) {
    var self = this;
    var tb = self.get_toolbar();

    if(!tb)
      return false;

    $('.rte-panel', tb).remove();
    var drag, event;
    var left = self.event.pageX;
    var top = self.event.pageY;
    
    var panel	= $('<div></div>').hide().addClass('rte-panel').css({left: left, top: top});
    $('<div></div>')
      .addClass('rte-panel-title')
      .html(title)
      .append($("<a class='close' href='#'>X</a>")
	      .click( function() { panel.remove(); return false; }))
      .mousedown( function() { drag = true; return false; })
      .mouseup( function() { drag = false; return false; })
      .mousemove( 
        function(e) {
	  if(drag && event) {
	    left -= event.pageX - e.pageX;
	    top -=  event.pageY - e.pageY;
	    panel.css( {left: left, top: top} ); 
	  }

	  event = e;
	  return false;
        } 
      )
      .appendTo(panel);

    if(width)
      panel.width(width);

    tb.append(panel);
    return panel;
  };

  lwRTE.prototype.get_content = function() {
    var content;
    
    if (this.output == 'markdown')
      content = this.get_markdown();
    else if (this.output == 'html')
      content = this.get_html();
    else
      content = (this.iframe) ? $('body', this.iframe_doc).html() : $(this.textarea).val();
    
    return content;    
  };

  lwRTE.prototype.set_content = function(content) {
    var self = this;
    
    if (this.input == 'markdown') { 
      (this.iframe) ? $('body', this.iframe_doc).html(this.showdown.makeHtml(content)):$(this.textarea).val(content);
    }
    else if (this.input == 'html')
      
      (this.iframe) ? $('body', this.iframe_doc).html(content):$(this.textarea).val(this.reMarked.render(content));
    else
      throw new Error('input not defined in options [markdown, html]');

    if (self.autoGrow == true)
      $(self.iframe).height($(self.iframe_doc).contents().find('body').height());
  };

  lwRTE.prototype.set_selected_controls = function(node, controls) {
    var toolbar = this.get_toolbar();

    if(!toolbar)
      return false;
    
    var key, i_node, obj, control, tag, i, value;

    try {
      for (key in controls) {
        control = controls[key];
        obj = $('.' + key, toolbar);

        obj.removeClass('active');

        if(!control.tags)
	  continue;

        i_node = node;
        do {
	  if(i_node.nodeType != 1)
	    continue;

	  tag	= i_node.nodeName.toLowerCase();
	  if($.inArray(tag, control.tags) < 0 )
	    continue;

	  if(control.select) {
	    obj = obj.get(0);
	    if(obj.tagName.toUpperCase() == 'SELECT') {
	      obj.selectedIndex = 0;

	      for(i = 0; i < obj.options.length; i++) {
	        value = obj.options[i].value;
	        if(value && ((control.tag_cmp && control.tag_cmp(i_node, value)) || tag == value)) {
		  obj.selectedIndex = i;
		  break;
	        }
	      }
	    }
	  } else
	    obj.addClass('active');
        }  while(i_node = i_node.parentNode)
      }
    } catch(e) {
    }
    
    return true;
  };

  lwRTE.prototype.get_selected_element = function () {
    var node, selection, range;
    var iframe_win	= this.iframe.contentWindow;
    
    if (iframe_win.getSelection) {
      try {
        selection = iframe_win.getSelection();
        range = selection.getRangeAt(0);
        node = range.commonAncestorContainer;
      } catch(e){
        return false;
      }
    } else {
      try {
        selection = iframe_win.document.selection;
        range = selection.createRange();
        node = range.parentElement();
      } catch (e) {
        return false;
      }
    }

    return node;
  };

  lwRTE.prototype.get_selection_range = function() {
    var rng	= null;
    var iframe_window = this.iframe.contentWindow;
    this.iframe.focus();
    
    if(iframe_window.getSelection) {
      rng = iframe_window.getSelection().getRangeAt(0);
      if(navigator.userAgent.match(/opera/i)) { 
        var s = rng.startContainer;
        if(s.nodeType === Node.TEXT_NODE)
	  rng.setStartBefore(s.parentNode);
      }
    } else {
      this.range.select(); //Restore selection, if IE lost focus.
      rng = this.iframe_doc.selection.createRange();
    }

    return rng;
  };

  lwRTE.prototype.get_selected_text = function() {
    var iframe_win = this.iframe.contentWindow;

    if(iframe_win.getSelection)	
      return iframe_win.getSelection().toString();

    this.range.select(); //Restore selection, if IE lost focus.
    return iframe_win.document.selection.createRange().text;
  };

  lwRTE.prototype.get_selected_html = function() {
    var html = null;
    var iframe_window = this.iframe.contentWindow;
    var rng	= this.get_selection_range();

    if(rng) {
      if(iframe_window.getSelection) {
        var e = document.createElement('div');
        e.appendChild(rng.cloneContents());
        html = e.innerHTML;		
      } else {
        html = rng.htmlText;
      }
    }

    return html;
  };

  lwRTE.prototype.selection_replace_with = function(html) {
    var rng	= this.get_selection_range();
    var iframe_window = this.iframe.contentWindow;

    if (!rng) return;
    
    this.editor_cmd('removeFormat'); // we must remove formating or we will get empty format tags!

    if (iframe_window.getSelection) {
      rng.deleteContents();
      rng.insertNode(rng.createContextualFragment(html));
      this.editor_cmd('delete');
    } else {
      this.editor_cmd('delete');
      rng.pasteHTML(html);
    }
  };

  /**
   * @description Iframe resize
   *
   * @api private
   */
  var lwRTE_resizer = function(textarea) {
    this.drag = false;
    this.rte_zone = $(textarea).parents('.rte-zone');
  };

  lwRTE_resizer.mousedown = function(resizer, e) {
    resizer.drag = true;
    resizer.event = (typeof(e) == "undefined") ? window.event : e;
    resizer.rte_obj = $(".rte-resizer", resizer.rte_zone).prev().eq(0);
    $('body', document).css('cursor', 'se-resize');
    return false;
  };

  lwRTE_resizer.mouseup = function(resizer, e) {
    resizer.drag = false;
    $('body', document).css('cursor', 'auto');
    return false;
  };

  lwRTE_resizer.mousemove = function(resizer, e) {
    if(resizer.drag) {
      e = (typeof(e) == "undefined") ? window.event : e;
      var w = Math.max(1, resizer.rte_zone.width() + e.screenX - resizer.event.screenX);
      var h = Math.max(1, resizer.rte_obj.height() + e.screenY - resizer.event.screenY);
      resizer.rte_zone.width(w);
      resizer.rte_obj.height(h);
      resizer.event = e;
    }
    return false;
  };
  
})(jQuery, typeof window === "undefined" ? this : window);

// var resizer = new lwRTE_resizer(textarea);

// $(".rte-resizer a", $(textarea).parents('.rte-zone')).mousedown(function(e) {
//   $(document).mousemove(function(e) {
//     return lwRTE_resizer.mousemove(resizer, e);
//   });

//   $(document).mouseup(function(e) {
//     return lwRTE_resizer.mouseup(resizer, e);
//   });

//   return lwRTE_resizer.mousedown(resizer, e);
// });

;/*
 * Lightweight RTE - jQuery Plugin, v1.2
 * Basic Toolbars
 * Copyright (c) 2009 Andrey Gayvoronsky - http://www.gayvoronsky.com
 */

MoleskinConf = {};

;(function($, MoleskinConf, global, undefined) {
  
  MoleskinConf.rte_toolbar = {
    s1            : {separator: true},
    bold	  : {command: 'bold', tags:['b', 'strong']},
    italic        : {command: 'italic', tags:['i', 'em']},
    // s2            : {separator : true },
    // indent        : {command: 'indent'},
    s3            : {separator : true },
    orderedList   : {command: 'insertorderedlist', tags: ['ol'] },
    unorderedList : {command: 'insertunorderedlist', tags: ['ul'] },
    s4            : {separator : true },
    h1            : {command : 'formatblock', args : '<h1>'},
    h2            : {command : 'formatblock', args : '<h2>'},
    h3            : {command : 'formatblock', args : '<h3>'},
    s5            : {separator : true },
    image	  : {exec: lwrte_image, tags: ['img'] },
    link	  : {exec: lwrte_link, tags: ['a'] }
    // s6            : {separator : true },
    // removeFormat  : {exec: lwrte_unformat},
    // word	  : {exec: lwrte_cleanup_word},
    // clear	  : {exec: lwrte_clear}
  };

  MoleskinConf.html_toolbar = {
    s1    : {separator: true},
    word  : {exec: lwrte_cleanup_word},
    clear : {exec: lwrte_clear}
  };

  MoleskinConf.md_toolbar = {
    s1     : {separator: true},
    "md-enable"  : {exec: function(){
        window.open('https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet', '_blank');
    }}
  };

  var rte_tag		= '-rte-p-tag-';
  
  function moleskine_fullscreen() {
    $(this.textarea).toggleClass('fullscreen');
    $(this.textarea).prev().toggleClass('fullscreen');
  }

  function lwrte_image() {
    var self = this;
    var panel = self.create_panel('Insert image', 385);
    panel.append('\
                 <p><label>URL</label><input type="text" id="url" size="30" value=""><button id="file">Upload</button><button id="view">View</button></p>\
                 <div class="clear"></div>\
                 <p class="submit"><button id="ok">Ok</button><button id="cancel">Cancel</button></p>'
                ).show();

    var url = $('#url', panel);
    // var upload = $('#file', panel).upload( {
    //   autoSubmit: false,
    //   action: 'uploader.php',
    //   onSelect: function() {
    //     var file = this.filename();
    //     var ext = (/[.]/.exec(file)) ? /[^.]+$/.exec(file.toLowerCase()) : '';
    //     if(!(ext && /^(jpg|png|jpeg|gif)$/.test(ext))){
    //       alert('Invalid file extension');
    //       return;
    //     }

    //     this.submit();
    //   },
    //   onComplete: function(response) { 
    //     if(response.length <= 0)
    //       return;

    //     response	= eval("(" + response + ")");
    //     if(response.error && response.error.length > 0)
    //       alert(response.error);
    //     else
    //       url.val((response.file && response.file.length > 0) ? response.file : '');
    //   }
    // });

    $('#view', panel).click( function() {
      (url.val().length >0 ) ? window.open(url.val()) : alert("Enter URL of image to view");
      return false;
    }
	                   );

    $('#cancel', panel).click( function() { panel.remove(); return false;} );
    $('#ok', panel).click( 
      function() {
        var file = url.val();
        console.log('ok');
        self.editor_cmd('insertImage', file);
        panel.remove(); 
        return false;
      });
  }

  function lwrte_unformat() {
    this.editor_cmd('removeFormat');
    this.editor_cmd('unlink');
  }


  function lwrte_clear() {
    if (confirm('Clear Document?')) 
      this.set_content('');
  }

  function lwrte_cleanup_word() {
    this.set_content(cleanup_word(this.get_content(), true, true, true)); 
    
    function cleanup_word(s, bIgnoreFont, bRemoveStyles, bCleanWordKeepsStructure) {
      s = s.replace(/<o:p>\s*<\/o:p>/g, '') ;
      s = s.replace(/<o:p>[\s\S]*?<\/o:p>/g, '&nbsp;') ;

      // Remove mso-xxx styles.
      s = s.replace( /\s*mso-[^:]+:[^;"]+;?/gi, '' ) ;

      // Remove margin styles.
      s = s.replace( /\s*MARGIN: 0cm 0cm 0pt\s*;/gi, '' ) ;
      s = s.replace( /\s*MARGIN: 0cm 0cm 0pt\s*"/gi, "\"" ) ;

      s = s.replace( /\s*TEXT-INDENT: 0cm\s*;/gi, '' ) ;
      s = s.replace( /\s*TEXT-INDENT: 0cm\s*"/gi, "\"" ) ;

      s = s.replace( /\s*TEXT-ALIGN: [^\s;]+;?"/gi, "\"" ) ;

      s = s.replace( /\s*PAGE-BREAK-BEFORE: [^\s;]+;?"/gi, "\"" ) ;

      s = s.replace( /\s*FONT-VARIANT: [^\s;]+;?"/gi, "\"" ) ;

      s = s.replace( /\s*tab-stops:[^;"]*;?/gi, '' ) ;
      s = s.replace( /\s*tab-stops:[^"]*/gi, '' ) ;

      // Remove FONT face attributes.
      if (bIgnoreFont) {
        s = s.replace( /\s*face="[^"]*"/gi, '' ) ;
        s = s.replace( /\s*face=[^ >]*/gi, '' ) ;

        s = s.replace( /\s*FONT-FAMILY:[^;"]*;?/gi, '' ) ;
      }

      // Remove Class attributes
      s = s.replace(/<(\w[^>]*) class=([^ |>]*)([^>]*)/gi, "<$1$3") ;

      // Remove styles.
      if (bRemoveStyles)
        s = s.replace( /<(\w[^>]*) style="([^\"]*)"([^>]*)/gi, "<$1$3" ) ;

      // Remove style, meta and link tags
      s = s.replace( /<STYLE[^>]*>[\s\S]*?<\/STYLE[^>]*>/gi, '' ) ;
      s = s.replace( /<(?:META|LINK)[^>]*>\s*/gi, '' ) ;

      // Remove empty styles.
      s =  s.replace( /\s*style="\s*"/gi, '' ) ;

      s = s.replace( /<SPAN\s*[^>]*>\s*&nbsp;\s*<\/SPAN>/gi, '&nbsp;' ) ;

      s = s.replace( /<SPAN\s*[^>]*><\/SPAN>/gi, '' ) ;

      // Remove Lang attributes
      s = s.replace(/<(\w[^>]*) lang=([^ |>]*)([^>]*)/gi, "<$1$3") ;

      s = s.replace( /<SPAN\s*>([\s\S]*?)<\/SPAN>/gi, '$1' ) ;

      s = s.replace( /<FONT\s*>([\s\S]*?)<\/FONT>/gi, '$1' ) ;

      // Remove XML elements and declarations
      s = s.replace(/<\\?\?xml[^>]*>/gi, '' ) ;

      // Remove w: tags with contents.
      s = s.replace( /<w:[^>]*>[\s\S]*?<\/w:[^>]*>/gi, '' ) ;

      // Remove Tags with XML namespace declarations: <o:p><\/o:p>
      s = s.replace(/<\/?\w+:[^>]*>/gi, '' ) ;

      // Remove comments [SF BUG-1481861].
      s = s.replace(/<\!--[\s\S]*?-->/g, '' ) ;

      s = s.replace( /<(U|I|STRIKE)>&nbsp;<\/\1>/g, '&nbsp;' ) ;

      s = s.replace( /<H\d>\s*<\/H\d>/gi, '' ) ;

      // Remove "display:none" tags.
      s = s.replace( /<(\w+)[^>]*\sstyle="[^"]*DISPLAY\s?:\s?none[\s\S]*?<\/\1>/ig, '' ) ;

      // Remove language tags
      s = s.replace( /<(\w[^>]*) language=([^ |>]*)([^>]*)/gi, "<$1$3") ;

      // Remove onmouseover and onmouseout events (from MS Word comments effect)
      s = s.replace( /<(\w[^>]*) onmouseover="([^\"]*)"([^>]*)/gi, "<$1$3") ;
      s = s.replace( /<(\w[^>]*) onmouseout="([^\"]*)"([^>]*)/gi, "<$1$3") ;

      if (bCleanWordKeepsStructure) {
        // The original <Hn> tag send from Word is something like this: <Hn style="margin-top:0px;margin-bottom:0px">
        s = s.replace( /<H(\d)([^>]*)>/gi, '<h$1>' ) ;

        // Word likes to insert extra <font> tags, when using MSIE. (Wierd).
        s = s.replace( /<(H\d)><FONT[^>]*>([\s\S]*?)<\/FONT><\/\1>/gi, '<$1>$2<\/$1>' );
        s = s.replace( /<(H\d)><EM>([\s\S]*?)<\/EM><\/\1>/gi, '<$1>$2<\/$1>' );
      } else {
        s = s.replace( /<H1([^>]*)>/gi, '<div$1><b><font size="6">' ) ;
        s = s.replace( /<H2([^>]*)>/gi, '<div$1><b><font size="5">' ) ;
        s = s.replace( /<H3([^>]*)>/gi, '<div$1><b><font size="4">' ) ;
        s = s.replace( /<H4([^>]*)>/gi, '<div$1><b><font size="3">' ) ;
        s = s.replace( /<H5([^>]*)>/gi, '<div$1><b><font size="2">' ) ;
        s = s.replace( /<H6([^>]*)>/gi, '<div$1><b><font size="1">' ) ;

        s = s.replace( /<\/H\d>/gi, '<\/font><\/b><\/div>' ) ;

        // Transform <P> to <DIV>
        var re = new RegExp( '(<P)([^>]*>[\\s\\S]*?)(<\/P>)', 'gi' ) ;	// Different because of a IE 5.0 error
        s = s.replace( re, '<div$2<\/div>' ) ;

        // Remove empty tags (three times, just to be sure).
        // This also removes any empty anchor
        s = s.replace( /<([^\s>]+)(\s[^>]*)?>\s*<\/\1>/g, '' ) ;
        s = s.replace( /<([^\s>]+)(\s[^>]*)?>\s*<\/\1>/g, '' ) ;
        s = s.replace( /<([^\s>]+)(\s[^>]*)?>\s*<\/\1>/g, '' ) ;
      }

      return s;
    }
  }

  function lwrte_link() {
    var self = this;
    var panel = self.create_panel("Create link / Attach file", 385);

    panel.append('\
                 <p><label>URL</label><input type="text" id="url" size="30" value=""><button id="view">View</button></p>\
                 <div class="clear"></div>\
                 <p><label>Title</label><input type="text" id="title" size="30" value=""><label>Target</label><select id="target"><option value="">Default</option><option value="_blank">New window</option></select></p>\
                 <div class="clear"></div>\
                 <p class="submit"><button id="ok">Ok</button><button id="cancel">Cancel</button></p>').show();

    $('#cancel', panel).click( function() { panel.remove(); return false; } );

    var url = $('#url', panel);

    $('#view', panel).click(function() {
      (url.val().length >0 ) ? window.open(url.val()) : alert("Enter URL to view");
      return false;
    });

    $('#ok', panel).click( function() {
      var url = $('#url', panel).val();
      var target = $('#target', panel).val();
      var title = $('#title', panel).val();

      if(self.get_selected_text().length <= 0) {
        alert('Select the text you wish to link!');
        return false;
      }

      panel.remove(); 

      if (url.length <= 0)
        return false;

      self.editor_cmd('unlink');

      // we wanna well-formed linkage (<p>,<h1> and other block types can't be inside of link due to WC3)
      self.editor_cmd('createLink', url);
      var tmp = $('<span></span>').append(self.get_selected_html());

      if (target.length > 0)
        $('a[href*="' + url + '"]', tmp).attr('target', target);

      if (title.length > 0)
        $('a[href*="' + url + '"]', tmp).attr('title', title);

      $('a[href*="' + rte_tag + '"]', tmp).attr('href', url);

      //console.log($('a[href*="' + rte_tag + '"]').html());
      self.selection_replace_with(tmp.html());
      return false;
    });
  }

})(jQuery, MoleskinConf, typeof window === "undefined" ? this : window);
;
/* global angular */

/**
 * @doc module
 * @id MoleskineModule
 * @description MoleskineModule
 *
 * @author Alexandre Strzelewicz <as@unitech.io>
 */

var MoleskineModule = angular.module('MoleskineModule', []);

/**
 * @doc directive
 * @id MoleskineModule:moleskine
 * 
 * @description Moleskine directive for AngularJS
 * @author Alexandre Strzelewicz <as@unitech.io>
 */
MoleskineModule.directive('moleskine', [function() {
  var moleskine = {
    restrict : 'E',
    replace  : true,
    scope    : { 
      bindData    : '=',
      width       : '@',
      height      : '@',
      input       : '@',
      output      : '@',
      defaultMode : '@',
      cssClass    : '@',
      autoGrow    : '@',
      enable      : '='
    },
    template : '<textarea></textarea>'
  };
  
  moleskine.controller = ['$scope', function($scope, el, attrs) {
  }];

  function launch(scope, el) {
    
    var editor = $(el).moleskine({
      width         : scope.width,
      height        : scope.height,
      baseContent   : angular.copy(scope.bindData),
      defaultMode   : scope.defaultMode,
      input         : scope.input,
      output        : scope.output,
      autoGrow      : scope.autoGrow,
      change        : function(err, content) {
        var phase = scope.$root.$$phase;

        if (content == '') return;
        scope.bindData = content;
        
        if (!(phase == '$apply' || phase == '$digest')) {
          scope.$apply();
        }
      }
    });
  }
  moleskine.link = function(scope, el, attrs, ngModel) {

    /**
     * When cascading WYSIWYG
     */

    if (scope.enable !== undefined) {
      scope.$watch('enable', function(aft, bef) {      
        if (aft == bef) return;
        launch(scope, el);
      });
    }
    else {
      var a = scope.$watch('bindData', function(aft, bef) {
        console.log(aft, bef);
        if (aft == bef && aft === undefined) return;
        // Delay one tick
        a();
        setTimeout(function() {
          launch(scope, el);
        }, 1);
      });
    }

    
  };

  return moleskine;
}]);



import{_ as o,r as c,o as r,c as i,a as n,b as e,d as s,f as t}from"./app-e8bbc80c.js";const p={},l=n("h1",{id:"跨域资源共享",tabindex:"-1"},[n("a",{class:"header-anchor",href:"#跨域资源共享","aria-hidden":"true"},"#"),s(" 跨域资源共享")],-1),d=n("p",null,[n("code",null,"CORS"),s("，全称Cross-Origin Resource Sharing，是一种允许当前域（domain）的资源（比如html/js/web service）被其他域（domain）的脚本请求访问的机制，通常由于同域安全策略（the same-origin security policy）浏览器会禁止这种跨域请求。通常情况下，我们会依托nginx代理配置跨域共享，但是我们现在要分享一种更简单的方式")],-1),u=n("h2",{id:"安装",tabindex:"-1"},[n("a",{class:"header-anchor",href:"#安装","aria-hidden":"true"},"#"),s(" 安装")],-1),h={href:"https://www.npmjs.com/package/@aomex/cors",target:"_blank",rel:"noopener noreferrer"},k=n("img",{src:"https://img.shields.io/npm/v/@aomex/cors?logo=npm&label=@aomex/cors",alt:"npm"},null,-1),g=t(`<div class="language-bash" data-ext="sh"><pre class="language-bash"><code><span class="token function">pnpm</span> <span class="token function">add</span> @aomex/cors
</code></pre></div><h2 id="使用" tabindex="-1"><a class="header-anchor" href="#使用" aria-hidden="true">#</a> 使用</h2><div class="language-typescript line-numbers-mode" data-ext="ts"><pre class="language-typescript"><code><span class="token comment">// ./src/chains/web.chain.ts</span>
<span class="token keyword">import</span> <span class="token punctuation">{</span> cors <span class="token punctuation">}</span> <span class="token keyword">from</span> <span class="token string">&#39;@aomex/cors&#39;</span><span class="token punctuation">;</span>

<span class="token keyword">export</span> <span class="token keyword">const</span> appChain <span class="token operator">=</span> chain<span class="token punctuation">.</span>web<span class="token punctuation">.</span><span class="token function">mount</span><span class="token punctuation">(</span><span class="token function">cors</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="设置属性" tabindex="-1"><a class="header-anchor" href="#设置属性" aria-hidden="true">#</a> 设置属性</h2><h3 id="origin" tabindex="-1"><a class="header-anchor" href="#origin" aria-hidden="true">#</a> origin</h3><p><strong>类型：</strong> <code> ((ctx: WebContext) =&gt; string | PromiseLike&lt;string&gt;)</code> | <code>string</code> | <code>undefined</code><br></p><p>设置报头Access-Control-Allow-Origin，表示该响应的资源是否被允许与给定的来源（origin）共享。对于不包含凭据的请求，也可以设为星号(*)，表示同意任意跨源请求</p><h3 id="allowmethods" tabindex="-1"><a class="header-anchor" href="#allowmethods" aria-hidden="true">#</a> allowMethods</h3><p><strong>类型：</strong> <code>string[]</code> | <code>string</code><br><strong>默认值：</strong> <code>GET,HEAD,PUT,POST,DELETE,PATCH</code><br></p><p>设置报头Access-Control-Allow-Methods，表示客户端所要访问的资源允许使用的方法或方法列表</p><h3 id="exposeheaders" tabindex="-1"><a class="header-anchor" href="#exposeheaders" aria-hidden="true">#</a> exposeHeaders</h3><p><strong>类型：</strong> <code>string[]</code> | <code>string</code><br></p><p>响应标头 Access-Control-Expose-Headers 允许服务器指示那些响应标头可以暴露给浏览器中运行的脚本。默认情况下，只暴露安全列表的响应标头：</p><ul><li>Cache-Control</li><li>Content-Language</li><li>Content-Length</li><li>Content-Type</li><li>Expires</li><li>Last-Modified</li><li>Pragma</li></ul><p>我们可以传入更多额外的标头作为补充：</p><div class="language-typescript line-numbers-mode" data-ext="ts"><pre class="language-typescript"><code><span class="token function">cors</span><span class="token punctuation">(</span><span class="token punctuation">{</span>
  exposeHeaders<span class="token operator">:</span> <span class="token punctuation">[</span><span class="token string">&#39;Content-Encoding&#39;</span><span class="token punctuation">,</span> <span class="token string">&#39;Kuma-Revision&#39;</span><span class="token punctuation">]</span><span class="token punctuation">,</span>
<span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div>`,16),m={href:"https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Headers/Access-Control-Expose-Headers",target:"_blank",rel:"noopener noreferrer"},b=t(`<h3 id="allowheaders" tabindex="-1"><a class="header-anchor" href="#allowheaders" aria-hidden="true">#</a> allowHeaders</h3><p><strong>类型：</strong> <code>string[]</code> | <code>string</code><br></p><p>设置报头Access-Control-Allow-Headers</p><h3 id="maxage" tabindex="-1"><a class="header-anchor" href="#maxage" aria-hidden="true">#</a> maxAge</h3><p><strong>类型：</strong> <code>number</code> | <code>string</code><br></p><p>设置报头Access-Control-Max-Age，表示 Access-Control-Allow-Methods 和 Access-Control-Allow-Headers 提供的信息可以被缓存的最长时间（秒）。 <br> 如果值为<code>-1</code>，表示禁用缓存，则每次请求前都需要使用 OPTIONS 预检请求</p><h3 id="credentials" tabindex="-1"><a class="header-anchor" href="#credentials" aria-hidden="true">#</a> credentials</h3><p><strong>类型：</strong> <code> ((ctx: WebContext) =&gt; boolean | PromiseLike&lt;boolean&gt;)</code> | <code>boolean</code><br><strong>默认值：</strong> false<br></p><p>设置报头Access-Control-Allow-Credentials，Credentials可以代表 cookies、authorization headers 或 TLS client certificates，需要与客户端 XMLHttpRequest.withCredentials 或 Fetch API 的 credentials 选项结合使用</p><div class="language-typescript line-numbers-mode" data-ext="ts"><pre class="language-typescript"><code><span class="token comment">// XHR</span>
<span class="token keyword">const</span> xhr <span class="token operator">=</span> <span class="token keyword">new</span> <span class="token class-name">XMLHttpRequest</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
xhr<span class="token punctuation">.</span><span class="token function">open</span><span class="token punctuation">(</span><span class="token string">&#39;GET&#39;</span><span class="token punctuation">,</span> <span class="token string">&#39;https://aomex.js.org&#39;</span><span class="token punctuation">,</span> <span class="token boolean">true</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
xhr<span class="token punctuation">.</span>withCredentials <span class="token operator">=</span> <span class="token boolean">true</span><span class="token punctuation">;</span>
xhr<span class="token punctuation">.</span><span class="token function">send</span><span class="token punctuation">(</span><span class="token keyword">null</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

<span class="token comment">// Fetch</span>
<span class="token function">fetch</span><span class="token punctuation">(</span><span class="token string">&#39;https://aomex.js.org&#39;</span><span class="token punctuation">,</span> <span class="token punctuation">{</span>
  credentials<span class="token operator">:</span> <span class="token string">&#39;include&#39;</span><span class="token punctuation">,</span>
<span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

<span class="token comment">// Axios</span>
axios<span class="token punctuation">.</span><span class="token function">create</span><span class="token punctuation">(</span><span class="token punctuation">{</span>
  uri<span class="token operator">:</span> <span class="token string">&#39;https://aomex.js.org&#39;</span><span class="token punctuation">,</span>
  withCredentials<span class="token operator">:</span> <span class="token boolean">true</span><span class="token punctuation">,</span>
<span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h3 id="keepheadersonerror" tabindex="-1"><a class="header-anchor" href="#keepheadersonerror" aria-hidden="true">#</a> keepHeadersOnError</h3><p><strong>类型：</strong> <code>boolean</code><br><strong>默认值：</strong> true<br></p><p>抛出异常时把headers信息附加在<code>err.header</code>上</p><h3 id="securecontext" tabindex="-1"><a class="header-anchor" href="#securecontext" aria-hidden="true">#</a> secureContext</h3><p><strong>类型：</strong> <code>boolean</code><br><strong>默认值：</strong> false<br></p><p>响应头部增加 <code>Cross-Origin-Opener-Policy</code> 和 <code>Cross-Origin-Embedder-Policy</code> 这两个个报头</p><h3 id="privatenetworkaccess" tabindex="-1"><a class="header-anchor" href="#privatenetworkaccess" aria-hidden="true">#</a> privateNetworkAccess</h3><p><strong>类型：</strong> <code>boolean</code><br><strong>默认值：</strong> false<br></p>`,18),v=n("code",null,"Access-Control-Request-Private-Network",-1),x=n("code",null,"Access-Control-Allow-Private-Network",-1),f={href:"https://github.com/WICG/private-network-access",target:"_blank",rel:"noopener noreferrer"};function _(w,C){const a=c("ExternalLinkIcon");return r(),i("div",null,[l,d,u,n("p",null,[n("a",h,[k,e(a)])]),g,n("p",null,[s("更多详细信息请参考"),n("a",m,[s("MDN"),e(a)])]),b,n("p",null,[s("处理请求报头 "),v,s(" 并返回报头"),x,s("。想了解专有网络的内容请"),n("a",f,[s("点击这里"),e(a)])])])}const y=o(p,[["render",_],["__file","cors.html.vue"]]);export{y as default};

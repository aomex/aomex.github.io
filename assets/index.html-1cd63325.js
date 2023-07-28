import{_ as o,r as t,o as p,c,a as n,b as a,f as e}from"./app-3e488607.js";const l={},i=e('<h1 id="创建入口" tabindex="-1"><a class="header-anchor" href="#创建入口" aria-hidden="true">#</a> 创建入口</h1><p>对于需要主动触发的业务逻辑，我们必须执行类似<code>node schedule.js</code>这种命令。对于业务逻辑，执行单个js文件可能面临以下问题：</p><ul><li>无法复用中间件</li><li>参数接收过滤麻烦</li><li>执行时不清楚需要哪些参数</li><li>管理松散</li></ul><p>此时终端应用闪亮登场，让你的任务正规化，可视化</p><h2 id="安装" tabindex="-1"><a class="header-anchor" href="#安装" aria-hidden="true">#</a> 安装</h2>',5),r={href:"https://www.npmjs.com/package/@aomex/console",target:"_blank",rel:"noopener noreferrer"},d=n("img",{src:"https://img.shields.io/npm/v/@aomex/console?logo=npm&label=@aomex/console",alt:"npm"},null,-1),u={href:"https://www.npmjs.com/package/@aomex/commander",target:"_blank",rel:"noopener noreferrer"},m=n("img",{src:"https://img.shields.io/npm/v/@aomex/commander?logo=npm&label=@aomex/commander",alt:"npm"},null,-1),k=e(`<div class="language-bash" data-ext="sh"><pre class="language-bash"><code><span class="token function">pnpm</span> <span class="token function">add</span> @aomex/core @aomex/console @aomex/commander
<span class="token function">pnpm</span> <span class="token function">add</span> typescript @types/node <span class="token parameter variable">-D</span>
</code></pre></div><h2 id="初始化" tabindex="-1"><a class="header-anchor" href="#初始化" aria-hidden="true">#</a> 初始化</h2><p>执行如下命令：</p><div class="language-bash" data-ext="sh"><pre class="language-bash"><code>npx aomex <span class="token parameter variable">--init</span>
</code></pre></div><p>接着项目根目录会生成一个<code>aomex.json</code>的文件，它的作用就是根据不同的<code>p<wbr>rocess.env.NODE_ENV</code>找到你的入口文件</p><div class="language-json" data-ext="json"><pre class="language-json"><code><span class="token comment">// aomex.json</span>
<span class="token punctuation">{</span>
  <span class="token property">&quot;$schema&quot;</span><span class="token operator">:</span> <span class="token string">&quot;./node_modules/@aomex/console/config.json&quot;</span><span class="token punctuation">,</span>
  <span class="token property">&quot;cliEntry&quot;</span><span class="token operator">:</span> <span class="token punctuation">{</span>
    <span class="token property">&quot;production&quot;</span><span class="token operator">:</span> <span class="token string">&quot;./src/cli.js&quot;</span><span class="token punctuation">,</span>
    <span class="token property">&quot;default&quot;</span><span class="token operator">:</span> <span class="token string">&quot;./src/cli.ts&quot;</span>
  <span class="token punctuation">}</span>
<span class="token punctuation">}</span>
</code></pre></div><p>然后我们根据提示创建出入口文件：</p><div class="language-typescript line-numbers-mode" data-ext="ts"><pre class="language-typescript"><code><span class="token comment">// ./src/cli.ts</span>
<span class="token keyword">import</span> <span class="token punctuation">{</span> ConsoleApp <span class="token punctuation">}</span> <span class="token keyword">from</span> <span class="token string">&#39;@aomex/console&#39;</span><span class="token punctuation">;</span>

<span class="token keyword">const</span> app <span class="token operator">=</span> <span class="token keyword">new</span> <span class="token class-name">ConsoleApp</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

<span class="token keyword">const</span> code <span class="token operator">=</span> <span class="token keyword">await</span> app<span class="token punctuation">.</span><span class="token function">run</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
process<span class="token punctuation">.</span><span class="token function">exit</span><span class="token punctuation">(</span>code<span class="token punctuation">)</span><span class="token punctuation">;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>恭喜，终端应用已经初步成型。试着输入如下指令，看看会输出什么内容</p><div class="language-bash line-numbers-mode" data-ext="sh"><pre class="language-bash"><code>npx aomex <span class="token parameter variable">--help</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div></div></div>`,10);function h(v,g){const s=t("ExternalLinkIcon");return p(),c("div",null,[i,n("p",null,[n("a",r,[d,a(s)]),n("a",u,[m,a(s)])]),k])}const b=o(l,[["render",h],["__file","index.html.vue"]]);export{b as default};
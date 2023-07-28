import{_ as e,r as o,o as d,c,a as t,d as n,b as r,w as p,f as s}from"./app-3e488607.js";const l={},u=s(`<h1 id="验证器" tabindex="-1"><a class="header-anchor" href="#验证器" aria-hidden="true">#</a> 验证器</h1><p>有传递客户端参数的地方，就需要在执行业务逻辑之前验证数据是否符合业务的要求。对于不符合要求的参数，我们希望立即抛出异常。而通过验证时，得到的所有参数都是可信赖的。</p><blockquote><p>验证器是生成swagger文档的一部分</p></blockquote><p>首先我们看看验证器如何使用：</p><div class="language-typescript line-numbers-mode" data-ext="ts"><pre class="language-typescript"><code><span class="token keyword">import</span> <span class="token punctuation">{</span> rule<span class="token punctuation">,</span> validate <span class="token punctuation">}</span> <span class="token keyword">from</span> <span class="token string">&#39;@aomex/core&#39;</span><span class="token punctuation">;</span>

<span class="token keyword">const</span> untrusted <span class="token operator">=</span> <span class="token punctuation">{</span> name<span class="token operator">:</span> <span class="token string">&#39; hello  &#39;</span><span class="token punctuation">,</span> danger<span class="token operator">:</span> <span class="token string">&#39;rm -rf *&#39;</span> <span class="token punctuation">}</span><span class="token punctuation">;</span>
<span class="token keyword">const</span> trusted <span class="token operator">=</span> <span class="token keyword">await</span> <span class="token function">validate</span><span class="token punctuation">(</span>untrusted<span class="token punctuation">,</span> <span class="token punctuation">{</span>
  name<span class="token operator">:</span> rule<span class="token punctuation">.</span><span class="token function">string</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">trim</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">,</span>
<span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

<span class="token builtin">console</span><span class="token punctuation">.</span><span class="token function">log</span><span class="token punctuation">(</span>trusted<span class="token punctuation">)</span><span class="token punctuation">;</span> <span class="token comment">// { name: &#39;hello&#39; }</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>通常，你不需要使用直接<code>validate</code>函数，它会被集成到各个中间件中以满足不同的场景需求。同时<code>rule</code>集成了所有的验证器，我敢保证它你每天都需要和它打交道。</p><h2 id="string" tabindex="-1"><a class="header-anchor" href="#string" aria-hidden="true">#</a> string</h2><p><strong>描述：</strong> 字符串类型<br><strong>用法：</strong> <code>rule.string()</code><br></p><table><thead><tr><th>扩展</th><th>说明</th></tr></thead><tbody><tr><td><code>.trim()</code></td><td>删除字符串两边空格后再进行验证</td></tr><tr><td><code>.length(exact: number)</code><br><code>.length(min, max)</code><br><code>.length({min?,max?,exact?})</code></td><td>设置字符串长度</td></tr><tr><td><code>.allowEmpty()</code></td><td>把空字符串<code>&#39;&#39;</code>设置为合法的值</td></tr><tr><td><code>.match(reg:RegExp)</code></td><td>字符串需匹配正则表达式</td></tr><tr><td><code>.default(value:string)</code></td><td>如果值为空或者没传入，则使用该默认值，而且无需验证。<br>执行该方法后无需再执行<code>optional()</code></td></tr><tr><td><code>.optional()</code></td><td>允许数据是 <code>undefined, null, &#39;&#39;</code>或者<strong>不传</strong>，统一转换成<strong>undefined</strong></td></tr><tr><td><code>.nullable()</code></td><td>把<code>null</code>识别成合法的值</td></tr><tr><td><code>.docs({ ... })</code></td><td>扩展openapi的配置，允许多次调用，默认采用合并对象的形式收集配置。<br>如果需要覆盖原来的docs配置，则传递第二个参数为<code>replace</code></td></tr><tr><td><code>.transform(fn)</code></td><td>数据验证成功后触发，允许我们对数据进行最后的转换操作</td></tr></tbody></table><h2 id="number" tabindex="-1"><a class="header-anchor" href="#number" aria-hidden="true">#</a> number</h2><p><strong>描述：</strong> 数字类型，包括整型和浮点数<br><strong>用法：</strong> <code>rule.number()</code><br><strong>宽松模式</strong>: 默认开启。尝试将字符串转换为数字</p><table><thead><tr><th>扩展</th><th>说明</th></tr></thead><tbody><tr><td><code>.min(min,inclusive=true)</code></td><td>设置最小值。如果第二个参数<code>inclusive</code>设置为true，则对比时使用<code>&gt;=</code>判断，否则使用<code>&gt;</code>判断</td></tr><tr><td><code>.max(max,inclusive=true)</code></td><td>设置最小值。如果第二个参数<code>inclusive</code>设置为true，则对比时使用<code>&lt;=</code>判断，否则使用<code>&lt;</code>判断</td></tr><tr><td><code>.precision(decimals:number)</code></td><td>设置数字精度</td></tr><tr><td><code>.default(value: number)</code></td><td>如果值为空或者没传入，则使用该默认值，而且无需验证。<br>执行该方法后无需再执行<code>optional()</code></td></tr><tr><td><code>.optional()</code></td><td>允许数据是 <code>undefined, null, &#39;&#39;</code>或者<strong>不传</strong>，统一转换成<strong>undefined</strong></td></tr><tr><td><code>.nullable()</code></td><td>把<code>null</code>识别成合法的值</td></tr><tr><td><code>.docs({ ... })</code></td><td>扩展openapi的配置，允许多次调用，默认采用合并对象的形式收集配置。<br>如果需要覆盖原来的docs配置，则传递第二个参数为<code>replace</code></td></tr><tr><td><code>.strict(is=true)</code></td><td>是否开启严格模式。开启后数据必须是数字类型</td></tr><tr><td><code>.transform(fn)</code></td><td>数据验证成功后触发，允许我们对数据进行最后的转换操作</td></tr></tbody></table><h2 id="int" tabindex="-1"><a class="header-anchor" href="#int" aria-hidden="true">#</a> int</h2><p><strong>描述：</strong> 整数类型<br><strong>用法：</strong> <code>rule.int()</code><br><strong>宽松模式</strong>: 默认开启。尝试将字符串转换为数字</p><table><thead><tr><th>扩展</th><th>说明</th></tr></thead><tbody><tr><td><code>.min(min,inclusive=true)</code></td><td>设置最小值。如果第二个参数<code>inclusive</code>设置为true，则对比时使用<code>&gt;=</code>判断，否则使用<code>&gt;</code>判断</td></tr><tr><td><code>.max(max,inclusive=true)</code></td><td>设置最小值。如果第二个参数<code>inclusive</code>设置为true，则对比时使用<code>&lt;=</code>判断，否则使用<code>&lt;</code>判断</td></tr><tr><td><code>.default(value: number)</code></td><td>如果值为空或者没传入，则使用该默认值，而且无需验证。<br>执行该方法后无需再执行<code>optional()</code></td></tr><tr><td><code>.optional()</code></td><td>允许数据是 <code>undefined, null, &#39;&#39;</code>或者<strong>不传</strong>，统一转换成<strong>undefined</strong></td></tr><tr><td><code>.nullable()</code></td><td>把<code>null</code>识别成合法的值</td></tr><tr><td><code>.docs({ ... })</code></td><td>扩展openapi的配置，允许多次调用，默认采用合并对象的形式收集配置。<br>如果需要覆盖原来的docs配置，则传递第二个参数为<code>replace</code></td></tr><tr><td><code>.strict(is=true)</code></td><td>是否开启严格模式。开启后数据必须是数字类型</td></tr><tr><td><code>.transform(fn)</code></td><td>数据验证成功后触发，允许我们对数据进行最后的转换操作</td></tr></tbody></table><h2 id="bigint" tabindex="-1"><a class="header-anchor" href="#bigint" aria-hidden="true">#</a> bigint</h2><p><strong>描述：</strong> 大整型类型<br><strong>用法：</strong> <code>rule.bigint()</code><br><strong>宽松模式</strong>: 默认开启。尝试将字符串和数字转换为大整型</p><table><thead><tr><th>扩展</th><th>说明</th></tr></thead><tbody><tr><td><code>.default(value:bigint)</code></td><td>如果值为空或者没传入，则使用该默认值，而且无需验证。<br>执行该方法后无需再执行<code>optional()</code></td></tr><tr><td><code>.optional()</code></td><td>允许数据是 <code>undefined, null, &#39;&#39;</code>或者<strong>不传</strong>，统一转换成<strong>undefined</strong></td></tr><tr><td><code>.nullable()</code></td><td>把<code>null</code>识别成合法的值</td></tr><tr><td><code>.docs({ ... })</code></td><td>扩展openapi的配置，允许多次调用，默认采用合并对象的形式收集配置。<br>如果需要覆盖原来的docs配置，则传递第二个参数为<code>replace</code></td></tr><tr><td><code>.strict(is=true)</code></td><td>是否开启严格模式。开启后数据必须是大整型</td></tr><tr><td><code>.transform(fn)</code></td><td>数据验证成功后触发，允许我们对数据进行最后的转换操作</td></tr></tbody></table><h2 id="boolean" tabindex="-1"><a class="header-anchor" href="#boolean" aria-hidden="true">#</a> boolean</h2><p><strong>描述：</strong> 布尔值类型<br><strong>用法：</strong> <code>rule.boolean()</code><br><strong>真值:</strong> <code>1, &#39;1&#39;, true, &#39;true&#39;</code><br><strong>假值:</strong> <code>0, &#39;0&#39;, false, &#39;false&#39;</code><br></p><table><thead><tr><th>扩展</th><th>说明</th></tr></thead><tbody><tr><td><code>.trueValues([...])</code></td><td>设置新的真值</td></tr><tr><td><code>.falseValues([...])</code></td><td>设置新的假值</td></tr><tr><td><code>.default(value:boolean)</code></td><td>如果值为空或者没传入，则使用该默认值，而且无需验证。<br>执行该方法后无需再执行<code>optional()</code></td></tr><tr><td><code>.optional()</code></td><td>允许数据是 <code>undefined, null, &#39;&#39;</code>或者<strong>不传</strong>，统一转换成<strong>undefined</strong></td></tr><tr><td><code>.nullable()</code></td><td>把<code>null</code>识别成合法的值</td></tr><tr><td><code>.docs({ ... })</code></td><td>扩展openapi的配置，允许多次调用，默认采用合并对象的形式收集配置。<br>如果需要覆盖原来的docs配置，则传递第二个参数为<code>replace</code></td></tr><tr><td><code>.transform(fn)</code></td><td>数据验证成功后触发，允许我们对数据进行最后的转换操作</td></tr></tbody></table><h2 id="object" tabindex="-1"><a class="header-anchor" href="#object" aria-hidden="true">#</a> object</h2><p><strong>描述：</strong> 对象类型，每个属性都是验证器<br><strong>用法：</strong></p><div class="language-typescript line-numbers-mode" data-ext="ts"><pre class="language-typescript"><code><span class="token comment">// 只验证是个纯对象类型，并保留所有属性</span>
rule<span class="token punctuation">.</span><span class="token function">object</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

<span class="token comment">// 验证是个纯对象类型，并且只保留id和name这两个属性</span>
rule<span class="token punctuation">.</span><span class="token function">object</span><span class="token punctuation">(</span><span class="token punctuation">{</span> id<span class="token operator">:</span> rule<span class="token punctuation">.</span><span class="token function">int</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">,</span> name<span class="token operator">:</span> rule<span class="token punctuation">.</span><span class="token function">string</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><table><thead><tr><th>扩展</th><th>说明</th></tr></thead><tbody><tr><td><code>.parseFromString(is=true)</code></td><td>如果数据是字符串，则尝试使用<code>JSON.parse</code>转换为对象</td></tr><tr><td><code>.default(value:object)</code></td><td>如果值为空或者没传入，则使用该默认值，而且无需验证。<br>执行该方法后无需再执行<code>optional()</code></td></tr><tr><td><code>.optional()</code></td><td>允许数据是 <code>undefined, null, &#39;&#39;</code>或者<strong>不传</strong>，统一转换成<strong>undefined</strong></td></tr><tr><td><code>.nullable()</code></td><td>把<code>null</code>识别成合法的值</td></tr><tr><td><code>.docs({ ... })</code></td><td>扩展openapi的配置，允许多次调用，默认采用合并对象的形式收集配置。<br>如果需要覆盖原来的docs配置，则传递第二个参数为<code>replace</code></td></tr><tr><td><code>.strict(is=true)</code></td><td>是否开启严格模式。<strong>所有的子验证器都会同步为该状态</strong></td></tr><tr><td><code>.transform(fn)</code></td><td>数据验证成功后触发，允许我们对数据进行最后的转换操作</td></tr></tbody></table><h2 id="array" tabindex="-1"><a class="header-anchor" href="#array" aria-hidden="true">#</a> array</h2><p><strong>描述：</strong> 数组类型，包含一个元素验证器<br><strong>用法：</strong></p><div class="language-typescript line-numbers-mode" data-ext="ts"><pre class="language-typescript"><code><span class="token comment">// 只验证是个数组类型</span>
rule<span class="token punctuation">.</span><span class="token function">array</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

<span class="token comment">// 数字内每个元素都必须是字符串</span>
rule<span class="token punctuation">.</span><span class="token function">array</span><span class="token punctuation">(</span>rule<span class="token punctuation">.</span><span class="token function">string</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

<span class="token comment">// 数组的元素可以是空的，也可以是字符串类型</span>
rule<span class="token punctuation">.</span><span class="token function">array</span><span class="token punctuation">(</span>rule<span class="token punctuation">.</span><span class="token function">string</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">optional</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

<span class="token comment">// 数组哪每个元素都必须是对象，对象必须包含id和name属性</span>
rule<span class="token punctuation">.</span><span class="token function">array</span><span class="token punctuation">(</span><span class="token punctuation">{</span>
  id<span class="token operator">:</span> rule<span class="token punctuation">.</span><span class="token function">int</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">,</span>
  name<span class="token operator">:</span> rule<span class="token punctuation">.</span><span class="token function">string</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">,</span>
<span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div>`,28),i=t("thead",null,[t("tr",null,[t("th",null,"扩展"),t("th",null,"说明")])],-1),b=t("td",null,[t("code",null,".forceToArray({...})")],-1),k=t("tr",null,[t("td",null,[t("code",null,".default(value:Array)")]),t("td",null,[n("如果值为空或者没传入，则使用该默认值，而且无需验证。"),t("br"),n("执行该方法后无需再执行"),t("code",null,"optional()")])],-1),h=t("tr",null,[t("td",null,[t("code",null,".optional()")]),t("td",null,[n("允许数据是 "),t("code",null,"undefined, null, ''"),n("或者"),t("strong",null,"不传"),n("，统一转换成"),t("strong",null,"undefined")])],-1),g=t("tr",null,[t("td",null,[t("code",null,".nullable()")]),t("td",null,[n("把"),t("code",null,"null"),n("识别成合法的值")])],-1),m=t("tr",null,[t("td",null,[t("code",null,".docs({ ... })")]),t("td",null,[n("扩展openapi的配置，允许多次调用，默认采用合并对象的形式收集配置。"),t("br"),n("如果需要覆盖原来的docs配置，则传递第二个参数为"),t("code",null,"replace")])],-1),v=t("tr",null,[t("td",null,[t("code",null,".strict(is=true)")]),t("td",null,[n("是否开启严格模式。"),t("strong",null,"元素验证器也会同步为该状态")])],-1),f=t("tr",null,[t("td",null,[t("code",null,".transform(fn)")]),t("td",null,"数据验证成功后触发，允许我们对数据进行最后的转换操作")],-1),y=s(`<h4 id="forcetoarray" tabindex="-1"><a class="header-anchor" href="#forcetoarray" aria-hidden="true">#</a> forceToArray</h4><table><thead><tr><th>属性</th><th>类型</th><th>说明</th></tr></thead><tbody><tr><td>filter</td><td><code>(value:any)=&gt;boolean</code></td><td>过滤允许转换为数组的数据，不设置则代表全部允许</td></tr><tr><td>transform</td><td><code>(value:any)=&gt;any[]</code></td><td>转换的方式。默认方式：<br><code>(value) =&gt; {return [value]}</code></td></tr><tr><td>stringSeparator</td><td><code>string|RegExp</code></td><td>如果碰上字符串，则使用分割符转换为数组。优先级高于<code>transform</code>属性</td></tr><tr><td>stringCommaSeparator</td><td><code>boolean</code></td><td>如果碰上字符串，则使用<code>/\\s*,\\s*/</code>这个正则表达式来分割。优先级高于<code>stringSeparator</code>属性</td></tr></tbody></table><h2 id="buffer" tabindex="-1"><a class="header-anchor" href="#buffer" aria-hidden="true">#</a> buffer</h2><p><strong>描述：</strong> 缓冲区类型<br><strong>用法：</strong> <code>rule.buffer()</code><br></p><table><thead><tr><th>扩展</th><th>说明</th></tr></thead><tbody><tr><td><code>.default(value:Buffer)</code></td><td>如果值为空或者没传入，则使用该默认值，而且无需验证。<br>执行该方法后无需再执行<code>optional()</code></td></tr><tr><td><code>.optional()</code></td><td>允许数据是 <code>undefined, null, &#39;&#39;</code>或者<strong>不传</strong>，统一转换成<strong>undefined</strong></td></tr><tr><td><code>.nullable()</code></td><td>把<code>null</code>识别成合法的值</td></tr><tr><td><code>.docs({ ... })</code></td><td>扩展openapi的配置，允许多次调用，默认采用合并对象的形式收集配置。<br>如果需要覆盖原来的docs配置，则传递第二个参数为<code>replace</code></td></tr><tr><td><code>.transform(fn)</code></td><td>数据验证成功后触发，允许我们对数据进行最后的转换操作</td></tr></tbody></table><h2 id="enum" tabindex="-1"><a class="header-anchor" href="#enum" aria-hidden="true">#</a> enum</h2><p><strong>描述：</strong> 枚举类型<br><strong>用法：</strong> <code>rule.enum([&#39;a&#39;, &#39;b&#39;, &#39;c&#39;])</code><br></p><table><thead><tr><th>扩展</th><th>说明</th></tr></thead><tbody><tr><td><code>.default(value:T)</code></td><td>如果值为空或者没传入，则使用该默认值，而且无需验证。<br>执行该方法后无需再执行<code>optional()</code></td></tr><tr><td><code>.optional()</code></td><td>允许数据是 <code>undefined, null, &#39;&#39;</code>或者<strong>不传</strong>，统一转换成<strong>undefined</strong></td></tr><tr><td><code>.nullable()</code></td><td>把<code>null</code>识别成合法的值</td></tr><tr><td><code>.docs({ ... })</code></td><td>扩展openapi的配置，允许多次调用，默认采用合并对象的形式收集配置。<br>如果需要覆盖原来的docs配置，则传递第二个参数为<code>replace</code></td></tr><tr><td><code>.transform(fn)</code></td><td>数据验证成功后触发，允许我们对数据进行最后的转换操作</td></tr></tbody></table><h2 id="ip" tabindex="-1"><a class="header-anchor" href="#ip" aria-hidden="true">#</a> ip</h2><p><strong>描述：</strong> IP字符串类型，支持v4和v6版本<br><strong>用法：</strong></p><div class="language-typescript line-numbers-mode" data-ext="ts"><pre class="language-typescript"><code><span class="token comment">// ipv4</span>
rule<span class="token punctuation">.</span><span class="token function">ip</span><span class="token punctuation">(</span><span class="token string">&#39;v4&#39;</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
rule<span class="token punctuation">.</span><span class="token function">ip</span><span class="token punctuation">(</span><span class="token punctuation">[</span><span class="token string">&#39;v4&#39;</span><span class="token punctuation">]</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

<span class="token comment">// ipv6</span>
rule<span class="token punctuation">.</span><span class="token function">ip</span><span class="token punctuation">(</span><span class="token string">&#39;v6&#39;</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
rule<span class="token punctuation">.</span><span class="token function">ip</span><span class="token punctuation">(</span><span class="token punctuation">[</span><span class="token string">&#39;v6&#39;</span><span class="token punctuation">]</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

<span class="token comment">// ipv4 + ipv6</span>
rule<span class="token punctuation">.</span><span class="token function">ip</span><span class="token punctuation">(</span><span class="token punctuation">[</span><span class="token string">&#39;v4&#39;</span><span class="token punctuation">,</span> <span class="token string">&#39;v6&#39;</span><span class="token punctuation">]</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><table><thead><tr><th>扩展</th><th>说明</th></tr></thead><tbody><tr><td><code>.trim()</code></td><td>删除字符串两边空格后再进行验证</td></tr><tr><td><code>.match(reg:RegExp)</code></td><td>字符串需匹配正则表达式</td></tr><tr><td><code>.default(value:string)</code></td><td>如果值为空或者没传入，则使用该默认值，而且无需验证。<br>执行该方法后无需再执行<code>optional()</code></td></tr><tr><td><code>.optional()</code></td><td>允许数据是 <code>undefined, null, &#39;&#39;</code>或者<strong>不传</strong>，统一转换成<strong>undefined</strong></td></tr><tr><td><code>.nullable()</code></td><td>把<code>null</code>识别成合法的值</td></tr><tr><td><code>.docs({ ... })</code></td><td>扩展openapi的配置，允许多次调用，默认采用合并对象的形式收集配置。<br>如果需要覆盖原来的docs配置，则传递第二个参数为<code>replace</code></td></tr><tr><td><code>.transform(fn)</code></td><td>数据验证成功后触发，允许我们对数据进行最后的转换操作</td></tr></tbody></table><h2 id="email" tabindex="-1"><a class="header-anchor" href="#email" aria-hidden="true">#</a> email</h2><p><strong>描述：</strong> 电子邮件类型<br><strong>用法：</strong> <code>rule.email()</code><br></p><table><thead><tr><th>扩展</th><th>说明</th></tr></thead><tbody><tr><td><code>.trim()</code></td><td>删除字符串两边空格后再进行验证</td></tr><tr><td><code>.match(reg:RegExp)</code></td><td>字符串需匹配正则表达式</td></tr><tr><td><code>.default(value:string)</code></td><td>如果值为空或者没传入，则使用该默认值，而且无需验证。<br>执行该方法后无需再执行<code>optional()</code></td></tr><tr><td><code>.optional()</code></td><td>允许数据是 <code>undefined, null, &#39;&#39;</code>或者<strong>不传</strong>，统一转换成<strong>undefined</strong></td></tr><tr><td><code>.nullable()</code></td><td>把<code>null</code>识别成合法的值</td></tr><tr><td><code>.docs({ ... })</code></td><td>扩展openapi的配置，允许多次调用，默认采用合并对象的形式收集配置。<br>如果需要覆盖原来的docs配置，则传递第二个参数为<code>replace</code></td></tr><tr><td><code>.transform(fn)</code></td><td>数据验证成功后触发，允许我们对数据进行最后的转换操作</td></tr></tbody></table><h2 id="hash" tabindex="-1"><a class="header-anchor" href="#hash" aria-hidden="true">#</a> hash</h2><p><strong>描述：</strong> 哈希串类型<br><strong>用法：</strong> <code>rule.hash(algorithm: Hash)</code><br><strong>哈希算法：</strong> &quot;md5&quot; | &quot;md4&quot; | &quot;sha1&quot; | &quot;sha256&quot; | &quot;sha384&quot; | &quot;sha512&quot; | &quot;ripemd128&quot; | &quot;ripemd160&quot; | &quot;tiger128&quot; | &quot;tiger160&quot; | &quot;tiger192&quot; | &quot;crc32&quot; | &quot;crc32b&quot;</p><table><thead><tr><th>扩展</th><th>说明</th></tr></thead><tbody><tr><td><code>.trim()</code></td><td>删除字符串两边空格后再进行验证</td></tr><tr><td><code>.match(reg:RegExp)</code></td><td>字符串需匹配正则表达式</td></tr><tr><td><code>.default(value:Hash)</code></td><td>如果值为空或者没传入，则使用该默认值，而且无需验证。<br>执行该方法后无需再执行<code>optional()</code></td></tr><tr><td><code>.optional()</code></td><td>允许数据是 <code>undefined, null, &#39;&#39;</code>或者<strong>不传</strong>，统一转换成<strong>undefined</strong></td></tr><tr><td><code>.nullable()</code></td><td>把<code>null</code>识别成合法的值</td></tr><tr><td><code>.docs({ ... })</code></td><td>扩展openapi的配置，允许多次调用，默认采用合并对象的形式收集配置。<br>如果需要覆盖原来的docs配置，则传递第二个参数为<code>replace</code></td></tr><tr><td><code>.transform(fn)</code></td><td>数据验证成功后触发，允许我们对数据进行最后的转换操作</td></tr></tbody></table><h2 id="uuid" tabindex="-1"><a class="header-anchor" href="#uuid" aria-hidden="true">#</a> uuid</h2><p><strong>描述：</strong> 通用唯一识别码，共有6个版本<br><strong>用法：</strong></p><div class="language-typescript line-numbers-mode" data-ext="ts"><pre class="language-typescript"><code><span class="token comment">// 单个版本</span>
rule<span class="token punctuation">.</span><span class="token function">uuid</span><span class="token punctuation">(</span><span class="token string">&#39;v1&#39;</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
rule<span class="token punctuation">.</span><span class="token function">uuid</span><span class="token punctuation">(</span><span class="token string">&#39;v2&#39;</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
rule<span class="token punctuation">.</span><span class="token function">uuid</span><span class="token punctuation">(</span><span class="token string">&#39;v3&#39;</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
rule<span class="token punctuation">.</span><span class="token function">uuid</span><span class="token punctuation">(</span><span class="token string">&#39;v4&#39;</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
rule<span class="token punctuation">.</span><span class="token function">uuid</span><span class="token punctuation">(</span><span class="token string">&#39;v5&#39;</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

<span class="token comment">// 多版本一起支持</span>
rule<span class="token punctuation">.</span><span class="token function">uuid</span><span class="token punctuation">(</span><span class="token punctuation">[</span><span class="token string">&#39;v4&#39;</span><span class="token punctuation">,</span> <span class="token string">&#39;v5&#39;</span><span class="token punctuation">,</span> <span class="token string">&#39;v6&#39;</span><span class="token punctuation">]</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

<span class="token comment">// 全部支持</span>
rule<span class="token punctuation">.</span><span class="token function">uuid</span><span class="token punctuation">(</span><span class="token punctuation">[</span><span class="token string">&#39;v1&#39;</span><span class="token punctuation">,</span> <span class="token string">&#39;v2&#39;</span><span class="token punctuation">,</span> <span class="token string">&#39;v3&#39;</span><span class="token punctuation">,</span> <span class="token string">&#39;v4&#39;</span><span class="token punctuation">,</span> <span class="token string">&#39;v5&#39;</span><span class="token punctuation">]</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><table><thead><tr><th>扩展</th><th>说明</th></tr></thead><tbody><tr><td><code>.trim()</code></td><td>删除字符串两边空格后再进行验证</td></tr><tr><td><code>.match(reg:RegExp)</code></td><td>字符串需匹配正则表达式</td></tr><tr><td><code>.default(value:string)</code></td><td>如果值为空或者没传入，则使用该默认值，而且无需验证。<br>执行该方法后无需再执行<code>optional()</code></td></tr><tr><td><code>.optional()</code></td><td>允许数据是 <code>undefined, null, &#39;&#39;</code>或者<strong>不传</strong>，统一转换成<strong>undefined</strong></td></tr><tr><td><code>.nullable()</code></td><td>把<code>null</code>识别成合法的值</td></tr><tr><td><code>.docs({ ... })</code></td><td>扩展openapi的配置，允许多次调用，默认采用合并对象的形式收集配置。<br>如果需要覆盖原来的docs配置，则传递第二个参数为<code>replace</code></td></tr><tr><td><code>.transform(fn)</code></td><td>数据验证成功后触发，允许我们对数据进行最后的转换操作</td></tr></tbody></table><h2 id="ulid" tabindex="-1"><a class="header-anchor" href="#ulid" aria-hidden="true">#</a> ulid</h2><p><strong>描述：</strong> 可排序的全局唯一标识符，号称UUID的替代品<br><strong>用法：</strong> <code>rule.ulid()</code><br></p><table><thead><tr><th>扩展</th><th>说明</th></tr></thead><tbody><tr><td><code>.trim()</code></td><td>删除字符串两边空格后再进行验证</td></tr><tr><td><code>.match(reg:RegExp)</code></td><td>字符串需匹配正则表达式</td></tr><tr><td><code>.default(value:string)</code></td><td>如果值为空或者没传入，则使用该默认值，而且无需验证。<br>执行该方法后无需再执行<code>optional()</code></td></tr><tr><td><code>.optional()</code></td><td>允许数据是 <code>undefined, null, &#39;&#39;</code>或者<strong>不传</strong>，统一转换成<strong>undefined</strong></td></tr><tr><td><code>.nullable()</code></td><td>把<code>null</code>识别成合法的值</td></tr><tr><td><code>.docs({ ... })</code></td><td>扩展openapi的配置，允许多次调用，默认采用合并对象的形式收集配置。<br>如果需要覆盖原来的docs配置，则传递第二个参数为<code>replace</code></td></tr><tr><td><code>.transform(fn)</code></td><td>数据验证成功后触发，允许我们对数据进行最后的转换操作</td></tr></tbody></table><h2 id="one-of" tabindex="-1"><a class="header-anchor" href="#one-of" aria-hidden="true">#</a> one-of</h2><p><strong>描述：</strong> 从左往右匹配其中一种规则<br><strong>用法：</strong></p><div class="language-typescript line-numbers-mode" data-ext="ts"><pre class="language-typescript"><code><span class="token comment">// 字符串或者数字</span>
rule<span class="token punctuation">.</span><span class="token function">oneOf</span><span class="token punctuation">(</span><span class="token punctuation">[</span>rule<span class="token punctuation">.</span><span class="token function">string</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">,</span> rule<span class="token punctuation">.</span><span class="token function">number</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">]</span><span class="token punctuation">)</span><span class="token punctuation">;</span>

<span class="token comment">// 哈希 | uuid | ulid</span>
rule<span class="token punctuation">.</span><span class="token function">oneOf</span><span class="token punctuation">(</span><span class="token punctuation">[</span>rule<span class="token punctuation">.</span><span class="token function">hash</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">,</span> rule<span class="token punctuation">.</span><span class="token function">uuid</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">,</span> rule<span class="token punctuation">.</span><span class="token function">ulid</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">]</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><table><thead><tr><th>扩展</th><th>说明</th></tr></thead><tbody><tr><td><code>.default(value:string)</code></td><td>如果值为空或者没传入，则使用该默认值，而且无需验证。<br>执行该方法后无需再执行<code>optional()</code></td></tr><tr><td><code>.optional()</code></td><td>允许数据是 <code>undefined, null, &#39;&#39;</code>或者<strong>不传</strong>，统一转换成<strong>undefined</strong></td></tr><tr><td><code>.nullable()</code></td><td>把<code>null</code>识别成合法的值</td></tr><tr><td><code>.docs({ ... })</code></td><td>扩展openapi的配置，允许多次调用，默认采用合并对象的形式收集配置。<br>如果需要覆盖原来的docs配置，则传递第二个参数为<code>replace</code></td></tr><tr><td><code>.strict(is=true)</code></td><td>是否开启严格模式。<strong>子验证器也会同步为该状态</strong></td></tr><tr><td><code>.transform(fn)</code></td><td>数据验证成功后触发，允许我们对数据进行最后的转换操作</td></tr></tbody></table><h2 id="date-time" tabindex="-1"><a class="header-anchor" href="#date-time" aria-hidden="true">#</a> date-time</h2><p><strong>描述：</strong> 时间类型<br><strong>用法：</strong> <code>rule.dateTime()</code><br></p><table><thead><tr><th>扩展</th><th>说明</th></tr></thead><tbody><tr><td><code>.min(date,inclusive=true)</code></td><td>最小时间。如果第二个参数<code>inclusive</code>设置为true，则对比时使用<code>&gt;=</code>判断，否则使用<code>&gt;</code>判断</td></tr><tr><td><code>.max(date,inclusive=true)</code></td><td>最大时间。如果第二个参数<code>inclusive</code>设置为true，则对比时使用<code>&lt;=</code>判断，否则使用<code>&lt;</code>判断</td></tr><tr><td><code>.default(value:Date)</code></td><td>如果值为空或者没传入，则使用该默认值，而且无需验证。<br>执行该方法后无需再执行<code>optional()</code></td></tr><tr><td><code>.optional()</code></td><td>允许数据是 <code>undefined, null, &#39;&#39;</code>或者<strong>不传</strong>，统一转换成<strong>undefined</strong></td></tr><tr><td><code>.nullable()</code></td><td>把<code>null</code>识别成合法的值</td></tr><tr><td><code>.docs({ ... })</code></td><td>扩展openapi的配置，允许多次调用，默认采用合并对象的形式收集配置。<br>如果需要覆盖原来的docs配置，则传递第二个参数为<code>replace</code></td></tr><tr><td><code>.transform(fn)</code></td><td>数据验证成功后触发，允许我们对数据进行最后的转换操作</td></tr></tbody></table><h2 id="any" tabindex="-1"><a class="header-anchor" href="#any" aria-hidden="true">#</a> any</h2><p><strong>描述：</strong> 任意类型<br><strong>用法：</strong> <code>rule.any()</code><br><strong>类型限制：</strong> number | string | boolean | any[] | object | bigint | Buffer</p><table><thead><tr><th>扩展</th><th>说明</th></tr></thead><tbody><tr><td><code>.default(value:T)</code></td><td>如果值为空或者没传入，则使用该默认值，而且无需验证。<br>执行该方法后无需再执行<code>optional()</code></td></tr><tr><td><code>.optional()</code></td><td>允许数据是 <code>undefined, null, &#39;&#39;</code>或者<strong>不传</strong>，统一转换成<strong>undefined</strong></td></tr><tr><td><code>.nullable()</code></td><td>把<code>null</code>识别成合法的值</td></tr><tr><td><code>.docs({ ... })</code></td><td>扩展openapi的配置，允许多次调用，默认采用合并对象的形式收集配置。<br>如果需要覆盖原来的docs配置，则传递第二个参数为<code>replace</code></td></tr><tr><td><code>.transform(fn)</code></td><td>数据验证成功后触发，允许我们对数据进行最后的转换操作</td></tr></tbody></table>`,35);function x(_,q){const a=o("RouterLink");return d(),c("div",null,[u,t("table",null,[i,t("tbody",null,[t("tr",null,[b,t("td",null,[n("如果数据不是数组类型，则强制转换为数组形式。"),r(a,{to:"/core/validator.html#forcetoarray"},{default:p(()=>[n("查看参数")]),_:1})])]),k,h,g,m,v,f])]),y])}const E=e(l,[["render",x],["__file","validator.html.vue"]]);export{E as default};
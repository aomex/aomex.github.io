import{_ as e,o as a,c as t,e as d}from"./app-8f8e5849.js";const o={},r=d('<h1 id="为什么不用koa" tabindex="-1"><a class="header-anchor" href="#为什么不用koa" aria-hidden="true">#</a> 为什么不用koa</h1><p>多数新兴node.js框架都是基于koa，不得不承认它<strong>十分优秀</strong>。至于为什么不直接使用，有如下原因：</p><h4 id="_1-context委托太杂" tabindex="-1"><a class="header-anchor" href="#_1-context委托太杂" aria-hidden="true">#</a> 1. context委托太杂</h4><p>对于刚接触koa的新手来说，路由中使用的context包含了各种来自<code>request</code>和<code>response</code>的属性和方法，如<code>ctx.type</code>，<code>ctx.set</code>，<code>ctx.get</code>等一堆快捷操作。属性多，又爱使用简写，不熟练的开发者很难快速搞清楚它们的作用以及隶属于req还是res</p><h4 id="_2-类型提示不完善" tabindex="-1"><a class="header-anchor" href="#_2-类型提示不完善" aria-hidden="true">#</a> 2. 类型提示不完善</h4><p>虽然koa本身提供了<code>@types/koa</code>的库，但是对于中间件就无能为力了。挂载中间件后，context并不能提示出中间件提供的额外能力，以至于开发时很容易写错方法名和参数。部分中间件选择在全局向context注入类型，但其实这样很不好，因为即使你在某个路由中没有挂载这个中间件，也依然会有提示</p><h4 id="_3-缺乏终端能力" tabindex="-1"><a class="header-anchor" href="#_3-缺乏终端能力" aria-hidden="true">#</a> 3. 缺乏终端能力</h4><p>koa目前只能使用在编写api的场景，但如果你有一些cli的操作或者定时任务，就不得不集成第三方库。第三方库很难与koa完美融合，以至于一些逻辑没法复用，维护成本也更大</p><h1 id="为什么不用nest-js" tabindex="-1"><a class="header-anchor" href="#为什么不用nest-js" aria-hidden="true">#</a> 为什么不用nest.js</h1><p>nest算是一个很火的框架，拥有丰富的功能。至于为什么不直接使用，有如下原因：</p><h4 id="_1-装饰器太多" tabindex="-1"><a class="header-anchor" href="#_1-装饰器太多" aria-hidden="true">#</a> 1. 装饰器太多</h4><p>nest太依赖这玩意了，基本处于<code>无装饰器不编程</code>的状态。合理地使用装饰器可以让代码变得简洁，但是有一堆装饰器出现在某个方法上，对我而言就是灾难。装饰器的一个致命缺陷是<strong>没有类型提示</strong>，以及它还不是正式特性。</p><h4 id="_2-设计模式太重" tabindex="-1"><a class="header-anchor" href="#_2-设计模式太重" aria-hidden="true">#</a> 2. 设计模式太重</h4><p>源自Java的<code>Spring</code>框架，看起来也像前端的<code>Angular</code>框架，有一种你不懂设计模式那你就是废物的感觉。有这写模板代码的功夫，还不如直接上Java了。</p><h4 id="_3-概念太多" tabindex="-1"><a class="header-anchor" href="#_3-概念太多" aria-hidden="true">#</a> 3. 概念太多</h4><p>filters, guards, interceptors, pipes... 抱歉真的学不动了</p>',16),c=[r];function n(h,s){return a(),t("div",null,c)}const p=e(o,[["render",n],["__file","why-not.html.vue"]]);export{p as default};

##### 背景信息
对于WebView 中的 H5 向 小程序 的单方向通讯方式，腾讯官方给出了 如下方案：
![在这里插入图片描述](https://img-blog.csdnimg.cn/20190830135703122.png?x-oss-process=image/watermark,type_ZmFuZ3poZW5naGVpdGk,shadow_10,text_aHR0cHM6Ly9ibG9nLmNzZG4ubmV0L2Jhb3poYW5nMDA3,size_16,color_FFFFFF,t_70)
大家可以点击 [这里](https://developers.weixin.qq.com/miniprogram/dev/component/web-view.html) 查看官方文档 。

看到官方提供了解决办法，焦虑感顿时降低了不少。但仔细一看，不免又发愁起来：
> 网页向小程序 postMessage 时，会在特定时机（小程序后退、组件销毁、分享）触发并收到消息。e.detail = { data }，data是多次 postMessage 的参数组成的数组

这句话限定了小程序只能在应用后退、组件销毁、分享的时候才能捕捉到 H5 的消息，这个时候想要在执行什么操作，只怕用户已经不在之前的页面上了。更不用提如何将处理结果反馈给 H5 了。

如果程序是以小程序为功能主体，H5为功能副体、作为配角存的情况，这种方案多少或许还可能有用。但对于应用的主体内容，或者全部内容都由H5提供的开发者而言，就很不友好了。因为这个时候，作为 “壳” 的小程序，需要像工具箱一样能够及时为 H5 提供 H5 无法取得，但小程序能够相对容易获取的数据。

那有没有什么办法让小程序能够及时捕捉到 H5 发出的消息，同时向 H5 反馈处理结果呢？简单来说，有。

##### 及时捕捉消息
为了能够及时捕捉H5发出的消息，微信小程序需要能够以某种形态监听到 “消息发出” 这一动作。虽然 H5 可以调用 `postMessage` 方法，但微信小程序并不能主动感知，因而不符合我们的要求。

通观腾讯的官方文档，发现 H5 中还可以调用微信小程序的页面切换方法：`navigateTo` 以跳转到特定的微信小程序界面中。对于微信小程序的页面，则是可以向地址栏一样接收参数的，例如：
```js
/***********************************/
/************* H5端调用 *************/
/***********************************/

wx.miniProgram.navigateTo({
	url: "/pages/index/index?a=1&b=2"
});
```
而微信小程序的页面是可以在 onLoad 的时候捕获到传递的参数的：
![在这里插入图片描述](https://img-blog.csdnimg.cn/20190830142832622.png?x-oss-process=image/watermark,type_ZmFuZ3poZW5naGVpdGk,shadow_10,text_aHR0cHM6Ly9ibG9nLmNzZG4ubmV0L2Jhb3poYW5nMDA3,size_16,color_FFFFFF,t_70)
例如：
```js
Page({
  onLoad: function (options) {
    console.log(options); // -> {a: "1", b: "2"}
  }
});
```

这两者组合起来，恰好就满足了 “H5 向 小程序 发送消息，小程序 能够及时捕获消息” 这一诉求了。更为系统性的示例如下所示：
```js
/***********************************/
/************* H5端调用 *************/
/***********************************/

/**
 * 对象序列化
 * @param {Object} data 要序列化的对象
 * @returns {String}
 */
var serialize = function (data) {
	var s = "";
	for (var p in data)
		s += "&" + p + "=" + encodeURIComponent(data[p]).replace(/\+/gm, "%2B");
	s = s.length > 0 ? s.substring(1) : s;
	
	return s;
};

/* 通过跳转页面实现发送消息的目的 */
wx.miniProgram.navigateTo({
	url: "/pages/index/index?" + serialize({
		cmd: JSON.stringify({
			req: "H5Req_" + Date.now(), /* 本次消息的唯一编码，用于微信小程序将处理结果反馈给H5 */
			api: "do-sth", /* 消息的唯一编码，亦即业务指令 */
			params: params /* 业务指令的执行参数 */
		})
	})
});
```
```js
/************************************/
/********* 微信小程序端调用 *********/
/***********************************/

Page({
	onLoad: function(options){
		cmd = JSON.parse(decodeURIComponent(options.cmd));
		var req = cmd.req,
			api = cmd.api,
			params = cmd.params;
		
		switch(api){
			case "do-sth":
			
			/* do something with params */
			doSomething(params, function(result){
				/* 反馈处理结果 */
				//....
				
				/* 返回 webview 所在的页面 */
				wx.navigateBack();
			});
			break;
		}
	})
});
```

>你可能注意到了，这个方案牺牲了用户体验，借助了页面切换完成的消息传达。
>我当然知道这种体验有多糟糕，但毕竟没有其它选择。我企图用样式重载页面的切换效果，希望能够透明实现页面切换，但发现并不可行 - 微信并没有提供技术通道，使得我可以这样做。但愿随着小程序版本的迭代，腾讯能够给我们提供更为正统的解决方案吧。

##### 反馈处理结果
实现了消息的及时捕获，开发者就可以在微信小程序中根据 H5 发出的业务指令执行动作了。但动作结果如何向H5反馈呢？
看来看去，发现腾讯官方并没有提供从 微信小程序 到 H5 方向的消息反馈。那 webview 有没有其它能够为小程序所触发，同时H5能够感知的渠道呢？

想了想，还真有！
具体来说，就是微信小程序改写 webview 的 url 中的 hash 部分，将 hash 部分的取值替换为业务指令的处理结果。因为 hash 部分的改动既不会让 webview 离开或重新装在页面，也同时会让 webview 自动触发 `hashchange` 事件，而 H5 只要添加了该事件的监听句柄，就能够得到信息反馈。例如：

```js
/***********************************/
/************* H5端调用 *************/
/***********************************/

/**
 * H5 当前发出的的业务指令的唯一ID
 */
var currentReq = null;

/**
 * H5 发出业务指令时，指定的用于接收反馈消息的回调方法
 */
var currentCallback = null;
	
/**
 * 调用微信小程序
 * @param {String} api 业务指令
 * @param {Object} params 业务参数
 * @param {Function} [callback] 处理回调
 */
var callMiniProgram = function(api, params, callback){
	currentReq = randomString("H5Req_");
	currentCallback = typeof callback === "function"? callback: null;
	
	wx.miniProgram.navigateTo({
		url: "/pages/hybrid-page/hybrid?" + serialize({
			cmd: JSON.stringify({
				req: currentReq,
				api: api,
				params: params
			})
		})
	});
};

/* 监听 hashchange 事件，用于接收微信小程序给出的处理反馈 */
window.addEventListener("hashchange", function(e){
	/* 如果尚未发出指令，或 hash 不是微信小程序给出的操作反馈，那么 hashchange 可能是网页内部触发的，忽略即可 */
	if(null == currentReq || !location.hash.startsWith("#" + currentReq + "="))
		return;
	
	/* 解析hash中包含的操作反馈（除操作反馈外，还有随机数等） */
	var params = {};
	location.hash.substring(1).split("&").forEach(function(pair){
		var tmp = pair.split("=");
		if(tmp.length < 1)
			return;
		
		params[decodeURIComponent(tmp[0].trim())] = decodeURIComponent(tmp[1].trim());
	});
	
	/* 取出操作反馈正文，并触发可能存在的回调方法 */
	var result = params[currentReq];
	if(typeof currentCallback !== "function"){
		console.log(currentReq + " -> " + result);
	}else
		currentCallback(result);
});

/* 向微信小程序发出消息 */
callMiniProgram("do-sth", {
	param1: "value1",
	param2: true
});
```

```js
/************************************/
/********* 微信小程序端调用 *********/
/***********************************/

/**
 * 给指定的url设置hash
 * @param {String} url 要设置hash的url
 * @param {String} hash 要设置的hash
 */
var setUrlHash = function (url, hash) {
	if (null == url || "" === (url = String(url).trim()))
		return url;

	var hashIndex = url.indexOf("#");
	var urlWithoutQueryAndHash;

	if (-1 == hashIndex) {
		urlWithoutQueryAndHash = url;
	} else {
		urlWithoutQueryAndHash = url.substring(0, hashIndex);
	}

	return urlWithoutQueryAndHash + "#" + hash;
};

Page({
	onLoad: fu
	nction(options){
		cmd = JSON.parse(decodeURIComponent(options.cmd));
		var req = cmd.req,
			api = cmd.api,
			params = cmd.params;
		
		switch(api){
			case "do-sth":
			
			/* do something with params */
			doSomething(params, function(result){
				/* 反馈处理结果 */
				var pages = getCurrentPages();
				var page = pages[pages.length - 1];/* 当前页面是接收 H5 消息的页面，上一个页面是 webview 所在页面 */
				
				/**
				 * v=Date.now() 是为了加入干扰，保证每次的hash都会发生变化，
				 * 规避连续请求的 req 和 处理结果都相同导致hashchange 没有被触发的风险
				 */
				var newWebViewUrl = setUrlHash(
					page.data.webviewSrc,
					req + "=" + encodeURIComponent(result) + "&v=" + Date.now()
				);
				
				page.setData({
					webviewSrc: newWebViewUrl
				});
				
				/* 返回 webview 所在的页面 */
				wx.navigateBack();
			});
			break;
		}
	})
});
```
效果怎么样呢？我们一起看一看：
![在这里插入图片描述](https://img-blog.csdnimg.cn/20190830153859962.gif)

对于上述逻辑，我已经抽取并定义好了方法，托管在 [Github](https://github.com/RedTeapot/WxMiniProgramHybrid) ，开发者按照给定操作步骤操作即可：
>【H5 - 配置步骤】
>1. 网页引入 miniProgramHybrid.js
>2. 在需要通讯的地方调用API：miniProgramHybrid.call("业务指令", {参数集合}, 可选的回调方法)\

>【微信小程序 - 配置步骤】
>1. 将 index，hybrid-lib 与 hybrid-page 并行存放至小程序工程的 pages 目录下
>2. 在微信小程序的 app.json 文件中添加页面："pages/hybrid-page/hybrid" 和 "pages/index/index"
>3. 调整微信小程序 index 页面中 data 的 webviewSrc 字段取值为 webview 要打开的 H5 链接地址

>【微信小程序 - 业务指令开发步骤】
>1. 在 hybrid-lib/handler.js 中根据样例定义业务指令

##### 注意事项
通讯模型借助了 H5 的 hashchange 事件（hash 将被更改为形如：#H5Req_xxxx&v=1567077985338的形态），如果H5页面的既有逻辑也有使用 hashchange，请注意区分、识别。
var handler = require("./handler.js");

/**
 * 
 * 【H5 与 小程序 的通讯模型】
 * H5 主动通知小程序，并索要处理结果，小程序被动响应H5的请求，处理完毕后告知H5。
 * 
 * 【H5 主动通知 小程序 的方法】
 * 1. H5 引入微信的 js-sdk（1.3.2版本及以上）
 * 2. H5 监听浏览器的 hashchange 事件，用于捕获小程序的处理结果
 * 3. H5 通过调用 js-sdk 中的 api：wx.miniProgram.navigateTo({url: '微信小程序中响应H5请求的页面路径?cmd={req: "H5请求ID", api: "业务指令", params: {参数集合}}'})，实现主动通知的目的
 * 其中，H5请求ID，代表由H5指定的，代表本次交互的，可被自己所识别的，时空唯一的hash，用于标识本次请求。如果没有指定该ID，则微信小程序将默认为：“miniProgramResult”。
 * 
 * 【小程序 响应 H5 请求的方法】
 * 1. 在微信小程序中建立单独的页面，并在 onLoad 事件中解析 cmd 参数，用于响应 H5 请求
 * 2. 使用 cmd 中的 api 更新此数据交换区中的 req 字段，并将 result 重置为空
 * 3. 根据 cmd 中的 api 和 params 执行对应的业务指令
 * 4. 得到执行结果后，无论成功或失败，更新此处设置的数据交换区，处理结果。约定："0" 代表处理成功，其它取值代表处理失败的错误码。如果业务指令返回null或undefined，则认为处理成功，使用 "0" 代替
 * 5. 调用 wx.navigateBack() 方法，返回 webview 所在的页面
 * 
 * 【小程序 通知 H5 处理结果的方法】
 * 1. webview 所在的页面监听 onShow() 方法，使得当页面再次可见时，能够检索此处设置的数据交换区
 * 2. 如果 req 不为空，则更新 webview 中的src，使其地址中 hash 变更为 #[req的取值]=[result的取值]&v=[时间戳]
 */

/**
 * 生成随机字符串
 * @param {String} [prefix=""] 前缀
 * @param {Number} [len=10] 除前缀外，要随机生成的字符串的长度
 * @returns {String}
 */
var randomString = (function () {
  var i = 0, tailLength = 2;
  var alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";

  var getTail = function () {
    var s = (i++).toString(36);
    if (i > Math.pow(16, tailLength))
      i = 0;

    return s.substring(s.length - tailLength);
  };

  return function (prefix, len) {
    if (arguments.length < 2)
      len = 10;
    if (arguments.length < 1)
      prefix = "";

    var minLen = tailLength + 1;
    if (len < minLen)
      throw new Error("Length should not be little than " + minLen);
    len -= tailLength;

    var str = "";
    while (len-- > 0) {
      var index = Math.floor(Math.random() * alphabet.length);
      str += alphabet.charAt(index);
    }

    return prefix + str + getTail();
  };
})();

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

/**
 * 返回webview所在的页面
 */
var navigateBackToWebviewPage = function () {
  wx.navigateBack();
};

/**
 * 存储在全局变量中的，用于在小程序和H5之间交换数据的字段的key
 */
var hybridSwpKey = "__hybridSwp__" + randomString();

/**
 * 含有 webview 的小程序页面的 onShow 监听
 * 该页面应当在 Page() 的 data 字段中定义 名称为 webviewSrc 的字段，以代表要打开的H5的链接地址
 */
var onShow_webviewPageInMiniProgram = function(){
  var swp = getApp()[hybridSwpKey];
  if(null == swp || typeof swp !== "object")
    return;

  var req = swp.req;
  if(null == req || "" === (req = String(req.trim())))
    return;
  
  var pages = getCurrentPages();
  var page = pages[pages.length - 1];

  console.log(">> " + swp.result);
  var newWebViewUrl = setUrlHash(page.data.webviewSrc, req + "=" + encodeURIComponent(swp.result) + "&v=" + Date.now());
  console.log("Set webview url to " + newWebViewUrl);
  
  page.setData({
    webviewSrc: newWebViewUrl
  });
};

/**
 * 处理 H5 请求的小程序页面的 onLoad 监听
 * @param {Object} options 页面参数
 */
var onLoad_requestHandlePageInMiniProgram = function (options){
  var cmd = options.cmd;
  if (null == cmd || "" === (cmd = cmd.trim())) {
    console.warn("No command found");
    navigateBackToWebviewPage();
    return;
  }

  cmd = JSON.parse(decodeURIComponent(cmd));
  var api = cmd.api;
  if (null == api || "" === (api = String(api).trim())) {
    console.warn("No api found");
    navigateBackToWebviewPage();
    return;
  }

  if (!(api in handler)) {
    navigateBackToWebviewPage();
    return;
  }

  var req = cmd.req;
  if (null == req || "" === (req = String(req).trim()))
    req = "miniProgramResult";

  var appInstance = getApp();
  appInstance[hybridSwpKey] = {
    req: req,
    result: ""
  };

  handler[api](cmd.params || {}, function(rst){
    if (null === rst || undefined === rst)
      rst = "0";
    rst = String(rst);

    var pages = getCurrentPages();
    var page = pages[pages.length - 2];/* webview 页面 */

    console.log(">> " + rst);
    var newWebViewUrl = setUrlHash(page.data.webviewSrc, req + "=" + encodeURIComponent(rst) + "&v=" + Date.now());
    console.log("Set webview url to " + newWebViewUrl);

    page.setData({
      webviewSrc: newWebViewUrl
    });

    navigateBackToWebviewPage();
  });
};

module.exports = {
  onLoad_requestHandlePageInMiniProgram: onLoad_requestHandlePageInMiniProgram
};
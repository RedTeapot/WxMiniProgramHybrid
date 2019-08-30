var apis = {};

/**
 * @callback APIAction 业务指令的执行动作
 * @param {Object} [params] 由H5提供过来的参数集合
 * @param {Function} [callback] 小程序业务处理完毕后需要调用的回调方法，用于通知H5操作完成
 */

/**
 * 定义业务指令
 * @param {String} api 要定义的业务指令的代码，由 H5 发出，小程序 接收
 * @param {APIAction} action 业务指令的执行动作
 */
var defineApi = function(api, action){
  if(api in apis)
    throw new Error("API: '" + api + "' exists already");
  
  if(typeof action !== "function")
    throw new Error("Invalid action. Type of 'Function' is required");

  apis[api] = action;
};

/**
 * 样例：打开相机
 */
defineApi("open-camera", function (params, callback) {
  params.msgFromMiniProgram = "OK!";
  params.timeFromMiniProgram = Date.now();

  setTimeout(function () {
    callback(JSON.stringify(params));
  }, 1000);
});

module.exports = apis;